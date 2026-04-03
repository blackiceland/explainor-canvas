import {makeScene2D, Txt, Rect, Node, Layout} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {
  BoxGeometry, CylinderGeometry, EdgesGeometry, Group,
  LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial,
  Object3D, PerspectiveCamera, Scene, SkinnedMesh,
} from 'three';
import {OutlineEffect} from 'three/examples/jsm/effects/OutlineEffect.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createThreeView} from '../core/three/ThreeCanvas';
import {applyBackground} from '../core/utils';
import {Colors, Fonts, Screen} from '../core/theme';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';

// ── Colors ──────────────────────────────────────────────────────────────
const ACCENT = Colors.accent;                        // #FF8CA3
const TEXT = Colors.text.primary;                     // #F4F1EB
const BAR_COLOR = 'rgba(255,140,163,0.8)';
const METHOD = DryFiltersV3CodeTheme.method;          // #FF8CA3
const VAR = 'rgba(244, 241, 235, 0.96)';
const KW = DryFiltersV3CodeTheme.keyword;              // rgba(163,205,255,0.82)
const TYPE_C = 'rgba(220, 215, 255, 0.80)';

// ── Layout (matching robotArmCodeScene) ─────────────────────────────────
const LEFT_PAD = 80;
const CODE_W = Screen.width / 2 - LEFT_PAD - 20;
const CODE_CENTER_X = -Screen.width / 2 + LEFT_PAD + CODE_W / 2;
const THREE_W = Screen.width / 2;
const THREE_H = Screen.height;

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

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ═══════════════════════════════════════════════════════════════════════
  // SETUP: 3D hologram (static end state from robotArmCodeScene)
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
  conveyor.add(bp(new BoxGeometry(beltLen, beltH, beltW), fillMat, edgeMat));
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

  const gltf: any = yield new Promise<any>((resolve, reject) => {
    new GLTFLoader().load('/basic_robot_arm.glb', resolve, undefined, reject);
  });
  scene3.add(gltf.scene);
  (gltf.scene as Object3D).traverse((obj: any) => {
    if (obj instanceof SkinnedMesh) obj.material = dotArmMat(true, 0.14);
    else if (obj instanceof Mesh) obj.material = dotArmMat(false, 0.11);
  });

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
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      outline.render(s, c);
    },
  });
  threeView.node.x(Screen.width / 4);
  threeView.node.opacity(0);
  view.add(threeView.node);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 1: grab(cube)
  // ═══════════════════════════════════════════════════════════════════════
  const grabRef = createRef<Txt>();
  view.add(
    <Txt
      ref={grabRef}
      text={'grab(cube)'}
      fontFamily={Fonts.code}
      fontSize={64}
      fill={TEXT}
      opacity={0}
    />,
  );

  yield* grabRef().opacity(1, 0.6, easeInOutCubic);
  yield* waitFor(1.4);
  yield* grabRef().y(-180, 0.7, easeInOutCubic);

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
  // PHASE 3: Transform grab(cube) → grabStrategy.grab(cube);
  // ═══════════════════════════════════════════════════════════════════════
  const codeWrap = createRef<Node>();
  view.add(<Node ref={codeWrap} />);

  const transformLine = createRef<Layout>();
  const prefixRef = createRef<Txt>();
  const verbRef = createRef<Txt>();
  const argsRef = createRef<Txt>();

  // "grabStrategy." = variable (VAR), "grab" = method call (METHOD), args = VAR
  codeWrap().add(
    <Layout
      ref={transformLine}
      layout direction={'row'} gap={0}
      y={-180} opacity={0}
    >
      <Txt ref={prefixRef} text={''} fontFamily={Fonts.code} fontSize={64} fill={VAR} />
      <Txt ref={verbRef} text={'grab'} fontFamily={Fonts.code} fontSize={64} fill={METHOD} />
      <Txt ref={argsRef} text={'(cube)'} fontFamily={Fonts.code} fontSize={64} fill={VAR} />
    </Layout>,
  );

  yield* listNode().opacity(0, 0.5, easeInOutCubic);
  grabRef().opacity(0);
  transformLine().opacity(1);

  yield* waitFor(0.4);

  yield* all(
    prefixRef().text('grabStrategy.', 0.7, easeInOutCubic),
    argsRef().text('(cube);', 0.7, easeInOutCubic),
  );

  yield* waitFor(0.6);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 4: Code assembles → zoom out → hologram
  // ═══════════════════════════════════════════════════════════════════════

  const LINE_H = 104;
  const GRAB_Y = -180;
  const F = Fonts.code;
  const SZ = 64;
  const CW = SZ * 0.6;                       // 38.4 char width at 64px
  const LEFT64 = -374 * (64 / 34);           // left text edge scaled to 64px

  // Center-x for a left-aligned row Layout of N chars
  const alignX = (n: number) => LEFT64 + n * CW / 2;

  // Add 4-space indent to grab line, compensate x so text doesn't jump
  prefixRef().text('    grabStrategy.');
  transformLine().x(-76.8);                   // −(4 chars / 2) × 38.4

  const grabAlignX = alignX(28);             // "    grabStrategy.grab(cube);"

  // 6 surrounding lines: method sig + 4 body + closing brace
  // NOTE: spaces must be embedded in adjacent tokens — standalone space Txt nodes
  // render with zero width inside Motion Canvas Layout.
  const surroundData: {y: number; ch: number; tokens: {text: string; fill: string}[]}[] = [
    {y: GRAB_Y - 2 * LINE_H, ch: 53, tokens: [
      {text: 'public ', fill: KW},
      {text: 'void ', fill: KW},
      {text: 'moveCubeToTable(', fill: VAR},
      {text: 'Cube ', fill: TYPE_C},
      {text: 'cube, ', fill: VAR},
      {text: 'Table ', fill: TYPE_C},
      {text: 'table) {', fill: VAR},
    ]},
    {y: GRAB_Y - LINE_H, ch: 26, tokens: [
      {text: '    moveTo', fill: METHOD},
      {text: '(cube.position);', fill: VAR},
    ]},
    {y: GRAB_Y + LINE_H, ch: 11, tokens: [
      {text: '    lift', fill: METHOD},
      {text: '();', fill: VAR},
    ]},
    {y: GRAB_Y + 2 * LINE_H, ch: 23, tokens: [
      {text: '    place', fill: METHOD},
      {text: '(cube, table);', fill: VAR},
    ]},
    {y: GRAB_Y + 3 * LINE_H, ch: 14, tokens: [
      {text: '    release', fill: METHOD},
      {text: '();', fill: VAR},
    ]},
    {y: GRAB_Y + 4 * LINE_H, ch: 1, tokens: [
      {text: '}', fill: VAR},
    ]},
  ];

  const lineRefs: ReturnType<typeof createRef<Layout>>[] = [];
  for (const line of surroundData) {
    const ref = createRef<Layout>();
    codeWrap().add(
      <Layout
        ref={ref} layout direction={'row'} gap={0}
        x={alignX(line.ch)} y={line.y} opacity={0}
      >
        {line.tokens.map(t => (
          <Txt text={t.text} fontFamily={F} fontSize={SZ} fill={t.fill} />
        ))}
      </Layout>,
    );
    lineRefs.push(ref);
  }

  // Code assembles: surrounding lines fade in + grab line slides to alignment
  yield* all(
    ...lineRefs.map(r => r().opacity(1, 0.4, easeInOutCubic)),
    transformLine().x(grabAlignX, 0.4, easeInOutCubic),
  );
  yield* waitFor(0.4);

  // Zoom out + slide to final Manticore-matching position + hologram
  yield* all(
    codeWrap().scale(34 / 64, 1.2, easeInOutCubic),
    codeWrap().x(-470, 1.2, easeInOutCubic),
    codeWrap().y(-69, 1.2, easeInOutCubic),
    threeView.node.opacity(1, 1.2, easeInOutCubic),
  );

  yield* waitFor(2.0);

  yield* all(
    codeWrap().opacity(0, 0.8, easeInOutCubic),
    threeView.node.opacity(0, 0.8, easeInOutCubic),
  );
  yield* waitFor(0.3);
});
