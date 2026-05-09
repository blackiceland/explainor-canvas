import {Circle, Gradient, Img, Layout, Node, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
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
import skeleton from '../data/tree-skeleton.json';

// ─────────────────────────────────────────────────────────────────────────
// Hand-drawn sumi-e tree, revealed branch-by-branch through compositing.
//
// Layer stack (in a CACHED Layout so composite ops are local):
//   1. White/cream filled circles at each skeleton branch's TIP. Radius
//      grows as that branch's grow signal goes 0→1. Together, the union
//      of all circles forms the "revealed area".
//   2. Image of the cleaned tree, drawn with compositeOperation
//      'source-in' — visible ONLY where the mask circles exist.
//
// Hierarchical scheduler: trunk grows first, children launch when their
// parent is at 60%. The skeleton was extracted from the actual sumi-e
// reference (scripts/extract-tree-skeleton.cjs), so timing matches the
// real branch hierarchy of the painting.
// ─────────────────────────────────────────────────────────────────────────

type GrowSig = ReturnType<typeof createSignal<number>>;
type Branch = {id: number; parent: number; points: [number, number][]};

const FOREST_W = 1920;
const FOREST_H = 1080;
const BG_TOP    = '#0c0d10';
const BG_BOTTOM = '#06070a';
const LABEL_COL = 'rgba(232, 226, 215, 0.65)';

const ASSET_W = 736;
const ASSET_H = 1158;
const TREE_HEIGHT = 1040;
const TREE_WIDTH  = TREE_HEIGHT * (ASSET_W / ASSET_H);
const TREE_X      = -260;
const TREE_Y      = 0;

const SKEL_W = (skeleton as any).width as number;
const SKEL_H = (skeleton as any).height as number;
const BRANCHES = (skeleton as any).branches as Branch[];

// Skeleton was extracted from a 736×1288 source. Our cleaned image is
// 736×1158 (130 px cropped from bottom). So when mapping skeleton coords
// into the cleaned image, we shift y by 0 (skeleton y=0 still maps to
// image y=0). Anything past y=1158 falls below the visible image (we
// just clamp it visually — it'll be covered by ground).
const SKEL_Y_OFFSET = 0;

const px2world = (ix: number, iy: number): Vector2 => new Vector2(
  TREE_X + (ix / ASSET_W - 0.5) * TREE_WIDTH,
  TREE_Y + ((iy + SKEL_Y_OFFSET) / ASSET_H - 0.5) * TREE_HEIGHT,
);

// Reveal radius at full grow per depth — bigger near trunk, smaller for
// twigs. Tuned so the union of circles covers the whole branch's
// painted thickness.
function depthRadius(d: number): number {
  if (d === 0) return 90;
  if (d === 1) return 65;
  if (d === 2) return 45;
  if (d === 3) return 30;
  if (d === 4) return 20;
  if (d === 5) return 14;
  if (d === 6) return 10;
  return 8;
}

function depthDuration(d: number): number {
  if (d === 0) return 0.8;
  if (d === 1) return 0.4;
  if (d === 2) return 0.28;
  if (d === 3) return 0.20;
  return 0.14;
}

const CHILD_HANDOFF = 0.42;
const MIN_PATH_PTS  = 3;

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

  // ── Build branch list with depth ─────────────────────────────────────
  const byId = new Map<number, Branch>();
  for (const b of BRANCHES) byId.set(b.id, b);
  const depth = new Map<number, number>();
  const computeDepth = (id: number): number => {
    if (depth.has(id)) return depth.get(id)!;
    const b = byId.get(id);
    if (!b || b.parent === -1) {
      depth.set(id, 0);
      return 0;
    }
    const d = computeDepth(b.parent) + 1;
    depth.set(id, d);
    return d;
  };
  for (const b of BRANCHES) computeDepth(b.id);

  type RBranch = {b: Branch; pathWorld: Vector2[]; grow: GrowSig; depth: number};
  const renders: RBranch[] = [];
  for (const b of BRANCHES) {
    if (b.points.length < MIN_PATH_PTS) continue;
    const d = depth.get(b.id) ?? 0;
    const grow = createSignal(0);
    renders.push({
      b,
      pathWorld: b.points.map(([x, y]) => px2world(x, y)),
      grow,
      depth: d,
    });
  }

  // ── Composite-masked tree: cached Layout with mask circles + image ──
  view.add(
    <Layout cache>
      {/* Mask: a chain of expanding circles spaced ALONG every branch's
          full path (not just tip/mid). They light up sequentially from
          root-end to tip-end as b.grow → 1, giving a wave-like reveal
          along the branch's actual painted shape. */}
      {renders.flatMap((r, i) => {
        const n = r.pathWorld.length;
        const R = depthRadius(r.depth);
        return r.pathWorld.map((pt, j) => {
          // local progress: this point starts revealing when b.grow > j/n,
          // is fully revealed at b.grow > (j+0.7)/n
          const startT = j / n;
          const fullT = Math.min(1, startT + 0.4);
          return (
            <Circle
              key={`b${i}-${j}`}
              x={pt.x}
              y={pt.y}
              width={() => {
                const t = (r.grow() - startT) / Math.max(0.01, fullT - startT);
                return Math.max(0, Math.min(1, t)) * R * 2;
              }}
              height={() => {
                const t = (r.grow() - startT) / Math.max(0.01, fullT - startT);
                return Math.max(0, Math.min(1, t)) * R * 2;
              }}
              fill={'white'}
            />
          );
        });
      })}
      {/* Image — visible only where the mask above exists */}
      <Img
        src={'/tree-clean.png'}
        x={TREE_X}
        y={TREE_Y}
        width={TREE_WIDTH}
        height={TREE_HEIGHT}
        smoothing
        compositeOperation={'source-in'}
      />
    </Layout>,
  );

  // ── Labels at major forks ────────────────────────────────────────────
  const labelLayer = createRef<Node>();
  view.add(<Node ref={labelLayer} />);

  const labelOpacities: GrowSig[] = [];
  for (const fork of FORKS_PX) {
    const w = px2world(fork.x, fork.y);
    const opL = createSignal(0);
    const opR = createSignal(0);
    labelOpacities.push(opL, opR);
    labelLayer().add(
      <Txt
        text={fork.leftSide}
        x={w.x - 60}
        y={w.y + 10}
        fontFamily={Fonts.code}
        fontSize={20}
        fill={LABEL_COL}
        opacity={opL}
      />,
    );
    labelLayer().add(
      <Txt
        text={fork.rightSide}
        x={w.x + 70}
        y={w.y + 10}
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

  // ── Vignette ─────────────────────────────────────────────────────────
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

  // ── Hierarchical scheduler ───────────────────────────────────────────
  const childrenOf = new Map<number, Branch[]>();
  for (const b of BRANCHES) {
    if (!childrenOf.has(b.parent)) childrenOf.set(b.parent, []);
    childrenOf.get(b.parent)!.push(b);
  }
  const renderById = new Map<number, RBranch>();
  for (const r of renders) renderById.set(r.b.id, r);

  type Anim = {startTime: number; render: RBranch};
  const anims: Anim[] = [];
  const visited = new Set<number>();
  const schedule = (id: number, startTime: number) => {
    if (visited.has(id)) return;
    visited.add(id);
    const r = renderById.get(id);
    let nextStart = startTime;
    if (r) {
      const dur = depthDuration(r.depth);
      anims.push({startTime, render: r});
      nextStart = startTime + dur * CHILD_HANDOFF;
    }
    for (const ch of childrenOf.get(id) ?? []) {
      schedule(ch.id, nextStart);
    }
  };
  const roots = BRANCHES.filter(b => b.parent === -1);
  for (const r of roots) schedule(r.id, 0.4);

  console.log(`[reveal] branches=${BRANCHES.length} renderable=${renders.length} anims=${anims.length}`);

  for (const sig of moteSigs) sig(0);
  const moteAnims = moteSigs.map(s => s(1, 14, easeInOutCubic));

  yield* all(
    ...moteAnims,
    ...anims.map(({startTime, render}) =>
      chain(waitFor(startTime), render.grow(1, depthDuration(render.depth), easeOutCubic)),
    ),
    // Labels appear roughly when their fork zone is uncovered
    chain(waitFor(2.0), labelOpacities[0](1, 0.6, easeOutCubic)),
    chain(waitFor(2.2), labelOpacities[1](1, 0.6, easeOutCubic)),
    chain(waitFor(3.5), labelOpacities[2](1, 0.6, easeOutCubic)),
    chain(waitFor(3.7), labelOpacities[3](1, 0.6, easeOutCubic)),
    chain(waitFor(2.8), labelOpacities[4](1, 0.6, easeOutCubic)),
    chain(waitFor(3.0), labelOpacities[5](1, 0.6, easeOutCubic)),
  );

  yield* waitFor(2);
});
