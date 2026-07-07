import {makeScene2D} from '@motion-canvas/2d';
import {Circle, Line, Node, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, easeInOutSine, easeOutCubic, linear, waitFor} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {getCodePaddingX} from '../core/code/shared/TextMeasure';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Fonts} from '../core/theme';
import {
  CODE_RULES,
  CUSTOM_TYPES,
  TRANSPARENT_CARD,
  ACCENT,
  TYPE_CLEAN,
  VAR_LIGHT,
} from './fiveFacesBooleanV2Setup';

// ─────────────────────────────────────────────────────────────────────────
// "Юдан" — code & system, side by side, on pure black.
//
//   LEFT   a real IDE editing session played over years: lines typed, lines
//          deleted, an argument added back into an old line. The caret darts
//          above the guard and below it — and never once lands ON it.
//   RIGHT  the SYSTEM the code quietly assembles: one node per real call,
//          named like a service. A single GATE (validation) sits frozen at the
//          centre. Every year more services hang off the same unchanged gate.
//
// Both still points — the code guard and the system gate — are pinned at y=0.
// Everything else accretes around them. That symmetry IS the thesis: the flag
// never moved; what hangs behind it grew without bound.
// ─────────────────────────────────────────────────────────────────────────

// ── Left: code metrics ──────────────────────────────────────────────────
const FS = 24;
const LH = 36;
const TEXT_X = -870;          // left edge of the code text
const CW = 13.3;              // monospace advance ≈ for caret tracking
const I = '    ';

const GUTTER_X = -905;
const GUTTER_SEP_X = -888;
const ACTIVE_X = -882;
const ACTIVE_W = 850;
const GUTTER_OP = 0.30;
const CARET_COLOR = '#AFC8F2';
// width chosen so Manticore's centring offset (leftEdge = -width/2 + paddingX)
// is exactly 0 → the code text left edge lands precisely at TEXT_X.
const CARD_W = getCodePaddingX(FS) * 2;

// ── Right: system rail metrics ──────────────────────────────────────────
const RAIL_X = 330;
const STEP = 60;
const LABEL_DX = 30;
const GW = (a: number) => `rgba(244, 241, 235, ${a})`;

// The frozen heart (left) — never edited.
const GUARD_TOP = `${I}if (!skipValidation) {`;
const GUARD_MID = `${I}${I}validator.requireValid(order)`;
const GUARD_BOT = `${I}}`;

const SIGNATURE = `fun process(order: Order, skipValidation: Boolean = false) {`;
const RETURN = `${I}return orders.save(order)`;
const BRACE = `}`;
const BLANK = ` `;

const SCENE_TYPES = [...CUSTOM_TYPES, 'OrderAccepted'];
const SCENE_RULES: ColorRule[] = [
  ...CODE_RULES,
  {match: /^OrderAccepted$/, color: TYPE_CLEAN},
];

interface Row {
  mc: Manticore;
  num: Txt;
  blank: boolean;
}

interface GNode {
  group: Node;
  marker: Circle;
  primary: Txt;
  secondary: Txt;
  isGate: boolean;
}

