import {makeScene2D} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {
  AmbientLight,
  Bone,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  KeyframeTrack,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  SkinnedMesh,
  Vector3,
} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createThreeView} from '../core/three/ThreeCanvas';
import {Screen} from '../core/theme';
import {applyBackground} from '../core/utils';

const MODEL_URL = '/basic_robot_arm.glb';

const BONE_NAMES = {
  base:     'Bone_00',
  shoulder: 'Bone003_03',
  elbow:    'Bone005_05',
  wrist:    'Bone007_07',
  hand:     'Bone008_08',
};

const FINGER_NAMES = {
  finger1: 'Bone009_09',
  finger2: 'Bone010_010',
};

function findBone(root: Bone, name: string): Bone | null {
  if (root.name === name) return root;
  for (const child of root.children) {
    const found = findBone(child as Bone, name);
    if (found) return found;
  }
  return null;
}

/** Fingertip position: hand + (hand - wrist) to extend past joint. */
function getTipPos(sceneRoot: Object3D, wrist: Bone, hand: Bone): Vector3 {
  sceneRoot.updateMatrixWorld(true);
  const wp = new Vector3(), hp = new Vector3();
  wrist.getWorldPosition(wp);
  hand.getWorldPosition(hp);
  return hp.clone().add(hp.clone().sub(wp));
}

