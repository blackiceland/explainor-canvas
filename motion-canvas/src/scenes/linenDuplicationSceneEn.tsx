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
import {textWidth} from '../core/utils/textMeasure';

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
// Third color in the editorial 4-tone code system: muted olive-brown
// for scenario LITERALS — string values like "cart_reminder" and any
// uppercase domain constants (URGENT, MARKETING). Distinct from BROWN
// (keywords) and GREEN (types).
const LITERAL = '#7A5828';
const QUIET  = '#7B7160';
const MASS   = '#1B150A';
const SKEL   = 'rgba(60, 48, 22, 0.32)';
const DIM_OP = 0.22;

// Horizontal shift applied to every code block, figure, label, bar
// — gives the left margin a touch more breathing room without
// committing to a wider card or losing the optical centre.
const CODE_X = 20;

// Editorial 4-tone code coloring:
//   • INK     — default (variables, punctuation, operators)
//   • BROWN   — language grammar keywords (function/const/return)
//   • GREEN   — method/function names (definitions and calls)
//   • LITERAL — string literals + uppercase scenario constants
// Method-typed tokens (anything followed by `(`) all take GREEN, so
// both `sendCartReminder` (definition) and `render`, `send`, `record`
// (calls) read as the meaningful actions. The 4-tone system stays
// quiet — three subtle deviations from INK, never garish.
const THEME: SyntaxTheme = {
    keyword:     INK,
    type:        GREEN,
    string:      LITERAL,
    number:      INK,
    operator:    INK,
    punctuation: INK,
    method:      GREEN,
    comment:     QUIET,
    annotation:  INK,
    constant:    LITERAL,
    plain:       INK,
};

