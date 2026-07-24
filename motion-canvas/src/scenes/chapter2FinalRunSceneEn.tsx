import {blur, brightness, makeScene2D, Node, saturate, sepia} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {
  Bone,
  BoxGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  KeyframeTrack,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  SkinnedMesh,
  Vector3,
} from 'three';
import {OutlineEffect} from 'three/examples/jsm/effects/OutlineEffect.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createThreeView} from '../core/three/ThreeCanvas';
import {Fonts, Screen} from '../core/theme';
import {applyBackground} from '../core/utils';
import {Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingX, getLineHeight} from '../core/code/shared/TextMeasure';
import {JavaClass, method, param} from '../core/code/model/JavaModel';

// ── Layout ────────────────────────────────────────────────────────────────
// Унифицировано с problemsYouDontHaveStrategySceneEn: тот же 3D-вьюпорт руки
// (аспект/разрешение/скейл) и та же позиция+кегль кода, чтобы сцены не прыгали.
const LEFT_PAD = 80;
const CODE_W = Screen.width / 2 - LEFT_PAD - 20;
const ARM_SCALE = 0.85;
const ARM_DISPLAY = 0.801;   // унифицировано со Strategy-сценой (0.7 → 0.749 → 0.801)
const THREE_W = Math.ceil(Screen.width / ARM_SCALE);
const THREE_H = Math.ceil(Screen.height / ARM_SCALE);

// ── Robot arm constants ──────────────────────────────────────────────────
const MODEL_URL = '/basic_robot_arm.glb';

const BONE_NAMES: Record<string, string> = {
  base:     'Bone_00',
  turret:   'Bone001_01',
  shoulder: 'Bone003_03',
  elbow:    'Bone005_05',
  wrist:    'Bone007_07',
  hand:     'Bone008_08',
};

const FINGER_NAMES = {
  finger1: 'Bone009_09',
  finger2: 'Bone010_010',
};

const JOINT_AXIS: Record<string, 'x' | 'y'> = {
  base: 'y', turret: 'y', shoulder: 'x', elbow: 'x', wrist: 'x', hand: 'x',
};

function findBone(root: Bone, name: string): Bone | null {
  if (root.name === name) return root;
  for (const child of root.children) {
    const found = findBone(child as Bone, name);
    if (found) return found;
  }
  return null;
}

function getTipPos(sceneRoot: Object3D, wrist: Bone, hand: Bone): Vector3 {
  sceneRoot.updateMatrixWorld(true);
  const wp = new Vector3(), hp = new Vector3();
  wrist.getWorldPosition(wp);
  hand.getWorldPosition(hp);
  return hp.clone().add(hp.clone().sub(wp));
}

function solveIK(
  sceneRoot: Object3D,
  bones: Record<string, Bone | null>,
  initRot: Record<string, number>,
  target: Vector3,
): Record<string, number> {
  const JOINTS = ['base', 'turret', 'shoulder', 'elbow', 'wrist'] as const;
  const deltas: Record<string, number> = {base: 0, turret: 0, shoulder: 0, elbow: 0, wrist: 0};
  const EPS = 0.005;

  function apply() {
    for (const j of JOINTS) {
      if (bones[j]) bones[j]!.rotation[JOINT_AXIS[j] as 'x' | 'y'] = initRot[j] + deltas[j];
    }
  }

  function cost(): number {
    apply();
    const dist = getTipPos(sceneRoot, bones.wrist!, bones.hand!).distanceTo(target);
    return dist + Math.abs(deltas.base) * 80;
  }

  for (let i = 0; i < 1500; i++) {
    const c0 = cost();
    if (c0 < 3) break;

    const grads: Record<string, number> = {};
    for (const j of JOINTS) {
      deltas[j] += EPS;
      const cp = cost();
      deltas[j] -= 2 * EPS;
      const cm = cost();
      deltas[j] += EPS;
      grads[j] = (cp - cm) / (2 * EPS);
    }

    let norm = 0;
    for (const j of JOINTS) norm += grads[j] * grads[j];
    norm = Math.sqrt(norm);
    if (norm < 1e-6) break;

    const step = Math.min(0.05, c0 * 0.0005);
    for (const j of JOINTS) {
      deltas[j] -= (grads[j] / norm) * step;
      deltas[j] = Math.max(-1.5, Math.min(1.5, deltas[j]));
    }
  }

  for (const j of JOINTS) {
    if (bones[j]) bones[j]!.rotation[JOINT_AXIS[j] as 'x' | 'y'] = initRot[j];
  }
  sceneRoot.updateMatrixWorld(true);
  return deltas;
}

