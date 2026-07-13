import {makeScene2D, Node, Txt, blur} from '@motion-canvas/2d';
import {all, chain, createRef, easeInOutCubic, easeInOutSine, easeOutCubic, linear, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Canon, CanonCodeTheme, buildCanonRules, paintCanonParams, paintCanonParamsLine, paintCanonMethodCalls, paintCanonMethodCallsLine} from '../core/code/model/paletteCanon';
import {getCodePaddingX} from '../core/code/shared/TextMeasure';
import {Fonts} from '../core/theme';
import {
  createFiveFacesStage,
  NAME_XS,
  FACES,
  CODE_RULES, CANON_CODE_RULES, CODE_LH,
  IMPL_X, IMPL_W,
  IMPL_FONT_SIZE, IMPL_LH,
  TRANSPARENT_CARD, CUSTOM_TYPES,
  METHOD_COLOR, TYPE_CLEAN, FUN_BLUE,
  blockLines,
  paintNamedParams,
} from './fiveFacesBooleanV2Setup';

// ── Morph targets — clean diffs, two impl steps + one call step ──────

// After-state: the flag leaves — and with it the dead `if (!skipValidation)`
// branch. Order → ValidatedOrder. The body is already one-liners (the impl
// starts that way now), so this is a single clean morph, no reflow step.
const IMPL_AFTER = `fun process(order: ValidatedOrder, source: OrderSource): ProcessingResult {
    val normalized = normalizer.normalize(order.value, source)
    val reserved = inventory.reserve(normalized)
    val payment = payments.authorize(normalized)

    return ProcessingResult.Accepted(
        orderId = normalized.id,
        reservationId = reserved.id,
        paymentId = payment.id,
    )
}`;

// Call: the order crosses an explicit validation boundary, the flag leaves.
const CALL_AFTER = `@Service
class ErpOrderImportJob(

    private val parser: ErpOrderParser,
    private val orderProcessor: OrderProcessor,
    private val imports: ImportRunRepository,
) {

    fun importOrders(file: UploadedFile): ImportResult {
        val orders = parser.parse(file)
        val run = imports.start(file.name, orders.size)

        orders.forEach { order ->
            val validatedOrder = ValidatedOrder.from(order)

            orderProcessor.process(
                order = validatedOrder,
                source = OrderSource.ERP_IMPORT,
            )
        }

        imports.finish(run.id)

        return ImportResult.Imported(run.id, orders.size)
    }
}`;

// The type that carries the guarantee — a closed constructor means it
// cannot exist unless it came through `from`, and the gate is shown, not
// hidden in a helper: an invalid order throws here and never reaches
// `process`. Rules are a pure ruleset (OrderRules), not an injected bean — a
// companion can't hold one, and a guarantee that depends on mutable state
// would be a lie. Stable rules also seed the ending — one ruleset here, but whose?
const VALIDATED_ORDER = `class ValidatedOrder private constructor(val value: Order) {

    companion object {

        fun from(order: Order): ValidatedOrder {
            if (!OrderRules.isValid(order)) {
                throw InvalidOrder(order.id)
            }

            return ValidatedOrder(order)
        }
    }
}`;

// ── Coloring ──────────────────────────────────────────────────────────

const SHORT_TYPES = [...CUSTOM_TYPES, 'ValidatedOrder', 'OrderRules', 'InvalidOrder'];

const SHORT_RULES: ColorRule[] = [
  ...CANON_CODE_RULES,
  {match: /^ValidatedOrder$/, color: Canon.type},
];

// `constructor`/`companion`/`object` aren't in the tokenizer's keyword
// set — paint them as keywords so they read like `private`/`class`.
const VD_RULES: ColorRule[] = [
  ...SHORT_RULES,
  {match: /^(constructor|companion|object)$/, color: FUN_BLUE},
];

const TYPE_RULES: ColorRule[] = [
  {match: /^[A-Z][A-Za-z]*$/, color: Canon.type},
];

// Glow for the instant the flag's meaning lands in the type (vs PERMISSION,
// where it split into two method names). A cool type-coloured halo.
const GLOW_TYPE = 'rgba(201,180,255,0.45)';