// Editorial coloring for TypeScript: language keywords → BROWN
// (`function`, `const`, `return` aren't in the Java tokenizer's
// keyword set, so they need explicit rules). Method-name tokens
// (definitions + calls) pick up GREEN via THEME.method.
const RULES: ColorRule[] = [
    {match: /^function$/, color: BROWN},
    {match: /^const$/,    color: BROWN},
    {match: /^return$/,   color: BROWN},
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
// TypeScript variants — no type annotations, no namespaced services
// (render / send / record are flat free functions). Tighter signatures
// keep the composition airy at a larger fontSize. Body has empty rows
// around `record(...)` so the eye reads each operation as a discrete
// step. 8 rows total per method (signature + 5 body rows + closing).
const CODE_CART_V1 = `function sendCartReminder(user, cart) {
    const message = render("cart.reminder", cart)
    const delivery = send(user.phone, message)

    record(user, message, delivery)

    return delivery
}`;

const CODE_LOGIN_V1 = `function sendLoginCode(user, code) {
    const message = render("auth.loginCode", code)
    const delivery = send(user.phone, message)

    record(user, message, delivery)

    return delivery
}`;

// Merged code: single-line signature (TS makes that fit in ~47 ch),
// same body shape as the duplicated methods so the structural rhyme
// reads instantly. 8 rows total — same line layout as cart/login,
// which lets the reverse-bar mechanic share line indices.
const CODE_MERGED = `function sendMessage(user, template, payload) {
    const message = render(template, payload)
    const delivery = send(user.phone, message)

    record(user, message, delivery)

    return delivery
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

// Merged shape — the form the two figures fuse into during the merge
// beat. Slightly larger and softer than the marketing blob, with a
// gentler wobble so it reads as a *new* unified silhouette rather
// than either parent shape.
function mergedShapePoints(): [number, number][] {
    const pts: [number, number][] = [];
    const N = 28;
    for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        const wobble = 1 + Math.sin(a * 4 + 0.3) * 0.04;
        const r = 148 * wobble;
        pts.push([Math.cos(a) * r * 1.08, Math.sin(a) * r * 0.95]);
    }
    return pts;
}

// Crystal — 4-point rhombus, slightly elongated vertically, smaller
// per feedback. Solid HERO fill, no stroke.
function crystalPoints(size = 8): [number, number][] {
    return [
        [0, -size * 1.45],
        [size, 0],
        [0, size * 1.45],
        [-size, 0],
    ];
}

// Measure a code line's leading-whitespace width and trimmed-text
// width using the SAME canvas measureText call that Manticore uses
// to position tokens. This is the only way to get pixel-perfect bar
// widths — the 0.6 × fontSize estimate drifts by 3-25 px per row
// once you sum across long lines.
function measureRow(line: string, fontFamily: string, fontSize: number): {indentPx: number; widthPx: number} {
    const lead = line.match(/^\s*/)?.[0] ?? '';
    const trimmed = line.slice(lead.length);
    return {
        indentPx: textWidth(lead, fontFamily, fontSize),
        widthPx: textWidth(trimmed, fontFamily, fontSize),
    };
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
// Ink Resolve — the canon code-reveal animation for this reel.
//
//   Phase 1  resolve    every line fades 0 → 100% in one slow wave;
//                       container slides y +6 → 0 alongside.
//   Phase 2  ink in     BROWN/GREEN syntax colors fade over the
//                       now-readable code via colorizeAnimated.
//
// No per-line stagger, no ghost layer — the whole block resolves
// like a paper impression coming into focus, then the meaningful
// colors settle. Reads as "a thought becoming legible", not as
// typewriter or staggered group reveal.
// ──────────────────────────────────────────────────────────────────────
function* inkResolve(
    block: Manticore,
    rules: ColorRule[],
): ThreadGenerator {
    const node = block.node;
    const startY = node.y();

    node.opacity(1);
    node.y(startY + 6);
    for (let i = 0; i < block.lineCount; i++) {
        const line = block.getLine(i);
        if (line) line.node.opacity(0);
    }

    // Phase 1 — every line fades 0 → 100% together, container slides
    // y +6 → 0. Single smooth wave, slow ease-out for a soft landing.
    const resolveAnims: ThreadGenerator[] = [];
    for (let i = 0; i < block.lineCount; i++) {
        const line = block.getLine(i);
        if (line) resolveAnims.push(line.node.opacity(1, 0.85, easeOutCubic));
    }
    resolveAnims.push(node.y(startY, 0.85, easeOutCubic));
    yield* all(...resolveAnims);

    // Phase 2 — syntax colors fade in over the now-readable code.
    yield* block.colorizeAnimated(0, block.lineCount - 1, 0.32, rules);
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
    lineIndices?: number[],
): {handle: SkeletonHandle; jsx: any} {
    const bars: Reference<Rect>[] = [];
    const node = createRef<Node>();
    // The visible code occupies `totalLines` rows. Bars are placed at
    // the line indices in `lineIndices` (defaults to 0..barCount-1
    // contiguous). Closing-brace and empty rows are skipped via the
    // explicit indices — bars only mark actual code rows.
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
                        width={widths[i]}
                        height={12}
                        radius={4}
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
    figureX: number = 0,
): ThreadGenerator[] {
    const out: ThreadGenerator[] = [];
    for (let i = 0; i < bars.length; i++) {
        const b = bars[i];
        const targetW = widthAtY(figurePoints, barYsRelativeToFigure[i]);
        out.push(b().width(targetW, duration, easeInOutCubic));
        out.push(b().x(figureX, duration, easeInOutCubic));
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
        document.fonts.load(`400 28px "JetBrains Mono"`);
        document.fonts.load(`700 28px "JetBrains Mono"`);
        document.fonts.load(`400 30px "JetBrains Mono"`);
        document.fonts.load(`700 30px "JetBrains Mono"`);
        document.fonts.load(`400 26px "JetBrains Mono"`);
        document.fonts.load(`400 120px "Newsreader"`);
        document.fonts.load(`italic 400 120px "Newsreader"`);
        document.fonts.load(`500 22px "Newsreader"`);
    } catch {}

    const span = document.createElement('span');
    span.style.cssText = `position:fixed;left:-9999px;top:0;font:400 30px "JetBrains Mono",monospace;visibility:hidden;`;
    span.textContent = 'iiiiiiiiii MMMMMMMMMM';
    document.body.appendChild(span);
    void span.offsetWidth;

    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    if (!ctx) { document.body.removeChild(span); return; }
    for (let i = 0; i < 60; i++) {
        if (document.fonts.check(`400 28px "JetBrains Mono"`) &&
            document.fonts.check(`400 30px "JetBrains Mono"`)) {
            ctx.font = `400 30px "JetBrains Mono", monospace`;
            const wI = ctx.measureText('iiiiiiiiii').width;
            const wM = ctx.measureText('MMMMMMMMMM').width;
            if (Math.abs(wI - wM) < 0.5 && wI > 30 * 5) {
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
    // Hero at fontSize=72 — methods are back to inline (6 rows), so
    // the heading can reclaim a touch of weight without crowding.
    const hero = createRef<Node>();
    const HERO_TOP = -700;
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

    // TS variants are shorter than the Kotlin originals — the
    // composition can carry a bigger fontSize without crowding.
    // fontSize=30 lh=50 width=1100. Layout: cart at y=-190, login at
    // y=+275 → ~115 px gap between blocks (was 90), and code drops
    // ~30 px below the hero so the heading has more breathing room.
    // x=CODE_X (=20) lifts the leftmost char off the linen edge.
    const cart  = makeBlock({code: CODE_CART_V1,  x: CODE_X, y: -190, fontSize: 30, lineHeight: 50, width: 1100});
    const login = makeBlock({code: CODE_LOGIN_V1, x: CODE_X, y: +275, fontSize: 30, lineHeight: 50, width: 1100});
    cart.mount(view);
    login.mount(view);
    // NB: no colorize(RULES) here — Ink Resolve's Phase 2 fades the
    // BROWN/GREEN tones in *after* the lines have resolved on paper.

    // Editorial subtitle — green italic serif sitting below the code
    // block. Text changes per highlight beat (placeholder copy for
    // now). y=620 keeps it ~170 px below login's bottom edge and
    // ~200 px above ISSUE 02. Mirrors the hero's italic accent so it
    // reads as the same editorial voice, just smaller.
    const subtitle = createRef<Txt>();
    view.add(<Txt
        ref={subtitle}
        text=""
        fontFamily={F_SERIF} fontSize={36}
        fontStyle="italic" fontWeight={400}
        fill={HERO}
        x={CODE_X} y={620}
        textAlign="center"
        opacity={0}
    />);

    // Ink Resolve sequential reveal — cart first, short pause, login
    // as a rhythmic echo. Same cadence both times so the read is
    // "same shape, different meaning" structurally.
    yield* inkResolve(cart, RULES);
    yield* waitFor(0.25);
    yield* inkResolve(login, RULES);

    // First subtitle line fades in once both blocks have resolved.
    subtitle().text('two functions');
    yield* subtitle().opacity(1, 0.5, easeOutCubic);
    yield* waitFor(1.4);

    // ════════════════════════════════════════════════════════════════
    //  Beat 2 — HERO EXIT IS FOLDED INTO THE FIRST HIGHLIGHT
    //
    //  Per feedback, the hero must disappear at the *same time* as the
    //  first highlight + crystal arrives. So no separate hero-fade beat
    //  — the fade is run in parallel with the highlight in Beat 3.
    // ════════════════════════════════════════════════════════════════

    // ════════════════════════════════════════════════════════════════
    //  Beat 3 — SEQUENTIAL HIGHLIGHT + CRYSTAL
    //
    //  Each call repaints opacities directly (no pre-dim). A small
    //  editorial crystal sits to the LEFT of the highlighted line on
    //  each method and slides downward as the highlight steps from
    //  render → send → record.
    // ════════════════════════════════════════════════════════════════
    const lh_methods = 50;
    const lineCount_methods = 8;
    const startRel_methods = -((lineCount_methods - 1) / 2) * lh_methods; // -175
    const lineYRel = (i: number) => startRel_methods + i * lh_methods;
    const cartCenterYBeat3 = -190;
    const loginCenterYBeat3 = +275;

    // Crystal — vertically elongated rhombus, solid HERO fill. Sits
    // to the LEFT of the highlighted body line. With CODE_X=20, body
    // text starts at -494 + 20 + 36 ≈ -438, so CRYSTAL_X=-465 keeps
    // ~27 px of clean linen before the line begins.
    const cartCrystal = createRef<Line>();
    const loginCrystal = createRef<Line>();
    const CRYSTAL_X = -465;

    // Highlights walk through every duplicate body operation, including
    // the return statement. 8-row layout: L0 sig, L1 message=render,
    // L2 delivery=send, L3 empty, L4 record(...), L5 empty, L6 return
    // delivery, L7 closing brace.
    const RENDER_LINE = 1;
    const SEND_LINE = 2;
    const RECORD_LINE = 4;
    const RETURN_LINE = 6;

    view.add(<Line
        ref={cartCrystal}
        points={crystalPoints(8)} closed
        fill={HERO}
        x={CRYSTAL_X}
        y={cartCenterYBeat3 + lineYRel(RENDER_LINE)}
        opacity={0}
        scale={0.5}
    />);
    view.add(<Line
        ref={loginCrystal}
        points={crystalPoints(8)} closed
        fill={HERO}
        x={CRYSTAL_X}
        y={loginCenterYBeat3 + lineYRel(RENDER_LINE)}
        opacity={0}
        scale={0.5}
    />);

    // Subtitle swap — short fade-out, replace text, fade in. Runs
    // in parallel with the highlight transition so the caption
    // changes at the same beat as the crystal moves.
    function* swapSubtitle(text: string): ThreadGenerator {
        yield* subtitle().opacity(0, 0.18, easeInCubic);
        subtitle().text(text);
        yield* subtitle().opacity(1, 0.32, easeOutCubic);
    }

    // RENDER highlight. Hero fades in parallel — the title exits at
    // the exact moment the first duplicate line lights up.
    yield* all(
        hero().opacity(0, 0.6, easeInCubic),
        highlightOnly([cart, login], RENDER_LINE, 0.5),
        cartCrystal().opacity(1, 0.5, easeOutCubic),
        cartCrystal().scale(1, 0.5, easeOutCubic),
        loginCrystal().opacity(1, 0.5, easeOutCubic),
        loginCrystal().scale(1, 0.5, easeOutCubic),
        swapSubtitle('render the message'),
    );
    hero().remove();
    yield* waitFor(0.7);

    // SEND highlight — crystal glides to the next operation line.
    yield* all(
        highlightOnly([cart, login], SEND_LINE, 0.4),
        cartCrystal().y(cartCenterYBeat3 + lineYRel(SEND_LINE), 0.4, easeInOutCubic),
        loginCrystal().y(loginCenterYBeat3 + lineYRel(SEND_LINE), 0.4, easeInOutCubic),
        swapSubtitle('send to the user'),
    );
    yield* waitFor(0.7);

    // RECORD highlight.
    yield* all(
        highlightOnly([cart, login], RECORD_LINE, 0.4),
        cartCrystal().y(cartCenterYBeat3 + lineYRel(RECORD_LINE), 0.4, easeInOutCubic),
        loginCrystal().y(loginCenterYBeat3 + lineYRel(RECORD_LINE), 0.4, easeInOutCubic),
        swapSubtitle('record the delivery'),
    );
    yield* waitFor(0.7);

    // RETURN highlight — closes the body rhyme on the return statement.
    yield* all(
        highlightOnly([cart, login], RETURN_LINE, 0.4),
        cartCrystal().y(cartCenterYBeat3 + lineYRel(RETURN_LINE), 0.4, easeInOutCubic),
        loginCrystal().y(loginCenterYBeat3 + lineYRel(RETURN_LINE), 0.4, easeInOutCubic),
        swapSubtitle('return the result'),
    );
    yield* waitFor(0.75);

    // Restore + crystals fade + subtitle exits before the merge mech.
    yield* all(
        cart.showAllLines(0.4),
        login.showAllLines(0.4),
        cartCrystal().opacity(0, 0.4, easeInCubic),
        cartCrystal().scale(0.5, 0.4, easeInCubic),
        loginCrystal().opacity(0, 0.4, easeInCubic),
        loginCrystal().scale(0.5, 0.4, easeInCubic),
        subtitle().opacity(0, 0.4, easeInCubic),
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

    const lineCount = 8;
    const lh = 50;
    // Bars at body operation rows: L1 (render), L2 (send), L4
    // (record), L6 (return). L0 signature, empty L3/L5 and L7 closing
    // brace are skipped — bars mark body operations only.
    const cartLineIndices = [1, 2, 4, 6];
    // Manticore card: width 1100, paddingX = 56, x-shifted by CODE_X.
    // contentLeft = -1100/2 + 56 + CODE_X = -474.
    const contentLeft = -1100 / 2 + 56 + CODE_X;

    // Bar widths and indents are MEASURED from the actual code
    // strings via ctx.measureText — same call Manticore uses to lay
    // out tokens. Pixel-perfect against the rendered text.
    const cartLines = CODE_CART_V1.split('\n');
    const loginLines = CODE_LOGIN_V1.split('\n');
    const cartRowSpec = cartLineIndices.map(idx => measureRow(cartLines[idx], F_MONO, 30));
    const loginRowSpec = cartLineIndices.map(idx => measureRow(loginLines[idx], F_MONO, 30));
    const cartWidths  = cartRowSpec.map(r => r.widthPx);
    const loginWidths = loginRowSpec.map(r => r.widthPx);
    const cartIndents = cartRowSpec.map(r => r.indentPx);
    const loginIndents = loginRowSpec.map(r => r.indentPx);

    const cartCenterY  = -190;
    const loginCenterY =  275;
    const barCount = cartLineIndices.length;

    // Bar y positions relative to each method's centre. With 6 rows
    // at lh=42 and startRel=-105, bar i sits at startRel + idx*42.
    const barYsRel = cartLineIndices.map(idx =>
        idx * lh + (-((lineCount - 1) / 2) * lh),
    );

    const cartSkel  = buildSkeleton(cartCenterY,  barCount, lh, cartWidths,  cartIndents,  contentLeft, lineCount, cartLineIndices);
    const loginSkel = buildSkeleton(loginCenterY, barCount, lh, loginWidths, loginIndents, contentLeft, lineCount, cartLineIndices);

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
        ...compressBarsToSilhouetteWidths(cartSkel.handle.bars,  barYsRel, marketingBlobPoints(), 0.7, CODE_X),
        ...compressBarsToSilhouetteWidths(loginSkel.handle.bars, barYsRel, securityHexPoints(),    0.7, CODE_X),
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
        fill={MASS} x={CODE_X} y={cartCenterY} opacity={0}
    />);
    view.add(<Line
        ref={securityShape}
        points={securityHexPoints()} closed
        fill={MASS} x={CODE_X} y={loginCenterY} opacity={0}
    />);
    // Labels: anchored below each figure. The whole label container
    // shifts CODE_X with the rest of the code so the editorial column
    // reads consistently.
    view.add(<Node ref={labels} x={CODE_X} opacity={0}>
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
    //  Beat 6 — SHAPES MERGE (overlap at full scale)
    //
    //  Both figures slide to y=0 at full size — no shrink, no scale
    //  change. They overlap at the centre, becoming a single visual
    //  mass. Labels fade alongside. The merge IS the overlap.
    // ════════════════════════════════════════════════════════════════
    yield* all(
        marketingShape().position.y(0, 0.7, easeInOutCubic),
        securityShape().position.y(0, 0.7, easeInOutCubic),
        labels().opacity(0, 0.45, easeInCubic),
    );
    labels().remove();
    yield* waitFor(0.3);

    // ════════════════════════════════════════════════════════════════
    //  Beat 7 — FIGURE → BARS → CODE (4-step morph with silhouette)
    //
    //  Phase A — spawn bars at the merged-code's row y positions but
    //  with INITIAL widths = the figure's outline at each bar's y.
    //  Bars are centred at x=0 (the figure's centre). Bars whose y
    //  lies outside the figure start at width=0.
    //
    //  Phase B — cross-fade figures → bars at silhouette widths. The
    //  visible bars trace the figure's outline at the merged-code's
    //  line levels. Reads as "the figure decomposed into rows".
    //
    //  Phase C — bars EXPAND: widths animate to the merged-code's
    //  real line widths, x slides to the left-aligned text positions,
    //  fill shifts from MASS to SKEL paper-band. Bars outside the
    //  figure outline grow from 0 to their target — the code skeleton
    //  "fills in" beyond the figure.
    //
    //  Phase D — bars cross-fade into the actual merged code text.
    // ════════════════════════════════════════════════════════════════
    const MERGED_LH = 50;
    const MERGED_TOTAL_LINES = 8;
    const MERGED_TOP = -((MERGED_TOTAL_LINES - 1) / 2) * MERGED_LH; // -175
    // Code rows: signature + message=render + delivery=send + record
    // + return. Skip empty L3, L5 and closing-brace L7.
    const mergedLineIndices = [0, 1, 2, 4, 6];
    // Card width=1100, paddingX=56, x-shifted by CODE_X.
    const mergedContentLeft = -1100 / 2 + 56 + CODE_X;
    // Measure each row through canvas measureText to match Manticore's
    // own token positioning — pixel-perfect against the rendered text.
    const mergedLines = CODE_MERGED.split('\n');
    const mergedRowSpec = mergedLineIndices.map(idx => measureRow(mergedLines[idx], F_MONO, 30));
    const mergedWidths  = mergedRowSpec.map(r => r.widthPx);
    const mergedIndents = mergedRowSpec.map(r => r.indentPx);
    const N_REV_BARS = mergedWidths.length;

    // Phase A — spawn bars at silhouette widths, centred at the
    // converged figure's x (CODE_X). Bars share x with the figure
    // they emerged from so the cross-fade is in-place.
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
                <Rect
                    ref={ref}
                    width={initialW}
                    height={12}
                    radius={4}
                    fill={MASS}
                    x={CODE_X}
                    y={barY}
                />
            );
        })}
    </Node>);

    // Phase B — figures dissolve while silhouette bars appear at the
    // figure's outline at the code-row levels.
    yield* all(
        marketingShape().opacity(0, 0.55, easeInCubic),
        securityShape().opacity(0, 0.55, easeInCubic),
        revBarsNode().opacity(1, 0.55, easeOutCubic),
    );
    marketingShape().remove();
    securityShape().remove();
    yield* waitFor(0.3);

    // Phase C — bars expand into the full merged-code skeleton.
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

    // Phase D — bars cross-fade into the merged code text.
    const merged = makeBlock({
        code: CODE_MERGED, x: CODE_X, y: 0,
        fontSize: 30, lineHeight: MERGED_LH,
        width: 1100, noClip: true,
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
