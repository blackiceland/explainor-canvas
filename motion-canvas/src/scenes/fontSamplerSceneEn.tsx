import {Img, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {ThreadGenerator, waitFor} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {SyntaxTheme} from '../core/code/model/SyntaxTheme';

// ══════════════════════════════════════════════════════════════════════
// Font sampler — vertical 1080×1920. Renders one short TS line in every
// free / locally-hosted monospace family currently available, using
// the editorial "variant 2" palette so we can compare how each font
// holds the two-green-accent system on linen.
// ══════════════════════════════════════════════════════════════════════

const F_SERIF = 'Newsreader, EB Garamond, serif';

const VIEW_W = 1080;
const VIEW_H = 1920;

// "Variant 2" palette per design spec — INK body + two greens for
// domain accents (function names + string keys).
const INK         = '#2F2A24'; // warm charcoal
const NAME_GREEN  = '#3F6652'; // deep sage  — function names
const STRING_MOSS = '#5B6F5D'; // moss       — string literals
const HERO        = '#39593F';
const QUIET       = '#7B7160';

const THEME: SyntaxTheme = {
    keyword:     INK,
    type:        INK,
    string:      STRING_MOSS,
    number:      INK,
    operator:    INK,
    punctuation: INK,
    method:      NAME_GREEN,
    comment:     QUIET,
    annotation:  INK,
    constant:    INK,
    plain:       INK,
};

const RULES: ColorRule[] = [];

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

// Single-line TS sample — has one method definition name (gets the
// NAME_GREEN accent) and one string literal (STRING_MOSS). Everything
// else stays INK. 50 chars × charwidth(28) ≈ 840 px, fits 1080 card.
const SAMPLE = 'function sendCart(cart) { return "cart.reminder" }';

const FONTS = [
    {label: 'JETBRAINS MONO',    family: 'JetBrains Mono, monospace'},
    {label: 'IBM PLEX MONO',     family: '"IBM Plex Mono", monospace'},
    {label: 'GEIST MONO',        family: '"Geist Mono", monospace'},
    {label: 'COMMIT MONO',       family: '"Commit Mono", monospace'},
    {label: 'RECURSIVE MONO',    family: '"Recursive", monospace'},
    {label: 'MONASPACE ARGON',   family: '"Monaspace Argon", monospace'},
    {label: 'MONASPACE NEON',    family: '"Monaspace Neon", monospace'},
    {label: 'MONASPACE XENON',   family: '"Monaspace Xenon", monospace'},
    {label: 'MONASPACE KRYPTON', family: '"Monaspace Krypton", monospace'},
];

function* awaitFontsReady(): ThreadGenerator {
    if (typeof document === 'undefined') return;
    const families = [
        'JetBrains Mono', 'IBM Plex Mono', 'Geist Mono',
        'Commit Mono', 'Recursive',
        'Monaspace Argon', 'Monaspace Neon',
        'Monaspace Xenon', 'Monaspace Krypton',
        'Newsreader',
    ];
    try {
        for (const f of families) {
            document.fonts.load(`400 28px "${f}"`);
        }
        document.fonts.load(`500 18px "Newsreader"`);
    } catch {}

    for (let i = 0; i < 120; i++) {
        let allReady = true;
        for (const f of families) {
            if (!document.fonts.check(`400 28px "${f}"`)) {
                allReady = false;
                break;
            }
        }
        if (allReady) return;
        yield* waitFor(0.05);
    }
}

export default makeScene2D(function* (view) {
    yield* awaitFontsReady();

    // Linen ground.
    view.add(<Img src="/linen.jpg" width={VIEW_W} height={VIEW_H} />);
    view.add(<Rect
        width={VIEW_W} height={VIEW_H}
        fill="rgba(252, 245, 230, 0.18)"
    />);

    // Frame.
    view.add(<Txt
        text="KUROSHIMA"
        fontFamily={F_SERIF} fontSize={22} fontWeight={500}
        letterSpacing={5} fill={HERO} y={-880}
    />);
    view.add(<Txt
        text="FONT SAMPLER"
        fontFamily={F_SERIF} fontSize={20} fontWeight={500}
        letterSpacing={4} fill={HERO} y={+880}
    />);

    // Layout — N rows, evenly spaced around y=0. Each row has a small
    // label above its code line. Both label and code text start at
    // the same left x (Manticore's text left edge for a 1080-wide
    // card with paddingX=56 → -484).
    const ROW_GAP = 158;
    const N = FONTS.length;
    const startY = -((N - 1) / 2) * ROW_GAP;
    const LEFT_X = -484;

    for (let i = 0; i < N; i++) {
        const {label, family} = FONTS[i];
        const rowY = startY + i * ROW_GAP;

        view.add(<Txt
            text={label}
            fontFamily={F_SERIF}
            fontSize={18}
            fontWeight={500}
            letterSpacing={5}
            fill={HERO}
            offsetX={-1}
            x={LEFT_X}
            y={rowY - 42}
        />);

        const block = Manticore.create(SAMPLE, {
            x: 0,
            y: rowY,
            width: 1080,
            fontSize: 28,
            lineHeight: 50,
            fontFamily: family,
            theme: THEME,
            cardStyle: FLAT_CARD,
            glowAccent: false,
        });
        block.mount(view);
        block.colorize(RULES);
        block.node.opacity(1);
    }

    // Hold the static composition long enough to inspect.
    yield* waitFor(12);
});
