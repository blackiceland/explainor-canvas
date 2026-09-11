import {createSignal, SimpleSignal} from '@motion-canvas/core';
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BackSide,
  Box3,
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  PMREMGenerator,
  Scene,
  ShadowMaterial,
  Vector3,
  WebGLRenderer,
} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Screen} from '../theme';

// ── Площадка зарядки: общий мир главы ──────────────────────────────────────
// Одна и та же улица и одно и то же депо живут во всех актах главы, поэтому
// расстановка, свет и материалы собраны здесь, а не в сцене. В сцене остаётся
// только то, что она РАССКАЗЫВАЕТ: свои реакции мира, своя камера, свой код.
//
// ⚠️ Числа не подбирать заново. Позиции, углы и параметры света выверены в
// chargingHeroDemoScene (акт 1) и приняты автором; любое отличие читается как
// «другое место», а это та же самая станция.
// ⚠️ Акт 1 пока держит СВОЮ копию этой сборки — он принят, и трогать его до
// приёмки акта 2 нельзя. Как только акт 2 принят, chargingHeroDemoScene надо
// перевести на этот модуль и копию удалить.

export const CAR_URL = '/honda_e.glb';
export const POST_URL = '/charging_station.glb';
export const VAN_URL = '/fedex_van.glb';

export const D2R = Math.PI / 180;

/** Лицо стойки при rotation.y = 0 смотрит в +X. */
export const faceTo = (dx: number, dz: number) => Math.atan2(-dz, dx);

/** Полярная камера: азимут отсчитывается от +Z к +X. */
export function orbit(az: number, el: number, dist: number, t: Vector3): Vector3 {
  const ce = Math.cos(el);
  return new Vector3(
    t.x + Math.sin(az) * ce * dist,
    t.y + Math.sin(el) * dist,
    t.z + Math.cos(az) * ce * dist,
  );
}

// Съёмочный павильон для отражений (в кадре его нет — только в бликах кузова).
// Верх светлый, низ тёмный, тёплый ключевой софтбокс и холодный заполняющий:
// это даёт борту вертикальный перепад и линию горизонта.
export function makeStudioEnv(): Scene {
  const env = new Scene();
  const wall = new Mesh(new BoxGeometry(), new MeshBasicMaterial({color: '#171B24', side: BackSide}));
  wall.scale.set(26, 16, 26);
  wall.position.set(0, 6, 0);
  env.add(wall);
  const ceil = new Mesh(new PlaneGeometry(24, 24), new MeshBasicMaterial({color: '#C3D2E8'}));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = 13.6; env.add(ceil);
  const floor = new Mesh(new PlaneGeometry(24, 24), new MeshBasicMaterial({color: '#080A0E'}));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.6; env.add(floor);
  const keyCard = new Mesh(new PlaneGeometry(9, 6), new MeshBasicMaterial({color: '#FFE9C8'}));
  keyCard.position.set(7.5, 7.0, 5.5); keyCard.lookAt(0, 1.2, 0); env.add(keyCard);
  const fillCard = new Mesh(new PlaneGeometry(7, 5), new MeshBasicMaterial({color: '#3E5A80'}));
  fillCard.position.set(-7.5, 4.5, -5.0); fillCard.lookAt(0, 1.2, 0); env.add(fillCard);
  return env;
}

// Автокраска приходит зеркальной (roughness 0) — любой направленный источник
// рисует жёсткую белую точку. Базу грубим, лак оставляем почти гладким.
export function dress(root: Object3D, minRough: number, coatRough = 0.07): void {
  root.traverse((n: any) => {
    if (!n.isMesh) return;
    n.castShadow = true;
    n.receiveShadow = true;
    const m = n.material as MeshPhysicalMaterial;
    if (m.roughness !== undefined && m.roughness < minRough) m.roughness = minRough;
    if ((m as any).clearcoat > 0 && (m as any).clearcoatRoughness !== undefined) {
      (m as any).clearcoatRoughness = Math.max((m as any).clearcoatRoughness, coatRough);
    }
    // У CarPaintWhite нет baseColorFactor — по умолчанию glTF это альбедо 1.0,
    // физически невозможное даже для белой краски («виниры»). Сажаем в реальность.
    if (/CarPaint(White)?$/i.test(m.name || '') && m.color && !(m as any).map) {
      if (m.color.r > 0.95 && m.color.g > 0.95 && m.color.b > 0.95) {
        m.color.setRGB(0.845, 0.833, 0.808);
      }
    }
  });
}

