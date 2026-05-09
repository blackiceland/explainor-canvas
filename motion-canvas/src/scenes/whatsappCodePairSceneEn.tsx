import {Circle, Path, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
    all,
    createRef,
    easeOutCubic,
    waitFor,
} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// ══════════════════════════════════════════════════════════════════════════
//  WhatsApp dark-mode messenger — realistic.
//
//  Anatomy (top-to-bottom inside the panel):
//
//    1. Chat header bar — avatar + sender name + "online" status.
//    2. Earlier message bubble (context, smaller).
//    3. Main message bubble — Payment failed + sub-line + timestamp.
//    4. Input field — emoji glyph + placeholder + clip + mic.
//
//  Colours follow the canonical WA dark-mode palette: panel #0B141A,
//  header / bubble #1F2C33, accent green for status dot #25D366
//  (toned down to a calmer #4DA37D so it doesn't shout). Text in the
//  message is sans-serif (system-feel), with the headline kept in
//  Newsreader serif so the editorial brand still bleeds through.
// ══════════════════════════════════════════════════════════════════════════

const F_SERIF = 'Newsreader, "Source Serif 4", "EB Garamond", serif';
const F_SANS  = Fonts.primary;
const F_MONO  = Fonts.code;

// Realistic WA dark palette
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
const PANEL_W       = 620;
const PANEL_H       = 760;
const PANEL_RADIUS  = 36;
const PANEL_Y       = 0;

// header bar
const HEADER_H      = 70;
const HEADER_Y_REL  = -PANEL_H / 2 + HEADER_H / 2;
const AVATAR_R      = 22;
const AVATAR_X_REL  = -PANEL_W / 2 + 32 + AVATAR_R;
const NAME_X_REL    = AVATAR_X_REL + AVATAR_R + 18;

// earlier bubble (context)
const EBUBBLE_W     = 280;
const EBUBBLE_H     = 56;
const EBUBBLE_X_REL = -PANEL_W / 2 + 30 + EBUBBLE_W / 2;
const EBUBBLE_Y_REL = -190;

// main bubble
const BUBBLE_W      = 440;
const BUBBLE_H      = 158;
const BUBBLE_RADIUS = 18;
const BUBBLE_X_REL  = -PANEL_W / 2 + 30 + BUBBLE_W / 2;
const BUBBLE_Y_REL  = -10;

// main-bubble path (bubble + tail) in path-local coords
const BUBBLE_AX = -BUBBLE_W / 2;
const BUBBLE_AY = -BUBBLE_H / 2;
const TAIL_TIP_X = BUBBLE_AX - 10;
const TAIL_TIP_Y = BUBBLE_AY - 4;
const MAIN_BUBBLE_PATH = [
    `M ${BUBBLE_AX + BUBBLE_RADIUS} ${BUBBLE_AY}`,
    `H ${BUBBLE_AX + BUBBLE_W - BUBBLE_RADIUS}`,
    `Q ${BUBBLE_AX + BUBBLE_W} ${BUBBLE_AY} ${BUBBLE_AX + BUBBLE_W} ${BUBBLE_AY + BUBBLE_RADIUS}`,
    `V ${BUBBLE_AY + BUBBLE_H - BUBBLE_RADIUS}`,
    `Q ${BUBBLE_AX + BUBBLE_W} ${BUBBLE_AY + BUBBLE_H} ${BUBBLE_AX + BUBBLE_W - BUBBLE_RADIUS} ${BUBBLE_AY + BUBBLE_H}`,
    `H ${BUBBLE_AX + BUBBLE_RADIUS}`,
    `Q ${BUBBLE_AX} ${BUBBLE_AY + BUBBLE_H} ${BUBBLE_AX} ${BUBBLE_AY + BUBBLE_H - BUBBLE_RADIUS}`,
    `V ${BUBBLE_AY + 6}`,
    `L ${TAIL_TIP_X} ${TAIL_TIP_Y}`,
    `L ${BUBBLE_AX + 6} ${BUBBLE_AY}`,
    `Z`,
].join(' ');

