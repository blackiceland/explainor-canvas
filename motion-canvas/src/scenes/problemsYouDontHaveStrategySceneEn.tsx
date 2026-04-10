import {makeScene2D, Txt, Rect, Node} from '@motion-canvas/2d';
import {all, createRef, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {
  Bone, BoxGeometry, CylinderGeometry, EdgesGeometry, Group,
  KeyframeTrack, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial,
  Object3D, PerspectiveCamera, Scene, SkinnedMesh, Vector3,
} from 'three';
import {OutlineEffect} from 'three/examples/jsm/effects/OutlineEffect.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createThreeView} from '../core/three/ThreeCanvas';
import {applyBackground} from '../core/utils';
import {Colors, Fonts, Screen} from '../core/theme';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Manticore} from '../core/code/components/Manticore';
import {textWidth} from '../core/utils/textMeasure';
import {getCodePaddingX, getLineHeight, charDelay} from '../core/code/shared/TextMeasure';

// ── Colors ──────────────────────────────────────────────────────────────
const TEXT = Colors.text.primary;
const BAR_COLOR = 'rgba(255,140,163,0.8)';
const VAR_LIGHT = 'rgba(244, 241, 235, 0.96)';
const TYPE_CLEAN = 'rgba(220, 215, 255, 0.80)';
const METHOD_COLOR = DryFiltersV3CodeTheme.method;
const KW_COLOR = DryFiltersV3CodeTheme.keyword;

// ── Layout ──────────────────────────────────────────────────────────────
const LEFT_PAD = 80;
const ARM_SCALE = 0.85;
const ARM_DISPLAY = 0.7;
const THREE_W = Math.ceil(Screen.width / ARM_SCALE);
const THREE_H = Math.ceil(Screen.height / ARM_SCALE);

// ── Text helpers ───────────────────────────────────────────────────────
const F = Fonts.code;
const SZ = 64;
const tw = (t: string) => textWidth(t, F, SZ);

// ── Manticore layout constants ─────────────────────────────────────────
const MC_WIDTH = 2200;
const MC_LEFT_EDGE = -MC_WIDTH / 2 + getCodePaddingX(SZ);
const MC_LINE_H = getLineHeight(SZ);

const INIT_CODE = `private final GrabStrategy grabStrategy = new StandardGrab();

public void handleCube(Cube cube, Table table) {
    arm.moveTo(cube.position);
    grabStrategy.grab(cube);
    arm.lift();
    arm.moveTo(table.position);
    arm.release();
}`;

const SOFT_CODE = INIT_CODE.replace('new StandardGrab()', 'new SoftGrab()');

const MC_LINES = INIT_CODE.split('\n').length;        // 9
const INIT_LINE = 0;                                   // field declaration line
const GRAB_LINE = 4;                                   // grabStrategy.grab(cube);
const GRAB_LINE_Y = -(((MC_LINES - 1) / 2) * MC_LINE_H) + GRAB_LINE * MC_LINE_H;

// grab(cube) centering: starts after "    grabStrategy."
const PREFIX_PX = tw('    grabStrategy.');
const GRAB_W = tw('grab(cube)');
const GRAB_CENTER = MC_LEFT_EDGE + PREFIX_PX + GRAB_W / 2;

// ── Color rules ────────────────────────────────────────────────────────
const COLOR_RULES = [
  {match: /^public$/,       color: KW_COLOR},
  {match: /^void$/,         color: KW_COLOR},
  {match: /^private$/,      color: KW_COLOR},
  {match: /^final$/,        color: KW_COLOR},
  {match: /^new$/,          color: KW_COLOR},
  {match: 'handleCube',     color: VAR_LIGHT},
  {match: 'arm',            color: VAR_LIGHT},
  {match: 'cube',           color: VAR_LIGHT},
  {match: 'position',       color: VAR_LIGHT},
  {match: 'table',          color: VAR_LIGHT},
  {match: 'grabStrategy',   color: VAR_LIGHT},
  {match: /^Cube$/,         color: TYPE_CLEAN},
  {match: /^Table$/,        color: TYPE_CLEAN},
  {match: /^GrabStrategy$/, color: TYPE_CLEAN},
  {match: /^StandardGrab$/, color: TYPE_CLEAN},
  {match: /^SoftGrab$/,     color: TYPE_CLEAN},
  {match: 'moveTo',         color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'lift',           color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'release',        color: METHOD_COLOR, onlyTypes: ['method']},
];

