import {
  AdditiveBlending,
  CanvasTexture,
  CatmullRomCurve3,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import type {Person} from './rocketboxPerson';

// ── Вещи на людях: очки, наушники, стаканчик кофе ────────────────────────────
// Всё строится в кадре головы/кисти из rocketboxPerson (headFrame/handFrame):
// голова — начало в середине глаз, вперёд +Z, вверх +Y, его левая рука +X.
// Каждый кадр вещь просто получает матрицу кадра — сама ничего не считает.
// ⚠️ Очки сажаются по ЗАМЕРУ лица (headPoints → fitGlasses), а не по числам на
// глаз: с угаданной глубиной нижние углы оправы уходили в нос (правка автора).

/** Поставить вещь в кадр: matrix = frame · local. */
export function attach(o: Object3D, frame: Matrix4): void {
  o.matrixAutoUpdate = false;
  o.matrix.copy(frame);
  o.matrixWorldNeedsUpdate = true;
}

// ── Замер лица ───────────────────────────────────────────────────────────────
/** Вершины кожи головы в кадре головы (после setPose): по ним садятся очки. */
export function headPoints(person: Person): Vector3[] {
  const skin = person.skin;
  skin.updateMatrixWorld(true);
  skin.skeleton.update();
  const inv = person.headFrame().invert();
  const mats = (Array.isArray(skin.material) ? skin.material : [skin.material]) as Material[];
  const geo = skin.geometry;
  const idx = geo.index;
  const seen = new Uint8Array(geo.getAttribute('position').count);
  const v = new Vector3();
  const out: Vector3[] = [];
  for (const g of geo.groups) {
    if (mats[g.materialIndex ?? 0]?.name !== 'head') continue;
    for (let i = g.start; i < g.start + g.count; i++) {
      const vi = idx ? idx.getX(i) : i;
      if (seen[vi]) continue;
      seen[vi] = 1;
      skin.getVertexPosition(vi, v);
      out.push(v.clone().applyMatrix4(skin.matrixWorld).applyMatrix4(inv));
    }
  }
  return out;
}

export interface GlassesFit {
  /** Центры стёкол ±LX, высота LY, плоскость стёкол LZ (кадр головы, м). */
  LX: number; LY: number; LZ: number;
  W: number; H: number;
  /** Перемычка: высота и глубина над спинкой носа. */
  bridgeY: number; bridgeZ: number;
  /** Дужки: точки вдоль виска к уху (x — по правой стороне головы, без знака). */
  temple: Vector3[];
}

const LENS_W = 0.048, LENS_H = 0.033, LENS_R = 0.011;
const BRIDGE = 0.021;              // ширина перемычки: между внутренними краями стёкол
const RIM = 0.0019;                // полутолщина ободка
const LASH = 0.0055;               // ресницы и воздух между глазом и стеклом

/** Контур стекла (в плоскости стекла, от его центра). */
function lensShape(): Shape {
  const w = LENS_W, h = LENS_H, r = LENS_R;
  const s = new Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}

/**
 * Посадка по замеру: стекло на LASH перед веками и скулами, ободок нигде не
 * заходит в кожу (проверка по всему контуру, с носом), перемычка лежит на
 * спинке носа, дужки идут вдоль висков на ширине головы.
 */
export function fitGlasses(pts: Vector3[]): GlassesFit {
  const W = LENS_W, H = LENS_H;
  const LX = BRIDGE / 2 + W / 2;
  const LY = -0.002;                                   // зрачок чуть выше центра стекла
  // самая выступающая кожа в круге радиуса rad вокруг (x, y) — по обеим сторонам
  const skinZ = (x: number, y: number, rad: number) => {
    let m = -Infinity;
    for (const v of pts) if ((Math.abs(v.x) - x) ** 2 + (v.y - y) ** 2 < rad * rad) m = Math.max(m, v.z);
    return m;
  };
  // стекло: перед всем, что под его площадью, кроме носа (нос держит перемычка)
  let front = -Infinity;
  for (const v of pts) {
    const ax = Math.abs(v.x);
    if (ax < BRIDGE / 2 + 0.002) continue;
    if (Math.abs(ax - LX) < W / 2 - 0.002 && Math.abs(v.y - LY) < H / 2 - 0.002) front = Math.max(front, v.z);
  }
  let LZ = front + LASH;
  // ободок: по всему контуру, с носом — если где-то кожа выше, стекло выходит вперёд
  for (const p of lensShape().getSpacedPoints(96)) LZ = Math.max(LZ, skinZ(LX + p.x, LY + p.y, RIM + 0.0015) + RIM + 0.0012);
  const bridgeY = LY + H / 2 - 0.007;
  const bridgeZ = Math.max(LZ, skinZ(0, bridgeY, 0.004) + RIM + 0.0015);
  // ширина головы на уровне дужки: самая дальняя от середины кожа на глубине z
  const halfWidth = (z: number, y: number) => {
    let m = 0;
    for (const v of pts) if (Math.abs(v.z - z) < 0.007 && Math.abs(v.y - y) < 0.01) m = Math.max(m, Math.abs(v.x));
    return m;
  };
  const ty = LY + H / 2 - 0.007;
  const temple = [
    new Vector3(LX + W / 2 + 0.002, ty, LZ - 0.002),
    new Vector3(Math.max(LX + W / 2 + 0.004, halfWidth(LZ - 0.022, ty) + 0.004), ty, LZ - 0.022),
    new Vector3(halfWidth(-0.03, ty) + 0.004, ty - 0.002, -0.03),
    new Vector3(halfWidth(-0.07, ty - 0.004) + 0.004, ty - 0.006, -0.07),
    new Vector3(halfWidth(-0.09, ty - 0.018) + 0.003, ty - 0.02, -0.09),
  ];
  return {LX, LY, LZ, W, H, bridgeY, bridgeZ, temple};
}

/** Мягкое отражение монитора: экран целиком, зеркально, размыт, края гаснут. */
export function softReflection(src: HTMLCanvasElement | HTMLImageElement): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 160;
  drawSoftReflection(c, src);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Перерисовать отражение (экран сменился): после — texture.needsUpdate. */
export function drawSoftReflection(c: HTMLCanvasElement, src: HTMLCanvasElement | HTMLImageElement): void {
  const g = c.getContext('2d')!;
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  g.save();
  g.filter = 'blur(2.2px)';
  g.translate(c.width, 0);
  g.scale(-1, 1);                                   // отражение — зеркально
  g.drawImage(src, 18, 22, c.width - 36, c.height - 44);
  g.restore();
  // к краям стекла отражение гаснет: множим на радиальную маску
  const mask = g.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.25, c.width / 2, c.height / 2, c.width * 0.62);
  mask.addColorStop(0, 'rgba(0,0,0,0)');
  mask.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = mask; g.fillRect(0, 0, c.width, c.height);
}

