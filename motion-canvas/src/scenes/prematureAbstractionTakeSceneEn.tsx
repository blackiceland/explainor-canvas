import {makeScene2D, Node, Txt} from '@motion-canvas/2d';
import {all, createRef, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
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
import {Colors, Fonts, Screen, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

const ACCENT = Colors.accent;
const MODEL_URL = '/basic_robot_arm.glb';

function dotArmMat(isSkinned: boolean, baseOpacity: number): MeshBasicMaterial {
  const mat = new MeshBasicMaterial({
    color: 0x00e5ff,
    transparent: true,
    opacity: baseOpacity,
  });
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

const THREE_W = Screen.width / 2;
const THREE_H = Screen.height;
const THREE_VIEW_X = Screen.width / 4;

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ═══════════════════════════════════════════════════════════════════════
  // ACT 1: "premature abstraction" appears, then slides left on X only
  // ═══════════════════════════════════════════════════════════════════════
  const prematureTxt = createRef<Txt>();

  view.add(
    <Txt
      ref={prematureTxt}
      fontFamily={Fonts.primary}
      fontSize={72}
      fontWeight={600}
      fill={ACCENT}
      y={0}
      opacity={0}
    >
      premature abstraction
    </Txt>,
  );

  yield* prematureTxt().opacity(1, 0.6, easeInOutCubic);
  yield* waitFor(1.6);
  yield* prematureTxt().x(-560, 1.0, easeInOutCubic);

  // ═══════════════════════════════════════════════════════════════════════
  // ACT 2: 3D scene — static arm, belt (A), platform (B)
  // ═══════════════════════════════════════════════════════════════════════
  const scene3 = new Scene();
  const camera = new PerspectiveCamera(50, THREE_W / THREE_H, 1, 10000);
  camera.position.set(900, 550, 1400);
  camera.lookAt(-100, 250, 400);

  const fillMat = new MeshBasicMaterial({color: 0x00a0b8, transparent: true, opacity: 0.12});
  const edgeMat = new LineBasicMaterial({color: 0x00a0b8, transparent: true, opacity: 0.7});
  const cubeFillMat = new MeshBasicMaterial({color: 0xff9500, transparent: true, opacity: 0.25});
  const cubeEdgeMat = new LineBasicMaterial({color: 0xff9500, transparent: true, opacity: 1.0});

  function bp(
    geom: BoxGeometry | CylinderGeometry,
    fill?: MeshBasicMaterial,
    edge?: LineBasicMaterial,
  ): Group {
    const g = new Group();
    g.add(new Mesh(geom, fill ?? fillMat));
    g.add(new LineSegments(new EdgesGeometry(geom), edge ?? edgeMat));
    return g;
  }

  // Belt (A)
  const conveyor = new Group();
  const beltLen = 1200;
  const beltW = 160;
  const beltH = 15;
  const beltY = 0;
  const beltZ = 600;
  const legH = 120;

  const belt = bp(new BoxGeometry(beltLen, beltH, beltW));
  belt.position.set(0, beltY, beltZ);
  conveyor.add(belt);

  const railH = 30, railT = 8;
  for (const s of [-1, 1]) {
    const rail = bp(new BoxGeometry(beltLen, railH, railT));
    rail.position.set(0, beltY + beltH / 2 + railH / 2, beltZ + s * (beltW / 2 + railT / 2));
    conveyor.add(rail);
  }
  for (const xs of [-1, 1]) for (const zs of [-1, 1]) {
    const leg = bp(new CylinderGeometry(10, 10, legH, 8));
    leg.position.set(
      xs * (beltLen / 2 - 40),
      beltY - beltH / 2 - legH / 2,
      beltZ + zs * (beltW / 2 - 20),
    );
    conveyor.add(leg);
  }
  for (const xs of [-1, 1]) {
    const roller = bp(new CylinderGeometry(18, 18, beltW - 10, 16));
    roller.rotation.x = Math.PI / 2;
    roller.position.set(xs * (beltLen / 2 - 5), beltY, beltZ);
    conveyor.add(roller);
  }
  scene3.add(conveyor);

  // Two cubes: A on belt, B on platform — cross-fade for teleport
  const cubeSize = 60;
  const cubeOnBeltY = beltY + beltH / 2 + cubeSize / 2;
  const cubeStopX = 0;

  const cubeA = bp(new BoxGeometry(cubeSize, cubeSize, cubeSize), cubeFillMat, cubeEdgeMat);
  cubeA.position.set(cubeStopX, cubeOnBeltY, beltZ);
  scene3.add(cubeA);

  // Platform (B)
  const platX = -350;
  const platZ = 300;
  const platW = 260;
  const platD = 180;
  const platH = 15;
  const platform = bp(new BoxGeometry(platW, platH, platD));
  platform.position.set(platX, beltY, platZ);
  scene3.add(platform);
  for (const xs of [-1, 1]) for (const zs of [-1, 1]) {
    const pLeg = bp(new CylinderGeometry(10, 10, legH, 8));
    pLeg.position.set(
      platX + xs * (platW / 2 - 30),
      beltY - platH / 2 - legH / 2,
      platZ + zs * (platD / 2 - 25),
    );
    scene3.add(pLeg);
  }
  const placedCubeY = beltY + platH / 2 + cubeSize / 2;
  const cubeBMat = new MeshBasicMaterial({color: 0xff9500, transparent: true, opacity: 0});
  const cubeBEdgeMat = new LineBasicMaterial({color: 0xff9500, transparent: true, opacity: 0});
  const cubeB = bp(new BoxGeometry(cubeSize, cubeSize, cubeSize), cubeBMat, cubeBEdgeMat);
  cubeB.position.set(platX, placedCubeY, platZ);
  scene3.add(cubeB);

  // Load arm model — static pose, no animation
  const gltf: any = yield new Promise<any>((resolve, reject) => {
    new GLTFLoader().load(MODEL_URL, resolve, undefined, reject);
  });
  scene3.add(gltf.scene);
  const sceneRoot = gltf.scene as Object3D;
  sceneRoot.traverse((obj: any) => {
    if (obj instanceof SkinnedMesh) {
      obj.material = dotArmMat(true, 0.14);
    } else if (obj instanceof Mesh) {
      obj.material = dotArmMat(false, 0.11);
    }
  });

  // 3D vector on ground plane — A → B (thick box shaft + cone tip)
  const groundY = beltY - beltH / 2 - legH + 4;
  const arrowOrigin = new Vector3(cubeStopX, groundY, beltZ);
  const arrowTarget = new Vector3(platX, groundY, platZ);
  const arrowDir = arrowTarget.clone().sub(arrowOrigin);
  const arrowFullLen = arrowDir.length();
  arrowDir.normalize();
  const arrowAccentHex = parseInt(ACCENT.replace('#', ''), 16);
  const arrowHeadLen = 70;
  const arrowShaftThickness = 10;
  const arrowShaftMat = new MeshBasicMaterial({color: arrowAccentHex, transparent: true, opacity: 0});
  const arrowHeadMat = new MeshBasicMaterial({color: arrowAccentHex, transparent: true, opacity: 0});
  const arrow = new Group();
  const arrowShaft = new Mesh(new BoxGeometry(1, arrowShaftThickness, arrowShaftThickness), arrowShaftMat);
  const arrowHead = new Mesh(new ConeGeometry(24, arrowHeadLen, 16), arrowHeadMat);
  arrowHead.rotation.z = -Math.PI / 2;
  arrow.add(arrowShaft);
  arrow.add(arrowHead);
  arrow.position.copy(arrowOrigin);
  const arrowYaw = Math.atan2(
    arrowTarget.x - arrowOrigin.x,
    arrowTarget.z - arrowOrigin.z,
  );
  arrow.rotation.y = arrowYaw - Math.PI / 2;
  scene3.add(arrow);

  const arrowProgress = createSignal(0);
  const cubeAOpacity = createSignal(1);
  const cubeBOpacity = createSignal(0);

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

      // Cube cross-fade
      const oa = cubeAOpacity();
      const ob = cubeBOpacity();
      cubeFillMat.opacity = 0.25 * oa;
      cubeEdgeMat.opacity = 1.0 * oa;
      cubeBMat.opacity = 0.25 * ob;
      cubeBEdgeMat.opacity = 1.0 * ob;

      // Arrow grow (shaft extends, head rides tip)
      const p = arrowProgress();
      const totalLen = Math.max(0.0001, arrowFullLen * p);
      const shaftLen = Math.max(0.0001, totalLen - arrowHeadLen);
      arrowShaft.scale.x = shaftLen;
      arrowShaft.position.x = shaftLen / 2;
      arrowHead.position.x = shaftLen + arrowHeadLen / 2;
      const arrowAlpha = Math.min(1, p * 4);
      arrowShaftMat.opacity = 0.95 * arrowAlpha;
      arrowHeadMat.opacity = arrowAlpha;

      outline.render(s, c);
    },
  });

  threeView.node.x(THREE_VIEW_X);
  threeView.node.opacity(0);
  view.add(threeView.node);

  // 2D A/B labels projected from 3D positions
  camera.updateMatrixWorld(true);
  function worldToScreen(world: Vector3): {x: number; y: number} {
    const v = world.clone().project(camera);
    return {
      x: THREE_VIEW_X + v.x * (THREE_W / 2),
      y: -v.y * (THREE_H / 2),
    };
  }
  const posA = worldToScreen(new Vector3(cubeStopX, cubeOnBeltY - cubeSize / 2, beltZ));
  const posB = worldToScreen(new Vector3(platX, placedCubeY - cubeSize / 2, platZ));

  const labelA = createRef<Txt>();
  const labelB = createRef<Txt>();

  view.add(
    <Txt
      ref={labelA}
      x={posA.x + 80}
      y={posA.y + 90}
      fontFamily={Fonts.primary}
      fontSize={64}
      fontWeight={700}
      fill={ACCENT}
      opacity={0}
    >
      A
    </Txt>,
  );
  view.add(
    <Txt
      ref={labelB}
      x={posB.x - 90}
      y={posB.y + 90}
      fontFamily={Fonts.primary}
      fontSize={64}
      fontWeight={700}
      fill={ACCENT}
      opacity={0}
    >
      B
    </Txt>,
  );

  // ═══════════════════════════════════════════════════════════════════════
  // ACT 3: 3D appears, A label, cube teleport to B, vector fills in
  // ═══════════════════════════════════════════════════════════════════════
  yield* threeView.node.opacity(1, 0.8, easeInOutCubic);
  yield* labelA().opacity(1, 0.5, easeInOutCubic);
  yield* waitFor(0.6);

  // Cube teleport: A fades out, brief gap, B fades in
  yield* cubeAOpacity(0, 0.35, easeInOutCubic);
  yield* waitFor(0.12);
  yield* cubeBOpacity(1, 0.35, easeInOutCubic);
  yield* labelB().opacity(1, 0.5, easeInOutCubic);

  yield* arrowProgress(1, 1.2, easeInOutCubic);
  yield* waitFor(2.0);

  yield* all(
    threeView.node.opacity(0, Timing.slow, easeInOutCubic),
    labelA().opacity(0, Timing.slow, easeInOutCubic),
    labelB().opacity(0, Timing.slow, easeInOutCubic),
    prematureTxt().opacity(0, Timing.slow, easeInOutCubic),
  );
  yield* waitFor(0.3);
});
