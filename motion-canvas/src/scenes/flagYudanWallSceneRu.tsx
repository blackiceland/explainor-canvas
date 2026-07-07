import {makeScene2D, Line, Node, Rect, Txt} from '@motion-canvas/2d';
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
} from './fiveFacesBooleanV2Setup';

// ─────────────────────────────────────────────────────────────────────────
// "Юдан" — a load-bearing default. The definition never moves; the things
// that lean on it keep multiplying.
//
//   LEFT   one frozen definition at the top —
//          `fun send(report, async: Boolean = true)` — and below it, year over
//          year, the call sites that USE it. Almost all of them omit `async`
//          and quietly inherit the default. A careful few pass it explicitly.
//   RIGHT  the same population as a field of cubes resting on one base node,
//          `async = true`. A cube that omits the arg has no value of its own —
//          it takes the base's colour. A cube that passes it explicitly carries
//          its own (amber) and owns its boundary.
//
//   The base and the definition's default token are wired together. Someone
//   edits one character — `true` → `false` — the base flips, and every cube
//   that had no value of its own floods red. The explicit few are untouched.
// ─────────────────────────────────────────────────────────────────────────

// ── Left: code metrics ───────────────────────────────────────────────────
const FS = 24;
const LH = 36;
const TEXT_X = -890;
const CW = 13.3;
const TOP_Y = -402;                  // screen y of the first code row

const GUTTER_X = -925;
const GUTTER_SEP_X = -908;
const ACTIVE_X = -902;
const ACTIVE_W = 880;
const GUTTER_OP = 0.30;
const CARET_COLOR = '#AFC8F2';
const CARD_W = getCodePaddingX(FS) * 2;
const GW = (a: number) => `rgba(244, 241, 235, ${a})`;

// ── Right: the default + its dependents ──────────────────────────────────
const HUB_X = 470;
const COLS = 4;
const CUBE_W = 110;
const CUBE_H = 62;
const GAP = 16;
const BASE_W = COLS * CUBE_W + (COLS - 1) * GAP;
const BASE_H = 58;
const INHERIT = '#5B83C4';            // the borrowed default value
const BASE_FILL = '#3E6BB0';          // the source it is borrowed from
const EXPLICIT = '#D8A24A';           // a call site that pinned its own value
const DANGER = '#FF4757';
const INK = '#0B0C10';

// ── Code text — the frozen definition ────────────────────────────────────
const SIG = `fun send(report: Report, async: Boolean = true) {`;
const SIG_FALSE = `fun send(report: Report, async: Boolean = false) {`;
const BODY_A = `    if (async) scheduler.enqueue(report)`;
const BODY_A2 = `    if (async) scheduler.enqueue(report, retries = 3)`;
const BODY_B = `    else mailer.sendNow(report)`;
const BODY_B2 = `    else mailer.sendNow(report, timeout = 30.seconds)`;
const BRACE = `}`;
const BLANK = ` `;

const SCENE_TYPES = [...CUSTOM_TYPES, 'Report'];
const SCENE_RULES: ColorRule[] = [...CODE_RULES];

interface Row {
  mc: Manticore;
  num: Txt;
  blank: boolean;
}

interface Cube {
  group: Node;
  rect: Rect;
  explicit: boolean;
}

