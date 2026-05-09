import {Img, Line, Node, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
    Reference,
    ThreadGenerator,
    all,
    createRef,
    easeInCubic,
    easeInOutCubic,
    easeOutCubic,
    waitFor,
} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {SyntaxTheme} from '../core/code/model/SyntaxTheme';

// ══════════════════════════════════════════════════════════════════════
// Linen — Don't Fight Duplication (vertical 1080×1920, ~28 s reel).
//
//   permanent : KUROSHIMA + ISSUE 02 frame stays the entire time.
//
//   1. hero+   : "Code duplication / isn't always / bad." on top.
//      preview   Methods sit BELOW the heading from the start, at scale
//                0.6 (preview state). Both visible at once.
//   2. zoom in: hero fades, methods scale 0.6 → 1.0 and recentre — the
//                viewer's attention is pulled onto the code.
//   3. read   : methods at full size, full opacity.
//   4. high-  : sequential rhyme on the duplicate body lines (render →
//      light     send → record). NO pre-dim step — each line just lights
//                up directly while everything else dims to 22 %.
//   5. merge  : code → skeleton → black mass → SVG shape, *exactly* as
//      mech.     the user spelled out:
//                  cart  → MARKETING blob  (organic)
//                  login → SECURITY hex    (angular polygon)
//                Lines stay in the code's exact y positions, then
//                compress and darken; at maximum compression each mass
//                match-cuts to its domain shape, and the label fades in.
//   6. labels : both shapes + their domain rules hold for 3 s — this is
//                the punchline of the reel.
//   7. honest : shapes cross-fade into two domain methods (each carrying
//                its real rules).
//   8. mantra : "Same shape. / Different meaning."
// ══════════════════════════════════════════════════════════════════════

const F_SERIF = 'Newsreader, EB Garamond, serif';
const F_MONO  = 'JetBrains Mono, IBM Plex Mono, monospace';

const VIEW_W = 1080;
const VIEW_H = 1920;

// ── Linen palette ────────────────────────────────────────────────────
const INK    = '#2A2418';
const HERO   = '#39593F';
const GREEN  = '#1A4D2A';
const BROWN  = '#5B3813';
const QUIET  = '#7B7160';
const MASS   = '#1B150A';
const SKEL   = 'rgba(60, 48, 22, 0.32)';
const DIM_OP = 0.22;

const THEME: SyntaxTheme = {
    keyword:     INK,
    type:        GREEN,
    string:      INK,
    number:      INK,
    operator:    INK,
    punctuation: INK,
    method:      INK,
    comment:     QUIET,
    annotation:  INK,
    constant:    BROWN,
    plain:       INK,
};

