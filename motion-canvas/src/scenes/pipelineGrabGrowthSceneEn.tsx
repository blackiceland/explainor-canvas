import {makeScene2D, Circle, Line, Node, Txt} from '@motion-canvas/2d';
import {
  all, createRef, easeInOutCubic, easeOutCubic, waitFor,
} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Colors, Fonts} from '../core/theme';

// ── Palette ────────────────────────────────────────────────────────────
const ACCENT = '#2563eb';                            // rich deep blue
const ACCENT_DIM = 'rgba(37,99,235,0.12)';
const LINE_COLOR = 'rgba(255,255,255,0.10)';
const TEXT_DIM = Colors.text.muted;
const TEXT_BRIGHT = Colors.text.primary;

// Gentle per-node tints: [stroke, fill, dot]
const NODE_TINTS: [string, string, string][] = [
  ['rgba(139,160,196,0.28)', 'rgba(139,160,196,0.04)', 'rgba(139,160,196,0.30)'],
  ['rgba(37,99,235,0.28)',   'rgba(37,99,235,0.04)',   'rgba(37,99,235,0.30)'],
  ['rgba(125,191,160,0.28)', 'rgba(125,191,160,0.04)', 'rgba(125,191,160,0.30)'],
  ['rgba(139,160,196,0.28)', 'rgba(139,160,196,0.04)', 'rgba(139,160,196,0.30)'],
  ['rgba(164,139,191,0.28)', 'rgba(164,139,191,0.04)', 'rgba(164,139,191,0.30)'],
];

// ── Layout ─────────────────────────────────────────────────────────────
const STEPS = ['move', 'grab', 'lift', 'move', 'release'] as const;
const GAP = 280;
const NODE_R = 42;
const START_X = -GAP * (STEPS.length - 1) / 2;
const Y = 0;

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ═══════════════════════════════════════════════════════════════════════
  // BUILD
  // ═══════════════════════════════════════════════════════════════════════
  const root = createRef<Node>();
  view.add(<Node ref={root} opacity={0} />);

  const circles: ReturnType<typeof createRef<Circle>>[] = [];
  const labels: ReturnType<typeof createRef<Txt>>[] = [];
  const dots: ReturnType<typeof createRef<Circle>>[] = [];
  const connectors: ReturnType<typeof createRef<Line>>[] = [];

  for (let i = 0; i < STEPS.length; i++) {
    const cx = START_X + i * GAP;

    if (i > 0) {
      const ref = createRef<Line>();
      root().add(
        <Line
          ref={ref}
          points={[[cx - GAP + NODE_R + 14, Y], [cx - NODE_R - 14, Y]]}
          stroke={LINE_COLOR}
          lineWidth={1.5}
          opacity={0}
          end={0}
        />,
      );
      connectors.push(ref);
    }

    const cRef = createRef<Circle>();
    root().add(
      <Circle
        ref={cRef}
        x={cx} y={Y}
        size={NODE_R * 2}
        stroke={NODE_TINTS[i][0]}
        lineWidth={1.5}
        fill={NODE_TINTS[i][1]}
        opacity={0}
      />,
    );
    circles.push(cRef);

    const dRef = createRef<Circle>();
    root().add(
      <Circle
        ref={dRef}
        x={cx} y={Y}
        size={8}
        fill={NODE_TINTS[i][2]}
        opacity={0}
      />,
    );
    dots.push(dRef);

    const lRef = createRef<Txt>();
    root().add(
      <Txt
        ref={lRef}
        text={STEPS[i]}
        x={cx} y={Y + NODE_R + 32}
        fontFamily={Fonts.code}
        fontSize={22}
        fill={TEXT_DIM}
        opacity={0}
      />,
    );
    labels.push(lRef);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 1: Pipeline fades in
  // ═══════════════════════════════════════════════════════════════════════
  yield* root().opacity(1, 0);

  for (let i = 0; i < STEPS.length; i++) {
    const dur = 0.35;
    const anims = [
      circles[i]().opacity(1, dur, easeOutCubic),
      dots[i]().opacity(1, dur, easeOutCubic),
      labels[i]().opacity(1, dur, easeOutCubic),
    ];
    if (i > 0) {
      anims.push(
        connectors[i - 1]().opacity(1, dur * 0.5),
        connectors[i - 1]().end(1, dur, easeOutCubic),
      );
    }
    yield* all(...anims);
    if (i < STEPS.length - 1) yield* waitFor(0.08);
  }

  yield* waitFor(1.2);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2: Grab brightens
  // ═══════════════════════════════════════════════════════════════════════
  const GRAB_IDX = 1;
  const grabX = START_X + GRAB_IDX * GAP;

  yield* all(
    circles[GRAB_IDX]().stroke(ACCENT, 0.6, easeInOutCubic),
    circles[GRAB_IDX]().fill(ACCENT_DIM, 0.6, easeInOutCubic),
    dots[GRAB_IDX]().fill(ACCENT, 0.4, easeInOutCubic),
    labels[GRAB_IDX]().fill(TEXT_BRIGHT, 0.6, easeInOutCubic),
  );

  yield* waitFor(1.0);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 3: Blue circle spreads from grab
  // ═══════════════════════════════════════════════════════════════════════
  const growCircle = createRef<Circle>();
  root().add(
    <Circle
      ref={growCircle}
      x={grabX} y={Y}
      size={0}
      fill={ACCENT}
    />,
  );
  growCircle().moveToBottom();

  const dimAnims: any[] = [];
  for (let i = 0; i < STEPS.length; i++) {
    if (i === GRAB_IDX) continue;
    dimAnims.push(
      circles[i]().opacity(0.18, 3.0, easeInOutCubic),
      dots[i]().opacity(0.18, 3.0, easeInOutCubic),
      labels[i]().opacity(0.18, 3.0, easeInOutCubic),
    );
  }
  for (const c of connectors) dimAnims.push(c().opacity(0.08, 3.0, easeInOutCubic));

  yield* all(
    growCircle().size(800, 3.5, easeInOutCubic),
    ...dimAnims,
  );

  yield* labels[GRAB_IDX]().fontSize(34, 0.5, easeInOutCubic);

  yield* waitFor(2.0);

  // ═══════════════════════════════════════════════════════════════════════
  // FADE OUT
  // ═══════════════════════════════════════════════════════════════════════
  yield* root().opacity(0, 1.2, easeInOutCubic);
  yield* waitFor(0.5);
});
