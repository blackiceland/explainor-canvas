import {makeScene2D, Node, Path, Rect} from '@motion-canvas/2d';
import {createRef, easeInOutCubic, linear, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {TITLE_LINES} from './nullTitleGlyphs';

// Титул видео «Your null / means too much» (строчными, лирический курсив
// Playfair Display Italic). Запрос автора: буквы должны РИСОВАТЬСЯ, чисто и БЕЗ
// наездов/скачков над базовой линией.
//
// Механика: КАЖДАЯ СТРОКА — один залитый контур (обводки нет: обводка контурного
// шрифта рисует периметр буквы = точки/пустые контуры). «Письмо» = один
// чернильный фронт вдоль строки: в кэш-ячейке маска-Rect (destination-in) растёт
// слева направо (PEN_SPEED px/с, linear), в любой момент недорисована ТОЛЬКО
// буква на кромке пера.
//
// ⚠️⚠️ ПОЧЕМУ ОДНА СТРОКА = ОДИН path (а не по буквам): Motion Canvas Path
// авто-центрирует СВОЙ bbox (по контрольным точкам), а не ink-bbox шрифта. При
// по-буквенном позиционировании каждая буква сдвигалась на свою разницу этих
// bbox → буквы НАЕЗЖАЛИ и ПРЫГАЛИ над строкой. В одном path позиции букв
// впечатаны в координаты (пекутся в bake.mjs), авто-центрируется строка целиком.
//
// ⚠️ Буквы = запечённые контуры (nullTitleGlyphs.ts), НЕ живой шрифт → рендер
// не зависит от FontFace. Сменить шрифт = перепечь scratchpad/otbake/bake.mjs.

const CREAM = 'rgba(244, 241, 235, 0.96)';
const PITCH = 196;                    // межстрочный
const TITLE_Y = 62;                   // компенсация верхнего выноса

const PEN_SPEED = 760;                // px/сек — ровная скорость пера (одинакова на обеих строках)
const LINE_GAP = 0.18;               // перо переходит на новую строку
const HOLD = 2.6;
const MASK_PAD = 44;                  // запас фронта на курсивные свесы

export default makeScene2D(function* (view) {
  applyBackground(view);

  const titleNode = createRef<Node>();
  view.add(<Node ref={titleNode} y={TITLE_Y} />);

  // Одна кэш-ячейка на строку: строка-контур + общий маск-фронт.
  const n = TITLE_LINES.length;
  const lineMasks: {mask: Rect; w: number}[] = [];
  TITLE_LINES.forEach((line, li) => {
    const baseY = (li - (n - 1) / 2) * PITCH;
    const inkCx = (line.inkX1 + line.inkX2) / 2;      // центр ink строки в baked-координатах
    const inkW = line.inkX2 - line.inkX1;
    // ⚠️ Path рисует baked-координаты С ОРИГИНОМ В ПОЗИЦИИ УЗЛА (авто-центрирования
    // в отрисовке НЕТ — offsetComputedLayout влияет лишь на layout-режим). Значит
    // центрируем строку сами: сдвигаем ячейку на -inkCx. (Прежняя по-буквенная
    // компенсация cx/cy как раз и была багом — двигала каждую букву на её центр →
    // наезды и скачки над линией.)
    const lineCell = new Node({x: -inkCx, y: baseY, cache: true});
    lineCell.add(new Path({data: line.d, x: 0, y: 0, fill: CREAM}));
    const mask = new Rect({
      offsetX: -1,                       // якорь = левый край ink строки (в baked-координатах)
      x: line.inkX1 - MASK_PAD,
      y: 0,
      width: 0,
      height: 520,                       // с запасом — destination-in клипит к буквам
      fill: '#fff',
      compositeOperation: 'destination-in',
    });
    lineCell.add(mask);
    titleNode().add(lineCell);
    lineMasks.push({mask, w: inkW + MASK_PAD * 2});
  });

  yield* waitFor(0.8);

  // Перо ведёт строки по очереди с ровной скоростью.
  for (const {mask, w} of lineMasks) {
    yield* mask.width(w, w / PEN_SPEED, linear);
    yield* waitFor(LINE_GAP);
  }

  yield* waitFor(HOLD);
  yield* titleNode().opacity(0, 0.8, easeInOutCubic);
  yield* waitFor(0.4);
});
