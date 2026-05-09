import {Img, Node, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {ThreadGenerator, createRef, waitFor} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {SyntaxTheme} from '../core/code/model/SyntaxTheme';

// ══════════════════════════════════════════════════════════════════════
// Linen-hero test scene — vertical 1080×1920.
//
//   Beat 1  static  : KUROSHIMA · hero · code-v1 · ISSUE 01
//   Beat 2  declutter: every editorial element fades out, only code stays
//   Beat 3  morph    : code-v1 → code-v2 (Manticore.morphTo, advanced opts)
//   Beat 4  reframe  : italic question fades in below the code
// ══════════════════════════════════════════════════════════════════════

const F_SERIF = 'Newsreader, EB Garamond, serif';
const F_MONO  = 'JetBrains Mono, IBM Plex Mono, monospace';

const VIEW_W = 1080;
const VIEW_H = 1920;

const INK   = '#2A2418';
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
// width must fit the v2 signature on one line (~730 px) plus padding
// (paddingX = 56 each side at this fontSize) → 730 + 112 ≈ 842, round
// to 860 for breathing room.
const CODE_W    = 860;

const CODE_V1 = `fun buildNotice(
    condition: Boolean,
    urgentTitle: String,
    normalTitle: String
) {
    send(urgentTitle)
}`;

const CODE_V2 = `fun buildNotice(title: String) {
    send(title)
}`;

function* awaitFontsReady(): ThreadGenerator {
    if (typeof document === 'undefined') return;
    try {
        document.fonts.load(`400 ${CODE_FONT}px "JetBrains Mono"`);
        document.fonts.load(`700 ${CODE_FONT}px "JetBrains Mono"`);
        document.fonts.load(`400 120px "Newsreader"`);
        document.fonts.load(`italic 400 120px "Newsreader"`);
        document.fonts.load(`500 22px "Newsreader"`);
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
            document.fonts.check(`400 120px "Newsreader"`)) {
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

    // ── Linen BG: full bleed, soft warm-white overlay to mute nap ────
    view.add(<Img
        src="/linen.jpg"
        width={VIEW_W}
        height={VIEW_H}
    />);
    view.add(<Rect
        width={VIEW_W}
        height={VIEW_H}
        fill="rgba(252, 245, 230, 0.18)"
    />);

    // ── Editorial layer: every text element except the code lives in
    //    one parent Node so we can fade them out together before the
    //    code morphs.
    const editorial = createRef<Node>();
    const HERO_TOP = -440;
    const HERO_LH = 130;
    const HERO_SIZE = 118;

    view.add(<Node ref={editorial}>
        <Txt
            text="KUROSHIMA"
            fontFamily={F_SERIF}
            fontSize={22}
            fontWeight={500}
            letterSpacing={5}
            fill={HERO}
            x={0}
            y={-820}
        />
        <Txt
            text="Clean code"
            fontFamily={F_SERIF}
            fontSize={HERO_SIZE}
            fontWeight={400}
            fill={HERO}
            x={0}
            y={HERO_TOP}
            textAlign="center"
        />
        <Txt
            text="can erase"
            fontFamily={F_SERIF}
            fontSize={HERO_SIZE}
            fontWeight={400}
            fill={HERO}
            x={0}
            y={HERO_TOP + HERO_LH}
            textAlign="center"
        />
        <Txt
            text="meaning."
            fontFamily={F_SERIF}
            fontSize={HERO_SIZE}
            fontWeight={400}
            fontStyle="italic"
            fill={HERO}
            x={0}
            y={HERO_TOP + HERO_LH * 2}
            textAlign="center"
        />
        <Txt
            text="ISSUE 01"
            fontFamily={F_SERIF}
            fontSize={20}
            fontWeight={500}
            letterSpacing={4}
            fill={HERO}
            x={0}
            y={820}
        />
    </Node>);

    // ── Code, optically centred for the v2 single-line signature
    //    (~730 px). text-left = container.x - cardWidth/2 + paddingX,
    //    so for longest centred at view-centre: container.x =
    //    cardWidth/2 - paddingX - longest/2 = 430 - 56 - 365 = 9.
    //    v1's longest line is shorter (~547 px), so v1 sits slightly
    //    left of centre and slides to optical centre after the morph.
    const code = Manticore.create(CODE_V1, {
        x: 9,
        y: 280,
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

    // ── Reframe question, hidden initially, sits where the hero was so
    //    the eye doesn't have to travel after declutter ──────────────
    const question = createRef<Txt>();
    view.add(<Txt
        ref={question}
        text="— what about urgency?"
        fontFamily={F_SERIF}
        fontSize={42}
        fontStyle="italic"
        fill={HERO}
        x={0}
        y={-180}
        textAlign="center"
        opacity={0}
    />);

    // Beat 1 — let the viewer read the static composition. ──────────
    yield* waitFor(3.4);

    // Beat 2 — declutter: every editorial element fades out at once,
    // leaving the code alone in the frame. ──────────────────────────
    yield* editorial().opacity(0, 0.7);
    yield* waitFor(0.5);

    // Beat 3 — code morphs in solitude. Minimal MorphOptions: extra
    // options (typewriter, reverseType erase, flash) caused token
    // alignment glitches on this diff, so we keep just the two
    // durations Manticore needs.
    yield* code.morphTo(CODE_V2, {
        moveDuration: 0.7,
        removeDuration: 0.4,
        scrollStrategy: 'block',
    });
    code.colorize(RULES);

    // Beat 4 — italic question fades in above the code, naming what
    // got refactored away. The hero's last word ("meaning.") was
    // italic; this echoes that single design accent. ────────────────
    yield* waitFor(0.4);
    yield* question().opacity(1, 0.6);

    // Hold briefly so the post-morph beat is readable, then yield the
    // playhead to the next scene in the project.
    yield* waitFor(0.6);
});
