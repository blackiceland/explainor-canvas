import {
  ACESFilmicToneMapping,
  Box3,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  HemisphereLight,
  InstancedMesh,
  LatheGeometry,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Path,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Quaternion,
  RectAreaLight,
  RepeatWrapping,
  Scene,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SpotLight,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {RectAreaLightUniformsLib} from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {CinemaLens} from './cinemaLens';
import {buildKeyboard, KEY_U, KEYBOARD_SIZE, keyboardXForGH, KEYBOARDS, keyCenter} from './keyboard';
import {loadPerson, PersonSpec} from './rocketboxPerson';

// ── Good Code, But I Hate It · открытие ─────────────────────────────────────
// Ночь. Домашний кабинет с цветами. Программист пишет хороший код — и тот ему
// не нравится. Один непрерывный проезд камеры, без склеек:
//   1. Цветок на столе — в фокусе; за ним в холодном свете экрана лицо.
//      Фокус переводится с цветка на глаза.
//   2. Камера обходит голову: анфас → профиль → за плечо. Он читает код.
//   3. Из-за плеча — наезд в экран; он допечатывает строку. Код заполняет
//      кадр, мигает каретка — дальше ролик идёт в коде.
//
// ⚠️ Кадр целиком собирает этот модуль: мир, человек, объектив И РАСКАДРОВКА
// (openingTimeline — чистая функция времени). Сцена MC только ведёт часы; тот же
// модуль снимает стенд без редактора — что проверено там, то и в кадре.
// ⚠️ Расфокус — по глубине каждого пикселя (cinemaLens), не слоями: камера
// облетает человека, и «ближе/дальше» меняется посреди проезда.
// ⚠️ Свет только от предметов с телом: экран (холодный, спереди), торшер за
// спиной справа (тёплый контур), гирлянда на полке, ночное окно за монитором.
// ⚠️ Ноги модели уходят под пол (стоячий риг усажен по глазам) — ракурсы
// подобраны так, что ниже стола камера не заглядывает.

const D2R = Math.PI / 180;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smooth = (a: number, b: number, x: number) => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// Плавный шум: сумма синусов с несоизмеримыми частотами.
export const wob = (t: number, a: number, f: number, p: number) =>
  a * (Math.sin(t * f + p) * 0.6 + Math.sin(t * f * 2.31 + p * 1.7) * 0.28 + Math.sin(t * f * 4.07 + p * 0.3) * 0.12);

// Детерминированный шум: кадры обязаны совпадать между прогонами.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Место ────────────────────────────────────────────────────────────────────
// Человек смотрит в +Z; глаза — EYE. Стол перед ним, монитор на столе, за
// монитором стена с окном. За спиной — полка с гирляндой и торшер.
export const EYE = new Vector3(0, 1.2, 0);
export const DESK = {x0: -0.85, x1: 0.85, z0: 0.3, z1: 1.05, y: 0.74, t: 0.035};
// Клавиатура TKL (keyboard.ts): граница G/H — ровно перед человеком, поэтому
// сама клавиатура сдвинута вправо от него (справа стрелки и Home/End).
// Ближний край клавиатуры в 2 см от края стола: иначе руки тянутся, локоть раскрыт
// на ~125° (автор: «что-то не так с предплечьем»); так локти у тела, ~105°.
const KB_X = keyboardXForGH(0), KB_Z = 0.389;
export const KEYS = {x: KB_X, z: KB_Z, w: KEYBOARD_SIZE.w, d: KEYBOARD_SIZE.d};
/** Клавиша в мире (центр). */
export const keyAt = (label: string) => keyCenter(label, KB_X, KB_Z);
/** Глубина домашнего ряда: сюда ложатся кончики пальцев. */
export const HOME_Z = keyAt('F').z - 0.003;
/** Середина кончиков пальцев на домашнем ряду по ширине: ASDF (левая) и JKL; (правая).
 *  В раскладке: F и J — в 1.5 клавиши от границы G/H, A и ; — в 4.5; середина — в 3. */
export const HOME_X: [number, number] = [
  ['A', 'S', 'D', 'F'].reduce((a, l) => a + keyAt(l).x, 0) / 4,
  ['J', 'K', 'L', ';'].reduce((a, l) => a + keyAt(l).x, 0) / 4,
];
/** От кончика указательного до кончика мизинца на домашнем ряду: F…A — три клавиши. */
export const HOME_SPREAD = 3 * KEY_U;
/** Клавиши кабинета при клавиатуре на глубине kbZ: где клавиша, домашний ряд, середины рук. */
export function studyKeysAt(kbZ: number) {
  const at = (label: string) => keyCenter(label, KB_X, kbZ);
  return {
    keyAt: at,
    homeZ: at('F').z - 0.003,
    homeX: [['A', 'S', 'D', 'F'].reduce((a, l) => a + at(l).x, 0) / 4, ['J', 'K', 'L', ';'].reduce((a, l) => a + at(l).x, 0) / 4] as [number, number],
    spread: HOME_SPREAD,
  };
}
/** Запястья при наборе: пальцы на домашнем ряду ASDF / JKL;. */
export const WRIST_TYPING: [Vector3, Vector3] = [new Vector3(0.065, 0.808, 0.25), new Vector3(-0.065, 0.808, 0.25)];
export const KEY_TOP = DESK.y + 0.024;              // верх клавиш
export const SCREEN = {w: 0.597, h: 0.336, y: 1.13, z: 0.64};
const FRONT_Z = 1.15, BACK_Z = -2.4, SIDE_X = 2.1, CEIL = 2.7;
const WIN = {x0: -1.25, x1: 0.85, y0: 1.02, y1: 2.35};
const LAMP = new Vector3(1.25, 1.52, -1.85);  // центр абажура
const VASE = new Vector3(-0.5, DESK.y, 0.66);
const VASE_S = 0.72;                          // ваза 31 см → 22 см: букет из невысоких стеблей

// ── Код на экране ────────────────────────────────────────────────────────────
// Цвета — канон (core/code/model/paletteCanon.ts; копия: импорт тянет MC).
const C = {
  ink: 'rgba(244,241,235,0.96)', punct: 'rgba(244,241,235,0.58)', comment: 'rgba(244,241,235,0.45)',
  kw: '#A3CDFF', type: 'rgba(205,198,250,0.90)', param: '#85B0DC', def: '#FF8CA3', call: '#FFAEC0',
};
type Tok = [string, keyof typeof C];
const CODE: Tok[][] = [
  [['package ', 'kw'], ['home.lighting', 'ink']],
  [],
  [['class ', 'kw'], ['SetLampBrightnessHandler', 'type'], ['(', 'punct']],
  [['    private val ', 'kw'], ['lamps', 'param'], [': ', 'punct'], ['LampRepository', 'type'], [',', 'punct']],
  [['    private val ', 'kw'], ['events', 'param'], [': ', 'punct'], ['EventBus', 'type'], [',', 'punct']],
  [[') : ', 'punct'], ['CommandHandler', 'type'], ['<', 'punct'], ['SetLampBrightness', 'type'], ['> {', 'punct']],
  [],
  [['    override fun ', 'kw'], ['handle', 'def'], ['(', 'punct'], ['command', 'param'], [': ', 'punct'], ['SetLampBrightness', 'type'], [') {', 'punct']],
  [['        val ', 'kw'], ['lamp', 'ink'], [' = ', 'punct'], ['lamps', 'param'], ['.', 'punct'], ['find', 'call'], ['(', 'punct'], ['command', 'ink'], ['.', 'punct'], ['lampId', 'param'], [')', 'punct']],
  [['        lamp', 'ink'], ['.', 'punct'], ['brightness', 'param'], [' = ', 'punct'], ['command', 'ink'], ['.', 'punct'], ['level', 'param']],
  [['        events', 'param'], ['.', 'punct'], ['publish', 'call'], ['(', 'punct'], ['LampBrightnessChanged', 'type'], ['(', 'punct'],
    ['lamp', 'ink'], ['.', 'punct'], ['id', 'param'], [', ', 'punct'], ['command', 'ink'], ['.', 'punct'], ['level', 'param'], ['))', 'punct']],
  [['    }', 'punct']],
  [['}', 'punct']],
];
export const TYPE_LINE = 10;
// Строка TYPE_LINE набирается по ходу: до этой длины она уже есть в кадре.
const TYPED_BEFORE = '        events.publish(LampBrightnessChanged('.length;
export const TYPE_TOTAL = CODE[TYPE_LINE].reduce((n, [s]) => n + s.length, 0);

// Раскладка холста экрана: пиксели 2048×1152 = весь экран 16:9.
const TEX_W = 2048, TEX_H = 1152;
const TAB_H = 70, CODE_TOP = 150, LINE_H = 66, FONT = 38, GUTTER = 150, CODE_X = 190;
const CHAR_W = FONT * 0.6;                   // JetBrains Mono: ширина знака 0.6 кегля

/** Точка холста экрана (px) → мир. */
function screenPoint(px: number, py: number): Vector3 {
  // экран смотрит на человека (−Z): его «право» в мире — −X
  return new Vector3(SCREEN.w / 2 - (px / TEX_W) * SCREEN.w, SCREEN.y + SCREEN.h / 2 - (py / TEX_H) * SCREEN.h, SCREEN.z - 0.001);
}
export const charPoint = (line: number, col: number) => screenPoint(CODE_X + col * CHAR_W, CODE_TOP + line * LINE_H + LINE_H * 0.5);

// ── Раскадровка ──────────────────────────────────────────────────────────────
export const OPENING_DURATION = 16;

// Набор: два захода. Первый — начало аргументов, потом он замирает и читает
// код выше; второй — дописывает строку уже в кадре из-за плеча.
const BURSTS = [
  {t0: 0.35, text: 'lamp.id, ', cps: 4.2},
  {t0: 10.5, text: 'command.level))', cps: 7.0},
];
interface Keystroke { t: number; ch: string; }
const KEYSTROKES: Keystroke[] = (() => {
  const rnd = mulberry32(711);
  const out: Keystroke[] = [];
  for (const b of BURSTS) {
    let t = b.t0;
    for (const ch of b.text) {
      out.push({t, ch});
      t += (1 / b.cps) * (0.65 + rnd() * 0.7);
    }
  }
  return out;
})();
if (TYPED_BEFORE + KEYSTROKES.length !== TYPE_TOTAL) throw new Error('goodCodeOpening: набор не сходится со строкой');

// Какой палец жмёт знак: [рука 0 — левая, 1 — правая, палец 0..4].
function fingerFor(ch: string): [number, number] {
  const c = ch.toLowerCase();
  const L: Record<string, number> = {q: 4, a: 4, z: 4, w: 3, s: 3, x: 3, e: 2, d: 2, c: 2, r: 1, f: 1, v: 1, t: 1, g: 1, b: 1};
  const R: Record<string, number> = {y: 1, h: 1, n: 1, u: 1, j: 1, m: 1, i: 2, k: 2, ',': 2, o: 3, l: 3, '.': 3, p: 4, ';': 4, '(': 3, ')': 4};
  if (c === ' ') return [1, 0];
  if (c in L) return [0, L[c]];
  return [1, R[c] ?? 2];
}

export interface OpeningState {
  t: number;
  /** Набрано знаков в строке TYPE_LINE. */
  typed: number;
  /** Каретка видна. */
  caret: boolean;
  /** Нажатия по рукам и пальцам 0..1. */
  taps: [number[], number[]];
  /** Куда смотрят глаза (мир) и куда за ними идёт голова (с запаздыванием). */
  gaze: Vector3;
  headGaze: Vector3;
  blink: number;
  breath: number;
  lean: number;
  camera: {pos: Vector3; look: Vector3; fov: number; roll: number};
  /** Дистанция фокуса по оси объектива, м. */
  focus: number;
  /** Светосила: кружок нерезкости, px 1080p на диоптрию. */
  aperture: number;
}

// Моргания: не на переводах фокуса и не посреди набора.
const BLINKS = [3.55, 6.4, 8.95, 13.35];
const blinkAt = (t: number) => BLINKS.reduce((m, b) => Math.max(m, smooth(b, b + 0.07, t) * (1 - smooth(b + 0.1, b + 0.24, t))), 0);

// Взгляд: редкие фиксации и короткие скачки. ⚠️ За работой глаза почти
// неподвижны: фиксация 0.5–0.9 с, скачок на несколько знаков, строки — соседние.
// Частые скачки через пол-экрана (первая версия: каждые 0.26 с) читались тиком.
// На наборе взгляд не бежит за кареткой по знаку — стоит на слове.
const SACCADE = 0.06;
const FIXATIONS: {t: number; line: number; col: number}[] = [
  {t: 0.0, line: 10, col: 45},                 // набор «lamp.id, »
  {t: 1.7, line: 10, col: 51},
  {t: 3.3, line: 9, col: 30},                  // читает строки выше
  {t: 4.0, line: 9, col: 20},
  {t: 4.8, line: 9, col: 30},
  {t: 5.7, line: 10, col: 16},
  {t: 6.5, line: 10, col: 30},
  {t: 7.4, line: 10, col: 44},
  {t: 8.3, line: 8, col: 30},
  {t: 9.1, line: 8, col: 40},
  {t: 9.9, line: 10, col: 50},                 // вернулся к каретке
  {t: 11.4, line: 10, col: 58},                // набор «command.level))»
  {t: 12.6, line: 10, col: 64},
];
function gazeAt(t: number): Vector3 {
  let i = 0;
  while (i < FIXATIONS.length - 1 && t >= FIXATIONS[i + 1].t) i++;
  const f = FIXATIONS[i], prev = FIXATIONS[Math.max(0, i - 1)];
  return charPoint(prev.line, prev.col).lerp(charPoint(f.line, f.col), i === 0 ? 1 : smooth(0, SACCADE, t - f.t));
}
// Голова за глазами не прыгает: она идёт за СРЕДНИМ взглядом за последние ~1.5 с.
function headGazeAt(t: number): Vector3 {
  const m = new Vector3();
  const N = 16;
  for (let k = 0; k < N; k++) m.add(gazeAt(t - (k / N) * 1.5));
  return m.divideScalar(N);
}

// Камера: опорные точки проезда. Между ними — кубический Эрмит по времени.
interface CamKey { t: number; pos: Vector3; look: Vector3; fov: number; }
const CAM: CamKey[] = [
  // взгляды K0–K2 посчитаны проекцией: глаза в левой трети (он смотрит вправо),
  // букет в K0 — в правой трети; дальше камера проходит мимо цветов
  {t: 0.0, pos: new Vector3(-0.98, 1.1, 0.84), look: new Vector3(-0.301, 1.138, 0.42), fov: 30},
  {t: 4.4, pos: new Vector3(-0.86, 1.13, 0.66), look: new Vector3(-0.182, 1.155, 0.236), fov: 30},
  {t: 6.8, pos: new Vector3(-0.78, 1.2, 0.2), look: new Vector3(0.006, 1.178, 0.05), fov: 32},
  {t: 8.4, pos: new Vector3(-0.62, 1.25, -0.2), look: new Vector3(0.0, 1.18, 0.1), fov: 34},
  {t: 10.2, pos: new Vector3(-0.34, 1.33, -0.42), look: new Vector3(0.02, 1.12, 0.62), fov: 36},
  {t: 12.1, pos: new Vector3(-0.15, 1.24, -0.05), look: new Vector3(0.02, 1.12, 0.64), fov: 38},
  {t: 14.0, pos: new Vector3(0.0, 1.13, 0.16), look: new Vector3(0.0, 1.13, 0.64), fov: 40},
  {t: 16.0, pos: new Vector3(0.0, 1.13, 0.17), look: new Vector3(0.0, 1.13, 0.64), fov: 40},
];
function hermite<T extends number | Vector3>(keys: CamKey[], get: (k: CamKey) => T, t: number): T {
  const n = keys.length;
  let i = 0;
  while (i < n - 2 && t > keys[i + 1].t) i++;
  const k0 = keys[i], k1 = keys[i + 1];
  const h = k1.t - k0.t;
  const u = clamp01((t - k0.t) / h);
  // касательные Катмулла–Рома по времени; на концах — ноль (старт и стоп мягкие)
  const tan = (j: number): any => {
    if (j === 0 || j === n - 1) return typeof get(keys[j]) === 'number' ? 0 : new Vector3();
    const a = get(keys[j - 1]), b = get(keys[j + 1]);
    const dt = keys[j + 1].t - keys[j - 1].t;
    return typeof a === 'number' ? ((b as number) - a) / dt : (b as Vector3).clone().sub(a as Vector3).divideScalar(dt);
  };
  const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
  const p0 = get(k0), p1 = get(k1), m0 = tan(i), m1 = tan(i + 1);
  if (typeof p0 === 'number') return (h00 * p0 + h10 * h * m0 + h01 * (p1 as number) + h11 * h * m1) as T;
  return (p0 as Vector3).clone().multiplyScalar(h00).addScaledVector(m0, h10 * h)
    .addScaledVector(p1 as Vector3, h01).addScaledVector(m1, h11 * h) as T;
}

// Точки фокуса. Перевод — в диоптриях: так глаз и объектив «видят» скорость.
const FLOWER = new Vector3(-0.5, 1.1, 0.66);
const RACKS = [
  {t0: 1.5, t1: 3.1, to: 'eyes'},
  {t0: 9.5, t1: 10.9, to: 'screen'},
] as const;

export function openingTimeline(t: number): OpeningState {
  // набор
  const pressed = KEYSTROKES.filter(k => k.t <= t).length;
  const typed = TYPED_BEFORE + pressed;
  const taps: [number[], number[]] = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]];
  for (const k of KEYSTROKES) {
    const dt = t - k.t;
    if (dt < -0.07 || dt > 0.1) continue;
    const [hand, f] = fingerFor(k.ch);
    const v = dt < 0 ? smooth(-0.07, 0, dt) : 1 - smooth(0, 0.1, dt);
    taps[hand][f] = Math.max(taps[hand][f], v);
  }
  const typing = KEYSTROKES.some(k => Math.abs(t - k.t) < 0.45);
  const lastKey = KEYSTROKES.filter(k => k.t <= t).pop()?.t ?? -9;
  // каретка горит, пока печатают, потом мигает 0.53 / 0.53
  const caret = typing || t - lastKey < 0.5 || Math.floor((t - lastKey - 0.5) / 0.53) % 2 === 1;

  // камера
  const pos = hermite(CAM, k => k.pos, t);
  const look = hermite(CAM, k => k.look, t);
  const fov = hermite(CAM, k => k.fov, t);
  // «ручная» камера: едва заметное дыхание оператора
  pos.add(new Vector3(wob(t, 0.0025, 0.9, 0.2), wob(t, 0.002, 1.1, 1.9), wob(t, 0.002, 0.7, 3.1)));
  const roll = wob(t, 0.35, 0.45, 0.7) * D2R;

  // фокус
  const fwd = look.clone().sub(pos).normalize();
  const along = (p: Vector3) => Math.max(0.05, p.clone().sub(pos).dot(fwd));
  const eyesP = EYE.clone();
  const screenP = charPoint(TYPE_LINE, typed);
  const pt = {flower: FLOWER, eyes: eyesP, screen: screenP};
  let from: keyof typeof pt = 'flower';
  let inv = 1 / along(pt[from]);
  for (const r of RACKS) {
    const k = smooth(r.t0, r.t1, t);
    inv = lerp(inv, 1 / along(pt[r.to]), k);
    if (k >= 1) from = r.to;
  }

  const breath = Math.sin((2 * Math.PI * t) / 3.8 + 0.8);
  // выдох и чуть откинулся на чтении — «хороший код, но…»
  const lean = 8 - 3 * smooth(6.8, 8.6, t) + 3 * smooth(9.8, 10.6, t);

  return {
    t, typed, caret, taps,
    gaze: gazeAt(t), headGaze: headGazeAt(t),
    blink: blinkAt(t), breath, lean,
    camera: {pos, look, fov, roll},
    focus: 1 / inv,
    aperture: 26,
  };
}

