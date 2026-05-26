import {makeScene2D} from '@motion-canvas/2d';
import {Rect} from '@motion-canvas/2d';
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
  METHOD_COLOR, PARAM_DARK, FUN_BLUE,
  blockLines,
  paintNamedParams,
  yForCode,
  NAMED_PARAMS,
} from './fiveFacesBooleanV2Setup';

// ── Morph targets — two-step impl morph for clean diffs ──────────────

// Step 1: only the signature changes.
// silent: Boolean → mode: NotificationMode. Body untouched.
const IMPL_STEP1 = `fun send(user: User, message: Message, mode: NotificationMode): Delivery {
    val options = if (silent) {
        PushOptions.Silent
    } else {
        PushOptions.Default
    }

    return pushGateway.send(
        recipient = user.deviceToken,
        message = message,
        options = options,
    )
}`;

// Step 2: body changes. if/else → when.
// SILENT-first so PushOptions.Silent stays on its line, Default stays on its.
const IMPL_STEP2 = `fun send(user: User, message: Message, mode: NotificationMode): Delivery {
    val options = when (mode) {
        NotificationMode.SILENT -> PushOptions.Silent
        NotificationMode.DEFAULT -> PushOptions.Default
    }

    return pushGateway.send(
        recipient = user.deviceToken,
        message = message,
        options = options,
    )
}`;

// Call: one line changes.
const CALL_MODE_AFTER = `@Service
class ShipmentNotificationService(

    private val templates: MessageTemplateRepository,
    private val notifier: CustomerNotifier,
    private val deliveries: DeliveryRepository,
) {

    fun notifyShipmentCreated(order: Order): DeliveryResult {
        val template = templates.require("shipment.created")

        val message = template.render(mapOf(
            "firstName" to order.customer.firstName,
            "trackingNumber" to order.trackingNumber,
            "deliveryDate" to order.estimatedDeliveryDate,
        ))

        val delivery = notifier.send(
            user = order.customer,
            message = message,
            mode = NotificationMode.SILENT,
        )

        deliveries.save(order.id, message.id, delivery.id)

        return DeliveryResult.Sent(delivery.id)
    }
}`;

// Enum appears below send as a separate block.
const ENUM_CODE = `enum class NotificationMode {
    DEFAULT,
    SILENT,
}`;

// ── Extended coloring ────────────────────────────────────────────────

const MODE_TYPES = [...CUSTOM_TYPES, 'NotificationMode'];

const MODE_RULES: ColorRule[] = [
  ...CODE_RULES,
  {match: /^(when|enum)$/, color: FUN_BLUE},
];

const MODE_PARAMS = [...NAMED_PARAMS, 'mode'];

const paintModeParams = (code: Manticore): void => {
  for (let lineIdx = 0; lineIdx < code.lineCount; lineIdx++) {
    const line = code.getLine(lineIdx);
    if (!line) continue;
    const toks = line.tokens;
    for (let i = 0; i < toks.length; i++) {
      const tok = toks[i];
      if (!MODE_PARAMS.includes(tok.text)) continue;
      let p = i - 1;
      while (p >= 0 && toks[p].text.trim() === '') p--;
      const prev = p >= 0 ? toks[p].text.trim() : '';
      if (prev === 'val' || prev === 'var') continue;
      let n = i + 1;
      while (n < toks.length && toks[n].text.trim() === '') n++;
      if (n < toks.length && toks[n].text.trim() === '=') {
        tok.ref().fill(PARAM_DARK);
      }
    }
  }
};

const STRIPE_COLOR = 'rgba(255, 80, 120, 0.18)';

// ── Scene ────────────────────────────────────────────────────────────

