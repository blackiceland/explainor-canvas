import {blur, makeScene2D, Node} from '@motion-canvas/2d';
import {
  all,
  chain,
  createSignal,
  easeInOutCubic,
  easeInOutSine,
  easeOutCubic,
  easeOutQuint,
  linear,
  spawn,
  ThreadGenerator,
  waitFor,
} from '@motion-canvas/core';
import {
  ACESFilmicToneMapping,
  BackSide,
  Box3,
  BoxGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  Scene,
  ShadowMaterial,
  Vector3,
  WebGLRenderer,
} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createThreeView} from '../core/three/ThreeCanvas';
import {Screen} from '../core/theme';
import {applyBackground} from '../core/utils';
import {Manticore} from '../core/code/components/Manticore';
import {buildCanonRules, Canon, CanonCodeTheme, paintCanonMethodCalls} from '../core/code/model/paletteCanon';
import {mountVignette} from '../core/components/SoftVignette';
import {backdropRect, grainRect} from '../core/components/OpeningBackdrop';

// Операторская демка. Автопарк стоит в кадре С САМОГО НАЧАЛА — глубоко в расфокусе,
// как задний план за героем. Ничто ниоткуда не появляется: мир цел с первого кадра.
// Два такта: резкое приближение к Honda e у стойки → отъезд с подъёмом, к концу
// которого задний план входит в фокус, а на своих местах проступают оба блока кода.
// Нижняя пара доходит до полной резкости, верхняя остаётся приглушённой: она фон.
// Камера за всю сцену не меняет ни азимут, ни объектив.
// Земли и тумана нет: всё стоит на графите applyBackground, тени ловит
// невидимый ShadowMaterial. Motion Canvas владеет временем, three — пространством.

const CAR_URL = '/honda_e.glb';
const POST_URL = '/charging_station.glb';
const VAN_URL = '/fedex_van.glb';

// Лицо стойки при rotation.y = 0 смотрит в +X.
const faceTo = (dx: number, dz: number) => Math.atan2(-dz, dx);
const D2R = Math.PI / 180;

// Полярная камера: азимут отсчитывается от +Z к +X.
function orbit(az: number, el: number, dist: number, t: Vector3): Vector3 {
  const ce = Math.cos(el);
  return new Vector3(
    t.x + Math.sin(az) * ce * dist,
    t.y + Math.sin(el) * dist,
    t.z + Math.cos(az) * ce * dist,
  );
}

