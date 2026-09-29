import {
  Bone,
  CanvasTexture,
  Color,
  DoubleSide,
  LoadingManager,
  Material,
  Matrix4,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  Object3D,
  Quaternion,
  SkinnedMesh,
  SRGBColorSpace,
  Texture,
  Vector3,
} from 'three';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';

// ── Человек из Microsoft Rocketbox (лицензия MIT) с лицом в фокусе ─────────
// Модель: <имя>_facial.fbx — один skinned-меш (тело, голова, карточки волос),
// 81 кость Biped, 175 лицевых форм (ARKit-набор: моргание, взгляд). Текстуры
// 2048: *_head_color / normal / specular, *_body_*, *_opacity_color.
//
// ⚠️ Оси костей Biped повёрнуты как попало: у головы «вперёд» — не её +Z.
// Поэтому всё позируется в МИРОВЫХ осях — поворотом кости вокруг мировой оси
// или наведением кости на точку, — а взгляд считается от покоя: в покое глаза
// смотрят туда же, куда лицо (+Z мира), дальше их несёт поворот головы.
// ⚠️ Глазное яблоко лежит в атласе головы (внизу слева): радужка в центре
// круга, вокруг белок, снаружи красная задняя сторона. Неверный поворот глаза
// показывает именно её — «красные глаза» значат ошибку взгляда, не текстуры.
// ⚠️ Без окклюзии белок под светом экрана горит ровно и глаз стеклянный:
// край яблока темнее (тень века), отражение роговицы тише кожи, бархата нет.
// ⚠️ Волосы — карточки с альфой. Пышную причёску (афро) карточки не держат:
// вблизи она читается шлемом. Брать людей с короткими и прямыми волосами.

export interface PersonSpec {
  /** <имя>.fbx (веки — костями) или <имя>_facial.fbx (веки — формами). */
  fbx: string;
  /** Префикс текстур: '<папка>/m017' → m017_head_color.<ext> и т. д. */
  tex: string;
  /** Расширение текстур: png (исходник) или webp (сжато для dev-сервера). */
  ext?: string;
  /** Глазное яблоко в текстуре головы, px исходника 2048: центр и радиус. */
  eyeUV?: [number, number, number];
  /** Второй, полупрозрачный проход волос (пушок по краю). По умолчанию выключен. */
  softHair?: boolean;
  /** Карточки волос. У Female_Adult_08 они выходят сплошными чёрными листами с бликом,
   *  а нарисованной на голове причёски хватает — там false. */
  hairCards?: boolean;
}

export interface PersonPose {
  /** Куда поставить середину между глазами, мир, м. */
  eyes: Vector3;
  /** Наклон корпуса вперёд, °. */
  lean: number;
  /** Голова: вперёд-вниз, поворот (+ к своему левому), крен, °. */
  head: [number, number, number];
  /** Точка, куда смотрят глаза, мир. */
  gazeAt: Vector3;
  /** Моргание 0..1. */
  blink: number;
  /** Запястья (левое, правое) — цели для IK рук, мир. */
  wrist: [Vector3, Vector3];
  /** Дыхание −1..1. */
  breath: number;
  /** Нажатие пальцем 0..1 по рукам (левая, правая) и пальцам (большой…мизинец). */
  taps?: [number[], number[]];
  /** Куда лягут кончики пальцев: высота верха клавиш и глубина домашнего ряда, мир.
   *  Если задано, запястье подгоняется так, чтобы кончики встали ровно туда.
   *  x — середина кончиков по ширине для левой и правой руки (домашний ряд);
   *  spread — от кончика указательного до кончика мизинца (F…A — три клавиши);
   *  z, spread, turn — можно по рукам (левая, правая): руки лежат не симметрично.
   *  turn — отклонение кисти от линии предплечья к мизинцу, рад (по умолчанию 3°). */
  keys?: {y: number; z: number | [number, number]; x?: [number, number]; spread?: number | [number, number]; turn?: [number, number]};
  /** Своя ориентация кисти (левая, правая). Без неё — «на клавишах»: пальцы
   *  вперёд, ладонью вниз. Нужна, чтобы держать стакан. */
  handAim?: [HandAim | null, HandAim | null];
  /** Наклон кисти к пальцам, рад (+ — вниз). По умолчанию почти ровная (HAND_PITCH);
   *  запястья на столе — кисть поднята к клавишам (отрицательный). */
  handPitch?: number;
  /** Множитель сгиба пальцев над клавишами (по умолчанию 1); можно по пальцам —
   *  указательный … мизинец: у поднятой кисти короткий мизинец иначе уходит в клавиши. */
  curl?: number | [number, number, number, number];
  /** Сгиб большого пальца по суставам, ° (по умолчанию — под ладонь). Запястье на
   *  столе: большой палец поверх пробела, иначе он уходит в столешницу. */
  thumb?: [number, number, number];
}