export function ground0(root: Object3D): void {
  const b = new Box3().setFromObject(root);
  root.position.y -= b.min.y;
}

// Невидимая плоскость-приёмник тени: машины стоят прямо на графите фона,
// но контактная тень остаётся — объект не висит.
function shadowCatcher(): Mesh {
  const m = new Mesh(new PlaneGeometry(200, 200), new ShadowMaterial({opacity: 0.4}));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

/** Три источника одной сцены — наружу, чтобы сцена могла погасить день. */
export interface StageLights {
  key: DirectionalLight;
  rim: DirectionalLight;
  hemi: HemisphereLight;
}

/** Стойка депо: узел и её собственные материалы — свет каждой правится отдельно. */
export interface DepotPost {
  node: Object3D;
  mats: MeshStandardMaterial[];
}

export interface ChargingStage {
  scene3: Scene;                 // улица: стойка и Honda e
  sceneD: Scene;                 // депо: два ряда фургонов и остров стоек
  car: Object3D;
  post: Object3D;
  depot: Object3D;
  vans: Object3D[];
  postMats: MeshStandardMaterial[];   // эмиссия уличной стойки
  depotPosts: DepotPost[];            // шесть стоек депо, каждая со своим светом
  lights3: StageLights;               // свет улицы
  lightsD: StageLights;               // свет депо
  // Приёмники тени. ⚠️ ShadowMaterial НЕ следит за силой света: тень остаётся
  // полной и при intensity 0. Сцена, которая гасит ключевой свет, обязана
  // гасить и opacity приёмника — иначе под машинами ночью висит дневная тень.
  catcher3: Mesh;
  catcherD: Mesh;
  // Дневные значения — чтобы сцена могла вернуться к ним по числу, а не по памяти.
  // ⚠️ environmentIntensity выставляется ОДИН раз при первом кадре (0.9); сцена,
  // которой нужна ночь, пишет (sceneD as any).environmentIntensity сама на каждом
  // кадре ПЕРЕД вызовом frame().
  DAY: {key: number; rim: number; hemi: number; env: number};
  camera: PerspectiveCamera;
  camAz: number;
  camEl: SimpleSignal<number>;
  camDist: SimpleSignal<number>;
  tgtX: SimpleSignal<number>;
  tgtY: SimpleSignal<number>;
  tgtZ: SimpleSignal<number>;
  lookOff: SimpleSignal<number>;
  /** Ставит камеру, инициализирует рендерер при первом кадре и рисует сцену. */
  frame: (renderer: WebGLRenderer, s: Scene) => void;
}

/** Свободна / занята — цвета индикатора стойки. Зелёный НИКОГДА не значит «идёт сессия». */
export const POST_IDLE = new Color('#4ade80');
export const POST_LIVE = new Color('#FFB070');

export const DEPOT_POS = new Vector3(-7.0, 0, -19.5);

export function* buildChargingStage(): Generator<any, ChargingStage> {
  // Шрифт карточек приборов обязан быть готов ДО первой отрисовки — иначе
  // первый кадр уедет на fallback-моноширинный.
  yield (document as any).fonts.load('600 150px "JetBrains Mono"');
  yield (document as any).fonts.load('600 96px "JetBrains Mono"');

  // ── Сцена улицы ──────────────────────────────────────────────────────────
  const scene3 = new Scene();
  const catcher3 = shadowCatcher();
  scene3.add(catcher3);
  const hemi = new HemisphereLight(0xa8c4ff, 0x141a26, 0.22);
  scene3.add(hemi);

  const key = new DirectionalLight(0xfff2e0, 1.25);
  key.position.set(6.5, 9.0, 5.0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.normalBias = 0.05;
  key.shadow.bias = -0.0004;
  const kc = key.shadow.camera;
  kc.left = -7; kc.right = 7; kc.top = 7; kc.bottom = -7; kc.near = 3; kc.far = 28;
  kc.updateProjectionMatrix();
  scene3.add(key);

  const rim = new DirectionalLight(0x9ec0ff, 0.8);
  rim.position.set(-7.0, 3.2, -6.0);
  scene3.add(rim);

  // ── Сцена депо (отдельная — у неё свой расфокус и своя прозрачность) ──────
  const sceneD = new Scene();
  const catcherD = shadowCatcher();
  sceneD.add(catcherD);
  const hemiD = new HemisphereLight(0xa8c4ff, 0x141a26, 0.22);
  sceneD.add(hemiD);

  const keyD = new DirectionalLight(0xfff2e0, 1.25);
  keyD.position.copy(DEPOT_POS).add(new Vector3(6, 12, 7));
  keyD.target.position.copy(DEPOT_POS);
  keyD.castShadow = true;
  keyD.shadow.mapSize.set(2048, 2048);
  keyD.shadow.normalBias = 0.05;
  keyD.shadow.bias = -0.0004;
  const dcam = keyD.shadow.camera;
  dcam.left = -12; dcam.right = 12; dcam.top = 12; dcam.bottom = -12; dcam.near = 2; dcam.far = 55;
  dcam.updateProjectionMatrix();
  sceneD.add(keyD);
  sceneD.add(keyD.target);

  const rimD = new DirectionalLight(0x9ec0ff, 0.8);
  rimD.position.copy(DEPOT_POS).add(new Vector3(-7, 4, -7));
  sceneD.add(rimD);

  // ── Модели ───────────────────────────────────────────────────────────────
  const loader = new GLTFLoader();
  const carGltf = yield new Promise<any>((res, rej) => loader.load(CAR_URL, res, undefined, rej));
  const postGltf = yield new Promise<any>((res, rej) => loader.load(POST_URL, res, undefined, rej));
  const vanGltf = yield new Promise<any>((res, rej) => loader.load(VAN_URL, res, undefined, rej));

  const car = carGltf.scene as Object3D;
  dress(car, 0.26);
  car.position.set(0.55, 0, -0.20);
  // Тот же разворот, что у фургонов ряда 0: ракурс к камере совпадает.
  car.rotation.y = -31 * D2R;
  ground0(car);
  scene3.add(car);

  const post = postGltf.scene as Object3D;
  dress(post, 0.35);
  post.position.set(-1.95, 0, 0.85);
  post.rotation.y = faceTo(0.94, 0.34);   // лицом к машине и одновременно в камеру
  ground0(post);
  scene3.add(post);

  // У модели эмиссия идёт по текстуре: светятся только светодиодная полоса и
  // экран, а не весь корпус. Материалы клонируются — иначе свет одной стойки
  // зажёг бы все шесть в депо.
  const postMats: MeshStandardMaterial[] = [];
  post.traverse((n: any) => {
    if (!n.isMesh) return;
    n.material = n.material.clone();
    n.material.emissive = POST_IDLE.clone();
    n.material.emissiveIntensity = 0;
    postMats.push(n.material);
  });

  // ── Депо ─────────────────────────────────────────────────────────────────
  // Раскладка референса S_mode_depot: два ряда носами к центру, стойки островом
  // по центральной оси спина к спине, каждая лицом к своему ряду. Внутренняя
  // геометрия не трогается — в кадр её ставит поворот всей группы.
  const depot = new Object3D();
  depot.position.copy(DEPOT_POS);
  depot.rotation.y = -31 * D2R;
  sceneD.add(depot);

  const vans: Object3D[] = [];
  const depotPosts: DepotPost[] = [];
  const vanSrc = vanGltf.scene as Object3D;
  const COLS = 3, SU = 3.3, ROW = 4.6, SPINE = 0.75;
  for (let i = 0; i < COLS * 2; i++) {
    const col = i % COLS, row = (i / COLS) | 0;
    const lx = (col - (COLS - 1) / 2) * SU;

    const v = vanSrc.clone(true);
    dress(v, 0.30);
    // r=0.5 у краски фургона не ловит окружение вовсе; лёгкий отблеск неба по
    // крыше, но герой остаётся заметно глянцевее — иерархия планов.
    v.traverse((n: any) => {
      if (n.isMesh && !n.material.transparent && n.material.roughness > 0.45) n.material.roughness = 0.45;
    });
    v.position.set(lx, 0, row ? ROW : -ROW);
    v.rotation.y = row ? Math.PI : 0;      // нос к центральному острову
    const vb = new Box3().setFromObject(v);
    v.position.y = -vb.min.y;
    depot.add(v);
    vans.push(v);

    const p = post.clone(true);
    p.position.set(lx, 0, row ? SPINE : -SPINE);
    p.rotation.y = faceTo(0, row ? 1 : -1);   // лицом к своему ряду
    const mats: MeshStandardMaterial[] = [];
    p.traverse((n: any) => {
      if (!n.isMesh) return;
      n.material = n.material.clone();
      n.material.emissive = POST_IDLE.clone();
      n.material.emissiveIntensity = 0;
      mats.push(n.material);
    });
    depot.add(p);
    depotPosts.push({node: p, mats});
  }

  // ── Камера (одна на оба вьюпорта) ────────────────────────────────────────
  const camAz = 14 * D2R;
  const camera = new PerspectiveCamera(34, Screen.width / Screen.height, 0.1, 300);
  const camEl = createSignal(16 * D2R);
  const camDist = createSignal(10.5);
  const tgtX = createSignal(-0.62);
  const tgtY = createSignal(1.00);
  const tgtZ = createSignal(0.12);
  // Сдвиг точки прицеливания вдоль «вправо» камеры: двигает мир по кадру,
  // не трогая камеру — так левая колонна освобождается под код.
  const lookOff = createSignal(0);

  let envTex: any = null;
  const frame = (renderer: WebGLRenderer, s: Scene) => {
    if (!envTex) {
      const pm = new PMREMGenerator(renderer);
      envTex = pm.fromScene(makeStudioEnv(), 0.02).texture;
      scene3.environment = envTex;
      sceneD.environment = envTex;
      (scene3 as any).environmentIntensity = 0.9;
      (sceneD as any).environmentIntensity = 0.9;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = PCFShadowMap;
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.92;
    }
    const t = new Vector3(tgtX(), tgtY(), tgtZ());
    camera.position.copy(orbit(camAz, camEl(), camDist(), t));
    const off = lookOff();
    camera.lookAt(t.x + Math.cos(camAz) * off, t.y, t.z - Math.sin(camAz) * off);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(s, camera);
  };

  return {
    scene3, sceneD, car, post, depot, vans, postMats, depotPosts,
    lights3: {key, rim, hemi},
    lightsD: {key: keyD, rim: rimD, hemi: hemiD},
    catcher3, catcherD,
    DAY: {key: 1.25, rim: 0.8, hemi: 0.22, env: 0.9},
    camera, camAz, camEl, camDist, tgtX, tgtY, tgtZ, lookOff, frame,
  };
}

/**
 * Прибор В МИРОВОМ ПРОСТРАНСТВЕ над объектом: карта с замком над машиной,
 * шкала мощности над фургонами, таймер над машиной. Плоскость развёрнута ЛИЦОМ
 * К КАМЕРЕ (rotation.y = азимут камеры), а не по грани объекта: приборы стоят
 * над разными предметами, и общая ориентация — единственное, что делает их
 * одним слоем, а не тремя наклейками под случайными углами. Масштаб задаётся в
 * МЕТРАХ, поэтому прибор живёт по законам сцены: дальний меньше ближнего.
 */
export function mountWorldCard(
  scene: Scene,
  opts: {
    x: number; y: number; z: number;
    planeW: number; planeH: number;
    rotationY: number;
    px?: number; py?: number;
  },
): PostCard {
  const width = opts.px ?? 1024;
  const height = opts.py ?? 512;
  const cv = document.createElement('canvas');
  cv.width = width;
  cv.height = height;
  const ctx = cv.getContext('2d')!;
  const tex = new CanvasTexture(cv);
  tex.anisotropy = 8;
  const mat = new MeshBasicMaterial({
    map: tex, transparent: true, opacity: 0,
    depthWrite: false, depthTest: false, side: DoubleSide, toneMapped: false,
  });
  const mesh = new Mesh(new PlaneGeometry(opts.planeW, opts.planeH), mat);
  mesh.renderOrder = 12;
  mesh.position.set(opts.x, opts.y, opts.z);
  mesh.rotation.y = opts.rotationY;
  scene.add(mesh);
  return {mesh, mat, ctx, tex, width, height};
}

/** Табличка прибора в плоскости ЛИЦА стойки — карточка живёт в мире, не в кадре. */
export interface PostCard {
  mesh: Mesh;
  mat: MeshBasicMaterial;
  ctx: CanvasRenderingContext2D;
  tex: CanvasTexture;
  width: number;
  height: number;
}

/**
 * ⚠️ Плоскость обязана принадлежать грани РЕАЛЬНОГО объекта. Любой «свой» угол
 * (по оси машины, компромиссные градусы к камере) не принадлежит ни одной
 * плоскости кадра, и табличка висит под углом, которого в сцене нет — это и
 * читается как сломанная геометрия.
 */
export function mountPostCard(
  scene: Scene, post: Object3D,
  opts: {planeW?: number; planeH?: number; above?: number; px?: number; py?: number} = {},
): PostCard {
  const width = opts.px ?? 1024;
  const height = opts.py ?? 256;
  const cv = document.createElement('canvas');
  cv.width = width;
  cv.height = height;
  const ctx = cv.getContext('2d')!;
  const tex = new CanvasTexture(cv);
  tex.anisotropy = 8;
  const mat = new MeshBasicMaterial({
    map: tex, transparent: true, opacity: 0,
    depthWrite: false, side: DoubleSide, toneMapped: false,
  });
  const mesh = new Mesh(new PlaneGeometry(opts.planeW ?? 3.2, opts.planeH ?? 0.8), mat);
  mesh.renderOrder = 10;
  scene.add(mesh);

  post.updateMatrixWorld(true);
  const b = new Box3().setFromObject(post);
  const c = b.getCenter(new Vector3());
  mesh.position.set(c.x, b.max.y + (opts.above ?? 0.68), c.z);
  mesh.rotation.y = post.rotation.y + Math.PI / 2;   // нормаль плоскости = лицо стойки

  return {mesh, mat, ctx, tex, width, height};
}

// ── Панель прибора: тело и типографика ────────────────────────────────────
// Один набор на все приборы главы — они один слой, а не наклейки под разными
// стилями. ⚠️ Акт 2 держит свою копию этих же функций внутри сцены (принят, не
// трогать до миграции); значения обязаны совпадать.
export const PANEL = {
  ink: 'rgba(244, 238, 224, 0.95)',
  inkDim: 'rgba(244, 238, 224, 0.46)',
  edge: 'rgba(244, 238, 224, 0.30)',
  glass: 'rgba(7, 9, 13, 0.60)',
  amber: 'rgba(255, 168, 90, ',
  hair: 4,
} as const;

export function roundRect(c: CanvasRenderingContext2D, x: number, y: number,
                          w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Тело панели: стекло + волосяная кромка. Рисуется под содержимым. */
export function panelBody(c: CanvasRenderingContext2D, w: number, h: number): void {
  const H = PANEL.hair;
  roundRect(c, H, H, w - H * 2, h - H * 2, 30);
  c.fillStyle = PANEL.glass;
  c.fill();
  c.lineWidth = H;
  c.strokeStyle = PANEL.edge;
  c.stroke();
}

/** Разрядка прописных — подпись прибора, не бейдж. Возвращает x после текста. */
export function capsText(c: CanvasRenderingContext2D, text: string, x: number, y: number,
                         size: number, track: number, fill: string): number {
  c.font = `600 ${size}px "JetBrains Mono", monospace`;
  c.fillStyle = fill;
  let cx = x;
  for (const ch of text) { c.fillText(ch, cx, y); cx += size * 0.62 + track; }
  return cx - track;
}

/** Пятно света на асфальте под объектом. */
export interface GroundPool {
  mesh: Mesh;
  mat: MeshBasicMaterial;
  light: PointLight;
  /** Одно число 0..1 зажигает и гасит и пятно, и настоящий свет рядом. */
  set: (v: number) => void;
}

// ⚠️ Пятно строится ПОПИКСЕЛЬНО с дизерингом. Плавный радиальный градиент на
// тёмном асфальте распадается на кольца (полосы Маха на 8 битах); шум в
// четверть уровня их полностью снимает и на глаз не читается.
function poolTexture(px = 512): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(px, px);
  const d = img.data;
  const r = px / 2;
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const dx = (x + 0.5 - r) / r;
      const dy = (y + 0.5 - r) / r;
      const t = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      // Ядро почти ровное, край уходит в ноль без различимой кромки: у света
      // на земле нет границы, есть затухание.
      const f = Math.pow(1 - t, 2.4);
      const a = f * 255 + (Math.random() - 0.5) * 2.4;
      const i = (y * px + x) * 4;
      d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
      d[i + 3] = Math.max(0, Math.min(255, a));
    }
  }
  ctx.putImageData(img, 0, 0);
  return new CanvasTexture(c);
}

