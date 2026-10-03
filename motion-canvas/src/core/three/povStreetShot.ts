import {
  ACESFilmicToneMapping,
  Color,
  HemisphereLight,
  Matrix4,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Quaternion,
  Scene,
  SpotLight,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import {ChargeAppState, drawChargeApp} from './chargeAppUi';
import {loadPhoneHand, ThumbPose} from './phoneHand';
import {PovCompositor} from './povCompositor';
import {buildRainStreet, EYE} from './rainStreet';

// ── POV-кадр целиком: улица, рука с телефоном, объектив ───────────────────
// Сцена MC двигает только состояние (PovState); всё, что из него следует —
// камера, поза руки, палец, экран, фокус, — считается здесь. Тот же модуль
// снимает стенд scratchpad/pov (без редактора), поэтому кадры совпадают.

export interface PovState {
  /** Время сцены, с: дождь, дыхание камеры, спиннер. */
  t: number;
  /** 0..1 — телефон поднимается в кадр. */
  rise: number;
  /** 0..1 — взгляд опускается со стойки на телефон. */
  look: number;
  /** Дистанция фокуса, м (стойка ~2.9, телефон ~0.31). */
  focus: number;
  /** 0..1 — палец идёт от края к кнопке. */
  reach: number;
  /** 0..1 — палец касается стекла. */
  press: number;
  /** 0..1 — после тапа палец отходит вниз-вправо и открывает лист ошибки. */
  away: number;
  /** 0..1 — телефон уходит вправо и чуть ближе, слева проявляется графит под
   *  код (продолжение POV в главе 2). */
  side: number;
  /** 0..1 — рука и камера замирают: «жизнь» (дрожь руки, дыхание камеры)
   *  гаснет вскоре после переезда, чтобы телефон не дёргался, пока читают код. */
  still: number;
  /** Время мира для дождя и кругов в лужах, с: идёт как t, а когда всё
   *  замирает — плавно тормозит и встаёт (автор: «дождь тоже должен
   *  остановиться»). */
  worldT: number;
  /** 0..1 — графит выталкивает руку с телефоном вправо за кадр; 1 — кадр
   *  целиком в графите, справа встаёт код. */
  push: number;
  ui: Omit<ChargeAppState, 't'>;
}

const D2R = Math.PI / 180;

// ── Раскадровка ────────────────────────────────────────────────────────────
// Кадр — чистая функция времени: и сцена MC, и стенд берут состояние отсюда,
// поэтому то, что проверено на стенде, и есть то, что увидит автор.
// ⚠️ Фокус переводится в ДИОПТРИЯХ (1/м): так ходит кольцо фокуса настоящего
// объектива; линейный перевод в метрах «проскакивает» середину.
export const POST_D = 3.9;      // до стойки, м
export const PHONE_D = 0.30;    // до телефона, м
// ⚠️ Продолжение (28.09, автор: «телефон в руке уходит вправо, экран делится на
// две части, слева код»). Фокус остаётся на телефоне, телефон уезжает вправо и
// приближается, слева — код (сцена MC рисует его поверх кадра).
// ⚠️ 03.10 (автор: связь toView и handle показать телефоном): на телефоне
// сначала КАРТА с ближней станцией, тапов в начале нет. Оба тапа — уже рядом
// с кодом: тап 1 открывает станцию, и экран собирается по строкам toView;
// тап 2 — Start, полоска идёт по handle, на `throw` выезжает лист ошибки.
/** Телефон трогается вправо — после ~1.4 с на карте. */
export const SIDE_AT = 5.0;
export const SIDE_T = 1.6;
/** До телефона в правой половине, м (ближе, чем 0.30: экран крупнее). */
export const SIDE_D = 0.25;

// ── Код рядом с телефоном: такты ОБЩИЕ для сцены MC и экрана ────────────────
// Указатель — полоска-канон под строкой (автор: «выбираю розовый хайлайт»).
// Моменты — по черновику озвучки (~2.8 слова/с); переставить по записи.
/** Код проявляется, когда телефон встал справа. */
export const CODE_AT = SIDE_AT + SIDE_T + 0.1;
/** Полоска: проявление и переезд со строки на строку, с. */
export const MARK_IN = 0.42;
export const MARK_MOVE = 0.45;
/** Тап 1 — водитель открывает станцию (карточка «Mill Street»). */
export const TAP1_AT = CODE_AT + 2.0;
/** Страница станции въезжает справа. */
export const PAGE_AT = TAP1_AT + 0.22;
export const PAGE_T = 0.4;
/** «Opening the station runs this function» — полоска на `fun Connector.toView(`. */
export const VIEW_AT = TAP1_AT + 0.6;
/** Поля toView: plug, maxPowerKw, pricePerKwh, available. Полоска встаёт на
 *  строку — в тот же момент её кусок появляется на экране. */
export const FIELD_AT = [2.5, 3.3, 4.1, 5.6].map(d => TAP1_AT + d);
/** «The last field decides the big word and the green button» — полоска под
 *  `available`, и на экране в тот же момент появляются «● Available» и кнопка.
 *  Полоски и расфокуса на экране больше нет: кусок экрана сам появляется на
 *  своей строке — это и есть пара «строка ↔ пиксели». */
export const AVAIL_AT = FIELD_AT[3];
/** Тап 2 — Start. */
export const TAP2_AT = AVAIL_AT + 6.7;
/** «…another part of the system» — обе строки `package`. */
export const PKG_AT = TAP2_AT + 4.5;
/** «…the charging service» — полоска на `fun handle(`. */
export const HANDLE_AT = TAP2_AT + 7.2;
/** «It lets a driver start only on two statuses» — проверка статуса. */
export const GUARD_AT = TAP2_AT + 9.3;
/** «…it throws Connector unavailable» — полоска на `throw`, и в тот же момент
 *  на телефоне выезжает лист ошибки. */
export const ERROR_AT = TAP2_AT + 13.6;
/** «Two places, two different shapes…» — обе строки правил; на телефоне в
 *  это время оба конца противоречия: «Available» и лист «Connector unavailable». */
export const BOTH_AT = ERROR_AT + 3.1;
/** Графит выталкивает руку с телефоном вправо за кадр (автор, 02.10: «рука
 *  должна уйти другим эффектом — графит должен её сдвинуть вправо за фрейм»;
 *  растворение с расфокусом отвергнуто). Справа встанет enum. */
export const GONE_AT = BOTH_AT + 13.1;
export const GONE_T = 1.4;
/** На сколько (доля ширины кадра) уезжают графит и рука: плотная часть графита
 *  (до 0.40W) доходит до правого края, рука — далеко за него. */
const PUSH_SHIFT = 0.62;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const tw = (t: number, t0: number, dur: number) => clamp01((t - t0) / dur);
const outCubic = (x: number) => 1 - (1 - x) ** 3;
const inOutCubic = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
const inOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;

export function povTimeline(t: number): PovState {
  // 0.0–1.4 улица, стойка в фокусе; 1.4–3.6 телефон поднимается, взгляд
  // опускается, фокус уходит на экран; 3.6–4.6 читаем экран
  const rise = outCubic(tw(t, 1.4, 1.6));
  const look = inOutSine(tw(t, 2.2, 1.2));
  const dPost = 1 / POST_D, dPhone = 1 / PHONE_D;
  let diopt = dPost + (dPhone - dPost) * inOutCubic(tw(t, 2.6, 1.0));
  // два тапа в одну точку (карточка станции, потом кнопка Start — они на одном
  // месте экрана): палец над точкой → касание → отпускание → палец к краю
  const tapAt = t < TAP2_AT - 0.5 ? TAP1_AT : TAP2_AT;
  const reachIn = inOutCubic(tw(t, tapAt - 0.5, 0.5));
  const reachOut = inOutCubic(tw(t, tapAt + 0.38, 0.45));
  const pressIn = outCubic(tw(t, tapAt, 0.12));
  const pressOut = inOutSine(tw(t, tapAt + 0.2, 0.2));
  const pressAt = (T: number) => clamp01(tw(t, T, 0.1)) * (1 - tw(t, T + 0.2, 0.2));
  // карта → страница станции; поля появляются по строкам toView
  const page = inOutCubic(tw(t, PAGE_AT, PAGE_T));
  const reveal = FIELD_AT.map(T => +inOutSine(tw(t, T, 0.35)).toFixed(3));
  // Start: ожидание, на `throw` — лист ошибки; статус «Available» остаётся
  const loading = tw(t, TAP2_AT + 0.2, 0.2) * (1 - tw(t, ERROR_AT, 0.3));
  const error = outCubic(tw(t, ERROR_AT, 0.45));
  // телефон уходит вправо и ближе; фокус едет вместе с ним
  const side = inOutCubic(tw(t, SIDE_AT, SIDE_T));
  diopt += (1 / SIDE_D - dPhone) * side;
  // графит выталкивает руку с телефоном вправо за кадр: оба едут одним ходом,
  // рука остаётся резкой (фокус на ней)
  const push = inOutCubic(tw(t, GONE_AT, GONE_T));
  // автор: «вскоре после зума телефона не дёргать его, чтобы зритель не
  // отвлекался» — дрожь руки и дыхание камеры гаснут к концу переезда
  const stillAt = SIDE_AT + SIDE_T - 0.4, stillT = 0.9;
  const still = inOutSine(tw(t, stillAt, stillT));
  // «Дождь тоже должен остановиться»: время мира течёт со скоростью (1 − still)
  // — дождь и круги в лужах плавно тормозят и замирают вместе с рукой.
  // Интеграл (1 − inOutSine) в замкнутом виде: x/2 + sin(πx)/(2π).
  const xs = tw(t, stillAt, stillT);
  const worldT = t <= stillAt ? t
    : stillAt + stillT * (xs / 2 + Math.sin(Math.PI * xs) / (2 * Math.PI));
  return {
    t, rise, look, focus: 1 / diopt,
    reach: reachIn,
    press: pressIn * (1 - pressOut),
    away: reachOut,
    side,
    still,
    worldT,
    push,
    // капли со стекла уходят, пока телефон едет вправо — в режиме объяснения
    // они шум поверх букв (автор: «на экране сохранилась картинка из сцены с
    // дождём, возможно поэтому плохо читается»)
    ui: {
      page: +page.toFixed(3), cardPressed: +pressAt(TAP1_AT).toFixed(3), reveal,
      pressed: +pressAt(TAP2_AT).toFixed(3), loading, error,
      drops: +(1 - side).toFixed(3),
    },
  };
}

// Большой палец (phoneHand.ThumbPose, мм системы телефона). Точка нажатия и
// крен найдены солвером хвата вместе с позой кисти (scratchpad/pov/opt_hand.html):
// там, куда палец ложится сам, и стоит кнопка «Start charging»
// (chargeAppUi.START_BUTTON).
// Покой — как на фото автора (Downloads/1ф): палец стоит вдоль правого края
// телефона, кончик чуть клонится к экрану, ноготь наружу. Нажатие — как 2ф: палец
// почти прямой по диагонали снизу справа (IP 20°, MCP 16° — солвер держит сгиб,
// иначе палец жмёт крючком), ноготь к камере. Крен у покоя и нажатия близкий
// (35° и 21°) — по пути к кнопке палец не проворачивается.
// В покое палец у края не закрывает ни надпись кнопки, ни лист «Connector
// unavailable».
const PRESS: ThumbPose = {Q: [-1.94, -18.28], lift: 0, zM: 9, roll: 20.94};
const REST: ThumbPose = {Q: [36.5, -3], lift: 7, zM: 11, roll: 35};
function thumbPoses(): Record<'rest' | 'hover' | 'press', ThumbPose> {
  return {rest: REST, hover: {...PRESS, lift: 13, zM: 12}, press: PRESS};
}
const mixPose = (a: ThumbPose, b: ThumbPose, k: number): ThumbPose => ({
  Q: [a.Q[0] + (b.Q[0] - a.Q[0]) * k, a.Q[1] + (b.Q[1] - a.Q[1]) * k],
  lift: a.lift + (b.lift - a.lift) * k,
  zM: a.zM + (b.zM - a.zM) * k,
  roll: a.roll + (b.roll - a.roll) * k,
});

// Телефон в системе камеры: поднят (смотрим на экран) и опущен (под кадром).
const PHONE_UP = {pos: new Vector3(0.05, -0.035, -0.30), roll: -7, tilt: 0};
const PHONE_DOWN = {pos: new Vector3(0.12, -0.46, -0.24), roll: -16, tilt: 48};
// Правая половина кадра: центр экрана около x 1440 и по вертикали по центру.
const PHONE_SIDE = {pos: new Vector3(0.098, -0.004, -SIDE_D), roll: -5, tilt: 0};
// Ход руки при выталкивании, м в системе камеры: столько же пикселей кадра,
// сколько проходит графит (PUSH_SHIFT·W на дистанции SIDE_D, fov 46°, 16:9).
const PUSH_X = PUSH_SHIFT * 2 * (16 / 9) * Math.tan(23 * D2R) * SIDE_D;

// Плавный шум для «живой» камеры: сумма синусов с несоизмеримыми частотами.
const wob = (t: number, a: number, f: number, p: number) =>
  a * (Math.sin(t * f + p) * 0.6 + Math.sin(t * f * 2.31 + p * 1.7) * 0.28 + Math.sin(t * f * 4.07 + p * 0.3) * 0.12);

let sharedRenderer: WebGLRenderer | null = null;
function renderer(): WebGLRenderer {
  if (sharedRenderer) return sharedRenderer;
  sharedRenderer = new WebGLRenderer({canvas: document.createElement('canvas'), alpha: true, antialias: true, preserveDrawingBuffer: true});
  sharedRenderer.outputColorSpace = SRGBColorSpace;
  sharedRenderer.toneMapping = ACESFilmicToneMapping;
  sharedRenderer.toneMappingExposure = 1;
  sharedRenderer.shadowMap.enabled = true;
  sharedRenderer.shadowMap.type = PCFShadowMap;
  return sharedRenderer;
}

export interface PovShot {
  /** Рисует кадр в холст размера W×H (пиксели выхода). */
  render: (s: PovState, W: number, H: number) => HTMLCanvasElement;
  camera: PerspectiveCamera;
}

export function* buildPovShot(): Generator<any, PovShot> {
  yield (document as any).fonts.load('700 40px Manrope');
  yield (document as any).fonts.load('400 40px Manrope');
  const world = yield* buildRainStreet();
  const rig = yield* loadPhoneHand();
  const THUMB = thumbPoses();

  // ── ближний план: рука и телефон ──
  const fg = new Scene();
  fg.add(rig.root);
  rig.root.matrixAutoUpdate = false;
  fg.add(new HemisphereLight(0x33405a, 0x120f0c, 0.35));
  // ближний фонарь впереди-сверху (тот же, что светит на стойку)
  const lampAhead = new SpotLight(new Color('#FFC98A'), 60, 26, 62 * D2R, 0.65, 1.6);
  lampAhead.position.set(-0.25, 6.14, -2.4);
  lampAhead.target.position.set(0.1, 1.2, -0.3);
  fg.add(lampAhead, lampAhead.target);
  // фонарь за спиной (предыдущий по тротуару): тёплый свет на тыльную сторону руки
  const lampBehind = new SpotLight(new Color('#FFC98A'), 36, 30, 62 * D2R, 0.7, 1.6);
  lampBehind.position.set(-0.25, 6.14, 7.4);
  lampBehind.target.position.set(0.1, 1.2, -0.3);
  fg.add(lampBehind, lampBehind.target);
  // свет экрана на палец: прожектор из центра стекла наружу. Само стекло позади
  // него и не освещается — точечный источник рисовал на экране блик.
  // ⚠️ Слабо: экран тёмный, и на 0.12 кромки пальцев у стекла горели белым.
  const screenGlow = new SpotLight(new Color('#8fb89f'), 0.035, 0.25, 75 * D2R, 0.8, 2);
  screenGlow.position.set(0, -0.012, 0.005);
  screenGlow.target.position.set(0, -0.012, 0.1);
  rig.root.add(screenGlow, screenGlow.target);

  // Рука уходит в тень вместе с «замиранием» (автор: «и руку можно затемнить с
  // той же целью — дать фокус на телефон»): материалы кожи темнеют, экран
  // остаётся единственным светлым предметом справа. Материалы уникальны —
  // один и тот же может висеть на нескольких мешах.
  const HAND_DIM = 0.6;                    // рука к концу — 40 % прежней яркости
  const handMats: {m: MeshStandardMaterial; base: Color; env: number}[] = [];
  {
    const seen = new Set<MeshStandardMaterial>();
    rig.hand.traverse((o: any) => {
      if (!o.isMesh) return;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material]) as MeshStandardMaterial[]) {
        if (!m || seen.has(m) || !m.color) continue;
        seen.add(m);
        handMats.push({m, base: m.color.clone(), env: m.envMapIntensity ?? 1});
      }
    });
  }

  const camera = new PerspectiveCamera(46, 16 / 9, 0.05, 220);
  let comp: PovCompositor | null = null;
  let lastUi = '';

  const phoneMatrix = (s: PovState) => {
    const k = s.rise;
    const pos = PHONE_DOWN.pos.clone().lerp(PHONE_UP.pos, k).lerp(PHONE_SIDE.pos, s.side);
    // руку ведёт мягко: лёгкая «жизнь» даже в покое — до того, как рука замрёт
    const life = 1 - s.still;
    pos.x += wob(s.t, 0.0016, 1.1, 0.4) * life;
    pos.y += wob(s.t, 0.0018, 0.9, 2.1) * life;
    pos.z += wob(s.t, 0.0012, 0.7, 4.0) * life;
    // экран смотрит в глаз; наклон назад (tilt) и крен (roll) — по состоянию
    const toEye = pos.clone().negate().normalize();
    const up = new Vector3(0, 1, 0);
    const x = new Vector3().crossVectors(up, toEye).normalize();
    const y = new Vector3().crossVectors(toEye, x).normalize();
    const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, toEye));
    const tilt = PHONE_DOWN.tilt + (PHONE_UP.tilt - PHONE_DOWN.tilt) * k
      + (PHONE_SIDE.tilt - PHONE_UP.tilt) * s.side;
    const roll = PHONE_DOWN.roll + (PHONE_UP.roll - PHONE_DOWN.roll) * k
      + (PHONE_SIDE.roll - PHONE_UP.roll) * s.side + wob(s.t, 0.5, 0.8, 1.3) * life;
    q.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -tilt * D2R));
    q.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), roll * D2R));
    // выталкивание — чистый сдвиг вправо: разворот к глазу остаётся тем, что
    // был у PHONE_SIDE, иначе телефон поворачивался бы, уезжая
    pos.x += PUSH_X * s.push;
    return new Matrix4().compose(pos, q, new Vector3(1, 1, 1));
  };

  const render = (s: PovState, W: number, H: number) => {
    const r = renderer();
    if (!comp || comp.width !== W || comp.height !== H) comp = new PovCompositor(W, H);
    // телефон ушёл, графит сплошной: мира не видно — только графит и зерно
    if (s.push >= 1) {
      return comp.render(r, camera, [], {focus: s.focus, K: 20}, {time: s.t, shade: 1, cover: 1});
    }
    world.prepare(r);
    if (!fg.environment) fg.environment = world.mid.environment;
    (fg as any).environmentIntensity = 0.6;

    // ── камера: глаз, взгляд со стойки на телефон, дыхание (замирает вместе с рукой) ──
    const breath = 1 - s.still;
    const yaw = (7 + 3 * s.look) * D2R + wob(s.t, 0.0035, 0.55, 0.0) * breath;
    const pitch = (-8 - 9 * s.look) * D2R + wob(s.t, 0.003, 0.62, 1.9) * breath;
    const roll = wob(s.t, 0.0025, 0.45, 3.3) * breath;
    camera.position.copy(EYE);
    camera.position.y += wob(s.t, 0.004, 0.5, 0.7) * breath;
    camera.rotation.set(pitch, -yaw, roll, 'YXZ');
    camera.updateMatrixWorld(true);

    // ── рука и телефон перед глазом ──
    rig.root.matrix.multiplyMatrices(camera.matrixWorld, phoneMatrix(s));
    rig.root.matrixWorldNeedsUpdate = true;
    rig.root.updateMatrixWorld(true);
    const tap = mixPose(mixPose(THUMB.rest, THUMB.hover, s.reach), THUMB.press, s.press);
    rig.setThumb(mixPose(tap, THUMB.rest, s.away));
    const handLight = 1 - HAND_DIM * s.still;
    for (const h of handMats) {
      h.m.color.copy(h.base).multiplyScalar(handLight);
      h.m.envMapIntensity = h.env * handLight;
    }

    // ── экран: перерисовка только при смене состояния (спиннер — каждый кадр) ──
    const ui = {...s.ui, t: s.t};
    const key = JSON.stringify(s.ui) + (s.ui.loading > 0 ? s.t.toFixed(3) : '');
    if (key !== lastUi) {
      drawChargeApp(rig.screenCanvas, ui);
      rig.screenTex.needsUpdate = true;
      lastUi = key;
    }

    world.update(s.worldT, camera);
    const bokehFar = world.bokeh.filter(b => b.layer === 'far');
    const bokehMid = world.bokeh.filter(b => b.layer === 'mid');
    // Слой руки идёт за телефоном и в конце переезда садится РОВНО в фокус
    // (0.25 м): прежде слой считался на 0.26 м при фокусе 0.25 — кружок
    // нерезкости ~3 px, экран был чуть мыльный (автор: «экран заблюренный
    // немного»). В самом POV (side = 0) всё как было.
    const fgDepth = 0.31 + (SIDE_D - 0.31) * s.side;
    return comp.render(r, camera, [
      {scene: world.far, depth: 16, bokeh: bokehFar},
      {scene: world.mid, depth: 2.9, bokeh: bokehMid},
      {scene: world.near, depth: 1.0},
      {scene: fg, depth: fgDepth},
    ], {focus: s.focus, K: 20}, {
      time: s.t, shade: s.side, shift: PUSH_SHIFT * s.push,
      // виньетка уходит вместе с выталкиванием — в конце кадр чистый графит
      vignette: 0.35 * (1 - s.push),
    });
  };

  return {render, camera};
}
