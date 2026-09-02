import {makeScene2D, Node, Txt} from '@motion-canvas/2d';
import {easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';
import {mountVignette} from '../core/components/SoftVignette';

// ── DON'T FIGHT DUPLICATION · эпиграф ──────────────────────────────────────
// Первые 4.53 с видео. Канон открытия nullMeansIntroSceneEn: моноширинный
// бежевый эпиграф, проявляется как одно целое, стоит, уходит. Никакого
// движения — говорит голос, кадр только держит фразу.
//
// VO: «Removing duplication is one of the first reflexes we learn as
//      programmers.»
//
// Фон — обычный графит проекта плюс мягкая круговая виньетка. Ни подсветки
// центра, ни зерна: на титре фон обязан быть ровным. Та же виньетка стоит в
// начале chargingHeroDemoScene и гаснет там на отъезде камеры — так две
// сцены читаются одним кадром.

const FS = 60;                        // канон эпиграфа
const CW = FS * 0.6;                  // advance JetBrains Mono = ровно 0.6em
const LH = 92;
const BEIGE = 'rgba(232, 207, 174, 0.96)';

// Разбито по фразам, а не по ширине: каждая строка — законченный кусок речи.
// Одной строкой фраза не живёт: 74 знака в каноничном кегле дают 2664 px, а
// ужать её до 38-го кегля значит потерять именно то, что делает эпиграф
// эпиграфом, — размер. Три коротких строки сохраняют и кегль, и дыхание.
const LINES = [
  'Removing duplication',
  'is one of the first reflexes',
  'we learn as programmers.',
];

const T_IN = 0.7;
const T_HOLD = 3.15;
const T_OUT = 0.6;
const T_END = 4.53;

export default makeScene2D(function* (view) {
  applyBackground(view);

  const quote = new Node({opacity: 0});
  view.add(quote);
  LINES.forEach((t, i) => quote.add(new Txt({
    x: -(t.length * CW) / 2,
    y: (i - (LINES.length - 1) / 2) * LH,
    text: t,
    offset: [-1, 0],
    fontFamily: Fonts.code,
    fontSize: FS,
    fill: BEIGE,
  })));

  mountVignette(view);

  yield* quote.opacity(1, T_IN, easeInOutCubic);
  yield* waitFor(T_HOLD);
  yield* quote.opacity(0, T_OUT, easeInOutCubic);
  yield* waitFor(Math.max(0, T_END - T_IN - T_HOLD - T_OUT));
});
