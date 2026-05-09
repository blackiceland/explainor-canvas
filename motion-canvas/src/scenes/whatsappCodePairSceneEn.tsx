import {Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
    all,
    createRef,
    easeOutCubic,
    waitFor,
} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// ══════════════════════════════════════════════════════════════════════════
//  WhatsApp + code-pair (horizontal 1920×1080)
//
//   LEFT  — code (mechanism). codeWithActionsSceneRu palette, no card
//           under the code, no chip-labels.
//
//   RIGHT — messenger panel (product). Light matte graphite, just three
//           elements inside: WHATSAPP caption, Today, the bubble. NO
//           input pill — it doesn't say anything. Panel is intentionally
//           lighter than before: shorter height, softer shadow, thinner
//           stroke, so it doesn't outweigh the code column.
// ══════════════════════════════════════════════════════════════════════════

const F_SERIF = 'Newsreader, "Source Serif 4", "EB Garamond", serif';
const F_MONO  = Fonts.code;

// ── code palette (codeWithActionsSceneRu canon + explicit fun accent) ────
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
    {match: /^fun$/,            color: FUN_BLUE},
    {match: 'sendCartReminder', color: METHOD_COLOR, onlyTypes: ['method']},
    {match: 'sendLoginCode',    color: METHOD_COLOR, onlyTypes: ['method']},
    {match: 'render',           color: METHOD_COLOR, onlyTypes: ['method']},
    {match: /^send$/,           color: METHOD_COLOR, onlyTypes: ['method']},
    {match: 'record',           color: METHOD_COLOR, onlyTypes: ['method']},
    {match: /^"[^"]*"$/,        color: SOFT_GREEN},
    {match: 'user',             color: VAR_LIGHT},
    {match: 'cart',             color: VAR_LIGHT},
    {match: /^code$/,           color: VAR_LIGHT},
    {match: 'message',          color: VAR_LIGHT},
    {match: 'result',           color: VAR_LIGHT},
    {match: 'phone',            color: VAR_LIGHT},
    {match: 'templates',        color: VAR_LIGHT},
    {match: 'whatsapp',         color: VAR_LIGHT},
    {match: 'deliveries',       color: VAR_LIGHT},
    {match: /^User$/,           color: TYPE_CLEAN},
    {match: /^Cart$/,           color: TYPE_CLEAN},
    {match: /^LoginCode$/,      color: TYPE_CLEAN},
    {match: /^SendResult$/,     color: TYPE_CLEAN},
];

const CODE_PAIR = `fun sendCartReminder(user: User, cart: Cart): SendResult {
    val message = templates.render("cart_reminder", cart)
    val result  = whatsapp.send(user.phone, message)
    deliveries.record(user, message, result)
    return result
}

fun sendLoginCode(user: User, code: LoginCode): SendResult {
    val message = templates.render("login_code", code)
    val result  = whatsapp.send(user.phone, message)
    deliveries.record(user, message, result)
    return result
}`;

// ── messenger palette (light matte graphite, no green) ───────────────────
const MSG_SURFACE   = '#1A1D1C';
const MSG_STROKE    = 'rgba(255,255,255,0.05)';
const MSG_SHADOW    = 'rgba(0,0,0,0.32)';
const MSG_SHADOW_BLUR  = 30;
const MSG_SHADOW_OFFS: [number, number] = [-8, 14];

const BUBBLE_FILL   = '#2A2E2D';   // brighter — has to clearly separate from MSG_SURFACE
const BUBBLE_STROKE = 'rgba(255,255,255,0.07)';

const CAPTION_DIM   = 'rgba(244,241,235,0.65)';   // small caps caption: visible, not loud
const CAPTION_VERY  = 'rgba(244,241,235,0.38)';
const SERIF_WHITE   = '#E8E1D3';
const URGENT_AMBER  = '#B07A3E';

// ── proportions ───────────────────────────────────────────────────────────
const CODE_CENTER_X  = -480;
const CODE_W         = 820;
const CODE_FONT      = 21;
const CODE_LH        = 34;

const MSG_X          = +460;
const MSG_W          = 760;
const MSG_H          = 460;        // tighter — three elements stop drifting
const MSG_RADIUS     = 34;

// All three elements (header / today / bubble) form one tight group.
// Header sits in the upper third, today right below it, bubble centred
// just below the panel mid-line. ~60 px of breathing room under the
// bubble — calm, not "we forgot to put something there".
const HEADER_Y       = -180;
const TODAY_Y        = -140;
const BUBBLE_Y       = +30;
const BUBBLE_W       = 440;
const BUBBLE_H       = 184;
const BUBBLE_RADIUS  = 32;
const BUBBLE_X_INSIDE = -40;

