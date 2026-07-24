import {makeScene2D, Txt} from '@motion-canvas/2d';
import {easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// Мост-вопрос перед главой 2. Канон эпиграфа — problemsYouDontHaveSubtitlesSceneEn:
// Fonts.code, один тёплый беж, один кегль, по центру, без курсива. Здесь один бит.
// Кегль 54, не 60: строка 52 знака, моно-набор при 60 шире кадра (1872px > 1920).
const QUOTE_FONT = 54;
const QUOTE_BEIGE = 'rgba(232, 207, 174, 0.96)';

const QUESTION = "So how do you know when you're preparing for change?";

export default makeScene2D(function* (view) {
  applyBackground(view);

  yield* waitFor(1.2);

  const question = new Txt({
    text: QUESTION,
    fontFamily: Fonts.code,
    fontSize: QUOTE_FONT,
    fill: QUOTE_BEIGE,
    textAlign: 'center',
    x: 0,
    y: 0,
    opacity: 0,
  });
  view.add(question);

  yield* question.opacity(1, 0.4, easeInOutCubic);
  yield* waitFor(3.4);
  yield* question.opacity(0, 0.5, easeInOutCubic);
  yield* waitFor(0.6);
});
