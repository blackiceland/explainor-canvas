import {makeScene2D} from '@motion-canvas/2d';
import {Node, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, easeInOutSine, linear, waitFor} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';
import {
  CODE_RULES,
  CUSTOM_TYPES,
  TRANSPARENT_CARD,
  ACCENT,
  TYPE_CLEAN,
  VAR_LIGHT,
} from './fiveFacesBooleanV2Setup';

// ─────────────────────────────────────────────────────────────────────────
// "Юдан" interlude — a pause between the five faces, shot as a REAL IDE
// editing session played back over years.
//
// The camera is locked on ONE Boolean guard at the dead centre of the frame.
// Around it the file is edited: a caret darts above to add setup, below to add
// consequences, jumps back up to change a line written two years earlier. The
// active line glows as it always does in an editor. Line numbers tick up as the
// file swells. And through every edit the caret never once lands on the guard:
// nobody ever touches those three lines. By the end the same bit that guarded
// one save in 2021 stands in front of warehouse, money, shipping and events —
// and only then does it light. Pure 油断.
//
// Architecture: the file is a hand-managed COLUMN of single-line Manticores.
// The guard's middle line is the PIVOT — every row sits at
//   sceneY = (rowIndex - guardMiddleIndex) * lineHeight
// so the guard is frozen at y=0 by construction and can never be moved or
// overlapped. The caret / active-line / gutter are the editor chrome on top.
// ─────────────────────────────────────────────────────────────────────────

const FS = 27;
const LH = 40;
const CODE_X = 70;
const CODE_W = 1040;
const I = '    ';

const GUTTER_X = -430;
const GUTTER_SEP_X = -405;
const GUTTER_OP = 0.30;
const ACTIVE_OP = 1;     // node opacity when current line is lit; alpha lives in the fill
const CARET_COLOR = '#AFC8F2';
const CW = 15;            // monospace advance ≈ for caret tracking

// The frozen heart.
const GUARD_TOP = `${I}if (!skipValidation) {`;
const GUARD_MID = `${I}${I}validator.requireValid(order)`;
const GUARD_BOT = `${I}}`;

const SIGNATURE = `fun process(order: Order, skipValidation: Boolean = false) {`;
const RETURN = `${I}return orders.save(order)`;
const BRACE = `}`;

// Era additions.
const A_ACCOUNT = `${I}val account = accounts.require(order.buyerId)`;
const A_LIMITS  = `${I}val limits = rateLimiter.check(account)`;
const A_PRICING = `${I}val pricing = pricingEngine.quote(order)`;
const A_RISK    = `${I}val risk = fraudScorer.score(order, account)`;
const B_INVENT  = `${I}inventory.reserve(order.items)`;
const B_PAYMENT = `${I}payments.authorize(order)`;
const B_EVENTS  = `${I}events.publish(OrderAccepted(order.id))`;
const B_SHIP    = `${I}shipping.schedule(order, account)`;
const B_AUDIT   = `${I}audit.record(order, account)`;
const B_NOTIFY  = `${I}notifier.notify(account)`;

const SCENE_TYPES = [...CUSTOM_TYPES, 'OrderAccepted'];
const SCENE_RULES: ColorRule[] = [
  ...CODE_RULES,
  {match: /^OrderAccepted$/, color: TYPE_CLEAN},
];

interface Row {
  mc: Manticore;
  num: Txt;
  revealed: boolean;
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  const stage = createRef<Node>();
  const activeLine = createRef<Rect>();
  const column = createRef<Node>();
  const caret = createRef<Rect>();
  view.add(
    <Node ref={stage}>
      <Rect
        ref={activeLine}
        x={70}
        y={0}
        width={1040}
        height={LH}
        radius={5}
        fill={'rgba(175, 200, 242, 0.15)'}
        opacity={0}
      />
      <Rect
        x={GUTTER_SEP_X}
        y={0}
        width={1.5}
        height={1120}
        fill={'rgba(244, 241, 235, 0.07)'}
      />
      <Node ref={column} />
      <Rect
        ref={caret}
        x={0}
        y={0}
        width={2.5}
        height={FS * 0.96}
        radius={1}
        fill={CARET_COLOR}
        opacity={0}
      />
    </Node>,
  );

  const rows: Row[] = [];
  let guardMid: Row;

  const makeRow = (text: string): Row => {
    const mc = Manticore.create(text, {
      x: CODE_X, y: 0, width: CODE_W,
      fontSize: FS, lineHeight: LH, fontFamily: Fonts.code,
      theme: DryFiltersV3CodeTheme, noClip: true,
      cardStyle: TRANSPARENT_CARD, glowAccent: false, customTypes: SCENE_TYPES,
    });
    mc.mount(column());
    mc.colorize(SCENE_RULES);
    mc.node.opacity(1);
    mc.getLine(0)!.hideTokensInstantly();
    const num = new Txt({
      x: GUTTER_X, y: 0, offset: [1, 0],
      text: '', fontFamily: Fonts.code, fontSize: Math.round(FS * 0.78),
      fill: `rgba(244, 241, 235, ${GUTTER_OP})`, opacity: 0,
    });
    column().add(num);
    return {mc, num, revealed: false};
  };