export interface HandAim {
  /** Куда смотрят пальцы (от запястья к костяшкам), мир. */
  fingers: Vector3;
  /** Куда смотрит тыльная сторона кисти, мир. */
  back: Vector3;
  /** Обхват цилиндра этого радиуса, м: пальцы гнутся по его окружности. */
  wrap?: number | number[];
}

export interface Person {
  root: Object3D;
  setPose: (p: PersonPose) => void;
  /** Кадр головы после setPose, мир: начало — середина глаз, оси — как у головы
   *  в покое (вперёд +Z, вверх +Y, его левая рука +X). К нему крепятся очки и наушники. */
  headFrame: () => Matrix4;
  /** Плечо, локоть, запястье руки после setPose, мир. 0 — левая, 1 — правая. */
  armPoints: (hand: 0 | 1) => [Vector3, Vector3, Vector3];
  /** Основания пальцев 1…4 (указательный…мизинец) после setPose, мир. */
  fingerBases: (hand: 0 | 1) => Vector3[];
  /** Кадр кисти после setPose, мир: начало — кость кисти (запястье), +Z — к пальцам,
   *  +Y — тыльная сторона, +X = Y × Z. 0 — левая рука, 1 — правая. */
  handFrame: (hand: 0 | 1) => Matrix4;
  /** Сетка кожи — для замеров лица (посадка очков). */
  skin: SkinnedMesh;
}

const D2R = Math.PI / 180;
// Материал: подобрано на стенде под свет экрана в тёмной комнате.
const ROUGH_FROM_SPEC = 0.35 * 2.2;   // насколько карта блеска сглаживает кожу
const SHEEN = 0.35;                   // бархат кожи
const EYE_ROUGH = 0.08;               // мокрое глазное яблоко
const EYE_DIM = 0.88;                 // приглушение белка
const EYE_SPEC = 0.3;                 // сила отражения роговицы относительно кожи
const HAIR_CORE = 0.6;                // порог плотной сердцевины карточек
const HAIR_DARKEN = 0.35;             // нарисованные волосы темнее: чёрные волосы почти не отражают диффузно
const HAIR_ROUGH = 0.5;               // и блестят волосом, а не кожей
const HAIR_SPEC = 0.55;               // сила блика на нарисованных волосах относительно кожи
const HAIR_CARD_DARKEN = 0.7;         // карточки — в тон нарисованным
// ⚠️ Гладкие длинные волосы (Female_Adult_08) под большим окном давали белую
// пластиковую полосу во всю прядь: у карточки одна нормаль на всю ширину.
const HAIR_CARD_ROUGH = 0.72;
// Веки костями (у модели без лицевых форм). ⚠️ Поворот этих костей веко почти
// не двигает — их СДВИГАЕМ вдоль вертикали головы, м: верхнее вниз, нижнее чуть вверх.
const LID_TOP = -0.0095, LID_BOTTOM = 0.0015;
// верхнее веко при этом чуть выходит вперёд, иначе роговица проступает сквозь него
const LID_FWD = 0.003;
// Пальцы над клавишами: сгиб по суставам (основание, середина, кончик), °.
const CURL: Record<number, [number, number, number]> = {
  // ⚠️ Сильнее согнутые пальцы ставили кисть высокой аркой: из глаз (кадр POV)
  // видно только тыл ладони, пальцы прятались под костяшками.
  1: [9, 24, 14], 2: [8, 25, 15], 3: [10, 26, 16], 4: [12, 28, 17],
};
const HAND_PITCH = 0.05;              // кисть почти ровная: тыльная сторона чуть вниз к пальцам
// Кисть продолжает линию предплечья: букву V дают сходящиеся предплечья, а кисть
// лишь чуть отклонена к мизинцу, рад. ⚠️ Кисть, повёрнутая на постоянный угол без
// оглядки на предплечье, давала излом на запястье (автор: «что-то не так с
// предплечьем»): при сходящихся на 30° предплечьях кисть загибалась наружу.
const HAND_DEV = 3 * Math.PI / 180;
// Локти чуть в стороны, но не «пингвином»: сильнее — предплечья сходятся круче.
const ELBOW_OUT = 0.12;
// Доля поворота ладони, которую берёт предплечье (лучевая кость вокруг локтевой).
const PRONATE = 0.65;
const DISTAL = 0.85;                  // кончик: последняя фаланга, продолженная на эту долю средней
const TAP = 14;
const FINGER_HALF = 0.008;
// Разведение пальцев: доля угла на палец (указательный — к себе, мизинец — наружу)
// и плечо, на котором поворот основания сдвигает кончик (указательный + мизинец), м.
const SPLAY = [0, -1, -0.35, 0.35, 1];
const SPREAD_LEVER = 0.16;            // полутолщина пальца: по ней пальцы огибают стакан                       // дополнительный сгиб основания при нажатии, °

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error(`нет картинки ${url}`));
    i.src = url;
  });
}

