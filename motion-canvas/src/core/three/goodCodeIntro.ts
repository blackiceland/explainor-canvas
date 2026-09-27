import {Vector3} from 'three';
import {buildFaces, faceStateAt, FaceState, FacesShot, shotDuration} from './goodCodeFaces';
import {EYE, OPENING_DEBUG, SCREEN, smooth, wob} from './goodCodeOpening';
import {PersonSpec} from './rocketboxPerson';

// ── Good Code, But I Hate It · интро (17 с) ──────────────────────────────────
// Кабинет ночью: барвинок на столе в фокусе → фокус на лицо нового разработчика
// → камера подъезжает к нему и встаёт в тот же ракурс, что у всех остальных, —
// на место монитора → короткая остановка на лице → лицо уходит в левую половину,
// справа выезжает его стол (клавиатура, руки, код) → щелчок, склейки чуть
// ускоряются: ещё пятеро, у каждого свой стол и редактор → после последнего
// щелчка лицо уходит из кадра, и ВМЕСТЕ с этим камера плавно едет прямо в его
// экран → экран на весь кадр → эффект монитора снимается, остаётся обычная
// код-сцена ролика: графит, фирменные цвета, код лампы из сценария (1.1) слева.
// С неё стартует часть 1.1.
//
// Озвучка (36 слов; такты — по оценке темпа, ⚠️ поставить по записи автора):
//   A new developer joins a smart home platform.                  0.4 – 3.0
//   Thirty people wrote its code.                                  3.6 – 5.2
//   They'd argue about naming, about formatting,
//   about almost anything.                                         7.1 – 10.7
//   And yet — open any integration, and you'll know
//   exactly where to look.                                        11.3 – 15.0
//   Except one.                                                   15.6 – 16.3
//
// ⚠️ 3D-кадр собирает этот модуль (introTimeline — чистая функция времени,
// render рисует кадр). Код-сцена в конце — живые ноды MC в сцене: её снимок
// идёт на экран последнего (setEndImage), после наезда сцена растворяет 3D в ней.
// ⚠️ Такты — в одной таблице INTRO: перестановка под запись — только здесь.

export const INTRO = {
  open: [0, 4.9] as const,                  // наезд: от цветов — в ракурс «как у всех»
  rack: [0.6, 1.7] as const,                // фокус: цветы → глаза, пока букет в кадре
  split: [5.3, 6.2] as const,               // после остановки на лице — справа его стол
  click0: 7.0,                              // первый щелчок — склейки («They'd argue…»)
  collage: [1.3, 1.15, 1.0, 0.9, 0.85],     // остальные пятеро, склейки чуть ускоряются
  expand: 1.0,                              // лицо последнего уходит из кадра, с
  push: 3.1,                                // с того же мига камера едет в экран, с
  clear: 0.9,                               // экран на весь кадр — эффект монитора снимается, с
  end: 17.0,
};
export const INTRO_DURATION = INTRO.end;
const LAST = 5;                                             // последний план — очки, тёмный кабинет
const collageStart = (k: number) => INTRO.click0 + INTRO.collage.slice(0, k - 1).reduce((a, b) => a + b, 0);
const COLLAGE_END = collageStart(6);                        // = последний щелчок (12.2)
const PUSH_END = COLLAGE_END + INTRO.push;                  // экран на весь кадр (15.3)
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

