import {
  blur,
  brightness,
  Circle,
  makeScene2D,
  Node,
  Rect,
  saturate,
  sepia,
  Txt,
  View2D,
} from '@motion-canvas/2d';
import {
  all,
  createRef,
  createSignal,
  easeInOutCubic,
  easeOutCubic,
  ThreadGenerator,
  waitFor,
} from '@motion-canvas/core';
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
import {Fonts, Screen, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {Medusa} from '../core/code/director/Medusa';
import {JavaClass, method, param} from '../core/code/model/JavaModel';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingX, getLineHeight, measureChar} from '../core/code/shared/TextMeasure';

// ══════════════════════════════════════════════════════════════════════
// Chapter 2 — the WHOLE chapter as one scene, in the montage order:
//   1. title card            (chapter2EarnAbstractionSceneEn)
//   2. replay, part A        (chapter2ReplaySceneEn: erase in one breath)
//   3. living path           (chapter2LivingPathSceneEn: arm runs bare code)
//   4. replay, parts C/D/E   (guard → gold evidence → fold + profile panel)
//   5. boundary take, silent (chapter2BoundaryTakeSceneEn)
//   6. final run             (chapter2FinalRunSceneEn: sensitive cube)
// Segment bodies are verbatim copies of the standalone scenes; the only
// merge additions are the cross-cut fades and the subtitle track.
// chapter2Full(true) burns the VO subtitles in; chapter2Full(false) is the
// clean twin. Subtitle calls cost the SAME fixed time in both variants, so
// the two timelines are frame-identical.
// ══════════════════════════════════════════════════════════════════════

// ── Subtitles ─────────────────────────────────────────────────────────────
const SUB_FONT_SIZE = 40;
const SUB_LINE_HEIGHT = 56;
const SUB_W = 1600;
const SUB_Y = 462;
const SUB_COLOR = 'rgba(244, 241, 235, 0.95)';
// Scrim wears the background's bottom color with feathered edges: invisible
// over the background itself, quietly masks whatever slides underneath.
const SUB_SCRIM = '#12141A';

type Subs = {
  swap(text: string, y?: number): ThreadGenerator;
  off(): ThreadGenerator;
};

// Бит E: финальный стек доходит до y≈465 — двухстрочный капшен на штатном
// месте наезжает на низ панели профиля. Капшены бита E — однострочные и ниже.
const E_SUB_Y = 505;

function createSubs(view: View2D, enabled: boolean): Subs {
  const layer = createRef<Node>();
  const scrim = createRef<Rect>();
  const label = createRef<Txt>();
  view.add(
    <Node ref={layer}>
      <Rect
        ref={scrim}
        y={SUB_Y}
        width={SUB_W + 220}
        height={190}
        fill={SUB_SCRIM}
        opacity={0}
        filters={[blur(36)]}
        cachePadding={120}
      />
      <Txt
        ref={label}
        y={SUB_Y}
        width={SUB_W}
        textAlign={'center'}
        textWrap={true}
        fontFamily={Fonts.code}
        fontSize={SUB_FONT_SIZE}
        lineHeight={SUB_LINE_HEIGHT}
        fill={SUB_COLOR}
        opacity={0}
        text={''}
      />
    </Node>,
  );

  let shown = false;

  function* swap(text: string, y: number = SUB_Y): ThreadGenerator {
    const wasShown = shown;
    shown = true;
    if (!enabled) {
      yield* waitFor(wasShown ? 0.6 : 0.35);
      return;
    }
    layer().moveToTop();
    if (wasShown) {
      yield* label().opacity(0, 0.25, easeInOutCubic);
      label().text(text);
      label().y(y);
      scrim().y(y);
      yield* label().opacity(1, 0.35, easeInOutCubic);
    } else {
      label().text(text);
      label().y(y);
      scrim().y(y);
      yield* all(
        scrim().opacity(1, 0.35, easeInOutCubic),
        label().opacity(1, 0.35, easeInOutCubic),
      );
    }
  }

  function* off(): ThreadGenerator {
    const wasShown = shown;
    shown = false;
    if (!wasShown) return;
    if (!enabled) {
      yield* waitFor(0.4);
      return;
    }
    yield* all(
      scrim().opacity(0, 0.4, easeInOutCubic),
      label().opacity(0, 0.4, easeInOutCubic),
    );
  }

  return {swap, off};
}

// ══════════════════════════════════════════════════════════════════════
// Segment 1 — title card (verbatim chapter2EarnAbstractionSceneEn)
// ══════════════════════════════════════════════════════════════════════
const CHAPTER_FONT_SIZE = 40;
const TITLE_FONT_SIZE = 72;
const TITLE_TEXT_COLOR = 'rgba(244, 241, 235, 0.95)';
const TITLE_MUTED = 'rgba(244, 241, 235, 0.6)';

function* titleSegment(view: View2D, subs: Subs): ThreadGenerator {
  const container = createRef<Node>();
  const chapterRef = createRef<Txt>();
  const titleRef = createRef<Txt>();

  view.add(
    <Node ref={container} opacity={0}>
      <Txt
        ref={chapterRef}
        text={'CHAPTER 2'}
        fontFamily={Fonts.primary}
        fontWeight={500}
        fontSize={CHAPTER_FONT_SIZE}
        letterSpacing={18}
        fill={TITLE_MUTED}
        y={-60}
        opacity={0}
      />
      <Txt
        ref={titleRef}
        text={'EARN THE ABSTRACTION'}
        fontFamily={Fonts.primary}
        fontWeight={700}
        fontSize={TITLE_FONT_SIZE}
        letterSpacing={16}
        fill={TITLE_TEXT_COLOR}
        y={30}
        opacity={0}
      />
    </Node>,
  );

  yield* container().opacity(1, 0);

  yield* chapterRef().opacity(1, 0.8, easeInOutCubic);
  yield* subs.swap('Real preparation does not try to predict the shape of the next change.');
  yield* waitFor(0.5);

  yield* titleRef().opacity(1, 0.7, easeInOutCubic);
  yield* waitFor(3.4);

  yield* subs.swap('It keeps the code easy to reshape until that change arrives.');
  yield* waitFor(4.4);

  yield* container().opacity(0, 1.2, easeInOutCubic);
  yield* waitFor(0.3);
  container().remove();
}

