import {makeScene2D, Txt, Rect, Node} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Colors, Fonts} from '../core/theme';

const ACCENT = Colors.accent;
const TEXT = Colors.text.primary;
const GHOST = 'rgba(255,255,255,0.18)';
const BAR_COLOR = 'rgba(255,140,163,0.8)';

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ── Phase 1: "Strategy" ───────────────────────────────────────────────
  const titleRef = createRef<Txt>();
  view.add(
    <Txt
      ref={titleRef}
      text={'Strategy'}
      fontFamily={Fonts.code}
      fontSize={96}
      fill={ACCENT}
      opacity={0}
    />,
  );

  yield* titleRef().opacity(0.85, 1.0, easeInOutCubic);
  yield* waitFor(1.5);
  yield* titleRef().opacity(0, 0.8, easeInOutCubic);
  yield* waitFor(0.4);

  // ── Phase 2: grab(cube) ───────────────────────────────────────────────
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

  // ── Phase 3: Strategy list ────────────────────────────────────────────
  const listNode = createRef<Node>();
  view.add(<Node ref={listNode} opacity={0} />);

  const ITEMS = [
    {name: 'StandardGrab', active: true,  y: -30},
    {name: 'SoftGrab',     active: false, y:  40},
    {name: 'FirmGrab',     active: false, y: 110},
  ];

  const barRef = createRef<Rect>();
  const itemRefs: ReturnType<typeof createRef<Txt>>[] = [];

  // accent bar for active item
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
        fontSize={item.active ? 44 : 36}
        fill={item.active ? TEXT : GHOST}
        y={item.y}
        opacity={0}
      />,
    );
    itemRefs.push(ref);
  }

  yield* listNode().opacity(1, 0);

  // active item + bar
  yield* all(
    itemRefs[0]().opacity(1, 0.5, easeInOutCubic),
    barRef().opacity(1, 0.5, easeInOutCubic),
  );
  yield* waitFor(0.4);

  // ghost items
  yield* all(
    itemRefs[1]().opacity(1, 0.6, easeInOutCubic),
    itemRefs[2]().opacity(1, 0.6, easeInOutCubic),
  );

  yield* waitFor(2.5);

  // ── Phase 4: Collapse into strategy call ──────────────────────────────
  const stratRef = createRef<Txt>();
  view.add(
    <Txt
      ref={stratRef}
      text={'grabStrategy.grab(cube)'}
      fontFamily={Fonts.code}
      fontSize={56}
      fill={TEXT}
      opacity={0}
    />,
  );

  yield* all(
    grabRef().opacity(0, 0.6, easeInOutCubic),
    listNode().opacity(0, 0.6, easeInOutCubic),
  );

  yield* stratRef().opacity(1, 0.5, easeInOutCubic);
  yield* waitFor(1.8);

  yield* stratRef().opacity(0, 0.8, easeInOutCubic);
  yield* waitFor(0.3);
});
