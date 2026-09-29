import {Vector3} from 'three';
import {buildFaces, eyesOf, faceStateAt, FaceState, FacesShot, shotDuration} from './goodCodeFaces';
import {DESK, EYE, KEYS, SCREEN, smooth, wob} from './goodCodeOpening';
import {PersonSpec} from './rocketboxPerson';

// ── Good Code, But I Hate It · интро ─────────────────────────────────────────
// Ночь, кабинет: барвинок на столе в фокусе, за ним в расфокусе новый разработчик,
// лицо освещено монитором → фокус уходит на него, камера издалека по прямой едет к
// нему мимо букета и встаёт чуть сбоку от лица, в трёх четвертях (без облёта, к фронту
// не заворачивает) → на 3-й секунде справа выезжает его стол (клавиатура, руки, код) →
// щелчок, склейки: ещё пятеро, у каждого свой стол и редактор, последний — в очках, у
// него на экране идёт загрузка → после его щелчка лицо уходит из кадра, и ВМЕСТЕ с
// этим камера мягко едет в его экран → загрузка доходит, на 17.03 на экране
// проступает титул видео (автор) → экран на весь кадр, эффект монитора снимается,
// титул стоит на графите и гаснет.
//
// Озвучка (такты сошлись с записью автора):
//   Thirty people wrote a smart home platform — one spent twenty years on banking
//   software, another came from video games, and someone only started coding last
//   year. They'd argue about naming, formatting, almost anything. It all just worked,
//   and this is the story of how a newcomer made it better — and broke it.
//
// ⚠️ 3D-кадр собирает этот модуль (introTimeline — чистая функция времени,
// render рисует кадр). Титул в конце — живые ноды MC в сцене: их снимок идёт на
// экран последнего (setEndImages), после наезда сцена растворяет 3D в титуле.
// ⚠️ Такты — в одной таблице INTRO: перестановка под запись — только здесь.

export const INTRO = {
  open: [0, 3.2] as const,                  // наезд от цветов — чуть сбоку от лица (к 3.0 почти стоит)
  rack: [0.2, 0.95] as const,               // фокус: цветы → лицо, пока букет в кадре (уходит к 1.37)
  split: [3.0, 3.8] as const,               // автор: «на третьей секунде наедет кадр с клавиатурой»
  // китаец после раскладки и пятеро после него — поровну, по 47 кадров (1.57 с): так
  // наезд в экран начинается на прежних 13.2 (автор: «на прежнем тайминге»)
  click0: 3.8 + 47 / 30,                    // первый щелчок — склейки
  collage: [1, 2, 3, 4, 5].map(shot => ({shot, d: 47 / 30})),
  push: 4.7,                                // лицо последнего уходит, камера мягко едет в экран, с
  loaded: 16.5,                             // полоска загрузки на его экране дошла до конца
  title: [17.03, 17.88] as const,           // ⚠️ автор: титул появляется на 17.03
  clear: 0.9,                               // экран на весь кадр — эффект монитора снимается, с
  out: [20.7, 21.5] as const,               // титул гаснет (канон: стоит 2.8 с, уходит 0.8)
  end: 21.9,
};
export const INTRO_DURATION = INTRO.end;
const LAST = 5;                                             // последний план — очки, тёмный кабинет
const collageStart = (i: number) => INTRO.click0 + INTRO.collage.slice(0, i).reduce((a, c) => a + c.d, 0);
const COLLAGE_END = collageStart(INTRO.collage.length);    // последний щелчок (13.2)
const LAST_START = collageStart(INTRO.collage.length - 1); // его план в коллаже (12.15)
const PUSH_END = COLLAGE_END + INTRO.push;                  // экран на весь кадр (17.9)
const D2R = Math.PI / 180;
/** Плавнее smooth: на концах нулевые и скорость, и ускорение — посадка без толчка. */
const smoother = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * u * (u * (u * 6 - 15) + 10);
};

