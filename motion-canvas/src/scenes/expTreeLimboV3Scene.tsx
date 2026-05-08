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

// ─────────────────────────────────────────────────────────────────────────
// V3 — three additions over V2:
//
//   1. HIERARCHICAL GROWTH. Children start growing when their parent has
//      reached 60% of its own length, not after the whole depth layer is
//      done. Branches sprout from points of fork, not appear afterwards.
//
//   2. KNOTS. Small bulge-ellipses at every fork — a slight swelling
//      where a child branch attaches. Without these the tree reads as
//      tubes.
//
//   3. SOFT DROP SHADOW. Real Canvas-level shadowBlur on the body pass,
//      not just an inflated offset polygon. Branches sit in space.
//
// LIMBO atmosphere from V2 is kept (fog, vignette, motes, true/false
// labels at the major forks).
// ─────────────────────────────────────────────────────────────────────────

type GrowSig = ReturnType<typeof createSignal<number>>;

type Branch = {
  start: Vector2;
  end: Vector2;
  ctrl1: Vector2;
  ctrl2: Vector2;
  startW: number;
  endW: number;
  isTip: boolean;
  depth: number;
  seed: number;
  grow: GrowSig;
  children: Branch[];
  parent: Branch | null;
};

const MAX_DEPTH        = 6;
const BASE_LENGTH      = 230;
const BASE_WIDTH       = 42;
const WITHIN_TAPER     = 0.80;
const TIP_RATIO        = 0.55;
const BRANCH_ANGLE_MIN = 14;
const BRANCH_ANGLE_MAX = 55;
const LEN_SCALE_MIN    = 0.55;
const LEN_SCALE_MAX    = 0.84;
const CURVE_S_AMOUNT   = 0.28;
const KEEP_PROB        = 0.85;
const TRIPLE_PROB      = 0.45;
const LATERAL_PROB     = 0.30;
const ROOT_X           = 0;
const ROOT_Y           = 480;
const N_SAMPLES        = 22;
const CHILD_HANDOFF    = 0.60;   // children start growing at parent's 60%

const TREE_FILL    = 'rgba(244, 240, 234, 1.0)';
const HILITE_FILL  = 'rgba(255, 252, 245, 1.0)';
const SHADOW_FILL  = 'rgba(180, 175, 168, 0.55)';
const KNOT_FILL    = 'rgba(248, 244, 238, 1.0)';
const DROP_SHADOW  = 'rgba(0, 0, 0, 0.55)';

// Atmosphere
const BG_TOP    = '#0c0d10';
const BG_BOTTOM = '#06070a';
const LABEL_COL = 'rgba(232, 226, 215, 0.45)';

const FOREST_W = 1920;
const FOREST_H = 1080;

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pnoise(t: number, seed: number): number {
  return (
    Math.sin(t * 4.73 + seed * 1.0) * 0.55 +
    Math.sin(t * 9.31 + seed * 1.7) * 0.30 +
    Math.sin(t * 17.1 + seed * 2.3) * 0.15
  );
}

