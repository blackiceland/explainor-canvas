import {Line, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
    all, chain, createRef,
    easeInCubic, easeInOutCubic, easeOutCubic, easeOutQuart,
    ThreadGenerator, Vector2, waitFor,
} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {SyntaxTheme} from '../core/code/model/SyntaxTheme';

// ══════════════════════════════════════════════════════════════════════
// Reels · Don't Fight Duplication — 30s · Vertical 1080×1920 · Light Lab
//
//   0–3s   Hook       "This looks like duplication."
//   3–8s   Pair       Two near-mirror Kotlin functions stacked vertically.
//   8–12s  Merge      Two blocks compress into one buildNotice(...).
//   12–17s Isolate    `condition: Boolean` highlighted. Ghost labels
//                     (invoice.isOverdue / login.isSuspicious) drift up
//                     into the parameter and fade.
//   17–22s Loss       Domain labels BILLING / SECURITY appear with a
//                     boundary line, then erase.
//   22–26s Thesis     Code dims to 45%. "Clean code can erase meaning."
//   26–30s Axiom      "Don't fight duplication / until you know what it
//                     remembers." — held 2s.
// ══════════════════════════════════════════════════════════════════════

// ── Palette (§4) ──────────────────────────────────────────────────────
const BG         = '#E8E3D8';
const INK        = '#1F2326';
const SECONDARY  = '#706D66';
const KW         = '#A75B38';
const TYP        = '#55748C';
const STR        = '#6B7F5A';
const QUIET_FILL = 'rgba(220,212,195,0.55)';   // §4 quiet highlight (~55%)
const BOUNDARY   = 'rgba(155,150,140,0.65)';   // §4 boundary 45–70%
const ERASED     = 'rgba(184,178,167,0.95)';   // §4 erased context tone
const ACCENT     = KW;

// ── Typography (§5) ───────────────────────────────────────────────────
const F_HEAD = 'Geist, Space Grotesk, Inter, sans-serif';
const F_CODE = 'JetBrains Mono, IBM Plex Mono, monospace';

// ── SyntaxTheme: cv-clean light, semantic colour only ─────────────────
const LightLabTheme: SyntaxTheme = {
    keyword:     KW,
    type:        TYP,
    string:      STR,
    number:      INK,
    operator:    INK,
    punctuation: INK,
    method:      INK,
    comment:     SECONDARY,
    annotation:  KW,
    constant:    TYP,   // URGENT / NORMAL are domain enum values, mark as type-tone
    plain:       INK,
};

// CodeCard goes invisible — code sits directly on the warm-greige page.
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

// ── Code samples ──────────────────────────────────────────────────────
// Compact pair (no internal blank line) so two stacked blocks fit the
// vertical action zone (§3 y:420–1180 in screen coords). Function names
// trimmed (billingNotice → billing, etc.) and strings shortened so the
// longest line fits inside the 880px card at fontSize 30 — the tightest
// budget the §3 96-px side margin allows.
const BILLING = `fun billing(invoice: Invoice): Message {
    if (invoice.isOverdue) {
        return Message("Overdue", URGENT)
    }
    return Message("Cleared", NORMAL)
}`;

const SECURITY = `fun security(login: Login): Message {
    if (login.isSuspicious) {
        return Message("Risky", URGENT)
    }
    return Message("Trusted", NORMAL)
}`;

const MERGED = `fun build(
    condition: Boolean,
    urgent: String,
    normal: String
): Message {
    if (condition) {
        return Message(urgent, URGENT)
    }
    return Message(normal, NORMAL)
}`;

const CUSTOM_TYPES = ['Message', 'Invoice', 'Login'];

// Tokenizer is Java-only — `fun` lands as 'plain'. Recolor it as keyword
// without touching the lexer.
const KOTLIN_KW_RULES: ColorRule[] = [
    {match: /^fun$/, color: KW, onlyTypes: ['plain']},
];

const CODE_FONT = 30;
const CODE_LH   = 48;
const CODE_W    = 880;

