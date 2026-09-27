import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  InstancedMesh,
  LatheGeometry,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Quaternion,
  RectAreaLight,
  RepeatWrapping,
  Scene,
  Shape,
  SphereGeometry,
  SpotLight,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {CinemaLens} from './cinemaLens';
import {canvasTex, fabricTex, mulberry32, place, plasterTex, renderer, StudyModels} from './goodCodeOpening';

// ── Good Code, But I Hate It · дом в разрезе ────────────────────────────────
// Умный дом, как кукольный: передняя стена снята, видно все комнаты сразу. На
// срезе стены и перекрытия — тёмный «пошé», как на архитектурном разрезе.
// Закрыт только гараж: его ворота — единственное, что не видно насквозь.
// Сейчас дом нужен для вспышки «Except one» (2 с из будущего): сумерки, в окнах
// тёплый свет, гость в приложении жмёт «Garage» — ворота поднимаются, в гараже
// загорается свет. Позже этот же дом — правая половина раскладки «код + дом».
//
// ⚠️ Размеры — в метрах, фасад (плоскость среза) — z = 0, вглубь — −z.
// ⚠️ Свет только от предметов с телом: торшер, подвесы, ночники, лампа гаража.

const D2R = Math.PI / 180;
/** Глубина дома, ширина, высоты этажей. */
export const HOUSE = {
  W: 9.2, D: 5.0, PLINTH: 0.3, H1: 2.7, SLAB: 0.25, H2: 2.6, ATTIC_SLAB: 0.2, WALL: 0.25, PART: 0.12, PITCH: 32,
};
const Y1 = HOUSE.PLINTH;                              // пол первого этажа
const C1 = Y1 + HOUSE.H1;                             // потолок первого
const Y2 = C1 + HOUSE.SLAB;                           // пол второго
const C2 = Y2 + HOUSE.H2;                             // потолок второго
const YA = C2 + HOUSE.ATTIC_SLAB;                     // пол чердака = карниз
const EAVE_X = HOUSE.W / 2 + 0.35;                    // свес крыши
const RIDGE = YA + EAVE_X * Math.tan(HOUSE.PITCH * D2R);
const XL = -HOUSE.W / 2 + HOUSE.WALL, XR = HOUSE.W / 2 - HOUSE.WALL;   // внутренние грани боковых стен
/** Гараж и его ворота. */
export const GARAGE = {x0: XL, x1: -1.46, door: {x0: -4.1, x1: -1.7, h: 2.1}};

// ── Фактуры ──────────────────────────────────────────────────────────────────
function oakTex(rnd: () => number, planks: number, tone: [number, number, number]): CanvasTexture {
  const W = 512, H = 512;
  return canvasTex(W, H, g => {
    const img = g.createImageData(W, H);
    const ph = Array.from({length: planks}, () => rnd() * 50);
    const tint = Array.from({length: planks}, () => 0.9 + rnd() * 0.18);
    for (let y = 0; y < H; y++) {
      const pl = Math.floor((y / H) * planks);
      for (let x = 0; x < W; x++) {
        const s = 0.5 + 0.5 * Math.sin((x / W) * 40 + Math.sin(y / 23 + ph[pl]) * 1.4 + ph[pl]);
        const seam = (y % Math.floor(H / planks)) < 2 ? 0.72 : 1;
        const k = (0.88 + 0.12 * s) * seam * tint[pl];
        const i = (y * W + x) * 4;
        img.data[i] = tone[0] * k; img.data[i + 1] = tone[1] * k; img.data[i + 2] = tone[2] * k; img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });
}
function tileTex(base: string, grout: string, n: number): CanvasTexture {
  return canvasTex(256, 256, g => {
    g.fillStyle = grout; g.fillRect(0, 0, 256, 256);
    const s = 256 / n;
    g.fillStyle = base;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) g.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
  });
}
function seamTex(): CanvasTexture {
  // кровля: фальц, вертикальные рёбра
  return canvasTex(256, 64, g => {
    g.fillStyle = '#34363b'; g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#2a2c30';
    for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 3, 64);
  });
}
function boardTex(): CanvasTexture {
  // обшивка гаража: вертикальная доска
  return canvasTex(256, 256, g => {
    g.fillStyle = '#3b3530'; g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 21) { g.fillStyle = '#2b2622'; g.fillRect(x, 0, 2, 256); }
  });
}
function nightWindowTex(rnd: () => number): CanvasTexture {
  // стекло ночью: сумеречное небо и пара далёких огней
  return canvasTex(128, 128, g => {
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#0e1a33'); gr.addColorStop(1, '#2a3552');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = `rgba(255,${190 + rnd() * 40},120,${0.5 + rnd() * 0.4})`;
      g.beginPath(); g.arc(rnd() * 128, 70 + rnd() * 50, 1.5 + rnd() * 2, 0, Math.PI * 2); g.fill();
    }
  });
}

// ── Каркас ───────────────────────────────────────────────────────────────────
// пошé чуть светлее ночи: разрез дома читается на тёмном фоне
const POCHE = new MeshStandardMaterial({color: '#3a3b41', roughness: 1});
const HIDDEN = new MeshStandardMaterial({color: '#2a2a2e', roughness: 1});

/** Коробка каркаса: срез (грань +z) — пошé, остальные — hidden/заданные. */
function frameBox(scene: Object3D, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, faces: Partial<Record<'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz', Material>> = {}) {
  const m = new Mesh(new BoxGeometry(x1 - x0, y1 - y0, z1 - z0), [
    faces.px ?? HIDDEN, faces.nx ?? HIDDEN, faces.py ?? HIDDEN, faces.ny ?? HIDDEN, faces.pz ?? POCHE, faces.nz ?? HIDDEN,
  ]);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  scene.add(m);
  return m;
}