// ── Zoom-out final layout ──────────────────────────────────────────────
const MC_SCALE = 30 / 64;
const MC_FINAL_X = -Screen.width / 2 + LEFT_PAD - MC_LEFT_EDGE * MC_SCALE;
const MC_FINAL_Y = -69;
const GRAB_CTR_X = MC_FINAL_X + GRAB_CENTER * MC_SCALE;
const GRAB_CTR_Y = MC_FINAL_Y + GRAB_LINE_Y * MC_SCALE;
const ZOOM = 1 / MC_SCALE;
const ZOOM_X0 = -GRAB_CTR_X * ZOOM;
const ZOOM_Y0 = -GRAB_CTR_Y * ZOOM;

// ── 3D helpers ──────────────────────────────────────────────────────────
function bp(
  geom: BoxGeometry | CylinderGeometry,
  fill: MeshBasicMaterial,
  edge: LineBasicMaterial,
): Group {
  const g = new Group();
  g.add(new Mesh(geom, fill));
  g.add(new LineSegments(new EdgesGeometry(geom), edge));
  return g;
}

function dotArmMat(isSkinned: boolean, baseOpacity: number): MeshBasicMaterial {
  const mat = new MeshBasicMaterial({color: 0x00e5ff, transparent: true, opacity: baseOpacity});
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvDotUv = uv;')
      .replace('void main() {', 'varying vec2 vDotUv;\nvoid main() {');
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'varying vec2 vDotUv;\nvoid main() {')
      .replace(
        '#include <dithering_fragment>',
        `vec2 cell = mod(vDotUv * 80.0, vec2(1.0));
        float d = length(cell - vec2(0.5));
        float dot = 1.0 - smoothstep(0.1, 0.15, d);
        gl_FragColor.a += dot * 0.07;
        #include <dithering_fragment>`,
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

// ── Bone infrastructure ────────────────────────────────────────────────
const BONE_NAMES: Record<string, string> = {
  base: 'Bone_00', turret: 'Bone001_01', shoulder: 'Bone003_03', elbow: 'Bone005_05',
  wrist: 'Bone007_07', hand: 'Bone008_08',
};
const FINGER_NAMES = {finger1: 'Bone009_09', finger2: 'Bone010_010'};
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
    // Penalize base rotation — prefer turret for lateral movement
    return dist + Math.abs(deltas.base) * 80;
  }
  for (let i = 0; i < 2000; i++) {
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
  // SETUP: 3D hologram
  // ═══════════════════════════════════════════════════════════════════════
  const scene3 = new Scene();
  const camera = new PerspectiveCamera(50, THREE_W / THREE_H, 1, 10000);
  camera.position.set(900, 550, 1400);
  camera.lookAt(-100, 250, 400);

  const fillMat = new MeshBasicMaterial({color: 0x00a0b8, transparent: true, opacity: 0.12});
  const edgeMat = new LineBasicMaterial({color: 0x00a0b8, transparent: true, opacity: 0.7});
  const cubeFillMat = new MeshBasicMaterial({color: 0xff9500, transparent: true, opacity: 0.25});
  const cubeEdgeMat = new LineBasicMaterial({color: 0xff9500, transparent: true, opacity: 1.0});

  const conveyor = new Group();
  const beltLen = 1200, beltW = 160, beltH = 15, beltY = 0, beltZ = 600, legH = 120;
  const beltSurface = bp(new BoxGeometry(beltLen, beltH, beltW), fillMat, edgeMat);
  beltSurface.position.set(0, beltY, beltZ);
  conveyor.add(beltSurface);
  const railH = 30, railT = 8;
  for (const s of [-1, 1]) {
    const rail = bp(new BoxGeometry(beltLen, railH, railT), fillMat, edgeMat);
    rail.position.set(0, beltY + beltH / 2 + railH / 2, beltZ + s * (beltW / 2 + railT / 2));
    conveyor.add(rail);
  }
  for (const xs of [-1, 1]) for (const zs of [-1, 1]) {
    const leg = bp(new CylinderGeometry(10, 10, legH, 8), fillMat, edgeMat);
    leg.position.set(xs * (beltLen / 2 - 40), beltY - beltH / 2 - legH / 2, beltZ + zs * (beltW / 2 - 20));
    conveyor.add(leg);
  }
  for (const xs of [-1, 1]) {
    const roller = bp(new CylinderGeometry(18, 18, beltW - 10, 16), fillMat, edgeMat);
    roller.rotation.x = Math.PI / 2;
    roller.position.set(xs * (beltLen / 2 - 5), beltY, beltZ);
    conveyor.add(roller);
  }
  scene3.add(conveyor);

  const platX = -350, platZ = 300, platW = 260, platD = 180, platH = 15;
  const platform = bp(new BoxGeometry(platW, platH, platD), fillMat, edgeMat);
  platform.position.set(platX, beltY, platZ);
  scene3.add(platform);
  for (const xs of [-1, 1]) for (const zs of [-1, 1]) {
    const pLeg = bp(new CylinderGeometry(10, 10, legH, 8), fillMat, edgeMat);
    pLeg.position.set(platX + xs * (platW / 2 - 30), beltY - platH / 2 - legH / 2, platZ + zs * (platD / 2 - 25));
    scene3.add(pLeg);
  }

  const cubeSize = 60;
  const placedY = beltY + platH / 2 + cubeSize / 2;
  const cube3d = bp(new BoxGeometry(cubeSize, cubeSize, cubeSize), cubeFillMat, cubeEdgeMat);
  cube3d.position.set(platX, placedY, platZ);
  scene3.add(cube3d);

  // Second cube on conveyor (slides in during soft-grab demo)
  const cubeOnBeltY = beltY + beltH / 2 + cubeSize / 2;
  const cube2FillMat = new MeshBasicMaterial({color: 0xff9500, transparent: true, opacity: 0});
  const cube2EdgeMat = new LineBasicMaterial({color: 0xff9500, transparent: true, opacity: 0});
  const cube2 = bp(new BoxGeometry(cubeSize, cubeSize, cubeSize), cube2FillMat, cube2EdgeMat);
  cube2.renderOrder = -1;
  cube2.position.set(beltLen / 2, cubeOnBeltY, beltZ);
  cube2.visible = false;   // hidden until soft-grab phase
  scene3.add(cube2);

  const gltf: any = yield new Promise<any>((resolve, reject) => {
    new GLTFLoader().load('/basic_robot_arm.glb', resolve, undefined, reject);
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
  if (skeletonRoot) for (const [k, n] of Object.entries(BONE_NAMES)) bones[k] = findBone(skeletonRoot, n);
  const fingers: Record<string, Bone | null> = {};
  if (skeletonRoot) for (const [k, n] of Object.entries(FINGER_NAMES)) fingers[k] = findBone(skeletonRoot, n);

  const fingerPos = {
    open:   {f1: new Vector3(), f2: new Vector3()},
    closed: {f1: new Vector3(), f2: new Vector3()},
  };
  if (gltf.animations?.length) {
    const clip = gltf.animations[0];
    function samplePos(boneName: string, t: number): Vector3 | null {
      const track = clip.tracks.find((tr: KeyframeTrack) => tr.name.includes(boneName) && tr.name.endsWith('.position'));
      if (!track) return null;
      const times = track.times, vals = track.values;
      let idx = 0;
      for (let i = 0; i < times.length - 1; i++) { if (times[i + 1] > t) { idx = i; break; } }
      const t0 = times[idx], t1 = times[idx + 1] ?? t0;
      const a = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
      const p0 = new Vector3(vals[idx*3], vals[idx*3+1], vals[idx*3+2]);
      const p1 = new Vector3(vals[(idx+1)*3], vals[(idx+1)*3+1], vals[(idx+1)*3+2]);
      return p0.lerp(p1, a);
    }
    const f1o = samplePos(FINGER_NAMES.finger1, 0), f2o = samplePos(FINGER_NAMES.finger2, 0);
    const f1c = samplePos(FINGER_NAMES.finger1, 1), f2c = samplePos(FINGER_NAMES.finger2, 1);
    if (f1o) fingerPos.open.f1.copy(f1o);   if (f2o) fingerPos.open.f2.copy(f2o);
    if (f1c) fingerPos.closed.f1.copy(f1c); if (f2c) fingerPos.closed.f2.copy(f2c);
  }

  const initRot: Record<string, number> = {};
  for (const [k, bone] of Object.entries(bones)) if (bone) initRot[k] = bone.rotation[JOINT_AXIS[k] as 'x' | 'y'];

  // IK targets
  const cube2Start = new Vector3(0, cubeOnBeltY, beltZ);
  const softLift   = new Vector3(0, 450, 500);
  const stackPos   = new Vector3(platX, placedY + cubeSize, platZ);

  const reachDeltas = solveIK(sceneRoot, bones, initRot, cube2Start);
  const liftDeltas  = solveIK(sceneRoot, bones, initRot, softLift);
  const placeDeltas = solveIK(sceneRoot, bones, initRot, stackPos);

  // ── Signals ──
  const baseDelta     = createSignal(0);
  const turretDelta   = createSignal(0);
  const shoulderDelta = createSignal(0);
  const elbowDelta    = createSignal(0);
  const wristDelta    = createSignal(0);
  const gripClose     = createSignal(0);
  const cube2Opacity  = createSignal(0);
  const cube2X        = createSignal(beltLen / 2);
  // 0 = on belt, 1 = held by hand, 2 = placed on stack
  const cubeMode      = createSignal(0);
  const grabBlend     = createSignal(0);
  const grabOrigin    = new Vector3();
  let grabBaseY = 0;
  let grabTilt = 0;
  let grabTiltReady = false;

  let outline: OutlineEffect | null = null;
  const threeView = createThreeView({
    width: THREE_W, height: THREE_H,
    scene: scene3, camera,
    onRender: (renderer, s, c) => {
      if (!outline) {
        outline = new OutlineEffect(renderer, {
          defaultThickness: 0.002, defaultColor: [0, 0.9, 1], defaultAlpha: 0.75,
        });
      }
      // Bone rotation
      if (bones.base)     bones.base.rotation.y     = initRot.base     + baseDelta();
      if (bones.turret)   bones.turret.rotation.y   = initRot.turret   + turretDelta();
      if (bones.shoulder) bones.shoulder.rotation.x = initRot.shoulder + shoulderDelta();
      if (bones.elbow)    bones.elbow.rotation.x    = initRot.elbow    + elbowDelta();
      if (bones.wrist)    bones.wrist.rotation.x    = initRot.wrist    + wristDelta();

      // Grip
      const g = gripClose();
      if (fingers.finger1) fingers.finger1.position.lerpVectors(fingerPos.open.f1, fingerPos.closed.f1, g);
      if (fingers.finger2) fingers.finger2.position.lerpVectors(fingerPos.open.f2, fingerPos.closed.f2, g);

      // Cube2
      const c2 = cube2Opacity();
      cube2FillMat.opacity = c2 * 0.25;
      cube2EdgeMat.opacity = c2;

      const mode = cubeMode();
      if (mode === 1 && bones.wrist && bones.hand) {
        sceneRoot.updateMatrixWorld(true);
        const wp = new Vector3(), hp = new Vector3();
        bones.wrist.getWorldPosition(wp);
        bones.hand.getWorldPosition(hp);
        const tip = hp.clone().add(hp.clone().sub(wp));
        const b = grabBlend();
        cube2.position.lerpVectors(grabOrigin, tip, b);
        const dir = hp.clone().sub(wp);
        const horiz = Math.sqrt(dir.x * dir.x + dir.z * dir.z);
        const tilt = Math.atan2(dir.y, horiz);
        if (!grabTiltReady) {
          grabTilt = tilt;
          grabTiltReady = true;
        }
        cube2.rotation.y = (baseDelta() + turretDelta()) - grabBaseY;
        cube2.rotation.x = -(tilt - grabTilt);
      } else if (mode === 0) {
        cube2.position.set(cube2X(), cubeOnBeltY, beltZ);
        cube2.rotation.set(0, 0, 0);
      } else if (mode === 2) {
        cube2.position.copy(stackPos);
        cube2.rotation.x = 0;
      }

      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      outline.render(s, c);
    },
  });
  // ── Zoom container (code + 3D zoom out together) ──
  const zoomRef = createRef<Node>();
  view.add(
    <Node ref={zoomRef} scale={ZOOM} x={ZOOM_X0} y={ZOOM_Y0} />,
  );

  threeView.node.x(Screen.width / 4);
  threeView.node.opacity(0);
  threeView.node.scale(ARM_DISPLAY);
  zoomRef().add(threeView.node);

  // ═══════════════════════════════════════════════════════════════════════
  // MANTICORE: full code, at final zoom-out position inside container
  // ═══════════════════════════════════════════════════════════════════════
  const MC_STYLE = {
    x: MC_FINAL_X,
    y: MC_FINAL_Y,
    width: MC_WIDTH,
    fontSize: SZ,
    lineHeight: MC_LINE_H,
    fontFamily: F,
    theme: DryFiltersV3CodeTheme,
    noClip: true,
    cardStyle: {
      radius: 0, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)',
      strokeWidth: 0, edge: false, opacity: 0,
      shadowBlur: 0, shadowColor: 'rgba(0,0,0,0)',
      shadowOffsetX: 0, shadowOffsetY: 0,
    },
    glowAccent: false,
    customTypes: ['Cube', 'Table', 'GrabStrategy', 'StandardGrab', 'SoftGrab'],
  };
  const mc = Manticore.create(INIT_CODE, MC_STYLE);
  mc.mount(zoomRef());
  mc.node.scale(MC_SCALE);
  mc.colorize(COLOR_RULES);

  // Hide all lines except the grab line
  for (let i = 0; i < mc.lineCount; i++) {
    if (i !== GRAB_LINE) mc.getLine(i)!.node.opacity(0);
  }

  // On the grab line, hide prefix tokens — grab stays at its final position
  const grabLine = mc.getLine(GRAB_LINE)!;
  const gt = grabLine.tokens;
  const prefixFull = String(gt[1].ref().text());  // 'grabStrategy' — save before mutation
  gt[1].ref().text('');     // grabStrategy → empty
  gt[2].ref().text('');     // . → empty
  gt[7].ref().opacity(0);   // ; → hidden

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 1: grab(cube) appears centered
  // ═══════════════════════════════════════════════════════════════════════
  yield* mc.appear(0.6);
  yield* waitFor(1.4);

  // Move up
  yield* zoomRef().y(ZOOM_Y0 - 180, 0.7, easeInOutCubic);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2: Strategy list
  // ═══════════════════════════════════════════════════════════════════════
  const listNode = createRef<Node>();
  view.add(<Node ref={listNode} opacity={0} />);

  const ITEMS = [
    {name: 'StandardGrab', y: -30},
    {name: 'SoftGrab', y: 40},
    {name: 'FirmGrab', y: 110},
  ];

  const barRef = createRef<Rect>();
  const itemRefs: ReturnType<typeof createRef<Txt>>[] = [];

  listNode().add(
    <Rect
      ref={barRef}
      x={-230} y={ITEMS[0].y}
      width={6} height={42} radius={3}
      fill={BAR_COLOR} opacity={0}
    />,
  );

  for (const item of ITEMS) {
    const ref = createRef<Txt>();
    listNode().add(
      <Txt
        ref={ref}
        text={item.name}
        fontFamily={Fonts.code}
        fontSize={40}
        fill={TEXT}
        y={item.y}
        opacity={0}
      />,
    );
    itemRefs.push(ref);
  }

  yield* listNode().opacity(1, 0);

  yield* all(
    itemRefs[0]().opacity(1, 0.4, easeInOutCubic),
    itemRefs[1]().opacity(0.18, 0.4, easeInOutCubic),
    itemRefs[2]().opacity(0.18, 0.4, easeInOutCubic),
    barRef().opacity(1, 0.4, easeInOutCubic),
  );
  yield* waitFor(0.25);

  yield* all(
    barRef().y(ITEMS[1].y, 0.3, easeInOutCubic),
    itemRefs[0]().opacity(0.18, 0.3, easeInOutCubic),
    itemRefs[1]().opacity(1, 0.3, easeInOutCubic),
  );
  yield* waitFor(0.25);

  yield* all(
    barRef().y(ITEMS[2].y, 0.3, easeInOutCubic),
    itemRefs[1]().opacity(0.18, 0.3, easeInOutCubic),
    itemRefs[2]().opacity(1, 0.3, easeInOutCubic),
  );
  yield* waitFor(0.25);

  yield* all(
    barRef().y(ITEMS[0].y, 0.3, easeInOutCubic),
    itemRefs[2]().opacity(0.18, 0.3, easeInOutCubic),
    itemRefs[0]().opacity(1, 0.3, easeInOutCubic),
  );

  yield* waitFor(1.5);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 3: grabStrategy. appears LEFT of grab — then full code reveals
  // ═══════════════════════════════════════════════════════════════════════
  yield* listNode().opacity(0, 0.5, easeInOutCubic);
  yield* waitFor(0.4);

  // Typewriter + surrounding code appear simultaneously
  const lineAnims = [];
  for (let i = 0; i < mc.lineCount; i++) {
    if (i !== GRAB_LINE) lineAnims.push(mc.getLine(i)!.setOpacity(1, 0.4));
  }
  yield* all(
    (function* () {
      for (let c = 0; c < prefixFull.length; c++) {
        gt[1].ref().text(prefixFull.slice(0, c + 1));
        yield* waitFor(charDelay(prefixFull[c], 0.015));
      }
      gt[2].ref().text('.');
      yield* waitFor(charDelay('.', 0.015));
      yield* gt[7].ref().opacity(1, 0.2, easeInOutCubic);
    })(),
    ...lineAnims,
  );

  yield* waitFor(0.4);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 5: Zoom out + hologram + STANDARD gauge appears together
  // ═══════════════════════════════════════════════════════════════════════
  const GAUGE_W = 320;
  const GAUGE_X = Screen.width / 4 + 70;
  const GAUGE_Y = -Screen.height / 2 + 130;
  const GAP = 38;
  const LABEL_X = -GAUGE_W / 2 - 60;

  const forceVal = createSignal(0);
  const speedVal = createSignal(0);

  const gaugeNode = createRef<Node>();
  const forceFill = createRef<Rect>();
  const speedFill = createRef<Rect>();
  const modeLabel = createRef<Txt>();
  const softLabel = createRef<Txt>();

  zoomRef().add(
    <Node ref={gaugeNode} x={GAUGE_X} y={GAUGE_Y} opacity={0}>
      <Txt
        ref={modeLabel}
        text={'STANDARD'}
        fontFamily={Fonts.code}
        fontSize={32}
        fill={'rgba(0, 229, 255, 0.5)'}
        y={-48}
      />
      <Txt
        ref={softLabel}
        text={'SOFT'}
        fontFamily={Fonts.code}
        fontSize={32}
        fill={'rgba(0, 229, 255, 0.5)'}
        y={-48}
        opacity={0}
      />
      {/* Force row */}
      <Txt
        text={'Force'}
        fontFamily={Fonts.code}
        fontSize={22}
        fill={'rgba(0, 229, 255, 0.4)'}
        x={LABEL_X} y={-GAP / 2}
      />
      <Rect
        width={GAUGE_W} height={10} radius={5}
        fill={'rgba(0, 229, 255, 0.12)'}
        stroke={'rgba(0, 229, 255, 0.25)'}
        lineWidth={1} y={-GAP / 2}
      />
      <Rect
        ref={forceFill}
        width={0} height={10} radius={5}
        fill={'rgba(255, 149, 0, 0.8)'}
        offset={[-1, 0]}
        x={-GAUGE_W / 2} y={-GAP / 2}
      />
      {/* Speed row */}
      <Txt
        text={'Speed'}
        fontFamily={Fonts.code}
        fontSize={22}
        fill={'rgba(0, 229, 255, 0.4)'}
        x={LABEL_X} y={GAP / 2}
      />
      <Rect
        width={GAUGE_W} height={10} radius={5}
        fill={'rgba(0, 229, 255, 0.12)'}
        stroke={'rgba(0, 229, 255, 0.25)'}
        lineWidth={1} y={GAP / 2}
      />
      <Rect
        ref={speedFill}
        width={0} height={10} radius={5}
        fill={'rgba(255, 149, 0, 0.8)'}
        offset={[-1, 0]}
        x={-GAUGE_W / 2} y={GAP / 2}
      />
    </Node>,
  );

  // Zoom out + gauge + standard bars all at once
  yield* all(
    zoomRef().scale(1, 1.2, easeInOutCubic),
    zoomRef().x(0, 1.2, easeInOutCubic),
    zoomRef().y(0, 1.2, easeInOutCubic),
    threeView.node.opacity(1, 1.2, easeInOutCubic),
    gaugeNode().opacity(1, 1.2, easeInOutCubic),
    forceFill().width(GAUGE_W * 0.7, 1.2, easeInOutCubic),
    speedFill().width(GAUGE_W * 0.8, 1.2, easeInOutCubic),
  );

  yield* waitFor(1.2);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 6: Highlight init line → morph to SoftGrab → change gauges
  // ═══════════════════════════════════════════════════════════════════════
  // Smoothly dim everything except init + grab lines
  yield* all(
    mc.dimLines(0, mc.lineCount - 1, 0.2, 0.6),
    mc.dimLines(INIT_LINE, INIT_LINE, 1, 0.6),
    mc.dimLines(GRAB_LINE, GRAB_LINE, 1, 0.6),
  );
  yield* waitFor(0.3);

  // Morph + gauge transition + label crossfade — all simultaneous
  yield* all(
    mc.morphTo(SOFT_CODE, {addStyle: 'typewriter', charDelay: 0.025}),
    forceFill().width(GAUGE_W * 0.3, 1.0, easeInOutCubic),
    speedFill().width(GAUGE_W * 0.4, 1.0, easeInOutCubic),
    // Label: STANDARD slides up + fades, SOFT slides up from below + appears
    modeLabel().opacity(0, 0.5, easeInOutCubic),
    modeLabel().y(-58, 0.5, easeInOutCubic),
    (function* () {
      softLabel().y(-38);
      yield* all(
        softLabel().opacity(1, 0.5, easeInOutCubic),
        softLabel().y(-48, 0.5, easeInOutCubic),
      );
    })(),
    (function* () {
      yield* waitFor(0.4);
      forceFill().fill('rgba(0, 229, 255, 0.8)');
      speedFill().fill('rgba(0, 229, 255, 0.8)');
    })(),
  );
  mc.colorize(COLOR_RULES);

  // Keep init + grab lines highlighted — rest stays dimmed until end
  yield* all(
    mc.dimLines(0, mc.lineCount - 1, 0.25, 0.4),
    mc.dimLines(INIT_LINE, INIT_LINE, 1, 0.4),
    mc.dimLines(GRAB_LINE, GRAB_LINE, 1, 0.4),
  );
  yield* waitFor(0.3);

  // Cube2 appears at grab position
  cube2.visible = true;
  cube2X(0);

  // Arm reaches to cube
  yield* all(
    baseDelta(reachDeltas.base, 2.0, easeInOutCubic),
    turretDelta(reachDeltas.turret, 2.0, easeInOutCubic),
    shoulderDelta(reachDeltas.shoulder, 2.0, easeInOutCubic),
    elbowDelta(reachDeltas.elbow, 2.0, easeInOutCubic),
    wristDelta(reachDeltas.wrist, 2.0, easeInOutCubic),
    cube2Opacity(1, 0.6, easeInOutCubic),
  );
  yield* waitFor(0.2);

  // Gentle grip + attach
  yield* gripClose(0.5, 0.5, easeInOutCubic);
  grabOrigin.copy(cube2.position);
  grabBaseY = baseDelta() + turretDelta();
  grabTiltReady = false;
  cubeMode(1);
  yield* grabBlend(1, 0.15, easeInOutCubic);

  // Lift
  yield* all(
    baseDelta(liftDeltas.base, 1.8, easeInOutCubic),
    turretDelta(liftDeltas.turret, 1.8, easeInOutCubic),
    shoulderDelta(liftDeltas.shoulder, 1.8, easeInOutCubic),
    elbowDelta(liftDeltas.elbow, 1.8, easeInOutCubic),
    wristDelta(liftDeltas.wrist, 1.8, easeInOutCubic),
  );
  yield* waitFor(0.2);

  // Place on top of first cube
  yield* all(
    baseDelta(placeDeltas.base, 1.8, easeInOutCubic),
    turretDelta(placeDeltas.turret, 1.8, easeInOutCubic),
    shoulderDelta(placeDeltas.shoulder, 1.8, easeInOutCubic),
    elbowDelta(placeDeltas.elbow, 1.8, easeInOutCubic),
    wristDelta(placeDeltas.wrist, 1.8, easeInOutCubic),
  );
  yield* waitFor(0.1);

  // Release — onRender mode=2 handles position from here
  cubeMode(2);
  yield* gripClose(0, 0.4, easeInOutCubic);
  yield* waitFor(0.2);

  // Arm returns to rest
  yield* all(
    baseDelta(0, 1.5, easeInOutCubic),
    turretDelta(0, 1.5, easeInOutCubic),
    shoulderDelta(0, 1.5, easeInOutCubic),
    elbowDelta(0, 1.5, easeInOutCubic),
    wristDelta(0, 1.5, easeInOutCubic),
  );

  yield* waitFor(0.5);

  // Cleanup + fade
  yield* gaugeNode().opacity(0, 0.4, easeInOutCubic);
  yield* waitFor(0.2);
  yield* zoomRef().opacity(0, 0.8, easeInOutCubic);
  yield* waitFor(0.3);
});
