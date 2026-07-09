import {makeScene2D, Node, Txt} from '@motion-canvas/2d';
import {all, chain, createRef, easeInCubic, easeInOutCubic, easeOutCubic, linear, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingX, measureText} from '../core/code/shared/TextMeasure';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// ─────────────────────────────────────────────────────────────────────────
// YUDAN
//   0. Show a SHORT register method (blank lines around the if block).
//   1. 8s of the approved cinematic time-lapse ON it: every BODY line/part
//      churns at once (whole-line swaps to different code + partial token swaps).
//      The method stays WHOLE — the signature, returns, braces, block headers
//      and the blank separators never churn; @Transactional appears above and
//      the body grows. Only the `if (fromImport)` block is fully static.
//   2. The SAME swap time-lapse EXPANDS the method to the final size while the
//      camera zooms out LEFT; the churn then stops and the code settles onto the
//      catastrophe so the last line is ready BEFORE the zoom-out finishes.
// ─────────────────────────────────────────────────────────────────────────

const VAR_LIGHT   = 'rgba(244,241,235,0.96)';
const TYPE_LILAC  = 'rgba(201,180,255,0.86)';
const METHOD_ROSE = '#FF8CA3';
const CONST_LILAC = 'rgba(201,180,255,0.84)';
const KEY_BLUE    = 'rgba(163,205,255,0.9)';

const CUSTOM_TYPES = [
  'RegisterCustomer', 'Customer', 'CustomerSource', 'CustomerStatus', 'CustomerPlan',
  'Boolean', 'EmailRequired', 'CustomerAlreadyExists', 'CustomerRegistered', 'Region', 'Locale',
];
const METHODS = ['register', 'save', 'findByEmail', 'findByHandle', 'trim', 'lowercase', 'start', 'schedule', 'add', 'record', 'increment', 'debug', 'validate'];

const RULES: ColorRule[] = [
  {match: /^[a-z][a-zA-Z0-9_]*$/, color: VAR_LIGHT},
  {match: /^[A-Z][a-zA-Z0-9]*$/, color: TYPE_LILAC, onlyTypes: ['type'] as const},
  {match: new RegExp('^(' + CUSTOM_TYPES.join('|') + ')$'), color: TYPE_LILAC},
  {match: /^[a-z][a-zA-Z0-9_]*$/, color: METHOD_ROSE, onlyTypes: ['method'] as const},
  {match: new RegExp('^(' + METHODS.join('|') + ')$'), color: METHOD_ROSE},
  {match: /^[A-Z][A-Z0-9_]+$/, color: CONST_LILAC},
  {match: /^(class|object|fun|val|var|private|public|internal|return|if|else|is|in|when|for|while|throw|null|true|false)$/, color: KEY_BLUE},
  {match: /^@\w+$/, color: KEY_BLUE},
];

const TRANSPARENT_CARD = {
  radius: 0, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)', strokeWidth: 0,
  edge: false, opacity: 0, shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
  shadowOffsetX: 0, shadowOffsetY: 0,
} as const;

const ANCHOR_LINE = '    if (fromImport) {';

// Short source method — blank line BEFORE and AFTER the if block.
const SHORT = [
  'fun register(command: RegisterCustomer, fromImport: Boolean): Customer {',
  '    var email = command.email',
  '    var source = CustomerSource.SIGN_UP',
  '',
  '    if (fromImport) {',
  '        source = CustomerSource.IMPORT',
  '    }',
  '',
  '    return customers.save(Customer(email, source))',
  '}',
];

// After beat-1 edits: @Transactional above the (unchanged) signature, validate
// below it, and three lines at the bottom. The signature, `return` and `}` are
// KEPT verbatim across SHORT/MID/FINAL, so register is never removed. Every MID
// line is also in FINAL (so MID→FINAL is pure inserts).
const MID = [
  '@Transactional',
  'fun register(command: RegisterCustomer, fromImport: Boolean): Customer {',
  '    validate(command)',
  '    var email = command.email',
  '    var source = CustomerSource.SIGN_UP',
  '',
  '    if (fromImport) {',
  '        source = CustomerSource.IMPORT',
  '    }',
  '',
  '    var status = CustomerStatus.PENDING',
  '    val existing = customers.findByEmail(email)',
  '    val saved = customers.save(customer)',
  '    return saved',
  '}',
];