// ══════════════════════════════════════════════════════════════════════
// Shared robot-arm infrastructure — byte-identical in livingPath/finalRun,
// factored once. Everything that DIFFERS between the two runs (cube color,
// IK targets, onRender cube rules, choreography) stays inside each segment.
// ══════════════════════════════════════════════════════════════════════
const MODEL_URL = '/basic_robot_arm.glb';
const ARM_SCALE = 0.85;
const ARM_DISPLAY = 0.801;
const THREE_W = Math.ceil(Screen.width / ARM_SCALE);
const THREE_H = Math.ceil(Screen.height / ARM_SCALE);
const ARM_LEFT_PAD = 80;

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

type ArmWorld = {
  scene3: Scene;
  camera: PerspectiveCamera;
  cube3d: Group;
  cubeStartX: number;
  cubeStopX: number;
  cubeStartPos: Vector3;
  placeTarget: Vector3;
};

function buildArmWorld(cubeColor: number): ArmWorld {
  const scene3 = new Scene();

  const camera = new PerspectiveCamera(50, THREE_W / THREE_H, 1, 10000);
  camera.position.set(900, 550, 1400);
  camera.lookAt(-100, 250, 400);

  const fillMat = new MeshBasicMaterial({color: 0x00a0b8, transparent: true, opacity: 0.12});
  const edgeMat = new LineBasicMaterial({color: 0x00a0b8, transparent: true, opacity: 0.7});
  const cubeFillMat = new MeshBasicMaterial({color: cubeColor, transparent: true, opacity: 0.25});
  const cubeEdgeMat = new LineBasicMaterial({color: cubeColor, transparent: true, opacity: 1.0});

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

  return {scene3, camera, cube3d, cubeStartX, cubeStopX, cubeStartPos, placeTarget};
}

type ArmRig = {
  sceneRoot: Object3D;
  bones: Record<string, Bone | null>;
  fingers: Record<string, Bone | null>;
  fingerPos: {open: {f1: Vector3; f2: Vector3}; closed: {f1: Vector3; f2: Vector3}};
  initRot: Record<string, number>;
};