export default makeScene2D(function* (view) {
  // Pure black.
  view.add(<Rect width={1920} height={1080} fill={'#000000'} />);

  // ── Chrome (unscaled) ──────────────────────────────────────────────────
  const year = createRef<Txt>();
  const chrome = createRef<Node>();
  view.add(
    <Node ref={chrome}>
      <Txt x={TEXT_X} y={-470} offset={[-1, 0]} text={'OrderService.kt'}
        fontFamily={Fonts.code} fontSize={20} fill={GW(0.46)} letterSpacing={1} />
      <Txt ref={year} x={TEXT_X} y={-436} offset={[-1, 0]} text={'2021'}
        fontFamily={Fonts.code} fontSize={26} fill={GW(0.42)} letterSpacing={3} opacity={0} />
      <Txt x={RAIL_X} y={-470} offset={[-1, 0]} text={'WHAT  THE  FLAG  GATES'}
        fontFamily={Fonts.code} fontSize={17} fill={GW(0.36)} letterSpacing={4} />
      <Line points={[[90, -430], [90, 430]]} stroke={GW(0.06)} lineWidth={1.5} />
    </Node>,
  );

  // ── Stage (scaled at the pull-back) ─────────────────────────────────────
  const stage = createRef<Node>();
  const activeLine = createRef<Rect>();
  const column = createRef<Node>();
  const caret = createRef<Rect>();
  const graphLayer = createRef<Node>();
  const rail = createRef<Rect>();
  const bracket = createRef<Line>();
  const thread = createRef<Line>();
  const threadBright = createRef<Line>();
  view.add(
    <Node ref={stage}>
      {/* the wire from the guard to the gate — "this guard IS that gate" */}
      <Line ref={thread} points={[[0, 0], [0, 0]]} stroke={GW(0.17)} lineWidth={1.4}
        lineDash={[3, 7]} opacity={0} />
      <Line ref={threadBright} points={[[0, 0], [0, 0]]} stroke={GW(0.9)} lineWidth={1.6}
        end={0} opacity={0} />
      <Rect ref={activeLine} x={ACTIVE_X} y={0} offset={[-1, 0]} width={ACTIVE_W} height={LH}
        radius={5} fill={'rgba(175, 200, 242, 0.15)'} opacity={0} />
      <Rect x={GUTTER_SEP_X} y={0} width={1.5} height={1120} fill={GW(0.07)} />
      <Node ref={column} />
      <Rect ref={caret} x={0} y={0} width={2.5} height={FS * 0.96} radius={1}
        fill={CARET_COLOR} opacity={0} />
      <Node ref={graphLayer}>
        <Rect ref={rail} x={RAIL_X} y={0} width={1.5} height={0} fill={GW(0.16)} />
        {/* the gate brackets everything it controls */}
        <Line ref={bracket} points={[[0, 0], [0, 0]]} stroke={GW(0.22)} lineWidth={1.5} />
      </Node>
    </Node>,
  );

  // The gate's containment bracket, hung from the gate down to the last service.
  const BRACKET_X = RAIL_X - 28;
  const bracketPoints = (botY: number) =>
    [[BRACKET_X + 13, 0], [BRACKET_X, 0], [BRACKET_X, botY], [BRACKET_X + 13, botY]] as [number, number][];

  // ── Left: code rows (Still Point column) ────────────────────────────────
  const rows: Row[] = [];
  let guardMid: Row;

  const makeRow = (text: string, blank = false): Row => {
    const mc = Manticore.create(text, {
      x: TEXT_X, y: 0, width: CARD_W,
      fontSize: FS, lineHeight: LH, fontFamily: Fonts.code,
      theme: DryFiltersV3CodeTheme, noClip: true,
      cardStyle: TRANSPARENT_CARD, glowAccent: false, customTypes: SCENE_TYPES,
    });
    mc.mount(column());
    mc.colorize(SCENE_RULES);
    mc.node.opacity(1);
    mc.getLine(0)!.hideTokensInstantly();
    const num = new Txt({
      x: GUTTER_X, y: 0, offset: [1, 0], text: '',
      fontFamily: Fonts.code, fontSize: Math.round(FS * 0.78),
      fill: GW(GUTTER_OP), opacity: 0,
    });
    column().add(num);
    return {mc, num, blank};
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

  const tokensOf = (row: Row) => row.mc.getLine(0)!.tokens;
  const lineLeftX = (row: Row) => {
    for (const t of tokensOf(row)) if (t.text.trim().length > 0) return TEXT_X + t.localX;
    return TEXT_X;
  };
  const lineRightX = (row: Row) => {
    let last: any = null;
    for (const t of tokensOf(row)) if (t.text.length > 0) last = t;
    return last ? TEXT_X + last.localX + last.text.length * CW : TEXT_X;
  };
  const charCount = (row: Row) => tokensOf(row).reduce((s, t) => s + t.text.length, 0);

  function* jumpCaretTo(x: number, y: number, dur = 0.1) {
    yield* all(
      caret().opacity(1, 0.06, easeInOutSine),
      caret().position([x, y], dur, easeInOutCubic),
      activeLine().position.y(y, dur, easeInOutCubic),
      activeLine().opacity(1, dur, easeInOutSine),
    );
  }

  function* typeRow(row: Row, delay: number, slideDur: number) {
    const y = slotOf(row);
    caret().position([lineLeftX(row), y]);
    const dur = Math.max(0.1, charCount(row) * delay);
    yield* all(
      layout(slideDur),
      row.num.opacity(GUTTER_OP, 0.18, easeInOutSine),
      row.mc.getLine(0)!.typewriter(delay),
      caret().position.x(lineRightX(row), dur, linear),
    );
  }

  function* blinkHold(dur: number) {
    let t = 0;
    while (t < dur - 0.001) {
      const step = Math.min(0.5, dur - t);
      yield* caret().opacity(0.12, step * 0.5, easeInOutSine);
      yield* caret().opacity(1, step * 0.5, easeInOutSine);
      t += step;
    }
  }

  // Backspace a whole line, caret riding the shrinking edge.
  function* eraseLine(row: Row, charDelay: number) {
    const y = slotOf(row);
    const toks = tokensOf(row).filter(t => t.text.length > 0);
    const total = toks.reduce((s, t) => s + t.text.length, 0);
    yield* jumpCaretTo(lineRightX(row), y, 0.12);
    yield* all(
      caret().position.x(lineLeftX(row), Math.max(0.12, total * charDelay), linear),
      (function* () {
        for (let i = toks.length - 1; i >= 0; i--) {
          const node = toks[i].ref();
          const full = toks[i].text;
          for (let c = full.length; c >= 0; c--) {
            node.text(full.slice(0, c));
            yield* waitFor(charDelay * 0.7);
          }
        }
      })(),
    );
  }

  function* addArg(row: Row, beforeToken: string, insertText: string, delay: number) {
    const y = slotOf(row);
    yield* jumpCaretTo(lineRightX(row) - 12, y);
    yield* all(
      caret().position.x(lineRightX(row) + insertText.length * CW, 0.32, linear),
      row.mc.getLine(0)!.insertBeforeToken(beforeToken, insertText, {
        charDelay: delay, fromEnd: true,
        colorRules: [{match: 'pricing', color: VAR_LIGHT}],
        customTypes: SCENE_TYPES,
      }),
    );
  }

  // ── Right: system rail (gate is the pivot, mirrors the guard) ───────────
  const gnodes: GNode[] = [];
  let gate: GNode;
  let saveNode: GNode;
  const gateIndex = () => gnodes.indexOf(gate);

  const makeGNode = (primary: string, secondary: string, isGate = false): GNode => {
    const group = new Node({x: RAIL_X, y: 0, opacity: 0});
    const marker = new Circle({
      width: isGate ? 0 : 13, height: isGate ? 0 : 13,
      stroke: GW(0.85), lineWidth: 1.6, fill: '#000000',
    });
    let bars: Node | null = null;
    if (isGate) {
      bars = new Node({});
      bars.add(new Rect({x: -11, y: 0, width: 18, height: 3, radius: 1.5, fill: GW(0.82)}));
      bars.add(new Rect({x: 11, y: 0, width: 18, height: 3, radius: 1.5, fill: GW(0.82)}));
      group.add(bars);
    }
    group.add(marker);
    const primaryTxt = new Txt({
      x: LABEL_DX, y: isGate ? -10 : -8, offset: [-1, 0], text: primary,
      fontFamily: Fonts.code, fontSize: 22, fill: GW(isGate ? 0.96 : 0.9), letterSpacing: 0.5,
    });
    const secondaryTxt = new Txt({
      x: LABEL_DX, y: isGate ? 14 : 13, offset: [-1, 0], text: secondary,
      fontFamily: Fonts.code, fontSize: 15, fill: GW(isGate ? 0.5 : 0.38), letterSpacing: 0.5,
    });
    group.add(primaryTxt);
    group.add(secondaryTxt);
    if (isGate) {
      group.add(new Rect({x: 20, y: 0, width: 2, height: 30, radius: 1, fill: GW(0.5)}));
    }
    graphLayer().add(group);
    return {group, marker, primary: primaryTxt, secondary: secondaryTxt, isGate};
  };

  function* glayout(dur: number) {
    const g = gateIndex();
    const anims: any[] = [];
    for (let i = 0; i < gnodes.length; i++) {
      const ty = (i - g) * STEP;
      if (Math.abs(gnodes[i].group.position.y() - ty) > 0.5) {
        anims.push(gnodes[i].group.position.y(ty, dur, easeInOutCubic));
      }
    }
    const top = (0 - g) * STEP;
    const bot = (gnodes.length - 1 - g) * STEP;
    anims.push(rail().height(bot - top, dur, easeInOutCubic));
    anims.push(rail().position.y((top + bot) / 2, dur, easeInOutCubic));
    anims.push(bracket().points(bracketPoints(bot), dur, easeInOutCubic));
    if (anims.length > 0) yield* all(...anims);
  }

  // ── Left-only code line (setup the flag does NOT gate) ──────────────────
  function* addCode(side: 'up' | 'down', codeText: string, delay: number, slide: number): Row {
    const anchor = side === 'up' ? blankBefore : retRow;
    const row = makeRow(codeText);
    rows.splice(rows.indexOf(anchor), 0, row);
    row.mc.node.position.y(slotOf(row));
    row.num.position.y(slotOf(row));
    yield* jumpCaretTo(lineLeftX(row), slotOf(row));
    yield* typeRow(row, delay, slide);
    return row;
  }

  // ── A gated consequence: a code line AND its system node, in lockstep.
  // The right rail only ever shows what runs BEHIND the gate. ─────────────
  function* addEffect(
    codeText: string, primary: string, secondary: string, delay: number, slide: number,
  ): {row: Row; gnode: GNode} {
    const row = makeRow(codeText);
    rows.splice(rows.indexOf(retRow), 0, row);
    row.mc.node.position.y(slotOf(row));
    row.num.position.y(slotOf(row));

    const gnode = makeGNode(primary, secondary);
    gnodes.splice(gnodes.indexOf(saveNode), 0, gnode);
    gnode.group.position.y((gnodes.indexOf(gnode) - gateIndex()) * STEP);
    gnode.marker.scale(0.4);

    yield* jumpCaretTo(lineLeftX(row), slotOf(row));
    yield* all(
      typeRow(row, delay, slide),
      glayout(slide),
      gnode.group.opacity(1, 0.3, easeInOutSine),
      gnode.marker.scale(1, 0.34, easeOutCubic),
    );
    return {row, gnode};
  }

  function* removeStatement(row: Row, gnode: GNode | null, slide: number) {
    yield* eraseLine(row, 0.012);
    rows.splice(rows.indexOf(row), 1);
    if (gnode) gnodes.splice(gnodes.indexOf(gnode), 1);
    yield* all(
      layout(slide),
      glayout(slide),
      ...(gnode ? [gnode.group.opacity(0, 0.26, easeInOutSine)] : []),
    );
    row.mc.node.remove();
    row.num.remove();
    if (gnode) gnode.group.remove();
  }

  function* tick(label: string) {
    yield* year().opacity(0, 0.14, easeInOutSine);
    year().text(label);
    yield* year().opacity(0.42, 0.2, easeInOutSine);
  }

  // ── 2021 — the file as first written ────────────────────────────────────
  const sig = makeRow(SIGNATURE);
  const blankBefore = makeRow(BLANK, true);
  const gTop = makeRow(GUARD_TOP);
  guardMid = makeRow(GUARD_MID);
  const gBot = makeRow(GUARD_BOT);
  const blankAfter = makeRow(BLANK, true);
  const retRow = makeRow(RETURN);
  const brace = makeRow(BRACE);
  rows.push(sig, blankBefore, gTop, guardMid, gBot, blankAfter, retRow, brace);
  placeInstantly();

  gate = makeGNode('Validation', 'if (!skipValidation)', true);
  saveNode = makeGNode('Orders', 'save', false);
  gnodes.push(gate, saveNode);
  gate.group.position.y(0);
  saveNode.group.position.y(STEP);
  saveNode.marker.scale(0.4);

  yield* year().opacity(0.42, 0.5, easeInOutSine);
  for (const r of rows) {
    if (r.blank) {
      yield* r.num.opacity(GUTTER_OP, 0.12, easeInOutSine);
      continue;
    }
    yield* jumpCaretTo(lineLeftX(r), slotOf(r), 0.08);
    yield* typeRow(r, 0.008, 0.001);
    if (r === guardMid) {
      yield* all(gate.group.opacity(1, 0.4, easeInOutSine), glayout(0.4));
    }
    if (r === retRow) {
      yield* all(
        saveNode.group.opacity(1, 0.34, easeInOutSine),
        saveNode.marker.scale(1, 0.34, easeOutCubic),
        glayout(0.34),
      );
    }
  }

  // wire the guard to the gate — both pinned at y=0, the same still point
  const threadL = lineRightX(guardMid) + 16;
  const threadR = RAIL_X - 24;
  thread().points([[threadL, 0], [threadR, 0]]);
  threadBright().points([[threadL, 0], [threadR, 0]]);
  yield* thread().opacity(1, 0.6, easeInOutSine);
  yield* blinkHold(0.9);

  // ── 2022 — a buyer check up top, a warehouse hold below ─────────────────
  yield* tick('2022');
  yield* addCode('up', A('account', 'accounts.require(order.buyerId)'), 0.010, 0.18);
  yield* blinkHold(0.35);
  yield* addEffect(`${I}inventory.reserve(order.items)`, 'Inventory', 'reserve', 0.010, 0.18);
  yield* blinkHold(0.7);

  // ── 2023 — limits added, then pulled when it moves to the gateway ───────
  yield* tick('2023');
  const limits = yield* addCode('up', A('limits', 'rateLimiter.check(account)'), 0.009, 0.16);
  yield* blinkHold(0.4);
  const pay = yield* addEffect(`${I}payments.authorize(order)`, 'Payments', 'authorize', 0.009, 0.16);
  yield* blinkHold(0.5);
  // deletion #1 — rate limiting moves out to the API gateway
  yield* removeStatement(limits, null, 0.16);
  yield* blinkHold(0.8);

  // ── 2024 — pricing, an event, and a jump BACK to an old line ────────────
  yield* tick('2024');
  yield* addCode('up', A('pricing', 'pricingEngine.quote(order)'), 0.008, 0.15);
  const events = yield* addEffect(`${I}events.publish(OrderAccepted(order.id))`, 'Events', 'publish', 0.008, 0.15);
  yield* blinkHold(0.35);
  yield* addArg(pay.row, ')', ', pricing', 0.014);
  yield* blinkHold(0.9);

  // ── The pull-back — take in the whole grown thing ───────────────────────
  yield* all(
    caret().opacity(0, 0.4, easeInOutSine),
    activeLine().opacity(0, 0.4, easeInOutSine),
    stage().scale(0.82, 1.3, easeInOutSine),
  );
  yield* waitFor(0.5);

  // ── 2025 — and it KEEPS going. The guard is still never touched ─────────
  yield* tick('2025');
  yield* addCode('up', A('risk', 'fraudScorer.score(order, account)'), 0.007, 0.13);
  yield* addEffect(`${I}shipping.schedule(order, account)`, 'Shipping', 'schedule', 0.007, 0.13);
  // deletion #2 — the event call is migrated onto the new bus
  yield* removeStatement(events.row, events.gnode, 0.13);
  yield* addEffect(`${I}eventBus.emit(OrderAccepted(order.id))`, 'Event Bus', 'emit', 0.007, 0.13);
  yield* addEffect(`${I}audit.record(order, account)`, 'Audit', 'record', 0.007, 0.13);
  yield* addEffect(`${I}notifier.notify(account)`, 'Notifications', 'notify', 0.007, 0.13);
  yield* blinkHold(0.6);

  // ── Climax, in two beats — the asymmetry is the whole point ─────────────
  yield* all(
    caret().opacity(0, 0.4, easeInOutSine),
    activeLine().opacity(0, 0.4, easeInOutSine),
  );

  // BEAT 1 — one bit. The single token nobody ever re-examined lights; the
  // check it guards is struck out. Tiny, quiet, and held.
  const igniteBit: any[] = [];
  for (const r of [sig, gTop]) {
    for (const tok of r.mc.getLine(0)!.tokens) {
      if (tok.text.includes('skipValidation')) {
        const t = tok.ref();
        t.shadowColor(ACCENT);
        igniteBit.push(t.fill(ACCENT, 0.5, easeInOutSine));
        igniteBit.push(t.shadowBlur(11, 0.5, easeInOutSine));
      }
    }
  }
  const strike = new Line({
    points: [[lineLeftX(guardMid) - 4, 0], [lineRightX(guardMid) + 4, 0]],
    stroke: ACCENT, lineWidth: 2, end: 0,
  });
  column().add(strike);
  gate.secondary.text('skipValidation = true');
  yield* all(
    ...igniteBit,
    guardMid.mc.getLine(0)!.setAllTokensOpacity(0.3, 0.5),
    strike.end(1, 0.5, easeInOutCubic),
    gate.secondary.fill(GW(0.88), 0.5, easeInOutSine),
  );
  yield* waitFor(0.5); // the held beat — small cause, suspended

  // BEAT 1½ — the flipped bit travels the wire to the gate. The cause is on
  // the left; it reaches across to the thing it governs.
  threadBright().opacity(1);
  yield* threadBright().end(1, 0.55, easeOutCubic);

  // BEAT 2 — the avalanche. The gate opens and everything it guarded floods
  // at once: one bit, the entire downstream rail.
  const below = gnodes.filter(g => gnodes.indexOf(g) > gateIndex());
  const bottom = (gnodes.length - 1 - gateIndex()) * STEP;
  const flow = new Line({
    points: [[RAIL_X, 0], [RAIL_X, 0]], stroke: GW(0.94), lineWidth: 2.6, opacity: 0.95,
  });
  graphLayer().add(flow);
  const gateBars = gate.group.children()[0] as Node;
  yield* all(
    gateBars.children()[0].position.x(-26, 0.45, easeInOutCubic),
    gateBars.children()[1].position.x(26, 0.45, easeInOutCubic),
    flow.points([[RAIL_X, 0], [RAIL_X, bottom]], 0.7, easeOutCubic),
    bracket().stroke(GW(0.85), 0.7, easeInOutSine),
    bracket().lineWidth(2, 0.7, easeInOutSine),
  );
  // each gated service fills solid as the unvalidated flow reaches it
  for (const g of below) {
    g.marker.fill(GW(0.95));
    g.primary.fill(GW(1));
    yield* waitFor(0.05);
  }
  yield* waitFor(2.4); // hold the payoff — one bit, the whole rail exposed

  // ── Final card ──────────────────────────────────────────────────────────
  const card = createRef<Node>();
  view.add(
    <Node ref={card} opacity={0}>
      <Txt x={0} y={-26} text={'The flag stayed the same.'}
        fontFamily={Fonts.code} fontSize={42} letterSpacing={1} fill={GW(0.78)} />
      <Txt x={0} y={26} text={'What it controlled kept growing.'}
        fontFamily={Fonts.code} fontSize={42} letterSpacing={1} fill={'#F4F1EB'} />
    </Node>,
  );
  yield* all(
    stage().opacity(0, 0.8, easeInOutSine),
    chrome().opacity(0, 0.8, easeInOutSine),
  );
  yield* card().opacity(1, 0.9, easeInOutSine);
  yield* waitFor(2.4);
  yield* card().opacity(0, 0.9, easeInOutSine);
  yield* waitFor(0.4);
});

// `val name = expr` setup line.
function A(name: string, expr: string): string {
  return `    val ${name} = ${expr}`;
}
