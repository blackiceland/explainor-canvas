import {Line, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
    Reference,
    all,
    createRef,
    easeOutCubic,
    waitFor,
} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// ══════════════════════════════════════════════════════════════════════════
//  Three messenger-panel variants, side by side, for the author to pick.
//
//   A — minimal abstract (current).
//   B — adds tail + left-alignment + date pill.
//   C — adds sender name + tail + alignment + date pill.
// ══════════════════════════════════════════════════════════════════════════

const F_SERIF = 'Newsreader, "Source Serif 4", "EB Garamond", serif';
const F_MONO  = Fonts.code;

// Palette
const MSG_SURFACE   = '#1A1D1C';
const MSG_STROKE    = 'rgba(255,255,255,0.05)';
const MSG_SHADOW    = 'rgba(0,0,0,0.32)';
const BUBBLE_FILL   = '#2A2E2D';
const BUBBLE_STROKE = 'rgba(255,255,255,0.07)';

const CAPTION_DIM   = 'rgba(244,241,235,0.65)';
const CAPTION_VERY  = 'rgba(244,241,235,0.42)';
const CAPTION_MUTE  = 'rgba(244,241,235,0.55)';
const SERIF_WHITE   = '#E8E1D3';
const URGENT_AMBER  = '#B07A3E';

// Layout: three panels in a row.
const PANEL_W       = 540;
const PANEL_H       = 620;
const PANEL_RADIUS  = 32;
const PANEL_GAP     = 60;
const PANEL_Y       = -10;

const CENTERS_X = [
    -(PANEL_W + PANEL_GAP),
    0,
    +(PANEL_W + PANEL_GAP),
];
const TAG_Y = PANEL_Y + PANEL_H / 2 + 56;

// Bubble shared dimensions
const BUBBLE_W      = 360;
const BUBBLE_H      = 168;
const BUBBLE_RADIUS = 30;

// ──────────────────────────────────────────────────────────────────────────
// Variant A — minimal abstract (current state, kept as the control)
//   panel, WHATSAPP small caps, italic Today, centred bubble (no tail).
// ──────────────────────────────────────────────────────────────────────────
function variantA(centerX: number) {
    const panel    = createRef<Rect>();
    const header   = createRef<Txt>();
    const today    = createRef<Txt>();
    const bubble   = createRef<Rect>();
    const payment  = createRef<Txt>();
    const urgent   = createRef<Txt>();

    const HEADER_Y_REL = -PANEL_H / 2 + 70;
    const TODAY_Y_REL  = HEADER_Y_REL + 44;
    const BUBBLE_Y_REL = +60;

    const jsx = (
        <Rect
            ref={panel}
            x={centerX} y={PANEL_Y}
            width={PANEL_W} height={PANEL_H}
            radius={PANEL_RADIUS}
            fill={MSG_SURFACE}
            stroke={MSG_STROKE} lineWidth={1}
            shadowColor={MSG_SHADOW} shadowBlur={30} shadowOffset={[-8, 14]}
            opacity={0}
        >
            <Txt ref={header} text="WHATSAPP"
                fontFamily={F_SERIF} fontSize={17} fontWeight={500}
                fill={CAPTION_DIM} letterSpacing={4}
                y={HEADER_Y_REL} />
            <Txt ref={today} text="Today"
                fontFamily={F_SERIF} fontSize={22}
                fontStyle="italic" fontWeight={400}
                fill={CAPTION_VERY} y={TODAY_Y_REL} />

            <Rect ref={bubble}
                width={BUBBLE_W} height={BUBBLE_H} radius={BUBBLE_RADIUS}
                fill={BUBBLE_FILL} stroke={BUBBLE_STROKE} lineWidth={1}
                y={BUBBLE_Y_REL} />
            <Txt ref={payment} text="Payment failed"
                fontFamily={F_SERIF} fontSize={36} fontWeight={500}
                fill={SERIF_WHITE}
                y={BUBBLE_Y_REL - 18} />
            <Txt ref={urgent} text="URGENT"
                fontFamily={F_MONO} fontSize={20} fontWeight={500}
                fill={URGENT_AMBER} letterSpacing={4}
                y={BUBBLE_Y_REL + 32} />
        </Rect>
    );

    return {jsx, ref: panel};
}

