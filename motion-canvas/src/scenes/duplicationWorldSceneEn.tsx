import {makeScene2D} from '@motion-canvas/2d';
import {all, chain, createSignal, easeInOutSine, linear, waitFor} from '@motion-canvas/core';
import {
  AdditiveBlending,
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  Matrix4,
  Mesh,
  NoToneMapping,
  Object3D,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshSurfaceSampler} from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {createThreeView} from '../core/three/ThreeCanvas';
import {rng, type Rng} from '../core/three/hydra';
import {Screen, Fonts} from '../core/theme';
import {Canon} from '../core/code/model/paletteCanon';
import {applyBackground} from '../core/utils';
import {mountVignette} from '../core/components/SoftVignette';

// ═══════════════════════════════════════════════════════════════════════════
// АКТ 7 «МИР» — ПРОТОТИП, такты 1→2 (8 секунд, без музыки и голоса).
//
//   такт 1 (0–3.5 с)   код теряет резкость: буквы сливаются в светящиеся полосы
//   такт 2 (2.9–7.2 с) вещество стекается и собирается в машину
//   такт 3, шаг 1      машина отдаёт часть вещества, рядом встаёт колонка
//
// Приёмка одна: понятно ли БЕЗ ОБЪЯСНЕНИЙ, что машина сделана из кода.
//
// ⚠️ ГЛАВНОЕ ПРАВИЛО СЦЕНЫ: в кадре нет ничего, кроме частиц. Код в начале —
// НЕ текстовая нода: это те же самые точки, стоящие на своих пикселях. Машина
// в конце — не меш: модель живёт ровно один раз, при подготовке, где с её
// поверхности снимаются целевые позиции. scene3 содержит один объект — Points.
// Убрать его — кадр пуст, включая первый кадр с текстом.
//
// ⚠️ ЧТО РЕШАЕТ ПРИЁМКУ — НЕ КАЧЕСТВО ЧАСТИЦ, А СООТВЕТСТВИЕ. Если пиксель
// текста летит к случайной точке кузова, зритель видит рой: что-то рассыпалось,
// что-то собралось, связи между ними нет. Поэтому пары строятся по ЭКРАННОМУ
// положению: оба набора сортируются по коду Мортона (2D-локальность сохраняется
// при линейном обходе), пары берутся по рангу. Материал с верха текста уходит в
// крышу, с низа — в колёса, слева — налево. Читается складывание, а не подмена.
//
// ⚠️ ПОЧЕМУ У ТЕКСТА НЕТ СТАДИИ «СЧЁТНОГО ЗЕРНА». Ink кода занимает около
// 38 тысяч пикселей буфера. При миллионе точек это два с половиной десятка
// точек НА ПИКСЕЛЬ; чтобы они стали различимы поодиночке, их пришлось бы
// размазать на весь кадр — и буквы исчезли бы вместе с ними. Отдельными
// точками вещество становится видно ТОЛЬКО на отрыве, когда оно разлетается
// по дугам и плотность падает на порядок. Поэтому такт 1 доводит буквы до
// светящихся полос («свечение той же формы»), а частицами материал
// объявляет себя в начале полёта — это физика, а не выбор.
//
// ⚠️ ОТКУДА БЕРЁТСЯ ВЕЩЕСТВО МИРА. Облако закрытое: после такта 2 все точки
// лежат на машине, добавить в него нечего. Поэтому каждый следующий объект
// собирается ИЗ МАШИНЫ — она отдаёт материал. Это не экономия, это правило,
// по которому дальше вырастет весь город, и оно проговаривает реплику
// «someone's work becomes the ground for someone else's». Подмножество берётся
// РАВНОМЕРНО по всей поверхности (перемешанный порядок индексов): вырви точки
// одним куском — и машина будет читаться как повреждённая, а не отдавшая.
//
// Всё состояние — чистая функция сигналов MC, пересчёт в onRender. Ни одного
// таймера по реальному времени: сцена обязана скраббиться.
// ═══════════════════════════════════════════════════════════════════════════

const D2R = Math.PI / 180;
const QUALITY = 1.5;
const RW = Screen.width * QUALITY;
const RH = Screen.height * QUALITY;
const BG = '#0B0C10';
const INK = '#F4EEE0';                      // крем: единственный цвет материала

const SEED = 20260906;

// ── Бюджет облака ──────────────────────────────────────────────────────────
// Один BufferGeometry, один Points, один вызов отрисовки.
// ⚠️ Миллион, а не сто тысяч. Сто тысяч — фолк-число веб-туториалов; здесь
// упирается только заливка на такте 5 (точки у самого объектива), а память
// на 1M — 60 МБ. Количество покупает не свет, а ЗЕРНО: суммарная яркость есть
// N × alpha, и при росте N альфу приходится опускать. Выбирать N надо по
// самому грубому объекту в кадре: на машине миллион даёт различимые точки,
// на тексте — сплошной штрих. Обратный порядок дал бы редкую машину.
const N = 1_000_000;

// ⚠️ Доли считаны от ПЛОЩАДЕЙ, а не назначены. Яркость поверхности из точек
// равна плотности на м² и от выноса камеры не зависит, поэтому «колонка чуть
// тусклее машины» — это отношение плотностей, а не отдельная альфа. Машина
// 39 м², колонка 16 м²; при 220k/780k выходит 13 900 против 20 000 точек на м²,
// то есть 0.70. Бриф: «Машина всегда чуть ярче окружения».
const N_POST = 270_000;
const N_CAR = N - N_POST;