// FBX хранит UV снизу вверх, как картинка с переворотом.
function canvasTex(c: HTMLCanvasElement, srgb: boolean): Texture {
  const t = new CanvasTexture(c);
  t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  t.flipY = true;
  t.anisotropy = 8;
  return t;
}

function imageTex(img: HTMLImageElement, srgb: boolean): Texture {
  const t = new Texture(img);
  t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  t.flipY = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function toCanvas(img: HTMLImageElement): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d', {willReadFrequently: true})!;
  g.drawImage(img, 0, 0);
  return [c, g];
}

/** 0 внутри глазного яблока, 1 снаружи, мягкий край по последним 20 % радиуса. */
function eyeK(px: number, py: number, eye?: [number, number, number]): number {
  if (!eye) return 1;
  const dd = Math.hypot(px - eye[0], py - eye[1]) / eye[2];
  return dd >= 1 ? 1 : dd <= 0.8 ? 0 : (dd - 0.8) / 0.2;
}

// ⚠️ Большая часть причёски — НАРИСОВАНА на атласе головы, карточки лишь сверху.
// С материалом кожи (бархат, кожный блик) затылок под тёплым контуром читался
// рыжей лысиной-шлемом. Маска волос: тёмное и малонасыщенное на атласе.
interface HairMask { k: Float32Array; w: number; h: number; }
function hairMask(img: HTMLImageElement): HairMask {
  const [c, g] = toCanvas(img);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const k = new Float32Array(c.width * c.height);
  for (let i = 0; i < k.length; i++) {
    const r = d[i * 4] / 255, gg = d[i * 4 + 1] / 255, b = d[i * 4 + 2] / 255;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    const lum = 0.3 * r + 0.59 * gg + 0.11 * b;
    const sat = mx > 0 ? (mx - mn) / mx : 0;
    const dark = 1 - Math.min(1, Math.max(0, (lum - 0.12) / 0.14));
    const grey = 1 - Math.min(1, Math.max(0, (sat - 0.45) / 0.25));
    k[i] = d[i * 4 + 3] > 0 ? dark * grey : 0;
  }
  return {k, w: c.width, h: c.height};
}
/** Маска волос в точке карты другого размера. */
const hairAt = (m: HairMask | undefined, px: number, py: number, w: number, h: number) =>
  m ? m.k[Math.min(m.h - 1, Math.floor((py * m.h) / h)) * m.w + Math.min(m.w - 1, Math.floor((px * m.w) / w))] : 0;

/** Цвет головы с тенью век на глазном яблоке; нарисованные волосы темнее. */
function headColor(img: HTMLImageElement, eye?: [number, number, number], hair?: HairMask): Texture {
  const [c, g] = toCanvas(img);
  if (hair) {
    const d = g.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < d.data.length; i += 4) {
      const k = 1 - HAIR_DARKEN * hairAt(hair, (i / 4) % c.width, Math.floor(i / 4 / c.width), c.width, c.height);
      for (let j = 0; j < 3; j++) d.data[i + j] = Math.round(d.data[i + j] * k);
    }
    g.putImageData(d, 0, 0);
  }
  if (eye) {
    const x0 = Math.max(0, eye[0] - eye[2]), y0 = Math.max(0, eye[1] - eye[2]), s = eye[2] * 2;
    const d = g.getImageData(x0, y0, s, s);
    for (let i = 0; i < d.data.length; i += 4) {
      const px = x0 + (i / 4) % s, py = y0 + Math.floor(i / 4 / s);
      const dd = Math.hypot(px - eye[0], py - eye[1]) / eye[2];
      if (dd >= 1) continue;
      const u = Math.min(1, Math.max(0, (dd - 0.35) / 0.65));
      const k = EYE_DIM * (1 - 0.45 * u * u * (3 - 2 * u));
      for (let j = 0; j < 3; j++) d.data[i + j] = Math.round(d.data[i + j] * k);
    }
    g.putImageData(d, x0, y0);
  }
  return canvasTex(c, true);
}

/** Шероховатость из карты блеска; на глазу — мокро. */
function roughFromSpec(img: HTMLImageElement, eye?: [number, number, number], hair?: HairMask): Texture {
  const [c, g] = toCanvas(img);
  const d = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const s = (d.data[i] + d.data[i + 1] + d.data[i + 2]) / (3 * 255);
    let r = Math.max(0.08, Math.min(1, 1 - s * ROUGH_FROM_SPEC));
    const k = eyeK((i / 4) % c.width, Math.floor(i / 4 / c.width), eye);
    if (k < 1) r = Math.min(r, EYE_ROUGH + (1 - EYE_ROUGH) * k);
    const hk = hairAt(hair, (i / 4) % c.width, Math.floor(i / 4 / c.width), c.width, c.height);
    r += (HAIR_ROUGH - r) * hk;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = Math.round(r * 255);
    d.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  return canvasTex(c, false);
}

