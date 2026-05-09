import {Circle, Path, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
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
//   LEFT  — code (mechanism). codeWithActionsSceneRu palette, no card,
//           no chip-labels.
//   RIGHT — realistic WhatsApp dark-mode messenger panel. Two equal-
//           size bubbles (context + main) + chat header + input field.
// ══════════════════════════════════════════════════════════════════════════

const F_SERIF = 'Newsreader, "Source Serif 4", "EB Garamond", serif';
const F_SANS  = Fonts.primary;
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

// ── messenger palette (canonical WA dark mode) ───────────────────────────
const PANEL_BG     = '#0B141A';
const HEADER_BG    = '#1F2C33';
const BUBBLE_BG    = '#1F2C33';
const INPUT_BG     = '#1F2C33';
const TEXT_PRIMARY = '#E9EDEF';
const TEXT_MUTED   = '#8696A0';
const ICON_TINT    = '#8696A0';
const ONLINE_DOT   = '#4DA37D';
const SERIF_WHITE  = '#E9EDEF';

const PANEL_STROKE = 'rgba(255,255,255,0.04)';
const PANEL_SHADOW = 'rgba(0,0,0,0.45)';

// ── proportions ───────────────────────────────────────────────────────────
const CODE_CENTER_X  = -480;
const CODE_W         = 820;
const CODE_FONT      = 21;
const CODE_LH        = 34;

const PANEL_X        = +460;
const PANEL_W        = 540;
const PANEL_H        = 640;
const PANEL_RADIUS   = 32;

// header bar
const HEADER_H      = 60;
const HEADER_Y_REL  = -PANEL_H / 2 + HEADER_H / 2;
const AVATAR_R      = 20;
const AVATAR_X_REL  = -PANEL_W / 2 + 28 + AVATAR_R;

// bubbles (equal size)
const BUBBLE_W      = 380;
const BUBBLE_H      = 104;
const BUBBLE_RADIUS = 16;
const BUBBLE_X_REL  = -PANEL_W / 2 + 30 + BUBBLE_W / 2;

const EARLIER_Y_REL = -160;
const MAIN_Y_REL    = -30;

// shared bubble path (with left-bottom tail)
const BUB_AX = -BUBBLE_W / 2;
const BUB_AY = -BUBBLE_H / 2;
const TAIL_TIP_X = BUB_AX - 8;
const TAIL_TIP_Y = BUB_AY - 3;
const BUBBLE_PATH = [
    `M ${BUB_AX + BUBBLE_RADIUS} ${BUB_AY}`,
    `H ${BUB_AX + BUBBLE_W - BUBBLE_RADIUS}`,
    `Q ${BUB_AX + BUBBLE_W} ${BUB_AY} ${BUB_AX + BUBBLE_W} ${BUB_AY + BUBBLE_RADIUS}`,
    `V ${BUB_AY + BUBBLE_H - BUBBLE_RADIUS}`,
    `Q ${BUB_AX + BUBBLE_W} ${BUB_AY + BUBBLE_H} ${BUB_AX + BUBBLE_W - BUBBLE_RADIUS} ${BUB_AY + BUBBLE_H}`,
    `H ${BUB_AX + BUBBLE_RADIUS}`,
    `Q ${BUB_AX} ${BUB_AY + BUBBLE_H} ${BUB_AX} ${BUB_AY + BUBBLE_H - BUBBLE_RADIUS}`,
    `V ${BUB_AY + 5}`,
    `L ${TAIL_TIP_X} ${TAIL_TIP_Y}`,
    `L ${BUB_AX + 5} ${BUB_AY}`,
    `Z`,
].join(' ');

// input
const INPUT_W       = PANEL_W - 56;
const INPUT_H       = 52;
const INPUT_RADIUS  = 26;
const INPUT_Y_REL   = +PANEL_H / 2 - 50;

// ── glyphs ────────────────────────────────────────────────────────────────
function plusGlyph(cx: number, cy: number, size = 14) {
    const t = 1.8;
    return (
        <>
            <Rect x={cx} y={cy} width={size} height={t} radius={1} fill={ICON_TINT} />
            <Rect x={cx} y={cy} width={t} height={size} radius={1} fill={ICON_TINT} />
        </>
    );
}

function micGlyph(cx: number, cy: number) {
    return (
        <>
            <Rect x={cx} y={cy - 4} width={9} height={14} radius={4.5}
                fill="rgba(0,0,0,0)" stroke={ICON_TINT} lineWidth={1.4} />
            <Rect x={cx} y={cy + 7} width={2} height={3} radius={1} fill={ICON_TINT} />
            <Rect x={cx} y={cy + 9} width={11} height={2} radius={1} fill={ICON_TINT} />
        </>
    );
}

// ──────────────────────────────────────────────────────────────────────────
export default makeScene2D(function* (view) {
    applyBackground(view);

    // ── messenger panel (right) ──────────────────────────────────────────
    const panelRef    = createRef<Rect>();
    const earlierBubble = createRef<Path>();
    const earlierText   = createRef<Txt>();
    const earlierTime   = createRef<Txt>();
    const mainBubble    = createRef<Path>();
    const mainHeadline  = createRef<Txt>();
    const mainTime      = createRef<Txt>();
    const inputRef    = createRef<Rect>();

    view.add(
        <Rect
            ref={panelRef}
            x={PANEL_X} y={0}
            width={PANEL_W} height={PANEL_H}
            radius={PANEL_RADIUS}
            fill={PANEL_BG}
            stroke={PANEL_STROKE} lineWidth={1}
            shadowColor={PANEL_SHADOW} shadowBlur={36} shadowOffset={[-10, 16]}
            opacity={0}
            clip
        >
            {/* header bar */}
            <Rect
                width={PANEL_W} height={HEADER_H}
                fill={HEADER_BG}
                y={HEADER_Y_REL}
            />
            <Circle
                width={AVATAR_R * 2} height={AVATAR_R * 2}
                fill="#3A4F5A"
                x={AVATAR_X_REL} y={HEADER_Y_REL}
            />
            <Txt
                text="A"
                fontFamily={F_SANS} fontSize={16} fontWeight={600}
                fill={TEXT_PRIMARY}
                x={AVATAR_X_REL} y={HEADER_Y_REL}
            />
            <Txt
                text="Acme Notifications"
                fontFamily={F_SANS} fontSize={16} fontWeight={500}
                fill={TEXT_PRIMARY}
                textAlign="left"
                x={AVATAR_X_REL + AVATAR_R + 100} y={HEADER_Y_REL - 8}
            />
            <Circle
                width={6} height={6}
                fill={ONLINE_DOT}
                x={AVATAR_X_REL + AVATAR_R + 16} y={HEADER_Y_REL + 11}
            />
            <Txt
                text="online"
                fontFamily={F_SANS} fontSize={11}
                fill={TEXT_MUTED}
                x={AVATAR_X_REL + AVATAR_R + 47} y={HEADER_Y_REL + 11}
            />

            {/* earlier bubble — equal size */}
            <Path
                ref={earlierBubble}
                data={BUBBLE_PATH}
                fill={BUBBLE_BG}
                x={BUBBLE_X_REL} y={EARLIER_Y_REL}
                opacity={0}
            />
            <Txt
                ref={earlierText}
                text="Your card on file was declined."
                fontFamily={F_SANS} fontSize={15} fontWeight={400}
                fill={TEXT_PRIMARY}
                x={BUBBLE_X_REL} y={EARLIER_Y_REL - 8}
                opacity={0}
            />
            <Txt
                ref={earlierTime}
                text="2:12 PM"
                fontFamily={F_SANS} fontSize={11}
                fill={TEXT_MUTED}
                x={BUBBLE_X_REL + BUBBLE_W / 2 - 32}
                y={EARLIER_Y_REL + BUBBLE_H / 2 - 14}
                opacity={0}
            />

            {/* main bubble — equal size */}
            <Path
                ref={mainBubble}
                data={BUBBLE_PATH}
                fill={BUBBLE_BG}
                x={BUBBLE_X_REL} y={MAIN_Y_REL}
                opacity={0}
            />
            <Txt
                ref={mainHeadline}
                text="Payment failed"
                fontFamily={F_SERIF} fontSize={32} fontWeight={500}
                fill={SERIF_WHITE}
                x={BUBBLE_X_REL} y={MAIN_Y_REL - 10}
                opacity={0}
            />
            <Txt
                ref={mainTime}
                text="2:14 PM"
                fontFamily={F_SANS} fontSize={11}
                fill={TEXT_MUTED}
                x={BUBBLE_X_REL + BUBBLE_W / 2 - 32}
                y={MAIN_Y_REL + BUBBLE_H / 2 - 14}
                opacity={0}
            />

            {/* input */}
            <Rect
                ref={inputRef}
                width={INPUT_W} height={INPUT_H} radius={INPUT_RADIUS}
                fill={INPUT_BG}
                y={INPUT_Y_REL}
                opacity={0}
            >
                {plusGlyph(-INPUT_W / 2 + 24, 0, 14)}
                <Txt
                    text="Message"
                    fontFamily={F_SANS} fontSize={14}
                    fill={TEXT_MUTED}
                    x={-INPUT_W / 2 + 64}
                    textAlign="left"
                />
                {micGlyph(+INPUT_W / 2 - 24, 0)}
            </Rect>
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
    //  Sequence — panel + header settle, then bubbles arrive in order
    //  (earlier → main), then input. Code pair fades in as the last
    //  beat: cart reads first, login reveals after a quiet pause.
    // ══════════════════════════════════════════════════════════════════════
    yield* panelRef().opacity(1, 0.55, easeOutCubic);
    yield* waitFor(0.18);

    yield* all(
        earlierBubble().opacity(1, 0.45, easeOutCubic),
        earlierText().opacity(1, 0.45, easeOutCubic),
        earlierTime().opacity(1, 0.45, easeOutCubic),
    );
    yield* waitFor(0.4);

    yield* all(
        mainBubble().opacity(1, 0.5, easeOutCubic),
        mainHeadline().opacity(1, 0.5, easeOutCubic),
        mainTime().opacity(1, 0.5, easeOutCubic),
    );
    yield* waitFor(0.35);

    yield* inputRef().opacity(1, 0.4, easeOutCubic);
    yield* waitFor(0.4);

    yield* code.appear(0.55);
    yield* waitFor(1.6);
    yield* code.dimLines(7, 12, 1, 0.55);

    yield* waitFor(2.6);
});
