import {makeScene2D, Txt, Rect, Node} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Fonts, Screen} from '../core/theme';

export default makeScene2D(function* (view) {
  applyBackground(view);

  const container = createRef<Node>();
  const bg = createRef<Rect>();

  const BLOOD_RED = 'rgba(120, 10, 10, 0.95)';
  const TEXT_COLOR = 'rgba(244, 241, 235, 0.95)';
  const JACK_RED = 'rgba(230, 60, 60, 0.95)';
  const MUTED = 'rgba(244, 241, 235, 0.55)';

  const chapterRef = createRef<Txt>();
  const theCodeRef = createRef<Txt>();
  const thatRef = createRef<Txt>();
  const jackRef = createRef<Txt>();
  const builtRef = createRef<Txt>();

  view.add(
    <Node ref={container} opacity={0}>
      <Rect
        ref={bg}
        width={Screen.width}
        height={Screen.height}
        fill={BLOOD_RED}
        opacity={0}
      />
      <Txt
        ref={chapterRef}
        text={'CHAPTER 1'}
        fontFamily={Fonts.primary}
        fontWeight={500}
        fontSize={24}
        letterSpacing={14}
        fill={MUTED}
        y={-120}
        opacity={0}
      />
      <Txt
        ref={theCodeRef}
        text={'THE CODE'}
        fontFamily={Fonts.primary}
        fontWeight={700}
        fontSize={96}
        letterSpacing={20}
        fill={TEXT_COLOR}
        y={-40}
        opacity={0}
      />
      <Txt
        ref={thatRef}
        text={'THAT'}
        fontFamily={Fonts.primary}
        fontWeight={500}
        fontSize={24}
        letterSpacing={14}
        fill={MUTED}
        y={32}
        opacity={0}
      />
      <Txt
        ref={jackRef}
        text={'JACK'}
        fontFamily={Fonts.primary}
        fontWeight={700}
        fontSize={96}
        letterSpacing={20}
        fill={JACK_RED}
        y={108}
        opacity={0}
      />
      <Txt
        ref={builtRef}
        text={'BUILT'}
        fontFamily={Fonts.primary}
        fontWeight={500}
        fontSize={24}
        letterSpacing={14}
        fill={MUTED}
        y={180}
        opacity={0}
      />
    </Node>,
  );

  yield* container().opacity(1, 0);

  yield* chapterRef().opacity(1, 0.8, easeInOutCubic);
  yield* waitFor(0.6);

  yield* theCodeRef().opacity(1, 0.6, easeInOutCubic);
  yield* waitFor(0.5);

  yield* thatRef().opacity(1, 0.5, easeInOutCubic);
  yield* waitFor(0.3);

  yield* all(
    jackRef().opacity(1, 0.4, easeInOutCubic),
    bg().opacity(0.08, 0.3, easeInOutCubic),
  );
  yield* bg().opacity(0, 1.0, easeInOutCubic);

  yield* waitFor(0.3);
  yield* builtRef().opacity(1, 0.5, easeInOutCubic);

  yield* waitFor(3);

  yield* container().opacity(0, 1.2, easeInOutCubic);
  yield* waitFor(0.3);
});
