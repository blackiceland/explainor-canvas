import {Line, Node, Rect, Txt, blur, makeScene2D} from '@motion-canvas/2d';
import {
    Reference,
    ThreadGenerator,
    all,
    createRef,
    createSignal,
    easeInCubic,
    easeInOutCubic,
    easeOutCubic,
    easeOutQuint,
    sequence,
    waitFor,
} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {SyntaxTheme} from '../core/code/model/SyntaxTheme';
import {textWidth} from '../core/utils/textMeasure';

const F_SERIF = 'Newsreader, EB Garamond, serif';
const F_MONO  = '"JetBrains Mono", "Monaspace Argon", monospace';

const VIEW_W = 1080;
const VIEW_H = 1920;

const BG       = '#151A28';
const INK      = '#E7E1D6';
const KEY      = '#CAB4EA';
const DOMAIN   = '#8AC7EF';
const STRING   = '#A8CF98';
const PUNC     = '#D2D8E2';
const OPERATOR = '#8F9AAA';
const HERO     = '#E7E1D6';
const ACCENT   = '#E8C656';
const QUIET    = 'rgba(231, 225, 214, 0.50)';
const MASS     = '#E7E1D6';
const SKEL     = 'rgba(231, 225, 214, 0.25)';
const DIM_OP   = 0.22;

const CODE_X = 20;

const THEME: SyntaxTheme = {
    keyword:     INK,
    type:        DOMAIN,
    string:      STRING,
    number:      INK,
    operator:    OPERATOR,
    punctuation: PUNC,
    method:      INK,
    comment:     QUIET,
    annotation:  INK,
    constant:    DOMAIN,
    plain:       INK,
};

const RULES: ColorRule[] = [
    {match: /^(function|const|let|var|return|if|else|await|async|throw|new|export|import|class|interface|enum)$/, color: KEY},
    {match: /^(sendCartReminder|sendLoginCode|sendMessage|render|send|track|canReceiveMarketing|persistOtp|auditOtpSent|hasValidCard|completedSetup|recentlyActive)$/, color: DOMAIN},
    {match: /^(quietHours|frequencyCap)$/, color: DOMAIN},
    {match: /^(MARKETING|SECURITY|BILLING|ONBOARDING|REENGAGEMENT|CART_TPL|LOGIN_TPL|TTL|TPL)$/, color: '#B49ED8'},
];

const FLAT_CARD = {
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

const CODE_CART = `function sendCartReminder(user, cart) {
    const message = render(CART_TPL, cart)
    const delivery = send(user.phone, message)
    track(user, message, delivery)

    return delivery
}`;

const CODE_LOGIN = `function sendLoginCode(user, code) {
    const message = render(LOGIN_TPL, code)
    const delivery = send(user.phone, message)
    track(user, message, delivery)

    return delivery
}`;

const CODE_MERGED = `function sendMessage(user, template, payload) {
    const message = render(template, payload)
    const delivery = send(user.phone, message)
    track(user, message, delivery)

    return delivery
}`;

// Beat 7 degradation chain. Each state is shaped so morphTo does exactly one thing
// per step (verified by scripts/deg-plan.mjs): only the first `if` types, every other
// new line fades, `track` is kept throughout, and nothing teleports.

// Zoom target: the merge gains a discriminator (template->kind, render(TPL[kind])).
// Same line count as CODE_MERGED, so the body does not move on this step.
const DEG_KIND = `function sendMessage(user, kind, payload) {
    const message = render(TPL[kind], payload)
    const delivery = send(user.phone, message)
    track(user, message, delivery)

    return delivery
}`;

const DEG_GUARD1 = `function sendMessage(user, kind, payload) {
    if (kind === MARKETING && !canReceiveMarketing(user)) return
    const message = render(TPL[kind], payload)
    const delivery = send(user.phone, message)
    track(user, message, delivery)

    return delivery
}`;

// Marketing rules pile on (fade in; the body keeps sliding down).
const DEG_MKT = `function sendMessage(user, kind, payload) {
    if (kind === MARKETING && !canReceiveMarketing(user)) return
    if (kind === MARKETING && quietHours.active(user)) return
    if (kind === MARKETING && frequencyCap.exceeded(user)) return

    const message = render(TPL[kind], payload)
    const delivery = send(user.phone, message)
    track(user, message, delivery)

    return delivery
}`;

// Security rules pile on too: persistOtp + auditOtpSent fade in around the body.
const DEG_FINAL = `function sendMessage(user, kind, payload) {
    if (kind === MARKETING && !canReceiveMarketing(user)) return
    if (kind === MARKETING && quietHours.active(user)) return
    if (kind === MARKETING && frequencyCap.exceeded(user)) return

    if (kind === SECURITY) persistOtp(user, payload.code, TTL)

    const message = render(TPL[kind], payload)
    const delivery = send(user.phone, message)
    track(user, message, delivery)

    if (kind === SECURITY) auditOtpSent(user, delivery)

    return delivery
}`;

// Opens a 10-line gap before return for the placeholder bars (lines 12..21).
const DEG_FINAL_SPACED = DEG_FINAL.replace(
    'auditOtpSent(user, delivery)\n\n    return delivery',
    'auditOtpSent(user, delivery)\n' + '\n'.repeat(10) + '    return delivery',
);

// ── Shape geometry ───────────────────────────────────────────────────
function marketingBlobPoints(): [number, number][] {
    const pts: [number, number][] = [];
    const N = 24;
    for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        const wobble = 1 + Math.sin(a * 3) * 0.06 + Math.sin(a * 5 + 0.7) * 0.04;
        const r = 130 * wobble;
        pts.push([Math.cos(a) * r * 1.05, Math.sin(a) * r * 0.95]);
    }
    return pts;
}