// ── Материал точки (размеры в пикселях БУФЕРА 2880×1620, не экрана) ────────
// ⚠️ Альфы посчитаны, а не подобраны: пиковое накопление держим около 0.75,
// выше начинается выбеленное пятно вместо формы. Плотность у текста и у
// машины отличается на порядок (38 тыс. пикселей ink против 560 тыс.
// оболочки), поэтому одна альфа на оба состояния физически невозможна.
const PX_TEXT = 1.5;                        // резкий код: штрих сплошной
const PX_GLOW = 3.0;                        // полосы: точка чуть крупнее
const PX_VAN = 2.05;                        // собранная машина: зерно различимо
const A_TEXT = 0.058;
const A_GLOW = 0.030;                       // разброс проредил плотность в восемь раз
// Машина отдала пятую часть вещества, её плотность упала с 25 700 до 20 000
// точек на м² — альфу поднимаем ровно на столько же, чтобы абсолютный уровень
// остался тем, что выставлен замером. Колонка при этом остаётся тусклее сама
// по себе: у неё меньше точек на метр поверхности.
const A_VAN = 0.152;
const FLY_DIM = 1.0;
// ⚠️ Отдельного гашения в полёте НЕТ. Вещество тускнеет само: летящие точки
// размазаны вдоль дуг, и плотность на пиксель падает на порядок. Домножить
// сверху — значит стереть шлейф, а он и есть доказательство, что материал один.
const PX_MIN = 1.0;
const PX_MAX = 16.0;
const ALPHA_FLOOR = 0.05;

// ── Код: финальное состояние предыдущей сцены ──────────────────────────────
// Это буквально тот кадр, на котором закончился chargingHeroDemoScene: слитая
// функция и две двери к ней. Раскладка повторена по его же числам, включая
// дрейф кадра (stage.scale 1.022, y 11) — стык идёт без скачка.
const WRAP_FLEET = `fun startFleetSession(cmd: StartFleet) {
    val owner = SessionOwner.Vehicle(cmd.vehicle)
    startSession(StartSession(cmd.connector, owner))
}`;
const WRAP_PUBLIC = `fun startPublicSession(cmd: StartPublic) {
    val owner = SessionOwner.Driver(cmd.driver)
    startSession(StartSession(cmd.connector, owner))
}`;
const MERGED = `fun startSession(cmd: StartSession) {
    val connector = connectors.acquire(cmd.connector)
    val session = sessions.open(connector, cmd.owner)
    metering.start(session.id)
    charger.energize(connector.id)
    events.publish(SessionStarted(session.id))
}`;

const FS = 25;                              // кегль предыдущей сцены
const ADV = FS * 0.6;                       // шаг моноширинного JetBrains Mono
const LH = FS * 1.5;                        // шаг строки Manticore
const TEXT_LEFT = -832;                     // левое поле: правый край текста ≈ −52
const COL_Y = 140;
const Y_HOME = COL_Y;
const Y_WRAP_PUBLIC = Y_HOME - 6.5 * LH;
const Y_WRAP_FLEET = Y_WRAP_PUBLIC - 5 * LH;
const STAGE_SCALE = 1.022;
const STAGE_DY = 11;

// Сверхсемплинг текстуры кода. Кадр рендерится в 2880×1620, значит текст должен
// быть чётким на 2880 — 5760 даёт два образца на пиксель кадра и мягкий край.
const SS = 3;
const TEX_W = Screen.width * SS;
const TEX_H = Screen.height * SS;
const INK_CUT = 6;                          // ниже — шум сглаживания, не буква

// ⚠️ Разброс, которым буквы сливаются в полосы. Пять с половиной экранных
// пикселей — треть ширины знакоместа: соседние глифы смыкаются, но пробелы
// между словами выживают, и строка держит свой ритм. На семи слова слипались
// в сплошную плиту. По горизонтали чуть шире: смыкаться должно ВДОЛЬ строки.
const SPREAD_R = 5.5;
const SPREAD_X = 1.25;

// ── Камера ─────────────────────────────────────────────────────────────────
// Одно движение и то формальное: 1.8% наезда за восемь секунд. Это дыхание
// кадра (тот же приём, которым заканчивается предыдущая сцена), а не наезд:
// у движения нет ни начала, ни события. Отъезд начинается только в такте 3.
const FOV = 34;
const CAM_AZ = 34 * D2R;                    // отклонение от оси кузова: три четверти
const CAM_EL = 11 * D2R;
// ⚠️ Доля ширины кадра под машину. Больше 0.55 — колёса подходят к нижней
// кромке, и такту 3 некуда отъезжать: кадр обязан начинаться с воздухом.
const FILL = 0.52;
const TGT_DY = -0.16;                       // цель ниже центра кузова: машина встаёт по центру кадра
const CAM_BREATH = 0.982;

// ⚠️ Начало отъезда. Колонка стоит в трёх метрах вбок от машины, а при
// стартовом выносе полукадр всего 3.5 м — она упёрлась бы в кромку. Камера
// обязана отойти вместе с её появлением: это не отдельное движение, это первый
// шаг того самого отъезда из такта 3.
const CAM_PULL = 1.42;                      // множитель выноса к концу шага
const CAM_EL2 = 14 * D2R;

// ── Колонка: положение задано ОТ КАМЕРЫ, а не в мировых осях ──────────────
// Модель может прийти повёрнутой, а решение здесь экранное: колонка должна
// встать справа от машины, в свободной части кадра, и чуть дальше по глубине.
const POST_URL = '/charging_station.glb';
const POST_RIGHT = 2.35;                    // метров вбок по оси кадра
const POST_FWD = 0.30;                      // метров вглубь: почти вровень с машиной

const DUR = 12.0;

// ── Полёт ──────────────────────────────────────────────────────────────────
// ⚠️ Задержка назначается по КВАНТИЛЮ расстояния цели от центра кузова, а не
// по самому расстоянию. На поверхности точек с большим радиусом кратно больше,
// и «delay ∝ r» отправляет девять десятых вещества в последнюю треть такта:
// первые полторы секунды в кадре не происходит ничего. Квантиль даёт ровный
// поток массы, и машина набирается изнутри наружу с постоянной скоростью.
const FLY_SPAN = 0.34;                      // доля сигнала на полёт одной точки
// ⚠️ БОКОВОГО ПЕРЕЛЁТА НЕТ ВООБЩЕ (решение автора, дважды). Любая траектория от
// машины к объекту — хоть по воздуху, хоть низом — читается как «огоньки
// притащили предмет»: событие происходит с частицами, а не с объектом.
// Поэтому точка ГАСНЕТ на машине и ПОЯВЛЯЕТСЯ над своим конечным местом,
// откуда опускается на него. Переброс идёт на нулевой альфе, в кадре его нет.
//   ⚠️ Цена решения: видимой связи «вещество взято у машины» не остаётся.
//   Остаётся временнáя: машина тускнеет ровно тогда, когда встаёт колонка.
// Очередь по-прежнему снизу вверх, поэтому фронт роста ползёт кверху, а над ним
// висит и оседает облако появившегося вещества.
const POST_SPAN = 0.24;                     // на проход теперь три события, не одно
const HANDOFF = 0.30;                       // доля пути до переброса
const DROP_FROM = 0.48;                     // с этого места точка начинает опускаться
const HOVER_MIN = 0.55;                     // метров над целью
const HOVER_VAR = 0.85;
const HOVER_JIT = 0.25;                     // разброс вбок: облако, а не копия объекта
const SWIRL = 0.20;                         // закрутка вокруг оси взгляда, рад
const BOW_NEAR = 0.93;                      // дуга выгибается К камере
const BOW_OUT = 1.06;                       // и чуть наружу

