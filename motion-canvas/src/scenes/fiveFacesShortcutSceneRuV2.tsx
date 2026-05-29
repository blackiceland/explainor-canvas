import {makeScene2D, Rect} from '@motion-canvas/2d';
import {all, createRef, easeInOutSine, waitFor} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Fonts} from '../core/theme';
import {
  createFiveFacesStage,
  NAME_XS,
  FACES,
  CODE_RULES, CODE_LH,
  CALL_X, CALL_W, IMPL_X, IMPL_W,
  IMPL_FONT_SIZE, IMPL_LH,
  TRANSPARENT_CARD, CUSTOM_TYPES,
  METHOD_COLOR, TYPE_CLEAN,
  blockLines,
  paintNamedParams,
  yForCode,
} from './fiveFacesBooleanV2Setup';

// ── Morph targets — clean diffs, two impl steps + one call step ──────

// Step 1: signature only. Order → ValidatedOrder, the flag is gone.
// Body untouched (it still references skipValidation — transitional).
const IMPL_STEP1 = `fun process(order: ValidatedOrder, source: OrderSource): ProcessingResult {
    if (!skipValidation) {
        validator.requireValid(order)
    }

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

// Step 2: the internal guard is gone — the check no longer lives here.
const IMPL_STEP2 = `fun process(order: ValidatedOrder, source: OrderSource): ProcessingResult {
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

// Call: validation appears at the boundary, the flag leaves.
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
            val validatedOrder = erpOrderValidator.validate(order)

            orderProcessor.process(
                order = validatedOrder,
                source = OrderSource.ERP_IMPORT,
            )
        }

        imports.finish(run.id)

        return ImportResult.Imported(run.id, orders.size)
    }
}`;

// Epilogue — one clean type fractures into a zoo of wrappers.
const ZOO = `ValidatedOrder
ErpValidatedOrder
WebValidatedOrder
PricedOrder
StockCheckedOrder
FraudScreenedOrder`;

// ── Coloring ──────────────────────────────────────────────────────────

const SHORT_TYPES = [...CUSTOM_TYPES, 'ValidatedOrder', 'ErpOrderValidator'];

const SHORT_RULES: ColorRule[] = [
  ...CODE_RULES,
  {match: /^(ValidatedOrder|ErpOrderValidator)$/, color: TYPE_CLEAN},
];

const ZOO_RULES: ColorRule[] = [
  {match: /^[A-Z][A-Za-z]*$/, color: TYPE_CLEAN},
];

const STRIPE_COLOR = 'rgba(255, 80, 120, 0.18)';

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

  // ── Beat A: the escape hatch turns red ─────────────────────────────
  // impl line 1: skipValidation: Boolean = false  (параметр)
  // impl line 2: if (!skipValidation)             (гард в теле)

  {
    const paramLine = s.implCodes[3].getLine(1);
    const guardLine = s.implCodes[3].getLine(2);
    const anims: any[] = [];
    if (paramLine) anims.push(...paramLine.colorizeByRuleAnimated('skipValidation', METHOD_COLOR, 0.4));
    if (guardLine) anims.push(...guardLine.colorizeByRuleAnimated('skipValidation', METHOD_COLOR, 0.4));
    if (anims.length) yield* all(...anims);
  }
  yield* waitFor(1.5);

  // ── MORPH 1: tighten the type — Order → ValidatedOrder, drop the flag

  yield* s.implCodes[3].morphTo(IMPL_STEP1, {
    removeDuration: 0.3,
    moveDuration: 0.4,
    charDelay: 0.015,
    flashRemovedColor: METHOD_COLOR,
    flashRemovedDuration: 0.2,
    addStyle: 'typewriter',
    scrollStrategy: 'block',
  });
  s.implCodes[3].colorize(SHORT_RULES);
  paintNamedParams(s.implCodes[3]);
  s.implCodes[3].recenterContent();
  yield* waitFor(1.5);

  // ── The check moves out: stripe marks the call-site flag ───────────

  const callLines = FACES[3].callCode.split('\n').length;
  const callCenterY = yForCode(FACES[3].callCode);
  const flagLineY = callCenterY + (16 - (callLines - 1) / 2) * CODE_LH;

  const stripe = createRef<Rect>();
  view.add(
    <Rect
      ref={stripe}
      x={CALL_X}
      y={flagLineY}
      width={CALL_W - 40}
      height={CODE_LH * 1.15}
      fill={STRIPE_COLOR}
      radius={4}
      opacity={0}
    />,
  );
  yield* stripe().opacity(1, 0.4, easeInOutSine);
  yield* waitFor(0.5);

  // ── MORPH 2 (synchronized): guard dissolves right ↔ validate appears left

  yield* all(
    s.implCodes[3].morphTo(IMPL_STEP2, {
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
      flashRemovedColor: METHOD_COLOR,
      flashRemovedDuration: 0.2,
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
  yield* waitFor(2.0);
  yield* stripe().opacity(0, 0.5, easeInOutSine);

  // ── Close morph section ────────────────────────────────────────────

  yield* s.showSmallScale(3);
  yield* waitFor(2.0);

  yield* all(
    s.hideCallCode(3, 0.5),
    s.hideImplCode(3, 0.5),
    s.hideSmallScale(3, 0.4),
  );
  yield* waitFor(0.5);

  // ── EPILOGUE: one type fractures into a zoo ────────────────────────

  const zooLineCount = ZOO.split('\n').length;

  const zoo = Manticore.create(ZOO, {
    x: 0,
    y: 0,
    width: 640,
    fontSize: 46,
    lineHeight: 70,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    noClip: true,
    cardStyle: TRANSPARENT_CARD,
    glowAccent: false,
    customTypes: SHORT_TYPES,
  });
  zoo.mount(view);
  zoo.colorize(ZOO_RULES);

  for (let i = 1; i < zooLineCount; i++) {
    const line = zoo.getLine(i);
    if (line) line.node.opacity(0);
  }
  zoo.node.opacity(0);

  yield* zoo.node.opacity(1, 0.5, easeInOutSine);
  yield* waitFor(1.0);

  for (let i = 1; i < zooLineCount; i++) {
    const line = zoo.getLine(i);
    if (line) yield* line.node.opacity(1, 0.3, easeInOutSine);
    yield* waitFor(0.45);
  }
  yield* waitFor(3.0);

  yield* zoo.node.opacity(0, 0.6, easeInOutSine);
  yield* waitFor(0.4);
});
