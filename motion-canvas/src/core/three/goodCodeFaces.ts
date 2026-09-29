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
import {attach, cupRadius, drawSoftReflection, fitGlasses, glasses, headphones, headPoints, softReflection, takeawayCup} from './accessories';
import {CinemaLens} from './cinemaLens';
import {buildDesk, Desk, DeskSpec} from './desk';
import {drawIde, HANDLERS, IdeChrome, IDE_THEMES} from './ide';
import {
  bouquet, buildNightStudy, canvasTex, DESK, EYE, fabricTex, KEY_TOP, KEYS, loadStudyModels, mulberry32,
  place, plasterTex, renderer, SCREEN, smooth, StudyModels, studyKeysAt, TYPE_TOTAL, walnutTex, wob, WRIST_TYPING, HOME_X, HOME_SPREAD, HOME_Z, keyAt,
} from './goodCodeOpening';
import {KEY_U, KEYBOARDS} from './keyboard';
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
  /** Руки (автор: «пусть не симметрично»): по умолчанию обе на домашнем ряду;
   *  arrows — правая на стрелках (листает код); upper — правая рядом выше;
   *  reach — правая тянется к Enter; trackpad / mouse — правая на тачпаде / мыши. */
  hands?: 'arrows' | 'upper' | 'reach' | 'trackpad' | 'mouse';
  /** Что у него на экране: обработчик, тема, редактор. */
  ide: {h: keyof typeof HANDLERS; theme: keyof typeof IDE_THEMES; chrome: IdeChrome};
  /** Откинулся в кресле: глаза дальше и ниже, руки не на клавиатуре. */
  recline?: boolean;
  /** Сидит дальше от стола, м: руки тянутся к клавишам прямее. */
  sitBack?: number;
  /** Сиденье выше, м: локти над столешницей, предплечья ложатся на стол сверху. */
  sitUp?: number;
  /** Верхние веки чуть опущены (0…1): взгляд вниз, к ноутбуку. Своих век, идущих за
   *  взглядом, у модели нет — без этого глаза, опущенные на 25°, смотрят испуганно. */
  lidDrop?: number;
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
    blinks: [1.2], lean: 8, head: [3, 0, 0], taps: [[0.8, 1, 2], [1.55, 1, 2], [2.4, 1, 2]], hands: 'arrows',
    // ⚠️ сбоку, средним планом, руки «как цапля» (автор): локти у корпуса ~105°. Сидит
    // дальше — руки тянутся к клавишам прямее
    sitBack: 0.09,
    // запястья на столе: сиденье выше — локти над столешницей, предплечья не режут её край
    sitUp: 0.05,
    ide: {h: 'lamp', theme: 'canon', chrome: 'jetbrains'}},
  // 2 · день, опенспейс: быстро набирает
  {dur: 1.8, set: 1, fix: [{t: 0, x: 0.05, y: -0.01}, {t: 0.9, x: 0.0, y: -0.012}],
    blinks: [0.6], lean: 5, head: [1, -2, 2.5], taps: [...typing(0.25, 1.4, 0.13), [1.8, 0, 3]], hands: 'upper',
    ide: {h: 'thermostat', theme: 'light', chrome: 'jetbrains'}},
  // 3 · вечер, кухня: старший, читает, щелчок правым средним.
  // ⚠️ У него ноутбук: экран на 27 см ниже камеры (центр 0.857 против 1.13). Смотрел
  // почти в объектив — взгляд опущен к экрану ноутбука (~25°), голова ниже, веки чуть
  // опущены (автор: «дед с блондинкой пусть чуть ниже смотрят, они с ноутами работают»).
  // Замер стенда: при 19° разницы с объективом почти не видно.
  {dur: 1.3, set: 2, fix: [{t: 0, x: 0.0, y: -0.23}, {t: 0.7, x: 0.05, y: -0.235}],
    blinks: [0.4], lean: 2, head: [7, 3, -1.5], lidDrop: 0.25, taps: [[0.5, 0, 2], [1.3, 0, 1]], props: {headphones: true}, hands: 'trackpad',
    ide: {h: 'lock', theme: 'gruvbox', chrome: 'vim'}},
  // 4 · ночь, пустой опенспейс: откинулся в кресле, смотрит на экран издалека
  {dur: 0.9, set: 3, fix: [{t: 0, x: -0.02, y: -0.03}],
    blinks: [], lean: -22, head: [-6, -6, 7], taps: [], recline: true, fov: 54,
    ide: {h: 'blinds', theme: 'dark', chrome: 'vscode'}},
  // 5 · утро, кухня: печатает; ноутбук — взгляд к верху его экрана, как у деда
  {dur: 0.6, set: 4, fix: [{t: 0, x: 0.03, y: -0.23}],
    // моргает посреди своего плана в интро (там план 1.57 с, раскадровка с u −0.97; автор)
    blinks: [-0.25], lean: 5, head: [9, 4, 0], lidDrop: 0.25, taps: [[0.12, 1, 1], [0.3, 1, 2], [0.6, 1, 1]], props: {coffee: true},
    ide: {h: 'speaker', theme: 'solarized', chrome: 'vscode'}},
  // 6 · ночь, только свет экрана: вспышка лица
  {dur: 0.4, set: 5, fix: [{t: 0, x: 0.0, y: 0.02}],
    blinks: [], lean: 9, head: [4, 0, 0], taps: [[0.4, 1, 1]], props: {glasses: true}, hands: 'reach',
    // у последнего на экране — код, который дальше идёт по сценарию (1.1, лампа):
    // в каноне ролика, слева; в интро камера въезжает в этот экран (автор)
    ide: {h: 'lamp', theme: 'canon', chrome: 'page'}},
];
/** Кадр его глазами: куда смотрит камера (между экраном и клавиатурой) и угол. */
/** Половинка со столом: откуда смотрит камера, куда, угол, глубина резкости, фокус. */
export interface DeskView {pos: Vector3; at: Vector3; fov: number; K: number; focus: 'screen' | 'hands'}
// Автор: «с другого ракурса, чуть сбоку; клавиатура слишком маленькая; пусть код
// будет видно». Камера над правым предплечьем, чуть сбоку; объектив с большой
// глубиной резкости и фокусом на экране: код читается, руки лишь чуть мягче.
// Положение подобрано расчётом: экран, клавиатура и обе руки целиком в портретной
// половине, голова и правое плечо — вне кадра; азимут 36° от его взгляда, уровень плеча.
export const DESK_VIEW: DeskView = {pos: new Vector3(-0.441, 1.04, -0.096), at: new Vector3(0.108, 0.951, 0.735), fov: 55.1, K: 6, focus: 'screen'};
/** Середина кисти от запястья к пальцам, м: сюда наводится фокус и ложится тень. */
const HAND_MID = 0.075;
/** Сцены, где стол с клавиатурой (кабинет): в них руки видны его глазами. */
const DESK_SETS = new Set([0, 1, 2, 3, 4, 5]);

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
// Середина хвата, мир. Автор: «кофе поближе к груди», потом «руку опусти» — замер по
// вершинам туловища: грудь на этой высоте — z ≈ 0.0 (x 0…0.1); стакан — в 5 см.
const CUP_AT = new Vector3(0.10, 0.945, 0.05);
/** Основания пальцев (указательный…мизинец) по оси стакана от середины ладони, м —
 *  замер на стенде (Female_Adult_04): верхний палец лежит там, где стакан шире. */
