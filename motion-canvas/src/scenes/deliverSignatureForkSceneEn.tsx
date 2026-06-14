import {Node, Rect, Txt, blur, makeScene2D} from '@motion-canvas/2d';
import {
    ThreadGenerator,
    all,
    chain,
    createSignal,
    easeInOutCubic,
    easeOutCubic,
    waitFor,
} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {CodeLine} from '../core/code/components/CodeLine';
import {SyntaxTheme} from '../core/code/model/SyntaxTheme';
import {applyBackground} from '../core/utils';
import {textWidth} from '../core/utils/textMeasure';
import {getCodePaddingX} from '../core/code/shared/TextMeasure';

// ════════════════════════════════════════════════════════════════════════
//  ONE SIGNATURE → EIGHT FUNCTIONS
//  Replaces the radar/orbit/counter viz. The thesis is carried by NOTHING but
//  signature strings: deliver(dryRun, forceSend, isRetry) is ONE Manticore
//  block, morphed never replaced, that doubles 1 → 2 → 4 → 8. Each doubling
//  resolves exactly one boolean param (order: dryRun, forceSend, isRetry): the
//  param NAME's slot SPINS like a reel through false/true and locks on a value,
//  while the new branch types in below. The honest-zoom pull-back (the
//  block shrinks 1.9 → 1.4 → 1.0 → 0.66 as it grows) is the visual proof the
//  function got 8× denser — the motion IS the math, not a decorative loop.
//  The held final is 8 tabular deliver(...) strings in one calm hue: a truth
//  table that was never drawn as a table.
// ════════════════════════════════════════════════════════════════════════

const F_MONO = '"JetBrains Mono", "Monaspace Argon", monospace';

// Background = the canon applyBackground: a vertical gradient #0B0C10 (top) →
// #12141A (bottom) WITH a faint warm radial spotlight composited on top (same
// as the chapter title scenes). The reel-slot mask must reproduce this EXACT
// composite at its own world point — gradient slice + spotlight lift — or it
// reads as a darker, cooler patch (the gradient alone undershoots the warm
// spotlight by ~10 levels).
const BG_TOP: [number, number, number] = [0x0b, 0x0c, 0x10];
const BG_BOT: [number, number, number] = [0x12, 0x14, 0x1a];
const SCREEN_W = 1920;
const SCREEN_H = 1080;
const SPOT_CX = SCREEN_W * 0.12;   // spotlight centre, matches applyBackground
const SPOT_CY = -SCREEN_H * 0.12;
const SPOT_R = SCREEN_W * 0.95;
const SPOT_WARM: [number, number, number] = [246, 231, 212];
const SPOT_A = 0.045;              // peak spotlight alpha at its centre
function bgColorAt(worldX: number, worldY: number): string {
    if (!Number.isFinite(worldX)) worldX = 0;
    if (!Number.isFinite(worldY)) worldY = 0;
    const t = Math.min(1, Math.max(0, (worldY + SCREEN_H / 2) / SCREEN_H));
    const gr = BG_TOP[0] + (BG_BOT[0] - BG_TOP[0]) * t;
    const gg = BG_TOP[1] + (BG_BOT[1] - BG_TOP[1]) * t;
    const gb = BG_TOP[2] + (BG_BOT[2] - BG_TOP[2]) * t;
    const d = Math.hypot(worldX - SPOT_CX, worldY - SPOT_CY);
    const a = SPOT_A * (1 - Math.min(1, d / SPOT_R));   // source-over warm lift
    const r = Math.round(gr + (SPOT_WARM[0] - gr) * a);
    const g = Math.round(gg + (SPOT_WARM[1] - gg) * a);
    const b = Math.round(gb + (SPOT_WARM[2] - gb) * a);
    return `rgb(${r}, ${g}, ${b})`;
}

const INK = '#E7E1D6';   // bone — the param NAMES (the bright knobs)
const KEY = '#CAB4EA';   // the ONE calm value hue for every true/false
const METH = '#8E8EA8';  // 'deliver' — recessive cool BLUE-GREY, the same cool
                         // family as the punctuation (deliver IS syntax). Neutral
                         // R=G with a blue lift (no teal cast like the old
                         // #8E97A8, no warmth), sits on the cool axis with the
                         // lavender literals so the whole palette reads as one.
const PUNC = '#5E6678';  // commas / parens — the most recessive structure