  const guardIndex = () => rows.indexOf(guardMid);
  const slotOf = (row: Row) => (rows.indexOf(row) - guardIndex()) * LH;

  const syncNumbers = () => {
    for (let i = 0; i < rows.length; i++) rows[i].num.text(String(i + 1));
  };

  function* layout(dur: number) {
    syncNumbers();
    const g = guardIndex();
    const anims: any[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const ty = (i - g) * LH;
      if (Math.abs(r.mc.node.position.y() - ty) > 0.5) {
        anims.push(r.mc.node.position.y(ty, dur, easeInOutCubic));
        anims.push(r.num.position.y(ty, dur, easeInOutCubic));
      }
    }
    if (anims.length > 0) yield* all(...anims);
  }

  const placeInstantly = () => {
    const g = guardIndex();
    for (let i = 0; i < rows.length; i++) {
      rows[i].mc.node.position.y((i - g) * LH);
      rows[i].num.position.y((i - g) * LH);
    }
    syncNumbers();
  };

  // ── Caret + active-line helpers ─────────────────────────────────────────
  const tokensOf = (row: Row) => row.mc.getLine(0)!.tokens;
  const lineLeftX = (row: Row): number => {
    for (const t of tokensOf(row)) if (t.text.trim().length > 0) return CODE_X + t.localX;
    return CODE_X;
  };
  const lineRightX = (row: Row): number => {
    const toks = tokensOf(row);
    let last = null as null | (typeof toks)[number];
    for (const t of toks) if (t.text.length > 0) last = t;
    return last ? CODE_X + last.localX + last.text.length * CW : CODE_X;
  };
  const charCount = (row: Row): number =>
    tokensOf(row).reduce((s, t) => s + t.text.length, 0);

  function* jumpCaretTo(x: number, y: number, dur = 0.13) {
    yield* all(
      caret().opacity(1, 0.08, easeInOutSine),
      caret().position([x, y], dur, easeInOutCubic),
      activeLine().position.y(y, dur, easeInOutCubic),
      activeLine().opacity(ACTIVE_OP, dur, easeInOutSine),
    );
  }

  // Type a freshly-built row in place, caret tracking the text edge, while the
  // rest of the file slides to make room.
  function* typeRow(row: Row, delay: number, slideDur: number) {
    const y = slotOf(row);
    const startX = lineLeftX(row);
    const endX = lineRightX(row);
    caret().position([startX, y]);
    const dur = Math.max(0.14, charCount(row) * delay);
    yield* all(
      layout(slideDur),
      row.num.opacity(GUTTER_OP, 0.2, easeInOutSine),
      row.mc.getLine(0)!.typewriter(delay),
      caret().position.x(endX, dur, linear),
    );
  }

  function* blinkHold(dur: number) {
    let t = 0;
    while (t < dur - 0.001) {
      const step = Math.min(0.52, dur - t);
      yield* caret().opacity(0.12, step * 0.5, easeInOutSine);
      yield* caret().opacity(1, step * 0.5, easeInOutSine);
      t += step;
    }
  }

  // Insert a new line just before `before`, with the caret jumping there first.
  function* addLine(text: string, before: Row, delay: number, slideDur: number): Row {
    const row = makeRow(text);
    rows.splice(rows.indexOf(before), 0, row);
    row.mc.node.position.y(slotOf(row));
    row.num.position.y(slotOf(row));
    row.revealed = true;
    yield* jumpCaretTo(lineLeftX(row), slotOf(row));
    yield* typeRow(row, delay, slideDur);
    return row;
  }

  // Non-linear edit: go back to an existing line and append an argument.
  function* addArg(row: Row, beforeToken: string, insertText: string, delay: number) {
    const y = slotOf(row);
    yield* jumpCaretTo(lineRightX(row) - 14, y);
    yield* all(
      caret().position.x(lineRightX(row) + insertText.length * CW, 0.4, linear),
      row.mc.getLine(0)!.insertBeforeToken(beforeToken, insertText, {
        charDelay: delay, fromEnd: true,
        colorRules: [{match: 'pricing', color: VAR_LIGHT}],
        customTypes: SCENE_TYPES,
      }),
    );
  }

  // Year marker — quiet mono on the left. It ticks; the flag does not.
  const year = createRef<Txt>();
  view.add(
    <Txt ref={year} x={-740} y={0} text={'2021'}
      fontFamily={Fonts.code} fontSize={30} letterSpacing={4}
      fill={'rgba(244, 241, 235, 0.42)'} opacity={0} />,
  );

