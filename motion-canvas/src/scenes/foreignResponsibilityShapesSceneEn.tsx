import {Circle, makeScene2D, Node, Rect, Txt} from '@motion-canvas/2d';
import {
  all,
  chain,
  createRef,
  createSignal,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  easeOutElastic,
  linear,
  waitFor,
} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// ── Palette ───────────────────────────────────────────────────────
const GRAB_COLOR    = 'rgba(100, 180, 255, 0.85)';   // calm blue
const GRAB_BORDER   = 'rgba(100, 180, 255, 0.35)';
const FOREIGN_COLOR = '#FF9F43';                       // orange — outputs
const RULES_COLOR   = '#FF4757';                       // red — rules
const TEXT_MUTED    = 'rgba(244, 241, 235, 0.5)';
const TEXT_DIM      = 'rgba(244, 241, 235, 0.25)';

// ── Layout ────────────────────────────────────────────────────────
const MEMBRANE_R = 200;
const DOT_R = 14;

// grab's own operations — positioned inside the circle
const OWN_OPS = [
  {label: 'approach',  x: -60,  y: -50},
  {label: 'close',     x:  40,  y: -20},
  {label: 'lockWrist', x: -20,  y:  50},
];

// foreign outputs — start outside, drift in
const FOREIGN_OPS = [
  {label: 'MotionProfile', x: -70, y: 10,  startX: -380, startY: -80},
  {label: 'Orientation',   x:  50, y: 60,  startX:  350, startY: -60},
];

// foreign rules — start further out, more alarming shapes
const RULES_OPS = [
  {label: 'isDelicate()',    x: -90, y: -10, startX: -420, startY: -180},
  {label: 'hasLooseParts()', x:  20, y:  80, startX:  380, startY:  160},
  {label: 'requiresFixed()', x:  70, y: -40, startX:  400, startY: -140},
];

