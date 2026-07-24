import {makeScene2D, Txt} from '@motion-canvas/2d';
import {easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// Закрывающая кода главы 2 — рамка к титулу главы: тот же титульный голос
// (Fonts.primary, caps, letter-spacing), что у chapter2EarnAbstractionSceneEn,
// нежно-розовый. Экран НЕ дублирует озвучку — два постера-тезиса по очереди,
// каждый проявляется КАК ОДНО (без постадийных строк). Вывод из конкретного
// HandlingProfile в общий принцип.
// VO поверх: "This may not be the final design. It is simply the smallest
// abstraction the evidence supports today. That is how you earn an
// abstraction: let the change arrive, see what moves together, and
// extract only that."
const TITLE_FONT_SIZE = 72;
const TITLE_LINE_HEIGHT = 104;
const SOFT_PINK = 'rgba(236, 189, 200, 0.95)';

const THESIS = 'THE SMALLEST ABSTRACTION\nTHE EVIDENCE SUPPORTS';
const PRINCIPLE = 'CHANGE ARRIVES\nTHE SHAPE EMERGES\nABSTRACTION FOLLOWS';

function makeCard(text: string): Txt {
  return new Txt({
    text,
    fontFamily: Fonts.primary,
    fontWeight: 700,
    fontSize: TITLE_FONT_SIZE,
    lineHeight: TITLE_LINE_HEIGHT,
    letterSpacing: 16,
    fill: SOFT_PINK,
    textAlign: 'center',
    x: 0,
    y: 0,
    opacity: 0,
  });
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  yield* waitFor(1.0);

  const thesis = makeCard(THESIS);
  view.add(thesis);
  yield* thesis.opacity(1, 0.5, easeInOutCubic);
  yield* waitFor(4.4);
  yield* thesis.opacity(0, 0.4, easeInOutCubic);
  yield* waitFor(0.15);

  const principle = makeCard(PRINCIPLE);
  view.add(principle);
  yield* principle.opacity(1, 0.6, easeInOutCubic);
  yield* waitFor(5.4);
  yield* principle.opacity(0, 0.6, easeInOutCubic);
  yield* waitFor(0.5);
});