// ⚠️ Меши, которых в кадре быть не должно. SombraSketchfab — плоскость тени
// из экспорта Sketchfab: она лежит на нуле, по площади сравнима с кузовом и
// съедает заметную долю бюджета, рисуя под машиной светящийся прямоугольник.
// Xlay3d — водяной знак автора модели. Ни то, ни другое не машина.
const MESH_SKIP = /sombra|xlay3d/i;

// Дизер последним пассом: ореол блума на плоском графите в 8 битах распадается
// на концентрические кольца; шум в ±1/255 их разбивает и сам не виден.
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

let _composer: EffectComposer | null = null;
let _renderPass: RenderPass | null = null;
let _bloom: UnrealBloomPass | null = null;

// ───────────────────────────────────────────────────────────────────────────
// Код → пиксели. Своя растеризация, а не Manticore: нужен доступ к пикселям,
// а не к нодам. Палитра берётся из канона, поэтому код прилетает окрашенным
// ровно так, как ушёл из прошлой сцены, и цвет стекает уже в полёте.
// ───────────────────────────────────────────────────────────────────────────

interface Tok {
  text: string;
  col: number;
  color: string;
}

const KEYWORDS = new Set(['fun', 'val', 'var', 'return', 'if', 'else', 'true', 'false', 'null']);

function tokenize(line: string): Tok[] {
  const out: Tok[] = [];
  const re = /[A-Za-z_][A-Za-z0-9_]*|\s+|./g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) out.push({text: m[0], col: m.index, color: Canon.ink});
  return out;
}

/** Порядок правил повторяет buildCanonRules: побеждает более специфичное. */
function colorize(toks: Tok[]): void {
  const sig = (i: number, step: number): string => {
    let j = i + step;
    while (j >= 0 && j < toks.length && /^\s+$/.test(toks[j].text)) j += step;
    return j >= 0 && j < toks.length ? toks[j].text : '';
  };
  for (let i = 0; i < toks.length; i++) {
    const s = toks[i].text;
    if (/^\s+$/.test(s)) {
      toks[i].color = '';
      continue;
    }
    if (!/^[A-Za-z_]/.test(s)) {
      toks[i].color = Canon.punctuation;
      continue;
    }
    if (KEYWORDS.has(s)) {
      toks[i].color = Canon.keyword;
      continue;
    }
    if (sig(i, -1) === 'fun') {
      toks[i].color = Canon.methodDef;       // имя в определении — якорь
      continue;
    }
    if (/^[A-Z]/.test(s)) {
      toks[i].color = Canon.type;            // типы раньше вызовов: SessionStarted( — тип
      continue;
    }
    toks[i].color = sig(i, 1) === '(' ? Canon.methodCall : Canon.ink;
  }
}

interface InkPixel {
  x: number[];
  y: number[];
  w: number[];
  rgb: number[];
  total: number;
}