// ──────────────────────────────────────────────────────────────────────────
export default makeScene2D(function* (view) {
    applyBackground(view);

    // ── messenger panel (right) ──────────────────────────────────────────
    const panelRef   = createRef<Rect>();
    const headerRef  = createRef<Txt>();
    const todayRef   = createRef<Txt>();
    const bubbleRef  = createRef<Rect>();
    const paymentRef = createRef<Txt>();
    const urgentRef  = createRef<Txt>();

    view.add(
        <Rect
            ref={panelRef}
            x={MSG_X}
            y={0}
            width={MSG_W}
            height={MSG_H}
            radius={MSG_RADIUS}
            fill={MSG_SURFACE}
            stroke={MSG_STROKE}
            lineWidth={1}
            shadowColor={MSG_SHADOW}
            shadowBlur={MSG_SHADOW_BLUR}
            shadowOffset={MSG_SHADOW_OFFS}
            opacity={0}
        >
            <Txt
                ref={headerRef}
                text="WHATSAPP"
                fontFamily={F_SERIF}
                fontSize={17}
                fontWeight={500}
                fill={CAPTION_DIM}
                letterSpacing={4}
                y={HEADER_Y}
                opacity={0}
            />
            <Txt
                ref={todayRef}
                text="Today"
                fontFamily={F_SERIF}
                fontSize={22}
                fontStyle="italic"
                fontWeight={400}
                fill={CAPTION_VERY}
                y={TODAY_Y}
                opacity={0}
            />
            <Rect
                ref={bubbleRef}
                width={BUBBLE_W}
                height={BUBBLE_H}
                radius={BUBBLE_RADIUS}
                x={BUBBLE_X_INSIDE}
                y={BUBBLE_Y + 12}
                fill={BUBBLE_FILL}
                stroke={BUBBLE_STROKE}
                lineWidth={1}
                opacity={0}
            />
            <Txt
                ref={paymentRef}
                text="Payment failed"
                fontFamily={F_SERIF}
                fontSize={42}
                fontWeight={500}
                fill={SERIF_WHITE}
                x={BUBBLE_X_INSIDE}
                y={BUBBLE_Y - 22 + 12}
                opacity={0}
            />
            <Txt
                ref={urgentRef}
                text="URGENT"
                fontFamily={F_MONO}
                fontSize={22}
                fontWeight={500}
                fill={URGENT_AMBER}
                letterSpacing={0}
                x={BUBBLE_X_INSIDE}
                y={BUBBLE_Y + 36 + 12}
                opacity={0}
            />
        </Rect>,
    );

    // ── code (left) ──────────────────────────────────────────────────────
    const code = Manticore.create(CODE_PAIR, {
        x: CODE_CENTER_X,
        y: 0,
        width: CODE_W,
        fontSize: CODE_FONT,
        lineHeight: CODE_LH,
        fontFamily: F_MONO,
        theme: DryFiltersV3CodeTheme,
        cardStyle: CODE_CARD_STYLE,
        glowAccent: false,
        customTypes: ['User', 'Cart', 'LoginCode', 'SendResult'],
    });
    code.mount(view);
    code.colorize(COLOR_RULES);

    yield* code.dimLines(7, 12, 0, 0);
    code.node.opacity(0);

    // ══════════════════════════════════════════════════════════════════════
    //  Sequence — panel, header, today, bubble, URGENT, code (cart →
    //  login). Everything settles inside ~6.5 s setup + 2.6 s hold.
    // ══════════════════════════════════════════════════════════════════════
    yield* panelRef().opacity(1, 0.55, easeOutCubic);
    yield* headerRef().opacity(1, 0.45, easeOutCubic);
    yield* waitFor(0.12);
    yield* todayRef().opacity(1, 0.35, easeOutCubic);
    yield* waitFor(0.25);

    yield* all(
        bubbleRef().opacity(1, 0.5, easeOutCubic),
        bubbleRef().y(BUBBLE_Y, 0.5, easeOutCubic),
        paymentRef().opacity(1, 0.5, easeOutCubic),
        paymentRef().y(BUBBLE_Y - 22, 0.5, easeOutCubic),
    );
    yield* waitFor(0.2);

    yield* all(
        urgentRef().opacity(1, 0.35, easeOutCubic),
        urgentRef().y(BUBBLE_Y + 36, 0.35, easeOutCubic),
        urgentRef().letterSpacing(5, 0.45, easeOutCubic),
    );
    yield* waitFor(0.4);

    yield* code.appear(0.55);
    yield* waitFor(1.6);
    yield* code.dimLines(7, 12, 1, 0.55);

    yield* waitFor(2.6);
});