function securityHexPoints(): [number, number][] {
    const pts: [number, number][] = [];
    const r = 138;
    const tilt = 0.12;
    for (let i = 0; i < 6; i++) {
        const a = tilt + (i / 6) * Math.PI * 2;
        pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.96]);
    }
    return pts;
}

function billingDiscPoints(): [number, number][] {
    // A calm octagon — distinct from the marketing blob and the security hexagon,
    // a neutral third domain.
    const pts: [number, number][] = [];
    const r = 124;
    const N = 8;
    for (let i = 0; i < N; i++) {
        const a = Math.PI / N + (i / N) * Math.PI * 2; // flat top/bottom
        pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.98]);
    }
    return pts;
}

function measureRow(line: string, fontFamily: string, fontSize: number): {indentPx: number; widthPx: number} {
    const lead = line.match(/^\s*/)?.[0] ?? '';
    const trimmed = line.slice(lead.length);
    return {
        indentPx: textWidth(lead, fontFamily, fontSize),
        widthPx: textWidth(trimmed, fontFamily, fontSize),
    };
}

function widthAtY(points: [number, number][], y: number): number {
    let leftX = Infinity, rightX = -Infinity;
    for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        if (y < Math.min(y1, y2) || y > Math.max(y1, y2)) continue;
        if (Math.abs(y2 - y1) < 0.0001) continue;
        const t = (y - y1) / (y2 - y1);
        const x = x1 + t * (x2 - x1);
        if (x < leftX) leftX = x;
        if (x > rightX) rightX = x;
    }
    return Math.max(0, rightX - leftX);
}

type SkeletonHandle = { bars: Reference<Rect>[]; node: Reference<Node> };

function buildSkeleton(
    centerY: number, barCount: number, lh: number,
    widths: number[], indents: number[],
    contentLeft: number, totalLines: number,
    lineIndices?: number[],
): {handle: SkeletonHandle; jsx: any} {
    const bars: Reference<Rect>[] = [];
    const node = createRef<Node>();
    const startRel = -((totalLines - 1) / 2) * lh;
    const indices = lineIndices ?? Array.from({length: barCount}, (_, i) => i);
    const jsx = (
        <Node ref={node} opacity={0}>
            {indices.slice(0, barCount).map((lineIdx, i) => {
                const ref = createRef<Rect>();
                bars.push(ref);
                return (
                    <Rect
                        ref={ref}
                        width={widths[i]} height={12} radius={4}
                        fill={SKEL}
                        x={contentLeft + indents[i] + widths[i] / 2}
                        y={centerY + startRel + lineIdx * lh}
                    />
                );
            })}
        </Node>
    );
    return {handle: {bars, node}, jsx};
}

function compressBarsToSilhouetteWidths(
    bars: Reference<Rect>[], barYsRelativeToFigure: number[],
    figurePoints: [number, number][], duration: number, figureX = 0,
): ThreadGenerator[] {
    const out: ThreadGenerator[] = [];
    for (let i = 0; i < bars.length; i++) {
        const targetW = widthAtY(figurePoints, barYsRelativeToFigure[i]);
        out.push(bars[i]().width(targetW, duration, easeInOutCubic));
        out.push(bars[i]().x(figureX, duration, easeInOutCubic));
        out.push(bars[i]().fill(MASS, duration, easeInOutCubic));
    }
    return out;
}

function applyGlow(block: Manticore): void {
    const glowMap: Record<string, string> = {
        [KEY]:    'rgba(202, 180, 234, 0.13)',
        [DOMAIN]: 'rgba(138, 199, 239, 0.13)',
        [STRING]: 'rgba(168, 207, 152, 0.13)',
    };
    for (let i = 0; i < block.lineCount; i++) {
        const line = block.getLine(i);
        if (!line) continue;
        for (const tokenData of line.tokens) {
            const node = tokenData.ref();
            const fill = String(node.fill());
            const glow = glowMap[fill];
            if (glow) {
                node.shadowColor(glow);
                node.shadowBlur(8);
                node.shadowOffset([0, 0]);
            } else {
                node.shadowColor('rgba(0, 0, 0, 0.30)');
                node.shadowBlur(6);
                node.shadowOffset([0, 1]);
            }
        }
    }
}