// Three muted per-flag identity hues. TRANSIENT only — they appear at the
// instant a boolean arms + forks, then the param is gone. Never a held colour.
const C_DRYRUN = '#7AC9C9';     // teal
const C_FORCESEND = '#E0BB6A';  // amber
const C_ISRETRY = '#F08A8A';    // pink

const THEME: SyntaxTheme = {
    keyword: INK,
    type: KEY,
    string: INK,
    number: INK,
    operator: PUNC,
    punctuation: PUNC,
    method: METH,
    comment: 'rgba(231,225,214,0.50)',
    annotation: INK,
    constant: KEY,
    plain: INK,
};

// Colour hierarchy applied as tokens build: literals → KEY, deliver → recessive
// METH (belt-and-suspenders in case it isn't tagged 'method'). Match on text.
const RULES: ColorRule[] = [
    {match: /^(true|false)$/, color: KEY},
    {match: /^deliver$/, color: METH},
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

// ── Signature builder ────────────────────────────────────────────────────
// Each cell is either a resolved boolean (→ literal) or an unresolved param
// NAME. Inner columns stay tabular by padding the separator (`true` gets two
// trailing spaces, `false` one) so commas + field-starts column-align. The
// LAST column is never padded — nothing must sit between a literal and the
// closing `)`.
const LIT_W = 5; // 'false'
function cell(v: boolean | string, last: boolean): string {
    if (typeof v === 'boolean') {
        const s = v ? 'true' : 'false';
        const pad = ' '.repeat(LIT_W - s.length);
        return last ? s : s + ',' + pad + ' ';
    }
    return last ? v : v + ', ';
}
function mk(a: boolean | string, b: boolean | string, c: boolean | string): string {
    return `deliver(${cell(a, false)}${cell(b, false)}${cell(c, true)})`;
}

// The four states. Ordering is engine-aware: morphTo pairs lines positionally,
// so each doubling keeps the surviving lines FIRST (only their newly-resolved
// column changes — kept columns stay pinned, no diagonal creep) and appends the
// new branch below. The final grid falls out as a clean binary counter:
//   dryRun  = F T F T F T F T  (alternates every row)
//   force   = F F T T F F T T
//   isRetry = F F F F T T T T  (the midline split)
const S1 = mk('dryRun', 'forceSend', 'isRetry');
const S2 = [mk(false, 'forceSend', 'isRetry'), mk(true, 'forceSend', 'isRetry')].join('\n');
const S4 = [
    mk(false, false, 'isRetry'),
    mk(true, false, 'isRetry'),
    mk(false, true, 'isRetry'),
    mk(true, true, 'isRetry'),
].join('\n');
const S8_ORDER: [boolean, boolean, boolean][] = [];
for (const r of [false, true]) for (const f of [false, true]) for (const d of [false, true]) S8_ORDER.push([d, f, r]);
const S8 = S8_ORDER.map(([d, f, r]) => mk(d, f, r)).join('\n');

// ── Sizing / camera ──────────────────────────────────────────────────────
const FS = 40;
const LH = 64;
const HERO = 1.9; // one enormous line; it shrinks as the count doubles
const LEFT_LOCAL = -1100 / 2 + getCodePaddingX(FS);
const widthOf = (code: string): number =>
    Math.max(...code.split('\n').map(l => textWidth(l, F_MONO, FS)));
const centerX = (code: string, scale: number): number => -(LEFT_LOCAL + widthOf(code) / 2) * scale;
// World vertical centre of an n-line block (line 0 sits at content y=0; the
// block grows downward, container eases up — net centre stays on y=0).
const centerY = (n: number, scale: number): number => -((n - 1) / 2) * LH * scale;

// No flashRemoved* here: the param name is removed via a custom DISSOLVE (see
// fork()), not the engine's backspace/flash. The literal still writes in with
// the house typewriter — canon for new code ("green typing").
const TYPE = {
    addStyle: 'typewriter' as const,
    charDelay: 0.025,
    moveDuration: 0.5,
    removeDuration: 0.2,
    blockOrder: 'parallel' as const,
    lineOrder: 'parallel' as const,
    scrollStrategy: 'block' as const,
    tokenSlideDuration: 0,
};

// Hierarchy lives in COLOUR, not opacity: param NAMES bone-bright, literal
// values KEY, the deliver wrapper + punctuation recessive. Every token is BORN
// its final colour (theme + rules, applied before it types in), so nothing
// changes brightness after the morph — no dim-snap on the new lines.
function paint(fn: Manticore): void {
    fn.colorize(RULES);
}

// recolorLine hook for the fork morph: the morph re-types the resolving literal
// as a FRESH 'false' token (still text '' / opacity 0 at this point, just before
// the typewriter). We paint it transparent so the morph never shows it — the
// value-ROLL is the only `false` the eye sees, so there's no double. After the
// morph, paint() recolours it KEY and it takes over from the roll, already in
// place. Identify the new token by its still-empty ref text; kept literals from
// earlier forks already read 'false'.
function hideMorphedFalse(cl: CodeLine): void {
    for (const td of cl.tokens) {
        if (td.text === 'false' && td.ref().text() === '') {
            td.ref().fill('rgba(0,0,0,0)');
        }
    }
}

const ROLL_DUR = 0.5; // a single, quick value-roll into place — not a spin

function* awaitFontsReady(): ThreadGenerator {
    if (typeof document === 'undefined') return;
    try {
        document.fonts.load(`400 ${FS}px "JetBrains Mono"`);
        document.fonts.load(`500 ${FS}px "JetBrains Mono"`);
    } catch {}
    for (let i = 0; i < 60; i++) {
        if (document.fonts.check(`400 ${FS}px "JetBrains Mono"`)) return;
        yield* waitFor(0.05);
    }
}

export default makeScene2D(function* (view) {
    yield* awaitFontsReady();
    applyBackground(view);

    const fn = Manticore.create(S1, {
        x: 20, y: 0, width: 1100,
        fontSize: FS, lineHeight: LH, fontFamily: F_MONO,
        theme: THEME, cardStyle: FLAT_CARD, glowAccent: false, noClip: true, customTypes: [],
    });
    fn.mount(view);
    paint(fn);

    const fnBlur = createSignal(10);
    fn.node.filters(() => [blur(fnBlur())]);
    fn.node.opacity(0);
    fn.node.scale(HERO);
    fn.node.x(centerX(S1, HERO));
    fn.node.y(centerY(1, HERO));

    const CW = textWidth('0', F_MONO, FS);   // mono advance (runtime — needs fonts)
    const REEL_W = 5 * CW + 8;               // slot window: fits 'false' + a margin

    // A single value-roll for one slot: the literal scrolls UP into a line-tall
    // transparent clip window and stops. ONE move — the value rolls onto the slot
    // the name held, no spin. There is NO backing fill: the surviving line's
    // resolving token is pre-set to the kept literal at opacity 0 (see fork), so
    // the morph never types a competing literal here — nothing to mask, no patch.
    // Built at the resolving token's local x inside the line, so it rides the
    // honest-zoom camera.
    function makeRoll(slotX: number, value: string): {node: Rect; roll: () => ThreadGenerator} {
        const content = new Node({x: -REEL_W / 2, y: LH});
        content.add(new Txt({
            text: value, fontFamily: F_MONO, fontSize: FS, offset: [-1, 0],
            x: 0, y: 0, fill: KEY,
        }));
        const node = new Rect({
            width: REEL_W, height: LH, x: slotX + REEL_W / 2, y: 0, clip: true,
        });
        node.add(content);
        function* roll(): ThreadGenerator {
            yield* content.y(0, ROLL_DUR, easeOutCubic);
        }
        return {node, roll};
    }

    // Light the param NAME on every current line to its identity hue + a soft
    // glow swell — "this boolean is about to divide". Transient: the fork that
    // follows erases the armed name, so the glow is never a held state.
    function* arm(name: string, hue: string, glow: string, dur = 0.45): ThreadGenerator {
        const ops: ThreadGenerator[] = [];
        for (let i = 0; i < fn.lineCount; i++) {
            const t = fn.getLine(i)?.tokens.find(tk => tk.text === name)?.ref();
            if (!t) continue;
            t.shadowColor(glow);
            t.shadowOffset([0, 0]);
            ops.push(t.fill(hue, dur, easeOutCubic));
            ops.push(t.shadowBlur(8, dur, easeOutCubic));
        }
        yield* all(...ops);
    }

    // One doubling. On every surviving line the resolving param NAME resolves to
    // `false` (the kept branch) via a single value-ROLL. The morph still re-types
    // that `false`, but `hideMorphedFalse` (recolorLine) paints the morph's copy
    // transparent, so the roll is the only `false` visible — no double. When the
    // roll lands we drop it and paint() recolours the morph's copy KEY, already
    // sitting in the exact spot. Meanwhile the new `true` branch types in below
    // and the camera pulls back (scale + x + y), all coupled.
    function* fork(code: string, n: number, scale: number, name: string, dur: number): ThreadGenerator {
        const slots: Rect[] = [];
        const rolls: ThreadGenerator[] = [];
        for (let i = 0; i < fn.lineCount; i++) {
            const line = fn.getLine(i);
            const td = line?.tokens.find(tk => tk.text === name);
            if (!line || !td) continue;
            td.ref().opacity(0);             // hide the armed name; the roll takes over
            const r = makeRoll(td.localX, 'false');
            r.node.y(fn.getLineY(i));
            fn.addToContent(r.node);
            slots.push(r.node);
            rolls.push(r.roll());
        }
        yield* all(
            ...rolls,
            fn.morphTo(code, {...TYPE, recolorLine: hideMorphedFalse}),
            fn.node.scale(scale, dur, easeInOutCubic),
            fn.node.x(centerX(code, scale), dur, easeInOutCubic),
            fn.node.y(centerY(n, scale), dur, easeInOutCubic),
        );
        for (const s of slots) s.remove();   // drop the roll overlay
        paint(fn);                            // reveals the morph's false (rules → KEY)
    }

    // B0 — the hero signature racks into focus, alone and large. A name is a
    // promise: one honest function, three named knobs.
    yield* all(fn.node.opacity(1, 0.8, easeOutCubic), fnBlur(0, 0.8, easeOutCubic));
    yield* waitFor(1.0);

    // B1·B2 — dryRun arms (teal), then 1 → 2.
    yield* arm('dryRun', C_DRYRUN, 'rgba(122,201,201,0.30)');
    yield* waitFor(0.3);
    yield* fork(S2, 2, 1.5, 'dryRun', 0.9);
    yield* waitFor(0.5);

    // B3·B4 — forceSend arms (amber), then 2 → 4.
    yield* arm('forceSend', C_FORCESEND, 'rgba(224,187,106,0.30)', 0.4);
    yield* waitFor(0.3);
    yield* fork(S4, 4, 1.2, 'forceSend', 0.95);
    yield* waitFor(0.5);

    // B5·B6 — isRetry arms (pink), then 4 → 8. The last axis takes it home.
    // Final scale held larger (0.95) so the eight-row truth table reads big, not
    // cramped — still smaller than the 4-row block (1.2), so the honest-zoom
    // pull-back keeps its ~0.8-per-step pacing all the way down.
    yield* arm('isRetry', C_ISRETRY, 'rgba(240,138,138,0.30)', 0.4);
    yield* waitFor(0.3);
    yield* fork(S8, 8, 0.95, 'isRetry', 1.0);

    // B7 — the held ledger reads for a beat: eight concrete functions, one hue.
    yield* waitFor(1.0);

    // B7b — COLOUR PASS. The param names are gone, but each value column still
    // IS one of the three booleans. Their arm hues return in a wave that runs
    // L→R across the columns — dryRun teal, forceSend amber, isRetry pink —
    // naming the three levers that generated all eight rows by colour alone.
    // Then it settles back to the one calm hue: the levers named, the table calm.
    const AXIS = [C_DRYRUN, C_FORCESEND, C_ISRETRY];
    const cols: Txt[][] = [[], [], []];
    for (let i = 0; i < fn.lineCount; i++) {
        const lits = fn.getLine(i)!.tokens.filter(t => t.text === 'true' || t.text === 'false');
        lits.slice(0, 3).forEach((t, c) => cols[c].push(t.ref()));
    }
    yield* all(
        ...cols.flatMap((col, c) =>
            col.map(ref => chain(waitFor(c * 0.16), ref.fill(AXIS[c], 0.35, easeOutCubic))),
        ),
    );
    yield* waitFor(0.7);
    yield* all(...cols.flat().map(ref => ref.fill(KEY, 0.6, easeInOutCubic)));
    yield* waitFor(0.5);

    // B8 — rack-out. The exact entrance move reversed: the block softens out of
    // focus (blur 0 → 10) and dims to nothing in one slow breath. No drift, no
    // wipe — the ledger simply settles back into the dark it rose from. Verified
    // at its midpoint (opacity 0.45 / blur 5): all eight lines defocus as one.
    yield* all(
        fn.node.opacity(0, 1.2, easeInOutCubic),
        fnBlur(10, 1.2, easeInOutCubic),
    );
    yield* waitFor(0.4);
});
