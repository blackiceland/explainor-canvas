import {Circle, Gradient, Line, Node, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
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
// Renders the sumi-e tree by drawing its EXTRACTED SKELETON. Skeleton
// is computed offline (scripts/extract-tree-skeleton.cjs) — Zhang-Suen
// thinning + BFS-traversal of the binarized reference image. Each
// branch grows along its actual path from the reference, depth gives
// thickness, and the parent/child hierarchy drives growth timing.
//
// No `Img` here — the image was only the source for skeleton extraction.
// We render purely through stroked Lines, so the tree is procedural
// but its shape is HAND-MADE (the source art).
// ─────────────────────────────────────────────────────────────────────────

type GrowSig = ReturnType<typeof createSignal<number>>;
type Branch = {id: number; parent: number; points: [number, number][]};

const FOREST_W = 1920;
const FOREST_H = 1080;
const BG_TOP    = '#0c0d10';
const BG_BOTTOM = '#06070a';
const TREE_FILL = 'rgba(244, 240, 234, 1.0)';
const LABEL_COL = 'rgba(232, 226, 215, 0.55)';

// Tree positioning in scene world coords. Image is portrait — we fit
// by height and place it slightly left for asymmetric composition.
const SKEL_W = (skeleton as any).width as number;
const SKEL_H = (skeleton as any).height as number;
const BRANCHES = (skeleton as any).branches as Branch[];

const RENDER_HEIGHT = 1040;
const RENDER_WIDTH  = RENDER_HEIGHT * (SKEL_W / SKEL_H);
const TREE_OFFSET_X = -260;     // off-center left
const TREE_OFFSET_Y = 0;

// Map image coords [0..SKEL_W, 0..SKEL_H] → world coords centered around
// (TREE_OFFSET_X, TREE_OFFSET_Y), scaled to RENDER_WIDTH×RENDER_HEIGHT.
const mapPt = ([ix, iy]: [number, number]): Vector2 =>
  new Vector2(
    TREE_OFFSET_X + (ix / SKEL_W - 0.5) * RENDER_WIDTH,
    TREE_OFFSET_Y + (iy / SKEL_H - 0.5) * RENDER_HEIGHT,
  );

// Depth → stroke width. Trunk solid, twigs taper down.
function depthWidth(d: number): number {
  if (d === 0) return 70;
  if (d === 1) return 48;
  if (d === 2) return 32;
  if (d === 3) return 20;
  if (d === 4) return 12;
  if (d === 5) return 7;
  if (d === 6) return 4;
  return 2.5;
}

const MIN_RENDER_PTS = 5;   // skip noise stubs

// Sequential growth duration by depth (faster at twigs).
function depthDuration(d: number): number {
  if (d === 0) return 1.4;
  if (d === 1) return 0.6;
  if (d === 2) return 0.4;
  if (d === 3) return 0.3;
  return 0.22;
}

const CHILD_HANDOFF = 0.55;

export default makeScene2D(function* (view) {
  // ── Atmosphere ───────────────────────────────────────────────────────
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

  // ── Tree: build depth map, render each branch ────────────────────────
  const treeRoot = createRef<Node>();
  view.add(<Node ref={treeRoot} />);

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

  // Pre-compute mapped points and per-branch grow signal
  type BranchRender = {b: Branch; pts: Vector2[]; grow: GrowSig; depth: number};
  const renders: BranchRender[] = [];
  for (const b of BRANCHES) {
    if (b.points.length < MIN_RENDER_PTS) continue;
    const pts = b.points.map(mapPt);
    const grow = createSignal(0);
    renders.push({b, pts, grow, depth: depth.get(b.id) ?? 0});
  }

  // Render in order: shallow first (drawn under), deep last (twigs on top)
  renders.sort((a, b) => a.depth - b.depth);
  for (const r of renders) {
    const w = depthWidth(r.depth);
    treeRoot().add(
      <Line
        points={() => {
          const t = r.grow();
          if (t <= 0) return [r.pts[0], r.pts[0]];
          const lastIdx = r.pts.length - 1;
          const cur = t * lastIdx;
          const i = Math.floor(cur);
          const frac = cur - i;
          if (i >= lastIdx) return r.pts;
          const sub = r.pts.slice(0, i + 1);
          const a = r.pts[i];
          const b = r.pts[i + 1];
          sub.push(new Vector2(
            a.x + (b.x - a.x) * frac,
            a.y + (b.y - a.y) * frac,
          ));
          return sub;
        }}
        stroke={TREE_FILL}
        lineWidth={w}
        lineCap={'round'}
        lineJoin={'round'}
      />,
    );
  }

  // ── Hierarchical animation scheduler ─────────────────────────────────
  const childrenOf = new Map<number, Branch[]>();
  for (const b of BRANCHES) {
    if (!childrenOf.has(b.parent)) childrenOf.set(b.parent, []);
    childrenOf.get(b.parent)!.push(b);
  }

  type Anim = {startTime: number; render: BranchRender};
  const anims: Anim[] = [];
  const visited = new Set<number>();
  const renderById = new Map<number, BranchRender>();
  for (const r of renders) renderById.set(r.b.id, r);

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
    // Recurse to children even if THIS branch was too short to render —
    // otherwise the tree is decapitated at every short stub.
    for (const ch of childrenOf.get(id) ?? []) {
      schedule(ch.id, nextStart);
    }
  };

  // Find roots: branches with parent === -1
  const roots = BRANCHES.filter(b => b.parent === -1);
  for (const r of roots) schedule(r.id, 0.4);

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

  console.log(`[traced] branches=${BRANCHES.length} renderable=${renders.length} animations=${anims.length}`);

  yield* all(
    ...anims.map(({startTime, render}) =>
      chain(waitFor(startTime), render.grow(1, depthDuration(render.depth), easeOutCubic)),
    ),
  );

  yield* waitFor(2);
});