// ── Кадрирование ─────────────────────────────────────────────────────────────
const V = (x: number, y: number, z: number) => new Vector3(x, y, z);
/** Где точка P в кадре камеры pos → look (fov по вертикали, 16:9): NDC x, y. */
function ndcOf(pos: Vector3, look: Vector3, fov: number, P: Vector3): [number, number] {
  const f = look.clone().sub(pos).normalize();
  const r = V(-f.z, 0, f.x).normalize();
  const u = r.clone().cross(f);
  const d = P.clone().sub(pos);
  const z = d.dot(f), tv = Math.tan((fov / 2) * D2R);
  return [d.dot(r) / (z * tv * 16 / 9), d.dot(u) / (z * tv)];
}
/** Куда смотреть из pos, чтобы точка P встала в кадре в (ex, ey) — без крена. */
function aimAt(pos: Vector3, P: Vector3, ex: number, ey: number, fov: number): Vector3 {
  const tv = Math.tan((fov / 2) * D2R);
  const c = V(ex * tv * 16 / 9, ey * tv, 1).normalize();   // луч на P в осях камеры
  const w = P.clone().sub(pos).normalize();                 // он же в мире
  const pitch = Math.asin(w.y / Math.hypot(c.z, c.y)) - Math.atan2(c.y, c.z);
  const q = c.z * Math.cos(pitch) - c.y * Math.sin(pitch);
  const yaw = Math.atan2(q, c.x) - Math.atan2(-w.z, w.x);
  return pos.clone().add(V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)));
}
/** Где накопленная таблица набирает долю f своего итога: 0…1 по индексу. */
function atFraction(cum: number[], f: number): number {
  const want = f * cum[cum.length - 1];
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < want) lo = m; else hi = m; }
  return (lo + (want - cum[lo]) / (cum[hi] - cum[lo] || 1)) / (cum.length - 1);
}

// ── Наезд на первого ─────────────────────────────────────────────────────────
// Принцип первой версии (автор: «вернём первое начало с китайцем и цветами, без
// окна»): барвинок в фокусе, лицо за ним в расфокусе → фокус на лицо, камера едет к
// нему и встаёт чуть сбоку (автор: «не заворачивай на фронт лица»).
// ⚠️ Потом: «пусть камера начнёт с большего отдаления… закручивание делать не надо».
// Кривая мимо букета крутила камеру вокруг него (27°, до 22°/с) — теперь путь ПРЯМОЙ:
// от стены с окном (1.53 м до глаз, 40° от оси лица) к трём четвертям (0.72 м, 36°:
// торшер ровно за головой — тёплый ореол, а не лампа, торчащая у уха, как на 32°).
// ⚠️ Букет в 0.75 м у края кадра «ушёл» (автор: «цветок играл важную роль в
// режиссуре, эффект надо вернуть»), а в правой трети он лёг на тёмную спинку монитора
// (автор: «цветок сливается с монитором, сделай как оператор»). Теперь стороны
// поменяны: букет в 0.55 м в ЛЕВОЙ трети, за ним — полка с книгами и гирляндой (тёмный
// силуэт на светлом боке); лицо в правой трети, освещённое экраном, — на тёмной стене.
// Камера едет вправо-вперёд, букет остаётся слева от пути, и наезд почти без поворота.
// Солвер (scratchpad solve/straight_push2.mjs, flower_bg.mjs — за букетом полка, не
// монитор): поворот за наезд 3.3°, скорость ≤ 0.48 м/с, до цветов ≥ 0.20 м, букет в
// кадре до 1.37 с, монитор лицо не закрывает; к 3.0 с до конца пути ~3 мм.
/** Ракурс «как у всех» (камера = монитор): по нему — композиция лица в конце. */
const CAM_FACE = V(0, SCREEN.y, SCREEN.z - 0.015);
const FACE_LOOK = V(EYE.x, EYE.y - Math.tan(20 * D2R) * EYE.distanceTo(CAM_FACE) / 3, EYE.z);
/** Наклон кисти первого: запястье на столе, кисть поднята к клавишам (рад, − — вверх). */
const REST_PITCH = -0.41;
/** Клавиатура первого ближе к нему (м) и передний край стола: локти 126–152°,
 *  предплечья и ладони на столешнице (замер: в стол не глубже 2 мм, у правого
 *  предплечья — 5). */
