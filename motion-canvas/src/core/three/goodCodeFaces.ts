import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  HemisphereLight,
  LatheGeometry,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  RectAreaLight,
  Scene,
  SphereGeometry,
  SpotLight,
  Vector2,
  Vector3,
} from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {attach, cupRadius, fitGlasses, glasses, headphones, headPoints, softReflection, takeawayCup} from './accessories';
import {CinemaLens} from './cinemaLens';
import {drawIde, IDE_THEMES, LAMP_HANDLER} from './ide';
import {
  bouquet, buildNightStudy, canvasTex, EYE, fabricTex, KEY_TOP, KEYS, loadStudyModels, mulberry32,
  place, plasterTex, renderer, SCREEN, smooth, StudyModels, TYPE_TOTAL, walnutTex, wob, WRIST_TYPING, HOME_X, HOME_SPREAD, HOME_Z, keyAt,
} from './goodCodeOpening';
import {KEY_U} from './keyboard';
import {HandAim, loadPerson, Person, PersonPose, PersonSpec} from './rocketboxPerson';

// ── Good Code, But I Hate It · шесть лиц, склейки ускоряются ─────────────────
// Камера — на месте монитора. Программист читает код, то есть смотрит почти в
// объектив. Щелчок клавиши — склейка на следующего: другой человек, другая
// комната, другой свет; кадр тот же. Разные люди, разные проекты — работа одна.
// Планы короче и короче (2.4 → 0.4 с), щелчки учащаются, как разгон набора;
// после последнего — пауза в черноте.
//   1. Ночь, кабинет с цветами и торшером (тот же, что в проезде).
//   2. День, опенспейс: стеклянная стена за спиной, холодный свет.
//   3. Вечер, кухня: тёплый подвес над столом, зелёная стена, полка.
//   4. Ночь, пустой опенспейс: откинулся в кресле, красная куртка; за окном
//      проходит поезд надземки — огни плывут в расфокусе.
//   5. Утро, та же кухня: девушка держит стаканчик кофе у плеча, правой печатает.
//   6. Ночь, кабинет без торшера — лицо только в свете экрана, в очках отражается код.
// Вещи (очки, наушники, кружка) — core/three/accessories, крепятся к кадрам
// головы и кисти человека.
//
// ⚠️ Кадр целиком собирает этот модуль (facesTimeline — чистая функция времени),
// сцена MC только ведёт часы; тот же модуль снимает стенд.
// ⚠️ Глаза за работой почти неподвижны: 2–3 фиксации за кадр, скачки малые.
// Голова — медленный дрейф, без тряски (правки автора по проезду).
// ⚠️ Склейка — ровно на щелчке: палец доходит до клавиши в последний кадр.
// Звук щелчка ставит автор.

const D2R = Math.PI / 180;

// Камера: центр экрана, чуть перед стеклом. Глаза — на верхней трети кадра.
const FOV = 40;
const CAM = new Vector3(0, SCREEN.y, SCREEN.z - 0.015);
const aimAt = (eyes: Vector3, fov = FOV) => new Vector3(eyes.x, eyes.y - Math.tan((fov / 2) * D2R) * eyes.distanceTo(CAM) / 3, eyes.z);

// ── Раскадровка ──────────────────────────────────────────────────────────────
interface Beat {
  dur: number;
  /** Комната (индекс сцены) — у каждого плана своя. */
  set: number;
  /** Фиксации взгляда: время и точка на экране (м от центра: вправо — к его левой руке, вверх). */
  fix: {t: number; x: number; y: number}[];
  blinks: number[];
  lean: number;
  /** Наклон головы, °: кивок, поворот, крен. */
  head: [number, number, number];
  /** Нажатия: время, рука (0 — левая, 1 — правая), палец. Последнее — щелчок склейки. */
  taps: [number, number, number][];
  /** Руки: по умолчанию обе на домашнем ряду; 'arrows' — левая на ASDF, правая на
   *  стрелках (листает код), руки лежат не симметрично (автор). */
  hands?: 'arrows';
  /** Откинулся в кресле: глаза дальше и ниже, руки не на клавиатуре. */
  recline?: boolean;
  /** Что на нём: очки, наушники, стаканчик кофе в левой руке у плеча. */
  props?: {glasses?: boolean; headphones?: boolean; coffee?: boolean};
  /** Свой угол объектива: откинувшегося надо показать с креслом, иначе поза не читается. */
  fov?: number;
}

// быстрый набор: чередование рук и пальцев от t0 до t1
const typing = (t0: number, t1: number, step: number): [number, number, number][] => {
  const out: [number, number, number][] = [];
  for (let t = t0, k = 0; t < t1; t += step * (0.75 + ((k * 7) % 5) / 10), k++) out.push([t, k % 2, 1 + ((k * 3) % 4)]);
  return out;
};

