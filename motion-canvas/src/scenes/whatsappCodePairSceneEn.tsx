import {Path, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
    all,
    createRef,
    easeOutCubic,
    waitFor,
} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// ══════════════════════════════════════════════════════════════════════════
//  Variant B finalised — bubble pinned left + soft tail + date pill +
//  realistic input field at the bottom (placeholder text, plus / emoji
//  glyph on the left, mic glyph on the right).
// ══════════════════════════════════════════════════════════════════════════

const F_SERIF = 'Newsreader, "Source Serif 4", "EB Garamond", serif';
const F_MONO  = Fonts.code;

const MSG_SURFACE   = '#1A1D1C';
const MSG_STROKE    = 'rgba(255,255,255,0.05)';
const MSG_SHADOW    = 'rgba(0,0,0,0.32)';

const BUBBLE_FILL   = '#2A2E2D';
const BUBBLE_STROKE = 'rgba(255,255,255,0.07)';

const INPUT_FILL    = '#222625';
const INPUT_STROKE  = 'rgba(255,255,255,0.06)';
const PLACEHOLDER   = 'rgba(244,241,235,0.32)';
const ICON_TINT     = 'rgba(244,241,235,0.55)';

const CAPTION_DIM   = 'rgba(244,241,235,0.65)';
const CAPTION_MUTE  = 'rgba(244,241,235,0.55)';
const SERIF_WHITE   = '#E8E1D3';
const URGENT_AMBER  = '#B07A3E';

// ── proportions ───────────────────────────────────────────────────────────
const PANEL_W       = 620;
const PANEL_H       = 720;
const PANEL_RADIUS  = 36;
const PANEL_Y       = 0;

const HEADER_Y_REL  = -PANEL_H / 2 + 60;
const PILL_Y_REL    = HEADER_Y_REL + 64;
const BUBBLE_Y_REL  = +30;

const BUBBLE_W      = 420;
const BUBBLE_H      = 184;
const BUBBLE_RADIUS = 30;
const BUBBLE_X_REL  = -PANEL_W / 2 + 36 + BUBBLE_W / 2;

// Tail — soft 5-point shape on the bubble's left edge near the bottom.
// Points are local to the panel; the upper and lower attach points
// overlap the bubble by 2 px so the bubble's stroke is hidden where
// they meet. Smoothing comes from the Line's radius.
const TAIL_ATTACH_X = BUBBLE_X_REL - BUBBLE_W / 2 + 2;
const TAIL_TOP_Y    = BUBBLE_Y_REL + BUBBLE_H / 2 - 36;
const TAIL_BOT_Y    = BUBBLE_Y_REL + BUBBLE_H / 2 - 4;
const TAIL_W        = 16;

// Input field at the bottom of the panel.
const INPUT_W       = PANEL_W - 60;
const INPUT_H       = 56;
const INPUT_RADIUS  = 28;
const INPUT_Y_REL   = +PANEL_H / 2 - 56;

// ── tiny vector glyphs (built from Rects, not unicode emoji) ──────────────
function plusGlyph(cx: number, cy: number, size = 18, tint = ICON_TINT) {
    const t = 2;
    return (
        <>
            <Rect x={cx} y={cy} width={size} height={t} radius={1} fill={tint} />
            <Rect x={cx} y={cy} width={t} height={size} radius={1} fill={tint} />
        </>
    );
}

function micGlyph(cx: number, cy: number, tint = ICON_TINT) {
    return (
        <>
            {/* mic capsule */}
            <Rect x={cx} y={cy - 4} width={10} height={16} radius={5}
                fill="rgba(0,0,0,0)" stroke={tint} lineWidth={1.6} />
            {/* mic stem */}
            <Rect x={cx} y={cy + 8} width={2} height={4} radius={1} fill={tint} />
            {/* mic base */}
            <Rect x={cx} y={cy + 11} width={12} height={2} radius={1} fill={tint} />
        </>
    );
}