const REST_KB = -0.03, REST_DESK = 0.09;
/** Большой палец к пробелу (°): с сгибом по умолчанию он уходил в стол на 2,7 см. */
const REST_THUMB: [number, number, number] = [-20, 6, 8];
/** Сгиб пальцев (указательный … мизинец): у поднятой кисти мизинец уходил в клавиши на 1,5 см. */
const REST_CURL: [number, number, number, number] = [1, 1, 0.9, 0.6];
/** Глаза первого (он сидит чуть дальше от стола и чуть выше — goodCodeFaces sitBack, sitUp). */
const FIRST_EYE = eyesOf(0);
/** Точка сбоку от глаз: угол от оси лица (к его правому плечу), расстояние в плане, высота. */
const beside = (deg: number, r: number, y: number) => V(FIRST_EYE.x - Math.sin(deg * D2R) * r, y, FIRST_EYE.z + Math.cos(deg * D2R) * r);
/** Старт — в 7 см от стены с окном (FRONT_Z 1.15), конец — три четверти, чуть ниже глаз. */
const START_POS = beside(40, (1.08 - FIRST_EYE.z) / Math.cos(40 * D2R), 1.10);
const STOP_POS = beside(36, 0.72, 1.16);
/** Букет: на старте в левой трети, в 0.55 м от камеры, на фоне полки; с пути в стороне. */
export const INTRO_VASE = V(-0.764, DESK.y, 0.565);
const FLOWER = INTRO_VASE.clone().add(V(0, 0.36, 0));        // середина цветков (как OPENING_DEBUG.FLOWER)
/** Лицо в кадре: на старте — правее середины (на тёмной стене), в конце — как у всех. */
const E0: [number, number] = [0.25, 0.25];
const E1 = ndcOf(CAM_FACE, FACE_LOOK, 40, EYE);
// Угол — от расстояния до глаз: tan(fov/2) ∝ r^−α, 30° → 40°; лицо растёт монотонно.
const R0 = FIRST_EYE.distanceTo(START_POS), R1 = FIRST_EYE.distanceTo(STOP_POS);
const ALPHA = Math.log(Math.tan(20 * D2R) / Math.tan(15 * D2R)) / Math.log(R0 / R1);
const fovAt = (r: number) => 2 * Math.atan(Math.tan(15 * D2R) * Math.pow(R0 / r, ALPHA)) / D2R;
/** Камера на доле пути s (путь прямой): место, угол, куда смотреть (глаза идут по кадру по прямой). */
function pathCamera(s: number) {
  const pos = START_POS.clone().lerp(STOP_POS, s);
  const fov = fovAt(FIRST_EYE.distanceTo(pos));
  const look = aimAt(pos, FIRST_EYE, E0[0] + (E1[0] - E0[0]) * s, E0[1] + (E1[1] - E0[1]) * s, fov);
  return {pos, look, fov};
}
// Время — по «усилию»: путь плюс поворот (2.5 м на радиан), поворот не копится на пике скорости.
const EFFORT = (() => {
  const cum = [0];
  let p = pathCamera(0);
  for (let i = 1; i <= 800; i++) {
    const c = pathCamera(i / 800);
    const turn = p.look.clone().sub(p.pos).normalize().angleTo(c.look.clone().sub(c.pos).normalize());
    cum.push(cum[i - 1] + Math.hypot(c.pos.distanceTo(p.pos), 2.5 * turn));
    p = c;
  }
  return cum;
})();
// Профиль скорости u²(1−u)²: мягкий старт — цветы в кадре до 1.37 с. ⚠️ С профилем,
// где камера трогается сразу (u^1.2·(1−u)^2.6), они проскакивали раньше, чем фокус
// успевал уйти с них: лицо на полсекунды плыло.
const FLY_EASE = (() => {
  const N = 2000, cum = [0];
  for (let i = 1; i <= N; i++) { const u = (i - 0.5) / N; cum.push(cum[i - 1] + u ** 2 * (1 - u) ** 2); }
  return (u: number) => {
    const x = Math.min(1, Math.max(0, u)) * N, i = Math.min(N - 1, Math.floor(x));
    return (cum[i] + (cum[i + 1] - cum[i]) * (x - i)) / cum[N];
  };
})();
const openCamera = (t: number) => pathCamera(atFraction(EFFORT, FLY_EASE((t - INTRO.open[0]) / (INTRO.open[1] - INTRO.open[0]))));
/** Ракурс первого после наезда — он же до щелчка (раскладка его не меняет). */
const FIRST_VIEW = pathCamera(1);

