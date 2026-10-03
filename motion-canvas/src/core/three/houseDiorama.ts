import {
  Box3, BoxGeometry, BufferGeometry, LinearMipmapLinearFilter, CanvasTexture, Color, CylinderGeometry, DataTexture, DataUtils, DirectionalLight, DoubleSide,
  EquirectangularReflectionMapping, ExtrudeGeometry, Float32BufferAttribute, Group, HemisphereLight,
  IcosahedronGeometry, InstancedMesh, LinearFilter, RectAreaLight, Material, Matrix4, Mesh, MeshPhysicalMaterial, MeshStandardMaterial,
  NearestFilter, NeutralToneMapping, Object3D, Path, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Quaternion,
  RepeatWrapping, RGBAFormat, Scene, ShadowMaterial, Shape, ShapeGeometry, SphereGeometry, SRGBColorSpace, Texture,
  TextureLoader, UnsignedByteType, Vector2, Vector3, PCFShadowMap, WebGLRenderer,
} from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries, mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {HDRLoader} from 'three/examples/jsm/loaders/HDRLoader.js';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/examples/jsm/postprocessing/GTAOPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {HorizontalTiltShiftShader} from 'three/examples/jsm/shaders/HorizontalTiltShiftShader.js';
import {VerticalTiltShiftShader} from 'three/examples/jsm/shaders/VerticalTiltShiftShader.js';

// ── Дом-диорама для «Good Code, But I Hate It» (главы 1–2) ──────────────────
// Автор: «мне очень нравится такой дизайн модели дома» (референс — стоковый рендер
// загородного дома на подставке, Downloads/house.jpg; сам рендер брать нельзя, стиль
// повторяем). Первый пробный кадр — «качество сильно хуже исходника: вкусные деревья,
// покрытие крыши, стекла, трава, стены, да всё». Теперь:
// - кромки скруглены везде (острые углы — главный признак «компьютерной» картинки);
// - стены, дерево, бетон, кора, земля — PBR-текстуры Poly Haven (CC0) с рельефом и
//   шероховатостью, public/goodcode/house; цоколь по низу стен;
// - черепица — отдельные плитки рядами с нахлёстом (свет и тень на каждом ряду), конёк
//   полукруглыми плитками, водостоки;
// - стёкла пропускают свет (transmission) и отражают небо; за ними — глубина комнаты и
//   шторы;
// - кроны, изгородь и кусты — тысячи листовых веточек (у каждой нормаль кроны: мягкая
//   светотень объёма), внутри темнее; под листвой — тёмное ядро, чтобы не просвечивало;
// - газон — ворс из слоёв (shell): каждая травинка сужается кверху, у корней темно, кромки
//   у дорожек мягкие (маска);
// - свет — небо HDRI (Poly Haven, CC0), солнце совмещено с солнцем на небе; затенение в
//   углах (GTAO); лёгкий тилт-шифт по краям кадра — «макет».
// Цвета — спокойнее референса (тёплый белый, коричневая крыша, сероватая зелень).
// Единицы — метры. Раскладка строится с фасадом в −z и воротами в +x, потом дом отражается
// (ворота справа, как у референса).

const T = 0.22;                       // толщина стен
const BV = 0.022;                     // скругление кромок стен

// ── Общее ────────────────────────────────────────────────────────────────────
function rand(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = SRGBColorSpace;
  return t;
}

/** Гладкий шум 3D (решётка + плавная интерполяция), 0…1. */
function noise3(seed: number) {
  const h = (x: number, y: number, z: number) => {
    let n = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144269) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const f = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number, z: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = f(x - xi), yf = f(y - yi), zf = f(z - zi);
    let v = 0;
    for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) {
      v += h(xi + dx, yi + dy, zi + dz) * (dx ? xf : 1 - xf) * (dy ? yf : 1 - yf) * (dz ? zf : 1 - zf);
    }
    return v;
  };
}

/** UV граней коробки — в метрах (проекция по оси нормали): текстура одного масштаба везде. */
function metricUV(geo: BufferGeometry) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    const [u, v] = ay >= ax && ay >= az ? [pos.getX(i), pos.getZ(i)] : ax >= az ? [pos.getZ(i), pos.getY(i)] : [pos.getX(i), pos.getY(i)];
    uv.setXY(i, u, v);
  }
}

function shadowed<T extends Object3D>(o: T, cast = true): T {
  o.traverse(m => { if ((m as Mesh).isMesh) { m.castShadow = cast; m.receiveShadow = true; } });
  return o;
}

/** Коробка со скруглёнными кромками; UV в метрах. */
function rbox(w: number, h: number, d: number, mat: Material | Material[], x = 0, y = 0, z = 0, r = 0.02): Mesh {
  const geo = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2));
  metricUV(geo);
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  return shadowed(m);
}

// ── Ассеты (Poly Haven, CC0) ────────────────────────────────────────────────
interface Pbr {map: Texture; normalMap: Texture; roughnessMap: Texture}

async function loadPbr(base: string, name: string): Promise<Pbr> {
  const L = new TextureLoader();
  const [map, normalMap, roughnessMap] = await Promise.all(['diffuse', 'nor_gl', 'rough'].map(k => L.loadAsync(`${base}/${name}_${k}.jpg`)));
  map.colorSpace = SRGBColorSpace;
  for (const t of [map, normalMap, roughnessMap]) { t.wrapS = t.wrapT = RepeatWrapping; t.anisotropy = 8; }
  return {map, normalMap, roughnessMap};
}

/** Тот же набор с повтором «метров на плитку текстуры» (UV у геометрий — в метрах). */
function tiled(p: Pbr, metres: number, rot = 0): Pbr {
  const c = (t: Texture) => {
    const k = t.clone();
    k.repeat.set(1 / metres, 1 / metres);
    k.rotation = rot;
    k.needsUpdate = true;
    return k;
  };
  return {map: c(p.map), normalMap: c(p.normalMap), roughnessMap: c(p.roughnessMap)};
}

interface Assets {stucco: Pbr; wood: Pbr; bark: Pbr; concrete: Pbr; mud: Pbr; sky: DataTexture}

async function loadAssets(base: string): Promise<Assets> {
  const [stucco, wood, bark, concrete, mud, sky] = await Promise.all([
    loadPbr(base, 'white_stucco'), loadPbr(base, 'fine_grained_wood'), loadPbr(base, 'bark_brown_02'),
    loadPbr(base, 'concrete_floor_02'), loadPbr(base, 'brown_mud_02'),
    new HDRLoader().loadAsync(`${base}/sky_2k.hdr`) as Promise<DataTexture>,
  ]);
  sky.mapping = EquirectangularReflectionMapping;
  return {stucco, wood, bark, concrete, mud, sky};
}

/** Направление на солнце на небе HDRI (самый яркий тексель), в осях three.js. */
function skySun(sky: DataTexture): Vector3 {
  const {width: W, height: H, data} = sky.image as {width: number; height: number; data: Uint16Array | Float32Array};
  const half = data instanceof Uint16Array;
  let best = -1, bi = 0;
  for (let i = 0; i < W * H; i++) {
    const r = half ? DataUtils.fromHalfFloat(data[i * 4]) : data[i * 4];
    const g = half ? DataUtils.fromHalfFloat(data[i * 4 + 1]) : data[i * 4 + 1];
    const l = r + g;
    if (l > best) { best = l; bi = i; }
  }
  const row = Math.floor(bi / W), col = bi % W;
  // equirect three.js: u = atan(z, x)/2π + 0.5, v = asin(y)/π + 0.5; строки .hdr — сверху вниз
  const u = (col + 0.5) / W, v = sky.flipY ? 1 - (row + 0.5) / H : (row + 0.5) / H;
  const lat = (v - 0.5) * Math.PI, lon = (u - 0.5) * 2 * Math.PI;
  return new Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
}

// ── Материалы ────────────────────────────────────────────────────────────────
interface Mats {
  plaster: Material; frame: Material; fascia: Material; door: Material; roofTile: Material; ridge: Material;
  concrete: Material; curb: Material; base: Material; bark: Material; soil: Material; paver: Material;
  glass: Material; interior: Material; curtain: Material; metal: Material; dark: Material; garage: Material;
  panel: Material; lampGlow: Material; leaf: Material; core: Material; lawnBase: Material; accent: Material; cavity: Material;
}

/** Веточка с листьями (белая — цвет даёт вершина): 6 листиков вокруг черешка. */
function twigTex() {
  return canvasTex(256, 256, g => {
    g.clearRect(0, 0, 256, 256);
    const leaf = (x: number, y: number, a: number, s: number) => {
      g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
      g.beginPath(); g.moveTo(0, 0);
      g.bezierCurveTo(26, -14, 30, -54, 0, -84);
      g.bezierCurveTo(-30, -54, -26, -14, 0, 0);
      g.fillStyle = '#ffffff'; g.fill();
      g.strokeStyle = 'rgba(150,150,150,0.55)'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(0, -4); g.lineTo(0, -76); g.stroke();
      g.restore();
    };
    g.strokeStyle = '#bbbbbb'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(128, 250); g.quadraticCurveTo(122, 160, 132, 60); g.stroke();
    leaf(130, 70, 0.1, 0.95);
    leaf(128, 120, -0.9, 0.85); leaf(130, 116, 0.95, 0.85);
    leaf(126, 170, -1.1, 0.8); leaf(128, 166, 1.15, 0.8);
    leaf(126, 215, -0.8, 0.7);
  });
}

/** Солнечная панель: ячейки в тонкой сетке. */
function panelTex() {
  return canvasTex(256, 384, g => {
    g.fillStyle = '#182230'; g.fillRect(0, 0, 256, 384);
    g.strokeStyle = 'rgba(170,185,200,0.45)'; g.lineWidth = 2;
    for (let x = 0; x <= 256; x += 42.6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 384); g.stroke(); }
    for (let y = 0; y <= 384; y += 42.6) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  });
}

/** Внутренняя стена комнаты за окном: светлее кверху (свет из окна). */
function interiorTex() {
  return canvasTex(8, 128, g => {
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#d9d0c3'); gr.addColorStop(0.7, '#b7ab9b'); gr.addColorStop(1, '#8f8475');
    g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
  });
}

