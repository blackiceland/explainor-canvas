import {Img, Line, Node, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
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
// Linen — Don't Fight Duplication (vertical 1080×1920 reels, ~38 s).
//
//   1. hero        : KUROSHIMA · "Code duplication / isn't always / bad."
//                    (mixed case — matches linenHero's editorial cover;
//                     KUROSHIMA + ISSUE 02 stay on screen forever.)
//   2. methods     : sendCartReminder + sendLoginCode stacked vertically
//   3. highlight   : dim everything to ~22%, then bring render → send →
//                    record back to full opacity in turn (the duplicate
//                    rhyme reads without any explicit highlight color)
//   4. → pebbles   : each method dissolves into an identical organic
//                    pebble at the same y; both pebbles are the SAME
//                    shape — the visual punchline before the merge
//   5. → one pebble: the two pebbles slide to centre and become one
//                    larger pebble (the "merge" itself, geometric)
//   6. merged code : pebble dissolves into sendMessage(template, payload)
//                    + "less code." caption
//   7. frankenstein: morphTo grows the body with kind / payload as / ifs
//   8. → shapes    : Frankenstein cross-fades into TWO DIFFERENT shapes
//                    stacked vertically — organic blob (MARKETING) on
//                    top, angular polygon (SECURITY) below. No skeleton
//                    bars: the user found the bars muddy. Clean cut.
//   9. honest split: two domain methods reappear, each carrying its rules
//  10. mantra      : "Same shape. / Different meaning."
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

const RULES: ColorRule[] = [
    {match: /^fun$/,         color: BROWN},
    {match: /^val$/,         color: BROWN},
    {match: /^return$/,      color: BROWN},
    {match: /^if$/,          color: BROWN},
    {match: /^else$/,        color: BROWN},
    {match: /^as$/,          color: BROWN},
    {match: /^User$/,        color: GREEN},
    {match: /^Cart$/,        color: GREEN},
    {match: /^LoginCode$/,   color: GREEN},
    {match: /^SendResult$/,  color: GREEN},
    {match: /^MessageKind$/, color: GREEN},
    {match: /^String$/,      color: GREEN},
    {match: /^Any$/,         color: GREEN},
    {match: /^Skipped$/,     color: GREEN},
    {match: /^OtpSent$/,     color: GREEN},
    {match: /^MARKETING$/,   color: BROWN},
    {match: /^AUTH$/,        color: BROWN},
    {match: /^NO_CONSENT$/,  color: BROWN},
    {match: /^QUIET_HOURS$/, color: BROWN},
    {match: /^CAP$/,         color: BROWN},
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

// ── Code blocks (Kotlin without `suspend` — feedback dropped it) ────
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

const CODE_MERGED = `fun sendMessage(
    user: User,
    template: String,
    payload: Any,
): SendResult {
    val message = templates.render(template, payload)
    val result  = whatsapp.send(user.phone, message)
    deliveries.record(user, message, result)
    return result
}`;

const CODE_FRANKENSTEIN = `fun sendMessage(
    user: User,
    kind: MessageKind,
    payload: Any,
): SendResult {
    if (kind == MARKETING && !consent.has(user)) return Skipped(NO_CONSENT)
    if (kind == MARKETING && quietHours.on(user)) return Skipped(QUIET_HOURS)
    if (kind == MARKETING && cap.exceeded(user)) return Skipped(CAP)

    if (kind == AUTH) otp.persist(user, payload as LoginCode, 5.minutes)

    val template = if (kind == AUTH) "login_code" else "cart_reminder"
    val message  = templates.render(template, payload)
    val result   = whatsapp.send(user.phone, message)

    deliveries.record(user, message, result)
    if (kind == AUTH) audit.log(OtpSent(user, result))

    return result
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
// Shape geometry — paper-cut silhouettes.
// ──────────────────────────────────────────────────────────────────────

// Generic pebble: smooth, slightly squashed, gentle 4-lobed wobble.
// Used twice in Beat 4 (two identical pebbles = "same shape") and once
// in Beat 5 (one bigger pebble = "merge").
function pebblePoints(): [number, number][] {
    const pts: [number, number][] = [];
    const N = 28;
    for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        const wobble = 1 + Math.sin(a * 4 + 0.4) * 0.04;
        const r = 130 * wobble;
        pts.push([Math.cos(a) * r * 1.05, Math.sin(a) * r * 0.92]);
    }
    return pts;
}

// MARKETING blob — softer, more asymmetric than the pebble. The waveform
// (sin*3 + sin*5) gives it character: it does not look like a circle.
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

// SECURITY hexagon — small tilt so it does not look mathematical.
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
        width: o.width ?? 1020,
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
// Highlight helpers — used in Beat 3 to rhyme the duplicate body lines.
// We never recolour: focus is gained by *dimming* everything else, the
// way an editorial designer would direct attention with paper.
// ──────────────────────────────────────────────────────────────────────
function* highlightLine(blocks: Manticore[], idx: number, dur = 0.4): ThreadGenerator {
    const ops: ThreadGenerator[] = [];
    for (const b of blocks) {
        const line = b.getLine(idx);
        if (line) ops.push(line.setOpacity(1, dur));
    }
    if (ops.length) yield* all(...ops);
}

function* switchHighlight(
    blocks: Manticore[], fromIdx: number, toIdx: number, dur = 0.4,
): ThreadGenerator {
    const ops: ThreadGenerator[] = [];
    for (const b of blocks) {
        const f = b.getLine(fromIdx);
        const t = b.getLine(toIdx);
        if (f) ops.push(f.setOpacity(DIM_OP, dur));
        if (t) ops.push(t.setOpacity(1, dur));
    }
    if (ops.length) yield* all(...ops);
}

// ══════════════════════════════════════════════════════════════════════
// Font activation — best-effort. Block on JBM (mono metrics matter for
// code), let serif quietly fall back to EB Garamond if Newsreader did
// not register (puppeteer's Google Fonts CDN is flaky in headless).
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

    // ── BG: linen + warm-white wash ─────────────────────────────────
    view.add(<Img src="/linen.jpg" width={VIEW_W} height={VIEW_H} />);
    view.add(<Rect width={VIEW_W} height={VIEW_H} fill="rgba(252, 245, 230, 0.18)" />);

    // ── Permanent editorial frame: KUROSHIMA + ISSUE 02 ─────────────
    //    These two plates stay on screen the whole reel — they frame
    //    every beat and never fade.
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
    //  Beat 1 — HERO (mixed case, italic last word)
    // ════════════════════════════════════════════════════════════════
    const hero = createRef<Node>();
    const HERO_TOP = -440;
    const HERO_LH  = 130;
    const HERO_SZ  = 118;

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

    yield* waitFor(3.0);

    // ════════════════════════════════════════════════════════════════
    //  Beat 2 — METHODS appear (vertical stack)
    // ════════════════════════════════════════════════════════════════
    const cart  = makeBlock({code: CODE_CART_V1,  y: -240, fontSize: 26, lineHeight: 42, width: 1040});
    const login = makeBlock({code: CODE_LOGIN_V1, y: +240, fontSize: 26, lineHeight: 42, width: 1040});
    cart.mount(view);
    login.mount(view);
    cart.colorize(RULES);
    login.colorize(RULES);

    yield* hero().opacity(0, 0.55, easeInOutCubic);
    hero().remove();

    yield* all(
        cart.appear(0.55),
        login.appear(0.55),
    );
    yield* waitFor(1.4);

    // ════════════════════════════════════════════════════════════════
    //  Beat 3 — SEQUENTIAL HIGHLIGHT (render → send → record)
    //    Both methods dim to 22%; only the matching duplicate line in
    //    each method comes back to full opacity. Sequence reads as a
    //    triple chant: "render → send → record".
    // ════════════════════════════════════════════════════════════════
    yield* all(
        cart.dimLines(0, 5, DIM_OP, 0.5),
        login.dimLines(0, 5, DIM_OP, 0.5),
    );
    yield* waitFor(0.25);

    yield* highlightLine([cart, login], 1, 0.4); // val message = templates.render(...)
    yield* waitFor(0.75);

    yield* switchHighlight([cart, login], 1, 2, 0.4); // val result = whatsapp.send(...)
    yield* waitFor(0.75);

    yield* switchHighlight([cart, login], 2, 3, 0.4); // deliveries.record(...)
    yield* waitFor(0.75);

    yield* all(cart.showAllLines(0.4), login.showAllLines(0.4));
    yield* waitFor(0.4);

    // ════════════════════════════════════════════════════════════════
    //  Beat 4 — METHODS → IDENTICAL PEBBLES (same shape, vertical)
    //    Each method dissolves into a pebble at the same y. Both
    //    pebbles are *exactly the same shape* — that is the punchline.
    // ════════════════════════════════════════════════════════════════
    const cartShape  = createRef<Line>();
    const loginShape = createRef<Line>();

    view.add(<Line
        ref={cartShape} points={pebblePoints()} closed
        fill={MASS} y={-240} scale={0.6} opacity={0}
    />);
    view.add(<Line
        ref={loginShape} points={pebblePoints()} closed
        fill={MASS} y={+240} scale={0.6} opacity={0}
    />);

    yield* all(
        cart.node.opacity(0, 0.6, easeInOutCubic),
        login.node.opacity(0, 0.6, easeInOutCubic),
        cartShape().opacity(1, 0.6, easeOutCubic),
        cartShape().scale(1, 0.6, easeOutCubic),
        loginShape().opacity(1, 0.6, easeOutCubic),
        loginShape().scale(1, 0.6, easeOutCubic),
    );
    cart.node.remove();
    login.node.remove();
    yield* waitFor(1.0);

    // ════════════════════════════════════════════════════════════════
    //  Beat 5 — PEBBLES MERGE INTO ONE (the geometric merge)
    // ════════════════════════════════════════════════════════════════
    const mergedShape = createRef<Line>();
    view.add(<Line
        ref={mergedShape} points={pebblePoints()} closed
        fill={MASS} y={0} scale={0.4} opacity={0}
    />);

    yield* all(
        cartShape().y(0, 0.7, easeInOutCubic),
        cartShape().opacity(0, 0.7, easeInOutCubic),
        loginShape().y(0, 0.7, easeInOutCubic),
        loginShape().opacity(0, 0.7, easeInOutCubic),
        mergedShape().opacity(1, 0.7, easeInOutCubic),
        mergedShape().scale(1.4, 0.7, easeInOutCubic),
    );
    cartShape().remove();
    loginShape().remove();
    yield* waitFor(0.7);

    // ════════════════════════════════════════════════════════════════
    //  Beat 6 — PEBBLE → MERGED CODE
    // ════════════════════════════════════════════════════════════════
    const merged = makeBlock({
        code: CODE_MERGED, y: -100,
        fontSize: 20, lineHeight: 32,
        width: 1020, noClip: true,
    });
    merged.mount(view);
    merged.colorize(RULES);
    merged.node.opacity(0);

    const lessCode = createRef<Txt>();
    view.add(<Txt
        ref={lessCode} text="less code."
        fontFamily={F_SERIF} fontSize={36} fontStyle="italic"
        fill={HERO} y={300} opacity={0}
    />);

    yield* all(
        mergedShape().opacity(0, 0.55, easeInCubic),
        mergedShape().scale(0.5, 0.55, easeInCubic),
        merged.appear(0.55),
    );
    mergedShape().remove();
    yield* lessCode().opacity(1, 0.45, easeOutCubic);
    yield* waitFor(2.4);

    // ════════════════════════════════════════════════════════════════
    //  Beat 7 — MERGED → FRANKENSTEIN (morphTo)
    // ════════════════════════════════════════════════════════════════
    yield* lessCode().opacity(0, 0.4, easeInCubic);
    lessCode().remove();

    yield* merged.morphTo(CODE_FRANKENSTEIN, {
        moveDuration: 0.7,
        removeDuration: 0.4,
        scrollStrategy: 'block',
    });
    merged.colorize(RULES);

    const rules = createRef<Txt>();
    view.add(<Txt
        ref={rules} text="business rules arrive."
        fontFamily={F_SERIF} fontSize={28} fontStyle="italic"
        fill={QUIET} y={460} opacity={0}
    />);
    yield* rules().opacity(1, 0.4, easeOutCubic);
    yield* waitFor(2.8);

    // ════════════════════════════════════════════════════════════════
    //  Beat 8 — FRANKENSTEIN → DIFFERENT SHAPES (vertical, no skeleton)
    //    Code cross-fades straight into two semantic shapes stacked
    //    vertically: organic blob (MARKETING) above, angular polygon
    //    (SECURITY) below. The horizontal layout from the previous
    //    pass and the dark line skeleton are gone.
    // ════════════════════════════════════════════════════════════════
    const marketingShape = createRef<Line>();
    const securityShape  = createRef<Line>();
    const labels = createRef<Node>();

    view.add(<Line
        ref={marketingShape} points={marketingBlobPoints()} closed
        fill={MASS} y={-240} scale={0.4} opacity={0}
    />);
    view.add(<Line
        ref={securityShape} points={securityHexPoints()} closed
        fill={MASS} y={+180} scale={0.4} opacity={0}
    />);

    view.add(<Node ref={labels} opacity={0}>
        <Txt
            text="MARKETING"
            fontFamily={F_SERIF} fontSize={24} fontWeight={500}
            letterSpacing={5} fill={MASS} y={-80}
        />
        <Txt
            text="consent · quiet hours · cap"
            fontFamily={F_SERIF} fontSize={24} fontStyle="italic"
            fill={QUIET} y={-40}
        />
        <Txt
            text="SECURITY"
            fontFamily={F_SERIF} fontSize={24} fontWeight={500}
            letterSpacing={5} fill={MASS} y={340}
        />
        <Txt
            text="ttl · otp.persist · audit"
            fontFamily={F_SERIF} fontSize={24} fontStyle="italic"
            fill={QUIET} y={380}
        />
    </Node>);

    yield* all(
        merged.node.opacity(0, 0.6, easeInOutCubic),
        rules().opacity(0, 0.6, easeInOutCubic),
        marketingShape().opacity(1, 0.7, easeOutCubic),
        marketingShape().scale(1, 0.7, easeOutCubic),
        securityShape().opacity(1, 0.7, easeOutCubic),
        securityShape().scale(1, 0.7, easeOutCubic),
        labels().opacity(1, 0.7, easeOutCubic),
    );
    merged.node.remove();
    rules().remove();
    yield* waitFor(3.2);

    // ════════════════════════════════════════════════════════════════
    //  Beat 9 — SHAPES → HONEST SPLIT (two domain methods)
    // ════════════════════════════════════════════════════════════════
    const honestCart  = makeBlock({code: CODE_CART_V4,  y: -260, fontSize: 22, lineHeight: 36, width: 1040});
    const honestLogin = makeBlock({code: CODE_LOGIN_V4, y: +260, fontSize: 22, lineHeight: 36, width: 1040});
    honestCart.mount(view);
    honestLogin.mount(view);
    honestCart.colorize(RULES);
    honestLogin.colorize(RULES);
    honestCart.node.opacity(0);
    honestLogin.node.opacity(0);

    yield* all(
        marketingShape().opacity(0, 0.55, easeInCubic),
        marketingShape().scale(0.4, 0.55, easeInCubic),
        securityShape().opacity(0, 0.55, easeInCubic),
        securityShape().scale(0.4, 0.55, easeInCubic),
        labels().opacity(0, 0.55, easeInCubic),
        honestCart.appear(0.6),
        honestLogin.appear(0.6),
    );
    marketingShape().remove();
    securityShape().remove();
    labels().remove();
    yield* waitFor(2.8);

    // ════════════════════════════════════════════════════════════════
    //  Beat 10 — MANTRA
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
        honestCart.node.opacity(0, 0.55, easeInOutCubic),
        honestLogin.node.opacity(0, 0.55, easeInOutCubic),
        mantra().opacity(1, 0.7, easeOutCubic),
    );
    honestCart.node.remove();
    honestLogin.node.remove();
    yield* waitFor(3.0);
});