// ── Фактуры: всё из шума, без картинок с диска ───────────────────────────────
export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new CanvasTexture(c);
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function noiseFill(g: CanvasRenderingContext2D, w: number, h: number, rnd: () => number, base: [number, number, number], amp: number) {
  const img = g.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const n = (rnd() - 0.5) * amp;
    img.data[i * 4] = base[0] + n; img.data[i * 4 + 1] = base[1] + n; img.data[i * 4 + 2] = base[2] + n; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

// Штукатурка: мелкое зерно и крупные пятна — стена не читается пластиком.
export function plasterTex(rnd: () => number): CanvasTexture {
  return canvasTex(512, 512, g => {
    noiseFill(g, 512, 512, rnd, [128, 128, 128], 26);
    g.globalAlpha = 0.05;
    for (let i = 0; i < 90; i++) {
      g.fillStyle = rnd() < 0.5 ? '#000' : '#fff';
      g.beginPath(); g.arc(rnd() * 512, rnd() * 512, 20 + rnd() * 80, 0, Math.PI * 2); g.fill();
    }
  }, false);
}

// Орех: волокна — синусы с дрейфом фазы, плюс поры.
export function walnutTex(rnd: () => number, planks = 1): CanvasTexture {
  const W = 1024, H = 1024;
  return canvasTex(W, H, g => {
    const img = g.createImageData(W, H);
    const ph = Array.from({length: planks}, () => rnd() * 100);
    for (let y = 0; y < H; y++) {
      const pl = Math.floor((y / H) * planks);
      for (let x = 0; x < W; x++) {
        const u = x / W, v = y / H;
        const s = Math.sin((v * 90 + Math.sin(u * 7 + ph[pl]) * 2.2 + Math.sin(u * 23 + ph[pl] * 2) * 0.4) * Math.PI);
        const ring = Math.pow(0.5 + 0.5 * s, 3);
        const pore = rnd() < 0.04 ? -18 : 0;
        const seam = planks > 1 && (y % Math.floor(H / planks)) < 2 ? -40 : 0;
        const k = 0.8 + 0.2 * Math.sin(ph[pl] * 3);
        const i = (y * W + x) * 4;
        img.data[i] = (92 - ring * 38 + pore + seam) * k;
        img.data[i + 1] = (62 - ring * 28 + pore + seam) * k;
        img.data[i + 2] = (44 - ring * 20 + pore + seam) * k;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });
}

// Ткань: мелкое плетение.
export function fabricTex(rnd: () => number, base: [number, number, number]): CanvasTexture {
  return canvasTex(256, 256, g => {
    const img = g.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const weave = ((x >> 1) + (y >> 1)) % 2 ? 8 : -8;
      const n = (rnd() - 0.5) * 22 + weave;
      const i = (y * 256 + x) * 4;
      img.data[i] = base[0] + n; img.data[i + 1] = base[1] + n; img.data[i + 2] = base[2] + n; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
}

// ── Экран: редактор ──────────────────────────────────────────────────────────
function drawEditor(g: CanvasRenderingContext2D, typed: number, caret: boolean): void {
  // фон — поднятый графит канона, вертикальный градиент
  const bg = g.createLinearGradient(0, 0, 0, TEX_H);
  bg.addColorStop(0, '#15161A'); bg.addColorStop(1, '#1C1E24');
  g.fillStyle = bg; g.fillRect(0, 0, TEX_W, TEX_H);
  // вкладка файла
  g.fillStyle = '#111215'; g.fillRect(0, 0, TEX_W, TAB_H);
  g.fillStyle = '#1A1B20'; g.fillRect(0, 0, 640, TAB_H);
  g.fillStyle = '#FF8CA3'; g.fillRect(0, TAB_H - 3, 640, 3);
  g.font = `500 28px "JetBrains Mono", monospace`;
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(244,241,235,0.82)';
  g.fillText('SetLampBrightnessHandler.kt', 40, TAB_H / 2 + 1);
  g.fillStyle = 'rgba(244,241,235,0.3)';
  g.fillText('LampRepository.kt', 700, TAB_H / 2 + 1);
  // подсветка текущей строки
  g.fillStyle = 'rgba(255,255,255,0.035)';
  g.fillRect(0, CODE_TOP + TYPE_LINE * LINE_H, TEX_W, LINE_H);

  g.font = `500 ${FONT}px "JetBrains Mono", monospace`;
  CODE.forEach((toks, li) => {
    const y = CODE_TOP + li * LINE_H + LINE_H / 2;
    g.fillStyle = li === TYPE_LINE ? 'rgba(244,241,235,0.55)' : 'rgba(244,241,235,0.22)';
    g.textAlign = 'right';
    g.fillText(String(li + 1), GUTTER - 20, y);
    g.textAlign = 'left';
    let col = 0;
    const limit = li === TYPE_LINE ? typed : Infinity;
    for (const [s, c] of toks) {
      if (col >= limit) break;
      const part = s.slice(0, Math.max(0, limit - col));
      g.fillStyle = C[c];
      g.fillText(part, CODE_X + col * CHAR_W, y);
      col += s.length;
    }
  });
  if (caret) {
    g.fillStyle = 'rgba(244,241,235,0.9)';
    g.fillRect(CODE_X + typed * CHAR_W - 1, CODE_TOP + TYPE_LINE * LINE_H + 10, 4, LINE_H - 20);
  }
}

// ── Загрузка ─────────────────────────────────────────────────────────────────
// Все модели — одним залпом: сервер в WSL медленный, по очереди ждать дольше.
function* glbs(urls: string[]): Generator<any, Object3D[]> {
  const gs: {scene: Object3D}[] = yield Promise.all(urls.map(u => new GLTFLoader().loadAsync(u)));
  return gs.map(g => {
    g.scene.traverse(o => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const mats = (Array.isArray(m.material) ? m.material : [m.material]) as MeshStandardMaterial[];
      for (const mt of mats) {
        // ⚠️ Полупрозрачные листья (BLEND) не пишут глубину — расфокус по глубине
        // их не увидит. Вырез по альфе: лист либо есть, либо нет.
        if (mt.transparent && mt.map) { mt.transparent = false; mt.alphaTest = 0.5; mt.depthWrite = true; }
        // листья — двусторонние карточки
        if (mt.alphaTest > 0) mt.side = DoubleSide;
      }
    });
    return g.scene;
  });
}

/** Букет: стебли из модели ставятся в горлышко вазы веером. */
export function bouquet(src: Object3D, rnd: () => number): Object3D {
  const stems: Mesh[] = [];
  src.updateMatrixWorld(true);
  src.traverse(o => { if ((o as Mesh).isMesh) stems.push(o as Mesh); });
  const out = new Object3D();
  const box = new Box3();
  // каждый стебель дважды, с разным поворотом и наклоном
  for (let copy = 0; copy < 2; copy++) stems.forEach((m, i) => {
    if (copy === 1 && i === 0) return;         // самый высокий — один: букет лёгкий, лицо видно
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    box.setFromBufferAttribute(g.getAttribute('position') as any);
    // основание стебля — в начало координат
    const c = box.getCenter(new Vector3());
    g.translate(-c.x, -box.min.y, -c.z);
    const s = new Mesh(g, m.material);
    const k = copy * stems.length + i;
    const ang = (k / (stems.length * 2)) * Math.PI * 2 + rnd() * 0.5;
    const tilt = 0.12 + rnd() * 0.22;
    s.rotation.set(Math.cos(ang) * tilt, rnd() * Math.PI * 2, Math.sin(ang) * tilt, 'YXZ');
    s.scale.setScalar(1.15 + rnd() * 0.25);
    s.position.set(Math.cos(ang) * 0.012, 0, Math.sin(ang) * 0.012);
    out.add(s);
  });
  return out;
}

export function place(o: Object3D, p: Vector3, rotY = 0, s = 1): Object3D {
  o.position.copy(p);
  o.rotation.y = rotY;
  o.scale.setScalar(s);
  return o;
}

export interface OpeningOptions {
  person: PersonSpec;
  /** Корень ассетов: `<root>/sorrel.glb` и т.д. */
  assets: string;
}

export interface OpeningShot {
  render: (s: OpeningState, W: number, H: number) => HTMLCanvasElement;
  /** Для стенда. */
  scene: Scene;
}

let sharedRenderer: WebGLRenderer | null = null;
export function renderer(): WebGLRenderer {
  if (sharedRenderer) return sharedRenderer;
  RectAreaLightUniformsLib.init();
  sharedRenderer = new WebGLRenderer({canvas: document.createElement('canvas'), antialias: false, preserveDrawingBuffer: true});
  sharedRenderer.outputColorSpace = SRGBColorSpace;
  sharedRenderer.toneMapping = ACESFilmicToneMapping;
  return sharedRenderer;
}

export interface StudyModels {
  anthurium: Object3D; vase: Object3D; syngonium: Object3D; succulent: Object3D; armchair: Object3D; periwinkle: Object3D;
}
export function* loadStudyModels(A: string): Generator<any, StudyModels> {
  const [anthurium, vase, syngonium, succulent, armchair, periwinkle] = yield* glbs(
    ['anthurium', 'vase', 'syngonium', 'succulent', 'armchair', 'periwinkle'].map(n => `${A}/${n}.glb`));
  return {anthurium, vase, syngonium, succulent, armchair, periwinkle};
}

/** Ночной кабинет с цветами: стол, монитор с редактором, полка с гирляндой, торшер. */
export interface StudySet {
  updateScreen: (typed: number, caret: boolean) => void;
  /** Нарисовать на экране своё (редактор коллажа); после этого updateScreen экран не трогает. */
  drawScreen: (draw: (g: CanvasRenderingContext2D, W: number, H: number) => void) => void;
}

/** vase — где стоит ваза с барвинком (интро переставляет её под свой кадр);
 *  exterior — стена дома снаружи вокруг окна (интро влетает в окно);
 *  keyboardZ — глубина клавиатуры; deskFront — передний край стола (в интро стол
 *  глубже к нему: предплечья и запястья лежат на столешнице). */
export function buildNightStudy(scene: Scene, models: StudyModels, rnd: () => number, opts: {vase?: Vector3; exterior?: boolean; keyboardZ?: number; deskFront?: number} = {}): StudySet {
  const {anthurium, vase, syngonium, succulent, armchair, periwinkle} = models;
  // ── комната ──
  const plaster = plasterTex(rnd);
  const wallMat = (hex: string) => new MeshStandardMaterial({color: new Color(hex), roughness: 0.95, roughnessMap: plaster, bumpMap: plaster, bumpScale: 0.6});
  const wallWarm = wallMat('#8a8177');
  const addPlane = (w: number, h: number, mat: Material, p: Vector3, ry: number, rx = 0) => {
    const m = new Mesh(new PlaneGeometry(w, h), mat);
    m.position.copy(p); m.rotation.set(rx, ry, 0, 'YXZ');
    scene.add(m);
    return m;
  };
  // задняя стена (за спиной), боковые, потолок
  addPlane(SIDE_X * 2, CEIL, wallWarm, new Vector3(0, CEIL / 2, BACK_Z), 0);
  addPlane(FRONT_Z - BACK_Z, CEIL, wallWarm, new Vector3(-SIDE_X, CEIL / 2, (FRONT_Z + BACK_Z) / 2), Math.PI / 2);
  addPlane(FRONT_Z - BACK_Z, CEIL, wallWarm, new Vector3(SIDE_X, CEIL / 2, (FRONT_Z + BACK_Z) / 2), -Math.PI / 2);
  addPlane(SIDE_X * 2, FRONT_Z - BACK_Z, new MeshStandardMaterial({color: '#6f6962', roughness: 1}), new Vector3(0, CEIL, (FRONT_Z + BACK_Z) / 2), 0, Math.PI / 2);
  // передняя стена с проёмом окна — четыре куска
  const fw = (x0: number, x1: number, y0: number, y1: number) =>
    addPlane(x1 - x0, y1 - y0, wallWarm, new Vector3((x0 + x1) / 2, (y0 + y1) / 2, FRONT_Z), Math.PI);
  fw(-SIDE_X, WIN.x0, 0, CEIL); fw(WIN.x1, SIDE_X, 0, CEIL); fw(WIN.x0, WIN.x1, 0, WIN.y0); fw(WIN.x0, WIN.x1, WIN.y1, CEIL);
  // пол: доски ореха
  const floorTex = walnutTex(rnd, 6);
  floorTex.repeat.set(2, 2);
  const floor = addPlane(SIDE_X * 2, FRONT_Z - BACK_Z, new MeshStandardMaterial({map: floorTex, roughness: 0.55}), new Vector3(0, 0, (FRONT_Z + BACK_Z) / 2), 0, -Math.PI / 2);
  floor.receiveShadow = true;

  // окно: откосы, подоконник, переплёт; за стеклом — ночной город
  const frameMat = new MeshStandardMaterial({color: '#e7e2da', roughness: 0.6});
  const box = (w: number, h: number, d: number, mat: Material, p: Vector3) => {
    const m = new Mesh(new BoxGeometry(w, h, d), mat);
    m.position.copy(p);
    scene.add(m);
    return m;
  };
  const wcx = (WIN.x0 + WIN.x1) / 2, wcy = (WIN.y0 + WIN.y1) / 2, ww = WIN.x1 - WIN.x0, wh = WIN.y1 - WIN.y0;
  box(ww + 0.1, 0.03, 0.26, frameMat, new Vector3(wcx, WIN.y0 - 0.015, FRONT_Z + 0.08));      // подоконник
  box(0.05, wh, 0.2, wallWarm, new Vector3(WIN.x0 - 0.025, wcy, FRONT_Z + 0.1));             // откосы
  box(0.05, wh, 0.2, wallWarm, new Vector3(WIN.x1 + 0.025, wcy, FRONT_Z + 0.1));
  box(ww, 0.05, 0.2, wallWarm, new Vector3(wcx, WIN.y1 + 0.025, FRONT_Z + 0.1));
  const mull = new MeshStandardMaterial({color: '#2a2b2e', roughness: 0.5});
  const GZ = FRONT_Z + 0.2;
  box(ww, 0.05, 0.05, mull, new Vector3(wcx, WIN.y0 + 0.025, GZ)); box(ww, 0.05, 0.05, mull, new Vector3(wcx, WIN.y1 - 0.025, GZ));
  box(0.05, wh, 0.05, mull, new Vector3(WIN.x0 + 0.025, wcy, GZ)); box(0.05, wh, 0.05, mull, new Vector3(WIN.x1 - 0.025, wcy, GZ));
  box(0.04, wh, 0.05, mull, new Vector3(wcx, wcy, GZ)); box(ww, 0.04, 0.05, mull, new Vector3(wcx, WIN.y0 + wh * 0.62, GZ));
  // небо: засветка города снизу
  const skyTex = canvasTex(16, 256, g => {
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#05080f'); gr.addColorStop(0.6, '#0d1422'); gr.addColorStop(1, '#2a2230');
    g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
  });
  const sky = new Mesh(new PlaneGeometry(60, 30), new MeshBasicMaterial({map: skyTex, color: new Color(0.55, 0.55, 0.55)}));
  sky.position.set(wcx, 8, 30); sky.rotation.y = Math.PI;
  scene.add(sky);
  // окна домов напротив: маленькие яркие квадраты далеко — в расфокусе это диски
  const lit = new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({color: '#ffffff', side: DoubleSide}), 240);
  const mtx = new Matrix4();
  for (let i = 0; i < 240; i++) {
    const far = 14 + rnd() * 30;
    const x = wcx + (rnd() - 0.5) * far * 1.4;
    const y = 1.2 + rnd() * far * 0.45 - far * 0.08;
    // ⚠️ точка, а не квадрат: у крупного источника боке — квадрат со скруглением
    const s = 0.06 + rnd() * 0.06;
    mtx.compose(new Vector3(x, y, FRONT_Z + far), new Quaternion(), new Vector3(s, s * 0.8, 1));
    lit.setMatrixAt(i, mtx);
    const warm = rnd() < 0.72;
    const k = (4 + rnd() * rnd() * 30) * (warm ? 1 : 0.8);
    lit.setColorAt(i, warm ? new Color(1.0 * k, 0.62 * k, 0.32 * k) : new Color(0.55 * k, 0.7 * k, 1.0 * k));
  }
  scene.add(lit);

  // ── стол ──
  const walnut = walnutTex(rnd);
  const deskMat = new MeshPhysicalMaterial({map: walnut, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35});
  const z0 = opts.deskFront ?? DESK.z0;
  const top = new Mesh(new RoundedBoxGeometry(DESK.x1 - DESK.x0, DESK.t, DESK.z1 - z0, 3, 0.004), deskMat);
  top.position.set((DESK.x0 + DESK.x1) / 2, DESK.y - DESK.t / 2, (z0 + DESK.z1) / 2);
  scene.add(top);
  const steel = new MeshStandardMaterial({color: '#1d1e21', roughness: 0.35, metalness: 0.8});
  for (const x of [DESK.x0 + 0.05, DESK.x1 - 0.05]) for (const z of [z0 + 0.05, DESK.z1 - 0.05]) {
    box(0.04, DESK.y - DESK.t, 0.04, steel, new Vector3(x, (DESK.y - DESK.t) / 2, z));
  }

  // ── монитор: тонкий корпус, экран с редактором, стойка ──
  const shell = new MeshStandardMaterial({color: '#202125', roughness: 0.45, metalness: 0.55});
  const body = new Mesh(new RoundedBoxGeometry(SCREEN.w + 0.018, SCREEN.h + 0.018, 0.022, 3, 0.006), shell);
  body.position.set(0, SCREEN.y, SCREEN.z + 0.012);
  scene.add(body);
  const back = new Mesh(new RoundedBoxGeometry(0.34, 0.2, 0.04, 3, 0.012), shell);
  back.position.set(0, SCREEN.y - 0.02, SCREEN.z + 0.04);
  scene.add(back);
  const neck = new Mesh(new RoundedBoxGeometry(0.06, 0.34, 0.02, 3, 0.006), shell);
  neck.position.set(0, DESK.y + 0.17, SCREEN.z + 0.085);
  neck.rotation.x = -0.12;
  scene.add(neck);
  const foot = new Mesh(new RoundedBoxGeometry(0.24, 0.012, 0.18, 3, 0.005), shell);
  foot.position.set(0, DESK.y + 0.006, SCREEN.z + 0.07);
  scene.add(foot);
  const screenCv = document.createElement('canvas');
  screenCv.width = TEX_W; screenCv.height = TEX_H;
  const sg = screenCv.getContext('2d')!;
  const screenTex = new CanvasTexture(screenCv);
  screenTex.colorSpace = SRGBColorSpace;
  screenTex.anisotropy = 8;
  // экран светится сам: базовый материал, яркость — чуть выше белого листа
  const screenMat = new MeshBasicMaterial({map: screenTex, color: new Color(1.35, 1.35, 1.35)});
  const screen = new Mesh(new PlaneGeometry(SCREEN.w, SCREEN.h), screenMat);
  screen.position.set(0, SCREEN.y, SCREEN.z);
  screen.rotation.y = Math.PI;
  scene.add(screen);
  let screenKey = '';
  let custom = false;
  const updateScreen = (typed: number, caret: boolean) => {
    const key = `${typed}|${caret}`;
    if (custom || key === screenKey) return;
    screenKey = key;
    drawEditor(sg, typed, caret);
    screenTex.needsUpdate = true;
  };
  const drawScreen = (draw: (g: CanvasRenderingContext2D, W: number, H: number) => void) => {
    custom = true;
    draw(sg, TEX_W, TEX_H);
    screenTex.needsUpdate = true;
  };
  // свет экрана — мягкий прямоугольник, холодный, на человека
  const screenLight = new RectAreaLight(new Color('#c9d7ff'), 7, SCREEN.w, SCREEN.h);
  screenLight.position.set(0, SCREEN.y, SCREEN.z - 0.01);
  screenLight.lookAt(0, SCREEN.y, -1);
  scene.add(screenLight);

  // ── клавиатура: раскладка ANSI, буквы на колпачках (крупный план «его глазами») ──
  const kbZ = opts.keyboardZ ?? KEYS.z;
  scene.add(buildKeyboard(KEYS.x, kbZ, KEY_TOP, KEYBOARDS.graphite).group);
  // мышь
  const mouse = new Mesh(new SphereGeometry(0.03, 24, 16), new MeshStandardMaterial({color: '#232427', roughness: 0.4}));
  mouse.scale.set(1, 0.42, 1.75);
  mouse.position.set(-0.3, DESK.y + 0.008, 0.4 + (kbZ - KEYS.z));    // под правую руку (он смотрит в +Z, правая — −X), правее стрелок
  scene.add(mouse);
  // кружка: керамика, внутри темно
  const mugPts = [new Vector2(0, 0), new Vector2(0.038, 0), new Vector2(0.04, 0.004), new Vector2(0.04, 0.095), new Vector2(0.036, 0.095), new Vector2(0.036, 0.008), new Vector2(0, 0.008)];
  const mug = new Mesh(new LatheGeometry(mugPts, 40), new MeshPhysicalMaterial({color: '#d9d2c7', roughness: 0.3, clearcoat: 0.6}));
  mug.position.set(0.44, DESK.y, 0.62);
  scene.add(mug);

  // ── цветы на столе: барвинок в керамической вазе ──
  const vaseAt = opts.vase ?? VASE;
  place(vase, vaseAt, 0.4, VASE_S);
  const flowers = place(bouquet(periwinkle, rnd), vaseAt.clone().add(new Vector3(0, 0.31 * VASE_S * 0.55, 0)), 0.3, 1);
  scene.add(vase, flowers);

  // ── за спиной: полка с книгами и гирляндой, торшер, кресло, фикус ──
  const shelfMat = new MeshStandardMaterial({map: walnutTex(rnd), roughness: 0.6});
  const SH = {x0: 0.35, x1: 1.55, z: BACK_Z + 0.16};
  const shelfYs = [0.95, 1.35, 1.75];
  for (const y of shelfYs) box(SH.x1 - SH.x0, 0.025, 0.28, shelfMat, new Vector3((SH.x0 + SH.x1) / 2, y, SH.z));
  // на полках — антуриум и суккулент; ставим до книг, чтобы книги их обходили
  place(anthurium, new Vector3(1.3, shelfYs[2] + 0.0125, SH.z), 0.8, 0.5);
  place(succulent, new Vector3(0.52, shelfYs[1] + 0.0125, SH.z), 0.3, 0.8);
  const plantBoxes = [anthurium, succulent].map(o => { o.updateMatrixWorld(true); return new Box3().setFromObject(o).expandByScalar(0.01); });
  const books: Matrix4[] = [], colors: Color[] = [];
  const PAL = ['#6b2f2a', '#2f4a5e', '#8a7a5c', '#3d3d3d', '#5c4a3a', '#2c3b2e', '#9a8f80', '#4a2f45', '#b3a58c'];
  // ⚠️ Раньше цветы стояли внутри ряда книг (листья насквозь через корешки), а
  // наклонённая книга вращалась вокруг середины и врезалась в соседку и в полку:
  // на проезде эти пересечения мерцали (автор: «у книг текстуры просвечивают и
  // мерцают»). Теперь книга, задевающая цветок, не ставится (на её месте — просвет),
  // а наклонённая опирается на нижний правый угол и ложится в свой зазор 5 см.
  // Случайные числа тянутся в том же порядке — остальные книги те же, что были.
  for (const y0 of shelfYs) {
    let x = SH.x0 + 0.03;
    while (x < SH.x1 - 0.04) {
      const w = 0.018 + rnd() * 0.03, h = 0.17 + rnd() * 0.13;
      if (rnd() < 0.1) { x += 0.06 + rnd() * 0.12; continue; }
      const tilt = rnd() < 0.06 ? Math.min(0.25, Math.asin(0.046 / h)) : 0;
      const color = new Color(PAL[Math.floor(rnd() * PAL.length)]);
      const bottom = y0 + 0.0125;
      const hit = plantBoxes.some(b => b.intersectsBox(new Box3(new Vector3(x, bottom, SH.z - 0.09), new Vector3(x + w + (tilt ? 0.05 : 0), bottom + h, SH.z + 0.11))));
      if (!hit) {
        // опора — нижний правый угол: верх уходит вправо, в зазор
        const c = tilt
          ? new Vector3(x + w - (w / 2) * Math.cos(tilt) + (h / 2) * Math.sin(tilt), bottom + (w / 2) * Math.sin(tilt) + (h / 2) * Math.cos(tilt), SH.z + 0.01)
          : new Vector3(x + w / 2, bottom + h / 2, SH.z + 0.01);
        books.push(new Matrix4().compose(c, new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -tilt), new Vector3(w, h, 0.2)));
        colors.push(color);
      }
      x += w + 0.002 + (tilt ? 0.05 : 0);
    }
  }
  const bookMesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({roughness: 0.8}), books.length);
  books.forEach((m, i) => { bookMesh.setMatrixAt(i, m); bookMesh.setColorAt(i, colors[i]); });
  scene.add(bookMesh);
  scene.add(anthurium, succulent);
  // гирлянда: провисает дугами вдоль полок, лампочки — тёплые яркие точки
  const bulbGeo = new SphereGeometry(0.0045, 8, 6);
  const bulbs: Vector3[] = [];
  for (const [i, y] of [shelfYs[1], shelfYs[2]].entries()) {
    const N = 16;
    for (let k = 0; k < N; k++) {
      const u = (k + 0.5) / N;
      const x = SH.x0 + u * (SH.x1 - SH.x0);
      const sag = 0.07 * Math.sin(((u * 3) % 1) * Math.PI);
      bulbs.push(new Vector3(x, y - 0.02 - sag, SH.z + 0.15 + (i ? 0.005 : 0)));
    }
  }
  const bulbMesh = new InstancedMesh(bulbGeo, new MeshBasicMaterial({color: new Color(6, 3.6, 1.6)}), bulbs.length);
  bulbs.forEach((b, i) => { mtx.makeTranslation(b.x, b.y, b.z); bulbMesh.setMatrixAt(i, mtx); });
  scene.add(bulbMesh);
  const fairy = new PointLight(new Color('#ffb56b'), 0.35, 2.5, 2);
  fairy.position.set((SH.x0 + SH.x1) / 2, 1.5, SH.z + 0.3);
  scene.add(fairy);
  // торшер: основание, штанга, абажур, светящийся изнутри
  const lampMat = new MeshStandardMaterial({color: '#1a1a1b', roughness: 0.35, metalness: 0.7});
  const lampBase = new Mesh(new CylinderGeometry(0.14, 0.15, 0.02, 32), lampMat);
  lampBase.position.set(LAMP.x, 0.01, LAMP.z);
  scene.add(lampBase);
  const pole = new Mesh(new CylinderGeometry(0.009, 0.009, LAMP.y, 12), lampMat);
  pole.position.set(LAMP.x, LAMP.y / 2, LAMP.z);
  scene.add(pole);
  const shadeTex = canvasTex(8, 128, g => {
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#6e5236'); gr.addColorStop(0.65, '#d7a36f'); gr.addColorStop(1, '#ffd2a0');
    g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
  });
  const shade = new Mesh(new CylinderGeometry(0.15, 0.21, 0.28, 40, 1, true), new MeshBasicMaterial({map: shadeTex, color: new Color(2.2, 2.2, 2.2), side: DoubleSide}));
  shade.position.copy(LAMP);
  scene.add(shade);
  // лампа светит вниз и вверх из-под абажура: пятна на полу и на стене
  const down = new SpotLight(new Color('#ffb46f'), 9, 5, 62 * D2R, 0.55, 2);
  down.position.copy(LAMP).add(new Vector3(0, -0.02, 0));
  down.target.position.set(LAMP.x, 0, LAMP.z);
  const up = new SpotLight(new Color('#ffb46f'), 5, 4, 50 * D2R, 0.6, 2);
  up.position.copy(LAMP);
  up.target.position.set(LAMP.x, CEIL, LAMP.z);
  scene.add(down, down.target, up, up.target);
  // контур на человеке: тот же торшер, узким пучком в голову
  const rim = new SpotLight(new Color('#ffb27a'), 12, 6, 16 * D2R, 0.7, 2);
  rim.position.copy(LAMP);
  rim.target.position.set(EYE.x, EYE.y - 0.12, EYE.z);
  scene.add(rim, rim.target);
  // кресло у правой стены и фикус рядом
  place(armchair, new Vector3(1.55, 0, -0.35), -Math.PI / 2 - 0.35, 1);
  place(syngonium, new Vector3(1.7, 0, -1.25), 1.2, 1.1);
  scene.add(armchair, syngonium);

  // ── кресло программиста: высокая спинка из ткани ──
  const chairFab = new MeshStandardMaterial({map: fabricTex(rnd, [46, 48, 52]), roughness: 0.95});
  const backrest = new Mesh(new RoundedBoxGeometry(0.46, 0.62, 0.07, 4, 0.03), chairFab);
  backrest.position.set(0, 0.86, -0.3);
  backrest.rotation.x = -0.12;
  scene.add(backrest);

  // окно: слабый холодный свет ночи в комнату
  const night = new RectAreaLight(new Color('#7f98c8'), 0.5, ww, wh);
  night.position.set(wcx, wcy, FRONT_Z + 0.15);
  night.lookAt(wcx, wcy, 0);
  scene.add(night);
  scene.add(new HemisphereLight(0x2a3040, 0x0b0907, 0.12));
  if (opts.exterior) buildFacade(scene, box, wallWarm);

  return {updateScreen, drawScreen};
}

/** Наружная плоскость стены: окно утоплено в неё на 7 см. */
export const FACADE_Z = FRONT_Z + 0.27;
/** Окно кабинета (проём), м. */
export const STUDY_WINDOW = WIN;

// Стена дома снаружи: штукатурка с проёмом окна, наружные откосы и каменный отлив.
// Изнутри комнаты её не видно (стена одной стороной смотрит наружу).
function buildFacade(scene: Scene, box: (w: number, h: number, d: number, mat: Material, p: Vector3) => Mesh, reveal: Material) {
  // своя случайность: у комнаты не должен сдвинуться ни один случайный выбор
  const tex = plasterTex(mulberry32(4242));
  tex.repeat.set(1 / 1.4, 1 / 1.4);                  // UV формы — в метрах: пятно штукатурки ~1.4 м
  const mat = new MeshStandardMaterial({color: '#5b554e', roughness: 0.95, roughnessMap: tex, bumpMap: tex, bumpScale: 1.4});
  const shape = new Shape();
  shape.moveTo(-7, -1); shape.lineTo(7, -1); shape.lineTo(7, 8); shape.lineTo(-7, 8); shape.lineTo(-7, -1);
  const hole = new Path();
  hole.moveTo(WIN.x0, WIN.y0); hole.lineTo(WIN.x0, WIN.y1); hole.lineTo(WIN.x1, WIN.y1); hole.lineTo(WIN.x1, WIN.y0); hole.lineTo(WIN.x0, WIN.y0);
  shape.holes.push(hole);
  const wall = new Mesh(new ShapeGeometry(shape), mat);
  wall.position.z = FACADE_Z;
  scene.add(wall);
  // наружные откосы: от рамы до плоскости стены
  const d = FACADE_Z - (FRONT_Z + 0.2), zc = FRONT_Z + 0.2 + d / 2;
  const ww = WIN.x1 - WIN.x0, wh = WIN.y1 - WIN.y0, wcx = (WIN.x0 + WIN.x1) / 2, wcy = (WIN.y0 + WIN.y1) / 2;
  box(0.05, wh, d, reveal, new Vector3(WIN.x0 - 0.025, wcy, zc));
  box(0.05, wh, d, reveal, new Vector3(WIN.x1 + 0.025, wcy, zc));
  box(ww + 0.1, 0.05, d, reveal, new Vector3(wcx, WIN.y1 + 0.025, zc));
  // низ проёма — на всю толщину стены: иначе снаружи под рамой видна щель
  box(ww + 0.1, 0.05, FACADE_Z - FRONT_Z, reveal, new Vector3(wcx, WIN.y0 - 0.025, (FRONT_Z + FACADE_Z) / 2));
  // каменный отлив под окном — чуть выступает из стены
  const stone = new MeshStandardMaterial({color: '#7a746c', roughness: 0.8, roughnessMap: tex, bumpMap: tex, bumpScale: 0.6});
  box(ww + 0.2, 0.045, 0.17, stone, new Vector3(wcx, WIN.y0 - 0.02, FACADE_Z + 0.07));
}

export function* buildOpening(opts: OpeningOptions): Generator<any, OpeningShot> {
  yield (document as any).fonts?.load?.(`500 ${FONT}px "JetBrains Mono"`);
  const A = opts.assets;
  const person = yield* loadPerson(opts.person);
  const models = yield* loadStudyModels(A);
  const rnd = mulberry32(20260926);
  const scene = new Scene();
  scene.add(person.root);

  const study = buildNightStudy(scene, models, rnd);

  const camera = new PerspectiveCamera(30, 16 / 9, 0.03, 120);
  let lens: CinemaLens | null = null;
  const wristBase: [Vector3, Vector3] = [WRIST_TYPING[0].clone(), WRIST_TYPING[1].clone()];

  const render = (s: OpeningState, W: number, H: number) => {
    const r = renderer();
    if (!lens) lens = new CinemaLens(r);
    study.updateScreen(s.typed, s.caret);

    // голова идёт за взглядом: доворот на точку, куда он смотрит, с запаздыванием
    const hg = s.headGaze.clone().sub(EYE);
    const yaw = Math.atan2(hg.x, hg.z) / D2R;
    const pitch = -Math.atan2(hg.y, Math.hypot(hg.x, hg.z)) / D2R;
    const head: [number, number, number] = [
      // голова почти неподвижна: доля поворота к среднему взгляду и медленный дрейф
      pitch * 0.35 + 2 + wob(s.t, 0.15, 0.22, 1.3),
      yaw * 0.25 + wob(s.t, 0.2, 0.18, 0.2),
      wob(s.t, 0.15, 0.15, 2.2),
    ];
    const wrist: [Vector3, Vector3] = [
      wristBase[0].clone().add(new Vector3(wob(s.t, 0.003, 2.1, 0.4), 0, 0)),
      wristBase[1].clone().add(new Vector3(wob(s.t, 0.003, 1.7, 2.4), 0, 0)),
    ];
    person.setPose({
      eyes: EYE.clone().add(new Vector3(0, s.breath * 0.0012, 0)),
      lean: s.lean, head, gazeAt: s.gaze, blink: s.blink, wrist, breath: s.breath, taps: s.taps,
      keys: {y: KEY_TOP, z: HOME_Z, x: HOME_X, spread: HOME_SPREAD},
    });

    camera.position.copy(s.camera.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(s.camera.look);
    camera.rotateZ(s.camera.roll);
    camera.fov = s.camera.fov;
    camera.updateMatrixWorld(true);
    return lens.render(scene, camera, W, H, {focus: s.focus, K: s.aperture, maxR: 34, exposure: 1.0, time: s.t, grain: 0.03, vignette: 0.34});
  };
  return {render, scene};
}

// для стенда: точки и размеры места
export const OPENING_DEBUG = {EYE, SCREEN, VASE, FLOWER, LAMP, charPoint};
