import {blur, Img, makeScene2D, Node, Rect, Txt} from '@motion-canvas/2d';
import {
  all,
  createRef,
  createSignal,
  easeInOutCubic,
  easeInOutSine,
  easeOutCubic,
  SimpleSignal,
  Vector2,
  waitFor,
} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Fonts} from '../core/theme';

// ВТОРОЙ ДОКУМЕНТ — «улика», в отличие от страницы ALGOL («алиби»).
// C. A. R. Hoare, RECORD HANDLING, лекции NATO Summer School, Villard-de-Lans,
// 12–16 сентября 1966, стр. 9. Всё рассуждение целиком лежит на ОДНОЙ странице:
// объявление record class person → раздел 2.2 о частичных отношениях → введение
// null. Поэтому листать не нужно: один зум и три прохода маркером.
//
// Сцена: страница проявляется как одно (focus-pull) → зум в блок объявления →
// маркер по `reference (person) father…` → камера вниз к 2.2, маркер по
// «there may be an x for which there is no y» → маркер по «a special null value
// is / provided» (переносится на следующую строку, как настоящий маркер) →
// камера возвращается к объявлению → страница растворяется, а объявление
// ОСТАЁТСЯ, уже нашим набором на графите (та же позиция, кегль и левое поле —
// строка переживает растворение) → печатается его же строка создания записи
// T := person (1908, true, null, null, null); три null подряд — самый сильный
// кадр акта, и он дословно из источника.
//
// ⚠️ Даты: этот документ — СЕНТЯБРЬ 1966, статья ALGOL — июнь 1966. К 1965-му
// относится сама работа над языком. Ни один из документов подписывать 1965-м
// нельзя.

const RH_SRC = '/hoare/record-handling-p9-4800x2700.jpg';
const RH_W = 4800;
const RH_H = 2700;
const RH_S = 0.4;                    // 4800×2700 → ровно 1920×1080

// лист внутри ассета (см. _rh_prep.mjs)
const PAPER_W = 1672;
const PAPER_H = 2440;
const PAPER_CX = RH_W / 2;
const PAPER_CY = RH_H / 2;
const TILT = -0.45;                  // градусы, наклон листа на поверхности

// зум: текстовая колонка (paper x 120…1500) должна занять ширину кадра —
// иначе строчный кегль уходит в нечитаемое на телефоне
const ZOOM_S = 3.4;                  // s = RH_S*ZOOM_S = 1.36
const S_ZOOM = RH_S * ZOOM_S;
const COL_CX = 810;                  // центр текстовой колонки в координатах листа

// ── замеры краски (_rh_measure.mjs, координаты листа) ───────────────────
const HL_FILL = 'rgb(247, 179, 196)';
const HL_DECL = {x0: 500, x1: 1395, cy: 1050, h: 44};     // reference (person) father, elder sibling, youngest
const HL_PARTIAL = {x0: 120, x1: 849, cy: 1851, h: 46};   // there may be an x for which there is no y
const HL_NULL_A = {x0: 1040, x1: 1428, cy: 2011, h: 45};  // a special null value is
const HL_NULL_B = {x0: 120, x1: 266, cy: 2051, h: 43};    // provided

const AT_DECL = {x: COL_CX, y: 1071};
const AT_PARTIAL = {x: COL_CX, y: 1851};
const AT_NULL = {x: COL_CX, y: 2010};

// ── тайминги ────────────────────────────────────────────────────────────
const PAGE_IN = 1.1;
const PAGE_HOLD = 0.7;
const ZOOM_DUR = 1.3;
const HL_DUR = 0.55;
const READ_DECL = 1.0;               // ⚠️ VO
const MOVE_DUR = 0.95;
const READ_PARTIAL = 1.2;            // ⚠️ VO
const MOVE_SHORT = 0.6;
const HL_WRAP = 0.28;                // хвост маркера на следующей строке
const READ_NULL = 1.4;               // ⚠️ VO
const BACK_DUR = 0.9;
const DISSOLVE = 1.0;
const CODE_HOLD = 0.9;
const LIFT_DUR = 0.8;                // блок поднимается, освобождая строку под T:=
const LIFT_Y = -96;
const LIFT_X = 62;                   // и отходит от левого края: позицию строки он
                                     // держал только ради непрерывности растворения
const CHAR = 0.028;                  // печать
const NULL_BEAT = 0.34;              // пауза перед каждым null
const TAIL_HOLD = 1.2;
const DIM_DUR = 0.8;
const OUT_DUR = 0.7;

