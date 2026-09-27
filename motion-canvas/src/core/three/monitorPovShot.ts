import {
  ACESFilmicToneMapping,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Quaternion,
  RectAreaLight,
  Scene,
  SpotLight,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import {RectAreaLightUniformsLib} from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import {PovCompositor} from './povCompositor';
import {loadPerson, PersonSpec} from './rocketboxPerson';

// ── Good Code, But I Hate It · открытие: камера на месте монитора ──────────
// Мы — экран. Программист смотрит в нас, то есть прямо в объектив, и читает
// код: глаза идут по строке фиксациями, возвращаются к началу следующей,
// на возврате — моргание, как у людей. Кадр неподвижен: в открытии он один на
// все восемь склеек, меняется всё остальное — человек, комната, свет, время.
// Склейка — по щелчку клавиши (CLICK_AT); сам звук ставит автор.
//
// ⚠️ Кадр целиком собирает этот модуль: мир, человек, объектив И РАСКАДРОВКА
// (monitorTimeline — чистая функция времени). Сцена MC только ведёт часы, тот
// же модуль снимает стенд без редактора.
// ⚠️ Руки на клавиатуре в кадр не попадают и попасть не могут: клавиатура
// прямо под экраном, а камера — сам экран. Нажатие читается плечом и звуком.
// ⚠️ Свет только от предметов: экран спереди (холодный), торшер за спиной
// справа (тёплый контур), окно слева (город, холодный). Комната — вне фокуса.

export interface MonitorPovState {
  /** Время кадра, с. */
  t: number;
  /** Куда на экране смотрит человек: м от центра экрана, вправо и вверх. */
  gaze: [number, number];
  /** То же для головы: она догоняет глаза плавно, а не скачком. */
  headGaze: [number, number];
  /** Моргание 0..1. */
  blink: number;
  /** Дыхание −1..1. */
  breath: number;
  /** Нажатие клавиши правой рукой 0..1. */
  press: number;
}

export interface MonitorPovOptions {
  person: PersonSpec;
}

/** Щелчок клавиши — склейка на следующего человека. */
export const CLICK_AT = 2.4;
/** Склейка обрывается ровно на щелчке. */
export const SHOT_DUR = CLICK_AT;

const D2R = Math.PI / 180;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, x: number) => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };

// Геометрия места: глаза сидящего, экран перед ним.
const EYE = new Vector3(0, 1.2, 0);
const SCREEN_D = 0.62;            // от глаз до экрана, м
const SCREEN_DY = -0.07;          // центр экрана ниже глаз
const SCREEN_W = 0.6, SCREEN_H = 0.34;
const FOV = 44;                   // вертикальный угол объектива
// Глаза — на верхней трети кадра: ось объектива ниже глаз на треть полукадра.
const AIM_DY = -Math.tan((FOV / 2) * D2R) * SCREEN_D / 3;
const DESK_Y = 0.74;
const KEYS_Z = 0.36;              // клавиатура между человеком и экраном
const FOCUS = SCREEN_D;           // фокус — на лице
const LENS_K = 45;                // кружок нерезкости, px 1080p на диоптрию: комната уходит в боке

// ── Раскадровка ────────────────────────────────────────────────────────────
// Чтение строки: фиксация 0.24 с, скачок глаз 40 мс, четыре фиксации на строку,
// потом возврат к началу следующей. Моргание — на первом возврате.
const FIX = 0.24, SACCADE = 0.04;
const XS = [-0.085, -0.035, 0.015, 0.065];
const LINE_H = 0.016, LINE0 = 0.03;
function fixation(n: number): [number, number] {
  const k = Math.max(0, n);
  return [XS[k % XS.length], LINE0 - LINE_H * Math.floor(k / XS.length)];
}

// ⚠️ Голова за глазами — не скачком. Глаз прыгает за 40 мс, голова догоняет
// за ~0.2 с; одинаковый скачок у обоих читается роботом.
const HEAD_LAG = 0.2;

export function monitorTimeline(t: number): MonitorPovState {
  const n = Math.floor(t / FIX);
  const a = fixation(n - 1), b = fixation(n);
  const mix = (k: number): [number, number] => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  const gaze = mix(smooth(0, SACCADE, t - n * FIX));
  const headGaze = mix(smooth(0, HEAD_LAG, t - n * FIX));
  const b0 = FIX * XS.length;                       // первый возврат глаз
  const blink = smooth(b0, b0 + 0.06, t) * (1 - smooth(b0 + 0.08, b0 + 0.2, t));
  // палец идёт вниз за 0.12 с до щелчка; отпускание уже за склейкой
  const press = smooth(CLICK_AT - 0.12, CLICK_AT, t);
  return {t, gaze, headGaze, blink, breath: Math.sin((2 * Math.PI * t) / 3.6 + 0.8), press};
}

