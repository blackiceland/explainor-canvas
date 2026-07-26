import {makeScene2D, Node, Path, Rect, blur} from '@motion-canvas/2d';
import {createRef, easeInOutCubic, linear, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {TITLE_LINES} from './nullTitleGlyphs';

// Титул «Your null / means too much» — РИСУЕТСЯ КАК РУКОЙ (запрос автора: рисовка
// рукой, НЕ тайпинг). Связный каллиграфический курсив (PinyonScript, запечён в
// контуры) проявляется чернильным пером слева направо: на СВЯЗНОМ письме это
// читается как ведущая строку рука, а не typewriter.
//
// ⚠️ «Перо, а не вайп»: фронт проявления РАЗМЫТ (blur на маске) → чернила
// натекают из-под пера мягкой кромкой, а не рубленым вертикальным столбцом
// (именно рубленый край и делал эффект «печатанием»). Скорость ровная — рука
// ведёт линию с одинаковым нажимом.
//
// Механика: СТРОКА = ОДИН залитый Path (fill CREAM, БЕЗ обводки — обводка
// контурного шрифта рисует ПЕРИМЕТР буквы = точки/пустые контуры), в кэш-ячейке
// (Node cache) + один маск-Rect compositeOperation:'destination-in', растущий по
// ширине. destination-in режет строку к дорисованному; blur даёт мягкий фронт.
//
// ⚠️⚠️ Path НЕ авто-центрируется В ОТРИСОВКЕ (Curve.offsetComputedLayout влияет
// лишь на layout-режим, Shape.drawShape рисует с ОРИГИНОМ БЕЙКА в позиции узла)
// → строку центрируем САМИ: ячейка x=-inkCx. Интерлиньяж и центровку выводим ИЗ
// запечённых ink-метрик (baseline y=0 у всех строк) → база ПРЯМАЯ и не зависит
// от кегля/шрифта. (Жёстко зашитые PITCH/TITLE_Y под другой кегль как раз и
// клали буквы «немного криво» — здесь их нет.) Сменил шрифт = только перепёк.

const CREAM = 'rgba(244, 241, 235, 0.96)';
const LINE_SPACE = 16;                 // воздух между строками поверх высоты ink
const PEN_SPEED = 700;                 // px/сек — ровная скорость руки
const LINE_GAP = 0.2;                  // перо переходит на новую строку
const HOLD = 2.6;
const MASK_PAD = 48;                   // запас фронта под курсивные свесы
const BLUR_FRONT = 15;                 // мягкая чернильная кромка пера (не рубленый край)

// Метрики из ink запечённых строк (baseline y=0 у всех) → центрируем блок сами.
const N = TITLE_LINES.length;
const LINE_H = Math.max(...TITLE_LINES.map(l => l.inkY2 - l.inkY1));
const PITCH = LINE_H + LINE_SPACE;
const baseY = (li: number) => (li - (N - 1) / 2) * PITCH;
const TOP = Math.min(...TITLE_LINES.map((l, li) => baseY(li) + l.inkY1));
const BOT = Math.max(...TITLE_LINES.map((l, li) => baseY(li) + l.inkY2));
const TITLE_Y = -(TOP + BOT) / 2;

export default makeScene2D(function* (view) {
  applyBackground(view);

  const titleNode = createRef<Node>();
  view.add(<Node ref={titleNode} y={TITLE_Y} />);

  // Одна кэш-ячейка на строку: строка-контур + мягкий чернильный маск-фронт.
  const lineMasks: {mask: Rect; w: number}[] = [];
  TITLE_LINES.forEach((line, li) => {
    const inkCx = (line.inkX1 + line.inkX2) / 2;      // центр ink в baked-координатах
    const inkW = line.inkX2 - line.inkX1;
    const inkMidY = (line.inkY1 + line.inkY2) / 2;
    // Центрируем строку целиком (сдвиг ячейки на -inkCx). Path рисует baked-
    // координаты с оригином в позиции узла — авто-центрирования в отрисовке нет.
    const lineCell = new Node({x: -inkCx, y: baseY(li), cache: true});
    lineCell.add(new Path({data: line.d, x: 0, y: 0, fill: CREAM}));
    const mask = new Rect({
      offsetX: -1,                       // якорь = левый край ink строки (baked)
      x: line.inkX1 - MASK_PAD,
      y: inkMidY,
      width: 0,
      height: (line.inkY2 - line.inkY1) + MASK_PAD * 4, // с запасом: blur не заденет верх/низ ink
      fill: '#fff',
      filters: [blur(BLUR_FRONT)],       // ⚠️ мягкая кромка → чернила натекают, не рубят
      compositeOperation: 'destination-in',
    });
    lineCell.add(mask);
    titleNode().add(lineCell);
    // Перелёт на BLUR_FRONT*2, чтобы последняя буква добралась до полной непрозрачности.
    lineMasks.push({mask, w: inkW + MASK_PAD * 2 + BLUR_FRONT * 2});
  });

  yield* waitFor(0.8);

  // Перо ведёт строки по очереди ровным нажимом.
  for (const {mask, w} of lineMasks) {
    yield* mask.width(w, w / PEN_SPEED, linear);
    yield* waitFor(LINE_GAP);
  }

  yield* waitFor(HOLD);
  yield* titleNode().opacity(0, 0.8, easeInOutCubic);
  yield* waitFor(0.4);
});
