import {makeScene2D, Txt} from '@motion-canvas/2d';
import {all, createRef, easeInOutSine, waitFor} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Canon, CanonCodeTheme, paintCanonParams, paintCanonParamsLine, paintCanonMethodCalls, paintCanonMethodCallsLine} from '../core/code/model/paletteCanon';
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

  // ── Beat A: the escape hatch turns red (impl only) ─────────────────
  // line 0: ..., skipValidation: Boolean   (параметр, сигнатура в строку)
  // line 1: if (!skipValidation)           (гард в теле)

  {
    const paramLine = s.implCodes[3].getLine(0);
    const guardLine = s.implCodes[3].getLine(1);
    const anims: any[] = [];
    if (paramLine) anims.push(...paramLine.colorizeByRuleAnimated('skipValidation', METHOD_COLOR, 0.4));
    if (guardLine) anims.push(...guardLine.colorizeByRuleAnimated('skipValidation', METHOD_COLOR, 0.4));
    if (anims.length) yield* all(...anims);
  }
  yield* waitFor(1.5);

  // ── MORPH 1 (synchronized handoff): the flag AND its now-dead branch
  // leave the method ↔ validation appears at the call-site boundary. ──
  // Right carries the red flash (removed smell); the left stays clean.

  // During the morph, colour BOTH method calls and named params per line, so
  // freshly typed tokens land in their final colour instead of flashing white
  // (VAR_LIGHT) until the post-morph paintCanonParams runs.
  const recolorMorphLine = (line: any) => {
    paintCanonMethodCallsLine(line);
    paintCanonParamsLine(line);
  };

  yield* all(
    s.implCodes[3].morphTo(IMPL_AFTER, {
      removeDuration: 0.35,
      moveDuration: 0.5,
      charDelay: 0.015,
      flashRemovedColor: METHOD_COLOR,
      flashRemovedDuration: 0.2,
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
  s.implCodes[3].colorize(SHORT_RULES);
  paintCanonParams(s.implCodes[3]);
  paintCanonMethodCalls(s.implCodes[3]);
  s.implCodes[3].recenterContent();
  s.callCodes[3].colorize(SHORT_RULES);
  paintCanonParams(s.callCodes[3]);
  paintCanonMethodCalls(s.callCodes[3]);
  s.callCodes[3].recenterContent();

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

  // (No reflow step — the body is already one-liners from the start.)
  yield* waitFor(1.0);

  // ── ValidatedOrder definition appears below the method ─────────────
  // Its closing brace lines up with the closing brace of the left code;
  // the method above glides up to make room.

  const callLinesAfter = CALL_AFTER.split('\n').length;
  const callBottomY = s.callCodes[3].node.position.y() + ((callLinesAfter - 1) / 2) * CODE_LH;
  const vdLineCount = VALIDATED_ORDER.split('\n').length;
  const vdY = callBottomY - ((vdLineCount - 1) / 2) * IMPL_LH;

  const vd = Manticore.create(VALIDATED_ORDER, {
    x: IMPL_X_SHORT,
    y: vdY,
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

  // Lift the method so its real bottom line sits one blank line above the
  // definition (reads the actual bottom, so it holds for any block anchor).
  const vdTop = callBottomY - (vdLineCount - 1) * IMPL_LH;
  const implBottomLocal = s.implCodes[3].getLineY(s.implCodes[3].lineCount - 1);
  const implTargetY = vdTop - IMPL_LH * 2 - implBottomLocal;
  const implLiftY = Math.min(s.implCodes[3].node.position.y(), implTargetY);

  yield* all(
    vd.node.opacity(1, 0.6, easeInOutSine),
    s.implCodes[3].node.position.y(implLiftY, 0.6, easeInOutSine),
  );
  yield* waitFor(0.6);

  // ── Focus-pull: isolate the `from` factory + its call site ─────────
  // Classic dim-the-rest focus. Bright: the `from` method with its body
  // (the gate) on the right, and the one place it's called on the left
  // (`ValidatedOrder.from(order)`). Everything else — the process method
  // and the surrounding job class — recedes by opacity.
  const FOCUS_DIM = 0.15;
  yield* all(
    s.spotlightLines(vd, [4, 5, 6, 7, 8, 9, 10], FOCUS_DIM, 0.6),
    s.spotlightLines(s.callCodes[3], [13], FOCUS_DIM, 0.6),
    s.implCodes[3].node.opacity(FOCUS_DIM, 0.6, easeInOutSine),
  );
  yield* waitFor(2.0);

  // ── Shift focus to the process binding ─────────────────────────────
  // The validated order flows into `process`. Bring the process signature
  // (right) and its call (left) up, dim the gate, then highlight the ONE
  // parameter that carries the guarantee — `order` (whose type is now
  // ValidatedOrder, the old skipValidation flag's replacement) — at the
  // definition, where it's unwrapped into `normalize`, and at the call, and
  // blink so the binding reads. `source` is left alone: it's an ordinary
  // param, not part of the flag's story.
  yield* all(
    s.implCodes[3].node.opacity(1, 0.6, easeInOutSine),
    s.spotlightLines(s.callCodes[3], [13, 15, 16, 17, 18], FOCUS_DIM, 0.6),
    s.spotlightLines(vd, [], FOCUS_DIM, 0.6),
  );
  yield* waitFor(0.6);

  const PARAM_HL = '#FFB562';
  const paramToks: any[] = [];
  const pushToks = (line: any, names: string[]) => {
    if (!line) return;
    for (const t of line.tokens) {
      if (names.includes(t.text.trim())) paramToks.push(t.ref());
    }
  };
  pushToks(s.implCodes[3].getLine(0), ['order']);  // the parameter at the definition
  pushToks(s.implCodes[3].getLine(1), ['order']);  // the same order, unwrapped into normalize
  pushToks(s.callCodes[3].getLine(16), ['order']); // the argument at the call
  const paramOrig = paramToks.map(r => r.fill());
  yield* all(...paramToks.map(r => r.fill(PARAM_HL, 0.2, easeInOutSine)));
  for (let k = 0; k < 2; k++) {
    yield* all(...paramToks.map(r => r.opacity(0.25, 0.16, easeInOutSine)));
    yield* all(...paramToks.map(r => r.opacity(1, 0.16, easeInOutSine)));
  }
  yield* waitFor(0.8);
  yield* all(...paramToks.map((r, i) => r.fill(paramOrig[i], 0.4, easeInOutSine)));

  yield* waitFor(0.5);
  yield* all(
    s.restoreLines(vd, 0.6),
    s.restoreLines(s.callCodes[3], 0.6),
    s.implCodes[3].node.opacity(1, 0.6, easeInOutSine),
  );
  yield* waitFor(1.0);

  // ── Close morph section (the rating now blinks in at the very end) ──
  yield* all(
    s.hideCallCode(3, 0.5),
    s.hideImplCode(3, 0.5),
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
