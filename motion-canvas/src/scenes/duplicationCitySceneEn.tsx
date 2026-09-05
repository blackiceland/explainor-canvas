import {makeScene2D} from '@motion-canvas/2d';
import {all, chain, createSignal, easeInOutSine, easeOutCubic, linear, waitFor} from '@motion-canvas/core';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Fog,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  NoToneMapping,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {createThreeView} from '../core/three/ThreeCanvas';
import {DollyRig, EndSparks, Ribbons, arc, evalLink, rng, scheduleFlashes} from '../core/three/hydra';
import {Screen} from '../core/theme';
import {applyBackground} from '../core/utils';
import {mountVignette} from '../core/components/SoftVignette';

// ═══════════════════════════════════════════════════════════════════════════
// ГОРОД — акт 7 «Don't Fight Duplication». ПЕРВЫЙ ПРОХОД: город и ОДНА
// геройская связь. Перехода код → окно → код здесь ещё нет; сцена начинается
// там, где он закончится — на одном светящемся окне.
//
// Тезис сцены целиком лежит в контрасте: связь, которую держат в голове люди,
// вспыхивает и гаснет; связь, которую запомнила система, горит. Поэтому
// геройская нить вспыхивает ТРИЖДЫ — и на третий раз не гаснет. Пока зритель
// не прочитал правило на одной нити, остальную сеть зажигать нельзя: двадцать
// линий разом читаются как «включили сеть», а не как «система запомнила».
//
// Всё состояние — чистая функция сигналов MC, пересчёт в onRender: сцена
// обязана скраббиться. Ни одного таймера по реальному времени.
//
// ⚠️ Здания — это НЕ модели. Каждое здание есть дважды: россыпь точек-окон на
// фасадах (видимое) и чёрная коробка-окклюдер (невидимая). Без окклюдера
// дальний фасад просвечивает сквозь ближний, и город превращается в лес
// полупрозрачных столбиков. Коробка почти цвета фона — она не рисует здание,
// она только прячет то, что за ним.
// ═══════════════════════════════════════════════════════════════════════════

const D2R = Math.PI / 180;
const QUALITY = 1.5;                       // 2880×1620 — bloom по 4K не окупается
const RW = Screen.width * QUALITY;
const RH = Screen.height * QUALITY;

const BG = '#0B0C10';                      // тот же графит, что у applyBackground

// Город
const GRID = 26;
const CELL = 62;                           // метр = юнит: улица + пятно застройки
const CITY_R = (GRID * CELL) / 2;          // 806
const FLOOR = 3.6;                         // шаг этажа
const COLW = 5.0;                          // шаг оконной колонны
const KEEP = 0.72;                         // доля занятых слотов оконной решётки
const LIT = 0.22;                          // доля ярких окон

// Герой
const HERO_X = -30, HERO_Z = 24, HERO_W = 36, HERO_D = 30, HERO_H = 104;
const HERO_WIN = new Vector3(HERO_X + 7, 48, HERO_Z + HERO_D / 2 + 0.8);

// Камера: один непрерывный жест — подъём и отъезд. Азимут постоянный, и это
// не случайно: геройское окно посажено на тот фасад, который смотрит в камеру
// финального кадра, поэтому подниматься можно вообще без доворота.
const AZ = 22 * D2R;
const EL0 = 5 * D2R, EL1 = 15 * D2R;
const LEN0 = 26, LEN1 = 1050;
const CITY_TGT = new Vector3(0, 80, 0);

// Связи
const LINKS = 120;
const SEGS = 14;                           // сегментов на нить (дуга, не прямая)
const ARC = 0.055;                         // подъём дуги в долях длины
const NET_LEN = 22;                        // длина сетевого времени, сек
const EVENTS = 45;                         // всего вспышек у фоновых нитей за NET_LEN
const HERO_FLASH = [2.0, 7.4, 13.4];
const FLASH_DUR = 1.25;

