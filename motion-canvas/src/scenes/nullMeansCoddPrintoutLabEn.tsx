import {Circle, Gradient, Img, Line, Node, Rect, Txt, blur, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  createSignal,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Fonts, Screen} from '../core/theme';

// ═══════════════════════════════════════════════════════════════════════
// ЛАБА: тот же леджер Кодда, но материалом — РАСПЕЧАТКА АЦПУ.
// Не сцена ролика, а кадр для решения: смотреть и выбирать глядя.
//
// Всё в кадре подчинено физике настоящей фальцованной ленты, потому что
// именно физика решает вопрос:
//   · лист 9½″ × 11″, поля под перфорацию по ½″, шаг отверстий ½″;
//   · шаг знака 10 CPI (0.1″) и строки 6 LPI (⅙″) — ЖЁСТКИЕ, отсюда кегль;
//   · печатная зона 8½″ = ровно 85 знакомест: шире отчёт физически не бывает;
//   · линейки таблицы рисуются ЗНАКАМИ (`-`), волосяных линий у АЦПУ нет;
//   · шапка отчёта с прогоном и номером страницы датирует кадр без титра.
//
// ⚠️ ЭТО И ЕСТЬ ГЛАВНАЯ НАХОДКА: 85 знакомест — потолок. Ключевой жест сцены
// (камера едет вправо вдоль разрастающейся схемы) на ленте невозможен: схема
// упирается в перфорацию. Лента растёт ВНИЗ, то есть записями, а не вопросами,
// а нам нужны именно вопросы. Кадр показывает материал честно — вместе с этим
// ограничением.
//
// Три кадра: (A) весь лист, (B) наезд на запись, (C) две клетки — размазанный
// оттиск против пустоты (бумага не расфокусируется, у неё другой глагол).
// ═══════════════════════════════════════════════════════════════════════

const MONO = Fonts.code;

// ── физика листа ────────────────────────────────────────────────────────
const IN_PX = 190;                   // дюйм
const PAPER_W = 9.5 * IN_PX;         // 1805
const PAPER_H = 11 * IN_PX;          // 2090 — выше кадра, лист обрезан
const MARGIN = 0.5 * IN_PX;          // поле под перфорацию
const PRINT_L = -PAPER_W / 2 + MARGIN;
const ADV = IN_PX / 10;              // 10 CPI = 19px
const LP = IN_PX / 6;                // 6 LPI ≈ 31.7px
const FS = 32;                       // кегль ВЫВЕДЕН из шага, а не выбран
const COLS = 85;                     // печатная зона 8½″

const HOLE_PITCH = 0.5 * IN_PX;
const HOLE_D = 0.156 * IN_PX;        // 5/32″

// ⚠️ Бумага приглушена: чистый белый лист на тёмном таймлайне — вспышка.
const PAPER_C = 'rgb(214,209,198)';
const BAR_C = 'rgba(0,0,0,0.038)';   // «гринбар» в ч/б: полосы по 3 строки
const PERF_C = 'rgba(0,0,0,0.13)';
const HOLE_C = '#0C0E12';
const CREASE_C = 'rgba(0,0,0,0.22)';
// краска ленты — не чёрная: изношенный риббон даёт тёплый графит
const INK = 'rgba(30,28,26,0.90)';

const CREASE_Y = -392;               // сгиб = стык страниц
const L0 = -290;                     // первая строка новой страницы
const lineY = (l: number) => L0 + l * LP;
const colX = (c: number) => PRINT_L + c * ADV;

// ── содержимое отчёта ───────────────────────────────────────────────────
const C_ID = 2;
const C_NAME = 8;
const C_DOB = 26;
const C_MAIDEN = 41;

const ROWS: [string, string, string, string][] = [
  ['0411', 'Helen Vance', '1971-05-02', 'Brandt'],
  ['0412', 'Margaret Ellis', '1979-07-19', 'Whitfield'],
  ['0413', 'Peter Hallam', 'null', 'null'],
  ['0414', 'Anna Boyd', '1988-02-03', 'Carrow'],
  ['0415', 'David Okafor', '1983-12-30', 'null'],
  ['0416', 'Ruth Lindqvist', 'null', 'Palm'],
  ['0417', 'Simon Reyes', '1990-08-14', 'null'],
  ['0418', 'Clara Nowak', '1976-01-23', 'Bauer'],
];
const SUBJ = 2;                      // запись 0413
const ROW_L0 = 5;                    // строки через одну — так печатали отчёты
const rowLine = (i: number) => ROW_L0 + i * 2;
const FOG_TEXT = '1962-11-04';