const FINGER_ON_CUP = [0.020, 0.0, -0.022, -0.040];
const GRIP_Y = 0.052;                              // высота хвата от дна стакана
const PALM = 0.046;                                // от кости кисти до середины ладони
const PALM_T = 0.012;                              // от кости кисти до кожи ладони
export const FACE_STARTS = BEATS.reduce<number[]>((a, b, i) => [...a, i ? a[i - 1] + BEATS[i - 1].dur : 0], []);
export const FACES_DURATION = BEATS.reduce((s, b) => s + b.dur, 0) + PAUSE;
const EYES_AT = (b: Beat) => (b.recline ? new Vector3(0.03, 1.07, -0.26) : EYE.clone().set(EYE.x, EYE.y + (b.sitUp ?? 0), EYE.z - (b.sitBack ?? 0)));
/** Где глаза человека плана (с учётом того, как он сидит). */
export const eyesOf = (shot: number) => EYES_AT(BEATS[shot]);

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
  /** Своя камера лица (проезд в интро); иначе — на месте монитора. */
  camera?: {pos: Vector3; look: Vector3; fov: number; roll?: number};
  /** Свой фокус (м по оси) и светосила. */
  focus?: number;
  aperture?: number;
  /** Строка каретки у первого (листает код); иначе — по нажатиям ↓ плана. */
  caretLine?: number;
}

const SACCADE = 0.06;

export function facesTimeline(t: number): FaceState {
  const end = FACES_DURATION - PAUSE;
  if (t > end + 1e-6) return {t, shot: -1, u: t - end, gaze: EYE.clone(), blink: 0, breath: 0, taps: [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]]};
  let shot = 0;
  while (shot < BEATS.length - 1 && t >= FACE_STARTS[shot + 1]) shot++;
  // последний кадр каждого плана — момент щелчка, а не первый кадр следующего
  return faceStateAt(shot, Math.min(t - FACE_STARTS[shot], BEATS[shot].dur), t);
}

/** Длительность плана по раскадровке, с. */
export const shotDuration = (shot: number) => BEATS[shot].dur;