const BEATS: Beat[] = [
  // 1 · ночь, кабинет с цветами: читает спокойно, один перевод взгляда, моргнул, щелчок
  {dur: 2.4, set: 0, fix: [{t: 0, x: -0.02, y: 0.02}, {t: 1.3, x: 0.04, y: 0.015}],   // одно движение глаз за план
    blinks: [1.2], lean: 8, head: [3, 0, 0], taps: [[0.8, 1, 2], [1.55, 1, 2], [2.4, 1, 2]], hands: 'arrows'},
  // 2 · день, опенспейс: быстро набирает
  {dur: 1.8, set: 1, fix: [{t: 0, x: 0.05, y: -0.01}, {t: 0.9, x: 0.0, y: -0.012}],
    blinks: [0.6], lean: 5, head: [1, -2, 2.5], taps: [...typing(0.25, 1.4, 0.13), [1.8, 0, 3]]},
  // 3 · вечер, кухня: старший, читает, щелчок правым средним
  {dur: 1.3, set: 2, fix: [{t: 0, x: 0.0, y: 0.04}, {t: 0.7, x: 0.05, y: 0.035}],
    blinks: [0.4], lean: 2, head: [0, 3, -1.5], taps: [[1.3, 1, 2]], props: {headphones: true}},
  // 4 · ночь, пустой опенспейс: откинулся в кресле, смотрит на экран издалека
  {dur: 0.9, set: 3, fix: [{t: 0, x: -0.02, y: -0.03}],
    blinks: [], lean: -22, head: [-6, -6, 7], taps: [], recline: true, fov: 54},
  // 5 · утро, кухня: печатает
  {dur: 0.6, set: 4, fix: [{t: 0, x: 0.03, y: 0.0}],
    blinks: [], lean: 5, head: [3, 4, 0], taps: [[0.12, 1, 1], [0.3, 1, 2], [0.6, 1, 1]], props: {coffee: true}},
  // 6 · ночь, только свет экрана: вспышка лица
  {dur: 0.4, set: 5, fix: [{t: 0, x: 0.0, y: 0.02}],
    blinks: [], lean: 9, head: [4, 0, 0], taps: [[0.4, 1, 1]], props: {glasses: true}},
];
/** Кадр его глазами: куда смотрит камера (между экраном и клавиатурой) и угол. */
/** Половинка со столом: откуда смотрит камера, куда, угол, глубина резкости, фокус. */
export interface DeskView {pos: Vector3; at: Vector3; fov: number; K: number; focus: 'screen' | 'hands'}
// Автор: «с другого ракурса, чуть сбоку; клавиатура слишком маленькая; пусть код
// будет видно». Камера над правым предплечьем, чуть сбоку; объектив с большой
// глубиной резкости и фокусом на экране: код читается, руки лишь чуть мягче.
export const DESK_VIEW: DeskView = {pos: new Vector3(-0.34, 1.0, 0.16), at: new Vector3(-0.03, 0.9, 0.55), fov: 50, K: 6, focus: 'screen'};
/** Левая на ASDF чуть вперёд, правая на стрелках (средний — на ↓): руки не симметричны. */
const ARROWS_KEYS = {
  y: KEY_TOP,
  z: [HOME_Z + 0.004, keyAt('↓').z + 0.006] as [number, number],
  x: [HOME_X[0] + 0.004, keyAt('↓').x + 0.003] as [number, number],
  spread: [HOME_SPREAD, 2.2 * KEY_U] as [number, number],
  turn: [0.28, -0.04] as [number, number],
};

/** Середина кисти от запястья к пальцам, м: сюда наводится фокус и ложится тень. */
const HAND_MID = 0.075;
/** Сцены, где стол с клавиатурой (кабинет): в них руки видны его глазами. */
const DESK_SETS = new Set([0, 5]);

/** Поза покоя: по ней меряется лицо (посадка очков). */
const neutralPose = (): PersonPose => ({
  eyes: EYE.clone(), lean: 0, head: [0, 0, 0], gazeAt: new Vector3(0, SCREEN.y, SCREEN.z), blink: 0, breath: 0,
  wrist: [WRIST_TYPING[0].clone(), WRIST_TYPING[1].clone()],
});

/** Пауза в черноте после последнего щелчка. */
const PAUSE = 1.2;
/** Стаканчик в левой руке у плеча — так держат кофе с собой (референс автора
 *  Downloads/coffee.avif): стакан стоит прямо, кисть «рукопожатием» — ладонь к
 *  стакану, большой палец сверху, пальцы обхватывают его спереди, к камере.
 *  ⚠️ Кружка у губ (прошлая версия) — другой жест и кривой хват. */
const CUP_AT = new Vector3(0.125, 1.02, 0.165);   // середина хвата, мир: кисть целиком в кадре
const GRIP_Y = 0.052;                              // высота хвата от дна стакана
const PALM = 0.046;                                // от кости кисти до середины ладони
const PALM_T = 0.012;                              // от кости кисти до кожи ладони
export const FACE_STARTS = BEATS.reduce<number[]>((a, b, i) => [...a, i ? a[i - 1] + BEATS[i - 1].dur : 0], []);
export const FACES_DURATION = BEATS.reduce((s, b) => s + b.dur, 0) + PAUSE;
const EYES_AT = (b: Beat) => (b.recline ? new Vector3(0.03, 1.07, -0.26) : EYE.clone());

export interface FaceState {
  t: number;
  /** План 0…5; −1 — пауза в черноте. */
  shot: number;
  /** Время внутри кадра, с. */
  u: number;
  gaze: Vector3;
  blink: number;
  breath: number;
  taps: [number[], number[]];
}

const SACCADE = 0.06;

