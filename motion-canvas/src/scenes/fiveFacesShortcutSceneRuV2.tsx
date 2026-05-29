import {makeScene2D, Txt} from '@motion-canvas/2d';
import {all, createRef, easeInOutSine, waitFor} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Fonts} from '../core/theme';
import {
  createFiveFacesStage,
  NAME_XS,
  FACES,
  CODE_RULES, CODE_LH,
  IMPL_X, IMPL_W,
  IMPL_FONT_SIZE, IMPL_LH,
  TRANSPARENT_CARD, CUSTOM_TYPES,
  METHOD_COLOR, TYPE_CLEAN, FUN_BLUE,
  blockLines,
  paintNamedParams,
} from './fiveFacesBooleanV2Setup';

// ── Morph targets — clean diffs, two impl steps + one call step ──────

// Step 1: the flag leaves — and with it the dead `if (!skipValidation)`
// branch. Order → ValidatedOrder. Body keeps its wrapped val lines.
const IMPL_STEP1 = `fun process(order: ValidatedOrder, source: OrderSource): ProcessingResult {
    val normalized = normalizer
        .normalize(order, source)
    val reserved = inventory
        .reserve(normalized)
    val payment = payments
        .authorize(normalized)

    return ProcessingResult.Accepted(
        orderId = normalized.id,
        reservationId = reserved.id,
        paymentId = payment.id,
    )
}`;

// Step 2: the body collapses to clean one-liners — cosmetic tidy-up.
const IMPL_STEP2 = `fun process(order: ValidatedOrder, source: OrderSource): ProcessingResult {
    val normalized = normalizer.normalize(order, source)
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
// cannot exist unless it came through `from`, which validates.
const VALIDATED_ORDER = `class ValidatedOrder private constructor(val order: Order) {

    companion object {
        fun from(order: Order): ValidatedOrder {
            validator.requireValid(order)
            return ValidatedOrder(order)
        }
    }
}`;

// ── Coloring ──────────────────────────────────────────────────────────

const SHORT_TYPES = [...CUSTOM_TYPES, 'ValidatedOrder'];

const SHORT_RULES: ColorRule[] = [
  ...CODE_RULES,
  {match: /^ValidatedOrder$/, color: TYPE_CLEAN},
];

// `constructor`/`companion`/`object` aren't in the tokenizer's keyword
// set — paint them as keywords so they read like `private`/`class`.
const VD_RULES: ColorRule[] = [
  ...SHORT_RULES,
  {match: /^(constructor|companion|object)$/, color: FUN_BLUE},
];

const TYPE_RULES: ColorRule[] = [
  {match: /^[A-Z][A-Za-z]*$/, color: TYPE_CLEAN},
];

// ── Scene ────────────────────────────────────────────────────────────

export default makeScene2D(function* (view) {
  const s = createFiveFacesStage(view);

  s.baseX(NAME_XS[2]);
  s.bgCover().opacity(0);

  // ── Face beat ──────────────────────────────────────────────────────

  yield* s.baseX(NAME_XS[3], 0.9, easeInOutSine);
  s.arrivalTime(view.globalTime());
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
  // line 0: ..., skipValidation: Boolean = false   (параметр)
  // line 2: if (!skipValidation)                    (гард в теле)

  {
    const paramLine = s.implCodes[3].getLine(0);
    const guardLine = s.implCodes[3].getLine(2);
    const anims: any[] = [];
    if (paramLine) anims.push(...paramLine.colorizeByRuleAnimated('skipValidation', METHOD_COLOR, 0.4));
    if (guardLine) anims.push(...guardLine.colorizeByRuleAnimated('skipValidation', METHOD_COLOR, 0.4));
    if (anims.length) yield* all(...anims);
  }
  yield* waitFor(1.5);

  // ── MORPH 1 (synchronized handoff): the flag AND its now-dead branch
  // leave the method ↔ validation appears at the call-site boundary. ──
  // Right carries the red flash (removed smell); the left stays clean.

  yield* all(
    s.implCodes[3].morphTo(IMPL_STEP1, {
      removeDuration: 0.35,
      moveDuration: 0.5,
      charDelay: 0.015,
      flashRemovedColor: METHOD_COLOR,
      flashRemovedDuration: 0.2,
      addStyle: 'typewriter',
      scrollStrategy: 'block',
    }),
    s.callCodes[3].morphTo(CALL_AFTER, {
      removeDuration: 0.3,
      moveDuration: 0.5,
      charDelay: 0.015,
      addStyle: 'typewriter',
      scrollStrategy: 'block',
    }),
  );
  s.implCodes[3].colorize(SHORT_RULES);
  paintNamedParams(s.implCodes[3]);
  s.implCodes[3].recenterContent();
  s.callCodes[3].colorize(SHORT_RULES);
  paintNamedParams(s.callCodes[3]);
  s.callCodes[3].recenterContent();
  yield* waitFor(1.5);

  // ── MORPH 2 (impl only): wrapped val lines REFLOW into one-liners ───
  // The trailing calls glide up onto their `val` line (no retype); the
  // lines below settle up to fill. reflowTo keeps the block centred.

  yield* s.implCodes[3].reflowTo(IMPL_STEP2, {duration: 0.6});
  s.implCodes[3].colorize(SHORT_RULES);
  paintNamedParams(s.implCodes[3]);
  yield* waitFor(1.0);

  // ── ValidatedOrder definition appears below the method ─────────────
  // Its closing brace lines up with the closing brace of the left code;
  // the method above glides up to make room.

  const callLinesAfter = CALL_AFTER.split('\n').length;
  const callBottomY = s.callCodes[3].node.position.y() + ((callLinesAfter - 1) / 2) * CODE_LH;
  const vdLineCount = VALIDATED_ORDER.split('\n').length;
  const vdY = callBottomY - ((vdLineCount - 1) / 2) * IMPL_LH;

  const vd = Manticore.create(VALIDATED_ORDER, {
    x: IMPL_X,
    y: vdY,
    width: IMPL_W,
    fontSize: IMPL_FONT_SIZE,
    lineHeight: IMPL_LH,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    noClip: true,
    cardStyle: TRANSPARENT_CARD,
    glowAccent: false,
    customTypes: SHORT_TYPES,
  });
  vd.mount(view);
  vd.colorize(VD_RULES);
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
  yield* waitFor(3.0);

  // ── Close morph section ────────────────────────────────────────────

  yield* s.showSmallScale(3);
  yield* waitFor(2.0);

  yield* all(
    s.hideCallCode(3, 0.5),
    s.hideImplCode(3, 0.5),
    s.hideSmallScale(3, 0.4),
    vd.node.opacity(0, 0.5, easeInOutSine),
  );
  yield* waitFor(0.5);

  // ── ENDING: "valid — by whose rules?" ──────────────────────────────
  // ValidatedOrder stays fixed and never leaves. The source-qualifier in
  // front of it can't settle — Erp, Web, Manual — so the clean name is
  // never just one. The question made literal.

  const base = Manticore.create('ValidatedOrder', {
    x: 150,
    y: 0,
    width: 760,
    fontSize: 52,
    lineHeight: 70,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
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
      fill={TYPE_CLEAN}
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

  yield* all(
    base.node.opacity(0, 0.6, easeInOutSine),
    prefix().opacity(0, 0.6, easeInOutSine),
  );
  yield* waitFor(0.4);
});