export default makeScene2D(function* (view) {
  applyBackground(view);

  const root = createRef<Node>();
  view.add(<Node ref={root} />);

  // ── Membrane circle ─────────────────────────────────────────────
  const membraneScaleX = createSignal(1);
  const membraneScaleY = createSignal(1);
  const membrane = createRef<Circle>();
  root().add(
    <Circle
      ref={membrane}
      width={MEMBRANE_R * 2}
      height={MEMBRANE_R * 2}
      stroke={GRAB_BORDER}
      lineWidth={2}
      fill={'rgba(100, 180, 255, 0.04)'}
      opacity={0}
      scaleX={() => membraneScaleX()}
      scaleY={() => membraneScaleY()}
    />,
  );

  // ── Label ───────────────────────────────────────────────────────
  const grabLabel = createRef<Txt>();
  root().add(
    <Txt
      ref={grabLabel}
      text="grab()"
      y={MEMBRANE_R + 40}
      fontFamily={Fonts.primary}
      fontWeight={700}
      fontSize={28}
      letterSpacing={2}
      fill={TEXT_MUTED}
      opacity={0}
    />,
  );

  // ── Own operations (blue dots) ──────────────────────────────────
  const ownDots = OWN_OPS.map(() => createRef<Circle>());
  const ownLabels = OWN_OPS.map(() => createRef<Txt>());
  for (let i = 0; i < OWN_OPS.length; i++) {
    const op = OWN_OPS[i];
    root().add(
      <Circle
        ref={ownDots[i]}
        x={op.x} y={op.y}
        width={DOT_R * 2} height={DOT_R * 2}
        fill={GRAB_COLOR}
        opacity={0}
      />,
    );
    root().add(
      <Txt
        ref={ownLabels[i]}
        text={op.label}
        x={op.x} y={op.y + DOT_R + 14}
        fontFamily={Fonts.code}
        fontSize={12}
        fill={TEXT_DIM}
        opacity={0}
      />,
    );
  }

  // ── Foreign output shapes (orange squares) ──────────────────────
  const foreignRefs = FOREIGN_OPS.map(() => createRef<Rect>());
  const foreignLabels = FOREIGN_OPS.map(() => createRef<Txt>());
  for (let i = 0; i < FOREIGN_OPS.length; i++) {
    const op = FOREIGN_OPS[i];
    root().add(
      <Rect
        ref={foreignRefs[i]}
        x={op.startX} y={op.startY}
        width={22} height={22}
        fill={FOREIGN_COLOR}
        radius={3}
        opacity={0}
        rotation={45}
      />,
    );
    root().add(
      <Txt
        ref={foreignLabels[i]}
        text={op.label}
        x={op.startX} y={op.startY + 24}
        fontFamily={Fonts.code}
        fontSize={12}
        fill={FOREIGN_COLOR}
        opacity={0}
      />,
    );
  }

  // ── Foreign rule shapes (red diamonds, larger) ──────────────────
  const rulesRefs = RULES_OPS.map(() => createRef<Rect>());
  const rulesLabels = RULES_OPS.map(() => createRef<Txt>());
  for (let i = 0; i < RULES_OPS.length; i++) {
    const op = RULES_OPS[i];
    root().add(
      <Rect
        ref={rulesRefs[i]}
        x={op.startX} y={op.startY}
        width={28} height={28}
        fill={RULES_COLOR}
        radius={2}
        opacity={0}
        rotation={45}
      />,
    );
    root().add(
      <Txt
        ref={rulesLabels[i]}
        text={op.label}
        x={op.startX} y={op.startY + 28}
        fontFamily={Fonts.code}
        fontSize={12}
        fill={RULES_COLOR}
        opacity={0}
      />,
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // Act 1 — membrane + own operations appear
  // ═══════════════════════════════════════════════════════════════
  yield* all(
    membrane().opacity(1, 0.8, easeOutCubic),
    grabLabel().opacity(1, 0.8, easeOutCubic),
  );
  yield* all(
    ...ownDots.map((d, i) =>
      chain(waitFor(i * 0.15), all(
        d().opacity(1, 0.4, easeOutCubic),
        ownLabels[i]().opacity(1, 0.4, easeOutCubic),
      )),
    ),
  );
  yield* waitFor(1.5);

  // ═══════════════════════════════════════════════════════════════
  // Act 2 — foreign outputs appear outside, then drift into membrane
  // ═══════════════════════════════════════════════════════════════
  // Appear outside
  yield* all(
    ...foreignRefs.map((r, i) => chain(
      waitFor(i * 0.2),
      all(
        r().opacity(1, 0.4, easeOutCubic),
        foreignLabels[i]().opacity(1, 0.4, easeOutCubic),
      ),
    )),
  );
  yield* waitFor(0.6);

  // Drift through the membrane
  yield* all(
    ...foreignRefs.map((r, i) => all(
      r().x(FOREIGN_OPS[i].x, 1.2, easeInOutCubic),
      r().y(FOREIGN_OPS[i].y, 1.2, easeInOutCubic),
      r().rotation(0, 1.2, easeInOutCubic),
    )),
    ...foreignLabels.map((l, i) => all(
      l().x(FOREIGN_OPS[i].x, 1.2, easeInOutCubic),
      l().y(FOREIGN_OPS[i].y + 24, 1.2, easeInOutCubic),
      l().opacity(0, 0.5, easeInCubic),
    )),
  );

  // Membrane flickers on penetration
  yield* all(
    membrane().stroke(FOREIGN_COLOR, 0.15, linear),
    membrane().lineWidth(3, 0.15, linear),
  );
  yield* all(
    membrane().stroke(GRAB_BORDER, 0.3, easeOutCubic),
    membrane().lineWidth(2, 0.3, easeOutCubic),
  );

  yield* waitFor(1.2);

  // ═══════════════════════════════════════════════════════════════
  // Act 3 — foreign rules appear and invade
  // ═══════════════════════════════════════════════════════════════
  yield* all(
    ...rulesRefs.map((r, i) => chain(
      waitFor(i * 0.2),
      all(
        r().opacity(1, 0.4, easeOutCubic),
        rulesLabels[i]().opacity(1, 0.4, easeOutCubic),
      ),
    )),
  );
  yield* waitFor(0.6);

  // Rules push in — membrane deforms
  yield* all(
    ...rulesRefs.map((r, i) => all(
      r().x(RULES_OPS[i].x, 1.0, easeInOutCubic),
      r().y(RULES_OPS[i].y, 1.0, easeInOutCubic),
    )),
    ...rulesLabels.map((l, i) => all(
      l().x(RULES_OPS[i].x, 1.0, easeInOutCubic),
      l().y(RULES_OPS[i].y + 28, 1.0, easeInOutCubic),
      l().opacity(0, 0.4, easeInCubic),
    )),
    // membrane deforms under pressure
    membraneScaleX(1.25, 1.0, easeInOutCubic),
    membraneScaleY(0.85, 1.0, easeInOutCubic),
    membrane().stroke(RULES_COLOR, 0.8, easeInOutCubic),
    membrane().lineWidth(2.5, 0.8, easeInOutCubic),
  );

  // Membrane flickers hard
  yield* membrane().lineWidth(4, 0.1, linear);
  yield* membrane().lineWidth(2.5, 0.2, easeOutCubic);

  yield* waitFor(1.5);

  // ═══════════════════════════════════════════════════════════════
  // Act 4 — settle: membrane stays deformed, label dims
  // ═══════════════════════════════════════════════════════════════
  yield* all(
    grabLabel().fill(TEXT_DIM, 0.6, easeInOutCubic),
    membrane().fill('rgba(255, 71, 87, 0.06)', 0.6, easeInOutCubic),
  );
  yield* waitFor(1.5);

  // ═══════════════════════════════════════════════════════════════
  // Act 5 — fade
  // ═══════════════════════════════════════════════════════════════
  yield* root().opacity(0, 0.9, easeInCubic);
  yield* waitFor(0.3);
});