function rasterizeCode(): InkPixel {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext('2d')!;

  // Экранные координаты сцены (центр в нуле) + дрейф прошлой сцены.
  ctx.setTransform(SS, 0, 0, SS, TEX_W / 2, TEX_H / 2);
  ctx.translate(0, STAGE_DY);
  ctx.scale(STAGE_SCALE, STAGE_SCALE);
  ctx.font = `${FS}px ${Fonts.code}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  // ⚠️ Подстановочный моноширинный (Consolas и подобные) идёт с шагом 0.55, а
  // не 0.6: раскладка молча разъедется, и код в кадре будет чужим. Сцена не
  // имеет права стартовать на не той гарнитуре.
  const adv = ctx.measureText('MMMMMMMMMM').width / 10;
  if (Math.abs(adv - ADV) > 0.4) {
    throw new Error(`шрифт кода не JetBrains Mono: шаг ${adv.toFixed(2)} вместо ${ADV}`);
  }

  const blocks: [string, number][] = [
    [WRAP_FLEET, Y_WRAP_FLEET],
    [WRAP_PUBLIC, Y_WRAP_PUBLIC],
    [MERGED, Y_HOME],
  ];
  for (const [src, cy] of blocks) {
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const y = cy + (i - (lines.length - 1) / 2) * LH;
      const toks = tokenize(lines[i]);
      colorize(toks);
      for (const t of toks) {
        if (!t.color) continue;
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, TEXT_LEFT + t.col * ADV, y);
      }
    }
  }

  // Чтение полосами: полный getImageData на 5760×3240 — это 75 МБ разом.
  const out: InkPixel = {x: [], y: [], w: [], rgb: [], total: 0};
  const STRIPS = 12;
  for (let s = 0; s < STRIPS; s++) {
    const y0 = Math.floor((TEX_H * s) / STRIPS);
    const y1 = Math.floor((TEX_H * (s + 1)) / STRIPS);
    const img = ctx.getImageData(0, y0, TEX_W, y1 - y0).data;
    for (let row = 0; row < y1 - y0; row++) {
      const base = row * TEX_W * 4;
      for (let col = 0; col < TEX_W; col++) {
        const o = base + col * 4;
        const a = img[o + 3];
        if (a <= INK_CUT) continue;
        // Альфа — покрытие: у пунктуации она вдвое ниже (цвет канона задан с
        // прозрачностью), и точек ей достаётся ровно вдвое меньше. Это верно.
        const w = a / 255;
        out.x.push(col);
        out.y.push(y0 + row);
        out.w.push(w);
        out.rgb.push(img[o], img[o + 1], img[o + 2]);
        out.total += w;
      }
    }
  }
  if (out.total <= 0) throw new Error('растеризация кода дала пустой кадр');
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// Модель → точки. Используется РОВНО ОДИН РАЗ, в сцену не попадает.
// ───────────────────────────────────────────────────────────────────────────

function collectMeshes(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.updateMatrixWorld(true);
  root.traverse((n: any) => {
    if (!n.isMesh || !n.geometry?.getAttribute?.('position')) return;
    if (MESH_SKIP.test(n.name ?? '')) return;
    const mats = Array.isArray(n.material) ? n.material : [n.material];
    if (mats.some((m: any) => MESH_SKIP.test(m?.name ?? ''))) return;
    if (mats.every((m: any) => m?.transparent && (m.opacity ?? 1) < 0.6)) return;
    out.push(n as Mesh);
  });
  return out;
}

/** Площадь меша В МИРОВЫХ единицах: доли сэмплов обязаны учитывать масштаб узлов. */
function worldArea(mesh: Mesh): number {
  const g = mesh.geometry as BufferGeometry;
  const pos = g.getAttribute('position') as any;
  const idx = g.index;
  const n = idx ? idx.count : pos.count;
  const M = mesh.matrixWorld;
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  const ab = new Vector3(), ac = new Vector3(), cr = new Vector3();
  let sum = 0;
  for (let i = 0; i + 2 < n; i += 3) {
    const i0 = idx ? idx.getX(i) : i;
    const i1 = idx ? idx.getX(i + 1) : i + 1;
    const i2 = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, i0).applyMatrix4(M);
    b.fromBufferAttribute(pos, i1).applyMatrix4(M);
    c.fromBufferAttribute(pos, i2).applyMatrix4(M);
    ab.subVectors(b, a); ac.subVectors(c, a);
    sum += cr.crossVectors(ab, ac).length() * 0.5;
  }
  return sum;
}

function sampleSurface(roots: Object3D[], count: number, rnd: Rng, out: Float32Array): void {
  const meshes = roots.flatMap(collectMeshes);
  const areas = meshes.map(worldArea);
  const total = areas.reduce((s, a) => s + a, 0) || 1;
  const p = new Vector3();
  let written = 0;
  for (let mi = 0; mi < meshes.length; mi++) {
    const left = count - written;
    if (left <= 0) break;
    const share = mi === meshes.length - 1
      ? left
      : Math.min(left, Math.round((count * areas[mi]) / total));
    if (share <= 0) continue;
    // ⚠️ Сид обязан дойти и до сэмплера, иначе облако будет разным на каждом
    // прогоне и стилл разойдётся с плеером. setRandomGenerator есть в рантайме
    // three 0.183, но его нет в @types — отсюда каст и проверка.
    const sampler = new MeshSurfaceSampler(meshes[mi]) as any;
    if (typeof sampler.setRandomGenerator !== 'function') {
      throw new Error('MeshSurfaceSampler без setRandomGenerator — сцена перестанет быть воспроизводимой');
    }
    sampler.setRandomGenerator(rnd);
    sampler.build();
    const M = meshes[mi].matrixWorld;
    for (let k = 0; k < share; k++) {
      sampler.sample(p);
      p.applyMatrix4(M);
      const o = (written + k) * 3;
      out[o] = p.x; out[o + 1] = p.y; out[o + 2] = p.z;
    }
    written += share;
  }
  if (written < count) throw new Error(`сэмплер выдал ${written} точек из ${count}`);
}

// ───────────────────────────────────────────────────────────────────────────
// Сортировки по упакованному ключу. Морton даёт соответствие текст↔машина,
// ранг радиуса — очередь вылета.
// ⚠️ Ключ пакуется в Float64: 22 бита значения + 20 бит индекса = 42, мантисса
// держит 53 — целые точные. Сортировка типизированного массива числовая.
// ───────────────────────────────────────────────────────────────────────────

const MORTON_BITS = 11;                     // сетка 2048×2048 на кадр
const IDX_BASE = 1 << 20;                   // N ≤ 2^20; ключ = value*2^20 + i

function part1by1(n: number): number {
  n &= 0x0000ffff;
  n = (n | (n << 8)) & 0x00ff00ff;
  n = (n | (n << 4)) & 0x0f0f0f0f;
  n = (n | (n << 2)) & 0x33333333;
  n = (n | (n << 1)) & 0x55555555;
  return n;
}

function orderByKey(keys: Float64Array, n: number): Int32Array {
  keys.sort();
  const order = new Int32Array(n);
  for (let i = 0; i < n; i++) order[i] = keys[i] % IDX_BASE;
  return order;
}

/** Перемешанный порядок индексов: подмножество берётся равномерно по поверхности. */
function shuffledOrder(n: number, rnd: Rng): Int32Array {
  const o = new Int32Array(n);
  for (let i = 0; i < n; i++) o[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    const t = o[i]; o[i] = o[j]; o[j] = t;
  }
  return o;
}

/** Индексы, отсортированные по коду Мортона от экранных NDC. */
function mortonOrder(ndc: Float32Array, n: number): Int32Array {
  const Q = (1 << MORTON_BITS) - 1;
  const keys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let qx = Math.round(((ndc[i * 2] + 1) * 0.5) * Q);
    let qy = Math.round(((1 - ndc[i * 2 + 1]) * 0.5) * Q);
    qx = qx < 0 ? 0 : qx > Q ? Q : qx;
    qy = qy < 0 ? 0 : qy > Q ? Q : qy;
    keys[i] = (part1by1(qx) | (part1by1(qy) << 1)) * IDX_BASE + i;
  }
  return orderByKey(keys, n);
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  const rnd = rng(SEED);

  // ⚠️ Растеризация идёт по реальным метрикам гарнитуры: до неё шрифт обязан
  // быть загружен, иначе первый кадр уедет на подстановочный.
  yield document.fonts.load(`${FS}px "JetBrains Mono"`);

  // ── Машина: модель используется один раз ─────────────────────────────────
  const loader = new GLTFLoader();
  const gltf = yield new Promise<any>((res, rej) => loader.load('/honda_e.glb', res, undefined, rej));
  const postGltf = yield new Promise<any>((res, rej) => loader.load(POST_URL, res, undefined, rej));
  const car = gltf.scene as Object3D;
  car.updateMatrixWorld(true);
  const bb = new Box3().setFromObject(car);
  car.position.y -= bb.min.y;                // ставим на нулевую отметку
  car.position.x -= (bb.min.x + bb.max.x) / 2;
  car.position.z -= (bb.min.z + bb.max.z) / 2;
  car.updateMatrixWorld(true);
  const box = new Box3().setFromObject(car);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());

  // ── Камера: три четверти от оси кузова ───────────────────────────────────
  // Ось длины берётся из габарита, а не хардкодом: модель может прийти
  // повёрнутой, и ракурс не должен от этого разъезжаться.
  const alongX = size.x >= size.z;
  const halfLen = (alongX ? size.x : size.z) / 2;
  const halfWid = (alongX ? size.z : size.x) / 2;
  const screenHalf = halfLen * Math.sin(CAM_AZ) + halfWid * Math.cos(CAM_AZ);
  const tanX = Math.tan((FOV * D2R) / 2) * (Screen.width / Screen.height);
  const DT = screenHalf / (FILL * tanX);

  const dirLen = alongX ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1);
  const dirWid = alongX ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0);
  const flat = dirLen.clone().multiplyScalar(Math.cos(CAM_AZ))
    .addScaledVector(dirWid, Math.sin(CAM_AZ))
    .normalize();
  const camDir = new Vector3(
    flat.x * Math.cos(CAM_EL),
    Math.sin(CAM_EL),
    flat.z * Math.cos(CAM_EL),
  ).normalize();

  const target = center.clone();
  target.y += TGT_DY;
  const camPos = target.clone().addScaledVector(camDir, DT);

  const camera = new PerspectiveCamera(FOV, Screen.width / Screen.height, 0.1, 400);

  // Одна функция на всю камеру: дыхание кадра и отъезд складываются, угол
  // возвышения растёт вместе с выносом. Вызывается из onRender по сигналам.
  const camDirAt = new Vector3();
  function placeCamera(breathV: number, pullV: number): void {
    const el = CAM_EL + (CAM_EL2 - CAM_EL) * pullV;
    camDirAt.set(flat.x * Math.cos(el), Math.sin(el), flat.z * Math.cos(el)).normalize();
    const len = DT * (1 + (CAM_BREATH - 1) * breathV) * (1 + (CAM_PULL - 1) * pullV);
    camera.position.copy(target).addScaledVector(camDirAt, len);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
  }
  placeCamera(0, 0);

  const fwd = target.clone().sub(camPos).normalize();
  const right = new Vector3().crossVectors(fwd, new Vector3(0, 1, 0)).normalize();
  const up = new Vector3().crossVectors(right, fwd).normalize();

  // ── Точки текста ─────────────────────────────────────────────────────────
  // Плоскость текста стоит перпендикулярно взгляду на выносе камеры: кадр там
  // ровно в границах экрана, а перспективный множитель равен единице.
  const halfH = Math.tan((FOV * D2R) / 2) * DT;
  const halfW = halfH * (Screen.width / Screen.height);

  const aText = new Float32Array(N * 3);
  const aTint = new Uint8Array(N * 3);
  const ndcText = new Float32Array(N * 2);

  {
    const ink = rasterizeCode();
    const count = ink.w.length;
    const scale = N / ink.total;
    let cur = 0;
    // Стохастическое округление доли: пиксель получает floor(w·s + ξ) точек.
    // Это ровнее выборки по CDF — там пуассоновский разброс комкует штрих.
    // Хвост (±пара сотен по дисперсии) добираем циклическим обходом.
    for (let pass = 0; cur < N; pass++) {
      for (let e = 0; e < count && cur < N; e++) {
        let k = pass === 0 ? Math.floor(ink.w[e] * scale + rnd()) : 1;
        while (k-- > 0 && cur < N) {
          const px = ink.x[e] + rnd();
          const py = ink.y[e] + rnd();
          const nx = (px / TEX_W) * 2 - 1;
          const ny = 1 - (py / TEX_H) * 2;
          const o = cur * 3;
          aText[o] = camPos.x + fwd.x * DT + right.x * nx * halfW + up.x * ny * halfH;
          aText[o + 1] = camPos.y + fwd.y * DT + right.y * nx * halfW + up.y * ny * halfH;
          aText[o + 2] = camPos.z + fwd.z * DT + right.z * nx * halfW + up.z * ny * halfH;
          aTint[o] = ink.rgb[e * 3];
          aTint[o + 1] = ink.rgb[e * 3 + 1];
          aTint[o + 2] = ink.rgb[e * 3 + 2];
          ndcText[cur * 2] = nx;
          ndcText[cur * 2 + 1] = ny;
          cur++;
        }
      }
    }
  }

  // ── Точки машины ─────────────────────────────────────────────────────────
  const vanPos = new Float32Array(N * 3);
  sampleSurface([car], N, rnd, vanPos);

  const ndcVan = new Float32Array(N * 2);
  {
    const mvp = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const m = mvp.elements;
    for (let i = 0; i < N; i++) {
      const o = i * 3;
      const x = vanPos[o], y = vanPos[o + 1], z = vanPos[o + 2];
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      const iw = 1 / (Math.abs(w) < 1e-6 ? 1e-6 : w);
      ndcVan[i * 2] = (m[0] * x + m[4] * y + m[8] * z + m[12]) * iw;
      ndcVan[i * 2 + 1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) * iw;
    }
  }

  // ── Колонка: ставится по осям КАДРА, справа от машины и чуть глубже ─────
  const post = postGltf.scene as Object3D;
  post.updateMatrixWorld(true);
  {
    const pb = new Box3().setFromObject(post);
    post.position.y -= pb.min.y;
    post.position.x -= (pb.min.x + pb.max.x) / 2;
    post.position.z -= (pb.min.z + pb.max.z) / 2;
    // Горизонтальная проекция взгляда: смещение «вглубь» не должно поднимать
    // колонку над землёй.
    const fwdFlat = new Vector3(fwd.x, 0, fwd.z).normalize();
    post.position.x += right.x * POST_RIGHT + fwdFlat.x * POST_FWD;
    post.position.z += right.z * POST_RIGHT + fwdFlat.z * POST_FWD;
    // Лицом к машине: направление от колонки к центру кузова.
    const dx = center.x - post.position.x, dz = center.z - post.position.z;
    post.rotation.y = Math.atan2(-dz, dx);
    post.updateMatrixWorld(true);
  }
  const postPos = new Float32Array(N_POST * 3);
  sampleSurface([post], N_POST, rnd, postPos);

  // ⚠️ ЗДЕСЬ РЕШАЕТСЯ, ЧИТАЕТСЯ СЦЕНА ИЛИ НЕТ. Оба набора идут по одному
  // обходу экрана, пары берутся по рангу — приблизительный перенос массы,
  // сохраняющий взаимное расположение. Текст не рассыпается, он складывается.
  const orderText = mortonOrder(ndcText, N);
  const orderVan = mortonOrder(ndcVan, N);

  const aTarget = new Float32Array(N * 3);
  const aVia = new Float32Array(N * 3);
  const aSpread = new Float32Array(N * 3);
  const aSeed = new Float32Array(N);
  const aDelay = new Float32Array(N);
  const aSpan = new Float32Array(N);
  // Второй дом точки: куда она уходит с машины. У неподвижных совпадает с
  // aTarget — тогда кривая вырождается в точку и полёта не происходит вовсе.
  const aHome2 = new Float32Array(N * 3);
  const aVia2 = new Float32Array(N * 3);
  const aSched2 = new Float32Array(N * 3);   // (delay, span, group)

  const pxWorld = (2 * halfH) / Screen.height;   // мир на один экранный пиксель

  const mid = new Vector3(), perp = new Vector3(), cr = new Vector3();
  for (let r = 0; r < N; r++) {
    const ti = orderText[r];
    const vi = orderVan[r];
    const to = ti * 3, vo = vi * 3;

    aTarget[to] = vanPos[vo];
    aTarget[to + 1] = vanPos[vo + 1];
    aTarget[to + 2] = vanPos[vo + 2];

    // Дуга: середина пути, отведённая к камере и закрученная вокруг оси
    // взгляда. Стечение получает вращение, но кадр не превращается в вихрь.
    mid.set(
      (aText[to] + aTarget[to]) * 0.5,
      (aText[to + 1] + aTarget[to + 1]) * 0.5,
      (aText[to + 2] + aTarget[to + 2]) * 0.5,
    ).sub(camPos);
    const depth = mid.dot(fwd);
    perp.copy(mid).addScaledVector(fwd, -depth);
    cr.crossVectors(fwd, perp);
    const cs = Math.cos(SWIRL), sn = Math.sin(SWIRL);
    const jx = (rnd() - 0.5) * 0.5, jy = (rnd() - 0.5) * 0.5, jz = (rnd() - 0.5) * 0.5;
    aVia[to] = camPos.x + fwd.x * depth * BOW_NEAR + (perp.x * cs + cr.x * sn) * BOW_OUT + jx;
    aVia[to + 1] = camPos.y + fwd.y * depth * BOW_NEAR + (perp.y * cs + cr.y * sn) * BOW_OUT + jy;
    aVia[to + 2] = camPos.z + fwd.z * depth * BOW_NEAR + (perp.z * cs + cr.z * sn) * BOW_OUT + jz;

    // Разброс, которым буквы сливаются в полосы: равномерный по площади диск
    // в плоскости кадра, чуть вытянутый вдоль строки.
    const th = rnd() * Math.PI * 2;
    const rad = SPREAD_R * pxWorld * Math.sqrt(rnd());
    const cw = Math.cos(th) * rad * SPREAD_X, sw = Math.sin(th) * rad;
    aSpread[to] = right.x * cw + up.x * sw;
    aSpread[to + 1] = right.y * cw + up.y * sw;
    aSpread[to + 2] = right.z * cw + up.z * sw;

    aSeed[ti] = rnd();
    aSpan[ti] = FLY_SPAN;
  }

  // Очередь вылета по квантилю радиуса цели: машина набирается изнутри наружу
  // с постоянным потоком массы.
  {
    const keys = new Float64Array(N);
    let rMax = 1e-6;
    for (let i = 0; i < N; i++) {
      const o = i * 3;
      const r = Math.hypot(aTarget[o] - center.x, aTarget[o + 1] - center.y, aTarget[o + 2] - center.z);
      if (r > rMax) rMax = r;
      keys[i] = r;
    }
    const Q = IDX_BASE - 1;
    for (let i = 0; i < N; i++) keys[i] = Math.round((keys[i] / rMax) * Q) * IDX_BASE + i;
    const byRadius = orderByKey(keys, N);
    for (let rank = 0; rank < N; rank++) {
      const i = byRadius[rank];
      const q = rank / (N - 1);
      aDelay[i] = Math.max(0, Math.min(1 - FLY_SPAN, q * (1 - FLY_SPAN) + (rnd() - 0.5) * 0.04));
    }
  }

  // ── Второй дом: колонка ──────────────────────────────────────────────────
  // По умолчанию точка никуда не летит: обе контрольные точки совпадают с её
  // местом на машине.
  aHome2.set(aTarget);
  aVia2.set(aTarget);
  // delay=1 у неподвижных: их h остаётся нулём при любом сигнале, и ни размер,
  // ни альфа их не трогают.
  for (let i = 0; i < N; i++) { aSched2[i * 3] = 1; aSched2[i * 3 + 1] = 1; }

  {
    // ⚠️ Подмножество РАВНОМЕРНОЕ по всей поверхности машины. Взять «первые
    // N_POST индексов» нельзя: сэмплер идёт мешами подряд, и у машины исчез бы
    // целый кусок кузова — читалось бы как поломка, а не как отдача материала.
    const shuf = shuffledOrder(N, rnd);

    const mvp = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const m = mvp.elements;
    const ndcAt = (x: number, y: number, z: number, out: Float32Array, k: number) => {
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      const iw = 1 / (Math.abs(w) < 1e-6 ? 1e-6 : w);
      out[k * 2] = (m[0] * x + m[4] * y + m[8] * z + m[12]) * iw;
      out[k * 2 + 1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) * iw;
    };

    const ndcFrom = new Float32Array(N_POST * 2);
    const ndcTo = new Float32Array(N_POST * 2);
    for (let k = 0; k < N_POST; k++) {
      const o = shuf[k] * 3;
      ndcAt(aTarget[o], aTarget[o + 1], aTarget[o + 2], ndcFrom, k);
      const p = k * 3;
      ndcAt(postPos[p], postPos[p + 1], postPos[p + 2], ndcTo, k);
    }
    // Тот же принцип, что и на тексте: пары по экранному рангу, иначе поток
    // читается роем, а не переносом вещества.
    const oFrom = mortonOrder(ndcFrom, N_POST);
    const oTo = mortonOrder(ndcTo, N_POST);

    // Очередь по высоте цели: колонка набирается снизу вверх — она РАСТЁТ из
    // земли, а не проявляется целиком.
    const hKeys = new Float64Array(N_POST);
    let hMin = Infinity, hMax = -Infinity;
    for (let k = 0; k < N_POST; k++) {
      const y = postPos[k * 3 + 1];
      if (y < hMin) hMin = y;
      if (y > hMax) hMax = y;
    }
    const span = Math.max(1e-6, hMax - hMin);
    for (let k = 0; k < N_POST; k++) {
      hKeys[k] = Math.round(((postPos[k * 3 + 1] - hMin) / span) * (IDX_BASE - 1)) * IDX_BASE + k;
    }
    const byHeight = orderByKey(hKeys, N_POST);
    const rankOf = new Int32Array(N_POST);
    for (let r = 0; r < N_POST; r++) rankOf[byHeight[r]] = r;

    for (let r = 0; r < N_POST; r++) {
      const i = shuf[oFrom[r]];
      const dst = oTo[r];
      const o = i * 3, p = dst * 3;
      aHome2[o] = postPos[p];
      aHome2[o + 1] = postPos[p + 1];
      aHome2[o + 2] = postPos[p + 2];

      // Точка ПОЯВЛЕНИЯ — над своим же местом, с небольшим разбросом вбок,
      // чтобы над объектом висело облако, а не его призрачная копия.
      aVia2[o] = aHome2[o] + (rnd() - 0.5) * 2 * HOVER_JIT;
      aVia2[o + 1] = aHome2[o + 1] + HOVER_MIN + rnd() * HOVER_VAR;
      aVia2[o + 2] = aHome2[o + 2] + (rnd() - 0.5) * 2 * HOVER_JIT;

      const q = rankOf[dst] / (N_POST - 1);
      aSched2[o] = Math.max(0, Math.min(1 - POST_SPAN, q * (1 - POST_SPAN) + (rnd() - 0.5) * 0.04));
      aSched2[o + 1] = POST_SPAN;
      aSched2[o + 2] = 1;
    }
  }

  // ── Облако ───────────────────────────────────────────────────────────────
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(aText, 3));
  geo.setAttribute('aTarget', new BufferAttribute(aTarget, 3));
  geo.setAttribute('aVia', new BufferAttribute(aVia, 3));
  geo.setAttribute('aSpread', new BufferAttribute(aSpread, 3));
  geo.setAttribute('aTint', new BufferAttribute(aTint, 3, true));
  geo.setAttribute('aSeed', new BufferAttribute(aSeed, 1));
  geo.setAttribute('aDelay', new BufferAttribute(aDelay, 1));
  geo.setAttribute('aSpan', new BufferAttribute(aSpan, 1));
  geo.setAttribute('aHome2', new BufferAttribute(aHome2, 3));
  geo.setAttribute('aVia2', new BufferAttribute(aVia2, 3));
  geo.setAttribute('aSched2', new BufferAttribute(aSched2, 3));

  const mat = new ShaderMaterial({
    uniforms: {
      uDissolve: {value: 0},
      uAssemble: {value: 0},
      uStation: {value: 0},
      uDrain: {value: 0},
      uRef: {value: DT},
      uPxText: {value: PX_TEXT},
      uPxGlow: {value: PX_GLOW},
      uPxVan: {value: PX_VAN},
      uATxt: {value: A_TEXT},
      uAGlow: {value: A_GLOW},
      uAVan: {value: A_VAN},
      uFlyDim: {value: FLY_DIM},
      uMinPx: {value: PX_MIN},
      uMaxPx: {value: PX_MAX},
      uFloor: {value: ALPHA_FLOOR},
      uHandoff: {value: HANDOFF},
      uDropFrom: {value: DROP_FROM},
      uInk: {value: new Color(INK).convertSRGBToLinear()},
    },
    vertexShader: `
      attribute vec3 aTarget;
      attribute vec3 aVia;
      attribute vec3 aSpread;
      attribute vec3 aTint;
      attribute float aSeed;
      attribute float aDelay;
      attribute float aSpan;
      attribute vec3 aHome2;
      attribute vec3 aVia2;
      attribute vec3 aSched2;
      uniform float uDissolve, uAssemble, uStation, uDrain, uRef;
      uniform float uPxText, uPxGlow, uPxVan;
      uniform float uATxt, uAGlow, uAVan, uFlyDim;
      uniform float uMinPx, uMaxPx, uFloor;
      uniform float uHandoff, uDropFrom;
      uniform vec3 uInk;
      varying float vA;
      varying vec3 vTint;

      float ease(float t) { return t * t * (3.0 - 2.0 * t); }

      // Атрибут цвета приходит в sRGB (пиксели канваса), рендер линейный.
      vec3 srgbToLinear(vec3 c) {
        return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
      }

      void main() {
        // Такт 1. Разбег по точкам небольшой: буквы обязаны РАСПУСКАТЬСЯ, а не
        // плыть однородным блюром — часть вещества отходит от штриха раньше.
        float d = ease(clamp((uDissolve - aSeed * 0.25) / 0.75, 0.0, 1.0));
        vec3 loose = position + aSpread * d;
        float pxD = mix(uPxText, uPxGlow, d);
        float aD = mix(uATxt, uAGlow, d);

        // Такт 2. У каждой точки своя задержка, путь — дуга через aVia.
        float g = ease(clamp((uAssemble - aDelay) / aSpan, 0.0, 1.0));
        float u = 1.0 - g;
        vec3 p = u * u * loose + 2.0 * u * g * aVia + g * g * aTarget;

        // Такт 3, шаг 1. Точка гаснет на машине, появляется НАД своим местом и
        // опускается на него. Перелёта в кадре нет: переброс идёт на нулевой
        // альфе. У неподвижных aSched2.x = 1, значит h = 0 и всё вырождается.
        float h = ease(clamp((uStation - aSched2.x) / max(aSched2.y, 1e-4), 0.0, 1.0));
        float sw = step(uHandoff, h);
        float drop = smoothstep(uDropFrom, 1.0, h);
        p = mix(p, mix(aVia2, aHome2, drop), sw);
        // Гашение на машине и проявление над целью; между ними точка невидима.
        float visOut = 1.0 - smoothstep(0.0, uHandoff * 0.92, h);
        float visIn = smoothstep(uHandoff * 1.05, uDropFrom, h);
        float vis = mix(visOut, visIn, sw);

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;

        // Перспективный размер с зажимом и компенсацией альфой: суммарная
        // яркость формы не зависит от того, где точка оказалась по глубине.
        float px = mix(pxD, uPxVan, g);
        float want = px * uRef / max(-mv.z, 0.001);
        float size = clamp(want, uMinPx, uMaxPx);
        float k = want / size;

        float a = mix(aD, uAVan, g);
        a *= mix(1.0, uFlyDim, 4.0 * g * (1.0 - g));
        a *= mix(1.0, vis, aSched2.z);
        vA = a * clamp(k * k, uFloor, 1.0);
        vTint = mix(srgbToLinear(aTint), uInk, uDrain);
        gl_PointSize = size;
      }
    `,
    fragmentShader: `
      varying float vA;
      varying vec3 vTint;
      void main() {
        if (vA < 0.0015) discard;
        vec2 q = gl_PointCoord - 0.5;
        float r = length(q) * 2.0;
        if (r > 1.0) discard;
        float core = 1.0 - smoothstep(0.45, 1.0, r);
        gl_FragColor = vec4(vTint, core * vA);
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  });

  const cloud = new Points(geo, mat);
  cloud.frustumCulled = false;

  // ⚠️ В сцене РОВНО ОДИН объект. Модель дальше не нужна.
  const scene3 = new Scene();
  scene3.add(cloud);

  // ── Сигналы ──────────────────────────────────────────────────────────────
  const dissolveCode = createSignal(0);   // код → светящиеся полосы
  const assembleCar = createSignal(0);    // вещество → машина
  const station = createSignal(0);        // машина отдаёт вещество, встаёт колонка
  const cameraHeight = createSignal(0);   // отъезд: начат вместе с колонкой
  const worldGrowth = createSignal(0);    // квартал — вне прототипа
  const returnToCode = createSignal(0);   // такт 5 — вне прототипа
  const breath = createSignal(0);

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
        _bloom = new UnrealBloomPass(new Vector2(RW, RH), 0.16, 0.45, 0.62);
        _composer = new EffectComposer(renderer);
        _composer.setSize(RW, RH);
        _composer.addPass(_renderPass);
        _composer.addPass(_bloom);
        _composer.addPass(new OutputPass());
        _composer.addPass(new ShaderPass(DITHER));
      }
      _renderPass!.scene = s;
      _renderPass!.camera = c;
      renderer.toneMapping = NoToneMapping;
      renderer.toneMappingExposure = 1.0;

      const dis = dissolveCode();
      const asm = assembleCar();
      mat.uniforms.uDissolve.value = dis;
      mat.uniforms.uAssemble.value = asm;
      mat.uniforms.uStation.value = station();
      // Цвет канона стекает в крем: код уходит вместе со своей палитрой,
      // дальше в кадре только вещество.
      const t = (dis - 0.15) / 0.6;
      mat.uniforms.uDrain.value = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
      void worldGrowth(); void returnToCode();

      // ⚠️ Блум — это ТАКТ, а не постоянный слой. На резком коде он почти
      // выключен и порог поднят: при низком пороге в ореол уходит весь штрих,
      // и код читается размытым, хотя точки стоят на своих пикселях. Максимум —
      // на светящихся полосах; к собранной машине блум снова убирается.
      const glow = dis * (1 - asm * 0.85);
      _bloom!.strength = 0.16 + 0.70 * glow + 0.26 * asm;
      _bloom!.radius = 0.45 + 0.30 * glow;
      _bloom!.threshold = 0.62 - 0.42 * glow - 0.18 * asm;

      // Дыхание кадра (1.8% за восемь секунд) и начало отъезда — одним рычагом.
      placeCamera(breath(), cameraHeight());

      _composer.render();
    },
  });

  view.add(threeView.node);
  mountVignette(view, 0.5);

  // ── Такты ────────────────────────────────────────────────────────────────
  // 0.0  код из предыдущей сцены, резкий и читаемый — ЭТОТ такт обязателен:
  //      если зритель не успел опознать код, приёмка провалится не из-за частиц
  // 1.5  ТАКТ 1: цвет стекает, буквы распускаются в светящиеся полосы
  // 2.9  ТАКТ 2: вещество снимается изнутри наружу и стекается в машину
  //      ⚠️ Полёт начинается ДО конца распада. На стыке в кадре одновременно
  //      стоят ещё читаемые полосы кода и уже летящие одиночные точки — именно
  //      это, а не статичное зерно, объявляет, что материал один и тот же.
  // 7.6  ТАКТ 3, шаг 1: камера начинает отходить, машина отдаёт пятую часть
  //      вещества, и справа от неё снизу вверх вырастает зарядная колонка
  yield* all(
    chain(breath(1, 7.6, linear), waitFor(DUR - 7.6)),
    (function* () {
      yield* waitFor(1.5);
      yield* all(
        dissolveCode(1, 1.9, easeInOutSine),
        chain(waitFor(1.4), assembleCar(1, 4.3, linear)),
      );
      yield* waitFor(0.4);
      yield* all(
        cameraHeight(1, 4.0, easeInOutSine),
        chain(waitFor(0.5), station(1, 3.0, linear)),
      );
      yield* waitFor(0.4);
    })(),
  );
});
