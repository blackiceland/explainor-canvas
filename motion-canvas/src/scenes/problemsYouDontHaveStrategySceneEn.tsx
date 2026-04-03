import {makeScene2D, Txt, Rect, Node, Layout} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Colors, Fonts} from '../core/theme';

const ACCENT = Colors.accent;
const TEXT = Colors.text.primary;
const BAR_COLOR = 'rgba(255,140,163,0.8)';

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ── Phase 1: grab(cube) ──────────────────────────────────────────────
  const grabRef = createRef<Txt>();
  view.add(
    <Txt
      ref={grabRef}
      text={'grab(cube)'}
      fontFamily={Fonts.code}
      fontSize={64}
      fill={TEXT}
      opacity={0}
    />,
  );

  yield* grabRef().opacity(1, 0.6, easeInOutCubic);
  yield* waitFor(1.4);
  yield* grabRef().y(-180, 0.7, easeInOutCubic);

  // ── Phase 2: Strategy list ────────────────────────────────────────────
  const listNode = createRef<Node>();
  view.add(<Node ref={listNode} opacity={0} />);

  const ITEMS = [
    {name: 'StandardGrab', y: -30},
    {name: 'SoftGrab', y: 40},
    {name: 'FirmGrab', y: 110},
  ];

  const barRef = createRef<Rect>();
  const itemRefs: ReturnType<typeof createRef<Txt>>[] = [];

  listNode().add(
    <Rect
      ref={barRef}
      x={-230}
      y={ITEMS[0].y}
      width={6}
      height={42}
      radius={3}
      fill={BAR_COLOR}
      opacity={0}
    />,
  );

  for (const item of ITEMS) {
    const ref = createRef<Txt>();
    listNode().add(
      <Txt
        ref={ref}
        text={item.name}
        fontFamily={Fonts.code}
        fontSize={40}
        fill={TEXT}
        y={item.y}
        opacity={0}
      />,
    );
    itemRefs.push(ref);
  }

  yield* listNode().opacity(1, 0);

  yield* all(
    itemRefs[0]().opacity(0.18, 0.4, easeInOutCubic),
    itemRefs[1]().opacity(0.18, 0.4, easeInOutCubic),
    itemRefs[2]().opacity(0.18, 0.4, easeInOutCubic),
    barRef().opacity(1, 0.4, easeInOutCubic),
  );

  // → StandardGrab
  yield* itemRefs[0]().opacity(1, 0.2, easeInOutCubic);
  yield* waitFor(0.25);

  // → SoftGrab
  yield* all(
    barRef().y(ITEMS[1].y, 0.3, easeInOutCubic),
    itemRefs[0]().opacity(0.18, 0.3, easeInOutCubic),
    itemRefs[1]().opacity(1, 0.3, easeInOutCubic),
  );
  yield* waitFor(0.25);

  // → FirmGrab
  yield* all(
    barRef().y(ITEMS[2].y, 0.3, easeInOutCubic),
    itemRefs[1]().opacity(0.18, 0.3, easeInOutCubic),
    itemRefs[2]().opacity(1, 0.3, easeInOutCubic),
  );
  yield* waitFor(0.25);

  // → back to StandardGrab
  yield* all(
    barRef().y(ITEMS[0].y, 0.3, easeInOutCubic),
    itemRefs[2]().opacity(0.18, 0.3, easeInOutCubic),
    itemRefs[0]().opacity(1, 0.3, easeInOutCubic),
  );

  yield* waitFor(1.5);

  // ── Phase 3: Transform grab(cube) → grabStrategy.grab(cube) ──────────

  // Decomposed line at same position — prefix starts empty so it looks
  // identical to the single-text "grab(cube)"
  const transformLine = createRef<Layout>();
  const prefixRef = createRef<Txt>();
  const verbRef = createRef<Txt>();
  const argsRef = createRef<Txt>();

  view.add(
    <Layout
      ref={transformLine}
      layout
      direction={'row'}
      gap={0}
      y={-180}
      opacity={0}
    >
      <Txt ref={prefixRef} text={''} fontFamily={Fonts.code} fontSize={64} fill={ACCENT} />
      <Txt ref={verbRef} text={'grab'} fontFamily={Fonts.code} fontSize={64} fill={TEXT} />
      <Txt ref={argsRef} text={'(cube)'} fontFamily={Fonts.code} fontSize={64} fill={TEXT} />
    </Layout>,
  );

  // Fade list, swap single text for decomposed layout
  yield* listNode().opacity(0, 0.5, easeInOutCubic);
  grabRef().opacity(0);
  transformLine().opacity(1);

  yield* waitFor(0.3);

  // "grab" morphs into "StandardGrab" — the verb becomes a named strategy
  yield* verbRef().text('StandardGrab', 0.4);
  yield* waitFor(0.5);

  // Flash through alternatives (dim → swap → brighten)
  yield* verbRef().opacity(0.3, 0.1);
  verbRef().text('SoftGrab');
  yield* verbRef().opacity(0.8, 0.1);
  yield* waitFor(0.2);

  yield* verbRef().opacity(0.3, 0.1);
  verbRef().text('FirmGrab');
  yield* verbRef().opacity(0.8, 0.1);
  yield* waitFor(0.2);

  // Settle back to "grab"
  yield* verbRef().opacity(0.3, 0.1);
  verbRef().text('grab');
  yield* verbRef().opacity(1, 0.15);

  yield* waitFor(0.4);

  // Prefix types in — "grabStrategy." pushes grab(cube) to the right
  yield* prefixRef().text('grabStrategy.', 0.7, easeInOutCubic);

  // Settle to center
  yield* transformLine().y(0, 0.5, easeInOutCubic);

  yield* waitFor(1.8);

  yield* transformLine().opacity(0, 0.8, easeInOutCubic);
  yield* waitFor(0.3);
});
