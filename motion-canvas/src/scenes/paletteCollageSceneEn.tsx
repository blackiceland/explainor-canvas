import {Img, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {ThreadGenerator, waitFor} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {SyntaxTheme} from '../core/code/model/SyntaxTheme';

// ══════════════════════════════════════════════════════════════════════
// Palette collage v2 — five code variants on a SINGLE linen page, no
// dark cards isolating them. Goal: scan all five harmonies side by
// side and see which colour pair breathes best with the cream ground.
// ══════════════════════════════════════════════════════════════════════

const F_SERIF = 'Newsreader, EB Garamond, serif';
const F_ARGON = '"Monaspace Argon", "JetBrains Mono", monospace';
const F_JBM   = '"JetBrains Mono", monospace';
const F_XENON = '"Monaspace Xenon", "JetBrains Mono", monospace';
const F_PLEX  = '"IBM Plex Mono", "JetBrains Mono", monospace';
const F_KRYP  = '"Monaspace Krypton", "JetBrains Mono", monospace';

const VIEW_W = 1080;
const VIEW_H = 1920;

// Linen identity colours — frame / hero / subtitle / INK body.
// These stay constant across all five rows so the reader can isolate
// the variable (KEY + DOMAIN colours) per row.
const HERO_GREEN = '#39593F'; // sage — frame, hero, subtitle
const INK        = '#1F1A10'; // warm dark — body of every code row
const QUIET      = '#7B7160';

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

// Two-line snippet — shows each pair across the three syntax roles
// (`const` KEY, identifiers INK, `"cart.reminder"` DOMAIN).
const SNIPPET = `const message = render("cart.reminder", cart)
const delivery = send(user.phone, message)`;

interface Variant {
    label: string;
    KEY: string;     // keywords (function/const/return)
    DOMAIN: string;  // strings — domain markers
    font: string;
}

// Five accent pairs designed for the LIGHT linen ground.
// Each colour ~35-55% lightness, saturation ~30-50%, so it holds
// presence on cream without looking digital. Hue families chosen to
// give five distinct moods.
const VARIANTS: Variant[] = [
    // Linen canon — warm tobacco + forest sage.
    {label: 'TOBACCO + FOREST',  KEY: '#6B3F24', DOMAIN: '#2F5A3E', font: F_ARGON},
    // Wine + dusty olive.
    {label: 'WINE + OLIVE',      KEY: '#7B3A4D', DOMAIN: '#5A6B45', font: F_XENON},
    // Deep plum + warm gold-olive.
    {label: 'PLUM + GOLD',       KEY: '#5C3F7B', DOMAIN: '#7B6A3F', font: F_PLEX},
    // Cobalt ink + terracotta clay.
    {label: 'NAVY INK + CLAY',   KEY: '#2D4E7F', DOMAIN: '#9C5E3F', font: F_JBM},
    // Burgundy + petrol mint.
    {label: 'BURGUNDY + PETROL', KEY: '#8C3F4D', DOMAIN: '#3F7B6B', font: F_KRYP},
];

function bumpWeight(block: Manticore, weight: number): void {
    for (let i = 0; i < block.lineCount; i++) {
        const line = block.getLine(i);
        if (!line) continue;
        for (const tokenData of line.tokens) {
            tokenData.ref().fontWeight(weight);
        }
    }
}

function themeFor(v: Variant): SyntaxTheme {
    return {
        keyword:     INK,
        type:        INK,
        string:      v.DOMAIN,
        number:      INK,
        operator:    INK,
        punctuation: INK,
        method:      INK,
        comment:     QUIET,
        annotation:  INK,
        constant:    v.DOMAIN,
        plain:       INK,
    };
}

function rulesFor(v: Variant): ColorRule[] {
    return [
        {match: /^(function|const|let|var|return|if|else|await|async|throw|new|export|import|class|interface|enum)$/, color: v.KEY},
    ];
}

function* awaitFontsReady(): ThreadGenerator {
    if (typeof document === 'undefined') return;
    try {
        for (const fam of ['Monaspace Argon', 'Monaspace Xenon', 'Monaspace Krypton',
                            'JetBrains Mono', 'IBM Plex Mono']) {
            document.fonts.load(`400 24px "${fam}"`);
            document.fonts.load(`500 24px "${fam}"`);
        }
        document.fonts.load(`400 52px "Newsreader"`);
        document.fonts.load(`italic 400 78px "Newsreader"`);
        document.fonts.load(`500 22px "Newsreader"`);
        document.fonts.load(`italic 400 32px "Newsreader"`);
    } catch {}
    for (let i = 0; i < 80; i++) {
        if (document.fonts.check(`400 24px "Monaspace Argon"`) &&
            document.fonts.check(`400 24px "JetBrains Mono"`) &&
            document.fonts.check(`400 24px "IBM Plex Mono"`) &&
            document.fonts.check(`400 52px "Newsreader"`)) {
            return;
        }
        yield* waitFor(0.05);
    }
}

export default makeScene2D(function* (view) {
    yield* awaitFontsReady();

    // Linen ground — no cards, no overlays per row. Page is one
    // continuous cream surface so the reader judges every colour
    // pair against the SAME paper.
    view.add(<Img src="/linen.jpg" width={VIEW_W} height={VIEW_H} />);
    view.add(<Rect width={VIEW_W} height={VIEW_H} fill="rgba(252, 245, 230, 0.18)" />);

    // Frame.
    view.add(<Txt
        text="KUROSHIMA"
        fontFamily={F_SERIF} fontSize={22} fontWeight={500}
        letterSpacing={5} fill={HERO_GREEN} y={-900}
    />);
    view.add(<Txt
        text="ISSUE 02"
        fontFamily={F_SERIF} fontSize={20} fontWeight={500}
        letterSpacing={4} fill={HERO_GREEN} y={895}
    />);

    // Compressed hero.
    const HERO_TOP = -810;
    const HERO_LH  = 64;
    const HERO_SZ  = 50;
    view.add(<Txt
        text="Code duplication"
        fontFamily={F_SERIF} fontSize={HERO_SZ} fontWeight={400}
        fill={HERO_GREEN} y={HERO_TOP} textAlign="center"
    />);
    view.add(<Txt
        text="isn't always"
        fontFamily={F_SERIF} fontSize={HERO_SZ} fontWeight={400}
        fill={HERO_GREEN} y={HERO_TOP + HERO_LH} textAlign="center"
    />);
    view.add(<Txt
        text="bad."
        fontFamily={F_SERIF} fontSize={78} fontWeight={400}
        fontStyle="italic" fill={HERO_GREEN}
        y={HERO_TOP + HERO_LH * 2 + 10} textAlign="center"
    />);

    // Five code rows directly on linen — no rect under them.
    // Each row: small palette label + 2-line code.
    const ROW_SPACING = 210;
    const stackHeight = ROW_SPACING * (VARIANTS.length - 1);
    const firstRowY = -stackHeight / 2;
    const CARD_W = 980;
    const LEFT_X = -CARD_W / 2 + 30;

    for (let i = 0; i < VARIANTS.length; i++) {
        const v = VARIANTS[i];
        const rowY = firstRowY + i * ROW_SPACING;

        // Palette label — left-aligned to the code text edge,
        // small caps in the KEY colour so the label IS its swatch.
        view.add(<Txt
            text={v.label}
            fontFamily={F_SERIF}
            fontSize={18} fontWeight={500}
            letterSpacing={5}
            fill={v.KEY}
            offsetX={-1}
            x={LEFT_X} y={rowY - 56}
        />);

        // Tiny font hint — right-aligned, in QUIET so it whispers.
        const fontLabel = v.font.match(/"([^"]+)"/)?.[1] ?? v.font.split(',')[0];
        view.add(<Txt
            text={fontLabel.toUpperCase()}
            fontFamily={F_SERIF}
            fontSize={11} fontWeight={400}
            letterSpacing={3}
            fill={QUIET}
            offsetX={1}
            x={-LEFT_X} y={rowY - 56}
        />);

        // Code rendered directly on the linen page.
        const code = Manticore.create(SNIPPET, {
            x: 0, y: rowY + 10,
            width: 1040,
            fontSize: 26, lineHeight: 40,
            fontFamily: v.font,
            theme: themeFor(v),
            cardStyle: FLAT_CARD,
            glowAccent: false,
        });
        code.mount(view);
        bumpWeight(code, 500);
        code.colorize(rulesFor(v));
        code.node.opacity(1);
    }

    // Subtitle.
    view.add(<Txt
        text="five voices"
        fontFamily={F_SERIF} fontSize={30} fontWeight={400}
        fontStyle="italic"
        fill={HERO_GREEN}
        y={770} textAlign="center"
    />);

    yield* waitFor(12);
});