interface Room {x0: number; x1: number; y0: number; y1: number; wall: Material; floor: Material; ceil?: Material; left?: boolean; right?: boolean}
/** Отделка комнаты: пол, потолок, задняя и боковые стены — плоскости чуть внутри каркаса. */
function roomShell(scene: Object3D, r: Room, ceilMat: Material) {
  const D = HOUSE.D, w = r.x1 - r.x0, h = r.y1 - r.y0, e = 0.002;
  const add = (geo: BufferGeometry, mat: Material, p: Vector3, rx: number, ry: number) => {
    const m = new Mesh(geo, mat);
    m.position.copy(p); m.rotation.set(rx, ry, 0, 'YXZ');
    scene.add(m);
  };
  add(new PlaneGeometry(w, D), r.floor, new Vector3((r.x0 + r.x1) / 2, r.y0 + e, -D / 2), -Math.PI / 2, 0);
  add(new PlaneGeometry(w, D), r.ceil ?? ceilMat, new Vector3((r.x0 + r.x1) / 2, r.y1 - e, -D / 2), Math.PI / 2, 0);
  add(new PlaneGeometry(w, h), r.wall, new Vector3((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, -D + e), 0, 0);
  add(new PlaneGeometry(D, h), r.wall, new Vector3(r.x0 + e, (r.y0 + r.y1) / 2, -D / 2), 0, Math.PI / 2);
  add(new PlaneGeometry(D, h), r.wall, new Vector3(r.x1 - e, (r.y0 + r.y1) / 2, -D / 2), 0, -Math.PI / 2);
}

// ── Мебель и вещи ────────────────────────────────────────────────────────────
function rbox(w: number, h: number, d: number, mat: Material, p: Vector3, r = 0.02, ry = 0): Mesh {
  const m = new Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)), mat);
  m.position.copy(p);
  m.rotation.y = ry;
  return m;
}
function sofa(fab: Material, wood: Material): Group {
  const g = new Group();
  g.add(rbox(2.1, 0.42, 0.9, fab, new Vector3(0, 0.33, 0), 0.06));            // сиденье
  g.add(rbox(2.1, 0.5, 0.22, fab, new Vector3(0, 0.68, -0.34), 0.08));        // спинка
  for (const s of [-1, 1]) g.add(rbox(0.2, 0.55, 0.9, fab, new Vector3(s * 1.05, 0.42, 0), 0.08));
  for (let i = 0; i < 3; i++) g.add(rbox(0.64, 0.12, 0.7, fab, new Vector3(-0.66 + i * 0.66, 0.6, 0.05), 0.05));
  for (const s of [-1, 1]) for (const z of [-0.36, 0.36]) g.add(rbox(0.05, 0.12, 0.05, wood, new Vector3(s * 1.0, 0.06, z), 0.01));
  return g;
}
function bed(fab: Material, duvet: Material, wood: Material): Group {
  const g = new Group();
  g.add(rbox(1.7, 0.3, 2.1, wood, new Vector3(0, 0.2, 0), 0.03));             // основание
  g.add(rbox(1.64, 0.22, 2.0, fab, new Vector3(0, 0.46, 0), 0.06));          // матрас
  g.add(rbox(1.7, 0.1, 1.45, duvet, new Vector3(0, 0.6, 0.3), 0.05));        // одеяло
  for (const s of [-1, 1]) g.add(rbox(0.66, 0.16, 0.4, fab, new Vector3(s * 0.4, 0.66, -0.75), 0.07));
  g.add(rbox(1.8, 1.0, 0.1, wood, new Vector3(0, 0.62, -1.05), 0.03));       // изголовье
  return g;
}
/** Лампа с телом: абажур светится изнутри, рядом — настоящий свет. */
function lampShade(r0: number, r1: number, h: number, color: string): Mesh {
  const c = new Color(color);
  return new Mesh(new CylinderGeometry(r0, r1, h, 32, 1, true), new MeshBasicMaterial({color: c.multiplyScalar(2.2), side: DoubleSide}));
}
function floorLamp(metal: Material): Group {
  const g = new Group();
  g.add(new Mesh(new CylinderGeometry(0.16, 0.17, 0.02, 32), metal).translateY(0.01));
  g.add(new Mesh(new CylinderGeometry(0.012, 0.012, 1.45, 10), metal).translateY(0.74));
  g.add(lampShade(0.18, 0.24, 0.3, '#ffd6a0').translateY(1.52));
  return g;
}
function pendant(metal: Material, drop: number, glow: string): Group {
  const g = new Group();
  g.add(new Mesh(new CylinderGeometry(0.004, 0.004, drop, 6), new MeshBasicMaterial({color: '#111'})).translateY(-drop / 2));
  const dome = new Mesh(new LatheGeometry([new Vector2(0.004, 0.16), new Vector2(0.05, 0.15), new Vector2(0.14, 0.06), new Vector2(0.2, 0)], 40),
    new MeshStandardMaterial({color: '#23262b', roughness: 0.45, metalness: 0.5, side: DoubleSide}));
  dome.position.y = -drop - 0.16;
  g.add(dome);
  const bulb = new Mesh(new SphereGeometry(0.045, 16, 12), new MeshBasicMaterial({color: new Color(glow).multiplyScalar(4)}));
  bulb.position.y = -drop - 0.13;
  g.add(bulb);
  return g;
}
function smallLamp(metal: Material, color: string): Group {
  const g = new Group();
  g.add(new Mesh(new CylinderGeometry(0.06, 0.07, 0.02, 24), metal).translateY(0.01));
  g.add(new Mesh(new CylinderGeometry(0.008, 0.008, 0.28, 8), metal).translateY(0.15));
  g.add(lampShade(0.09, 0.12, 0.16, color).translateY(0.34));
  return g;
}
function art(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Group {
  const g = new Group();
  g.add(rbox(w + 0.06, h + 0.06, 0.03, new MeshStandardMaterial({color: '#161718', roughness: 0.5}), new Vector3(0, 0, 0), 0.005));
  const t = canvasTex(256, Math.round(256 * h / w), draw);
  const p = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({map: t, roughness: 0.8}));
  p.position.z = 0.016;
  g.add(p);
  return g;
}
function windowPane(w: number, h: number, glass: Material, frame: Material): Group {
  const g = new Group();
  const t = 0.05;
  const pane = new Mesh(new PlaneGeometry(w, h), glass);
  g.add(pane);
  for (const [bw, bh, x, y] of [[w + t, t, 0, h / 2], [w + t, t, 0, -h / 2], [t, h, -w / 2, 0], [t, h, w / 2, 0], [t * 0.6, h, 0, 0]] as const) {
    g.add(rbox(bw, bh, 0.05, frame, new Vector3(x, y, 0.02), 0.004));
  }
  return g;
}

