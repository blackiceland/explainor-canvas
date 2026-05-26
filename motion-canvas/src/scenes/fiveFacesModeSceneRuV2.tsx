import {makeScene2D} from '@motion-canvas/2d';
import {Circle, Node, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, createSignal, easeInOutCubic, easeInOutSine, waitFor} from '@motion-canvas/core';
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
  TYPE_CLEAN, CONST_COLOR, TEXT_PRIMARY,
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
            mode = campaign.notificationMode,
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

// Big enum for the epilogue showcase.
const BIG_ENUM = `enum class NotificationMode {
    DEFAULT,
    SILENT,
    CRITICAL,
    BACKGROUND,
}`;

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

  // Line 0: fun send(..., silent: Boolean)  — параметр
  // Line 1: val options = if (silent)       — тело
  {
    const paramLine = s.implCodes[1].getLine(0);
    const bodyLine = s.implCodes[1].getLine(1);
    const anims: any[] = [];
    if (paramLine) anims.push(...paramLine.colorizeByRuleAnimated('silent', METHOD_COLOR, 0.4));
    if (bodyLine) anims.push(...bodyLine.colorizeByRuleAnimated('silent', METHOD_COLOR, 0.4));
    if (anims.length) yield* all(...anims);
  }
  yield* waitFor(1.5);

  // ── MORPH 1: signature — silent: Boolean → mode: NotificationMode ──

  yield* s.implCodes[1].morphTo(IMPL_STEP1, {
    removeDuration: 0.3,
    moveDuration: 0.4,
    charDelay: 0.015,
    flashRemovedColor: METHOD_COLOR,
    flashRemovedDuration: 0.2,
    addStyle: 'typewriter',
    scrollStrategy: 'block',
  });
  s.implCodes[1].colorize(MODE_RULES);
  paintModeParams(s.implCodes[1]);
  s.implCodes[1].recenterContent();
  yield* waitFor(1.5);

  // ── MORPH 2: if/else → when ────────────────────────────────────────

  yield* s.implCodes[1].morphTo(IMPL_STEP2, {
    removeDuration: 0.3,
    moveDuration: 0.5,
    charDelay: 0.015,
    flashRemovedColor: METHOD_COLOR,
    flashRemovedDuration: 0.2,
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

  // ── Close morph section ─────────────────────────────────────────────

  yield* s.showSmallScale(1);
  yield* waitFor(2.0);

  yield* all(
    s.hideCallCode(1, 0.5),
    s.hideImplCode(1, 0.5),
    s.hideSmallScale(1, 0.4),
    enumMC.node.opacity(0, 0.5, easeInOutSine),
  );
  yield* waitFor(0.5);

  // ── EPILOGUE STEP 1: enum showcase ─────────────────────────────────

  const bigEnum = Manticore.create(BIG_ENUM, {
    x: -100,
    y: 0,
    width: 900,
    fontSize: 48,
    lineHeight: 68,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    noClip: true,
    cardStyle: TRANSPARENT_CARD,
    glowAccent: false,
    customTypes: MODE_TYPES,
  });
  bigEnum.mount(view);
  bigEnum.colorize(MODE_RULES);

  for (let i = 1; i <= 4; i++) {
    const line = bigEnum.getLine(i);
    if (line) line.node.opacity(0);
  }
  {
    const closeLine = bigEnum.getLine(5);
    if (closeLine) closeLine.node.opacity(0);
  }
  bigEnum.node.opacity(0);

  yield* bigEnum.node.opacity(1, 0.5, easeInOutSine);
  yield* waitFor(0.6);

  for (let i = 1; i <= 4; i++) {
    const line = bigEnum.getLine(i);
    if (line) yield* line.node.opacity(1, 0.35, easeInOutSine);
    yield* waitFor(0.5);
  }
  {
    const closeLine = bigEnum.getLine(5);
    if (closeLine) yield* closeLine.node.opacity(1, 0.25, easeInOutSine);
  }
  yield* waitFor(3.0);

  yield* bigEnum.node.opacity(0, 0.6, easeInOutSine);
  yield* waitFor(0.5);

  // ── EPILOGUE STEP 2: boolean toggle ────────────────────────────────

  const toggleOn = createSignal(0);

  const TRACK_W  = 200;
  const TRACK_H  = 100;
  const HANDLE_R = 38;
  const HANDLE_OFF_X = -TRACK_W / 2 + HANDLE_R + 10;
  const HANDLE_ON_X  =  TRACK_W / 2 - HANDLE_R - 10;
  const GLOW_COLOR   = 'rgba(255, 170, 185, 0.7)';

  const toggleGroup = createRef<Node>();
  const falseTxt = createRef<Txt>();
  const trueTxt = createRef<Txt>();

  view.add(
    <Node ref={toggleGroup} opacity={0}>
      <Txt
        ref={falseTxt}
        x={-TRACK_W / 2 - 140}
        y={0}
        text={'false'}
        fontFamily={Fonts.code}
        fontSize={44}
        fill={FUN_BLUE}
        opacity={() => 0.3 + (1 - toggleOn()) * 0.7}
      />
      <Rect
        x={0}
        y={0}
        width={TRACK_W}
        height={TRACK_H}
        radius={TRACK_H / 2}
        fill={() => `rgba(255, 170, 185, ${0.10 + toggleOn() * 0.45})`}
        stroke={() => `rgba(244, 241, 235, ${0.18 + toggleOn() * 0.10})`}
        lineWidth={1}
        shadowColor={GLOW_COLOR}
        shadowBlur={() => 14 * toggleOn()}
      />
      <Circle
        x={() => HANDLE_OFF_X + toggleOn() * (HANDLE_ON_X - HANDLE_OFF_X)}
        y={0}
        width={HANDLE_R * 2}
        height={HANDLE_R * 2}
        fill={'rgba(244, 241, 235, 0.95)'}
        shadowColor={'rgba(0, 0, 0, 0.45)'}
        shadowBlur={10}
        shadowOffsetY={3}
      />
      <Txt
        ref={trueTxt}
        x={TRACK_W / 2 + 140}
        y={0}
        text={'true'}
        fontFamily={Fonts.code}
        fontSize={44}
        fill={FUN_BLUE}
        opacity={() => 0.3 + toggleOn() * 0.7}
      />
    </Node>,
  );

  yield* toggleGroup().opacity(1, 0.5, easeInOutSine);
  yield* waitFor(1.2);

  yield* toggleOn(1, 0.4, easeInOutCubic);
  yield* waitFor(1.0);

  yield* toggleOn(0, 0.4, easeInOutCubic);
  yield* waitFor(0.8);

  yield* toggleOn(1, 0.4, easeInOutCubic);
  yield* waitFor(2.5);

  yield* toggleGroup().opacity(0, 0.6, easeInOutSine);
});