function makeMats(a: Assets): Mats {
  const nrm = (k: number) => new Vector2(k, k);
  const pbr = (p: Pbr, color: string, extra: Partial<MeshStandardMaterial> = {}) =>
    new MeshStandardMaterial({...p, color: new Color(color), roughness: 1, metalness: 0, normalScale: nrm(0.8), ...extra});
  const std = (color: string, roughness: number, extra: Partial<MeshStandardMaterial> = {}) =>
    new MeshStandardMaterial({color: new Color(color), roughness, metalness: 0, ...extra});
  const woodTile = a.wood;                                 // плитка черепицы: вся текстура на плитку (UV 0…1)
  return {
    plaster: pbr(tiled(a.stucco, 1.8), '#edf0ee', {normalScale: nrm(0.5)}),
    frame: pbr(tiled(a.wood, 0.9), '#8a6a56'),
    fascia: pbr(tiled(a.wood, 1.2), '#7a5c49'),
    door: pbr(tiled(a.wood, 1.0, Math.PI / 2), '#c4946e'),
    roofTile: new MeshStandardMaterial({...woodTile, color: new Color('#a58468'), roughness: 1, metalness: 0, normalScale: nrm(1.2)}),
    ridge: pbr(tiled(a.wood, 0.6), '#6e5341'),
    concrete: std('#dcdad5', 0.85, {normalMap: tiled(a.concrete, 1.6).normalMap, normalScale: nrm(0.5), roughnessMap: tiled(a.concrete, 1.6).roughnessMap}),
    curb: std('#e9e9e7', 0.55),
    base: std('#c9cbce', 0.5),
    bark: pbr(tiled(a.bark, 0.7), '#b9a796'),
    soil: pbr(tiled(a.mud, 0.9), '#a08b78'),
    paver: std('#d6d3cc', 0.85, {normalMap: tiled(a.concrete, 1.2).normalMap, normalScale: nrm(0.6), roughnessMap: tiled(a.concrete, 1.2).roughnessMap}),
    glass: new MeshPhysicalMaterial({color: new Color('#eef3f5'), metalness: 0, roughness: 0.02, transmission: 1, thickness: 0.02, ior: 1.5, envMapIntensity: 1.2}),
    interior: new MeshStandardMaterial({map: interiorTex(), color: new Color('#8a8580'), roughness: 1, metalness: 0, envMapIntensity: 0.22}),
    curtain: std('#e6dfd2', 0.95, {side: DoubleSide, envMapIntensity: 0.4}),
    metal: std('#8a8f95', 0.36, {metalness: 0.55}),
    dark: std('#2c2f33', 0.45, {metalness: 0.4}),
    garage: std('#eeece8', 0.42),
    panel: new MeshPhysicalMaterial({map: panelTex(), color: new Color('#ffffff'), roughness: 0.16, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06}),
    lampGlow: new MeshStandardMaterial({color: new Color('#f4ecdc'), emissive: new Color('#ffe8c2'), emissiveIntensity: 0.5, roughness: 0.4}),
    leaf: new MeshStandardMaterial({map: twigTex(), alphaTest: 0.5, side: DoubleSide, vertexColors: true, roughness: 0.62, metalness: 0}),
    core: std('#33402a', 1),
    lawnBase: std('#4c5a35', 1),
    accent: std('#d98a9c', 0.5),                           // акцент канала (#E886A0) под светом
    cavity: std('#26231f', 1),
  };
}

// ── Стены, окна, двери ───────────────────────────────────────────────────────
interface Hole {x: number; y: number; w: number; h: number; kind?: 'window' | 'door' | 'garage'}

/**
 * Стена — плита с проёмами, кромки скруглены: w по низу, h до карниза, сверху щипец
 * высотой gable. Локально: x вдоль стены, y вверх, наружная грань — z = 0, внутренняя — T.
 */
function wall(w: number, h: number, gable: number, holes: Hole[], m: Mats): Mesh {
  // проём от самого низа (ворота) — вырез в контуре: дыра, касающаяся края, не вырезается
  const notches = holes.filter(o => o.y - o.h / 2 <= 1e-3).sort((p, q) => p.x - q.x);
  const s = new Shape();
  s.moveTo(0, 0);
  for (const o of notches) { s.lineTo(o.x - o.w / 2, 0); s.lineTo(o.x - o.w / 2, o.h); s.lineTo(o.x + o.w / 2, o.h); s.lineTo(o.x + o.w / 2, 0); }
  s.lineTo(w, 0); s.lineTo(w, h);
  if (gable > 0) s.lineTo(w / 2, h + gable);
  s.lineTo(0, h); s.lineTo(0, 0);
  for (const o of holes) {
    if (notches.includes(o)) continue;
    const p = new Path();
    p.moveTo(o.x - o.w / 2, o.y - o.h / 2); p.lineTo(o.x + o.w / 2, o.y - o.h / 2);
    p.lineTo(o.x + o.w / 2, o.y + o.h / 2); p.lineTo(o.x - o.w / 2, o.y + o.h / 2); p.lineTo(o.x - o.w / 2, o.y - o.h / 2);
    s.holes.push(p);
  }
  const geo = new ExtrudeGeometry(s, {depth: T - 2 * BV, bevelEnabled: true, bevelThickness: BV, bevelSize: BV, bevelOffset: -BV, bevelSegments: 3, curveSegments: 1});
  geo.translate(0, 0, BV);
  const mesh = shadowed(new Mesh(geo, m.plaster));
  for (const o of holes) {
    const u = o.kind === 'door' ? door(o, m) : o.kind === 'garage' ? garageDoor(o, m) : windowUnit(o, m);
    u.userData.opening = o.kind ?? 'window';
    mesh.add(u);
  }
  return mesh;
}

/** Проём — своей группой с центром в середине проёма: в сборке окно «встаёт» из центра. */
function recenter(g: Group, x: number, y: number): Group {
  for (const c of g.children) { c.position.x -= x; c.position.y -= y; }
  g.position.set(x, y, 0);
  return g;
}

/** Штора: полотно со складками. */
function curtain(w: number, h: number, m: Mats, seed: number): Mesh {
  const geo = new PlaneGeometry(w, h, 24, 1);
  const pos = geo.attributes.position, r = rand(seed), ph = r() * 6;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, 0.022 * Math.sin(pos.getX(i) / w * Math.PI * 2 * 3.5 + ph));
  geo.computeVertexNormals();
  return shadowed(new Mesh(geo, m.curtain), false);
}

/** Окно: рама в глубине откоса, импост, стекло, отлив; за стеклом — комната и шторы. */
function windowUnit(o: Hole, m: Mats): Group {
  const g = new Group();
  const F = 0.08, D = 0.1, Z = 0.06 + D / 2;
  g.add(rbox(o.w, F, D, m.frame, o.x, o.y - o.h / 2 + F / 2, Z, 0.012), rbox(o.w, F, D, m.frame, o.x, o.y + o.h / 2 - F / 2, Z, 0.012));
  g.add(rbox(F, o.h, D, m.frame, o.x - o.w / 2 + F / 2, o.y, Z, 0.012), rbox(F, o.h, D, m.frame, o.x + o.w / 2 - F / 2, o.y, Z, 0.012));
  if (o.w > 1.0) g.add(rbox(F * 0.75, o.h - 2 * F, D * 0.8, m.frame, o.x, o.y, Z, 0.01));
  if (o.h > 1.3) g.add(rbox(o.w - 2 * F, F * 0.75, D * 0.8, m.frame, o.x, o.y + o.h * 0.18, Z, 0.01));
  const glass = new Mesh(new PlaneGeometry(o.w - F, o.h - F), m.glass);
  glass.position.set(o.x, o.y, Z + 0.006);
  glass.rotation.y = Math.PI;
  g.add(shadowed(glass, false));
  g.add(rbox(o.w + 0.2, 0.055, 0.2, m.concrete, o.x, o.y - o.h / 2 - 0.028, -0.05, 0.015));     // отлив
  // комната: дальняя стена в 0.6 м и шторы по краям проёма
  const back = new Mesh(new PlaneGeometry(o.w + 1.0, o.h + 1.0), m.interior);
  back.position.set(o.x, o.y + 0.1, T + 0.6);
  back.rotation.y = Math.PI;
  g.add(shadowed(back, false));
  const cw = o.w * 0.26, seed = Math.round(o.x * 100 + o.y * 37);
  for (const s of [-1, 1]) {
    const c = curtain(cw, o.h + 0.12, m, seed + s);
    c.position.set(o.x + s * (o.w / 2 - cw / 2 + 0.04), o.y + 0.02, T + 0.08);
    c.rotation.y = Math.PI;
    g.add(c);
  }
  return recenter(g, o.x, o.y);
}

function door(o: Hole, m: Mats): Group {
  const g = new Group();
  const Z = 0.11;
  g.add(rbox(o.w, o.h, 0.06, m.door, o.x, o.y, Z, 0.012));
  for (const [py, ph] of [[o.y + o.h * 0.2, o.h * 0.38], [o.y - o.h * 0.22, o.h * 0.34]]) {
    const pw = o.w * 0.62;
    g.add(rbox(pw, 0.045, 0.03, m.door, o.x, py + ph / 2, Z - 0.035, 0.01), rbox(pw, 0.045, 0.03, m.door, o.x, py - ph / 2, Z - 0.035, 0.01));
    g.add(rbox(0.045, ph, 0.03, m.door, o.x - pw / 2, py, Z - 0.035, 0.01), rbox(0.045, ph, 0.03, m.door, o.x + pw / 2, py, Z - 0.035, 0.01));
  }
  g.add(rbox(0.035, 0.2, 0.05, m.metal, o.x + o.w * 0.36, o.y - 0.05, Z - 0.06, 0.012));
  const F = 0.09;
  g.add(rbox(F, o.h + F, 0.15, m.frame, o.x - o.w / 2 - F / 2 + 0.01, o.y + F / 2, 0.05, 0.015), rbox(F, o.h + F, 0.15, m.frame, o.x + o.w / 2 + F / 2 - 0.01, o.y + F / 2, 0.05, 0.015));
  g.add(rbox(o.w + 2 * F, F, 0.15, m.frame, o.x, o.y + o.h / 2 + F / 2, 0.05, 0.015));
  return recenter(g, o.x, o.y);
}

/** Секционные ворота: четыре панели с зазорами, в верхней — ряд окошек. */
function garageDoor(o: Hole, m: Mats): Group {
  const g = new Group();
  const n = 4, gap = 0.03, ph = (o.h - gap * (n - 1)) / n, Z = 0.13;
  for (let i = 0; i < n; i++) {
    const y = o.y - o.h / 2 + ph / 2 + i * (ph + gap);
    g.add(rbox(o.w - 0.02, ph, 0.05, m.garage, o.x, y, Z, 0.02));
    if (i === n - 1) for (let k = 0; k < 4; k++) {
      const win = new Mesh(new PlaneGeometry(o.w / 6, ph * 0.48), m.glass);
      win.position.set(o.x - o.w * 0.36 + k * o.w * 0.24, y, Z - 0.026);
      win.rotation.y = Math.PI;
      g.add(shadowed(win, false));
    }
  }
  // модуль ворот — другой: рама акцентным цветом канала (приглушённый розовый), чуть наружу
  const J = 0.07;
  g.add(rbox(J, o.h + J, 0.16, m.accent, o.x - o.w / 2 - J / 2, o.y + J / 2, -0.02, 0.02), rbox(J, o.h + J, 0.16, m.accent, o.x + o.w / 2 + J / 2, o.y + J / 2, -0.02, 0.02));
  g.add(rbox(o.w + 2 * J, J, 0.16, m.accent, o.x, o.y + o.h / 2 + J / 2, -0.02, 0.02));
  return recenter(g, o.x, o.y);
}

// ── Крыша ────────────────────────────────────────────────────────────────────
/** Каскад экземпляров при сборке: плитки ложатся рядами (order — номер ряда), конёк — по длине. */
interface Cascade {mesh: InstancedMesh; base: Matrix4[]; order: number[]; ridge?: boolean}

interface RoofOpts {
  len: number; span: number; rise: number; ohE: number; ohG: number;
  /** Где стоит крыша (у крыла) и поворот вокруг вертикали — до раскладки плиток. */
  at: Vector3; rotY: number;
  /** Плитку не класть (точка — в раскладке дома): спрятана под другой крышей. */
  skip?: (p: Vector3) => boolean;
  seed: number;
}

/**
 * Двускатная крыша: плиты-основания с толщиной (кромки — фасадная доска), по ним —
 * черепица рядами с нахлёстом, конёк полукруглыми плитками, водостоки по карнизам.
 * Локально: конёк вдоль x, скаты к ±z, начало — середина карниза на высоте верха стен.
 */