/** Состояние плана shot в момент u от его начала (u может выходить за план). */
export function faceStateAt(shot: number, u: number, t: number): FaceState {
  const b = BEATS[shot];
  let i = 0;
  while (i < b.fix.length - 1 && u >= b.fix[i + 1].t) i++;
  const f = b.fix[i], prev = b.fix[Math.max(0, i - 1)];
  const k = i === 0 ? 1 : smooth(0, SACCADE, u - f.t);
  const onScreen = (x: number, y: number) => new Vector3(CAM.x - x, CAM.y + y, SCREEN.z);
  const gaze = onScreen(prev.x, prev.y).lerp(onScreen(f.x, f.y), k);
  const blink = b.blinks.reduce((m, s) => Math.max(m, smooth(s, s + 0.07, u) * (1 - smooth(s + 0.1, s + 0.24, u))), b.lidDrop ?? 0);
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
// спинка кресла за человеком
function chairBack(scene: Scene, rnd: () => number, rgb: [number, number, number], recline = false) {
  const fab = new MeshStandardMaterial({map: fabricTex(rnd, rgb), roughness: 0.95});
  const m = new Mesh(new RoundedBoxGeometry(0.48, 0.7, 0.07, 4, 0.03), fab);
  m.position.set(0, recline ? 0.88 : 0.86, recline ? -0.5 : -0.3);
  m.rotation.x = recline ? -0.42 : -0.12;
  scene.add(m);
  if (!recline) return;
  // подлокотники: на них лежат предплечья откинувшегося
  const frame = new MeshStandardMaterial({color: '#1b1c1f', roughness: 0.4, metalness: 0.5});
  for (const sx of [-1, 1]) {
    const x = RECLINE_X + sx * ARMREST.dx;
    scene.add(new Mesh(new RoundedBoxGeometry(0.075, 0.045, ARMREST.len, 3, 0.018), fab).translateX(x).translateY(ARMREST.top - 0.0225).translateZ(ARMREST.z));
    scene.add(new Mesh(new RoundedBoxGeometry(0.03, ARMREST.top - 0.46, 0.05, 2, 0.01), frame).translateX(x).translateY((ARMREST.top + 0.46) / 2 - 0.02).translateZ(ARMREST.z - 0.12));
  }
}
/** Откинувшийся: середина тела по x и подлокотники (верх, отступ от середины, центр и длина по z). */
const RECLINE_X = 0.03;
const ARMREST = {top: 0.575, dx: 0.3, z: -0.03, len: 0.52};

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
    scene.add(new HemisphereLight(0x223048, 0x0a0908, 0.12));
    return;
  }
  // свет: стекло сзади (контур), зал спереди (мягко), экран
  const win = new RectAreaLight(new Color('#eef3ff'), 5, 7, 2.6);
  win.position.set(0, 1.5, Z + 0.05);
  win.lookAt(0, 1.5, 0);
  // потолочная панель над столом: свет сверху лепит клавиши и руки (иначе стол
  // и клавиатура плоские — вся комната залита рассеянным)
  const panel = new RectAreaLight(new Color('#fffaf2'), 5, 1.2, 0.6);
  panel.position.set(0, 2.9, 0.62);
  panel.lookAt(0, 0.74, 0.62);
  scene.add(panel);
  scene.add(win);
  const room = new RectAreaLight(new Color('#fff6ec'), 1.6, 1.8, 1.2);
  room.position.set(0.5, 1.9, 1.6);
  room.lookAt(EYE);
  scene.add(room);
  scene.add(new HemisphereLight(0xe8eef8, 0x6b665e, 0.32));
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
    // утренний рассеянный свет: мягко, но лицо держит светотень от окна
    // ⚠️ Заливка 1.1 + 3 давала пересвеченный плоский кадр (правка автора)
    scene.add(new HemisphereLight(0xdfe7f2, 0x4a443c, 0.5));
    const fill = new RectAreaLight(new Color('#eef2f8'), 1.2, 3, 2);
    fill.position.set(0, 2.2, 1.0);
    fill.lookAt(0, 1.2, -2.2);
    scene.add(fill);
    return;
  }
  // ⚠️ Широкий яркий конус заливал стол перед ноутбуком оранжевым (автор: «освещение
  // сцены ноута слишком яркое»): тише и уже — пятно у подвеса, не весь стол
  const down = new SpotLight(new Color('#ffb56e'), 7, 5, 38 * D2R, 0.6, 2);
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
  scene.add(new HemisphereLight(0x3a3a44, 0x100c09, 0.15));
}

// ── Перед столом: что видно за монитором из половинки ─────────────────────────
// Опенспейс: низкая войлочная перегородка, за ней стол соседа (монитор спиной),
// дальше стена с акустическими панелями и высокое растение. Ночью всё гаснет,
// горят только огоньки ожидания на мониторах и табличка выхода.
function officeFront(scene: Scene, m: StudyModels, rnd: () => number, night: boolean) {
  const felt = new MeshStandardMaterial({color: night ? '#2a2c30' : '#7d8288', roughness: 1});
  const part = new Mesh(new RoundedBoxGeometry(1.8, 0.42, 0.04, 3, 0.012), felt);
  part.position.set(0, 0.74 + 0.21, 1.08);
  scene.add(part);
  // стол соседа за перегородкой: монитор к нам спиной
  box(scene, 1.6, 0.03, 0.7, new MeshStandardMaterial({color: night ? '#141517' : '#e4e2dd', roughness: 0.55}), new Vector3(0, 0.725, 1.5));
  const shell = new MeshStandardMaterial({color: night ? '#101113' : '#c9ccd1', roughness: 0.4, metalness: 0.6});
  for (const x of [-0.45, 0.4]) {
    const mon = new Mesh(new RoundedBoxGeometry(0.58, 0.34, 0.03, 3, 0.006), shell);
    mon.position.set(x, 1.13, 1.42);
    scene.add(mon);
    if (night) {
      const led = new Mesh(new SphereGeometry(0.003, 8, 6), new MeshBasicMaterial({color: new Color(0.3, 2.5, 0.8)}));
      led.position.set(x + 0.25, 0.975, 1.405);
      scene.add(led);
    }
  }
  // дальняя стена: панели, растение
  const wall = new MeshStandardMaterial({color: night ? '#1b1c1f' : '#dcd9d3', roughness: 0.95, roughnessMap: plasterTex(rnd)});
  plane(scene, 8, 3, wall, new Vector3(0, 1.5, 3.2), Math.PI);
  const panel = new MeshStandardMaterial({color: night ? '#23262b' : '#9aa3ab', roughness: 1});
  for (let i = 0; i < 4; i++) box(scene, 0.6, 1.1, 0.03, panel, new Vector3(-1.2 + i * 0.8, 1.55, 3.17));
  const syn = m.syngonium.clone();
  place(syn, new Vector3(1.9, 0, 2.7), 2.4, 1.5);
  scene.add(syn);
  // потолочные линии над рядами
  const strip = new MeshBasicMaterial({color: night ? new Color(0.02, 0.02, 0.02) : new Color(3, 3, 3)});
  for (const z of [1.0, 2.3]) for (const x of [-1.4, 1.4]) box(scene, 1.2, 0.02, 0.08, strip, new Vector3(x, 2.95, z));
  if (night) {
    const exit = new Mesh(new RoundedBoxGeometry(0.34, 0.14, 0.03, 2, 0.01), new MeshBasicMaterial({color: new Color(0.15, 2.2, 0.6)}));
    exit.position.set(-1.1, 2.55, 3.15);
    scene.add(exit);
  }
}