function* loadArm(scene3: Scene): Generator<any, ArmRig, any> {
  const loader = new GLTFLoader();
  const gltf: any = yield new Promise<any>((resolve, reject) => {
    loader.load(MODEL_URL, resolve, undefined, reject);
  });
  scene3.add(gltf.scene);
  const sceneRoot = gltf.scene as Object3D;

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

  const fingerPos: ArmRig['fingerPos'] = {
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

  return {sceneRoot, bones, fingers, fingerPos, initRot};
}

// Halation layers — same film-halo recipe both arm segments use.
const HAL_BLOOM_BLUR    = 6;
const HAL_BLOOM_OPACITY = 0.7;
const HAL_WARM_BLUR     = 18;
const HAL_WARM_OPACITY  = 0.9;
const HAL_CROSSFADE     = 0.35;

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

// ══════════════════════════════════════════════════════════════════════
// Segment 3 — living path (verbatim chapter2LivingPathSceneEn)
// ══════════════════════════════════════════════════════════════════════
function* livingPathSegment(view: View2D, subs: Subs): Generator<any, void, any> {
  const CODE_W = Screen.width / 2 - ARM_LEFT_PAD - 20;
  const CODE_FONT_SIZE = 30;
  const MAX_LINE_CHARS = 80;

  const VAR_LIGHT = 'rgba(244, 241, 235, 0.96)';
  const TYPE_CLEAN = 'rgba(220, 215, 255, 0.80)';
  const METHOD_COLOR = DryFiltersV3CodeTheme.method;
  const SOFT_GREEN = 'rgba(168, 214, 178, 0.88)';
  const KW_COLOR = DryFiltersV3CodeTheme.keyword;

  const CODE_CARD_STYLE = {
    radius: 24, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)',
    strokeWidth: 0, shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
    shadowOffsetX: 0, shadowOffsetY: 0, edge: false,
  } as const;

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
    {match: /^Cube$/,         color: TYPE_CLEAN},
    {match: /^Table$/,        color: TYPE_CLEAN},
    {match: 'moveTo',         color: METHOD_COLOR, onlyTypes: ['method']},
    {match: 'grab',           color: METHOD_COLOR, onlyTypes: ['method']},
    {match: 'confirmGrip',    color: METHOD_COLOR, onlyTypes: ['method']},
    {match: 'release',        color: METHOD_COLOR, onlyTypes: ['method']},
    {match: /^"[^"]*"$/,      color: SOFT_GREEN},
  ];

  const LINE_REACH   = 1;  // arm.moveTo(cube.position);
  const LINE_GRAB    = 2;  // arm.grab(cube);
  const LINE_CONFIRM = 3;  // arm.confirmGrip();
  const LINE_PLACE   = 4;  // arm.moveTo(table.position);
  const LINE_RELEASE = 5;  // arm.release();

  // ── 3D world + arm ────────────────────────────────────────────────────
  const world = buildArmWorld(0xff9500);
  const {scene3, camera, cube3d, cubeStartX, cubeStopX, cubeStartPos, placeTarget} = world;
  const {sceneRoot, bones, fingers, fingerPos, initRot} = yield* loadArm(scene3);

  // ── IK ────────────────────────────────────────────────────────────────
  const reachDeltas = solveIK(sceneRoot, bones, initRot, cubeStartPos);
  const liftTarget = new Vector3(0, 550, 500);
  const liftDeltas = solveIK(sceneRoot, bones, initRot, liftTarget);
  const placeDeltas = solveIK(sceneRoot, bones, initRot, placeTarget);

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
  let grabTilt = 0;
  let grabTiltReady = false;

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

      if (cubeAttached) {
        const wp = new Vector3(), hp = new Vector3();
        bones.wrist!.getWorldPosition(wp);
        bones.hand!.getWorldPosition(hp);
        const tip = hp.clone().add(hp.clone().sub(wp));
        const b = grabBlend();
        cube3d.position.lerpVectors(grabOrigin, tip, b);
        const dir3 = hp.clone().sub(wp);
        const horiz = Math.sqrt(dir3.x * dir3.x + dir3.z * dir3.z);
        const tilt = Math.atan2(dir3.y, horiz);
        if (!grabTiltReady) {
          grabTilt = tilt;
          grabTiltReady = true;
        }
        cube3d.rotation.y = (baseDelta() + turretDelta()) - grabBaseY;
        cube3d.rotation.x = -(tilt - grabTilt);
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

  // ── Code ──────────────────────────────────────────────────────────────
  const fontSize   = CODE_FONT_SIZE;
  const lineHeight = getLineHeight(fontSize);
  const codeX = -Screen.width / 2 + ARM_LEFT_PAD + CODE_W / 2 - getCodePaddingX(fontSize);

  const model = JavaClass.create([
    method('public', 'void', 'handleCube',
      [param('Cube', 'cube'), param('Table', 'table')],
      ['arm.moveTo(cube.position);',
       'arm.grab(cube);',
       'arm.confirmGrip();',
       'arm.moveTo(table.position);',
       'arm.release();']),
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
    customTypes: ['Cube', 'Table', 'Position', 'GripResult', 'LiftPlan', 'ObjectProfile', 'PlacementConfig'],
  });
  manticore.mount(view);
  manticore.colorize(COLOR_RULES);

  const dir = new Medusa(model, manticore, {
    morphDefaults: {scrollStrategy: 'block', removeDuration: 0, moveDuration: 0.6},
    pauseAfterMorph: 0.5,
  });

  const halation = new Map<number, ReturnType<typeof attachHalation>>();
  for (const i of [LINE_REACH, LINE_GRAB, LINE_CONFIRM, LINE_PLACE, LINE_RELEASE]) {
    halation.set(i, attachHalation(manticore.getLine(i)!.node));
  }

  let halLit: number | null = null;
  const halateTo = (line: number | null, duration = HAL_CROSSFADE): ThreadGenerator[] => {
    const tweens: ThreadGenerator[] = [];
    if (halLit !== null) tweens.push(halation.get(halLit)!(0, duration, easeInOutCubic));
    if (line !== null) tweens.push(halation.get(line)!(1, duration, easeInOutCubic));
    halLit = line;
    return tweens;
  };

  // ── Animation ─────────────────────────────────────────────────────────
  yield* dir.cb.appear(0.8);
  yield* waitFor(0.6);

  yield* threeView.node.opacity(1, 0.8, easeInOutCubic);
  yield* waitFor(0.4);

  yield* subs.swap('Five plain lines remain, and they still do the whole job.');

  // Belt moves cube
  yield* cubeX(cubeStopX, 2.0, easeInOutCubic);
  yield* waitFor(0.5);

  // ── Reach ─────────────────────────────────────────────────────────────
  yield* all(
    ...halateTo(LINE_REACH),
    baseDelta(reachDeltas.base, 1.5, easeInOutCubic),
    turretDelta(reachDeltas.turret, 1.5, easeInOutCubic),
    shoulderDelta(reachDeltas.shoulder, 1.5, easeInOutCubic),
    elbowDelta(reachDeltas.elbow, 1.5, easeInOutCubic),
    wristDelta(reachDeltas.wrist, 1.5, easeInOutCubic),
  );
  yield* waitFor(0.2);

  // ── Grip ──────────────────────────────────────────────────────────────
  yield* all(
    ...halateTo(LINE_GRAB, 0.3),
    gripClose(0.7, 0.3, easeInOutCubic),
  );
  grabOrigin.copy(cube3d.position);
  grabBaseY = baseDelta() + turretDelta();
  grabTiltReady = false;
  cubeAttached = true;
  yield* grabBlend(1, 0.15, easeInOutCubic);

  // ── Confirm grip ──────────────────────────────────────────────────────
  yield* all(
    ...halateTo(LINE_CONFIRM, 0.3),
    gripClose(0.85, 0.45, easeInOutCubic),
  );
  yield* waitFor(0.5);

  yield* subs.off();

  // ── Place: подъём и перенос — одна строка кода, одно длинное движение ─
  yield* all(
    ...halateTo(LINE_PLACE),
    baseDelta(liftDeltas.base, 1.6, easeInOutCubic),
    turretDelta(liftDeltas.turret, 1.6, easeInOutCubic),
    shoulderDelta(liftDeltas.shoulder, 1.6, easeInOutCubic),
    elbowDelta(liftDeltas.elbow, 1.6, easeInOutCubic),
    wristDelta(liftDeltas.wrist, 1.6, easeInOutCubic),
  );
  yield* all(
    baseDelta(placeDeltas.base, 2.0, easeInOutCubic),
    turretDelta(placeDeltas.turret, 2.0, easeInOutCubic),
    shoulderDelta(placeDeltas.shoulder, 2.0, easeInOutCubic),
    elbowDelta(placeDeltas.elbow, 2.0, easeInOutCubic),
    wristDelta(placeDeltas.wrist, 2.0, easeInOutCubic),
  );
  yield* waitFor(0.1);

  // ── Release ───────────────────────────────────────────────────────────
  cubeAttached = false;
  cubePlaced = true;
  cube3d.position.copy(placeTarget);
  cube3d.rotation.x = 0;
  yield* all(
    ...halateTo(LINE_RELEASE, 0.3),
    gripClose(0, 0.3, easeInOutCubic),
  );
  yield* waitFor(0.3);

  // ── Return to rest ────────────────────────────────────────────────────
  yield* all(
    ...halateTo(null, 0.6),
    baseDelta(0, 1.5, easeInOutCubic),
    turretDelta(0, 1.5, easeInOutCubic),
    shoulderDelta(0, 1.5, easeInOutCubic),
    elbowDelta(0, 1.5, easeInOutCubic),
    wristDelta(0, 1.5, easeInOutCubic),
  );

  yield* waitFor(1.0);

  // ── Merge exit: hand the stage back to the replay block ───────────────
  yield* all(
    threeView.node.opacity(0, 0.8, easeInOutCubic),
    manticore.node.opacity(0, 0.8, easeInOutCubic),
  );
  threeView.node.remove();
  manticore.node.remove();
}