function gableRoof(o: RoofOpts, m: Mats): Group {
  const g = new Group();
  g.position.copy(o.at);
  g.rotation.y = o.rotY;
  g.updateMatrix();
  const t = 0.18;
  const a = Math.atan2(o.rise, o.span / 2), run = o.span / 2 + o.ohE, S = run / Math.cos(a);
  const Lx = o.len + 2 * o.ohG;
  const r = rand(o.seed);
  const cascade: Cascade[] = [];
  // плитка: ширина, вылет ряда, длина, толщина
  const WT = 0.46, E = 0.27, LT = 0.4, TT = 0.03, GAP = 0.016;
  const tileGeo = new RoundedBoxGeometry(WT - GAP, TT, LT, 2, 0.007);
  const delta = Math.atan2(TT * 0.9, LT);
  const mtx = new Matrix4(), q = new Quaternion(), qa = new Quaternion(), sc = new Vector3(), p = new Vector3(), world = new Vector3();
  const col = new Color();
  for (const sgn of [1, -1]) {
    const slab = rbox(Lx, t, S, m.fascia, 0, 0, 0, 0.03);
    slab.rotation.x = sgn * a;
    const n = new Vector3(0, Math.cos(a), sgn * Math.sin(a));
    slab.position.set(0, o.rise - (run / 2) * Math.tan(a), sgn * run / 2).addScaledVector(n, t / 2);
    g.add(slab);
    slab.updateMatrix();
    // ряды от карниза (u = 0) к коньку; локально у плиты z = sgn·(S/2 − u)
    const mats: Matrix4[] = [], cols: Color[] = [], rows: number[] = [];
    for (let k = 0; ; k++) {
      const u0 = -0.04 + k * E;
      if (u0 + LT > S + 0.02) break;
      const zc = sgn * (S / 2 - (u0 + LT / 2));
      const off = (k % 2) * (WT / 2) + (r() - 0.5) * 0.04;
      for (let xs = -Lx / 2 - off; xs < Lx / 2; xs += WT) {
        const a0 = Math.max(xs, -Lx / 2 + 0.01), a1 = Math.min(xs + WT - GAP, Lx / 2 - 0.01);
        if (a1 - a0 < 0.07) continue;
        const xc = (a0 + a1) / 2;
        p.set(xc, t / 2 + TT * 0.95, zc);
        world.copy(p).applyMatrix4(slab.matrix).applyMatrix4(g.matrix);
        if (o.skip?.(world)) continue;
        q.setFromAxisAngle(new Vector3(1, 0, 0), -sgn * delta);
        qa.setFromAxisAngle(new Vector3(0, 1, 0), (r() - 0.5) * 0.035);
        q.multiply(qa);
        sc.set((a1 - a0) / (WT - GAP), 1, 1 + (r() - 0.5) * 0.06);
        mats.push(new Matrix4().compose(p.clone(), q.clone(), sc.clone()));
        rows.push(k);
        const k2 = 0.84 + r() * 0.26;
        cols.push(col.setRGB(k2 * (0.98 + r() * 0.04), k2 * (0.96 + r() * 0.04), k2 * (0.94 + r() * 0.05)).clone());
      }
    }
    const tiles = new InstancedMesh(tileGeo, m.roofTile, mats.length);
    mats.forEach((mm, i) => { tiles.setMatrixAt(i, mm); tiles.setColorAt(i, cols[i]); });
    tiles.instanceMatrix.needsUpdate = true;
    if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
    shadowed(tiles);
    slab.add(tiles);
    cascade.push({mesh: tiles, base: mats, order: rows});
    // водосток вдоль карниза: полутруба (открыта вверх) под краем ската
    const gut = new Mesh(new CylinderGeometry(0.085, 0.085, Lx, 16, 1, true, Math.PI / 2, Math.PI), m.metal);
    gut.rotation.z = Math.PI / 2;
    const eaveY = -o.ohE * Math.tan(a), eaveZ = sgn * (o.span / 2 + o.ohE);
    gut.position.set(0, eaveY - 0.03, eaveZ + sgn * 0.06);
    g.add(shadowed(gut));
    g.userData[sgn > 0 ? 'eavePlus' : 'eaveMinus'] = new Vector3(0, eaveY - 0.03, eaveZ + sgn * 0.06);
  }
  // конёк: полукруглые плитки
  const RR = 0.17;
  const ridgeGeo = new CylinderGeometry(RR, RR, 0.42, 16, 1, false, 0, Math.PI);
  ridgeGeo.rotateZ(Math.PI / 2);
  ridgeGeo.scale(1, 0.55, 1);
  const ridgeN = Math.ceil(Lx / 0.38);
  const ridge = new InstancedMesh(ridgeGeo, m.ridge, ridgeN);
  for (let i = 0; i < ridgeN; i++) {
    const x = -Lx / 2 + 0.19 + i * ((Lx - 0.38) / Math.max(1, ridgeN - 1));
    // центр — ниже вершины скатов: край полутрубы (±RR) ложится на черепицу
    ridge.setMatrixAt(i, new Matrix4().compose(new Vector3(x, o.rise + t / Math.cos(a) + TT * 1.6 - RR * Math.tan(a), 0), new Quaternion(), new Vector3(1, 1, 1)));
    const k2 = 0.88 + r() * 0.2;
    ridge.setColorAt(i, new Color(k2, k2, k2));
  }
  g.add(shadowed(ridge));
  {
    const base: Matrix4[] = [];
    for (let i = 0; i < ridgeN; i++) { const mm = new Matrix4(); ridge.getMatrixAt(i, mm); base.push(mm); }
    cascade.push({mesh: ridge, base, order: base.map((_, i) => i), ridge: true});
  }
  g.userData.lx = Lx;
  g.userData.cascade = cascade;
  return g;
}

/** Водосточная труба: от водостока (out) коленом к углу стены (wall: x, z) и по нему вниз. */
function downspout(out: Vector3, wall: Vector2, m: Mats): Group {
  const g = new Group();
  const kneeY = out.y - 0.42;
  const pipe = new Mesh(new CylinderGeometry(0.045, 0.045, kneeY - 0.2, 12), m.metal);
  pipe.position.set(wall.x, (kneeY + 0.2) / 2, wall.y);
  g.add(shadowed(pipe));
  const a = new Vector3(wall.x, kneeY, wall.y), b = new Vector3(out.x, out.y - 0.04, out.z);
  const knee = new Mesh(new CylinderGeometry(0.045, 0.045, a.distanceTo(b), 12), m.metal);
  knee.position.copy(a).add(b).multiplyScalar(0.5);
  knee.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize());
  g.add(shadowed(knee));
  g.add(rbox(0.11, 0.12, 0.2, m.metal, wall.x, 0.26, wall.y - 0.04, 0.04));     // отвод у земли
  return g;
}

// ── Листва ──────────────────────────────────────────────────────────────────
interface LeafPt {p: Vector3; n: Vector3; depth: number}

/**
 * Листва из веточек: у каждой квадрат со своим наклоном, нормаль — от кроны (объёмная
 * светотень), цвет — по глубине, высоте и случайно.
 */
function foliage(pts: LeafPt[], size: number, base: Color, m: Mats, seed: number, y0: number, y1: number): Mesh {
  const r = rand(seed), N = pts.length;
  // ⚠️ Цвет вершин — RGBA (4): трассировщик сам дописывает 4-компонентный цвет сеткам без цвета,
  // а при слиянии разной ширины его код копирует задом наперёд — цвета обнуляются (листья,
  // черепица, трава — чёрные), и какая ширина победит, решает случайный порядок сеток.
  const pos = new Float32Array(N * 12), nor = new Float32Array(N * 12), uv = new Float32Array(N * 8), col = new Float32Array(N * 16);
  const idx: number[] = [];
  const t1 = new Vector3(), t2 = new Vector3(), ln = new Vector3(), ax = new Vector3(), bx = new Vector3(), nn = new Vector3();
  const hsl = {h: 0, s: 0, l: 0};
  base.getHSL(hsl);
  pts.forEach(({p, n, depth}, i) => {
    t1.set(r() - 0.5, r() - 0.5, r() - 0.5).cross(n).normalize();
    t2.copy(n).cross(t1);
    ln.copy(n).addScaledVector(t1, (r() - 0.5) * 1.4).addScaledVector(t2, (r() - 0.5) * 1.4).normalize();
    ax.set(r() - 0.5, r() - 0.5, r() - 0.5).cross(ln).normalize();
    bx.copy(ln).cross(ax);
    const s = size * (0.75 + r() * 0.5);
    const c = p.clone().addScaledVector(bx, s * 0.25);
    const corners = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
    nn.copy(n).multiplyScalar(0.8).addScaledVector(ln, 0.2).normalize();
    const hgt = Math.min(1, Math.max(0, (p.y - y0) / (y1 - y0)));
    const light = (0.5 + 0.5 * hgt) * (1 - depth * 0.55) * (0.88 + r() * 0.24);
    const leafCol = new Color().setHSL(hsl.h + (r() - 0.5) * 0.035, hsl.s * (0.9 + r() * 0.25), Math.min(0.85, hsl.l * (0.38 + 0.78 * light)));
    corners.forEach(([u, v], k) => {
      const q = c.clone().addScaledVector(ax, u * s).addScaledVector(bx, v * s);
      pos.set([q.x, q.y, q.z], i * 12 + k * 3);
      nor.set([nn.x, nn.y, nn.z], i * 12 + k * 3);
      uv.set([u + 0.5, v + 0.5], i * 8 + k * 2);
      col.set([leafCol.r, leafCol.g, leafCol.b, 1], i * 16 + k * 4);
    });
    const b = i * 4;
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new Float32BufferAttribute(col, 4));
  geo.setIndex(idx);
  const mesh = shadowed(new Mesh(geo, m.leaf));
  mesh.userData.noAO = true;                             // у квадратов листвы GTAO видит целые квадраты
  return mesh;
}

/** Точки листвы по поверхности объединения сфер (кроны, кусты). */
function lobePoints(lobes: {c: Vector3; r: number}[], density: number, seed: number): LeafPt[] {
  const r = rand(seed), out: LeafPt[] = [];
  for (const L of lobes) {
    const n = Math.round(density * 4 * Math.PI * L.r * L.r);
    for (let i = 0; i < n; i++) {
      const z = r() * 2 - 1, ph = r() * Math.PI * 2, s = Math.sqrt(1 - z * z);
      const d = new Vector3(s * Math.cos(ph), z, s * Math.sin(ph));
      const depth = r() * r();
      const p = L.c.clone().addScaledVector(d, L.r * (1.02 - depth * 0.3));
      if (lobes.some(o => o !== L && p.distanceTo(o.c) < o.r * 0.9)) continue;   // внутри соседа — не видно
      out.push({p, n: d, depth});
    }
  }
  return out;
}

/** Кочка: сфера, вздутая шумом по нормали (ядро кроны и куста). */
function blob(r: number, bump: number, seed: number, detail = 3): BufferGeometry {
  let geo: BufferGeometry = new IcosahedronGeometry(r, detail);
  geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  const n = noise3(seed), pos = geo.attributes.position, p = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const d = p.clone().normalize();
    const k = n(p.x * 2.2 / r, p.y * 2.2 / r, p.z * 2.2 / r);
    p.addScaledVector(d, (k - 0.5) * 2 * bump * r);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function lobedPlant(lobes: {c: Vector3; r: number}[], density: number, leafSize: number, colorHex: string, m: Mats, seed: number): Group {
  const g = new Group();
  const core = mergeGeometries(lobes.map((L, i) => blob(L.r * 0.86, 0.12, seed * 13 + i).translate(L.c.x, L.c.y, L.c.z)));
  g.add(shadowed(new Mesh(core, m.core)));
  const y0 = Math.min(...lobes.map(L => L.c.y - L.r)), y1 = Math.max(...lobes.map(L => L.c.y + L.r));
  g.add(foliage(lobePoints(lobes, density, seed), leafSize, new Color(colorHex), m, seed + 1, y0, y1));
  return g;
}

/** Дерево: ствол с ветками в крону, крона из нескольких долей. */
function tree(h: number, crown: number, seed: number, m: Mats, colorHex: string): Group {
  const g = new Group(), r = rand(seed);
  const trunk = new Mesh(new CylinderGeometry(0.075 * h / 4, 0.12 * h / 4, h * 0.66, 12), m.bark);
  trunk.position.y = h * 0.33;
  g.add(shadowed(trunk));
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2 + r();
    const b = new Mesh(new CylinderGeometry(0.03, 0.05, h * 0.32, 8), m.bark);
    b.position.set(Math.cos(a) * 0.16, h * 0.56, Math.sin(a) * 0.16);
    b.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    g.add(shadowed(b));
  }
  const cy = h * 0.68, lobes: {c: Vector3; r: number}[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r() * 0.8;
    lobes.push({c: new Vector3(Math.cos(a) * crown * 0.45, cy + (r() - 0.3) * crown * 0.5, Math.sin(a) * crown * 0.45), r: crown * (0.5 + r() * 0.22)});
  }
  lobes.push({c: new Vector3(0, cy + crown * 0.55, 0), r: crown * 0.62});
  g.add(lobedPlant(lobes, 190, 0.28, colorHex, m, seed));
  return g;
}

/** Куст: две-три доли. */
function shrub(r0: number, seed: number, m: Mats, colorHex = '#5f7347'): Group {
  const r = rand(seed), lobes: {c: Vector3; r: number}[] = [];
  for (let i = 0; i < 3; i++) lobes.push({c: new Vector3((r() - 0.5) * r0, r0 * 0.75 + r() * r0 * 0.2, (r() - 0.5) * r0), r: r0 * (0.6 + r() * 0.3)});
  return lobedPlant(lobes, 150, 0.2, colorHex, m, seed);
}

/** Живая изгородь: скруглённое ядро, по поверхности — веточки. */
function hedge(w: number, h: number, d: number, seed: number, m: Mats): Group {
  const g = new Group();
  const seg = (L: number) => Math.max(4, Math.round(L * 9));
  let geo: BufferGeometry = new BoxGeometry(1, 1, 1, seg(w), seg(h), seg(d));
  geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  const rr = Math.min(w, h, d) * 0.42, n = noise3(seed), pos = geo.attributes.position, p = new Vector3();
  const half = new Vector3(w / 2 - rr, h / 2 - rr, d / 2 - rr);
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).multiply(new Vector3(w, h, d));
    const inner = new Vector3(Math.max(-half.x, Math.min(half.x, p.x)), Math.max(-half.y, Math.min(half.y, p.y)), Math.max(-half.z, Math.min(half.z, p.z)));
    const dir = p.clone().sub(inner).normalize();
    const k = 0.6 * n(p.x * 3, p.y * 3, p.z * 3) + 0.4 * n(p.x * 8 + 3, p.y * 8, p.z * 8);
    p.copy(inner).addScaledVector(dir, rr + (k - 0.5) * 0.12);
    pos.setXYZ(i, p.x, p.y + h / 2, p.z);
  }
  geo.computeVertexNormals();
  const coreGeo = geo.clone();
  coreGeo.scale(0.94, 0.95, 0.9);
  g.add(shadowed(new Mesh(coreGeo, m.core)));
  // точки по поверхности (по площади треугольников)
  const r = rand(seed + 5), idx = geo.index!, nor = geo.attributes.normal, pts: LeafPt[] = [];
  const A = new Vector3(), B = new Vector3(), C = new Vector3(), NA = new Vector3(), NB = new Vector3(), NC = new Vector3();
  for (let t = 0; t < idx.count; t += 3) {
    A.fromBufferAttribute(pos, idx.getX(t)); B.fromBufferAttribute(pos, idx.getX(t + 1)); C.fromBufferAttribute(pos, idx.getX(t + 2));
    const area = B.clone().sub(A).cross(C.clone().sub(A)).length() / 2;
    let cnt = area * 170;
    while (cnt > 0) {
      if (cnt < 1 && r() > cnt) break;
      cnt -= 1;
      let u = r(), v = r();
      if (u + v > 1) { u = 1 - u; v = 1 - v; }
      NA.fromBufferAttribute(nor, idx.getX(t)); NB.fromBufferAttribute(nor, idx.getX(t + 1)); NC.fromBufferAttribute(nor, idx.getX(t + 2));
      const P = A.clone().multiplyScalar(1 - u - v).addScaledVector(B, u).addScaledVector(C, v);
      const Nn = NA.clone().multiplyScalar(1 - u - v).addScaledVector(NB, u).addScaledVector(NC, v).normalize();
      pts.push({p: P.addScaledVector(Nn, r() * 0.04), n: Nn, depth: r() * r() * 0.6});
    }
  }
  g.add(foliage(pts, 0.2, new Color('#58693f'), m, seed + 9, 0, h));
  return g;
}

