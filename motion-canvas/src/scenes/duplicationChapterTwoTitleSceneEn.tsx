import {makeScene2D, Node, Txt} from '@motion-canvas/2d';
import {easeInOutCubic, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Fonts} from '../core/theme';

// ── DON'T FIGHT DUPLICATION · карточка главы 2 ──────────────────────────────
// Разделитель между колбами и главой 2. Название — дословно как на второй
// колбе, «Sync cost»: зритель узнаёт вопрос из отступления и сам ищет, где
// разошлись копии (решение автора, 27.09).
//
// Типографика — ВЕРБАТИМ карточка главы 1 (duplicationChapterOneTitleSceneEn),
// а та — карточка главы из nullMeansChapter2En: кегли 40/72, трекинг 18/16,
// смещения −60/+30, вес 500/700, простой фейд. Карточка обязана читаться одним и
// тем же объектом, иначе она перестаёт быть разделителем.
//
// ⚠️ ОБЕ СТРОКИ ПРИХОДЯТ ОДНОВРЕМЕННО: прозрачность ведётся на общей ноде.
const CHAPTER_FS = 40;
const TITLE_FS = 72;
const CARD_INK = 'rgba(244, 241, 235, 0.95)';
const CARD_MUTED = 'rgba(244, 241, 235, 0.6)';
const CARD_WAIT = 0.4;               // вдох на пустом фоне после ухода колб
const CARD_IN = 1.0;
const CARD_HOLD = 1.5;
const CARD_OUT = 1.2;
const CARD_GAP = 0.4;                // тьма под монтажный стык с POV

export default makeScene2D(function* (view) {
  applyBackground(view);

  const eyebrow = new Txt({
    text: 'CHAPTER 2',
    fontFamily: Fonts.primary,
    fontWeight: 500,
    fontSize: CHAPTER_FS,
    letterSpacing: 18,
    fill: CARD_MUTED,
    y: -60,
  });
  const title = new Txt({
    text: 'SYNC COST',
    fontFamily: Fonts.primary,
    fontWeight: 700,
    fontSize: TITLE_FS,
    letterSpacing: 16,
    fill: CARD_INK,
    y: 30,
  });
  const card = new Node({opacity: 0});
  card.add(eyebrow);
  card.add(title);
  view.add(card);

  yield* waitFor(CARD_WAIT);
  yield* card.opacity(1, CARD_IN, easeInOutCubic);
  yield* waitFor(CARD_HOLD);
  yield* card.opacity(0, CARD_OUT, easeInOutCubic);
  yield* waitFor(CARD_GAP);
});
