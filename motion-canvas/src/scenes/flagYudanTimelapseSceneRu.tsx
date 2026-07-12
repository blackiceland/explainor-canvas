import {makeScene2D, Node, Txt, Circle, Rect, Line as EdgeLine} from '@motion-canvas/2d';
import {all, chain, createRef, easeInCubic, easeInOutCubic, easeInOutSine, easeOutCubic, linear, makeRef, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {Manticore} from '../core/code/components/Manticore';
import {CanonCodeTheme, buildCanonRules, paintCanonParams, paintCanonMethodCalls} from '../core/code/model/paletteCanon';
import {getCodePaddingX, measureText} from '../core/code/shared/TextMeasure';
import {Fonts} from '../core/theme';

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

// Канон-палитра кода — единый источник цвета (эталон fiveFacesPermissionSceneRuV2
// / paletteCanon): свежая лаванда типов, тил-константы, синие ключевые+числа,
// methodDef-роуз в определении + пастель-роуз на вызовах, синие поля-аргументы,
// зелёные строки. Аннотация `@Transactional` красится темой (annotation→keyword).
// Раньше сцена красилась старым локальным RULES (лиловые константы, один rose).
const CUSTOM_TYPES = [
  'RegisterCustomer', 'Customer', 'CustomerSource', 'CustomerStatus', 'CustomerPlan',
  'Boolean', 'EmailRequired', 'CustomerAlreadyExists', 'CustomerRegistered', 'Region', 'Locale',
];
const METHODS = ['register', 'save', 'findByEmail', 'findByHandle', 'trim', 'lowercase', 'start', 'schedule', 'add', 'record', 'increment', 'debug', 'validate'];

const RULES = buildCanonRules({types: CUSTOM_TYPES, methods: METHODS});

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
  '',
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
// Deliberately wide so no row loops the same few states over several seconds.
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
  '    val country = command.country',
  '    val phone = command.phone?.trim()',
  '    cache.evict(command.email)',
  '    session.touch(command.actor)',
  '    val device = command.device',
  '    val consent = command.consent == true',
  '    rateLimiter.acquire(command.actor)',
  '    val tags = command.tags.orEmpty()',
  '    val score = riskEngine.score(command)',
  '    notifications.enqueue(command.email)',
  '    val ip = command.ipAddress',
  '    featureFlags.check("register")',
  '    val handle = command.handle?.lowercase()',
  '    outbox.publish("customer.created")',
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
const TRAIL = 3;
const SHUTTER = 0.28;              // slow-shutter smear (was .345; −~20% → trains more intangible)
const TRAIN_INTANGIBLE = 0.66;    // incoming swap line materializes from a faint streak (intangible)
const SHOW_HOLD = 2.0;
const A1_SWAP = 0.28;               // short → mid: per-op swap / cadence (snappy)
const A1_CAD  = 0.34;
const A2_DUR = 6.0;                 // dense cinematic churn on the mid method
const GROW_SWAP = 0.3;              // mid → final growth: per-op swap / cadence
const GROW_CAD  = 0.55;
const SWAP_DUR = 0.3;               // snappy swap — reads as a time-lapse, not smooth editing
const CHURN_GAP = 0.36;             // flat gap between swaps (dense but render-safe)
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
  // Pure black stage (author direction: this yudan scene plays on black, like
  // the other flag scenes — not the graphite gradient/vignette of applyBackground).
  view.add(<Rect width={3200} height={2200} fill={'#000000'} />);

  const codeRoot = createRef<Node>();
  const ghostLayer = createRef<Node>();
  const lineLayer  = createRef<Node>();
  view.add(<Node ref={codeRoot} />);
  codeRoot().add(<Node ref={ghostLayer} />);
  codeRoot().add(<Node ref={lineLayer} />);

  interface Line { node: Node; text: string; home: string; mc: Manticore; }
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
      theme: CanonCodeTheme, noClip: true, cardStyle: TRANSPARENT_CARD,
      glowAccent: false, customTypes: CUSTOM_TYPES, contentOffsetX: CONTENT_OFF,
    });
    mc.mount(lineLayer());
    mc.colorize(RULES);
    paintCanonParams(mc);        // поля-аргументы `x =` → синий (канон)
    paintCanonMethodCalls(mc);   // вызовы → пастель-роуз; определение остаётся methodDef
    mc.node.opacity(op);
    return {node: mc.node, text, home, mc};
  };

  const targetY = (i: number) => (i - anchorIdx) * LH;
  const comb = (text: string, y: number, sx: number, ex: number, dur: number, ease: typeof easeInCubic, op0: number, trailN: number = TRAIL) => {
    const anims: ThreadGenerator[] = []; const ghosts: Txt[] = [];
    for (let k = 1; k <= trailN; k++) {
      const op = (SHUTTER / (k * 0.9 + 0.6)) * op0;
      const g = new Txt({x: sx, y, text: text || ' ', offset: [-1, 0], fontFamily: Fonts.code, fontSize: FS, fill: `rgba(242,240,235,${op})`});
      ghostLayer().add(g); ghosts.push(g);
      anims.push(chain(waitFor(k * 0.014), all(g.position.x(ex, dur, ease), g.opacity(0, dur, linear))));
    }
    return {anims, ghosts};
  };

  function* swapLine(i: number, newText: string, dur: number, dir: number, off: number = OFF, trailN: number = TRAIL, home?: string): ThreadGenerator {
    if (i < 0 || i >= buf.length) return;
    const old = buf[i]; const y = targetY(i); const op = opFor(i);
    const next = mkLine(newText, LINE_X + dir * off, y, op, home ?? old.home);
    next.node.opacity(op * TRAIN_INTANGIBLE);   // train materializes from a faint streak, not a solid car
    buf[i] = next;
    const gN = comb(newText, y, LINE_X + dir * off, LINE_X, dur, linear, op, trailN);
    const gO = comb(old.text, y, LINE_X, LINE_X - dir * off, dur, linear, op, trailN);
    yield* all(
      old.node.x(LINE_X - dir * off, dur, linear), old.node.opacity(0, dur * 0.92, linear),
      next.node.x(LINE_X, dur, linear), next.node.opacity(op, dur, linear), ...gN.anims, ...gO.anims,
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
    // NO vertical glide: every existing line SNAPS to its slot; only the new
    // lines move, and only horizontally (the growth IS the time-lapse swap).
    buf.forEach((l, i) => l.node.y(targetY(i)));
    const anims: ThreadGenerator[] = []; const trash: Txt[] = [];
    objs.forEach((o, k) => {
      const g = comb(o.text, targetY(pos + k), LINE_X + dir * OFF, LINE_X, dur, linear, opForText(pos + k, o.text)); trash.push(...g.ghosts);
      anims.push(chain(waitFor(k * 0.02), all(o.node.x(LINE_X, dur, linear), ...g.anims)));
    });
    yield* all(...anims); trash.forEach(g => g.remove());
  }

  function* deleteLine(pos: number, dur: number, dir: number): ThreadGenerator {
    const o = buf[pos]; buf.splice(pos, 1); if (pos < anchorIdx) anchorIdx--;
    const g = comb(o.text, o.node.y(), LINE_X, LINE_X + dir * OFF, dur, linear, 0.6);
    buf.forEach((l, i) => l.node.y(targetY(i)));            // snap, no glide
    yield* all(o.node.x(LINE_X + dir * OFF, dur, linear), ...g.anims);
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
      if (op.kind === 'chg') { yield* swapLine(cursor, op.b!, swapDur, dir, OFF, TRAIL, op.b!); cursor++; }
      else if (op.kind === 'ins') { yield* insertBlock(cursor, op.texts!, swapDur, dir); cursor += op.texts!.length; }
      else { yield* deleteLine(cursor, swapDur, dir); }
      flip++;
      yield* waitFor(Math.max(0.02, cadence - swapDur));
    }
  }

  // Keep the swapped-in variant at the SAME indentation as the slot it lands in
  // (a line inside an if-block stays 8-space indented, not dedented to 4).
  const indentOf = (s: string) => s.match(/^\s*/)?.[0] ?? '';
  const reindent = (text: string, indent: string) => indent + text.replace(/^\s+/, '');
  // Well-mixed variant pick (Knuth hash of seq⊕row) — no obvious cycle, never a
  // no-op, so a row shows a stream of DIFFERENT code, not the same few states.
  const pickVariant = (i: number, seq: number): string => {
    const cur = buf[i].text; const indent = indentOf(cur);
    for (let t = 0; t < POOL.length; t++) {
      const h = (Math.imul(seq + t + 1, 2654435761) ^ Math.imul(i + 1, 40503)) >>> 0;
      const cand = reindent(POOL[h % POOL.length], indent);
      if (cand !== cur) return cand;
    }
    return reindent(POOL[(seq + i) % POOL.length], indent);
  };
  // Per-swap MOTION character (deterministic, well-mixed): so the movement never
  // looks like one repeated slide — speed, throw distance, side and smear length
  // all vary swap-to-swap while the rhythm stays even.
  const swapStyle = (seq: number, i: number) => {
    const h = (Math.imul(seq * 2 + 1, 2246822519) ^ Math.imul(i + 1, 3266489917)) >>> 0;
    const a = (h & 1023) / 1023;
    const b = ((h >>> 10) & 1023) / 1023;
    return {
      dur: 0.2 + a * 0.34,                 // 0.20 .. 0.54  (snappy ↔ long-drag)
      off: OFF * (0.55 + b * 1.05),        // near ↔ far throw (fast ↔ slow visual)
      dir: (h >>> 20) & 1 ? 1 : -1,        // enter from either side
      trail: 2 + ((h >>> 21) % 4),         // 2 .. 5 smear length
    };
  };
  const churnOnce = function* (i: number): ThreadGenerator {
    const seq = variantPtr++;
    const st = swapStyle(seq, i);
    const p = findPartial(buf[i].text);
    // Mostly swap the WHOLE line to a fresh variant (variety); only occasionally
    // flip a single token, so no row sits oscillating A↔B for seconds.
    if (p && (seq + i) % 4 === 0) yield* partialSwap(i, p, st.dur, st.dir);
    else yield* swapLine(i, pickVariant(i, seq), st.dur, st.dir, st.off, st.trail);
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
      return chain(waitFor(d), swapLine(i, l.home, SWAP_DUR, i % 2 === 0 ? 1 : -1, OFF, TRAIL, l.home) as unknown as ThreadGenerator);
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

  // ── Beat 1a — the time-lapse STARTS immediately: churn runs while the method
  //    grows SHORT→MID (@Transactional above the kept signature, validate below,
  //    three lines at the bottom). Snappy, so the opening reads as a time-lapse. ─
  receded = true;
  churnActive = true;
  yield* all(
    chain(
      growthDiff(SHORT, MID, A1_SWAP, A1_CAD),
      (function* () { churnActive = false; })(),
    ),
    ...Array.from({length: 4}, (_, w) => churnWorker(w)),
    ...buf.map((l, i) => l.node.opacity(opFor(i), 0.4, linear)),
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

  yield* waitFor(0.7);

  // ══════════════════════════════════════════════════════════════════════════
  // CONTINUATION — the catastrophe has settled small on the LEFT.
  //   Beat 3: YUDAN (the term) blooms on the RIGHT + a short English gloss.
  //   Beat 4: push INTO the code on the left (readable scale); YUDAN sweeps off
  //           to the right as the push passes it — logical parallax, not a blink.
  //   Beat 5: scroll down the method (scaffold from registerFlagOptionsSceneRu:
  //           codeRoot.y centers a line, dim the rest) — but on the buf[] of
  //           per-line Manticores, not a single mc. On the RIGHT a fan accretes:
  //           one leaf per fork = the single flag taking on ever more
  //           responsibility, cool→red as the load compounds (yudan). No logic
  //           text — a scheme + one label, sync sells the code↔fan link.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Beat 3 — YUDAN term, GLUED to the code canvas ─────────────────────────
  // It is a CHILD of codeRoot (not a screen overlay), so the zoom transforms it
  // together with the code — logical parallax, not a detached sideways crawl.
  // Authored at screen px and counter-scaled by 1/SCALE_END so it reads at
  // natural size over the settled catastrophe. Just the label + one text style.
  const S0 = SCALE_END;                                             // codeRoot scale after Beat 2
  const centerLocal2 = ((FINAL.length - 1) / 2 - FINAL.indexOf(ANCHOR_LINE)) * LH;
  const cRootY0 = -centerLocal2 * S0;                               // codeRoot.y after Beat 2
  // Left-aligned block: the label and both lines share ONE left edge (geometric).
  // yuScreenX is that shared left edge on screen in Beat 3.
  const yuScreenX = 44, yuScreenY = -6;
  const yudan = createRef<Node>();
  const yuTitle = createRef<Txt>();
  const yuL1 = createRef<Txt>();
  const yuL2 = createRef<Txt>();
  codeRoot().add(
    <Node
      ref={yudan}
      x={(yuScreenX - LEFT_END) / S0}
      y={(yuScreenY - cRootY0) / S0}
      scale={1 / S0}
      opacity={0}
    >
      <Txt ref={yuTitle} y={-54} text={'YUDAN'} fontFamily={Fonts.primary} fontSize={136}
           fontWeight={600} letterSpacing={2} fill={'#F4F1EB'} />
      <Txt ref={yuL1} offset={[-1, 0]} x={0} y={56} text={'a slow-motion catastrophe of a lowered guard –'}
           fontFamily={Fonts.primary} fontSize={29} fill={'rgba(244,241,235,0.72)'} />
      <Txt ref={yuL2} offset={[-1, 0]} x={0} y={95} text={'each move looks safe, until the game is already lost.'}
           fontFamily={Fonts.primary} fontSize={29} fill={'rgba(244,241,235,0.72)'} />
    </Node>,
  );
  // Geometry: the two lines are left-aligned into a block (shared left edge at 0);
  // YUDAN is CENTERED over that block, not stuck to its left edge.
  const yuBlockW = Math.max(yuL1().width(), yuL2().width());
  yuTitle().x(yuBlockW / 2);
  yield* yudan().opacity(1, 0.9, easeOutCubic);            // whole label appears as one
  yield* waitFor(2.8);

  // ── Beat 4 — bring the camera to the TOP of the code with a zoom (NOT a push
  //    that shoves the code down to frame-centre). YUDAN, glued to the canvas,
  //    scales and moves WITH the code as the camera closes in, then dissolves. ─
  const READ_SCALE = 0.92;
  const READ_X = -355;   // left-anchored: keeps @Transactional/fun on-screen, forks clear of the fan
  const DIMLINE = 0.2;
  const centerY = (c: number) => -READ_SCALE * targetY(c);
  const TOP_Y = -430;                                      // @Transactional lands near the frame top
  const topFrameY = TOP_Y - READ_SCALE * targetY(0);
  const SIG_FOCUS = [0, 1, 2, 3, 4];
  const ZIN = 1.7;
  yield* all(
    codeRoot().scale(READ_SCALE, ZIN, easeInOutCubic),
    codeRoot().position([READ_X, topFrameY], ZIN, easeInOutCubic),
    yudan().opacity(0, ZIN * 0.62, easeInOutSine),         // dissolves as the canvas carries it off
    ...buf.map((l, i) => l.node.opacity(SIG_FOCUS.includes(i) ? 1 : DIMLINE, ZIN, easeInOutSine)),
  );
  yudan().remove();
  yield* waitFor(0.9);

  // ── Beat 5 — scroll the forks; the responsibility fan accretes on the right ─
  const dimExcept = (focus: number[], dur: number) =>
    buf.map((l, i) => l.node.opacity(focus.includes(i) ? 1 : DIMLINE, dur, easeInOutSine));

  // Fan HUD (screen space, drawn over the scrolling code). cool → red = the flag
  // taking on more than one job at a time until it is overloaded.
  const LOAD = ['#8FC0FF', '#C9A6E8', '#F0896F', '#FF4757'];
  // Each leaf NAMES the responsibility (a role noun, not the if-logic).
  const LEAF_LABEL = ['record source', 'trust state', 'email rule', 'side-effects'];
  const ROOT: [number, number] = [330, 12];
  const LEAF_X = 726;
  const LEAF_Y = [-156, -52, 52, 156];
  const rootDot = createRef<Circle>();
  const rootRing = createRef<Circle>();
  const leafDot: Circle[] = [];
  const leafLabel: Txt[] = [];
  const edge: EdgeLine[] = [];
  const fan = createRef<Node>();
  view.add(
    <Node ref={fan} opacity={0}>
      <Txt x={528} y={-252} text={'RESPONSIBILITIES'} fontFamily={Fonts.primary}
           fontSize={23} fontWeight={600} letterSpacing={5} fill={'rgba(244,241,235,0.5)'} />
      <Circle ref={rootRing} x={ROOT[0]} y={ROOT[1]} width={80} height={80}
              lineWidth={2} stroke={'rgba(244,241,235,0.16)'} />
      <Circle ref={rootDot} x={ROOT[0]} y={ROOT[1]} width={52} height={52} fill={'#8FC0FF'} />
      <Txt x={ROOT[0]} y={ROOT[1] + 60} text={'fromImport'} fontFamily={Fonts.code}
           fontSize={21} fill={'rgba(244,241,235,0.55)'} />
      {LEAF_Y.map((ly, i) => (
        <EdgeLine ref={makeRef(edge, i)} points={[[ROOT[0], ROOT[1]], [LEAF_X, ly]]}
                  lineWidth={2.5} stroke={LOAD[i]} end={0} opacity={0.5} />
      ))}
      {LEAF_Y.map((ly, i) => (
        <Circle ref={makeRef(leafDot, i)} x={LEAF_X} y={ly} width={30} height={30}
                fill={LOAD[i]} opacity={0} scale={0.4} />
      ))}
      {LEAF_Y.map((ly, i) => (
        <Txt ref={makeRef(leafLabel, i)} x={LEAF_X + 32} y={ly} offset={[-1, 0]}
             text={LEAF_LABEL[i]} fontFamily={Fonts.code} fontSize={20}
             fill={'rgba(244,241,235,0.62)'} opacity={0} />
      ))}
    </Node>,
  );
  yield* fan().opacity(1, 0.5, easeInOutSine);

  // Show the top, then move DOWN only (monotonic). The first fork sits near the
  // top after the zoom, so it is lit IN PLACE (no scroll-up); every later fork is
  // reached by a strictly downward scroll — no pointless down-then-up.
  const BEATS = [
    {fork: 6,  focus: [6, 7, 8],            scrollY: topFrameY},
    {fork: 13, focus: [13, 14, 15, 16],     scrollY: centerY(14)},
    {fork: 22, focus: [22, 23, 24],         scrollY: centerY(23)},
    {fork: 39, focus: [39, 40, 41, 42, 43], scrollY: centerY(41)},
  ];
  for (let b = 0; b < BEATS.length; b++) {
    const beat = BEATS[b];
    yield* all(
      codeRoot().position.y(beat.scrollY, 1.1, easeInOutCubic),
      ...dimExcept(beat.focus, 1.1),
      ...buf[beat.fork].mc.getLine(0)!.colorizeByRuleAnimated('fromImport', LOAD[b], 0.6),
      edge[b].end(1, 0.7, easeInOutCubic),
      leafDot[b].opacity(1, 0.5, easeInOutSine),
      leafDot[b].scale(1, 0.5, easeOutCubic),
      chain(waitFor(0.25), leafLabel[b].opacity(1, 0.5, easeInOutSine)),
    );
    yield* waitFor(1.6);
  }

  // The flag is overloaded — the core reddens (yudan: the safe-looking lead lost).
  yield* all(
    rootDot().fill('#FF4757', 0.7, easeInOutSine),
    rootRing().stroke('rgba(255,71,87,0.5)', 0.7, easeInOutSine),
    rootRing().lineWidth(3, 0.7, easeInOutSine),
  );
  yield* waitFor(END_HOLD);

  // ── Outro — zoom BACK OUT to the whole method at full opacity, so the viewer
  //    takes in the entire catastrophe once more; then everything fades to black.
  yield* all(
    codeRoot().scale(SCALE_END, 1.6, easeInOutCubic),
    codeRoot().position([LEFT_END, cRootY0], 1.6, easeInOutCubic),
    ...buf.map(l => l.node.opacity(1, 1.3, easeInOutSine)),   // restore full opacity (undim)
  );
  yield* waitFor(1.4);
  yield* all(
    codeRoot().opacity(0, 1.4, easeInOutSine),
    fan().opacity(0, 1.4, easeInOutSine),
  );
  yield* waitFor(0.6);

  // ── Chapter hand-off — CHAPTER 2 · YUDAN, in the same title formatting as
  //    the FACES card (chapter1YudanSceneEn PHASE 3); then the scene ends black.
  const chapterCard = createRef<Node>();
  view.add(
    <Node ref={chapterCard} opacity={0}>
      <Txt text={'CHAPTER 2'} fontFamily={Fonts.primary} fontWeight={500} fontSize={36}
           letterSpacing={12} fill={'rgba(244,241,235,0.6)'} textAlign={'center'} x={6} y={-58} />
      <Txt text={'YUDAN'} fontFamily={Fonts.primary} fontWeight={700} fontSize={96}
           letterSpacing={12} fill={'rgba(244,241,235,0.95)'} textAlign={'center'} x={6} y={48} />
    </Node>,
  );
  yield* chapterCard().opacity(1, 1.0, easeInOutCubic);
  yield* waitFor(1.4);
  yield* chapterCard().opacity(0, 1.2, easeInOutCubic);
  yield* waitFor(0.4);
});
