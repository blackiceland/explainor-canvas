import {blur, makeScene2D} from '@motion-canvas/2d';
import {SimpleSignal, ThreadGenerator, all, createSignal, waitFor} from '@motion-canvas/core';
import {Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';
import {
  CODE,
  CODE_CARD_STYLE,
  CODE_FONT,
  CODE_LH,
  CODE_W,
  COLOR_RULES,
  CUSTOM_TYPES,
  LINE,
} from './messageDeliveryShared';

// Sequential focus by blur — no accent colours, no opacity dim. Each
// boolean takes a turn: its sig line and the body block it controls
// stay sharp while every other line goes out of focus (gaussian blur).
// "In focus" frames the gesture as attention, not execution.

const BLUR_OUT = 6;
const HOLD     = 2.2;
const FADE     = 0.55;

type Range = readonly [number, number];

export default makeScene2D(function* (view) {
  applyBackground(view);

  const code = Manticore.create(CODE, {
    x: 0,
    y: 0,
    width: CODE_W,
    fontSize: CODE_FONT,
    lineHeight: CODE_LH,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    customTypes: CUSTOM_TYPES,
  });
  code.mount(view);
  code.colorize(COLOR_RULES);

  const blurs: SimpleSignal<number>[] = [];
  for (let i = 0; i < code.lineCount; i++) {
    const sig = createSignal(0);
    blurs.push(sig);
    const line = code.getLine(i);
    if (line) line.node.filters(() => [blur(sig())]);
  }

  function* focusRanges(keep: Range[], duration: number): ThreadGenerator {
    const anims: ThreadGenerator[] = [];
    for (let i = 0; i < blurs.length; i++) {
      const inRange = keep.some(([a, b]) => i >= a && i <= b);
      anims.push(blurs[i](inRange ? 0 : BLUR_OUT, duration));
    }
    yield* all(...anims);
  }

  yield* code.appear(0.7);
  yield* waitFor(0.6);

  yield* focusRanges(
    [[LINE.sigDryRun, LINE.sigDryRun], LINE.zoneDryRun],
    FADE,
  );
  yield* waitFor(HOLD);

  yield* focusRanges(
    [[LINE.sigForceSend, LINE.sigForceSend], LINE.zoneForceSend],
    FADE,
  );
  yield* waitFor(HOLD);

  yield* focusRanges(
    [[LINE.sigIsRetry, LINE.sigIsRetry], LINE.zoneIsRetry],
    FADE,
  );
  yield* waitFor(HOLD + 1.0);
});
