import {makeScene2D} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
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
import {Screen} from '../core/theme';
import {applyBackground} from '../core/utils';

// ── Beat 3b — WHAT THE REQUIREMENTS ACTUALLY NEED ────────────────────────
//
// Full-screen 3D. No code. The arm demonstrates three real requirements:
//   1. Maintain orientation during transport  → vertical beam stays vertical
//   2. Avoid sudden movements and impacts     → slow, smooth arc
//   3. Check/stabilize after grip before lift  → green flash after grip
//
// Purple cube = fragile component. Vertical beam = orientation indicator.
// ─────────────────────────────────────────────────────────────────────────

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
  cube3d.position.set(cubeStartX, cubeOnBeltY, beltZ);
  cube3d.renderOrder = -1;
  scene3.add(cube3d);

  // ── Light beam (top: fixed height above cube, bottom: dynamic to surface) ─
  const beamHeight = 1500;
  const BEAM_COLOR = 0xffcc44;
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
  view.add(threeView.node);

  // ═══════════════════════════════════════════════════════════════════════
  // ANIMATION
  // ═══════════════════════════════════════════════════════════════════════

  // Fade in
  yield* threeView.node.opacity(1, 0.8, easeInOutCubic);
  yield* waitFor(0.4);

  // Belt moves cube
  yield* cubeX(cubeStopX, 2.0, easeInOutCubic);
  yield* waitFor(0.3);

  // ── Reach (slow, deliberate) ──────────────────────────────────────────
  yield* all(
    baseDelta(reachDeltas.base, 2.5, easeInOutCubic),
    turretDelta(reachDeltas.turret, 2.5, easeInOutCubic),
    shoulderDelta(reachDeltas.shoulder, 2.5, easeInOutCubic),
    elbowDelta(reachDeltas.elbow, 2.5, easeInOutCubic),
    wristDelta(reachDeltas.wrist, 2.5, easeInOutCubic),
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

  // Beam disappears after placement
  yield* beamGlow(0, 0.6, easeInOutCubic);
  yield* waitFor(0.3);

  // ── Return to rest ────────────────────────────────────────────────────
  yield* all(
    baseDelta(0, 2.0, easeInOutCubic),
    turretDelta(0, 2.0, easeInOutCubic),
    shoulderDelta(0, 2.0, easeInOutCubic),
    elbowDelta(0, 2.0, easeInOutCubic),
    wristDelta(0, 2.0, easeInOutCubic),
  );

  yield* waitFor(1.5);

  // Fade out
  yield* threeView.node.opacity(0, 0.8, easeInOutCubic);
  yield* waitFor(0.3);
});