// ── Code config ──────────────────────────────────────────────────────────
// 24 = решение автора для финальной сцены: −20% от унифицированных 30,
// чтобы присваивание профиля помещалось одной строкой, не заходя в зону руки.
const CODE_FONT_SIZE = 24;
const MAX_LINE_CHARS = 80;

const VAR_LIGHT = 'rgba(244, 241, 235, 0.96)';
const TYPE_CLEAN = 'rgba(220, 215, 255, 0.80)';
const METHOD_COLOR = DryFiltersV3CodeTheme.method;

const CODE_CARD_STYLE = {
  radius: 24, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0, shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
  shadowOffsetX: 0, shadowOffsetY: 0, edge: false,
} as const;

const SOFT_GREEN = 'rgba(168, 214, 178, 0.88)';

const KW_COLOR = DryFiltersV3CodeTheme.keyword;

const COLOR_RULES = [
  {match: /^public$/,       color: KW_COLOR},
  {match: /^private$/,      color: KW_COLOR},
  {match: /^void$/,         color: KW_COLOR},
  {match: /^return$/,       color: KW_COLOR},
  {match: /^new$/,          color: KW_COLOR},
  {match: 'handleCube',     color: VAR_LIGHT},
  {match: 'arm',            color: VAR_LIGHT},
  {match: 'cube',           color: VAR_LIGHT},
  {match: 'position',       color: VAR_LIGHT},
  {match: 'table',          color: VAR_LIGHT},
  {match: 'handling',       color: VAR_LIGHT},
  {match: 'gripForce',      color: VAR_LIGHT},
  {match: 'motionProfile',  color: VAR_LIGHT},
  {match: 'releaseStyle',   color: VAR_LIGHT},
  {match: /^Cube$/,            color: TYPE_CLEAN},
  {match: /^Table$/,           color: TYPE_CLEAN},
  {match: /^HandlingProfile$/, color: TYPE_CLEAN},
  {match: 'moveTo',         color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'grab',           color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'confirmGrip',    color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'release',        color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'forCube',        color: METHOD_COLOR, onlyTypes: ['method']},
  {match: /^"[^"]*"$/,      color: SOFT_GREEN},
];

// ── Halation ─────────────────────────────────────────────────────────────
// Тот же плёночный ореол, что в chapter2LivingPathSceneEn: snapshot-клон
// строки, blur, ПОД резким оригиналом, складываем светом.
const HAL_BLOOM_BLUR    = 6;
const HAL_BLOOM_OPACITY = 0.7;
const HAL_WARM_BLUR     = 18;
const HAL_WARM_OPACITY  = 0.9;
const HAL_CROSSFADE     = 0.35;

