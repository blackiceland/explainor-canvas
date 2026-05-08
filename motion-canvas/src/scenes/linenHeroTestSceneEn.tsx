import {Img, Txt, makeScene2D} from '@motion-canvas/2d';
import {ThreadGenerator, waitFor} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {SyntaxTheme} from '../core/code/model/SyntaxTheme';

// ══════════════════════════════════════════════════════════════════════
// Linen-hero test scene — vertical 1080×1920.
// Full-bleed linen texture (no central paper panel).
// Layout (top → bottom): tiny serif caption, big serif hero with the
// last word italic, then a moderate-size code block below.
// ══════════════════════════════════════════════════════════════════════

const F_SERIF = 'Cormorant Garamond, EB Garamond, serif';
const F_MONO  = 'JetBrains Mono, IBM Plex Mono, monospace';

const VIEW_W = 1080;
const VIEW_H = 1920;

// Pixel-sampled directly from the reference:
//   hero  → sage green #39593F (lighter than first guess)
//   `fun` → warm brown #5B3813
//   `Boolean`, `String` (types only) → forest green #1A4D2A
//   everything else in code (send, identifiers, punctuation) → INK.
const INK   = '#1F2326';
const HERO  = '#39593F';
const GREEN = '#1A4D2A';
const BROWN = '#5B3813';

const THEME: SyntaxTheme = {
    keyword:     INK,
    type:        GREEN,
    string:      INK,
    number:      INK,
    operator:    INK,
    punctuation: INK,
    method:      INK,
    comment:     INK,
    annotation:  INK,
    constant:    INK,
    plain:       INK,
};

const RULES: ColorRule[] = [
    {match: /^fun$/,     color: BROWN},
    {match: /^Boolean$/, color: GREEN},
    {match: /^String$/,  color: GREEN},
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

const CODE_FONT = 38;
const CODE_LH   = 58;
const CODE_W    = 720;

const CODE = `fun buildNotice(
    condition: Boolean,
    urgentTitle: String,
    normalTitle: String
) {
    send(urgentTitle)
}`;

// Force the browser to actually activate the fonts before Manticore
// measures token widths or Txt nodes lay out glyphs.
function* awaitFontsReady(): ThreadGenerator {
    if (typeof document === 'undefined') return;
    try {
        document.fonts.load(`400 ${CODE_FONT}px "JetBrains Mono"`);
        document.fonts.load(`700 ${CODE_FONT}px "JetBrains Mono"`);
        document.fonts.load(`400 120px "Cormorant Garamond"`);
        document.fonts.load(`italic 400 120px "Cormorant Garamond"`);
        document.fonts.load(`400 32px "Cormorant Garamond"`);
    } catch {}

    const span = document.createElement('span');
    span.style.cssText = `position:fixed;left:-9999px;top:0;font:400 ${CODE_FONT}px "JetBrains Mono",monospace;visibility:hidden;`;
    span.textContent = 'iiiiiiiiii MMMMMMMMMM';
    document.body.appendChild(span);
    void span.offsetWidth;

    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    if (!ctx) { document.body.removeChild(span); return; }
    for (let i = 0; i < 60; i++) {
        if (document.fonts.check(`400 ${CODE_FONT}px "JetBrains Mono"`) &&
            document.fonts.check(`400 120px "Cormorant Garamond"`)) {
            ctx.font = `400 ${CODE_FONT}px "JetBrains Mono", monospace`;
            const wI = ctx.measureText('iiiiiiiiii').width;
            const wM = ctx.measureText('MMMMMMMMMM').width;
            if (Math.abs(wI - wM) < 0.5 && wI > CODE_FONT * 5) {
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

    // ── Linen BG: full bleed, fills the entire 1080×1920 canvas ──────
    view.add(<Img
        src="/linen.jpg"
        width={VIEW_W}
        height={VIEW_H}
    />);

    // ── Tiny caption (top, centred): brand wordmark ──────────────────
    view.add(<Txt
        text="Kuroshima"
        fontFamily={F_SERIF}
        fontSize={32}
        fontStyle="italic"
        fill={HERO}
        x={0}
        y={-720}
    />);

    // ── Hero: three lines, all centred, last word in italic ──────────
    const HERO_TOP = -380;
    const HERO_LH = 130;
    const HERO_SIZE = 118;

    view.add(<Txt
        text="Clean code"
        fontFamily={F_SERIF}
        fontSize={HERO_SIZE}
        fontWeight={400}
        fill={HERO}
        x={0}
        y={HERO_TOP}
        textAlign="center"
    />);
    view.add(<Txt
        text="can erase"
        fontFamily={F_SERIF}
        fontSize={HERO_SIZE}
        fontWeight={400}
        fill={HERO}
        x={0}
        y={HERO_TOP + HERO_LH}
        textAlign="center"
    />);
    view.add(<Txt
        text="meaning."
        fontFamily={F_SERIF}
        fontSize={HERO_SIZE}
        fontWeight={400}
        fontStyle="italic"
        fill={HERO}
        x={0}
        y={HERO_TOP + HERO_LH * 2}
        textAlign="center"
    />);

    // ── Code block, mono — centred as a block, content left-aligned ──
    // Manticore: text-left absolute = container.x - cardWidth/2 + paddingX.
    // For fontSize 38, paddingX clamps to 56. Longest line ≈ 524 px,
    // so for visual centring: x = 524/2 - 720/2 + 56 = 42.
    const code = Manticore.create(CODE, {
        x: 42,
        y: 400,
        width: CODE_W,
        fontSize: CODE_FONT,
        lineHeight: CODE_LH,
        fontFamily: F_MONO,
        theme: THEME,
        cardStyle: FLAT_CARD,
        glowAccent: false,
    });
    code.mount(view);
    code.colorize(RULES);
    yield* code.appear(0.4);

    // Hold so preview captures land in visible territory.
    yield* waitFor(30);
});