function strokeShape(
  start: Vector2,
  end: Vector2,
  c1: Vector2,
  c2: Vector2,
  startW: number,
  endW: number,
  isTip: boolean,
  seed: number,
  growT: number,
  widthScale: number,
  widthBias: number,
  lumpAmt: number,
): Vector2[] {
  if (growT <= 0) return [start, start];
  const top: Vector2[] = [];
  const bot: Vector2[] = [];
  for (let i = 0; i <= N_SAMPLES; i++) {
    const localT = i / N_SAMPLES;
    const t = localT * growT;
    const u = 1 - t;
    const u2 = u * u, u3 = u2 * u;
    const t2 = t * t, t3 = t2 * t;
    const px = start.x * u3 + 3 * c1.x * u2 * t + 3 * c2.x * u * t2 + end.x * t3;
    const py = start.y * u3 + 3 * c1.y * u2 * t + 3 * c2.y * u * t2 + end.y * t3;
    const tx = 3 * u2 * (c1.x - start.x) + 6 * u * t * (c2.x - c1.x) + 3 * t2 * (end.x - c2.x);
    const ty = 3 * u2 * (c1.y - start.y) + 6 * u * t * (c2.y - c1.y) + 3 * t2 * (end.y - c2.y);
    const tlen = Math.max(0.0001, Math.sqrt(tx * tx + ty * ty));
    const nx = -ty / tlen;
    const ny =  tx / tlen;
    const tipFactor = isTip ? 0.0 : 0.40;
    let pressure;
    if (t < 0.10) {
      const u_ = t / 0.10;
      pressure = 0.75 + 0.25 * (1 - (1 - u_) * (1 - u_));
    } else if (t < 0.62) {
      pressure = 1.0;
    } else {
      const u_ = (t - 0.62) / 0.38;
      pressure = 1.0 - (1.0 - tipFactor) * (u_ * u_);
    }
    const lump = pnoise(t * 5, seed) * lumpAmt;
    const w = (startW + (endW - startW) * t) * pressure * widthScale + lump;
    const wTop = w * widthBias;
    const wBot = w * (1 - widthBias);
    top.push(new Vector2(px + nx * wTop, py + ny * wTop));
    bot.push(new Vector2(px - nx * wBot, py - ny * wBot));
  }
  return [...top, ...bot.reverse()];
}

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

  // ── Tree generation (returns recursive Branch tree) ──────────────────
  const treeRoot = createRef<Node>();
  view.add(<Node ref={treeRoot} />);
  const labelLayer = createRef<Node>();
  view.add(<Node ref={labelLayer} />);

  const rand = mulberry32(29);
  const labels: {x: number; y: number; text: 'true' | 'false'; opacity: GrowSig; depth: number}[] = [];
  const allBranches: Branch[] = [];

  const spawn = (
    start: Vector2,
    parentAngleDeg: number,
    length: number,
    baseWidth: number,
    depth: number,
    parent: Branch | null,
  ): Branch | null => {
    if (depth > MAX_DEPTH) return null;

    const angleRad = (parentAngleDeg - 90) * Math.PI / 180;
    const dirX = Math.cos(angleRad);
    const dirY = Math.sin(angleRad);
    const end = start.add(new Vector2(dirX * length, dirY * length));

    const perpX = -dirY;
    const perpY =  dirX;
    const bend1 = (rand() - 0.5) * 2 * CURVE_S_AMOUNT * length;
    const bend2 = -bend1 * (0.4 + rand() * 0.5);
    const c1 = new Vector2(
      start.x + dirX * length * 0.33 + perpX * bend1,
      start.y + dirY * length * 0.33 + perpY * bend1,
    );
    const c2 = new Vector2(
      start.x + dirX * length * 0.66 + perpX * bend2,
      start.y + dirY * length * 0.66 + perpY * bend2,
    );

    const isTip = depth >= MAX_DEPTH - 1;
    const startW = baseWidth;
    const endW = isTip ? 0.0 : Math.max(0.4, baseWidth * WITHIN_TAPER);

    const grow = createSignal(0);
    const seed = rand() * 1000;

    const branch: Branch = {
      start, end, ctrl1: c1, ctrl2: c2,
      startW, endW, isTip, depth, seed, grow,
      children: [],
      parent,
    };
    allBranches.push(branch);

    if (depth === MAX_DEPTH) return branch;

    const tilts: number[] = [];
    tilts.push(-(BRANCH_ANGLE_MIN + rand() * (BRANCH_ANGLE_MAX - BRANCH_ANGLE_MIN)));
    tilts.push(+(BRANCH_ANGLE_MIN + rand() * (BRANCH_ANGLE_MAX - BRANCH_ANGLE_MIN)));
    if (depth >= 1 && rand() < TRIPLE_PROB) {
      tilts.push((rand() - 0.5) * 12);
    }

    const childBase = endW * (TIP_RATIO + (rand() - 0.5) * 0.06);

    const childRefs: {b: Branch | null; tilt: number}[] = [];
    for (const tilt of tilts) {
      if (rand() >= KEEP_PROB && tilts.length > 2) {
        childRefs.push({b: null, tilt});
        continue;
      }
      const lenC = length * (LEN_SCALE_MIN + rand() * (LEN_SCALE_MAX - LEN_SCALE_MIN));
      const child = spawn(end, parentAngleDeg + tilt, lenC, childBase, depth + 1, branch);
      if (child) {
        branch.children.push(child);
        childRefs.push({b: child, tilt});
      }
    }

    if (depth >= 1 && depth <= MAX_DEPTH - 2 && rand() < LATERAL_PROB) {
      const tParam = 0.45 + rand() * 0.35;
      const lateralStart = new Vector2(
        start.x + (end.x - start.x) * tParam,
        start.y + (end.y - start.y) * tParam,
      );
      const lateralAngle = parentAngleDeg + (rand() < 0.5 ? -1 : 1) * (BRANCH_ANGLE_MIN + rand() * 30);
      const lateralLen = length * (0.35 + rand() * 0.25);
      const lateralBase = baseWidth * (0.45 + rand() * 0.15);
      const lat = spawn(lateralStart, lateralAngle, lateralLen, lateralBase, depth + 2, branch);
      if (lat) branch.children.push(lat);
    }

    if (depth <= 2) {
      const [left, right] = childRefs;
      const off = 30 + depth * 4;
      if (left?.b) {
        const a = (parentAngleDeg + left.tilt - 90) * Math.PI / 180;
        labels.push({
          x: end.x + Math.cos(a) * off - 50,
          y: end.y + Math.sin(a) * off,
          text: 'true',
          opacity: createSignal(0),
          depth,
        });
      }
      if (right?.b) {
        const a = (parentAngleDeg + right.tilt - 90) * Math.PI / 180;
        labels.push({
          x: end.x + Math.cos(a) * off + 50,
          y: end.y + Math.sin(a) * off,
          text: 'false',
          opacity: createSignal(0),
          depth,
        });
      }
    }

    return branch;
  };

  const root = spawn(new Vector2(ROOT_X, ROOT_Y), 0, BASE_LENGTH, BASE_WIDTH, 0, null)!;

  // ── Render: drop shadow → body → highlight, plus knots at forks ──────
  for (const b of allBranches) {
    const lumpAmt = b.depth === 0 ? 1.6 : (b.depth === 1 ? 1.0 : 0.4);

    // Drop shadow with real Canvas blur. Single layer so we don't pay
    // the blur cost three times per branch.
    treeRoot().add(
      <Line
        points={() => strokeShape(
          b.start, b.end, b.ctrl1, b.ctrl2, b.startW, b.endW, b.isTip, b.seed,
          b.grow(), 1.0, 0.5, lumpAmt,
        )}
        closed
        fill={DROP_SHADOW}
        lineWidth={0}
        shadowBlur={18}
        shadowColor={DROP_SHADOW}
        shadowOffsetX={4}
        shadowOffsetY={6}
        opacity={0.55}
      />,
    );
    // Body silhouette
    treeRoot().add(
      <Line
        points={() => strokeShape(
          b.start, b.end, b.ctrl1, b.ctrl2, b.startW, b.endW, b.isTip, b.seed,
          b.grow(), 1.0, 0.5, lumpAmt,
        )}
        closed
        fill={TREE_FILL}
        lineWidth={0}
      />,
    );
    // Highlight strip on the upper edge
    treeRoot().add(
      <Line
        points={() => strokeShape(
          b.start, b.end, b.ctrl1, b.ctrl2, b.startW, b.endW, b.isTip, b.seed,
          b.grow(), 0.32, 0.95, lumpAmt * 0.4,
        )}
        closed
        fill={HILITE_FILL}
        lineWidth={0}
      />,
    );

    // Knot at the start of every NON-root branch — small ellipse,
    // scaled by parent's tip width. Visible from the moment this branch
    // begins to grow.
    if (b.parent) {
      const knotSize = Math.max(2, b.startW * 1.18);
      treeRoot().add(
        <Circle
          x={b.start.x}
          y={b.start.y}
          width={knotSize * 1.4}
          height={knotSize}
          fill={KNOT_FILL}
          opacity={() => Math.min(1, b.grow() * 8)}
        />,
      );
    }
  }

  // Labels
  for (const lbl of labels) {
    labelLayer().add(
      <Txt
        text={lbl.text}
        x={lbl.x}
        y={lbl.y}
        fontFamily={Fonts.code}
        fontSize={20}
        fill={LABEL_COL}
        opacity={lbl.opacity}
      />,
    );
  }

  // ── Drifting motes ───────────────────────────────────────────────────
  const moteSigs: GrowSig[] = [];
  for (let i = 0; i < 28; i++) {
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

  // ── HIERARCHICAL animation scheduler ─────────────────────────────────
  // Each branch has an absolute startTime. Children launch at their
  // parent.startTime + parent.duration * CHILD_HANDOFF.
  type Anim = {startTime: number; branch: Branch; dur: number};
  const anims: Anim[] = [];
  const schedule = (branch: Branch, startTime: number) => {
    const dur = branch.depth === 0
      ? 1.2
      : Math.max(0.18, 0.55 - branch.depth * 0.05);
    anims.push({startTime, branch, dur});
    const childStart = startTime + dur * CHILD_HANDOFF;
    for (const child of branch.children) {
      schedule(child, childStart);
    }
    // Fade in true/false labels rooted at this fork at the moment its
    // children start.
    if (branch.depth <= 2) {
      // Find labels with depth == branch.depth and pretend they belong
      // to this fork (close enough — only used for top 3 depths).
    }
  };
  schedule(root, 0);

  // Label fade timing — tied to the time when each label's depth fork
  // starts spawning children (we just use approximate cumulative times).
  const labelAnims = [
    {depth: 0, startTime: 1.2 * CHILD_HANDOFF},
    {depth: 1, startTime: 1.2 * CHILD_HANDOFF + 0.45 * CHILD_HANDOFF},
    {depth: 2, startTime: 1.2 * CHILD_HANDOFF + 0.45 * CHILD_HANDOFF + 0.40 * CHILD_HANDOFF},
  ];

  for (const sig of moteSigs) sig(0);
  const moteAnims = moteSigs.map(s => s(1, 14, easeInOutCubic));

  yield* all(
    ...moteAnims,
    ...anims.map(({startTime, branch, dur}) =>
      chain(waitFor(startTime), branch.grow(1, dur, easeOutCubic)),
    ),
    ...labelAnims.flatMap(({depth, startTime}) =>
      labels
        .filter(l => l.depth === depth)
        .map(l => chain(waitFor(startTime + 0.4), l.opacity(1, 0.5, easeOutCubic))),
    ),
  );

  yield* waitFor(2);
});