/**
 * Свет на асфальте — тем же тёплым, что и живая стойка.
 *
 * ⚠️ Это НЕ рамка выделения. Плоскость лежит В плоскости земли, поэтому
 * перспектива сжимает её вместе с площадкой, а depthTest прячет её за кузовом:
 * свет ложится ПОД машину, а не поверх неё. Смешение аддитивное — пятно
 * осветляет асфальт, а не закрывает его плашкой.
 *
 * ⚠️ Рядом обязателен настоящий PointLight. Одна плоская заливка читается
 * наклейкой; светом она становится ровно тогда, когда тот же тёплый ловят
 * колёса и пороги (канон: свет обязан коснуться геометрии, а не только земли).
 */
export function mountGroundPool(
  scene: Scene,
  opts: {
    x: number; z: number; size: number;
    peak?: number;            // яркость пятна в максимуме
    lightY?: number;          // высота настоящего источника над землёй
    lightRange?: number;
    lightPeak?: number;
    color?: Color;
  },
): GroundPool {
  const color = opts.color ?? POST_LIVE;
  const peak = opts.peak ?? 0.5;
  const lightPeak = opts.lightPeak ?? 5;

  const mat = new MeshBasicMaterial({
    map: poolTexture(),
    color: color.clone(),
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new Mesh(new PlaneGeometry(opts.size, opts.size), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(opts.x, 0.012, opts.z);   // над приёмником тени, без z-fighting
  mesh.renderOrder = 1;
  scene.add(mesh);

  const light = new PointLight(color.clone(), 0, opts.lightRange ?? 7, 2);
  light.position.set(opts.x, opts.lightY ?? 0.55, opts.z);
  scene.add(light);

  return {
    mesh, mat, light,
    set: (v: number) => {
      mat.opacity = v * peak;
      light.intensity = v * lightPeak;
    },
  };
}