// ── тайминги (кадры-цели: 60 · 135 · 210) ───────────────────────────────
const IN = 1.0;
const HOLD_A = 1.4;
const PUSH = 1.4;
const HOLD_B = 1.0;
const OPEN = 0.9;
const HOLD_C = 2.0;

const PUSH_S = 1.6;

// детерминированный шум: неровность оттиска у ударной печати
const rnd = (i: number, s: number) => {
  const x = Math.sin((i + 1) * 12.9898 + s * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// ═══════════════════════════════════════════════════════════════════════
export default makeScene2D(function* (view) {
  applyBackground(view);

  const camBlur = createSignal(12);
  const cam = createRef<Node>();
  view.add(
    <Node ref={cam} opacity={0} cache cachePadding={90} filters={[blur(() => camBlur())]} />,
  );

  // ── лист ──────────────────────────────────────────────────────────────
  cam().add(
    <Rect
      width={PAPER_W}
      height={PAPER_H}
      fill={PAPER_C}
      shadowColor="rgba(0,0,0,0.65)"
      shadowBlur={44}
      shadowOffset={[0, 6]}
    />,
  );

  // «гринбар» в ч/б: полосы по три строки, только по печатной зоне
  const BAR_H = LP * 3;
  for (let b = -12; b < 12; b++) {
    if (b % 2 !== 0) continue;
    cam().add(
      <Rect
        x={0}
        y={lineY(0) - LP + b * BAR_H + BAR_H / 2}
        width={PAPER_W - 2 * MARGIN}
        height={BAR_H}
        fill={BAR_C}
      />,
    );
  }

  // перфорация полей + отверстия
  [-1, 1].forEach(side => {
    const px = side * (PAPER_W / 2 - MARGIN);
    cam().add(
      <Line
        points={[[px, -PAPER_H / 2], [px, PAPER_H / 2]]}
        stroke={PERF_C}
        lineWidth={1}
        lineDash={[3, 7]}
      />,
    );
    const hx = side * (PAPER_W / 2 - MARGIN / 2);
    const n = Math.ceil(PAPER_H / HOLE_PITCH);
    for (let i = -n; i <= n; i++) {
      const hy = i * HOLE_PITCH + HOLE_PITCH / 2;
      if (Math.abs(hy) > PAPER_H / 2 - HOLE_D) continue;
      cam().add(<Circle x={hx} y={hy} size={HOLE_D} fill={HOLE_C} />);
    }
  });

  // сгиб: перфорация + тень в изломе + блик на сходе бумаги
  cam().add(
    <Rect
      y={CREASE_Y - 9}
      width={PAPER_W}
      height={18}
      fill={
        new Gradient({
          type: 'linear',
          from: [0, -9],
          to: [0, 9],
          stops: [
            {offset: 0, color: 'rgba(0,0,0,0)'},
            {offset: 1, color: 'rgba(0,0,0,0.10)'},
          ],
        })
      }
    />,
  );
  cam().add(
    <Rect
      y={CREASE_Y + 7}
      width={PAPER_W}
      height={14}
      fill={
        new Gradient({
          type: 'linear',
          from: [0, -7],
          to: [0, 7],
          stops: [
            {offset: 0, color: 'rgba(255,255,255,0.10)'},
            {offset: 1, color: 'rgba(255,255,255,0)'},
          ],
        })
      }
    />,
  );
  cam().add(
    <Line
      points={[[-PAPER_W / 2, CREASE_Y], [PAPER_W / 2, CREASE_Y]]}
      stroke={CREASE_C}
      lineWidth={1}
      lineDash={[6, 5]}
    />,
  );

  // ── печать: КАЖДЫЙ ЗНАК ОТДЕЛЬНО ──────────────────────────────────────
  // Ударная печать неровная: краска ложится с разной плотностью, литеры чуть
  // пляшут по базовой. Ровный Txt на бумаге читается как наклейка.
  let inkSeed = 0;
  const put = (
    line: number,
    col: number,
    text: string,
    opacity: (() => number) | number = 1,
  ) => {
    const nodes: Txt[] = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === ' ') continue;
      const s = inkSeed++;
      const t = new Txt({
        text: ch,
        x: colX(col + i) + (rnd(s, 1) - 0.5) * 0.9,
        y: lineY(line) + (rnd(s, 2) - 0.5) * 1.3,
        offset: [-1, 0],
        fontFamily: MONO,
        fontSize: FS,
        fontWeight: 500,
        fill: INK,
        opacity:
          typeof opacity === 'number'
            ? opacity * (0.84 + rnd(s, 3) * 0.16)
            : () => opacity() * (0.84 + rnd(s, 3) * 0.16),
      });
      cam().add(t);
      nodes.push(t);
    }
    return nodes;
  };

  // шапка отчёта — она и датирует кадр, титр не нужен
  put(0, C_ID, 'PERSONNEL MASTER FILE');
  put(0, 38, 'RUN 14 MAR 86');
  put(0, 70, 'PAGE 0001');

  put(2, C_ID, 'ID');
  put(2, C_NAME, 'NAME');
  put(2, C_DOB, 'DATE OF BIRTH');
  put(2, C_MAIDEN, 'MAIDEN NAME');
  // ⚠️ Линейки у АЦПУ — ЗНАКИ. Волосяных линий не бывает.
  put(3, C_ID, '----');
  put(3, C_NAME, '----------------');
  put(3, C_DOB, '-------------');
  put(3, C_MAIDEN, '-----------');

  const dobNullOp = createSignal(1);
  const maidenNullOp = createSignal(1);
  const fogOp = createSignal(0);

  ROWS.forEach((r, i) => {
    const l = rowLine(i);
    put(l, C_ID, r[0]);
    put(l, C_NAME, r[1]);
    if (i === SUBJ) {
      put(l, C_DOB, r[2], () => dobNullOp());
      put(l, C_MAIDEN, r[3], () => maidenNullOp());
    } else {
      put(l, C_DOB, r[2]);
      put(l, C_MAIDEN, r[3]);
    }
  });

  // ⚠️ Бумага НЕ РАСФОКУСИРУЕТСЯ — у неё другой глагол. «Значение есть, но не
  // прочесть» на ленте = СМАЗАННЫЙ ОТТИСК: каретка дёрнулась, риббон повело.
  // Поэтому дата печатается многократно со сдвигом по горизонтали.
  const smear = createRef<Node>();
  cam().add(<Node ref={smear} opacity={() => fogOp()} cache cachePadding={40} filters={[blur(1.6)]} />);
  for (let k = 0; k < 9; k++) {
    const dx = (k - 4) * 1.9;
    for (let i = 0; i < FOG_TEXT.length; i++) {
      const s = inkSeed++;
      smear().add(
        new Txt({
          text: FOG_TEXT[i],
          x: colX(C_DOB + i) + dx + (rnd(s, 1) - 0.5) * 1.2,
          y: lineY(rowLine(SUBJ)) + (rnd(s, 2) - 0.5) * 1.6,
          offset: [-1, 0],
          fontFamily: MONO,
          fontSize: FS,
          fontWeight: 500,
          fill: INK,
          opacity: 0.20,
        }),
      );
    }
  }

  // ── линза: виньетка и зерно живут вне камеры ──────────────────────────
  const lens = createRef<Node>();
  view.add(<Node ref={lens} opacity={0} />);
  lens().add(
    <Rect
      width={Screen.width * 1.2}
      height={Screen.height * 1.2}
      fill={
        new Gradient({
          type: 'radial',
          from: [0, 0],
          to: [0, 0],
          fromRadius: 380,
          toRadius: 1180,
          stops: [
            {offset: 0, color: 'rgba(0,0,0,0)'},
            {offset: 1, color: 'rgba(0,0,0,0.55)'},
          ],
        })
      }
    />,
  );
  lens().add(
    <Img
      src="/hoare/grain-1920x1080.png"
      width={Screen.width}
      height={Screen.height}
      compositeOperation="overlay"
      opacity={0.5}
    />,
  );

  // ═══ ТАЙМЛАЙН ═══════════════════════════════════════════════════════
  yield* all(
    cam().opacity(1, IN * 0.8, easeOutCubic),
    lens().opacity(1, IN * 0.8, easeOutCubic),
    camBlur(0, IN, easeInOutCubic),
  );
  yield* waitFor(HOLD_A);                                   // ← КАДР A (f60)

  const tx = colX(C_DOB) + (colX(C_MAIDEN + 11) - colX(C_DOB)) / 2;
  const ty = lineY(rowLine(SUBJ));
  yield* all(
    cam().scale(PUSH_S, PUSH, easeInOutCubic),
    cam().position([-PUSH_S * tx, -PUSH_S * ty], PUSH, easeInOutCubic),
  );
  yield* waitFor(HOLD_B);                                   // ← КАДР B (f135)

  yield* all(
    dobNullOp(0, OPEN * 0.5, easeInCubic),
    fogOp(1, OPEN * 0.8, easeOutCubic),
    maidenNullOp(0, OPEN, easeInCubic),
  );
  yield* waitFor(HOLD_C);                                   // ← КАДР C (f210)
});