// ── Газон: ворс из слоёв ─────────────────────────────────────────────────────
/** Шум высот травинок: тексель — травинка (0…1). */
function bladeNoise(seed: number) {
  const r = rand(seed), S = 256, data = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) {
    const v = r();
    data[i * 4] = Math.round(255 * (0.25 + 0.75 * Math.sqrt(v)));
    data[i * 4 + 1] = Math.round(255 * r());
    data[i * 4 + 2] = Math.round(255 * r());
    data[i * 4 + 3] = Math.round(255 * r());
  }
  const t = new DataTexture(data, S, S, RGBAFormat, UnsignedByteType);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.magFilter = t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/** Плавное поле наклона травинок: пучки клонятся в разные стороны. */
function leanNoise(seed: number) {
  const r = rand(seed), S = 64, data = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S * 4; i++) data[i] = Math.round(255 * r());
  const t = new DataTexture(data, S, S, RGBAFormat, UnsignedByteType);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;                  // мелкое зерно пучков не рябит вдали
  t.anisotropy = 16;                                      // газон сжат углом камеры по вертикали: без анизотропии мип мылит обе оси
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

interface GrassArea {w: number; d: number; r: number; y: number; clear: (g: CanvasRenderingContext2D, px: (x: number, z: number) => [number, number], k: number) => void}

/** Газон: основание + N слоёв; травинка сужается кверху, у корней темно; маска — где травы нет. */
function lawnShells(a: GrassArea, m: Mats): Group {
  const g = new Group(), shells: Mesh[] = [];
  const grow = {value: 1};                                 // сборка: фронт роста идёт от фасада к заднему краю
  const aa = {value: 1};                                   // сглаживание ворса по размеру пикселя (0 — резкие травинки)
  const farK = {value: new Vector2(0.3, 0.8)};
  const clumpK = {value: 1};                               // пучки (стенд: 0 — без них)
  const clumpS = {value: new Vector2(1, 0.15)};            // масштаб пучков и их контраст: лёгкая пятнистость             // с какого размера ячейки (ячеек на пиксель) травинки усредняются
  // ⚠️ 20 травинок на метр (~5 см): мельче — на общем плане травинка уже пикселя по вертикали
  // (камера под 31°), и газон либо рябит («динамический грейн»), либо мылится. Крупный ворс —
  // как макетный флок у референса: видны травинки, мерцание в 1.7–4.7 раза ниже (замер).
  const N = 30, H = 0.13, DENS = 20;                    // слоёв, высота ворса (м), травинок на метр
  const densK = {value: DENS};                             // травинок на метр (стенд)
  const farGain = {value: 1.2};                            // свет вдали: сквозь слои видны корни (замер против резких при 4× SS: ±3 %)
  const MW = 1024, MH = Math.round(1024 * a.d / a.w);
  const k = MW / a.w;
  const px = (x: number, z: number): [number, number] => [(x + a.w / 2) * k, (z + a.d / 2) * k];
  const mask = canvasTex(MW, MH, c => {
    c.fillStyle = '#000'; c.fillRect(0, 0, MW, MH);
    // газон — скруглённый прямоугольник; у бортика ворс ниже
    c.filter = 'blur(6px)';
    c.fillStyle = '#fff';
    const inset = 0.12 * k, rr = a.r * k;
    c.beginPath(); (c as any).roundRect(inset, inset, MW - 2 * inset, MH - 2 * inset, rr); c.fill();
    c.filter = 'blur(3px)';
    c.fillStyle = '#000';
    a.clear(c, px, k);
    c.filter = 'none';
  }, false);
  mask.wrapS = mask.wrapT = RepeatWrapping;
  mask.magFilter = LinearFilter;
  mask.flipY = false;                                     // строка холста = z раскладки (как в шейдере)
  const noise = bladeNoise(17), lean = leanNoise(23);
  const shape = new Shape();
  {
    const w = a.w, d = a.d, r = a.r, x0 = -w / 2, y0 = -d / 2;
    shape.moveTo(x0 + r, y0); shape.lineTo(x0 + w - r, y0); shape.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
    shape.lineTo(x0 + w, y0 + d - r); shape.quadraticCurveTo(x0 + w, y0 + d, x0 + w - r, y0 + d);
    shape.lineTo(x0 + r, y0 + d); shape.quadraticCurveTo(x0, y0 + d, x0, y0 + d - r);
    shape.lineTo(x0, y0 + r); shape.quadraticCurveTo(x0, y0, x0 + r, y0);
  }
  const geo = new ShapeGeometry(shape, 16);
  geo.rotateX(-Math.PI / 2);                               // (x, y) контура → (x, −y): лицом вверх; маска — по вершинам (раскладка)
  const base = new Mesh(geo, m.lawnBase);
  base.position.y = a.y;
  g.add(shadowed(base, false));
  // Средняя доля покрытия слоя (как у шума травинок: высота 0.25 + 0.75·√v, радиус сужается
  // кверху, травинка сдвинута в ячейке) — ею слой рисуется там, где ячейка мельче ~2 px.
  // ⚠️ Без этого травинки мельче пикселя при облёте камеры мерцают: «динамический грейн».
  const covAt = (h: number) => {
    const rc = rand(91);
    let sum = 0;
    for (let k = 0; k < 600; k++) {
      const hb = 0.25 + 0.75 * Math.sqrt(rc()), jx = (rc() - 0.5) * 0.45, jy = (rc() - 0.5) * 0.45;
      if (h > hb) continue;
      const rad = 0.5 * (1 - h / hb);
      let inside = 0;
      for (let q = 0; q < 64; q++) { const px = (q % 8 + 0.5) / 8 - 0.5, py = (Math.floor(q / 8) + 0.5) / 8 - 0.5; if (Math.hypot(px - jx, py - jy) <= rad) inside++; }
      sum += inside / 64;
    }
    return sum / 600;
  };
  // Слои — не независимые: травинка, видная в верхнем слое, закрывает собой нижние (сечения
  // вложены). Чтобы сверху виднелись кончики с тем же распределением, что у резких травинок,
  // прозрачность слоя i = (cᵢ − cᵢ₊₁) / (1 − cᵢ₊₁), cᵢ — доля покрытия на его высоте.
  // ⚠️ С долями «как есть» газон темнел: просвечивали тёмные корни.
  const covs = Array.from({length: N + 2}, (_, i) => i >= 1 && i <= N ? covAt(i / N) : 0);
  for (let i = 1; i <= N; i++) {
    const h = i / N;
    const mat = new MeshStandardMaterial({color: new Color('#86a05c'), roughness: 0.92, metalness: 0, transparent: true});
    const cov = Math.max(0, (covs[i] - covs[i + 1]) / Math.max(1e-3, 1 - covs[i + 1]));
    mat.onBeforeCompile = sh => {
      sh.uniforms.uShell = {value: h};
      sh.uniforms.uCov = {value: cov};
      sh.uniforms.uAA = aa;
      sh.uniforms.uFar = farK;
      sh.uniforms.uClump = clumpK;
      sh.uniforms.uClumpS = clumpS;
      sh.uniforms.uNoise = {value: noise};
      sh.uniforms.uLean = {value: lean};
      sh.uniforms.uGrow = grow;
      sh.uniforms.uMask = {value: mask};
      sh.uniforms.uArea = {value: new Vector2(a.w, a.d)};
      sh.uniforms.uDens = densK;
      sh.uniforms.uFarGain = farGain;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vLawn;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLawn = position.xz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vLawn;\nuniform float uShell, uDens, uGrow, uCov, uAA, uClump;\nuniform sampler2D uNoise, uMask, uLean;\nuniform vec2 uArea, uFar, uClumpS;\nuniform float uFarGain;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          // травинки клонятся пучками (плавный шум), сильнее к верху
          vec2 lean = (texture2D(uLean, vLawn * 0.35).rg * 2.0 - 1.0) * 0.6 * uShell * uShell;
          vec2 gp = vLawn * uDens + lean;
          vec2 cell = floor(gp);
          vec4 nz = texture2D(uNoise, (cell + 0.5) / 256.0);
          vec2 f = fract(gp) - 0.5 - (nz.ba - 0.5) * 0.45;     // травинка не в центре ячейки
          float msk = texture2D(uMask, vLawn / uArea + 0.5).r;
          // пучки 4–7 см (на общем плане 3–6 px): видимая фактура газона, которая не мерцает
          // (автор: «газон стал мыльный» — вдали травинки усреднялись в гладкий слой)
          float clump = mix(0.5, 0.45 * texture2D(uLean, vLawn * 0.22 * uClumpS.x + 0.13).a + 0.35 * texture2D(uLean, vLawn * 0.37 * uClumpS.x + 0.61).g + 0.2 * texture2D(uLean, vLawn * 0.61 * uClumpS.x + 0.29).b, uClump);
          float hgt = nz.r * msk * (0.62 + 0.7 * clump);
          float front = mix(-uArea.y * 0.5 - 1.6, uArea.y * 0.5 + 1.6, uGrow);
          float growK = clamp((front - vLawn.y) / 1.6, 0.0, 1.0);
          hgt *= growK;
          float rad = 0.5 * (1.0 - uShell / max(hgt, 1e-3));
          // край травинки — в пиксель; ячейка мельче ~2 px — средняя доля покрытия слоя
          float fw = max(fwidth(gp.x), fwidth(gp.y));
          float far = uAA * smoothstep(uFar.x, uFar.y, fw);
          float e = max(fw * 0.5 * uAA, 1e-4);
          float cov = uShell > hgt ? 0.0 : 1.0 - smoothstep(rad - e, rad + e, length(f));
          float alpha = mix(cov, uCov * msk * growK * (0.65 + 0.7 * clump), far);
          if (alpha <= 0.004) discard;
          diffuseColor.a = uAA > 0.5 ? alpha : 1.0;
          float tone = texture2D(uLean, vLawn * 0.11 + 0.37).b;     // ⚠️ не patch: зарезервировано в GLSL
          diffuseColor.rgb *= mix(0.32, 1.06, uShell) * mix(0.86 + 0.28 * nz.g, 1.0, far) * (0.9 + 0.2 * tone) * (1.0 - uClumpS.y + 2.0 * uClumpS.y * clump)
            * mix(1.0, uFarGain, far);   // вдали сквозь слои видны корни: газон темнел на 16 % (замер против резких травинок при 8× SS) — свет ×1.49`);
    };
    mat.customProgramCacheKey = () => 'lawn-shell';
    const shell = new Mesh(geo, mat);
    shell.position.y = a.y + H * h;
    shell.renderOrder = i;                                  // слои снизу вверх: верхние ложатся на нижние
    shell.receiveShadow = true;
    shell.userData.noAO = true;
    g.add(shell);
    shells.push(shell);
  }
  g.userData.lawn = {shells, mask: mask.image as HTMLCanvasElement, area: a, H, grow, aa, farK, clumpK, clumpS, densK, farGain};
  return g;
}

