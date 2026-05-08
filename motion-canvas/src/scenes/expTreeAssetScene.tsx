import {Circle, Gradient, Img, Node, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  chain,
  createRef,
  createSignal,
  easeInOutCubic,
  easeOutCubic,
  Vector2,
  waitFor,
} from '@motion-canvas/core';
import {Fonts} from '../core/theme';

// ─────────────────────────────────────────────────────────────────────────
// Hand-drawn sumi-e tree as a transparent-background asset (cleaned via
// scripts/clean-tree-asset.cjs). Reveal animates a mask shrinking
// upward — the tree "grows out of the ground". LIMBO atmosphere
// (fog, vignette, motes) wraps it. true/false labels at the three
// most readable forks in the source painting.
// ─────────────────────────────────────────────────────────────────────────

type GrowSig = ReturnType<typeof createSignal<number>>;

const FOREST_W = 1920;
const FOREST_H = 1080;

const BG_TOP    = '#0c0d10';
const BG_BOTTOM = '#06070a';
const LABEL_COL = 'rgba(232, 226, 215, 0.65)';

// Tree image (cleaned). Original 736×1198 after watermark crop.
const ASSET_W = 736;
const ASSET_H = 1158;   // 1288 source - 130 crop

const TREE_HEIGHT = 1040;
const TREE_WIDTH  = TREE_HEIGHT * (ASSET_W / ASSET_H);
const TREE_X      = -260;
const TREE_Y      = 0;

// Convert pixel-space coordinates from the source image into world
// coords. Origin (0,0) of the image = top-left.
const px2world = (ix: number, iy: number): [number, number] => [
  TREE_X + (ix / ASSET_W - 0.5) * TREE_WIDTH,
  TREE_Y + (iy / ASSET_H - 0.5) * TREE_HEIGHT,
];

// Forks I picked off the cleaned image (pixel coords):
//   1. Main trunk split — large fork ~ 35% from bottom
//   2. Upper-left split — branch heading up-left from trunk
//   3. Hero-right split — horizontal limb fork
const FORKS_PX = [
  {x: 320, y: 760, leftSide: 'true' as const, rightSide: 'false' as const},
  {x: 280, y: 480, leftSide: 'true' as const, rightSide: 'false' as const},
  {x: 540, y: 720, leftSide: 'true' as const, rightSide: 'false' as const},
];

