import {makeScene2D} from '@motion-canvas/2d';
import {all, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// ── code palette (canon: codeWithActionsSceneRu / whatsappCodePairSceneEn) ──
const VAR_LIGHT    = 'rgba(244,241,235,0.96)';
const TYPE_CLEAN   = 'rgba(220,215,255,0.80)';
const METHOD_COLOR = '#FF8CA3';
const SOFT_GREEN   = 'rgba(168,214,178,0.88)';
const FUN_BLUE     = '#A3CDFF';

const CODE_CARD_STYLE = {
  radius: 0,
  fill: 'rgba(0,0,0,0)',
  stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0,
  shadowColor: 'rgba(0,0,0,0)',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  edge: false,
} as const;

const COLOR_RULES: ColorRule[] = [
  // declaration / control-flow keywords. The Java tokenizer doesn't know
  // Kotlin's `fun`/`val`/`is`, so we pin them to the keyword slot here.
  {match: /^fun$/, color: FUN_BLUE},
  {match: /^val$/, color: FUN_BLUE},
  {match: /^is$/,  color: FUN_BLUE},

  // method calls — rose accent. (sendMessage falls into theme.method
  // automatically via tokenizer classification.)
  {match: /^render$/,    color: METHOD_COLOR, onlyTypes: ['method']},
  {match: /^check$/,     color: METHOD_COLOR, onlyTypes: ['method']},
  {match: /^create$/,    color: METHOD_COLOR, onlyTypes: ['method']},
  {match: /^nextRetry$/, color: METHOD_COLOR, onlyTypes: ['method']},
  {match: /^send$/,      color: METHOD_COLOR, onlyTypes: ['method']},

  // common variable identifiers — kept on the plain cream row.
  {match: /^user$/,     color: VAR_LIGHT},
  {match: /^template$/, color: VAR_LIGHT},
  {match: /^message$/,  color: VAR_LIGHT},
  {match: /^decision$/, color: VAR_LIGHT},
  {match: /^attempt$/,  color: VAR_LIGHT},
  {match: /^receipt$/,  color: VAR_LIGHT},
  {match: /^renderer$/, color: VAR_LIGHT},
  {match: /^rules$/,    color: VAR_LIGHT},
  {match: /^attempts$/, color: VAR_LIGHT},
  {match: /^gateway$/,  color: VAR_LIGHT},

  // Types — both outer (User, MessageTemplate, …) and the sealed-class
  // members (Preview, Deferred, Sent, Blocked). All in the lavender slot.
  {match: /^(MessageRenderer|DeliveryRules|DeliveryAttempts|MessageGateway|User|MessageTemplate|Boolean|DeliveryResult|DeliveryDecision|Preview|Deferred|Sent|Blocked)$/,
   color: TYPE_CLEAN, onlyTypes: ['type']},
];

const CODE = `fun sendMessage(
    user: User,
    template: MessageTemplate,
    dryRun: Boolean = false,
    forceSend: Boolean = false,
    isRetry: Boolean = false,
): DeliveryResult {
    val message = renderer.render(template, user)

    if (dryRun) {
        return DeliveryResult.Preview(message)
    }

    if (!forceSend) {
        val decision = rules.check(user, message)

        if (decision is DeliveryDecision.Blocked) {
            return DeliveryResult.Deferred(decision.reason)
        }
    }

    val attempt =
        if (isRetry) attempts.nextRetry(user, message)
        else attempts.create(user, message)

    val receipt = gateway.send(user, message, attempt)

    return DeliveryResult.Sent(receipt)
}`;

// ── geometry ────────────────────────────────────────────────────────────
// 29 lines * 33 px line-height = 957 + paddingY*2 (≈82) = 1039.
// Fits 1080 height with ≈20px margin each side. Centered both axes.
// Longest line is ~59 chars × ~13.2 px (fontSize 22, JetBrains Mono) ≈
// 779, plus paddingX*2 (≈104) ≈ 883; width 920 leaves comfortable slack.
const CODE_FONT = 22;
const CODE_LH   = 33;
const CODE_W    = 920;

const TOTAL_LINES = CODE.split('\n').length;
// Signature occupies lines 0-6 ("fun sendMessage(" through "): DeliveryResult {").
const BODY_FIRST   = 7;
const BODY_LAST    = TOTAL_LINES - 1;
// Mid of signature in content-space: startY + SIG_MID_LINE * lineHeight.
const SIG_MID_LINE = 3;
const SIG_MID_Y    = -((TOTAL_LINES - 1) / 2) * CODE_LH + SIG_MID_LINE * CODE_LH;
// Mid of signature horizontally — leftEdge (-CODE_W/2 + paddingX(22)=52) is
// -408; the longest signature line ("    forceSend: Boolean = false,",
// 31 chars at ≈13.2px) extends to about +1, so the sig block midpoint sits
// near content x = -204. Centering that mid puts the signature visually
// in the middle of the frame at zoom-in.
const SIG_MID_X    = -204;

// Phase A — signature only, large and centered. The whole code container
// is scaled up and translated so the sig block midpoint lands at world
// (0, 0); the body is hidden via line-level opacity so the camera
// pull-back can fade it in as it shrinks.
const ZOOM_IN  = 2.5;
const X_OFFSET = -SIG_MID_X * ZOOM_IN;
const Y_OFFSET = -SIG_MID_Y * ZOOM_IN;

export default makeScene2D(function* (view) {
  applyBackground(view);

  const code = Manticore.create(CODE, {
    x: 0,
    y: 0,
    width: CODE_W,
    fontSize: CODE_FONT,
    lineHeight: CODE_LH,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    // 'Preview', 'Deferred', 'Sent', 'Blocked' added so they tokenize as
    // 'type' (and the rule above keeps them lavender) instead of falling
    // into 'method' via the `(` lookahead.
    customTypes: [
      'MessageRenderer',
      'DeliveryRules',
      'DeliveryAttempts',
      'MessageGateway',
      'User',
      'MessageTemplate',
      'Boolean',
      'DeliveryResult',
      'DeliveryDecision',
      'Preview',
      'Deferred',
      'Sent',
      'Blocked',
    ],
  });
  code.mount(view);
  code.colorize(COLOR_RULES);

  // Phase A initial state — zoomed in on signature, body hidden.
  code.node.scale(ZOOM_IN);
  code.node.position([X_OFFSET, Y_OFFSET]);
  yield* code.dimLines(BODY_FIRST, BODY_LAST, 0, 0);

  yield* code.appear(0.7);
  yield* waitFor(1.6);

  // Phase B — camera pulls back: scale → 1, position → (0, 0). Body
  // fades in across the same window so it appears as the frame opens up
  // around it.
  yield* all(
    code.node.scale(1, 1.5, easeInOutCubic),
    code.node.position([0, 0], 1.5, easeInOutCubic),
    code.dimLines(BODY_FIRST, BODY_LAST, 1, 1.2),
  );

  yield* waitFor(3.0);
});
