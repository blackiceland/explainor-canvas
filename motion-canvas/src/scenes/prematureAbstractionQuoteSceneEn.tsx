import {makeScene2D, Txt} from '@motion-canvas/2d';
import {all, createRef, easeInCubic, easeInOutCubic, easeOutCubic, waitFor} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// Current-design attributed-quote idiom (matches the tracer-bullet quote in
// chapter2ReversibilitySceneEn): one warm cream for the whole block, quote set
// in Space Grotesk italic, attribution roman in the SAME cream — no accent
// color — and plain opacity fades instead of the old typewriter reveal.
const CREAM = 'rgba(244, 230, 200, 0.96)';
const TITLE_CREAM = 'rgba(244, 241, 235, 0.95)';

const QUOTE = '“The wrong abstraction is far more costly\nthan no abstraction at all.”';

export default makeScene2D(function* (view) {
  applyBackground(view);

  const title = createRef<Txt>();
  const quote = createRef<Txt>();
  const attribution = createRef<Txt>();

  view.add(
    <Txt
      ref={title}
      text="Premature abstraction."
      fontFamily={Fonts.primary}
      fontSize={128}
      fontWeight={500}
      letterSpacing={-3}
      fill={TITLE_CREAM}
      textAlign="center"
      y={-250}
      opacity={0}
    />,
  );

  view.add(
    <Txt
      ref={quote}
      text={QUOTE}
      fontFamily={Fonts.primary}
      fontStyle="italic"
      fontSize={50}
      fontWeight={400}
      letterSpacing={0.6}
      fill={CREAM}
      textAlign="center"
      width={1500}
      lineHeight={72}
      y={35}
      opacity={0}
    />,
  );

  view.add(
    <Txt
      ref={attribution}
      text="– Sandi Metz"
      fontFamily={Fonts.primary}
      fontSize={34}
      fontWeight={400}
      letterSpacing={0.5}
      fill={CREAM}
      textAlign="center"
      y={225}
      opacity={0}
    />,
  );

  // Title lands first, then the quote and attribution arrive as clean fades.
  yield* title().opacity(1, 1.1, easeOutCubic);
  yield* waitFor(0.5);
  yield* quote().opacity(1, 1.0, easeInOutCubic);
  yield* waitFor(0.5);
  yield* attribution().opacity(1, 0.8, easeInOutCubic);
  yield* waitFor(3.4);

  yield* all(
    title().opacity(0, 0.9, easeInCubic),
    quote().opacity(0, 0.9, easeInCubic),
    attribution().opacity(0, 0.9, easeInCubic),
  );
  yield* waitFor(0.3);
});