// ──────────────────────────────────────────────────────────────────────────
// Variant B — tail + left-alignment + date pill.
//   Bubble is anchored at the LEFT inset of the panel and grows a tail
//   on its left-bottom edge. "Today" becomes a small centred pill.
// ──────────────────────────────────────────────────────────────────────────
function variantB(centerX: number) {
    const panel  = createRef<Rect>();
    const header = createRef<Txt>();
    const datePill = createRef<Rect>();
    const dateTxt  = createRef<Txt>();
    const bubble = createRef<Rect>();
    const tail   = createRef<Line>();
    const payment = createRef<Txt>();
    const urgent  = createRef<Txt>();

    const HEADER_Y_REL = -PANEL_H / 2 + 60;
    const PILL_Y_REL   = HEADER_Y_REL + 60;
    const BUBBLE_Y_REL = +70;

    // Bubble pinned to the left inset (30 px from the panel's left edge).
    const BUBBLE_X_REL = -PANEL_W / 2 + 30 + BUBBLE_W / 2;

    // Tail: small triangle on the bubble's left-bottom edge. Coordinates
    // are LOCAL TO PANEL (so the tail can be a sibling of bubble, not a
    // child — kept simple).
    const tailRootX = BUBBLE_X_REL - BUBBLE_W / 2;
    const tailRootY = BUBBLE_Y_REL + BUBBLE_H / 2 - 22;
    const TAIL_W    = 14;
    const TAIL_H    = 18;

    const jsx = (
        <Rect
            ref={panel}
            x={centerX} y={PANEL_Y}
            width={PANEL_W} height={PANEL_H}
            radius={PANEL_RADIUS}
            fill={MSG_SURFACE}
            stroke={MSG_STROKE} lineWidth={1}
            shadowColor={MSG_SHADOW} shadowBlur={30} shadowOffset={[-8, 14]}
            opacity={0}
        >
            <Txt ref={header} text="WHATSAPP"
                fontFamily={F_SERIF} fontSize={17} fontWeight={500}
                fill={CAPTION_DIM} letterSpacing={4}
                y={HEADER_Y_REL} />

            {/* date pill — centred, small, mono-uppercase */}
            <Rect ref={datePill}
                width={68} height={22} radius={11}
                fill="rgba(255,255,255,0.06)"
                stroke="rgba(255,255,255,0.05)" lineWidth={1}
                y={PILL_Y_REL} />
            <Txt ref={dateTxt} text="TODAY"
                fontFamily={F_MONO} fontSize={11} fontWeight={500}
                fill={CAPTION_MUTE} letterSpacing={2}
                y={PILL_Y_REL} />

            {/* bubble */}
            <Rect ref={bubble}
                width={BUBBLE_W} height={BUBBLE_H} radius={BUBBLE_RADIUS}
                fill={BUBBLE_FILL} stroke={BUBBLE_STROKE} lineWidth={1}
                x={BUBBLE_X_REL} y={BUBBLE_Y_REL} />

            {/* tail */}
            <Line ref={tail} closed
                fill={BUBBLE_FILL}
                stroke={BUBBLE_STROKE} lineWidth={1}
                points={[
                    [tailRootX,           tailRootY - TAIL_H / 2],
                    [tailRootX - TAIL_W,  tailRootY + TAIL_H / 2],
                    [tailRootX,           tailRootY + TAIL_H / 2],
                ]}
            />

            {/* text inside bubble */}
            <Txt ref={payment} text="Payment failed"
                fontFamily={F_SERIF} fontSize={36} fontWeight={500}
                fill={SERIF_WHITE}
                x={BUBBLE_X_REL} y={BUBBLE_Y_REL - 18} />
            <Txt ref={urgent} text="URGENT"
                fontFamily={F_MONO} fontSize={20} fontWeight={500}
                fill={URGENT_AMBER} letterSpacing={4}
                x={BUBBLE_X_REL} y={BUBBLE_Y_REL + 32} />
        </Rect>
    );

    return {jsx, ref: panel};
}