// ── Наезд на первого ─────────────────────────────────────────────────────────
/** Ракурс «как у всех» (камера = монитор; goodCodeFaces: CAM и aimAt). */
const CAM_FACE = V(0, SCREEN.y, SCREEN.z - 0.015);
const FACE_LOOK = V(EYE.x, EYE.y - Math.tan(20 * D2R) * EYE.distanceTo(CAM_FACE) / 3, EYE.z);
/** Начало — ключ K0 утверждённого проезда (goodCodeOpening): букет в фокусе. */
const K0 = {pos: V(-0.98, 1.10, 0.84), look: V(-0.301, 1.138, 0.42), fov: 30};
// Путь в плане (x, z) — кубическая Безье: выходит из K0 туда же, куда проезд (к K1),
// проходит сбоку от букета на высоте цветов и приходит на место монитора вдоль
// экрана. Высота растёт монотонно 1.10 → 1.13 — без горки над букетом (автор:
// «вверх, потом вниз»). Солвер: до букета ≥ 0.19 м, корпус монитора (z 0.641–0.663
// при |x| < 0.33) не задет.
const BEZ: [number, number][] = [[-0.98, 0.84], [-0.5196, 0.1494], [-0.38, 0.625], [0, 0.625]];
const bez = (u: number): [number, number] => {
  const a = (1 - u) ** 3, b = 3 * (1 - u) ** 2 * u, c = 3 * (1 - u) * u * u, d = u ** 3;
  return [0, 1].map(i => a * BEZ[0][i] + b * BEZ[1][i] + c * BEZ[2][i] + d * BEZ[3][i]) as [number, number];
};
const ARC = (() => {
  const cum = [0];
  let p = bez(0);
  for (let i = 1; i <= 400; i++) { const q = bez(i / 400); cum.push(cum[i - 1] + Math.hypot(q[0] - p[0], q[1] - p[1])); p = q; }
  return cum;
})();
/** Где накопленная таблица набирает долю f своего итога: 0…1 по индексу. */
function atFraction(cum: number[], f: number): number {
  const want = f * cum[cum.length - 1];
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < want) lo = m; else hi = m; }
  return (lo + (want - cum[lo]) / (cum[hi] - cum[lo] || 1)) / (cum.length - 1);
}
/** Точка пути на доле его длины s. */
const alongPath = (s: number) => bez(atFraction(ARC, s));
// Угол — от расстояния до глаз: tan(fov/2) ∝ r^−α. Лицо в кадре растёт вместе с
// наездом, в конце угол ровно 40° (как у всех); без «отъезда» на посадке, как
// было при угле, растущем по времени.
const R0 = EYE.distanceTo(K0.pos), R1 = EYE.distanceTo(CAM_FACE);
const ALPHA = Math.log(Math.tan(20 * D2R) / Math.tan(15 * D2R)) / Math.log(R0 / R1);
const fovAt = (r: number) => 2 * Math.atan(Math.tan(15 * D2R) * Math.pow(R0 / r, ALPHA)) / D2R;
// Лицо в кадре идёт по прямой: из левой трети (K0) в середину, глаза — на верхнюю треть.
const E0 = ndcOf(K0.pos, K0.look, K0.fov, EYE), E1 = ndcOf(CAM_FACE, FACE_LOOK, 40, EYE);
/** Камера на доле длины пути s: место, угол, куда смотреть. */
function pathCamera(s: number) {
  const [x, z] = alongPath(s);
  const pos = V(x, K0.pos.y + (CAM_FACE.y - K0.pos.y) * s, z);
  const fov = fovAt(EYE.distanceTo(pos));
  const look = aimAt(pos, EYE, E0[0] + (E1[0] - E0[0]) * s, E0[1] + (E1[1] - E0[1]) * s, fov);
  return {pos, look, fov};
}
// ⚠️ Время раздаётся по «усилию» — путь плюс поворот (1 м на радиан), а не по одной
// длине пути: иначе весь разворот к лицу в лоб (60°) шёл на пике скорости и фон за
// ним проносился (~41°/с, так ~33°/с), а подъезд издалека, наоборот, тянулся.
const EFFORT = (() => {
  const cum = [0];
  let p = pathCamera(0);
  for (let i = 1; i <= 600; i++) {
    const c = pathCamera(i / 600);
    const turn = p.look.clone().sub(p.pos).normalize().angleTo(c.look.clone().sub(c.pos).normalize());
    cum.push(cum[i - 1] + Math.hypot(c.pos.distanceTo(p.pos), turn));
    p = c;
  }
  return cum;
})();
const openCamera = (t: number) => pathCamera(atFraction(EFFORT, smoother(INTRO.open[0], INTRO.open[1], t)));