// Съёмочный павильон для отражений (в кадре его нет — только в бликах кузова).
// Верх светлый, низ тёмный, тёплый ключевой софтбокс и холодный заполняющий:
// это даёт борту вертикальный перепад и линию горизонта.
function makeStudioEnv(): Scene {
  const env = new Scene();
  const wall = new Mesh(new BoxGeometry(), new MeshBasicMaterial({color: '#171B24', side: BackSide}));
  wall.scale.set(26, 16, 26);
  wall.position.set(0, 6, 0);
  env.add(wall);
  const ceil = new Mesh(new PlaneGeometry(24, 24), new MeshBasicMaterial({color: '#C3D2E8'}));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = 13.6; env.add(ceil);
  const floor = new Mesh(new PlaneGeometry(24, 24), new MeshBasicMaterial({color: '#080A0E'}));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.6; env.add(floor);
  const keyCard = new Mesh(new PlaneGeometry(9, 6), new MeshBasicMaterial({color: '#FFE9C8'}));
  keyCard.position.set(7.5, 7.0, 5.5); keyCard.lookAt(0, 1.2, 0); env.add(keyCard);
  const fillCard = new Mesh(new PlaneGeometry(7, 5), new MeshBasicMaterial({color: '#3E5A80'}));
  fillCard.position.set(-7.5, 4.5, -5.0); fillCard.lookAt(0, 1.2, 0); env.add(fillCard);
  return env;
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ── Мост из опенинга ─────────────────────────────────────────────────────
  // Последний кадр опенинга — его фон и зерно, конвейер к тому моменту погашен.
  // Первый кадр этой сцены — ТОТ ЖЕ растр поверх графита: срез невидим, потому
  // что по обе стороны одно и то же тёмное. Дальше слой уходит вместе с
  // наводкой машины на резкость — мир и его свет приходят как одно, из той же
  // темноты, в которую упал конвейер. Паузы нет: это V с дном в один кадр —
  // спуск это гашение опенинга на ходу, подъём это наводка машины.
  const bridge = backdropRect();
  const bridgeGrain = grainRect();
  view.add(bridge);
  view.add(bridgeGrain);

  // ── Общие утилиты ────────────────────────────────────────────────────────
  // Автокраска приходит зеркальной (roughness 0) — любой направленный источник
  // рисует жёсткую белую точку. Базу грубим, лак оставляем почти гладким.
  function dress(root: Object3D, minRough: number, coatRough = 0.07) {
    root.traverse((n: any) => {
      if (!n.isMesh) return;
      n.castShadow = true;
      n.receiveShadow = true;
      const m = n.material as MeshPhysicalMaterial;
      if (m.roughness !== undefined && m.roughness < minRough) m.roughness = minRough;
      if ((m as any).clearcoat > 0 && (m as any).clearcoatRoughness !== undefined) {
        (m as any).clearcoatRoughness = Math.max((m as any).clearcoatRoughness, coatRough);
      }
      // У CarPaintWhite нет baseColorFactor — по умолчанию glTF это альбедо 1.0,
      // физически невозможное даже для белой краски («виниры»). Сажаем в реальность.
      if (/CarPaint(White)?$/i.test(m.name || '') && m.color && !(m as any).map) {
        if (m.color.r > 0.95 && m.color.g > 0.95 && m.color.b > 0.95) {
          m.color.setRGB(0.845, 0.833, 0.808);
        }
      }
    });
  }
  function ground0(root: Object3D) {
    const b = new Box3().setFromObject(root);
    root.position.y -= b.min.y;
  }
  // Невидимая плоскость-приёмник тени: машины стоят прямо на графите фона,
  // но контактная тень остаётся — объект не висит.
  function shadowCatcher(): Mesh {
    const m = new Mesh(new PlaneGeometry(200, 200), new ShadowMaterial({opacity: 0.4}));
    m.rotation.x = -Math.PI / 2;
    m.receiveShadow = true;
    return m;
  }

  // ── Сцена героя ──────────────────────────────────────────────────────────
  const scene3 = new Scene();
  scene3.add(shadowCatcher());
  scene3.add(new HemisphereLight(0xa8c4ff, 0x141a26, 0.22));

  const key = new DirectionalLight(0xfff2e0, 1.25);
  key.position.set(6.5, 9.0, 5.0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.normalBias = 0.05;
  key.shadow.bias = -0.0004;
  const kc = key.shadow.camera;
  kc.left = -7; kc.right = 7; kc.top = 7; kc.bottom = -7; kc.near = 3; kc.far = 28;
  kc.updateProjectionMatrix();
  scene3.add(key);

  const rim = new DirectionalLight(0x9ec0ff, 0.8);
  rim.position.set(-7.0, 3.2, -6.0);
  scene3.add(rim);

  // ── Сцена депо (отдельная — у неё свой расфокус при материализации) ──────
  const sceneD = new Scene();
  sceneD.add(shadowCatcher());
  sceneD.add(new HemisphereLight(0xa8c4ff, 0x141a26, 0.22));

  const DEPOT_POS = new Vector3(-7.0, 0, -19.5);
  const keyD = new DirectionalLight(0xfff2e0, 1.25);
  keyD.position.copy(DEPOT_POS).add(new Vector3(6, 12, 7));
  keyD.target.position.copy(DEPOT_POS);
  keyD.castShadow = true;
  keyD.shadow.mapSize.set(2048, 2048);
  keyD.shadow.normalBias = 0.05;
  keyD.shadow.bias = -0.0004;
  const dcam = keyD.shadow.camera;
  dcam.left = -12; dcam.right = 12; dcam.top = 12; dcam.bottom = -12; dcam.near = 2; dcam.far = 55;
  dcam.updateProjectionMatrix();
  sceneD.add(keyD);
  sceneD.add(keyD.target);

  const rimD = new DirectionalLight(0x9ec0ff, 0.8);
  rimD.position.copy(DEPOT_POS).add(new Vector3(-7, 4, -7));
  sceneD.add(rimD);

  // ── Модели ───────────────────────────────────────────────────────────────
  // Карточка счётчика рисуется в canvas, а не через Txt: она живёт в мире,
  // а не на плоскости кадра. Шрифт обязан быть готов ДО первой отрисовки —
  // иначе первый кадр уедет на fallback-моноширинный.
  yield (document as any).fonts.load('600 150px "JetBrains Mono"');
  yield (document as any).fonts.load('600 96px "JetBrains Mono"');

  const loader = new GLTFLoader();
  const carGltf = yield new Promise<any>((res, rej) => loader.load(CAR_URL, res, undefined, rej));
  const postGltf = yield new Promise<any>((res, rej) => loader.load(POST_URL, res, undefined, rej));
  const vanGltf = yield new Promise<any>((res, rej) => loader.load(VAN_URL, res, undefined, rej));

  const car = carGltf.scene as Object3D;
  dress(car, 0.26);
  car.position.set(0.55, 0, -0.20);
  // Тот же разворот, что у фургонов ряда 0 (депо повёрнуто на -31°): ракурс к
  // финальной камере совпадает — 46.2° против 44.6° у фургона.
  car.rotation.y = -31 * D2R;
  ground0(car);
  scene3.add(car);

  // Порт зарядки на капоте — единственная деталь машины, которой физически есть
  // чем ответить на charger.energize (у Honda e он там и есть, под стеклом,
  // с подсветкой). Материал CarPaintBlack общий на всю чёрную отделку кузова,
  // поэтому у этой сетки он свой, клонированный.
  const portLit = createSignal(0);
  const portMats: MeshStandardMaterial[] = [];
  let portNode: Object3D | null = null;
  car.traverse((n: any) => {
    if (!n.isMesh || !/PlasticoCargador/i.test(n.name)) return;
    n.material = n.material.clone();
    n.material.emissive = new Color('#FFA85A');
    n.material.emissiveIntensity = 0;
    portMats.push(n.material);
    portNode = n;
  });

  // ⚠️ Одной эмиссии мало. Ровная янтарная заливка на белом капоте читается как
  // НАКЛЕЙКА, а не как свет: белая краска вокруг неё ярче её самой. Светом это
  // делают две вещи — выбитая в белое сердцевина и растекание по соседней
  // поверхности. Поэтому над портом стоит короткий источник: он кладёт на капот
  // тёплую лужу с мягким краем, и порт становится её центром.
  const portGlow = new PointLight(0xffb063, 0, 1.3, 2);
  if (portNode) {
    car.updateMatrixWorld(true);
    const c = new Box3().setFromObject(portNode).getCenter(new Vector3());
    portGlow.position.copy(c).add(new Vector3(0, 0.11, 0));
  }
  scene3.add(portGlow);

  // Кабеля в кадре нет — и он не нужен: «ток пошёл» держится на том, что свет
  // появляется на ОБОИХ концах разом и поднимает воздух между ними. Радиус
  // короткий, чтобы отсвет не уехал на фургоны и не подсветил полкадра.
  const bondLit = createSignal(0);
  const bond = new PointLight(0xffd2a0, 0, 4.6, 2);
  bond.position.set(-1.20, 0.74, 0.40);
  scene3.add(bond);

  // ── Счётчик над стойкой ──────────────────────────────────────────────────
  // Счётчик энергии — прибор СТАНЦИИ, у машины его не бывает. Карточка живёт
  // В МИРЕ, а не на плоскости кадра, и висит над стойкой в плоскости её лица,
  // как табличка на колонке (позиция задаётся ниже, когда стойка уже стоит).
  // Ни рамки, ни подложки, ни линии вниз — только типографика: моно, крем,
  // табличные цифры. Появляется как всё в этой сцене — из расфокуса, только
  // расфокус тут честный, в самом растре.
  const CARD_W = 1024, CARD_H = 256;
  const cardCv = document.createElement('canvas');
  cardCv.width = CARD_W;
  cardCv.height = CARD_H;
  const cardCtx = cardCv.getContext('2d')!;
  const cardTex = new CanvasTexture(cardCv);
  cardTex.anisotropy = 8;
  const cardMat = new MeshBasicMaterial({
    map: cardTex, transparent: true, opacity: 0,
    depthWrite: false, side: DoubleSide, toneMapped: false,
  });
  const card = new Mesh(new PlaneGeometry(3.2, 0.8), cardMat);
  card.renderOrder = 10;
  scene3.add(card);

  const cardOp = createSignal(0);
  const cardBlur = createSignal(18);
  const boltLit = createSignal(0);
  // Часы зарядки: показания считаются из них, а не анимируются напрямую —
  // так счётчик не может разъехаться с монтажом. 100 кВт — обычная уличная
  // быстрая станция; сотые тикают раз в 0.36 с, этого хватает, чтобы читалось
  // «идёт», и это честная физика, а не ускорение ради красоты.
  const chargeClock = createSignal(0);
  const KW = 100;

  const INK = '244, 238, 224';
  const BOLT_ON = [255, 176, 106];
  let cardKey = '';
  function drawCard() {
    const val = (chargeClock() * KW / 3600).toFixed(2);
    const b = Math.round(cardBlur() * 4) / 4;
    const lit = Math.round(boltLit() * 20) / 20;
    const key = `${val}|${b}|${lit}`;
    if (key === cardKey) return;
    cardKey = key;

    const c = cardCtx;
    c.clearRect(0, 0, CARD_W, CARD_H);
    c.save();
    if (b > 0.05) c.filter = `blur(${b}px)`;

    const FS_NUM = 150, FS_UNIT = 96;
    c.font = `600 ${FS_NUM}px "JetBrains Mono", monospace`;
    const wNum = c.measureText(val).width;
    c.font = `600 ${FS_UNIT}px "JetBrains Mono", monospace`;
    const wUnit = c.measureText('kWh').width;
    const BOLT_W = 78, GAP_B = 54, GAP_U = 26;
    const total = BOLT_W + GAP_B + wNum + GAP_U + wUnit;
    let x = (CARD_W - total) / 2;
    const cy = CARD_H / 2;

    // Молния — индикатор, а не украшение: она есть всегда, но погашена, пока
    // ток не пошёл. Дашбордная логика, не бейдж.
    const bh = 172, bx = x, by = cy - bh / 2;
    const P: [number, number][] = [
      [0.58, 0.00], [0.16, 0.56], [0.44, 0.56],
      [0.40, 1.00], [0.84, 0.42], [0.56, 0.42],
    ];
    c.beginPath();
    P.forEach(([px, py], i) => {
      const X = bx + px * BOLT_W / 0.84, Y = by + py * bh;
      i ? c.lineTo(X, Y) : c.moveTo(X, Y);
    });
    c.closePath();
    if (lit > 0) {
      c.shadowColor = `rgba(${BOLT_ON.join(',')}, ${0.55 * lit})`;
      c.shadowBlur = 30 * lit;
    }
    const br = Math.round(244 + (BOLT_ON[0] - 244) * lit);
    const bg = Math.round(238 + (BOLT_ON[1] - 238) * lit);
    const bb = Math.round(224 + (BOLT_ON[2] - 224) * lit);
    c.fillStyle = `rgba(${br}, ${bg}, ${bb}, ${0.20 + 0.80 * lit})`;
    c.fill();
    c.shadowBlur = 0;

    x += BOLT_W + GAP_B;
    c.textBaseline = 'alphabetic';
    const base = cy + FS_NUM * 0.36;
    c.font = `600 ${FS_NUM}px "JetBrains Mono", monospace`;
    c.fillStyle = `rgba(${INK}, 0.95)`;
    c.fillText(val, x, base);
    x += wNum + GAP_U;
    c.font = `600 ${FS_UNIT}px "JetBrains Mono", monospace`;
    c.fillStyle = `rgba(${INK}, 0.50)`;
    c.fillText('kWh', x, base);

    c.restore();
    cardTex.needsUpdate = true;
  }

  const post = postGltf.scene as Object3D;
  dress(post, 0.35);
  post.position.set(-1.95, 0, 0.85);
  post.rotation.y = faceTo(0.94, 0.34);   // лицом к машине и одновременно в камеру
  ground0(post);
  scene3.add(post);

  // Карточка — в плоскости ЛИЦА стойки, над её верхом. ⚠️ Любой другой угол
  // (по оси машины, «компромиссные 22° от камеры») не принадлежит ни одной
  // плоскости кадра, и карточка висит под углом, которого в сцене нет — это и
  // читалось как сломанная геометрия. Грань стоит к камере под ~56°, цифры
  // сжимаются по ширине, но наклон строки совпадает с рёбрами самой стойки —
  // а это и есть разница между перспективой и кривым набором.
  {
    post.updateMatrixWorld(true);
    const b = new Box3().setFromObject(post);
    const c = b.getCenter(new Vector3());
    card.position.set(c.x, b.max.y + 0.68, c.z);
    card.rotation.y = post.rotation.y + Math.PI / 2;   // нормаль плоскости = лицо стойки
  }

  // ── Янтарь захвата: оболочки стойки и машины ─────────────────────────────
  // Одно устройство на три роли по возрастающей: ЗАНЯТО — янтарь ложится на
  // стойку и держится (connectors.acquire: разъём недоступен другим; машину не
  // трогаем — она клиент, её никто не выключал); СВЯЗАНО — захват перекидывается
  // на машину, оба мигают дважды синхронно (sessions.open); ТОК ПОШЁЛ — один
  // прогон от стойки к машине с задержкой, и дальше устоявшееся состояние
  // (charger.energize). Решается ЯВНО, цветом корпусов, а не отсветом и не
  // тинтом альбедо (у стойки эмиссия замаскирована текстурой, корпус от неё не
  // загорится): клон геометрии с плоским неосвещённым материалом поверх.
  // depthWrite выключен, а глубина уже записана самим объектом, поэтому
  // внутренности клона отсекаются и остаётся чистый силуэт.
  const LINK = new Color('#FFA85A');
  const SHELL_MAX = 0.55;
  const postClaim = createSignal(0);
  const carClaim = createSignal(0);
  const mkShellMat = () => new MeshBasicMaterial({
    color: LINK, transparent: true, opacity: 0, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    toneMapped: false,
  });
  const postShellMat = mkShellMat();
  const carShellMat = mkShellMat();
  const mkShell = (src: Object3D, mat: MeshBasicMaterial) => {
    const sh = src.clone(true);
    sh.traverse((n: any) => {
      if (!n.isMesh) return;
      n.material = mat;
      n.castShadow = false;
      n.receiveShadow = false;
    });
    sh.visible = false;
    scene3.add(sh);
    return sh;
  };
  const carShell = mkShell(car, carShellMat);
  const postShell = mkShell(post, postShellMat);

  // Индикатор стойки живёт двумя сигналами. Уровень — сколько света;
  // оттенок — какое состояние. У модели эмиссия идёт по текстуре, светятся
  // только светодиодная полоса и экран, а не весь корпус: это и есть та самая
  // «мягкая подсветка колонки», без единой нарисованной поверх плашки.
  const postLit = createSignal(0);
  const postHue = createSignal(0);
  const POST_IDLE = new Color('#4ade80');     // свободна
  const POST_LIVE = new Color('#FFB070');     // занята, идёт сессия
  const postMats: MeshStandardMaterial[] = [];
  post.traverse((n: any) => {
    if (!n.isMesh) return;
    n.material = n.material.clone();
    n.material.emissive = new Color('#4ade80');
    n.material.emissiveIntensity = 0;
    postMats.push(n.material);
  });

  // Депо: раскладка ровно как в референсе S_mode_depot — два ряда носами к центру,
  // стойки островом по центральной оси спина к спине, каждая лицом к своему ряду.
  // Внутренняя геометрия не трогается вовсе; в кадр её ставит поворот всей группы:
  // камера смотрит с az 14°, референс смотрел с 45° → группа развёрнута на 14−45.
  // Позиция выверена проекцией (scratchpad/sweep.mjs): экранный бокс депо
  // 1009..1867 × 142..387 на обеих точках дрейфа — целиком в кадре.
  const depot = new Object3D();
  depot.position.copy(DEPOT_POS);
  depot.rotation.y = -31 * D2R;
  sceneD.add(depot);

  const depotLit = createSignal(1);
  const depotMats: MeshStandardMaterial[] = [];
  const vanSrc = vanGltf.scene as Object3D;
  const COLS = 3, SU = 3.3, ROW = 4.6, SPINE = 0.75;
  for (let i = 0; i < COLS * 2; i++) {
    const col = i % COLS, row = (i / COLS) | 0;
    const lx = (col - (COLS - 1) / 2) * SU;

    const v = vanSrc.clone(true);
    dress(v, 0.30);
    // r=0.5 у краски фургона не ловит окружение вовсе; лёгкий отблеск неба по
    // крыше, но герой остаётся заметно глянцевее — иерархия планов
    v.traverse((n: any) => {
      if (n.isMesh && !n.material.transparent && n.material.roughness > 0.45) n.material.roughness = 0.45;
    });
    v.position.set(lx, 0, row ? ROW : -ROW);
    v.rotation.y = row ? Math.PI : 0;      // нос к центральному острову
    const vb = new Box3().setFromObject(v);
    v.position.y = -vb.min.y;
    depot.add(v);

    const p = post.clone(true);
    p.position.set(lx, 0, row ? SPINE : -SPINE);
    p.rotation.y = faceTo(0, row ? 1 : -1);   // лицом к своему ряду
    p.traverse((n: any) => {
      if (!n.isMesh) return;
      n.material = n.material.clone();
      n.material.emissive = new Color('#4ade80');
      n.material.emissiveIntensity = 0;
      depotMats.push(n.material);
    });
    depot.add(p);
  }

  // ── Камера (одна на оба вьюпорта) ────────────────────────────────────────
  // Азимут и объектив постоянны — камера только отъезжает и поднимается.
  // Один жест, четыре канала на одной кривой, никакого доворота в конце.
  const AZ = 14 * D2R;
  const camera = new PerspectiveCamera(34, Screen.width / Screen.height, 0.1, 300);
  const camEl = createSignal(16 * D2R);
  const camDist = createSignal(10.5);
  const tgtX = createSignal(-0.62);
  const tgtY = createSignal(1.00);
  const tgtZ = createSignal(0.12);
  // Сдвиг точки прицеливания вдоль «вправо» камеры: двигает мир по кадру,
  // не трогая камеру — так левая колонна освобождается под код.
  const lookOff = createSignal(0);

  let envTex: any = null;
  function frame(renderer: WebGLRenderer, s: Scene) {
    if (!envTex) {
      const pm = new PMREMGenerator(renderer);
      envTex = pm.fromScene(makeStudioEnv(), 0.02).texture;
      scene3.environment = envTex;
      sceneD.environment = envTex;
      (scene3 as any).environmentIntensity = 0.9;
      (sceneD as any).environmentIntensity = 0.9;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = PCFShadowMap;
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.92;
    }
    for (const m of postMats) {
      m.emissive.copy(POST_IDLE).lerp(POST_LIVE, postHue());
      m.emissiveIntensity = postLit() * 3.4;
    }
    for (const m of portMats) m.emissiveIntensity = portLit() * 3.2;
    portGlow.intensity = portLit() * 2.4;
    bond.intensity = bondLit() * 7.0;
    // Потолок 0.55, не полная: сквозь янтарь должна остаться форма — «корпус
    // стал цветным», а не «поверх положили плоский вырез». Автор: «нежнее».
    postShellMat.opacity = postClaim() * SHELL_MAX;
    postShell.visible = postClaim() > 0.004;
    carShellMat.opacity = carClaim() * SHELL_MAX;
    carShell.visible = carClaim() > 0.004;
    cardMat.opacity = cardOp();
    drawCard();
    // Депо остаётся зелёным: там сессий никто не открывал.
    for (const m of depotMats) m.emissiveIntensity = depotLit() * 3.4;

    const t = new Vector3(tgtX(), tgtY(), tgtZ());
    camera.position.copy(orbit(AZ, camEl(), camDist(), t));
    const off = lookOff();
    camera.lookAt(t.x + Math.cos(AZ) * off, t.y, t.z - Math.sin(AZ) * off);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(s, camera);
  }

  // Депо рисуется ПОД героем (узел добавлен раньше); у него свой блюр и своя
  // прозрачность — материализация тем же жестом расфокуса, что вход героя.
  const depotView = createThreeView({
    width: Screen.width, height: Screen.height, scene: sceneD, camera,
    onRender: r => frame(r, sceneD),
  });
  // Радиус держим малым относительно объекта: фургон на стартовом кадре ~147 px,
  // 7 это пять процентов его высоты. Больше — и просветы между машинами затекают,
  // ряд превращается в одно пятно; расфокус должен убирать фактуру, а не силуэт.
  const IN_BLUR_DEPOT = 7;
  const depShot = depotView.node;
  const depFocus = blur(IN_BLUR_DEPOT);
  depShot.opacity(0);
  depShot.filters([depFocus]);
  view.add(depShot);

  const mainView = createThreeView({
    width: Screen.width, height: Screen.height, scene: scene3, camera,
    onRender: r => frame(r, scene3),
  });
  const shot = mainView.node;
  const focus = blur(30);
  shot.opacity(0);
  shot.filters([focus]);
  view.add(shot);

  // ── Код: ДВА блока ───────────────────────────────────────────────────────
  // Каждый мир приносит свою функцию: сначала уличная (она уже в кадре),
  // потом — только после появления автопарка — фургонная. Так вторая читается
  // как почти-копия первой, и вилка «миры разные, код один» возникает у зрителя
  // сама, до того как мы её назовём.
  // ⚠️ ТЕЛА ОБЯЗАНЫ БЫТЬ ОДИНАКОВЫМИ — это весь тезис акта: «Same four lines.
  // Only the id is different». Прежняя версия различалась тремя строками из
  // четырёх (billing.authorize/charge, PUBLIC_TARIFF/FLEET_CONTRACT,
  // 45.minutes/8.hours), и это ломало сразу два места: слияние переставало
  // казаться очевидно правильным (сливать разное неудивительно), а акт 2
  // лишался своей развязки — ровно эти различия он и вводит как опции.
  // Различие живёт в ОДНОМ токене тела: driver / vehicle.
  // Пять строк тела — ровно пять действий, которые перечисляет озвучка:
  // захватить коннектор, открыть сессию, запустить учёт, подать ток,
  // опубликовать событие. Подсветка идёт строка за строкой под эти слова,
  // поэтому тело обязано читаться как пять строк — никаких переносов внутри.
  // acquire, а не take: речь о временном эксклюзивном захвате ресурса, и в
  // опенинге по конвейеру уже проезжает парный connectors.release(...).
  const CODE_PUBLIC = `fun startPublicSession(cmd: StartPublic) {
    val connector = connectors.acquire(cmd.connector)
    val session = sessions.open(connector, cmd.driver)
    metering.start(session.id)
    charger.energize(connector.id)
    events.publish(SessionStarted(session.id))
}`;

  const CODE_FLEET = `fun startFleetSession(cmd: StartFleet) {
    val connector = connectors.acquire(cmd.connector)
    val session = sessions.open(connector, cmd.vehicle)
    metering.start(session.id)
    charger.energize(connector.id)
    events.publish(SessionStarted(session.id))
}`;

  // Тело — строки 1..5; 0 это сигнатура, 6 — закрывающая скобка.
  const BODY_FROM = 1;
  const BODY_TO = 5;

  const CODE_TYPES = [
    'StartPublic', 'StartFleet', 'StartSession', 'SessionStarted', 'SessionOwner',
  ];

  // Кегль 25, а не 27: самая длинная строка тела 55 знаков, при 27 в блок
  // влезает 52. Расширить блок нельзя — фургоны депо начинаются на +50 от
  // центра кадра, а текст верхнего блока уже доходит до −7.
  const CODE_FS = 25;
  // Каждый блок стоит НАПРОТИВ своего объекта, а не по порядку чтения:
  // депо сидит в кадре на y≈265 px, Хонда на y≈717 px — отсюда и центры блоков.
  // Порядок ПОЯВЛЕНИЯ при этом обратный: сначала нижний, уличный.
  const Y_FLEET = -275;                      // напротив автопарка
  const Y_PUBLIC = 177;                      // напротив Хонды

  // Код стоит на своём месте и не двигается вовсе: появление — только выход из блюра.
  // Блок расширен с 880 до 960: самая длинная строка тела — 51 знак (826 px при
  // кегле 27), а под текст при 880 оставалось 768. x сдвинут ровно на половину
  // расширения, чтобы ЛЕВОЕ поле осталось на месте: блок растёт только вправо,
  // до −6 px от центра кадра. Стойка начинается на +130 — 136 px запаса.
  const CODE_X = -408;
  const CODE_W = 960;
  const publicWrap = new Node({opacity: 0});
  const fleetWrap = new Node({opacity: 0});
  view.add(publicWrap);
  view.add(fleetWrap);

  const mkCode = (src: string, y: number, parent: Node) => {
    const m = Manticore.create(src, {
      x: CODE_X,
      y,
      width: CODE_W,
      height: 0,
      fontSize: CODE_FS,
      theme: CanonCodeTheme,
      glowAccent: false,
      customTypes: CODE_TYPES,
      cardStyle: {fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)', radius: 0, edge: false},
    });
    m.mount(parent);
    m.colorize(buildCanonRules({
      types: CODE_TYPES,
      methods: ['startPublicSession', 'startFleetSession', 'startSession'],
      vars: [
        'cmd', 'connector', 'connectors', 'session', 'sessions',
        'metering', 'charger', 'events', 'driver', 'vehicle',
      ],
    }));
    paintCanonMethodCalls(m);
    return m;
  };

  const codeFleet = mkCode(CODE_FLEET, Y_FLEET, fleetWrap);
  const codePublic = mkCode(CODE_PUBLIC, Y_PUBLIC, publicWrap);
  // Manticore.mount ставит контейнеру opacity 0 — поднимаем, видимостью правит обёртка.
  codeFleet.node.opacity(1);
  codePublic.node.opacity(1);
  // Верхняя пара — фон разговора: и автопарк, и его код остаются под расфокусом с
  // частичной прозрачностью. Нижняя пара выходит в полную резкость.
  const DIM_OP = 0.45, DIM_BLUR = 4;
  const IN_BLUR = 8;                          // с чего начинают все трое
  // Задний план разговора: половина, о которой сейчас не говорят, не исчезает,
  // а отступает — своя прозрачность и свой расфокус. В этой сцене НИЧТО не
  // материализуется из ничего, всё приходит и уходит наводкой на резкость.
  const FAR_OP = 0.34, FAR_BLUR = 6;
  const publicBlur = blur(IN_BLUR);
  const fleetBlur = blur(IN_BLUR);
  publicWrap.filters([publicBlur]);
  fleetWrap.filters([fleetBlur]);


  // Та же мягкая круговая виньетка, что на титре: сцена открывается тем же
  // кадром, что закрылся эпиграф. Держится весь первый такт и уходит вместе
  // с отъездом — когда кадр раскрывается под код, сжимать его нечем.
  const vignette = mountVignette(view, 0);

  // ── Чтение кода ──────────────────────────────────────────────────────────
  // ОБЪЯСНЕНИЕ читается прозрачностью: активная 1, пройденные 0.58, остальные
  // 0.22. Цветом здесь не красим ничего — у каждой из пяти строк в каноне уже
  // есть розовый вызов метода, и на полной яркости он читается розовым сам.
  // ⚠️ Акцентная перекраска в этом такте была ошибкой: это жест СРАВНЕНИЯ, а
  // строки тут не сравнивают, а разбирают по одной.
  const READ_ON = 1;
  const READ_PAST = 0.58;
  const READ_OFF = 0.22;

  function* readTo(m: Manticore, active: number, dur: number): ThreadGenerator {
    const anims: ThreadGenerator[] = [];
    for (let i = 0; i < m.lineCount; i++) {
      const inBody = i >= BODY_FROM && i <= BODY_TO;
      const to = !inBody ? READ_OFF
        : i === active ? READ_ON
        : i < active ? READ_PAST
        : READ_OFF;
      const line = m.getLine(i);
      if (line) anims.push(line.setOpacity(to, dur));
    }
    yield* all(...anims);
  }

  function* readOff(m: Manticore, dur: number): ThreadGenerator {
    yield* all(...Array.from({length: m.lineCount}, (_, i) =>
      m.getLine(i)!.setOpacity(1, dur)));
  }

  // СРАВНЕНИЕ — жест из dryConditionsScene, автор указал на него как на эталон
  // сличения двух методов: активная строка идёт на 1 и перекрашивается целиком
  // в акцент, весь остальной блок держится на 0.25. Цвет со строки НЕ снимается,
  // когда подсветка ушла дальше: след копится в ЦВЕТЕ, а не в прозрачности, и к
  // концу прохода тело стоит акцентом целиком. Снимается всё разом, в конце.
  // Пара вспыхивает СИНХРОННО в обоих блоках — одновременность и есть всё
  // утверждение, поэтому связей между блоками рисовать не нужно.
  const CMP_OFF = 0.25;
  const CMP_ACCENT = Canon.methodDef;

  function* cmpTo(m: Manticore, active: number, dur: number): ThreadGenerator {
    const anims: ThreadGenerator[] = [];
    for (let i = 0; i < m.lineCount; i++) {
      const line = m.getLine(i);
      if (line) anims.push(line.setOpacity(i === active ? READ_ON : CMP_OFF, dur));
    }
    const act = m.getLine(active);
    if (act) anims.push(act.recolorAll(CMP_ACCENT, dur));
    yield* all(...anims);
  }

  function* cmpPair(active: number, dur: number): ThreadGenerator {
    yield* all(cmpTo(codePublic, active, dur), cmpTo(codeFleet, active, dur));
  }

  function* cmpOff(m: Manticore, dur: number): ThreadGenerator {
    const anims: ThreadGenerator[] = [];
    for (let i = 0; i < m.lineCount; i++) {
      const line = m.getLine(i);
      if (!line) continue;
      anims.push(line.setOpacity(1, dur));
      if (i >= BODY_FROM && i <= BODY_TO) anims.push(line.resetColors(dur));
    }
    yield* all(...anims);
  }

  // ── Реакция мира: причинно-следственная цепочка на пять строк ────────────
  // Каждая строка МЕНЯЕТ СОСТОЯНИЕ мира, и состояния разные — выбрали разъём →
  // связали его с машиной → включили учёт → подали ток → сообщили системе.
  // Это механизм, а не иллюстрация: порядок строк начинает что-то значить.
  // Сильнее всего работает 0.00 kWh, который стоит и НЕ растёт, а на energize
  // идёт: только так видно, что учёт включается ДО тока.
  // На events.publish в физическом мире не происходит ничего — там только
  // строка и голос. Обратно не гаснет ничего: сессия идёт, ток течёт.
  const L_ACQUIRE = 1, L_OPEN = 2, L_METER = 3, L_ENERGIZE = 4;

  // ЗАНЯТО. Строка про разъём, не про машину: янтарь ложится на СТОЙКУ и
  // держится, индикатор переходит с зелёного «свободна» на тёплое «занято».
  // Машина стоит как стояла. ⚠️ Гасить её (тень, дизейбл) значит учить зрителя
  // неверному значению строки ровно там, где он и остановится.
  // Всё на easeInOutSine и без бросков — автор: «нежнее».
  // Янтарь на стойке НЕ держится до open: пришёл, постоял, ушёл — в том же
  // акте (автор). «Занято» дальше несёт индикатор стойки, он остаётся тёплым.
  function* wAcquire(): ThreadGenerator {
    yield* all(
      chain(
        postClaim(0.6, 0.6, easeInOutSine),
        waitFor(0.3),
        postClaim(0, 0.6, easeInOutSine),
      ),
      postHue(1, 0.9, easeInOutSine),
      postLit(1.12, 0.9, easeInOutSine),
    );
  }

  // СВЯЗАНО. Захват перекидывается на машину: оба корпуса синхронно дважды
  // мягко пульсируют янтарём и сходят на нет — дыхание, а не строб (атака в
  // два кадра читалась как глитч). Дальше «занято» несёт индикатор стойки.
  function* wOpen(): ThreadGenerator {
    const pulse = (v: typeof carClaim) => chain(
      v(1, 0.22, easeInOutSine),
      v(0.25, 0.3, easeInOutSine),
      v(1, 0.22, easeInOutSine),
      v(0, 0.55, easeInOutSine),
    );
    yield* all(pulse(postClaim), pulse(carClaim));
  }

  // Учёт готов, но ток не подан: карточка приходит из расфокуса и показывает
  // ноль. Она НЕ растёт — в этом весь смысл такта.
  function* wMeter(): ThreadGenerator {
    yield* all(
      cardOp(1, 0.75, easeOutCubic),
      cardBlur(0, 0.75, easeOutCubic),
    );
  }

  // ТОК ПОШЁЛ. Событие — СТАРТ СЧЁТЧИКА, и его достаточно (автор). Никаких
  // бросков и прогонов по корпусам: молния загорается, стойка выходит на
  // рабочую яркость, порт на капоте берёт свет чуть позже — всё плавно, без
  // пиков и посадок, на одной синусоиде.
  function* wEnergize(): ThreadGenerator {
    yield* all(
      boltLit(1, 0.5, easeInOutSine),
      postLit(1.85, 0.8, easeInOutSine),
      bondLit(0.9, 0.8, easeInOutSine),
      chain(waitFor(0.15), portLit(0.8, 0.8, easeInOutSine)),
    );
  }

  // ── Таймлайн ─────────────────────────────────────────────────────────────
  // Без вдоха в начале: подъём из темноты опенинга идёт с первого кадра.

  // Такт 1. Кадр открывается разом: герой выходит из расфокуса, автопарк уже стоит
  // за ним глубоким боке. Приближение короткое и резкое — 1.5 с на квинтике, то есть
  // бросок и мягкая посадка, а не плавный проезд.
  yield* all(
    // Мост уходит за время наводки; своя виньетка приходит на его место.
    bridge.opacity(0, 1.25, easeInOutSine),
    bridgeGrain.opacity(0, 1.25, easeInOutSine),
    vignette.strength(0.45, 1.25, easeInOutSine),
    shot.opacity(1, 0.5, easeOutCubic),
    depShot.opacity(DIM_OP, 0.5, easeOutCubic),
    focus.value(0, 1.25, easeOutCubic),
    camDist(5.70, 1.5, easeOutQuint),
    camEl(8.5 * D2R, 1.5, easeOutQuint),
    tgtX(-0.30, 1.5, easeOutQuint),
    tgtY(0.78, 1.5, easeOutQuint),
    tgtZ(0.00, 1.5, easeOutQuint),
  );
  bridge.remove();
  bridgeGrain.remove();
  yield* postLit(1, 0.7, easeOutCubic);
  yield* waitFor(0.5);

  // Такт 2. Отъезд с подъёмом. К концу его на свои места выходят ОБА блока, но
  // на разных планах: нижний в полную резкость, верхний — задним планом.
  // Кадр с самого начала заявляет «два мира, один код»; держать половину
  // пустой тринадцать секунд значит перекосить композицию ради буквальности.
  const APPEAR = 1.3;
  yield* all(
    camDist(17.0, 2.6, easeInOutCubic),
    camEl(22 * D2R, 2.6, easeInOutCubic),
    tgtX(0.62, 2.6, easeInOutCubic),
    tgtY(1.45, 2.6, easeInOutCubic),
    tgtZ(-1.2, 2.6, easeInOutCubic),
    lookOff(-5.6, 2.6, easeInOutCubic),
    // Гасим силой, а не прозрачностью узла: иначе дизеринг умножается на неё
    // же, перестаёт работать, и по кадру едут кольца квантования.
    vignette.strength(0, 2.6, easeInOutCubic),
    chain(
      waitFor(1.9),
      all(
        publicWrap.opacity(1, APPEAR, easeOutCubic),
        publicBlur.value(0, APPEAR, easeOutCubic),
        fleetWrap.opacity(FAR_OP, APPEAR, easeOutCubic),
        fleetBlur.value(FAR_BLUR, APPEAR, easeOutCubic),
      ),
    ),
  );

  // ── 0:10–0:25 · Уличная станция ──────────────────────────────────────────
  // «This is a public charging station… the backend grabs the connector, opens
  //  a session for that driver, starts metering, sends power, publishes an
  //  event.» Депо всё это время стоит глубоким боке позади — мир целый, но
  //  разговор идёт не о нём.
  yield* waitFor(3.4);

  // 2.2 с на строку, не 1.6: строка названа (0.55) → мир ответил (≤1.2) →
  // ПАУЗА, чтобы состояние устоялось, → следующая. Без паузы пять реакций
  // сливались в один восьмисекундный каскад (автор: «паузы ставь между актами»).
  const READ_STEP = 2.2;
  const READ_DUR = 0.55;
  // Сколько бегут часы зарядки после energize: остаток чтения (две строки) и
  // возврат яркости — ≈4.45 с, двенадцать тиков до 0.12 kWh.
  const CLOCK_RUN = (READ_STEP - READ_DUR) * 2 + READ_DUR + 0.6;
  for (let i = BODY_FROM; i <= BODY_TO; i++) {
    yield* readTo(codePublic, i, READ_DUR);
    // Мир отвечает ПОСЛЕ того, как строка названа, а не вместе с ней.
    if (i === L_ACQUIRE) spawn(wAcquire());
    if (i === L_OPEN) spawn(wOpen());
    if (i === L_METER) spawn(wMeter());
    if (i === L_ENERGIZE) {
      spawn(wEnergize());
      // Часы зарядки заводятся с главного потока, а не изнутри реакции: поток
      // реакции живёт секунду, а счётчик — дольше. Но НЕ бесконечно: он идёт,
      // пока метод дочитывается (оставшиеся строки + возврат яркости), и
      // встаёт. Показать «пошёл» достаточно, дальше он только отвлекает.
      spawn(chargeClock(CLOCK_RUN, CLOCK_RUN, linear));
    }
    yield* waitFor(READ_STEP - READ_DUR);
  }
  // «The driver's card is authorized up front. They're paying public rates.» —
  // кода под это нет, строки просто возвращаются в ровную яркость.
  yield* readOff(codePublic, 0.6);
  yield* waitFor(0.4);

  // ── Мир возвращается в нейтраль ──────────────────────────────────────────
  // Реакции показаны — после energize держать их в кадре незачем (автор).
  // Карточка уходит так же, как пришла, в расфокус; порт, отсвет и индикатор
  // стойки — в исходное. К сравнению оба мира стоят одинаково тихо.
  yield* all(
    cardOp(0, 1.2, easeInOutSine),
    cardBlur(18, 1.2, easeInOutSine),
    portLit(0, 1.2, easeInOutSine),
    bondLit(0, 1.2, easeInOutSine),
    postLit(1, 1.2, easeInOutSine),
    postHue(0, 1.2, easeInOutSine),
  );
  boltLit(0);
  yield* waitFor(0.6);

  // ── Депо входит в кадр ───────────────────────────────────────────────────
  // «And this is a depot… our own delivery vans.» Верхняя половина выходит из
  // расфокуса, нижняя ОСТАЁТСЯ резкой: передачи плана с блюром нижней части
  // больше нет — автор: шаг лишний, сразу к сравнению. После — короткая пауза,
  // где показано всё: без подсветок, без блюра, без эффектов. Длина этой
  // паузы — единственное, что здесь подстраивать под озвучку депо.
  yield* all(
    depFocus.value(0, 1.6, easeInOutCubic),
    depShot.opacity(1, 1.6, easeInOutCubic),
    fleetWrap.opacity(1, 1.6, easeInOutCubic),
    fleetBlur.value(0, 1.6, easeInOutCubic),
  );
  const CLEAR_HOLD = 3.0;
  yield* waitFor(CLEAR_HOLD);

  // ── Совпадение ───────────────────────────────────────────────────────────
  // «The worlds are different. The code, for now, is almost the same.
  //  Grab the connector. Open the session. Start metering. Send power.
  //  Publish the event.» — пять пар, синхронно в обоих блоках.
  const CMP_DUR = 0.5;
  for (let i = BODY_FROM; i <= BODY_TO; i++) {
    yield* cmpPair(i, CMP_DUR);
    yield* waitFor(1.2 - CMP_DUR);
  }
  yield* all(cmpOff(codePublic, 0.6), cmpOff(codeFleet, 0.6));
  yield* waitFor(0.8);

  // ── Различия ─────────────────────────────────────────────────────────────
  // Жест diff из dryConditionsScene: всё приглушается, кроме строк, где код
  // расходится, а сами различающиеся токены уходят в акцент и дважды
  // пульсируют. Различий ТРИ, и все три показываем: имя функции, тип команды
  // и владелец сессии — ровно то, что слиянию предстоит свести в одно
  // (startSession, StartSession, SessionOwner). Показать только driver/vehicle
  // значило бы, что слияние потом «решает» различия, которых зритель не видел.
  type DiffSpec = [line: number, tokens: string[]][];
  const DIFF_PUBLIC: DiffSpec = [[0, ['startPublicSession', 'StartPublic']], [2, ['driver']]];
  const DIFF_FLEET: DiffSpec = [[0, ['startFleetSession', 'StartFleet']], [2, ['vehicle']]];
  const DIFF_BLUE = '#66ADFF';
  const DIFF_LOW = 'rgba(102, 173, 255, 0.72)';
  const DIFF_PULSE = 0.16;
  function* diffTo(m: Manticore, spec: DiffSpec, dur: number): ThreadGenerator {
    const lit = new Set(spec.map(([l]) => l));
    const anims: ThreadGenerator[] = [];
    for (let i = 0; i < m.lineCount; i++) {
      const line = m.getLine(i);
      if (line) anims.push(line.setOpacity(lit.has(i) ? 1 : CMP_OFF, dur));
    }
    for (const [l, toks] of spec) anims.push(m.getLine(l)!.recolorTokens(toks, DIFF_BLUE, dur));
    yield* all(...anims);
  }
  const diffPulse = (color: string) => all(
    ...DIFF_PUBLIC.map(([l, toks]) => codePublic.getLine(l)!.recolorTokens(toks, color, DIFF_PULSE)),
    ...DIFF_FLEET.map(([l, toks]) => codeFleet.getLine(l)!.recolorTokens(toks, color, DIFF_PULSE)),
  );
  yield* all(diffTo(codePublic, DIFF_PUBLIC, 0.6), diffTo(codeFleet, DIFF_FLEET, 0.6));
  yield* waitFor(0.25);
  for (let k = 0; k < 2; k++) {
    yield* diffPulse(DIFF_LOW);
    yield* diffPulse(DIFF_BLUE);
  }
  yield* waitFor(2.4);
});