// Per feedback: only `fun` carries the brown accent (matches the
// linenHero canon — declaration keyword stands out, body keywords
// like val/return/if stay neutral so the eye lands on intent, not
// noise). Types still take green.
const RULES: ColorRule[] = [
    {match: /^fun$/,          color: BROWN},
    {match: /^User$/,         color: GREEN},
    {match: /^Cart$/,         color: GREEN},
    {match: /^LoginCode$/,    color: GREEN},
    {match: /^SendResult$/,   color: GREEN},
    {match: /^Skipped$/,      color: GREEN},
    {match: /^OtpSent$/,      color: GREEN},
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

// ── Code blocks ──────────────────────────────────────────────────────
const CODE_CART_V1 = `fun sendCartReminder(user: User, cart: Cart): SendResult {
    val message = templates.render("cart_reminder", cart)
    val result  = whatsapp.send(user.phone, message)
    deliveries.record(user, message, result)
    return result
}`;

const CODE_LOGIN_V1 = `fun sendLoginCode(user: User, code: LoginCode): SendResult {
    val message = templates.render("login_code", code)
    val result  = whatsapp.send(user.phone, message)
    deliveries.record(user, message, result)
    return result
}`;

// Body uses short names (msg/res) so the merged code can render at
// fontSize=30 (mobile-readable) and still fit the longest line inside
// the card's content area.
const CODE_MERGED = `fun sendMessage(
    user: User,
    template: String,
    payload: Any,
): SendResult {
    val msg = templates.render(template, payload)
    val res = whatsapp.send(user.phone, msg)
    deliveries.record(user, msg, res)
    return res
}`;

const CODE_CART_V4 = `fun sendCartReminder(user: User, cart: Cart): SendResult {
    if (!consent.hasMarketing(user)) return Skipped(NO_CONSENT)
    if (quietHours.active(user))     return Skipped(QUIET_HOURS)
    if (frequencyCap.exceeded(user)) return Skipped(CAP)

    val message = templates.render("cart_reminder", cart)
    val result  = whatsapp.send(user.phone, message)
    campaigns.recordCartReminder(user, cart, result)
    return result
}`;

const CODE_LOGIN_V4 = `fun sendLoginCode(user: User, code: LoginCode): SendResult {
    otp.persist(user, code, 5.minutes)

    val message = templates.render("login_code", code)
    val result  = whatsapp.send(user.phone, message)
    audit.log(OtpSent(user, result))
    return result
}`;

// ══════════════════════════════════════════════════════════════════════
// Shape geometry — paper-cut silhouettes used as the merge destination.
// ──────────────────────────────────────────────────────────────────────
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

// Crystal — simple 4-point rhombus (diamond). Sage-green fill, set
// alongside the highlighted line to mark it.
function crystalPoints(size = 12): [number, number][] {
    return [[0, -size], [size, 0], [0, size], [-size, 0]];
}

// ── Polygon helpers — used to compress bars into a figure silhouette ──
function figureYExtent(points: [number, number][]): {minY: number; maxY: number} {
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of points) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }
    return {minY, maxY};
}

// Horizontal width of the polygon at the given y (scan-line intersection).
function widthAtY(points: [number, number][], y: number): number {
    let leftX = Infinity, rightX = -Infinity;
    for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        const minSegY = Math.min(y1, y2);
        const maxSegY = Math.max(y1, y2);
        if (y < minSegY || y > maxSegY) continue;
        if (Math.abs(y2 - y1) < 0.0001) continue;
        const t = (y - y1) / (y2 - y1);
        const x = x1 + t * (x2 - x1);
        if (x < leftX) leftX = x;
        if (x > rightX) rightX = x;
    }
    return Math.max(0, rightX - leftX);
}

// For a target figure, return (w, y, h) per band so that nBars stacked
// at those positions tile the figure's bounding box. Each bar's width
// matches the figure's actual horizontal extent at its band — i.e. the
// stacked bars trace out a stepped silhouette of the figure.
type SilhouetteBand = {w: number; y: number; h: number};
function silhouetteBars(
    points: [number, number][],
    nBars: number,
): SilhouetteBand[] {
    const {minY, maxY} = figureYExtent(points);
    const figH = maxY - minY;
    const barH = figH / nBars;
    const bands: SilhouetteBand[] = [];
    for (let i = 0; i < nBars; i++) {
        const yCenter = minY + (i + 0.5) * barH;
        bands.push({w: widthAtY(points, yCenter), y: yCenter, h: barH});
    }
    return bands;
}

// ══════════════════════════════════════════════════════════════════════
// Manticore factory.
// ──────────────────────────────────────────────────────────────────────
type BlockOpts = {
    code: string;
    x?: number;
    y: number;
    width?: number;
    fontSize?: number;
    lineHeight?: number;
    noClip?: boolean;
};

function makeBlock(o: BlockOpts): Manticore {
    return Manticore.create(o.code, {
        x: o.x ?? 0,
        y: o.y,
        width: o.width ?? 1040,
        fontSize: o.fontSize ?? 26,
        lineHeight: o.lineHeight ?? 42,
        fontFamily: F_MONO,
        theme: THEME,
        cardStyle: FLAT_CARD,
        glowAccent: false,
        noClip: o.noClip ?? false,
    });
}

