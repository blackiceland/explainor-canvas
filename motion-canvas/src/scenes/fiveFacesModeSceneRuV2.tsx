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
  CODE_RULES,
  IMPL_X, IMPL_W,
  IMPL_FONT_SIZE, IMPL_LH,
  TRANSPARENT_CARD, CUSTOM_TYPES,
  METHOD_COLOR, PARAM_DARK, FUN_BLUE,
  TYPE_CLEAN, CONST_COLOR, TEXT_PRIMARY,
  blockLines,
  paintNamedParams,
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
  // NotificationMode is not in the shared CUSTOM_TYPES the call/impl Manticores
  // are built with, so the tokenizer marks it `plain` and it falls through to
  // the cream variable colour. Force it to the type colour by text.
  {match: /^NotificationMode$/, color: TYPE_CLEAN},
];

const MODE_PARAMS = [...NAMED_PARAMS, 'mode'];

const paintModeParamsLine = (line: any): void => {
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
};

const paintModeParams = (code: Manticore): void => {
  for (let lineIdx = 0; lineIdx < code.lineCount; lineIdx++) {
    const line = code.getLine(lineIdx);
    if (line) paintModeParamsLine(line);
  }
};

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

  yield* waitFor(0.8);

  // ── INTERLUDE: diagnose the flag ───────────────────────────────────
  // Blur the code into a soft backdrop and lift the flag off it into an
  // abstract toggle (only two states) shown on top. Then sharpen the code
  // back and apply the enum — and finally let that enum grow to the domain.

  yield* all(
    s.callBlurs[1](12, 0.6, easeInOutSine),
    s.implBlurs[1](12, 0.6, easeInOutSine),
  );
  yield* waitFor(0.3);

  // ── The boolean has exactly two states ─────────────────────────────

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
      {/* The flag's name, carried in its accent colour. */}
      <Txt
        x={0}
        y={-TRACK_H / 2 - 70}
        text={'silent'}
        fontFamily={Fonts.code}
        fontSize={44}
        fill={METHOD_COLOR}
      />
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
  yield* waitFor(1.2);

  yield* toggleOn(0, 0.4, easeInOutCubic);
  yield* waitFor(1.8);

  yield* toggleGroup().opacity(0, 0.6, easeInOutSine);
  yield* waitFor(0.6);

  // ── Back to the code — sharpen it and apply the enum ───────────────

  yield* all(
    s.callBlurs[1](0, 0.6, easeInOutSine),
    s.implBlurs[1](0, 0.6, easeInOutSine),
  );
  yield* waitFor(0.6);

  // ── MORPH 1: signature — silent: Boolean → mode: NotificationMode ──
  // Pre-set MODE_RULES (+ dark params) so the added tokens type straight in
  // their target colour instead of recolouring after the morph settles.

  s.implCodes[1].colorize(MODE_RULES);
  paintModeParams(s.implCodes[1]);
  yield* s.implCodes[1].morphTo(IMPL_STEP1, {
    removeDuration: 0.22,
    moveDuration: 0.3,
    charDelay: 0.01,
    addStyle: 'typewriter',
    scrollStrategy: 'block',
    recolorLine: paintModeParamsLine,
  });
  s.implCodes[1].colorize(MODE_RULES);
  paintModeParams(s.implCodes[1]);
  s.implCodes[1].recenterContent();
  yield* waitFor(1.5);

  // ── MORPH 2: if/else → when ────────────────────────────────────────

  yield* s.implCodes[1].morphTo(IMPL_STEP2, {
    removeDuration: 0.22,
    moveDuration: 0.38,
    charDelay: 0.01,
    addStyle: 'typewriter',
    scrollStrategy: 'block',
    recolorLine: paintModeParamsLine,
  });
  s.implCodes[1].colorize(MODE_RULES);
  paintModeParams(s.implCodes[1]);
  s.implCodes[1].recenterContent();
  yield* waitFor(2.0);

  // ── Enum appears below the function ────────────────────────────────

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

  // Enum fades in below the function.
  yield* enumMC.node.opacity(1, 0.55, easeInOutSine);
  yield* waitFor(1.0);

  // ── MORPH 3: call site — silent = true → mode = NotificationMode.SILENT

  s.callCodes[1].colorize(MODE_RULES);
  paintModeParams(s.callCodes[1]);
  yield* s.callCodes[1].morphTo(CALL_MODE_AFTER, {
    removeDuration: 0.22,
    moveDuration: 0.3,
    charDelay: 0.01,
    addStyle: 'typewriter',
    scrollStrategy: 'block',
    recolorLine: paintModeParamsLine,
  });
  s.callCodes[1].colorize(MODE_RULES);
  paintModeParams(s.callCodes[1]);
  s.callCodes[1].recenterContent();
  yield* waitFor(2.5);

  // ── Payoff: the enum can grow ───────────────────────────────────────
  // Clear the code, then let the type we just introduced gain the modes
  // the domain will need — DEFAULT/SILENT stay, CRITICAL/BACKGROUND grow in.
  // It is the same enum reflowing through states, so the brace slides down
  // and the new constants type in (no reserved empty rows).

  yield* all(
    s.hideCallCode(1, 0.6),
    s.hideImplCode(1, 0.6),
    enumMC.node.opacity(0, 0.5, easeInOutSine),
  );
  yield* waitFor(0.4);

  const growEnum = Manticore.create(ENUM_CODE, {
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
  growEnum.mount(view);
  growEnum.colorize(MODE_RULES);
  growEnum.node.opacity(0);

  yield* growEnum.node.opacity(1, 0.5, easeInOutSine);
  yield* waitFor(1.0);

  yield* growEnum.morphTo(BIG_ENUM, {
    removeDuration: 0.2,
    moveDuration: 0.5,
    charDelay: 0.02,
    addStyle: 'typewriter',
    scrollStrategy: 'block',
  });
  growEnum.colorize(MODE_RULES);
  growEnum.recenterContent();
  yield* waitFor(1.5);

  // ── Verdict: the face's weight ──────────────────────────────────────
  // Lands while the enum is still on screen, then blinks a couple of times
  // so the eye catches it. The enum then bows out smoothly, and the verdict
  // holds to the end of the scene.

  yield* s.showSmallScale(1);
  const scaleNode = s.smallScaleNodes[1]();
  yield* waitFor(0.25);
  for (let k = 0; k < 2; k++) {
    yield* scaleNode.opacity(0.18, 0.16, easeInOutSine);
    yield* scaleNode.opacity(1, 0.16, easeInOutSine);
  }
  yield* waitFor(0.8);

  yield* growEnum.node.opacity(0, 0.7, easeInOutSine);
  yield* waitFor(1.6);
});