// ──────────────────────────────────────────────────────────────────────────
export default makeScene2D(function* (view) {
    applyBackground(view);

    const panelRef    = createRef<Rect>();
    const headerRef   = createRef<Txt>();
    const datePillRef = createRef<Rect>();
    const dateTxtRef  = createRef<Txt>();
    const bubbleRef   = createRef<Rect>();
    const tailRef     = createRef<Line>();
    const paymentRef  = createRef<Txt>();
    const urgentRef   = createRef<Txt>();
    const inputRef    = createRef<Rect>();
    const placeRef    = createRef<Txt>();

    const INPUT_LEFT_GLYPH_X  = -INPUT_W / 2 + 30;
    const INPUT_RIGHT_GLYPH_X = +INPUT_W / 2 - 30;
    const INPUT_PLACE_X       = -INPUT_W / 2 + 64;

    view.add(
        <Rect
            ref={panelRef}
            y={PANEL_Y}
            width={PANEL_W} height={PANEL_H}
            radius={PANEL_RADIUS}
            fill={MSG_SURFACE}
            stroke={MSG_STROKE} lineWidth={1}
            shadowColor={MSG_SHADOW} shadowBlur={36} shadowOffset={[-10, 16]}
            opacity={0}
        >
            <Txt
                ref={headerRef}
                text="WHATSAPP"
                fontFamily={F_SERIF} fontSize={18} fontWeight={500}
                fill={CAPTION_DIM} letterSpacing={4}
                y={HEADER_Y_REL}
                opacity={0}
            />

            {/* date pill */}
            <Rect
                ref={datePillRef}
                width={72} height={24} radius={12}
                fill="rgba(255,255,255,0.06)"
                stroke="rgba(255,255,255,0.05)" lineWidth={1}
                y={PILL_Y_REL}
                opacity={0}
            />
            <Txt
                ref={dateTxtRef}
                text="TODAY"
                fontFamily={F_MONO} fontSize={12} fontWeight={500}
                fill={CAPTION_MUTE} letterSpacing={2}
                y={PILL_Y_REL}
                opacity={0}
            />

            {/* bubble */}
            <Rect
                ref={bubbleRef}
                width={BUBBLE_W} height={BUBBLE_H} radius={BUBBLE_RADIUS}
                fill={BUBBLE_FILL} stroke={BUBBLE_STROKE} lineWidth={1}
                x={BUBBLE_X_REL} y={BUBBLE_Y_REL + 12}
                opacity={0}
            />

            {/* soft tail — fill only, slightly overlapping the bubble's
                left stroke so the seam disappears. radius={6} smooths the
                three outer corners. */}
            <Line
                ref={tailRef}
                closed
                fill={BUBBLE_FILL}
                radius={6}
                points={[
                    [TAIL_ATTACH_X,            TAIL_TOP_Y],
                    [TAIL_ATTACH_X - 6,        TAIL_TOP_Y + 8],
                    [TAIL_ATTACH_X - TAIL_W,   TAIL_TOP_Y + 18],
                    [TAIL_ATTACH_X - 4,        TAIL_BOT_Y],
                    [TAIL_ATTACH_X,            TAIL_BOT_Y],
                ]}
                opacity={0}
            />

            <Txt
                ref={paymentRef}
                text="Payment failed"
                fontFamily={F_SERIF} fontSize={42} fontWeight={500}
                fill={SERIF_WHITE}
                x={BUBBLE_X_REL} y={BUBBLE_Y_REL - 22 + 12}
                opacity={0}
            />
            <Txt
                ref={urgentRef}
                text="URGENT"
                fontFamily={F_MONO} fontSize={22} fontWeight={500}
                fill={URGENT_AMBER} letterSpacing={0}
                x={BUBBLE_X_REL} y={BUBBLE_Y_REL + 36 + 12}
                opacity={0}
            />

            {/* input field — pill with plus on the left, placeholder
                centred-left, mic on the right */}
            <Rect
                ref={inputRef}
                width={INPUT_W} height={INPUT_H} radius={INPUT_RADIUS}
                fill={INPUT_FILL} stroke={INPUT_STROKE} lineWidth={1}
                y={INPUT_Y_REL}
                opacity={0}
            >
                {plusGlyph(INPUT_LEFT_GLYPH_X, 0, 16)}
                <Txt
                    ref={placeRef}
                    text="Message"
                    fontFamily={F_SERIF} fontSize={20}
                    fontStyle="italic" fontWeight={400}
                    fill={PLACEHOLDER}
                    x={INPUT_PLACE_X + 36}
                />
                {micGlyph(INPUT_RIGHT_GLYPH_X, 0)}
            </Rect>
        </Rect>,
    );

    yield* panelRef().opacity(1, 0.55, easeOutCubic);
    yield* headerRef().opacity(1, 0.4, easeOutCubic);
    yield* waitFor(0.12);
    yield* all(
        datePillRef().opacity(1, 0.35, easeOutCubic),
        dateTxtRef().opacity(1, 0.35, easeOutCubic),
    );
    yield* waitFor(0.2);

    yield* all(
        bubbleRef().opacity(1, 0.5, easeOutCubic),
        bubbleRef().y(BUBBLE_Y_REL, 0.5, easeOutCubic),
        tailRef().opacity(1, 0.5, easeOutCubic),
        paymentRef().opacity(1, 0.5, easeOutCubic),
        paymentRef().y(BUBBLE_Y_REL - 22, 0.5, easeOutCubic),
    );
    yield* waitFor(0.2);

    yield* all(
        urgentRef().opacity(1, 0.35, easeOutCubic),
        urgentRef().y(BUBBLE_Y_REL + 36, 0.35, easeOutCubic),
        urgentRef().letterSpacing(5, 0.45, easeOutCubic),
    );
    yield* waitFor(0.3);

    yield* inputRef().opacity(1, 0.4, easeOutCubic);

    yield* waitFor(4.0);
});
