import {makeScene2D, Txt} from '@motion-canvas/2d';
import {all, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Fonts, Screen, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

/** English quote, same rhythm as smallMethodsProblemsSubtitlesSceneRu: one beat per line, then clear. */
const SUBTITLES = [
  'The most common mistake in code',
  "isn't bugs.",
  "It's code that solves problems",
  "you don't have.",
] as const;

const MARGIN = 0.18;
const SAFE_W = Screen.width * (0.5 - MARGIN);
const SAFE_H = Screen.height * (0.5 - MARGIN);

const TOP_LEFTS: [number, number][] = [
  [-SAFE_W * 0.55, -SAFE_H * 0.52],
  [ SAFE_W * 0.10, -SAFE_H * 0.14],
  [ SAFE_W * 0.05,  SAFE_H * 0.18],
  [-SAFE_W * 0.15 + 380,  SAFE_H * 0.52],
];

const FONT_SIZES = [54, 62, 54, 62] as const;

const FILL_A = 'rgba(232, 207, 174, 0.96)';
const FILL_B = 'rgba(244, 241, 235, 0.92)';

export default makeScene2D(function* (view) {
  applyBackground(view);

  yield* waitFor(2);

  const durationIn = 0.5;
  const durationOut = 0.7;
  const hold = 1.45;

  const FILLS = [FILL_A, FILL_B, FILL_A, FILL_B];

  const texts: Txt[] = [];

  for (let i = 0; i < SUBTITLES.length; i++) {
    const [left, top] = TOP_LEFTS[i];
    const txt = new Txt({
      text: SUBTITLES[i],
      fontFamily: Fonts.code,
      fontSize: FONT_SIZES[i],
      fill: FILLS[i],
      textAlign: 'left',
      topLeft: [left, top],
      opacity: 0,
    });
    view.add(txt);
    texts.push(txt);

    yield* txt.opacity(1, durationIn, easeInOutCubic);
    if (i < SUBTITLES.length - 1) {
      yield* waitFor(hold);
    }
  }

  yield* waitFor(0.85);
  yield* all(...texts.map((t) => t.opacity(0, durationOut, easeInOutCubic)));
  yield* waitFor(Timing.normal);
});
