import {makeScene2D, Txt, Node} from '@motion-canvas/2d';
import {createRef, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Fonts} from '../core/theme';

// Chapter-2 title card — same idiom as problemsYouDontHaveLieIntroSceneEn:
// muted "CHAPTER 2" eyebrow above, bold letter-spaced title below, staggered
// fade-in then fade-out as one block.
const CHAPTER_FONT_SIZE = 40;
const TITLE_FONT_SIZE = 72;
const TEXT_COLOR = 'rgba(244, 241, 235, 0.95)';
const MUTED = 'rgba(244, 241, 235, 0.6)';

export default makeScene2D(function* (view) {
  applyBackground(view);

  const container = createRef<Node>();
  const chapterRef = createRef<Txt>();
  const titleRef = createRef<Txt>();

  view.add(
    <Node ref={container} opacity={0}>
      <Txt
        ref={chapterRef}
        text={'CHAPTER 2'}
        fontFamily={Fonts.primary}
        fontWeight={500}
        fontSize={CHAPTER_FONT_SIZE}
        letterSpacing={18}
        fill={MUTED}
        y={-60}
        opacity={0}
      />
      <Txt
        ref={titleRef}
        text={'EARN THE ABSTRACTION'}
        fontFamily={Fonts.primary}
        fontWeight={700}
        fontSize={TITLE_FONT_SIZE}
        letterSpacing={16}
        fill={TEXT_COLOR}
        y={30}
        opacity={0}
      />
    </Node>,
  );

  yield* container().opacity(1, 0);

  yield* chapterRef().opacity(1, 0.8, easeInOutCubic);
  yield* waitFor(0.8);

  yield* titleRef().opacity(1, 0.7, easeInOutCubic);
  yield* waitFor(3);

  yield* container().opacity(0, 1.2, easeInOutCubic);
  yield* waitFor(0.3);
});