// ── YUDAN growth — the flag stays, the system grows under it ───────────
// Same time-lapse language as flagYudanTimelapseSceneRu: new lines arrive as
// motion-blur streaks and SNAP into place. The buffer OVERLAYS the original impl
// exactly (same position, size, single-line signature) and grows it in place —
// the signature never moves, only the body grows DOWNWARD off the frame. Then
// the CONTRACT morphs from the grown state (single-line sig edited on its line).
// (Seed = FACES[3].implCode = IMPL_SHORTCUT, so no separate GROWN_START.)

// Grown: years of work accreted AFTER the same unreconsidered `if`. Pricing,
// shipping, persistence, outbox, audit — an unvalidated order now reaches all of
// it. The method grows UPWARD (each new line pushes the ones above it up).
const GROWN = `fun process(order: Order, source: OrderSource, skipValidation: Boolean): ProcessingResult {
    if (!skipValidation) {
        validator.requireValid(order)
    }

    val normalized = normalizer.normalize(order, source)
    val priced = pricing.calculate(normalized)
    val reserved = inventory.reserve(priced)
    val payment = payments.authorize(priced)
    val shipment = shipping.schedule(priced, reserved)

    val saved = orders.save(
        order = priced,
        reservationId = reserved.id,
        paymentId = payment.id,
        shipmentId = shipment.id,
    )

    outbox.add(OrderProcessed(saved.id))
    audit.recordProcessed(saved.id, source)

    return ProcessingResult.Accepted(saved.id, reserved.id, payment.id, shipment.id)
}`;

// Contract morphed FROM the grown state: the signature line is edited IN PLACE
// (order: Order → order: ValidatedOrder, the flag leaves the same line), the dead
// guard dissolves, the pipeline stays and rises to fill the gap. Only the input
// contract changed; `order` → `order.value` at the one spot the raw value is used.
const GROWN_AFTER = `fun process(order: ValidatedOrder, source: OrderSource): ProcessingResult {
    val normalized = normalizer.normalize(order.value, source)
    val priced = pricing.calculate(normalized)
    val reserved = inventory.reserve(priced)
    val payment = payments.authorize(priced)
    val shipment = shipping.schedule(priced, reserved)

    val saved = orders.save(priced, reserved.id, payment.id, shipment.id)

    outbox.add(OrderProcessed(saved.id))
    audit.recordProcessed(saved.id, source)

    return ProcessingResult.Accepted(saved.id, reserved.id, payment.id, shipment.id)
}`;

const GROW_TYPES = [...SHORT_TYPES, 'OrderProcessed'];

const GROWTH_RULES: ColorRule[] = buildCanonRules({
  types: GROW_TYPES,
  methods: ['process', 'requireValid', 'normalize', 'calculate', 'reserve',
    'authorize', 'schedule', 'save', 'add', 'recordProcessed'],
  vars: ['order', 'source', 'normalized', 'priced', 'reserved', 'payment',
    'shipment', 'saved', 'validator', 'normalizer', 'pricing', 'inventory',
    'payments', 'shipping', 'orders', 'outbox', 'audit'],
});