// ══════════════════════════════════════════════════════════════════════
export default makeScene2D(function* (view) {
    view.size(new Vector2(1080, 1920));
    view.fill(BG);

    // Solid backing rect — guarantees full coverage even if the player
    // letter-boxes the canvas.
    view.add(<Rect width={1080} height={1920} fill={BG}/>);

    // ─── BEAT 0 (0–3s) · HOOK ─────────────────────────────────────────
    const hook = createRef<Txt>();
    view.add(<Txt
        ref={hook}
        text="This looks like duplication."
        fontFamily={F_HEAD}
        fontSize={62}
        fontWeight={500}
        fill={INK}
        letterSpacing={-1.2}
        opacity={0}
        y={-30}
    />);
    yield* all(
        hook().opacity(1, 0.55, easeOutQuart),
        hook().y(0, 0.55, easeOutQuart),
    );
    yield* waitFor(1.6);
    yield* hook().opacity(0, 0.45, easeInCubic);
    hook().remove();
    yield* waitFor(0.05);

    // ─── BEAT 1 (3–8s) · TWO BLOCKS (compare pair) ────────────────────
    const billing  = makeBlock(BILLING,  -300);
    const security = makeBlock(SECURITY,  300);
    billing.mount(view);
    security.mount(view);
    billing.colorize(KOTLIN_KW_RULES);
    security.colorize(KOTLIN_KW_RULES);

    // Slide in from below + fade.
    billing.node.y(billing.node.y() + 140);
    security.node.y(security.node.y() + 140);
    yield* all(
        billing.node.y(-300, 0.7, easeOutQuart),
        security.node.y(300, 0.7, easeOutQuart),
        billing.appear(0.6),
        security.appear(0.6),
    );

    yield* waitFor(0.5);

    // Highlight the if-lines (mirror form is the message).
    const ifBilling  = billing.findLine('if (invoice');
    const ifSecurity = security.findLine('if (login');
    yield* all(
        billing.showBackground(ifBilling, ifBilling, QUIET_FILL, 0.45),
        security.showBackground(ifSecurity, ifSecurity, QUIET_FILL, 0.45),
    );

    yield* waitFor(2.4);

    // Drop the highlights before the merge so it doesn't bleed visually.
    yield* all(
        billing.hideBackground(ifBilling, ifBilling, 0.3),
        security.hideBackground(ifSecurity, ifSecurity, 0.3),
    );

    // ─── BEAT 2 (8–12s) · MERGE ───────────────────────────────────────
    yield* all(
        billing.node.y(-90, 0.55, easeInOutCubic),
        security.node.y(90, 0.55, easeInOutCubic),
        billing.disappear(0.5),
        security.disappear(0.5),
    );
    billing.node.remove();
    security.node.remove();

    const merged = makeBlock(MERGED, 0);
    merged.mount(view);
    merged.colorize(KOTLIN_KW_RULES);
    merged.node.scale(0.92);
    yield* all(
        merged.appear(0.55),
        merged.node.scale(1, 0.55, easeOutCubic),
    );

    yield* waitFor(2.3);

    // ─── BEAT 3 (12–17s) · ISOLATE `condition: Boolean` ───────────────
    const condLine = merged.findLine('condition: Boolean');

    const dimOthers: ThreadGenerator[] = [];
    for (let i = 0; i < merged.lineCount; i++) {
        if (i === condLine) continue;
        const ln = merged.getLine(i);
        if (ln) dimOthers.push(ln.setOpacity(0.22, 0.45));
    }
    yield* all(
        ...dimOthers,
        merged.showBackground(condLine, condLine, QUIET_FILL, 0.45),
    );

    yield* waitFor(0.4);

    // Two ghost labels: invoice.isOverdue, login.isSuspicious. They sit
    // where the body's other params used to live, then drift up into the
    // condition line and fade — visualising the names that became `condition`.
    const ghostY1 = merged.getLineSceneY(merged.findLine('urgent:'));
    const ghostY2 = merged.getLineSceneY(merged.findLine('normal:'));
    const targetY = merged.getLineSceneY(condLine);

    const ghost1 = createRef<Txt>();
    const ghost2 = createRef<Txt>();
    view.add(<Txt
        ref={ghost1}
        text="invoice.isOverdue"
        fontFamily={F_CODE}
        fontSize={30}
        fill={ERASED}
        offset={[-1, 0]}
        x={-300}
        y={ghostY1}
        opacity={0}
    />);
    view.add(<Txt
        ref={ghost2}
        text="login.isSuspicious"
        fontFamily={F_CODE}
        fontSize={30}
        fill={ERASED}
        offset={[-1, 0]}
        x={-300}
        y={ghostY2}
        opacity={0}
    />);

    yield* ghost1().opacity(0.95, 0.45, easeOutCubic);
    yield* waitFor(0.3);
    yield* ghost2().opacity(0.95, 0.45, easeOutCubic);
    yield* waitFor(1.2);

    // Drift up into condition + erase.
    yield* all(
        ghost1().y(targetY, 0.6, easeInOutCubic),
        ghost1().opacity(0, 0.6, easeInCubic),
        ghost2().y(targetY, 0.6, easeInOutCubic),
        ghost2().opacity(0, 0.6, easeInCubic),
    );
    ghost1().remove();
    ghost2().remove();

    // Restore other lines (still slightly muted, prepares Beat 4).
    const restoreLines: ThreadGenerator[] = [];
    for (let i = 0; i < merged.lineCount; i++) {
        const ln = merged.getLine(i);
        if (ln) restoreLines.push(ln.setOpacity(1, 0.4));
    }
    yield* all(
        ...restoreLines,
        merged.hideBackground(condLine, condLine, 0.4),
    );

    // ─── BEAT 4 (17–22s) · DOMAIN LABELS · CONTEXT LOSS ───────────────
    // Slide code right; labels + boundary appear on the left, then erase.
    yield* merged.node.x(120, 0.5, easeInOutCubic);

    const labelTop    = createRef<Txt>();
    const labelBottom = createRef<Txt>();
    const boundary    = createRef<Line>();

    view.add(<Txt
        ref={labelTop}
        text="BILLING"
        fontFamily={F_HEAD}
        fontSize={26}
        fontWeight={500}
        fill={SECONDARY}
        letterSpacing={5}
        x={-360}
        y={-70}
        opacity={0}
    />);
    view.add(<Txt
        ref={labelBottom}
        text="SECURITY"
        fontFamily={F_HEAD}
        fontSize={26}
        fontWeight={500}
        fill={SECONDARY}
        letterSpacing={5}
        x={-360}
        y={70}
        opacity={0}
    />);
    view.add(<Line
        ref={boundary}
        points={[[-460, 0], [-260, 0]]}
        stroke={BOUNDARY}
        lineWidth={1}
        opacity={0}
    />);

    yield* all(
        labelTop().opacity(0.92, 0.5, easeOutQuart),
        labelBottom().opacity(0.92, 0.5, easeOutQuart),
        boundary().opacity(1, 0.5, easeOutQuart),
    );

    yield* waitFor(1.7);

    // Erase: labels collapse toward the boundary; boundary shrinks to a point.
    yield* all(
        labelTop().opacity(0, 0.7, easeInCubic),
        labelTop().y(-30, 0.7, easeInOutCubic),
        labelBottom().opacity(0, 0.7, easeInCubic),
        labelBottom().y(30, 0.7, easeInOutCubic),
        boundary().opacity(0, 0.7, easeInCubic),
        boundary().points([[-360, 0], [-360, 0]], 0.7, easeInOutCubic),
    );
    labelTop().remove();
    labelBottom().remove();
    boundary().remove();

    // Recenter the code for Beat 5/6.
    yield* merged.node.x(0, 0.4, easeInOutCubic);

    // ─── BEAT 5 (22–26s) · THESIS ─────────────────────────────────────
    // Push code into the background hard so the thesis reads cleanly.
    const dimAll: ThreadGenerator[] = [];
    for (let i = 0; i < merged.lineCount; i++) {
        const ln = merged.getLine(i);
        if (ln) dimAll.push(ln.setOpacity(0.18, 0.6));
    }
    yield* all(...dimAll);

    const thesisLead    = createRef<Txt>();
    const thesisAccent  = createRef<Txt>();
    view.add(<Txt
        ref={thesisLead}
        text="Clean code can erase"
        fontFamily={F_HEAD}
        fontSize={68}
        fontWeight={500}
        fill={INK}
        letterSpacing={-1.6}
        x={0}
        y={-100}
        opacity={0}
    />);
    view.add(<Txt
        ref={thesisAccent}
        text="meaning."
        fontFamily={F_HEAD}
        fontSize={68}
        fontWeight={500}
        fill={INK}
        letterSpacing={-1.6}
        x={0}
        y={-30}
        opacity={0}
    />);
    yield* all(
        thesisLead().opacity(1, 0.55, easeOutQuart),
        thesisLead().y(-120, 0.55, easeOutQuart),
    );
    yield* waitFor(0.2);
    yield* all(
        thesisAccent().opacity(1, 0.55, easeOutQuart),
        thesisAccent().y(-50, 0.55, easeOutQuart),
    );
    // Soft highlight on `meaning` — colour shift, not a chip.
    yield* waitFor(0.25);
    yield* thesisAccent().fill(ACCENT, 0.5, easeInOutCubic);

    yield* waitFor(1.6);

    // ─── BEAT 6 (26–30s) · FINAL AXIOM ────────────────────────────────
    yield* all(
        merged.disappear(0.5),
        thesisLead().opacity(0, 0.5, easeInCubic),
        thesisAccent().opacity(0, 0.5, easeInCubic),
    );
    thesisLead().remove();
    thesisAccent().remove();

    const axiomA = createRef<Txt>();
    const axiomB = createRef<Txt>();
    view.add(<Txt
        ref={axiomA}
        text="Don't fight duplication"
        fontFamily={F_HEAD}
        fontSize={68}
        fontWeight={500}
        fill={INK}
        letterSpacing={-1.6}
        x={0}
        y={-60}
        opacity={0}
    />);
    view.add(<Txt
        ref={axiomB}
        text="until you know what it remembers."
        fontFamily={F_HEAD}
        fontSize={48}
        fontWeight={400}
        fill={SECONDARY}
        letterSpacing={-0.8}
        x={0}
        y={30}
        opacity={0}
    />);

    yield* all(
        axiomA().opacity(1, 0.6, easeOutQuart),
        axiomA().y(-50, 0.6, easeOutQuart),
    );
    yield* waitFor(0.4);
    yield* all(
        axiomB().opacity(0.95, 0.6, easeOutQuart),
        axiomB().y(40, 0.6, easeOutQuart),
    );

    yield* waitFor(2.0);
});

// ── Helpers ───────────────────────────────────────────────────────────
function makeBlock(code: string, y: number): Manticore {
    return Manticore.create(code, {
        x: 0,
        y,
        width: CODE_W,
        fontSize: CODE_FONT,
        lineHeight: CODE_LH,
        fontFamily: F_CODE,
        theme: LightLabTheme,
        cardStyle: FLAT_CARD,
        customTypes: CUSTOM_TYPES,
        glowAccent: false,
    });
}
