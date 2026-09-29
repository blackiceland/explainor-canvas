import {
  CatmullRomCurve3, Color, DoubleSide, Euler, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial,
  PlaneGeometry, Quaternion, RectAreaLight, Scene, TubeGeometry, Vector3,
} from 'three';
import {buildFaces, eyesOf, faceStateAt, FaceState, FacesShot, shotDuration} from './goodCodeFaces';
import {canvasTex, DESK, EYE, FACADE_Z, KEYS, mulberry32, SCREEN, smooth, STUDY_WINDOW, wob} from './goodCodeOpening';
import {PersonSpec} from './rocketboxPerson';

// ── Good Code, But I Hate It · интро ─────────────────────────────────────────
// Ночь, мы снаружи: перед окном ветви дерева в фокусе, за ними тёплое окно, в левой
// створке — новый разработчик, лицо освещено монитором, за головой торшер → фокус
// уходит на него, камера по прямой влетает в окно и встаёт сбоку от лица, в трёх
// четвертях → короткая остановка на лице → лицо уходит в левую
// половину, справа выезжает его стол (клавиатура, руки, код) → щелчок, склейки чуть
// ускоряются: ещё трое, у каждого свой стол и редактор, и последний — в очках, у
// него на экране идёт загрузка → после его щелчка лицо уходит из кадра, и ВМЕСТЕ с
// этим камера мягко едет в его экран → загрузка доходит, на 17.03 на экране
// проступает титул видео (автор) → экран на весь кадр, эффект монитора снимается,
// титул стоит на графите и гаснет.
//
// Озвучка (черновик; такты — по оценке темпа, ⚠️ поставить по записи автора):
//   Thirty people wrote a smart home platform — one spent twenty years on banking
//   software, another came from video games, and someone only started coding last
//   year. And yet in any of their integrations you know exactly where to look —
//   in all but the one that's written best.
//
// ⚠️ 3D-кадр собирает этот модуль (introTimeline — чистая функция времени,
// render рисует кадр). Титул в конце — живые ноды MC в сцене: их снимок идёт на
// экран последнего (setEndImages), после наезда сцена растворяет 3D в титуле.
// ⚠️ Такты — в одной таблице INTRO: перестановка под запись — только здесь.