// earlier-bubble path (smaller, same tail anatomy)
const EB_AX = -EBUBBLE_W / 2;
const EB_AY = -EBUBBLE_H / 2;
const EB_R  = 16;
const EB_TAIL_TIP_X = EB_AX - 8;
const EB_TAIL_TIP_Y = EB_AY - 3;
const EARLIER_BUBBLE_PATH = [
    `M ${EB_AX + EB_R} ${EB_AY}`,
    `H ${EB_AX + EBUBBLE_W - EB_R}`,
    `Q ${EB_AX + EBUBBLE_W} ${EB_AY} ${EB_AX + EBUBBLE_W} ${EB_AY + EB_R}`,
    `V ${EB_AY + EBUBBLE_H - EB_R}`,
    `Q ${EB_AX + EBUBBLE_W} ${EB_AY + EBUBBLE_H} ${EB_AX + EBUBBLE_W - EB_R} ${EB_AY + EBUBBLE_H}`,
    `H ${EB_AX + EB_R}`,
    `Q ${EB_AX} ${EB_AY + EBUBBLE_H} ${EB_AX} ${EB_AY + EBUBBLE_H - EB_R}`,
    `V ${EB_AY + 5}`,
    `L ${EB_TAIL_TIP_X} ${EB_TAIL_TIP_Y}`,
    `L ${EB_AX + 5} ${EB_AY}`,
    `Z`,
].join(' ');

// input field
const INPUT_W       = PANEL_W - 60;
const INPUT_H       = 56;
const INPUT_RADIUS  = 28;
const INPUT_Y_REL   = +PANEL_H / 2 - 56;

// ── tiny vector glyphs ────────────────────────────────────────────────────
function plusGlyph(cx: number, cy: number, size = 16, tint = ICON_TINT) {
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
            <Rect x={cx} y={cy - 4} width={10} height={16} radius={5}
                fill="rgba(0,0,0,0)" stroke={tint} lineWidth={1.6} />
            <Rect x={cx} y={cy + 8} width={2} height={4} radius={1} fill={tint} />
            <Rect x={cx} y={cy + 11} width={12} height={2} radius={1} fill={tint} />
        </>
    );
}

// double check-marks (the WA "delivered/read" indicator) — outgoing only;
// for incoming bubbles we just show the timestamp.
function timestamp(cx: number, cy: number, text: string) {
    return (
        <Txt
            text={text}
            fontFamily={F_SANS} fontSize={11} fontWeight={400}
            fill={TEXT_MUTED}
            x={cx} y={cy}
        />
    );
}

