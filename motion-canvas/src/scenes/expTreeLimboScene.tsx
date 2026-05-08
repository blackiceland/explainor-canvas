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
// LIMBO-style tree: white silhouette growing in foggy darkness, with
// `true` / `false` labels appearing at every fork as the branches split.
// Atmosphere = radial fog + drifting motes + vignette. No lighting, no
// textures, no detailed shading — pure shape on atmospheric ground.
// ─────────────────────────────────────────────────────────────────────────

type GrowSig = ReturnType<typeof createSignal<number>>;

type Branch = {
  start: Vector2;
  end: Vector2;
  ctrl: Vector2;
  startW: number;
  endW: number;
  isTip: boolean;
  depth: number;
  // null on the trunk (no parent fork); on children: which side it
  // came from (sets its label).
  label: 'true' | 'false' | null;
  grow: GrowSig;
};

const MAX_DEPTH        = 8;
const BASE_LENGTH      = 240;
const BASE_WIDTH       = 34;
const WITHIN_TAPER     = 0.66;
const TIP_RATIO        = 0.55;
const BRANCH_ANGLE_MIN = 18;
const BRANCH_ANGLE_MAX = 38;
const LEN_SCALE_MIN    = 0.62;
const LEN_SCALE_MAX    = 0.78;
const CURVE_AMOUNT     = 0.20;
const KEEP_PROB        = 0.92;
const ROOT_X           = 0;
const ROOT_Y           = 480;
const N_SAMPLES        = 28;

// Atmosphere
const BG_TOP    = '#0c0d10';
const BG_BOTTOM = '#06070a';
const FOG_COLOR = 'rgba(120, 130, 150, 0.08)';   // cool foggy haze
const TREE_FILL = 'rgba(244, 240, 234, 1.0)';
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

// Tapered closed-polygon ribbon along a quadratic bezier, drawn up to growT.
function strokeShape(
  start: Vector2,
  end: Vector2,
  ctrl: Vector2,
  startW: number,
  endW: number,
  growT: number,
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
    const w = startW + (endW - startW) * t;
    top.push(new Vector2(px + nx * w / 2, py + ny * w / 2));
    bot.push(new Vector2(px - nx * w / 2, py - ny * w / 2));
  }
  return [...top, ...bot.reverse()];
}