  // ── 2021 — the file as first written ───────────────────────────────────
  const sig = makeRow(SIGNATURE);
  const gTop = makeRow(GUARD_TOP);
  guardMid = makeRow(GUARD_MID);
  const gBot = makeRow(GUARD_BOT);
  const ret = makeRow(RETURN);
  const brace = makeRow(BRACE);
  rows.push(sig, gTop, guardMid, gBot, ret, brace);
  placeInstantly();

  yield* year().opacity(0.42, 0.6, easeInOutSine);
  // VO: «Когда-то этот файл был коротким. Флаг охранял одну строку —
  //      сохранение заказа.»
  for (const r of rows) {
    r.revealed = true;
    yield* jumpCaretTo(lineLeftX(r), slotOf(r), 0.1);
    yield* typeRow(r, 0.014, 0.001);
  }
  yield* blinkHold(2.0);

  function* tick(label: string) {
    yield* year().opacity(0, 0.16, easeInOutSine);
    year().text(label);
    yield* year().opacity(0.42, 0.22, easeInOutSine);
  }

  // ── 2022 — context up top, inventory down below ────────────────────────
  // VO: «Год спустя — проверка покупателя сверху, резерв на складе снизу.»
  yield* tick('2022');
  yield* addLine(A_ACCOUNT, gTop, 0.018, 0.34);
  yield* blinkHold(0.7);
  yield* addLine(B_INVENT, ret, 0.018, 0.34);
  yield* blinkHold(1.4);

  // ── 2023 — limits up, money down ───────────────────────────────────────
  // VO: «Ещё год — лимиты и списание денег. Флаг — тот же.»
  yield* tick('2023');
  yield* addLine(A_LIMITS, gTop, 0.016, 0.30);
  yield* blinkHold(0.5);
  const paymentsRow = yield* addLine(B_PAYMENT, ret, 0.016, 0.30);
  yield* blinkHold(1.2);

  // ── 2024 — pricing, events, and a jump BACK to fix an old line ──────────
  // VO: «Дальше — расчёт цены и событие. И тут же возвращаются назад: к оплате
  //      добавляют только что посчитанную цену.»
  yield* tick('2024');
  yield* addLine(A_PRICING, gTop, 0.014, 0.28);
  yield* addLine(B_EVENTS, ret, 0.014, 0.28);
  yield* blinkHold(0.4);
  yield* addArg(paymentsRow, ')', ', pricing', 0.02);
  yield* blinkHold(1.1);

  // ── 2025 — the cascade. The caret darts; the guard is never touched ─────
  // VO: «И вот — скоринг рисков, доставка, аудит, уведомления. Всё это теперь
  //      за одной строкой, которую можно пропустить одним битом.»
  yield* tick('2025');
  yield* addLine(A_RISK, gTop, 0.010, 0.22);
  yield* addLine(B_SHIP, ret, 0.010, 0.22);
  yield* addLine(B_AUDIT, ret, 0.010, 0.22);
  yield* addLine(B_NOTIFY, ret, 0.010, 0.22);
  yield* blinkHold(0.7);

  // ── Climax — the editor recedes; the bit ignites ───────────────────────
  // The caret and active line fade — editing is done. The camera pulls back to
  // take in the whole grown file, and the one untouched guard lights warm.
  yield* all(
    caret().opacity(0, 0.5, easeInOutSine),
    activeLine().opacity(0, 0.5, easeInOutSine),
  );
  yield* all(
    stage().scale(0.8, 1.5, easeInOutSine),
    (function* () {
      yield* waitFor(0.45);
      const anims: any[] = [];
      for (const r of [gTop, guardMid, gBot]) {
        for (const tok of r.mc.getLine(0)!.tokens) {
          const t = tok.ref();
          t.shadowColor(ACCENT);
          anims.push(t.fill(ACCENT, 1.1, easeInOutSine));
          anims.push(t.shadowBlur(10, 1.1, easeInOutSine));
        }
      }
      yield* all(...anims);
    })(),
  );
  // VO (медленнее): «Один бит. В нём не изменилось ничего. Изменился не флаг —
  //      изменилось всё вокруг него.»
  yield* waitFor(3.0);

  // ── Final card ─────────────────────────────────────────────────────────
  const card = createRef<Node>();
  view.add(
    <Node ref={card} opacity={0}>
      <Txt x={0} y={-26} text={'The flag stayed the same.'}
        fontFamily={Fonts.code} fontSize={40} letterSpacing={1}
        fill={'rgba(244, 241, 235, 0.78)'} />
      <Txt x={0} y={26} text={'The code around it did not.'}
        fontFamily={Fonts.code} fontSize={40} letterSpacing={1}
        fill={'#F4F1EB'} />
    </Node>,
  );

  yield* all(
    stage().opacity(0, 0.8, easeInOutSine),
    year().opacity(0, 0.8, easeInOutSine),
  );
  yield* card().opacity(1, 0.9, easeInOutSine);
  yield* waitFor(2.6);
  yield* card().opacity(0, 0.9, easeInOutSine);
  yield* waitFor(0.5);
});