// Индексы отрендеренных строк финального handleCube.
const LINE_REACH   = 1;  // arm.moveTo(cube.position);
const LINE_PROFILE = 3;  // HandlingProfile handling = HandlingProfile.forCube(cube, table);
const LINE_GRAB    = 5;  // arm.grab(cube, handling.gripForce);
const LINE_CONFIRM = 6;  // arm.confirmGrip();
const LINE_PLACE   = 7;  // arm.moveTo(table.position, handling.motionProfile);
const LINE_RELEASE = 8;  // arm.release(handling.releaseStyle);

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ═══════════════════════════════════════════════════════════════════════
  // RIGHT SIDE: Three.js robot arm
  // ═══════════════════════════════════════════════════════════════════════
  const scene3 = new Scene();

  const camera = new PerspectiveCamera(50, THREE_W / THREE_H, 1, 10000);
  camera.position.set(900, 550, 1400);
  camera.lookAt(-100, 250, 400);

  const fillMat = new MeshBasicMaterial({color: 0x00a0b8, transparent: true, opacity: 0.12});
  const edgeMat = new LineBasicMaterial({color: 0x00a0b8, transparent: true, opacity: 0.7});
  // Sensitive-куб фиолетовый — словарь problemsYouDontHaveCarefulArmSceneEn:
  // хрупкость, которую мы там ВООБРАЗИЛИ, здесь приходит по-настоящему.
  const cubeFillMat = new MeshBasicMaterial({color: 0xb388ff, transparent: true, opacity: 0.25});
  const cubeEdgeMat = new LineBasicMaterial({color: 0xb388ff, transparent: true, opacity: 1.0});

  function blueprint(geom: BoxGeometry | CylinderGeometry, fill?: MeshBasicMaterial, edge?: LineBasicMaterial): Group {
    const g = new Group();
    g.add(new Mesh(geom, fill ?? fillMat));
    g.add(new LineSegments(new EdgesGeometry(geom), edge ?? edgeMat));
    return g;
  }

  // ── Conveyor Belt ─────────────────────────────────────────────────────
  const conveyor = new Group();
  const beltLength = 1200;
  const beltWidth = 160;
  const beltHeight = 15;
  const beltY = 0;
  const beltZ = 600;
  const legHeight = 120;

  const belt = blueprint(new BoxGeometry(beltLength, beltHeight, beltWidth));
  belt.position.set(0, beltY, beltZ);
  conveyor.add(belt);

  const railHeight = 30;
  const railThickness = 8;
  for (const side of [-1, 1]) {
    const rail = blueprint(new BoxGeometry(beltLength, railHeight, railThickness));
    rail.position.set(0, beltY + beltHeight / 2 + railHeight / 2, beltZ + side * (beltWidth / 2 + railThickness / 2));
    conveyor.add(rail);
  }

  for (const xSide of [-1, 1]) {
    for (const zSide of [-1, 1]) {
      const leg = blueprint(new CylinderGeometry(10, 10, legHeight, 8));
      leg.position.set(
        xSide * (beltLength / 2 - 40),
        beltY - beltHeight / 2 - legHeight / 2,
        beltZ + zSide * (beltWidth / 2 - 20),
      );
      conveyor.add(leg);
    }
  }

  for (const xSide of [-1, 1]) {
    const roller = blueprint(new CylinderGeometry(18, 18, beltWidth - 10, 16));
    roller.rotation.x = Math.PI / 2;
    roller.position.set(xSide * (beltLength / 2 - 5), beltY, beltZ);
    conveyor.add(roller);
  }

  scene3.add(conveyor);

  // ── Cube ──────────────────────────────────────────────────────────────
  const cubeSize = 60;
  const cube3d = blueprint(new BoxGeometry(cubeSize, cubeSize, cubeSize), cubeFillMat, cubeEdgeMat);
  const cubeOnBeltY = beltY + beltHeight / 2 + cubeSize / 2;
  const cubeStartX = beltLength / 2 - 50;
  const cubeStopX = 0;
  const cubeStartPos = new Vector3(cubeStopX, cubeOnBeltY, beltZ);
  cube3d.position.set(cubeStartX, cubeOnBeltY, beltZ);
  cube3d.renderOrder = -1;
  scene3.add(cube3d);

  // ── Destination platform ──────────────────────────────────────────────
  const platformX = -350;
  const platformZ = 300;
  const platformWidth = 260;
  const platformDepth = 180;
  const platformHeight = 15;
  const platform = blueprint(new BoxGeometry(platformWidth, platformHeight, platformDepth));
  platform.position.set(platformX, beltY, platformZ);
  scene3.add(platform);

  for (const xSide of [-1, 1]) {
    for (const zSide of [-1, 1]) {
      const pLeg = blueprint(new CylinderGeometry(10, 10, legHeight, 8));
      pLeg.position.set(
        platformX + xSide * (platformWidth / 2 - 30),
        beltY - platformHeight / 2 - legHeight / 2,
        platformZ + zSide * (platformDepth / 2 - 25),
      );
      scene3.add(pLeg);
    }
  }

  const placedCubeY = beltY + platformHeight / 2 + cubeSize / 2;
  const placeTarget = new Vector3(platformX, placedCubeY, platformZ);

  // ── Load model ────────────────────────────────────────────────────────
  const loader = new GLTFLoader();
  const gltf = yield new Promise<any>((resolve, reject) => {
    loader.load(MODEL_URL, resolve, undefined, reject);
  });
  scene3.add(gltf.scene);
  const sceneRoot = gltf.scene as Object3D;

  function dotArmMat(isSkinned: boolean, baseOpacity: number): MeshBasicMaterial {
    const mat = new MeshBasicMaterial({color: 0x00e5ff, transparent: true, opacity: baseOpacity});
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <uv_vertex>',
        `
        #include <uv_vertex>
        vDotUv = uv;
        `,
      );
      shader.vertexShader = shader.vertexShader.replace(
        'void main() {',
        `
        varying vec2 vDotUv;
        void main() {`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        'void main() {',
        `
        varying vec2 vDotUv;
        void main() {`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
        vec2 cell = mod(vDotUv * 80.0, vec2(1.0));
        float d = length(cell - vec2(0.5));
        float dot = 1.0 - smoothstep(0.1, 0.15, d);
        gl_FragColor.a += dot * 0.07;
        #include <dithering_fragment>
        `,
      );
    };
    (mat as any).userData.outlineParameters = {
      thickness: isSkinned ? 0.0025 : 0.002,
      color: [0, 0.9, 1],
      alpha: isSkinned ? 0.9 : 0.75,
      visible: true,
      keepAlive: true,
    };
    return mat;
  }

  let skeletonRoot: Bone | null = null;
  sceneRoot.traverse((obj: any) => {
    if (obj instanceof SkinnedMesh) {
      if (obj.skeleton) skeletonRoot = obj.skeleton.bones[0];
      obj.material = dotArmMat(true, 0.14);
    } else if (obj instanceof Mesh) {
      obj.material = dotArmMat(false, 0.11);
    }
  });

  const bones: Record<string, Bone | null> = {};
  if (skeletonRoot) {
    for (const [key, name] of Object.entries(BONE_NAMES)) {
      bones[key] = findBone(skeletonRoot, name);
    }
  }
  const fingers: Record<string, Bone | null> = {};
  if (skeletonRoot) {
    for (const [key, name] of Object.entries(FINGER_NAMES)) {
      fingers[key] = findBone(skeletonRoot, name);
    }
  }

  const fingerPos: {
    open: {f1: Vector3; f2: Vector3};
    closed: {f1: Vector3; f2: Vector3};
  } = {
    open:   {f1: new Vector3(), f2: new Vector3()},
    closed: {f1: new Vector3(), f2: new Vector3()},
  };

  if (gltf.animations?.length) {
    const clip = gltf.animations[0];

    function samplePosTrack(boneName: string, timeSeconds: number): Vector3 | null {
      const track = clip.tracks.find(
        (t: KeyframeTrack) => t.name.includes(boneName) && t.name.endsWith('.position'),
      );
      if (!track) return null;

      const times = track.times;
      const vals = track.values;

      let idx = 0;
      for (let i = 0; i < times.length - 1; i++) {
        if (times[i + 1] > timeSeconds) { idx = i; break; }
      }

      const t0 = times[idx], t1 = times[idx + 1] ?? t0;
      const alpha = t1 > t0 ? (timeSeconds - t0) / (t1 - t0) : 0;

      const p0 = new Vector3(vals[idx * 3], vals[idx * 3 + 1], vals[idx * 3 + 2]);
      const p1 = new Vector3(vals[(idx + 1) * 3], vals[(idx + 1) * 3 + 1], vals[(idx + 1) * 3 + 2]);

      return p0.lerp(p1, alpha);
    }

    const f1Open = samplePosTrack(FINGER_NAMES.finger1, 0);
    const f2Open = samplePosTrack(FINGER_NAMES.finger2, 0);
    const f1Closed = samplePosTrack(FINGER_NAMES.finger1, 1.0);
    const f2Closed = samplePosTrack(FINGER_NAMES.finger2, 1.0);

    if (f1Open) fingerPos.open.f1.copy(f1Open);
    if (f2Open) fingerPos.open.f2.copy(f2Open);
    if (f1Closed) fingerPos.closed.f1.copy(f1Closed);
    if (f2Closed) fingerPos.closed.f2.copy(f2Closed);
  }

  const initRot: Record<string, number> = {};
  for (const [key, bone] of Object.entries(bones)) {
    if (bone) initRot[key] = bone.rotation[JOINT_AXIS[key] as 'x' | 'y'];
  }

  // ── IK — reach + осторожная дуга переноса + place ─────────────────────
  // Хореография переноса из problemsYouDontHaveCarefulArmSceneEn: квадратичный
  // Безье с высокой контрольной точкой, 4 waypoint'а, крайние сегменты eased,
  // середина линейная — одно медленное непрерывное движение без пиков.
  const arcControl = new Vector3(
    (cubeStartPos.x + placeTarget.x) / 2,
    600,
    (cubeStartPos.z + placeTarget.z) / 2,
  );

  function bezier(t: number): Vector3 {
    const u = 1 - t;
    return new Vector3(
      u * u * cubeStartPos.x + 2 * u * t * arcControl.x + t * t * placeTarget.x,
      u * u * cubeStartPos.y + 2 * u * t * arcControl.y + t * t * placeTarget.y,
      u * u * cubeStartPos.z + 2 * u * t * arcControl.z + t * t * placeTarget.z,
    );
  }

  const reachDeltas = solveIK(sceneRoot, bones, initRot, cubeStartPos);
  const arcDeltas = [0.2, 0.4, 0.6, 0.8].map(t => solveIK(sceneRoot, bones, initRot, bezier(t)));
  const placeDeltas = solveIK(sceneRoot, bones, initRot, placeTarget);
  const linear = (v: number) => v;

  // ── 3D signals ────────────────────────────────────────────────────────
  const baseDelta     = createSignal(0);
  const turretDelta   = createSignal(0);
  const shoulderDelta = createSignal(0);
  const elbowDelta    = createSignal(0);
  const wristDelta    = createSignal(0);
  const gripClose     = createSignal(0);

  let cubeAttached = false;
  let cubePlaced = false;
  const cubeX = createSignal(cubeStartX);
  const grabBlend = createSignal(0);
  const grabOrigin = new Vector3();
  let grabBaseY = 0;

  let outline: OutlineEffect | null = null;

  const threeView = createThreeView({
    width: THREE_W,
    height: THREE_H,
    scene: scene3,
    camera,
    onRender: (renderer, s, c) => {
      if (!outline) {
        outline = new OutlineEffect(renderer, {
          defaultThickness: 0.002,
          defaultColor: [0, 0.9, 1],
          defaultAlpha: 0.75,
        });
      }

      renderer.setClearColor(0x000000, 0);
      renderer.clear();

      if (bones.base)     bones.base.rotation.y     = initRot.base     + baseDelta();
      if (bones.turret)   bones.turret.rotation.y   = initRot.turret   + turretDelta();
      if (bones.shoulder) bones.shoulder.rotation.x = initRot.shoulder + shoulderDelta();
      if (bones.elbow)    bones.elbow.rotation.x    = initRot.elbow    + elbowDelta();
      if (bones.wrist)    bones.wrist.rotation.x    = initRot.wrist    + wristDelta();

      const g = gripClose();
      if (fingers.finger1) {
        fingers.finger1.position.lerpVectors(fingerPos.open.f1, fingerPos.closed.f1, g);
      }
      if (fingers.finger2) {
        fingers.finger2.position.lerpVectors(fingerPos.open.f2, fingerPos.closed.f2, g);
      }

      // Правила куба — один в один problemsYouDontHaveCarefulArmSceneEn.
      if (cubeAttached) {
        const wp = new Vector3(), hp = new Vector3();
        bones.wrist!.getWorldPosition(wp);
        bones.hand!.getWorldPosition(hp);
        const tip = hp.clone().add(hp.clone().sub(wp));
        const b = grabBlend();
        cube3d.position.lerpVectors(grabOrigin, tip, b);
        cube3d.rotation.y = (baseDelta() + turretDelta()) - grabBaseY;
      } else if (!cubePlaced) {
        cube3d.position.x = cubeX();
      }

      outline.render(s, c);
    },
  });

  threeView.node.x(Screen.width / 4);
  threeView.node.opacity(0);
  threeView.node.scale(ARM_DISPLAY);
  view.add(threeView.node);

  // ═══════════════════════════════════════════════════════════════════════
  // LEFT SIDE: Code (Manticore) — финальный handleCube из replay-сцены.
  // В этой сцене НЕТ директора морфов: код ни разу не редактируется.
  // Это и есть тезис бита — изменение проходит через готовую дверь.
  // ═══════════════════════════════════════════════════════════════════════
  const fontSize   = CODE_FONT_SIZE;
  const lineHeight = getLineHeight(fontSize);
  const codeX = -Screen.width / 2 + LEFT_PAD + CODE_W / 2 - getCodePaddingX(fontSize);

  const model = JavaClass.create([
    method('public', 'void', 'handleCube',
      [param('Cube', 'cube'), param('Table', 'table')],
      ['arm.moveTo(cube.position);',
       '',
       'HandlingProfile handling = HandlingProfile.forCube(cube, table);',
       '',
       'arm.grab(cube, handling.gripForce);',
       'arm.confirmGrip();',
       'arm.moveTo(table.position, handling.motionProfile);',
       'arm.release(handling.releaseStyle);']),
  ], MAX_LINE_CHARS);

  const manticore = Manticore.create(model.render(), {
    x: codeX, y: -69,
    width: CODE_W,
    fontSize, lineHeight,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    noClip: true,
    customTypes: ['Cube', 'Table', 'HandlingProfile'],
  });
  manticore.mount(view);
  manticore.colorize(COLOR_RULES);

  const attachHalation = (line: Node) => {
    const amount = createSignal(0);
    const content = line.parent()!;

    const warm = line.snapshotClone();
    warm.filters([blur(HAL_WARM_BLUR), sepia(1), saturate(3.2), brightness(1.6)]);
    warm.cachePadding(HAL_WARM_BLUR * 4);
    warm.compositeOperation('lighter');
    warm.zIndex(-2);
    warm.opacity(() => amount() * HAL_WARM_OPACITY);

    const bloom = line.snapshotClone();
    bloom.filters([blur(HAL_BLOOM_BLUR)]);
    bloom.cachePadding(HAL_BLOOM_BLUR * 4);
    bloom.compositeOperation('lighter');
    bloom.zIndex(-1);
    bloom.opacity(() => amount() * HAL_BLOOM_OPACITY);

    content.add(warm);
    content.add(bloom);
    return amount;
  };

  const halation = new Map<number, ReturnType<typeof attachHalation>>();
  for (const i of [
    LINE_REACH, LINE_PROFILE,
    LINE_GRAB, LINE_CONFIRM, LINE_PLACE, LINE_RELEASE,
  ]) {
    halation.set(i, attachHalation(manticore.getLine(i)!.node));
  }

  // Свет передаётся от строки к строке, как в chapter2LivingPathSceneEn.
  let halLit: number | null = null;
  const halateTo = (line: number | null, duration = HAL_CROSSFADE): ThreadGenerator[] => {
    const tweens: ThreadGenerator[] = [];
    if (halLit !== null) tweens.push(halation.get(halLit)!(0, duration, easeInOutCubic));
    if (line !== null) tweens.push(halation.get(line)!(1, duration, easeInOutCubic));
    halLit = line;
    return tweens;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ANIMATION — один последний цикл. Честное правило: темп меняется ТОЛЬКО
  // у вызовов, несущих handling.* (grab мягче, перенос медленнее, release
  // ровнее); reach и confirmGrip — без аргументов профиля — идут темпом
  // живого пути. Код на экране не меняется ни на символ.
  // ═══════════════════════════════════════════════════════════════════════

  // ── v0: appear code, then 3D ──────────────────────────────────────────
  yield* manticore.appear(0.8);
  yield* waitFor(0.6);

  yield* threeView.node.opacity(1, 0.8, easeInOutCubic);
  yield* waitFor(0.4);

  // Belt: приезжает sensitive-куб — фиолетовый. Единственное, что поменялось.
  yield* cubeX(cubeStopX, 2.0, easeInOutCubic);
  yield* waitFor(0.7);

  // ── Reach — темп прежний: у этого вызова нет профиля ──────────────────
  yield* all(
    ...halateTo(LINE_REACH),
    baseDelta(reachDeltas.base, 1.5, easeInOutCubic),
    turretDelta(reachDeltas.turret, 1.5, easeInOutCubic),
    shoulderDelta(reachDeltas.shoulder, 1.5, easeInOutCubic),
    elbowDelta(reachDeltas.elbow, 1.5, easeInOutCubic),
    wristDelta(reachDeltas.wrist, 1.5, easeInOutCubic),
  );
  yield* waitFor(0.2);

  // ── The decision — рука неподвижна, свет стоит на двери ───────────────
  // Единственный бит сцены, где свет движется без физики: это и есть развилка.
  yield* all(...halateTo(LINE_PROFILE, 0.45));
  yield* waitFor(1.2);

  // ── Grip — GENTLE: темп и сила careful-arm сцены ──────────────────────
  yield* all(
    ...halateTo(LINE_GRAB, 0.3),
    gripClose(0.5, 0.5, easeInOutCubic),
  );
  grabOrigin.copy(cube3d.position);
  grabBaseY = baseDelta() + turretDelta();
  cubeAttached = true;
  yield* grabBlend(1, 0.15, easeInOutCubic);

  // ── Confirm grip — темп донора: у этого вызова нет профиля ────────────
  // Мягкость здесь только в конечной силе (следствие GENTLE из grab-строки),
  // сам дожим и пауза — как в живом пути: строка не изменилась, темп тоже.
  yield* all(
    ...halateTo(LINE_CONFIRM, 0.3),
    gripClose(0.62, 0.45, easeInOutCubic),
  );
  yield* waitFor(0.5);

  // ── Place — CAUTIOUS: одна строка, одна медленная дуга (5.4с) ─────────
  // Пластика careful-arm сцены: eased вход, линейная середина, eased посадка.
  // Свет стоит на moveTo весь перенос — одна строка, одно движение.
  yield* all(
    ...halateTo(LINE_PLACE),
    baseDelta(arcDeltas[0].base, 1.2, easeInOutCubic),
    turretDelta(arcDeltas[0].turret, 1.2, easeInOutCubic),
    shoulderDelta(arcDeltas[0].shoulder, 1.2, easeInOutCubic),
    elbowDelta(arcDeltas[0].elbow, 1.2, easeInOutCubic),
    wristDelta(arcDeltas[0].wrist, 1.2, easeInOutCubic),
  );
  yield* all(
    baseDelta(arcDeltas[1].base, 1.0, linear),
    turretDelta(arcDeltas[1].turret, 1.0, linear),
    shoulderDelta(arcDeltas[1].shoulder, 1.0, linear),
    elbowDelta(arcDeltas[1].elbow, 1.0, linear),
    wristDelta(arcDeltas[1].wrist, 1.0, linear),
  );
  yield* all(
    baseDelta(arcDeltas[2].base, 1.0, linear),
    turretDelta(arcDeltas[2].turret, 1.0, linear),
    shoulderDelta(arcDeltas[2].shoulder, 1.0, linear),
    elbowDelta(arcDeltas[2].elbow, 1.0, linear),
    wristDelta(arcDeltas[2].wrist, 1.0, linear),
  );
  yield* all(
    baseDelta(arcDeltas[3].base, 1.0, linear),
    turretDelta(arcDeltas[3].turret, 1.0, linear),
    shoulderDelta(arcDeltas[3].shoulder, 1.0, linear),
    elbowDelta(arcDeltas[3].elbow, 1.0, linear),
    wristDelta(arcDeltas[3].wrist, 1.0, linear),
  );
  yield* all(
    baseDelta(placeDeltas.base, 1.2, easeInOutCubic),
    turretDelta(placeDeltas.turret, 1.2, easeInOutCubic),
    shoulderDelta(placeDeltas.shoulder, 1.2, easeInOutCubic),
    elbowDelta(placeDeltas.elbow, 1.2, easeInOutCubic),
    wristDelta(placeDeltas.wrist, 1.2, easeInOutCubic),
  );
  yield* waitFor(0.1);

  // ── Release — как в референсе: позиция + rotation.x, пальцы открываются ─
  cubeAttached = false;
  cubePlaced = true;
  cube3d.position.copy(placeTarget);
  cube3d.rotation.x = 0;
  yield* all(
    ...halateTo(LINE_RELEASE, 0.3),
    gripClose(0, 0.4, easeInOutCubic),
  );
  yield* waitFor(0.3);

  // ── Return to rest — медленно, как в careful-arm сцене ────────────────
  yield* all(
    ...halateTo(null, 0.6),
    baseDelta(0, 2.0, easeInOutCubic),
    turretDelta(0, 2.0, easeInOutCubic),
    shoulderDelta(0, 2.0, easeInOutCubic),
    elbowDelta(0, 2.0, easeInOutCubic),
    wristDelta(0, 2.0, easeInOutCubic),
  );

  // Код не изменился ни на символ. Дверь была готова.
  yield* waitFor(1.4);
});