// ══════════════════════════════════════════════════════════════════════
// Segment 5 — boundary take (verbatim chapter2BoundaryTakeSceneEn, silent)
// ══════════════════════════════════════════════════════════════════════
function* boundaryTakeSegment(view: View2D): ThreadGenerator {
  const PART_COLOR   = 'rgba(100, 180, 255, 0.85)';
  const GOLD         = 'rgba(255, 214, 140, 1.0)';
  const GOLD_BORDER  = 'rgba(255, 214, 140, 0.45)';
  const GOLD_FILL    = 'rgba(255, 214, 140, 0.05)';

  const DOT_R = 22;

  const STILL_PARTS = [
    {x: -560, y: -180},
    {x: -430, y:  150},
    {x: -120, y: -230},
    {x:   60, y:  210},
    {x:  420, y: -160},
    {x:  610, y:  100},
  ];

  const MOVERS = [
    {x: -260, y:  60, toX: 140, toY: -10},
    {x:   30, y: -60, toX: 260, toY:  60},
    {x:  500, y: 240, toX: 190, toY: 110},
  ];

  const BOUNDARY_X = 196;
  const BOUNDARY_Y = 53;
  const BOUNDARY_R = 150;

  const NUDGE_X = 30;
  const NUDGE_Y = 8;
  const SWEEP_SPAN = 0.9;
  const FIELD_MIN_X = -560;
  const FIELD_MAX_X = 610;

  const sweepDelay = (x: number) =>
    ((x - FIELD_MIN_X) / (FIELD_MAX_X - FIELD_MIN_X)) * SWEEP_SPAN;

  const root = createRef<Node>();
  view.add(<Node ref={root} />);

  const stillRefs = STILL_PARTS.map(() => createRef<Circle>());
  for (let i = 0; i < STILL_PARTS.length; i++) {
    const p = STILL_PARTS[i];
    root().add(
      <Circle
        ref={stillRefs[i]}
        x={p.x} y={p.y}
        width={DOT_R * 2} height={DOT_R * 2}
        fill={PART_COLOR}
        opacity={0}
      />,
    );
  }

  const moverRefs = MOVERS.map(() => createRef<Circle>());
  for (let i = 0; i < MOVERS.length; i++) {
    const p = MOVERS[i];
    root().add(
      <Circle
        ref={moverRefs[i]}
        x={p.x} y={p.y}
        width={DOT_R * 2} height={DOT_R * 2}
        fill={PART_COLOR}
        opacity={0}
      />,
    );
  }

  const boundary = createRef<Circle>();
  root().add(
    <Circle
      ref={boundary}
      x={BOUNDARY_X} y={BOUNDARY_Y}
      width={BOUNDARY_R * 2} height={BOUNDARY_R * 2}
      stroke={GOLD_BORDER}
      lineWidth={3}
      lineCap={'round'}
      fill={'rgba(0,0,0,0)'}
      startAngle={-90}
      endAngle={-90}
      opacity={1}
    />,
  );

  // ── 1. The parts appear — indistinguishable, no grouping visible ──
  const everyDot = [...stillRefs, ...moverRefs];
  yield* all(
    ...everyDot.map((r, i) =>
      r().opacity(1, 0.9, easeInOutCubic).wait(i * 0.05),
    ),
  );
  yield* waitFor(1.1);

  // ── 2. A change passes through the field ──────────────────────────
  const shiver = (r: ReturnType<typeof createRef<Circle>>, x: number, y: number, delay: number) =>
    (function* () {
      yield* waitFor(delay);
      yield* r().position([x + NUDGE_X, y + NUDGE_Y], 0.32, easeOutCubic);
      yield* r().position([x, y], 0.55, easeInOutCubic);
    })();

  const carry = (r: ReturnType<typeof createRef<Circle>>, m: typeof MOVERS[number], delay: number) =>
    (function* () {
      yield* waitFor(delay);
      yield* all(
        r().position([m.toX, m.toY], 1.7, easeInOutCubic),
        r().fill(GOLD, 1.2, easeInOutCubic),
      );
    })();

  yield* all(
    ...STILL_PARTS.map((p, i) => shiver(stillRefs[i], p.x, p.y, sweepDelay(p.x))),
    ...MOVERS.map((m, i) => carry(moverRefs[i], m, sweepDelay(m.x))),
  );
  yield* waitFor(0.8);

  // ── 3. Only now: the boundary draws itself around what moved as one ─
  yield* boundary().endAngle(270, 1.3, easeInOutCubic);
  yield* boundary().fill(GOLD_FILL, 0.6, easeInOutCubic);
  yield* waitFor(4.0);

  // ── Quiet exit ────────────────────────────────────────────────────
  yield* all(
    ...everyDot.map(r => r().opacity(0, 1.0, easeInOutCubic)),
    boundary().opacity(0, 1.0, easeInOutCubic),
  );
  yield* waitFor(0.3);
  root().remove();
}