// первый: читает, листает стрелкой; щелчок ↓ — на click0
const P0 = {
  // одно движение глаз за план (автор) — со стрелкой, когда рядом уже его стол
  fix: [{t: 0, x: -0.02, y: 0.02}, {t: 4.45, x: 0.03, y: 0.0}],
  blinks: [1.7, 4.9],
  downs: [2.3, 4.45, INTRO.click0],
};
function firstState(t: number): FaceState {
  const base = faceStateAt(0, 0.05, t);                      // руки, дыхание — от плана 0
  let i = 0;
  while (i < P0.fix.length - 1 && t >= P0.fix[i + 1].t) i++;
  const f = P0.fix[i], prev = P0.fix[Math.max(0, i - 1)];
  const k = i === 0 ? 1 : smooth(0, 0.06, t - f.t);
  const onScreen = (x: number, y: number) => V(CAM_FACE.x - x, CAM_FACE.y + y, SCREEN.z);
  const gaze = onScreen(prev.x, prev.y).lerp(onScreen(f.x, f.y), k);
  const blink = P0.blinks.reduce((m, b) => Math.max(m, smooth(b, b + 0.07, t) * (1 - smooth(b + 0.1, b + 0.24, t))), 0);
  const taps: [number[], number[]] = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]];
  for (const d of P0.downs) {
    const dt = t - d;
    if (dt < -0.08 || dt > 0.1) continue;
    taps[1][2] = Math.max(taps[1][2], dt < 0 ? smooth(-0.08, 0, dt) : 1 - smooth(0, 0.1, dt));
  }
  const caretLine = 17 + P0.downs.filter(d => d <= t + 1e-6).length;
  const breath = Math.sin((2 * Math.PI * t) / 3.8 + 0.8);
  return {...base, t, u: t, gaze, blink, taps, caretLine, breath};
}

// ── Раскадровка ──────────────────────────────────────────────────────────────
export type IntroPhase = 'open' | 'split' | 'collage' | 'expand' | 'code';
/** Экран последнего: доля загрузки, видимость полоски и титула (0…1). */
export interface EndScreen {load: number; bar: number; title: number}
export interface IntroState {
  t: number;
  phase: IntroPhase;
  face: FaceState;
  /** Сдвиг раскладки 0…1 (split — выезд стола, expand — уход лица вместе с наездом). */
  e: number;
  /** Путь камеры к экрану 0…1. */
  push: number;
  /** Растворение 3D в титуле 0…1 (эффект монитора снимается). */
  clear: number;
  /** Свет экрана кабинета (доля): на наезде сбоку — полный, в лоб — 0.45. */
  studyK: number;
  /** Что на экране последнего. */
  screen: EndScreen;
}

/** Титул в сцене гаснет (0…1) — канон титулов: простой фейд. */
export const introTitleOut = (t: number) => smooth(INTRO.out[0], INTRO.out[1], t);

function endScreen(t: number): EndScreen {
  const u = Math.min(1, Math.max(0, (t - INTRO.title[0]) / (INTRO.title[1] - INTRO.title[0])));
  return {
    // загрузка уже идёт, когда он появляется в коллаже; дойдёт — полоска гаснет
    load: 0.18 + 0.82 * smooth(LAST_START, INTRO.loaded, t),
    bar: 1 - smooth(INTRO.loaded, INTRO.loaded + 0.4, t),
    title: 1 - (1 - u) ** 3,                                  // канон титула: простой фейд, easeOutCubic
  };
}

