import {makeScene2D, Node, Path} from '@motion-canvas/2d';
import {createRef, easeInOutCubic, easeInOutQuint, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {TITLE_LINES} from './nullTitleGlyphs';

// Титул «Your null / means too much» — НАСТОЯЩАЯ РИСОВКА ПЕРОМ (Playfair Display
// Italic). Перо ведёт растущую обводку ПО ОСЕВОЙ линии буквы (скелет глифа,
// end:0→1), а красивая залитая буква проявляется ВСЛЕД за пером. Это рисование,
// а не открывашка залитого глифа слева-направо.
//
// Механика ПО-ГЛИФНАЯ: каждая буква — свой cache-узел [заливка Path(gl.d) +
// перо Path(gl.pen) butt-обводкой NIB как destination-in-маска, end 0→1].
// Перо буквы физически НЕ МОЖЕТ проявить чужую заливку — в тесных парах
// (хвост u у самого штамба l, n→s, u→c) хвост предыдущей буквы больше не
// засвечивает сливер следующей.
//
// ⚠️ Скелет печётся в scratchpad/otbake/skelbake.mjs (растр→Zhang-Suen→Флёри-маршрут).
// ⚠️ Path рисует baked-координаты с оригином в позиции узла (авто-центрирования в
// отрисовке нет) → строку центрируем сами (ячейка x=-inkCx). Метрики из ink.

const DEBUG = false;                   // true → показать осевую (скелет) поверх бледной заливки

const CREAM = 'rgba(244, 241, 235, 0.96)';
const LINE_SPACE = 20;
const PEN_SPEED = 1900;                // px/сек ВДОЛЬ МАРШРУТА пера (средняя скорость штриха)
const STROKE_MIN = 0.3;                // короткий штрих (l/t) не быстрее этого — иначе вспыхивает
const AIR = 0.06;                      // «перенос» пера по воздуху между буквами
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

  const linePens: {pen: Path; segs: number[]}[][] = [];
  TITLE_LINES.forEach((line, li) => {
    const inkCx = (line.inkX1 + line.inkX2) / 2;
    const cell = new Node({x: -inkCx, y: baseY(li)});
    const pens: {pen: Path; segs: number[]}[] = [];
    for (const gl of line.glyphs) {
      const gnode = new Node({cache: !DEBUG});     // буква = свой узел: заливка ∩ СВОЁ перо
      gnode.add(new Path({data: gl.d, fill: CREAM, opacity: DEBUG ? 0.22 : 1}));
      const pen = new Path({
        data: gl.pen,
        stroke: DEBUG ? '#ff4d4d' : '#fff',
        lineWidth: DEBUG ? 3 : NIB,
        lineCap: DEBUG ? 'round' : 'butt', // butt: нет круглого колпачка → нет капли на старте буквы
        lineJoin: 'round',
        end: DEBUG ? 1 : 0,
        compositeOperation: DEBUG ? 'source-over' : 'destination-in',
      });
      gnode.add(pen);
      cell.add(gnode);
      pens.push({pen, segs: gl.segs});
    }
    titleNode().add(cell);
    linePens.push(pens);
  });

  if (DEBUG) { yield* waitFor(0.2); return; }

  // По-штриховой пейсинг: КАЖДАЯ буква — свой твин с мягким касанием и отрывом
  // (easeInOutCubic: в кадре входа перо проявляет ~ничего, кончик буквы РАСТЁТ, а не
  // вспыхивает куском) + AIR-пауза «переноса» между буквами. Иначе прыжок пера между
  // буквами (нулевая длина дуги) проявлял верх следующей буквы мгновенной точкой.
  yield* waitFor(0.8);
  for (const pens of linePens) {
    for (const {pen, segs} of pens) {
      const total = segs.reduce((a, b) => a + b, 0);
      let cum = 0;
      for (let i = 0; i < segs.length; i++) {
        cum += segs[i];
        const target = i === segs.length - 1 ? 1 : cum / total;
        yield* pen.end(target, Math.max(segs[i] / PEN_SPEED, STROKE_MIN), easeInOutQuint);
        yield* waitFor(AIR);
      }
    }
    yield* waitFor(LINE_GAP);
  }
  yield* waitFor(HOLD);
  yield* titleNode().opacity(0, 0.8, easeInOutCubic);
  yield* waitFor(0.4);
});