// Кухня: стена с окном напротив (вечером — синие сумерки, утром — светлое небо),
// холодильник справа, открытая полка слева.
function kitchenFront(scene: Scene, m: StudyModels, rnd: () => number, morning: boolean) {
  const Z = 1.9;
  const plaster = plasterTex(rnd);
  const wall = new MeshStandardMaterial({color: '#7d6f60', roughness: 0.95, roughnessMap: plaster});
  const W0 = -0.55, W1 = 0.55, Y0 = 1.0, Y1 = 2.05;
  plane(scene, 2 - W1 + 2, 2.8, wall, new Vector3((W1 + 2) / 2, 1.4, Z), Math.PI);
  plane(scene, W0 + 2, 2.8, wall, new Vector3((W0 - 2) / 2, 1.4, Z), Math.PI);
  plane(scene, W1 - W0, Y0, wall, new Vector3(0, Y0 / 2, Z), Math.PI);
  plane(scene, W1 - W0, 2.8 - Y1, wall, new Vector3(0, (Y1 + 2.8) / 2, Z), Math.PI);
  const sky = canvasTex(8, 128, g => {
    const gr = g.createLinearGradient(0, 0, 0, 128);
    if (morning) { gr.addColorStop(0, '#cfe0f2'); gr.addColorStop(1, '#f6efe2'); } else { gr.addColorStop(0, '#0f1a33'); gr.addColorStop(1, '#3a3350'); }
    g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
  });
  const skyM = new Mesh(new PlaneGeometry(6, 4), new MeshBasicMaterial({map: sky, color: morning ? new Color(2.2, 2.2, 2.2) : new Color(0.8, 0.8, 0.8)}));
  skyM.position.set(0, 1.6, Z + 1.2);
  skyM.rotation.y = Math.PI;
  scene.add(skyM);
  const frame = new MeshStandardMaterial({color: '#e8e4dc', roughness: 0.6});
  box(scene, W1 - W0 + 0.08, 0.04, 0.2, frame, new Vector3(0, Y0 - 0.02, Z - 0.06));
  box(scene, 0.03, Y1 - Y0, 0.05, frame, new Vector3(0, (Y0 + Y1) / 2, Z + 0.02));
  const herb = m.succulent.clone();
  place(herb, new Vector3(-0.3, Y0, Z - 0.08), 1.0, 0.9);
  scene.add(herb);
  // холодильник справа от окна (для человека — слева, +X)
  const fridge = new Mesh(new RoundedBoxGeometry(0.6, 1.85, 0.62, 4, 0.03), new MeshPhysicalMaterial({color: '#e9e6e0', roughness: 0.35, clearcoat: 0.4}));
  fridge.position.set(1.25, 0.925, Z - 0.32);
  scene.add(fridge);
  const handle = new Mesh(new RoundedBoxGeometry(0.02, 0.5, 0.03, 2, 0.008), new MeshStandardMaterial({color: '#9a9ca1', roughness: 0.3, metalness: 0.9}));
  handle.position.set(0.98, 1.25, Z - 0.64);
  scene.add(handle);
  // полка с тарелками слева от окна (для человека — справа, −X)
  const shelf = new MeshStandardMaterial({map: walnutTex(rnd), roughness: 0.6});
  box(scene, 0.8, 0.03, 0.24, shelf, new Vector3(-1.2, 1.5, Z - 0.13));
  const ceramic = new MeshPhysicalMaterial({color: '#e9e2d6', roughness: 0.35, clearcoat: 0.5});
  for (let i = 0; i < 5; i++) {
    const plate = new Mesh(new CylinderGeometry(0.11, 0.1, 0.012, 32), ceramic);
    plate.position.set(-1.45 + i * 0.012, 1.63, Z - 0.12);
    plate.rotation.set(Math.PI / 2 - 0.2, 0, 0);
    scene.add(plate);
  }
}

/** Столы: у каждой комнаты свой (кабинет — свой, из goodCodeOpening). */
const DESKS: Record<number, DeskSpec> = {
  1: {top: {kind: 'linoleum', y: 0.74, x0: -0.8, x1: 0.8, z0: 0.3, z1: 1.0, legs: '#d9d9d9'}, device: 'monitor', shell: '#c8cbd0', shellMetal: 0.85,
    keyboard: KEYBOARDS.ivory, mouse: '#ececec', screenGain: 1.0, screenLight: 3.5, lightColor: '#f2f5ff'},
  2: {top: {kind: 'oak', y: 0.74, x0: -0.7, x1: 0.7, z0: 0.3, z1: 1.2}, device: 'laptop', shell: '#4a4c52', shellMetal: 0.8,
    screenGain: 1.3, screenLight: 3, lightColor: '#ffe4c2'},
  3: {top: {kind: 'black', y: 0.74, x0: -0.8, x1: 0.8, z0: 0.3, z1: 1.0, legs: '#111214'}, device: 'monitor', shell: '#18191c',
    keyboard: KEYBOARDS.black, mouse: '#1b1b1c', screenGain: 1.3, screenLight: 3.5},
  4: {top: {kind: 'oak', y: 0.74, x0: -0.7, x1: 0.7, z0: 0.3, z1: 1.2}, device: 'laptop', shell: '#c9ccd1', shellMetal: 0.85,
    screenGain: 1.0, screenLight: 2.5, lightColor: '#fff4e0'},
};

/**
 * Ракурс половинки расчётом: камера справа от человека, «чуть сбоку»; экран,
 * клавиатура и руки целиком в портретной половине с полями 8 %; голова и правое
 * плечо — вне кадра. Из подходящих — с самым узким углом (клавиатура крупнее).
 */