// ══════════════════════════════════════════════════════════════════════
// Sequential highlight — DIRECT (no pre-dim). One transition does both:
// the targeted line goes to 1.0, every other line goes to DIM_OP. The
// next call retransitions in place.
// ──────────────────────────────────────────────────────────────────────
function* highlightOnly(
    blocks: Manticore[], idx: number, dur = 0.4,
): ThreadGenerator {
    const ops: ThreadGenerator[] = [];
    for (const b of blocks) {
        for (let i = 0; i < b.lineCount; i++) {
            const line = b.getLine(i);
            if (line) ops.push(line.setOpacity(i === idx ? 1 : DIM_OP, dur));
        }
    }
    if (ops.length) yield* all(...ops);
}

// ══════════════════════════════════════════════════════════════════════
// Skeleton-merge mechanic — code → paper-bars → black dot → SVG shape,
// per method.
//
//   Bar design (post-feedback): height=12, radius=4, paper-tone fill —
//   reads as deliberate paper marks, not pencil dust. Bars cover only
//   the actual code lines (signature + body); the closing `}` line gets
//   no bar, just fades with the rest of the text.
//
//   Compression: every bar collapses to the *same* point with
//   width=height=24, radius=12 — i.e., they all stack into a single
//   round 24-px dot at the method's centre. The dot is the "compressed
//   black mass" the user described.
//
//   Match cut: the dot fades while the SVG shape grows scale 0.1 → 1.0
//   from the *same* centre, so the read is "dot opened into a shape".
// ──────────────────────────────────────────────────────────────────────
type SkeletonHandle = {
    bars: Reference<Rect>[];
    node: Reference<Node>;
};

function buildSkeleton(
    centerY: number,
    barCount: number,
    lh: number,
    widths: number[],
    indents: number[],
    contentLeft: number,
    totalLines: number,
): {handle: SkeletonHandle; jsx: any} {
    const bars: Reference<Rect>[] = [];
    const node = createRef<Node>();
    // The visible code occupies `totalLines` rows, but we draw a bar
    // only for the first `barCount` of them (the closing-bracket row
    // is left alone per the feedback).
    const startRel = -((totalLines - 1) / 2) * lh;
    const jsx = (
        <Node ref={node} opacity={0}>
            {widths.slice(0, barCount).map((w, i) => {
                const ref = createRef<Rect>();
                bars.push(ref);
                return (
                    <Rect
                        ref={ref}
                        width={w}
                        height={12}
                        radius={4}
                        fill={SKEL}
                        x={contentLeft + indents[i] + w / 2}
                        y={centerY + startRel + i * lh}
                    />
                );
            })}
        </Node>
    );
    return {handle: {bars, node}, jsx};
}

// Compression: each bar STAYS at its code-line y, keeps its 12-px
// height, and only its WIDTH animates — to the figure's horizontal
// extent at the bar's existing y. The bars therefore become like
// short rules whose ends touch the future figure's silhouette at
// each line's level. They are NOT thickened, NOT stacked, NOT
// repositioned. The figure then fades in over the rules and "fills
// in" the silhouette area the bars don't cover.
function compressBarsToSilhouetteWidths(
    bars: Reference<Rect>[],
    barYsRelativeToFigure: number[],
    figurePoints: [number, number][],
    duration: number,
): ThreadGenerator[] {
    const out: ThreadGenerator[] = [];
    for (let i = 0; i < bars.length; i++) {
        const b = bars[i];
        const targetW = widthAtY(figurePoints, barYsRelativeToFigure[i]);
        out.push(b().width(targetW, duration, easeInOutCubic));
        out.push(b().x(0, duration, easeInOutCubic));
        out.push(b().fill(MASS, duration, easeInOutCubic));
        // Height, y, radius stay where they were.
    }
    return out;
}

