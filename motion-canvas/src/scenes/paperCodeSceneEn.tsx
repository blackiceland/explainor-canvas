import {Img, Rect, makeScene2D} from '@motion-canvas/2d';
import {ThreadGenerator, createRef, waitFor} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {SyntaxTheme} from '../core/code/model/SyntaxTheme';

// ══════════════════════════════════════════════════════════════════════
// Paper code — vertical 1080×1920 (verticalProject).
// Editorial light visual: quiet warm BG (no gradient, no vignette),
// one neutral cream paper panel with a very soft short shadow and a
// barely-visible grain. Code sits a touch above centre with airy
// line-height. Editorial accenting: charcoal + dark green + warm brown.
// ══════════════════════════════════════════════════════════════════════

const F_MONO = 'JetBrains Mono, IBM Plex Mono, monospace';

const VIEW_W = 1080;
const VIEW_H = 1920;

// ── Palette ───────────────────────────────────────────────────────────
// Outer BG slightly cooler/darker than the page; page is a quiet cream.
const BG          = '#DCD5CA';
const PAGE        = '#F2EEE6';
const PAGE_STROKE = 'rgba(120, 102, 70, 0.07)';
const INK         = '#1F2326';
const GREEN       = '#2F4A3E';
const BROWN       = '#5B4032';

const THEME: SyntaxTheme = {
    keyword:     INK,
    type:        INK,
    string:      GREEN,
    number:      INK,
    operator:    INK,
    punctuation: INK,
    method:      INK,
    comment:     INK,
    annotation:  INK,
    constant:    INK,
    plain:       INK,
};

// Editorial accenting — touch a few tokens, leave the rest charcoal.
// Tokenizer is Java-only, so Kotlin `fun` is forced via ColorRule.
const RULES: ColorRule[] = [
    {match: /^fun$/,    color: BROWN},
    {match: /^send$/,   color: GREEN},
    {match: /^URGENT$/, color: BROWN},
    {match: /^CALM$/,   color: BROWN},
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

const CODE_FONT = 32;
const CODE_LH   = 56;
const CODE_W    = 600;

const CODE = `fun notice() {
    send("pay", URGENT)
}

fun warning() {
    send("login", CALM)
}`;

// Page covers ~91% width, ~82% height of the frame — large enough to be
// the central stage, small enough to leave breathing margins.
const PAGE_W = 980;
const PAGE_H = 1570;
const PAGE_RADIUS = 36;

// Paper weave is a real crop from the reference photo (no procedural
// canvas-noise — those approximations don't read as fabric). The PNG
// is built by scripts/build-paper-texture.mjs and lives in /public.
const PAPER_TEXTURE = '/paper-weave.png';

// Force the browser to actually activate JBM monospace before Manticore
// measures token widths. Two layers: (1) a hidden DOM span forces a
// real layout pass with the font, which warms it up everywhere; (2) a
// canvas2d measureText sanity check confirms the metrics are mono.
function* awaitCodeFontReady(): ThreadGenerator {
    if (typeof document === 'undefined') return;
    try {
        document.fonts.load(`400 ${CODE_FONT}px "JetBrains Mono"`);
        document.fonts.load(`700 ${CODE_FONT}px "JetBrains Mono"`);
    } catch {}

    // Force layout with the real font face — this is what makes
    // canvas2d.measureText return mono metrics on subsequent calls.
    const span = document.createElement('span');
    span.style.cssText = `position:fixed;left:-9999px;top:0;font:400 ${CODE_FONT}px "JetBrains Mono",monospace;visibility:hidden;`;
    span.textContent = 'iiiiiiiiii MMMMMMMMMM';
    document.body.appendChild(span);
    void span.offsetWidth;

    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    if (!ctx) { document.body.removeChild(span); return; }
    for (let i = 0; i < 60; i++) {
        if (document.fonts.check(`400 ${CODE_FONT}px "JetBrains Mono"`)) {
            ctx.font = `400 ${CODE_FONT}px "JetBrains Mono", monospace`;
            const wI = ctx.measureText('iiiiiiiiii').width;
            const wM = ctx.measureText('MMMMMMMMMM').width;
            // True monospace: 'i' and 'M' have IDENTICAL advance widths.
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
    yield* awaitCodeFontReady();

    // ── BG: flat warm tone, no gradient, no vignette ─────────────────
    view.add(<Rect width={VIEW_W} height={VIEW_H} fill={BG} />);

    // ── Page: flat cream, very soft short shadow, mild radius ────────
    const page = createRef<Rect>();
    view.add(<Rect
        ref={page}
        width={PAGE_W}
        height={PAGE_H}
        fill={PAGE}
        stroke={PAGE_STROKE}
        lineWidth={1}
        radius={PAGE_RADIUS}
        shadowColor="rgba(20, 14, 4, 0.10)"
        shadowBlur={22}
        shadowOffset={[0, 6]}
    />);

    // ── Whisper of paper grain, clipped to the page shape ────────────
    view.add(<Rect
        width={PAGE_W}
        height={PAGE_H}
        radius={PAGE_RADIUS}
        clip
    >
        <Img
            src={PAPER_TEXTURE}
            width={PAGE_W}
            height={PAGE_H}
            opacity={1}
        />
    </Rect>);

    // ── Code: a touch above centre, lots of air around ───────────────
    const code = Manticore.create(CODE, {
        x: 0,
        y: -120,
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
    yield* code.appear(0.5);

    // Long static phase so preview captures land in visible territory.
    yield* waitFor(30);
});
