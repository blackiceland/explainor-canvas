import {Txt, makeScene2D} from '@motion-canvas/2d';
import {
    all, createRef,
    easeInCubic, easeInOutCubic, easeOutCubic,
    waitFor,
} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {SyntaxTheme} from '../core/code/model/SyntaxTheme';

// ══════════════════════════════════════════════════════════════════════
// Don't Fight Duplication — vertical 1080×1920 (verticalProject).
// V2 dark pastel — five colours only: BG, PLAIN, LILAC, BLUE, QUIET.
// Two Kotlin functions look identical → merged into one → thesis lands
// on empty stage.
// ══════════════════════════════════════════════════════════════════════

const F_MONO  = 'JetBrains Mono, IBM Plex Mono, monospace';
const F_SERIF = 'EB Garamond, Caslon, Georgia, serif';

// ── V2 dark pastel — strict reference palette ────────────────────────
const BG    = '#1A1B1F';
const PLAIN = '#C7C3B9';
const LILAC = '#B8A3D4';
const BLUE  = '#9FBED9';
const QUIET = '#6E6F73';

const THEME: SyntaxTheme = {
    keyword:     LILAC,
    type:        PLAIN,
    string:      PLAIN,
    number:      PLAIN,
    operator:    QUIET,
    punctuation: QUIET,
    method:      BLUE,
    comment:     QUIET,
    annotation:  LILAC,
    constant:    PLAIN,
    plain:       PLAIN,
};

// Tokenizer is Java-only; force Kotlin keywords through ColorRule.
const RULES: ColorRule[] = [
    {match: /^fun$/, color: LILAC},
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

const CODE_FONT = 56;
const CODE_LH   = 100;
const CODE_W    = 880;

const CODE_BEFORE = `fun notice() {
    send("pay", URGENT)
}

fun warning() {
    send("login", CALM)
}`;

const CODE_AFTER = `fun send(text, tone) {
    Message(text, tone)
}`;

const THESIS = 'They were never duplicates.';

// ══════════════════════════════════════════════════════════════════════
export default makeScene2D(function* (view) {
    view.fill(BG);

    // ─── Two functions appear ────────────────────────────────────────
    const before = makeBlock(CODE_BEFORE);
    before.mount(view);
    before.colorize(RULES);
    yield* before.appear(0.7);
    yield* waitFor(4.3);

    // ─── Crossfade to merged form ────────────────────────────────────
    const after = makeBlock(CODE_AFTER);
    after.mount(view);
    after.colorize(RULES);
    after.node.opacity(0);
    yield* all(
        before.node.opacity(0, 0.65, easeInOutCubic),
        after.node.opacity(1, 0.65, easeInOutCubic),
    );
    before.node.opacity(0);
    before.node.remove();

    yield* waitFor(3.4);

    // ─── Code clears completely ─────────────────────────────────────
    yield* after.node.opacity(0, 0.55, easeInCubic);
    after.node.remove();

    // ─── Thesis lands on empty stage ─────────────────────────────────
    const thesis = createRef<Txt>();
    view.add(<Txt
        ref={thesis}
        text={THESIS}
        fontFamily={F_SERIF}
        fontSize={72}
        fontStyle="italic"
        fontWeight={400}
        fill={PLAIN}
        opacity={0}
        textAlign="center"
        width={CODE_W}
    />);
    yield* thesis().opacity(1, 0.9, easeOutCubic);
    yield* waitFor(2.8);
    yield* thesis().opacity(0, 0.5, easeInCubic);
});

// ── Helper ────────────────────────────────────────────────────────────
function makeBlock(code: string): Manticore {
    return Manticore.create(code, {
        x: 0,
        y: 0,
        width: CODE_W,
        fontSize: CODE_FONT,
        lineHeight: CODE_LH,
        fontFamily: F_MONO,
        theme: THEME,
        cardStyle: FLAT_CARD,
        glowAccent: false,
    });
}