// ⚠️ Маски — попиксельно, не композитингом холста: заливка «под» полупрозрачным
// кругом поднимала альфу обратно до единицы, и маска ничего не делала.
function eyeMask(size: number, eye: [number, number, number] | undefined, inside: number, inRgb: boolean, hair?: HairMask, onHair = 1): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const d = g.createImageData(size, size);
  for (let i = 0; i < d.data.length; i += 4) {
    const px = (i / 4) % size, py = Math.floor(i / 4 / size);
    const v = (inside + (1 - inside) * eyeK(px, py, eye)) * (1 + (onHair - 1) * hairAt(hair, px, py, size, size));
    const rgb = inRgb ? Math.round(255 * v) : 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = rgb;
    d.data[i + 3] = Math.round(255 * v);
  }
  g.putImageData(d, 0, 0);
  return canvasTex(c, false);
}

// Прозрачные пиксели карточек светлые — на мипмапах они выползают по краю
// светлыми осколками. Красим прозрачное в средний цвет волос.
function hairTex(img: HTMLImageElement): Texture {
  const [c, g] = toCanvas(img);
  const d = g.getImageData(0, 0, c.width, c.height);
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let i = 0; i < d.data.length; i += 4) {
    if (d.data[i + 3] > 230) { sr += d.data[i]; sg += d.data[i + 1]; sb += d.data[i + 2]; n++; }
  }
  const avg = [sr / Math.max(1, n), sg / Math.max(1, n), sb / Math.max(1, n)];
  for (let i = 0; i < d.data.length; i += 4) {
    const k = Math.min(1, (d.data[i + 3] / 255) * 1.4);
    for (let j = 0; j < 3; j++) d.data[i + j] = Math.round((avg[j] + (d.data[i + j] - avg[j]) * k) * HAIR_CARD_DARKEN);
  }
  g.putImageData(d, 0, 0);
  return canvasTex(c, true);
}

// ── позирование в мировых осях ─────────────────────────────────────────────
const _wq = new Quaternion();
const _pq = new Quaternion();

function worldPos(o: Object3D, out = new Vector3()): Vector3 {
  o.updateWorldMatrix(true, false);
  return out.setFromMatrixPosition(o.matrixWorld);
}

/** Повернуть кость на q, заданный в мировых осях. */
function rotateWorld(bone: Object3D, q: Quaternion): void {
  bone.getWorldQuaternion(_wq);
  bone.parent!.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(q.clone().multiply(_wq)));
  bone.updateMatrixWorld(true);
}

/** Сдвинуть кость на вектор, заданный в мировых осях (с учётом масштаба предков). */
function moveWorld(bone: Object3D, delta: Vector3): void {
  bone.parent!.updateWorldMatrix(true, false);
  const inv = bone.parent!.matrixWorld.clone().invert();
  const a = new Vector3().applyMatrix4(inv);
  const b = delta.clone().applyMatrix4(inv);
  bone.position.add(b.sub(a));
  bone.updateMatrixWorld(true);
}

function rotateAxis(bone: Object3D, axis: Vector3, deg: number): void {
  if (Math.abs(deg) < 1e-6) return;
  rotateWorld(bone, new Quaternion().setFromAxisAngle(axis, deg * D2R));
}

/** Навести кость так, чтобы направление на дочернюю смотрело в dir. */
function aim(bone: Object3D, child: Object3D, dir: Vector3): void {
  const cur = worldPos(child).sub(worldPos(bone)).normalize();
  rotateWorld(bone, new Quaternion().setFromUnitVectors(cur, dir.clone().normalize()));
}

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