// Плавный шум: сумма синусов с несоизмеримыми частотами.
const wob = (t: number, a: number, f: number, p: number) =>
  a * (Math.sin(t * f + p) * 0.6 + Math.sin(t * f * 2.31 + p * 1.7) * 0.28 + Math.sin(t * f * 4.07 + p * 0.3) * 0.12);

// Детерминированный шум: кадры обязаны совпадать между прогонами.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Комната: домашний кабинет ночью ────────────────────────────────────────
// Вся — вне фокуса, поэтому важны пятна света и цвета, а не детали. Но и в
// размытии коробка читается коробкой: у полки есть книги, у окна — переплёт.
interface Room { scene: Scene; bokeh: {pos: Vector3; color: Color; power: number}[]; }

const WALL_Z = -2.3;
const WIN = {x0: -1.9, x1: -0.45, y0: 0.9, y1: 2.25};
const LAMP = new Vector3(1.25, 1.55, -1.75);

function buildNightOffice(rnd: () => number, camPos: Vector3): Room {
  const scene = new Scene();
  const wallMat = new MeshStandardMaterial({color: new Color('#3b3f47'), roughness: 0.92});
  // стена с проёмом окна: четыре куска вокруг проёма
  const wall = (x0: number, x1: number, y0: number, y1: number) => {
    const m = new Mesh(new PlaneGeometry(x1 - x0, y1 - y0), wallMat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, WALL_Z);
    scene.add(m);
  };
  wall(-6, WIN.x0, -1, 4); wall(WIN.x1, 6, -1, 4); wall(WIN.x0, WIN.x1, -1, WIN.y0); wall(WIN.x0, WIN.x1, WIN.y1, 4);
  // за окном — ночной город: тёмное небо с тёплой засветкой снизу
  const sky = document.createElement('canvas'); sky.width = 64; sky.height = 256;
  const sg = sky.getContext('2d')!;
  const gr = sg.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#0a1020'); gr.addColorStop(0.62, '#1a2233'); gr.addColorStop(1, '#3a2c24');
  sg.fillStyle = gr; sg.fillRect(0, 0, 64, 256);
  const skyTex = new CanvasTexture(sky); skyTex.colorSpace = SRGBColorSpace;
  const skyM = new Mesh(new PlaneGeometry(WIN.x1 - WIN.x0 + 0.4, WIN.y1 - WIN.y0 + 0.4), new MeshBasicMaterial({map: skyTex}));
  skyM.position.set((WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, WALL_Z - 0.35);
  scene.add(skyM);
  // переплёт окна: рама и крест — тёмные силуэты на фоне засветки
  const frameMat = new MeshStandardMaterial({color: new Color('#14161a'), roughness: 0.7});
  const bar = (w: number, h: number, x: number, y: number) => {
    const m = new Mesh(new BoxGeometry(w, h, 0.06), frameMat);
    m.position.set(x, y, WALL_Z - 0.05);
    scene.add(m);
  };
  const cx = (WIN.x0 + WIN.x1) / 2, cy = (WIN.y0 + WIN.y1) / 2;
  bar(WIN.x1 - WIN.x0, 0.05, cx, WIN.y0); bar(WIN.x1 - WIN.x0, 0.05, cx, WIN.y1);
  bar(0.05, WIN.y1 - WIN.y0, WIN.x0, cy); bar(0.05, WIN.y1 - WIN.y0, WIN.x1, cy);
  bar(0.04, WIN.y1 - WIN.y0, cx, cy); bar(WIN.x1 - WIN.x0, 0.04, cx, cy + 0.12);

  // полка с книгами справа: в размытии — пятна корешков, а не коробка
  const shelfMat = new MeshStandardMaterial({color: new Color('#2a221c'), roughness: 0.8});
  const SH = {x0: 0.35, x1: 1.0, y0: 0.25, y1: 2.05, z: WALL_Z + 0.18};
  for (let k = 0; k <= 5; k++) {
    const m = new Mesh(new BoxGeometry(SH.x1 - SH.x0, 0.025, 0.3), shelfMat);
    m.position.set((SH.x0 + SH.x1) / 2, SH.y0 + ((SH.y1 - SH.y0) * k) / 5, SH.z);
    scene.add(m);
  }
  const books: Matrix4[] = [], colors: Color[] = [];
  const PALETTE = ['#6b2f2a', '#2f4a5e', '#8a7a5c', '#3d3d3d', '#5c4a3a', '#2c3b2e', '#9a8f80', '#4a2f45'];
  for (let k = 0; k < 5; k++) {
    let x = SH.x0 + 0.02;
    const y = SH.y0 + ((SH.y1 - SH.y0) * k) / 5 + 0.0125;
    while (x < SH.x1 - 0.03) {
      const w = 0.018 + rnd() * 0.03, h = 0.19 + rnd() * 0.12;
      if (rnd() < 0.08) { x += w * 2; continue; }
      books.push(new Matrix4().compose(new Vector3(x + w / 2, y + h / 2, SH.z + 0.02), new Quaternion(), new Vector3(w, h, 0.22)));
      colors.push(new Color(PALETTE[Math.floor(rnd() * PALETTE.length)]));
      x += w + 0.002;
    }
  }
  const bookMesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({roughness: 0.75}), books.length);
  books.forEach((m, i) => { bookMesh.setMatrixAt(i, m); bookMesh.setColorAt(i, colors[i]); });
  scene.add(bookMesh);

  // торшер за спиной справа: абажур светится, свет — тёплый.
  // ⚠️ Ровная заливка читалась плоской трапецией: ткань ярче у нижнего края,
  // где из-под неё бьёт лампа, и темнее к верху.
  const shadeCv = document.createElement('canvas'); shadeCv.width = 8; shadeCv.height = 128;
  const shg = shadeCv.getContext('2d')!;
  const shGr = shg.createLinearGradient(0, 0, 0, 128);
  shGr.addColorStop(0, '#7a5a3c'); shGr.addColorStop(0.7, '#d9a878'); shGr.addColorStop(1, '#ffd6a6');
  shg.fillStyle = shGr; shg.fillRect(0, 0, 8, 128);
  const shadeTex = new CanvasTexture(shadeCv); shadeTex.colorSpace = SRGBColorSpace;
  const shade = new Mesh(new CylinderGeometry(0.16, 0.22, 0.3, 32, 1, true), new MeshBasicMaterial({map: shadeTex}));
  shade.position.copy(LAMP);
  scene.add(shade);
  const pole = new Mesh(new CylinderGeometry(0.012, 0.012, LAMP.y, 12), new MeshStandardMaterial({color: '#1a1a1a', roughness: 0.4, metalness: 0.6}));
  pole.position.set(LAMP.x, LAMP.y / 2, LAMP.z);
  scene.add(pole);
  const lampLight = new PointLight(new Color('#ffb877'), 6.5, 6, 1.6);
  lampLight.position.copy(LAMP);
  scene.add(lampLight);
  // свет экрана доходит и до стены — слабо
  const spill = new RectAreaLight(new Color('#c8d6ff'), 0.6, SCREEN_W, SCREEN_H);
  spill.position.copy(camPos);
  spill.lookAt(0, 1.2, WALL_Z);
  scene.add(spill);
  scene.add(new HemisphereLight(0x2a3346, 0x0c0a08, 0.25));

  // боке: огни города в проёме окна. У торшера боке нет — абажур сам светится
  // и размывается слоем; диск поверх читался луной на ткани.
  const bokeh: Room['bokeh'] = [];
  for (let i = 0; i < 26; i++) {
    const onWall = new Vector3(WIN.x0 + 0.06 + rnd() * (WIN.x1 - WIN.x0 - 0.12), WIN.y0 + 0.05 + rnd() * (WIN.y1 - WIN.y0) * 0.75, WALL_Z);
    const far = 8 + rnd() * 30;
    const pos = onWall.clone().sub(camPos).normalize().multiplyScalar(far).add(camPos);
    const warm = rnd() < 0.7;
    bokeh.push({pos, color: new Color(warm ? '#ffb46e' : '#aac4ff'), power: 0.15 + rnd() * rnd() * 0.8});
  }
  return {scene, bokeh};
}