// ⚠️ Цвета держим бледными сознательно. Всё это складывается АДДИТИВНО и потом
// проходит bloom: любой намёк на янтарь в исходнике на выходе даёт золото, а
// золотой ночной город — это открытка, а не графит с кремовым.
const C_WIN_DIM = new Color('#8FA0B8');    // холодное неосвещённое окно
const C_WIN_LIT = new Color('#F4EEE0');    // кремовое освещённое
const C_FLICK = '#EDE8DA';                 // мерцающая нить
const C_PERSIST = '#FFDCAE';               // постоянная — чуть теплее и ярче

interface B {x: number; z: number; w: number; d: number; h: number}

interface Link {
  ai: number; bi: number;
  a: Vector3; b: Vector3;
}

const DITHER = {
  uniforms: {tDiffuse: {value: null as any}},
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      gl_FragColor = vec4(c.rgb + n / 255.0, c.a);
    }
  `,
};

// Композер живёт ВНЕ сцены. Сцена-генератор пересоздаётся на каждом сбросе и
// перемотке; если создавать композер внутри, каждый сброс оставляет на видео-
// карте пару полноразмерных таргетов. Сцена и камера у пассов подменяются.
let _composer: EffectComposer | null = null;
let _renderPass: RenderPass | null = null;

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ── Город ────────────────────────────────────────────────────────────────
  const rnd = rng(20260903);
  const bld: B[] = [{x: HERO_X, z: HERO_Z, w: HERO_W, d: HERO_D, h: HERO_H}];

  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const cx = (i - (GRID - 1) / 2) * CELL;
      const cz = (j - (GRID - 1) / 2) * CELL;
      const r = Math.hypot(cx, cz);
      if (r > CITY_R) continue;                              // круглая застройка: у города нет углов
      if (Math.hypot(cx - HERO_X, cz - HERO_Z) < 58) continue; // место героя
      if (rnd() < 0.16) continue;                            // пустыри
      const x = cx + (rnd() - 0.5) * CELL * 0.24;
      const z = cz + (rnd() - 0.5) * CELL * 0.24;
      // Лёгкий центральный уклон: без него поле одинаковых столбиков, с ним
      // читается город. Но без силуэтов-символов — просто плотнее и выше.
      const bias = 1 - Math.min(1, r / CITY_R);
      const tall = rnd() < 0.07 + bias * 0.15;
      bld.push({
        x, z,
        w: 22 + rnd() * 22,
        d: 22 + rnd() * 22,
        h: tall ? 58 + rnd() * 86 * (0.5 + bias) : 18 + rnd() * 42,
      });
    }
  }

  // Окна на фасадах по оконной решётке (этаж × колонна), а не в объёме:
  // объёмная россыпь читается как трёхмерная столбчатая диаграмма.
  const pos: number[] = [];
  const brt: number[] = [];
  const siz: number[] = [];
  const rad: number[] = [];
  const her: number[] = [];
  let MAXR = 0;

  const pushWin = (x: number, y: number, z: number, bright: number, size: number, hero: number) => {
    const r = Math.hypot(x - HERO_WIN.x, y - HERO_WIN.y, z - HERO_WIN.z);
    if (r > MAXR) MAXR = r;
    pos.push(x, y, z);
    brt.push(bright);
    siz.push(size);
    rad.push(r);
    her.push(hero);
  };

  for (const b of bld) {
    const floors = Math.max(3, Math.floor((b.h - 6) / FLOOR));
    for (let f = 0; f < 4; f++) {
      const alongX = f >= 2;
      const span = alongX ? b.w : b.d;
      const cols = Math.max(2, Math.floor(span / COLW));
      const sgn = f % 2 === 0 ? 1 : -1;
      for (let fl = 0; fl < floors; fl++) {
        const y = 4 + fl * FLOOR + (rnd() - 0.5) * 0.5;
        for (let c = 0; c < cols; c++) {
          if (rnd() > KEEP) continue;
          const t = ((c + 0.5) / cols - 0.5) * span + (rnd() - 0.5) * 0.7;
          const lit = rnd() < LIT;
          const bright = lit ? 0.55 + rnd() * 0.5 : 0.05 + rnd() * 0.12;
          if (alongX) pushWin(b.x + t, y, b.z + sgn * (b.d / 2 + 0.8), bright, 1, 0);
          else pushWin(b.x + sgn * (b.w / 2 + 0.8), y, b.z + t, bright, 1, 0);
        }
      }
    }
  }
  // Геройское окно — то самое, в которое свернулся код. Оно крупнее и
  // не подчиняется фронту раскрытия: с него всё начинается.
  pushWin(HERO_WIN.x, HERO_WIN.y, HERO_WIN.z, 1.15, 6, 1);

  const winGeo = new BufferGeometry();
  winGeo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  winGeo.setAttribute('aBright', new Float32BufferAttribute(brt, 1));
  winGeo.setAttribute('aSize', new Float32BufferAttribute(siz, 1));
  winGeo.setAttribute('aRadius', new Float32BufferAttribute(rad, 1));
  winGeo.setAttribute('aHero', new Float32BufferAttribute(her, 1));

  const winMat = new ShaderMaterial({
    uniforms: {
      uRevealR: {value: 0},
      uEdge: {value: 40},
      uScale: {value: 5.0},
      uDim: {value: C_WIN_DIM.clone().convertSRGBToLinear()},
      uLit: {value: C_WIN_LIT.clone().convertSRGBToLinear()},
    },
    vertexShader: `
      attribute float aBright;
      attribute float aSize;
      attribute float aRadius;
      attribute float aHero;
      uniform float uRevealR;
      uniform float uEdge;
      uniform float uScale;
      varying float vAlpha;
      varying float vBright;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float d = -mv.z;
        gl_Position = projectionMatrix * mv;
        float vis = aHero > 0.5 ? 1.0 : 1.0 - smoothstep(uRevealR, uRevealR + uEdge, aRadius);
        // Дымка только для глубины. Сильнее — и город на общем плане исчезает:
        // он и так теряет яркость на субпиксельных точках.
        float fog = 1.0 - 0.45 * smoothstep(500.0, 3000.0, d);
        vAlpha = vis * fog;
        vBright = aBright;
        float maxSize = mix(9.0, 84.0, step(0.5, aHero));
        // Нижний порог 1.5 px — не про яркость, а про дрожание: точка меньше
        // пикселя мерцает на каждом шаге камеры и город начинает «кипеть».
        gl_PointSize = clamp(uScale * aSize * (260.0 / max(d, 1.0)), 1.5, maxSize);
      }
    `,
    fragmentShader: `
      uniform vec3 uDim;
      uniform vec3 uLit;
      varying float vAlpha;
      varying float vBright;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float r = length(q);
        if (r > 0.5) discard;
        float core = 1.0 - smoothstep(0.10, 0.5, r);
        vec3 col = mix(uDim, uLit, clamp(vBright, 0.0, 1.0));
        gl_FragColor = vec4(col * vBright * 2.4, core * vAlpha);
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    depthTest: true,
    depthWrite: false,
  });

  const windows = new Points(winGeo, winMat);
  windows.frustumCulled = false;
  windows.renderOrder = 1;

  // Окклюдеры: один InstancedMesh, один вызов отрисовки, цвет почти фоновый.
  const boxGeo = new BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const mass = new InstancedMesh(boxGeo, new MeshBasicMaterial({color: '#06070A'}), bld.length);
  const mtx = new Matrix4();
  for (let i = 0; i < bld.length; i++) {
    const b = bld[i];
    mtx.makeScale(b.w, b.h, b.d);
    mtx.setPosition(b.x, 0, b.z);
    mass.setMatrixAt(i, mtx);
  }
  mass.instanceMatrix.needsUpdate = true;
  mass.frustumCulled = false;
  mass.renderOrder = 0;

  // ── Связи ────────────────────────────────────────────────────────────────
  // Пары только далёкие, и не больше двух на здание — иначе сами собой
  // заводятся хабы, и сеть читается как граф зависимостей.
  const used = new Map<number, number>();
  const links: Link[] = [];
  const top = (b: B) => new Vector3(b.x, b.h * 0.62 + rnd() * b.h * 0.28, b.z);

  // Геройская связь: один конец — ГЕРОЙСКОЕ ОКНО, тот самый код, откуда мы
  // приехали. Второй выбран поперёк взгляда камеры, чтобы нить прошла через
  // центр кадра во всю ширину, а не в глубину.
  const px = HERO_X + 520 * Math.cos(AZ);
  const pz = HERO_Z - 520 * Math.sin(AZ);
  let hi = 1, hd = Infinity;
  for (let i = 1; i < bld.length; i++) {
    const dd = Math.hypot(bld[i].x - px, bld[i].z - pz);
    if (dd < hd) {hd = dd; hi = i;}
  }
  links.push({
    ai: 0, bi: hi,
    a: HERO_WIN.clone(),
    b: top(bld[hi]),
  });
  used.set(0, 1);
  used.set(hi, 1);

  for (let guard = 0; guard < 20000 && links.length < LINKS; guard++) {
    const ai = 1 + ((rnd() * (bld.length - 1)) | 0);
    const bi = 1 + ((rnd() * (bld.length - 1)) | 0);
    if (ai === bi) continue;
    if ((used.get(ai) ?? 0) >= 2 || (used.get(bi) ?? 0) >= 2) continue;
    const dx = bld[bi].x - bld[ai].x, dz = bld[bi].z - bld[ai].z;
    const dist = Math.hypot(dx, dz);
    if (dist < 300 || dist > 650) continue;
    // Нить, направленная в камеру, проецируется почти вертикальной чертой и
    // читается как чужеродный прямой элемент среди дуг. Азимут камеры
    // постоянный, так что отсечь такие пары можно один раз на генерации.
    if (Math.abs((dx * Math.sin(AZ) + dz * Math.cos(AZ)) / dist) > 0.72) continue;
    used.set(ai, (used.get(ai) ?? 0) + 1);
    used.set(bi, (used.get(bi) ?? 0) + 1);
    links.push({ai, bi, a: top(bld[ai]), b: top(bld[bi])});
  }

  // Расписание фоновых вспышек: одновременно в кадре 3–6 нитей, иначе город
  // превращается в кашу. Геройская — по своему списку.
  const flashes = scheduleFlashes(rnd, links.length, {events: EVENTS, length: NET_LEN});
  flashes[0] = HERO_FLASH.slice();

  // Нити — сплошная лента Hydra (не LineSegments2: круглые торцы отрезков на
  // аддитиве садятся бусинами, нить читается пунктиром). Дуга: прямая между
  // домами на таком расстоянии читается как чертёжная линия, дуга — как связь.
  const polylines = links.map(l => arc(l.a, l.b, SEGS, ARC));
  const threads = new Ribbons(polylines, {
    res: new Vector2(RW, RH),
    halfWidth: 1.6,
    colorA: C_FLICK, colorB: C_PERSIST, holdBoost: 0.15,
    fade: 0.08,
  });
  threads.mesh.renderOrder = 3;

  // Концевые искры: на вспышке загораются оба дома, а не только нить между
  // ними — «два дома на разных концах города вспыхивают одновременно».
  const sparks = new EndSparks(polylines, {px: 16, refDist: 260, minPx: 1, maxPx: 26, color: C_FLICK, brightness: 1.2});
  sparks.points.renderOrder = 2;

  const scene3 = new Scene();
  // Дымка — только для окклюдеров (шейдерные материалы её не читают). Ближние
  // здания остаются чёрными силуэтами, дальние растворяются в фоне: без этого
  // коробки читаются как плоские серые карточки, а не как масса города.
  scene3.fog = new Fog(BG, 350, 2800);
  scene3.add(mass, windows, sparks.points, threads.mesh);

  const camera = new PerspectiveCamera(34, Screen.width / Screen.height, 1, 6000);
  const rig = new DollyRig({az: AZ, el0: EL0, el1: EL1, len0: LEN0, len1: LEN1, fov0: 34, fov1: 34, tgt0: HERO_WIN, tgt1: CITY_TGT}, camera);

  // ── Сигналы ──────────────────────────────────────────────────────────────
  const camP = createSignal(0);          // 0 → 1 — вся траектория подъёма
  const reveal = createSignal(0);        // фронт раскрытия города
  const netT = createSignal(0);          // сетевое время, сек
  const flickerD = createSignal(0);      // сила мерцающих связей
  const heroHold = createSignal(0);      // геройская нить осталась гореть
  const persistRatio = createSignal(0);  // доля остальных, что залипнут (такт 4)

  const threeView = createThreeView({
    width: Screen.width,
    height: Screen.height,
    quality: QUALITY,
    scene: scene3,
    camera,
    background: BG,
    onRender: (renderer, s, c) => {
      if (!_composer) {
        _renderPass = new RenderPass(s, c);
        _composer = new EffectComposer(renderer);
        _composer.setSize(RW, RH);
        _composer.addPass(_renderPass);
        // Порог обязателен: тусклые окна не должны светиться вовсе, яркие —
        // едва, нити — заметно. Без порога город превращается в туман.
        _composer.addPass(new UnrealBloomPass(new Vector2(RW, RH), 0.55, 0.40, 0.45));
        _composer.addPass(new OutputPass());
        // Дизер последним. Ореол вокруг окна — это перепад в пару десятков
        // уровней, растянутый на пол-экрана: в 8 битах он распадается на
        // концентрические кольца. Шум в ±1/255 их разбивает и сам не виден.
        _composer.addPass(new ShaderPass(DITHER));
      }
      _renderPass!.scene = s;
      _renderPass!.camera = c;
      // ⚠️ БЕЗ тонмаппинга. ACES тянет кремовый в золото на любой яркости
      // выше единицы, а весь город складывается аддитивно и эту единицу
      // проходит постоянно. Пусть ядра честно уходят в белый.
      renderer.toneMapping = NoToneMapping;
      renderer.toneMappingExposure = 1.0;

      // Камера: одно движение (Hydra DollyRig). Длина растёт экспоненциально —
      // так отъезд ощущается равномерным на всех масштабах.
      const {len} = rig.apply(camP());

      // Фронт раскрытия привязан к дистанции камеры: он всегда чуть шире
      // кадра, поэтому город именно ПРОСТУПАЕТ по мере отъезда, а не
      // включается целиком за пределами видимости.
      // Сдвиг на −45: при reveal = 0 фронт УЖЕ за спиной у геройского окна,
      // иначе соседние окна того же фасада проступают сами собой и первый
      // кадр перестаёт быть одним окном в темноте.
      const rr = Math.min(reveal() * (len * 2.6 + 85) - 45, MAXR + 400);
      winMat.uniforms.uRevealR.value = rr;
      winMat.uniforms.uEdge.value = 40 + Math.max(0, rr) * 0.35;

      // Связи
      const state = {
        t: netT(), flicker: flickerD(), heroHold: heroHold(), persistRatio: persistRatio(),
        flashDur: FLASH_DUR,
        latchLevel: 0.94,
      };
      for (let i = 0; i < links.length; i++) {
        const {alpha, hold} = evalLink(i, 0, flashes[i], i, links.length, state);
        threads.set(i, alpha, hold);
        sparks.set(i, alpha * 0.85);
      }
      threads.commit();
      sparks.commit();

      _composer.render();
    },
  });

  view.add(threeView.node);
  mountVignette(view, 0.5);

  // ── Такты ────────────────────────────────────────────────────────────────
  // 0.0  одно окно в темноте
  // 1.4  отрыв: камера пошла вверх, вокруг окна проступает фасад, потом город
  // 16.2 сеть: фоновые нити мигают, геройская вспыхивает на 18.2 и 23.6
  // 29.6 третья вспышка геройской — и она НЕ гаснет
  yield* waitFor(1.4);

  yield* all(
    camP(0.44, 8, easeInOutSine),
    reveal(1, 7.2, easeOutCubic),
  );

  yield* all(
    camP(0.80, 6.8, easeInOutSine),
    chain(waitFor(3.2), flickerD(1, 3.4, easeOutCubic)),
  );

  yield* all(
    camP(1.0, 12, easeInOutSine),
    netT(NET_LEN, NET_LEN, linear),
    chain(waitFor(HERO_FLASH[2] + 0.28), heroHold(1, 0.55, easeOutCubic)),
  );
});