// ══════════════════════════════════════════════════════════════════════
// Segment 6 — final run (verbatim chapter2FinalRunSceneEn)
// ══════════════════════════════════════════════════════════════════════
function* finalRunSegment(view: View2D, subs: Subs): Generator<any, void, any> {
  const CODE_W = Screen.width / 2 - ARM_LEFT_PAD - 20;
  const CODE_FONT_SIZE = 24;
  const MAX_LINE_CHARS = 80;

  const VAR_LIGHT = 'rgba(244, 241, 235, 0.96)';
  const TYPE_CLEAN = 'rgba(220, 215, 255, 0.80)';
  const METHOD_COLOR = DryFiltersV3CodeTheme.method;
  const SOFT_GREEN = 'rgba(168, 214, 178, 0.88)';
  const KW_COLOR = DryFiltersV3CodeTheme.keyword;

  const CODE_CARD_STYLE = {
    radius: 24, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)',
    strokeWidth: 0, shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
    shadowOffsetX: 0, shadowOffsetY: 0, edge: false,
  } as const;

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

  const LINE_REACH   = 1;  // arm.moveTo(cube.position);
  const LINE_PROFILE = 3;  // HandlingProfile handling = HandlingProfile.forCube(cube, table);
  const LINE_GRAB    = 5;  // arm.grab(cube, handling.gripForce);
  const LINE_CONFIRM = 6;  // arm.confirmGrip();
  const LINE_PLACE   = 7;  // arm.moveTo(table.position, handling.motionProfile);
  const LINE_RELEASE = 8;  // arm.release(handling.releaseStyle);

  // ── 3D world + arm — sensitive cube is PURPLE (careful-arm vocabulary) ─
  const world = buildArmWorld(0xb388ff);
  const {scene3, camera, cube3d, cubeStartX, cubeStopX, cubeStartPos, placeTarget} = world;
  const {sceneRoot, bones, fingers, fingerPos, initRot} = yield* loadArm(scene3);

  // ── IK — reach + осторожная дуга переноса + place ─────────────────────
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

  // ── Code — финальный handleCube; директора морфов НЕТ, код не меняется ─
  const fontSize   = CODE_FONT_SIZE;
  const lineHeight = getLineHeight(fontSize);
  const codeX = -Screen.width / 2 + ARM_LEFT_PAD + CODE_W / 2 - getCodePaddingX(fontSize);

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

  const halation = new Map<number, ReturnType<typeof attachHalation>>();
  for (const i of [
    LINE_REACH, LINE_PROFILE,
    LINE_GRAB, LINE_CONFIRM, LINE_PLACE, LINE_RELEASE,
  ]) {
    halation.set(i, attachHalation(manticore.getLine(i)!.node));
  }

  let halLit: number | null = null;
  const halateTo = (line: number | null, duration = HAL_CROSSFADE): ThreadGenerator[] => {
    const tweens: ThreadGenerator[] = [];
    if (halLit !== null) tweens.push(halation.get(halLit)!(0, duration, easeInOutCubic));
    if (line !== null) tweens.push(halation.get(line)!(1, duration, easeInOutCubic));
    halLit = line;
    return tweens;
  };

  // ── Animation — один последний цикл, код не меняется ни на символ ─────
  yield* manticore.appear(0.8);
  yield* waitFor(0.6);

  yield* threeView.node.opacity(1, 0.8, easeInOutCubic);
  yield* waitFor(0.4);

  yield* subs.swap('Now a sensitive cube comes down the line.');

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

  yield* subs.swap('The same workflow executes, but the behavior changes.');

  // ── The decision — рука неподвижна, свет стоит на двери ───────────────
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
  yield* all(
    ...halateTo(LINE_CONFIRM, 0.3),
    gripClose(0.62, 0.45, easeInOutCubic),
  );
  yield* waitFor(0.5);

  yield* subs.swap('This may not be the final design. It is simply the smallest abstraction the evidence supports today.');

  // ── Place — CAUTIOUS: одна строка, одна медленная дуга (5.4с) ─────────
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

  yield* subs.swap('That is how you earn an abstraction: let the change arrive, see what moves together, and extract only that.');

  // ── Return to rest — медленно, как в careful-arm сцене ────────────────
  yield* all(
    ...halateTo(null, 0.6),
    baseDelta(0, 2.0, easeInOutCubic),
    turretDelta(0, 2.0, easeInOutCubic),
    shoulderDelta(0, 2.0, easeInOutCubic),
    elbowDelta(0, 2.0, easeInOutCubic),
    wristDelta(0, 2.0, easeInOutCubic),
  );

  // Код не изменился ни на символ. Дверь была готова. Холд растянут под
  // закрывающую VO-строку.
  yield* waitFor(4.2);
  yield* subs.off();
  yield* waitFor(0.4);
}