export function facesTimeline(t: number): FaceState {
  const end = FACES_DURATION - PAUSE;
  if (t > end + 1e-6) return {t, shot: -1, u: t - end, gaze: EYE.clone(), blink: 0, breath: 0, taps: [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]]};
  let shot = 0;
  while (shot < BEATS.length - 1 && t >= FACE_STARTS[shot + 1]) shot++;
  const b = BEATS[shot];
  // последний кадр каждого плана — момент щелчка, а не первый кадр следующего
  const u = Math.min(t - FACE_STARTS[shot], b.dur);
  let i = 0;
  while (i < b.fix.length - 1 && u >= b.fix[i + 1].t) i++;
  const f = b.fix[i], prev = b.fix[Math.max(0, i - 1)];
  const k = i === 0 ? 1 : smooth(0, SACCADE, u - f.t);
  const onScreen = (x: number, y: number) => new Vector3(CAM.x - x, CAM.y + y, SCREEN.z);
  const gaze = onScreen(prev.x, prev.y).lerp(onScreen(f.x, f.y), k);
  const blink = b.blinks.reduce((m, s) => Math.max(m, smooth(s, s + 0.07, u) * (1 - smooth(s + 0.1, s + 0.24, u))), 0);
  const taps: [number[], number[]] = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]];
  for (const [tt, hand, finger] of b.taps) {
    const dt = u - tt;
    if (dt < -0.08 || dt > 0.1) continue;
    const v = dt < 0 ? smooth(-0.08, 0, dt) : 1 - smooth(0, 0.1, dt);
    taps[hand][finger] = Math.max(taps[hand][finger], v);
  }
  // у каждого своё дыхание: разная фаза и темп
  const breath = Math.sin((2 * Math.PI * u) / (3.2 + ((shot * 0.37) % 1.2)) + shot * 1.3);
  return {t, shot, u, gaze, blink, breath, taps};
}

// ── Комнаты ──────────────────────────────────────────────────────────────────
const box = (scene: Scene, w: number, h: number, d: number, mat: Material, p: Vector3) => {
  const m = new Mesh(new BoxGeometry(w, h, d), mat);
  m.position.copy(p);
  scene.add(m);
  return m;
};
const plane = (scene: Scene, w: number, h: number, mat: Material, p: Vector3, ry: number, rx = 0) => {
  const m = new Mesh(new PlaneGeometry(w, h), mat);
  m.position.copy(p);
  m.rotation.set(rx, ry, 0, 'YXZ');
  scene.add(m);
  return m;
};
// экран светит на человека: у всех комнат одинаково
function screenLight(scene: Scene, k: number) {
  const l = new RectAreaLight(new Color('#c9d7ff'), k, SCREEN.w, SCREEN.h);
  l.position.set(0, SCREEN.y, SCREEN.z - 0.01);
  l.lookAt(0, SCREEN.y, -1);
  scene.add(l);
}
// спинка кресла за человеком
function chairBack(scene: Scene, rnd: () => number, rgb: [number, number, number], recline = false) {
  const m = new Mesh(new RoundedBoxGeometry(0.48, 0.7, 0.07, 4, 0.03), new MeshStandardMaterial({map: fabricTex(rnd, rgb), roughness: 0.95}));
  m.position.set(0, recline ? 0.88 : 0.86, recline ? -0.5 : -0.3);
  m.rotation.x = recline ? -0.42 : -0.12;
  scene.add(m);
}

// 2 · День, опенспейс. За спиной — стеклянная стена в светлый город: высокий
// ключ, холодный контур по волосам и плечам; спереди — мягкий свет зала.
/** Поезд надземки: тёмный состав с горящими окнами; едет вдоль стекла. */
function buildTrain(scene: Scene): Object3D {
  const train = new Object3D();
  const body = new MeshBasicMaterial({color: new Color(0.02, 0.02, 0.025)});
  const lit = new MeshBasicMaterial({color: new Color(6, 5.2, 4.2)});
  for (let car = 0; car < 5; car++) {
    const x0 = car * 17;
    const c = new Mesh(new BoxGeometry(16.4, 3.2, 3), body);
    c.position.set(x0, 0, 0);
    train.add(c);
    for (let k = 0; k < 7; k++) {
      const w = new Mesh(new PlaneGeometry(1.3, 0.8), lit);
      w.position.set(x0 - 6.6 + k * 2.2, 0.35, 1.52);
      train.add(w);
    }
  }
  // перед домами напротив (их фасады с z ≈ −22), выше уровня окна
  train.position.set(0, 2.1, -18);
  scene.add(train);
  return train;
}

