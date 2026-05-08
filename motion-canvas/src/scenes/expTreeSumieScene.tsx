import {Line, Node, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  createSignal,
  easeInOutCubic,
  easeOutCubic,
  Vector2,
  waitFor,
} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';

// ─────────────────────────────────────────────────────────────────────────
// Sumi-e (japanese ink) brush-stroke tree.
//
// Each branch is rendered as a CLOSED POLYGON sampled densely along a
// quadratic bezier. Three things make it read as a brush stroke instead
// of a CAD ribbon:
//
//   1. PRESSURE PROFILE — width varies along the stroke as if the brush
//      is being pressed and then lifted. Ramp up at the tail-down,
//      sustain through the middle, sharp lift to zero at the tip.
//   2. WOBBLE — small perlin-style offset perpendicular to the path,
//      different on each side, mimicking natural brush jitter.
//   3. INK BLEED — a second, slightly larger and more transparent layer
//      offset to one side, simulating ink wicking into the paper.
//
// No "knots", no "highlights", no "shadows". Just stroke + bleed.
// ─────────────────────────────────────────────────────────────────────────

type GrowSig = ReturnType<typeof createSignal<number>>;

type Branch = {
  start: Vector2;
  end: Vector2;
  ctrl: Vector2;
  startW: number;
  endW: number;
  isTip: boolean;
  seed: number;
  depth: number;
  grow: GrowSig;
};

const MAX_DEPTH        = 8;
const BASE_LENGTH      = 240;
const BASE_WIDTH       = 38;
const WITHIN_TAPER     = 0.62;
const TIP_RATIO        = 0.55;
const BRANCH_ANGLE_MIN = 18;
const BRANCH_ANGLE_MAX = 38;
const LEN_SCALE_MIN    = 0.62;
const LEN_SCALE_MAX    = 0.78;
const CURVE_AMOUNT     = 0.22;
const KEEP_PROB        = 0.92;
const ROOT_X           = 0;
const ROOT_Y           = 480;
const N_SAMPLES        = 36;        // higher = smoother stroke

const STROKE_FILL = 'rgba(248, 244, 238, 0.97)';
const BLEED_FILL  = 'rgba(170, 152, 132, 0.42)';
const BLEED_OFFSET_PX = 3;
const BLEED_INFLATE  = 1.18;        // bleed is slightly wider than stroke

const WOBBLE_AMPLITUDE_BASE = 0.9;   // px — minimum jitter
const WOBBLE_AMPLITUDE_TIP  = 2.4;   // px — extra jitter near the tip (drier brush)

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smoothed pseudo-noise from a sum of sines — deterministic per seed.
function pnoise(t: number, seed: number): number {
  return (
    Math.sin(t * 4.73 + seed * 1.0) * 0.55 +
    Math.sin(t * 9.31 + seed * 1.7) * 0.30 +
    Math.sin(t * 17.1 + seed * 2.3) * 0.15
  );
}

// Brush pressure as a function of position along the stroke.
//   t ∈ [0,1]:
//     0..0.10  — quick ramp-up from 70% to full (touch-down)
//     0.10..0.65 — sustained at full
//     0.65..1.0 — taper to tipFactor (sharp lift if isTip)
function pressure(t: number, isTip: boolean): number {
  const tipFactor = isTip ? 0.0 : 0.45;
  if (t < 0.10) {
    const u = t / 0.10;
    return 0.70 + 0.30 * (1 - (1 - u) * (1 - u));
  }
  if (t < 0.65) {
    return 1.0;
  }
  const u = (t - 0.65) / 0.35;
  return 1.0 - (1.0 - tipFactor) * (u * u);
}

