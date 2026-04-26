import {makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {all, createSignal, easeInCubic, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {
  AmbientLight,
  Bone,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  KeyframeTrack,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  SkinnedMesh,
  SphereGeometry,
  SpotLight,
  Vector3,
} from 'three';
import {OutlineEffect} from 'three/examples/jsm/effects/OutlineEffect.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createThreeView} from '../core/three/ThreeCanvas';
import {Fonts, Screen} from '../core/theme';

const MODEL_URL = '/basic_robot_arm.glb';

const BONE_NAMES: Record<string, string> = {
  base:     'Bone_00',
  turret:   'Bone001_01',
  shoulder: 'Bone003_03',
  elbow:    'Bone005_05',
  forearm:  'Bone006_06',
  wrist:    'Bone007_07',
  hand:     'Bone008_08',
};

const FINGER_NAMES = {
  finger1: 'Bone009_09',
  finger2: 'Bone010_010',
};

const JOINT_AXIS: Record<string, 'x' | 'y'> = {
  base: 'y', turret: 'y', shoulder: 'x', elbow: 'x', forearm: 'x', wrist: 'x', hand: 'x',
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
  // ── Pure black backdrop ───────────────────────────────────────────────
  view.add(new Rect({width: Screen.width, height: Screen.height, fill: '#000000'}));

  // ── Three scene ───────────────────────────────────────────────────────
  const scene3 = new Scene();

  const camera = new PerspectiveCamera(42, Screen.width / Screen.height, 1, 10000);
  camera.position.set(1100, 650, 1500);
  camera.lookAt(-40, 260, 450);

  // ── Lights (burning from frame 1 — reveal is via view opacity, not
  //    intensity, so the arm is always 3D-shaded even while fading in) ──
  const ambient = new AmbientLight(0xb9d9ff, 0.55);
  scene3.add(ambient);

  const keySpot = new SpotLight(0xfff1d6, 9.0, 4000, Math.PI / 4.5, 0.85, 1.1);
  keySpot.position.set(600, 1700, 900);
  keySpot.target.position.set(-40, 230, 480);
  keySpot.target.updateMatrixWorld();
  scene3.add(keySpot);
  scene3.add(keySpot.target);

  const rim = new DirectionalLight(0x5bb8ff, 1.1);
  rim.position.set(-900, 450, -1000);
  scene3.add(rim);

  // Cool cyan fill from viewer-right — complements the warm key,
  // grazes the camera-facing side of the arm ──────────────────────────
  const rightFill = new DirectionalLight(0x4fc8e8, 5.5);
  rightFill.position.set(2200, 550, 100);
  rightFill.target.position.set(-40, 280, 450);
  rightFill.target.updateMatrixWorld();
  scene3.add(rightFill);
  scene3.add(rightFill.target);

  // ── Materials ─────────────────────────────────────────────────────────
  function litMat(opts: {
    color: number;
    emissive?: number;
    emissiveIntensity?: number;
    roughness?: number;
    metalness?: number;
    outlineColor?: [number, number, number];
    outlineAlpha?: number;
  }): MeshStandardMaterial {
    const mat = new MeshStandardMaterial({
      color: opts.color,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 0.4,
      roughness: opts.roughness ?? 0.55,
      metalness: opts.metalness ?? 0.35,
    });
    (mat as any).userData.outlineParameters = {
      thickness: 0.0018,
      color: opts.outlineColor ?? [0.15, 0.7, 0.9],
      alpha: opts.outlineAlpha ?? 0.5,
      visible: true,
      keepAlive: true,
    };
    return mat;
  }

  const frameMat = litMat({color: 0x0f141a, emissive: 0x081018, emissiveIntensity: 0.22, outlineAlpha: 0.3});
  // Belt / platform / legs all share frameMat — make it fadable so we
  // can dissolve the whole stage at the end while keeping cube3d visible.
  frameMat.transparent = true;
  const frameOutlineParams = (frameMat as any).userData.outlineParameters;
  const frameOutlineBaseAlpha: number = frameOutlineParams.alpha;
  const cubeMat  = litMat({color: 0xff9a3c, emissive: 0x4a1f05, emissiveIntensity: 1.0, roughness: 0.45, metalness: 0.2, outlineColor: [1, 0.55, 0.2], outlineAlpha: 0.8});

  function blueprintLit(geom: BufferGeometry, mat: MeshStandardMaterial): Group {
    const g = new Group();
    g.add(new Mesh(geom, mat));
    return g;
  }

  // ── Conveyor ──────────────────────────────────────────────────────────
  const conveyor = new Group();
  const beltLength = 1200;
  const beltWidth = 160;
  const beltHeight = 15;
  const beltY = 0;
  const beltZ = 600;
  const legHeight = 120;

  const belt = blueprintLit(new BoxGeometry(beltLength, beltHeight, beltWidth), frameMat);
  belt.position.set(0, beltY, beltZ);
  conveyor.add(belt);

  const railHeight = 30;
  const railThickness = 8;
  for (const side of [-1, 1]) {
    const rail = blueprintLit(new BoxGeometry(beltLength, railHeight, railThickness), frameMat);
    rail.position.set(0, beltY + beltHeight / 2 + railHeight / 2, beltZ + side * (beltWidth / 2 + railThickness / 2));
    conveyor.add(rail);
  }

  for (const xSide of [-1, 1]) {
    for (const zSide of [-1, 1]) {
      const leg = blueprintLit(new CylinderGeometry(10, 10, legHeight, 8), frameMat);
      leg.position.set(
        xSide * (beltLength / 2 - 40),
        beltY - beltHeight / 2 - legHeight / 2,
        beltZ + zSide * (beltWidth / 2 - 20),
      );
      conveyor.add(leg);
    }
  }

  for (const xSide of [-1, 1]) {
    const roller = blueprintLit(new CylinderGeometry(18, 18, beltWidth - 10, 16), frameMat);
    roller.rotation.x = Math.PI / 2;
    roller.position.set(xSide * (beltLength / 2 - 5), beltY, beltZ);
    conveyor.add(roller);
  }

  scene3.add(conveyor);

  // ── Cube ──────────────────────────────────────────────────────────────
  const cubeSize = 60;
  const cube3d = blueprintLit(new BoxGeometry(cubeSize, cubeSize, cubeSize), cubeMat);
  const cubeOnBeltY = beltY + beltHeight / 2 + cubeSize / 2;
  const cubeStopX = 0;
  const cubeStartPos = new Vector3(cubeStopX, cubeOnBeltY, beltZ);
  cube3d.position.set(cubeStopX, cubeOnBeltY, beltZ);
  cube3d.renderOrder = -1;
  scene3.add(cube3d);

  // ── Second item — a SPHERE, not a cube.  Appears AFTER the curtsy as
  //    a black shadow, then materialises into the same warm orange.
  //    The sphere is the metaphor's twist: the призрак built itself
  //    flexibility along the WRONG axis (joint angles), and the new
  //    requirement varies along a DIFFERENT axis (object shape).  Even
  //    if the призрак were tangible, parallel jaws couldn't grip a
  //    sphere — the prepared abstraction is orthogonal to the real change.
  const cube2Mat = cubeMat.clone();
  cube2Mat.transparent = true;
  cube2Mat.opacity = 0;
  cube2Mat.color.set(0x000000);
  cube2Mat.emissive.set(0x000000);
  cube2Mat.emissiveIntensity = 0;
  (cube2Mat as any).userData = {
    ...cubeMat.userData,
    outlineParameters: {...(cubeMat as any).userData.outlineParameters, alpha: 0},
  };
  const cube2OutlineParams = (cube2Mat as any).userData.outlineParameters;
  const cube2OutlineFinalAlpha: number = (cubeMat as any).userData.outlineParameters.alpha;
  // Sphere sits FURTHER along the belt than the original cube — that
  // way it ends up clearly opposite of cube3d in screen-space (cube3d
  // falls left to the floor, sphere stays right on the belt). ─────
  const cube2_3d = blueprintLit(new SphereGeometry(cubeSize / 2, 32, 20), cube2Mat);
  cube2_3d.position.set(cubeStopX, cubeOnBeltY, beltZ);
  cube2_3d.renderOrder = -1;
  scene3.add(cube2_3d);
  // Endpoint colors used by the materialise tween — cached so we don't
  // allocate a Color object every frame.
  const cube2BlackColor = new Color(0x000000);
  const cube2FinalColor = new Color(0xff9a3c);
  const cube2FinalEmissive = new Color(0x4a1f05);

  // ── Destination platform ──────────────────────────────────────────────
  const platformX = -350;
  const platformZ = 300;
  const platformWidth = 260;
  const platformDepth = 180;
  const platformHeight = 15;
  const platform = blueprintLit(new BoxGeometry(platformWidth, platformHeight, platformDepth), frameMat);
  platform.position.set(platformX, beltY, platformZ);
  scene3.add(platform);

  for (const xSide of [-1, 1]) {
    for (const zSide of [-1, 1]) {
      const pLeg = blueprintLit(new CylinderGeometry(10, 10, legHeight, 8), frameMat);
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

  const armMat = litMat({
    color: 0x2e3a44,
    emissive: 0x09222b,
    emissiveIntensity: 0.18,
    roughness: 0.42,
    metalness: 0.6,
    outlineColor: [0.2, 0.8, 1.0],
    outlineAlpha: 0.22,
  });
  // Real arm fades out under the ghost so the blueprint can render with
  // its native depth behavior (no z-fighting against an opaque twin). ─
  armMat.transparent = true;
  const armMatSkinned = armMat.clone();
  (armMatSkinned as any).userData = armMat.userData;
  const armOutlineParams = (armMat as any).userData.outlineParameters;
  const armOutlineBaseAlpha: number = armOutlineParams.alpha;

  let skeletonRoot: Bone | null = null;
  sceneRoot.traverse((obj: any) => {
    if (obj instanceof SkinnedMesh) {
      if (obj.skeleton) skeletonRoot = obj.skeleton.bones[0];
      obj.material = armMatSkinned;
    } else if (obj instanceof Mesh) {
      obj.material = armMat;
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

  // ── Ghost arm: a second GLTF instance rendered as a blueprint.
  //    The real arm above is physical.  This one is our imagination —
  //    it shows degrees of freedom we THINK we need.  Drives its bones
  //    independently, including the twist axis real IK never uses ────
  const ghostGltf = yield new Promise<any>((resolve, reject) => {
    loader.load(MODEL_URL, resolve, undefined, reject);
  });
  scene3.add(ghostGltf.scene);
  const ghostRoot = ghostGltf.scene as Object3D;

  const ghostOutlineParamsRef: {alpha: number, peak: number}[] = [];

  // Blueprint ghost with the dotArmMat pattern from robotArmCodeScene —
  // translucent cyan + bright cyan outline + procedural dot texture ──
  function ghostMat(isSkinned: boolean): MeshBasicMaterial {
    const fillPeak = isSkinned ? 0.14 : 0.11;
    const outlinePeak = isSkinned ? 0.9 : 0.75;
    const mat = new MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0,
      // Push ghost fragments slightly toward the camera in depth so the
      // ghost ALWAYS wins the z-fight against the real arm's identical
      // geometry, while keeping standard depth-test self-occlusion within
      // the ghost itself (back faces still hidden by ghost front faces).
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -10,
    });
    (mat as any).__fillPeak = fillPeak;
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
    const outlineParams = {
      thickness: isSkinned ? 0.0025 : 0.002,
      color: [0.0, 0.9, 1.0] as [number, number, number],
      alpha: 0,
      peak: outlinePeak,
      visible: true,
      keepAlive: true,
    };
    (mat as any).userData.outlineParameters = outlineParams;
    ghostOutlineParamsRef.push(outlineParams);
    return mat;
  }

  let ghostSkeletonRoot: Bone | null = null;
  ghostRoot.traverse((obj: any) => {
    if (obj instanceof SkinnedMesh) {
      if (obj.skeleton) ghostSkeletonRoot = obj.skeleton.bones[0];
      obj.material = ghostMat(true);
      obj.renderOrder = 1000;
    } else if (obj instanceof Mesh) {
      obj.material = ghostMat(false);
      obj.renderOrder = 1000;
    }
  });

  const ghostBones: Record<string, Bone | null> = {};
  if (ghostSkeletonRoot) {
    for (const [key, name] of Object.entries(BONE_NAMES)) {
      ghostBones[key] = findBone(ghostSkeletonRoot, name);
    }
  }
  const ghostFingers: Record<string, Bone | null> = {};
  if (ghostSkeletonRoot) {
    for (const [key, name] of Object.entries(FINGER_NAMES)) {
      ghostFingers[key] = findBone(ghostSkeletonRoot, name);
    }
  }
  const ghostInitRot: Record<string, number> = {};
  for (const [key, bone] of Object.entries(ghostBones)) {
    if (bone) ghostInitRot[key] = bone.rotation[JOINT_AXIS[key] as 'x' | 'y'];
  }
  // Extra axes real IK never touches — for ghost showmanship:
  //   wrist Y = screw / screwdriver motion
  //   hand X = the human-wrist-style bend nobody uses
  const ghostWristInitY = ghostBones.wrist ? ghostBones.wrist.rotation.y : 0;
  const ghostHandInitX  = ghostBones.hand  ? ghostBones.hand.rotation.x  : 0;

  // ── IK targets ────────────────────────────────────────────────────────
  const reachDeltas = solveIK(sceneRoot, bones, initRot, cubeStartPos);
  //   Lift target swung further left (from arm's POV) and in front of
  //   the belt (Z < beltZ).  Released cube drops OFF the belt. ──────
  const liftTarget = new Vector3(-550, 580, 340);
  const liftDeltas = solveIK(sceneRoot, bones, initRot, liftTarget);
  const placeDeltas = solveIK(sceneRoot, bones, initRot, placeTarget);

  // ── 3D signals ────────────────────────────────────────────────────────
  const baseDelta     = createSignal(0);
  const turretDelta   = createSignal(0);
  const shoulderDelta = createSignal(0);
  const elbowDelta    = createSignal(0);
  const wristDelta    = createSignal(0);
  const gripClose     = createSignal(0);

  // ── Ghost arm signals.  Includes two axes real IK never exercises:
  //    wrist Y (screwdriver) and hand X (human-wrist-style bend) ──────
  const realArmOpacity = createSignal(1);
  const ghostOpacity  = createSignal(0);
  const gBase         = createSignal(0);
  const gTurret       = createSignal(0);
  const gShoulder     = createSignal(0);
  const gElbow        = createSignal(0);
  const gForearmBend  = createSignal(0);  // X — joint between elbow and wrist
  const gWristPitch   = createSignal(0);
  const gWristScrew   = createSignal(0);  // Y-axis — screw motion
  const gHandBend     = createSignal(0);  // hand X — unused wrist-bend joint
  const gGripClose    = createSignal(0);
  // Cube #2 staging — shadow phase first, then full materialise.
  const cube2Shadow      = createSignal(0);  // 0=invisible, 1=full-opaque black silhouette
  const cube2Materialize = createSignal(0);  // 0=black,      1=orange + emissive on
  // Final dissolve: belt + platform + legs all fade together.  Cube3d
  // (the failed cube on the floor) is NOT in this group — it survives.
  const worldOpacity     = createSignal(1);

  let cubeAttached = false;
  let cubePlaced = false;
  const cubeX = createSignal(cubeStopX);
  const cubeY = createSignal(cubeOnBeltY);
  const cubeZ = createSignal(beltZ);
  const grabBlend = createSignal(0);
  const grabOrigin = new Vector3();

  let outline: OutlineEffect | null = null;

  const THREE_W = Screen.width / 2;
  const THREE_H = Screen.height;
  camera.aspect = THREE_W / THREE_H;
  camera.updateProjectionMatrix();

  const threeView = createThreeView({
    width: THREE_W,
    height: THREE_H,
    scene: scene3,
    camera,
    onRender: (renderer, s, c) => {
      if (!outline) {
        outline = new OutlineEffect(renderer, {
          defaultThickness: 0.0018,
          defaultColor: [0.2, 0.8, 1.0],
          defaultAlpha: 0.5,
        });
      }

      renderer.setClearColor(0x000000, 0);
      renderer.clear();

      // Real arm fades to zero before/while the ghost takes over, so the
      // ghost's depth pass is unobstructed and looks identical to the
      // standalone blueprint scene.  Outline alpha tracks material alpha.
      const ro = realArmOpacity();
      armMat.opacity = ro;
      armMatSkinned.opacity = ro;
      armMat.depthWrite = ro > 0.99;
      armMatSkinned.depthWrite = ro > 0.99;
      armOutlineParams.alpha = ro * armOutlineBaseAlpha;
      sceneRoot.visible = ro > 0.001;

      // Ghost arm blueprint: fill + outline alpha from signal, peak
      // alphas differ for skinned vs static parts (matches dotArmMat).
      const go = ghostOpacity();
      ghostRoot.traverse((obj: any) => {
        if (obj.material && (obj instanceof SkinnedMesh || obj instanceof Mesh)) {
          const peak = (obj.material as any).__fillPeak ?? 0.14;
          obj.material.opacity = go * peak;
        }
      });
      for (const p of ghostOutlineParamsRef) p.alpha = go * p.peak;
      ghostRoot.visible = go > 0.001;

      // Drive ghost bones — deltas, plus extra axes real IK never uses
      if (ghostBones.base)     ghostBones.base.rotation.y      = ghostInitRot.base     + gBase();
      if (ghostBones.turret)   ghostBones.turret.rotation.y    = ghostInitRot.turret   + gTurret();
      if (ghostBones.shoulder) ghostBones.shoulder.rotation.x  = ghostInitRot.shoulder + gShoulder();
      if (ghostBones.elbow)    ghostBones.elbow.rotation.x     = ghostInitRot.elbow    + gElbow();
      if (ghostBones.forearm)  ghostBones.forearm.rotation.x   = ghostInitRot.forearm  + gForearmBend();
      if (ghostBones.wrist) {
        ghostBones.wrist.rotation.x = ghostInitRot.wrist + gWristPitch();
        ghostBones.wrist.rotation.y = ghostWristInitY + gWristScrew();
      }
      if (ghostBones.hand) {
        ghostBones.hand.rotation.x = ghostHandInitX + gHandBend();
      }
      const gg = gGripClose();
      if (ghostFingers.finger1) {
        ghostFingers.finger1.position.lerpVectors(fingerPos.open.f1, fingerPos.closed.f1, gg);
      }
      if (ghostFingers.finger2) {
        ghostFingers.finger2.position.lerpVectors(fingerPos.open.f2, fingerPos.closed.f2, gg);
      }

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
        // Cube follows the gripper TIP position only.  Orientation is
        // pinned to identity (horizontal, top-face up) — the gripper is
        // treated as a level platform, no roll/pitch leaks into the cube.
        const wp = new Vector3(), hp = new Vector3();
        bones.wrist!.getWorldPosition(wp);
        bones.hand!.getWorldPosition(hp);
        const tip = hp.clone().add(hp.clone().sub(wp));
        const b = grabBlend();
        cube3d.position.lerpVectors(grabOrigin, tip, b);
      } else if (!cubePlaced) {
        cube3d.position.x = cubeX();
        cube3d.position.y = cubeY();
        cube3d.position.z = cubeZ();
      }

      // Cube #2 — two-stage materialisation.  Shadow phase: opacity grows
      // while material stays pure black (cube reads as a silhouette).
      // Materialise phase: color + emissive lerp from black to the warm
      // orange.  Outline alpha tracks the shadow phase so the silhouette
      // already has its outline before color comes in.
      const sh = cube2Shadow();
      const mz = cube2Materialize();
      cube2Mat.opacity = sh;
      cube2Mat.color.lerpColors(cube2BlackColor, cube2FinalColor, mz);
      cube2Mat.emissive.lerpColors(cube2BlackColor, cube2FinalEmissive, mz);
      cube2Mat.emissiveIntensity = mz * 1.0;
      cube2OutlineParams.alpha = sh * cube2OutlineFinalAlpha;
      cube2_3d.visible = sh > 0.001;

      // Stage dissolve — belt + platform + legs all share frameMat, so a
      // single opacity tween fades them together.  cube3d uses cubeMat
      // (untouched) so it survives the dissolve. ────────────────────
      const wo = worldOpacity();
      frameMat.opacity = wo;
      frameMat.depthWrite = wo > 0.99;
      frameOutlineParams.alpha = wo * frameOutlineBaseAlpha;

      outline.render(s, c);
    },
  });

  threeView.node.x(Screen.width / 4);
  threeView.node.opacity(0);
  view.add(threeView.node);

  // ── Opening statement — lives in the LEFT half (the space reserved
  //    for code in later chapter-2 scenes).  Arm works on the right.
  //    Break at the natural caesura: one setup line, one landing line. ─
  const subtitle = new Txt({
    text: "We're worse at predicting the future\nthan we think.",
    fontFamily: Fonts.primary,
    fontSize: 46,
    fontWeight: 500,
    fill: 'rgba(232, 207, 174, 0.96)',
    textAlign: 'center',
    lineHeight: 62,
    x: -Screen.width / 4,
    y: 0,
    opacity: 0,
  });
  view.add(subtitle);

  // Phrase 2 — preparation / early insurance setup
  const subtitle2 = new Txt({
    text: "And because we know change will come,\nwe try to prepare for it early.",
    fontFamily: Fonts.primary,
    fontSize: 44,
    fontWeight: 500,
    fill: 'rgba(232, 207, 174, 0.96)',
    textAlign: 'center',
    lineHeight: 60,
    x: -Screen.width / 4,
    y: 0,
    opacity: 0,
  });
  view.add(subtitle2);

  // Phrase 3 — the insurance metaphor, landing into take 2
  const subtitle3 = new Txt({
    text: "So we start buying flexibility in advance —\nlike insurance against a future\nwe don't really understand yet.",
    fontFamily: Fonts.primary,
    fontSize: 40,
    fontWeight: 500,
    fill: 'rgba(232, 207, 174, 0.96)',
    textAlign: 'center',
    lineHeight: 56,
    x: -Screen.width / 4,
    y: 0,
    opacity: 0,
  });
  view.add(subtitle3);

  // ── Animated film grain — pre-generate a noise atlas bigger than the
  //    screen, then blit a different sub-region each frame by overriding
  //    the Rect's draw method.  Cheap, guaranteed-animated. ──────────
  const noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = 2560;
  noiseCanvas.height = 1440;
  {
    const nctx = noiseCanvas.getContext('2d')!;
    const img = nctx.createImageData(noiseCanvas.width, noiseCanvas.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    nctx.putImageData(img, 0, 0);
  }

  const grain = new Rect({
    width: Screen.width,
    height: Screen.height,
  });
  const origGrainDraw = (grain as any).draw.bind(grain);
  (grain as any).draw = function (ctx: CanvasRenderingContext2D) {
    const maxDx = noiseCanvas.width - Screen.width;
    const maxDy = noiseCanvas.height - Screen.height;
    const dx = Math.floor(Math.random() * maxDx);
    const dy = Math.floor(Math.random() * maxDy);
    const savedAlpha = ctx.globalAlpha;
    const savedComp = ctx.globalCompositeOperation;
    ctx.globalAlpha = 0.06;
    ctx.globalCompositeOperation = 'screen';
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      noiseCanvas,
      dx, dy, Screen.width, Screen.height,
      -Screen.width / 2, -Screen.height / 2, Screen.width, Screen.height,
    );
    ctx.globalAlpha = savedAlpha;
    ctx.globalCompositeOperation = savedComp;
    origGrainDraw(ctx);
  };
  view.add(grain);

  // ═══════════════════════════════════════════════════════════════════════
  // DIRECTION
  // ═══════════════════════════════════════════════════════════════════════

  // ── Arm materializes out of black, cube already under it ────────────
  yield* threeView.node.opacity(1, 1.6, easeInOutCubic);
  yield* waitFor(1.0);

  // ── Phrase 1 appears AS the arm reaches — word + action land together
  yield* all(
    subtitle.opacity(1, 0.9, easeInOutCubic),
    baseDelta(reachDeltas.base, 1.9, easeInOutCubic),
    turretDelta(reachDeltas.turret, 1.9, easeInOutCubic),
    shoulderDelta(reachDeltas.shoulder, 1.9, easeInOutCubic),
    elbowDelta(reachDeltas.elbow, 1.9, easeInOutCubic),
    wristDelta(reachDeltas.wrist, 1.9, easeInOutCubic),
  );
  yield* waitFor(0.25);

  // ── Grip closes around cube ──────────────────────────────────────────
  yield* gripClose(0.72, 0.4, easeInOutCubic);
  grabOrigin.copy(cube3d.position);
  cubeAttached = true;
  yield* grabBlend(1, 0.18, easeInOutCubic);

  // ── Lift ─────────────────────────────────────────────────────────────
  yield* all(
    baseDelta(liftDeltas.base, 2.3, easeInOutCubic),
    turretDelta(liftDeltas.turret, 2.3, easeInOutCubic),
    shoulderDelta(liftDeltas.shoulder, 2.3, easeInOutCubic),
    elbowDelta(liftDeltas.elbow, 2.3, easeInOutCubic),
    wristDelta(liftDeltas.wrist, 2.3, easeInOutCubic),
  );
  yield* waitFor(0.4);

  // ── Release mid-air: grip opens, cube drops STRAIGHT DOWN with X/Z
  //    frozen at release.  Orientation stays at identity throughout, so
  //    it lands flat — no rotation animation needed. ──────────────────
  const releaseX = cube3d.position.x;
  const releaseY = cube3d.position.y;
  const releaseZ = cube3d.position.z;
  cubeX(releaseX);
  cubeY(releaseY);
  cubeZ(releaseZ);
  cubeAttached = false;
  yield* gripClose(0, 0.28, easeInOutCubic);
  yield* cubeY(-20, 0.7, easeInCubic);
  cubePlaced = true;
  yield* waitFor(0.5);

  // ─── Ghost emerges OVERLAID on the frozen real arm.  Bake the lift
  //     pose into ghost baseline so its silhouette starts exactly on
  //     top of what the real arm is holding ────────────────────────
  gBase(liftDeltas.base);
  gTurret(liftDeltas.turret);
  gShoulder(liftDeltas.shoulder);
  gElbow(liftDeltas.elbow);
  gWristPitch(liftDeltas.wrist);
  // Ghost appears OVER the still-visible real arm.  Polygon-offset on
  // the ghost material wins the z-fight against the identical real-arm
  // geometry, so the blueprint reads cleanly without losing the lit
  // arm beneath it.
  yield* ghostOpacity(1, 0.9, easeInOutCubic);
  yield* waitFor(0.3);

  // Ghost performs a "curtsy" while turning left: turret swings, shoulder
  // droops, elbow bends further — bends lead the arm DOWN.  Wrist pitch
  // counter-rotates so the gripper stays horizontal while the wrist
  // itself screws on Y (screwdriver).  The two bends sum to +0.8 on the
  // X axis, the wrist absorbs -0.8 to hold level. ────────────────────
  yield* all(
    gTurret(liftDeltas.turret + 1.1, 1.6, easeInOutCubic),
    gShoulder(liftDeltas.shoulder + 0.5, 1.6, easeInOutCubic),
    gElbow(liftDeltas.elbow + 0.3, 1.6, easeInOutCubic),
    gWristPitch(liftDeltas.wrist - 0.8, 1.6, easeInOutCubic),
    gWristScrew(Math.PI * 2, 1.6, easeInOutCubic),
  );
  yield* waitFor(0.6);

  // ── A new cube emerges on the belt.  First phase: shadow — fades in
  //    as a pure-black silhouette, no color, just presence.
  yield* cube2Shadow(1, 0.6, easeInOutCubic);
  // Second phase: materialise — black warms into orange, emissive lights up.
  yield* cube2Materialize(1, 0.7, easeInOutCubic);
  yield* waitFor(0.25);

  // Призрак lowers the arm from the curtsy pose into the proper IK reach
  // for the SPHERE (further along the belt, opposite side of screen
  // from the floor cube).  Wrist screw stops where it was — the showy
  // flourish was ALREADY done. ─────────────────────────────────────
  yield* all(
    gTurret(reachDeltas.turret,    1.4, easeInOutCubic),
    gShoulder(reachDeltas.shoulder,1.4, easeInOutCubic),
    gElbow(reachDeltas.elbow,      1.4, easeInOutCubic),
    gWristPitch(reachDeltas.wrist, 1.4, easeInOutCubic),
  );

  // One short grab attempt — gripper snaps shut, opens.  Fails because
  // призрак is intangible: the cube never moves.  Single failed attempt
  // is enough to seal the metaphor — repetition would dilute it. ────
  yield* gGripClose(0.72, 0.2, easeInOutCubic);
  yield* gGripClose(0,    0.2, easeInOutCubic);
  yield* waitFor(0.6);

  // For now: only the призрак dissolves.  The real arm, the belt, the
  // new cube and the subtitle all stay — leaving the lit-arm/belt/cube
  // tableau as the last frame.  (Wider dissolve can come later.) ────
  yield* ghostOpacity(0, 1.4, easeInOutCubic);
  yield* waitFor(1.0);
});