function buildDayOffice(scene: Scene, m: StudyModels, rnd: () => number, night = false) {
  const Z = -2.8;
  const concrete = plasterTex(rnd);
  const floor = new MeshStandardMaterial({color: '#9a9994', roughness: 0.7, roughnessMap: concrete});
  plane(scene, 8, 6, floor, new Vector3(0, 0, -0.5), 0, -Math.PI / 2);
  plane(scene, 8, 6, new MeshStandardMaterial({color: '#e9e8e4', roughness: 0.95}), new Vector3(0, 3.0, -0.5), 0, Math.PI / 2);
  // стекло: небо с лёгким градиентом и силуэты домов напротив — всё далеко и в расфокусе
  const sky = canvasTex(16, 256, g => {
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#b9cde6'); gr.addColorStop(0.7, '#e3e9ef'); gr.addColorStop(1, '#f4efe6');
    g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
  });
  // ночью небо — глубокий синий, дома — тёмные массы с горящими окнами
  const skyM = new Mesh(new PlaneGeometry(120, 60), new MeshBasicMaterial({map: sky, color: night ? new Color(0.05, 0.07, 0.13) : new Color(2.6, 2.6, 2.6)}));
  skyM.position.set(0, 12, -60);
  scene.add(skyM);
  const facade = [new Color(1.1, 1.12, 1.15), new Color(0.75, 0.78, 0.82), new Color(1.35, 1.3, 1.2), new Color(0.55, 0.58, 0.62)];
  for (let i = 0; i < 14; i++) {
    const w = 6 + rnd() * 10, h = 8 + rnd() * 30, z = -25 - rnd() * 30;
    const b = new Mesh(new BoxGeometry(w, h, 6), new MeshBasicMaterial({color: night ? facade[i % facade.length].clone().multiplyScalar(0.03) : facade[i % facade.length]}));
    b.position.set(-30 + i * 4.8 + rnd() * 3, h / 2 - 6, z);
    scene.add(b);
    if (!night) continue;
    // горящие окна — точки, в расфокусе диски
    for (let k = 0; k < 10; k++) {
      const wm = new Mesh(new PlaneGeometry(0.5, 0.4), new MeshBasicMaterial({color: rnd() < 0.7 ? new Color(5, 3.2, 1.6) : new Color(2.2, 3, 4.5)}));
      wm.position.set(b.position.x + (rnd() - 0.5) * w * 0.8, rnd() * (h - 7) - 5, z + 3.05);
      scene.add(wm);
    }
  }
  // переплёт стеклянной стены
  const metal = new MeshStandardMaterial({color: '#2b2d31', roughness: 0.4, metalness: 0.7});
  for (let x = -3.6; x <= 3.6; x += 1.2) box(scene, 0.06, 3.0, 0.08, metal, new Vector3(x, 1.5, Z));
  box(scene, 8, 0.06, 0.08, metal, new Vector3(0, 0.45, Z));
  box(scene, 8, 0.06, 0.08, metal, new Vector3(0, 2.55, Z));
  // потолочные линейные светильники — светлые полосы вверху кадра
  const strip = new MeshBasicMaterial({color: night ? new Color(5, 4.6, 4.2) : new Color(3, 3, 3)});
  for (const z of [-0.6, -1.8]) for (const x of [-1.4, 1.4]) box(scene, 1.2, 0.02, 0.08, strip, new Vector3(x, 2.95, z));
  // соседний стол: монитор спиной к нам и настольная лампа — «здесь работают»
  const desk2 = walnutTex(rnd);
  box(scene, 1.4, 0.03, 0.7, new MeshStandardMaterial({map: desk2, roughness: 0.5}), new Vector3(1.35, 0.74, -1.7));
  const shell = new MeshStandardMaterial({color: '#1f2023', roughness: 0.45, metalness: 0.5});
  const mon = new Mesh(new RoundedBoxGeometry(0.6, 0.36, 0.03, 3, 0.006), shell);
  mon.position.set(1.2, 1.1, -1.55);
  mon.rotation.y = 0.25;
  scene.add(mon);
  box(scene, 0.05, 0.3, 0.03, shell, new Vector3(1.2, 0.9, -1.5));
  // растения у окна
  const syn = m.syngonium.clone();
  place(syn, new Vector3(-1.05, 0, -2.2), 0.4, 1.35);
  const anth = m.anthurium.clone();
  place(anth, new Vector3(0.55, 0.62, -2.35), 2.0, 0.8);
  box(scene, 0.4, 0.62, 0.4, new MeshStandardMaterial({color: '#d8d4cc', roughness: 0.8}), new Vector3(0.55, 0.31, -2.35));
  scene.add(syn, anth);
  chairBack(scene, rnd, night ? [40, 42, 46] : [70, 74, 80], night);
  if (night) {
    // ночью: все ушли, горит одна линия потолка над ним и экран
    const over = new SpotLight(new Color('#ffe2c0'), 6, 5, 35 * D2R, 0.8, 2);
    over.position.set(-0.6, 2.9, -0.6);
    over.target.position.copy(EYE);
    scene.add(over, over.target);
    screenLight(scene, 3.5);
    scene.add(new HemisphereLight(0x223048, 0x0a0908, 0.12));
    return;
  }
  // свет: стекло сзади (контур), зал спереди (мягко), экран
  const win = new RectAreaLight(new Color('#eef3ff'), 5, 7, 2.6);
  win.position.set(0, 1.5, Z + 0.05);
  win.lookAt(0, 1.5, 0);
  scene.add(win);
  const room = new RectAreaLight(new Color('#fff6ec'), 1.6, 1.8, 1.2);
  room.position.set(0.5, 1.9, 1.6);
  room.lookAt(EYE);
  scene.add(room);
  screenLight(scene, 3.5);
  scene.add(new HemisphereLight(0xe8eef8, 0x6b665e, 0.55));
}

