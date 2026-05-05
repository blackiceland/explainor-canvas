import {Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
    all, createRef,
    easeInCubic, easeInOutCubic, easeOutCubic, easeOutQuart,
    ThreadGenerator, Vector2, waitFor,
} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {SyntaxTheme} from '../core/code/model/SyntaxTheme';

// ══════════════════════════════════════════════════════════════════════
// Reels · Don't Fight Duplication — 30s · Vertical 1080×1920 · Light Lab
//
//   0–3s   Hook       "This looks like duplication."
//   3–8s   Pair       Two near-mirror Kotlin extension functions, stacked.
//                     The condition expression in each `if` recolours to
//                     accent — the only signal of mirror, no card pills.
//   8–12s  Merge      Two blocks fade out, single `notice(condition)` fades in.
//   12–17s Isolate    Other lines fade to 0.18; condition: Boolean stays
//                     full opacity. No bg pill, no ghost labels.
//   17–22s Hold       Code restores to full, but `condition` recolours to
//                     accent — what we have left of the domain knowledge.
//   22–26s Thesis     Code FULLY disappears, then thesis appears.
//                     "Clean code can erase meaning."
//   26–30s Axiom      "Don't fight duplication / until you know what it
//                     remembers." — held 2s.
// ══════════════════════════════════════════════════════════════════════

// ── Palette (§4) ──────────────────────────────────────────────────────
const BG        = '#E8E3D8';
const INK       = '#1F2326';
const SECONDARY = '#706D66';
const KW        = '#A75B38';
const TYP       = '#55748C';
const STR       = '#6B7F5A';
const ACCENT    = KW;

// ── Typography (§5) ───────────────────────────────────────────────────
const F_HEAD = 'Geist, Space Grotesk, Inter, sans-serif';
const F_CODE = 'JetBrains Mono, IBM Plex Mono, monospace';

// ── SyntaxTheme: Light Lab semantic colours, no decorative tones. ─────
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
    constant:    TYP,
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
// Kotlin extension functions: shorter signatures fit fontSize 36 within
// the 880-px card. Single-arg Message keeps lines short and the merge
// monomorphic.
const BILLING = `fun Invoice.notice(): Message {
    if (isOverdue) {
        return Message(URGENT)
    }
    return Message(NORMAL)
}`;

const SECURITY = `fun Login.notice(): Message {
    if (isSuspicious) {
        return Message(URGENT)
    }
    return Message(NORMAL)
}`;

// Multi-line signature — keeps each visible line short.
const MERGED = `fun notice(
    condition: Boolean
): Message {
    if (condition) {
        return Message(URGENT)
    }
    return Message(NORMAL)
}`;

const CUSTOM_TYPES = ['Message', 'Invoice', 'Login'];

// Tokenizer is Java-only — `fun` lands as 'plain'. Recolour without
// touching the lexer.
const KOTLIN_KW_RULES: ColorRule[] = [
    {match: /^fun$/, color: KW, onlyTypes: ['plain']},
];

const CODE_FONT = 36;
const CODE_LH   = 56;
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
        fontSize={64}
        fontWeight={500}
        fill={INK}
        letterSpacing={-1.4}
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
    const billing  = makeBlock(BILLING,  -260);
    const security = makeBlock(SECURITY,  260);
    billing.mount(view);
    security.mount(view);
    billing.colorize(KOTLIN_KW_RULES);
    security.colorize(KOTLIN_KW_RULES);

    // Slide in from below + fade.
    billing.node.y(billing.node.y() + 140);
    security.node.y(security.node.y() + 140);
    yield* all(
        billing.node.y(-260, 0.7, easeOutQuart),
        security.node.y(260, 0.7, easeOutQuart),
        billing.appear(0.6),
        security.appear(0.6),
    );

    yield* waitFor(0.5);

    // Recolour the condition expressions (the part that carries domain
    // knowledge) to accent — no bg pills, only token colour.
    yield* all(
        ...billing.getLine(billing.findLine('isOverdue'))!
            .colorizeByRuleAnimated('isOverdue', ACCENT, 0.45, ['plain']),
        ...security.getLine(security.findLine('isSuspicious'))!
            .colorizeByRuleAnimated('isSuspicious', ACCENT, 0.45, ['plain']),
    );

    yield* waitFor(2.4);

    // ─── BEAT 2 (8–12s) · MERGE ───────────────────────────────────────
    yield* all(
        billing.node.y(-60, 0.55, easeInOutCubic),
        security.node.y(60, 0.55, easeInOutCubic),
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
    // Pure isolation through opacity differential. No pill, no ghosts.
    const condLine = merged.findLine('condition: Boolean');

    const dimOthers: ThreadGenerator[] = [];
    for (let i = 0; i < merged.lineCount; i++) {
        if (i === condLine) continue;
        const ln = merged.getLine(i);
        if (ln) dimOthers.push(ln.setOpacity(0.18, 0.5));
    }
    yield* all(...dimOthers);

    yield* waitFor(2.4);

    // ─── BEAT 4 (17–22s) · DOMAIN KNOWLEDGE GONE ──────────────────────
    // Restore other lines, then recolour `condition` to accent — the only
    // residue of the lost domain names.
    const restoreLines: ThreadGenerator[] = [];
    for (let i = 0; i < merged.lineCount; i++) {
        if (i === condLine) continue;
        const ln = merged.getLine(i);
        if (ln) restoreLines.push(ln.setOpacity(1, 0.55));
    }
    yield* all(...restoreLines);

    const condCl = merged.getLine(condLine)!;
    yield* all(
        ...condCl.colorizeByRuleAnimated('condition', ACCENT, 0.5, ['plain']),
    );

    yield* waitFor(2.6);

    // ─── BEAT 5 (22–26s) · THESIS ─────────────────────────────────────
    // Code MUST be fully gone before the thesis lands.
    yield* merged.disappear(0.55);
    merged.node.remove();

    const thesisLead   = createRef<Txt>();
    const thesisAccent = createRef<Txt>();
    view.add(<Txt
        ref={thesisLead}
        text="Clean code can erase"
        fontFamily={F_HEAD}
        fontSize={72}
        fontWeight={500}
        fill={INK}
        letterSpacing={-1.6}
        x={0}
        y={-110}
        opacity={0}
    />);
    view.add(<Txt
        ref={thesisAccent}
        text="meaning."
        fontFamily={F_HEAD}
        fontSize={88}
        fontWeight={600}
        fill={INK}
        letterSpacing={-2.2}
        x={0}
        y={10}
        opacity={0}
    />);
    yield* all(
        thesisLead().opacity(1, 0.55, easeOutQuart),
        thesisLead().y(-130, 0.55, easeOutQuart),
    );
    yield* waitFor(0.25);
    yield* all(
        thesisAccent().opacity(1, 0.6, easeOutQuart),
        thesisAccent().y(-10, 0.6, easeOutQuart),
    );
    yield* waitFor(0.3);
    yield* thesisAccent().fill(ACCENT, 0.55, easeInOutCubic);

    yield* waitFor(1.5);

    // ─── BEAT 6 (26–30s) · FINAL AXIOM ────────────────────────────────
    yield* all(
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
        fontSize={72}
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
        fontSize={50}
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