// ──────────────────────────────────────────────────────────────────────────
// Variant C — sender name + tail + alignment + date pill.
//   "Acme Notifications" sits below the WHATSAPP caption — gives the
//   message a "from" identity. Otherwise same anatomy as B.
// ──────────────────────────────────────────────────────────────────────────
function variantC(centerX: number) {
    const panel  = createRef<Rect>();
    const header = createRef<Txt>();
    const sender = createRef<Txt>();
    const datePill = createRef<Rect>();
    const dateTxt  = createRef<Txt>();
    const bubble = createRef<Rect>();
    const tail   = createRef<Line>();
    const payment = createRef<Txt>();
    const urgent  = createRef<Txt>();

    const HEADER_Y_REL = -PANEL_H / 2 + 56;
    const SENDER_Y_REL = HEADER_Y_REL + 36;
    const PILL_Y_REL   = SENDER_Y_REL + 50;
    const BUBBLE_Y_REL = +90;

    const BUBBLE_X_REL = -PANEL_W / 2 + 30 + BUBBLE_W / 2;
    const tailRootX = BUBBLE_X_REL - BUBBLE_W / 2;
    const tailRootY = BUBBLE_Y_REL + BUBBLE_H / 2 - 22;
    const TAIL_W    = 14;
    const TAIL_H    = 18;

    const jsx = (
        <Rect
            ref={panel}
            x={centerX} y={PANEL_Y}
            width={PANEL_W} height={PANEL_H}
            radius={PANEL_RADIUS}
            fill={MSG_SURFACE}
            stroke={MSG_STROKE} lineWidth={1}
            shadowColor={MSG_SHADOW} shadowBlur={30} shadowOffset={[-8, 14]}
            opacity={0}
        >
            <Txt ref={header} text="WHATSAPP"
                fontFamily={F_SERIF} fontSize={15} fontWeight={500}
                fill={CAPTION_VERY} letterSpacing={4}
                y={HEADER_Y_REL} />

            {/* sender name — slightly larger, warmer than the WHATSAPP caption */}
            <Txt ref={sender} text="Acme Notifications"
                fontFamily={F_SERIF} fontSize={22} fontWeight={500}
                fill={SERIF_WHITE}
                y={SENDER_Y_REL} />

            {/* date pill */}
            <Rect ref={datePill}
                width={68} height={22} radius={11}
                fill="rgba(255,255,255,0.06)"
                stroke="rgba(255,255,255,0.05)" lineWidth={1}
                y={PILL_Y_REL} />
            <Txt ref={dateTxt} text="TODAY"
                fontFamily={F_MONO} fontSize={11} fontWeight={500}
                fill={CAPTION_MUTE} letterSpacing={2}
                y={PILL_Y_REL} />

            {/* bubble */}
            <Rect ref={bubble}
                width={BUBBLE_W} height={BUBBLE_H} radius={BUBBLE_RADIUS}
                fill={BUBBLE_FILL} stroke={BUBBLE_STROKE} lineWidth={1}
                x={BUBBLE_X_REL} y={BUBBLE_Y_REL} />

            <Line ref={tail} closed
                fill={BUBBLE_FILL}
                stroke={BUBBLE_STROKE} lineWidth={1}
                points={[
                    [tailRootX,           tailRootY - TAIL_H / 2],
                    [tailRootX - TAIL_W,  tailRootY + TAIL_H / 2],
                    [tailRootX,           tailRootY + TAIL_H / 2],
                ]}
            />

            <Txt ref={payment} text="Payment failed"
                fontFamily={F_SERIF} fontSize={36} fontWeight={500}
                fill={SERIF_WHITE}
                x={BUBBLE_X_REL} y={BUBBLE_Y_REL - 18} />
            <Txt ref={urgent} text="URGENT"
                fontFamily={F_MONO} fontSize={20} fontWeight={500}
                fill={URGENT_AMBER} letterSpacing={4}
                x={BUBBLE_X_REL} y={BUBBLE_Y_REL + 32} />
        </Rect>
    );

    return {jsx, ref: panel};
}

// ──────────────────────────────────────────────────────────────────────────
export default makeScene2D(function* (view) {
    applyBackground(view);

    const A = variantA(CENTERS_X[0]);
    const B = variantB(CENTERS_X[1]);
    const C = variantC(CENTERS_X[2]);

    view.add(<>{A.jsx}{B.jsx}{C.jsx}</>);

    // A/B/C tags under each panel.
    const tagFor = (label: string, x: number) => (
        <Txt text={label}
            fontFamily={F_MONO} fontSize={28} fontWeight={500}
            fill="rgba(244,241,235,0.55)" letterSpacing={6}
            x={x} y={TAG_Y}
        />
    );
    view.add(<>
        {tagFor('A', CENTERS_X[0])}
        {tagFor('B', CENTERS_X[1])}
        {tagFor('C', CENTERS_X[2])}
    </>);

    // Reveal — quick stagger so all three settle within ~1 second.
    yield* all(
        A.ref().opacity(1, 0.5, easeOutCubic),
    );
    yield* all(
        B.ref().opacity(1, 0.5, easeOutCubic),
    );
    yield* all(
        C.ref().opacity(1, 0.5, easeOutCubic),
    );

    yield* waitFor(6.0);
});
