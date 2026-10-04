import {makeScene2D, Node, Path} from '@motion-canvas/2d';
import {createRef, easeInOutCubic, waitFor} from '@motion-canvas/core';
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
const NIB = 46;                        // ширина пера-маски (покрыть толстые штрихи)

// ⚠️⚠️ ДЛИНА СЦЕНЫ = ОКНО В РОЛИКЕ (разбор null-demo, 03.10): между «…ask it to
// carry» и «1965» ~4,6 с. Прежняя сцена шла 12,8 с, в монтаже её ускорили в
// 3,4 раза — и каждая буква открывалась за 3 кадра и стояла 2–3, ~9 букв в
// секунду: мерцание вместо пера. Теперь сцена ставится в монтаж на 100 %.
// ⚠️ Перо идёт с ПОСТОЯННОЙ скоростью нового штриха, без разгона и торможения
// на каждой букве: при таком темпе мягкое касание сжимается в пару кадров и
// превращается в рывок. Перенос между буквами — один кадр, между словами чуть
// дольше. Рисовка ~3,1 с, ~47 px нового штриха за кадр.
const PRE = 0.15;                      // тьма до первого штриха — под растворение null из интро
const PEN_SPEED = 2800;                // px/с НОВОГО штриха (возвраты времени не берут, см. penWarp)
const AIR = 1 / 60;                    // перенос пера между буквами — один кадр
const WORD_AIR = 0.07;                 // между словами
const LINE_GAP = 0.12;
const HOLD = 0.9;
const FADE = 0.45;

// ⚠️ Запечка advance-only (у этого variable-TTF кернинг в opentype не читается),
// а у шрифта есть пара Yo = −22 px при кегле 200 (замер браузером, fontKerning).
// Без неё первые две буквы титула стоят врозь. Сдвиг применяется ко всем буквам
// после пары, центр строки пересчитывается.
const KERN: Record<string, number> = {Yo: -22};

const N = TITLE_LINES.length;
const LINE_H = Math.max(...TITLE_LINES.map(l => l.inkY2 - l.inkY1));
const PITCH = LINE_H + LINE_SPACE;
const baseY = (li: number) => (li - (N - 1) / 2) * PITCH;
const TOP = Math.min(...TITLE_LINES.map((l, li) => baseY(li) + l.inkY1));
const BOT = Math.max(...TITLE_LINES.map((l, li) => baseY(li) + l.inkY2));
const TITLE_Y = -(TOP + BOT) / 2;

