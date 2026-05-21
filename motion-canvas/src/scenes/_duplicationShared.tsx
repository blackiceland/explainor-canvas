import {Img, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {ThreadGenerator, waitFor} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {SyntaxTheme} from '../core/code/model/SyntaxTheme';

// ══════════════════════════════════════════════════════════════════════
// Shared scaffolding for the three palette-variant duplication scenes
// (pink / lavender / beige). Each variant supplies just a palette;
// composition, geometry, font, hero, code, and "hacks from the s4
// reference" (same-lightness pastel accents on a hue-tinted dark
// ground, humanist mono, braced subtitle) live here.
// ══════════════════════════════════════════════════════════════════════

export interface Palette {
    /** Hue-tinted deep ground. Scene's identity colour. */
    BG: string;
    /** Body text — warm-neutral, ~90 % lightness. */
    INK: string;
    /** Keywords (function / const / return). Pastel ~75-82 % light. */
    KEY: string;
    /** Domain markers — function DEFINITION names. Pastel in a hue
     *  30-60° from KEY, same lightness. Also the fallback for STRING
     *  if STRING isn't explicitly set. */
    DOMAIN: string;
    /** Italic "bad." punch. Third hue in the family. */
    PUNCH: string;
    /** Hero + frame (KUROSHIMA / ISSUE 02). Usually = KEY. */
    HERO: string;
    /** Muted neutral — comments, dimmed states. */
    QUIET: string;
    /** Optional override of the code font family. Defaults to Argon. */
    font?: string;
    /** Optional override of the bumped weight. Defaults to 530. */
    weight?: number;
    /** Optional separate colour for string literals ("cart.reminder",
     *  "login.code"). When unset, strings inherit DOMAIN. */
    STRING?: string;
    /** Method-CALL sites — `render` / `send` / `track`. Verb identity.
     *  When unset, falls back to INK (calls read neutral). */
    CALL?: string;
    /** Parameter + local-binding names: `user`, `cart`, `code`,
     *  `message`, `delivery`. The "body" of the function. */
    PARAM?: string;
    /** Property access (`user.phone` → `phone`). */
    PROP?: string;
    /** Brackets / braces / parens / commas. Dimming PUNC pushes the
     *  coloured identifiers forward without bleaching them. */
    PUNC?: string;
    /** Operators (`=`). Often = PUNC. */
    OPERATOR?: string;
    /** Optional background image URL. When set, layered above BG fill
     *  (BG then becomes a tint mask, not the visible ground). */
    bgImage?: string;
    /** Optional rgba tint laid over the bgImage to darken / hue-shift
     *  the texture toward the palette. Default: a soft BG-coloured
     *  veil at 35 % alpha so accents read crisp on photo textures. */
    bgTint?: string;
}

const F_SERIF = 'Newsreader, EB Garamond, serif';
// Monaspace Argon — humanist mono, rounded letterforms. Closest free
// equivalent to the Cartograph CF feel in the s4 reference.
const F_MONO  = '"Monaspace Argon", "JetBrains Mono", monospace';

const VIEW_W = 1080;
const VIEW_H = 1920;
const CODE_X = 0;

const CODE_CART = `function sendCartReminder(phone, cart) {
  const message = render("cart.due", cart)
  const sent = send(phone, message)
  track(phone, message, sent)

  return sent
}`;

const CODE_LOGIN = `function sendLoginCode(phone, code) {
  const message = render("login.code", code)
  const sent = send(phone, message)
  track(phone, message, sent)

  return sent
}`;

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
        document.fonts.load(`400 32px "Monaspace Argon"`);
        document.fonts.load(`500 32px "Monaspace Argon"`);
        document.fonts.load(`400 32px "JetBrains Mono"`);
        document.fonts.load(`500 32px "JetBrains Mono"`);
        document.fonts.load(`600 32px "JetBrains Mono"`);
        document.fonts.load(`400 120px "Newsreader"`);
        document.fonts.load(`italic 400 120px "Newsreader"`);
        document.fonts.load(`500 22px "Newsreader"`);
    } catch {}

    for (let i = 0; i < 80; i++) {
        if (document.fonts.check(`400 32px "Monaspace Argon"`) &&
            document.fonts.check(`400 32px "JetBrains Mono"`) &&
            document.fonts.check(`400 120px "Newsreader"`)) {
            return;
        }
        yield* waitFor(0.05);
    }
}

