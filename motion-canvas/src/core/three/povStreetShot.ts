import {
  ACESFilmicToneMapping,
  Color,
  HemisphereLight,
  Matrix4,
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
/** Касание стекла — под звук тапа. */
export const TAP_AT = 5.1;
export const POV_DURATION = 11.1;

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
  // тап: палец над кнопкой → касание (TAP_AT) → отпускание → палец к краю
  const reachIn = inOutCubic(tw(t, TAP_AT - 0.5, 0.5));
  const reachOut = inOutCubic(tw(t, TAP_AT + 0.38, 0.45));
  const pressIn = outCubic(tw(t, TAP_AT, 0.12));
  const pressOut = inOutSine(tw(t, TAP_AT + 0.2, 0.2));
  const pressedUi = clamp01(tw(t, TAP_AT, 0.1)) * (1 - tw(t, TAP_AT + 0.2, 0.2));
  // ожидание и ошибка: лист выезжает, статус «Available» остаётся
  const errAt = TAP_AT + 1.83;
  const loading = tw(t, TAP_AT + 0.2, 0.2) * (1 - tw(t, errAt, 0.3));
  const error = outCubic(tw(t, errAt, 0.45));
  // читаем ошибку 1.5 с — фокус уходит обратно на мёртвую стойку
  diopt += (dPost - dPhone) * inOutCubic(tw(t, errAt + 1.95, 1.1));
  return {
    t, rise, look, focus: 1 / diopt,
    reach: reachIn,
    press: pressIn * (1 - pressOut),
    away: reachOut,
    ui: {pressed: pressedUi, loading, error},
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

  const camera = new PerspectiveCamera(46, 16 / 9, 0.05, 220);
  let comp: PovCompositor | null = null;
  let lastUi = '';

  const phoneMatrix = (s: PovState) => {
    const k = s.rise;
    const pos = PHONE_DOWN.pos.clone().lerp(PHONE_UP.pos, k);
    // руку ведёт мягко: лёгкая «жизнь» даже в покое
    pos.x += wob(s.t, 0.0016, 1.1, 0.4);
    pos.y += wob(s.t, 0.0018, 0.9, 2.1);
    pos.z += wob(s.t, 0.0012, 0.7, 4.0);
    // экран смотрит в глаз; наклон назад (tilt) и крен (roll) — по состоянию
    const toEye = pos.clone().negate().normalize();
    const up = new Vector3(0, 1, 0);
    const x = new Vector3().crossVectors(up, toEye).normalize();
    const y = new Vector3().crossVectors(toEye, x).normalize();
    const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, toEye));
    const tilt = PHONE_DOWN.tilt + (PHONE_UP.tilt - PHONE_DOWN.tilt) * k;
    const roll = PHONE_DOWN.roll + (PHONE_UP.roll - PHONE_DOWN.roll) * k + wob(s.t, 0.5, 0.8, 1.3);
    q.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -tilt * D2R));
    q.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), roll * D2R));
    return new Matrix4().compose(pos, q, new Vector3(1, 1, 1));
  };

  const render = (s: PovState, W: number, H: number) => {
    const r = renderer();
    if (!comp || comp.width !== W || comp.height !== H) comp = new PovCompositor(W, H);
    world.prepare(r);
    if (!fg.environment) fg.environment = world.mid.environment;
    (fg as any).environmentIntensity = 0.6;

    // ── камера: глаз, взгляд со стойки на телефон, дыхание ──
    const yaw = (7 + 3 * s.look) * D2R + wob(s.t, 0.0035, 0.55, 0.0);
    const pitch = (-8 - 9 * s.look) * D2R + wob(s.t, 0.003, 0.62, 1.9);
    const roll = wob(s.t, 0.0025, 0.45, 3.3);
    camera.position.copy(EYE);
    camera.position.y += wob(s.t, 0.004, 0.5, 0.7);
    camera.rotation.set(pitch, -yaw, roll, 'YXZ');
    camera.updateMatrixWorld(true);

    // ── рука и телефон перед глазом ──
    rig.root.matrix.multiplyMatrices(camera.matrixWorld, phoneMatrix(s));
    rig.root.matrixWorldNeedsUpdate = true;
    rig.root.updateMatrixWorld(true);
    const tap = mixPose(mixPose(THUMB.rest, THUMB.hover, s.reach), THUMB.press, s.press);
    rig.setThumb(mixPose(tap, THUMB.rest, s.away));

    // ── экран: перерисовка только при смене состояния (спиннер — каждый кадр) ──
    const ui = {...s.ui, t: s.t};
    const key = JSON.stringify(s.ui) + (s.ui.loading > 0 ? s.t.toFixed(3) : '');
    if (key !== lastUi) {
      drawChargeApp(rig.screenCanvas, ui);
      rig.screenTex.needsUpdate = true;
      lastUi = key;
    }

    world.update(s.t, camera);
    const bokehFar = world.bokeh.filter(b => b.layer === 'far');
    const bokehMid = world.bokeh.filter(b => b.layer === 'mid');
    return comp.render(r, camera, [
      {scene: world.far, depth: 16, bokeh: bokehFar},
      {scene: world.mid, depth: 2.9, bokeh: bokehMid},
      {scene: world.near, depth: 1.0},
      {scene: fg, depth: 0.31},
    ], {focus: s.focus, K: 20}, {time: s.t});
  };

  return {render, camera};
}
