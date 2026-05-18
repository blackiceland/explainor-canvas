import {Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {ThreadGenerator, waitFor} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {SyntaxTheme} from '../core/code/model/SyntaxTheme';

// ══════════════════════════════════════════════════════════════════════
// Dark variant of the linen duplication scene — same editorial
// vocabulary (KUROSHIMA frame, hero italic punch, two TS specimens,
// 3-role syntax palette, mono subtitle) inverted to a warm-charcoal
// ground. No corporate dark-mode: still "newsprint", just at night.
//
// Palette inversion principle: keep the HUE, flip the LIGHTNESS.
// Body INK becomes the dark warm BG. The warm cream of the page
// becomes the new INK on top. Keywords/domain greens preserve their
// hue but rise into the light end of the value range.
// ══════════════════════════════════════════════════════════════════════

const F_SERIF = 'Newsreader, EB Garamond, serif';
// Monaspace Xenon — the editorial cut with subtle serif touches.
// On dark BG it reads as "letterpress on aged paper at night", not
// as a terminal. JetBrains Mono is the safety fallback.
const F_MONO  = '"Monaspace Xenon", "JetBrains Mono", monospace';

const VIEW_W = 1080;
const VIEW_H = 1920;

// ── Dark palette ─────────────────────────────────────────────────────
const BG     = '#1A1409'; // aged ink ground — deeper warm than charcoal
const INK    = '#E5DAC2'; // warm cream — body
const BROWN  = '#B89D7A'; // light tobacco — keywords (function/const/return)
const GREEN  = '#A8C09C'; // warm olive sage — domain (function defs, strings)
const HERO   = '#A8C09C'; // same accent for frame + most of hero
const AMBER  = '#D4B57A'; // warm honey — italic punch ("bad.")
const QUIET  = '#7B7160';
const MASS   = '#E5DAC2'; // cream — figure fills (paper cutouts on dark)
const SKEL   = 'rgba(229, 218, 194, 0.32)'; // cream low-α paper bands
const DIM_OP = 0.28;

const THEME: SyntaxTheme = {
    keyword:     INK,
    type:        INK,
    string:      GREEN,
    number:      INK,
    operator:    INK,
    punctuation: INK,
    method:      INK,
    comment:     QUIET,
    annotation:  INK,
    constant:    GREEN,
    plain:       INK,
};

const RULES: ColorRule[] = [
    {match: /^(function|const|let|var|return|if|else|await|async|throw|new|export|import|class|interface|enum)$/, color: BROWN},
    {match: /^(sendCartReminder|sendLoginCode|sendMessage)$/, color: GREEN},
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

const CODE_X = 20;

const CODE_CART = `function sendCartReminder(user, cart) {
    const message = render("cart.reminder", cart)
    const delivery = send(user.phone, message)
    track(user, message, delivery)

    return delivery
}`;

const CODE_LOGIN = `function sendLoginCode(user, code) {
    const message = render("login.code", code)
    const delivery = send(user.phone, message)
    track(user, message, delivery)

    return delivery
}`;

function bumpWeight(block: Manticore, weight: number): void {
    for (let i = 0; i < block.lineCount; i++) {
        const line = block.getLine(i);
        if (!line) continue;
        for (const tokenData of line.tokens) {
            tokenData.ref().fontWeight(weight);
        }
    }
}

function* awaitFontsReady(): ThreadGenerator {
    if (typeof document === 'undefined') return;
    try {
        document.fonts.load(`400 32px "Monaspace Xenon"`);
        document.fonts.load(`500 32px "Monaspace Xenon"`);
        document.fonts.load(`400 32px "JetBrains Mono"`);
        document.fonts.load(`500 32px "JetBrains Mono"`);
        document.fonts.load(`600 32px "JetBrains Mono"`);
        document.fonts.load(`400 120px "Newsreader"`);
        document.fonts.load(`italic 400 120px "Newsreader"`);
        document.fonts.load(`500 22px "Newsreader"`);
    } catch {}

    for (let i = 0; i < 80; i++) {
        if (document.fonts.check(`400 32px "Monaspace Xenon"`) &&
            document.fonts.check(`500 32px "Monaspace Xenon"`) &&
            document.fonts.check(`400 32px "JetBrains Mono"`) &&
            document.fonts.check(`400 120px "Newsreader"`)) {
            return;
        }
        yield* waitFor(0.05);
    }
}

export default makeScene2D(function* (view) {
    yield* awaitFontsReady();

    // Solid warm-charcoal ground — no texture for this first pass.
    view.add(<Rect width={VIEW_W} height={VIEW_H} fill={BG} />);

    // Frame — same positions as the linen scene.
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

    // Hero phrase — three lines, the italic "bad." punch.
    const HERO_TOP = -700;
    const HERO_LH  = 88;
    const HERO_SZ  = 72;
    view.add(<Txt
        text="Code duplication"
        fontFamily={F_SERIF} fontSize={HERO_SZ} fontWeight={400}
        fill={HERO} y={HERO_TOP} textAlign="center"
    />);
    view.add(<Txt
        text="isn't always"
        fontFamily={F_SERIF} fontSize={HERO_SZ} fontWeight={400}
        fill={HERO} y={HERO_TOP + HERO_LH} textAlign="center"
    />);
    view.add(<Txt
        text="bad."
        fontFamily={F_SERIF} fontSize={108} fontWeight={400}
        fontStyle="italic" fill={AMBER}
        y={HERO_TOP + HERO_LH * 2 + 14} textAlign="center"
    />);

    // Two TS specimens — same fontSize/lineHeight/positions as the
    // linen scene so the composition reads as the same poster, just
    // in night mode.
    const cart = Manticore.create(CODE_CART, {
        x: CODE_X, y: -125,
        width: 1100,
        fontSize: 32, lineHeight: 46,
        fontFamily: F_MONO,
        theme: THEME,
        cardStyle: FLAT_CARD,
        glowAccent: false,
    });
    const login = Manticore.create(CODE_LOGIN, {
        x: CODE_X, y: +260,
        width: 1100,
        fontSize: 32, lineHeight: 46,
        fontFamily: F_MONO,
        theme: THEME,
        cardStyle: FLAT_CARD,
        glowAccent: false,
    });
    cart.mount(view);
    login.mount(view);
    bumpWeight(cart, 560);
    bumpWeight(login, 560);
    cart.colorize(RULES);
    login.colorize(RULES);
    cart.node.opacity(1);
    login.node.opacity(1);

    // Subtitle — voiceover-mode mono, single accent green.
    view.add(<Txt
        text="two functions"
        fontFamily={F_MONO} fontSize={32} fontWeight={400}
        fill={HERO}
        x={CODE_X} y={680}
        textAlign="center"
    />);

    // Static hold — let the dark composition sit so we can judge the
    // palette translation. Animation comes later if the look survives
    // the inspection.
    yield* waitFor(12);
});