// ══════════════════════════════════════════════════════════════════════
// Font activation — best effort. Newsreader is loaded if the CDN works
// (and silently falls back to EB Garamond if not).
// ──────────────────────────────────────────────────────────────────────
function* awaitFontsReady(): ThreadGenerator {
    if (typeof document === 'undefined') return;
    try {
        document.fonts.load(`400 26px "JetBrains Mono"`);
        document.fonts.load(`700 26px "JetBrains Mono"`);
        document.fonts.load(`400 22px "JetBrains Mono"`);
        document.fonts.load(`400 120px "Newsreader"`);
        document.fonts.load(`italic 400 120px "Newsreader"`);
        document.fonts.load(`500 22px "Newsreader"`);
    } catch {}

    const span = document.createElement('span');
    span.style.cssText = `position:fixed;left:-9999px;top:0;font:400 26px "JetBrains Mono",monospace;visibility:hidden;`;
    span.textContent = 'iiiiiiiiii MMMMMMMMMM';
    document.body.appendChild(span);
    void span.offsetWidth;

    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    if (!ctx) { document.body.removeChild(span); return; }
    for (let i = 0; i < 60; i++) {
        if (document.fonts.check(`400 26px "JetBrains Mono"`)) {
            ctx.font = `400 26px "JetBrains Mono", monospace`;
            const wI = ctx.measureText('iiiiiiiiii').width;
            const wM = ctx.measureText('MMMMMMMMMM').width;
            if (Math.abs(wI - wM) < 0.5 && wI > 26 * 5) {
                document.body.removeChild(span);
                return;
            }
        }
        yield* waitFor(0.05);
    }
    document.body.removeChild(span);
}

