import {Gradient, Node, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
    ThreadGenerator,
    createRef,
    easeInCubic,
    easeOutCubic,
    waitFor,
} from '@motion-canvas/core';

// ─────────────────────────────────────────────────────────────────────
// Subtitle overlay — Reels-style. 2-4 words at a time, each SRT cue
// replacing the last in sync with the voice.
//
// Built exactly like the scene's own caption: a STATIC `// ` pinned at a
// fixed x, and a body typed on to its right at a fixed x. The slashes never
// move — only the body changes. Gold mono, lowercase, punctuation stripped.
// TRANSPARENT background → PNG render keeps alpha, drops onto a DaVinci
// track at 00:00:00.
//
// Timings baked straight from the DaVinci SRT (final-timeline time, with
// the editing pauses already in it). One card per cue — no grouping.
// ─────────────────────────────────────────────────────────────────────

const F_MONO = '"JetBrains Mono", "Monaspace Argon", monospace';
const ACCENT = '#E8C656'; // opening-scene caption gold

const VIEW_W  = 1080;
const SUB_FS  = 40;
const SUB_FW  = 500;
const SUB_X   = -300; // fixed slashes left edge — same idea as the scene (shifted 50 left)
const SLASH_W = 72;   // advance of "// " at this size; body starts here
const SUB_Y   = 705;  // same baseline as the scene's old caption
const SCRIM_H = 160;  // feathered backing height (#151A28) — masks code that drifts into the line

interface Cue { t: number; text: string; }

// Each cue = one on-screen card, shown from t until the next cue's t.
// Re-chunked from the raw SRT into natural reading units: phrases that read
// as a whole and NEVER end on an orphan article/preposition/conjunction
// (a / the / and / to / for / so / is …). Words are reflowed across the SRT's
// timestamp grid, so each card still lands on the voice (text may lead it by
// a beat — that reads naturally). Punctuation is stripped at draw.
const CUES: Cue[] = [
    // At first glance, these functions look almost identical.
    {t: 0.458,  text: 'At first glance'},
    {t: 1.541,  text: 'these functions'},
    {t: 2.000,  text: 'look almost identical'},
    // They render a message, send it, and track the delivery.
    {t: 3.916,  text: 'they render a message'},
    {t: 4.375,  text: 'send it'},
    {t: 5.625,  text: 'and track the delivery'},
    // But they belong to different domains, marketing and security.
    {t: 7.416,  text: 'but they belong'},
    {t: 8.000,  text: 'to different domains'},
    {t: 9.708,  text: 'marketing and security'},
    // And because the lines look so similar, the first instinct is to merge them.
    {t: 11.958, text: 'and because the lines'},
    {t: 12.500, text: 'look so similar'},
    {t: 13.958, text: 'the first instinct'},
    {t: 15.083, text: 'is to merge them'},
    // But that merge erases what made them different.
    {t: 16.416, text: 'but that merge'},
    {t: 17.166, text: 'erases what made'},
    {t: 18.000, text: 'them different'},
    // Now the function needs a flag, a generic payload, and branches for separate rules.
    {t: 19.500, text: 'now the function'},
    {t: 20.083, text: 'needs a flag'},
    {t: 21.125, text: 'a generic payload'},
    {t: 22.125, text: 'and branches'},
    {t: 22.833, text: 'for separate rules'},
    // Shorter code, worse meaning.
    {t: 24.250, text: 'shorter code'},
    {t: 25.208, text: 'worse meaning'},
    // Now the three domains are coupled, and a change in one domain can quietly break the other.
    {t: 26.916, text: 'now the three domains'},
    {t: 27.833, text: 'are coupled'},
    {t: 29.166, text: 'and a change'},
    {t: 29.750, text: 'in one domain'},
    {t: 30.625, text: 'can quietly break the other'},
    // That's the warning sign.
    {t: 32.750, text: "that's the warning sign"},
    // If a merged function needs a flag to tell cases apart, the abstraction came too early.
    {t: 34.375, text: 'if a merged function'},
    {t: 34.916, text: 'needs a flag'},
    {t: 35.875, text: 'to tell cases apart'},
    {t: 37.833, text: 'the abstraction came'},
    {t: 38.541, text: 'too early'},
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
            {/* Feathered backing in the scene bg colour (#151A28 = rgb 21,26,40). Over the
                scene's flat bg it is invisible; where code drifts into the caption band it
                masks it. Soft top/bottom edges → no hard rectangle. Behind the text. */}
            <Rect
                width={VIEW_W} height={SCRIM_H} y={SUB_Y}
                fill={new Gradient({
                    type: 'linear',
                    from: [0, -SCRIM_H / 2], to: [0, SCRIM_H / 2],
                    stops: [
                        {offset: 0,    color: 'rgba(21, 26, 40, 0)'},
                        {offset: 0.26, color: 'rgba(21, 26, 40, 1)'},
                        {offset: 0.74, color: 'rgba(21, 26, 40, 1)'},
                        {offset: 1,    color: 'rgba(21, 26, 40, 0)'},
                    ],
                })}
            />
            <Txt
                text="// "
                fontFamily={F_MONO} fontSize={SUB_FS} fontWeight={SUB_FW}
                fill={ACCENT} offset={[-1, 0]} x={SUB_X} y={SUB_Y}
            />
            <Txt
                ref={body} text=""
                fontFamily={F_MONO} fontSize={SUB_FS} fontWeight={SUB_FW}
                fill={ACCENT} offset={[-1, 0]} x={SUB_X + SLASH_W} y={SUB_Y}
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
    // Fast typewriter for one card. Slashes stay put; only the body types.
    function* typeCard(word: string, slot: number): ThreadGenerator {
        body().text('');
        const n = word.length;
        if (n <= 0) return;
        const delay = Math.min(0.026, Math.max(0.010, (slot * 0.5) / n));
        for (let i = 1; i <= n; i++) {
            body().text(word.substring(0, i));
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
