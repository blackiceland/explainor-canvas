import {
  AnimationClip, AnimationMixer, BufferGeometry, CanvasTexture, Color, Mesh, MeshBasicMaterial, MeshPhysicalMaterial,
  MeshStandardMaterial, Object3D, PlaneGeometry, SkinnedMesh, Vector3,
} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ── Кошка, которая бежит ─────────────────────────────────────────────────────
// ⚠️ Сейчас не используется: автор выбрал сидящую, которая лижет лапу (ниже).
// Модель: Sketchfab «Trotting Cat», автор miyapCG (uucgstation), лицензия Sketchfab Free
// Standard (коммерческое использование можно), public/goodcode/cat_trot.glb. Скелет,
// цикл рыси 0.8 с на месте, хвост поднят крючком. Цвета при выгрузке потерялись (все
// материалы белые) — красим по именам. Автор: «покрась в чёрный»: шерсть чёрная, грани
// сварены и сглажены, мех держит мягкий отблеск (sheen) по силуэту; глаза жёлтые.
// ⚠️ Раньше: статичная «Cat in Motion» с качающимся хвостом («всрато» — застывшая
// фигурка), потом Momo (низкополигональная, не понравилась).
// Бег на месте — по столу её ведёт путь from → to. Скорость — от длины шага: лапа за
// цикл проходит вдоль тела ~1.0 единицы модели, то есть ~1.25 единицы в секунду цикла
// (замер, scratchpad bench/cattrot.html); темп цикла подгоняется, чтобы лапы не скользили.

export interface CatWalk {
  /** Модель (glb) и куда она смотрит в своей системе. */
  url: string; forward: 'x' | 'z';
  /** Начало и конец прохода по столу (м; y — столешница). */
  from: Vector3; to: Vector3;
  /** Когда начинает и сколько бежит, с (время плана). */
  start: number; dur: number;
  /** Метров на единицу модели; ход лапы — единиц модели за секунду цикла (замер). */
  scale: number; stride: number;
  /** Цвета по именам материалов; 'fur' — чёрная шерсть с отблеском, сглаженная. */
  paint: Record<string, string>;
}

export interface WalkingCat {
  root: Object3D;
  /** Кошка в момент t (с, время плана): место на пути и фаза шага. */
  pose: (t: number) => void;
}

/** Мягкое пятно: радиальный градиент на альфе. */
let shadowTexCache: CanvasTexture | null = null;
function shadowTex() {
  if (shadowTexCache) return shadowTexCache;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, '#fff'); gr.addColorStop(0.45, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return (shadowTexCache = new CanvasTexture(c));
}

const furMaterial = () => new MeshPhysicalMaterial({
  color: new Color('#0b0b0d'), roughness: 0.62, metalness: 0,
  sheen: 0.7, sheenColor: new Color('#3d3f47'), sheenRoughness: 0.45,
});

export function prepareWalkingCat(scene: Object3D, clips: AnimationClip[], walk: CatWalk): WalkingCat {
  scene.traverse(o => {
    const m = o as SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const name = (m.material as MeshStandardMaterial).name;
    const paint = walk.paint[name] ?? 'fur';
    if (paint === 'fur') {
      // шерсть: у модели плоское затенение (вершины на гранях раздельно) — сварить и сгладить
      let g = m.geometry as BufferGeometry;
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'skinIndex' && k !== 'skinWeight') g.deleteAttribute(k);
      g = mergeVertices(g, 1e-4);
      g.computeVertexNormals();
      m.geometry = g;
      m.material = furMaterial();
    } else {
      m.material = new MeshStandardMaterial({color: new Color(paint), roughness: 0.55, metalness: 0});
    }
    m.frustumCulled = false;
  });
  const clip = clips[0];
  const mixer = new AnimationMixer(scene);
  mixer.clipAction(clip).play();
  const body = new Object3D();
  body.add(scene);
  scene.scale.setScalar(walk.scale);
  // тень под телом бежит вместе с ней (в метрах; тело ~0.45 м)
  const blob = new Mesh(new PlaneGeometry(0.17, 0.46), new MeshBasicMaterial({
    color: '#000', alphaMap: shadowTex(), transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
  }));
  blob.rotation.x = -Math.PI / 2;
  blob.renderOrder = 1;
  const root = new Object3D();
  root.add(body);
  // модель смотрит вдоль своей оси forward — разворачиваем по пути; тень — вдоль тела
  const dir = walk.to.clone().sub(walk.from);
  body.rotation.y = walk.forward === 'z' ? Math.atan2(dir.x, dir.z) : Math.atan2(-dir.z, dir.x);
  blob.rotation.z = Math.atan2(dir.x, dir.z);
  blob.position.set(0, 0.0006, 0).addScaledVector(dir.clone().normalize(), 0.18);
  root.add(blob);
  // темп цикла: скорость по столу / (ход лапы × масштаб)
  const rate = dir.length() / walk.dur / (walk.stride * walk.scale);
  const pose = (t: number) => {
    const tt = Math.min(walk.dur, Math.max(0, t - walk.start));
    root.position.copy(walk.from).addScaledVector(dir, tt / walk.dur);
    mixer.setTime((tt * rate) % clip.duration);
    root.updateMatrixWorld(true);
  };
  pose(0);
  return {root, pose};
}

