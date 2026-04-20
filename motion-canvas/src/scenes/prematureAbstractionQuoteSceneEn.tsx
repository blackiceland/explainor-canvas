import {makeScene2D, Txt} from '@motion-canvas/2d';
import {all, createRef, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Colors, Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

const QUOTE = `“The wrong abstraction is far more costly\nthan no abstraction at all.”`;

export default makeScene2D(function* (view) {
  applyBackground(view);

  const hero = createRef<Txt>();
  const quote = createRef<Txt>();
  const attribution = createRef<Txt>();
  const typed = createSignal('');

  view.add(
    <Txt
      ref={hero}
      fontFamily={Fonts.primary}
      fontSize={140}
      fontWeight={500}
      fill={Colors.text.primary}
      letterSpacing={-3}
      textAlign="center"
      y={-200}
      opacity={0}
    >
      Premature abstraction.
    </Txt>,
  );

  view.add(
    <Txt
      ref={quote}
      text={typed}
      fontFamily={Fonts.code}
      fontSize={44}
      fontWeight={400}
      fill={Colors.text.primary}
      textAlign="center"
      width={1500}
      lineHeight={60}
      y={-20}
      offset={[0, -1]}
      opacity={1}
    />,
  );

  view.add(
    <Txt
      ref={attribution}
      fontFamily={Fonts.primary}
      fontSize={42}
      fontWeight={500}
      fill={Colors.accent}
      textAlign="center"
      y={195}
      opacity={0}
    >
      – Sandi Metz
    </Txt>,
  );

  // Hero first
  yield* hero().opacity(1, 1.3, easeInOutCubic);
  yield* waitFor(0.8);

  // Typewriter reveal
  for (let i = 0; i <= QUOTE.length; i++) {
    typed(QUOTE.slice(0, i));
    const ch = QUOTE[i] ?? '';
    const dt =
      ch === '\n' ? 0.22 :
      ch === ' ' ? 0.035 :
      /[“”".,:;!?—–]/.test(ch) ? 0.09 :
      0.032;
    yield* waitFor(dt);
  }

  yield* waitFor(0.5);

  // Attribution after the quote is done
  yield* attribution().opacity(1, 0.9, easeInOutCubic);
  yield* waitFor(3.2);

  yield* all(
    hero().opacity(0, Timing.slow, easeInOutCubic),
    quote().opacity(0, Timing.slow, easeInOutCubic),
    attribution().opacity(0, Timing.slow, easeInOutCubic),
  );
  yield* waitFor(0.3);
});