// ══════════════════════════════════════════════════════════════════════
// Segments 2 + 4 — replay (verbatim chapter2ReplaySceneEn constants)
// ══════════════════════════════════════════════════════════════════════
const CODE_FONT_SIZE = 24;
const CODE_W = 1180;
const LINE_HEIGHT = Math.round(CODE_FONT_SIZE * 1.62 * 10) / 10;
const CLIP_PAD_Y = 20;

const MAX_LINES = 24;
const MAIN_H = MAX_LINES * LINE_HEIGHT + CLIP_PAD_Y * 2;
const MAIN_Y = 0;

const FINAL_MAIN_LINES = 15;
const PANEL_LINES = 8;
const PANEL_W = CODE_W;
const PANEL_H = PANEL_LINES * LINE_HEIGHT + CLIP_PAD_Y * 2;
const STACK_GAP = 36;
const STACK_CONTENT =
  FINAL_MAIN_LINES * LINE_HEIGHT + STACK_GAP + PANEL_LINES * LINE_HEIGHT;
const STACK_TOP = -STACK_CONTENT / 2;
const MAIN_Y_FINAL = STACK_TOP + MAIN_H / 2 - CLIP_PAD_Y;
const PANEL_Y = STACK_TOP + FINAL_MAIN_LINES * LINE_HEIGHT + STACK_GAP
  + PANEL_H / 2 - CLIP_PAD_Y;

const MAX_LINE_CHARS = Math.floor(
  (CODE_W - getCodePaddingX(CODE_FONT_SIZE)) / measureChar(CODE_FONT_SIZE),
);

const VAR_LIGHT = 'rgba(244, 241, 235, 0.96)';
const TYPE_CLEAN = 'rgba(220, 215, 255, 0.80)';
const METHOD_COLOR = DryFiltersV3CodeTheme.method;
const CONST_COLOR = DryFiltersV3CodeTheme.constant;

const CREATE_GREEN = 'rgba(150, 230, 165, 0.96)';

const ACCENT = 'rgba(255, 214, 140, 1.0)';
const HALATION_COLOR = 'rgba(255, 104, 36, 0.8)';
const HALATION_BLUR = 16;

const ACCENT_TOKENS = new Set([
  'GripForce', 'GENTLE',
  'MotionProfile', 'CAUTIOUS',
  'ReleaseStyle', 'ALIGNED',
]);

const COLOR_RULES: ColorRule[] = [
  // vars
  {match: 'handleCube',    color: VAR_LIGHT},
  {match: 'arm',           color: VAR_LIGHT},
  {match: 'cube',          color: VAR_LIGHT},
  {match: 'table',         color: VAR_LIGHT},
  {match: 'position',      color: VAR_LIGHT},
  {match: 'grabStrategy',  color: VAR_LIGHT},
  {match: 'handling',      color: VAR_LIGHT},
  {match: 'result',        color: VAR_LIGHT},
  {match: 'confidence',    color: VAR_LIGHT},
  {match: 'motionProfile', color: VAR_LIGHT},
  {match: 'orientation',   color: VAR_LIGHT},
  {match: 'gripForce',     color: VAR_LIGHT},
  {match: 'releaseStyle',  color: VAR_LIGHT},
  // constants
  {match: /^SENSITIVE$/,   color: CONST_COLOR},
  {match: /^STANDARD$/,    color: CONST_COLOR},
  {match: /^GENTLE$/,      color: CONST_COLOR},
  {match: /^CAUTIOUS$/,    color: CONST_COLOR},
  {match: /^ALIGNED$/,     color: CONST_COLOR},
  // types
  {match: /^Cube$/,                  color: TYPE_CLEAN},
  {match: /^Table$/,                 color: TYPE_CLEAN},
  {match: /^GrabResult$/,            color: TYPE_CLEAN},
  {match: /^RobotArm$/,              color: TYPE_CLEAN},
  {match: /^GrabStrategy$/,          color: TYPE_CLEAN},
  {match: /^StandardGrab$/,          color: TYPE_CLEAN},
  {match: /^HandlingProfile$/,       color: TYPE_CLEAN},
  {match: /^GripForce$/,             color: TYPE_CLEAN},
  {match: /^MotionProfile$/,         color: TYPE_CLEAN},
  {match: /^ReleaseStyle$/,          color: TYPE_CLEAN},
  // methods
  {match: 'moveTo',                 color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'grab',                   color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'confirmGrip',            color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'release',                color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'hasSensitiveComponents', color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'forCube',                color: METHOD_COLOR, onlyTypes: ['method']},
];

const GREEN_RULES: ColorRule[] = [
  ...COLOR_RULES,
  {match: 'hasSensitiveComponents', color: CREATE_GREEN, onlyTypes: ['method']},
  {match: /^GripForce$/,     color: CREATE_GREEN},
  {match: /^GENTLE$/,        color: CREATE_GREEN},
  {match: /^MotionProfile$/, color: CREATE_GREEN},
  {match: /^CAUTIOUS$/,      color: CREATE_GREEN},
  {match: /^ReleaseStyle$/,  color: CREATE_GREEN},
  {match: /^ALIGNED$/,       color: CREATE_GREEN},
];

const FOLD_GREEN_RULES: ColorRule[] = [
  ...COLOR_RULES,
  {match: /^HandlingProfile$/, color: CREATE_GREEN},
  {match: 'handling',          color: CREATE_GREEN},
  {match: 'forCube',           color: CREATE_GREEN, onlyTypes: ['method']},
];

const PANEL_ACCENT_RULES: ColorRule[] = [
  ...COLOR_RULES,
  {match: /^GripForce$/,     color: ACCENT},
  {match: /^GENTLE$/,        color: ACCENT},
  {match: /^MotionProfile$/, color: ACCENT},
  {match: /^CAUTIOUS$/,      color: ACCENT},
  {match: /^ReleaseStyle$/,  color: ACCENT},
  {match: /^ALIGNED$/,       color: ACCENT},
];