// ── Кошка, которая сидит и вылизывает лапу ───────────────────────────────────
// Модель: Sketchfab «An Animated Cat», выложил Evil_Katz под CC-BY-4.0 (по факту — модель
// из игры Murdered: Soul Suspect; риск автор принял). public/goodcode/cat_lick.glb: свои
// текстуры (атлас ужат до 1024², его дубль убран), клип «Take 001» 6 с — сидит, лижет
// правую переднюю лапу, поднимает голову. Морда вдоль +x модели, верх +y, единицы ~см.
// Автор: «давай кошку серой сделаем» — в модели она чёрная; шерсть атласа перекрашена
// в голубовато-серую (яркость 110 ± рисунок ×1.3), язык, дёсны, глаз, подушечки и
// внутренние уши — свои (scratchpad cat/lick/tex/gray.mjs).

export interface CatSit {
  url: string;
  /** Где сидит (м; y — столешница) и куда смотрит морда (рад вокруг вертикали; 0 — к +x мира). */
  at: Vector3; yaw: number;
  /** Метров на единицу модели. */
  scale: number;
  /** Секунда клипа в t = 0 плана. */
  offset: number;
  /** Окно плана, где её видно (с): по нему — силуэт для ракурса. */
  shown: [number, number];
}

export interface SittingCat {
  root: Object3D;
  /** Кошка в момент t (с, время плана). */
  pose: (t: number) => void;
  /** Точки силуэта за всё окно показа (мир): ракурс берёт её целиком. */
  outline: () => Vector3[];
}

/** 26 направлений: грани, рёбра и углы куба — крайние точки по ним держат силуэт. */
const SUPPORT = [-1, 0, 1].flatMap(x => [-1, 0, 1].flatMap(y => [-1, 0, 1].map(z => new Vector3(x, y, z))))
  .filter(d => d.lengthSq() > 0).map(d => d.normalize());

export function prepareSittingCat(scene: Object3D, clips: AnimationClip[], sit: CatSit): SittingCat {
  const meshes: SkinnedMesh[] = [];
  scene.traverse(o => {
    const m = o as SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    m.frustumCulled = false;
    meshes.push(m);
  });
  const clip = clips[0];
  const mixer = new AnimationMixer(scene);
  mixer.clipAction(clip).play();
  const body = new Object3D();
  body.add(scene);
  body.rotation.y = sit.yaw;
  scene.scale.setScalar(sit.scale);
  const root = new Object3D();
  root.add(body);
  root.position.copy(sit.at);
  const v = new Vector3();
  const each = (fn: (p: Vector3) => void) => {
    for (const m of meshes) {
      const n = m.geometry.attributes.position.count;
      for (let i = 0; i < n; i++) fn(m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld));
    }
  };
  const pose = (t: number) => {
    mixer.setTime(((sit.offset + t) % clip.duration + clip.duration) % clip.duration);
    root.updateMatrixWorld(true);
  };
  // нижняя точка (лапы, хвост на столе) — на столешницу
  pose(sit.shown[0]);
  let low = Infinity;
  each(p => { low = Math.min(low, p.y); });
  scene.position.y += sit.at.y - low;
  // тень под телом: от крупа до передних лап, вдоль морды
  const blob = new Mesh(new PlaneGeometry(0.34, 0.17), new MeshBasicMaterial({
    color: '#000', alphaMap: shadowTex(), transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
  }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.set(-0.01, 0.0006, -0.02);
  blob.renderOrder = 1;
  body.add(blob);
  const outline = () => {
    const pts: Vector3[] = [];
    for (let k = 0; k <= 6; k++) {
      pose(sit.shown[0] + (sit.shown[1] - sit.shown[0]) * k / 6);
      const best = SUPPORT.map(() => ({d: -Infinity, p: new Vector3()}));
      each(p => SUPPORT.forEach((d, j) => { const e = p.dot(d); if (e > best[j].d) { best[j].d = e; best[j].p.copy(p); } }));
      pts.push(...best.map(b => b.p));
    }
    pose(sit.shown[0]);
    return pts;
  };
  pose(sit.shown[0]);
  return {root, pose, outline};
}

export function* loadSittingCat(base: string, sit: CatSit): Generator<any, SittingCat> {
  const g: {scene: Object3D; animations: AnimationClip[]} = yield new GLTFLoader().loadAsync(`${base}/${sit.url}`);
  return prepareSittingCat(g.scene, g.animations, sit);
}

/** Загрузить и подготовить (генератор — как остальные загрузки сцен). */
export function* loadWalkingCat(base: string, walk: CatWalk): Generator<any, WalkingCat> {
  const g: {scene: Object3D; animations: AnimationClip[]} = yield new GLTFLoader().loadAsync(`${base}/${walk.url}`);
  return prepareWalkingCat(g.scene, g.animations, walk);
}
