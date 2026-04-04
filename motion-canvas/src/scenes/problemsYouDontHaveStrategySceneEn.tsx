import {makeScene2D, Txt, Rect, Node} from '@motion-canvas/2d';
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
const THREE_W = Screen.width / 2;
const THREE_H = Screen.height;

// ── Text helpers ───────────────────────────────────────────────────────
const F = Fonts.code;
const SZ = 64;
const tw = (t: string) => textWidth(t, F, SZ);

// ── Manticore layout constants ─────────────────────────────────────────
const MC_WIDTH = 2200;
const MC_LEFT_EDGE = -MC_WIDTH / 2 + getCodePaddingX(SZ);
const MC_LINE_H = getLineHeight(SZ);

const FULL_CODE = `public void handleCube(Cube cube, Table table) {
    arm.moveTo(cube.position);
    grabStrategy.grab(cube);
    arm.lift();
    arm.moveTo(table.position);
    arm.release();
}`;

const MC_LINES = FULL_CODE.split('\n').length;       // 7
const GRAB_LINE = 2;                                  // grabStrategy.grab(cube);
const GRAB_LINE_Y = -(((MC_LINES - 1) / 2) * MC_LINE_H) + GRAB_LINE * MC_LINE_H;

// grab(cube) centering: grab starts after "    grabStrategy."
const PREFIX_PX = tw('    grabStrategy.');
const GRAB_CUBE_W = tw('grab(cube)');
const GRAB_CUBE_CENTER = MC_LEFT_EDGE + PREFIX_PX + GRAB_CUBE_W / 2;

// ── Color rules ────────────────────────────────────────────────────────
const COLOR_RULES = [
  {match: /^public$/,       color: KW_COLOR},
  {match: /^void$/,         color: KW_COLOR},
  {match: 'handleCube',     color: VAR_LIGHT},
  {match: 'arm',            color: VAR_LIGHT},
  {match: 'cube',           color: VAR_LIGHT},
  {match: 'position',       color: VAR_LIGHT},
  {match: 'table',          color: VAR_LIGHT},
  {match: 'grabStrategy',   color: VAR_LIGHT},
  {match: /^Cube$/,         color: TYPE_CLEAN},
  {match: /^Table$/,        color: TYPE_CLEAN},
  {match: 'moveTo',         color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'grab',           color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'lift',           color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'release',        color: METHOD_COLOR, onlyTypes: ['method']},
];

// ── Zoom-out final layout ──────────────────────────────────────────────
const MC_SCALE = 34 / 64;
const MC_FINAL_X = -Screen.width / 2 + LEFT_PAD - MC_LEFT_EDGE * MC_SCALE;
const MC_FINAL_Y = -69;
const GRAB_CTR_X = MC_FINAL_X + GRAB_CUBE_CENTER * MC_SCALE;
const GRAB_CTR_Y = MC_FINAL_Y + GRAB_LINE_Y * MC_SCALE;
const ZOOM = 1 / MC_SCALE;                            // 64/34
const ZOOM_X0 = -GRAB_CTR_X * ZOOM;                   // grab at screen x=0
const ZOOM_Y0 = -GRAB_CTR_Y * ZOOM;                   // grab at screen y=0

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
  // ── Zoom container (code + 3D zoom out together) ──
  const zoomRef = createRef<Node>();
  view.add(
    <Node ref={zoomRef} scale={ZOOM} x={ZOOM_X0} y={ZOOM_Y0} />,
  );

  threeView.node.x(Screen.width / 4);
  threeView.node.opacity(0);
  threeView.node.scale(0.85);
  zoomRef().add(threeView.node);

  // ═══════════════════════════════════════════════════════════════════════
  // MANTICORE: full code, at final zoom-out position inside container
  // ═══════════════════════════════════════════════════════════════════════
  const mc = Manticore.create(FULL_CODE, {
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
    customTypes: ['Cube', 'Table', 'GrabStrategy'],
  });
  mc.mount(zoomRef());
  mc.node.scale(MC_SCALE);
  mc.colorize(COLOR_RULES);

  // Hide all lines except the grab line
  for (let i = 0; i < mc.lineCount; i++) {
    if (i !== GRAB_LINE) mc.getLine(i)!.node.opacity(0);
  }

  // On the grab line, hide prefix tokens — grab stays at its final position
  // Tokens: [0]'    ' [1]'grabStrategy' [2]'.' [3]'grab' [4]'(' [5]'cube' [6]')' [7]';'
  const grabLine = mc.getLine(GRAB_LINE)!;
  const gt = grabLine.tokens;
  gt[1].ref().text('');     // grabStrategy → empty (positioned but invisible)
  gt[2].ref().text('');     // . → empty
  gt[7].ref().opacity(0);   // ; → hidden

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 1: grab(cube) appears centered
  // ═══════════════════════════════════════════════════════════════════════
  yield* mc.appear(0.6);
  yield* waitFor(1.4);

  // Move up — grab goes to y=-180
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
  // PHASE 3: grabStrategy. appears LEFT of grab — grab does NOT move
  // ═══════════════════════════════════════════════════════════════════════
  yield* listNode().opacity(0, 0.5, easeInOutCubic);
  yield* waitFor(0.4);

  // Typewriter: characters appear left of grab
  const prefixFull = gt[1].text;   // 'grabStrategy'
  for (let c = 0; c < prefixFull.length; c++) {
    gt[1].ref().text(prefixFull.slice(0, c + 1));
    yield* waitFor(charDelay(prefixFull[c], 0.015));
  }
  gt[2].ref().text('.');
  yield* waitFor(charDelay('.', 0.015));

  // Show semicolon
  yield* gt[7].ref().opacity(1, 0.2, easeInOutCubic);

  yield* waitFor(0.6);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 4: Surrounding code appears — grab line stays put
  // ═══════════════════════════════════════════════════════════════════════
  const lineAnims = [];
  for (let i = 0; i < mc.lineCount; i++) {
    if (i !== GRAB_LINE) lineAnims.push(mc.getLine(i)!.setOpacity(1, 0.4));
  }
  yield* all(...lineAnims);

  yield* waitFor(0.4);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 5: Zoom out + hologram
  // ═══════════════════════════════════════════════════════════════════════
  yield* all(
    zoomRef().scale(1, 1.2, easeInOutCubic),
    zoomRef().x(0, 1.2, easeInOutCubic),
    zoomRef().y(0, 1.2, easeInOutCubic),
    threeView.node.opacity(1, 1.2, easeInOutCubic),
  );

  yield* waitFor(2.0);

  yield* zoomRef().opacity(0, 0.8, easeInOutCubic);
  yield* waitFor(0.3);
});
