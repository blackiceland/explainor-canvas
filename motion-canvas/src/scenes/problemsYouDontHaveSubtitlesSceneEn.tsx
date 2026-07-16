import {makeScene2D, Txt} from '@motion-canvas/2d';
import {easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// Стартовые титры главы //03 (premature abstraction). Канон открытия главы —
// chapter1YudanSceneEn PHASE 1: те же «X isn't Y. It's Z.» два предложения
// показываются ДВУМЯ битами по очереди в одном центре — первое приходит,
// держится, уходит; второе приходит на то же место. Один шрифт (Fonts.code,
// НЕ титульный sans), один тёплый беж, один кегль, без курсива. Разница между
// битами только временная (выплата держится дольше), не цветом/наклоном.
const QUOTE_FONT = 60;
const QUOTE_BEIGE = 'rgba(232, 207, 174, 0.96)';

const SETUP = "The most common mistake in code isn't bugs.";
const PAYOFF = "It's code that solves problems you don't have.";

export default makeScene2D(function* (view) {
  applyBackground(view);

  yield* waitFor(2);

  const setup = new Txt({
    text: SETUP,
    fontFamily: Fonts.code,
    fontSize: QUOTE_FONT,
    fill: QUOTE_BEIGE,
    textAlign: 'center',
    x: 0,
    y: 0,
    opacity: 0,
  });
  view.add(setup);

  yield* setup.opacity(1, 0.4, easeInOutCubic);
  yield* waitFor(2.4);
  yield* setup.opacity(0, 0.4, easeInOutCubic);
  yield* waitFor(0.1);

  const payoff = new Txt({
    text: PAYOFF,
    fontFamily: Fonts.code,
    fontSize: QUOTE_FONT,
    fill: QUOTE_BEIGE,
    textAlign: 'center',
    x: 0,
    y: 0,
    opacity: 0,
  });
  view.add(payoff);

  yield* payoff.opacity(1, 0.4, easeInOutCubic);
  yield* waitFor(3.7);
  yield* payoff.opacity(0, 0.5, easeInOutCubic);
  yield* waitFor(0.6);
});
