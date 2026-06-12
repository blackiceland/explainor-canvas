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
// "THREE CUTS OF TRUTH" — the bare sumi-e tree IS the decision tree.
//
//   The single signature  deliver(dryRun, forceSend, isRetry)  is the seed at
//   the root. The tree forks EXACTLY three times — one fork-level per boolean —
//   so the eight twig-tips ARE the eight hidden functions. 2 -> 4 -> 8 is
//   watched as organic growth, never counted. Each boolean owns one fork-level
//   (colored joints: dryRun mint, forceSend amber, isRetry teal/red); every
//   tip carries its (T/F,T/F,T/F) identity. No counter, no sweep, no chips —
//   the explosion is felt in the static fullness of eight lit ends.
//
//   Built on the expTreeLimboV4 machinery: tapered bezier ribbons with edge
//   jitter, multi-pass shadow -> body -> highlight, hierarchical CHILD_HANDOFF
//   growth, fog + drifting motes + vignette.
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
  accentIdx: number;   // governing boolean (= depth-1); -1 for the trunk
  pathBits: string;    // accumulated T/F path (leaf = full 3-char tuple)
  schedStart: number;
  schedDur: number;
};

// ── Per-boolean accents (matches the oneMethodManyVersions beat) ──────────
const ACCENTS = ['#7AC9C9', '#E0BB6A', '#F08A8A']; // dryRun, forceSend, isRetry

const MAX_DEPTH      = 3;            // 3 fork-levels -> 8 leaves
const U              = 10;           // angular unit (deg)
const FORK_HALF      = [4 * U, 2 * U, 1 * U]; // 4:2:1 -> evenly fanned 8 tips
const BASE_LENGTH    = 300;
const BASE_WIDTH     = 58;
// Per-parent-depth length scale: terminal twigs stay long & graceful (not stubby).
const LEN_SCALE_BY_DEPTH = [0.80, 0.82, 0.92];
const WITHIN_TAPER   = 0.82;         // endW = startW * this
const CHILD_W_RATIO  = 0.75;         // child startW = parent endW * this
const CURVE_S        = 0.15;         // bend -> graceful twigs, structure still reads
const ROOT_X         = -20;
const ROOT_Y         = 460;
const TRUNK_LEAN_DEG = -5;
const ANGLE_JITTER   = 6;            // deg, breaks the org-chart symmetry
const LEN_JITTER     = 0.16;
const CHILD_HANDOFF  = 0.60;         // children launch at 60% of parent
const N_SAMPLES      = 40;
const TAG_OFFSET     = 42;

const TREE_FILL   = 'rgba(244, 240, 234, 1.0)';
const HILITE_FILL = 'rgba(255, 252, 245, 1.0)';
const KNOT_CREAM  = 'rgba(248, 244, 238, 1.0)';
const DROP_SHADOW = 'rgba(0, 0, 0, 0.55)';
const GROUND_FILL = 'rgba(244, 240, 234, 1.0)';
const DIM_TF      = 'rgba(232, 226, 215, 0.30)';
const PUNCT_FILL  = 'rgba(244, 241, 235, 0.42)';

const BG_TOP    = '#0c0d10';
const BG_BOTTOM = '#06070a';

const FOREST_W = 1920;
const FOREST_H = 1080;

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 3-octave fractal noise — smooth, not slick.
function fnoise(t: number, seed: number): number {
  return (
    Math.sin(t * 5.13 + seed * 1.0) * 0.55 +
    Math.sin(t * 11.7 + seed * 1.7) * 0.28 +
    Math.sin(t * 27.3 + seed * 2.41) * 0.12 +
    Math.sin(t * 64.1 + seed * 3.13) * 0.05
  );
}

// Tapered ribbon with INDEPENDENT top/bot edge jitter (V4 strokeShape).
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
  jitterAmt: number,
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
    const ny = tx / tlen;

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

    const w = (startW + (endW - startW) * t) * pressure * widthScale;
    const wMul = Math.max(0.05, w * 0.10 + 0.5);
    const jTop = fnoise(t, seed) * jitterAmt * wMul;
    const jBot = fnoise(t, seed + 137.7) * jitterAmt * wMul;

    const wTop = w * widthBias + jTop;
    const wBot = w * (1 - widthBias) + jBot;
    top.push(new Vector2(px + nx * wTop, py + ny * wTop));
    bot.push(new Vector2(px - nx * wBot, py - ny * wBot));
  }
  return [...top, ...bot.reverse()];
}