const CUSTOM_TYPES = [
  'Cube', 'Table', 'GrabResult', 'RobotArm',
  'GrabStrategy', 'StandardGrab',
  'HandlingProfile', 'GripForce', 'MotionProfile', 'ReleaseStyle',
];

const CODE_CARD_STYLE = {
  radius: 16, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0, shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
  shadowOffsetX: 0, shadowOffsetY: 0, edge: false,
} as const;

const CANON_MORPH = {
  scrollStrategy: 'block' as const,
  removeDuration: 0,
  moveDuration: 0.6,
};

const ERASE_TINT = 'rgba(244, 241, 235, 0.96)';
const ERASE_MORPH = {
  ...CANON_MORPH,
  removeDuration: 0.3,
  flashRemovedColor: ERASE_TINT,
  flashRemovedDuration: 0.12,
  flashRemovedErase: 'reverseType' as const,
  flashRemovedEraseCharDelay: 0.02,
  flashRemovedExcludeTypes: [],
  tokenSlideDuration: 0.35,
  addStyle: 'typewriter' as const,
  charDelay: 0.02,
};

const TYPE_MORPH = {
  ...CANON_MORPH,
  addStyle: 'typewriter' as const,
  charDelay: 0.02,
  lineDelay: 0.1,
};

const PANEL_CODE = `class HandlingProfile {
    static final HandlingProfile SENSITIVE = new HandlingProfile(
            GripForce.GENTLE, MotionProfile.CAUTIOUS, ReleaseStyle.ALIGNED);

    static HandlingProfile forCube(Cube cube, Table table) {
        return cube.hasSensitiveComponents() ? SENSITIVE : STANDARD;
    }
}`;