export default makeScene2D(function* (view) {
  const s = createFiveFacesStage(view);

  s.baseX(NAME_XS[0]);
  s.bgCover().opacity(0);

  // ── Face beat ──────────────────────────────────────────────────────

  yield* s.baseX(NAME_XS[1], 0.9, easeInOutSine);
  s.arrivalTime(view.globalTime());
  yield* waitFor(0.18);
  yield* s.showCallCode(1);
  yield* waitFor(4.5);
  yield* all(
    s.spotlightLines(s.callCodes[1], blockLines(FACES[1].callBlock), 0.32, 0.55),
    s.showImplCode(1),
    s.showViz(1),
  );
  yield* waitFor(2.0);
  yield* s.modeDriver();
  yield* s.restoreLines(s.callCodes[1], 0.8);
  yield* waitFor(1.2);
  yield* s.hideViz(1, 0.5);
  yield* waitFor(1.0);

  // ── MORPH 1: rename the parameter ──────────────────────────────────
  // Both `silent` tokens turn red simultaneously.

  {
    const sigLine = s.implCodes[1].getLine(0);
    const ifLine = s.implCodes[1].getLine(1);
    const anims: any[] = [];
    if (sigLine) anims.push(sigLine.colorizeByRuleAnimated('silent', METHOD_COLOR, 0.4));
    if (ifLine) anims.push(ifLine.colorizeByRuleAnimated('silent', METHOD_COLOR, 0.4));
    if (anims.length) yield* all(...anims);
  }
  yield* waitFor(1.5);

  yield* s.implCodes[1].morphTo(IMPL_STEP1, {
    removeDuration: 0.3,
    moveDuration: 0.4,
    charDelay: 0.015,
    addStyle: 'typewriter',
    scrollStrategy: 'block',
  });
  s.implCodes[1].colorize(MODE_RULES);
  paintModeParams(s.implCodes[1]);
  s.implCodes[1].recenterContent();

  // Re-apply red on the remaining `silent` in if() (morph rebuilt tokens).
  {
    const ifLine = s.implCodes[1].getLine(1);
    if (ifLine) yield* ifLine.colorizeByRuleAnimated('silent', METHOD_COLOR, 0.4);
  }
  yield* waitFor(1.5);

  // ── MORPH 2: if/else → when ────────────────────────────────────────
  // PushOptions.Silent stays on its line, Default stays on its.

  yield* s.implCodes[1].morphTo(IMPL_STEP2, {
    removeDuration: 0.3,
    moveDuration: 0.5,
    charDelay: 0.015,
    addStyle: 'typewriter',
    scrollStrategy: 'block',
  });
  s.implCodes[1].colorize(MODE_RULES);
  paintModeParams(s.implCodes[1]);
  s.implCodes[1].recenterContent();
  yield* waitFor(2.0);

  // ── Enum + call-site stripe appear together ────────────────────────

  // Enum below the send function.
  const implLines = IMPL_STEP2.split('\n').length;
  const implNodeY = s.implCodes[1].node.position.y();
  const implBottomY = implNodeY + ((implLines - 1) * IMPL_LH) / 2;
  const enumLines = ENUM_CODE.split('\n').length;
  const enumY = implBottomY + IMPL_LH * 2 + ((enumLines - 1) * IMPL_LH) / 2;

  const enumMC = Manticore.create(ENUM_CODE, {
    x: IMPL_X,
    y: enumY,
    width: IMPL_W,
    fontSize: IMPL_FONT_SIZE,
    lineHeight: IMPL_LH,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    noClip: true,
    cardStyle: TRANSPARENT_CARD,
    glowAccent: false,
    customTypes: MODE_TYPES,
  });
  enumMC.mount(view);
  enumMC.colorize(MODE_RULES);
  enumMC.node.opacity(0);

  // Stripe on the call-site line that will change (line 20: silent = true).
  const callLines = FACES[1].callCode.split('\n').length;
  const callCenterY = yForCode(FACES[1].callCode);
  const lineY = callCenterY + (20 - (callLines - 1) / 2) * CODE_LH;

  const stripe = createRef<Rect>();
  view.add(
    <Rect
      ref={stripe}
      x={CALL_X}
      y={lineY}
      width={CALL_W - 40}
      height={CODE_LH * 1.15}
      fill={STRIPE_COLOR}
      radius={4}
      opacity={0}
    />,
  );

  // Both appear at once.
  yield* all(
    enumMC.node.opacity(1, 0.55, easeInOutSine),
    stripe().opacity(1, 0.4, easeInOutSine),
  );
  yield* waitFor(1.0);

  // ── MORPH 3: call site — silent = true → mode = NotificationMode.SILENT

  yield* s.callCodes[1].morphTo(CALL_MODE_AFTER, {
    removeDuration: 0.3,
    moveDuration: 0.4,
    charDelay: 0.015,
    addStyle: 'typewriter',
    scrollStrategy: 'block',
  });
  s.callCodes[1].colorize(MODE_RULES);
  paintModeParams(s.callCodes[1]);
  s.callCodes[1].recenterContent();
  yield* waitFor(2.5);
  yield* stripe().opacity(0, 0.5, easeInOutSine);

  // ── Close ──────────────────────────────────────────────────────────

  yield* s.showSmallScale(1);
  yield* waitFor(2.0);

  yield* all(
    s.hideCallCode(1, 0.5),
    s.hideImplCode(1, 0.5),
    s.hideSmallScale(1, 0.4),
    enumMC.node.opacity(0, 0.5, easeInOutSine),
  );
});