export default makeScene2D(function* (view) {
  // ── Atmosphere — dark gradient + cool fog blooms ─────────────────────
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
    {x: 300, y: 50, r: 600, op: 0.07},
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
            {offset: 0, color: `rgba(150, 160, 180, ${fog.op})`},
            {offset: 0.55, color: `rgba(150, 160, 180, ${fog.op * 0.4})`},
            {offset: 1, color: 'rgba(150, 160, 180, 0)'},
          ],
        })}
      />,
    );
  }

  const treeRoot = createRef<Node>();
  view.add(<Node ref={treeRoot} />);
  const labelLayer = createRef<Node>();
  view.add(<Node ref={labelLayer} />);

  const rand = mulberry32(7);
  const allBranches: Branch[] = [];
  const leaves: Branch[] = [];

  // ── Build the binary truth-tree (deterministic topology, organic shape) ─
  const build = (
    start: Vector2,
    angleDeg: number,
    length: number,
    baseWidth: number,
    depth: number,
    parent: Branch | null,
    pathBits: string,
  ): Branch => {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;
    const dirX = Math.cos(angleRad);
    const dirY = Math.sin(angleRad);
    const end = start.add(new Vector2(dirX * length, dirY * length));

    const perpX = -dirY;
    const perpY = dirX;
    const bendScale = depth === 0 ? 1.5 : 1.0;
    const bend1 = (rand() - 0.5) * 2 * CURVE_S * length * bendScale;
    const bend2 = -bend1 * (0.4 + rand() * 0.5);
    const c1 = new Vector2(
      start.x + dirX * length * 0.33 + perpX * bend1,
      start.y + dirY * length * 0.33 + perpY * bend1,
    );
    const c2 = new Vector2(
      start.x + dirX * length * 0.66 + perpX * bend2,
      start.y + dirY * length * 0.66 + perpY * bend2,
    );

    const isTip = depth === MAX_DEPTH;
    const startW = baseWidth;
    const endW = isTip ? 0.0 : Math.max(0.6, baseWidth * WITHIN_TAPER);

    const branch: Branch = {
      start, end, ctrl1: c1, ctrl2: c2,
      startW, endW, isTip, depth,
      seed: rand() * 1000,
      grow: createSignal(0),
      children: [],
      parent,
      accentIdx: depth - 1,
      pathBits,
      schedStart: 0,
      schedDur: 0,
    };
    allBranches.push(branch);

    if (depth < MAX_DEPTH) {
      const half = FORK_HALF[depth];
      // false = left limb, true = right limb (so left half of canopy = dryRun
      // false, right half = dryRun true; the first fork splits the crown in two)
      for (const side of [false, true]) {
        const jitter = (rand() - 0.5) * 2 * ANGLE_JITTER;
        const childAngle = angleDeg + (side ? half : -half) + jitter;
        const lenC = length * LEN_SCALE_BY_DEPTH[depth] * (1 + (rand() - 0.5) * 2 * LEN_JITTER);
        const childBase = Math.max(1.5, endW * CHILD_W_RATIO);
        const child = build(end, childAngle, lenC, childBase, depth + 1, branch, pathBits + (side ? 'T' : 'F'));
        branch.children.push(child);
      }
    } else {
      leaves.push(branch);
    }
    return branch;
  };

  // ── Ground mass — chunky inky base the trunk emerges from ────────────
  // (No ground mound — the signature caption anchors the trunk base, and a
  // cream mound washed out the cream signature text behind it.)
  const groundOpacity = createSignal(0);

  const root = build(new Vector2(ROOT_X, ROOT_Y), TRUNK_LEAN_DEG, BASE_LENGTH, BASE_WIDTH, 0, null, '');

  // ── Render branches: drop shadow -> body -> highlight -> colored knot ──
  for (const b of allBranches) {
    const lumpAmt = b.depth === 0 ? 1.9 : b.depth === 1 ? 1.6 : 1.1;

    treeRoot().add(
      <Line
        points={() => strokeShape(b.start, b.end, b.ctrl1, b.ctrl2, b.startW, b.endW, b.isTip, b.seed, b.grow(), 1.0, 0.5, lumpAmt)}
        closed
        fill={DROP_SHADOW}
        lineWidth={0}
        shadowBlur={18}
        shadowColor={DROP_SHADOW}
        shadowOffsetX={4}
        shadowOffsetY={6}
        opacity={0.5}
      />,
    );
    treeRoot().add(
      <Line
        points={() => strokeShape(b.start, b.end, b.ctrl1, b.ctrl2, b.startW, b.endW, b.isTip, b.seed, b.grow(), 1.0, 0.5, lumpAmt)}
        closed
        fill={TREE_FILL}
        lineWidth={0}
      />,
    );
    treeRoot().add(
      <Line
        points={() => strokeShape(b.start, b.end, b.ctrl1, b.ctrl2, b.startW, b.endW, b.isTip, b.seed, b.grow(), 0.32, 0.95, lumpAmt * 0.4)}
        closed
        fill={HILITE_FILL}
        lineWidth={0}
      />,
    );
    // Colored joint = the fork that created this branch (its governing boolean).
    if (b.parent) {
      const knotSize = Math.min(20, Math.max(6, b.startW * 0.85));
      const knotColor = b.accentIdx >= 0 ? ACCENTS[b.accentIdx] : KNOT_CREAM;
      treeRoot().add(
        <Circle
          x={b.start.x}
          y={b.start.y}
          width={knotSize * 1.5}
          height={knotSize * 1.0}
          fill={knotColor}
          opacity={() => Math.min(1, b.grow() * 8)}
        />,
      );
    }
  }

  // ── Tip tags — each leaf carries its (dryRun, forceSend, isRetry) tuple ──
  const tagSigs: {leaf: Branch; sig: GrowSig}[] = [];
  for (const leaf of leaves) {
    const dx = leaf.end.x - leaf.start.x;
    const dy = leaf.end.y - leaf.start.y;
    const len = Math.max(0.001, Math.hypot(dx, dy));
    const px = leaf.end.x + (dx / len) * TAG_OFFSET;
    const py = leaf.end.y + (dy / len) * TAG_OFFSET;
    const sig = createSignal(0);
    tagSigs.push({leaf, sig});
    labelLayer().add(
      <Node x={px} y={py} opacity={sig}>
        <Txt fontFamily={Fonts.code} fontSize={20} fontWeight={500} fill={DIM_TF}>
          {leaf.pathBits.split('').map((ch, i) => (
            <Txt
              text={ch}
              fill={ch === 'T' ? ACCENTS[i] : DIM_TF}
              fontWeight={ch === 'T' ? 700 : 400}
            />
          ))}
        </Txt>
      </Node>,
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

  // ── Signature legend at the root — the one seed everything grows from ──
  const sigOpacity = createSignal(0);
  view.add(
    <Node x={0} y={512} opacity={sigOpacity}>
      <Txt fontFamily={Fonts.code} fontSize={30} fontWeight={500} fill={PUNCT_FILL}>
        <Txt text={'deliver('} fontWeight={500} fill={TREE_FILL} />
        <Txt text={'dryRun'} fontWeight={600} fill={ACCENTS[0]} />
        <Txt text={', '} />
        <Txt text={'forceSend'} fontWeight={600} fill={ACCENTS[1]} />
        <Txt text={', '} />
        <Txt text={'isRetry'} fontWeight={600} fill={ACCENTS[2]} />
        <Txt text={')'} fill={TREE_FILL} />
      </Txt>
    </Node>,
  );

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
          {offset: 0, color: 'rgba(0, 0, 0, 0)'},
          {offset: 0.65, color: 'rgba(0, 0, 0, 0)'},
          {offset: 1, color: 'rgba(0, 0, 0, 0.85)'},
        ],
      })}
    />,
  );

  // ── Growth schedule — deliberate level-by-level cascade so the DOUBLING
  // reads: trunk -> (beat) -> split to 2 -> (beat) -> 4 -> (beat) -> 8. Each
  // level finishes before the next begins (so twigs stay connected to their
  // parent), with a small per-branch stagger so a level isn't lockstep.
  const LEVEL_START = [0.5, 2.2, 3.4, 4.6];
  const LEVEL_DUR   = [1.5, 0.95, 0.85, 0.75];
  for (const b of allBranches) {
    b.schedStart = LEVEL_START[b.depth] + rand() * 0.15;
    b.schedDur = LEVEL_DUR[b.depth];
  }

  for (const sig of moteSigs) sig(0);

  yield* all(
    ...moteSigs.map(s => s(1, 14, easeInOutCubic)),
    sigOpacity(1, 0.9, easeOutCubic),
    ...allBranches.map(b => chain(waitFor(b.schedStart), b.grow(1, b.schedDur, easeOutCubic))),
    ...tagSigs.map(({leaf, sig}) =>
      chain(waitFor(leaf.schedStart + leaf.schedDur + 0.1), sig(1, 0.5, easeOutCubic)),
    ),
  );

  yield* waitFor(2.5);
});