// ══════════════════════════════════════════════════════════════════════
// The chapter
// ══════════════════════════════════════════════════════════════════════
export function chapter2Full(withSubs: boolean) {
  return makeScene2D(function* (view) {
    applyBackground(view);
    const subs = createSubs(view, withSubs);

    // ══ 1. TITLE ══════════════════════════════════════════════════════
    yield* titleSegment(view, subs);

    // ══ 2. REPLAY, PART A — the guess is erased in one breath ═════════
    const handlerModel = JavaClass.create([
      method('public', 'void', 'handleCube',
        [param('Cube', 'cube'), param('Table', 'table')],
        [
          'arm.moveTo(cube.position);',
          'GrabResult result = grabStrategy.grab(cube);',
          'arm.confirmGrip(result.confidence);',
          'arm.moveTo(table.position, result.motionProfile);',
          'arm.release(result.orientation);',
        ]),
    ], MAX_LINE_CHARS, {
      className: 'CubeHandler',
      fields: [
        'private final RobotArm arm = new RobotArm();',
        'private final GrabStrategy grabStrategy = new StandardGrab();',
      ],
    });

    const mc = Manticore.create(handlerModel.render(), {
      x: 0, y: MAIN_Y,
      width: CODE_W,
      height: MAIN_H,
      fontSize: CODE_FONT_SIZE,
      lineHeight: LINE_HEIGHT,
      clipPaddingY: CLIP_PAD_Y,
      fontFamily: Fonts.code,
      theme: DryFiltersV3CodeTheme,
      cardStyle: CODE_CARD_STYLE,
      glowAccent: false,
      noClip: true,
      customTypes: CUSTOM_TYPES,
    });
    mc.mount(view);
    mc.colorize(COLOR_RULES);

    const dir = new Medusa(handlerModel, mc, {
      morphDefaults: CANON_MORPH,
      profiles: {stableExpand: CANON_MORPH},
      pauseAfterMorph: 0.5,
    });

    yield* mc.appear(Timing.slow);
    yield* subs.swap('So let’s rewind and run the story again — without the guess.');
    yield* waitFor(2.8);

    yield* subs.swap('We remove everything built for an imagined future.');
    yield* waitFor(0.3);

    // The whole guess leaves in one breath: every erased token across every
    // line backspaces in the same erase pass, the parens slide shut together.
    yield* dir.apply(m => {
      m.setFields(['private final RobotArm arm = new RobotArm();']);
      m.replaceLine('handleCube',
        'GrabResult result = grabStrategy.grab(cube);',
        'arm.grab(cube);');
      m.replaceLine('handleCube',
        'arm.confirmGrip(result.confidence);',
        'arm.confirmGrip();');
      m.replaceLine('handleCube',
        'arm.moveTo(table.position, result.motionProfile);',
        'arm.moveTo(table.position);');
      m.replaceLine('handleCube',
        'arm.release(result.orientation);',
        'arm.release();');
    }, ERASE_MORPH);
    mc.colorize(COLOR_RULES);

    // Five bare lines. The demonstration itself is the living-path cut.
    yield* waitFor(1.4);

    // ══ 3. LIVING PATH — the arm proves the bare code still works ═════
    yield* mc.node.opacity(0, 0.8, easeInOutCubic);
    yield* livingPathSegment(view, subs);

    // ══ 4. REPLAY, PARTS C/D/E ════════════════════════════════════════
    yield* mc.node.opacity(1, 0.8, easeInOutCubic);

    // ── C: the requirement returns — the guard is typed in above ──────
    yield* subs.swap('Then a real change arrives: some cubes need a gentler grip, more careful movement, and a controlled release.');
    yield* waitFor(0.4);

    mc.colorize(GREEN_RULES);
    yield* dir.apply(m => {
      m.addLine('handleCube', 'arm.moveTo(cube.position);',
        '',
        'if (cube.hasSensitiveComponents()) {',
        '    arm.grab(cube, GripForce.GENTLE);',
        '    arm.confirmGrip();',
        '    arm.moveTo(table.position, MotionProfile.CAUTIOUS);',
        '    arm.release(ReleaseStyle.ALIGNED);',
        '    return;',
        '}',
        '');
    }, TYPE_MORPH);
    mc.colorize(GREEN_RULES);

    yield* subs.swap('Don’t design another abstraction yet. Add the case directly, even if that means an if and two similar branches.');
    yield* waitFor(2.8);

    yield* mc.colorizeAnimated(0, mc.lineCount - 1, 0.9, COLOR_RULES);
    yield* subs.swap('The duplication lets us see the change before we model it.');
    yield* waitFor(2.6);

    // ── D: evidence — the three differences rise to gold and stay ─────
    const accentRefsOnLine = (lineIdx: number) =>
      mc.getLine(lineIdx)!.tokens
        .filter(t => ACCENT_TOKENS.has(t.text))
        .map(t => t.ref());

    const goldLines = [
      mc.findLine('arm.grab(cube, GripForce.GENTLE)'),
      mc.findLine('arm.moveTo(table.position, MotionProfile.CAUTIOUS)'),
      mc.findLine('arm.release(ReleaseStyle.ALIGNED)'),
    ];

    yield* subs.swap('Now compare the paths. The sequence is the same.');

    for (const lineIdx of goldLines) {
      const refs = accentRefsOnLine(lineIdx);
      for (const r of refs) r.shadowColor(HALATION_COLOR);
      yield* all(...refs.flatMap(r => [
        r.fill(ACCENT, 0.7, easeInOutCubic),
        r.shadowBlur(HALATION_BLUR, 0.7, easeInOutCubic),
      ]));
      yield* waitFor(0.45);
    }

    yield* subs.swap('Only three values change — together, and for the same reason.');
    yield* waitFor(2.4);

    // ── E: the fold ───────────────────────────────────────────────────
    mc.colorize(FOLD_GREEN_RULES);
    yield* subs.swap('That is enough evidence to group them into a HandlingProfile.', E_SUB_Y);
    yield* dir.apply(m => {
      m.addLine('handleCube', 'arm.moveTo(cube.position);',
        '',
        'HandlingProfile handling = HandlingProfile.forCube(cube, table);');
    }, TYPE_MORPH);
    mc.colorize(FOLD_GREEN_RULES);
    yield* waitFor(0.7);

    yield* all(
      dir.apply(m => {
        m.setBody('handleCube', [
          'arm.moveTo(cube.position);',
          '',
          'HandlingProfile handling = HandlingProfile.forCube(cube, table);',
          '',
          'arm.grab(cube, handling.gripForce);',
          'arm.confirmGrip();',
          'arm.moveTo(table.position, handling.motionProfile);',
          'arm.release(handling.releaseStyle);',
        ]);
      }, {...TYPE_MORPH, removeDuration: 0.25}),
      mc.node.y(MAIN_Y_FINAL, 0.9, easeInOutCubic),
    );
    mc.colorize(FOLD_GREEN_RULES);
    yield* waitFor(0.4);

    // The if did not disappear. It moved — same predicate, new owner.
    const panel = Manticore.create(PANEL_CODE, {
      x: 0, y: PANEL_Y,
      width: PANEL_W,
      height: PANEL_H,
      fontSize: CODE_FONT_SIZE,
      lineHeight: LINE_HEIGHT,
      clipPaddingY: CLIP_PAD_Y,
      fontFamily: Fonts.code,
      theme: DryFiltersV3CodeTheme,
      cardStyle: CODE_CARD_STYLE,
      glowAccent: false,
      noClip: true,
      customTypes: CUSTOM_TYPES,
    });
    panel.mount(view);
    panel.colorize(PANEL_ACCENT_RULES);
    panel.node.opacity(0);

    const goldRefs = [] as any[];
    for (let i = 0; i < panel.lineCount; i++) {
      const line = panel.getLine(i);
      if (!line) continue;
      for (const t of line.tokens) {
        if (ACCENT_TOKENS.has(t.text)) goldRefs.push(t.ref());
      }
    }
    for (const r of goldRefs) {
      r.shadowColor(HALATION_COLOR);
      r.shadowBlur(HALATION_BLUR);
    }

    yield* panel.node.opacity(1, 0.9, easeInOutCubic);
    yield* subs.swap('The workflow stays untouched.', E_SUB_Y);
    yield* waitFor(1.4);
    yield* subs.swap('The if simply moves to where the profile is selected.', E_SUB_Y);
    yield* waitFor(1.8);

    // Everything settles: green becomes code, gold becomes vocabulary.
    yield* all(
      mc.colorizeAnimated(0, mc.lineCount - 1, 1.1, COLOR_RULES),
      panel.colorizeAnimated(0, panel.lineCount - 1, 1.1, COLOR_RULES),
      ...goldRefs.map(r => r.shadowBlur(0, 1.1, easeInOutCubic)),
    );
    yield* subs.off();
    yield* waitFor(1.6);

    yield* all(
      mc.node.opacity(0, Timing.slow, easeInOutCubic),
      panel.node.opacity(0, Timing.slow, easeInOutCubic),
    );
    yield* waitFor(0.3);
    mc.node.remove();
    panel.node.remove();

    // ══ 5. BOUNDARY TAKE — silent, purely visual ══════════════════════
    yield* boundaryTakeSegment(view);

    // ══ 6. FINAL RUN — the sensitive cube meets the ready door ════════
    yield* finalRunSegment(view, subs);
  });
}
