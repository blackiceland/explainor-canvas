import {Circle, Line, Node, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  createSignal,
  easeOutCubic,
  Vector2,
  waitFor,
} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';

// ─────────────────────────────────────────────────────────────────────────
// Multi-layer stylized tree. Each branch is rendered as five overlapping
// pieces:
//   1. SHADOW silhouette — slightly larger, offset down-right, darker.
//   2. BASE silhouette — main cream fill, sharp tip taper.
//   3. HIGHLIGHT strip — narrow lighter ribbon along one edge.
//   4. KNOT at base — small ellipse where this branch meets its parent.
//   5. (implicit) sharp tips — endW = 0 on the last generation.
//
// Plus: upper levels spawn 3 children instead of 2 → denser canopy.
// ─────────────────────────────────────────────────────────────────────────

type GrowSig = ReturnType<typeof createSignal<number>>;

type Branch = {
  start: Vector2;
  end: Vector2;
  ctrl: Vector2;
  startW: number;
  endW: number;
  depth: number;
  isTipBranch: boolean;
  grow: GrowSig;
};

const MAX_DEPTH        = 9;
const BASE_LENGTH      = 220;
const BASE_WIDTH       = 36;
const TIP_RATIO        = 0.62;
const WITHIN_TAPER     = 0.74;
const BRANCH_ANGLE_MIN = 16;
const BRANCH_ANGLE_MAX = 36;
const LEN_SCALE_MIN    = 0.62;
const LEN_SCALE_MAX    = 0.78;
const CURVE_AMOUNT     = 0.20;
const KEEP_PROB        = 0.92;
const TRIPLE_DEPTH     = 5;            // depth at which a third child may sprout
const TRIPLE_PROB      = 0.55;
const ROOT_X           = 0;
const ROOT_Y           = 480;
const N_SAMPLES        = 22;