export default makeScene2D(function* (view) {
  // ── Atmospheric background ───────────────────────────────────────────
  view.add(
    <Rect
      width={FOREST_W}
      height={FOREST_H}
      fill={new Gradient({
        type: 'linear',
        from: new Vector2(0, -FOREST_H / 2),
        to: new Vector2(0, FOREST_H / 2),
        stops: [
          {offset: 0, color: BG_TOP},
          {offset: 1, color: BG_BOTTOM},
        ],
      })}
    />,
  );

  for (const fog of [
    {x: -200, y: 200, r: 700, op: 0.10},
    {x:  300, y:  50, r: 600, op: 0.07},
    {x: -100, y: -150, r: 500, op: 0.05},
  ]) {
    view.add(
      <Circle
        x={fog.x}
        y={fog.y}
        width={fog.r * 2}
        height={fog.r * 2}
        fill={new Gradient({
          type: 'radial',
          from: new Vector2(0, 0),
          to: new Vector2(0, 0),
          fromRadius: 0,
          toRadius: fog.r,
          stops: [
            {offset: 0,    color: `rgba(150, 160, 180, ${fog.op})`},
            {offset: 0.55, color: `rgba(150, 160, 180, ${fog.op * 0.4})`},
            {offset: 1,    color: 'rgba(150, 160, 180, 0)'},
          ],
        })}
      />,
    );
  }

  // ── Tree asset + reveal mask ─────────────────────────────────────────
  // Image is wrapped in a clipping container whose height shrinks from
  // the top down — uncovering the tree from the bottom up.
  const clipNode = createRef<Node>();
  const clipHeight = createSignal(TREE_HEIGHT);

  // The container is anchored at the bottom of the tree, so when its
  // height shrinks it crops from the TOP, not from the bottom. We want
  // the OPPOSITE — uncover bottom first. So we put the image at full
  // size and use a separate full-coverage mask Rect that recedes upward.
  view.add(
    <Img
      src={'/tree-clean.png'}
      x={TREE_X}
      y={TREE_Y}
      width={TREE_WIDTH}
      height={TREE_HEIGHT}
      smoothing
    />,
  );

  // Mask: same color as the bg gradient at the tree's vertical extent.
  // It covers the tree fully at start; height shrinks to zero so the
  // bottom edge of the mask travels upward, revealing the tree under it.
  const maskHeight = createSignal(TREE_HEIGHT + 40);
  const maskTopY = TREE_Y - TREE_HEIGHT / 2 - 20;
  view.add(
    <Rect
      x={TREE_X}
      y={() => maskTopY + maskHeight() / 2}
      width={TREE_WIDTH + 40}
      height={maskHeight}
      fill={new Gradient({
        type: 'linear',
        from: new Vector2(0, -300),
        to: new Vector2(0, 300),
        stops: [
          {offset: 0,    color: BG_TOP},
          {offset: 1,    color: BG_BOTTOM},
        ],
      })}
    />,
  );

  // ── Labels at major forks ────────────────────────────────────────────
  const labelLayer = createRef<Node>();
  view.add(<Node ref={labelLayer} />);

  const labelOpacities: GrowSig[] = [];
  const labelPositions: number[] = [];   // image-y of each fork pair (for reveal timing)

  for (const fork of FORKS_PX) {
    const [wx, wy] = px2world(fork.x, fork.y);
    const opL = createSignal(0);
    const opR = createSignal(0);
    labelOpacities.push(opL, opR);
    labelPositions.push(wy);
    labelLayer().add(
      <Txt
        text={fork.leftSide}
        x={wx - 60}
        y={wy + 10}
        fontFamily={Fonts.code}
        fontSize={20}
        fill={LABEL_COL}
        opacity={opL}
      />,
    );
    labelLayer().add(
      <Txt
        text={fork.rightSide}
        x={wx + 70}
        y={wy + 10}
        fontFamily={Fonts.code}
        fontSize={20}
        fill={LABEL_COL}
        opacity={opR}
      />,
    );
  }

  // ── Drifting motes ───────────────────────────────────────────────────
  const moteSigs: GrowSig[] = [];
  const seed = (a: number) => () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rand = seed(89);
  for (let i = 0; i < 32; i++) {
    const startX = (rand() - 0.5) * FOREST_W * 0.95;
    const startY = FOREST_H / 2 - 60 + rand() * 80;
    const sig = createSignal(0);
    moteSigs.push(sig);
    const driftX = (rand() - 0.5) * 60;
    const driftY = -(700 + rand() * 350);
    const radius = 1 + rand() * 2;
    const op = 0.18 + rand() * 0.22;
    view.add(
      <Circle
        x={() => startX + driftX * sig()}
        y={() => startY + driftY * sig()}
        width={radius * 2}
        height={radius * 2}
        fill={'rgba(232, 226, 215, 1.0)'}
        opacity={() => op * Math.sin(sig() * Math.PI)}
      />,
    );
  }

  // ── Vignette (always on top) ─────────────────────────────────────────
  view.add(
    <Rect
      width={FOREST_W}
      height={FOREST_H}
      fill={new Gradient({
        type: 'radial',
        from: new Vector2(0, 0),
        to: new Vector2(0, 0),
        fromRadius: 0,
        toRadius: FOREST_W * 0.55,
        stops: [
          {offset: 0,    color: 'rgba(0, 0, 0, 0)'},
          {offset: 0.65, color: 'rgba(0, 0, 0, 0)'},
          {offset: 1,    color: 'rgba(0, 0, 0, 0.85)'},
        ],
      })}
    />,
  );

  // ── Animation ────────────────────────────────────────────────────────
  // Reveal: mask shrinks from full (TREE_HEIGHT+40) to 0 over REVEAL_DUR.
  // Each label fades in shortly after its fork-y is uncovered by the
  // receding mask edge.
  const REVEAL_DUR = 5.5;
  const h0 = TREE_HEIGHT + 40;

  // For each fork: world-y where it sits. Mask bottom edge = maskTopY +
  // maskHeight. Fork uncovered when bottom edge < forkWorldY ⇒
  // maskHeight < forkWorldY - maskTopY.
  // Linear approx (eased ~ similar shape): t_label = REVEAL_DUR * (1 - hTrigger / h0)
  const labelTimes: number[] = labelPositions.map(forkWy => {
    const hTrigger = forkWy - maskTopY;
    const ratio = Math.max(0, Math.min(1, 1 - hTrigger / h0));
    // Adjust by easeOutCubic profile: when h has reached fraction f of
    // its journey, time elapsed ≈ 1 - (1-f)^(1/3)
    const eased = 1 - Math.pow(1 - ratio, 1 / 3);
    return REVEAL_DUR * eased;
  });

  for (const sig of moteSigs) sig(0);
  const moteAnims = moteSigs.map(s => s(1, 14, easeInOutCubic));

  yield* waitFor(0.4);

  yield* all(
    ...moteAnims,
    maskHeight(0, REVEAL_DUR, easeOutCubic),
    ...FORKS_PX.flatMap((_fork, i) => {
      const t = labelTimes[i];
      return [
        chain(waitFor(t + 0.5), labelOpacities[i * 2](1, 0.6, easeOutCubic)),
        chain(waitFor(t + 0.7), labelOpacities[i * 2 + 1](1, 0.6, easeOutCubic)),
      ];
    }),
  );

  yield* waitFor(2);
});
