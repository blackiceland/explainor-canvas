import {makeScene2D, Txt} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Fonts, Screen, Timing} from '../core/theme';
import {SafeZone} from '../core/ScreenGrid';
import {textWidth} from '../core/utils/textMeasure';

const QUOTE = `“Duplication is cheaper than the wrong abstraction.”\n— Sandi Metz`;

export default makeScene2D(function* (view) {
  applyBackground(view);

  const typed = createSignal('');
  const textOn = createSignal(1);
  const cursorOpacity = createSignal(1);

  const fontSize = 44;
  const lineHeight = 58;
  const fontWeight = 400;
  const fill = '#F6E7D4';

  const x = SafeZone.left + 140;
  const width = SafeZone.right - SafeZone.left - 280;
  const y = -40;

  view.add(
    <>
      <Txt
        x={x}
        y={y}
        width={width}
        text={typed}
        fontFamily={Fonts.code}
        fontSize={fontSize}
        lineHeight={lineHeight}
        fontWeight={fontWeight}
        fill={fill}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={textOn}
      />
      <Txt
        x={() => {
          const lines = typed().split('\n');
          const last = lines[lines.length - 1] ?? '';
          return x + textWidth(last, Fonts.code, fontSize, fontWeight);
        }}
        y={() => {
          const lines = typed().split('\n');
          const idx = Math.max(0, lines.length - 1);
          return y + idx * lineHeight;
        }}
        text={'▍'}
        fontFamily={Fonts.code}
        fontSize={fontSize}
        lineHeight={lineHeight}
        fontWeight={fontWeight}
        fill={fill}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={() => cursorOpacity()}
      />
    </>,
  );

  yield* waitFor(0.35);

  // Typewriter: simple per-character reveal.
  for (let i = 0; i <= QUOTE.length; i++) {
    typed(QUOTE.slice(0, i));
    const ch = QUOTE[i] ?? '';
    const dt =
      ch === '\n' ? 0.09 :
      ch === ' ' ? 0.02 :
      /[“”"—–.,:;!?]/.test(ch) ? 0.05 :
      0.024;
    yield* waitFor(dt);
  }

  // Culmination:
  // - Cursor keeps blinking ~5s
  // - Text fades out smoothly
  // - Cursor continues blinking on empty space
  // - Cursor fades out at the very end
  yield* waitFor(0.35);

  const blink = function* (seconds: number) {
    const step = 0.26;
    let t = 0;
    while (t < seconds) {
      yield* cursorOpacity(0, step, easeInOutCubic);
      t += step;
      if (t >= seconds) break;
      yield* cursorOpacity(1, step, easeInOutCubic);
      t += step;
    }
  };

  yield* all(
    textOn(0, 1.25, easeInOutCubic),
    blink(5.0),
  );

  yield* cursorOpacity(0, 0.7, easeInOutCubic);

  yield* waitFor(Timing.slow);
});