function bumpWeight(block: Manticore, weight: number): void {
    for (let i = 0; i < block.lineCount; i++) {
        const line = block.getLine(i);
        if (!line) continue;
        for (const tokenData of line.tokens) {
            tokenData.ref().fontWeight(weight);
        }
    }
}

function* highlightOnly(blocks: Manticore[], idx: number, dur = 0.4): ThreadGenerator {
    const ops: ThreadGenerator[] = [];
    for (const b of blocks) {
        for (let i = 0; i < b.lineCount; i++) {
            const line = b.getLine(i);
            if (line) ops.push(line.setOpacity(i === idx ? 1 : DIM_OP, dur));
        }
    }
    if (ops.length) yield* all(...ops);
}

type BlockOpts = {
    code: string; x?: number; y: number;
    width?: number; fontSize?: number; lineHeight?: number; noClip?: boolean;
};

function makeBlock(o: BlockOpts): Manticore {
    return Manticore.create(o.code, {
        x: o.x ?? 0, y: o.y,
        width: o.width ?? 1040,
        fontSize: o.fontSize ?? 32,
        lineHeight: o.lineHeight ?? 46,
        fontFamily: F_MONO,
        theme: THEME,
        cardStyle: FLAT_CARD,
        glowAccent: false,
        noClip: o.noClip ?? false,
    });
}

function* awaitFontsReady(): ThreadGenerator {
    if (typeof document === 'undefined') return;
    try {
        document.fonts.load(`400 32px "JetBrains Mono"`);
        document.fonts.load(`500 32px "JetBrains Mono"`);
        document.fonts.load(`400 120px "Newsreader"`);
        document.fonts.load(`italic 400 120px "Newsreader"`);
    } catch {}
    for (let i = 0; i < 60; i++) {
        if (document.fonts.check(`400 32px "JetBrains Mono"`)) return;
        yield* waitFor(0.05);
    }
}

// ── Typing animation for comment-style subtitles ─────────────────────
function* typeBody(
    ref: ReturnType<typeof createRef<Txt>>, body: string, charDelay = 0.03,
): ThreadGenerator {
    ref().text('');
    for (let i = 1; i <= body.length; i++) {
        ref().text(body.substring(0, i));
        yield* waitFor(charDelay);
    }
}


function* swapSub(
    ref: ReturnType<typeof createRef<Txt>>, body: string,
): ThreadGenerator {
    ref().text('');
    yield* waitFor(0.08);
    yield* typeBody(ref, body);
}