// первый: читает, листает стрелкой; щелчок ↓ — на click0
const P0 = {
  // одно движение глаз за план (автор) — на остановке, когда лицо крупно и в лоб
  fix: [{t: 0, x: -0.02, y: 0.02}, {t: 4.95, x: 0.03, y: 0.0}],
  blinks: [2.9, 5.6],
  downs: [3.5, 4.95, INTRO.click0],
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
export interface IntroState {
  t: number;
  phase: IntroPhase;
  face: FaceState;
  /** Сдвиг раскладки 0…1 (split — выезд стола, expand — стол на весь кадр). */
  e: number;
  /** Путь камеры к экрану 0…1. */
  push: number;
  /** Растворение 3D в код-сцене 0…1 (эффект монитора снимается). */
  clear: number;
  /** Свет экрана кабинета (доля): на наезде сбоку — полный, в лоб — 0.45. */
  studyK: number;
}

export function introTimeline(t: number): IntroState {
  const I = INTRO;
  // ⚠️ свет экрана «подыгрывает» ракурсу: сбоку лицо держит полный свет экрана,
  // в лоб он же делает лицо плоским — к концу наезда тише (экрана в кадре нет)
  const studyK = 1 - 0.55 * smooth(I.open[1] - 2.6, I.open[1], t);
  if (t < I.open[1]) {
    const face = firstState(t);
    const {pos, look, fov} = openCamera(t);
    const fwd = look.clone().sub(pos).normalize();
    const r = smooth(I.rack[0], I.rack[1], t);
    // фокус — в обратных расстояниях: цветы (по оси) → глаза (как у всех: до глаз)
    const inv = (1 - r) / Math.max(0.05, OPENING_DEBUG.FLOWER.clone().sub(pos).dot(fwd)) + r / EYE.distanceTo(pos);
    const settle = smooth(I.open[1] - 1.4, I.open[1], t);
    face.camera = {pos, look, fov, roll: wob(t, 0.35, 0.45, 0.7) * D2R * (1 - settle)};
    face.focus = 1 / inv;
    face.aperture = 26 + 4 * settle;                          // к концу — как у всех (30)
    return {t, phase: 'open', face, e: 0, push: 0, clear: 0, studyK};
  }
  // остановка на лице, потом справа выезжает стол
  if (t < I.click0) return {t, phase: 'split', face: firstState(t), e: smooth(I.split[0], I.split[1], t), push: 0, clear: 0, studyK};
  if (t < COLLAGE_END) {
    let k = 1;
    while (k < LAST && t >= collageStart(k + 1)) k++;
    // план кончается щелчком: берём последние d секунд его раскадровки (u < 0 —
    // раньше её начала: план в интро длиннее, человек просто работает дальше)
    const u = shotDuration(k) - (I.collage[k - 1] - (t - collageStart(k)));
    return {t, phase: 'collage', face: faceStateAt(k, u, t), e: 1, push: 0, clear: 0, studyK};
  }
  // после последнего щелчка: лицо уходит — и в тот же миг камера едет прямо в экран
  const face = faceStateAt(LAST, shotDuration(LAST) + (t - COLLAGE_END), t);
  const e = smooth(COLLAGE_END, COLLAGE_END + I.expand, t);
  // плавный разгон и мягкая посадка (автор: «наезд слишком быстрый»)
  const push = smoother(COLLAGE_END, PUSH_END, t);
  const clear = smooth(PUSH_END, PUSH_END + I.clear, t);
  return {t, phase: e < 1 ? 'expand' : 'code', face, e, push, clear, studyK};
}

// ── Эффект монитора ──────────────────────────────────────────────────────────
// Так снятый в тёмной комнате экран отличается от нашей код-сцены: буквы светятся
// ореолом, чёрный у LCD не чёрный (подсветка, к углам светлее — IPS), а объектив
// добавляет зерно, виньетку и плёночную кривую. После наезда всё это снимается:
// 3D растворяется в код-сцене, которая лежит под ним.
function monitorLook(g: CanvasRenderingContext2D, W: number, H: number, full: CanvasImageSource, glyphs: CanvasImageSource) {
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.drawImage(full, 0, 0, W, H);
  // ореол букв: близкий и широкий
  g.globalCompositeOperation = 'lighter';
  g.filter = `blur(${(W * 0.0035).toFixed(1)}px)`;
  g.globalAlpha = 0.5;
  g.drawImage(glyphs, 0, 0, W, H);
  g.filter = `blur(${(W * 0.012).toFixed(1)}px)`;
  g.globalAlpha = 0.3;
  g.drawImage(glyphs, 0, 0, W, H);
  g.filter = 'none';
  g.globalAlpha = 1;
  // подсветка: поднятый холодный чёрный, к углам — свечение IPS
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
  g.restore();
}

// ── Сборка ───────────────────────────────────────────────────────────────────
export interface IntroOptions {people: PersonSpec[]; assets: string}
export interface IntroShot {
  render: (s: IntroState, W: number, H: number) => HTMLCanvasElement;
  /** Снимок код-сцены конца (весь кадр 16:9 и отдельно буквы на прозрачном) —
   *  на экран последнего, с эффектом монитора. */
  setEndImage: (full: CanvasImageSource, glyphs: CanvasImageSource) => void;
  faces: FacesShot;
}

export function* buildIntro(opts: IntroOptions): Generator<any, IntroShot> {
  const faces = yield* buildFaces({people: opts.people, assets: opts.assets, studyScreenK: 1});

  // в экран последнего — по прямой: от ракурса стола до экрана ровно на весь кадр
  const dv = faces.deskView(LAST);
  const scr = faces.screenCenter(LAST);
  // ⚠️ Экран в конце — ровно кадр: по ширине точно, по высоте на 0.05 % больше.
  // Рамки нет, и код на экране совпадает с код-сценой до пикселя — растворение
  // без двоения букв.
  const END_POS = V(scr.x, scr.y, scr.z - (SCREEN.w * 9) / (32 * Math.tan(20 * D2R)));
  const S0 = ndcOf(dv.pos, dv.at, dv.fov, scr);              // где экран в кадре стола
  const pushView = (k: number) => {
    const pos = dv.pos.clone().lerp(END_POS, k);
    const fov = dv.fov + (40 - dv.fov) * k;
    // экран растёт и плавно приходит в середину кадра
    return {pos, at: aimAt(pos, scr, S0[0] * (1 - k), S0[1] * (1 - k), fov), fov, K: dv.K, focus: 'screen' as const};
  };

  const out = document.createElement('canvas');
  const g = out.getContext('2d')!;
  const render = (s: IntroState, W: number, H: number) => {
    if (out.width !== W || out.height !== H) { out.width = W; out.height = H; }
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    faces.setStudyScreenK(s.studyK);
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
        g.drawImage(faces.render(s.face, half, H), -s.e * half, 0, half, H);
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
  const setEndImage = (full: CanvasImageSource, glyphs: CanvasImageSource) =>
    faces.drawScreen(LAST, (sg, W, H) => monitorLook(sg, W, H, full, glyphs));
  return {render, setEndImage, faces};
}
