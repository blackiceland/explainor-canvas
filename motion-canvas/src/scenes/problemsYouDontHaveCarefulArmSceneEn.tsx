import {blur, makeScene2D, Node} from '@motion-canvas/2d';
import {all, chain, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {
  Bone,
  BoxGeometry,
  Color,
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
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';

// ── Beat 3b — arm demonstrates requirements, then code impact + cost ────

// ── Interface shown inline above the orchestrator — the contract ────────
const INTERFACE_CODE = `public interface GrabStrategy {
    GrabResult grab(Cube cube);
}`;

// ── Record shown inline below the orchestrator — the data the arm needs ──
// Fields match what the arm visibly demonstrates:
//   confidence    ↔ the green stabilization flash after the gentle grip
//   motionProfile ↔ the Bezier arc with eased ends (not a discrete lift)
//   orientation   ↔ the beam indicator + locked rotation during transport
const RECORD_CODE = `public record GrabResult(
    GripConfidence confidence,
    MotionProfile motionProfile,
    Orientation orientation
) {}`;

// ── Left-panel orchestrator code (wrapped in class so handleCube has a home)
const ORC_CODE = `public class CubeHandler {

    private final GrabStrategy grabStrategy = new StandardGrab();

    public void handleCube(Cube cube, Table table) {
        arm.moveTo(cube.position);
        grabStrategy.grab(cube);
        arm.confirmGrip();
        arm.moveTo(table.position);
        arm.release();
    }
}`;

// Line indices (0-based) for dimming inside the class-wrapped orchestrator
const LINE_GRAB       = 6;  // grabStrategy.grab(cube);
const LINE_CONFIRM    = 7;  // arm.confirmGrip();
const LINE_MOVE_TABLE = 8;  // arm.moveTo(table.position);
const LINE_RELEASE    = 9;  // arm.release();

// ── Morph stages for the orchestrator ───────────────────────────────────
// Step 1: bare parameter names appear in highlighted lines
const ORC_STEP1 = `public class CubeHandler {

    private final GrabStrategy grabStrategy = new StandardGrab();

    public void handleCube(Cube cube, Table table) {
        arm.moveTo(cube.position);
        grabStrategy.grab(cube);
        arm.confirmGrip(confidence);
        arm.moveTo(table.position, motionProfile);
        arm.release(orientation);
    }
}`;

// Step 2: GrabResult result = appears before grab
const ORC_STEP2 = `public class CubeHandler {

    private final GrabStrategy grabStrategy = new StandardGrab();

    public void handleCube(Cube cube, Table table) {
        arm.moveTo(cube.position);
        GrabResult result = grabStrategy.grab(cube);
        arm.confirmGrip(confidence);
        arm.moveTo(table.position, motionProfile);
        arm.release(orientation);
    }
}`;

// Step 3: bare args become result.xxx — `result.` types in GREEN, then fades
const ORC_DONE = `public class CubeHandler {

    private final GrabStrategy grabStrategy = new StandardGrab();

    public void handleCube(Cube cube, Table table) {
        arm.moveTo(cube.position);
        GrabResult result = grabStrategy.grab(cube);
        arm.confirmGrip(result.confidence);
        arm.moveTo(table.position, result.motionProfile);
        arm.release(result.orientation);
    }
}`;

// Line index of the `result` declaration (unchanged by STEP3 morph, so we can
// revert it back to normal color after setting GREEN rules globally).
const LINE_RESULT_DECLARATION = 6;

// ── Strategy implementations (empty line after class, before return) ────
const SOFT_INIT = `public class SoftGrab implements GrabStrategy {

    public void grab(Cube cube) {
        approachSlowly(cube.position);
        close(Force.LIGHT);
        waitForSensor();
        adjustToFeedback();
    }
}`;
const SOFT_DONE = `public class SoftGrab implements GrabStrategy {

    public GrabResult grab(Cube cube) {
        approachSlowly(cube.position);
        close(Force.LIGHT);
        waitForSensor();
        adjustToFeedback();

        return new GrabResult(
            GripConfidence.HIGH,
            MotionProfile.CAUTIOUS,
            cube.orientation()
        );
    }
}`;

const FIRM_INIT = `public class FirmGrab implements GrabStrategy {

    public void grab(Cube cube) {
        preAlign(cube);
        close(Force.MAXIMUM);
        lockWrist();
    }
}`;
const FIRM_DONE = `public class FirmGrab implements GrabStrategy {

    public GrabResult grab(Cube cube) {
        preAlign(cube);
        close(Force.MAXIMUM);
        lockWrist();

        return new GrabResult(
            GripConfidence.HIGH,
            MotionProfile.FAST,
            Orientation.LOCKED
        );
    }
}`;

const STANDARD_INIT = `public class StandardGrab implements GrabStrategy {

    public void grab(Cube cube) {
        approach(cube.position);
        close(Force.MEDIUM);
    }
}`;
const STANDARD_DONE = `public class StandardGrab implements GrabStrategy {

    public GrabResult grab(Cube cube) {
        approach(cube.position);
        close(Force.MEDIUM);

        return new GrabResult(
            GripConfidence.MEDIUM,
            MotionProfile.LINEAR,
            Orientation.ANY
        );
    }
}`;

// ── Constructor arg line indices (0-based in the *_DONE states) ─────────
// Arg 1 = GripConfidence, Arg 2 = MotionProfile, Arg 3 = Orientation/etc.
const SOFT_ARGS = [9, 10, 11];
const FIRM_ARGS = [8, 9, 10];
const STD_ARGS  = [7, 8, 9];

// ── Styling ─────────────────────────────────────────────────────────────
// LEFT_PAD tighter than before — column reads closer to the frame edge.
const LEFT_PAD = 40;
const CODE_FONT_SIZE = 24;
const CODE_W = Screen.width / 2 - LEFT_PAD;
const CODE_CENTER_X = -Screen.width / 2 + LEFT_PAD + CODE_W / 2;

// ── Left column: interface (top) + orchestrator (below). The record is NOT
// stacked here — it appears to the RIGHT of the orchestrator (RECORD_RIGHT_X,
// same level) once the arm blurs, then the whole top group scrolls up.
// fontSize=24 → lineHeight=38.9. interface 3 lines (half-span 58), handleCube
// 12 lines (half-span 233). Interface top ≈ -440 (100px from -540); handleCube
// centered at -61 with a ~30px gap below the interface.
const INTERFACE_Y = -382;
const CODE_Y      = -61;

// Strategies appear in a horizontal ROW at the bottom — three columns side by
// side, no vertical stack and no scroll. ROW_W is snug (widest line + padding)
// so text centres on each column x. Each grows DOWNWARD in place when it expands.
const ROW_FONT = 20;
const ROW_LINE_H = Math.round(ROW_FONT * 1.62 * 10) / 10;
const ROW_W = 660;
const ROW_COLS = {soft: -610, firm: 0, standard: 610};
// Every strategy's line-0 top lands on ROW_TOP_Y so the row reads level despite
// different init line counts (auto-centered Manticore → per-block y offset).
const ROW_TOP_Y = 40;
const rowY = (initCode: string) =>
  ROW_TOP_Y + ((initCode.split('\n').length - 1) / 2) * ROW_LINE_H;

// The top group (orchestrator + interface + arm) scrolls up first; the interface
// fades out as it leaves the top. The record appears LATER (after the strategies),
// directly at its final spot — top-aligned with the SCROLLED orchestrator's class
// declaration, a touch to the right — so it never needs to scroll itself.
const CODE_LINE_H = Math.round(CODE_FONT_SIZE * 1.62 * 10) / 10;
const RECORD_RIGHT_X = 560;
const SCROLL_UP = 200;
const RECORD_Y = (CODE_Y - SCROLL_UP) - (
  (ORC_CODE.split('\n').length - 1) / 2
  - (RECORD_CODE.split('\n').length - 1) / 2
) * CODE_LINE_H;

const VAR_LIGHT = 'rgba(244, 241, 235, 0.96)';
const TYPE_CLEAN = 'rgba(220, 215, 255, 0.80)';
const METHOD_COLOR = DryFiltersV3CodeTheme.method;
const KW_COLOR = DryFiltersV3CodeTheme.keyword;
// Ephemeral "fresh reference" highlight — used while `result.` prefix tokens
// type into method arguments during STEP 3 of the orchestrator morph.
const CREATE_GREEN = 'rgba(150, 230, 165, 0.96)';
// ONE accent for both halves of the same event — the bare args
// (confidence/motionProfile/orientation) that land in confirmGrip/moveTo/release,
// and the GrabResult type once it spreads. Same colour, same halation: two marks
// in one vocabulary, not two vocabularies. The args hold it until `result.` feeds
// them; the type holds it to the end of the scene.
const ACCENT = 'rgba(255, 214, 140, 1.0)';
// Halation — the bleed film stock gets around anything hot. The red-sensitive
// layer scatters furthest, so the bloom sits WARMER than the token it surrounds.
// This is emulsion, not a UI glow: it only ever rides the accent.
const HALATION_COLOR = 'rgba(255, 104, 36, 0.8)';
const HALATION_BLUR = 16;
const ACCENT_ARG_NAMES = new Set(['confidence', 'motionProfile', 'orientation']);

const SHARED_KW_RULES: ColorRule[] = [
  {match: /^public$/,         color: KW_COLOR},
  {match: /^private$/,        color: KW_COLOR},
  {match: /^final$/,          color: KW_COLOR},
  {match: /^void$/,           color: KW_COLOR},
  {match: /^return$/,         color: KW_COLOR},
  {match: /^new$/,            color: KW_COLOR},
  {match: /^class$/,          color: KW_COLOR},
  {match: /^implements$/,     color: KW_COLOR},
];

const SHARED_VAR_RULES: ColorRule[] = [
  {match: 'cube',             color: VAR_LIGHT},
  {match: 'position',         color: VAR_LIGHT},
];

const SHARED_TYPE_RULES: ColorRule[] = [
  {match: /^Cube$/,            color: TYPE_CLEAN},
  {match: /^Table$/,           color: TYPE_CLEAN},
  {match: /^Force$/,           color: TYPE_CLEAN},
  {match: /^GrabStrategy$/,    color: TYPE_CLEAN},
  {match: /^GrabResult$/,      color: TYPE_CLEAN},
  {match: /^CubeHandler$/,     color: TYPE_CLEAN},
  {match: /^StandardGrab$/,    color: TYPE_CLEAN},
  {match: /^SoftGrab$/,        color: TYPE_CLEAN},
  {match: /^FirmGrab$/,        color: TYPE_CLEAN},
  {match: /^GripConfidence$/,  color: TYPE_CLEAN},
  {match: /^MotionProfile$/,   color: TYPE_CLEAN},
  {match: /^Orientation$/,     color: TYPE_CLEAN},
];

// Orchestrator — grab IS a call here
const ORC_COLOR_RULES: ColorRule[] = [
  ...SHARED_KW_RULES,
  {match: 'handleCube',       color: VAR_LIGHT},
  {match: 'arm',              color: VAR_LIGHT},
  {match: 'table',            color: VAR_LIGHT},
  {match: 'grabStrategy',     color: VAR_LIGHT},
  {match: 'result',           color: VAR_LIGHT},
  {match: 'confidence',       color: VAR_LIGHT},
  {match: 'motionProfile',    color: VAR_LIGHT},
  {match: 'orientation',      color: VAR_LIGHT},
  ...SHARED_VAR_RULES,
  ...SHARED_TYPE_RULES,
  {match: 'moveTo',           color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'grab',             color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'confirmGrip',      color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'release',          color: METHOD_COLOR, onlyTypes: ['method']},
];

// Interface prelude — `interface` + `public` only, grab is a definition stub
const INTERFACE_COLOR_RULES: ColorRule[] = [
  {match: /^public$/,         color: KW_COLOR},
  {match: /^interface$/,      color: KW_COLOR},
  ...SHARED_VAR_RULES,
  ...SHARED_TYPE_RULES,
  {match: 'grab',             color: VAR_LIGHT, onlyTypes: ['method', 'plain']},
];

// Record block — `record` is Java 14+; tokenizer doesn't classify it as keyword
const RECORD_COLOR_RULES: ColorRule[] = [
  {match: /^public$/,         color: KW_COLOR},
  {match: /^record$/,         color: KW_COLOR},
  ...SHARED_TYPE_RULES,
  {match: 'confidence',       color: VAR_LIGHT},
  {match: 'motionProfile',    color: VAR_LIGHT},
  {match: 'orientation',      color: VAR_LIGHT},
];

// New-arg accent overrides — the three bare args take the accent when they type in.
// NB: Manticore applies rules in order and LAST match wins, so overrides MUST
// come after ORC_COLOR_RULES.
const ACCENT_ARG_RULES: ColorRule[] = [
  {match: /^confidence$/,    color: ACCENT},
  {match: /^motionProfile$/, color: ACCENT},
  {match: /^orientation$/,   color: ACCENT},
];
// STEP 1/2: args accented, everything else normal.
const ORC_ACCENT_RULES: ColorRule[] = [
  ...ORC_COLOR_RULES,
  ...ACCENT_ARG_RULES,
];
// STEP 3: args STAY accented while the `result.` prefix types in GREEN. The final
// colorizeAnimated(..., ORC_COLOR_RULES) then clears BOTH (accented args → normal,
// green result → normal) — that's the "result. feeds the arg" moment.
const ORC_GREEN_ACCENT_RULES: ColorRule[] = [
  ...ORC_COLOR_RULES,
  ...ACCENT_ARG_RULES,
  {match: /^result$/,        color: CREATE_GREEN},
];

// Strategies — grab is a DEFINITION, not red
const STRAT_COLOR_RULES: ColorRule[] = [
  ...SHARED_KW_RULES,
  ...SHARED_VAR_RULES,
  ...SHARED_TYPE_RULES,
  {match: 'approach',         color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'approachSlowly',   color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'waitForSensor',    color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'adjustToFeedback', color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'close',            color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'preAlign',         color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'lockWrist',        color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'orientation',      color: METHOD_COLOR, onlyTypes: ['method']},
];

const CUSTOM_TYPES = [
  'Cube', 'Table', 'Force',
  'GrabStrategy', 'GrabResult',
  'CubeHandler',
  'StandardGrab', 'SoftGrab', 'FirmGrab',
  'GripConfidence', 'MotionProfile', 'Orientation',
];

const CODE_CARD_STYLE = {
  radius: 16, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0, shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
  shadowOffsetX: 0, shadowOffsetY: 0, edge: false,
} as const;

const MORPH_OPTS = {
  scrollStrategy: 'block' as const,
  removeDuration: 0,
  moveDuration: 0.75,
  charDelay: 0.013,
  lineDelay: 0.035,
};

// Smoother variant — for the `result` appearances (STEP 2/3): gentler glide and
// a slower type-in so the object arrives softly.
const SMOOTH_MORPH_OPTS = {
  ...MORPH_OPTS,
  moveDuration: 0.95,
  charDelay: 0.018,
  lineDelay: 0.05,
};

// Strategies use parallel mode to skip ensureRangeVisible (which scrolls
// content up inside the small clip area, even with noClip: true).
const STRAT_MORPH_OPTS = {
  ...MORPH_OPTS,
  blockOrder: 'parallel' as const,
  lineOrder: 'parallel' as const,
};

// De-emphasis is done with BLUR (rack focus), NOT opacity: target stays sharp,
// context de-focuses. cache(true) renders the node to a texture so the blur
// filter can apply; cachePadding keeps the blur from clipping at the bounds.
// A node that's about to MORPH must NOT be blurred/cached (blur+morph conflict).
const CODE_BLUR = 5;
function attachBlur(node: Node, padding = 36) {
  const s = createSignal(0);
  node.cache(true);
  node.cachePadding(padding);
  node.filters(() => [blur(s())]);
  return s;
}

// ── Layout ────────────────────────────────────────────────────────────────
const THREE_W = Screen.width / 2;
const THREE_H = Screen.height;

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

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ═══════════════════════════════════════════════════════════════════════
  // 3D Scene
  // ═══════════════════════════════════════════════════════════════════════
  const scene3 = new Scene();

  const camera = new PerspectiveCamera(50, THREE_W / THREE_H, 1, 10000);
  camera.position.set(900, 550, 1400);
  camera.lookAt(-100, 250, 400);

  const fillMat = new MeshBasicMaterial({color: 0x00a0b8, transparent: true, opacity: 0.12});
  const edgeMat = new LineBasicMaterial({color: 0x00a0b8, transparent: true, opacity: 0.7});

  // Purple cube — signals fragility
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
  cube3d.position.set(cubeStopX, cubeOnBeltY, beltZ);
  cube3d.renderOrder = -1;
  scene3.add(cube3d);

  // ── Light beam (top: fixed height above cube, bottom: dynamic to surface) ─
  const beamHeight = 1500;
  const BEAM_COLOR = 0xffb870;
  const beamCoreMat = new MeshBasicMaterial({color: BEAM_COLOR, transparent: true, opacity: 0, depthWrite: false});
  const beamMidMat  = new MeshBasicMaterial({color: BEAM_COLOR, transparent: true, opacity: 0, depthWrite: false});
  const beamOutMat  = new MeshBasicMaterial({color: BEAM_COLOR, transparent: true, opacity: 0, depthWrite: false});
  const beamObj = new Group();
  beamObj.add(new Mesh(new CylinderGeometry(2, 2, beamHeight, 8), beamCoreMat));
  beamObj.add(new Mesh(new CylinderGeometry(12, 12, beamHeight, 8), beamMidMat));
  beamObj.add(new Mesh(new CylinderGeometry(30, 30, beamHeight, 8), beamOutMat));
  scene3.add(beamObj);

  // Bottom beam — unit-height cylinders, scaled dynamically to surface below
  const botCoreMat = new MeshBasicMaterial({color: BEAM_COLOR, transparent: true, opacity: 0, depthWrite: false});
  const botMidMat  = new MeshBasicMaterial({color: BEAM_COLOR, transparent: true, opacity: 0, depthWrite: false});
  const botOutMat  = new MeshBasicMaterial({color: BEAM_COLOR, transparent: true, opacity: 0, depthWrite: false});
  const botBeamObj = new Group();
  botBeamObj.add(new Mesh(new CylinderGeometry(2, 2, 1, 8), botCoreMat));
  botBeamObj.add(new Mesh(new CylinderGeometry(12, 12, 1, 8), botMidMat));
  botBeamObj.add(new Mesh(new CylinderGeometry(30, 30, 1, 8), botOutMat));
  scene3.add(botBeamObj);
  const surfaceY = beltY + beltHeight / 2; // belt & platform top are at same Y

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

  // ── Bezier arc (no peak — continuous smooth curve) ─────────────────────
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

  // IK — reach + 4 arc waypoints + place
  const reachDeltas = solveIK(sceneRoot, bones, initRot, cubeStartPos);
  const arcDeltas = [0.2, 0.4, 0.6, 0.8].map(t => solveIK(sceneRoot, bones, initRot, bezier(t)));
  const placeDeltas = solveIK(sceneRoot, bones, initRot, placeTarget);
  const linear = (v: number) => v;

  // ── Signals ───────────────────────────────────────────────────────────
  const baseDelta     = createSignal(0);
  const turretDelta   = createSignal(0);
  const shoulderDelta = createSignal(0);
  const elbowDelta    = createSignal(0);
  const wristDelta    = createSignal(0);
  const gripClose     = createSignal(0);
  const checkGlow     = createSignal(0);
  const beamGlow      = createSignal(0);

  const cubeColorBase  = new Color(0xb388ff);
  const cubeColorCheck = new Color(0x66ff88);
  const cubeColorTmp   = new Color();

  let cubeAttached = false;
  let cubePlaced = false;
  const cubeX = createSignal(cubeStopX);
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

      // Green check glow
      const cg = checkGlow();
      cubeColorTmp.lerpColors(cubeColorBase, cubeColorCheck, cg);
      cubeFillMat.color.copy(cubeColorTmp);
      cubeFillMat.opacity = 0.25 + cg * 0.2;
      cubeEdgeMat.color.copy(cubeColorTmp);

      // Beam opacity + follows cube
      const bg = beamGlow();
      beamCoreMat.opacity = bg * 0.5;
      beamMidMat.opacity = bg * 0.1;
      beamOutMat.opacity = bg * 0.03;
      botCoreMat.opacity = bg * 0.35;
      botMidMat.opacity = bg * 0.07;
      botOutMat.opacity = bg * 0.02;

      // Top beam — above cube
      beamObj.position.set(
        cube3d.position.x,
        cube3d.position.y + cubeSize / 2 + beamHeight / 2,
        cube3d.position.z,
      );

      // Bottom beam — from cube bottom to nearest surface
      const cubeBot = cube3d.position.y - cubeSize / 2;
      const gap = Math.max(1, cubeBot - surfaceY);
      botBeamObj.scale.y = gap;
      botBeamObj.position.set(
        cube3d.position.x,
        cubeBot - gap / 2,
        cube3d.position.z,
      );

      // Cube position — Y rotation tracks arm, X stays 0 (no tilt)
      if (cubeAttached) {
        const wp = new Vector3(), hp = new Vector3();
        bones.wrist!.getWorldPosition(wp);
        bones.hand!.getWorldPosition(hp);
        const tip = hp.clone().add(hp.clone().sub(wp));
        const b = grabBlend();
        cube3d.position.lerpVectors(grabOrigin, tip, b);
        cube3d.rotation.x = 0;
        cube3d.rotation.y = (baseDelta() + turretDelta()) - grabBaseY;
        cube3d.rotation.z = 0;
      } else if (!cubePlaced) {
        cube3d.position.x = cubeX();
      }

      outline.render(s, c);
    },
  });

  threeView.node.x(Screen.width / 4);
  threeView.node.opacity(0);

  // ═══════════════════════════════════════════════════════════════════════
  // LEFT SIDE: Three stacked code blocks — interface prelude, orchestrator,
  // record data type. Same fontSize and CODE_CENTER_X → perfectly aligned
  // columns with ~30px gaps and symmetric top/bottom breathing room.
  // ═══════════════════════════════════════════════════════════════════════
  const fontSize   = CODE_FONT_SIZE;
  const lineHeight = Math.round(fontSize * 1.62 * 10) / 10;

  const codeBlockStyle = {
    width: CODE_W,
    fontSize, lineHeight,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    noClip: true,
    customTypes: CUSTOM_TYPES,
  } as const;

  const mcInterface = Manticore.create(INTERFACE_CODE, {
    x: CODE_CENTER_X, y: INTERFACE_Y,
    ...codeBlockStyle,
  });

  const mc = Manticore.create(ORC_CODE, {
    x: CODE_CENTER_X, y: CODE_Y,
    ...codeBlockStyle,
  });

  const mcRecord = Manticore.create(RECORD_CODE, {
    x: RECORD_RIGHT_X, y: RECORD_Y,   // right of orchestrator, top-aligned to its class decl
    ...codeBlockStyle,
  });

  // Blur only the 3D arm, not the code
  const armBlur = createSignal(0);
  threeView.node.cache(true);
  threeView.node.cachePadding(120);
  threeView.node.filters(() => [blur(armBlur())]);

  view.add(threeView.node);
  mcInterface.mount(view);
  mc.mount(view);
  mcRecord.mount(view);
  mcInterface.colorize(INTERFACE_COLOR_RULES);
  mc.colorize(ORC_COLOR_RULES);
  mcRecord.colorize(RECORD_COLOR_RULES);

  // Record starts hidden — it reveals AFTER the orchestrator morphs complete,
  // once the interface contract has been established by the code flow.
  mcRecord.node.opacity(0);

  // ═══════════════════════════════════════════════════════════════════════
  // ANIMATION
  // ═══════════════════════════════════════════════════════════════════════

  // Fade in — interface + orchestrator code + 3D arm together.
  // (Record stays hidden at opacity 0 until after the morphs.)
  yield* all(
    mcInterface.appear(0.8),
    mc.appear(0.8),
    threeView.node.opacity(1, 0.8, easeInOutCubic),
  );
  yield* waitFor(0.4);

  // ── Reach (slow, deliberate) ──────────────────────────────────────────
  yield* all(
    baseDelta(reachDeltas.base, 1.5, easeInOutCubic),
    turretDelta(reachDeltas.turret, 1.5, easeInOutCubic),
    shoulderDelta(reachDeltas.shoulder, 1.5, easeInOutCubic),
    elbowDelta(reachDeltas.elbow, 1.5, easeInOutCubic),
    wristDelta(reachDeltas.wrist, 1.5, easeInOutCubic),
  );
  yield* waitFor(0.2);

  // ── Grip (gentle) ─────────────────────────────────────────────────────
  yield* gripClose(0.5, 0.5, easeInOutCubic);
  grabOrigin.copy(cube3d.position);
  grabBaseY = baseDelta() + turretDelta();
  cubeAttached = true;
  yield* grabBlend(1, 0.15, easeInOutCubic);

  // ── Stabilization check — green flash ─────────────────────────────────
  yield* checkGlow(1, 0.3, easeInOutCubic);
  yield* waitFor(0.5);
  yield* checkGlow(0, 0.4, easeInOutCubic);
  yield* waitFor(0.2);

  // ── Beam appears — orientation indicator active ───────────────────────
  yield* beamGlow(0.7, 0.5, easeInOutCubic);

  // ── Smooth arc (no peak — 4 waypoints, linear middle, eased ends) ────
  yield* all(
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

  // ── Release ───────────────────────────────────────────────────────────
  cubeAttached = false;
  cubePlaced = true;
  cube3d.position.copy(placeTarget);
  cube3d.rotation.x = 0;
  yield* gripClose(0, 0.4, easeInOutCubic);

  // Beam disappears + arm returns to rest + focus lands on the four lines about
  // to morph (grab/confirm/moveTo/release). Focus is by BLUR, not opacity: those
  // four stay sharp (and un-cached, so they morph cleanly); the interface block
  // and the non-target orchestrator lines de-focus.
  const ifBlur = attachBlur(mcInterface.node, 48);
  const ORC_CONTEXT_LINES = [0, 2, 4, 5, 10, 11]; // all lines except grab/confirm/moveTo/release
  const orcCtxBlur = ORC_CONTEXT_LINES.map(i => attachBlur(mc.getLine(i)!.node));
  yield* all(
    beamGlow(0, 0.6, easeInOutCubic),
    baseDelta(0, 2.0, easeInOutCubic),
    turretDelta(0, 2.0, easeInOutCubic),
    shoulderDelta(0, 2.0, easeInOutCubic),
    elbowDelta(0, 2.0, easeInOutCubic),
    wristDelta(0, 2.0, easeInOutCubic),
    ifBlur(CODE_BLUR, 0.6, easeInOutCubic),
    ...orcCtxBlur.map(s => s(CODE_BLUR, 0.6, easeInOutCubic)),
  );
  yield* waitFor(0.8);

  // Halation on the accented args. Re-derived every time because a morph may rebuild
  // the token nodes; re-asserting the same blur is a no-op when they survived, and
  // blooms it back when they didn't — so it never pops across a morph seam.
  const accentArgRefs = () => [LINE_CONFIRM, LINE_MOVE_TABLE, LINE_RELEASE]
    .flatMap(i => mc.getLine(i)!.tokens
      .filter(t => ACCENT_ARG_NAMES.has(t.text))
      .map(t => t.ref()));
  function* bloomHalation(duration: number) {
    const refs = accentArgRefs();
    for (const r of refs) r.shadowColor(HALATION_COLOR);
    yield* all(...refs.map(r => r.shadowBlur(HALATION_BLUR, duration, easeInOutCubic)));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MORPH STEP 1 — bare args appear in highlighted lines
  // ═══════════════════════════════════════════════════════════════════════
  // Bare args (confidence/motionProfile/orientation) type in the ACCENT — new data
  // the downstream steps now demand — and the halation blooms in behind them.
  mc.colorize(ORC_ACCENT_RULES);
  yield* mc.morphTo(ORC_STEP1, MORPH_OPTS);
  mc.colorize(ORC_ACCENT_RULES);
  yield* bloomHalation(0.5);
  yield* waitFor(0.4);

  // ═══════════════════════════════════════════════════════════════════════
  // MORPH STEP 2 — GrabResult result = appears before grab
  // ═══════════════════════════════════════════════════════════════════════
  yield* mc.morphTo(ORC_STEP2, SMOOTH_MORPH_OPTS);
  mc.colorize(ORC_ACCENT_RULES);   // args stay accented; GrabResult/result normal
  yield* bloomHalation(0.3);
  yield* waitFor(0.5);

  // ═══════════════════════════════════════════════════════════════════════
  // MORPH STEP 3 — bare args become result.xxx
  // The new `result.` prefix tokens type in GREEN to visually bridge "the
  // object we just declared on line 6" → "is now flowing into these args".
  // Immediately after the morph, fade the four lines back to normal theme.
  // ═══════════════════════════════════════════════════════════════════════
  // Set GREEN rules so applyRules() during the 'modify' morph plan paints
  // the newly-typed `result` tokens green. Then revert line 6's own `result`
  // declaration back to normal color so only the ARGUMENT references flash.
  // args stay ACCENTED while `result.` types GREEN in front of them.
  mc.colorize(ORC_GREEN_ACCENT_RULES);
  mc.getLine(LINE_RESULT_DECLARATION)!.colorizeByRule('result', VAR_LIGHT);

  yield* mc.morphTo(ORC_DONE, SMOOTH_MORPH_OPTS);
  yield* bloomHalation(0.3);
  yield* waitFor(0.3);

  // `result.` now feeds each arg → clear BOTH highlights together (accented args
  // → normal, green result → normal) and let the halation cool with them.
  // Slower fade for a gentler hand-off.
  const halatedRefs = accentArgRefs();
  yield* all(
    mc.colorizeAnimated(LINE_CONFIRM, LINE_RELEASE, 0.9, ORC_COLOR_RULES),
    ...halatedRefs.map(r => r.shadowBlur(0, 0.9, easeInOutCubic)),
  );
  mc.colorize(ORC_COLOR_RULES);
  yield* waitFor(0.4);

  // ═══════════════════════════════════════════════════════════════════════
  // UN-BLUR — bring the whole orchestrator + interface back into focus.
  // ═══════════════════════════════════════════════════════════════════════
  yield* all(
    ifBlur(0, 0.7, easeInOutCubic),
    ...orcCtxBlur.map(s => s(0, 0.7, easeInOutCubic)),
  );
  // Drop the per-line/block caches now that everything is sharp again.
  mcInterface.node.cache(false);
  for (const i of ORC_CONTEXT_LINES) mc.getLine(i)!.node.cache(false);
  yield* waitFor(0.5);

  // ═══════════════════════════════════════════════════════════════════════
  // BLUR ARM — defocus only the 3D robot, code stays sharp. Soft blur (3)
  // so viewer still senses the arm is there without it stealing focus.
  // ═══════════════════════════════════════════════════════════════════════
  yield* all(
    armBlur(3, 0.8, easeInOutCubic),
    threeView.node.opacity(0.18, 0.8, easeInOutCubic),
  );
  yield* waitFor(0.3);

  // ═══════════════════════════════════════════════════════════════════════
  // SCROLL UP — orchestrator rises to crown the frame; the interface block fades
  // as it leaves the top edge; the blurred arm rises. Clears the bottom for the
  // strategies. (The record isn't here yet — it arrives after the strategies.)
  // ═══════════════════════════════════════════════════════════════════════
  yield* all(
    mcInterface.node.y(INTERFACE_Y - SCROLL_UP, 0.9, easeInOutCubic),
    mcInterface.node.opacity(0, 0.9, easeInOutCubic),   // fade out as it leaves — no peeking brace
    mc.node.y(CODE_Y - SCROLL_UP, 0.9, easeInOutCubic),
    threeView.node.y(-SCROLL_UP, 0.9, easeInOutCubic),
  );
  yield* waitFor(0.4);

  // ═══════════════════════════════════════════════════════════════════════
  // STRATEGIES — three columns in a ROW along the bottom. No vertical stack and
  // no scroll: each expands DOWNWARD in place when it grows the return block.
  // ═══════════════════════════════════════════════════════════════════════
  const stratGroup = new Node({});
  view.add(stratGroup);

  const rowStyle = {
    width: ROW_W,
    fontSize: ROW_FONT,
    lineHeight: ROW_LINE_H,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    customTypes: CUSTOM_TYPES,
    glowAccent: false,
    noClip: true,
  } as const;

  const mcSoft = Manticore.create(SOFT_INIT, {x: ROW_COLS.soft, y: rowY(SOFT_INIT), ...rowStyle});
  mcSoft.mount(stratGroup);
  mcSoft.colorize(STRAT_COLOR_RULES);

  const mcFirm = Manticore.create(FIRM_INIT, {x: ROW_COLS.firm, y: rowY(FIRM_INIT), ...rowStyle});
  mcFirm.mount(stratGroup);
  mcFirm.colorize(STRAT_COLOR_RULES);

  const mcStd = Manticore.create(STANDARD_INIT, {x: ROW_COLS.standard, y: rowY(STANDARD_INIT), ...rowStyle});
  mcStd.mount(stratGroup);
  mcStd.colorize(STRAT_COLOR_RULES);

  // ── Strategies cascade in ─────────────────────────────────────────────
  yield* all(
    chain(waitFor(0.15), mcSoft.appear(0.7)),
    chain(waitFor(0.35), mcFirm.appear(0.7)),
    chain(waitFor(0.55), mcStd.appear(0.7)),
  );
  yield* waitFor(0.9);

  // ── Each expands in place, in turn — grab now returns a GrabResult ────
  yield* mcSoft.morphTo(SOFT_DONE, STRAT_MORPH_OPTS);
  mcSoft.colorize(STRAT_COLOR_RULES);
  yield* waitFor(0.5);

  yield* mcFirm.morphTo(FIRM_DONE, STRAT_MORPH_OPTS);
  mcFirm.colorize(STRAT_COLOR_RULES);
  yield* waitFor(0.5);

  yield* mcStd.morphTo(STANDARD_DONE, STRAT_MORPH_OPTS);
  mcStd.colorize(STRAT_COLOR_RULES);
  yield* waitFor(0.6);

  // ═══════════════════════════════════════════════════════════════════════
  // RECORD REVEAL — GrabResult appears at the top (aligned with the orchestrator's
  // class declaration), then EVERY GrabResult in the frame takes the accent colour
  // together, in one slow lift that holds: the record that declares it, handleCube
  // that consumes it, and the three constructions the strategies now owe.
  // Same ACCENT and same halation the args wore — one vocabulary, so the type
  // reads as the continuation of that event, not a second kind of mark. No pulse.
  // Token refs are targeted directly because colorizeByRuleAnimated/setTokensGlow
  // silently no-op on these tokens.
  // ═══════════════════════════════════════════════════════════════════════
  yield* mcRecord.appear(0.7);
  yield* waitFor(0.2);

  const returnLine = (m: Manticore) => m.getLine(m.findLine('return new GrabResult'))!;
  const typeRefs = [
    mcRecord.getLine(0)!,      // public record GrabResult(
    mc.getLine(LINE_GRAB)!,    // GrabResult result = grabStrategy.grab(cube);
    returnLine(mcSoft),
    returnLine(mcFirm),
    returnLine(mcStd),
  ].flatMap(line => line.tokens.filter(t => t.text === 'GrabResult').map(t => t.ref()));
  for (const r of typeRefs) r.shadowColor(HALATION_COLOR);
  yield* all(...typeRefs.flatMap(r => [
    r.fill(ACCENT, 0.8, easeInOutCubic),
    r.shadowBlur(HALATION_BLUR, 0.8, easeInOutCubic),
  ]));

  // Hold the full damage
  yield* waitFor(2.0);

  // ═══════════════════════════════════════════════════════════════════════
  // ARG SWEEP — dim everything, then walk the three GrabResult constructor
  // args across all three strategies in sync. Orientation lands last:
  // cube.orientation() / LOCKED / ANY — three different answers to the same
  // contract slot. The arm leaves here; from now on it's code only.
  // ═══════════════════════════════════════════════════════════════════════
  // De-focus everything via BLUR (not opacity): block-blur the top context
  // (orchestrator + record), per-line blur the three strategy rows, and fade the
  // arm out entirely (it's done its job).
  const swpBlurOrc = attachBlur(mc.node, 60);
  const swpBlurRec = attachBlur(mcRecord.node, 60);
  const softBlurs = Array.from({length: mcSoft.lineCount}, (_, i) => attachBlur(mcSoft.getLine(i)!.node));
  const firmBlurs = Array.from({length: mcFirm.lineCount}, (_, i) => attachBlur(mcFirm.getLine(i)!.node));
  const stdBlurs  = Array.from({length: mcStd.lineCount},  (_, i) => attachBlur(mcStd.getLine(i)!.node));

  yield* all(
    swpBlurOrc(CODE_BLUR, 0.5, easeInOutCubic),
    swpBlurRec(CODE_BLUR, 0.5, easeInOutCubic),
    ...softBlurs.map(s => s(CODE_BLUR, 0.5, easeInOutCubic)),
    ...firmBlurs.map(s => s(CODE_BLUR, 0.5, easeInOutCubic)),
    ...stdBlurs.map(s => s(CODE_BLUR, 0.5, easeInOutCubic)),
    threeView.node.opacity(0, 0.5, easeInOutCubic),
  );

  // Pull ONE slot-row into focus across all three strategies; re-blur the prev.
  const focusSlot = (slot: number, prev: number | null) => {
    const a = [
      softBlurs[SOFT_ARGS[slot]](0, 0.5, easeInOutCubic),
      firmBlurs[FIRM_ARGS[slot]](0, 0.5, easeInOutCubic),
      stdBlurs[STD_ARGS[slot]](0, 0.5, easeInOutCubic),
    ];
    if (prev !== null) a.push(
      softBlurs[SOFT_ARGS[prev]](CODE_BLUR, 0.45, easeInOutCubic),
      firmBlurs[FIRM_ARGS[prev]](CODE_BLUR, 0.45, easeInOutCubic),
      stdBlurs[STD_ARGS[prev]](CODE_BLUR, 0.45, easeInOutCubic),
    );
    return a;
  };

  // Arg 1: GripConfidence
  yield* all(...focusSlot(0, null));
  yield* waitFor(0.8);
  // Arg 2: MotionProfile
  yield* all(...focusSlot(1, 0));
  yield* waitFor(0.8);
  // Arg 3: Orientation — cube.orientation() / LOCKED / ANY, three answers, one slot.
  yield* all(...focusSlot(2, 1));
  yield* waitFor(1.2);

  // ── Everything back into focus ────────────────────────────────────────
  // The sweep is over: lift every blur so the whole system reads sharp one last
  // time — the accent still on each GrabResult — and only THEN take the lights down.
  yield* all(
    swpBlurOrc(0, 0.8, easeInOutCubic),
    swpBlurRec(0, 0.8, easeInOutCubic),
    ...softBlurs.map(s => s(0, 0.8, easeInOutCubic)),
    ...firmBlurs.map(s => s(0, 0.8, easeInOutCubic)),
    ...stdBlurs.map(s => s(0, 0.8, easeInOutCubic)),
  );
  // Drop the caches now that nothing is filtered — the fade composites clean.
  mc.node.cache(false);
  mcRecord.node.cache(false);
  for (const m of [mcSoft, mcFirm, mcStd]) {
    for (let i = 0; i < m.lineCount; i++) m.getLine(i)!.node.cache(false);
  }
  yield* waitFor(1.2);

  // ── Fade out ──────────────────────────────────────────────────────────
  yield* all(
    mcInterface.node.opacity(0, 0.6, easeInOutCubic),
    mc.node.opacity(0, 0.6, easeInOutCubic),
    mcRecord.node.opacity(0, 0.6, easeInOutCubic),
    mcSoft.node.opacity(0, 0.6, easeInOutCubic),
    mcFirm.node.opacity(0, 0.6, easeInOutCubic),
    mcStd.node.opacity(0, 0.6, easeInOutCubic),
  );
});