function solveDeskView(d: Desk, hands: Vector3[], avoid: [Vector3, number][]): DeskView {
  const ASPECT = 960 / 1080;
  const up = new Vector3(0, -d.screen.normal.z, -d.screen.normal.y);
  const sc = d.screen.center, kb = d.keyboardBox;
  const pts = [
    ...[-1, 1].flatMap(sx => [-1, 1].map(sy => sc.clone().add(new Vector3(sx * d.screen.w / 2, 0, 0)).addScaledVector(up, sy * d.screen.h / 2))),
    new Vector3(kb.x0, kb.y, kb.z0), new Vector3(kb.x1, kb.y, kb.z0), new Vector3(kb.x0, kb.y, kb.z1), new Vector3(kb.x1, kb.y, kb.z1),
    ...hands,
  ];
  const cam = new PerspectiveCamera(50, ASPECT, 0.01, 10);
  const fit = (pos: Vector3) => {
    let dir = pts.reduce((a, q) => a.add(q.clone().sub(pos).normalize()), new Vector3()).normalize();
    let halfY = 1, at = pos.clone().add(dir);
    for (let it = 0; it < 60; it++) {
      cam.position.copy(pos); cam.lookAt(pos.clone().add(dir)); cam.updateMatrixWorld(true);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const q of pts) {
        const v = q.clone().applyMatrix4(cam.matrixWorldInverse);
        x0 = Math.min(x0, v.x / -v.z); x1 = Math.max(x1, v.x / -v.z); y0 = Math.min(y0, v.y / -v.z); y1 = Math.max(y1, v.y / -v.z);
      }
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      halfY = Math.max((y1 - y0) / 2, (x1 - x0) / 2 / ASPECT) * 1.08;
      at = pos.clone().add(dir);
      const right = new Vector3(1, 0, 0).applyQuaternion(cam.quaternion), u = new Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
      const fwd = new Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      dir = fwd.addScaledVector(right, cx).addScaledVector(u, cy).normalize();
      if (Math.abs(cx) < 1e-6 && Math.abs(cy) < 1e-6) break;
    }
    cam.position.copy(pos); cam.lookAt(at); cam.updateMatrixWorld(true);
    for (const [c, r] of avoid) {
      const v = c.clone().applyMatrix4(cam.matrixWorldInverse);
      if (-v.z > 0 && Math.abs(v.x) - r < -v.z * halfY * ASPECT && Math.abs(v.y) - r < -v.z * halfY) return null;
    }
    return {fov: 2 * Math.atan(halfY) / D2R, at};
  };
  const target = sc.clone().lerp(new Vector3((kb.x0 + kb.x1) / 2, kb.y, (kb.z0 + kb.z1) / 2), 0.5);
  let best: DeskView | null = null;
  // ⚠️ Угол у всех один (≈ утверждённый 36°): коллаж сравнивает места, и разный
  // ракурс читался бы разной формой. Свободны только высота и отход.
  for (let az = 34; az <= 38; az += 2) for (let h = 0.98; h <= 1.16; h += 0.03) for (let dd = 0.44; dd <= 0.8; dd += 0.02) {
    const a = az * D2R;
    const pos = new Vector3(target.x - Math.sin(a) * dd, h, target.z - Math.cos(a) * dd);
    const f = fit(pos);
    if (f && (!best || f.fov < best.fov)) best = {pos, at: f.at, fov: f.fov, K: 6, focus: 'screen'};
  }
  return best ?? DESK_VIEW;
}

/** Клавиатура места: где клавиши, домашний ряд — для рук. */
interface KeyPlace {top: number; homeZ: number; homeX: [number, number]; spread: number; keyAt: (l: string) => {x: number; z: number}}

/** Куда лягут пальцы: руки у каждого по-своему (не симметрично). */
function keysFor(b: Beat, k: KeyPlace, desk?: Desk) {
  const base = {y: k.top, z: k.homeZ, x: k.homeX, spread: k.spread};
  const dev = 3 * D2R;
  if (b.hands === 'arrows') {
    const a = k.keyAt('↓');
    return {...base, z: [k.homeZ + 0.004, a.z + 0.006] as [number, number], x: [k.homeX[0] + 0.004, a.x + 0.003] as [number, number],
      spread: [k.spread, 2.2 * KEY_U] as [number, number], turn: [dev, 0] as [number, number]};
  }
  if (b.hands === 'upper') {
    return {...base, z: [k.homeZ, k.homeZ + KEY_U] as [number, number], x: [k.homeX[0], k.homeX[1] - 0.3 * KEY_U] as [number, number],
      turn: [dev, 7 * D2R] as [number, number]};
  }
  if (b.hands === 'trackpad' && desk?.trackpadAt) {
    // правая — кончиками на тачпаде (ниже клавиш на пару миллиметров — неважно),
    // пальцы сомкнуты
    const tp = desk.trackpadAt;
    return {...base, z: [k.homeZ, tp.z + 0.012] as [number, number], x: [k.homeX[0], tp.x - 0.012] as [number, number],
      spread: [k.spread, 1.5 * KEY_U] as [number, number], turn: [dev, 2 * D2R] as [number, number]};
  }
  if (b.hands === 'reach') {
    const e = k.keyAt('enter');
    return {...base, z: [k.homeZ, e.z - 0.003] as [number, number], x: [k.homeX[0], e.x + 0.25 * KEY_U] as [number, number],
      spread: [k.spread, 2.4 * KEY_U] as [number, number], turn: [dev, -4 * D2R] as [number, number]};
  }
  return base;
}

// ── Сборка ───────────────────────────────────────────────────────────────────
export interface FacesOptions {
  /** Шесть человек — по плану на каждого. */
  people: PersonSpec[];
  assets: string;
  /** Свет экрана кабинета (доля от проезда). Лицо в лоб из объектива плоское —
   *  0.45; в интро первый снят сбоку, как в утверждённом проезде — 1. */
  studyScreenK?: number;
  /** Где в кабинете первого стоит ваза с барвинком (интро ставит под свой кадр). */
  studyVase?: Vector3;
  /** Стена дома снаружи вокруг окна кабинета (интро влетает в окно). */
  studyExterior?: boolean;
  /** Кабинет первого: стол глубже к нему, запястья лежат на столешнице, кисть
   *  поднята к клавишам (автор: «руки должны кистями лежать на столе»). */
  studyRest?: {keyboardZ: number; deskFront: number; handPitch: number; curl?: [number, number, number, number]; thumb?: [number, number, number]};
}

