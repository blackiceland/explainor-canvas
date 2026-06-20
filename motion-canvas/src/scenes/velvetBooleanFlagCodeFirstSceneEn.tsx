import {Img, Node, Rect, Txt, blur, makeScene2D} from '@motion-canvas/2d';
import {
    Reference,
    ThreadGenerator,
    all,
    createRef,
    createSignal,
    easeInCubic,
    easeInOutCubic,
    easeOutCubic,
    sequence,
    waitFor,
} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {SyntaxTheme} from '../core/code/model/SyntaxTheme';
import {textWidth} from '../core/utils/textMeasure';
import {getCodePaddingX} from '../core/code/shared/TextMeasure';

const F_SERIF = 'Newsreader, EB Garamond, serif';
const F_MONO  = '"JetBrains Mono", "Monaspace Argon", monospace';

const VIEW_W = 1080;
const VIEW_H = 1920;

const BG       = '#151A28';
const INK      = '#E7E1D6';
const KEY      = '#CAB4EA';
const DOMAIN   = '#8AC7EF';   // methods (savePost, publishPost, saveDraft)
const TYPE_CLR = 'rgba(213, 209, 245, 0.92)';   // types (Post, boolean, string…)
const STRING   = '#A8CF98';
const PUNC     = '#D2D8E2';
const OPERATOR = '#8F9AAA';
const HERO     = '#E7E1D6';
const ACCENT   = '#E8C656';
const QUIET    = 'rgba(231, 225, 214, 0.50)';
const DIM_OP   = 0.22;

const CODE_X = 20;

const THEME: SyntaxTheme = {
    keyword:     INK,
    type:        DOMAIN,
    string:      STRING,
    number:      INK,
    operator:    OPERATOR,
    punctuation: PUNC,
    method:      INK,
    comment:     QUIET,
    annotation:  INK,
    constant:    DOMAIN,
    plain:       INK,
};