// ⚠️⚠️ ВОЗВРАТЫ ПЕРА — БЕЗ ВРЕМЕНИ. Маршрут (обход Флёри) местами идёт назад по
// уже нарисованному: вверх по штамбу m/n/u/h, обратно со шпоры — это 27 %
// маршрута. Новых пикселей там нет, и при постоянной скорости по дуге буква
// застывала на 3–5 кадров («m» 100 мс стояла как «r»). Поэтому время считается
// по НОВОМУ штриху: участок ближе RETRACE_TOL к уже пройденному (не ближе
// RETRACE_GAP по дуге — соседей по маршруту не считаем) перо проходит мгновенно.
// `ease` — тайминг-функция для pen.end: доля времени → доля дуги маршрута.
const RETRACE_TOL = 2.5;
const RETRACE_GAP = 6;
const penWarp = (d: string) => {
  const toks = d.match(/[ML]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const pts: {x: number; y: number; move: boolean}[] = [];
  let cmd = 'M';
  for (let i = 0; i < toks.length; ) {
    if (toks[i] === 'M' || toks[i] === 'L') { cmd = toks[i++]; continue; }
    pts.push({x: +toks[i], y: +toks[i + 1], move: cmd === 'M'});
    i += 2;
    cmd = 'L';
  }
  // сэмплы через 1 px дуги: s — пройдено по маршруту, v — из них нового штриха
  const xs = [pts[0].x], ys = [pts[0].y], ss = [0], vs = [0];
  let S = 0, V = 0;
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1], b = pts[k];
    if (b.move) { xs.push(b.x); ys.push(b.y); ss.push(S); vs.push(V); continue; }
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(len));
    for (let j = 1; j <= n; j++) {
      const t = j / n, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, s = S + len * t;
      let retrace = false;
      for (let q = 0; q < ss.length && ss[q] < s - RETRACE_GAP; q++) {
        if (Math.hypot(x - xs[q], y - ys[q]) < RETRACE_TOL) { retrace = true; break; }
      }
      if (!retrace) V += s - ss[ss.length - 1];
      xs.push(x); ys.push(y); ss.push(s); vs.push(V);
    }
    S += len;
  }
  const ease = (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const target = t * V;
    let lo = 0, hi = vs.length - 1;     // первый сэмпл, где новый штрих дорос до target
    while (lo < hi) { const mid = (lo + hi) >> 1; if (vs[mid] < target) lo = mid + 1; else hi = mid; }
    const v0 = lo > 0 ? vs[lo - 1] : 0, s0 = lo > 0 ? ss[lo - 1] : 0;
    const s = vs[lo] > v0 ? s0 + (ss[lo] - s0) * (target - v0) / (vs[lo] - v0) : ss[lo];
    return s / S;
  };
  return {visible: V, ease};
};
const WARPS = TITLE_LINES.map(line => line.glyphs.map(gl => penWarp(gl.pen)));

// По тексту строки: сдвиг кернинга для каждой буквы и где начинается слово.
// Глифов пробела нет, поэтому пары берём из текста, а не из соседних глифов.
const layoutOf = (text: string) => {
  const shift: number[] = [];
  const wordStart: boolean[] = [];
  let acc = 0;
  let afterSpace = false;
  for (let k = 0; k < text.length; k++) {
    const ch = text[k];
    if (ch === ' ') { afterSpace = true; continue; }
    if (k > 0) acc += KERN[text[k - 1] + ch] ?? 0;
    shift.push(acc);
    wordStart.push(afterSpace);
    afterSpace = false;
  }
  return {shift, wordStart};
};

export default makeScene2D(function* (view) {
  applyBackground(view);

  const titleNode = createRef<Node>();
  view.add(<Node ref={titleNode} y={TITLE_Y} />);

  const linePens: {pen: Path; warp: ReturnType<typeof penWarp>; wordStart: boolean}[][] = [];
  TITLE_LINES.forEach((line, li) => {
    const {shift, wordStart} = layoutOf(line.text);
    // последняя буква несёт правый край ink-а → он уезжает на её сдвиг
    const inkCx = (line.inkX1 + line.inkX2 + shift[shift.length - 1]) / 2;
    const cell = new Node({x: -inkCx, y: baseY(li)});
    const pens: {pen: Path; warp: ReturnType<typeof penWarp>; wordStart: boolean}[] = [];
    line.glyphs.forEach((gl, gi) => {
      const gnode = new Node({x: shift[gi], cache: !DEBUG}); // буква = свой узел: заливка ∩ СВОЁ перо
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
      pens.push({pen, warp: WARPS[li][gi], wordStart: wordStart[gi]});
    });
    titleNode().add(cell);
    linePens.push(pens);
  });

  if (DEBUG) { yield* waitFor(0.2); return; }

  yield* waitFor(PRE);
  for (let li = 0; li < linePens.length; li++) {
    if (li > 0) yield* waitFor(LINE_GAP);
    for (let gi = 0; gi < linePens[li].length; gi++) {
      const {pen, warp, wordStart} = linePens[li][gi];
      if (gi > 0) yield* waitFor(wordStart ? WORD_AIR : AIR);
      yield* pen.end(1, warp.visible / PEN_SPEED, warp.ease);
    }
  }
  yield* waitFor(HOLD);
  yield* titleNode().opacity(0, FADE, easeInOutCubic);
});