const COLOR_BASE       = 'rgba(244, 240, 234, 1.0)';
const COLOR_SHADOW     = 'rgba(140, 128, 116, 0.55)';
const COLOR_HIGHLIGHT  = 'rgba(255, 252, 245, 1.0)';
const COLOR_KNOT       = 'rgba(178, 162, 142, 0.85)';

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Sample N+1 points along the visible portion of a quadratic bezier and
// build a closed ribbon polygon. `widthScale` controls overall width
// (1.0 = base width, > 1 = shadow inflate, < 1 = highlight strip on top).
// `widthBias` ∈ [0,1] places the ribbon eccentrically: 0.5 = centered,
// 1.0 = pinned to the "top" edge (used for the highlight).
function ribbonShape(
  start: Vector2,
  end: Vector2,
  ctrl: Vector2,
  startW: number,
  endW: number,
  growT: number,
  offset: Vector2,
  widthScale: number,
  widthBias: number,
): Vector2[] {
  if (growT <= 0) return [start, start];
  const top: Vector2[] = [];
  const bot: Vector2[] = [];
  for (let i = 0; i <= N_SAMPLES; i++) {
    const localT = i / N_SAMPLES;
    const t = localT * growT;
    const u = 1 - t;
    const px = start.x * u * u + ctrl.x * 2 * u * t + end.x * t * t + offset.x;
    const py = start.y * u * u + ctrl.y * 2 * u * t + end.y * t * t + offset.y;
    const tx = (ctrl.x - start.x) * 2 * u + (end.x - ctrl.x) * 2 * t;
    const ty = (ctrl.y - start.y) * 2 * u + (end.y - ctrl.y) * 2 * t;
    const tlen = Math.max(0.0001, Math.sqrt(tx * tx + ty * ty));
    const nx = -ty / tlen;
    const ny =  tx / tlen;
    const w = (startW + (endW - startW) * t) * widthScale;
    // bias: top side gets w * (1 - bias·(1 - widthBias))
    const wTop = w * widthBias;
    const wBot = w * (1 - widthBias);
    top.push(new Vector2(px + nx * wTop, py + ny * wTop));
    bot.push(new Vector2(px - nx * wBot, py - ny * wBot));
  }
  return [...top, ...bot.reverse()];
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  const treeRoot = createRef<Node>();
  view.add(<Node ref={treeRoot} />);

  const rand = mulberry32(31);
  const branchesByDepth: Branch[][] = [];
  for (let i = 0; i <= MAX_DEPTH; i++) branchesByDepth.push([]);

  const spawn = (
    start: Vector2,
    parentAngleDeg: number,
    length: number,
    baseWidth: number,
    depth: number,
  ): void => {
    if (depth > MAX_DEPTH) return;

    const angleRad = (parentAngleDeg - 90) * Math.PI / 180;
    const dirX = Math.cos(angleRad);
    const dirY = Math.sin(angleRad);
    const end = start.add(new Vector2(dirX * length, dirY * length));

    const perpX = -dirY;
    const perpY =  dirX;
    const bend = (rand() - 0.5) * 2 * CURVE_AMOUNT * length;
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const ctrl = new Vector2(midX + perpX * bend, midY + perpY * bend);

    const isTipBranch = depth === MAX_DEPTH;
    const startW = baseWidth;
    const endW = isTipBranch ? 0.0 : Math.max(0.4, baseWidth * WITHIN_TAPER);

    const grow = createSignal(0);

    branchesByDepth[depth].push({
      start, end, ctrl, startW, endW, depth, isTipBranch, grow,
    });

    if (depth === MAX_DEPTH) return;

    const tiltL = -(BRANCH_ANGLE_MIN + rand() * (BRANCH_ANGLE_MAX - BRANCH_ANGLE_MIN));
    const tiltR = +(BRANCH_ANGLE_MIN + rand() * (BRANCH_ANGLE_MAX - BRANCH_ANGLE_MIN));
    const lenL = length * (LEN_SCALE_MIN + rand() * (LEN_SCALE_MAX - LEN_SCALE_MIN));
    const lenR = length * (LEN_SCALE_MIN + rand() * (LEN_SCALE_MAX - LEN_SCALE_MIN));
    const childBase = endW * (TIP_RATIO + (rand() - 0.5) * 0.05);

    if (rand() < KEEP_PROB) spawn(end, parentAngleDeg + tiltL, lenL, childBase, depth + 1);
    if (rand() < KEEP_PROB) spawn(end, parentAngleDeg + tiltR, lenR, childBase, depth + 1);

    // Denser canopy: a small straight-up middle child on upper levels
    if (depth >= TRIPLE_DEPTH && rand() < TRIPLE_PROB) {
      const tiltC = (rand() - 0.5) * 8;
      const lenC = length * (LEN_SCALE_MIN + rand() * 0.1);
      spawn(end, parentAngleDeg + tiltC, lenC, childBase * 0.85, depth + 1);
    }
  };

  spawn(new Vector2(ROOT_X, ROOT_Y), 0, BASE_LENGTH, BASE_WIDTH, 0);

  // ── Render: shadow → base → highlight, plus a knot at each base ─────
  const shadowOffset = new Vector2(4, 5);
  for (let d = 0; d <= MAX_DEPTH; d++) {
    for (const b of branchesByDepth[d]) {
      // Shadow underneath
      treeRoot().add(
        <Line
          points={() => ribbonShape(
            b.start, b.end, b.ctrl, b.startW, b.endW,
            b.grow(), shadowOffset, 1.08, 0.5,
          )}
          closed
          fill={COLOR_SHADOW}
          lineWidth={0}
        />,
      );
      // Base silhouette
      treeRoot().add(
        <Line
          points={() => ribbonShape(
            b.start, b.end, b.ctrl, b.startW, b.endW,
            b.grow(), Vector2.zero, 1.0, 0.5,
          )}
          closed
          fill={COLOR_BASE}
          lineWidth={0}
        />,
      );
      // Highlight strip on the "upper" side (perpendicular pos), thinner.
      // Bias the ribbon to one edge — width on top side, none on bottom.
      treeRoot().add(
        <Line
          points={() => ribbonShape(
            b.start, b.end, b.ctrl, b.startW, b.endW,
            b.grow(), Vector2.zero, 0.30, 0.92,
          )}
          closed
          fill={COLOR_HIGHLIGHT}
          lineWidth={0}
        />,
      );
      // Knot at the base — small ellipse, anchored at this branch's start,
      // appears as the branch begins growing.
      if (d > 0) {
        const knotRadius = b.startW * 0.55;
        const knotOpacity = createSignal(0);
        // Reactive: knot opacity follows growth (visible from the very start).
        treeRoot().add(
          <Circle
            x={b.start.x}
            y={b.start.y}
            width={knotRadius * 2}
            height={knotRadius * 2 * 0.7}
            fill={COLOR_KNOT}
            opacity={() => Math.min(1, b.grow() * 4)}
          />,
        );
      }
    }
  }

  // ── Animate by generation ────────────────────────────────────────────
  for (let depth = 0; depth <= MAX_DEPTH; depth++) {
    const layer = branchesByDepth[depth];
    if (layer.length === 0) continue;
    const dur = depth === 0 ? 0.95 : Math.max(0.16, 0.50 - depth * 0.035);
    yield* all(...layer.map(b => b.grow(1, dur, easeOutCubic)));
  }

  yield* waitFor(2);
});