export interface FacesShot {
  render: (s: FaceState, W: number, H: number) => HTMLCanvasElement;
  /** Его глазами: экран, клавиатура, руки. */
  renderPov: (s: FaceState, W: number, H: number, view?: DeskView) => HTMLCanvasElement;
  /** Кадр пополам: слева лицо, справа его глазами. */
  renderSplit: (s: FaceState, W: number, H: number) => HTMLCanvasElement;
  /** Поставить позу человека и вещи плана без снимка (перед renderPov). */
  pose: (s: FaceState) => void;
  /** Ракурс половинки со столом для плана. */
  deskView: (shot: number) => DeskView;
  /** Центр экрана плана, мир. */
  screenCenter: (shot: number) => Vector3;
  /** Подсветка строк на экране плана (k 0…1) и расфокус остальных. */
  screenFx: (shot: number, lines: number[], k: number) => void;
  /** Нарисовать на экране плана своё (холст 16:9). */
  drawScreen: (shot: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void) => void;
  scenes: Scene[];
  /** Модели кабинета (растения, ваза…) — для других сцен (дом). */
  models: StudyModels;
  /** Люди планов (для замеров на стенде). */
  people: Person[];
  /** Свет экрана кабинета (доля от проезда): на наезде сбоку — 1, в лоб — 0.45. */
  setStudyScreenK: (k: number) => void;
}

