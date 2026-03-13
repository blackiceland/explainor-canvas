import {makeScene2D, Txt} from '@motion-canvas/2d';
import {all, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Fonts, Screen, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

const SUBTITLES = [
  'pass-through methods',
  'long call chains',
  'wrappers with no logic',
  'naming explosion',
  'bloated stack traces',
] as const;

const MARGIN = 0.18;
const SAFE_W = Screen.width * (0.5 - MARGIN);
const SAFE_H = Screen.height * (0.5 - MARGIN);

function shuffledPositions(): [number, number][] {
  const positions: [number, number][] = [
    [-SAFE_W * 0.70, -SAFE_H * 0.72],
    [SAFE_W * 0.68, -SAFE_H * 0.65],
    [-SAFE_W * 0.72, SAFE_H * 0.28 - 180],
    [SAFE_W * 0.72, SAFE_H * 0.28],
    [0, SAFE_H * 0.78],
  ];
  const shuffle = [2, 0, 4, 1, 3];
  return shuffle.map((i) => positions[i]);
}

const FONT_SIZE = 72;
const CODE_FILL = 'rgba(232, 207, 174, 0.96)';

export default makeScene2D(function* (view) {
  applyBackground(view);

  yield* waitFor(2);

  const durationIn = 0.5;
  const durationOut = 0.7;
  const hold = 1.4;

  const positions = shuffledPositions();
  const texts: Txt[] = [];

  for (let i = 0; i < SUBTITLES.length; i++) {
    const [x, y] = positions[i];
    const txt = new Txt({
      text: SUBTITLES[i],
      fontFamily: Fonts.code,
      fontSize: FONT_SIZE,
      fill: CODE_FILL,
      x,
      y,
      opacity: 0,
    });
    view.add(txt);
    texts.push(txt);

    yield* txt.opacity(1, durationIn, easeInOutCubic);
    yield* waitFor(hold);
  }

  yield* waitFor(0.8);
  yield* all(...texts.map((t) => t.opacity(0, durationOut, easeInOutCubic)));
  yield* waitFor(Timing.normal);
});