let sharedRenderer: WebGLRenderer | null = null;
function renderer(): WebGLRenderer {
  if (sharedRenderer) return sharedRenderer;
  RectAreaLightUniformsLib.init();
  sharedRenderer = new WebGLRenderer({canvas: document.createElement('canvas'), alpha: true, antialias: true, preserveDrawingBuffer: true});
  sharedRenderer.outputColorSpace = SRGBColorSpace;
  sharedRenderer.toneMapping = ACESFilmicToneMapping;
  sharedRenderer.toneMappingExposure = 1;
  return sharedRenderer;
}

export interface MonitorPovShot {
  render: (s: MonitorPovState, W: number, H: number) => HTMLCanvasElement;
  camera: PerspectiveCamera;
}

export function* buildMonitorShot(opts: MonitorPovOptions): Generator<any, MonitorPovShot> {
  const person = yield* loadPerson(opts.person);

  // ── камера = центр экрана ──
  const camPos = new Vector3(EYE.x, EYE.y + SCREEN_DY, EYE.z + SCREEN_D);
  const camera = new PerspectiveCamera(FOV, 16 / 9, 0.05, 80);
  camera.position.copy(camPos);
  camera.lookAt(EYE.x, EYE.y + AIM_DY, EYE.z);
  camera.updateMatrixWorld(true);
  const camRight = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const camUp = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);

  const room = buildNightOffice(mulberry32(20260925), camPos);

  // ── ближний план: человек и свет на нём ──
  const fg = new Scene();
  fg.add(person.root);
  // экран — главный свет: мягкий, холодный, ровно спереди
  const screen = new RectAreaLight(new Color('#cad8ff'), 6, SCREEN_W, SCREEN_H);
  screen.position.copy(camPos);
  screen.lookAt(EYE);
  fg.add(screen);
  // торшер за спиной справа — тёплый контур по щеке, шее и плечу
  const rim = new SpotLight(new Color('#ffb27a'), 14, 6, 40 * D2R, 0.8, 2);
  rim.position.copy(LAMP);
  rim.target.position.set(EYE.x, EYE.y - 0.15, EYE.z);
  fg.add(rim, rim.target);
  // окно слева — слабый холодный контур с другой стороны
  const win = new SpotLight(new Color('#8fa8d8'), 3, 6, 40 * D2R, 0.9, 2);
  win.position.set((WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, WALL_Z);
  win.target.position.copy(EYE);
  fg.add(win, win.target);
  fg.add(new HemisphereLight(0x3a4660, 0x0e0b09, 0.06));

  let comp: PovCompositor | null = null;
  const wristBase: [Vector3, Vector3] = [new Vector3(0.13, DESK_Y + 0.05, KEYS_Z), new Vector3(-0.13, DESK_Y + 0.05, KEYS_Z)];

  const render = (s: MonitorPovState, W: number, H: number) => {
    const r = renderer();
    if (!comp || comp.width !== W || comp.height !== H) comp = new PovCompositor(W, H);

    // куда смотрит: точка на плоскости экрана
    const gazeAt = camPos.clone().addScaledVector(camRight, s.gaze[0]).addScaledVector(camUp, s.gaze[1]);
    // голова чуть идёт за глазами (с запаздыванием), плюс медленная «жизнь»
    const head: [number, number, number] = [
      4 - s.headGaze[1] * 40 + wob(s.t, 0.5, 0.7, 1.3),
      -s.headGaze[0] * 25 + wob(s.t, 0.6, 0.55, 0.2),
      wob(s.t, 0.4, 0.5, 2.2),
    ];
    // руки на клавиатуре: мелкая дрожь набора и нажатие правой
    const wrist: [Vector3, Vector3] = [
      wristBase[0].clone().add(new Vector3(wob(s.t, 0.003, 3.1, 0.4), wob(s.t, 0.002, 4.3, 1.1), 0)),
      wristBase[1].clone().add(new Vector3(wob(s.t, 0.003, 2.7, 2.4), wob(s.t, 0.002, 3.9, 0.3) - 0.008 * s.press, 0)),
    ];
    person.setPose({
      eyes: EYE.clone().add(new Vector3(wob(s.t, 0.002, 0.6, 0.9), wob(s.t, 0.002, 0.5, 2.9) + s.breath * 0.0015, 0)),
      lean: 7, head, gazeAt, blink: s.blink, wrist, breath: s.breath,
    });

    return comp.render(r, camera, [
      {scene: room.scene, depth: -WALL_Z, bokeh: room.bokeh},
      {scene: fg, depth: FOCUS},
    ], {focus: FOCUS, K: LENS_K}, {time: s.t, grain: 0.07, vignette: 0.42});
  };

  return {render, camera};
}
