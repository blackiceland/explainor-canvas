import {
  Bone,
  Box3,
  CanvasTexture,
  DoubleSide,
  Group,
  Matrix3,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

// ── Телефон в правой руке: вид от первого лица ────────────────────────────
// Модели: smartphone.glb (Naudaff3D, CC-BY) и rigged_hand_-_game_model.glb
// (Lorenzo Drago, Sketchfab Standard). Обе ужаты scratchpad/pov/glbpack.mjs:
// у телефона упрощены тяжёлые меши и выброшены текстуры экрана (экран рисуем
// сами), у руки — JPEG вместо PNG и без тестовой анимации.
//
// Система координат узла `root` — система ТЕЛЕФОНА: метры, центр корпуса в
// нуле, экран смотрит в +Z, верх телефона +Y. Сцена ставит root перед камерой.
//
// ⚠️ Хват подобран солвером (scratchpad/pov/opt_hand.html), а не на глаз:
// пальцы обхватывают левый край, ладонь за спиной корпуса, предплечье к камере
// снизу справа, и кисть повёрнута так, чтобы основанию большого пальца
// приходилось поворачиваться как можно меньше.
//
// ⚠️ Большой палец — ОДНА плоскость и два чистых шарнира. Палец лежит в
// плоскости через основание (CMC) и точку касания; MCP и IP только сгибаются.
// Первая версия раскладывала поворот пальца по всем суставам — палец
// перекручивался в суставах и в нажатии выглядел вывихнутым (автор). Весь
// поворот теперь берёт основание, как у настоящего пальца при оппозиции.
// ⚠️ У этой руки палец в покое лежит «варежкой» (подушечка туда же, куда
// ладонь), поэтому основанию нужен большой поворот; его уменьшает не сустав,
// а разворот всей кисти (солвер) и небольшой крен плоскости пальца (roll).

export const PHONE_URL = '/phone_pov.glb';
export const HAND_URL = '/hand_pov.glb';

/** Экран в миллиметрах и его место на холсте текстуры (flipY = true). */
export const SCREEN = {
  wMM: 61.4, hMM: 135.5,
  texW: 1152, texH: 2048,
  // UV-прямоугольник экрана модели: u 0.079–0.869, v 0.007–0.987; при flipY
  // строка холста y = (1 − v)·H.
  x0: 0.079, x1: 0.869, y0: 0.013, y1: 0.993,
};

/** Полуразмеры корпуса и плоскости стекла/спины после выравнивания, м. */
export const PHONE_BOX = {hx: 0.0357, hy: 0.0718, front: 0.0036, back: -0.0040};

/** Кисть: поворот (град, порядок ZXY), положение запястья (м), сгиб пальцев 0..1. */
export const HAND_POSE = {rot: [-4.125, 205.125, 51.5], pos: [0.0786, -0.1338, -0.0001], curl: 0.115};

const CURL_DEG: Record<string, number[]> = {
  index: [55, 60, 35], middle: [60, 62, 38], ring: [64, 64, 38], pinky: [68, 64, 38],
};
const FINGERS: Record<string, string[]> = {
  index: ['Bone009_02', 'Bone010_03', 'Bone011_04'],
  middle: ['Bone012_05', 'Bone013_06', 'Bone014_07'],
  ring: ['Bone015_08', 'Bone016_09', 'Bone017_010'],
  pinky: ['Bone018_011', 'Bone019_012', 'Bone020_013'],
};
const THUMB = ['Bone003_014', 'Bone004_015', 'Bone005_016', 'Bone005_end_021'];
const D2R = Math.PI / 180;

/**
 * Поза большого пальца, мм системы телефона. Q — где подушечка касается стекла
 * (x, y), lift — высота подушечки над стеклом, zM — высота сустава MCP над
 * стеклом, roll — крен плоскости пальца вокруг линии «основание → касание»
 * (градусы: палец жмёт чуть боком, как настоящий).
 */
export interface ThumbPose { Q: number[]; lift: number; zM: number; roll: number }

export interface PhoneHand {
  root: Group;
  phone: Group;
  hand: Object3D;
  screenCanvas: HTMLCanvasElement;
  screenTex: CanvasTexture;
  screenMat: MeshStandardMaterial;
  /**
   * Большой палец; возвращает поворот основания от покоя (°), заход в корпус (мм)
   * и недотяг до точки касания (мм, 0 — палец дотягивается).
   */
  setThumb: (p: ThumbPose) => {metaDeg: number; penMM: number; shortMM: number; mcpDeg: number; ipDeg: number};
  /** Основание большого пальца (CMC), мм системы телефона: от него строится покой пальца. */
  thumbBase: () => number[];
  /** Поза кисти (для солвера хвата; сцена берёт HAND_POSE). */
  setHand: (rot: number[], pos: number[], curl: number) => void;
  /** Кости и перевод точки кости в систему телефона — для солвера на стенде. */
  bones: Record<string, Bone>;
  toPhone: (o: Object3D) => Vector3;
}

export function* loadPhoneHand(): Generator<any, PhoneHand> {
  const loader = new GLTFLoader();
  const load = (u: string) => new Promise<any>((res, rej) => loader.load(u, res, undefined, rej));
  const phoneG = yield load(PHONE_URL);
  const handG = yield load(HAND_URL);

  const root = new Group();

  // ── телефон, выровненный по нормали экрана ──
  const phone = new Group();
  const pm = phoneG.scene as Object3D;
  pm.scale.setScalar(0.03);            // 143.6 мм в высоту
  const pmWrap = new Group();
  pmWrap.add(pm);
  phone.add(pmWrap);
  root.add(phone);
  pm.updateMatrixWorld(true);
  let screenMesh: Mesh | null = null;
  pm.traverse((o: any) => { if (o.isMesh && o.material?.name === 'Lock_Screen') screenMesh = o; });
  if (!screenMesh) throw new Error('phone: нет меша экрана Lock_Screen');
  const nm = new Matrix3().getNormalMatrix((screenMesh as Mesh).matrixWorld);
  const nW = new Vector3(0, 0, 1).applyMatrix3(nm).normalize();
  const uW = new Vector3(0, 1, 0).applyMatrix3(nm).normalize();
  pmWrap.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(new Vector3().crossVectors(uW, nW), uW, nW)).invert();
  pmWrap.updateMatrixWorld(true);
  const box = new Box3().setFromObject(pmWrap);
  pmWrap.position.sub(box.getCenter(new Vector3()));

  // Экран: свой холст вместо текстуры модели. Светится сам (emissiveMap), базовый
  // цвет чёрный — иначе свет фонарей «засвечивал» бы картинку как бумагу.
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = SCREEN.texW;
  screenCanvas.height = SCREEN.texH;
  const screenTex = new CanvasTexture(screenCanvas);
  screenTex.flipY = true;
  screenTex.colorSpace = SRGBColorSpace;
  screenTex.anisotropy = 8;
  const screenMat = new MeshStandardMaterial({
    color: 0x000000, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 1,
    roughness: 0.35, metalness: 0,
    // ⚠️ У меша экрана по краям перевёрнута обмотка треугольников: с одной
    // стороной видна только полоса посередине (материал модели двусторонний).
    side: DoubleSide,
    // экран снят «правильной экспозицией»: цвета интерфейса как есть, без
    // пересчёта плёночной кривой (иначе зелёная кнопка тускнеет до хаки)
    toneMapped: false,
  });
  (screenMesh as Mesh).material = screenMat;

  // ── рука ──
  const hand = handG.scene as Object3D;
  const handRoot = new Group();
  handRoot.add(hand);
  root.add(handRoot);
  const bones: Record<string, Bone> = {};
  hand.traverse((o: any) => {
    if (o.isBone) bones[o.name] = o;
    if (o.isMesh) {
      o.frustumCulled = false;
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  hand.updateMatrixWorld(true);
  const wpos = (b: Object3D, v = new Vector3()) => b.getWorldPosition(v);
  // Масштаб: запястье → кончик среднего = 19 см. Запястье — в начало handRoot.
  const L = wpos(bones['Bone001_01']).distanceTo(wpos(bones['Bone014_end_018']));
  hand.scale.multiplyScalar(0.19 / L);
  hand.updateMatrixWorld(true);
  hand.position.sub(wpos(bones['Bone001_01']));
  const rest: Record<string, Quaternion> = {};
  for (const b of Object.values(bones)) rest[b.name] = b.quaternion.clone();

  const X = new Vector3(1, 0, 0);
  function setHand(rot: number[], pos: number[], curl: number) {
    handRoot.rotation.set(rot[0] * D2R, rot[1] * D2R, rot[2] * D2R, 'ZXY');
    handRoot.position.set(pos[0], pos[1], pos[2]);
    for (const [f, names] of Object.entries(FINGERS)) {
      names.forEach((n, i) => {
        bones[n].quaternion.copy(rest[n]).multiply(new Quaternion().setFromAxisAngle(X, -CURL_DEG[f][i] * curl * D2R));
      });
    }
    for (const n of THUMB.slice(0, 3)) bones[n].quaternion.copy(rest[n]);
    root.updateMatrixWorld(true);
  }
  setHand(HAND_POSE.rot, HAND_POSE.pos, HAND_POSE.curl);

  // ── большой палец ──
  // Всё считается в системе root (телефона): мировые матрицы берутся
  // относительно root, поэтому сцена может ставить root куда угодно.
  const toRoot = new Matrix4();
  const local = (o: Object3D) => {
    root.updateMatrixWorld(true);
    toRoot.copy(root.matrixWorld).invert();
    return o.getWorldPosition(new Vector3()).applyMatrix4(toRoot);
  };
  const rootQ = () => root.getWorldQuaternion(new Quaternion());
  const localQ = (o: Object3D) => rootQ().invert().multiply(o.getWorldQuaternion(new Quaternion()));
  const Lb = [0, 1, 2].map(k => local(bones[THUMB[k]]).distanceTo(local(bones[THUMB[k + 1]])));

  // Кость k — от from к to; ноготь — к стороне up плоскости пальца.
  // Минимальный поворот из покоя + закрутка вокруг оси кости до ногтя.
  // ⚠️ У большого пальца этой модели ноготь смотрит в ЛОКАЛЬНУЮ −X, подушечка
  // в +X, сгиб — вокруг Z (у остальных пальцев ноготь +Z, сгиб вокруг X).
  // Проверено снимком кончика с шести сторон (scratchpad/pov/nailcheck.html).
  // Первая версия ставила к up локальную +Z — палец ложился ногтем к телефону
  // и гнулся в обратную сторону (автор, по фото своей руки).
  function aim(k: number, from: Vector3, to: Vector3, up: Vector3) {
    const b = bones[THUMB[k]];
    b.quaternion.copy(rest[THUMB[k]]);
    b.updateMatrixWorld(true);
    const q0 = localQ(b);
    const y0 = new Vector3(0, 1, 0).applyQuaternion(q0);
    const y = to.clone().sub(from).normalize();
    const q = new Quaternion().setFromUnitVectors(y0, y).multiply(q0);
    const nMs = new Vector3(-1, 0, 0).applyQuaternion(q);
    const nF = up.clone();
    nF.sub(y.clone().multiplyScalar(nF.dot(y))).normalize();
    nMs.sub(y.clone().multiplyScalar(nMs.dot(y))).normalize();
    const phi = Math.atan2(new Vector3().crossVectors(nMs, nF).dot(y), nMs.dot(nF));
    q.premultiply(new Quaternion().setFromAxisAngle(y, phi));
    const parentQ = localQ(b.parent!);
    b.quaternion.copy(parentQ.invert().multiply(q));
    b.updateMatrixWorld(true);
  }

  // Заход точки (с радиусом r) внутрь корпуса телефона, м.
  const B = PHONE_BOX;
  const pen = (p: Vector3, r: number) => {
    const dx = B.hx + r - Math.abs(p.x), dy = B.hy + r - Math.abs(p.y);
    const dz1 = B.front + r - p.z, dz2 = p.z - (B.back - r);
    return (dx <= 0 || dy <= 0 || dz1 <= 0 || dz2 <= 0) ? 0 : Math.min(dx, dy, dz1, dz2);
  };

  function setThumb(p: ThumbPose) {
    for (const n of THUMB.slice(0, 3)) bones[n].quaternion.copy(rest[n]);
    root.updateMatrixWorld(true);
    const C = local(bones[THUMB[0]]);
    // точка касания и плоскость пальца: через C и Q, «верх» — к +Z с креном roll
    const Q = new Vector3(p.Q[0] * 0.001, p.Q[1] * 0.001, B.front + p.lift * 0.001);
    const u = Q.clone().sub(C).normalize();
    const Z = new Vector3(0, 0, 1);
    const up = Z.clone().sub(u.clone().multiplyScalar(Z.dot(u))).normalize().applyAxisAngle(u, p.roll * D2R);
    // MCP: в плоскости, на расстоянии пясти от C и на высоте zM над стеклом:
    //   C.z + L·(cosα·u.z + sinα·up.z) = front + zM  →  a·cosα + b·sinα = c
    const a = Lb[0] * u.z, b = Lb[0] * up.z, c = B.front + p.zM * 0.001 - C.z;
    const R = Math.hypot(a, b);
    const al = Math.atan2(b, a) - Math.acos(Math.max(-1, Math.min(1, c / R)));
    const M = C.clone().addScaledVector(u, Lb[0] * Math.cos(al)).addScaledVector(up, Lb[0] * Math.sin(al));
    // кончик: кость дистальной фаланги над подушечкой (6 мм) и впереди неё (9 мм)
    const T = Q.clone().addScaledVector(up, 0.006).addScaledVector(u, 0.009);
    // две фаланги: колено IP выпирает к up
    const MT = T.clone().sub(M);
    let d = MT.length();
    const maxR = Lb[1] + Lb[2] - 1e-5;
    const shortMM = Math.max(0, d - maxR) * 1000;
    if (d > maxR) { T.copy(M).add(MT.setLength(maxR)); d = maxR; }
    const ut = T.clone().sub(M).normalize();
    const w = up.clone().sub(ut.clone().multiplyScalar(up.dot(ut))).normalize();
    const cosA = (Lb[1] ** 2 + d ** 2 - Lb[2] ** 2) / (2 * Lb[1] * d);
    const A = Math.acos(Math.max(-1, Math.min(1, cosA)));
    const I = M.clone().addScaledVector(ut, Math.cos(A) * Lb[1]).addScaledVector(w, Math.sin(A) * Lb[1]);
    aim(0, C, M, up);
    aim(1, local(bones[THUMB[1]]), I, up);
    aim(2, local(bones[THUMB[2]]), T, up);
    root.updateMatrixWorld(true);
    // отчёт для солвера: поворот основания от покоя и заход в корпус
    const rel = rest[THUMB[0]].clone().invert().multiply(bones[THUMB[0]].quaternion);
    const metaDeg = 2 * Math.acos(Math.min(1, Math.abs(rel.w))) / D2R;
    let worst = 0;
    for (let k = 0; k < 3; k++) {
      const s0 = local(bones[THUMB[k]]), s1 = local(bones[THUMB[k + 1]]);
      for (let i = 0; i <= 8; i++) worst = Math.max(worst, pen(s0.clone().lerp(s1, i / 8), 0.009));
    }
    // сгиб суставов: угол между соседними фалангами (0 — палец прямой)
    const bend = (a: Vector3, b: Vector3, c: Vector3) => b.clone().sub(a).normalize().angleTo(c.clone().sub(b).normalize()) / D2R;
    return {metaDeg, penMM: worst * 1000, shortMM, mcpDeg: bend(C, M, I), ipDeg: bend(M, I, T)};
  }

  const thumbBase = () => local(bones[THUMB[0]]).toArray().map(v => v * 1000);

  return {root, phone, hand: handRoot, screenCanvas, screenTex, screenMat, setThumb, thumbBase, setHand, bones, toPhone: local};
}