const FINAL = [
  '@Transactional',
  'fun register(command: RegisterCustomer, fromImport: Boolean): Customer {',
  '    validate(command)',
  '    var email = command.email',
  '    var source = CustomerSource.SIGN_UP',
  '',
  '    if (fromImport) {',
  '        source = CustomerSource.IMPORT',
  '    }',
  '',
  '    var verified = command.emailVerified',
  '    var status = CustomerStatus.PENDING',
  '',
  '    if (fromImport) {',
  '        verified = true',
  '        status = CustomerStatus.ACTIVE',
  '    }',
  '',
  '    if (email != null) {',
  '        email = email.trim().lowercase()',
  '    }',
  '',
  '    if (!fromImport && email == null) {',
  '        throw EmailRequired()',
  '    }',
  '',
  '    val existing = customers.findByEmail(email)',
  '',
  '    if (existing != null && fromImport) {',
  '        return existing',
  '    }',
  '',
  '    if (existing != null) {',
  '        throw CustomerAlreadyExists(existing.id)',
  '    }',
  '',
  '    val customer = Customer(email, source, verified, status)',
  '    val saved = customers.save(customer)',
  '',
  '    if (!fromImport) {',
  '        verification.start(saved.id)',
  '        outbox.add(CustomerRegistered(saved.id))',
  '        welcomeMessages.schedule(saved.id)',
  '    }',
  '',
  '    return saved',
  '}',
];

// Throwaway variants the lines churn THROUGH (different code, never identical).
const POOL = [
  '    logger.debug("register", command.email)',
  '    val now = clock.instant()',
  '    metrics.increment("customer.register")',
  '    require(command.email != null)',
  '    val region = command.region ?: Region.EU',
  '    var attempts = command.attempts ?: 0',
  '    val plan = command.plan ?: CustomerPlan.FREE',
  '    val referrer = command.referrer',
  '    audit.record(command.actor)',
  '    val locale = command.locale ?: Locale.ROOT',
  '    val trimmed = command.email?.trim()',
  '    source = CustomerSource.REFERRAL',
];