// ── Line diff (LCS) — from flagYudanTimelapseSceneRu, drives the growth ─
type GDOp = {kind: 'keep' | 'chg' | 'ins' | 'del'; b?: string};
function diffLines(a: string[], b: string[]): GDOp[] {
  const n = a.length, m = b.length;
  const dp = Array.from({length: n + 1}, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const raw: GDOp[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { raw.push({kind: 'keep'}); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { raw.push({kind: 'del'}); i++; }
    else { raw.push({kind: 'ins', b: b[j]}); j++; }
  }
  while (i < n) { raw.push({kind: 'del'}); i++; }
  while (j < m) { raw.push({kind: 'ins', b: b[j]}); j++; }
  const out: GDOp[] = [];
  for (let k = 0; k < raw.length; k++) {
    if (raw[k].kind === 'del' && raw[k + 1]?.kind === 'ins') { out.push({kind: 'chg', b: raw[k + 1].b}); k++; }
    else out.push(raw[k]);
  }
  return out;
}
type GGOp = {kind: 'keep' | 'chg' | 'ins' | 'del'; b?: string; texts?: string[]};
function groupOps(ops: GDOp[]): GGOp[] {
  const out: GGOp[] = []; let i = 0;
  while (i < ops.length) {
    if (ops[i].kind === 'ins') { const texts: string[] = []; while (i < ops.length && ops[i].kind === 'ins') { texts.push(ops[i].b!); i++; } out.push({kind: 'ins', texts}); }
    else { out.push(ops[i]); i++; }
  }
  return out;
}

// Predict gGrowthDiff's total duration so a concurrent camera move (the rise) can
// match it. Every non-keep op — including each inserted line individually — costs
// one cadence step (the growth types lines in ONE AT A TIME, not as a block).
function growDuration(from: string[], to: string[], swapDur: number, cadence: number): number {
  const step = swapDur + Math.max(0.02, cadence - swapDur);
  let t = 0;
  for (const op of groupOps(diffLines(from, to))) {
    if (op.kind === 'keep') continue;
    t += (op.kind === 'ins' ? op.texts!.length : 1) * step;
  }
  return t;
}

// ── Scene ────────────────────────────────────────────────────────────

export default makeScene2D(function* (view) {
  const s = createFiveFacesStage(view);

  // Канон-палитра на код лица (начальный вид — setup красил старым CODE_RULES)
  s.callCodes[3].colorize(SHORT_RULES);
  paintCanonParams(s.callCodes[3]);
  paintCanonMethodCalls(s.callCodes[3]);
  s.implCodes[3].colorize(SHORT_RULES);
  paintCanonParams(s.implCodes[3]);
  paintCanonMethodCalls(s.implCodes[3]);

  // Nudge the right (impl) column left — the wider single-line signature needs
  // the extra right-edge margin (−50), plus a further −10 balance tweak. The
  // ValidatedOrder def below shares this x.
  const IMPL_X_SHORT = IMPL_X - 60;
  s.implCodes[3].node.position.x(IMPL_X_SHORT);
  // Balance: code 10px left, animation 10px right.
  s.callCodes[3].node.position.x(s.callCodes[3].node.position.x() - 10);
  s.shortcutViz().position.x(s.shortcutViz().position.x() + 10);

  s.baseX(NAME_XS[3]);
  s.bgCover().opacity(1);
  s.bgCover().moveToTop();   // above the spotlight + names, so this is a true black screen

  // ── Face beat ──────────────────────────────────────────────────────

  // Cold open: black screen, then the flashlight is revealed already parked on
  // SHORTCUT — no slide-in from a neighbouring face.
  yield* waitFor(0.45);
  s.arrivalTime(view.globalTime());
  yield* s.bgCover().opacity(0, 1.4, easeInOutSine);
  yield* waitFor(0.18);
  yield* s.showCallCode(3);
  yield* waitFor(4.5);
  yield* all(
    s.spotlightLines(s.callCodes[3], blockLines(FACES[3].callBlock), 0.32, 0.55),
    s.showImplCode(3),
    s.showViz(3),
  );
  yield* waitFor(2.0);
  yield* s.shortcutDriver();
  yield* s.restoreLines(s.callCodes[3], 0.8);
  yield* waitFor(1.2);
  yield* s.hideViz(3, 0.5);
  yield* waitFor(1.0);

  // ══════════════════════════════════════════════════════════════════════
  // YUDAN GROWTH — the flag stays; the system grows under it, off the frame.
  // The compact impl hands off to a per-line time-lapse buffer (signature
  // anchored at the top, body grows downward). Then the CONTRACT morphs from
  // the grown state, and the big body recedes into the compact after-state the
  // rest of the scene already expects.
  // ══════════════════════════════════════════════════════════════════════

  // During the morph, colour BOTH method calls and named params per line, so
  // freshly typed tokens land in their final colour (used by the call morph).
  const recolorMorphLine = (line: any) => {
    paintCanonMethodCallsLine(line);
    paintCanonParamsLine(line);
  };

  // Grow the original method IN PLACE. Build a per-line buffer that overlays
  // implCodes[3] EXACTLY (same left edge, size), swap to it invisibly. The method
  // grows UPWARD: the buffer is BOTTOM-anchored — the last line stays put and each
  // new line pushes everything ABOVE it up (no smooth camera pan).
  const origImpl = s.implCodes[3];
  const implHomeX = origImpl.node.position.x();
  const G_X = implHomeX + origImpl.getLeftEdge();                    // shared text left edge
  const G_SIG_Y = origImpl.node.position.y() + origImpl.getLineY(0); // original signature line
  // Anchor the buffer's bottom at the original method's bottom line, so the seed
  // overlays it and growth pushes the signature up from there.
  const GROW_BOTTOM_Y = origImpl.node.position.y() + origImpl.getLineY(origImpl.lineCount - 1);

  // ── Buffer geometry — MATCHES the impl exactly (no size/position change) ──
  const GFS = IMPL_FONT_SIZE, GLH = IMPL_LH, GW = IMPL_W;
  const GOFF = GW / 2 - getCodePaddingX(GFS);
  const G_THROW = 900;         // ghost-tail streak distance (stays off the left call)
  const G_TRAIL = 7;
  const G_SHUTTER = 0.85;
  const G_BLUR = 2;

  const growRoot = createRef<Node>();
  const gGhost = createRef<Node>();
  const gLine = createRef<Node>();
  view.add(<Node ref={growRoot} x={G_X} y={GROW_BOTTOM_Y} />);
  growRoot().add(<Node ref={gGhost} />);   // token comet-tails (the streak)
  growRoot().add(<Node ref={gLine} />);    // the sharp lines, shown at rest
  gGhost().cache(true);
  gGhost().cachePadding(G_BLUR * 2 + 16);
  gGhost().filters([blur(G_BLUR)]);

  interface GLn { node: Node; text: string; mc: Manticore; }
  const gbuf: GLn[] = [];
  // Bottom-anchored: the last line sits at local y=0, earlier lines above it.
  // Adding a line (length grows) shifts every existing line UP by one GLH.
  const gTargetY = (i: number) => (i - (gbuf.length - 1)) * GLH;

  const gMk = (text: string, y: number, op: number): GLn => {
    const mc = Manticore.create(text || ' ', {
      x: 0, y, width: GW, fontSize: GFS, lineHeight: GLH, fontFamily: Fonts.code,
      theme: CanonCodeTheme, noClip: true, cardStyle: TRANSPARENT_CARD,
      glowAccent: false, customTypes: GROW_TYPES, contentOffsetX: GOFF,
    });
    mc.mount(gLine());
    mc.colorize(GROWTH_RULES);
    paintCanonParams(mc);
    paintCanonMethodCalls(mc);
    mc.node.opacity(op);
    return {node: mc.node, text, mc};
  };

  // Slow-shutter tail: a token's copies sampled along its path, strong at the
  // head, fading down a long streak; the light gaussian just fuses the seams.
  const gComb = (text: string, y: number, sx: number, ex: number, dur: number, op0: number, trailN = G_TRAIL) => {
    const anims: ThreadGenerator[] = []; const ghosts: Txt[] = [];
    for (let k = 1; k <= trailN; k++) {
      const op = (G_SHUTTER / (k * 0.72 + 0.55)) * op0;
      const g = new Txt({x: sx, y, text: text || ' ', offset: [-1, 0], fontFamily: Fonts.code, fontSize: GFS, fill: `rgba(242,240,235,${op})`});
      gGhost().add(g); ghosts.push(g);
      anims.push(chain(waitFor(k * 0.024), all(g.position.x(ex, dur, linear), g.opacity(0, dur, linear))));
    }
    return {anims, ghosts};
  };

  function* gSwap(i: number, newText: string, dur: number, dir: number): ThreadGenerator {
    const old = gbuf[i]; const y = gTargetY(i);
    const next = gMk(newText, y, 0); gbuf[i] = next;
    const gN = gComb(newText, y, dir * G_THROW, 0, dur, 1);
    const gO = gComb(old.text, y, 0, -dir * G_THROW, dur, 1);
    yield* all(
      old.node.opacity(0, dur * 0.3, linear),
      chain(waitFor(dur * 0.72), next.node.opacity(1, dur * 0.28, linear)),
      ...gN.anims, ...gO.anims,
    );
    old.node.remove(); [...gN.ghosts, ...gO.ghosts].forEach(g => g.remove());
  }

  function* gInsert(pos: number, texts: string[], dur: number, dir: number): ThreadGenerator {
    const objs = texts.map(t => gMk(t, 0, 0));
    const objSet = new Set(objs);
    gbuf.splice(pos, 0, ...objs);
    const anims: ThreadGenerator[] = []; const trash: Txt[] = [];
    // Bottom-anchored: the new line lands at its slot; every line ABOVE it glides
    // UP by one GLH to make room (this IS the "raise what's above" per new line).
    gbuf.forEach((l, i) => {
      const ny = gTargetY(i);
      if (objSet.has(l)) l.node.y(ny);
      else anims.push(l.node.y(ny, dur, easeOutCubic));
    });
    objs.forEach((o, k) => {
      const g = gComb(o.text, gTargetY(pos + k), dir * G_THROW, 0, dur, 1); trash.push(...g.ghosts);
      anims.push(chain(waitFor(k * 0.02), all(...g.anims, chain(waitFor(dur * 0.72), o.node.opacity(1, dur * 0.28, linear)))));
    });
    yield* all(...anims); trash.forEach(g => g.remove());
  }

  // Delete with a SMOOTH rise of the survivors — the contract morph reads as the
  // body lifting to fill the gap, not a stutter of snaps.
  function* gDelete(pos: number, dur: number, dir: number): ThreadGenerator {
    const o = gbuf[pos]; gbuf.splice(pos, 1);
    const g = gComb(o.text, o.node.y(), 0, dir * G_THROW, dur, 0.7);
    yield* all(
      o.node.opacity(0, dur * 0.3, linear),
      ...g.anims,
      ...gbuf.map((l, i) => l.node.y(gTargetY(i), dur, easeInOutCubic)),
    );
    o.node.remove(); g.ghosts.forEach(x => x.remove());
  }

  function* gGrowthDiff(fromArr: string[], toArr: string[], swapDur: number, cadence: number, smoothDelete = false): ThreadGenerator {
    const grouped = groupOps(diffLines(fromArr, toArr));
    const gap = Math.max(0.02, cadence - swapDur);
    let cursor = 0, flip = 0;
    for (const op of grouped) {
      if (op.kind === 'keep') { cursor++; continue; }
      if (op.kind === 'chg') {
        const dir = flip % 2 === 0 ? 1 : -1; flip++;
        yield* gSwap(cursor, op.b!, swapDur, dir); cursor++;
        yield* waitFor(gap);
      } else if (op.kind === 'ins') {
        // Type inserted lines in ONE AT A TIME (not as a block), each from an
        // alternating side, so the time-lapse reads as line-by-line accretion.
        for (const text of op.texts!) {
          const dir = flip % 2 === 0 ? 1 : -1; flip++;
          yield* gInsert(cursor, [text], swapDur, dir); cursor++;
          yield* waitFor(gap);
        }
      } else {
        const dir = flip % 2 === 0 ? 1 : -1; flip++;
        yield* gDelete(cursor, smoothDelete ? swapDur * 1.3 : swapDur, dir);
        yield* waitFor(gap);
      }
    }
  }

  const clearGhosts = () => [...gGhost().children()].forEach(n => n.remove());

  // ── Boolean glow — skipValidation stays lit the whole time it's on screen ──
  // The signature + guard lines are kept verbatim through the growth, so glowing
  // them once (right after the seed) holds until the contract morph removes the
  // flag. Re-applied to grownMc after the buffer→Manticore hand-off.
  const glowFlagTokens = (mc: Manticore) => {
    for (let i = 0; i < mc.lineCount; i++) {
      const ln = mc.getLine(i);
      if (!ln) continue;
      for (const t of ln.tokens) {
        const tx = t.text.trim();
        if (tx === 'skipValidation' || tx === 'Boolean') {
          const r = t.ref();
          r.shadowColor(r.fill());
          r.shadowBlur(24);
        }
      }
    }
  };

  // ── Seed the buffer with the EXACT current method, cut over invisibly ─
  const seed = FACES[3].implCode.split('\n');
  seed.forEach(t => gbuf.push(gMk(t, 0, 1)));
  gbuf.forEach((l, i) => l.node.y(gTargetY(i)));   // bottom-anchored (full length known)
  for (const l of gbuf) glowFlagTokens(l.mc);   // flag glows from the first frame
  origImpl.node.opacity(0);   // instant swap — the buffer already draws identical pixels
  yield* waitFor(0.6);

  // ── GROW UPWARD ─────────────────────────────────────────────────────
  // Lines type in one-by-one; each new line pushes everything ABOVE it up
  // (bottom-anchored). No smooth camera pan — the rise IS the per-line push.
  const growSeq = GROWN.split('\n');
  yield* gGrowthDiff(seed, growSeq, 0.3, 0.5);
  clearGhosts();
  yield* waitFor(0.6);

  // Where the buffer's final signature line ended up — grownMc + the morph
  // anchor to it (top-anchored from here so the compact form leaves room below).
  const GROW_SIG_FINAL = GROW_BOTTOM_Y - (gbuf.length - 1) * GLH;

  // ── Convert the time-lapse buffer into ONE Manticore, so the contract morph
  //    uses the SAME visual logic as PERMISSION (Manticore.morphTo, no
  //    time-lapse). grownMc overlays the buffer exactly, then the buffer is cut. ─
  const grownMc = Manticore.create(GROWN, {
    x: implHomeX, y: 0, width: GW,
    fontSize: GFS, lineHeight: GLH, fontFamily: Fonts.code,
    theme: CanonCodeTheme, noClip: true, cardStyle: TRANSPARENT_CARD,
    glowAccent: false, customTypes: GROW_TYPES,
  });
  grownMc.mount(view);
  grownMc.colorize(GROWTH_RULES);
  paintCanonParams(grownMc);
  paintCanonMethodCalls(grownMc);
  grownMc.node.opacity(1);
  grownMc.node.position.y(GROW_SIG_FINAL - grownMc.getLineY(0));   // signature on the grown line
  glowFlagTokens(grownMc);
  growRoot().remove();
  origImpl.node.remove();
  s.implCodes[3] = grownMc;
  yield* waitFor(0.9);

  // ── CONTRACT MORPH — same visual logic as PERMISSION (Manticore.morphTo, no
  //    time-lapse): the flag + dead guard flash red and leave, the pipeline stays
  //    and types back in place, the signature is edited on its own line.
  //    Synchronised with the call-site gaining ValidatedOrder.from(order). ──────
  yield* all(
    grownMc.morphTo(GROWN_AFTER, {
      removeDuration: 0.35,
      moveDuration: 0.5,
      charDelay: 0.015,
      flashRemovedColor: METHOD_COLOR,
      flashRemovedDuration: 0.25,
      addStyle: 'typewriter',
      scrollStrategy: 'block',
      recolorLine: recolorMorphLine,
    }),
    s.callCodes[3].morphTo(CALL_AFTER, {
      removeDuration: 0.3,
      moveDuration: 0.5,
      charDelay: 0.015,
      addStyle: 'typewriter',
      scrollStrategy: 'block',
      recolorLine: recolorMorphLine,
    }),
  );
  grownMc.colorize(GROWTH_RULES);
  paintCanonParams(grownMc);
  paintCanonMethodCalls(grownMc);
  grownMc.node.position.y(GROW_SIG_FINAL - grownMc.getLineY(0));   // keep the signature on its line
  s.callCodes[3].colorize(SHORT_RULES);
  paintCanonParams(s.callCodes[3]);
  paintCanonMethodCalls(s.callCodes[3]);
  s.callCodes[3].recenterContent();
  yield* waitFor(1.2);

  // ── Contrast with PERMISSION ───────────────────────────────────────
  // Permission split the verb into two named methods. Here the flag's
  // meaning concentrates into a noun — the type. Glow ValidatedOrder where
  // it just displaced `Order`: the guarantee now lives in the type itself.
  {
    const sigLine = s.implCodes[3].getLine(0);
    if (sigLine) {
      yield* sigLine.setTokensGlow(['ValidatedOrder'], 12, GLOW_TYPE, 0.4);
      yield* waitFor(0.7);
      yield* sigLine.resetTokensGlow(['ValidatedOrder'], 0.5);
    }
  }
  yield* waitFor(0.8);

  yield* waitFor(1.0);

  // ── ValidatedOrder definition appears BELOW the compact method ──────
  // Now that the body is inlined, both fit: the whole system (method, top) and
  // the gate that guarantees the type (definition, below). The method never
  // disappears — it just softens to context while the gate takes focus.
  const vd = Manticore.create(VALIDATED_ORDER, {
    x: IMPL_X_SHORT,
    y: 0,
    width: IMPL_W,
    fontSize: IMPL_FONT_SIZE,
    lineHeight: IMPL_LH,
    fontFamily: Fonts.code,
    theme: CanonCodeTheme,
    noClip: true,
    cardStyle: TRANSPARENT_CARD,
    glowAccent: false,
    customTypes: SHORT_TYPES,
  });
  vd.mount(view);
  vd.colorize(VD_RULES);
  paintCanonMethodCalls(vd);
  vd.node.opacity(0);

  // Dock the definition one blank line under the method's real bottom.
  const methodBottomY = grownMc.node.position.y() + grownMc.getLineY(grownMc.lineCount - 1);
  const vdLineCount = VALIDATED_ORDER.split('\n').length;
  vd.node.position.y(methodBottomY + IMPL_LH * 2 + ((vdLineCount - 1) / 2) * IMPL_LH);

  yield* vd.node.opacity(1, 0.7, easeInOutSine);
  yield* waitFor(0.8);

  // ── Focus-pull: the gate takes focus; the method softens to context ─
  // Bright: the gate (a private constructor can't be forged) below, and
  // `ValidatedOrder.from(order)` on the left. The method dims but stays.
  const FOCUS_DIM = 0.15;
  yield* all(
    s.spotlightLines(vd, [4, 5, 6, 7, 8, 9, 10], FOCUS_DIM, 0.6),
    s.spotlightLines(s.callCodes[3], [13], FOCUS_DIM, 0.6),
    grownMc.node.opacity(0.32, 0.6, easeInOutSine),
  );
  yield* waitFor(2.0);

  // ── Trace `order`: the raw one into the gate, then the same binding through
  //    the whole method — signature, its unwrap, and the call that feeds it. ──
  const PARAM_HL = '#FFB562';
  const pushToks = (bucket: any[], line: any, names: string[]) => {
    if (!line) return;
    for (const t of line.tokens) {
      if (names.includes(t.text.trim())) bucket.push(t.ref());
    }
  };
  const blinkOrder = function* (toks: any[]): ThreadGenerator {
    if (!toks.length) return;
    const orig = toks.map(r => r.fill());
    yield* all(...toks.map(r => r.fill(PARAM_HL, 0.2, easeInOutSine)));
    for (let k = 0; k < 2; k++) {
      yield* all(...toks.map(r => r.opacity(0.25, 0.16, easeInOutSine)));
      yield* all(...toks.map(r => r.opacity(1, 0.16, easeInOutSine)));
    }
    yield* waitFor(0.6);
    yield* all(...toks.map((r, i) => r.fill(orig[i], 0.4, easeInOutSine)));
  };

  // Gate beat: the raw order enters the gate.
  const gateToks: any[] = [];
  pushToks(gateToks, s.callCodes[3].getLine(13), ['order']);   // ValidatedOrder.from(order)
  pushToks(gateToks, vd.getLine(4), ['order']);                // fun from(order: Order)
  yield* blinkOrder(gateToks);
  yield* waitFor(0.5);

  // Shift to the process binding: the method comes forward, the gate recedes, and
  // the SAME order blinks across the big method — the param, its use, the call.
  yield* all(
    grownMc.node.opacity(1, 0.6, easeInOutSine),
    s.spotlightLines(vd, [], FOCUS_DIM, 0.6),
    s.spotlightLines(s.callCodes[3], [13, 15, 16, 17, 18], FOCUS_DIM, 0.6),
  );
  yield* waitFor(0.5);

  const bindToks: any[] = [];
  pushToks(bindToks, grownMc.getLine(0), ['order']);           // process(order: ValidatedOrder)
  pushToks(bindToks, grownMc.getLine(1), ['order']);           // normalizer.normalize(order.value…)
  pushToks(bindToks, s.callCodes[3].getLine(16), ['order']);   // order = validatedOrder (feeds process)
  yield* blinkOrder(bindToks);

  yield* waitFor(0.5);
  yield* all(
    s.restoreLines(vd, 0.6),
    s.restoreLines(s.callCodes[3], 0.6),
    grownMc.node.opacity(1, 0.6, easeInOutSine),   // method back to full — both read together
  );
  yield* waitFor(1.0);

  // ── Close — fade method + call + type; the rating blinks over the ending ──
  yield* all(
    s.hideCallCode(3, 0.5),
    grownMc.node.opacity(0, 0.5, easeInOutSine),
    vd.node.opacity(0, 0.5, easeInOutSine),
  );
  yield* waitFor(0.5);

  // ── ENDING: "valid — by whose rules?" ──────────────────────────────
  // ValidatedOrder stays fixed and never leaves. The source-qualifier in
  // front of it can't settle — Erp, Web, Manual — so the clean name is
  // never just one. The question made literal.

  const base = Manticore.create('ValidatedOrder', {
    x: 200,
    y: 0,
    width: 760,
    fontSize: 52,
    lineHeight: 70,
    fontFamily: Fonts.code,
    theme: CanonCodeTheme,
    noClip: true,
    cardStyle: TRANSPARENT_CARD,
    glowAccent: false,
    customTypes: SHORT_TYPES,
  });
  base.mount(view);
  base.colorize(TYPE_RULES);
  base.node.opacity(0);

  yield* base.node.opacity(1, 0.5, easeInOutSine);
  yield* waitFor(1.2);

  // The prefix docks against the left edge of ValidatedOrder, reading as
  // one continuous type name.
  const dockX = base.node.position.x() + base.getLeftEdge();
  const SLIDE = 90;

  const prefix = createRef<Txt>();
  view.add(
    <Txt
      ref={prefix}
      x={dockX}
      y={0}
      offset={[1, 0]}
      text={''}
      fontFamily={Fonts.code}
      fontSize={52}
      fill={Canon.type}
      opacity={0}
    />,
  );

  const sources = ['Erp', 'Web', 'Manual'];
  for (let i = 0; i < sources.length; i++) {
    prefix().text(sources[i]);
    prefix().position.x(dockX - SLIDE);
    yield* all(
      prefix().position.x(dockX, 0.4, easeInOutSine),
      prefix().opacity(1, 0.4, easeInOutSine),
    );
    yield* waitFor(i === sources.length - 1 ? 1.8 : 1.3);
    if (i < sources.length - 1) {
      yield* all(
        prefix().position.x(dockX - SLIDE, 0.35, easeInOutSine),
        prefix().opacity(0, 0.35, easeInOutSine),
      );
    }
  }

  // ── Rating: blinks in now, once the ending is on screen — the same
  //    beat the other faces use (fade in, blink twice, then hold). ────
  yield* s.showSmallScale(3);
  const scaleNode = s.smallScaleNodes[3]();
  yield* waitFor(0.25);
  for (let k = 0; k < 2; k++) {
    yield* scaleNode.opacity(0.18, 0.16, easeInOutSine);
    yield* scaleNode.opacity(1, 0.16, easeInOutSine);
  }
  yield* waitFor(1.2);

  yield* all(
    base.node.opacity(0, 0.6, easeInOutSine),
    prefix().opacity(0, 0.6, easeInOutSine),
    s.hideSmallScale(3, 0.6),
  );
  yield* waitFor(0.4);
});