export default makeScene2D(function* (view) {
  // ── Atmosphere ───────────────────────────────────────────────────────
  const bgGradient = new Gradient({
    type: 'linear',
    from: new Vector2(0, -FOREST_H / 2),
    to: new Vector2(0, FOREST_H / 2),
    stops: [
      {offset: 0, color: BG_TOP},
      {offset: 1, color: BG_BOTTOM},
    ],
  });
  view.add(
    <Rect width={FOREST_W} height={FOREST_H} fill={bgGradient} />,
  );

  // Soft radial fog — three overlapping breath-like haze blobs.
  for (const fog of [
    {x: -200, y: 200, r: 700, op: 0.10},
    {x:  300, y:  50, r: 600, op: 0.07},
    {x: -100, y: -150, r: 500, op: 0.05},
  ]) {
    const fogGrad = new Gradient({
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
    });
    view.add(
      <Circle
        x={fog.x}
        y={fog.y}
        width={fog.r * 2}
        height={fog.r * 2}
        fill={fogGrad}
      />,
    );
  }

  // ── Tree generation ──────────────────────────────────────────────────
  const treeRoot = createRef<Node>();
  view.add(<Node ref={treeRoot} />);

  const labelLayer = createRef<Node>();
  view.add(<Node ref={labelLayer} />);

  const rand = mulberry32(17);
  const branchesByDepth: Branch[][] = [];
  for (let i = 0; i <= MAX_DEPTH; i++) branchesByDepth.push([]);
  const labels: {x: number; y: number; text: 'true' | 'false'; opacity: GrowSig}[] = [];

  const spawn = (
    start: Vector2,
    parentAngleDeg: number,
    length: number,
    baseWidth: number,
    depth: number,
    label: 'true' | 'false' | null,
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

    const isTip = depth === MAX_DEPTH;
    const startW = baseWidth;
    const endW = isTip ? 0.0 : Math.max(0.4, baseWidth * WITHIN_TAPER);

    const grow = createSignal(0);
    branchesByDepth[depth].push({
      start, end, ctrl, startW, endW, isTip, depth, label, grow,
    });

    if (depth === MAX_DEPTH) return;

    const tiltL = -(BRANCH_ANGLE_MIN + rand() * (BRANCH_ANGLE_MAX - BRANCH_ANGLE_MIN));
    const tiltR = +(BRANCH_ANGLE_MIN + rand() * (BRANCH_ANGLE_MAX - BRANCH_ANGLE_MIN));
    const lenL = length * (LEN_SCALE_MIN + rand() * (LEN_SCALE_MAX - LEN_SCALE_MIN));
    const lenR = length * (LEN_SCALE_MIN + rand() * (LEN_SCALE_MAX - LEN_SCALE_MIN));
    const childBase = endW * (TIP_RATIO + (rand() - 0.5) * 0.04);

    // Place a true/false label near the fork — only on the first three
    // generations, otherwise the canopy gets noisy.
    const showLabels = depth <= 2;

    if (rand() < KEEP_PROB) {
      spawn(end, parentAngleDeg + tiltL, lenL, childBase, depth + 1, 'true');
      if (showLabels) {
        const off = 28 + depth * 4;
        const lAngle = (parentAngleDeg + tiltL - 90) * Math.PI / 180;
        labels.push({
          x: end.x + Math.cos(lAngle) * off - 50,
          y: end.y + Math.sin(lAngle) * off,
          text: 'true',
          opacity: createSignal(0),
        });
      }
    }
    if (rand() < KEEP_PROB) {
      spawn(end, parentAngleDeg + tiltR, lenR, childBase, depth + 1, 'false');
      if (showLabels) {
        const off = 28 + depth * 4;
        const rAngle = (parentAngleDeg + tiltR - 90) * Math.PI / 180;
        labels.push({
          x: end.x + Math.cos(rAngle) * off + 50,
          y: end.y + Math.sin(rAngle) * off,
          text: 'false',
          opacity: createSignal(0),
        });
      }
    }
  };

  spawn(new Vector2(ROOT_X, ROOT_Y), 0, BASE_LENGTH, BASE_WIDTH, 0, null);

  // Render branches
  for (let d = 0; d <= MAX_DEPTH; d++) {
    for (const b of branchesByDepth[d]) {
      treeRoot().add(
        <Line
          points={() => strokeShape(
            b.start, b.end, b.ctrl, b.startW, b.endW, b.grow(),
          )}
          closed
          fill={TREE_FILL}
          lineWidth={0}
        />,
      );
    }
  }

  // Render labels
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

  // ── Drifting motes (LIMBO atmosphere) ────────────────────────────────
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
  const vignetteGrad = new Gradient({
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
  });
  view.add(
    <Rect width={FOREST_W} height={FOREST_H} fill={vignetteGrad} />,
  );

  // ── Animation ────────────────────────────────────────────────────────
  // Start motes drifting on a long loop in the background
  for (const sig of moteSigs) {
    sig(0);
  }
  const moteAnims = moteSigs.map(s => s(1, 14, easeInOutCubic));
  // Tree growth, generation by generation
  const growAnims = [];
  for (let depth = 0; depth <= MAX_DEPTH; depth++) {
    const layer = branchesByDepth[depth];
    if (layer.length === 0) continue;
    const dur = depth === 0 ? 1.1 : Math.max(0.16, 0.55 - depth * 0.05);
    growAnims.push(function* () {
      yield* all(...layer.map(b => b.grow(1, dur, easeOutCubic)));
      // After this layer's branches grow, fade in their `true`/`false`
      // labels (those rooted at the previous level's tips).
      if (depth >= 1 && depth <= 3) {
        const eligibleLabels = labels.filter(_ => true);
        // We can't precisely match labels to depth here without more
        // bookkeeping, so just fade labels in once when depth==2 hits.
        if (depth === 1) {
          yield* all(
            ...labels.slice(0, 2).map(l => l.opacity(1, 0.5, easeOutCubic)),
          );
        } else if (depth === 2) {
          yield* all(
            ...labels.slice(2, 6).map(l => l.opacity(1, 0.5, easeOutCubic)),
          );
        } else if (depth === 3) {
          yield* all(
            ...labels.slice(6).map(l => l.opacity(1, 0.5, easeOutCubic)),
          );
        }
      }
    }());
  }

  yield* all(
    ...moteAnims,
    (function* () {
      for (const anim of growAnims) {
        yield* anim;
      }
    })(),
  );

  yield* waitFor(2);
});