// ══════════════════════════════════════════════════════════════════════
export default makeScene2D(function* (view) {
    yield* awaitFontsReady();

    view.add(<Rect width={VIEW_W} height={VIEW_H} fill={BG} />);

    // ── Editorial frame ─────────────────────────────────────────────
    view.add(<Txt
        text="KUROSHIMA"
        fontFamily={F_SERIF} fontSize={22} fontWeight={500}
        letterSpacing={5} fill={HERO} y={-820}
    />);
    view.add(<Txt
        text="ISSUE 02"
        fontFamily={F_SERIF} fontSize={20} fontWeight={500}
        letterSpacing={4} fill={HERO} y={820}
    />);

// ════════════════════════════════════════════════════════════════
    //  Beat 1 — CODE FIRST, then HERO on top
    // ════════════════════════════════════════════════════════════════
    const cart  = makeBlock({code: CODE_CART,  x: CODE_X, y: -210, fontSize: 32, lineHeight: 46, width: 1100});
    const login = makeBlock({code: CODE_LOGIN, x: CODE_X, y: +270, fontSize: 32, lineHeight: 46, width: 1100});
    cart.mount(view);
    login.mount(view);
    bumpWeight(cart, 500);
    bumpWeight(login, 500);
    cart.colorize(RULES);
    login.colorize(RULES);
    applyGlow(cart);
    applyGlow(login);
    const SHIFT = 10;
    const cartBlur = createSignal(8);
    const loginBlur = createSignal(8);
    cart.node.filters(() => [blur(cartBlur())]);
    login.node.filters(() => [blur(loginBlur())]);
    cart.node.opacity(0);
    login.node.opacity(0);
    cart.node.x(CODE_X - SHIFT);
    login.node.x(CODE_X - SHIFT);

    yield* all(
        cart.node.opacity(1, 0.7, easeOutCubic),
        login.node.opacity(1, 0.7, easeOutCubic),
        cartBlur(0, 0.7, easeOutCubic),
        loginBlur(0, 0.7, easeOutCubic),
        cart.node.x(CODE_X, 0.7, easeOutCubic),
        login.node.x(CODE_X, 0.7, easeOutCubic),
    );
    yield* waitFor(0.3);

    // Subtitle: static `//` + typed body, both left-aligned at fixed x.
    // x=-175 centres the group visually for average subtitle length.
    const SUB_Y = 680;
    const SUB_X = -230;
    const SUB_FS = 37;
    const SLASH_W = 67; // "// " = 3 chars × ~22.2px at JBM 37px
    const subSlashes = createRef<Txt>();
    const subBody = createRef<Txt>();
    view.add(<Txt
        ref={subSlashes} text="// "
        fontFamily={F_MONO} fontSize={SUB_FS} fontWeight={500}
        fill={ACCENT} offset={[-1, 0]}
        x={SUB_X} y={SUB_Y} opacity={0}
    />);
    view.add(<Txt
        ref={subBody} text=""
        fontFamily={F_MONO} fontSize={SUB_FS} fontWeight={500}
        fill={ACCENT} offset={[-1, 0]}
        x={SUB_X + SLASH_W} y={SUB_Y} opacity={0}
    />);

    subSlashes().opacity(1);
    subBody().opacity(1);
    yield* typeBody(subBody, 'two functions');
    yield* waitFor(0.8);

    // ════════════════════════════════════════════════════════════════
    //  Beat 2 — SEQUENTIAL HIGHLIGHT (no crystal)
    // ════════════════════════════════════════════════════════════════
    const RENDER_LINE = 1;
    const SEND_LINE   = 2;
    const TRACK_LINE  = 3;
    const RETURN_LINE = 5;

    // RENDER
    yield* all(
        highlightOnly([cart, login], RENDER_LINE, 0.4),
        swapSub(subBody, 'render the message'),
    );
    yield* waitFor(0.25);

    // SEND
    yield* all(
        highlightOnly([cart, login], SEND_LINE, 0.3),
        swapSub(subBody, 'send to the user'),
    );
    yield* waitFor(0.25);

    // TRACK
    yield* all(
        highlightOnly([cart, login], TRACK_LINE, 0.3),
        swapSub(subBody, 'track the delivery'),
    );
    yield* waitFor(0.25);

    // RETURN
    yield* all(
        highlightOnly([cart, login], RETURN_LINE, 0.3),
        swapSub(subBody, 'return the result'),
    );
    yield* waitFor(0.25);

    // Restore all lines, subtitle fades
    yield* all(
        cart.showAllLines(0.4),
        login.showAllLines(0.4),
        subSlashes().opacity(0, 0.4, easeInCubic),
        subBody().opacity(0, 0.4, easeInCubic),
    );
    yield* waitFor(0.3);

    // ════════════════════════════════════════════════════════════════
    //  Beat 3 — MERGE: code → bars → shapes
    // ════════════════════════════════════════════════════════════════
    const lineCount = 7;
    const lh = 46;
    const cartLineIndices = [1, 2, 3, 5];
    const contentLeft = -1100 / 2 + 56 + CODE_X;

    const cartLines = CODE_CART.split('\n');
    const loginLines = CODE_LOGIN.split('\n');
    const cartRowSpec  = cartLineIndices.map(idx => measureRow(cartLines[idx], F_MONO, 32));
    const loginRowSpec = cartLineIndices.map(idx => measureRow(loginLines[idx], F_MONO, 32));
    const cartWidths   = cartRowSpec.map(r => r.widthPx);
    const loginWidths  = loginRowSpec.map(r => r.widthPx);
    const cartIndents  = cartRowSpec.map(r => r.indentPx);
    const loginIndents = loginRowSpec.map(r => r.indentPx);

    const cartCenterY  = -210;
    const loginCenterY =  270;
    const barCount = cartLineIndices.length;

    const barYsRel = cartLineIndices.map(idx =>
        idx * lh + (-((lineCount - 1) / 2) * lh),
    );

    const cartSkel  = buildSkeleton(cartCenterY,  barCount, lh, cartWidths,  cartIndents,  contentLeft, lineCount, cartLineIndices);
    const loginSkel = buildSkeleton(loginCenterY, barCount, lh, loginWidths, loginIndents, contentLeft, lineCount, cartLineIndices);
    view.add(cartSkel.jsx);
    view.add(loginSkel.jsx);

    yield* all(
        cart.node.opacity(0, 0.45, easeInOutCubic),
        login.node.opacity(0, 0.45, easeInOutCubic),
        cartSkel.handle.node().opacity(1, 0.45, easeInOutCubic),
        loginSkel.handle.node().opacity(1, 0.45, easeInOutCubic),
    );
    cart.node.remove();
    login.node.remove();

    yield* all(
        ...compressBarsToSilhouetteWidths(cartSkel.handle.bars,  barYsRel, marketingBlobPoints(), 0.7, CODE_X),
        ...compressBarsToSilhouetteWidths(loginSkel.handle.bars, barYsRel, securityHexPoints(),   0.7, CODE_X),
    );
    yield* waitFor(0.18);

    // Shapes cross-fade in
    const marketingShape = createRef<Line>();
    const securityShape  = createRef<Line>();
    const labels = createRef<Node>();

    view.add(<Line
        ref={marketingShape} points={marketingBlobPoints()} closed
        fill={MASS} x={CODE_X} y={cartCenterY} opacity={0}
    />);
    view.add(<Line
        ref={securityShape} points={securityHexPoints()} closed
        fill={MASS} x={CODE_X} y={loginCenterY} opacity={0}
    />);
    view.add(<Node ref={labels} x={CODE_X} opacity={0}>
        <Txt text="MARKETING"
            fontFamily={F_SERIF} fontSize={24} fontWeight={500}
            letterSpacing={5} fill={MASS} y={cartCenterY + 155}
        />
        <Txt text="SECURITY"
            fontFamily={F_SERIF} fontSize={24} fontWeight={500}
            letterSpacing={5} fill={MASS} y={loginCenterY + 155}
        />
    </Node>);

    yield* all(
        cartSkel.handle.node().opacity(0, 0.5, easeInOutCubic),
        loginSkel.handle.node().opacity(0, 0.5, easeInOutCubic),
        marketingShape().opacity(1, 0.5, easeInOutCubic),
        securityShape().opacity(1, 0.5, easeInOutCubic),
    );
    cartSkel.handle.node().remove();
    loginSkel.handle.node().remove();

    // ════════════════════════════════════════════════════════════════
    //  Beat 4 — labels
    // ════════════════════════════════════════════════════════════════
    yield* labels().opacity(1, 0.5, easeOutCubic);
    yield* waitFor(3.0);

    // ════════════════════════════════════════════════════════════════
    //  Beat 5 — shapes merge to center
    // ════════════════════════════════════════════════════════════════
    yield* all(
        marketingShape().position.y(0, 0.7, easeInOutCubic),
        securityShape().position.y(0, 0.7, easeInOutCubic),
        labels().opacity(0, 0.45, easeInCubic),
        (function* (): ThreadGenerator {
            yield* waitFor(0.45);
            yield* securityShape().scale(0.82, 0.15, easeInCubic);
        })(),
    );
    labels().remove();
    securityShape().remove();

    // ════════════════════════════════════════════════════════════════
    //  Beat 6 — reverse: figure → bars → merged code
    // ════════════════════════════════════════════════════════════════
    const MERGED_LH = 46;
    const MERGED_TOTAL_LINES = 7;
    const MERGED_TOP = -((MERGED_TOTAL_LINES - 1) / 2) * MERGED_LH;
    const mergedLineIndices = [0, 1, 2, 3, 5];
    const mergedContentLeft = -1100 / 2 + 56 + CODE_X;
    const mergedLines = CODE_MERGED.split('\n');
    const mergedRowSpec = mergedLineIndices.map(idx => measureRow(mergedLines[idx], F_MONO, 32));
    const mergedWidths  = mergedRowSpec.map(r => r.widthPx);
    const mergedIndents = mergedRowSpec.map(r => r.indentPx);
    const N_REV_BARS = mergedWidths.length;

    const blobPts = marketingBlobPoints();
    const revBarsNode = createRef<Node>();
    const revBarRefs: Reference<Rect>[] = [];

    view.add(<Node ref={revBarsNode} opacity={0}>
        {Array.from({length: N_REV_BARS}, (_, i) => {
            const ref = createRef<Rect>();
            revBarRefs.push(ref);
            const barY = MERGED_TOP + mergedLineIndices[i] * MERGED_LH;
            const initialW = widthAtY(blobPts, barY);
            return (
                <Rect ref={ref}
                    width={initialW} height={12} radius={4}
                    fill={MASS} x={CODE_X} y={barY}
                />
            );
        })}
    </Node>);

    // Blob dissolves while bars appear underneath
    yield* all(
        marketingShape().opacity(0, 0.4, easeInCubic),
        revBarsNode().opacity(1, 0.4, easeOutCubic),
    );
    marketingShape().remove();
    yield* waitFor(0.2);

    const expandOps: ThreadGenerator[] = [];
    for (let i = 0; i < N_REV_BARS; i++) {
        const targetX = mergedContentLeft + mergedIndents[i] + mergedWidths[i] / 2;
        expandOps.push(revBarRefs[i]().width(mergedWidths[i], 0.6, easeInOutCubic));
        expandOps.push(revBarRefs[i]().x(targetX, 0.6, easeInOutCubic));
        expandOps.push(revBarRefs[i]().fill(SKEL, 0.6, easeInOutCubic));
    }
    yield* all(...expandOps);
    yield* waitFor(0.25);

    const merged = makeBlock({
        code: CODE_MERGED, x: CODE_X, y: 0,
        fontSize: 32, lineHeight: MERGED_LH,
        width: 1100, noClip: true,
    });
    merged.mount(view);
    bumpWeight(merged, 500);
    merged.colorize(RULES);
    applyGlow(merged);
    merged.node.opacity(0);

    yield* all(
        revBarsNode().opacity(0, 0.55, easeInOutCubic),
        merged.appear(0.55),
    );
    revBarsNode().remove();
    yield* waitFor(1.5);

    // ════════════════════════════════════════════════════════════════
    //  Beat 7 — DEGRADATION + placeholder bars
    // ════════════════════════════════════════════════════════════════

    const NO_SCROLL = {
        blockOrder: 'parallel' as const,
        lineOrder: 'parallel' as const,
    };
    const MORPH_FADE = {
        addStyle: 'fade' as const,
        moveDuration: 0.4, removeDuration: 0.2,
        ...NO_SCROLL,
    };

    function* recolor(): ThreadGenerator {
        merged.colorize(RULES);
        applyGlow(merged);
    }

    const LEFT_LOCAL = -522;
    const SCALE = 0.78;
    const xScaled = CODE_X + LEFT_LOCAL * (1 - SCALE);
    const yScaled = -200;

    // Zoom in. The merge gains a discriminator: template→kind, render(TPL[kind]).
    // Same line count → the body stays put; only the signature and render() morph.
    yield* all(
        merged.morphTo(DEG_KIND, MORPH_FADE),
        merged.node.scale(SCALE, 0.5, easeInOutCubic),
        merged.node.x(xScaled, 0.5, easeInOutCubic),
        merged.node.y(yScaled, 0.5, easeInOutCubic),
    );
    yield* recolor();

    // First guard is the ONLY typed line. It is added directly above message, so the
    // body slides down one line (moveDuration > 0, no teleport). Nothing else types.
    yield* merged.morphTo(DEG_GUARD1, {
        addStyle: 'typewriter' as const,
        charDelay: 0.012, lineDelay: 0,
        moveDuration: 0.35, removeDuration: 0,
        ...NO_SCROLL,
    });
    yield* recolor();

    // Marketing rules pile on — fade in while the body keeps sliding down.
    yield* merged.morphTo(DEG_MKT, {...MORPH_FADE, moveDuration: 0.35});
    yield* recolor();

    // Security rules pile on too — persistOtp + auditOtpSent fade in around the body.
    yield* merged.morphTo(DEG_FINAL, {...MORPH_FADE, moveDuration: 0.35});
    yield* recolor();

    // Bars: 7 placeholder "lines" in two groups (4 + 3), revealed in sequence.
    // They share the code's coordinate system: startY is fixed at mount
    // (CODE_MERGED = 7 lines) and morphTo never recenters, so a bar on line `li`
    // sits exactly where code line `li` would — MOUNT_START_Y + li * 46.
    const MOUNT_START_Y = -((7 - 1) / 2) * 46;
    const LOCAL_LEFT = -1100 / 2 + 56;
    const bodyIndent = measureRow('    x', F_MONO, 32).indentPx;
    const BAR_LINES = [13, 14, 15, 16, 18, 19, 20];
    const BAR_WIDTHS = [1000, 820, 1080, 720, 900, 780, 560];

    const barsNode = createRef<Node>();
    const barRefs: Reference<Rect>[] = [];

    view.add(
        <Node ref={barsNode} x={xScaled} y={yScaled} scale={SCALE} opacity={0}>
            {BAR_LINES.map((li, i) => {
                const ref = createRef<Rect>();
                barRefs.push(ref);
                return (
                    <Rect
                        ref={ref}
                        width={0} height={12} radius={4}
                        fill={INK}
                        offset={[-1, 0]}
                        x={LOCAL_LEFT + bodyIndent}
                        y={MOUNT_START_Y + li * 46}
                    />
                );
            })}
        </Node>
    );

    // Morph opens gap + bars appear one by one
    yield* all(
        merged.morphTo(DEG_FINAL_SPACED, MORPH_FADE),
        (function* (): ThreadGenerator {
            barsNode().opacity(1);
            for (let i = 0; i < barRefs.length; i++) {
                yield* barRefs[i]().width(BAR_WIDTHS[i], 0.12, easeOutCubic);
            }
        })(),
    );
    yield* recolor();

    // Hold the bloated function, then push in on the if (kind === ...) block.
    // Honest zoom: the whole document — code AND the placeholder bars — scales as one;
    // the body just dims to gentle context. Nothing vanishes to fake the move.
    yield* waitFor(0.8);
    const guardSet = new Set(
        DEG_FINAL_SPACED.split('\n')
            .map((l, i) => (l.includes('if (kind ===') ? i : -1))
            .filter(i => i >= 0),
    );
    const ZOOM = 1.4;
    const xZoom = CODE_X + LEFT_LOCAL * (1 - ZOOM);
    const yZoom = 0;                        // line 3 sits at local 0, so the kind guards straddle screen center — tune on render
    yield* all(
        ...Array.from({length: merged.lineCount}, (_, i) => i)
            .filter(i => !guardSet.has(i))
            .map(i => merged.dimLines(i, i, 0.42, 0.6)),
        merged.node.scale(ZOOM, 0.7, easeInOutCubic),
        merged.node.x(xZoom, 0.7, easeInOutCubic),
        merged.node.y(yZoom, 0.7, easeInOutCubic),
        // bars belong to the document: scale them with the code, never fade them out
        barsNode().scale(ZOOM, 0.7, easeInOutCubic),
        barsNode().x(xZoom, 0.7, easeInOutCubic),
        barsNode().y(yZoom, 0.7, easeInOutCubic),
        barsNode().opacity(0.42, 0.6, easeInOutCubic),
    );
    yield* waitFor(0.4);

    // The conditions multiply: each new domain bolts on another if (kind === ...)
    // below the marketing guards. The signature stays put — everything beneath it,
    // body and bars alike, is pushed down one line per guard. The stack reads as endless.
    const DOMAIN_GUARDS = [
        'if (kind === BILLING && !hasValidCard(user)) return',
        'if (kind === ONBOARDING && completedSetup(user)) return',
        'if (kind === REENGAGEMENT && recentlyActive(user)) return',
    ];
    const MKT_ANCHOR = '    if (kind === MARKETING && frequencyCap.exceeded(user)) return\n';
    const withGuards = (n: number): string =>
        DEG_FINAL_SPACED.replace(
            MKT_ANCHOR,
            MKT_ANCHOR + DOMAIN_GUARDS.slice(0, n).map(g => '    ' + g + '\n').join(''),
        );
    for (let n = 1; n <= DOMAIN_GUARDS.length; n++) {
        yield* all(
            merged.morphTo(withGuards(n), {...MORPH_FADE, moveDuration: 0.35}),
            // bars sit below the insertion → they ride down with the body, one line
            barsNode().y(barsNode().y() + ZOOM * 46, 0.35, easeInOutCubic),
        );
        yield* recolor();
        yield* waitFor(0.15);
    }
    yield* waitFor(1.6);

    // ════════════════════════════════════════════════════════════════
    //  Beat 8 — CONSEQUENCES: one method, every domain on one line
    // ════════════════════════════════════════════════════════════════
    // No zoom — pure translation. Keep the method name and the three real domain constants from
    // the code, fade the rest; sendMessage slides to centre-top and the constants slide up into a
    // single column beneath it, all of them hanging off the one method.

    const sigLine = merged.getLine(0);
    const nameTok = sigLine?.tokens.find(t => t.text === 'sendMessage')?.ref();
    const NAME_LX =
        LOCAL_LEFT + textWidth('function ', F_MONO, 32) + textWidth('sendMessage', F_MONO, 32) / 2;
    const NAME_LY = MOUNT_START_Y;
    const SM_Y = -180;                      // sendMessage parks here; the constants line up beneath it

    // Keep sendMessage + the first domain constant of each kind; fade the rest. Column order
    // follows the source order, so SECURITY (which lives at the bottom of the body) sits at the
    // bottom of the chain rather than the middle.
    const KEEP = ['MARKETING', 'BILLING', 'SECURITY'];
    const constToks: Txt[] = [];
    const seenK = new Set<string>();
    const fadeToks: ThreadGenerator[] = [];
    for (let i = 0; i < merged.lineCount; i++) {
        const line = merged.getLine(i);
        if (!line) continue;
        for (const t of line.tokens) {
            const node = t.ref();
            if (t.text === 'sendMessage') { node.shadowColor('rgba(0,0,0,0)'); node.shadowBlur(0); continue; }
            const k = KEEP.indexOf(t.text);
            if (k >= 0 && !seenK.has(t.text)) {
                seenK.add(t.text);
                constToks[k] = node;
                node.shadowColor('rgba(0,0,0,0)'); node.shadowBlur(0);
                continue;
            }
            fadeToks.push(node.opacity(0, 0.5, easeInOutCubic));
        }
    }

    // Block-local centre of a constant's first occurrence (same layout maths as the name).
    const constBL = (name: string): {x: number; y: number} => {
        const lines = withGuards(DOMAIN_GUARDS.length).split('\n');
        for (let i = 0; i < lines.length; i++) {
            const idx = lines[i].indexOf(name);
            if (idx >= 0) {
                return {
                    x: LOCAL_LEFT + textWidth(lines[i].slice(0, idx), F_MONO, 32) + textWidth(name, F_MONO, 32) / 2,
                    y: MOUNT_START_Y + i * 46,
                };
            }
        }
        return {x: 0, y: 0};
    };

    // No-zoom geometry. With the scale held fixed, every motion is a pure translation, so a plain
    // linear tween gives CONSTANT on-screen velocity — nothing to cancel. The block translates so
    // sendMessage parks at (0, SM_Y); each constant additionally slides to its slot, dead-centre on
    // x=0, in source order.
    const S = merged.node.scale().x;        // current scale, held fixed (no zoom)
    const Pfx = -S * NAME_LX;
    const Pfy = SM_Y - S * NAME_LY;
    const GAP = 130;
    const colY = (k: number) => SM_Y + GAP * (k + 1);   // MARKETING / BILLING / SECURITY beneath sendMessage
    const FORM = 0.8;

    // One decisive move with a strong ease-out: everything launches fast and glides to rest, so the
    // constants carry momentum instead of a wooden constant-speed slide. The scale is fixed and the
    // block + every constant share the same ease, so the on-screen motion collapses to a clean
    // ease-out; the farther a constant travels the faster it goes, so the column assembles with
    // natural variation. Meanwhile every other token and the bars fade.
    yield* all(
        merged.node.x(Pfx, FORM, easeOutQuint),
        merged.node.y(Pfy, FORM, easeOutQuint),
        merged.showAllLines(0.55),
        ...fadeToks,
        barsNode().opacity(0, 0.5, easeInOutCubic),
        ...[0, 1, 2].map(k => {
            const tok = constToks[k];
            if (!tok) return waitFor(0);
            const cur = constBL(KEEP[k]);
            const p = tok.position();
            return tok.position(
                [p.x + ((0 - Pfx) / S - cur.x), p.y + ((colY(k) - Pfy) / S - cur.y)],
                FORM, easeOutQuint,
            );
        }),
    );
    yield* waitFor(0.2);

    // String the column together with a vertical line, drawn only in the gaps between the
    // items (sendMessage + the three constants) — all on one vertical line, one method.
    const itemY = [SM_Y, colY(0), colY(1), colY(2)];
    const HALF = 36;
    const conn = createRef<Node>();
    const segRefs: Reference<Line>[] = [];
    view.add(
        <Node ref={conn}>
            {[0, 1, 2].map(j => {
                const r = createRef<Line>();
                segRefs.push(r);
                return <Line ref={r} points={[[0, itemY[j] + HALF], [0, itemY[j + 1] - HALF]]} stroke={INK} lineWidth={2.5} opacity={0.5} end={0} />;
            })}
        </Node>,
    );
    yield* all(...segRefs.map(s => s().end(1, 0.4, easeInOutCubic)));
    yield* waitFor(0.5);

    // ── The cost: change one domain and the rest break ──────────────────
    // SECURITY (bottom of the chain) is edited — its own colour flares gold, then settles. Because
    // every domain hangs off the one method, the break then runs up the shared line: each link,
    // then the constant it feeds, turns to the alert clay in turn, bottom to top. You cannot touch
    // one without the rest going with it. Colour carries it — no gutter chrome, no glow, no shake.
    const ALERT  = '#D6907E';   // dusty clay-red: reads "broken" without RGB-cheapening the palette
    const PURPLE = '#B49ED8';   // the constants' normal colour
    const secTok = constToks[2];

    // 1) SECURITY is edited — a gold flare on the word itself, then it settles back to purple.
    if (secTok) {
        yield* secTok.fill(ACCENT, 0.24, easeOutCubic);
        yield* secTok.fill(PURPLE, 0.34, easeInCubic);
    }
    yield* waitFor(0.3);

    // 2) The break travels up the chain, evenly paced: each link, then the constant it feeds.
    const breakLink = (s: Reference<Line>): ThreadGenerator =>
        all(s().stroke(ALERT, 0.32, easeInOutCubic), s().opacity(0.8, 0.32, easeInOutCubic));
    const breakConst = (k: number): ThreadGenerator =>
        constToks[k] ? constToks[k].fill(ALERT, 0.34, easeInOutCubic) : waitFor(0);
    yield* sequence(0.16,
        breakLink(segRefs[2]),   // SECURITY → BILLING link
        breakConst(1),           // BILLING breaks
        breakLink(segRefs[1]),   // BILLING → MARKETING link
        breakConst(0),           // MARKETING breaks
        breakLink(segRefs[0]),   // MARKETING → sendMessage link
    );
    yield* waitFor(1.1);

    // ── Closing quote ────────────────────────────────────────────────────
    // A typographic statement, not typed: the claim in cream roman, the cost —
    // the wrong abstraction — set apart in gold italic. No quote marks.
    const line1 = createRef<Txt>();
    const line2 = createRef<Txt>();
    const attrib = createRef<Txt>();
    view.add(
        <Txt
            ref={line1}
            fontFamily={F_SERIF} fontSize={66} fontWeight={500}
            fill={INK} textAlign="center" y={-82} opacity={0}
        >
            Duplication is far cheaper than
        </Txt>,
    );
    view.add(
        <Txt
            ref={line2}
            fontFamily={F_SERIF} fontSize={66} fontWeight={500} fontStyle={'italic'}
            fill={ACCENT} textAlign="center" y={16} opacity={0}
        >
            the wrong abstraction
        </Txt>,
    );
    view.add(
        <Txt
            ref={attrib}
            fontFamily={F_SERIF} fontSize={30} fontWeight={500}
            letterSpacing={5} fill={QUIET} textAlign="center" y={158} opacity={0}
        >
            SANDI METZ
        </Txt>,
    );

    // Clear sendMessage + the constant row, then let the statement settle in (staggered).
    yield* all(
        merged.node.opacity(0, 0.7, easeInOutCubic),
        conn().opacity(0, 0.7, easeInOutCubic),
        barsNode().opacity(0, 0.7, easeInOutCubic),
    );
    yield* line1().opacity(1, 0.8, easeInOutCubic);
    yield* line2().opacity(1, 0.8, easeInOutCubic);
    yield* waitFor(0.3);
    yield* attrib().opacity(1, 0.7, easeInOutCubic);
    yield* waitFor(3.2);
});
