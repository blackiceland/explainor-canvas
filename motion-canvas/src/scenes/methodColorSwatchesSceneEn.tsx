import {Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {ThreadGenerator, waitFor} from '@motion-canvas/core';

// Single-column swatch test: `sendCartReminder` printed 50 times on
// the cobalt-grey ground, each row in a different candidate METHOD
// hue. All swatches are intentionally restrained — mid-lightness,
// low-to-moderate saturation — so the page reads as a tender palette
// catalogue, not a paint-store wall.

const VIEW_W = 1080;
const VIEW_H = 1920;
const BG     = '#1B1B1F';
const F_MONO = '"Monaspace Argon", "JetBrains Mono", monospace';

// 50 candidates, grouped from warm-pink → warm-orange → green → cool
// → brown so the user can scan whole hue families at once.
const SWATCHES: ReadonlyArray<readonly [string, string]> = [
    // ── Dusty pinks / roses ──
    ['#C89098', 'dusty rose (baseline)'],
    ['#D4A0A0', 'blush rose'],
    ['#B88890', 'mauve rose'],
    ['#C8A0A8', 'powder rose'],
    ['#A88090', 'wine rose'],
    // ── Salmons / corals ──
    ['#D89888', 'warm salmon'],
    ['#C89088', 'muted coral'],
    ['#D8A898', 'peachy salmon'],
    ['#C09080', 'clay coral'],
    ['#B88880', 'cinnamon coral'],
    // ── Apricots / peaches ──
    ['#D8B0A0', 'apricot'],
    ['#D8B8A0', 'warm peach'],
    ['#E0B898', 'pale peach'],
    ['#D8B888', 'honey peach'],
    // ── Bricks / terracottas ──
    ['#B07868', 'brick'],
    ['#A88068', 'rust'],
    ['#B88878', 'terracotta light'],
    ['#A07868', 'deep clay'],
    // ── Ambers / honeys ──
    ['#D0A878', 'amber honey'],
    ['#C8A878', 'muted honey'],
    ['#D0B888', 'warm gold'],
    ['#C0A070', 'desat gold'],
    // ── Olives ──
    ['#A8A878', 'olive'],
    ['#B0A878', 'pale olive'],
    ['#A09870', 'muted olive'],
    // ── Sages / greens ──
    ['#A0B898', 'sage'],
    ['#A8B8A0', 'pale sage'],
    ['#B0C8A8', 'mint sage'],
    ['#90B098', 'deeper sage'],
    ['#A8B898', 'desat sage'],
    // ── Mints / teals ──
    ['#90B0A0', 'muted teal'],
    ['#A0BCB0', 'mint dust'],
    ['#88A8A0', 'slate teal'],
    ['#A0C0B8', 'seafoam'],
    // ── Slate blues (≠ cobalt KEY) ──
    ['#88A0B0', 'slate blue'],
    ['#A0B0C0', 'powder slate'],
    ['#90A8B8', 'mid slate'],
    // ── Periwinkles ──
    ['#A8A8C0', 'periwinkle'],
    ['#B0B0C8', 'pale periwinkle'],
    ['#9890B0', 'deep periwinkle'],
    // ── Mauves / plums ──
    ['#A088A0', 'mauve'],
    ['#A89098', 'mauve rose'],
    ['#988090', 'dusty plum'],
    ['#B098B0', 'pale mauve'],
    ['#A090A8', 'muted plum'],
    // ── Browns / taupes ──
    ['#A89080', 'warm taupe'],
    ['#988878', 'taupe'],
    ['#A89880', 'walnut'],
    ['#A88870', 'mocha'],
    ['#988070', 'dark mocha'],
];

const N = SWATCHES.length;          // 50
const TOP_RESERVE   = 70;           // header strip
const BOTTOM_RESERVE = 40;
const COL_H = VIEW_H - TOP_RESERVE - BOTTOM_RESERVE; // 1810
const ROW_H = COL_H / N;            // ~36.2
const FIRST_Y = -VIEW_H / 2 + TOP_RESERVE + ROW_H / 2;

const COL_X      = -460;     // left edge of method-name column
const HEX_X      = 110;      // hex code label column
const LABEL_X    = 240;      // human name column

export default makeScene2D(function* (view): ThreadGenerator {
    view.add(<Rect width={VIEW_W} height={VIEW_H} fill={BG} />);

    view.add(<Txt
        text="method colour · 50 tender alternatives"
        fontFamily={F_MONO} fontSize={20} fontWeight={400}
        fill="rgba(244,241,235,0.55)"
        x={0} y={-VIEW_H / 2 + 36}
    />);

    SWATCHES.forEach(([hex, label], i) => {
        const y = FIRST_Y + i * ROW_H;
        // Method name in the candidate colour — the actual swatch.
        view.add(<Txt
            text="sendCartReminder"
            fontFamily={F_MONO} fontSize={24} fontWeight={500}
            fill={hex}
            offsetX={-1} x={COL_X} y={y}
        />);
        // Hex code in the same colour, smaller, to its right.
        view.add(<Txt
            text={hex}
            fontFamily={F_MONO} fontSize={18} fontWeight={400}
            fill={hex}
            offsetX={-1} x={HEX_X} y={y}
        />);
        // Human-readable name in dimmed cream — neutral so it doesn't
        // bias the eye's read of the candidate colour.
        view.add(<Txt
            text={label}
            fontFamily={F_MONO} fontSize={16} fontWeight={400}
            fill="rgba(244,241,235,0.42)"
            offsetX={-1} x={LABEL_X} y={y}
        />);
    });

    yield* waitFor(8);
});
