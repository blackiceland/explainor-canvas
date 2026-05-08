import {Circle, Gradient, Line, Node, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  createSignal,
  easeInOutCubic,
  easeOutCubic,
  Vector2,
  waitFor,
} from '@motion-canvas/core';
import {Fonts} from '../core/theme';

// ─────────────────────────────────────────────────────────────────────────
// Closer to a "rich" silhouette tree:
//   * 2-4 children per fork (not just 2) → wider, dense canopy
//   * Lateral twigs — small offshoots on the BODY of a branch, not only
//     at its tip → gives that fractal density
//   * Cubic bezier with two control points → real S-curves
//   * Width modulated by perlin noise → trunk has lumps and swells
//   * Sharp tips on all terminal branches (endW = 0)
//   * 3D highlight strip + shadow strip per branch → branches read as
//     round tubes, not flat ribbons
//   * Atmospheric fog + vignette + drifting motes (LIMBO mood)
//   * `true` / `false` labels at the major forks
// ─────────────────────────────────────────────────────────────────────────

type GrowSig = ReturnType<typeof createSignal<number>>;

type Branch = {
  start: Vector2;
  end: Vector2;
  ctrl1: Vector2;       // cubic bezier control point 1
  ctrl2: Vector2;       // cubic bezier control point 2
  startW: number;
  endW: number;
  isTip: boolean;
  depth: number;
  seed: number;
  grow: GrowSig;
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
const KEEP_PROB        = 0.82;
const TRIPLE_PROB      = 0.40;
const QUAD_PROB        = 0;
const LATERAL_PROB     = 0.30;
const ROOT_X           = 0;
const ROOT_Y           = 480;
const N_SAMPLES        = 22;

const TREE_FILL    = 'rgba(244, 240, 234, 1.0)';
const HILITE_FILL  = 'rgba(255, 252, 245, 1.0)';
const SHADOW_FILL  = 'rgba(180, 175, 168, 0.55)';

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

// Cubic bezier sample with width modulation, perlin lump bias, and an
// edge bias so we can use the same shape for stroke / highlight / shadow.
//   widthScale — multiply width (e.g. 1.05 for shadow inflate)
//   widthBias  — eccentricity: 0.5 = centered, > 0.5 = pinned to top edge
//   lumpAmt    — perlin width modulation amplitude
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
    // Cubic bezier point
    const u2 = u * u, u3 = u2 * u;
    const t2 = t * t, t3 = t2 * t;
    const px = start.x * u3 + 3 * c1.x * u2 * t + 3 * c2.x * u * t2 + end.x * t3;
    const py = start.y * u3 + 3 * c1.y * u2 * t + 3 * c2.y * u * t2 + end.y * t3;
    // Cubic bezier derivative
    const tx = 3 * u2 * (c1.x - start.x) + 6 * u * t * (c2.x - c1.x) + 3 * t2 * (end.x - c2.x);
    const ty = 3 * u2 * (c1.y - start.y) + 6 * u * t * (c2.y - c1.y) + 3 * t2 * (end.y - c2.y);
    const tlen = Math.max(0.0001, Math.sqrt(tx * tx + ty * ty));
    const nx = -ty / tlen;
    const ny =  tx / tlen;
    // Brush pressure with sharp tip lift
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
    // Perlin lumps along the trunk side
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

  // ── Tree gen ─────────────────────────────────────────────────────────
  const treeRoot = createRef<Node>();
  view.add(<Node ref={treeRoot} />);
  const labelLayer = createRef<Node>();
  view.add(<Node ref={labelLayer} />);

  const rand = mulberry32(29);
  const branchesByDepth: Branch[][] = [];
  for (let i = 0; i <= MAX_DEPTH; i++) branchesByDepth.push([]);
  const labels: {x: number; y: number; text: 'true' | 'false'; opacity: GrowSig; depth: number}[] = [];

  const spawn = (
    start: Vector2,
    parentAngleDeg: number,
    length: number,
    baseWidth: number,
    depth: number,
  ): Branch | null => {
    if (depth > MAX_DEPTH) return null;

    const angleRad = (parentAngleDeg - 90) * Math.PI / 180;
    const dirX = Math.cos(angleRad);
    const dirY = Math.sin(angleRad);
    const end = start.add(new Vector2(dirX * length, dirY * length));

    // Cubic S-curve: two control points biased to OPPOSITE sides for
    // natural wood-like serpentine character.
    const perpX = -dirY;
    const perpY =  dirX;
    const bend1 = (rand() - 0.5) * 2 * CURVE_S_AMOUNT * length;
    const bend2 = -bend1 * (0.4 + rand() * 0.5);  // S-curve: opposite sign
    const c1 = new Vector2(
      start.x + dirX * length * 0.33 + perpX * bend1,
      start.y + dirY * length * 0.33 + perpY * bend1,
    );
    const c2 = new Vector2(
      start.x + dirX * length * 0.66 + perpX * bend2,
      start.y + dirY * length * 0.66 + perpY * bend2,
    );

    const isTip = depth >= MAX_DEPTH - 1;  // last two depths get sharp tips
    const startW = baseWidth;
    const endW = isTip ? 0.0 : Math.max(0.4, baseWidth * WITHIN_TAPER);

    const grow = createSignal(0);
    const seed = rand() * 1000;
    const branch: Branch = {start, end, c1, c2, ctrl1: c1, ctrl2: c2, startW, endW, isTip, depth, seed, grow} as any;
    branch.ctrl1 = c1;
    branch.ctrl2 = c2;
    branchesByDepth[depth].push(branch);

    if (depth === MAX_DEPTH) return branch;

    // Variable child count: at least 2, optionally 3 (TRIPLE_PROB) and 4
    // (QUAD_PROB) on upper / mid-canopy levels.
    const tilts: number[] = [];
    tilts.push(-(BRANCH_ANGLE_MIN + rand() * (BRANCH_ANGLE_MAX - BRANCH_ANGLE_MIN)));
    tilts.push(+(BRANCH_ANGLE_MIN + rand() * (BRANCH_ANGLE_MAX - BRANCH_ANGLE_MIN)));
    if (depth >= 1 && rand() < TRIPLE_PROB) {
      tilts.push((rand() - 0.5) * 12);  // mostly axial
    }
    if (depth >= 3 && rand() < QUAD_PROB) {
      tilts.push((rand() - 0.5) * 2 * BRANCH_ANGLE_MAX);
    }

    const childBase = endW * (TIP_RATIO + (rand() - 0.5) * 0.06);

    // Track the first two children for label placement
    const childRefs: {b: Branch | null; tilt: number}[] = [];
    for (const tilt of tilts) {
      if (rand() >= KEEP_PROB && tilts.length > 2) {
        childRefs.push({b: null, tilt});
        continue;
      }
      const lenC = length * (LEN_SCALE_MIN + rand() * (LEN_SCALE_MAX - LEN_SCALE_MIN));
      const child = spawn(end, parentAngleDeg + tilt, lenC, childBase, depth + 1);
      childRefs.push({b: child, tilt});
    }

    // Lateral twigs: small offshoots from the BODY of this branch (not at
    // the end) — they give that fractal density seen in real silhouettes.
    if (depth >= 1 && depth <= MAX_DEPTH - 2 && rand() < LATERAL_PROB) {
      const tParam = 0.45 + rand() * 0.35;        // somewhere in the middle
      const lateralStart = new Vector2(
        start.x + (end.x - start.x) * tParam + perpX * (rand() - 0.5) * 8,
        start.y + (end.y - start.y) * tParam + perpY * (rand() - 0.5) * 8,
      );
      const lateralAngle = parentAngleDeg + (rand() < 0.5 ? -1 : 1) * (BRANCH_ANGLE_MIN + rand() * 30);
      const lateralLen = length * (0.35 + rand() * 0.25);
      const lateralBase = baseWidth * (0.45 + rand() * 0.15);
      spawn(lateralStart, lateralAngle, lateralLen, lateralBase, depth + 2);
    }

    // Place true/false labels on the first two main children of the
    // top three forks.
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

  spawn(new Vector2(ROOT_X, ROOT_Y), 0, BASE_LENGTH, BASE_WIDTH, 0);

  // ── Render: shadow → base → highlight per branch ─────────────────────
  for (let d = 0; d <= MAX_DEPTH; d++) {
    for (const b of branchesByDepth[d]) {
      const lumpAmt = d === 0 ? 1.6 : (d === 1 ? 1.0 : 0.4);
      // Shadow side — slight inflate, dark cream
      treeRoot().add(
        <Line
          points={() => strokeShape(
            b.start, b.end, b.ctrl1, b.ctrl2, b.startW, b.endW, b.isTip, b.seed,
            b.grow(), 1.06, 0.18, lumpAmt,
          )}
          closed
          fill={SHADOW_FILL}
          lineWidth={0}
        />,
      );
      // Main silhouette
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
      // Highlight strip on the opposite (upper) side
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

  // ── Animation ────────────────────────────────────────────────────────
  for (const sig of moteSigs) sig(0);
  const moteAnims = moteSigs.map(s => s(1, 14, easeInOutCubic));

  const growSequence = function* () {
    for (let depth = 0; depth <= MAX_DEPTH; depth++) {
      const layer = branchesByDepth[depth];
      if (layer.length === 0) continue;
      const dur = depth === 0 ? 1.1 : Math.max(0.13, 0.55 - depth * 0.05);
      yield* all(...layer.map(b => b.grow(1, dur, easeOutCubic)));
      // fade in labels rooted at this fork's children
      if (depth === 1) {
        yield* all(
          ...labels.filter(l => l.depth === 0).map(l => l.opacity(1, 0.5, easeOutCubic)),
        );
      } else if (depth === 2) {
        yield* all(
          ...labels.filter(l => l.depth === 1).map(l => l.opacity(1, 0.5, easeOutCubic)),
        );
      } else if (depth === 3) {
        yield* all(
          ...labels.filter(l => l.depth === 2).map(l => l.opacity(1, 0.5, easeOutCubic)),
        );
      }
    }
  };

  yield* all(
    ...moteAnims,
    growSequence(),
  );

  yield* waitFor(2);
});