// 3 · Вечер, кухня. Зелёная стена, открытая полка с посудой и цветами, над
// столом тёплый подвес — он и рисует лицо сбоку, экран досвечивает холодным.
function buildEveningKitchen(scene: Scene, m: StudyModels, rnd: () => number, morning = false) {
  const Z = -2.2;
  const plaster = plasterTex(rnd);
  const green = new MeshStandardMaterial({color: '#3a4a40', roughness: 0.95, roughnessMap: plaster, bumpMap: plaster, bumpScale: 0.6});
  plane(scene, 6, 2.8, green, new Vector3(0, 1.4, Z), 0);
  const warm = new MeshStandardMaterial({color: '#7d6f60', roughness: 0.95, roughnessMap: plaster});
  plane(scene, 4, 2.8, warm, new Vector3(-2.0, 1.4, 0), Math.PI / 2);
  plane(scene, 4, 2.8, warm, new Vector3(2.0, 1.4, 0), -Math.PI / 2);
  const wood = walnutTex(rnd, 5);
  wood.repeat.set(2, 2);
  plane(scene, 6, 4, new MeshStandardMaterial({map: wood, roughness: 0.6}), new Vector3(0, 0, -0.2), 0, -Math.PI / 2);
  plane(scene, 6, 4, new MeshStandardMaterial({color: '#5d544b', roughness: 1}), new Vector3(0, 2.8, -0.2), 0, Math.PI / 2);
  // кухонный фасад внизу: светлое дерево и столешница
  const oak = walnutTex(rnd);
  box(scene, 2.6, 0.88, 0.6, new MeshStandardMaterial({map: oak, color: '#d9c6a8', roughness: 0.55}), new Vector3(-0.6, 0.44, Z + 0.3));
  box(scene, 2.62, 0.035, 0.62, new MeshPhysicalMaterial({color: '#cfcac2', roughness: 0.3, clearcoat: 0.5}), new Vector3(-0.6, 0.9, Z + 0.3));
  // открытая полка: банки, кружки, букет
  const shelfMat = new MeshStandardMaterial({map: walnutTex(rnd), roughness: 0.6});
  const SY = 1.55, SX0 = -1.5, SX1 = 0.1, SZ = Z + 0.13;
  box(scene, SX1 - SX0, 0.03, 0.24, shelfMat, new Vector3((SX0 + SX1) / 2, SY, SZ));
  const ceramic = ['#e9e2d6', '#b8543f', '#2f4a5e', '#d8c7a0'].map(c => new MeshPhysicalMaterial({color: c, roughness: 0.35, clearcoat: 0.5}));
  const jar = (h: number, r: number) => new LatheGeometry([new Vector2(0, 0), new Vector2(r, 0), new Vector2(r, h * 0.85), new Vector2(r * 0.7, h), new Vector2(0, h)], 32);
  let x = SX0 + 0.1;
  while (x < SX1 - 0.3) {
    const h = 0.1 + rnd() * 0.12, r = 0.035 + rnd() * 0.03;
    const j = new Mesh(jar(h, r), ceramic[Math.floor(rnd() * ceramic.length)]);
    j.position.set(x, SY + 0.015, SZ);
    scene.add(j);
    x += r * 2 + 0.03 + rnd() * 0.06;
  }
  const vase = m.vase.clone();
  place(vase, new Vector3(-0.05, SY + 0.015, SZ), 0.3, 0.62);
  const flowers = place(bouquet(m.periwinkle, rnd), new Vector3(-0.05, SY + 0.015 + 0.1, SZ), 1.2, 0.85);
  scene.add(vase, flowers);
  const suc = m.succulent.clone();
  place(suc, new Vector3(-0.3, 0.92, Z + 0.3), 0.5, 0.9);
  scene.add(suc);
  // картина на стене слева в кадре: тёплые пятна
  const art = canvasTex(256, 320, g => {
    g.fillStyle = '#e6dccb'; g.fillRect(0, 0, 256, 320);
    g.fillStyle = '#c56b45'; g.beginPath(); g.arc(110, 140, 70, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2f4a5e'; g.fillRect(40, 220, 170, 50);
  });
  box(scene, 0.44, 0.54, 0.025, new MeshStandardMaterial({color: '#1c1c1d', roughness: 0.5}), new Vector3(1.0, 1.55, Z + 0.02));
  plane(scene, 0.38, 0.48, new MeshStandardMaterial({map: art, roughness: 0.8}), new Vector3(1.0, 1.55, Z + 0.035), 0);
  // подвес над столом: тёмный купол, внутри горит лампа
  const P = new Vector3(0.62, 1.78, -0.95);
  const dome = new Mesh(new LatheGeometry([new Vector2(0.005, 0.2), new Vector2(0.04, 0.19), new Vector2(0.11, 0.1), new Vector2(0.19, 0)], 48),
    new MeshStandardMaterial({color: '#1e2a24', roughness: 0.4, metalness: 0.5, side: DoubleSide}));
  dome.position.copy(P);
  scene.add(dome);
  const cord = new Mesh(new CylinderGeometry(0.003, 0.003, 1.0, 6), new MeshBasicMaterial({color: '#111'}));
  cord.position.set(P.x, P.y + 0.7, P.z);
  scene.add(cord);
  const bulb = new Mesh(new SphereGeometry(0.035, 20, 14), new MeshBasicMaterial({color: morning ? new Color(0.5, 0.45, 0.4) : new Color(9, 6, 3.2)}));
  bulb.position.copy(P).add(new Vector3(0, 0.02, 0));
  scene.add(bulb);
  const glow = new Mesh(new CylinderGeometry(0.185, 0.185, 0.002, 48), new MeshBasicMaterial({color: morning ? new Color(0.12, 0.1, 0.08) : new Color(2.2, 1.5, 0.8)}));
  glow.position.copy(P).add(new Vector3(0, 0.004, 0));
  scene.add(glow);
  if (morning) {
    // утро: подвес выключен, холодный свет из окна слева в кадре (его правая сторона)
    const win = new RectAreaLight(new Color('#e4ecff'), 6.5, 1.4, 1.6);
    win.position.set(1.95, 1.45, -0.3);
    win.lookAt(EYE);
    scene.add(win);
    chairBack(scene, rnd, [150, 140, 128]);
    screenLight(scene, 2.5);
    // утренний рассеянный свет: мягко, но лицо держит светотень от окна
    // ⚠️ Заливка 1.1 + 3 давала пересвеченный плоский кадр (правка автора)
    scene.add(new HemisphereLight(0xdfe7f2, 0x4a443c, 0.5));
    const fill = new RectAreaLight(new Color('#eef2f8'), 1.2, 3, 2);
    fill.position.set(0, 2.2, 1.0);
    fill.lookAt(0, 1.2, -2.2);
    scene.add(fill);
    return;
  }
  const down = new SpotLight(new Color('#ffb56e'), 14, 5, 55 * D2R, 0.5, 2);
  down.position.copy(P);
  down.target.position.set(P.x - 0.3, 0.8, P.z + 0.6);
  scene.add(down, down.target);
  // тот же подвес — тёплый свет на лицо сбоку-сверху
  const key = new SpotLight(new Color('#ffb877'), 9, 4, 20 * D2R, 0.7, 2);
  key.position.copy(P);
  key.target.position.copy(EYE);
  scene.add(key, key.target);
  const wall = new PointLight(new Color('#ffb070'), 0.6, 3, 2);
  wall.position.set(-0.6, 1.9, Z + 0.5);
  scene.add(wall);
  chairBack(scene, rnd, [58, 44, 36]);
  screenLight(scene, 3);
  scene.add(new HemisphereLight(0x3a3a44, 0x100c09, 0.15));
}

// ── Сборка ───────────────────────────────────────────────────────────────────
export interface FacesOptions {
  /** Шесть человек — по плану на каждого. */
  people: PersonSpec[];
  assets: string;
}

export interface FacesShot {
  render: (s: FaceState, W: number, H: number) => HTMLCanvasElement;
  /** Его глазами: экран, клавиатура, руки. */
  renderPov: (s: FaceState, W: number, H: number, view?: DeskView) => HTMLCanvasElement;
  /** Кадр пополам: слева лицо, справа его глазами. */
  renderSplit: (s: FaceState, W: number, H: number) => HTMLCanvasElement;
  scenes: Scene[];
}

export function* buildFaces(opts: FacesOptions): Generator<any, FacesShot> {
  yield (document as any).fonts?.load?.('500 38px "JetBrains Mono"');
  const models = yield* loadStudyModels(opts.assets);
  // все люди — одним залпом: сервер медленный
  const people: Person[] = yield Promise.all(opts.people.map(p => {
    const g = loadPerson(p);
    return new Promise<Person>((res, rej) => {
      const step = (v?: any) => { let r; try { r = g.next(v); } catch (e) { rej(e); return; } if (r.done) res(r.value); else Promise.resolve(r.value).then(step, rej); };
      step();
    });
  }));
  const scenes = BEATS.map(() => new Scene());
  // первая комната — та же, что в проезде; экран за камерой, но светит
  const study = buildNightStudy(scenes[0], models, mulberry32(20260926));
  study.updateScreen(TYPE_TOTAL, true);
  // на экране — обработчик лампы из 1.1: его он и открыл первым
  let lampLine = -1;
  const drawLamp = (line: number) => {
    if (line === lampLine) return;
    lampLine = line;
    study.drawScreen((g, W, H) => drawIde(g, W, H, IDE_THEMES.canon, {file: 'SetLampBrightnessHandler.kt', code: LAMP_HANDLER, font: 34, from: 10, current: line}));
  };
  drawLamp(17);
  // ⚠️ Свет экрана ночной комнаты поставлен под проезд (профиль, затылок). В лоб,
  // из объектива, он же делал лицо плоским и белым — здесь его вдвое тише.
  scenes[0].traverse(o => { const l = o as RectAreaLight; if (l.isRectAreaLight && Math.abs(l.width - SCREEN.w) < 1e-6) l.intensity *= 0.45; });
  // модели ночной комнаты уже стоят в первой сцене — остальным нужны свои копии
  const copy = (): StudyModels => ({
    anthurium: models.anthurium.clone(), vase: models.vase.clone(), syngonium: models.syngonium.clone(),
    succulent: models.succulent.clone(), armchair: models.armchair.clone(), periwinkle: models.periwinkle.clone(),
  });
  buildDayOffice(scenes[1], copy(), mulberry32(7));
  buildEveningKitchen(scenes[2], copy(), mulberry32(11));
  buildDayOffice(scenes[3], copy(), mulberry32(7), true);
  buildEveningKitchen(scenes[4], copy(), mulberry32(11), true);
  // 6 · тот же кабинет, торшер и гирлянда погашены — остаётся экран
  const dark = buildNightStudy(scenes[5], copy(), mulberry32(20260926));
  dark.updateScreen(TYPE_TOTAL, true);
  scenes[5].traverse(o => {
    const l = o as any;
    if (l.isSpotLight || l.isPointLight) l.intensity = 0;
    if (l.isRectAreaLight && Math.abs(l.width - SCREEN.w) > 1e-6) l.intensity *= 0.2;
    const mm = (o as Mesh).material as MeshBasicMaterial;
    if ((o as Mesh).isMesh && mm?.type === 'MeshBasicMaterial' && mm.color.r > 1.5) mm.color.multiplyScalar(0.04);
  });
  scenes.forEach((s, i) => s.add(people[i].root));
  const train = buildTrain(scenes[3]);
  // вещи: у каждого плана свои
  const screenTex = (() => {
    let t: any = null;
    scenes[5].traverse(o => { const mm = (o as Mesh).material as MeshBasicMaterial; if (mm?.map && (mm.map.image as any)?.width === 2048) t = mm.map; });
    return t;
  })();
  const reflect = screenTex ? softReflection(screenTex.image) : undefined;
  // тень ладони на клавишах: радиальное пятно, темнее к центру
  const shadowTex = canvasTex(64, 64, g => {
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  const handShadow: Record<number, Mesh[]> = {};
  for (const set of DESK_SETS) {
    handShadow[set] = [0, 1].map(() => {
      const m = new Mesh(new PlaneGeometry(0.1, 0.085), new MeshBasicMaterial({map: shadowTex, transparent: true, depthWrite: false}));
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 2;
      scenes[set].add(m);
      return m;
    });
  }
  const props = BEATS.map((b, i) => {
    const out: {head?: Object3D; cup?: Object3D} = {};
    if (b.props?.glasses) {
      // очки садятся по замеру лица этого человека
      people[i].setPose(neutralPose());
      out.head = glasses({fit: fitGlasses(headPoints(people[i])), reflect, reflectK: 0.16});
    }
    if (b.props?.headphones) out.head = headphones();
    if (b.props?.coffee) out.cup = takeawayCup();
    if (out.head) scenes[b.set].add(out.head);
    if (out.cup) scenes[b.set].add(out.cup);
    return out;
  });

  const camera = new PerspectiveCamera(FOV, 16 / 9, 0.03, 200);
  camera.position.copy(CAM);
  camera.lookAt(aimAt(EYE));
  camera.updateMatrixWorld(true);
  let lens: CinemaLens | null = null;
  const EXPOSURE = [1.0, 0.8, 1.0, 1.0, 0.85, 1.15];
  // шейдеры всех трёх комнат — заранее: иначе на каждой склейке кадр ждёт ~2 с
  const r0 = renderer();
  for (const s of scenes) r0.compile(s, camera);

  const render = (s: FaceState, W: number, H: number) => {
    const r = renderer();
    if (!lens) lens = new CinemaLens(r);
    if (s.shot < 0) {
      // пауза: чернота
      r.setSize(W, H, false);
      r.setRenderTarget(null);
      r.setClearColor(0x000000, 1);
      r.clear();
      return r.domElement;
    }
    const b = BEATS[s.shot];
    const eyes = EYES_AT(b);
    // голова: к взгляду — самую малость, плюс медленный дрейф; без тряски
    const g = s.gaze.clone().sub(eyes);
    const head: [number, number, number] = [
      b.head[0] - Math.atan2(g.y, g.z) / D2R * 0.2 + wob(s.u, 0.15, 0.22, 1.3 + s.shot),
      b.head[1] + Math.atan2(g.x, g.z) / D2R * 0.15 + wob(s.u, 0.2, 0.18, 0.2 + s.shot),
      b.head[2] + wob(s.u, 0.15, 0.15, 2.2 + s.shot),
    ];
    const wrist: [Vector3, Vector3] = b.recline
      // откинувшись — руки на коленях, не на клавиатуре
      ? [new Vector3(0.15, 0.64, 0.12), new Vector3(-0.15, 0.64, 0.12)]
      : [WRIST_TYPING[0].clone(), WRIST_TYPING[1].clone()];
    let handAim: [HandAim | null, HandAim | null] | undefined;
    const P = props[s.shot];
    const cupR = cupRadius(GRIP_Y);
    if (P.cup) {
      // левая кисть «рукопожатием»: пальцы вперёд и чуть к середине, тыл наружу
      const fingers = new Vector3(-0.22, 0.12, 1).normalize();
      const back = new Vector3(1, 0, 0.22).normalize();
      // запястье — туда, откуда ладонь ляжет на стакан в CUP_AT
      wrist[0] = CUP_AT.clone().addScaledVector(back, cupR + PALM_T).addScaledVector(fingers, -PALM);
      handAim = [{fingers, back, wrap: cupR}, null];
    }
    people[s.shot].setPose({
      eyes: eyes.clone().add(new Vector3(0, s.breath * 0.0012, 0)),
      lean: b.lean, head, gazeAt: s.gaze, blink: s.blink, breath: s.breath, taps: s.taps,
      wrist, handAim,
      keys: b.recline ? undefined : b.hands === 'arrows' ? ARROWS_KEYS : {y: KEY_TOP, z: HOME_Z, x: HOME_X, spread: HOME_SPREAD},
    });
    if (P.head) attach(P.head, people[s.shot].headFrame());
    // он листает код стрелкой: каретка на экране опускается с каждым ↓
    if (b.set === 0 && b.hands === 'arrows') drawLamp(17 + b.taps.filter(([tt, hand, f]) => hand === 1 && f === 2 && tt <= s.u + 1e-6).length);
    if (DESK_SETS.has(b.set)) {
      for (const h of [0, 1] as const) {
        if (handAim?.[h]) { handShadow[b.set][h].visible = false; continue; }
        const f = people[s.shot].handFrame(h);
        const m = new Vector3().setFromMatrixPosition(f).addScaledVector(new Vector3().setFromMatrixColumn(f, 2), HAND_MID);
        handShadow[b.set][h].visible = true;
        handShadow[b.set][h].position.set(m.x, KEY_TOP + 0.0008, m.z + 0.004);
      }
    }
    if (P.cup) {
      // стакан — по фактической кисти: в ладонь, ось вдоль костяшек (вверх)
      const f = people[s.shot].handFrame(0);
      const X = new Vector3().setFromMatrixColumn(f, 0);
      const Y = new Vector3().setFromMatrixColumn(f, 1);
      const Z = new Vector3().setFromMatrixColumn(f, 2);
      const up = X.y > 0 ? X : X.negate();
      const at = new Vector3().setFromMatrixPosition(f).addScaledVector(Z, PALM).addScaledVector(Y, -(cupR + PALM_T));
      P.cup.position.copy(at).addScaledVector(up, -GRIP_Y);
      P.cup.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), up);
      P.cup.rotateY(-0.6);                 // носик крышки — к её губам, не к камере
      P.cup.updateMatrixWorld(true);
    }
    if (b.set === 3) train.position.x = 10 - 26 * s.u;   // голова состава уже в кадре справа, уходит влево
    camera.fov = b.fov ?? FOV;
    camera.lookAt(aimAt(eyes, camera.fov));
    camera.updateMatrixWorld(true);
    return lens.render(scenes[b.set], camera, W, H, {
      focus: eyes.distanceTo(CAM), K: 30, maxR: 34, exposure: EXPOSURE[s.shot], time: s.t, grain: 0.03, vignette: 0.32,
    });
  };

  // ── Половинка: стол сбоку — клавиатура крупно, за ней экран с кодом ──
  // Поза уже стоит после render(). Голову не прячем: камера у правого плеча
  // смотрит вперёд, голова остаётся за кадром.
  const povCam = new PerspectiveCamera(50, 9 / 16, 0.02, 200);
  const renderPov = (s: FaceState, W: number, H: number, view: DeskView = DESK_VIEW) => {
    const r = renderer();
    if (!lens) lens = new CinemaLens(r);
    const b = BEATS[s.shot];
    const person = people[s.shot];
    povCam.position.copy(view.pos);
    povCam.up.set(0, 1, 0);
    povCam.lookAt(view.at);
    povCam.fov = view.fov;
    povCam.updateMatrixWorld(true);
    const fwd = view.at.clone().sub(view.pos).normalize();
    // фокус: на экране (код читается) или на руках — средняя глубина середин кистей
    const pts = view.focus === 'screen'
      ? [new Vector3(0, SCREEN.y, SCREEN.z)]
      : [0, 1].map(h => {
        const f = person.handFrame(h as 0 | 1);
        return new Vector3().setFromMatrixPosition(f).addScaledVector(new Vector3().setFromMatrixColumn(f, 2), HAND_MID);
      });
    const focus = pts.reduce((a, m) => a + m.clone().sub(view.pos).dot(fwd), 0) / pts.length;
    return lens.render(scenes[b.set], povCam, W, H, {
      focus, K: view.K, maxR: 34, exposure: EXPOSURE[s.shot], time: s.t + 0.5, grain: 0.03, vignette: 0.28,
    });
  };

  // ── Раскладка: слева лицо, справа его половинка ──
  const split = document.createElement('canvas');
  const sg = split.getContext('2d')!;
  const renderSplit = (s: FaceState, W: number, H: number) => {
    if (split.width !== W || split.height !== H) { split.width = W; split.height = H; }
    const half = Math.round(W / 2);
    sg.drawImage(render(s, half, H), 0, 0, half, H);
    if (s.shot >= 0) sg.drawImage(renderPov(s, W - half, H), half, 0, W - half, H);
    return split;
  };

  // ⚠️ Первый показ комнаты грузит её текстуры в видеокарту (~1.5–2 с): прогреваем
  // все при сборке, иначе на каждой склейке кадр встаёт.
  for (const t0 of FACE_STARTS) render(facesTimeline(t0 + 0.01), 320, 180);
  return {render, renderPov, renderSplit, scenes};
}

