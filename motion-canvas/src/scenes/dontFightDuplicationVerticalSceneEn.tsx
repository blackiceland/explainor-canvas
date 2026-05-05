import {Layout, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
    all, createRef,
    easeInCubic, easeInOutCubic, easeOutCubic,
    Reference, ThreadGenerator, Vector2, waitFor,
} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {SyntaxTheme} from '../core/code/model/SyntaxTheme';

// ══════════════════════════════════════════════════════════════════════
// Three code-styling variants, same snippet, vertical 1080×1920.
//   V1  Light editorial — warm bg, ink text, ONE accent token, quiet puncts.
//   V2  Dark pastel — graphite bg, soft lilac/blue/grey, big line-height.
//   V3  Serif italic — light bg, code rendered as poem (no syntax colour).
// No headlines, no chrome, no captions. Just code.
// ══════════════════════════════════════════════════════════════════════

const F_MONO  = 'JetBrains Mono, IBM Plex Mono, monospace';
const F_SERIF = 'EB Garamond, Caslon, Georgia, serif';

// ── Snippet (matches the dark-pastel reference verbatim) ──────────────
const SNIPPET = `while noSuccess:
    tryAgain()

    if dead:
        break`;

// ── V1 · Light editorial ──────────────────────────────────────────────
const V1_BG       = '#E0DACE';
const V1_INK      = '#1B1815';
const V1_QUIET    = 'rgba(27,24,21,0.42)';
const V1_ACCENT   = '#A75B38';
const V1_THEME: SyntaxTheme = {
    keyword:     V1_INK,
    type:        V1_INK,
    string:      V1_INK,
    number:      V1_INK,
    operator:    V1_QUIET,
    punctuation: V1_QUIET,
    method:      V1_INK,
    comment:     V1_QUIET,
    annotation:  V1_INK,
    constant:    V1_INK,
    plain:       V1_INK,
};
const V1_RULES: ColorRule[] = [
    {match: /^tryAgain$/, color: V1_ACCENT, onlyTypes: ['method']},
];

// ── V2 · Dark pastel (the while/if/break reference) ───────────────────
const V2_BG       = '#1A1B1F';
const V2_PLAIN    = '#C7C3B9';
const V2_LILAC    = '#B8A3D4';
const V2_BLUE     = '#9FBED9';
const V2_QUIET    = '#6E6F73';
const V2_THEME: SyntaxTheme = {
    keyword:     V2_LILAC,
    type:        V2_PLAIN,
    string:      V2_PLAIN,
    number:      V2_PLAIN,
    operator:    V2_QUIET,
    punctuation: V2_QUIET,
    method:      V2_BLUE,
    comment:     V2_QUIET,
    annotation:  V2_LILAC,
    constant:    V2_PLAIN,
    plain:       V2_PLAIN,
};

// ── V3 · Serif italic / editorial poem ────────────────────────────────
const V3_BG  = '#E0DACE';
const V3_INK = '#1B1815';

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
const CODE_LH   = 100;   // ≈ 1.8× — Open-style breathing
const CODE_W    = 920;

// ══════════════════════════════════════════════════════════════════════
export default makeScene2D(function* (view) {
    view.size(new Vector2(1080, 1920));
    view.fill(V1_BG);

    // Two background layers — we crossfade between them as the variant
    // changes. Light is on top by default.
    const bgLight = createRef<Rect>();
    const bgDark  = createRef<Rect>();
    view.add(<Rect ref={bgLight} width={1080} height={1920} fill={V1_BG} opacity={1}/>);
    view.add(<Rect ref={bgDark}  width={1080} height={1920} fill={V2_BG} opacity={0}/>);

    // ─── V1 ──────────────────────────────────────────────────────────
    const v1 = makeBlock(SNIPPET, V1_THEME);
    v1.mount(view);
    v1.colorize(V1_RULES);
    yield* v1.appear(0.6);
    yield* waitFor(3.4);

    // ─── V1 → V2 (light → dark, swap code) ────────────────────────────
    const v2 = makeBlock(SNIPPET, V2_THEME);
    v2.mount(view);
    v2.node.opacity(0);
    yield* all(
        v1.node.opacity(0, 0.55, easeInOutCubic),
        bgLight().opacity(0, 0.55),
        bgDark().opacity(1, 0.55),
        v2.node.opacity(1, 0.55, easeInOutCubic),
    );
    v1.node.opacity(0);
    v1.node.remove();

    yield* waitFor(3.4);

    // ─── V2 → V3 (dark → light, code becomes serif italic) ────────────
    const v3 = buildSerifBlock(view);
    v3.opacity(0);
    yield* all(
        v2.node.opacity(0, 0.55, easeInOutCubic),
        bgDark().opacity(0, 0.55),
        bgLight().opacity(1, 0.55),
        v3.opacity(1, 0.55, easeInOutCubic),
    );
    v2.node.opacity(0);
    v2.node.remove();

    yield* waitFor(4.0);

    // Tail fade so the loop ends clean.
    yield* v3.opacity(0, 0.45, easeInCubic);
});

// ── Helpers ───────────────────────────────────────────────────────────
function makeBlock(code: string, theme: SyntaxTheme): Manticore {
    return Manticore.create(code, {
        x: 0,
        y: 0,
        width: CODE_W,
        fontSize: CODE_FONT,
        lineHeight: CODE_LH,
        fontFamily: F_MONO,
        theme,
        cardStyle: FLAT_CARD,
        glowAccent: false,
    });
}

// V3 doesn't go through Manticore — it's serif italic, deliberately not
// monospace. Each line is a Txt placed by hand. Indents become
// typographic, not tabular.
function buildSerifBlock(view: Layout): Layout {
    const lines = [
        {text: 'while noSuccess:',     indent: 0},
        {text: 'tryAgain()',           indent: 1},
        {text: '',                     indent: 0},
        {text: 'if dead:',             indent: 1},
        {text: 'break',                indent: 2},
    ];
    const FS = 64;
    const LH = 96;
    const INDENT = 64;
    const total = lines.length * LH;

    const wrap = new Layout({y: 0, opacity: 0});
    for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        const y = -total / 2 + i * LH + LH / 2;
        if (ln.text.length === 0) continue;
        wrap.add(<Txt
            text={ln.text}
            fontFamily={F_SERIF}
            fontSize={FS}
            fontStyle="italic"
            fontWeight={400}
            fill={V3_INK}
            x={-CODE_W / 2 + ln.indent * INDENT}
            y={y}
            offset={[-1, 0]}
        />);
    }
    view.add(wrap);
    return wrap;
}