export function introTimeline(t: number): IntroState {
  const I = INTRO;
  const screen = endScreen(t);
  // свет экрана кабинета — полный: лицо первого снято сбоку, в лоб оно не бывает
  const studyK = 1;
  if (t < Math.min(I.open[1], I.split[0])) {
    const face = firstState(t);
    const {pos, look, fov} = openCamera(t);
    const fwd = look.clone().sub(pos).normalize();
    const r = smooth(I.rack[0], I.rack[1], t);
    // фокус — в обратных расстояниях: цветы (по оси) → глаза (как у всех: до глаз)
    const inv = (1 - r) / Math.max(0.05, FLOWER.clone().sub(pos).dot(fwd)) + r / FIRST_EYE.distanceTo(pos);
    const settle = smooth(I.open[1] - 1.4, I.open[1], t);
    face.camera = {pos, look, fov, roll: wob(t, 0.35, 0.45, 0.7) * D2R * (1 - settle)};
    face.focus = 1 / inv;
    face.aperture = 26 + 4 * settle;                          // к концу — как у всех (30)
    return {t, phase: 'open', face, e: 0, push: 0, clear: 0, studyK, screen};
  }
  // остановка на лице, потом справа выезжает стол; ракурс — тот, где кончился наезд
  // (автор: «не смещай ракурс, оставь чуть сбоку»)
  if (t < I.click0) {
    const face = firstState(t);
    // стол выезжает, пока камера досаживается (последние миллиметры пути): без скачка
    const v = t < I.open[1] ? openCamera(t) : FIRST_VIEW;
    face.camera = {pos: v.pos.clone(), look: v.look.clone(), fov: v.fov};
    face.focus = FIRST_EYE.distanceTo(v.pos);
    face.aperture = 30;
    return {t, phase: 'split', face, e: smooth(I.split[0], I.split[1], t), push: 0, clear: 0, studyK, screen};
  }
  if (t < COLLAGE_END) {
    let i = 0;
    while (i < I.collage.length - 1 && t >= collageStart(i + 1)) i++;
    const {shot, d} = I.collage[i];
    // план кончается щелчком: берём последние d секунд его раскадровки (u < 0 —
    // раньше её начала: план в интро длиннее, человек просто работает дальше)
    const u = shotDuration(shot) - (d - (t - collageStart(i)));
    return {t, phase: 'collage', face: faceStateAt(shot, u, t), e: 1, push: 0, clear: 0, studyK, screen};
  }
  // после последнего щелчка: лицо уходит — и в тот же миг камера едет прямо в экран
  const face = faceStateAt(LAST, shotDuration(LAST) + (t - COLLAGE_END), t);
  // плавный разгон и мягкая посадка (автор: «более мягкий тайминг наезда»)
  const push = smoother(COLLAGE_END, PUSH_END, t);
  // ⚠️ Лицо уходит по той же кривой и за то же время, что наезд: тогда экран идёт к
  // середине кадра по одной прямой. Когда лицо уходило за 1 с, оно тащило картинку
  // стола влево (~700 px/с), и экран резко менял курс (автор: «без резких смен
  // траекторий»).
  const e = push;
  const clear = smooth(PUSH_END, PUSH_END + I.clear, t);
  return {t, phase: e < 1 ? 'expand' : 'code', face, e, push, clear, studyK, screen};
}