export const INTRO = {
  open: [0, 6.4] as const,                  // влёт в окно — в три четверти к лицу
  rack: [0.3, 1.3] as const,                // фокус: ветви → лицо, пока ветви в кадре
  // камера фактически стоит уже с ~5.8 (хвост влёта — миллиметры): стол выезжает с 6.3
  split: [6.3, 7.1] as const,               // после остановки на лице — справа его стол
  click0: 7.95,                             // первый щелчок — склейки
  // остальные пятеро — поровну, по 1.05 (автор: «всем после китайца одинаковый отрезок»;
  // девушка с кофе вернулась за счёт паузы китайца, наезд в экран не тронут)
  collage: [1, 2, 3, 4, 5].map(shot => ({shot, d: 1.05})),
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

// ── Влёт в окно ──────────────────────────────────────────────────────────────
// Автор: «может в окно дома влететь?», потом «добавь ветви деревьев, как было с
// цветами, чтобы сначала фокус был на них; подъехав к китайцу, не смещай ракурс,
// оставь чуть сбоку», потом «не так близко подъезжать; с ветками слишком долго».
// Снаружи — стена дома (buildNightStudy exterior) и ветви перед окном
// (buildBranches): сначала резкие ветви, окно в расфокусе; фокус быстро уходит на
// него, камера сразу трогается, по прямой влетает в левую створку и встаёт сразу за
// окном — в трёх четвертях от лица, средним планом. Разворота нет (28° → 31°),
// высота монотонно 1.42 → 1.24. Лицо видно на всём пути: линия взгляда проходит
// левее края монитора (≥ 6 см) и через створку, мимо переплёта.
/** Ракурс «как у всех» (камера = монитор): по нему — композиция лица в конце. */
const CAM_FACE = V(0, SCREEN.y, SCREEN.z - 0.015);
const FACE_LOOK = V(EYE.x, EYE.y - Math.tan(20 * D2R) * EYE.distanceTo(CAM_FACE) / 3, EYE.z);
/** Ваза с барвинком в кабинете интро: у правой руки, с пути в стороне. */
export const INTRO_VASE = V(-0.56, DESK.y, 0.47);
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
const START = {pos: V(-1.6, 1.42, 3.0), fov: 30};
/** Конец — сразу за окном, над внутренним подоконником: средний план (1.43 м до глаз). */
const END_POS = V(-0.72, 1.24, 1.22);
/** Угол не меняется: лицо растёт только от подлёта (автор: «не так близко»). */
const END_FOV = START.fov;
/** Лицо в кадре: на старте — посередине створки, в конце — как у всех (глаза на верхней трети). */
const E0: [number, number] = [0.0, 0.08];
const E1 = ndcOf(CAM_FACE, FACE_LOOK, 40, EYE);
/** Фокус на старте — на ветвях перед окном (buildBranches), в ~0.7 м от камеры. */
const BRANCH_FOCUS = V(-1.4, 1.52, 2.38);
// Угол — от расстояния до глаз: tan(fov/2) ∝ r^−α, от START.fov к END_FOV; лицо
// растёт монотонно, без «отъезда» на посадке.
const R0 = FIRST_EYE.distanceTo(START.pos), R1 = FIRST_EYE.distanceTo(END_POS);
const ALPHA = Math.log(Math.tan((END_FOV / 2) * D2R) / Math.tan((START.fov / 2) * D2R)) / Math.log(R0 / R1);
const fovAt = (r: number) => 2 * Math.atan(Math.tan((START.fov / 2) * D2R) * Math.pow(R0 / r, ALPHA)) / D2R;
/** Камера на доле пути s (путь прямой): место, угол, куда смотреть (лицо идёт по кадру по прямой). */
function pathCamera(s: number) {
  const pos = START.pos.clone().lerp(END_POS, s);
  const fov = fovAt(FIRST_EYE.distanceTo(pos));
  const look = aimAt(pos, FIRST_EYE, E0[0] + (E1[0] - E0[0]) * s, E0[1] + (E1[1] - E0[1]) * s, fov);
  return {pos, look, fov};
}
// ⚠️ Время влёта — не smootherstep: тот ~2 с стоял на ветвях (автор: «слишком долго
// с ветками»). Профиль скорости u^1.2·(1−u)^2.6: камера трогается сразу, к 2 с
// пройдено 40 % пути, дальше долгая мягкая посадка.
const FLY_EASE = (() => {
  const N = 2000, cum = [0];
  for (let i = 1; i <= N; i++) { const u = (i - 0.5) / N; cum.push(cum[i - 1] + u ** 1.2 * (1 - u) ** 2.6); }
  return (u: number) => {
    const x = Math.min(1, Math.max(0, u)) * N, i = Math.min(N - 1, Math.floor(x));
    return (cum[i] + (cum[i + 1] - cum[i]) * (x - i)) / cum[N];
  };
})();
const openCamera = (t: number) => pathCamera(FLY_EASE((t - INTRO.open[0]) / (INTRO.open[1] - INTRO.open[0])));
/** Ракурс первого после влёта — он же до щелчка (раскладка его не меняет). */
const FIRST_VIEW = pathCamera(1);

// первый: читает, листает стрелкой; щелчок ↓ — на click0
const P0 = {
  // одно движение глаз за план (автор) — на остановке, когда лицо крупно
  fix: [{t: 0, x: -0.02, y: 0.02}, {t: 6.55, x: 0.03, y: 0.0}],
  blinks: [3.2, 7.3],
  downs: [4.6, 6.55, INTRO.click0],
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
    // фокус — в обратных расстояниях: ветви (по оси) → глаза (как у всех: до глаз)
    const inv = (1 - r) / Math.max(0.05, BRANCH_FOCUS.clone().sub(pos).dot(fwd)) + r / FIRST_EYE.distanceTo(pos);
    const settle = smooth(I.open[1] - 1.4, I.open[1], t);
    face.camera = {pos, look, fov, roll: wob(t, 0.35, 0.45, 0.7) * D2R * (1 - settle)};
    face.focus = 1 / inv;
    face.aperture = 26 + 4 * settle;                          // к концу — как у всех (30)
    return {t, phase: 'open', face, e: 0, push: 0, clear: 0, studyK, screen};
  }
  // остановка на лице, потом справа выезжает стол; ракурс — тот, где кончился влёт
  // (автор: «не смещай ракурс, оставь чуть сбоку»)
  if (t < I.click0) {
    const face = firstState(t);
    face.camera = {pos: FIRST_VIEW.pos.clone(), look: FIRST_VIEW.look.clone(), fov: FIRST_VIEW.fov};
    face.focus = FIRST_EYE.distanceTo(FIRST_VIEW.pos);
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

// ── Ветви перед окном ────────────────────────────────────────────────────────
// Дерево стоит левее окна, за кадром; его ветви свисают перед левой створкой в
// ~0.7 м от камеры на старте: первый фокус — на листьях, окно за ними в расфокусе
// (автор: «как было с цветами»). Камера проходит под ними справа (≥ 0.25 м), ветви
// уходят в левый верхний угол. Свет на листьях — из окна: тёплый прямоугольник в
// проёме светит наружу (изнутри комнаты его не видно — он односторонний).
function buildBranches(scene: Scene) {
  const rnd = mulberry32(611);
  // лист: овал с острым кончиком, черешок внизу; жилки светлее
  const leafTex = canvasTex(128, 256, g => {
    g.beginPath();
    g.moveTo(64, 250);
    g.bezierCurveTo(10, 196, 6, 92, 64, 6);
    g.bezierCurveTo(122, 92, 118, 196, 64, 250);
    const gr = g.createLinearGradient(0, 256, 0, 0);
    gr.addColorStop(0, '#34502a'); gr.addColorStop(1, '#58793a');
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = 'rgba(205, 222, 160, 0.35)';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(64, 248); g.lineTo(64, 14); g.stroke();
    g.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) {
      const y = 222 - i * 28;
      for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(64, y); g.quadraticCurveTo(64 + sx * 24, y - 16, 64 + sx * (42 - i * 3), y - 34); g.stroke(); }
    }
  });
  const leafMat = new MeshStandardMaterial({map: leafTex, alphaTest: 0.5, side: DoubleSide, roughness: 0.7});
  const bark = new MeshStandardMaterial({color: '#2b2522', roughness: 0.9});
  const leafGeo = new PlaneGeometry(0.052, 0.094, 1, 1);
  leafGeo.translate(0, 0.047, 0);                             // черешок — в начале координат
  // ветви: от дерева слева (за кадром) к окну, концы свисают
  const branches: [number, number, number][][] = [
    [[-2.6, 2.35, 2.75], [-2.0, 2.05, 2.55], [-1.55, 1.72, 2.42], [-1.28, 1.52, 2.34]],
    [[-2.7, 1.95, 2.35], [-2.1, 1.78, 2.3], [-1.62, 1.55, 2.28], [-1.42, 1.38, 2.3]],
    [[-2.5, 1.5, 2.9], [-2.0, 1.42, 2.75], [-1.7, 1.3, 2.62], [-1.52, 1.24, 2.55]],
    // «на 10 часов» (автор): гуще в левом верхнем углу кадра
    [[-2.7, 2.1, 2.5], [-2.1, 1.8, 2.4], [-1.7, 1.6, 2.32], [-1.45, 1.5, 2.28]],
  ];
  const leaves: Matrix4[] = [];
  const q = new Quaternion(), e = new Euler();
  const addLeaf = (p: Vector3, down: number) => {
    // лист висит вниз-наружу, плоскость повёрнута случайно
    e.set(Math.PI + (rnd() - 0.5) * 1.4 + down, (rnd() - 0.5) * 2.6, (rnd() - 0.5) * 1.2);
    q.setFromEuler(e);
    const s = 0.8 + rnd() * 0.45;
    leaves.push(new Matrix4().compose(p, q, new Vector3(s, s, s)));
  };
  for (const pts of branches) {
    const curve = new CatmullRomCurve3(pts.map(([x, y, z]) => V(x, y, z)));
    scene.add(new Mesh(new TubeGeometry(curve, 40, 0.008, 6), bark));
    // веточки с листьями — на дальней от дерева половине
    for (let k = 0; k < 9; k++) {
      const u = 0.45 + (k / 8) * 0.55;
      const base = curve.getPointAt(u);
      const dir = V((rnd() - 0.3) * 0.12, -0.05 - rnd() * 0.1, (rnd() - 0.5) * 0.12);
      const twig = new CatmullRomCurve3([base, base.clone().addScaledVector(dir, 0.5).add(V(0, 0.01, 0)), base.clone().add(dir)]);
      scene.add(new Mesh(new TubeGeometry(twig, 8, 0.003, 4), bark));
      for (let j = 0; j < 6; j++) addLeaf(twig.getPointAt(0.25 + (j / 5) * 0.75), j * 0.08);
    }
  }
  const inst = new InstancedMesh(leafGeo, leafMat, leaves.length);
  leaves.forEach((m, i) => inst.setMatrixAt(i, m));
  scene.add(inst);
  // свет из окна наружу: тёплый, по проёму
  const w = STUDY_WINDOW, ww = w.x1 - w.x0, wh = w.y1 - w.y0;
  const spill = new RectAreaLight(new Color('#ffb56e'), 2.2, ww, wh);
  spill.position.set((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2, FACADE_Z + 0.02);
  spill.lookAt((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2, 10);
  scene.add(spill);
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
  const faces = yield* buildFaces({people: opts.people, assets: opts.assets, studyScreenK: 1, studyVase: INTRO_VASE, studyExterior: true,
    // запястья на столе (автор: «так никто не печатает, руки должны кистями лежать на
    // столе»). Лицо в кадре не двигаем: стол глубже к нему, клавиатура ближе, сиденье выше
    studyRest: {keyboardZ: KEYS.z + REST_KB, deskFront: REST_DESK, handPitch: REST_PITCH, curl: REST_CURL, thumb: REST_THUMB}});
  buildBranches(faces.scenes[0]);

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