// ── Режим лучей (трассировка) ────────────────────────────────────────────────
// Трассировщик (three-gpu-pathtracer) берёт обычные сетки и материалы: ворс-шейдер ему не
// виден, инстансы он не разворачивает (вся черепица слиплась бы в одну плитку), тени от
// ShadowMaterial не умеет. Для него — свои заместители, в обычном рендере они спрятаны.

/** Газон для лучей: настоящие травинки-треугольники там, где маска разрешает ворс. */
function grassBlades(lawn: {mask: HTMLCanvasElement; area: GrassArea; H: number}, toward: Vector3, seed: number): Mesh {
  const {mask, area: a, H} = lawn;
  const MW = mask.width, MH = mask.height, img = mask.getContext('2d')!.getImageData(0, 0, MW, MH).data;
  const maskAt = (x: number, z: number) => {
    const u = Math.floor((x / a.w + 0.5) * MW), v = Math.floor((z / a.d + 0.5) * MH);
    return u < 0 || v < 0 || u >= MW || v >= MH ? 0 : img[(v * MW + u) * 4] / 255;
  };
  const r = rand(seed), DENS = 1500, N = Math.round(a.w * a.d * DENS);
  const pos: number[] = [], col: number[] = [], nor: number[] = [];
  const base = new Color('#86a05c');
  const face = Math.atan2(toward.x, toward.z);             // травинки повёрнуты к камере ±70°
  for (let i = 0; i < N; i++) {
    const x = (r() - 0.5) * a.w, z = (r() - 0.5) * a.d, mk = maskAt(x, z);
    if (mk <= 0.02 || r() > mk) continue;
    const h = H * (0.25 + 0.75 * Math.sqrt(r())) * (0.6 + 0.4 * mk);
    const th = face + (r() - 0.5) * 2.4, w = 0.022 * (0.7 + 0.6 * r());
    const cx = Math.cos(th) * w / 2, cz = -Math.sin(th) * w / 2;
    const lx = (r() - 0.5) * h * 0.6, lz = (r() - 0.5) * h * 0.6;
    pos.push(x - cx, a.y, z - cz, x + cx, a.y, z + cz, x + lx, a.y + h, z + lz);
    const n = new Vector3(Math.sin(th), 0, Math.cos(th)).multiplyScalar(0.45).add(new Vector3(0, 0.55, 0)).normalize();
    for (let k = 0; k < 3; k++) nor.push(n.x, n.y, n.z);
    const tip = 0.92 + r() * 0.2, root = 0.3;
    col.push(base.r * root, base.g * root, base.b * root, 1, base.r * root, base.g * root, base.b * root, 1, base.r * tip * 1.06, base.g * tip * 1.06, base.b * tip * 1.06, 1);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new Float32BufferAttribute(col, 4));
  const mesh = new Mesh(geo, new MeshStandardMaterial({vertexColors: true, roughness: 0.85, metalness: 0, side: DoubleSide}));
  mesh.receiveShadow = true;
  return mesh;
}

/** Инстансы → одна сетка: матрицы и цвета экземпляров запечены (цвет — в вершины). */
function bakeInstances(im: InstancedMesh): Mesh {
  im.geometry.computeBoundingBox();
  const bb = im.geometry.boundingBox!, size = bb.getSize(new Vector3()), center = bb.getCenter(new Vector3());
  // плитке хватит простой коробки (у скруглённой ~300 треугольников — 2000 плиток тяжело)
  const proto = im.geometry.attributes.position.count > 400 ? new BoxGeometry(size.x, size.y, size.z).translate(center.x, center.y, center.z) : im.geometry;
  const parts: BufferGeometry[] = [], m4 = new Matrix4(), c = new Color(1, 1, 1);
  for (let i = 0; i < im.count; i++) {
    im.getMatrixAt(i, m4);
    const g = proto.clone().applyMatrix4(m4);
    if (im.instanceColor) im.getColorAt(i, c);
    const n = g.attributes.position.count, cc = new Float32Array(n * 4);
    for (let k = 0; k < n; k++) { cc[k * 4] = c.r; cc[k * 4 + 1] = c.g; cc[k * 4 + 2] = c.b; cc[k * 4 + 3] = 1; }
    g.setAttribute('color', new Float32BufferAttribute(cc, 4));
    parts.push(g);
  }
  const mat = (im.material as MeshStandardMaterial).clone();
  mat.vertexColors = true;
  const mesh = new Mesh(mergeGeometries(parts), mat);
  mesh.position.copy(im.position); mesh.quaternion.copy(im.quaternion); mesh.scale.copy(im.scale);
  return shadowed(mesh);
}