const TOKEN_SWAPS: [string, string][] = [
  ['CustomerStatus.PENDING', 'CustomerStatus.ACTIVE'],
  ['CustomerSource.SIGN_UP', 'CustomerSource.IMPORT'],
  ['command.emailVerified', 'command.verifiedAt'],
  ['customers.findByEmail', 'customers.findByHandle'],
  ['CustomerPlan.FREE', 'CustomerPlan.BUSINESS'],
];
function affixLens(a: string, b: string): [number, number] {
  const n = Math.min(a.length, b.length);
  let p = 0; while (p < n && a[p] === b[p]) p++;
  let s = 0; while (s < n - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  return [p, s];
}
function findPartial(text: string): {head: string; tail: string; aMid: string; bMid: string; next: string} | null {
  for (const [a, b] of TOKEN_SWAPS) {
    let idx = text.indexOf(a); let from = a, to = b;
    if (idx < 0) { idx = text.indexOf(b); from = b; to = a; }
    if (idx < 0) continue;
    const [p, s] = affixLens(from, to);
    const start = idx + p, end = idx + from.length - s;
    const bMid = to.slice(p, to.length - s);
    return {head: text.slice(0, start), tail: text.slice(end), aMid: from.slice(p, from.length - s), bMid, next: text.slice(0, start) + bMid + text.slice(end)};
  }
  return null;
}

// The load-bearing frame of the method — never churned into random code so the
// method stays whole: signature, annotation, returns, braces, block headers,
// and the blank separators between logical blocks.
const isBlankT  = (t: string) => t.trim() === '';
const isSigT    = (t: string) => /\bfun register\b/.test(t);
const isAnnotT  = (t: string) => t.trimStart().startsWith('@');
const isReturnT = (t: string) => t.trimStart().startsWith('return');
const isBraceT  = (t: string) => t.trim() === '}';
const isHeadT   = (t: string) => t.trimEnd().endsWith('{');
const isFrameT  = (t: string) => isSigT(t) || isAnnotT(t) || isReturnT(t) || isBraceT(t) || isHeadT(t);

// ── Geometry / timing ────────────────────────────────────────────────────────
const FS = 26;
const LH = 38;
const W  = 1700;
const PAD_X = getCodePaddingX(FS);
const CONTENT_OFF = W / 2 - PAD_X;
const LINE_X = -560;
const OFF = 1600;
const OFF_TOK = 300;
const TRAIL = 4;
const SHOW_HOLD = 2.0;
const A1_SWAP = 0.35;               // short → mid: per-op swap / cadence
const A1_CAD  = 0.5;
const A2_DUR = 6.0;                 // dense cinematic churn on the mid method
const GROW_SWAP = 0.3;              // mid → final growth: per-op swap / cadence
const GROW_CAD  = 0.55;
const SWAP_DUR = 0.4;
const CHURN_GAP = 0.2;              // flat, dense gap between swaps (steady flow)
const SETTLE_STAGGER = 0.9;         // settle finishes inside the zoom window
const SCALE_END = 0.55;
const LEFT_END = -520;
const END_HOLD = 2.0;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ── Diff ─────────────────────────────────────────────────────────────────────
type Op = {kind: 'keep' | 'chg' | 'ins' | 'del'; b?: string};
function diffLines(a: string[], b: string[]): Op[] {
  const n = a.length, m = b.length;
  const dp = Array.from({length: n + 1}, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const raw: Op[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { raw.push({kind: 'keep'}); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { raw.push({kind: 'del'}); i++; }
    else { raw.push({kind: 'ins', b: b[j]}); j++; }
  }
  while (i < n) { raw.push({kind: 'del'}); i++; }
  while (j < m) { raw.push({kind: 'ins', b: b[j]}); j++; }
  const out: Op[] = [];
  for (let k = 0; k < raw.length; k++) {
    if (raw[k].kind === 'del' && raw[k + 1]?.kind === 'ins') { out.push({kind: 'chg', b: raw[k + 1].b}); k++; }
    else out.push(raw[k]);
  }
  return out;
}
type GOp = {kind: 'keep' | 'chg' | 'ins' | 'del'; b?: string; texts?: string[]};
function groupOps(ops: Op[]): GOp[] {
  const out: GOp[] = []; let i = 0;
  while (i < ops.length) {
    if (ops[i].kind === 'ins') { const texts: string[] = []; while (i < ops.length && ops[i].kind === 'ins') { texts.push(ops[i].b!); i++; } out.push({kind: 'ins', texts}); }
    else { out.push(ops[i]); i++; }
  }
  return out;
}

// Predict how long growthDiff(from,to,swapDur,cadence) takes, so the zoom can be
// sized to end just after the settle. Mirrors insertBlock's per-line stagger
// (`dur*0.08 + k*0.02` lead + `dur*0.92` move ⇒ a block of L lines takes
// dur + (L-1)*0.02) and the per-op cadence wait.
function growDuration(from: string[], to: string[], swapDur: number, cadence: number): number {
  const gap = Math.max(0.02, cadence - swapDur);
  let t = 0;
  for (const op of groupOps(diffLines(from, to))) {
    if (op.kind === 'keep') continue;
    const opDur = op.kind === 'ins' ? swapDur + (op.texts!.length - 1) * 0.02 : swapDur;
    t += opDur + gap;
  }
  return t;
}

// ── Scene ──────────────────────────────────────────────────────────────────
export default makeScene2D(function* (view) {
  applyBackground(view);

  const codeRoot = createRef<Node>();
  const ghostLayer = createRef<Node>();
  const lineLayer  = createRef<Node>();
  view.add(<Node ref={codeRoot} />);
  codeRoot().add(<Node ref={ghostLayer} />);
  codeRoot().add(<Node ref={lineLayer} />);

  interface Line { node: Node; text: string; home: string; }
  const buf: Line[] = [];
  let anchorIdx = 0;
  let receded = false;
  let churnActive = false;
  let variantPtr = 0;

  const isStatic = (i: number) => i >= anchorIdx && i <= anchorIdx + 2;
  // A line is left alone by the churn if it is the anchor block, a blank
  // separator, or part of the load-bearing frame (register / return / braces).
  const noChurn = (i: number) => isStatic(i) || isBlankT(buf[i].text) || isFrameT(buf[i].text);
  const restOp = (i: number) => lerp(0.72, 0.34, Math.min(Math.abs(i - anchorIdx), 10) / 10);
  // Opacity from (index, text) — safe to call before a line is spliced into buf.
  const opForText = (i: number, text: string) => {
    if (!receded) return 1;
    if (isStatic(i)) return 1;                    // anchor if-block: brightest focus
    if (isFrameT(text)) return 0.85;              // method skeleton stays readable
    return restOp(i);                             // churning body: dimmed
  };
  const opFor = (i: number) => opForText(i, buf[i].text);

  const mkLine = (text: string, x: number, y: number, op: number, home: string): Line => {
    const mc = Manticore.create(text || ' ', {
      x, y, width: W, fontSize: FS, lineHeight: LH, fontFamily: Fonts.code,
      theme: DryFiltersV3CodeTheme, noClip: true, cardStyle: TRANSPARENT_CARD,
      glowAccent: false, customTypes: CUSTOM_TYPES, contentOffsetX: CONTENT_OFF,
    });
    mc.mount(lineLayer());
    mc.colorize(RULES);
    mc.node.opacity(op);
    return {node: mc.node, text, home};
  };

  const targetY = (i: number) => (i - anchorIdx) * LH;
  const layoutShift = (dur: number) => all(...buf.map((l, i) => l.node.y(targetY(i), dur, linear)));
  const comb = (text: string, y: number, sx: number, ex: number, dur: number, ease: typeof easeInCubic, op0: number) => {
    const anims: ThreadGenerator[] = []; const ghosts: Txt[] = [];
    for (let k = 1; k <= TRAIL; k++) {
      const op = (0.3 / (k * 0.9 + 0.6)) * op0;
      const g = new Txt({x: sx, y, text: text || ' ', offset: [-1, 0], fontFamily: Fonts.code, fontSize: FS, fill: `rgba(242,240,235,${op})`});
      ghostLayer().add(g); ghosts.push(g);
      anims.push(chain(waitFor(k * 0.014), all(g.position.x(ex, dur, ease), g.opacity(0, dur, linear))));
    }
    return {anims, ghosts};
  };

  function* swapLine(i: number, newText: string, dur: number, dir: number, home?: string): ThreadGenerator {
    if (i < 0 || i >= buf.length) return;
    const old = buf[i]; const y = targetY(i); const op = opFor(i);
    const next = mkLine(newText, LINE_X + dir * OFF, y, op, home ?? old.home);
    buf[i] = next;
    const gN = comb(newText, y, LINE_X + dir * OFF, LINE_X, dur, linear, op);
    const gO = comb(old.text, y, LINE_X, LINE_X - dir * OFF, dur, linear, op);
    yield* all(
      old.node.x(LINE_X - dir * OFF, dur, linear), old.node.opacity(0, dur * 0.92, linear),
      next.node.x(LINE_X, dur, linear), ...gN.anims, ...gO.anims,
    );
    old.node.remove(); [...gN.ghosts, ...gO.ghosts].forEach(g => g.remove());
  }

  function* partialSwap(i: number, p: NonNullable<ReturnType<typeof findPartial>>, dur: number, dir: number): ThreadGenerator {
    const old = buf[i]; const y = targetY(i); const op = opFor(i); const home = old.home;
    const slotX = LINE_X + measureText(p.head, FS);
    const oldTailX = slotX + measureText(p.aMid, FS);
    const newTailX = slotX + measureText(p.bMid, FS);
    // Commit the resolved line to buf IMMEDIATELY (kept hidden) so a concurrent
    // insertBlock splice shifts the right entry — no orphaned node at the end.
    const resolved = mkLine(p.next, LINE_X, y, op, home);
    resolved.node.opacity(0);
    buf[i] = resolved;
    old.node.remove();
    const head = mkLine(p.head, LINE_X, y, op, p.head);
    const tail = p.tail.length ? mkLine(p.tail, oldTailX, y, op, p.tail) : null;
    const anims: ThreadGenerator[] = []; const trash: Txt[] = [];
    let om: Line | null = null, nm: Line | null = null;
    if (p.aMid.length) {
      om = mkLine(p.aMid, slotX, y, op, p.aMid);
      const g = comb(p.aMid, y, slotX, slotX - dir * OFF_TOK, dur, linear, op); trash.push(...g.ghosts);
      anims.push(om.node.x(slotX - dir * OFF_TOK, dur, linear), om.node.opacity(0, dur * 0.9, linear), ...g.anims);
    }
    if (p.bMid.length) {
      nm = mkLine(p.bMid, slotX + dir * OFF_TOK, y, op, p.bMid);
      const g = comb(p.bMid, y, slotX + dir * OFF_TOK, slotX, dur, linear, op); trash.push(...g.ghosts);
      anims.push(nm.node.x(slotX, dur, linear), ...g.anims);
    }
    if (tail && Math.abs(newTailX - oldTailX) > 0.5) anims.push(tail.node.x(newTailX, dur, linear));
    yield* all(...anims);
    head.node.remove(); tail?.node.remove(); om?.node.remove(); nm?.node.remove(); trash.forEach(g => g.remove());
    resolved.node.opacity(op);
  }

  function* insertBlock(pos: number, texts: string[], dur: number, dir: number): ThreadGenerator {
    const objs = texts.map((t, k) => mkLine(t, LINE_X + dir * OFF, 0, opForText(pos + k, t), t));
    buf.splice(pos, 0, ...objs);
    if (pos <= anchorIdx) anchorIdx += texts.length;
    const anims: ThreadGenerator[] = [layoutShift(dur)]; const trash: Txt[] = [];
    objs.forEach((o, k) => {
      o.node.y(targetY(pos + k));
      const g = comb(o.text, targetY(pos + k), LINE_X + dir * OFF, LINE_X, dur, linear, opForText(pos + k, o.text)); trash.push(...g.ghosts);
      anims.push(chain(waitFor(dur * 0.08 + k * 0.02), all(o.node.x(LINE_X, dur * 0.92, linear), ...g.anims)));
    });
    yield* all(...anims); trash.forEach(g => g.remove());
  }

  function* deleteLine(pos: number, dur: number, dir: number): ThreadGenerator {
    const o = buf[pos]; buf.splice(pos, 1); if (pos < anchorIdx) anchorIdx--;
    const g = comb(o.text, o.node.y(), LINE_X, LINE_X + dir * OFF, dur, linear, 0.6);
    yield* all(o.node.x(LINE_X + dir * OFF, dur, linear), layoutShift(dur), ...g.anims);
    o.node.remove(); g.ghosts.forEach(g2 => g2.remove());
  }

  // Apply a diff from `fromArr`→`toArr`, one structural op every `cadence`
  // seconds (each op's swap runs for `swapDur`). cadence ≥ swapDur keeps the
  // total duration predictable so the settle can be gated inside the zoom.
  function* growthDiff(fromArr: string[], toArr: string[], swapDur: number, cadence: number): ThreadGenerator {
    const grouped = groupOps(diffLines(fromArr, toArr));
    let cursor = 0, flip = 0;
    for (const op of grouped) {
      const dir = flip % 2 === 0 ? 1 : -1;
      if (op.kind === 'keep') { cursor++; continue; }
      if (op.kind === 'chg') { yield* swapLine(cursor, op.b!, swapDur, dir, op.b!); cursor++; }
      else if (op.kind === 'ins') { yield* insertBlock(cursor, op.texts!, swapDur, dir); cursor += op.texts!.length; }
      else { yield* deleteLine(cursor, swapDur, dir); }
      flip++;
      yield* waitFor(Math.max(0.02, cadence - swapDur));
    }
  }

  const churnOnce = function* (i: number): ThreadGenerator {
    const p = findPartial(buf[i].text);
    const dir = i % 2 === 0 ? 1 : -1;
    if (p) yield* partialSwap(i, p, SWAP_DUR, dir);
    else yield* swapLine(i, POOL[variantPtr++ % POOL.length], SWAP_DUR, dir);
  };
  // per-line churn (fixed structure) — every non-static line at once. Uniform
  // rhythm: flat gap between swaps + a low-discrepancy phase offset spread evenly
  // across the cycle (golden-ratio, not a modulo) so the stream is a steady
  // even flow, not clustered pulses.
  const churnPeriod = SWAP_DUR + CHURN_GAP;
  function* churnLine(i: number): ThreadGenerator {
    yield* waitFor(((i * 0.6180339887) % 1) * churnPeriod);
    while (churnActive) {
      if (!noChurn(i)) yield* churnOnce(i); else yield* waitFor(SWAP_DUR);
      yield* waitFor(CHURN_GAP);
    }
  }
  // worker churn (survives index shifts during growth)
  const pickChurn = (guess: number): number => {
    const N = buf.length;
    for (let t = 0; t < N; t++) { const i = ((guess + t) % N + N) % N; if (!noChurn(i)) return i; }
    return -1;
  };
  function* churnWorker(w: number): ThreadGenerator {
    while (churnActive) {
      const i = pickChurn(w * 5 + variantPtr + 1);
      if (i >= 0) yield* churnOnce(i); else yield* waitFor(SWAP_DUR);
      yield* waitFor(CHURN_GAP);
    }
  }

  function* settle(): ThreadGenerator {
    churnActive = false;
    receded = false;
    const N = buf.length;
    yield* all(...buf.map((l, i) => {
      const d = (Math.abs(i - anchorIdx) / N) * SETTLE_STAGGER;
      if (isStatic(i) || l.text === l.home) return chain(waitFor(d), l.node.opacity(1, 0.5, linear));
      return chain(waitFor(d), swapLine(i, l.home, SWAP_DUR, i % 2 === 0 ? 1 : -1, l.home) as unknown as ThreadGenerator);
    }));
    // Sweep any orphan nodes left by churn/growth races — the final frame must
    // be exactly the catastrophe, nothing doubled over a settled line.
    const live = new Set(buf.map(l => l.node));
    [...lineLayer().children()].forEach(n => { if (!live.has(n)) n.remove(); });
    [...ghostLayer().children()].forEach(n => n.remove());
  }

  // ── Beat 0 — show the short method. ───────────────────────────────────────
  anchorIdx = SHORT.indexOf(ANCHOR_LINE);
  SHORT.forEach((t, i) => buf.push(mkLine(t, LINE_X, (i - anchorIdx) * LH, 0, t)));
  yield* all(...buf.map(l => l.node.opacity(1, 0.6, easeOutCubic)));
  yield* waitFor(SHOW_HOLD);

  // ── Beat 1a — the edits: @Transactional above the (kept) signature, validate
  //    below it, and three lines grow at the bottom; register / return / } stay. ─
  receded = true;
  yield* all(
    growthDiff(SHORT, MID, A1_SWAP, A1_CAD),
    ...buf.map((l, i) => l.node.opacity(opFor(i), 0.5, easeOutCubic)),
  );

  // ── Beat 1b — cinematic time-lapse: every body line churns at once; the
  //    signature, return, braces and blank separators stay put (method whole). ─
  churnActive = true;
  yield* all(
    ...buf.map((_, i) => noChurn(i) ? waitFor(0) : churnLine(i)),
    chain(waitFor(A2_DUR), (function* () { churnActive = false; })()),
  );

  // ── Beat 2 — expand to the final size with the SAME swap time-lapse, moving
  //    together with the zoom; then the churn STOPS and the code settles onto the
  //    catastrophe so the last line is ready BEFORE the zoom-out finishes. ──────
  churnActive = true;
  const finalAnchor = FINAL.indexOf(ANCHOR_LINE);
  const centerLocal = ((FINAL.length - 1) / 2 - finalAnchor) * LH;
  // Size the zoom off the ACTUAL content timeline: growth → drain → settle, plus
  // a short tail so the camera keeps moving a beat after the catastrophe lands.
  const drainT  = SWAP_DUR + 0.1;
  const settleT = SETTLE_STAGGER + Math.max(SWAP_DUR, 0.5) + 0.05;
  const contentT = growDuration(MID, FINAL, GROW_SWAP, GROW_CAD) + drainT + settleT;
  const zoomDur = contentT + 0.85;   // camera glides to rest a beat after the code lands
  yield* all(
    all(
      codeRoot().scale(SCALE_END, zoomDur, easeInOutCubic),
      codeRoot().position([LEFT_END, -centerLocal * SCALE_END], zoomDur, easeInOutCubic),
    ),
    ...Array.from({length: 6}, (_, w) => churnWorker(w)),
    chain(
      growthDiff(MID, FINAL, GROW_SWAP, GROW_CAD),
      (function* () { churnActive = false; })(),
      waitFor(drainT),
      settle(),
    ),
  );

  yield* waitFor(END_HOLD);
});