export default makeScene2D(function* (view) {
  view.add(<Rect width={1920} height={1080} fill={'#000000'} />);

  // ── Chrome — just the filename. No time label. ─────────────────────────
  const chrome = createRef<Node>();
  view.add(
    <Node ref={chrome}>
      <Txt x={TEXT_X} y={-456} offset={[-1, 0]} text={'Reporting.kt'}
        fontFamily={Fonts.code} fontSize={20} fill={GW(0.4)} letterSpacing={1} />
      <Line points={[[40, -448], [40, 448]]} stroke={GW(0.05)} lineWidth={1.5} />
    </Node>,
  );

  // ── Stage ───────────────────────────────────────────────────────────────
  const stage = createRef<Node>();
  const activeLine = createRef<Rect>();
  const column = createRef<Node>();
  const caret = createRef<Rect>();
  const hubLayer = createRef<Node>();
  const thread = createRef<Line>();
  const threadBright = createRef<Line>();
  view.add(
    <Node ref={stage} y={TOP_Y}>
      <Line ref={thread} points={[[0, 0], [0, 0]]} stroke={GW(0.16)} lineWidth={1.4}
        lineDash={[3, 7]} opacity={0} />
      <Line ref={threadBright} points={[[0, 0], [0, 0]]} stroke={GW(0.9)} lineWidth={1.6}
        end={0} opacity={0} />
      <Rect ref={activeLine} x={ACTIVE_X} y={0} offset={[-1, 0]} width={ACTIVE_W} height={LH}
        radius={5} fill={'rgba(175, 200, 242, 0.12)'} opacity={0} />
      <Rect x={GUTTER_SEP_X} y={0} width={1.5} height={1180} fill={GW(0.06)} offset={[0, 0]} />
      <Line points={[[TEXT_X - 8, 162], [70, 162]]} stroke={GW(0.05)} lineWidth={1} />
      <Node ref={column} />
      <Rect ref={caret} x={0} y={0} width={2.5} height={FS * 0.96} radius={1}
        fill={CARET_COLOR} opacity={0} />
      <Node ref={hubLayer} />
    </Node>,
  );

  // ── The base node — `async = true`, the default everything borrows ──────
  const baseGroup = new Node({opacity: 0});
  const baseBrick = new Rect({
    x: HUB_X, y: 0, width: BASE_W, height: BASE_H, radius: 6, fill: BASE_FILL,
  });
  const baseLabel = new Txt({
    x: HUB_X, y: 0, text: 'async = true', fontFamily: Fonts.code, fontSize: 20,
    fontWeight: 600, fill: GW(0.95), letterSpacing: 1,
  });
  baseGroup.add(baseBrick);
  baseGroup.add(baseLabel);
  hubLayer().add(baseGroup);

  // ── Left: code rows (top-anchored, grows downward) ──────────────────────
  const rows: Row[] = [];

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

  // The definition (first DEF_ROWS) is pinned. Call rows below it scroll up as
  // they pile on, so the list can keep growing past the bottom of the screen.
  const DEF_ROWS = 5;
  const CALLS_MAX = 840;               // local y the newest call row sits at
  const FADE_Y = DEF_ROWS * LH - 8;    // call rows scrolled above this fade out
  let scrollY = 0;
  const updateScroll = () => {
    scrollY = Math.max(0, (rows.length - 1) * LH - CALLS_MAX);
  };
  const localY = (i: number) => (i < DEF_ROWS ? i * LH : i * LH - scrollY);
  const slotOf = (row: Row) => localY(rows.indexOf(row));
  const syncNumbers = () => {
    let n = 0;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].blank) { rows[i].num.text(''); continue; }
      n++;
      rows[i].num.text(String(n));
    }
  };

  function* layout(dur: number) {
    syncNumbers();
    const anims: any[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const ty = localY(i);
      if (Math.abs(r.mc.node.position.y() - ty) > 0.5) {
        anims.push(r.mc.node.position.y(ty, dur, easeInOutCubic));
        anims.push(r.num.position.y(ty, dur, easeInOutCubic));
      }
      const faded = i >= DEF_ROWS && ty < FADE_Y;
      const op = faded ? 0 : 1;
      if (Math.abs(r.mc.node.opacity() - op) > 0.01) {
        anims.push(r.mc.node.opacity(op, dur, easeInOutSine));
      }
      if (faded && r.num.opacity() > 0.01) {
        anims.push(r.num.opacity(0, dur, easeInOutSine));
      }
    }
    if (anims.length > 0) yield* all(...anims);
  }

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

  function* editRow(row: Row, newText: string, delay: number) {
    yield* jumpCaretTo(lineLeftX(row), slotOf(row), 0.1);
    yield* row.mc.morphTo(newText, {charDelay: delay, scrollStrategy: 'block', moveDuration: 0.18});
    caret().position.x(lineRightX(row), 0.12, linear);
  }

  // ── Right: the cube field ────────────────────────────────────────────────
  const cubes: Cube[] = [];

  const cubeCoords = (i: number) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = HUB_X + (col - (COLS - 1) / 2) * (CUBE_W + GAP);
    const y = BASE_H / 2 + GAP + CUBE_H / 2 + row * (CUBE_H + GAP);
    return [x, y] as [number, number];
  };

  const makeCube = (explicit: boolean): Cube => {
    const group = new Node({x: HUB_X, y: 0, opacity: 0});
    const rect = new Rect({
      width: CUBE_W, height: CUBE_H, radius: 5,
      fill: explicit ? EXPLICIT : INHERIT,
      stroke: explicit ? GW(0.9) : null,
      lineWidth: explicit ? 2 : 0,
    });
    group.add(rect);
    hubLayer().add(group);
    return {group, rect, explicit};
  };

  function* cubeLayout(dur: number) {
    const anims: any[] = [];
    for (let i = 0; i < cubes.length; i++) {
      const [x, y] = cubeCoords(i);
      const p = cubes[i].group.position();
      if (Math.abs(p.x - x) > 0.5 || Math.abs(p.y - y) > 0.5) {
        anims.push(cubes[i].group.position([x, y], dur, easeInOutCubic));
      }
    }
    if (anims.length > 0) yield* all(...anims);
  }

  // ── Add a call site (a code line + the cube that leans on the default) ──
  function* addCall(codeText: string, explicit: boolean, delay: number, slide: number): {row: Row; cube: Cube} {
    const row = makeRow(codeText);
    rows.push(row);
    updateScroll();
    row.mc.node.position.y(slotOf(row));
    row.num.position.y(slotOf(row));

    const cube = makeCube(explicit);
    cubes.push(cube);
    const [cx, cy] = cubeCoords(cubes.length - 1);
    cube.group.position([cx, cy]);
    cube.group.scale(0.6);

    yield* jumpCaretTo(lineLeftX(row), slotOf(row));
    yield* all(
      typeRow(row, delay, slide),
      cubeLayout(slide),
      cube.group.opacity(1, 0.3, easeInOutSine),
      cube.group.scale(1, 0.32, easeOutCubic),
    );
    return {row, cube};
  }

  function* removeCall(row: Row, cube: Cube, slide: number) {
    yield* eraseLine(row, 0.010);
    rows.splice(rows.indexOf(row), 1);
    cubes.splice(cubes.indexOf(cube), 1);
    updateScroll();
    yield* all(
      layout(slide),
      cubeLayout(slide),
      cube.group.opacity(0, 0.26, easeInOutSine),
    );
    row.mc.node.remove();
    row.num.remove();
    cube.group.remove();
  }

  // ── The frozen definition types in ──────────────────────────────────────
  const sig = makeRow(SIG);
  const bodyA = makeRow(BODY_A);
  const bodyB = makeRow(BODY_B);
  const brace = makeRow(BRACE);
  const blank = makeRow(BLANK, true);
  rows.push(sig, bodyA, bodyB, brace, blank);
  for (let i = 0; i < rows.length; i++) {
    rows[i].mc.node.position.y(i * LH);
    rows[i].num.position.y(i * LH);
  }
  syncNumbers();

  for (const r of [sig, bodyA, bodyB, brace]) {
    yield* jumpCaretTo(lineLeftX(r), slotOf(r), 0.08);
    yield* typeRow(r, 0.007, 0.001);
    if (r === sig) yield* baseGroup.opacity(1, 0.4, easeInOutSine);
  }
  yield* blank.num.opacity(GUTTER_OP, 0.12, easeInOutSine);

  // wire the default token to the base node — "this `= true` IS that base"
  const threadL = lineRightX(sig) + 16;
  const threadR = HUB_X - BASE_W / 2 - 18;
  thread().points([[threadL, 0], [threadR, 0]]);
  threadBright().points([[threadL, 0], [threadR, 0]]);
  yield* thread().opacity(1, 0.6, easeInOutSine);
  yield* blinkHold(0.6);

  // ── The call sites accumulate — almost all of them omit `async` ─────────
  // wave 1 — the first handful
  yield* addCall('reports.send(dailyDigest)', false, 0.007, 0.13);
  yield* addCall('reports.send(shipmentReceipt)', false, 0.007, 0.13);
  yield* addCall('orders.onPlaced { reports.send(it.receipt) }', false, 0.006, 0.13);
  const weekly = yield* addCall('reports.send(weeklyRollup)', false, 0.006, 0.13);
  yield* blinkHold(0.35);

  // wave 2 — the first careful caller pins the value itself
  yield* addCall('reports.send(invoice, async = false)', true, 0.007, 0.13);
  yield* addCall('reports.send(auditTrail)', false, 0.006, 0.13);
  yield* addCall('customers.forEach { reports.send(it.statement) }', false, 0.006, 0.13);
  yield* addCall('reports.send(taxSummary)', false, 0.006, 0.13);
  yield* blinkHold(0.35);

  // a job decommissioned — line and its cube both go
  yield* removeCall(weekly.row, weekly.cube, 0.13);
  // the async path quietly gets more robust — so it feels even safer to omit
  yield* editRow(bodyA, BODY_A2, 0.007);
  yield* blinkHold(0.4);

  // wave 3 — it keeps spreading
  yield* addCall('reports.send(refund, async = false)', true, 0.007, 0.13);
  const blast = yield* addCall('reports.send(marketingBlast)', false, 0.006, 0.13);
  yield* addCall('reports.send(slaBreach)', false, 0.006, 0.13);
  yield* addCall('reports.send(welcomeEmail)', false, 0.006, 0.13);
  yield* blinkHold(0.3);
  yield* addCall('webhooks.onPayment { reports.send(it.summary) }', false, 0.006, 0.13);
  const churn = yield* addCall('reports.send(churnReport)', false, 0.006, 0.13);
  // the sync path is the slow one — but nobody is on it
  yield* editRow(bodyB, BODY_B2, 0.007);
  yield* blinkHold(0.4);

  // wave 4 — and on, and on
  yield* addCall('reports.send(dunningNotice)', false, 0.006, 0.13);
  yield* addCall('reports.send(fraudAlert, async = false)', true, 0.007, 0.13);
  yield* addCall('tenants.forEach { reports.send(it.usage) }', false, 0.006, 0.13);
  yield* removeCall(blast.row, blast.cube, 0.13); // campaign ended
  yield* addCall('partners.forEach { reports.send(it.digest) }', false, 0.006, 0.13);
  yield* blinkHold(0.3);

  // someone finally notices one and pins the value — a single borrowed cube
  // becomes its own. (At the flip, it will be one of the few left standing.)
  yield* editRow(churn.row, 'reports.send(churnReport, async = false)', 0.012);
  yield* all(
    churn.cube.rect.fill(EXPLICIT, 0.3, easeInOutSine),
    churn.cube.rect.lineWidth(2, 0.3, easeInOutSine),
    churn.cube.rect.stroke(GW(0.9), 0.3, easeInOutSine),
  );
  churn.cube.explicit = true;
  yield* blinkHold(0.4);

  // wave 5 — and still it grows
  yield* addCall('reports.send(monthlyStatement)', false, 0.006, 0.13);
  yield* addCall('billing.onCharge { reports.send(it.statement) }', false, 0.006, 0.13);
  yield* addCall('reports.send(quarterlyReview)', false, 0.006, 0.13);
  yield* addCall('reports.send(retentionReport)', false, 0.006, 0.13);
  yield* addCall('regions.forEach { reports.send(it.rollup) }', false, 0.006, 0.13);
  yield* addCall('reports.send(yearEndSummary)', false, 0.006, 0.13);

  // take in how many came to lean on one default
  yield* blinkHold(1.6);

  // ── Climax — one character ──────────────────────────────────────────────
  yield* all(
    caret().opacity(0, 0.4, easeInOutSine),
    activeLine().opacity(0, 0.4, easeInOutSine),
  );

  // BEAT 1 — someone flips the default. `true` -> `false`.
  yield* editRow(sig, SIG_FALSE, 0.05);
  const igniteBit: any[] = [];
  for (const tok of sig.mc.getLine(0)!.tokens) {
    if (tok.text.includes('false')) {
      const t = tok.ref();
      t.shadowColor(ACCENT);
      igniteBit.push(t.fill(ACCENT, 0.5, easeInOutSine));
      igniteBit.push(t.shadowBlur(11, 0.5, easeInOutSine));
    }
  }
  yield* all(...igniteBit);
  yield* waitFor(0.4);

  // BEAT 1½ — the change travels the wire to the base.
  threadBright().opacity(1);
  yield* threadBright().end(1, 0.5, easeOutCubic);

  // BEAT 2 — the base flips, and every cube with no value of its own inherits
  // the new one. The explicit few keep theirs.
  yield* all(
    baseLabel.text('async = false'),
    baseBrick.fill(DANGER, 0.4, easeInOutSine),
  );
  const inheritCubes = cubes.filter(c => !c.explicit);
  for (const c of inheritCubes) {
    c.rect.fill(DANGER);
    yield* waitFor(0.05);
  }
  yield* waitFor(2.3);

  // ── Final card ──────────────────────────────────────────────────────────
  const card = createRef<Node>();
  view.add(
    <Node ref={card} opacity={0}>
      <Txt x={0} y={-26} text={'Nobody touched the default for years.'}
        fontFamily={Fonts.code} fontSize={40} letterSpacing={1} fill={GW(0.78)} />
      <Txt x={0} y={26} text={'Everyone who omitted it had been trusting it.'}
        fontFamily={Fonts.code} fontSize={40} letterSpacing={1} fill={'#F4F1EB'} />
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