// ── Подставка ────────────────────────────────────────────────────────────────
function roundedRect(w: number, d: number, r: number): Shape {
  const s = new Shape(), x0 = -w / 2, y0 = -d / 2;
  s.moveTo(x0 + r, y0);
  s.lineTo(x0 + w - r, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
  s.lineTo(x0 + w, y0 + d - r); s.quadraticCurveTo(x0 + w, y0 + d, x0 + w - r, y0 + d);
  s.lineTo(x0 + r, y0 + d); s.quadraticCurveTo(x0, y0 + d, x0, y0 + d - r);
  s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

/** Плита из скруглённого прямоугольника от y0 до y1, кромки скруглены. */
function slab(w: number, d: number, r: number, y0: number, y1: number, mat: Material, bevel = 0.06, hole?: [number, number, number]): Mesh {
  const s = roundedRect(w, d, r);
  if (hole) s.holes.push(roundedRect(hole[0], hole[1], hole[2]));
  const geo = new ExtrudeGeometry(s, {depth: y1 - y0 - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 5, curveSegments: 32});
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y0 + bevel, 0);
  return shadowed(new Mesh(geo, mat));
}

// ── Дом ──────────────────────────────────────────────────────────────────────
export interface HouseParts {
  plinth: Group; wingA: Group; wingB: Group; bay: Group; garage: Object3D; garden: Group; lawn: Group;
}

export interface HouseShot {
  scene: Scene;
  camera: PerspectiveCamera;
  parts: HouseParts;
  /** Кадр W×H (суперсэмплинг ss). */
  render: (W: number, H: number, ss?: number) => HTMLCanvasElement;
  /** Сборка дома на момент t (с): детали, газон, черепица, ворота и облёт камеры. */
  setBuild: (t: number) => void;
  /** Длительность сборки (с), дальше дом стоит. */
  buildEnd: number;
  /** Ворота встраиваются (сценарий 1.3): dt — секунды от начала их хода. */
  setGarage: (dt: number) => void;
  /** Стенд: сглаживание ворса и затенение в углах (GTAO) — для замеров. */
  setQuality: (q: {grassAA?: boolean; ao?: boolean; far?: [number, number]; clumps?: boolean; clumpS?: [number, number]; dens?: number; farGain?: number}) => void;
  /** Режим лучей: заместители для трассировщика вместо растровых приёмов (и обратно). */
  setTraceMode: (on: boolean) => void;
}

const SOCLE = 0.42;                    // цоколь; порог двери на нём

// ── Сборка ───────────────────────────────────────────────────────────────────
// ⚠️ Автор: «анимацию местами обобщить, не дольше 3 секунд». Окна — вместе со стенами,
// крыша падает уже покрытой (без каскада рядов), панели — одним блоком, фазы внахлёст;
// ворота в эту сборку не входят — по сценарию они встраиваются в 1.3 (setGarage).
// Сценарий: «дом собирается модулями на общем плане… шаг 40–80 мс, пружина с лёгким
// перелётом, одно направление; модуль ворот встраивается иначе». Крупные модули падают
// сверху с лёгким отскоком (ниже своего места не проходят — стена не тонет в земле), окна
// и двери раскрываются из центра проёма пружиной, растения вырастают от земли, черепица
// ложится рядами от карниза к коньку, газон прорастает волной от фасада. Ворота — последние,
// другим ходом: сбоку, медленный подход и щелчок.
type PieceStyle = 'drop' | 'pop' | 'grow';
interface Piece {o: Object3D; phase: string; style: PieceStyle; dropH: number; pos: Vector3; scale: Vector3; t0: number}

function buildHouse(m: Mats): {parts: HouseParts; pieces: Piece[]} {
  const plinth = new Group(), wingA = new Group(), wingB = new Group(), bay = new Group(), garden = new Group();
  const pieces: Piece[] = [];
  const reg = <O extends Object3D>(o: O, phase: string, style: PieceStyle = 'drop', dropH = 2.2): O => {
    pieces.push({o, phase, style, dropH, pos: o.position.clone(), scale: o.scale.clone(), t0: 0});
    return o;
  };

  // подставка: плита, бортик, газон чуть ниже бортика
  const PW = 21, PD = 17, PR = 2.4, CURB = 0.42, LAWN_Y = 0.08;
  plinth.add(reg(slab(PW, PD, PR, -0.95, -0.12, m.base, 0.08), 'plinth', 'drop', 2.6));
  plinth.add(reg(slab(PW, PD, PR, -0.14, 0.26, m.curb, 0.07, [PW - 2 * CURB, PD - 2 * CURB, PR - CURB]), 'plinth', 'drop', 1.6));

  // крыло A: слева, щипец к фасаду (−z), конёк вдоль z; щипцовые стены — во всю ширину,
  // карнизные — между ними (стыки без зазоров под скруглёнными кромками)
  const A = {x0: -6.2, x1: -1.0, z0: -3.0, z1: 4.0, h: 5.4, rise: 2.7};
  const aw = A.x1 - A.x0, ad = A.z1 - A.z0;
  const front = wall(aw, A.h, A.rise, [
    {x: aw / 2, y: 4.05, w: 1.7, h: 1.45},
    {x: aw * 0.27, y: 1.5, w: 1.3, h: 1.55}, {x: aw * 0.73, y: 1.5, w: 1.3, h: 1.55},
  ], m);
  front.position.set(A.x0, 0, A.z0);
  const backA = wall(aw, A.h, A.rise, [], m);
  backA.rotation.y = Math.PI; backA.position.set(A.x1, 0, A.z1);
  const leftA = wall(ad - 2 * T, A.h, 0, [{x: (ad - 2 * T) * 0.3, y: 4.0, w: 1.2, h: 1.3}, {x: (ad - 2 * T) * 0.7, y: 1.55, w: 1.2, h: 1.4}], m);
  leftA.rotation.y = Math.PI / 2; leftA.position.set(A.x0, 0, A.z1 - T);
  wingA.add(reg(front, 'walls', 'drop', 2.8), reg(backA, 'walls', 'drop', 2.8), reg(leftA, 'walls', 'drop', 2.8));
  const roofA = gableRoof({len: ad, span: aw, rise: A.rise, ohE: 0.45, ohG: 0.42, at: new Vector3((A.x0 + A.x1) / 2, A.h, (A.z0 + A.z1) / 2), rotY: Math.PI / 2, seed: 41}, m);
  wingA.add(reg(roofA, 'roofs', 'drop', 2.4));
  // козырёк над окнами первого этажа: фальцевый металл на кронштейнах
  const awn = new Group();
  awn.add(rbox(aw - 0.6, 0.05, 0.95, m.metal, 0, 0, 0, 0.015));
  for (let x = -(aw - 0.6) / 2 + 0.15; x < (aw - 0.6) / 2 - 0.1; x += 0.3) awn.add(rbox(0.03, 0.035, 0.95, m.metal, x, 0.035, 0, 0.01));
  awn.position.set((A.x0 + A.x1) / 2, 2.68, A.z0 - 0.44);
  awn.rotation.x = -0.32;
  for (const x of [A.x0 + 0.6, A.x1 - 0.6]) wingA.add(reg(rbox(0.05, 0.05, 0.82, m.dark, x, 2.52, A.z0 - 0.38, 0.015), 'roofTop', 'drop', 1.2));
  wingA.add(reg(awn, 'roofTop', 'drop', 1.4));
  const chA = new Group();
  chA.add(rbox(0.78, 2.6, 0.78, m.plaster, 0, 0, 0, 0.03), rbox(0.94, 0.12, 0.94, m.concrete, 0, 1.33, 0, 0.03), rbox(0.5, 0.18, 0.5, m.dark, 0, 1.45, 0, 0.03));
  chA.position.set(-4.6, A.h + 1.5, 2.6);
  wingA.add(reg(chA, 'roofTop', 'drop', 1.8));

  // эркер с входной дверью: выступ между крыльями, плоская крыша
  const BAY = {x0: -1.0, x1: 1.6, z0: -3.5, z1: -1.4, h: 5.0};
  const bw = BAY.x1 - BAY.x0, bd = BAY.z1 - BAY.z0;
  const bf = wall(bw, BAY.h, 0, [{x: bw / 2, y: SOCLE + 1.18, w: 1.1, h: 2.36, kind: 'door'}, {x: bw / 2, y: 3.95, w: 1.25, h: 1.3}], m);
  bf.position.set(BAY.x0, 0, BAY.z0);
  const br = wall(bd - T, BAY.h, 0, [], m);
  br.rotation.y = -Math.PI / 2; br.position.set(BAY.x1, 0, BAY.z0 + T);
  bay.add(reg(bf, 'walls', 'drop', 2.8), reg(br, 'walls', 'drop', 2.8));
  bay.add(reg(rbox(bw + 0.36, 0.24, bd + 0.3, m.metal, (BAY.x0 + BAY.x1) / 2, BAY.h + 0.12, (BAY.z0 + BAY.z1) / 2 - 0.12, 0.04), 'roofs', 'drop', 1.8));
  // крыльцо: две ступени до порога на цоколе
  for (let i = 0; i < 2; i++) bay.add(reg(rbox(1.9 - i * 0.25, SOCLE / 2 - 0.02, 1.1 - i * 0.4, m.concrete, (BAY.x0 + BAY.x1) / 2, LAWN_Y + (SOCLE / 2 - 0.02) / 2 + i * (SOCLE / 2 - 0.04), BAY.z0 - 0.55 + i * 0.2, 0.025), 'socle', 'drop', 0.9));

  // крыло B: справа, конёк вдоль x, щипец — к воротам (+x)
  const B = {x0: -1.0, x1: 6.6, z0: -1.4, z1: 4.0, h: 5.0, rise: 2.5};
  const bw2 = B.x1 - B.x0, bd2 = B.z1 - B.z0;
  const fB = wall(bw2 - T, B.h, 0, [
    {x: 3.6, y: 1.55, w: 1.45, h: 1.45}, {x: 5.9, y: 1.55, w: 1.45, h: 1.45},
    {x: 3.6, y: 3.85, w: 1.3, h: 1.3}, {x: 5.9, y: 3.85, w: 1.3, h: 1.3},
  ], m);
  fB.position.set(B.x0, 0, B.z0);
  const garageHole: Hole = {x: bd2 * 0.62, y: 1.25, w: 2.7, h: 2.5, kind: 'garage'};
  const rB = wall(bd2, B.h, B.rise, [garageHole, {x: bd2 * 0.16, y: 1.65, w: 0.75, h: 1.0}, {x: bd2 / 2, y: 4.15, w: 1.2, h: 1.25}], m);
  rB.rotation.y = -Math.PI / 2; rB.position.set(B.x1, 0, B.z0);
  const bB = wall(bw2 - T, B.h, 0, [], m);
  bB.rotation.y = Math.PI; bB.position.set(B.x1 - T, 0, B.z1);
  wingB.add(reg(fB, 'walls', 'drop', 2.8), reg(rB, 'walls', 'drop', 2.8), reg(bB, 'walls', 'drop', 2.8));
  // за проёмом ворот — тёмная глубина гаража (пока модуля нет, проём не сквозной)
  const cav = rbox(garageHole.w - 0.02, garageHole.h - 0.02, 1.2, m.cavity, garageHole.x, garageHole.y, T + 0.6, 0.01);
  rB.add(cav);
  // левый конец крыши B — внутрь крыши A: конёк B упирается в её скат там, где тот на
  // той же высоте; ендова получается из пересечения, плитки B под крышей A не кладём
  const slopeA = A.rise / (aw / 2), xcA = (A.x0 + A.x1) / 2, xMeet = xcA + (A.h + A.rise - B.h - B.rise) / slopeA;
  const roofBx1 = B.x1 + 0.42;
  const roofATop = (x: number) => A.h + A.rise + 0.18 / Math.cos(Math.atan(slopeA)) - slopeA * Math.abs(x - xcA);
  const roofB = gableRoof({len: roofBx1 - xMeet, span: bd2, rise: B.rise, ohE: 0.45, ohG: 0, at: new Vector3((xMeet + roofBx1) / 2, B.h, (B.z0 + B.z1) / 2), rotY: 0, seed: 42,
    skip: p => p.x < A.x1 + 0.45 && p.y < roofATop(p.x) + 0.02}, m);
  wingB.add(reg(roofB, 'roofs', 'drop', 2.4));
  // водосточные трубы — на видных углах крыла B
  const eave = (roofB.userData.eaveMinus as Vector3).clone().applyMatrix4(roofB.matrix);
  wingB.add(reg(downspout(new Vector3(B.x1 + 0.1, eave.y, eave.z), new Vector2(B.x1 + 0.07, B.z0 - 0.08), m), 'roofTop', 'drop', 1.4));
  // солнечные панели на переднем скате: над черепицей
  const aB = Math.atan2(B.rise, bd2 / 2);
  const panels = new Group();
  // ⚠️ Без массива материалов: у трассировщика сетки с массивом сбивают номера материалов
  // у других сеток (левая крыша серела, газон бурел). Рама — коробка, ячейки — пластина сверху.
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    const x = 1.4 + i * 1.08, z = -0.95 - j * 1.58;
    const panel = new Group();                              // своя группа: в сборке ложится на скат по нормали
    panel.add(rbox(1.0, 0.05, 1.5, m.metal, 0, 0, 0, 0.012));
    const cells = new Mesh(new PlaneGeometry(0.94, 1.44), m.panel);
    cells.rotation.x = -Math.PI / 2;
    cells.position.set(0, 0.0262, 0);
    panel.add(shadowed(cells, false));
    panel.position.set(x, 0.28, z);
    panels.add(panel);
  }
  panels.rotation.x = -aB;
  panels.position.set(0, B.h + B.rise, (B.z0 + B.z1) / 2);
  wingB.add(reg(panels, 'roofTop', 'drop', 1.2));
  const chB = new Group();
  chB.add(rbox(0.72, 2.4, 0.72, m.plaster, 0, 0, 0, 0.03), rbox(0.88, 0.12, 0.88, m.concrete, 0, 1.23, 0, 0.03), rbox(0.46, 0.18, 0.46, m.dark, 0, 1.35, 0, 0.03));
  chB.position.set(1.2, B.h + 1.8, 2.4);
  wingB.add(reg(chB, 'roofTop', 'drop', 1.8));
  const garage = rB.children[0];

  // цоколь: бетонная полоса по низу видимых стен, на 5 см наружу
  const socle = (x0: number, z0: number, x1: number, z1: number, g: Group) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const s = rbox(len + 0.1, SOCLE, T + 0.1, m.concrete, (x0 + x1) / 2, SOCLE / 2, (z0 + z1) / 2, 0.025);
    s.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    g.add(reg(s, 'socle', 'drop', 1.0));
  };
  socle(A.x0, A.z0 + T / 2 - 0.05, A.x1, A.z0 + T / 2 - 0.05, wingA);
  socle(A.x0 + T / 2 - 0.05, A.z0, A.x0 + T / 2 - 0.05, A.z1, wingA);
  socle(BAY.x0, BAY.z0 + T / 2 - 0.05, BAY.x1, BAY.z0 + T / 2 - 0.05, bay);
  socle(BAY.x1 - T / 2 + 0.05, BAY.z0, BAY.x1 - T / 2 + 0.05, BAY.z1, bay);
  socle(BAY.x1, B.z0 + T / 2 - 0.05, B.x1, B.z0 + T / 2 - 0.05, wingB);
  const gz0 = B.z0 + garageHole.x - garageHole.w / 2, gz1 = B.z0 + garageHole.x + garageHole.w / 2;
  socle(B.x1 - T / 2 + 0.05, B.z0, B.x1 - T / 2 + 0.05, gz0 - 0.05, wingB);
  socle(B.x1 - T / 2 + 0.05, gz1 + 0.05, B.x1 - T / 2 + 0.05, B.z1, wingB);


  // сад
  const r = rand(5);
  const pavers: [number, number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const x = 0.3 + (r() - 0.5) * 0.15, z = -4.6 - i * 0.82, rot = (r() - 0.5) * 0.12;
    const p = rbox(1.3 + r() * 0.15, 0.1, 0.62, m.paver, x, LAWN_Y + 0.06, z, 0.03);
    p.rotation.y = rot;
    garden.add(reg(p, 'garden', 'drop', 0.9));
    pavers.push([x, z, rot]);
  }
  const drive = {x: B.x1 + 1.75, z: (B.z0 + B.z1) / 2 + 0.95, w: 3.1, d: 4.6};
  garden.add(reg(rbox(drive.w, 0.08, drive.d, m.concrete, drive.x, LAWN_Y + 0.05, drive.z, 0.03), 'garden', 'drop', 1.0));
  const hedgeAt = {x: -3.6, z: -3.95, w: 4.6, d: 0.72};
  garden.add(reg(hedge(hedgeAt.w, 0.9, hedgeAt.d, 3, m).translateX(hedgeAt.x).translateZ(hedgeAt.z).translateY(LAWN_Y), 'plants', 'grow'));
  // грядки: каменный бортик, земля, кусты
  const beds: [number, number][] = [[-7.4, -5.0], [2.9, -5.4]];
  for (const [bx, bz] of beds) {
    const bed = new Group();
    bed.add(rbox(2.6, 0.45, 1.3, m.concrete, 0, LAWN_Y + 0.225, 0, 0.03), rbox(2.42, 0.06, 1.12, m.soil, 0, LAWN_Y + 0.43, 0, 0.02));
    for (let i = 0; i < 3; i++) bed.add(reg(shrub(0.3 + r() * 0.1, 20 + i + Math.round(bx), m).translateX(-0.8 + i * 0.8).translateY(LAWN_Y + 0.44), 'plants', 'grow'));
    bed.position.set(bx, 0, bz);
    garden.add(reg(bed, 'garden', 'drop', 1.2));
  }
  const trees: [number, number, number, number, string][] = [[-8.2, 1.4, 4.4, 1.25, '#6f8a4c'], [8.4, -3.6, 3.6, 1.05, '#7d9655'], [3.9, -2.6, 3.0, 0.9, '#78914f']];
  trees.forEach(([x, z, h, c, col], i) => garden.add(reg(tree(h, c, 7 + i, m, col).translateX(x).translateZ(z).translateY(LAWN_Y), 'plants', 'grow')));
  garden.add(reg(shrub(0.5, 31, m).translateX(2.15).translateZ(-3.95).translateY(LAWN_Y), 'plants', 'grow'));
  // фонарь у дорожки
  const lamp = new Group();
  lamp.add(rbox(0.24, 0.14, 0.24, m.dark, 0, LAWN_Y + 0.07, 0, 0.02));
  const pole = new Mesh(new CylinderGeometry(0.045, 0.06, 2.9, 12), m.dark);
  pole.position.y = LAWN_Y + 1.55;
  lamp.add(shadowed(pole));
  const head = new Mesh(new SphereGeometry(0.2, 24, 16), m.lampGlow);
  head.position.y = LAWN_Y + 3.12;
  lamp.add(head);
  lamp.position.set(-8.7, 0, -6.4);
  garden.add(reg(lamp, 'garden', 'drop', 1.6));
  // почтовый ящик у подъезда
  const mail = new Group();
  mail.add(rbox(0.07, 1.05, 0.07, m.dark, 0, LAWN_Y + 0.52, 0, 0.015), rbox(0.3, 0.32, 0.46, m.door, 0, LAWN_Y + 1.15, 0, 0.04));
  mail.position.set(B.x1 + 0.4, 0, -3.3);
  garden.add(reg(mail, 'garden', 'drop', 1.4));

  // газон: где травы нет — дом с цоколем, крыльцо, дорожка, подъезд, грядки, изгородь, стволы
  const lawn = lawnShells({w: PW - 2 * CURB, d: PD - 2 * CURB, r: PR - CURB, y: LAWN_Y, clear: (c, px, k) => {
    const rect = (x0: number, z0: number, x1: number, z1: number) => { const [a0, b0] = px(x0, z0), [a1, b1] = px(x1, z1); c.fillRect(Math.min(a0, a1), Math.min(b0, b1), Math.abs(a1 - a0), Math.abs(b1 - b0)); };
    rect(A.x0 - 0.08, A.z0 - 0.08, A.x1, A.z1 + 0.08);
    rect(BAY.x0, BAY.z0 - 0.08, BAY.x1 + 0.08, BAY.z1);
    rect(B.x0, B.z0 - 0.08, B.x1 + 0.08, B.z1 + 0.08);
    rect(-0.65, BAY.z0 - 1.12, 1.25, BAY.z0);
    for (const [x, z, rot] of pavers) { const [cx, cz] = px(x, z); c.save(); c.translate(cx, cz); c.rotate(-rot); c.fillRect(-0.68 * k, -0.33 * k, 1.36 * k, 0.66 * k); c.restore(); }
    rect(drive.x - drive.w / 2, drive.z - drive.d / 2, drive.x + drive.w / 2, drive.z + drive.d / 2);
    for (const [bx, bz] of beds) rect(bx - 1.32, bz - 0.67, bx + 1.32, bz + 0.67);
    rect(hedgeAt.x - hedgeAt.w / 2 + 0.1, hedgeAt.z - hedgeAt.d / 2 + 0.08, hedgeAt.x + hedgeAt.w / 2 - 0.1, hedgeAt.z + hedgeAt.d / 2 - 0.08);
    for (const [x, z] of [...trees.map(t => [t[0], t[1]]), [-8.7, -6.4], [B.x1 + 0.4, -3.3]]) { const [cx, cz] = px(x, z); c.beginPath(); c.arc(cx, cz, 0.16 * k, 0, Math.PI * 2); c.fill(); }
  }}, m);

  reg(lawn, 'plinth', 'drop', 1.6);
  return {parts: {plinth, wingA, wingB, bay, garage, garden, lawn}, pieces};
}