// ── набор на графите: подобран так, что строка ПЕРЕЖИВАЕТ растворение —
// те же экранные позиции, что у строк на листе при S_ZOOM ────────────────
const CODE_FS = 41;
const CODE_ADV = CODE_FS * 0.6;
// иерархия только цветом: объявление — контекст, null — предмет. Разница
// 0.92/0.98 не читалась вовсе, три null тонули в собственной строке.
const INK = 'rgba(232, 207, 174, 0.68)';
const NULL_C = 'rgba(255, 240, 212, 1)';
const MONO = Fonts.code;

export default makeScene2D(function* (view) {
  applyBackground(view);

  yield new Promise<void>(resolve => {
    const el = document.createElement('img');
    el.onload = () => resolve();
    el.onerror = () => resolve();
    el.src = RH_SRC;
  });

  // ── геометрия ─────────────────────────────────────────────────────────
  const T = (TILT * Math.PI) / 180;
  // координаты листа → координаты ассета (лист повёрнут вокруг своего центра)
  const paperToAsset = (px: number, py: number) => {
    const dx = px - PAPER_W / 2;
    const dy = py - PAPER_H / 2;
    return [
      PAPER_CX + dx * Math.cos(T) - dy * Math.sin(T),
      PAPER_CY + dx * Math.sin(T) + dy * Math.cos(T),
    ] as const;
  };
  // координаты ассета → локальные координаты рига (Img центрирован в риге)
  const toRig = (ax: number, ay: number) => [ax - RH_W / 2, ay - RH_H / 2] as const;
  // позиция рига, при которой точка ЛИСТА оказывается в центре кадра
  const rigAt = (p: {x: number; y: number}, s: number) => {
    const [ax, ay] = paperToAsset(p.x, p.y);
    const [lx, ly] = toRig(ax, ay);
    return new Vector2(-lx * s, -ly * s);
  };
  // экранная позиция точки листа при заданном положении/масштабе рига
  const screenOf = (px: number, py: number, at: {x: number; y: number}, s: number) => {
    const [ax, ay] = paperToAsset(px, py);
    const [lx, ly] = toRig(ax, ay);
    const rig = rigAt(at, s);
    return [rig.x + lx * s, rig.y + ly * s] as const;
  };

  // ── страница ──────────────────────────────────────────────────────────
  const pageBlur = createSignal(16);
  const pageRig = createRef<Node>();
  view.add(
    <Node ref={pageRig} scale={RH_S} opacity={0} filters={[blur(() => pageBlur())]} />,
  );
  pageRig().add(new Img({src: RH_SRC, width: RH_W, height: RH_H}));

  // маркер: краска ложится по строке слева направо, повёрнута вместе с листом
  const makeHighlight = (hl: {x0: number; x1: number; cy: number; h: number}) => {
    const [ax, ay] = paperToAsset(hl.x0, hl.cy);
    const [lx, ly] = toRig(ax, ay);
    const pad = hl.h * 0.2;
    const r = new Rect({
      x: lx - pad * Math.cos(T),
      y: ly - pad * Math.sin(T),
      offset: [-1, 0],
      rotation: TILT,
      width: 0,
      height: hl.h,
      fill: HL_FILL,
      compositeOperation: 'multiply',
      opacity: 0.82,
    });
    pageRig().add(r);
    return {rect: r, w: hl.x1 - hl.x0 + pad * 2};
  };
  const hlDecl = makeHighlight(HL_DECL);
  const hlPartial = makeHighlight(HL_PARTIAL);
  const hlNullA = makeHighlight(HL_NULL_A);
  const hlNullB = makeHighlight(HL_NULL_B);

  // ── наш набор: объявление Хоара, посаженное на экранные позиции строк ──
  const code = createRef<Node>();
  view.add(<Node ref={code} opacity={0} />);

  const dimOthers = createSignal(1);
  const makeLine = (paperX: number, paperY: number, text: string) => {
    const [sx, sy] = screenOf(paperX, paperY, AT_DECL, S_ZOOM);
    const t = new Txt({
      text,
      x: sx,
      y: sy,
      offset: [-1, 0],
      fontFamily: MONO,
      fontSize: CODE_FS,
      fontWeight: 500,
      fill: INK,
      opacity: () => dimOthers(),
    });
    code().add(t);
    return t;
  };
  // строки 19, 21, 22, 23 страницы — его собственная разбивка
  makeLine(120, 1010, 'record class person (integer date of birth; Boolean male;');
  makeLine(500, 1050, 'reference (person) father, elder sibling, youngest');
  makeLine(1245, 1089, 'offspring);');
  makeLine(120, 1132, 'reference (person) T, J, K;');

  // ── строка создания записи: печатается, три null подряд ───────────────
  const [declX, declY] = screenOf(120, 1132, AT_DECL, S_ZOOM);
  const createRow = createRef<Node>();
  code().add(<Node ref={createRow} x={declX} y={declY + CODE_FS * 2.9} />);
  const TOKENS: {text: string; isNull?: boolean}[] = [
    {text: 'T := person (1908, true, '},
    {text: 'null', isNull: true},
    {text: ', '},
    {text: 'null', isNull: true},
    {text: ', '},
    {text: 'null', isNull: true},
    {text: ');'},
  ];
  const nullOps: SimpleSignal<number>[] = [];
  let cursorChars = 0;
  const tokenNodes = TOKENS.map(tok => {
    const own = tok.isNull ? createSignal(1) : null;
    if (own) nullOps.push(own);
    const t = new Txt({
      text: '',
      x: cursorChars * CODE_ADV,
      offset: [-1, 0],
      fontFamily: MONO,
      fontSize: CODE_FS,
      fontWeight: 500,
      fill: tok.isNull ? NULL_C : INK,
      opacity: tok.isNull ? () => own!() : () => dimOthers(),
    });
    cursorChars += tok.text.length;
    createRow().add(t);
    return t;
  });

  // ═══ ТАЙМЛАЙН ═════════════════════════════════════════════════════════
  // страница проявляется КАК ОДНО: фокус наводится вместе с плотностью
  yield* all(
    pageRig().opacity(1, PAGE_IN * 0.8, easeOutCubic),
    pageBlur(0, PAGE_IN, easeInOutCubic),
  );
  yield* waitFor(PAGE_HOLD);

  // зум в блок объявления
  yield* all(
    pageRig().scale(S_ZOOM, ZOOM_DUR, easeInOutCubic),
    pageRig().position(rigAt(AT_DECL, S_ZOOM), ZOOM_DUR, easeInOutCubic),
  );

  // 1. что он объявил
  yield* hlDecl.rect.size.x(hlDecl.w, HL_DUR, easeInOutSine);
  yield* waitFor(READ_DECL);

  // 2. какую задачу это ставит
  yield* pageRig().position(rigAt(AT_PARTIAL, S_ZOOM), MOVE_DUR, easeInOutCubic);
  yield* hlPartial.rect.size.x(hlPartial.w, HL_DUR, easeInOutSine);
  yield* waitFor(READ_PARTIAL);

  // 3. его ответ — маркер переносится через конец строки
  yield* pageRig().position(rigAt(AT_NULL, S_ZOOM), MOVE_SHORT, easeInOutCubic);
  yield* hlNullA.rect.size.x(hlNullA.w, HL_DUR, easeInOutSine);
  yield* hlNullB.rect.size.x(hlNullB.w, HL_WRAP, easeInOutSine);
  yield* waitFor(READ_NULL);

  // назад к объявлению — и страница растворяется под уже стоящей строкой
  yield* pageRig().position(rigAt(AT_DECL, S_ZOOM), BACK_DUR, easeInOutCubic);
  yield* all(
    pageRig().opacity(0, DISSOLVE, easeInOutCubic),
    pageBlur(7, DISSOLVE, easeInOutCubic),
    code().opacity(1, DISSOLVE * 0.75, easeInOutCubic),
  );
  pageRig().remove();
  yield* waitFor(CODE_HOLD);

  // блок поднимается ровно настолько, чтобы принять строку создания записи
  yield* code().position([LIFT_X, LIFT_Y], LIFT_DUR, easeInOutCubic);

  // печать: перед каждым null — короткая пауза, три подряд и есть кадр
  for (let i = 0; i < TOKENS.length; i++) {
    const tok = TOKENS[i];
    if (tok.isNull) yield* waitFor(NULL_BEAT);
    for (let c = 1; c <= tok.text.length; c++) {
      tokenNodes[i].text(tok.text.slice(0, c));
      yield* waitFor(CHAR);
    }
  }
  yield* waitFor(TAIL_HOLD);

  // остаётся осадок: три null
  yield* dimOthers(0.22, DIM_DUR, easeInOutCubic);
  yield* waitFor(0.9);
  yield* all(
    code().opacity(0, OUT_DUR, easeInOutCubic),
    ...nullOps.map(op => op(0, OUT_DUR, easeInOutCubic)),
  );
  yield* waitFor(0.4);
});
