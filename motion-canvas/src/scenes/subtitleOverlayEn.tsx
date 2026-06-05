import {Node, Txt, makeScene2D} from '@motion-canvas/2d';
import {
    ThreadGenerator,
    createRef,
    easeInCubic,
    easeOutCubic,
    waitFor,
} from '@motion-canvas/core';
import {textWidth} from '../core/utils/textMeasure';

// ─────────────────────────────────────────────────────────────────────
// Subtitle overlay — Reels-style. 2-4 words at a time, each SRT cue
// replacing the last in sync with the voice. Opening-scene look: `// ` +
// body, gold mono, typed on fast. Each card is CENTRED on screen — the
// left edge is pre-placed from the full card width so the finished phrase
// sits at x=0 (it types rightward into a centred slot, no re-centre jitter).
// Punctuation stripped. TRANSPARENT background → PNG render keeps alpha,
// drops onto a DaVinci track at 00:00:00.
//
// Timings baked straight from the DaVinci SRT (final-timeline time, with
// the editing pauses already in it). One card per cue — no grouping.
// ─────────────────────────────────────────────────────────────────────

const F_MONO = '"JetBrains Mono", "Monaspace Argon", monospace';
const ACCENT = '#E8C656'; // opening-scene caption gold

const SUB_FS = 40;
const SUB_FW = 500;
const SUB_Y  = 705; // same baseline as the scene's old caption

interface Cue { t: number; text: string; }

// Each cue = one on-screen card (2-4 words), shown from t until the next
// cue's t. Text is straight from the SRT; punctuation is stripped at draw.
const CUES: Cue[] = [
    {t: 0.458,  text: 'At first glance,'},
    {t: 1.541,  text: 'these functions'},
    {t: 2.000,  text: 'look almost'},
    {t: 2.625,  text: 'identical.'},
    {t: 3.916,  text: 'They render a'},
    {t: 4.375,  text: 'message, send it,'},
    {t: 5.625,  text: 'and track the'},
    {t: 6.166,  text: 'delivery.'},
    {t: 7.416,  text: 'But they belong'},
    {t: 8.000,  text: 'to different'},
    {t: 8.500,  text: 'domains,'},
    {t: 9.708,  text: 'marketing and'},
    {t: 10.500, text: 'security.'},
    {t: 11.958, text: 'And because the'},
    {t: 12.500, text: 'lines look so'},
    {t: 13.125, text: 'similar, the'},
    {t: 13.958, text: 'first instinct is'},
    {t: 15.083, text: 'to merge them.'},
    {t: 16.416, text: 'But that merge'},
    {t: 17.166, text: 'erases what made'},
    {t: 18.000, text: 'them different.'},
    {t: 19.500, text: 'Now the function'},
    {t: 20.083, text: 'needs a flag, a'},
    {t: 21.125, text: 'generic payload,'},
    {t: 22.125, text: 'and branches for'},
    {t: 22.833, text: 'separate rules.'},
    {t: 24.250, text: 'Shorter code,'},
    {t: 25.208, text: 'worse meaning.'},
    {t: 26.916, text: 'Now the three'},
    {t: 27.375, text: 'domains are'},
    {t: 27.833, text: 'coupled, and a'},
    {t: 29.166, text: 'change in one'},
    {t: 29.750, text: 'domain can'},
    {t: 30.625, text: 'quietly'},
    {t: 31.000, text: 'break the other.'},
    {t: 32.750, text: "That's the"},
    {t: 33.125, text: 'warning sign.'},
    {t: 34.375, text: 'If a merged'},
    {t: 34.916, text: 'function needs a'},
    {t: 35.875, text: 'flag to tell'},
    {t: 36.500, text: 'cases apart, the'},
    {t: 37.833, text: 'abstraction came'},
    {t: 38.541, text: 'too early.'},
];
const END = 39.083;

// Drop sentence punctuation, force lowercase; keep apostrophes (inside words).
const clean = (s: string): string =>
    s.replace(/[.,;:!?"]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

function* awaitFontsReady(): ThreadGenerator {
    if (typeof document === 'undefined') return;
    try {
        document.fonts.load(`500 40px "JetBrains Mono"`);
        document.fonts.load(`400 40px "JetBrains Mono"`);
    } catch {}
    for (let i = 0; i < 60; i++) {
        if (document.fonts.check(`500 40px "JetBrains Mono"`)) return;
        yield* waitFor(0.05);
    }
}

export default makeScene2D(function* (view) {
    yield* awaitFontsReady();

    const line = createRef<Node>();
    const body = createRef<Txt>();

    view.add(
        <Node ref={line} opacity={0}>
            <Txt
                ref={body} text=""
                fontFamily={F_MONO} fontSize={SUB_FS} fontWeight={SUB_FW}
                fill={ACCENT} offset={[-1, 0]} y={SUB_Y}
            />
        </Node>,
    );

    // Manual scene clock so every card lands at its absolute SRT time.
    let clock = 0;
    function* wait(d: number): ThreadGenerator {
        if (d <= 1e-4) return;
        yield* waitFor(d);
        clock += d;
    }
    function* waitUntil(t: number): ThreadGenerator {
        yield* wait(t - clock);
    }
    function* fade(to: number, d: number, ease = easeOutCubic): ThreadGenerator {
        yield* line().opacity(to, d, ease);
        clock += d;
    }
    // Fast typewriter for one card. `// ` shows at once; the words type in.
    // Left edge is pre-placed from the FULL width so the finished card is
    // centred on x=0 (types rightward into place — no per-char re-centring).
    function* typeCard(word: string, slot: number): ThreadGenerator {
        const prefix = '// ';
        const full = prefix + word;
        const w = textWidth(full, F_MONO, SUB_FS, SUB_FW);
        body().x(-w / 2);
        body().text(prefix);
        const n = word.length;
        if (n <= 0) return;
        const delay = Math.min(0.026, Math.max(0.010, (slot * 0.5) / n));
        for (let i = 1; i <= n; i++) {
            body().text(prefix + word.substring(0, i));
            yield* wait(delay);
        }
    }

    yield* waitUntil(CUES[0].t - 0.15);
    yield* fade(1, 0.15);

    for (let i = 0; i < CUES.length; i++) {
        yield* waitUntil(CUES[i].t);
        const slotEnd = i + 1 < CUES.length ? CUES[i + 1].t : END;
        yield* typeCard(clean(CUES[i].text), slotEnd - CUES[i].t);
    }

    yield* waitUntil(END);
    yield* fade(0, 0.3, easeInCubic);
    yield* waitFor(0.4);
});