/** Студийный фон: мягкий вертикальный градиент. */
function backdrop() {
  return canvasTex(16, 512, g => {
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#a3a8ae'); gr.addColorStop(0.55, '#bfc3c8'); gr.addColorStop(1, '#b0b4b9');
    g.fillStyle = gr; g.fillRect(0, 0, 16, 512);
  });
}

let ownRenderer: WebGLRenderer | null = null;
export function houseRenderer(): WebGLRenderer {
  // свой рендерер: тип теней включается на весь рендерер, а общий нужен другим сценам
  if (ownRenderer) return ownRenderer;
  ownRenderer = new WebGLRenderer({canvas: document.createElement('canvas'), antialias: false, preserveDrawingBuffer: true});
  ownRenderer.outputColorSpace = SRGBColorSpace;
  ownRenderer.toneMapping = NeutralToneMapping;
  ownRenderer.toneMappingExposure = 1.0;
  ownRenderer.shadowMap.enabled = true;
  // ⚠️ VSM на слоях ворса ломается: газон весь в тени, светлая кайма по краю тени кроны
  ownRenderer.shadowMap.type = PCFShadowMap;
  return ownRenderer;
}

export async function loadHouseDiorama(base: string): Promise<HouseShot> {
  const r = houseRenderer();
  const assets = await loadAssets(base);
  const m = makeMats(assets);
  const scene = new Scene();
  scene.background = backdrop();
  // небо: свет и отражения; солнце на небе совмещено с ключевым светом (слева-сверху кадра)
  const pmrem = new PMREMGenerator(r);
  scene.environment = pmrem.fromEquirectangular(assets.sky).texture;
  scene.environmentIntensity = 0.75;
  const sunSky = skySun(assets.sky);
  scene.userData.skySun = sunSky;                         // для стенда: где солнце на небе
  const KEY_AZ = Math.atan2(-8, -22);                      // азимут ключа (как в пробном кадре)
  const skyAz = Math.atan2(sunSky.x, sunSky.z);
  scene.environmentRotation.y = skyAz - KEY_AZ;
  const el = Math.asin(Math.min(1, Math.max(0.35, sunSky.y)));
  const sunDir = new Vector3(Math.sin(KEY_AZ) * Math.cos(el), Math.sin(el), Math.cos(KEY_AZ) * Math.cos(el));

  const {parts, pieces} = buildHouse(m);
  // ⚠️ Раскладка референса — ворота справа от фасада: дом построен с воротами в +x и
  // отражён целиком (scale.x = −1; three.js сам меняет обход граней при отрицательном
  // масштабе): в мире ворота в −x, камера смотрит спереди-слева.
  const root = new Group();
  root.scale.x = -1;
  for (const p of Object.values(parts)) if (p.parent === null) root.add(p);
  scene.add(root);
  // ⚠️ У коробок и выдавленных стен в геометрии группы граней (6 и 2) при одном материале:
  // трассировщик берёт номер материала из группы — грани получали соседние материалы общего
  // списка (на стене — сетка панели, на полу — земля). Растру группы при одном материале не нужны.
  root.traverse(o => { const mesh = o as Mesh; if (mesh.isMesh && !Array.isArray(mesh.material) && mesh.geometry.groups.length) mesh.geometry.clearGroups(); });

  const sun = new DirectionalLight(new Color('#fff3e3'), 3.0);
  sun.position.copy(sunDir).multiplyScalar(40);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -17; sun.shadow.camera.right = 17; sun.shadow.camera.top = 17; sun.shadow.camera.bottom = -17;
  sun.shadow.camera.near = 5; sun.shadow.camera.far = 90;
  sun.shadow.radius = 3;
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.015;
  scene.add(sun, sun.target);
  scene.add(new HemisphereLight(new Color('#e6ebf1'), new Color('#8c8a83'), 0.25));
  const floor = new Mesh(new PlaneGeometry(200, 200), new ShadowMaterial({opacity: 0.22}));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.95;
  floor.receiveShadow = true;
  scene.add(floor);

  // камера: спереди-слева сверху, длинный фокус — «макет»; отход — по вершинам всех деталей,
  // цель — в середину видимого
  const camera = new PerspectiveCamera(19, 16 / 9, 1, 300);
  const AZ = 38 * Math.PI / 180, EL = 31 * Math.PI / 180;
  root.updateMatrixWorld(true);
  const all = new Box3().setFromObject(root);
  const target = all.getCenter(new Vector3());
  const corners: Vector3[] = [];
  root.traverse(o => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || (mesh as InstancedMesh).isInstancedMesh || mesh.userData.noAO) return;
    const pos = mesh.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 300));
    for (let i = 0; i < pos.count; i += step) corners.push(new Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
  });
  const place = (D: number) => {
    camera.position.set(target.x - Math.sin(AZ) * Math.cos(EL) * D, target.y + Math.sin(EL) * D, target.z - Math.cos(AZ) * Math.cos(EL) * D);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    return Math.max(...corners.map(c => { const v = c.clone().project(camera); return Math.max(Math.abs(v.x), Math.abs(v.y)); }));
  };
  const fit = () => {
    let lo = 20, hi = 200;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (place(mid) > 0.88) lo = mid; else hi = mid; }
    place(hi);
    return hi;
  };
  for (let it = 0; it < 4; it++) {
    const D = fit();
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (const c of corners) { const v = c.clone().project(camera); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    const tv = Math.tan(camera.fov / 2 * Math.PI / 180) * D;
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    target.addScaledVector(right, (x0 + x1) / 2 * tv * camera.aspect).addScaledVector(up, (y0 + y1) / 2 * tv);
  }
  const D_END = fit();

  // ── сборка ──
  // Фазы и шаг между модулями (сценарий: 40–80 мс); внутри фазы — слева направо по кадру.
  const PHASES: Record<string, {at: number; sort: boolean; step: [number, number]}> = {
    plinth: {at: 0, sort: false, step: [0.06, 0.06]}, socle: {at: 0.3, sort: true, step: [0.03, 0.05]},
    walls: {at: 0.4, sort: true, step: [0.04, 0.08]}, roofs: {at: 0.92, sort: false, step: [0.05, 0.07]},
    roofTop: {at: 1.25, sort: true, step: [0.04, 0.06]}, garden: {at: 1.45, sort: true, step: [0.03, 0.05]},
    plants: {at: 1.75, sort: true, step: [0.02, 0.04]},
  };
  const GARAGE = {approach: 0.9, from: 10};
  const BUILD_END = 3.0, DROP_T = 0.42, CASCADE = false;
  {
    const rs = rand(77), ndcX = (o: Object3D) => new Box3().setFromObject(o).getCenter(new Vector3()).project(camera).x;
    for (const [name, ph] of Object.entries(PHASES)) {
      const list = pieces.filter(p => p.phase === name);
      if (ph.sort) list.sort((a, b) => ndcX(a.o) - ndcX(b.o));
      let t = ph.at;
      for (const p of list) { p.t0 = t; t += ph.step[0] + (ph.step[1] - ph.step[0]) * rs(); }
    }
  }
  /** Падение с лёгким отскоком: доля высоты 1 → 0; ниже места не уходит. */
  const fall = (u: number) => {
    if (u <= 0) return 1;
    if (u >= 1) return 0;
    const s1 = 0.64, h = 0.07;
    if (u < s1) { const k = u / s1; return 1 - k * k; }
    const w = (u - s1) / (1 - s1);
    return h * 4 * w * (1 - w);
  };
  /** Пружина с лёгким перелётом (~6 %), оседает за ~0.6 с; аргумент — секунды. */
  const spring = (t: number) => t <= 0 ? 0 : 1 - Math.exp(-7.22 * t) * (Math.cos(8 * t) + 0.9025 * Math.sin(8 * t));
  const ease = (u: number) => { const k = Math.min(1, Math.max(0, u)); return k * k * k * (k * (k * 6 - 15) + 10); };
  const garage = parts.garage, gRest = garage.position.clone();
  const lawnGrow = parts.lawn.userData.lawn.grow as {value: number};
  const qTmp = new Quaternion(), sTmp = new Vector3(), pTmp = new Vector3(), mTmp = new Matrix4(), mOff = new Matrix4(), ZERO = new Vector3(1e-4, 1e-4, 1e-4);
  const camAt = (az: number, d: number) => {
    camera.position.set(target.x - Math.sin(az) * Math.cos(EL) * d, target.y + Math.sin(EL) * d, target.z - Math.cos(az) * Math.cos(EL) * d);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
  };
  const setBuildParts = (t: number) => {
    for (const p of pieces) {
      const dt = t - p.t0;
      p.o.visible = dt >= 0;
      if (dt < 0) continue;
      if (p.style === 'drop') p.o.position.copy(p.pos).setY(p.pos.y + p.dropH * fall(dt / DROP_T));
      else if (p.style === 'pop') p.o.scale.copy(p.scale).multiplyScalar(Math.max(1e-3, spring(dt)));
      else { const k = Math.max(1e-3, spring(dt * 0.85)); p.o.scale.set(p.scale.x * (0.35 + 0.65 * k), p.scale.y * k, p.scale.z * (0.35 + 0.65 * k)); }
      // черепица ложится рядами от карниза к коньку, когда скат лёг; потом конёк — по длине
      const cas = CASCADE ? p.o.userData.cascade as Cascade[] | undefined : undefined;
      if (cas) {
        const start = p.t0 + DROP_T * 0.8, ROW = 0.016, TILE_T = 0.32;
        const rows = Math.max(...cas.filter(c => !c.ridge).flatMap(c => c.order)) + 1;
        for (const c of cas) {
          const s0 = c.ridge ? start + rows * ROW + 0.06 : start, step = c.ridge ? 0.01 : ROW, lift = c.ridge ? 0.35 : 0.55;
          for (let i = 0; i < c.base.length; i++) {
            const u = (t - s0 - c.order[i] * step) / TILE_T;
            if (u < 0) { c.base[i].decompose(pTmp, qTmp, sTmp); c.mesh.setMatrixAt(i, mTmp.compose(pTmp, qTmp, ZERO)); continue; }
            c.mesh.setMatrixAt(i, mTmp.multiplyMatrices(mOff.makeTranslation(0, lift * fall(u), 0), c.base[i]));
          }
          c.mesh.instanceMatrix.needsUpdate = true;
        }
      }
    }
    // газон прорастает волной от фасада, когда подставка легла
    lawnGrow.value = ease((t - 0.12) / 0.8);
    garage.visible = false;                                 // в 1.1 ворот ещё нет
  };
  /** Ворота (сценарий 1.3): сбоку по нормали стены, медленный подход, пауза, щелчок; dt — с от начала. */
  const setGarage = (dt: number) => {
    {
      garage.visible = dt >= 0;
      let z = 0;
      if (dt < GARAGE.approach) { const u = Math.max(0, dt) / GARAGE.approach; z = -0.07 - (GARAGE.from - 0.07) * Math.pow(1 - u, 4); }
      else if (dt < GARAGE.approach + 0.12) z = -0.07;
      else if (dt < GARAGE.approach + 0.18) { const u = (dt - GARAGE.approach - 0.12) / 0.06; z = -0.07 + 0.082 * u * u; }
      else if (dt < GARAGE.approach + 0.3) { const u = (dt - GARAGE.approach - 0.18) / 0.12; z = 0.012 * (1 - u) * (1 - u); }
      garage.position.set(gRest.x, gRest.y, gRest.z + z);
    }
  };
  const setBuildCam = (t: number) => {
    // камера: облёт на 12° с лёгким наездом, к концу сборки — общий план
    const e = ease(t / 2.9);
    camAt(AZ - (12 * Math.PI / 180) * (1 - e), D_END * (1 + 0.1 * (1 - e)));
  };

  const setBuild = (t: number) => { setBuildParts(t); setBuildCam(t); };

  let composer: EffectComposer | null = null, size = '', aoPass: GTAOPass | null = null, aoOn = true;
  const setQuality = (q: {grassAA?: boolean; ao?: boolean; far?: [number, number]; clumps?: boolean; clumpS?: [number, number]; dens?: number; farGain?: number}) => {
    if (q.farGain) (parts.lawn.userData.lawn.farGain as {value: number}).value = q.farGain;
    if (q.dens) (parts.lawn.userData.lawn.densK as {value: number}).value = q.dens;
    if (q.clumpS) (parts.lawn.userData.lawn.clumpS as {value: Vector2}).value.set(q.clumpS[0], q.clumpS[1]);
    if (q.clumps !== undefined) (parts.lawn.userData.lawn.clumpK as {value: number}).value = q.clumps ? 1 : 0;
    if (q.grassAA !== undefined) (parts.lawn.userData.lawn.aa as {value: number}).value = q.grassAA ? 1 : 0;
    if (q.far) (parts.lawn.userData.lawn.farK as {value: Vector2}).value.set(q.far[0], q.far[1]);
    if (q.ao !== undefined) { aoOn = q.ao; if (aoPass) aoPass.enabled = aoOn; }
  };
  const out = document.createElement('canvas');
  const render = (W: number, H: number, ss = 2) => {
    const w = W * ss, h = H * ss;
    if (size !== `${w}x${h}`) {
      size = `${w}x${h}`;
      r.setPixelRatio(1);
      r.setSize(w, h, false);
      composer = new EffectComposer(r);
      composer.setPixelRatio(1);
      composer.setSize(w, h);
      composer.addPass(new RenderPass(scene, camera));
      const gtao = new GTAOPass(scene, camera, w, h);
      gtao.updateGtaoMaterial({radius: 1.2, distanceExponent: 1.4, thickness: 1.4, scale: 1.5, samples: 24, distanceFallOff: 1});
      gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16});
      // ворс газона и листва — квадраты/слои: в карту глубины GTAO их не пускаем
      const g = gtao as any, ov = g._overrideVisibility.bind(g);
      g._overrideVisibility = () => { ov(); scene.traverse(o => { if (o.userData.noAO && o.visible) { o.visible = false; g._visibilityCache.push(o); } }); };
      composer.addPass(gtao);
      aoPass = gtao;
      gtao.enabled = aoOn;
      const hts = new ShaderPass(HorizontalTiltShiftShader), vts = new ShaderPass(VerticalTiltShiftShader);
      hts.uniforms.h.value = 1.6 / w; hts.uniforms.r.value = 0.52;
      vts.uniforms.v.value = 1.6 / h; vts.uniforms.r.value = 0.52;
      composer.addPass(hts);
      composer.addPass(vts);
      composer.addPass(new OutputPass());
    }
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    composer!.render();
    if (out.width !== W || out.height !== H) { out.width = W; out.height = H; }
    const g = out.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(r.domElement, 0, 0, w, h, 0, 0, W, H);
    return out;
  };
  // ── режим лучей ──
  const pmremEnv = scene.environment, rasterBg = scene.background;
  const rasterOnly: Object3D[] = [sun, floor], traceOnly: Object3D[] = [];
  let traceBuilt = false;
  const buildTrace = () => {
    const ims: InstancedMesh[] = [];
    root.traverse(o => { if ((o as InstancedMesh).isInstancedMesh) ims.push(o as InstancedMesh); });
    for (const im of ims) { const b = bakeInstances(im); im.parent!.add(b); rasterOnly.push(im); traceOnly.push(b); }
    const lawn = parts.lawn.userData.lawn;
    rasterOnly.push(...lawn.shells);
    const toward = camera.position.clone().sub(target).applyMatrix4(new Matrix4().makeScale(-1, 1, 1));   // в осях раскладки (дом отражён)
    const blades = grassBlades(lawn, toward, 31);
    parts.lawn.add(blades);
    traceOnly.push(blades);
    // пол студии — настоящий: тень подставки на нём считает сам трассировщик
    const studio = new Mesh(new PlaneGeometry(400, 400), new MeshStandardMaterial({color: new Color('#b9bdc2'), roughness: 0.95, metalness: 0}));
    studio.rotation.x = -Math.PI / 2;
    studio.position.y = -0.95;
    scene.add(studio);
    traceOnly.push(studio);
    // ключ — большой софтбокс по направлению солнца: мягкая тень, как в студийном референсе
    const box = new RectAreaLight(new Color('#fff3e3'), 9, 16, 16);
    box.position.copy(sunDir).multiplyScalar(42);
    box.lookAt(0, 0, 0);
    scene.add(box);
    traceOnly.push(box);
  };
  const setTraceMode = (on: boolean) => {
    if (on && !traceBuilt) { buildTrace(); traceBuilt = true; }
    for (const o of rasterOnly) o.visible = !on;
    for (const o of traceOnly) o.visible = on;
    scene.environment = on ? assets.sky : pmremEnv;
    scene.background = on ? new Color('#b9bdc2') : rasterBg;
  };
  return {scene, camera, parts, render, setTraceMode, setBuild, setGarage, buildEnd: BUILD_END, setQuality};
}