const RULES: ColorRule[] = [
    {match: /^(function|const|let|var|return|if|else)$/, color: KEY},
    {match: /^(true|false)$/, color: KEY},
    {match: /^(boolean|string|number|Post)$/, color: TYPE_CLR},   // Post is a type → type colour, not method blue
    {match: /^(savePost|publishPost|saveDraft|db)$/, color: DOMAIN},
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

// ── Code states ──────────────────────────────────────────────────────
// The cold open: a method name with parens, alone — a promise of what it does.
const NAME_ONLY = `savePost()`;

// One parameter resolves inside the parens. Still honest: a post, fully typed.
const SIGNATURE = `savePost(post: Post)`;

// One boolean, typed in as a foreign element the name never accounted for.
const SIGNATURE_FLAG = `savePost(post: Post, publish: boolean)`;

// The body the name hides: save means write a draft — unless the flag is set,
// and then it doesn't save, it publishes, live to everyone. The signature keeps
// its types (matches SIGNATURE_FLAG); no `function` keyword — the hero is the
// bare name, every morph keeps its left edge, reads as a method.
const CODE_FLAG = `savePost(post: Post, publish: boolean) {
    if (publish) {
        return publishPost(post)
    }

    return saveDraft(post)
}`;

// ── Code block helpers (house style: theme + rules + glow + weight) ───
type BlockOpts = {
    code: string; x?: number; y: number;
    width?: number; fontSize?: number; lineHeight?: number; noClip?: boolean;
};

function makeBlock(o: BlockOpts): Manticore {
    return Manticore.create(o.code, {
        x: o.x ?? CODE_X, y: o.y,
        width: o.width ?? 1040,
        fontSize: o.fontSize ?? 32,
        lineHeight: o.lineHeight ?? 46,
        fontFamily: F_MONO,
        theme: THEME,
        cardStyle: FLAT_CARD,
        glowAccent: false,
        noClip: o.noClip ?? false,
    });
}

function bumpWeight(block: Manticore, weight: number): void {
    for (let i = 0; i < block.lineCount; i++) {
        const line = block.getLine(i);
        if (!line) continue;
        for (const tokenData of line.tokens) tokenData.ref().fontWeight(weight);
    }
}

function applyGlow(block: Manticore): void {
    const glowMap: Record<string, string> = {
        [KEY]:    'rgba(202, 180, 234, 0.13)',
        [DOMAIN]: 'rgba(138, 199, 239, 0.13)',
        [STRING]: 'rgba(168, 207, 152, 0.13)',
    };
    for (let i = 0; i < block.lineCount; i++) {
        const line = block.getLine(i);
        if (!line) continue;
        for (const tokenData of line.tokens) {
            const node = tokenData.ref();
            const glow = glowMap[String(node.fill())];
            if (glow) {
                node.shadowColor(glow); node.shadowBlur(8); node.shadowOffset([0, 0]);
            } else {
                node.shadowColor('rgba(0, 0, 0, 0.30)'); node.shadowBlur(6); node.shadowOffset([0, 1]);
            }
        }
    }
}

function dressBlock(block: Manticore): void {
    bumpWeight(block, 500);
    block.colorize(RULES);
    applyGlow(block);
}

// Spotlight a set of lines in one block: the kept lines stay lit, the rest dim.
function* spotlight(block: Manticore, keep: number[], dur = 0.4): ThreadGenerator {
    const ops: ThreadGenerator[] = [];
    for (let i = 0; i < block.lineCount; i++) {
        const line = block.getLine(i);
        if (line) ops.push(line.setOpacity(keep.includes(i) ? 1 : DIM_OP, dur));
    }
    if (ops.length) yield* all(...ops);
}

// ── Publish record — a raised DARK surface in the same world as the bg/code ─────────
// Anton rejected both the bright "plastic" slab AND the fully-flat borderless record;
// he wants EDGES + a SHADOW but still minimal & not plastic. So: keep the dark cool-navy
// world (#151A28 ground, warm-cream voice, desaturated pastels), but lift the record onto
// a real SURFACE — a flat panel a hair lighter than the bg, a crisp hairline EDGE, and a
// restrained two-layer shadow. Dark + flat + minimal (no gloss, no gradient dome, no big
// radius) = a Linear/Vercel dark surface, not a plastic card. The post IDENTITY (title +
// mono slug) is FIXED; only its STATE moves. MONOCHROME cream/grey in Draft; the single
// moment of colour on Publish is the code's OWN string-green (#A8CF98).
const DCARD_W = 680;
const RAD = 20;                            // modest radius (not a rounded plastic card)
const PUB_GREEN = STRING;                  // published accent = the code's string green
const SURFACE = '#1B2132';                 // panel fill — a hair lighter than the #151A28 bg
const SURFACE_EDGE = 'rgba(231,225,214,0.17)';   // the hairline EDGE — strong enough to read at
                                                 // low phone brightness (cream contrast survives)

// The publish record = a SOCIAL feed post (LinkedIn/X register) on the dark surface:
// sender AVATAR + name + @handle header, the post BODY as the content, then the
// visibility line + toggle. Clean composition — no divider rule, even rhythm.
function buildDraftCard(): {
    node: Reference<Node>; ambient: Reference<Rect>; panel: Reference<Rect>;
    status: Reference<Node>; statusDot: Reference<Rect>; statusLabel: Reference<Txt>;
    visibility: Reference<Txt>;
    track: Reference<Rect>; knob: Reference<Rect>;
    jsx: any;
} {
    const node        = createRef<Node>();
    const ambient     = createRef<Rect>();
    const panel       = createRef<Rect>();
    const status      = createRef<Node>();
    const statusDot   = createRef<Rect>();
    const statusLabel = createRef<Txt>();
    const visibility  = createRef<Txt>();
    const track       = createRef<Rect>();
    const knob        = createRef<Rect>();
    const PAD = 44;
    const L = -DCARD_W / 2 + PAD;   // -296  left rail
    const R =  DCARD_W / 2 - PAD;   //  296  right rail
    const COL = DCARD_W - PAD * 2;  //  592  column width
    const togW = 92;
    const togH = 52;
    const knobR = 21;
    const knobX = togW / 2 - knobR - 5;   // 20  (OFF = -knobX, ON = +knobX)
    const STAT_FS = 27;
    const STAT_DOT = 12;
    const pubW = Math.ceil(textWidth('PUBLISHED', F_MONO, STAT_FS));
    const dotX = R - pubW - 22;
    const H = 388;

    // shared surface wrapper (ambient caster + dark panel); content differs per variant
    const surface = (children: any): any => (
        <Node ref={node}>
            <Rect ref={ambient} width={DCARD_W} height={H} radius={RAD}
                fill={BG} shadowColor="rgba(0,0,0,0.58)" shadowBlur={2} shadowOffset={[0, 6]} />
            <Rect ref={panel} width={DCARD_W} height={H} radius={RAD}
                fill={SURFACE} stroke={SURFACE_EDGE} lineWidth={1}
                shadowColor="rgba(0,0,0,0.45)" shadowBlur={2} shadowOffset={[0, 2]}>
                {children}
            </Rect>
        </Node>
    );

    // Initial state is PUBLISHED (top branch — publishPost — is read first); the
    // flip in Phase 2 reverses it back to draft.
    const statusCluster = (y: number): any => (
        <Node ref={status} y={y}>
            <Rect ref={statusDot} width={STAT_DOT} height={STAT_DOT} radius={STAT_DOT / 2} x={dotX} y={2}
                fill={PUB_GREEN} />
            <Txt ref={statusLabel} text="PUBLISHED" fontFamily={F_MONO} fontSize={STAT_FS} fontWeight={500}
                letterSpacing={1.6} fill={INK} offset={[-1, 0]} x={dotX + STAT_DOT + 11} y={0} />
        </Node>
    );

    const toggle = (y: number): any => (
        <Rect ref={track} width={togW} height={togH} radius={togH / 2} x={R - togW / 2} y={y}
            fill="rgba(168,207,152,0.85)" stroke="rgba(168,207,152,0.55)" lineWidth={1.5}>
            <Rect ref={knob} width={knobR * 2} height={knobR * 2} radius={knobR} x={knobX} y={0}
                fill="rgba(231,225,214,0.85)" />
        </Rect>
    );

    const jsx = surface(<>
        {/* sender avatar (cropped face) + name + @handle; status top-right */}
        <Rect width={68} height={68} radius={34} x={L + 34} y={-112}
            fill="rgba(231,225,214,0.10)" stroke="rgba(231,225,214,0.20)" lineWidth={1} clip>
            <Img src="/avatar-anna.jpg" width={68} height={68} />
        </Rect>
        <Txt text="Anna Petrova" fontFamily={F_SERIF} fontSize={30} fontWeight={500}
            fill={INK} offset={[-1, 0]} x={L + 100} y={-126} />
        <Txt text="@anna · 5h" fontFamily={F_MONO} fontSize={20} fontWeight={450}
            fill="rgba(231,225,214,0.58)" offset={[-1, 0]} x={L + 100} y={-96} />
        {statusCluster(-112)}

        {/* post body — the content; clean, no divider rule beneath it */}
        <Txt text="Just shipped our Getting Started guide." fontFamily={F_SERIF} fontSize={27} fontWeight={400}
            fill="rgba(231,225,214,0.82)" offset={[-1, 0]} x={L} y={-30} />
        <Txt text="Set up your workspace and ship your" fontFamily={F_SERIF} fontSize={27} fontWeight={400}
            fill="rgba(231,225,214,0.82)" offset={[-1, 0]} x={L} y={6} />
        <Txt text="first change in minutes." fontFamily={F_SERIF} fontSize={27} fontWeight={400}
            fill="rgba(231,225,214,0.82)" offset={[-1, 0]} x={L} y={42} />

        {/* visibility line + flat toggle */}
        <Txt ref={visibility} text="Live · anyone can see this" fontFamily={F_MONO} fontSize={23} fontWeight={450}
            fill="rgba(231,225,214,0.72)" offset={[-1, 0]} x={L} y={120} />
        {toggle(120)}
    </>);
    return {node, ambient, panel, status, statusDot, statusLabel, visibility, track, knob, jsx};
}

// Crossfade a Txt to new copy in place — used on the flip for the visibility line.
function* retext(node: Txt, text: string): ThreadGenerator {
    yield* node.opacity(0, 0.18, easeInCubic);
    node.text(text);
    yield* node.opacity(1, 0.3, easeOutCubic);
}

// retext that also eases the fill on the way back in — the pill word going "live".
function* retextColored(node: Txt, text: string, finalFill: string): ThreadGenerator {
    yield* node.opacity(0, 0.18, easeInCubic);
    node.text(text);
    yield* all(
        node.opacity(1, 0.3, easeOutCubic),
        node.fill(finalFill, 0.3, easeOutCubic),
    );
}

function* awaitFontsReady(): ThreadGenerator {
    if (typeof document === 'undefined') return;
    try {
        document.fonts.load(`400 32px "JetBrains Mono"`);
        document.fonts.load(`500 32px "JetBrains Mono"`);
        document.fonts.load(`400 120px "Newsreader"`);
        document.fonts.load(`500 46px "Newsreader"`);
        document.fonts.load(`italic 400 120px "Newsreader"`);
    } catch {}
    for (let i = 0; i < 60; i++) {
        if (document.fonts.check(`400 32px "JetBrains Mono"`)) return;
        yield* waitFor(0.05);
    }
}

// ══════════════════════════════════════════════════════════════════════
export default makeScene2D(function* (view) {
    yield* awaitFontsReady();

    view.add(<Rect width={VIEW_W} height={VIEW_H} fill={BG} />);

    // ── Editorial frame ─────────────────────────────────────────────
    view.add(<Txt text="KUROSHIMA"
        fontFamily={F_SERIF} fontSize={22} fontWeight={500}
        letterSpacing={5} fill={HERO} y={-820} />);
    view.add(<Txt text="ISSUE 03"
        fontFamily={F_SERIF} fontSize={20} fontWeight={500}
        letterSpacing={4} fill={HERO} y={820} />);

    // ════════════════════════════════════════════════════════════════
    //  THE NAME  (an honest name, then the lie, then the body that proves it)
    // ════════════════════════════════════════════════════════════════
    // ONE block, morphed — never replaced. The method NAME with parens enters
    // large and alone, STAYS large as the first parameter TYPES inside the
    // parens, then SHRINKS to admit the boolean as it TYPES in. The name then
    // loses its authority (the gold flag is the only thing left lit), the gold
    // calmly resolves back to plain code, and the body grows out — line by line,
    // the signature staying exactly where it was. No subtitles: the lit code
    // line + the card state carry the meaning.
    const TYPE = {
        addStyle: 'typewriter' as const, charDelay: 0.045,
        moveDuration: 0.5, removeDuration: 0.3,
        blockOrder: 'parallel' as const, lineOrder: 'parallel' as const,
        tokenSlideDuration: 0,   // close paren re-types LAST → the growing line never shows a hole
    };
    // Body grow: line by line, top to bottom, while the signature stays put.
    // scrollStrategy 'block' keeps the engine from auto-scrolling the block as
    // lines are added (the signature must NOT move).
    // Build the body lines INSTANTLY (0 frames → no flash), then reveal them myself
    // as a hand-driven cascade. moveDuration 0 + parallel/parallel takes the fast path
    // with zero-duration tweens, so the morph advances no frames and nothing is shown
    // before I hide the new lines.
    const BODY_BUILD = {
        addStyle: 'fade' as const, moveDuration: 0, charDelay: 0, lineDelay: 0,
        lineOrder: 'parallel' as const, blockOrder: 'parallel' as const,
        scrollStrategy: 'block' as const, tokenSlideDuration: 0,
    };
    const FS = 38;                                          // larger working size
    const LEFT_LOCAL = -1100 / 2 + getCodePaddingX(FS);    // local x where text starts
    const HERO_SCALE = 1.6;   // big, but the shrink-to-fit at the boolean stays gentle + in-frame
    const widthOf = (code: string): number =>
        Math.max(...code.split('\n').map(l => textWidth(l, F_MONO, FS)));
    const centerX = (code: string, scale: number): number => -(LEFT_LOCAL + widthOf(code) / 2) * scale;

    const fn = makeBlock({code: NAME_ONLY, y: 0, fontSize: FS, lineHeight: 54, width: 1100, noClip: true});
    fn.mount(view);
    dressBlock(fn);
    const fnBlur = createSignal(10);
    fn.node.filters(() => [blur(fnBlur())]);

    // 1 — the method name with parens, alone and large. (A name is a promise.)
    fn.node.opacity(0);
    fn.node.scale(HERO_SCALE);
    fn.node.x(centerX(NAME_ONLY, HERO_SCALE));
    yield* all(
        fn.node.opacity(1, 0.8, easeOutCubic),
        fnBlur(0, 0.8, easeOutCubic),
    );
    yield* waitFor(0.25);

    // 2 — the first parameter TYPES into the parens at hero size; the line grows
    // outward from the centre. One param is no reason to shrink.
    yield* all(
        fn.morphTo(SIGNATURE, TYPE),
        fn.node.x(centerX(SIGNATURE, HERO_SCALE), 0.7, easeInOutCubic),
    );
    yield* waitFor(0.9);

    // 3 — the boolean TYPES in as the foreign flag, and the line SHRINKS to admit
    // it (the shrink is EARNED by the width it needs). Type + scale + recentre in
    // one move, so the boolean's arrival is what makes the method give ground.
    yield* all(
        fn.morphTo(SIGNATURE_FLAG, TYPE),
        fn.node.scale(1, 0.7, easeInOutCubic),
        fn.node.x(centerX(SIGNATURE_FLAG, 1), 0.7, easeInOutCubic),
    );
    yield* waitFor(0.9);

    // 4 — the name starts to lie: structure recedes, the name loses its glow,
    // and the gold flag is the only thing still lit.
    const sigLine = fn.getLine(0);
    const nameTok = sigLine?.tokens.find(t => t.text === 'savePost')?.ref();
    const pubTok  = sigLine?.tokens.find(t => t.text === 'publish')?.ref();
    const boolTok = sigLine?.tokens.find(t => t.text === 'boolean')?.ref();
    const lieDim: ThreadGenerator[] = [];
    if (sigLine) for (const t of sigLine.tokens) {
        if (t.text === 'savePost' || t.text === 'publish' || t.text === 'boolean') continue;
        lieDim.push(t.ref().opacity(DIM_OP, 0.5));
    }
    yield* all(
        ...lieDim,
        nameTok?.opacity(0.45, 0.5) ?? waitFor(0),
        nameTok?.shadowBlur(0, 0.5) ?? waitFor(0),
        pubTok?.fill(ACCENT, 0.5, easeOutCubic) ?? waitFor(0),
        boolTok?.fill(ACCENT, 0.5, easeOutCubic) ?? waitFor(0),
    );
    yield* waitFor(1.4);

    // 5a — the gold cools BEFORE the body opens (its own beat, not swept away by
    // the morph): the dimmed structure relights first, then the gold drains back
    // to plain — the lie quietly resolves into ordinary code.
    const relightSig = (fn.getLine(0)?.tokens ?? []).map(t => t.ref().opacity(1, 0.55, easeInOutCubic));
    yield* sequence(0.12,
        all(
            ...relightSig,
            nameTok?.shadowBlur(8, 0.6, easeInOutCubic) ?? waitFor(0),
        ),
        all(
            pubTok?.fill(INK, 0.55, easeInOutCubic) ?? waitFor(0),
            boolTok?.fill(TYPE_CLR, 0.55, easeInOutCubic) ?? waitFor(0),
        ),
    );
    yield* waitFor(0.35);

    // 5b — the body builds instantly (no flash), then CASCADES in top→bottom, each line
    // emerging from the one above ("словно строка из строки"): every body line starts
    // hidden and lifted 24px toward the line above, then fades + settles DOWN into its
    // slot, one after another. The signature does NOT move: no x-recentre (savePost's
    // left edge stays put — the line only extends right as ` {` is added) and no y-lift.
    yield* fn.morphTo(CODE_FLAG, BODY_BUILD);
    dressBlock(fn);

    const cascade: ThreadGenerator[] = [];
    for (const i of [1, 2, 3, 4, 5, 6]) {
        const ln = fn.getLine(i);
        if (!ln) continue;
        const restY = ln.node.y();
        ln.node.opacity(0);
        ln.node.y(restY - 24);               // start toward the line above
        cascade.push(all(
            ln.node.opacity(1, 0.28, easeOutCubic),
            ln.node.y(restY, 0.34, easeOutCubic),   // settle down into its slot
        ));
    }
    yield* sequence(0.10, ...cascade);
    yield* waitFor(0.5);

    // The two paths the switch routes between — surfaced one at a time, each made
    // concrete by the product card it produces. Draft path first.
    const IF_LINE     = 1;
    const RET_PUBLISH = 2;
    const IF_CLOSE    = 3;
    const RET_DRAFT   = 5;   // blank line sits above it (index 4)

    // The card, parked just above the static method and flat on the page, ready to
    // lift in when the publish path (top if-block) lights. The code never moves.
    // Symmetric between the KUROSHIMA header (y=-820) and the signature (y=0):
    // card centre at the midpoint → equal 218px gaps above and below.
    const SHEET_Y = -410;
    const card = buildDraftCard();
    view.add(card.jsx);

    // Entrance — the whole record DEVELOPS as ONE: the surface + typography resolve out of
    // soft focus together (a single focus-pull blurs the whole cached node, so every line
    // sharpens TOGETHER — never a per-element fade-in), the panel eases forward + drops a
    // few px, and the two-layer shadow blooms from flat = the soft elevation. The NODE
    // never fades; coming-into-focus + the shadow ARE the reveal. Then dead still.
    const cardBlur = createSignal(11);
    card.node().filters(() => [blur(cardBlur())]);
    card.node().scale(0.97);
    card.node().y(SHEET_Y - 10);
    card.ambient().shadowBlur(2);          // shadows start flat → bloom = the elevation
    card.ambient().shadowOffset([0, 6]);
    card.panel().shadowBlur(2);
    card.panel().shadowOffset([0, 2]);

    // The card materialises in ONE tempo with the code dimming: the spotlight drops the
    // non-publish lines to DIM_OP (easeInOutCubic — CodeLine.setOpacity) while the card
    // sharpens out of focus + the shadow blooms on the SAME duration and SAME curve, so
    // the two read as a single synchronized move, not two overlapping animations.
    const REVEAL_DUR = 0.6;
    yield* all(
        spotlight(fn, [IF_LINE, RET_PUBLISH, IF_CLOSE], REVEAL_DUR),
        cardBlur(0, REVEAL_DUR, easeInOutCubic),
        card.node().scale(1, REVEAL_DUR, easeInOutCubic),
        card.node().y(SHEET_Y, REVEAL_DUR, easeInOutCubic),
        card.ambient().shadowBlur(46, REVEAL_DUR, easeInOutCubic),
        card.ambient().shadowOffset([0, 20], REVEAL_DUR, easeInOutCubic),
        card.panel().shadowBlur(12, REVEAL_DUR, easeInOutCubic),
        card.panel().shadowOffset([0, 5], REVEAL_DUR, easeInOutCubic),
    );
    yield* waitFor(1.4);

    // Phase 2 — the flag drops. The DEFAULT branch (saveDraft, bottom) lights AND the
    // card flips back to draft in one gesture. Cause→effect, not a simultaneous recolour
    // blink: the TOGGLE is the cause (knob slides OFF, the publish-green drains out of the
    // track); then 0.12s later the CONSEQUENCE cascades — the pill word Published→Draft
    // (locked width, no reflow) then the visibility line. Title + slug NEVER move: same
    // post, only its state. One name, two contracts.
    yield* all(
        spotlight(fn, [RET_DRAFT], 0.45),
        (function* () {
            yield* sequence(0.12,
                all(   // the gesture (cause) leads — knob slides OFF, track drains the publish-green
                    card.knob().x(-20, 0.5, easeInOutCubic),
                    card.track().fill('rgba(231,225,214,0.04)', 0.5, easeInOutCubic),
                    card.track().stroke('rgba(231,225,214,0.22)', 0.5, easeInOutCubic),
                ),
                sequence(0.05,   // the consequence cascades top→bottom
                    all(
                        card.statusDot().fill('rgba(231,225,214,0.48)', 0.42, easeInOutCubic),
                        retextColored(card.statusLabel(), 'DRAFT', 'rgba(231,225,214,0.72)'),
                    ),
                    retext(card.visibility(), 'Only you can see this'),
                ),
            );
        })(),
    );
    yield* waitFor(1.4);

    // Restore the full method — end on the whole truth + the published card.
    yield* fn.showAllLines(0.4);
    yield* waitFor(2.4);
});
