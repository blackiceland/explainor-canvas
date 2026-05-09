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
//  Idea: code is the mechanism (left, off-white technical); the bubble
//  is the product (right, the only solid object that breaks the dark
//  field). Between them — air. No matte messenger frame, no input pill,
//  no decorative chrome.
//
//  Reading order: eye lands on `Payment failed` (warm white serif on
//  dark bubble), then drifts left into the two methods that produced
//  it. Both functions share the same skeleton — that's the point of
//  the frame.
// ══════════════════════════════════════════════════════════════════════════

const F_SERIF = 'Newsreader, "Source Serif 4", "EB Garamond", serif';
const F_MONO  = Fonts.code;

// ── code palette (codeWithActionsSceneRu canon + explicit fun accent) ────
const VAR_LIGHT    = 'rgba(244,241,235,0.96)';
const TYPE_CLEAN   = 'rgba(220,215,255,0.80)';
const METHOD_COLOR = '#FF8CA3';
const SOFT_GREEN   = 'rgba(168,214,178,0.88)';
const FUN_BLUE     = '#A3CDFF';   // explicit, brighter than theme.keyword

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

// ── messenger palette (warm editorial — kept for the bubble, but the
// surrounding panel and input pill are gone, so the warm notes only
// appear at the headline + URGENT) ────────────────────────────────────────
const BUBBLE_FILL   = '#1F2322';   // a touch lighter than the gradient mid-tone
const BUBBLE_STROKE = 'rgba(255,255,255,0.05)';
const BUBBLE_SHADOW = 'rgba(0,0,0,0.42)';

const CAPTION_DIM   = 'rgba(244,241,235,0.42)';
const CAPTION_VERY  = 'rgba(244,241,235,0.28)';
const SERIF_WHITE   = '#E8E1D3';
const URGENT_AMBER  = '#B07A3E';

// ── proportions ───────────────────────────────────────────────────────────
//
//   Code block sits well left — its right edge stops around x = -120,
//   leaving a wide air gap before the bubble starts at x ≈ +260. That
//   air is what makes the kadr read as "mechanism / product" instead
//   of "two cards next to each other".
const CODE_CENTER_X  = -480;
const CODE_W         = 820;
const CODE_FONT      = 21;
const CODE_LH        = 34;

const BUBBLE_X       = +480;
const BUBBLE_Y       = +20;
const BUBBLE_W       = 460;
const BUBBLE_H       = 196;
const BUBBLE_RADIUS  = 32;

const HEADER_Y       = BUBBLE_Y - BUBBLE_H / 2 - 100;
const TODAY_Y        = BUBBLE_Y - BUBBLE_H / 2 - 60;

// ──────────────────────────────────────────────────────────────────────────
export default makeScene2D(function* (view) {
    applyBackground(view);

    // ── right side: WHATSAPP / Today caption + bubble ────────────────────
    const headerRef  = createRef<Txt>();
    const todayRef   = createRef<Txt>();
    const bubbleRef  = createRef<Rect>();
    const paymentRef = createRef<Txt>();
    const urgentRef  = createRef<Txt>();

    view.add(
        <>
            <Txt
                ref={headerRef}
                text="WHATSAPP"
                fontFamily={F_SERIF}
                fontSize={20}
                fontWeight={500}
                fill={CAPTION_DIM}
                letterSpacing={5}
                x={BUBBLE_X}
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
                x={BUBBLE_X}
                y={TODAY_Y}
                opacity={0}
            />

            <Rect
                ref={bubbleRef}
                width={BUBBLE_W}
                height={BUBBLE_H}
                radius={BUBBLE_RADIUS}
                x={BUBBLE_X}
                y={BUBBLE_Y + 14}
                fill={BUBBLE_FILL}
                stroke={BUBBLE_STROKE}
                lineWidth={1}
                shadowColor={BUBBLE_SHADOW}
                shadowBlur={22}
                shadowOffset={[-4, 8]}
                opacity={0}
            />
            <Txt
                ref={paymentRef}
                text="Payment failed"
                fontFamily={F_SERIF}
                fontSize={44}
                fontWeight={500}
                fill={SERIF_WHITE}
                x={BUBBLE_X}
                y={BUBBLE_Y - 22 + 14}
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
                x={BUBBLE_X}
                y={BUBBLE_Y + 38 + 14}
                opacity={0}
            />
        </>,
    );

    // ── left side: code (mechanism) ──────────────────────────────────────
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

    // Hide the LOGIN block until after CART has had its read.
    yield* code.dimLines(7, 12, 0, 0);
    code.node.opacity(0);

    // ══════════════════════════════════════════════════════════════════════
    //  Sequence — caption first (sets the moment), bubble lands as the
    //  hero, URGENT opens its letter-spacing, then the code pair fades
    //  in (mechanism following result).
    // ══════════════════════════════════════════════════════════════════════
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
        urgentRef().y(BUBBLE_Y + 38, 0.35, easeOutCubic),
        urgentRef().letterSpacing(5, 0.45, easeOutCubic),
    );
    yield* waitFor(0.5);

    yield* code.appear(0.55);
    yield* waitFor(1.6);
    yield* code.dimLines(7, 12, 1, 0.55);

    yield* waitFor(2.6);
});