// Sample the stroke into a closed polygon up to `growT`. `widthScale` and
// `offsetN` let us reuse the same geometry for the bleed layer.
function strokeShape(
  start: Vector2,
  end: Vector2,
  ctrl: Vector2,
  startW: number,
  endW: number,
  isTip: boolean,
  seed: number,
  growT: number,
  widthScale: number,
  offsetN: number,                 // perpendicular shift in px (for bleed)
): Vector2[] {
  if (growT <= 0) return [start, start];
  const top: Vector2[] = [];
  const bot: Vector2[] = [];

  for (let i = 0; i <= N_SAMPLES; i++) {
    const localT = i / N_SAMPLES;
    const t = localT * growT;
    const u = 1 - t;

    const px = start.x * u * u + ctrl.x * 2 * u * t + end.x * t * t;
    const py = start.y * u * u + ctrl.y * 2 * u * t + end.y * t * t;

    const tx = (ctrl.x - start.x) * 2 * u + (end.x - ctrl.x) * 2 * t;
    const ty = (ctrl.y - start.y) * 2 * u + (end.y - ctrl.y) * 2 * t;
    const tlen = Math.max(0.0001, Math.sqrt(tx * tx + ty * ty));
    const nx = -ty / tlen;
    const ny =  tx / tlen;

    // Per-side wobble — different seeds so the two sides of the brush
    // don't move in lockstep.
    const tipBoost = WOBBLE_AMPLITUDE_BASE +
      (WOBBLE_AMPLITUDE_TIP - WOBBLE_AMPLITUDE_BASE) * Math.max(0, t - 0.5) * 2;
    const wobTop = pnoise(t * 6, seed) * tipBoost;
    const wobBot = pnoise(t * 6, seed + 91.7) * tipBoost;

    const nominalW = (startW + (endW - startW) * t) * pressure(t, isTip) * widthScale;
    const halfTop = nominalW / 2 + wobTop;
    const halfBot = nominalW / 2 + wobBot;

    // Optional perpendicular shift (bleed layer drifts to one side)
    const ox = nx * offsetN;
    const oy = ny * offsetN;

    top.push(new Vector2(px + nx * halfTop + ox, py + ny * halfTop + oy));
    bot.push(new Vector2(px - nx * halfBot + ox, py - ny * halfBot + oy));
  }
  return [...top, ...bot.reverse()];
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  const treeRoot = createRef<Node>();
  view.add(<Node ref={treeRoot} />);

  const rand = mulberry32(53);
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

    // Curved control point — random perpendicular bend.
    const perpX = -dirY;
    const perpY =  dirX;
    const bend = (rand() - 0.5) * 2 * CURVE_AMOUNT * length;
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const ctrl = new Vector2(midX + perpX * bend, midY + perpY * bend);

    const isTip = depth === MAX_DEPTH;
    const startW = baseWidth;
    const endW = isTip ? 0.0 : Math.max(0.4, baseWidth * WITHIN_TAPER);

    const grow = createSignal(0);
    const seed = rand() * 1000;

    branchesByDepth[depth].push({
      start, end, ctrl, startW, endW, isTip, seed, depth, grow,
    });

    if (depth === MAX_DEPTH) return;

    const tiltL = -(BRANCH_ANGLE_MIN + rand() * (BRANCH_ANGLE_MAX - BRANCH_ANGLE_MIN));
    const tiltR = +(BRANCH_ANGLE_MIN + rand() * (BRANCH_ANGLE_MAX - BRANCH_ANGLE_MIN));
    const lenL = length * (LEN_SCALE_MIN + rand() * (LEN_SCALE_MAX - LEN_SCALE_MIN));
    const lenR = length * (LEN_SCALE_MIN + rand() * (LEN_SCALE_MAX - LEN_SCALE_MIN));
    const childBase = endW * (TIP_RATIO + (rand() - 0.5) * 0.04);

    if (rand() < KEEP_PROB) spawn(end, parentAngleDeg + tiltL, lenL, childBase, depth + 1);
    if (rand() < KEEP_PROB) spawn(end, parentAngleDeg + tiltR, lenR, childBase, depth + 1);
  };

  spawn(new Vector2(ROOT_X, ROOT_Y), 0, BASE_LENGTH, BASE_WIDTH, 0);

  // Render: bleed layer first (under), stroke layer on top.
  for (let d = 0; d <= MAX_DEPTH; d++) {
    for (const b of branchesByDepth[d]) {
      // Pick bleed direction deterministically from seed so it's stable.
      const bleedDir = b.seed % 2 === 0 ? +BLEED_OFFSET_PX : -BLEED_OFFSET_PX;

      // Bleed layer
      treeRoot().add(
        <Line
          points={() => strokeShape(
            b.start, b.end, b.ctrl, b.startW, b.endW, b.isTip, b.seed,
            b.grow(), BLEED_INFLATE, bleedDir,
          )}
          closed
          fill={BLEED_FILL}
          lineWidth={0}
        />,
      );
      // Main stroke
      treeRoot().add(
        <Line
          points={() => strokeShape(
            b.start, b.end, b.ctrl, b.startW, b.endW, b.isTip, b.seed,
            b.grow(), 1.0, 0,
          )}
          closed
          fill={STROKE_FILL}
          lineWidth={0}
        />,
      );
    }
  }

  // Animate: trunk slow and deliberate, branches faster, twigs near-instant.
  for (let depth = 0; depth <= MAX_DEPTH; depth++) {
    const layer = branchesByDepth[depth];
    if (layer.length === 0) continue;
    const dur = depth === 0 ? 1.1 : Math.max(0.14, 0.55 - depth * 0.05);
    const ease = depth === 0 ? easeInOutCubic : easeOutCubic;
    yield* all(...layer.map(b => b.grow(1, dur, ease)));
  }

  yield* waitFor(2);
});
