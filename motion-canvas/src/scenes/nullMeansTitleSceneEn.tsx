import {makeScene2D, Node, Path} from '@motion-canvas/2d';
import {createRef, easeInOutCubic, linear, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {TITLE_LINES} from './nullTitleGlyphs';

// Титул «Your null / means too much» — НАСТОЯЩАЯ РИСОВКА ПЕРОМ (Playfair Display
// Italic). Перо ведёт растущую обводку ПО ОСЕВОЙ линии буквы (скелет глифа,
// end:0→1), а красивая залитая буква проявляется ВСЛЕД за пером. Это рисование,
// а не открывашка залитого глифа слева-направо.
//
// Механика: на строку — залитый Path (line.d, красивая буква) + Path-скелет
// (line.pen, осевая в порядке письма) толстой круглой обводкой как маска
// compositeOperation:'destination-in', end 0→1. Перо шириной NIB покрывает
// толстые штрихи Playfair; заливка режется к тому, что перо уже прошло.
//
// ⚠️ Скелет печётся в scratchpad/otbake/skelbake.mjs (растр→Zhang-Suen→трассировка).
// ⚠️ Path рисует baked-координаты с оригином в позиции узла (авто-центрирования в
// отрисовке нет) → строку центрируем сами (ячейка x=-inkCx). Метрики из ink.

const DEBUG = false;                   // true → показать осевую (скелет) поверх бледной заливки

const CREAM = 'rgba(244, 241, 235, 0.96)';
const LINE_SPACE = 20;
const PEN_SPEED = 540;                 // px/сек по видимой ширине строки (пейсинг)
const LINE_GAP = 0.22;
const HOLD = 2.6;
const NIB = 46;                        // ширина пера-маски (покрыть толстые штрихи)

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

  const pens: {pen: Path; dur: number}[] = [];
  TITLE_LINES.forEach((line, li) => {
    const inkCx = (line.inkX1 + line.inkX2) / 2;
    const inkW = line.inkX2 - line.inkX1;
    const cell = new Node({x: -inkCx, y: baseY(li), cache: !DEBUG});
    const fill = new Path({data: line.d, x: 0, y: 0, fill: CREAM, opacity: DEBUG ? 0.22 : 1});
    cell.add(fill);
    const pen = new Path({
      data: line.pen, x: 0, y: 0,
      stroke: DEBUG ? '#ff4d4d' : '#fff',
      lineWidth: DEBUG ? 3 : NIB,
      lineCap: 'round', lineJoin: 'round',
      end: DEBUG ? 1 : 0,
      compositeOperation: DEBUG ? 'source-over' : 'destination-in',
    });
    cell.add(pen);
    titleNode().add(cell);
    pens.push({pen, dur: (inkW + NIB) / PEN_SPEED});
  });

  if (DEBUG) { yield* waitFor(0.2); return; }

  yield* waitFor(0.8);
  for (const {pen, dur} of pens) {
    yield* pen.end(1, dur, linear);
    yield* waitFor(LINE_GAP);
  }
  yield* waitFor(HOLD);
  yield* titleNode().opacity(0, 0.8, easeInOutCubic);
  yield* waitFor(0.4);
});