export function* buildFaces(opts: FacesOptions): Generator<any, FacesShot> {
  yield Promise.all(['"JetBrains Mono"', '"Geist Mono"', '"IBM Plex Mono"'].map(f => (document as any).fonts?.load?.(`500 34px ${f}`)));
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
  const study = buildNightStudy(scenes[0], models, mulberry32(20260926), {vase: opts.studyVase, exterior: opts.studyExterior, keyboardZ: opts.studyRest?.keyboardZ, deskFront: opts.studyRest?.deskFront});
  study.updateScreen(TYPE_TOTAL, true);
  // на экране — обработчик лампы из 1.1: его он и открыл первым
  let lampLine = -1;
  const drawLamp = (line: number) => {
    if (line === lampLine) return;
    lampLine = line;
    study.drawScreen((g, W, H) => drawIde(g, W, H, IDE_THEMES.canon, {...HANDLERS.lamp, font: 34, from: 10, current: line}));
  };
  drawLamp(17);
  // ⚠️ Свет экрана ночной комнаты поставлен под проезд (профиль, затылок). В лоб,
  // из объектива, он же делал лицо плоским и белым — здесь его вдвое тише.
  const studyScreens: [RectAreaLight, number][] = [];
  scenes[0].traverse(o => { const l = o as RectAreaLight; if (l.isRectAreaLight && Math.abs(l.width - SCREEN.w) < 1e-6) { studyScreens.push([l, l.intensity]); l.intensity *= opts.studyScreenK ?? 0.45; } });
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
  // места: кабинет (0, 5) — стол из goodCodeOpening; остальные — свои столы
  const desks: Record<number, Desk> = {};
  for (const [set, spec] of Object.entries(DESKS)) desks[+set] = buildDesk(scenes[+set], spec);
  officeFront(scenes[1], copy(), mulberry32(21), false);
  officeFront(scenes[3], copy(), mulberry32(21), true);
  kitchenFront(scenes[2], copy(), mulberry32(22), false);
  kitchenFront(scenes[4], copy(), mulberry32(22), true);
  const studyKeys: KeyPlace = {top: KEY_TOP, homeZ: HOME_Z, homeX: HOME_X, spread: HOME_SPREAD, keyAt};
  // у первого клавиатура может стоять глубже (studyRest) — свои клавиши
  const study0Keys: KeyPlace = opts.studyRest ? {top: KEY_TOP, ...studyKeysAt(opts.studyRest.keyboardZ)} : studyKeys;
  const keyPlace = (set: number): KeyPlace => desks[set] ? {...desks[set], top: desks[set].keyTop} : set === 0 ? study0Keys : studyKeys;
  // экраны: у каждого свой обработчик, тема и редактор; прокручены к handle()
  const drawShotScreen = (i: number, fx: {stripes?: number[]; stripeK?: number; defocus?: number} = {}) => {
    const b = BEATS[i];
    const page = b.ide.chrome === 'page';
    const draw = (g: CanvasRenderingContext2D, W: number, H: number) =>
      drawIde(g, W, H, IDE_THEMES[b.ide.theme], page
        ? {...HANDLERS[b.ide.h], chrome: 'page', ...fx}
        : {...HANDLERS[b.ide.h], chrome: b.ide.chrome, font: W < 2000 ? 32 : 34, from: 10, current: 21, ...fx});
    if (desks[b.set]) desks[b.set].drawScreen(draw); else dark.drawScreen(draw);
  };
  BEATS.forEach((b, i) => { if (i > 0) drawShotScreen(i); });   // у первого — листает (drawLamp)
  let fxKey = '';
  /** Подсветка пяти шагов и расфокус остального на экране плана (k — проявление 0…1). */
  const screenFx = (shot: number, lines: number[], k: number) => {
    const key = shot + ':' + k.toFixed(2);
    if (key === fxKey) return;
    fxKey = key;
    drawShotScreen(shot, {stripes: lines, stripeK: k});
  };
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
  // ⚠️ Дневной офис (план 1) среди ночных планов слепил: средняя яркость половин
  // 122/165 против 15–55 у остальных (автор: «слишком яркий, бьёт глаза»). Экспозиция
  // 0.8 → 0.18 оказалось темно (автор: «слишком затемнил»): 0.3, стол ×0.85.
  const EXPOSURE = [1.0, 0.3, 1.0, 1.0, 0.85, 1.15];
  // половинка со столом — своя поправка экспозиции (кухня вечером: стол ярче лица;
  // утренняя кухня с кофе: стол 130 → 99 — как у офиса, 98, иначе он один слепит в коллаже)
  const POV_EXPOSURE: Record<number, number> = {1: 0.85, 2: 0.78, 4: 0.53};
  // шейдеры всех трёх комнат — заранее: иначе на каждой склейке кадр ждёт ~2 с
  const r0 = renderer();
  for (const s of scenes) r0.compile(s, camera);

  /** Поставить позу, вещи и экран плана (без снимка). */
  const pose = (s: FaceState) => {
    const b = BEATS[s.shot];
    const eyes = EYES_AT(b);
    // голова: к взгляду — самую малость, плюс медленный дрейф; без тряски
    const g = s.gaze.clone().sub(eyes);
    const head: [number, number, number] = [
      b.head[0] - Math.atan2(g.y, g.z) / D2R * 0.2 + wob(s.u, 0.15, 0.22, 1.3 + s.shot),
      b.head[1] + Math.atan2(g.x, g.z) / D2R * 0.15 + wob(s.u, 0.2, 0.18, 0.2 + s.shot),
      b.head[2] + wob(s.u, 0.15, 0.15, 2.2 + s.shot),
    ];
    const K = keyPlace(b.set);
    const wrist: [Vector3, Vector3] = b.recline
      // откинувшись — руки на коленях, не на клавиатуре
      ? [new Vector3(RECLINE_X + ARMREST.dx, ARMREST.top + 0.03, ARMREST.z + ARMREST.len / 2 - 0.05), new Vector3(RECLINE_X - ARMREST.dx, ARMREST.top + 0.03, ARMREST.z + ARMREST.len / 2 - 0.05)]
      : [WRIST_TYPING[0].clone().setY(K.top + 0.044), WRIST_TYPING[1].clone().setY(K.top + 0.044)];
    // запястья на столе: кисть поднята к клавишам, запястье ищет подгонка кончиков
    const rest = b.set === 0 && !b.recline ? opts.studyRest : undefined;
    if (rest) for (const w of wrist) w.set(w.x, DESK.y + 0.02, w.z + (rest.keyboardZ - KEYS.z));
    let handAim: [HandAim | null, HandAim | null] = [null, null];
    if (b.recline) {
      // ⚠️ Раньше руки тянулись к «коленям», которых у стоячей модели нет: локти
      // висели ниже кистей, рукава скручивались. Теперь кисти расслаблены на концах
      // подлокотников: пальцы вперёд и вниз, тыл вверх.
      const fingers = new Vector3(0, -0.45, 1).normalize();
      handAim = [{fingers, back: new Vector3(0, 1, 0.45)}, {fingers, back: new Vector3(0, 1, 0.45)}];
    }
    const P = props[s.shot];
    const desk = desks[b.set];
    if (b.hands === 'mouse' && desk?.mouseAt) {
      // правая лениво на мыши: ладонь на спинке, пальцы вперёд
      const fingers = new Vector3(0.05, -0.28, 1).normalize();
      wrist[1] = desk.mouseAt.clone().addScaledVector(fingers, -0.07).add(new Vector3(0, 0.036, 0));
      handAim[1] = {fingers, back: new Vector3(0, 1, 0.28)};
    }

    // ладонь — по самому широкому месту под пальцами, пальцы — каждый по своему радиусу
    const fingerR = FINGER_ON_CUP.map(o => cupRadius(GRIP_Y + o) + 0.001);
    const cupR = Math.max(cupRadius(GRIP_Y), ...fingerR);
    if (P.cup) {
      // левая кисть «рукопожатием»: пальцы вперёд и чуть к середине, тыл наружу
      const fingers = new Vector3(-0.22, 0.12, 1).normalize();
      const back = new Vector3(1, 0, 0.22).normalize();
      // запястье — туда, откуда ладонь ляжет на стакан в CUP_AT
      wrist[0] = CUP_AT.clone().addScaledVector(back, cupR + PALM_T).addScaledVector(fingers, -PALM);
      handAim[0] = {fingers, back, wrap: fingerR};
    }
    people[s.shot].setPose({
      eyes: eyes.clone().add(new Vector3(0, s.breath * 0.0012, 0)),
      lean: b.lean, head, gazeAt: s.gaze, blink: s.blink, breath: s.breath, taps: s.taps,
      wrist, handAim,
      keys: b.recline ? undefined : keysFor(b, K, desk),
      handPitch: rest?.handPitch, curl: rest?.curl, thumb: rest?.thumb,
    });
    if (P.head) attach(P.head, people[s.shot].headFrame());
    // он листает код стрелкой: каретка на экране опускается с каждым ↓
    if (b.set === 0 && b.hands === 'arrows') drawLamp(s.caretLine ?? 17 + b.taps.filter(([tt, hand, f]) => hand === 1 && f === 2 && tt <= s.u + 1e-6).length);
    if (DESK_SETS.has(b.set)) {
      for (const h of [0, 1] as const) {
        if (handAim[h] || b.recline) { handShadow[b.set][h].visible = false; continue; }
        const f = people[s.shot].handFrame(h);
        const m = new Vector3().setFromMatrixPosition(f).addScaledVector(new Vector3().setFromMatrixColumn(f, 2), HAND_MID);
        handShadow[b.set][h].visible = true;
        // запястья на столе — тень на столешнице (клавиатура её закрывает сама)
        handShadow[b.set][h].position.set(m.x, (rest ? DESK.y : K.top) + 0.0008, m.z + 0.004);
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
    return {b, eyes};
  };

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
    const {b, eyes} = pose(s);
    camera.up.set(0, 1, 0);
    if (s.camera) {
      camera.position.copy(s.camera.pos);
      camera.fov = s.camera.fov;
      camera.lookAt(s.camera.look);
      if (s.camera.roll) camera.rotateZ(s.camera.roll);
    } else {
      camera.position.copy(CAM);
      camera.fov = b.fov ?? FOV;
      camera.lookAt(aimAt(eyes, camera.fov));
    }
    camera.updateMatrixWorld(true);
    return lens.render(scenes[b.set], camera, W, H, {
      focus: s.focus ?? eyes.distanceTo(CAM), K: s.aperture ?? 30, maxR: 34, exposure: EXPOSURE[s.shot], time: s.t, grain: 0.03, vignette: 0.32,
    });
  };

  // ── Половинка: стол сбоку — клавиатура крупно, за ней экран с кодом ──
  // Поза уже стоит после render(). Голову не прячем: камера у правого плеча
  // смотрит вперёд, голова остаётся за кадром.
  const povCam = new PerspectiveCamera(50, 9 / 16, 0.02, 200);
  const renderPov = (s: FaceState, W: number, H: number, viewArg?: DeskView) => {
    const r = renderer();
    if (!lens) lens = new CinemaLens(r);
    const b = BEATS[s.shot];
    const view = viewArg ?? deskViews[b.set];
    const scr = desks[b.set]?.screen.center ?? new Vector3(0, SCREEN.y, SCREEN.z);
    const person = people[s.shot];
    povCam.position.copy(view.pos);
    povCam.up.set(0, 1, 0);
    povCam.lookAt(view.at);
    povCam.fov = view.fov;
    povCam.updateMatrixWorld(true);
    const fwd = view.at.clone().sub(view.pos).normalize();
    // фокус: на экране (код читается) или на руках — средняя глубина середин кистей
    const pts = view.focus === 'screen'
      ? [scr]
      : [0, 1].map(h => {
        const f = person.handFrame(h as 0 | 1);
        return new Vector3().setFromMatrixPosition(f).addScaledVector(new Vector3().setFromMatrixColumn(f, 2), HAND_MID);
      });
    const focus = pts.reduce((a, m) => a + m.clone().sub(view.pos).dot(fwd), 0) / pts.length;
    return lens.render(scenes[b.set], povCam, W, H, {
      focus, K: view.K, maxR: 34, exposure: EXPOSURE[s.shot] * (POV_EXPOSURE[b.set] ?? 1), time: s.t + 0.5, grain: 0.03, vignette: 0.28,
    });
  };

  // ракурсы половинок: кабинет — утверждённый DESK_VIEW, остальные — расчётом
  const deskViews: Record<number, DeskView> = {0: DESK_VIEW, 5: DESK_VIEW};
  BEATS.forEach(b => {
    const d = desks[b.set];
    if (!d || deskViews[b.set]) return;
    const eyes = EYES_AT(b);
    const hands: Vector3[] = [];
    if (!b.recline) hands.push(new Vector3(d.homeX[0] + 0.03, d.keyTop + 0.03, d.homeZ - 0.1));
    if (b.hands === 'mouse' && d.mouseAt) hands.push(d.mouseAt.clone().add(new Vector3(0, 0.04, -0.08)));
    else if (b.hands === 'trackpad' && d.trackpadAt) hands.push(d.trackpadAt.clone().add(new Vector3(0, 0.03, -0.08)));
    else if (!b.recline) hands.push(new Vector3(d.homeX[1] - 0.03, d.keyTop + 0.03, d.homeZ - 0.1));
    const avoid: [Vector3, number][] = [[eyes, 0.12], [eyes.clone().add(new Vector3(-0.18, -0.18, -0.02)), 0.07]];
    if (b.recline) {
      // откинулся: руки на коленях — ни плечи, ни локти, ни кисти в кадр не пускаем
      render(facesTimeline(FACE_STARTS[BEATS.indexOf(b)] + 0.01), 64, 36);
      for (const h of [0, 1] as const) {
        const [sh, el, wr] = people[BEATS.indexOf(b)].armPoints(h);
        for (let k = 0; k <= 4; k++) avoid.push([sh.clone().lerp(el, k / 4), 0.07]);
        for (let k = 1; k <= 4; k++) avoid.push([el.clone().lerp(wr, k / 4), 0.06]);
      }
    }
    deskViews[b.set] = solveDeskView(d, hands, avoid);
  });

  // ── Раскладка: слева лицо, справа его половинка ──
  const split = document.createElement('canvas');
  const sg = split.getContext('2d')!;
  const renderSplit = (s: FaceState, W: number, H: number) => {
    if (split.width !== W || split.height !== H) { split.width = W; split.height = H; }
    const half = Math.round(W / 2);
    sg.drawImage(render(s, half, H), 0, 0, half, H);
    if (s.shot >= 0) sg.drawImage(renderPov(s, W - half, H), half, 0, W - half, H);
    else { sg.fillStyle = "#000"; sg.fillRect(half, 0, W - half, H); }   // пауза: чернеет весь кадр
    return split;
  };

  // ⚠️ Первый показ комнаты грузит её текстуры в видеокарту (~1.5–2 с): прогреваем
  // все при сборке, иначе на каждой склейке кадр встаёт.
  for (const t0 of FACE_STARTS) renderSplit(facesTimeline(t0 + 0.01), 640, 360);
  const deskView = (shot: number) => deskViews[BEATS[shot].set];
  const screenCenter = (shot: number) => (desks[BEATS[shot].set]?.screen.center ?? new Vector3(0, SCREEN.y, SCREEN.z)).clone();
  const drawScreen = (shot: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void) => {
    const set = BEATS[shot].set;
    if (desks[set]) desks[set].drawScreen(draw); else (set === 0 ? study : dark).drawScreen(draw);
    // в очках отражается его экран: сменился экран — сменилось и отражение
    if (BEATS[shot].props?.glasses && reflect && screenTex) {
      drawSoftReflection(reflect.image as HTMLCanvasElement, screenTex.image);
      reflect.needsUpdate = true;
    }
  };
  return {render, renderPov, renderSplit, pose: (s: FaceState) => { if (s.shot >= 0) pose(s); }, deskView, screenCenter, screenFx, drawScreen, scenes, models, people,
    setStudyScreenK: (k: number) => { for (const [l, base] of studyScreens) l.intensity = base * k; }};
}