export function buildDuplicationScene(palette: Palette) {
    const {BG, INK, KEY, DOMAIN, PUNCH, HERO, QUIET} = palette;
    const codeFont = palette.font ?? F_MONO;
    const codeWeight = palette.weight ?? 695;
    const STRING_COLOR = palette.STRING ?? DOMAIN;
    const CALL_COLOR  = palette.CALL  ?? INK;
    const PARAM_COLOR = palette.PARAM ?? INK;
    const PROP_COLOR  = palette.PROP  ?? INK;
    const PUNC_COLOR  = palette.PUNC  ?? INK;
    const OP_COLOR    = palette.OPERATOR ?? PUNC_COLOR;

    // THEME — syntactic categories from the tokenizer. Identifier
    // colouring (CALL / PARAM / PROP / METHOD) is done by RULES below,
    // because the tokenizer marks them all as `identifier`.
    const THEME: SyntaxTheme = {
        keyword:     INK,
        type:        INK,
        string:      STRING_COLOR,
        number:      INK,
        operator:    OP_COLOR,
        punctuation: PUNC_COLOR,
        method:      INK,
        comment:     QUIET,
        annotation:  INK,
        constant:    DOMAIN,
        plain:       INK,
    };

    const RULES: ColorRule[] = [
        // Language layer — keywords carry the structural accent.
        {match: /^(function|const|let|var|return|if|else|await|async|throw|new|export|import|class|interface|enum)$/, color: KEY},
        // Function DEFINITIONS — the "noun" that names the routine.
        {match: /^(sendCartReminder|sendLoginCode|sendMessage)$/, color: DOMAIN},
        // Method CALLS — the verbs invoked from inside the body.
        {match: /^(render|send|track|log)$/, color: CALL_COLOR},
        // Parameter + local-binding identifiers — the body's nouns.
        {match: /^(phone|cart|code|message|sent|user|delivery|payload|context)$/, color: PARAM_COLOR},
        // Property access (e.g. `obj.email` → `email`).
        {match: /^(email|id|name)$/, color: PROP_COLOR},
    ];

    return makeScene2D(function* (view) {
        yield* awaitFontsReady();

        // Ground. Photo texture if bgImage is set (optional bgTint
        // veil on top); otherwise a flat hue-tinted dark fill.
        if (palette.bgImage) {
            view.add(<Img src={palette.bgImage} width={VIEW_W} height={VIEW_H} />);
            if (palette.bgTint) {
                view.add(<Rect width={VIEW_W} height={VIEW_H} fill={palette.bgTint} />);
            }
        } else {
            view.add(<Rect width={VIEW_W} height={VIEW_H} fill={BG} />);
        }

        // Editorial frame.
        view.add(<Txt
            text="KUROSHIMA"
            fontFamily={F_SERIF} fontSize={22} fontWeight={500}
            letterSpacing={5} fill={HERO} y={-820}
        />);
        view.add(<Txt
            text="ISSUE 02"
            fontFamily={F_SERIF} fontSize={17} fontWeight={500}
            letterSpacing={6} fill="rgba(237, 238, 232, 0.56)" y={820}
        />);

        // Hero — three lines, italic "bad." in its own PUNCH colour
        // so the punchline reads as a different intonation.
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
            fontStyle="italic" fill={PUNCH}
            y={HERO_TOP + HERO_LH * 2 + 14} textAlign="center"
        />);

        // Two TS specimens.
        const cart = Manticore.create(CODE_CART, {
            x: CODE_X, y: -125,
            width: 984,
            fontSize: 33, lineHeight: 39,
            fontFamily: codeFont,
            theme: THEME,
            cardStyle: FLAT_CARD,
            glowAccent: false,
        });
        const login = Manticore.create(CODE_LOGIN, {
            x: CODE_X, y: +200,
            width: 984,
            fontSize: 33, lineHeight: 39,
            fontFamily: codeFont,
            theme: THEME,
            cardStyle: FLAT_CARD,
            glowAccent: false,
        });
        cart.mount(view);
        login.mount(view);
        bumpWeight(cart, codeWeight);
        bumpWeight(login, codeWeight);
        cart.colorize(RULES);
        login.colorize(RULES);
        cart.node.opacity(1);
        login.node.opacity(1);

        // Bottom anchor — a refined supporting caption echoing the
        // code structure. Painted in code-keyword blue so it visually
        // pairs with the `function` keyword above, tying the caption
        // to the syntax it summarises.
        view.add(<Txt
            text="two functions"
            fontFamily={codeFont} fontSize={34} fontWeight={400}
            fill="#E2E6EE"
            x={CODE_X} y={575}
            textAlign="center"
        />);

        yield* waitFor(8);
    });
}