// ──────────────────────────────────────────────────────────────────────────
export default makeScene2D(function* (view) {
    applyBackground(view);

    const panelRef    = createRef<Rect>();
    const headerBgRef = createRef<Rect>();
    const avatarRef   = createRef<Circle>();
    const avatarLetter = createRef<Txt>();
    const nameRef     = createRef<Txt>();
    const statusRef   = createRef<Txt>();
    const statusDotRef = createRef<Circle>();

    const earlierBubbleRef = createRef<Path>();
    const earlierTextRef   = createRef<Txt>();

    const bubbleRef    = createRef<Path>();
    const headlineRef  = createRef<Txt>();
    const sublineRef   = createRef<Txt>();
    const timeRef      = createRef<Txt>();

    const inputRef = createRef<Rect>();

    view.add(
        <Rect
            ref={panelRef}
            y={PANEL_Y}
            width={PANEL_W} height={PANEL_H}
            radius={PANEL_RADIUS}
            fill={PANEL_BG}
            stroke={PANEL_STROKE} lineWidth={1}
            shadowColor={PANEL_SHADOW} shadowBlur={40} shadowOffset={[-10, 18]}
            opacity={0}
            clip
        >
            {/* header bar */}
            <Rect
                ref={headerBgRef}
                width={PANEL_W} height={HEADER_H}
                fill={HEADER_BG}
                y={HEADER_Y_REL}
            />
            <Circle
                ref={avatarRef}
                width={AVATAR_R * 2} height={AVATAR_R * 2}
                fill="#3A4F5A"
                x={AVATAR_X_REL} y={HEADER_Y_REL}
            />
            <Txt
                ref={avatarLetter}
                text="A"
                fontFamily={F_SANS} fontSize={18} fontWeight={600}
                fill={TEXT_PRIMARY}
                x={AVATAR_X_REL} y={HEADER_Y_REL}
            />
            <Txt
                ref={nameRef}
                text="Acme Notifications"
                fontFamily={F_SANS} fontSize={17} fontWeight={500}
                fill={TEXT_PRIMARY}
                textAlign="left"
                x={NAME_X_REL + 90} y={HEADER_Y_REL - 9}
            />
            <Circle
                ref={statusDotRef}
                width={6} height={6}
                fill={ONLINE_DOT}
                x={NAME_X_REL + 4} y={HEADER_Y_REL + 12}
            />
            <Txt
                ref={statusRef}
                text="online"
                fontFamily={F_SANS} fontSize={12}
                fill={TEXT_MUTED}
                x={NAME_X_REL + 38} y={HEADER_Y_REL + 12}
            />

            {/* earlier (context) bubble */}
            <Path
                ref={earlierBubbleRef}
                data={EARLIER_BUBBLE_PATH}
                fill={BUBBLE_BG}
                x={EBUBBLE_X_REL} y={EBUBBLE_Y_REL}
                opacity={0}
            />
            <Txt
                ref={earlierTextRef}
                text="Your card on file was declined."
                fontFamily={F_SANS} fontSize={15} fontWeight={400}
                fill={TEXT_PRIMARY}
                x={EBUBBLE_X_REL} y={EBUBBLE_Y_REL - 4}
                opacity={0}
            />
            {timestamp(EBUBBLE_X_REL + EBUBBLE_W / 2 - 26, EBUBBLE_Y_REL + 16, '2:12')}

            {/* main bubble */}
            <Path
                ref={bubbleRef}
                data={MAIN_BUBBLE_PATH}
                fill={BUBBLE_BG}
                x={BUBBLE_X_REL} y={BUBBLE_Y_REL}
                opacity={0}
            />
            <Txt
                ref={headlineRef}
                text="Payment failed"
                fontFamily={F_SERIF} fontSize={32} fontWeight={500}
                fill={SERIF_WHITE}
                x={BUBBLE_X_REL} y={BUBBLE_Y_REL - 28}
                opacity={0}
            />
            <Txt
                ref={sublineRef}
                text="We couldn't charge your card. Update payment to resume service."
                fontFamily={F_SANS} fontSize={14} fontWeight={400}
                fill={TEXT_MUTED}
                width={BUBBLE_W - 60}
                textAlign="left"
                textWrap
                x={BUBBLE_X_REL} y={BUBBLE_Y_REL + 18}
                opacity={0}
            />
            <Txt
                ref={timeRef}
                text="2:14 PM"
                fontFamily={F_SANS} fontSize={11} fontWeight={400}
                fill={TEXT_MUTED}
                x={BUBBLE_X_REL + BUBBLE_W / 2 - 36}
                y={BUBBLE_Y_REL + BUBBLE_H / 2 - 14}
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
                {plusGlyph(-INPUT_W / 2 + 26, 0, 16)}
                <Txt
                    text="Message"
                    fontFamily={F_SANS} fontSize={15}
                    fill={TEXT_MUTED}
                    x={-INPUT_W / 2 + 70}
                    textAlign="left"
                />
                {micGlyph(+INPUT_W / 2 - 26, 0)}
            </Rect>
        </Rect>,
    );

    yield* panelRef().opacity(1, 0.55, easeOutCubic);
    yield* waitFor(0.18);

    yield* all(
        earlierBubbleRef().opacity(1, 0.45, easeOutCubic),
        earlierTextRef().opacity(1, 0.45, easeOutCubic),
    );
    yield* waitFor(0.35);

    yield* all(
        bubbleRef().opacity(1, 0.5, easeOutCubic),
        headlineRef().opacity(1, 0.5, easeOutCubic),
    );
    yield* waitFor(0.15);
    yield* all(
        sublineRef().opacity(1, 0.4, easeOutCubic),
        timeRef().opacity(1, 0.4, easeOutCubic),
    );
    yield* waitFor(0.35);

    yield* inputRef().opacity(1, 0.4, easeOutCubic);

    yield* waitFor(4.0);
});