/** Gradient-descent IK for shoulder/elbow/wrist (all X-axis). */
function solveIK(
  sceneRoot: Object3D,
  bones: Record<string, Bone | null>,
  initRot: Record<string, number>,
  target: Vector3,
): {shoulder: number; elbow: number; wrist: number} {
  const JOINTS = ['shoulder', 'elbow', 'wrist'] as const;
  const deltas = {shoulder: 0, elbow: 0, wrist: 0};
  const EPS = 0.005;

  function apply() {
    for (const j of JOINTS) {
      if (bones[j]) bones[j]!.rotation.x = initRot[j] + deltas[j];
    }
  }

  function cost(): number {
    apply();
    return getTipPos(sceneRoot, bones.wrist!, bones.hand!).distanceTo(target);
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

  // Reset
  for (const j of JOINTS) {
    if (bones[j]) bones[j]!.rotation.x = initRot[j];
  }
  sceneRoot.updateMatrixWorld(true);

  return deltas;
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  const scene3 = new Scene();
  scene3.background = new Color(0x080810);

  const camera = new PerspectiveCamera(48, Screen.width / Screen.height, 1, 10000);
  camera.position.set(1000, 500, 1700);
  camera.lookAt(0, 250, 400);

  // ── Lighting ────────────────────────────────────────────────────────
  scene3.add(new AmbientLight(0xffffff, 0.6));
  const dirLight = new DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(500, 800, 600);
  scene3.add(dirLight);

  // ── Materials ────────────────────────────────────────────────────────
  const conveyorMat = new MeshStandardMaterial({color: 0x555555, metalness: 0.6, roughness: 0.4});
  const accentMat = new MeshStandardMaterial({color: 0x888888, metalness: 0.7, roughness: 0.3});
  const cubeMat = new MeshStandardMaterial({color: 0xff9500, metalness: 0.3, roughness: 0.5});

  // ── Conveyor Belt ─────────────────────────────────────────────────────
  const conveyor = new Group();
  const beltLength = 1200;
  const beltWidth = 160;
  const beltHeight = 15;
  const beltY = 0;
  const beltZ = 600;
  const legHeight = 120;

  // Belt surface
  const belt = new Mesh(new BoxGeometry(beltLength, beltHeight, beltWidth), conveyorMat);
  belt.position.set(0, beltY, beltZ);
  conveyor.add(belt);

  // Side rails
  const railHeight = 30;
  const railThickness = 8;
  for (const side of [-1, 1]) {
    const rail = new Mesh(new BoxGeometry(beltLength, railHeight, railThickness), accentMat);
    rail.position.set(0, beltY + beltHeight / 2 + railHeight / 2, beltZ + side * (beltWidth / 2 + railThickness / 2));
    conveyor.add(rail);
  }

  // Legs (4 corners)
  for (const xSide of [-1, 1]) {
    for (const zSide of [-1, 1]) {
      const leg = new Mesh(new CylinderGeometry(10, 10, legHeight, 8), accentMat);
      leg.position.set(
        xSide * (beltLength / 2 - 40),
        beltY - beltHeight / 2 - legHeight / 2,
        beltZ + zSide * (beltWidth / 2 - 20),
      );
      conveyor.add(leg);
    }
  }

  // Rollers at the ends
  for (const xSide of [-1, 1]) {
    const roller = new Mesh(new CylinderGeometry(18, 18, beltWidth - 10, 16), conveyorMat);
    roller.rotation.x = Math.PI / 2;
    roller.position.set(xSide * (beltLength / 2 - 5), beltY, beltZ);
    conveyor.add(roller);
  }

  scene3.add(conveyor);

  // ── Cube ──────────────────────────────────────────────────────────────
  const cubeSize = 60;
  const cube = new Mesh(new BoxGeometry(cubeSize, cubeSize, cubeSize), cubeMat);
  const cubeOnBeltY = beltY + beltHeight / 2 + cubeSize / 2;
  const cubeStartX = beltLength / 2 - 50;   // starts near right end of belt
  const cubeStopX = 0;                        // stops at center (arm's reach)
  const cubeStartPos = new Vector3(cubeStopX, cubeOnBeltY, beltZ);
  cube.position.set(cubeStartX, cubeOnBeltY, beltZ);
  scene3.add(cube);

  // ── Load model (skeleton only — visuals built from primitives) ──────
  const loader = new GLTFLoader();
  const gltf = yield new Promise<any>((resolve, reject) => {
    loader.load(MODEL_URL, resolve, undefined, reject);
  });
  scene3.add(gltf.scene);
  const sceneRoot = gltf.scene as Object3D;

  // Find skeleton root for IK
  let skeletonRoot: Bone | null = null;
  sceneRoot.traverse((obj: any) => {
    if (obj instanceof SkinnedMesh) {
      if (obj.skeleton) skeletonRoot = obj.skeleton.bones[0];
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

  // ── Extract finger grip positions from baked animation tracks ───────
  // Finger grip is position-animated (not quaternion) — bones translate to close
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

    // t=0s → open, t=1.0s → closed (max squeeze, dist=97 from SPEC probe)
    const f1Open = samplePosTrack(FINGER_NAMES.finger1, 0);
    const f2Open = samplePosTrack(FINGER_NAMES.finger2, 0);
    const f1Closed = samplePosTrack(FINGER_NAMES.finger1, 1.0);
    const f2Closed = samplePosTrack(FINGER_NAMES.finger2, 1.0);

    if (f1Open) fingerPos.open.f1.copy(f1Open);
    if (f2Open) fingerPos.open.f2.copy(f2Open);
    if (f1Closed) fingerPos.closed.f1.copy(f1Closed);
    if (f2Closed) fingerPos.closed.f2.copy(f2Closed);

  }

  // Store initial X rotations only
  const initRot: Record<string, number> = {};
  for (const [key, bone] of Object.entries(bones)) {
    if (bone) initRot[key] = bone.rotation.x;
  }

  // ── IK: find deltas ──────────────────────────────────────────────────
  const reachDeltas = solveIK(sceneRoot, bones, initRot, cubeStartPos);
  const liftTarget = new Vector3(0, 550, 500);
  const liftDeltas = solveIK(sceneRoot, bones, initRot, liftTarget);

  // ── Signals ───────────────────────────────────────────────────────────
  const shoulderDelta = createSignal(0);
  const elbowDelta    = createSignal(0);
  const wristDelta    = createSignal(0);
  const gripClose     = createSignal(0);

  let cubeAttached = false;
  const cubeX = createSignal(cubeStartX);
  const grabBlend = createSignal(0);
  const grabOrigin = new Vector3();

  const threeView = createThreeView({
    width: Screen.width,
    height: Screen.height,
    scene: scene3,
    camera,
    onRender: (renderer, s, c) => {
      if (bones.shoulder) bones.shoulder.rotation.x = initRot.shoulder + shoulderDelta();
      if (bones.elbow)    bones.elbow.rotation.x    = initRot.elbow    + elbowDelta();
      if (bones.wrist)    bones.wrist.rotation.x    = initRot.wrist    + wristDelta();

      // Finger grip via position lerp
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
        cube.position.lerpVectors(grabOrigin, tip, b);
      } else {
        cube.position.x = cubeX();
      }

      renderer.render(s, c);
    },
  });

  view.add(threeView.node);

  // ── Animation ─────────────────────────────────────────────────────────
  yield* waitFor(0.5);

  // Cube slides along conveyor belt
  yield* cubeX(cubeStopX, 2.0, easeInOutCubic);
  yield* waitFor(0.5);

  // Reach
  yield* all(
    shoulderDelta(reachDeltas.shoulder, 1.5, easeInOutCubic),
    elbowDelta(reachDeltas.elbow, 1.5, easeInOutCubic),
    wristDelta(reachDeltas.wrist, 1.5, easeInOutCubic),
  );
  yield* waitFor(0.2);

  // Grab — close fingers and attach cube
  yield* gripClose(1, 0.3, easeInOutCubic);
  grabOrigin.copy(cube.position);
  cubeAttached = true;
  yield* grabBlend(1, 0.15, easeInOutCubic);
  yield* waitFor(0.15);

  // Lift
  yield* all(
    shoulderDelta(liftDeltas.shoulder, 2.0, easeInOutCubic),
    elbowDelta(liftDeltas.elbow, 2.0, easeInOutCubic),
    wristDelta(liftDeltas.wrist, 2.0, easeInOutCubic),
  );

  // Hold
  yield* waitFor(2.0);
});