// ══════════════════════════════════════════════════════════════════════
export default makeScene2D(function* (view) {
    yield* awaitFontsReady();

    // ── BG ──────────────────────────────────────────────────────────
    view.add(<Img src="/linen.jpg" width={VIEW_W} height={VIEW_H} />);
    view.add(<Rect width={VIEW_W} height={VIEW_H} fill="rgba(252, 245, 230, 0.18)" />);

    // ── Permanent editorial frame ───────────────────────────────────
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
    //  Beat 1 — HERO + METHODS PREVIEW
    //
    //  Hero phrase sits where linenHero put it (HERO_TOP=-440 area).
    //  Methods are mounted BELOW the hero from the very first frame,
    //  at scale 0.6 — a quiet preview that the zoom-in will pull
    //  forward.
    // ════════════════════════════════════════════════════════════════
    // Composition refit (graphic-designer pass, no zoom):
    //   • hero shrinks to fontSize=72, line-height 88 — less dominant
    //     than 80, leaves more visual weight for the methods
    //   • HERO_TOP=-680 keeps a clean ~120 px gap below KUROSHIMA so
    //     the heading sits in the upper third, not jammed at the top
    //   • methods at fontSize=28 are substantial enough that the
    //     hero/method weight balance reads as: thesis (hero) → proof
    //     (methods) → metadata (issue tag), in proportion.
    const hero = createRef<Node>();
    const HERO_TOP = -680;
    const HERO_LH  = 88;
    const HERO_SZ  = 72;

    view.add(<Node ref={hero}>
        <Txt
            text="Code duplication"
            fontFamily={F_SERIF} fontSize={HERO_SZ} fontWeight={400}
            fill={HERO} y={HERO_TOP} textAlign="center"
        />
        <Txt
            text="isn't always"
            fontFamily={F_SERIF} fontSize={HERO_SZ} fontWeight={400}
            fill={HERO} y={HERO_TOP + HERO_LH} textAlign="center"
        />
        <Txt
            text="bad."
            fontFamily={F_SERIF} fontSize={HERO_SZ} fontWeight={400}
            fontStyle="italic" fill={HERO}
            y={HERO_TOP + HERO_LH * 2} textAlign="center"
        />
    </Node>);

    // Methods at FINAL size from frame 1 — no zoom. fontSize=28 gives
    // mobile-readable text, lh=46 keeps the block compact, width=1140
    // gives the longest signature ("sendLoginCode(user: User, code:
    // LoginCode): SendResult {", 60 chars × 16.8 = 1008 px) ~30 px of
    // breathing room inside the content area (1028 px). Symmetric
    // y=-180/+180 → margins 502 px to KUROSHIMA / ISSUE 02 edges.
    const cart  = makeBlock({code: CODE_CART_V1,  y: -180, fontSize: 28, lineHeight: 46, width: 1140});
    const login = makeBlock({code: CODE_LOGIN_V1, y: +180, fontSize: 28, lineHeight: 46, width: 1140});
    cart.mount(view);
    login.mount(view);
    cart.colorize(RULES);
    login.colorize(RULES);

    yield* all(
        cart.appear(0.55),
        login.appear(0.55),
    );
    yield* waitFor(2.6);

    // ════════════════════════════════════════════════════════════════
    //  Beat 2 — HERO EXIT (no zoom)
    //
    //  Hero phrase fades out cleanly — no scale animation, no parallax
    //  drift. Just opacity → 0 so the audience's eye lands on the
    //  methods that have been there at full size from frame one.
    // ════════════════════════════════════════════════════════════════
    yield* hero().opacity(0, 0.7, easeInCubic);
    hero().remove();
    yield* waitFor(0.5);

    // ════════════════════════════════════════════════════════════════
    //  Beat 3 — SEQUENTIAL HIGHLIGHT + CRYSTAL
    //
    //  Each call repaints opacities directly (no pre-dim). A small
    //  editorial crystal sits to the LEFT of the highlighted line on
    //  each method and slides downward as the highlight steps from
    //  render → send → record.
    // ════════════════════════════════════════════════════════════════
    const lh_methods = 42;
    const lineCount_methods = 6;
    const startRel_methods = -((lineCount_methods - 1) / 2) * lh_methods; // -105
    const lineYRel = (i: number) => startRel_methods + i * lh_methods;
    const cartCenterYBeat3 = -220;
    const loginCenterYBeat3 = +220;

    // Crystals to the left of each method's body text. The body lines
    // start at x = contentLeft + indent = -464 + 62 = -402, so x=-440
    // sits just outside the body text, comfortably clear of the line.
    const cartCrystal = createRef<Line>();
    const loginCrystal = createRef<Line>();
    const CRYSTAL_X = -440;

    view.add(<Line
        ref={cartCrystal}
        points={crystalPoints(11)} closed
        fill={MASS}
        x={CRYSTAL_X}
        y={cartCenterYBeat3 + lineYRel(1)}
        opacity={0}
        scale={0.5}
    />);
    view.add(<Line
        ref={loginCrystal}
        points={crystalPoints(11)} closed
        fill={MASS}
        x={CRYSTAL_X}
        y={loginCenterYBeat3 + lineYRel(1)}
        opacity={0}
        scale={0.5}
    />);

    // Line 1 — render
    yield* all(
        highlightOnly([cart, login], 1, 0.5),
        cartCrystal().opacity(1, 0.5, easeOutCubic),
        cartCrystal().scale(1, 0.5, easeOutCubic),
        loginCrystal().opacity(1, 0.5, easeOutCubic),
        loginCrystal().scale(1, 0.5, easeOutCubic),
    );
    yield* waitFor(0.75);

    // Line 2 — send (crystal slides)
    yield* all(
        highlightOnly([cart, login], 2, 0.4),
        cartCrystal().y(cartCenterYBeat3 + lineYRel(2), 0.4, easeInOutCubic),
        loginCrystal().y(loginCenterYBeat3 + lineYRel(2), 0.4, easeInOutCubic),
    );
    yield* waitFor(0.75);

    // Line 3 — record
    yield* all(
        highlightOnly([cart, login], 3, 0.4),
        cartCrystal().y(cartCenterYBeat3 + lineYRel(3), 0.4, easeInOutCubic),
        loginCrystal().y(loginCenterYBeat3 + lineYRel(3), 0.4, easeInOutCubic),
    );
    yield* waitFor(0.75);

    // Restore + crystals fade
    yield* all(
        cart.showAllLines(0.4),
        login.showAllLines(0.4),
        cartCrystal().opacity(0, 0.4, easeInCubic),
        cartCrystal().scale(0.5, 0.4, easeInCubic),
        loginCrystal().opacity(0, 0.4, easeInCubic),
        loginCrystal().scale(0.5, 0.4, easeInCubic),
    );
    cartCrystal().remove();
    loginCrystal().remove();
    yield* waitFor(0.3);

    // ════════════════════════════════════════════════════════════════
    //  Beat 4 — MERGE MECHANIC: code → bars → mass → SVG shape.
    //
    //  Per method, the text fades to 0 while a row of grey bars takes
    //  the same y positions; the bars then compress (X shrinks, Y
    //  collapses, fill darkens to MASS); at maximum compression the
    //  packed sliver match-cuts to the method's domain shape.
    //
    //  cart  → MARKETING blob  (organic, soft)
    //  login → SECURITY hex    (angular, strict)
    // ════════════════════════════════════════════════════════════════

    // Bar widths roughly mirror each code line's actual pixel width at
    // fontSize=26. Indents reflect the 4-space body indent (62 px).
    const lineCount = 6;
    const lh = 42;
    const indent4 = 62;
    const indents = [0, indent4, indent4, indent4, indent4, 0];
    // Manticore card: width 1040, paddingX = max(24, min(56, 26*2+8)) = 56,
    // so contentLeft = -1040/2 + 56 = -464.
    const contentLeft = -464;

    const cartWidths  = [880, 800, 740, 680, 260, 16];
    const loginWidths = [890, 720, 740, 680, 260, 16];

    const cartCenterY  = -220;
    const loginCenterY =  220;
    // Per feedback: bars cover only the *code* lines (signature + 4
    // body rows) — the closing `}` row gets no bar and quietly fades
    // with the rest of the text.
    const barCount = 5;

    // Bars stay at their code-line y positions during compression.
    // These are y values *relative to each method's centre*: line 0 is
    // -2.5 lineHeights up, line 1 is -1.5, ... line 4 is +1.5.
    const barYsRel = Array.from({length: barCount}, (_, i) =>
        ((i - (lineCount - 1) / 2) * lh),
    );

    const cartSkel  = buildSkeleton(cartCenterY,  barCount, lh, cartWidths,  indents, contentLeft, lineCount);
    const loginSkel = buildSkeleton(loginCenterY, barCount, lh, loginWidths, indents, contentLeft, lineCount);

    view.add(cartSkel.jsx);
    view.add(loginSkel.jsx);

    // Phase A — code text fades, skeleton bars take its place. Lines
    // are at the same y, so the read is "letters dropped, structure
    // stayed".
    yield* all(
        cart.node.opacity(0, 0.45, easeInOutCubic),
        login.node.opacity(0, 0.45, easeInOutCubic),
        cartSkel.handle.node().opacity(1, 0.45, easeInOutCubic),
        loginSkel.handle.node().opacity(1, 0.45, easeInOutCubic),
    );
    cart.node.remove();
    login.node.remove();

    // Phase B — bars compress widths only. Each bar STAYS at its code-
    // line y, keeps its 12-px height, and only its width animates so
    // its left/right edges land on the figure's outline at that y.
    // No thickening, no stacking. The figure's silhouette area not
    // covered by bars (above the topmost bar y_rel and below the
    // bottommost) stays empty — the figure will fill it in next.
    yield* all(
        ...compressBarsToSilhouetteWidths(cartSkel.handle.bars,  barYsRel, marketingBlobPoints(), 0.7),
        ...compressBarsToSilhouetteWidths(loginSkel.handle.bars, barYsRel, securityHexPoints(),    0.7),
    );
    yield* waitFor(0.18);

    // Phase C — match cut: each figure is pre-mounted at *full* scale
    // and full opacity 0. It cross-fades in over the bars and *fills
    // in* the silhouette — the bars' edges already touched the outline
    // at their y's; the figure now adds the missing top and bottom
    // bands. Reads as "lines reach the form's edges, then the form
    // fills in".
    const marketingShape = createRef<Line>();
    const securityShape  = createRef<Line>();
    const labels = createRef<Node>();

    view.add(<Line
        ref={marketingShape}
        points={marketingBlobPoints()} closed
        fill={MASS} y={cartCenterY} opacity={0}
    />);
    view.add(<Line
        ref={securityShape}
        points={securityHexPoints()} closed
        fill={MASS} y={loginCenterY} opacity={0}
    />);
    // Labels: cart's pair sits in the gap between the figures (cart
    // figure bottom ≈ -55, login figure top ≈ +55, so ±5 lands the
    // captions in the breathing room). Login's pair anchors below the
    // bottom figure.
    view.add(<Node ref={labels} opacity={0}>
        <Txt
            text="MARKETING"
            fontFamily={F_SERIF} fontSize={24} fontWeight={500}
            letterSpacing={5} fill={MASS}
            y={cartCenterY + 155}
        />
        <Txt
            text="consent · quiet hours · cap"
            fontFamily={F_SERIF} fontSize={22} fontStyle="italic"
            fill={QUIET} y={cartCenterY + 190}
        />
        <Txt
            text="SECURITY"
            fontFamily={F_SERIF} fontSize={24} fontWeight={500}
            letterSpacing={5} fill={MASS}
            y={loginCenterY + 155}
        />
        <Txt
            text="ttl · otp.persist · audit"
            fontFamily={F_SERIF} fontSize={22} fontStyle="italic"
            fill={QUIET} y={loginCenterY + 190}
        />
    </Node>);

    // Single-step cross-fade: bar silhouette and figure silhouette
    // share the same outline, so swapping is a clean dissolve.
    yield* all(
        cartSkel.handle.node().opacity(0, 0.5, easeInOutCubic),
        loginSkel.handle.node().opacity(0, 0.5, easeInOutCubic),
        marketingShape().opacity(1, 0.5, easeInOutCubic),
        securityShape().opacity(1, 0.5, easeInOutCubic),
    );
    cartSkel.handle.node().remove();
    loginSkel.handle.node().remove();

    // ════════════════════════════════════════════════════════════════
    //  Beat 5 — labels fade in and the punchline holds.
    // ════════════════════════════════════════════════════════════════
    yield* labels().opacity(1, 0.5, easeOutCubic);
    yield* waitFor(3.0);

    // ════════════════════════════════════════════════════════════════
    //  Beat 6 — SHAPES CONVERGE
    //
    //  Both shapes slide to y=0 at *full* scale and overlap there. No
    //  scale change — the converged outline stays at the figure's real
    //  size, so the upcoming reverse bars can match its silhouette.
    // ════════════════════════════════════════════════════════════════
    yield* all(
        marketingShape().position.y(0, 0.7, easeInOutCubic),
        securityShape().position.y(0, 0.7, easeInOutCubic),
        labels().opacity(0, 0.45, easeInCubic),
    );
    labels().remove();
    yield* waitFor(0.25);

    // ════════════════════════════════════════════════════════════════
    //  Beat 7 — REVERSE MORPH (symmetric inverse of forward)
    //
    //  Bars are spawned directly at the merged-code line y positions,
    //  with each bar's INITIAL width equal to the converged figure's
    //  outline at that y. Bars whose y lies outside the figure's
    //  vertical extent start at width=0 (invisible). Cross-fade the
    //  figures into those bars: the visible bars trace the figure's
    //  outline at the merged-code line levels.
    //
    //  Then the bars EXPAND: widths animate to merged-code line
    //  widths, x slides to the left-aligned text positions, fill
    //  shifts to the paper-band SKEL color. Bars that started at
    //  width=0 grow visible — the merged-code skeleton "fills in"
    //  beyond the figure's outline. Finally the merged-code text
    //  cross-fades in.
    //
    //  Merged code is at fontSize=30 (was 22) so it reads on mobile.
    // ════════════════════════════════════════════════════════════════
    const MERGED_LH = 50;
    const MERGED_TOP = -((10 - 1) / 2) * MERGED_LH; // top line at -225
    // Line widths at fontSize=30 (charwidth ≈ 18). Closing `}` skipped.
    const mergedWidths  = [288, 270, 378, 306, 252, 882, 738, 666, 252];
    const mergedIndents = [  0,  72,  72,  72,   0,  72,  72,  72,  72];
    const mergedContentLeft = -464;
    const N_REV_BARS = mergedWidths.length;

    // Phase A — spawn merged-code bars at line y positions; initial
    // widths follow the converged blob outline at each bar's y.
    const blobPts = marketingBlobPoints();
    const revBarsNode = createRef<Node>();
    const revBarRefs: Reference<Rect>[] = [];

    view.add(<Node ref={revBarsNode} opacity={0}>
        {Array.from({length: N_REV_BARS}, (_, i) => {
            const ref = createRef<Rect>();
            revBarRefs.push(ref);
            const barY = MERGED_TOP + i * MERGED_LH;
            const initialW = widthAtY(blobPts, barY);
            return (
                <Rect
                    ref={ref}
                    width={initialW}
                    height={12}
                    radius={4}
                    fill={MASS}
                    x={0}
                    y={barY}
                />
            );
        })}
    </Node>);

    // Phase B — figures dissolve while bars appear. Bars within the
    // blob's y range trace the outline; bars outside (top/bottom) are
    // invisible (width=0).
    yield* all(
        marketingShape().opacity(0, 0.5, easeInOutCubic),
        securityShape().opacity(0, 0.5, easeInOutCubic),
        revBarsNode().opacity(1, 0.5, easeInOutCubic),
    );
    marketingShape().remove();
    securityShape().remove();
    yield* waitFor(0.3);

    // Phase C — bars expand to merged-code line widths and slide to
    // their left-aligned x positions. Bars that started at width=0
    // grow into visible paper bands — the code skeleton "fills in"
    // beyond the figure's outline.
    const expandOps: ThreadGenerator[] = [];
    for (let i = 0; i < N_REV_BARS; i++) {
        const b = revBarRefs[i];
        const targetX = mergedContentLeft + mergedIndents[i] + mergedWidths[i] / 2;
        expandOps.push(b().width(mergedWidths[i], 0.6, easeInOutCubic));
        expandOps.push(b().x(targetX, 0.6, easeInOutCubic));
        expandOps.push(b().fill(SKEL, 0.6, easeInOutCubic));
    }
    yield* all(...expandOps);
    yield* waitFor(0.25);

    // Phase D — bars cross-fade into the real merged code text.
    const merged = makeBlock({
        code: CODE_MERGED, y: 0,
        fontSize: 30, lineHeight: MERGED_LH,
        width: 1040, noClip: true,
    });
    merged.mount(view);
    merged.colorize(RULES);
    merged.node.opacity(0);

    yield* all(
        revBarsNode().opacity(0, 0.55, easeInOutCubic),
        merged.appear(0.55),
    );
    revBarsNode().remove();
    yield* waitFor(2.4);

    // ════════════════════════════════════════════════════════════════
    //  Beat 8 — MANTRA
    // ════════════════════════════════════════════════════════════════
    const mantra = createRef<Node>();
    view.add(<Node ref={mantra} opacity={0}>
        <Txt
            text="Same shape."
            fontFamily={F_SERIF} fontSize={92} fontWeight={400}
            fill={HERO} y={-60} textAlign="center"
        />
        <Txt
            text="Different meaning."
            fontFamily={F_SERIF} fontSize={92} fontWeight={400}
            fontStyle="italic" fill={HERO}
            y={60} textAlign="center"
        />
    </Node>);

    yield* all(
        merged.node.opacity(0, 0.55, easeInOutCubic),
        mantra().opacity(1, 0.7, easeOutCubic),
    );
    merged.node.remove();
    yield* waitFor(3.0);
});