// ── Экран последнего: загрузка → титул, с эффектом монитора ─────────────────
// Так снятый в тёмной комнате экран отличается от нашей сцены: чёрный у LCD не
// чёрный (подсветка, к углам светлее — IPS), светлое светится ореолом, а объектив
// добавляет зерно, виньетку и плёночную кривую. После наезда всё это снимается:
// 3D растворяется в титуле, который лежит под ним.
const canvasOf = (W: number, H: number) => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
/** Фон экрана: графит сцены + подсветка LCD. */
function monitorBase(bg: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvasOf(bg.width, bg.height), g = c.getContext('2d')!, W = c.width, H = c.height;
  g.drawImage(bg, 0, 0);
  g.globalCompositeOperation = 'screen';
  g.fillStyle = 'rgb(16, 18, 24)';
  g.fillRect(0, 0, W, H);
  for (const [cx, cy] of [[0, 0], [W, 0], [0, H], [W, H]]) {
    const rg = g.createRadialGradient(cx, cy, 0, cx, cy, W * 0.35);
    rg.addColorStop(0, 'rgba(120, 135, 170, 0.10)');
    rg.addColorStop(1, 'rgba(120, 135, 170, 0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, W, H);
  }
  return c;
}
/** Буквы с лёгким ореолом на прозрачном. ⚠️ Сильный ореол «плавил» буквы титула
 *  (автор: «уродливое название») — оставлен едва заметный, для ощущения экрана. */
function glowGlyphs(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvasOf(src.width, src.height), g = c.getContext('2d')!, W = c.width;
  g.globalCompositeOperation = 'lighter';
  g.filter = `blur(${(W * 0.0035).toFixed(1)}px)`;
  g.globalAlpha = 0.18;
  g.drawImage(src, 0, 0);
  g.filter = `blur(${(W * 0.012).toFixed(1)}px)`;
  g.globalAlpha = 0.12;
  g.drawImage(src, 0, 0);
  g.filter = 'none';
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.drawImage(src, 0, 0);
  return c;
}

// ── Сборка ───────────────────────────────────────────────────────────────────
export interface IntroOptions {people: PersonSpec[]; assets: string}
export interface IntroShot {
  render: (s: IntroState, W: number, H: number) => HTMLCanvasElement;
  /** Снимок титула из сцены (фон 16:9 и отдельно буквы на прозрачном) — на экран
   *  последнего: сначала загрузка на этом фоне, потом сам титул. */
  setEndImages: (bg: HTMLCanvasElement, title: HTMLCanvasElement) => void;
  faces: FacesShot;
}

export function* buildIntro(opts: IntroOptions): Generator<any, IntroShot> {
  const faces = yield* buildFaces({people: opts.people, assets: opts.assets, studyScreenK: 1, studyVase: INTRO_VASE,
    // запястья на столе (автор: «так никто не печатает, руки должны кистями лежать на
    // столе»). Лицо в кадре не двигаем: стол глубже к нему, клавиатура ближе, сиденье выше
    studyRest: {keyboardZ: KEYS.z + REST_KB, deskFront: REST_DESK, handPitch: REST_PITCH, curl: REST_CURL, thumb: REST_THUMB}});

  // в экран последнего — по прямой: от ракурса стола до экрана ровно на весь кадр
  const dv = faces.deskView(LAST);
  const scr = faces.screenCenter(LAST);
  // ⚠️ Экран в конце — ровно кадр: по ширине точно, по высоте на 0.05 % больше.
  // Рамки нет, и титул на экране совпадает с титулом сцены до пикселя — растворение
  // без двоения букв.
  const END_POS = V(scr.x, scr.y, scr.z - (SCREEN.w * 9) / (32 * Math.tan(20 * D2R)));
  const S0 = ndcOf(dv.pos, dv.at, dv.fov, scr);              // где экран в кадре стола
  const pushView = (k: number) => {
    const pos = dv.pos.clone().lerp(END_POS, k);
    const fov = dv.fov + (40 - dv.fov) * k;
    // экран растёт и плавно приходит в середину кадра
    return {pos, at: aimAt(pos, scr, S0[0] * (1 - k), S0[1] * (1 - k), fov), fov, K: dv.K, focus: 'screen' as const};
  };

  // экран последнего: фон с подсветкой, полоска загрузки, титул с ореолом
  let base: HTMLCanvasElement | null = null, titleLit: HTMLCanvasElement | null = null, drawn = '';
  const drawEnd = (sc: EndScreen) => {
    if (!base || !titleLit) return;
    const key = `${sc.load.toFixed(3)}|${sc.bar.toFixed(2)}|${sc.title.toFixed(2)}`;
    if (key === drawn) return;
    drawn = key;
    faces.drawScreen(LAST, (sg, W, H) => {
      sg.save();
      sg.setTransform(1, 0, 0, 1, 0, 0);
      sg.globalCompositeOperation = 'source-over';
      sg.globalAlpha = 1;
      sg.drawImage(base!, 0, 0, W, H);
      if (sc.bar > 0) {
        // загрузка как в macOS (автор): скруглённая полоска на ровной серой дорожке,
        // без свечения; прежняя тонкая линия с ореолом читалась глюком
        const k = W / 1920, bw = 340 * k, bh = 8 * k, x0 = (W - bw) / 2, y0 = (H - bh) / 2;
        const pill = (w: number) => {
          const r = bh / 2;
          sg.beginPath();
          sg.arc(x0 + r, y0 + r, r, Math.PI / 2, Math.PI * 1.5);
          sg.arc(x0 + w - r, y0 + r, r, -Math.PI / 2, Math.PI / 2);
          sg.closePath();
          sg.fill();
        };
        sg.globalAlpha = sc.bar;
        sg.fillStyle = 'rgba(244, 241, 235, 0.2)';
        pill(bw);
        sg.fillStyle = 'rgba(244, 241, 235, 0.95)';
        pill(Math.max(bh, bw * sc.load));
      }
      if (sc.title > 0) {
        sg.globalAlpha = sc.title;
        sg.drawImage(titleLit!, 0, 0, W, H);
      }
      sg.restore();
    });
  };

  const out = document.createElement('canvas');
  const g = out.getContext('2d')!;
  const render = (s: IntroState, W: number, H: number) => {
    if (out.width !== W || out.height !== H) { out.width = W; out.height = H; }
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    faces.setStudyScreenK(s.studyK);
    if (s.face.shot === LAST) drawEnd(s.screen);
    const half = Math.round(W / 2);
    switch (s.phase) {
      case 'open':
        g.drawImage(faces.render(s.face, W, H), 0, 0, W, H);
        break;
      case 'split': {
        if (s.e >= 1) { g.drawImage(faces.renderSplit(s.face, W, H), 0, 0, W, H); break; }
        // лицо целиком уходит влево на четверть кадра; справа выезжает стол
        g.drawImage(faces.render(s.face, W, H), -s.e * (W / 4), 0, W, H);
        if (s.e > 0.001) g.drawImage(faces.renderPov(s.face, W - half, H), half + (1 - s.e) * (W - half), 0, W - half, H);
        break;
      }
      case 'collage':
        g.drawImage(faces.renderSplit(s.face, W, H), 0, 0, W, H);
        break;
      case 'expand': {
        // лицо уходит влево целиком; стол расширяется до всего кадра, камера уже едет
        const wp = Math.round(half + s.e * (W - half));
        if ((1 - s.e) * half >= 1) g.drawImage(faces.render(s.face, half, H), -s.e * half, 0, half, H);
        faces.pose(s.face);
        // стол шириной wp = середина полного кадра того же объектива (угол по вертикали
        // тот же): рендер одного размера, без пересоздания буферов на каждом кадре
        g.drawImage(faces.renderPov(s.face, W, H, pushView(s.push)), (W - wp) / 2, 0, wp, H, W - wp, 0, wp, H);
        break;
      }
      case 'code':
        faces.pose(s.face);
        g.drawImage(faces.renderPov(s.face, W, H, pushView(s.push)), 0, 0, W, H);
        break;
    }
    return out;
  };
  const setEndImages = (bg: HTMLCanvasElement, title: HTMLCanvasElement) => {
    base = monitorBase(bg);
    titleLit = glowGlyphs(title);
    drawn = '';
  };
  return {render, setEndImages, faces};
}