export interface GlassesOptions {
  fit: GlassesFit;
  /** Отражение в стёклах (softReflection). */
  reflect?: CanvasTexture;
  /** Сила отражения 0..1. */
  reflectK?: number;
}

/** Очки в тонкой матовой оправе по замеру лица. ⚠️ Без глянца: блик по всему
 *  контуру ободка читался обводкой. */
export function glasses(o: GlassesOptions): Group {
  const {LX, LY, LZ, W, H, bridgeY, bridgeZ, temple} = o.fit;
  const g = new Group();
  const frame = new MeshStandardMaterial({color: '#111113', roughness: 0.42, metalness: 0.0});
  for (const side of [-1, 1]) {
    const pts = lensShape().getSpacedPoints(80).map(p => new Vector3(p.x + side * LX, p.y + LY, LZ));
    g.add(new Mesh(new TubeGeometry(new CatmullRomCurve3(pts, true), 120, RIM, 8, true), frame));
    if (o.reflect) {
      // каждое стекло показывает весь экран уменьшенным — выпуклое зеркало
      const geo = new ShapeGeometry(lensShape(), 12);
      const pos = geo.getAttribute('position');
      const uv: number[] = [];
      for (let i = 0; i < pos.count; i++) uv.push(0.5 + pos.getX(i) / W, 0.5 + pos.getY(i) / H);
      geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
      const lens = new Mesh(geo, new MeshBasicMaterial({
        map: o.reflect, transparent: true, opacity: o.reflectK ?? 0.16, blending: AdditiveBlending, depthWrite: false, side: DoubleSide,
      }));
      lens.position.set(side * LX, LY, LZ);
      lens.renderOrder = 3;
      g.add(lens);
    }
    g.add(new Mesh(new TubeGeometry(new CatmullRomCurve3(temple.map(t => new Vector3(side * t.x, t.y, t.z))), 48, RIM * 0.8, 6, false), frame));
  }
  // перемычка: от внутренних верхних краёв стёкол над спинкой носа
  const inner = LX - W / 2 + 0.003;
  g.add(new Mesh(new TubeGeometry(new CatmullRomCurve3([
    new Vector3(-inner, bridgeY, LZ), new Vector3(0, bridgeY + 0.002, bridgeZ), new Vector3(inner, bridgeY, LZ),
  ]), 20, RIM * 0.9, 6, false), frame));
  return g;
}

// ── Наушники ─────────────────────────────────────────────────────────────────
export interface HeadphonesOptions {
  /** Половина ширины головы у ушей, м. */
  halfWidth?: number;
  /** Высота дуги над глазами, м. */
  top?: number;
  /** Глубина ушей за глазами, м (отрицательная — назад). */
  earZ?: number;
}

