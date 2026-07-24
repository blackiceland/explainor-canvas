import {Circle, makeScene2D, Node} from '@motion-canvas/2d';
import {
  all,
  createRef,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';

// ══════════════════════════════════════════════════════════════════════
// Chapter 2 take — "The change has drawn its own boundary."
// Mirror of the chapter-1 shapes scene, with the causality inverted:
// there the boundary existed first and foreign things were pulled into it;
// here the parts lie indistinguishable, a change passes through the field,
// three of them move TOGETHER — and only then a boundary quietly draws
// itself around the three that moved as one. The boundary comes last.
// Vocabulary: foreignResponsibilityShapesSceneEn (dots, hairline border,
// color = state). The three movers take the gold the code evidence wears.
// ══════════════════════════════════════════════════════════════════════

// ── Palette ───────────────────────────────────────────────────────
const PART_COLOR   = 'rgba(100, 180, 255, 0.85)';   // system parts, all alike
const GOLD         = 'rgba(255, 214, 140, 1.0)';    // the evidence accent
const GOLD_BORDER  = 'rgba(255, 214, 140, 0.45)';
const GOLD_FILL    = 'rgba(255, 214, 140, 0.05)';

const DOT_R = 22;

// ── Field ─────────────────────────────────────────────────────────
// Six parts that answer the change with a shiver and settle back.
const STILL_PARTS = [
  {x: -560, y: -180},
  {x: -430, y:  150},
  {x: -120, y: -230},
  {x:   60, y:  210},
  {x:  420, y: -160},
  {x:  610, y:  100},
];

// Three parts that answer the change the same way — and keep going.
// Scattered among the others at rest; nothing marks them in advance.
const MOVERS = [
  {x: -260, y:  60, toX: 140, toY: -10},
  {x:   30, y: -60, toX: 260, toY:  60},
  {x:  500, y: 240, toX: 190, toY: 110},
];

// The boundary is drawn around where the movers END UP, not planned ahead.
const BOUNDARY_X = 196;
const BOUNDARY_Y = 53;
const BOUNDARY_R = 150;

// The change sweeps left to right: each part is nudged in reading order,
// the nudge itself is the only trace the change leaves on screen.
const NUDGE_X = 30;
const NUDGE_Y = 8;
const SWEEP_SPAN = 0.9;          // stagger window across the field
const FIELD_MIN_X = -560;
const FIELD_MAX_X = 610;

const sweepDelay = (x: number) =>
  ((x - FIELD_MIN_X) / (FIELD_MAX_X - FIELD_MIN_X)) * SWEEP_SPAN;

export default makeScene2D(function* (view) {
  applyBackground(view);

  const root = createRef<Node>();
  view.add(<Node ref={root} />);

  const stillRefs = STILL_PARTS.map(() => createRef<Circle>());
  for (let i = 0; i < STILL_PARTS.length; i++) {
    const p = STILL_PARTS[i];
    root().add(
      <Circle
        ref={stillRefs[i]}
        x={p.x} y={p.y}
        width={DOT_R * 2} height={DOT_R * 2}
        fill={PART_COLOR}
        opacity={0}
      />,
    );
  }

  const moverRefs = MOVERS.map(() => createRef<Circle>());
  for (let i = 0; i < MOVERS.length; i++) {
    const p = MOVERS[i];
    root().add(
      <Circle
        ref={moverRefs[i]}
        x={p.x} y={p.y}
        width={DOT_R * 2} height={DOT_R * 2}
        fill={PART_COLOR}
        opacity={0}
      />,
    );
  }

  // Boundary arc — present from the start, invisible; drawn on last.
  const boundary = createRef<Circle>();
  root().add(
    <Circle
      ref={boundary}
      x={BOUNDARY_X} y={BOUNDARY_Y}
      width={BOUNDARY_R * 2} height={BOUNDARY_R * 2}
      stroke={GOLD_BORDER}
      lineWidth={3}
      lineCap={'round'}
      fill={'rgba(0,0,0,0)'}
      startAngle={-90}
      endAngle={-90}
      opacity={1}
    />,
  );

  // ── 1. The parts appear — indistinguishable, no grouping visible ──
  const everyDot = [...stillRefs, ...moverRefs];
  yield* all(
    ...everyDot.map((r, i) =>
      r().opacity(1, 0.9, easeInOutCubic).wait(i * 0.05),
    ),
  );
  yield* waitFor(1.1);

  // ── 2. A change passes through the field ──────────────────────────
  // The stills shiver and settle back; the movers take the same push
  // and keep going — the same answer, carried further. Gold rises
  // during the move: the difference exists only once the change acts.
  const shiver = (r: ReturnType<typeof createRef<Circle>>, x: number, y: number, delay: number) =>
    (function* () {
      yield* waitFor(delay);
      yield* r().position([x + NUDGE_X, y + NUDGE_Y], 0.32, easeOutCubic);
      yield* r().position([x, y], 0.55, easeInOutCubic);
    })();

  const carry = (r: ReturnType<typeof createRef<Circle>>, m: typeof MOVERS[number], delay: number) =>
    (function* () {
      yield* waitFor(delay);
      yield* all(
        r().position([m.toX, m.toY], 1.7, easeInOutCubic),
        r().fill(GOLD, 1.2, easeInOutCubic),
      );
    })();

  yield* all(
    ...STILL_PARTS.map((p, i) => shiver(stillRefs[i], p.x, p.y, sweepDelay(p.x))),
    ...MOVERS.map((m, i) => carry(moverRefs[i], m, sweepDelay(m.x))),
  );
  yield* waitFor(0.8);

  // ── 3. Only now: the boundary draws itself around what moved as one ─
  yield* boundary().endAngle(270, 1.3, easeInOutCubic);
  yield* boundary().fill(GOLD_FILL, 0.6, easeInOutCubic);
  // Тезис несёт озвучка; холд под закрывающую VO-строку (fantasy/plan).
  yield* waitFor(4.0);

  // ── Quiet exit ────────────────────────────────────────────────────
  yield* all(
    ...everyDot.map(r => r().opacity(0, 1.0, easeInOutCubic)),
    boundary().opacity(0, 1.0, easeInOutCubic),
  );
  yield* waitFor(0.3);
});