export function* loadPerson(spec: PersonSpec): Generator<any, Person> {
  const manager = new LoadingManager();
  // Текстуры из FBX не нужны: ссылки там на машину автора модели.
  manager.setURLModifier(u => (/\.(tga|png|jpe?g|dds)$/i.test(u) ? 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' : u));
  const model: Object3D = yield new FBXLoader(manager).loadAsync(spec.fbx);
  model.scale.setScalar(0.01);            // сантиметры → метры
  const root = new Object3D();
  root.add(model);

  const T = spec.tex, ext = spec.ext ?? 'png';
  const imgs: HTMLImageElement[] = yield Promise.all([
    'body_color', 'body_normal', 'body_specular', 'head_color', 'head_normal', 'head_specular',
    // у моделей без карточек волос (Male_Adult_12) карты прозрачности нет вовсе
    ...(spec.hairCards === false ? [] : ['opacity_color']),
  ].map(k => loadImage(`${T}_${k}.${ext}`)));
  const [bodyC, bodyN, bodyS, headC, headN, headS, hairC] = imgs;
  // Координаты глаза заданы в пикселях исходника 2048; сжатые карты мельче.
  const eyeAt = (w: number): [number, number, number] | undefined =>
    spec.eyeUV ? (spec.eyeUV.map(v => (v * w) / 2048) as [number, number, number]) : undefined;
  const eye = eyeAt(headC.width);
  const hair = hairMask(headC);
  const headMat = new MeshPhysicalMaterial({
    name: 'head', map: headColor(headC, eye, hair), normalMap: imageTex(headN, false),
    roughness: 1, roughnessMap: roughFromSpec(headS, eyeAt(headS.width), hair),
    specularIntensity: 1, specularIntensityMap: eyeMask(headC.width, eye, EYE_SPEC, false, hair, HAIR_SPEC),
    sheen: SHEEN, sheenRoughness: 0.75, sheenColor: new Color('#ffd9c4'),
    sheenColorMap: eyeMask(headC.width, eye, 0, true, hair, 0),
  });
  const bodyMat = new MeshStandardMaterial({
    name: 'body', map: imageTex(bodyC, true), normalMap: imageTex(bodyN, false),
    roughness: 1, roughnessMap: roughFromSpec(bodyS),
  });
  const hairTexture = hairC ? hairTex(hairC) : null;
  // Первый проход волос: плотная сердцевина с записью глубины.
  const hairCore = new MeshStandardMaterial({
    name: 'hair', map: hairTexture, roughness: HAIR_CARD_ROUGH, alphaTest: HAIR_CORE, side: DoubleSide,
  });
  // Второй проход: мягкий край — полупрозрачно, без записи глубины, поверх.
  // ⚠️ Матовый: пряди края стоят ребром и копятся без глубины — блик экрана на
  // них складывался в светлую зигзаг-полосу по пробору (вид из-за плеча).
  const hairSoft = new MeshStandardMaterial({
    name: 'hair_soft', map: hairTexture, roughness: 1, transparent: true, depthWrite: false,
    alphaTest: 0.02, side: DoubleSide,
  });

  let mesh: SkinnedMesh | null = null;
  model.traverse(o => { if ((o as SkinnedMesh).isSkinnedMesh) mesh = o as SkinnedMesh; });
  if (!mesh) throw new Error(`${spec.fbx}: нет skinned-меша`);
  const body: SkinnedMesh = mesh;
  const pick = (m: Material, head: Material, hair: Material, rest: Material) =>
    /head/.test(m.name) ? head : /opacity/.test(m.name) ? hair : rest;
  const src = (Array.isArray(body.material) ? body.material : [body.material]) as Material[];
  body.material = src.map(m => pick(m, headMat, hairCore, bodyMat));
  body.frustumCulled = false;
  const hide = new MeshBasicMaterial({visible: false});
  const soft = new SkinnedMesh(body.geometry, src.map(m => pick(m, hide, hairSoft, hide)));
  soft.position.copy(body.position);
  soft.quaternion.copy(body.quaternion);
  soft.scale.copy(body.scale);
  body.parent!.add(soft);
  soft.bind(body.skeleton, body.bindMatrix);
  soft.morphTargetInfluences = body.morphTargetInfluences;
  soft.frustumCulled = false;
  soft.renderOrder = 2;
  // ⚠️ Мягкий проход выключен: его полупрозрачные края прядей (цвет — средний
  // волос, коричневый) под тёплым светом давали коричневые полосы на макушке.
  // Без него края карточек чище; включать только для стрижек без слоёв.
  soft.visible = spec.softHair ?? false;
  if (spec.hairCards === false) hairCore.visible = false;

  // ── кости ──
  const bones = new Map<string, Bone>();
  model.traverse(o => { if ((o as Bone).isBone) bones.set(o.name, o as Bone); });
  const bone = (n: string): Bone => {
    const b = bones.get(n);
    if (!b) throw new Error(`${spec.fbx}: нет кости ${n}`);
    return b;
  };
  const rest = new Map<Bone, Quaternion>();
  bones.forEach(b => rest.set(b, b.quaternion.clone()));
  const restPos = new Map<Bone, Vector3>();
  bones.forEach(b => restPos.set(b, b.position.clone()));

  const spine = [bone('Bip01_Spine'), bone('Bip01_Spine1'), bone('Bip01_Spine2')];
  const neck = bone('Bip01_Neck'), head = bone('Bip01_Head');
  const eyeL = bone('Bip01_LEye'), eyeR = bone('Bip01_REye');
  const arms = (['L', 'R'] as const).map(s => ({
    clav: bone(`Bip01_${s}_Clavicle`),
    up: bone(`Bip01_${s}_UpperArm`),
    fore: bone(`Bip01_${s}_Forearm`),
    hand: bone(`Bip01_${s}_Hand`),
    // пальцы: 0 — большой, 1 — указательный … 4 — мизинец; по три сустава
    fingers: [0, 1, 2, 3, 4].map(f => [`Bip01_${s}_Finger${f}`, `Bip01_${s}_Finger${f}1`, `Bip01_${s}_Finger${f}2`].map(bone)),
  }));
  const lids = ['L', 'R'].map(s => ({top: bone(`Bip01_${s}EyeBlinkTop`), bottom: bone(`Bip01_${s}EyeBlinkBottom`)}));

  // Лицом в +Z: по носу относительно головы.
  root.updateMatrixWorld(true);
  const nose = worldPos(bone('Bip01_MNose')).sub(worldPos(head));
  model.rotation.y = -Math.atan2(nose.x, nose.z);
  root.updateMatrixWorld(true);
  const armLen = arms.map(a => [
    worldPos(a.fore).distanceTo(worldPos(a.up)),
    worldPos(a.hand).distanceTo(worldPos(a.fore)),
  ]);

  const morph = body.morphTargetDictionary ?? {};
  const find = (re: RegExp) => Object.keys(morph).filter(k => re.test(k)).map(k => morph[k]);
  // Моргание: у *_facial — формами, у облегчённой модели (на 1.4 МБ легче) — костями век.
  const blinkIdx = find(/EyeBlink(Left|Right)$/);

  const eyesMid = () => worldPos(eyeL).add(worldPos(eyeR)).multiplyScalar(0.5);

  function setPose(p: PersonPose): void {
    // Каждый кадр — с покоя: поза чистая функция p, ничего не накапливается.
    rest.forEach((q, b) => b.quaternion.copy(q));
    restPos.forEach((v, b) => b.position.copy(v));
    root.position.set(0, 0, 0);
    root.updateMatrixWorld(true);
    const headRest = new Quaternion();
    head.getWorldQuaternion(headRest);

    // корпус: наклон вперёд, разложен по трём позвонкам; дыхание — грудь
    for (const [i, s] of spine.entries()) rotateAxis(s, X, p.lean * [0.3, 0.35, 0.35][i] + (i === 2 ? p.breath * 0.35 : 0));
    // плечи чуть поднимаются на вдохе
    for (const a of arms) rotateAxis(a.clav, Z, Math.sign(worldPos(a.up).x) * p.breath * 0.6);
    // голова: половина — на шее, половина — на самой голове
    rotateAxis(neck, X, p.head[0] * 0.5);
    rotateAxis(head, X, p.head[0] * 0.5);
    rotateAxis(head, Y, p.head[1]);
    rotateAxis(head, Z, p.head[2]);

    // ставим глаза на место — позу это не меняет, только сдвигает человека
    root.position.add(p.eyes.clone().sub(eyesMid()));
    root.updateMatrixWorld(true);

    // руки: аналитический IK двух костей, локоть — вниз и назад, у корпуса.
    // ⚠️ Локоть, отведённый наружу, даёт «пингвина»: плечи в кадре торчат в стороны.
    arms.forEach((a, i) => {
      const side = Math.sign(worldPos(a.up).x) || 1;
      const target = p.wrist[side > 0 ? 0 : 1].clone();
      // рука со своей ориентацией (держит кружку) на клавиши не ставится
      if (p.keys && !p.handAim?.[side > 0 ? 0 : 1]) {
        // подгонка: кончики пальцев на клавиши — сдвигаем запястье на промах и повторяем.
        // Нажатия не в счёт: палец уходит вниз сам, кисть за ним не прыгает.
        const still = {...p, taps: undefined};
        for (let k = 0; k < 5; k++) {
          poseArm(a, i, side, target, still);
          const tip = tipsMid(a);
          const hi = side > 0 ? 0 : 1;
          const tx = p.keys.x ? p.keys.x[hi] : tip.x;
          const tz = Array.isArray(p.keys.z) ? p.keys.z[hi] : p.keys.z;
          const miss = new Vector3(tx - tip.x, p.keys.y - tip.y, tz - tip.z);
          if (miss.lengthSq() < 1e-8) break;
          target.add(miss);
        }
      }
      poseArm(a, i, side, target, p);
    });

    // взгляд: от покоя, с поворотом, который получила голова
    const headNow = new Quaternion();
    head.getWorldQuaternion(headNow);
    // поворот головы от покоя: им несутся и взгляд, и ось век
    const headDelta = headNow.clone().multiply(headRest.clone().invert());
    lastHead.copy(headDelta);
    const fwd = Z.clone().applyQuaternion(headDelta);
    for (const e of [eyeL, eyeR]) {
      const want = p.gazeAt.clone().sub(worldPos(e)).normalize();
      const ang = fwd.angleTo(want);
      if (ang > 1e-5) rotateWorld(e, new Quaternion().setFromAxisAngle(new Vector3().crossVectors(fwd, want).normalize(), ang));
    }

    if (blinkIdx.length) {
      const inf = body.morphTargetInfluences!;
      for (const i of blinkIdx) inf[i] = p.blink;
    } else if (p.blink > 1e-4) {
      // веки: сдвиг вдоль вертикали головы (в покое — Y мира)
      const ax = Y.clone().applyQuaternion(headDelta);
      const fw = Z.clone().applyQuaternion(headDelta);
      for (const l of lids) {
        moveWorld(l.top, ax.clone().multiplyScalar(LID_TOP * p.blink).addScaledVector(fw, LID_FWD * p.blink));
        moveWorld(l.bottom, ax.clone().multiplyScalar(LID_BOTTOM * p.blink));
      }
    }
    root.updateMatrixWorld(true);
  }

  type Arm = (typeof arms)[number];
  /** Середина кончиков четырёх пальцев: последняя фаланга, продолженная на свою длину. */
  function tipsMid(a: Arm): Vector3 {
    const m = new Vector3();
    for (let f = 1; f <= 4; f++) {
      const [, mid, end] = a.fingers[f].map(b => worldPos(b));
      m.add(end.clone().addScaledVector(end.clone().sub(mid), DISTAL));
    }
    return m.multiplyScalar(0.25);
  }

  /** Рука целиком от покоя: плечо, локоть, кисть, пальцы — под запястье target. */
  function poseArm(a: Arm, i: number, side: number, target: Vector3, p: PersonPose): void {
    for (const b of [a.up, a.fore, a.hand, ...a.fingers.flat()]) b.quaternion.copy(rest.get(b)!);
    a.up.updateMatrixWorld(true);
    {
      const [L1, L2] = armLen[i];
      const S = worldPos(a.up);
      const toT = target.clone().sub(S);
      const d = Math.min(toT.length(), (L1 + L2) * 0.995);
      const dir = toT.normalize();
      const cosA = Math.min(1, Math.max(-1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)));
      const pole = new Vector3(ELBOW_OUT * side, -0.9, -0.35);
      const perp = pole.sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
      const E = S.clone().addScaledVector(dir, Math.cos(Math.acos(cosA)) * L1).addScaledVector(perp, Math.sin(Math.acos(cosA)) * L1);
      aim(a.up, a.fore, E.clone().sub(S));
      aim(a.fore, a.hand, S.clone().addScaledVector(dir, d).sub(worldPos(a.fore)));

      // кисть: пальцы вперёд и чуть вниз к клавишам, ладонью вниз
      const [thumb, index, middle, , pinky] = a.fingers;
      const own = p.handAim?.[side > 0 ? 0 : 1] ?? null;
      // направление кисти: по предплечью в плане, с лёгким отклонением к мизинцу
      const dev = p.keys?.turn?.[side > 0 ? 0 : 1] ?? HAND_DEV;
      const fore = worldPos(a.hand).sub(worldPos(a.fore));
      const yaw = Math.atan2(fore.x, fore.z) + dev * side;
      const handDir = own ? own.fingers : new Vector3(Math.sin(yaw), -(p.handPitch ?? HAND_PITCH), Math.cos(yaw));
      const wantBack = own ? own.back : Y;
      // сколько повернуть кисть вокруг её оси, чтобы тыл смотрел куда надо
      const rollNeeded = () => {
        const along = worldPos(middle[0]).sub(worldPos(a.hand)).normalize();
        const across = worldPos(index[0]).sub(worldPos(pinky[0])).normalize();
        // тыльная сторона кисти: у левой руки cross(across, along), у правой — наоборот
        const back = new Vector3().crossVectors(across, along).multiplyScalar(side);
        const up = wantBack.clone().sub(along.clone().multiplyScalar(along.dot(wantBack))).normalize();
        const backP = back.sub(along.clone().multiplyScalar(along.dot(back))).normalize();
        return {along, roll: Math.atan2(new Vector3().crossVectors(backP, up).dot(along), backP.dot(up))};
      };
      aim(a.hand, middle[0], handDir);
      // ⚠️ Поворот ладони делит предплечье: костей скручивания у модели нет, и весь
      // поворот на одной кисти пережимал запястье «фантиком» (автор: «что-то не так
      // с предплечьем»). Предплечье берёт PRONATE, кисть — остаток.
      const r0 = rollNeeded();
      rotateWorld(a.fore, new Quaternion().setFromAxisAngle(fore.clone().normalize(), r0.roll * PRONATE));
      aim(a.hand, middle[0], handDir);
      const r1 = rollNeeded();
      rotateWorld(a.hand, new Quaternion().setFromAxisAngle(r1.along, r1.roll));
      const along = r1.along;
      // пальцы согнуты над клавишами; ось сгиба — поперёк кисти
      const bendAxis = worldPos(index[0]).sub(worldPos(pinky[0])).normalize().multiplyScalar(-side);
      a.fingers.forEach((chain, f) => {
        if (f === 0) return;
        const tap = p.taps?.[side > 0 ? 0 : 1]?.[f] ?? 0;
        // радиус обхвата — у каждого пальца свой: стакан сужается книзу, и общий
        // радиус вдавливал верхний палец в стенку (автор)
        const R = Array.isArray(own?.wrap) ? own!.wrap[f - 1] : own?.wrap;
        const c = R ? wrapCurl(chain, R) : CURL[f].map(v => v * (Array.isArray(p.curl) ? p.curl[f - 1] : p.curl ?? 1));
        chain.forEach((seg, j) => rotateWorld(seg, new Quaternion().setFromAxisAngle(bendAxis, (c[j] + (j === 0 ? tap * TAP : tap * 6)) * D2R)));
      });
      // пальцы по клавишам: раздвинуть так, чтобы от указательного до мизинца было
      // ровно spread. ⚠️ Без этого руки на компактной клавиатуре сжимались к G/H.
      const spread = Array.isArray(p.keys?.spread) ? p.keys!.spread[side > 0 ? 0 : 1] : p.keys?.spread;
      if (spread && !own) {
        const tipOf = (chain: Bone[]) => {
          const [, mid, end] = chain.map(b => worldPos(b));
          return end.clone().addScaledVector(end.clone().sub(mid), DISTAL);
        };
        const backNow = new Vector3().crossVectors(worldPos(index[0]).sub(worldPos(pinky[0])).normalize(), along).multiplyScalar(side).normalize();
        const toPinky = worldPos(pinky[0]).sub(worldPos(index[0])).normalize();
        // поворот вокруг тыла на +φ сдвигает кончик к cross(тыл, пальцы); куда это — к мизинцу или к указательному
        const sgn = Math.sign(new Vector3().crossVectors(backNow, along).dot(toPinky)) || 1;
        for (let it = 0; it < 2; it++) {
          const gap = tipOf(pinky).sub(tipOf(index)).dot(toPinky);
          const k = (spread - gap) / SPREAD_LEVER;
          a.fingers.forEach((chain, f) => {
            if (f === 0) return;
            rotateWorld(chain[0], new Quaternion().setFromAxisAngle(backNow, SPLAY[f] * k * sgn));
          });
        }
      }
      // большой палец — к указательному, под ладонь
      thumb.forEach((seg, j) => rotateWorld(seg, new Quaternion().setFromAxisAngle(bendAxis, (own?.wrap ? [16, 26, 18] : p.thumb ?? [8, 14, 10])[j] * D2R)));
    }
  }

  /** Сгиб суставов (°), чтобы фаланги легли по окружности радиуса R + полпальца.
   *  Ломаная, вписанная в окружность: звено длины L стягивает дугу θ = 2·asin(L/2ρ),
   *  поворот в суставе — полусумма дуг соседних звеньев; ладонь касается стакана,
   *  поэтому в основании — половина дуги первого звена. */
  function wrapCurl(chain: Bone[], R: number): [number, number, number] {
    const rho = R + FINGER_HALF;
    const L1 = worldPos(chain[0]).distanceTo(worldPos(chain[1]));
    const L2 = worldPos(chain[1]).distanceTo(worldPos(chain[2]));
    const L3 = L2 * DISTAL;
    const th = (L: number) => 2 * Math.asin(Math.min(0.99, L / (2 * rho)));
    const [a, b, c] = [th(L1), th(L2), th(L3)];
    return [a / 2 / D2R, (a + b) / 2 / D2R, (b + c) / 2 / D2R];
  }

  const lastHead = new Quaternion();
  const headFrame = () => new Matrix4().compose(eyesMid(), lastHead.clone(), new Vector3(1, 1, 1));
  const handFrame = (hand: 0 | 1) => {
    // левая рука человека — на +X мира (он смотрит в +Z)
    const a = arms.find(x => (Math.sign(worldPos(x.up).x) > 0) === (hand === 0))!;
    const w = worldPos(a.hand);
    const along = worldPos(a.fingers[2][0]).sub(w).normalize();
    const side = hand === 0 ? 1 : -1;
    const across0 = worldPos(a.fingers[1][0]).sub(worldPos(a.fingers[4][0])).normalize();
    // тыльная сторона — так же, как при позировании кисти
    const back = new Vector3().crossVectors(across0, along).multiplyScalar(side).normalize();
    const across = new Vector3().crossVectors(back, along).normalize();
    return new Matrix4().makeBasis(across, back, along).setPosition(w);
  };
  const armPoints = (hand: 0 | 1): [Vector3, Vector3, Vector3] => {
    const a = arms.find(x => (Math.sign(worldPos(x.up).x) > 0) === (hand === 0))!;
    return [worldPos(a.up), worldPos(a.fore), worldPos(a.hand)];
  };
  const fingerBases = (hand: 0 | 1) => {
    const a = arms.find(x => (Math.sign(worldPos(x.up).x) > 0) === (hand === 0))!;
    return [1, 2, 3, 4].map(f => worldPos(a.fingers[f][0]));
  };
  return {root, setPose, headFrame, handFrame, armPoints, fingerBases, skin: body};
}