/** Накладные наушники: матовая дуга, чашки с мягкими амбушюрами. */
export function headphones(o: HeadphonesOptions = {}): Group {
  const g = new Group();
  const HW = o.halfWidth ?? 0.082, TOP = o.top ?? 0.128, EZ = o.earZ ?? -0.078, EY = -0.028;
  const plastic = new MeshStandardMaterial({color: '#1b1c1f', roughness: 0.55, metalness: 0.1});
  const cushion = new MeshStandardMaterial({color: '#232326', roughness: 0.85});
  const metal = new MeshStandardMaterial({color: '#8c8f95', roughness: 0.3, metalness: 0.9});
  // дуга: полуэллипс над головой, с запасом на волосы
  const arc: Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI * (i / 24);
    arc.push(new Vector3(-Math.cos(a) * (HW + 0.02), EY + 0.03 + Math.sin(a) * (TOP - EY - 0.03), EZ + 0.005));
  }
  g.add(new Mesh(new TubeGeometry(new CatmullRomCurve3(arc), 64, 0.0065, 10, false), plastic));
  for (const side of [-1, 1]) {
    // вилка чашки — металл
    const yoke = new Mesh(new CylinderGeometry(0.003, 0.003, 0.05, 8), metal);
    yoke.position.set(side * (HW + 0.02), EY + 0.03, EZ);
    g.add(yoke);
    // чашка: ось — поперёк головы
    const cup = new Mesh(new CylinderGeometry(0.044, 0.046, 0.026, 40), plastic);
    cup.rotation.z = Math.PI / 2;
    cup.position.set(side * (HW + 0.018), EY, EZ);
    g.add(cup);
    const pad = new Mesh(new TorusGeometry(0.036, 0.011, 12, 40), cushion);
    pad.rotation.y = Math.PI / 2;
    pad.position.set(side * (HW + 0.004), EY, EZ);
    g.add(pad);
  }
  return g;
}

// ── Кофе с собой ─────────────────────────────────────────────────────────────
/** Размеры бумажного стаканчика: высота, радиус дна и верха. */
export const CUP = {H: 0.128, R0: 0.029, R1: 0.042, SLEEVE: [0.028, 0.088] as [number, number]};
/** Радиус стаканчика на высоте y от дна (с гильзой, если она там). */
export function cupRadius(y: number): number {
  const r = CUP.R0 + ((CUP.R1 - CUP.R0) * y) / CUP.H;
  return y > CUP.SLEEVE[0] && y < CUP.SLEEVE[1] ? r + 0.0018 : r;
}

/** Бумажный стаканчик: крафт, гильза, чёрная крышка. Начало — центр дна, ось +Y. */
export function takeawayCup(): Group {
  const g = new Group();
  const {H, R0, R1, SLEEVE} = CUP;
  const r = (y: number) => R0 + ((R1 - R0) * y) / H;
  const kraft = new MeshStandardMaterial({color: '#b98c5a', roughness: 0.88});
  const sleeve = new MeshStandardMaterial({color: '#8d6a44', roughness: 0.95});
  const lid = new MeshPhysicalMaterial({color: '#151517', roughness: 0.38, clearcoat: 0.3, clearcoatRoughness: 0.4});
  g.add(new Mesh(new LatheGeometry([
    new Vector2(0, 0.002), new Vector2(R0 - 0.002, 0), new Vector2(R0, 0.004), new Vector2(r(H), H),
  ], 48), kraft));
  g.add(new Mesh(new LatheGeometry([
    new Vector2(r(SLEEVE[0]) + 0.0002, SLEEVE[0]), new Vector2(r(SLEEVE[0]) + 0.0018, SLEEVE[0] + 0.002),
    new Vector2(r(SLEEVE[1]) + 0.0018, SLEEVE[1] - 0.002), new Vector2(r(SLEEVE[1]) + 0.0002, SLEEVE[1]),
  ], 48), sleeve));
  // крышка: борт шире стакана, над ним низкий купол
  g.add(new Mesh(new LatheGeometry([
    new Vector2(R1 - 0.002, H - 0.008), new Vector2(R1 + 0.0025, H - 0.006), new Vector2(R1 + 0.0028, H + 0.004),
    new Vector2(R1 - 0.004, H + 0.006), new Vector2(R1 - 0.008, H + 0.015), new Vector2(0, H + 0.016),
  ], 48), lid));
  // носик для питья на куполе
  const spout = new Mesh(new CylinderGeometry(0.009, 0.011, 0.005, 24), lid);
  spout.position.set(0, H + 0.018, R1 - 0.016);
  g.add(spout);
  return g;
}

/** Керамическая кружка с ручкой; начало — центр дна, ось — +Y. */
export function mug(color = '#e9e4da'): Group {
  const g = new Group();
  const R = 0.041, H = 0.095;
  const body = new Mesh(new LatheGeometry([
    new Vector2(0, 0), new Vector2(R - 0.004, 0), new Vector2(R, 0.005), new Vector2(R, H), new Vector2(R - 0.004, H),
    new Vector2(R - 0.004, 0.008), new Vector2(0, 0.008),
  ], 48), new MeshPhysicalMaterial({color, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.15}));
  g.add(body);
  const coffee = new Mesh(new CylinderGeometry(R - 0.005, R - 0.005, 0.002, 40), new MeshStandardMaterial({color: '#2a1a10', roughness: 0.15}));
  coffee.position.y = H - 0.018;
  g.add(coffee);
  const handle = new Mesh(new TorusGeometry(0.026, 0.0065, 12, 28, Math.PI), body.material);
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(R, H * 0.5, 0);
  g.add(handle);
  return g;
}