// ── Дом ──────────────────────────────────────────────────────────────────────
export interface HouseParts {
  scene: Scene;
  /** Ворота: 0 — закрыты, 1 — открыты. */
  setDoor: (s: number) => void;
  /** Свет в гараже 0…1 (загорается с воротами). */
  setGarageLight: (k: number) => void;
}

export function buildHouse(models: StudyModels, car: Object3D | null): HouseParts {
  const rnd = mulberry32(3141);
  const scene = new Scene();
  const D = HOUSE.D, W = HOUSE.W;
  const plaster = plasterTex(rnd);
  const wallMat = (c: string) => new MeshStandardMaterial({color: c, roughness: 0.95, roughnessMap: plaster, bumpMap: plaster, bumpScale: 0.4});
  const oak = (planks: number, tone: [number, number, number], rep: number) => {
    const t = oakTex(rnd, planks, tone); t.repeat.set(rep, rep); t.wrapS = t.wrapT = RepeatWrapping;
    return new MeshStandardMaterial({map: t, roughness: 0.6});
  };
  const ceilMat = new MeshStandardMaterial({color: '#e8e4dc', roughness: 1});
  const metal = new MeshStandardMaterial({color: '#1c1d20', roughness: 0.35, metalness: 0.7});
  const walnut = oak(6, [120, 84, 58], 1);

  // ── каркас: цоколь, перекрытия, боковые стены, перегородки, задняя стена ──
  frameBox(scene, -W / 2, W / 2, 0, Y1, -D - HOUSE.WALL, 0);                                  // цоколь
  frameBox(scene, -W / 2, W / 2, C1, Y2, -D - HOUSE.WALL, 0);                                 // перекрытие 1
  frameBox(scene, -W / 2, W / 2, C2, YA, -D - HOUSE.WALL, 0);                                 // перекрытие 2
  frameBox(scene, -W / 2, XL, Y1, YA, -D - HOUSE.WALL, 0);                                    // левая стена
  frameBox(scene, XR, W / 2, Y1, YA, -D - HOUSE.WALL, 0);                                     // правая стена
  frameBox(scene, -W / 2, W / 2, Y1, YA, -D - HOUSE.WALL, -D, {pz: HIDDEN});                  // задняя стена
  const part = (x: number, y0: number, y1: number) => frameBox(scene, x - HOUSE.PART / 2, x + HOUSE.PART / 2, y0, y1, -D, 0);
  part(GARAGE.x1 + HOUSE.PART / 2, Y1, C1);                                                   // гараж | гостиная
  part(2.0, Y1, C1);                                                                          // гостиная | кухня
  part(-0.6, Y2, C2);                                                                         // спальня | ванная
  part(1.2, Y2, C2);                                                                          // ванная | кабинет

  // ── крыша: два ската, срез — пошé; сверху фальц, снизу доска чердака ──
  const roofLen = EAVE_X / Math.cos(HOUSE.PITCH * D2R);
  const seam = seamTex(); seam.repeat.set(3, 1);
  const roofTop = new MeshStandardMaterial({map: seam, roughness: 0.55, metalness: 0.35});
  const atticWood = oak(10, [170, 132, 92], 2);
  for (const s of [-1, 1]) {
    const slab = new Mesh(new BoxGeometry(roofLen + 0.12, 0.22, D + HOUSE.WALL + 0.35), [HIDDEN, HIDDEN, roofTop, atticWood, POCHE, HIDDEN]);
    // центр плиты — середина линии ската, сдвинутая наружу на полтолщины по нормали
    slab.position.set(s * EAVE_X / 2 + s * 0.11 * Math.sin(HOUSE.PITCH * D2R), (YA + RIDGE) / 2 + 0.11 * Math.cos(HOUSE.PITCH * D2R), -(D + HOUSE.WALL + 0.35) / 2);
    slab.rotation.z = -s * HOUSE.PITCH * D2R;
    scene.add(slab);
  }
  // задний фронтон: пятиугольник над карнизом
  // ⚠️ Верх фронтона — точно по нижней плоскости ската (от свеса), иначе между
  // ними светится полоска неба
  const tp = Math.tan(HOUSE.PITCH * D2R), eaveRise = (EAVE_X - W / 2) * tp;
  const gable = new Shape();
  gable.moveTo(-W / 2, 0); gable.lineTo(W / 2, 0); gable.lineTo(W / 2, eaveRise); gable.lineTo(0, EAVE_X * tp); gable.lineTo(-W / 2, eaveRise); gable.closePath();
  const gm = new Mesh(new ExtrudeGeometry(gable, {depth: HOUSE.WALL, bevelEnabled: false}), [wallMat('#cbbfae'), HIDDEN]);
  gm.position.set(0, YA, -D - HOUSE.WALL);
  scene.add(gm);
  // стропила: «А» уходят вглубь
  const rafter = new MeshStandardMaterial({color: '#8a6a4a', roughness: 0.8});
  // стропило — от стены (x = ±(W/2 − WALL)) до конька, прямо под плоскостью ската
  const rx0 = W / 2 - HOUSE.WALL, rLen = rx0 / Math.cos(HOUSE.PITCH * D2R);
  for (let z = -0.35; z > -D; z -= 0.8) for (const s of [-1, 1]) {
    const r = new Mesh(new BoxGeometry(rLen, 0.14, 0.06), rafter);
    const xc = s * rx0 / 2;
    r.position.set(xc, YA + (EAVE_X - Math.abs(xc)) * tp - 0.07 / Math.cos(HOUSE.PITCH * D2R), z);
    r.rotation.z = -s * HOUSE.PITCH * D2R;
    scene.add(r);
  }

  // ── комнаты ──
  const floorOak = oak(8, [196, 158, 116], 2);
  const floorOakDark = oak(8, [150, 112, 80], 2);
  const tiles = new MeshStandardMaterial({map: tileTex('#9ea39f', '#7c807d', 8), roughness: 0.4});
  const bathTiles = new MeshStandardMaterial({map: (() => { const t = tileTex('#e9ebe8', '#c9cbc8', 10); t.repeat.set(3, 2); return t; })(), roughness: 0.3});
  const concrete = new MeshStandardMaterial({color: '#6f6d69', roughness: 0.9, roughnessMap: plaster});
  const rooms: Room[] = [
    {x0: XL, x1: GARAGE.x1, y0: Y1, y1: C1, wall: wallMat('#8d8a84'), floor: concrete, ceil: wallMat('#8d8a84')},   // гараж
    {x0: GARAGE.x1 + HOUSE.PART, x1: 2.0 - HOUSE.PART / 2, y0: Y1, y1: C1, wall: wallMat('#d9d1c4'), floor: floorOak},   // гостиная
    {x0: 2.0 + HOUSE.PART / 2, x1: XR, y0: Y1, y1: C1, wall: wallMat('#b9c2b3'), floor: tiles},                        // кухня
    {x0: XL, x1: -0.6 - HOUSE.PART / 2, y0: Y2, y1: C2, wall: wallMat('#aeb6c2'), floor: floorOakDark},                // спальня
    {x0: -0.6 + HOUSE.PART / 2, x1: 1.2 - HOUSE.PART / 2, y0: Y2, y1: C2, wall: bathTiles, floor: tiles},             // ванная
    {x0: 1.2 + HOUSE.PART / 2, x1: XR, y0: Y2, y1: C2, wall: wallMat('#cfc6b8'), floor: floorOak},                     // кабинет
  ];
  for (const r of rooms) roomShell(scene, r, ceilMat);
  // чердак: пол и задний фронтон изнутри
  const atticFloor = new Mesh(new PlaneGeometry(W - 2 * HOUSE.WALL, D), atticWood);
  atticFloor.rotation.x = -Math.PI / 2;
  atticFloor.position.set(0, YA + 0.002, -D / 2);
  scene.add(atticFloor);

  const glass = new MeshBasicMaterial({map: nightWindowTex(rnd)});
  const frame = new MeshStandardMaterial({color: '#e6e1d8', roughness: 0.6});
  const onBack = (o: Object3D, x: number, y: number) => { o.position.set(x, y, -D + 0.012); scene.add(o); return o; };

  // ── гостиная: диван, столик, торшер, ковёр, растение, картина, окно, колонка ──
  const LIV = rooms[1];
  const sofaFab = new MeshStandardMaterial({map: fabricTex(rnd, [92, 98, 104]), roughness: 0.95});
  onBack(sofa(sofaFab, walnut), 0.35, Y1).position.z = -D + 0.55;
  const rug = new Mesh(new PlaneGeometry(2.4, 1.6), new MeshStandardMaterial({map: fabricTex(rnd, [150, 134, 116]), roughness: 1}));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0.35, Y1 + 0.006, -D + 1.7);
  scene.add(rug);
  const table = new Group();
  table.add(rbox(1.0, 0.04, 0.55, walnut, new Vector3(0, 0.38, 0), 0.01));
  for (const x of [-0.45, 0.45]) for (const z of [-0.22, 0.22]) table.add(rbox(0.03, 0.36, 0.03, metal, new Vector3(x, 0.18, z), 0.005));
  table.position.set(0.35, Y1, -D + 1.65);
  scene.add(table);
  const lampL = floorLamp(metal); lampL.position.set(LIV.x1 - 0.45, Y1, -D + 0.45); scene.add(lampL);
  const livLight = new PointLight(new Color('#ffc58a'), 7, 6.5, 2);
  livLight.position.set(LIV.x1 - 0.45, Y1 + 1.5, -D + 0.6);
  scene.add(livLight);
  const syn = models.syngonium.clone(); place(syn, new Vector3(LIV.x0 + 0.45, Y1, -D + 0.45), 0.5, 1.25); scene.add(syn);
  onBack(art(1.1, 0.7, g => {
    g.fillStyle = '#e8dfcf'; g.fillRect(0, 0, 256, 163);
    g.fillStyle = '#c96f4f'; g.beginPath(); g.arc(90, 80, 44, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2f4a5e'; g.fillRect(140, 40, 70, 90);
  }), 0.35, Y1 + 1.72);
  onBack(windowPane(0.9, 1.1, glass, frame), LIV.x1 - 1.2, Y1 + 1.55).visible = false;   // окно гостиной — за картиной места нет
  // умная колонка на тумбе у дивана
  const stand = rbox(0.4, 0.5, 0.4, walnut, new Vector3(-0.95, Y1 + 0.25, -D + 0.45), 0.02); scene.add(stand);
  const speaker = new Mesh(new CylinderGeometry(0.06, 0.065, 0.2, 32), new MeshStandardMaterial({map: fabricTex(rnd, [60, 62, 66]), roughness: 1}));
  speaker.position.set(-0.95, Y1 + 0.6, -D + 0.45); scene.add(speaker);
  const ring = new Mesh(new TorusGeometry(0.05, 0.006, 8, 32), new MeshBasicMaterial({color: new Color(0.9, 1.6, 2.2)}));
  ring.rotation.x = Math.PI / 2; ring.position.set(-0.95, Y1 + 0.705, -D + 0.45); scene.add(ring);
  // камера под потолком в углу
  const cam = new Group();
  cam.add(rbox(0.12, 0.08, 0.1, new MeshStandardMaterial({color: '#e9e9e6', roughness: 0.4}), new Vector3(0, 0, 0), 0.02));
  cam.add(new Mesh(new CircleGeometry(0.025, 20), new MeshBasicMaterial({color: '#0b0c0e'})).translateZ(0.051));
  cam.position.set(LIV.x0 + 0.2, C1 - 0.18, -D + 0.25); cam.rotation.y = 0.5; scene.add(cam);

  // ── кухня: столешница с фасадами, полка, холодильник, подвес над столом ──
  const KIT = rooms[2];
  const fronts = oak(1, [205, 170, 128], 1);
  const stone = new MeshPhysicalMaterial({color: '#d9d6cf', roughness: 0.35, clearcoat: 0.4});
  const runW = KIT.x1 - KIT.x0 - 0.85;
  scene.add(rbox(runW, 0.86, 0.6, fronts, new Vector3(KIT.x0 + runW / 2 + 0.02, Y1 + 0.43, -D + 0.32), 0.01));
  scene.add(rbox(runW + 0.02, 0.04, 0.62, stone, new Vector3(KIT.x0 + runW / 2 + 0.02, Y1 + 0.88, -D + 0.32), 0.005));
  scene.add(rbox(runW, 0.03, 0.28, fronts, new Vector3(KIT.x0 + runW / 2 + 0.02, Y1 + 1.65, -D + 0.15), 0.005));
  const ceramic = ['#e9e2d6', '#b8543f', '#2f4a5e', '#d8c7a0'].map(c => new MeshPhysicalMaterial({color: c, roughness: 0.35, clearcoat: 0.5}));
  for (let i = 0; i < 7; i++) {
    const h = 0.12 + rnd() * 0.1, r = 0.04 + rnd() * 0.03;
    const j = new Mesh(new LatheGeometry([new Vector2(0, 0), new Vector2(r, 0), new Vector2(r, h * 0.85), new Vector2(r * 0.7, h), new Vector2(0, h)], 24), ceramic[i % 4]);
    j.position.set(KIT.x0 + 0.2 + i * 0.22, Y1 + 1.665, -D + 0.15); scene.add(j);
  }
  scene.add(rbox(0.75, 1.9, 0.68, new MeshPhysicalMaterial({color: '#e8e6e1', roughness: 0.35, clearcoat: 0.4}), new Vector3(KIT.x1 - 0.42, Y1 + 0.95, -D + 0.38), 0.03));
  const kTable = new Group();
  kTable.add(new Mesh(new CylinderGeometry(0.42, 0.42, 0.035, 40), walnut).translateY(0.74));
  kTable.add(new Mesh(new CylinderGeometry(0.03, 0.05, 0.72, 16), metal).translateY(0.36));
  kTable.position.set((KIT.x0 + KIT.x1) / 2 - 0.2, Y1, -D + 2.4); scene.add(kTable);
  const pendK = pendant(metal, 0.7, '#ffc88e'); pendK.position.set((KIT.x0 + KIT.x1) / 2 - 0.2, C1, -D + 2.4); scene.add(pendK);
  const kitLight = new PointLight(new Color('#ffc07c'), 6, 6, 2);
  kitLight.position.set((KIT.x0 + KIT.x1) / 2 - 0.2, C1 - 1.0, -D + 2.4); scene.add(kitLight);
  onBack(windowPane(0.8, 0.7, glass, frame), KIT.x0 + runW / 2, Y1 + 1.25).position.z = -D + 0.016;

  // ── спальня: кровать, тумбы с ночниками, окно с жалюзи ──
  const BED = rooms[3];
  const bedFab = new MeshStandardMaterial({map: fabricTex(rnd, [205, 200, 190]), roughness: 1});
  const duvet = new MeshStandardMaterial({map: fabricTex(rnd, [120, 132, 150]), roughness: 1});
  const bd = bed(bedFab, duvet, walnut); bd.position.set((BED.x0 + BED.x1) / 2 + 0.2, Y2, -D + 1.15); scene.add(bd);
  for (const s of [-1, 1]) {
    const x = (BED.x0 + BED.x1) / 2 + 0.2 + s * 1.2;
    scene.add(rbox(0.45, 0.45, 0.4, walnut, new Vector3(x, Y2 + 0.225, -D + 0.3), 0.02));
    const l = smallLamp(metal, '#ffd9a8'); l.position.set(x, Y2 + 0.45, -D + 0.3); scene.add(l);
  }
  const bedLight = new PointLight(new Color('#ffbf80'), 4, 5, 2);
  bedLight.position.set((BED.x0 + BED.x1) / 2 + 0.2, Y2 + 1.0, -D + 0.6); scene.add(bedLight);
  const win = onBack(windowPane(1.0, 1.0, glass, frame), BED.x0 + 0.75, Y2 + 1.55) as Group;
  win.position.x = BED.x0 + 0.72;
  // жалюзи: ламели, прикрыты наполовину
  for (let i = 0; i < 9; i++) {
    const sl = new Mesh(new BoxGeometry(1.02, 0.008, 0.06), new MeshStandardMaterial({color: '#e2ddd3', roughness: 0.6}));
    sl.position.set(BED.x0 + 0.72, Y2 + 2.02 - i * 0.055, -D + 0.07); sl.rotation.x = 0.6; scene.add(sl);
  }

  // ── ванная: ванна, раковина, зеркало, свет холодный ──
  const BTH = rooms[4];
  const white = new MeshPhysicalMaterial({color: '#f2f1ee', roughness: 0.2, clearcoat: 0.7});
  scene.add(rbox(1.5, 0.55, 0.75, white, new Vector3((BTH.x0 + BTH.x1) / 2, Y2 + 0.275, -D + 0.4), 0.08));
  const water = new Mesh(new PlaneGeometry(1.3, 0.55), new MeshPhysicalMaterial({color: '#9fb8c4', roughness: 0.05, transmission: 0, opacity: 1}));
  water.rotation.x = -Math.PI / 2; water.position.set((BTH.x0 + BTH.x1) / 2, Y2 + 0.5, -D + 0.4); scene.add(water);
  const mirror = new Mesh(new PlaneGeometry(0.7, 0.9), new MeshPhysicalMaterial({color: '#aab4bc', roughness: 0.05, metalness: 1}));
  mirror.position.set(BTH.x1 - 0.005, Y2 + 1.55, -D + 2.0); mirror.rotation.y = -Math.PI / 2; scene.add(mirror);
  scene.add(rbox(0.5, 0.12, 0.45, white, new Vector3(BTH.x1 - 0.26, Y2 + 0.85, -D + 2.0), 0.03));
  const bathLight = new PointLight(new Color('#eef3ff'), 3.5, 4, 2);
  bathLight.position.set((BTH.x0 + BTH.x1) / 2, C2 - 0.3, -D + 1.5); scene.add(bathLight);
  const bathFix = new Mesh(new CylinderGeometry(0.16, 0.16, 0.03, 32), new MeshBasicMaterial({color: new Color(2.6, 2.7, 2.9)}));
  bathFix.position.set((BTH.x0 + BTH.x1) / 2, C2 - 0.015, -D + 1.5); scene.add(bathFix);

  // ── кабинет: стол с монитором, лампа, стеллаж с книгами, термостат ──
  const STD = rooms[5];
  scene.add(rbox(1.5, 0.04, 0.7, walnut, new Vector3(STD.x0 + 1.1, Y2 + 0.74, -D + 0.4), 0.01));
  for (const x of [-0.7, 0.7]) scene.add(rbox(0.04, 0.72, 0.62, metal, new Vector3(STD.x0 + 1.1 + x, Y2 + 0.36, -D + 0.4), 0.005));
  scene.add(rbox(0.6, 0.36, 0.03, metal, new Vector3(STD.x0 + 1.1, Y2 + 1.1, -D + 0.25), 0.008));
  const code = canvasTex(256, 144, g => {
    g.fillStyle = '#17181c'; g.fillRect(0, 0, 256, 144);
    const cols = ['#A3CDFF', '#FF8CA3', 'rgba(244,241,235,0.8)', '#94C086'];
    for (let i = 0; i < 12; i++) {
      g.fillStyle = cols[i % 4];
      g.fillRect(16 + (i % 3) * 14, 12 + i * 10, 60 + ((i * 37) % 120), 4);
    }
  });
  const scr = new Mesh(new PlaneGeometry(0.56, 0.32), new MeshBasicMaterial({map: code, color: new Color(1.3, 1.3, 1.3)}));
  scr.position.set(STD.x0 + 1.1, Y2 + 1.1, -D + 0.268); scene.add(scr);
  const dl = smallLamp(metal, '#ffd8a0'); dl.position.set(STD.x0 + 0.5, Y2 + 0.76, -D + 0.35); dl.scale.setScalar(0.8); scene.add(dl);
  const stdLight = new PointLight(new Color('#ffc588'), 4.5, 5, 2);
  stdLight.position.set(STD.x0 + 0.8, Y2 + 1.3, -D + 0.8); scene.add(stdLight);
  // стеллаж у правой стены, книги
  const shelfX = STD.x1 - 0.22;
  for (let k = 0; k < 5; k++) scene.add(rbox(0.36, 0.03, 1.4, walnut, new Vector3(shelfX, Y2 + 0.3 + k * 0.45, -D + 1.9), 0.005));
  const bookColors = ['#6b2f2a', '#2f4a5e', '#8a7a5c', '#3d3d3d', '#5c4a3a', '#2c3b2e', '#9a8f80'];
  const books = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({roughness: 0.8}), 60);
  let bi = 0;
  const mtx = new Matrix4();
  for (let k = 0; k < 4 && bi < 60; k++) {
    let z = -D + 1.25;
    while (z < -D + 2.55 && bi < 60) {
      const t = 0.025 + rnd() * 0.03, h = 0.22 + rnd() * 0.12;
      mtx.compose(new Vector3(shelfX, Y2 + 0.315 + k * 0.45 + h / 2, z + t / 2), new Quaternion(), new Vector3(0.24, h, t));
      books.setMatrixAt(bi, mtx); books.setColorAt(bi, new Color(bookColors[bi % bookColors.length])); bi++;
      z += t + 0.004 + (rnd() < 0.12 ? 0.1 : 0);
    }
  }
  books.count = bi;
  scene.add(books);
  const thermo = new Mesh(new CylinderGeometry(0.05, 0.05, 0.02, 32), new MeshStandardMaterial({color: '#e8e6e1', roughness: 0.3}));
  thermo.rotation.z = Math.PI / 2; thermo.position.set(STD.x0 + 0.012, Y2 + 1.45, -D + 2.6); scene.add(thermo);
  const thermoDot = new Mesh(new CircleGeometry(0.018, 20), new MeshBasicMaterial({color: new Color(2.4, 1.6, 0.9)}));
  thermoDot.rotation.y = Math.PI / 2; thermoDot.position.set(STD.x0 + 0.023, Y2 + 1.45, -D + 2.6); scene.add(thermoDot);

  // ── чердак: коробки, лампочка, круглое окно ──
  const box = new MeshStandardMaterial({color: '#a88760', roughness: 0.95});
  for (const [x, z, s] of [[-1.6, -1.2, 0.5], [-1.1, -1.5, 0.4], [1.5, -1.0, 0.45], [2.0, -1.8, 0.35]] as const) scene.add(rbox(s, s * 0.8, s, box, new Vector3(x, YA + s * 0.4, z), 0.01));
  const bulb = new Mesh(new SphereGeometry(0.05, 16, 12), new MeshBasicMaterial({color: new Color(4, 3, 1.8)}));
  bulb.position.set(0.3, RIDGE - 1.2, -2.2); scene.add(bulb);
  const atticLight = new PointLight(new Color('#ffbd7a'), 2.2, 4.5, 2);
  atticLight.position.copy(bulb.position); scene.add(atticLight);
  const round = new Mesh(new CircleGeometry(0.4, 40), glass);
  round.position.set(0, YA + 1.1, -D + 0.01); scene.add(round);
  const roundFrame = new Mesh(new TorusGeometry(0.4, 0.035, 10, 48), frame);
  roundFrame.position.set(0, YA + 1.1, -D + 0.02); scene.add(roundFrame);

  // ── гараж: машина, стеллаж, фасад с воротами, свет ворот ──
  const GAR = rooms[0];
  if (car) {
    const c = car.clone();
    c.rotation.y = 0;                                         // морда к воротам
    c.position.set((GAR.x0 + GAR.x1) / 2, Y1, -D / 2 - 0.2);
    c.scale.setScalar(0.95);
    scene.add(c);
  }
  for (let k = 0; k < 3; k++) scene.add(rbox(0.4, 0.03, 1.6, metal, new Vector3(GAR.x0 + 0.22, Y1 + 0.5 + k * 0.6, -D + 1.2), 0.005));
  for (let k = 0; k < 6; k++) scene.add(rbox(0.3, 0.25, 0.35, box, new Vector3(GAR.x0 + 0.22, Y1 + 0.66 + (k % 3) * 0.6, -D + 0.6 + Math.floor(k / 3) * 0.8), 0.01));
  const clad = boardTex(); clad.repeat.set(2, 1);
  const cladMat = new MeshStandardMaterial({map: clad, roughness: 0.85});
  const dz0 = -HOUSE.WALL, dz1 = 0;
  const dr = GARAGE.door;
  frameBox(scene, GAR.x0 - HOUSE.WALL, dr.x0, Y1, C1, dz0, dz1, {pz: cladMat});          // левый простенок
  frameBox(scene, dr.x1, GAR.x1 + HOUSE.PART, Y1, C1, dz0, dz1, {pz: cladMat});           // правый
  frameBox(scene, dr.x0, dr.x1, Y1 + dr.h, C1, dz0, dz1, {pz: cladMat});                  // перемычка
  // секционные ворота: 4 панели по направляющей — вверх, дуга, назад под потолок
  const PANEL_H = dr.h / 4;
  const panelTex = canvasTex(256, 64, g => {
    g.fillStyle = '#2c2e33'; g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#25272b'; g.fillRect(0, 30, 256, 4);
    g.fillStyle = '#34363b'; g.fillRect(0, 0, 256, 2);
  });
  const panelMat = new MeshStandardMaterial({map: panelTex, roughness: 0.55, metalness: 0.3});
  const panels = Array.from({length: 4}, () => {
    const p = new Mesh(new BoxGeometry(dr.x1 - dr.x0 - 0.02, PANEL_H - 0.006, 0.045), panelMat);
    scene.add(p);
    return p;
  });
  const ZT = dz0 - 0.04, LV = dr.h + 0.05, R = 0.35;
  const track = (L: number): {y: number; z: number; a: number} => {
    if (L <= LV) return {y: Y1 + L, z: ZT, a: 0};
    const bend = R * Math.PI / 2;
    if (L <= LV + bend) { const th = (L - LV) / R; return {y: Y1 + LV + R * Math.sin(th), z: ZT - R + R * Math.cos(th), a: th}; }
    return {y: Y1 + LV + R, z: ZT - R - (L - LV - bend), a: Math.PI / 2};
  };
  const setDoor = (s: number) => {
    panels.forEach((p, i) => {
      const L = i * PANEL_H + PANEL_H / 2 + s * dr.h;
      const q = track(L);
      p.position.set((dr.x0 + dr.x1) / 2, q.y, q.z);
      p.rotation.x = -q.a;                     // верх панели уходит назад
    });
  };
  setDoor(0);
  // свет гаража: плафон под потолком и тёплое пятно наружу, на подъезд
  const garFix = new Mesh(new BoxGeometry(1.2, 0.03, 0.12), new MeshBasicMaterial({color: new Color(0.05, 0.05, 0.05)}));
  garFix.position.set((GAR.x0 + GAR.x1) / 2, C1 - 0.02, -D / 2); scene.add(garFix);
  const garLight = new RectAreaLight(new Color('#f4f1ea'), 0, 1.2, 0.12);
  garLight.position.set((GAR.x0 + GAR.x1) / 2, C1 - 0.04, -D / 2); garLight.lookAt((GAR.x0 + GAR.x1) / 2, Y1, -D / 2);
  scene.add(garLight);
  const spill = new SpotLight(new Color('#f1ece2'), 0, 12, 48 * D2R, 0.7, 2);
  spill.position.set((dr.x0 + dr.x1) / 2, C1 - 0.2, -1.2);
  spill.target.position.set((dr.x0 + dr.x1) / 2, 0, 5);
  scene.add(spill, spill.target);
  const setGarageLight = (k: number) => {
    garLight.intensity = 14 * k;
    spill.intensity = 30 * k;
    (garFix.material as MeshBasicMaterial).color.setScalar(0.05 + 3.2 * k);
  };

  // ── снаружи: газон, подъезд, небо, деревья, дальние огни ──
  const lawnTex = canvasTex(256, 256, g => {
    const img = g.createImageData(256, 256);
    let a = 11;
    for (let i = 0; i < 256 * 256; i++) {
      a = (a * 1664525 + 1013904223) >>> 0;
      const n = ((a >>> 24) - 128) * 0.12;
      img.data[i * 4] = 46 + n * 0.6; img.data[i * 4 + 1] = 58 + n; img.data[i * 4 + 2] = 48 + n * 0.6; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
  lawnTex.repeat.set(30, 30);
  const lawn = new Mesh(new PlaneGeometry(90, 70), new MeshStandardMaterial({map: lawnTex, roughness: 1}));
  lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, 0, -5); scene.add(lawn);
  const drive = new Mesh(new PlaneGeometry(dr.x1 - dr.x0 + 0.4, 16), new MeshStandardMaterial({color: '#5f5d59', roughness: 0.9, roughnessMap: plaster}));
  drive.rotation.x = -Math.PI / 2; drive.position.set((dr.x0 + dr.x1) / 2, 0.01, 8); scene.add(drive);
  // пандус к воротам: с земли на пол гаража
  const ramp = new Mesh(new BoxGeometry(dr.x1 - dr.x0 + 0.4, 0.02, 1.2), drive.material);
  ramp.position.set((dr.x0 + dr.x1) / 2, Y1 / 2, 0.6); ramp.rotation.x = Math.atan2(Y1, 1.2); scene.add(ramp);
  // небо с кромкой леса: низкий силуэт крон у горизонта (шары-деревья читались
  // тёмными пятнами и сливались с домом)
  const skyTex = canvasTex(1024, 256, g => {
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#0b1224'); gr.addColorStop(0.55, '#1b2a4a'); gr.addColorStop(0.8, '#3d3f5c'); gr.addColorStop(0.84, '#6b5560');
    g.fillStyle = gr; g.fillRect(0, 0, 1024, 256);
    g.fillStyle = '#080a0e';
    const horizon = 256 * (15 / 90);                      // y = 0 мира — в нижней шестой неба
    g.fillRect(0, 256 - horizon, 1024, horizon);
    for (let x = -10; x < 1034; x += 6 + rnd() * 10) {
      const r = 5 + rnd() * 9;
      g.beginPath(); g.arc(x, 256 - horizon - r * 0.4 - rnd() * 6, r, 0, Math.PI * 2); g.fill();
    }
  });
  const sky = new Mesh(new PlaneGeometry(260, 90), new MeshBasicMaterial({map: skyTex}));
  sky.position.set(0, 30, -80); scene.add(sky);
  for (let i = 0; i < 14; i++) {
    const l = new Mesh(new SphereGeometry(0.12, 8, 6), new MeshBasicMaterial({color: new Color(5, 3.3, 1.8)}));
    l.position.set(-30 + rnd() * 60, 1 + rnd() * 5, -40 - rnd() * 20); scene.add(l);
  }
  // свет сумерек: небо сверху, луна слева спереди — лепит срез и крышу
  scene.add(new HemisphereLight(0x3a4a6c, 0x100e0a, 0.45));
  const moon = new DirectionalLight(new Color('#9fb0e6'), 0.55);
  moon.position.set(-12, 18, 20); scene.add(moon);

  return {scene, setDoor, setGarageLight};
}

// ── Вспышка «Except one»: дом, гость жмёт «Garage», ворота поднимаются ────────
export const FLASH = {
  dur: 2.0,
  tap: 0.35,              // касание плитки «Garage»
  open: [0.5, 1.9] as [number, number],
};

interface CardTile {label: string; state: string}
const TILES: CardTile[] = [
  {label: 'Lights', state: 'On'}, {label: 'Front door', state: 'Locked'},
  {label: 'Thermostat', state: '21°'}, {label: 'Garage', state: 'Closed'},
];

/** Карточка приложения в режиме гостя — минимальная, как iOS: тени, слои, без обводок. */
function drawCard(g: CanvasRenderingContext2D, W: number, H: number, t: number) {
  const s = H / 1080;
  const cw = 520 * s, ch = 420 * s, x0 = W * 0.69, y0 = H * 0.5 - ch / 2;
  const pressed = t >= FLASH.tap;
  const press = t >= FLASH.tap && t < FLASH.tap + 0.12 ? 0.97 : 1;
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 60 * s; g.shadowOffsetY = 18 * s;
  g.fillStyle = 'rgba(22,24,30,0.9)';
  g.beginPath(); g.roundRect(x0, y0, cw, ch, 34 * s); g.fill();
  g.restore();
  g.textBaseline = 'alphabetic';
  g.fillStyle = 'rgba(244,241,235,0.5)';
  g.font = `700 ${17 * s}px Manrope, sans-serif`;
  (g as any).letterSpacing = `${2.4 * s}px`;
  g.fillText('GUEST ACCESS', x0 + 38 * s, y0 + 58 * s);
  (g as any).letterSpacing = '0px';
  g.fillStyle = 'rgba(244,241,235,0.94)';
  g.font = `700 ${31 * s}px Manrope, sans-serif`;
  g.fillText('14 Maple Street', x0 + 38 * s, y0 + 100 * s);
  const tw = (cw - 38 * s * 2 - 16 * s) / 2, th = 116 * s;
  TILES.forEach((tile, i) => {
    const tx = x0 + 38 * s + (i % 2) * (tw + 16 * s), ty = y0 + 138 * s + Math.floor(i / 2) * (th + 16 * s);
    const isGarage = tile.label === 'Garage';
    const k = isGarage && pressed ? press : 1;
    g.save();
    g.translate(tx + tw / 2, ty + th / 2); g.scale(k, k); g.translate(-(tx + tw / 2), -(ty + th / 2));
    g.fillStyle = isGarage && pressed ? '#FF8CA3' : 'rgba(255,255,255,0.07)';
    g.beginPath(); g.roundRect(tx, ty, tw, th, 22 * s); g.fill();
    const ink = isGarage && pressed ? '#1b1c21' : 'rgba(244,241,235,0.92)';
    g.fillStyle = ink;
    g.font = `700 ${23 * s}px Manrope, sans-serif`;
    g.fillText(tile.label, tx + 22 * s, ty + 46 * s);
    g.fillStyle = isGarage && pressed ? 'rgba(27,28,33,0.7)' : 'rgba(244,241,235,0.5)';
    g.font = `400 ${19 * s}px Manrope, sans-serif`;
    g.fillText(isGarage && pressed ? 'Opening' : tile.state, tx + 22 * s, ty + 84 * s);
    g.restore();
  });
}

export interface HouseFlash {
  /** Кадр вспышки в момент t ∈ [0, FLASH.dur]. */
  render: (t: number, W: number, H: number) => HTMLCanvasElement;
  house: HouseParts;
}

export function buildHouseFlash(models: StudyModels, car: Object3D | null): HouseFlash {
  const house = buildHouse(models, car);
  const camera = new PerspectiveCamera(28, 16 / 9, 0.5, 400);
  // кадр: дом — в левых двух третях, справа — карточка; подобрано проекцией
  const CAM_POS = new Vector3(3.2, 4.6, 22.5), LOOK = new Vector3(2.6, 4.25, -2.0);
  let lens: CinemaLens | null = null;
  const out = document.createElement('canvas');
  const g = out.getContext('2d')!;
  const render = (t: number, W: number, H: number) => {
    const r = renderer();
    if (!lens) lens = new CinemaLens(r);
    const s = Math.min(1, Math.max(0, (t - FLASH.open[0]) / (FLASH.open[1] - FLASH.open[0])));
    const e = s * s * (3 - 2 * s);
    house.setDoor(e * 0.92);
    house.setGarageLight(Math.min(1, Math.max(0, (t - FLASH.open[0]) / 0.25)));
    // лёгкий наезд — кадр живой
    camera.position.copy(CAM_POS).lerp(new Vector3(3.0, 4.55, 21.8), t / FLASH.dur);
    camera.lookAt(LOOK);
    camera.fov = 28;
    camera.updateMatrixWorld(true);
    const frame = lens.render(house.scene, camera, W, H, {
      focus: CAM_POS.distanceTo(new Vector3(-1, 3.5, 0)), K: 380, maxR: 26, exposure: 1.05, time: t, grain: 0.035, vignette: 0.38,
    });
    if (out.width !== W || out.height !== H) { out.width = W; out.height = H; }
    g.drawImage(frame, 0, 0, W, H);
    drawCard(g, W, H, t);
    return out;
  };
  return {render, house};
}
