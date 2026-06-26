import {Img, Node, Rect, Txt, blur, makeScene2D, saturate} from '@motion-canvas/2d';
import {
    Reference,
    ThreadGenerator,
    all,
    createRef,
    createSignal,
    easeInCubic,
    easeInOutCubic,
    easeOutCubic,
    linear,
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

// Placeholder "logic" stripes — the cart-reminder DEGRADATION-bar style: a SOLID bar on the line
// grid (audited from the reference: fill is INK #E7E1D6 at full opacity, NOT a faint skeleton). The
// if-block stripes are that exact reference cream; the outside block is «чуть коричневатые» — a warm
// tan — so the two logical regions read as distinct piles of code, each growing on its own.
const BAR_IF   = '#E7E1D6';   // inside `if (publish)` — the reference degradation-bar cream (INK)
const BAR_OUT  = '#D4BD93';   // outside the if — slightly brownish (warm tan), same brightness family

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
    {match: /^(function|const|let|var|return|if|else|await)$/, color: KEY},
    {match: /^(true|false)$/, color: KEY},
    {match: /^(boolean|string|number|Post)$/, color: TYPE_CLR},   // Post is a type → type colour, not method blue
    {match: /^(savePost|publishPost|saveDraft)$/, color: DOMAIN},   // the method NAMES (declarations) are blue
    // the bloat's added method CALLS — blue, by the same convention (so the new lines match the rest)
    {match: /^(buildPublicUrl|notifySubscribers|queuePublication|serializeDraft|persistAutosave|broadcastChanges)$/, color: DOMAIN, onlyTypes: ['method']},
    {match: /^(publish|save)$/, color: DOMAIN, onlyTypes: ['method']},   // method CALLS are blue too, by
    // convention (Anton: «методы синие по конвенции») — onlyTypes:'method' so the call `feed.publish`
    // is blue but the boolean FLAG `publish` in the pre-split (type 'plain') stays cream. feed/drafts
    // are OBJECTS, not methods → they remain plain cream.
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
// The cold open: a function name with parens, alone — a promise of what it does.
const NAME_ONLY = `function savePost()`;

// One parameter resolves inside the parens. Still honest: a post, fully typed.
const SIGNATURE = `function savePost(post: Post)`;

// One boolean, typed in as a foreign element the name never accounted for.
const SIGNATURE_FLAG = `function savePost(post: Post, publish: boolean)`;

// The body the name hides: save means write a draft — unless the flag is set,
// and then it doesn't save, it publishes, live to everyone. `function` is on EVERY
// state (cold open → split) so the register never changes: the only thing the payoff
// alters on screen is the NAME — `function` is the same keyword that was already there,
// not a syntactic surprise born in the split. Every beat is valid top-level TS.
const CODE_FLAG = `function savePost(post: Post, publish: boolean) {
    if (publish) {
        return publishPost(post)
    }

    return saveDraft(post)
}`;

// The payoff: the one branching method MORPHS (one block, token-morph) into two honestly
// named functions — saveDraft (lines 0-2) and publishPost (lines 4-6), blank line 3 between.
// Then the block's lines SPREAD into two columns so each function pairs with its card.
const CODE_SPLIT = `function saveDraft(post: Post) {
    return drafts.save(post)
}

function publishPost(post: Post) {
    return feed.publish(post)
}`;

// ── Code block helpers (house style: theme + rules + glow + weight) ───
type BlockOpts = {
    code: string; x?: number; y: number;
    width?: number; fontSize?: number; lineHeight?: number; noClip?: boolean;
    customTypes?: string[];
};

function makeBlock(o: BlockOpts): Manticore {
    return Manticore.create(o.code, {
        x: o.x ?? CODE_X, y: o.y,
        width: o.width ?? 1040,
        fontSize: o.fontSize ?? 32,
        lineHeight: o.lineHeight ?? 46,
        fontFamily: F_MONO,
        theme: THEME,
        customTypes: o.customTypes,
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
function* spotlight(block: Manticore, keep: number[], dur = 0.4, easing = easeInOutCubic): ThreadGenerator {
    const ops: ThreadGenerator[] = [];
    for (let i = 0; i < block.lineCount; i++) {
        const line = block.getLine(i);
        if (line) ops.push(line.node.opacity(keep.includes(i) ? 1 : DIM_OP, dur, easing));
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
    content: Reference<Node>;
    status: Reference<Node>; statusDot: Reference<Rect>; statusLabel: Reference<Txt>;
    visibility: Reference<Txt>;
    track: Reference<Rect>; knob: Reference<Rect>;
    jsx: any;
} {
    const node        = createRef<Node>();
    const ambient     = createRef<Rect>();
    const panel       = createRef<Rect>();
    const content     = createRef<Node>();
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
                <Node ref={content}>{children}</Node>
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
    return {node, ambient, panel, content, status, statusDot, statusLabel, visibility, track, knob, jsx};
}

// A FIXED-state card (no toggle) — used in the split payoff, where each function owns one
// outcome and there is no boolean left to flip. Same post, same surface; only the status +
// visibility line differ by state. The missing toggle is the point: the contract is the NAME.
function buildStateCard(state: 'draft' | 'published'): {
    node: Reference<Node>; ambient: Reference<Rect>; panel: Reference<Rect>; jsx: any;
} {
    const node    = createRef<Node>();
    const ambient = createRef<Rect>();
    const panel   = createRef<Rect>();
    const PAD = 44;
    const L = -DCARD_W / 2 + PAD;
    const R =  DCARD_W / 2 - PAD;
    const STAT_FS = 27;
    const STAT_DOT = 12;
    const pubW = Math.ceil(textWidth('PUBLISHED', F_MONO, STAT_FS));
    const dotX = R - pubW - 22;
    const H = 388;
    const pub = state === 'published';
    const dotFill   = pub ? PUB_GREEN : 'rgba(231,225,214,0.48)';
    const label     = pub ? 'PUBLISHED' : 'DRAFT';
    const labelFill = pub ? INK : 'rgba(231,225,214,0.72)';
    const vis       = pub ? 'Live · anyone can see this' : 'Only you can see this';
    // the toggle — present on BOTH cards so they read as parallel contracts: ON/green
    // for published, OFF/grey for draft (the draft card is disabled, its switch is off).
    const togW = 92, togH = 52, knobR = 21, knobX = togW / 2 - knobR - 5;   // 20
    const trackFill   = pub ? 'rgba(168,207,152,0.85)' : 'rgba(231,225,214,0.04)';
    const trackStroke = pub ? 'rgba(168,207,152,0.55)' : 'rgba(231,225,214,0.22)';
    const knobPosX    = pub ? knobX : -knobX;

    const jsx = (
        <Node ref={node}>
            <Rect ref={ambient} width={DCARD_W} height={H} radius={RAD}
                fill={BG} shadowColor="rgba(0,0,0,0.58)" shadowBlur={46} shadowOffset={[0, 20]} />
            <Rect ref={panel} width={DCARD_W} height={H} radius={RAD}
                fill={SURFACE} stroke={SURFACE_EDGE} lineWidth={1}
                shadowColor="rgba(0,0,0,0.45)" shadowBlur={12} shadowOffset={[0, 5]}>
              {/* draft = DISABLED look: content faded + desaturated (avatar greys), surface stays */}
              <Node opacity={pub ? 1 : 0.68} filters={pub ? [] : [saturate(0.3)]}>
                <Rect width={68} height={68} radius={34} x={L + 34} y={-112}
                    fill="rgba(231,225,214,0.10)" stroke="rgba(231,225,214,0.20)" lineWidth={1} clip>
                    <Img src="/avatar-anna.jpg" width={68} height={68} />
                </Rect>
                <Txt text="Anna Petrova" fontFamily={F_SERIF} fontSize={30} fontWeight={500}
                    fill={INK} offset={[-1, 0]} x={L + 100} y={-126} />
                <Txt text="@anna · 5h" fontFamily={F_MONO} fontSize={20} fontWeight={450}
                    fill="rgba(231,225,214,0.58)" offset={[-1, 0]} x={L + 100} y={-96} />
                <Rect width={STAT_DOT} height={STAT_DOT} radius={STAT_DOT / 2} x={dotX} y={-110} fill={dotFill} />
                <Txt text={label} fontFamily={F_MONO} fontSize={STAT_FS} fontWeight={500}
                    letterSpacing={1.6} fill={labelFill} offset={[-1, 0]} x={dotX + STAT_DOT + 11} y={-112} />

                <Txt text="Just shipped our Getting Started guide." fontFamily={F_SERIF} fontSize={27} fontWeight={400}
                    fill="rgba(231,225,214,0.82)" offset={[-1, 0]} x={L} y={-30} />
                <Txt text="Set up your workspace and ship your" fontFamily={F_SERIF} fontSize={27} fontWeight={400}
                    fill="rgba(231,225,214,0.82)" offset={[-1, 0]} x={L} y={6} />
                <Txt text="first change in minutes." fontFamily={F_SERIF} fontSize={27} fontWeight={400}
                    fill="rgba(231,225,214,0.82)" offset={[-1, 0]} x={L} y={42} />

                <Txt text={vis} fontFamily={F_MONO} fontSize={23} fontWeight={450}
                    fill="rgba(231,225,214,0.72)" offset={[-1, 0]} x={L} y={120} />
                <Rect width={togW} height={togH} radius={togH / 2} x={R - togW / 2} y={120}
                    fill={trackFill} stroke={trackStroke} lineWidth={1.5}>
                    <Rect width={knobR * 2} height={knobR * 2} radius={knobR} x={knobPosX} y={0}
                        fill="rgba(231,225,214,0.85)" />
                </Rect>
              </Node>
            </Rect>
        </Node>
    );
    return {node, ambient, panel, jsx};
}

// Roll a Txt to new copy — a top-to-bottom flip (departures-board feel): the old word
// drops DOWN and out as it fades, the new word arrives from ABOVE and settles into the
// slot. Both motions go downward → reads as a clean top→bottom morph, not a plain fade.
function* retext(node: Txt, text: string): ThreadGenerator {
    const baseY = node.y();
    const H = node.fontSize() * 0.85;
    yield* all(
        node.y(baseY + H, 0.2, easeInCubic),
        node.opacity(0, 0.2, easeInCubic),
    );
    node.text(text);
    node.y(baseY - H);
    yield* all(
        node.y(baseY, 0.32, easeOutCubic),
        node.opacity(1, 0.32, easeOutCubic),
    );
}

// Roll that also swaps the fill (the status word going "live"/"draft"): the new word rolls
// in already wearing its new colour, so the change reads as one clean top→bottom flip.
function* retextColored(node: Txt, text: string, finalFill: string): ThreadGenerator {
    const baseY = node.y();
    const H = node.fontSize() * 0.85;
    yield* all(
        node.y(baseY + H, 0.2, easeInCubic),
        node.opacity(0, 0.2, easeInCubic),
    );
    node.text(text);
    node.fill(finalFill);
    node.y(baseY - H);
    yield* all(
        node.y(baseY, 0.32, easeOutCubic),
        node.opacity(1, 0.32, easeOutCubic),
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
    const widthOf = (code: string): number =>
        Math.max(...code.split('\n').map(l => textWidth(l, F_MONO, FS)));
    const centerX = (code: string, scale: number): number => -(LEFT_LOCAL + widthOf(code) / 2) * scale;
    // SCREEN centre of a name token in a CENTRED block (node.x = centerX(code,scale), so content-left =
    // −widthOf/2·scale; line i top-anchored at node.y + i·53.2·scale). Used to drive overlay-Txt name
    // glides in a perfectly straight, linear path with linear shrink (the block transform itself can't
    // do straight-while-scaling — the Δscale·Δlocal cross-term is quadratic).
    const nameC = (code: string, indent: string, name: string, line: number, scale: number, ny: number) => ({
        x: (-widthOf(code) / 2 + textWidth(indent, F_MONO, FS) + textWidth(name, F_MONO, FS) / 2) * scale,
        y: ny + line * 53.2 * scale,
    });
    // GEOMETRY — fit every beat to the frame so the widest line of each state ALWAYS clears both
    // edges by >= MARGIN px (Anton: «функция всегда геометрически правильно — отступы слева и справа,
    // без налезания на края»). centerX puts a state's widest line dead-centre → on-screen half-width
    // is widthOf/2 * scale, so the scale leaving exactly MARGIN per side is (VIEW_W − 2·MARGIN)/widthOf;
    // cap it so a short line doesn't balloon. Driven by the engine's REAL glyph widths (textWidth),
    // never guessed: NAME_ONLY≈397, SIGNATURE≈606, SIGNATURE_FLAG≈982, CODE_FLAG≈1024 (its signature
    // line is the WIDEST in the scene → it sets WORK_S), CODE_GROWN≈710 (narrower → re-centred in MOVE).
    const MARGIN = 80;
    const fitScale = (code: string, cap: number): number =>
        Math.min(cap, (VIEW_W - 2 * MARGIN) / widthOf(code));
    const HERO_S = fitScale(SIGNATURE, 1.6);    // cold-open + signature (SIGNATURE is the wider of the two)
    const WORK_S = fitScale(CODE_FLAG, 1.0);    // boolean → body → split: shrink EARNED by CODE_FLAG's width

    // lineHeight 53.2 (not 54): a hair tighter so saveDraft (13 lines below publishPost in the split)
    // lands ~10px HIGHER than publishPost — Anton's «нижний блок на 10 выше», BAKED into the layout
    // so it never moves after placement (no nudge, no jerk). 0.8px/line — invisible on the savePost beats.
    // publishPost/saveDraft as customTypes → tokenizer always types them 'type' (constant), so the
    // line-diff KEEPS them across every morph (no 'plain'↔'method' flip at the paren = no re-type /
    // "перезатёрлись"). They're still painted DOMAIN-blue by the RULES (colour ≠ tokenizer-type).
    const fn = makeBlock({code: NAME_ONLY, y: 0, fontSize: FS, lineHeight: 53.2, width: 1100, noClip: true,
        customTypes: ['publishPost', 'saveDraft']});
    fn.mount(view);
    dressBlock(fn);
    const fnBlur = createSignal(10);
    fn.node.filters(() => [blur(fnBlur())]);

    // 1 — the method name with parens, alone and large. (A name is a promise.)
    fn.node.opacity(0);
    fn.node.scale(HERO_S);
    fn.node.x(centerX(NAME_ONLY, HERO_S));
    yield* all(
        fn.node.opacity(1, 0.8, easeOutCubic),
        fnBlur(0, 0.8, easeOutCubic),
    );
    yield* waitFor(0.25);

    // 2 — the first parameter TYPES into the parens at hero size; the line grows
    // outward from the centre. One param is no reason to shrink.
    yield* all(
        fn.morphTo(SIGNATURE, TYPE),
        fn.node.x(centerX(SIGNATURE, HERO_S), 0.7, easeInOutCubic),
    );
    yield* waitFor(0.9);

    // 3 — the boolean TYPES in as the foreign flag, and the line SHRINKS to admit
    // it (the shrink is EARNED by the width it needs). Type + scale + recentre in
    // one move, so the boolean's arrival is what makes the method give ground.
    // Shrink to WORK_S and centre on CODE_FLAG (the body's signature line is the widest in the scene)
    // so when the body builds below it NOTHING moves and NOTHING clips — body symmetric at MARGIN/side.
    yield* all(
        fn.morphTo(SIGNATURE_FLAG, TYPE),
        fn.node.scale(WORK_S, 0.7, easeInOutCubic),
        fn.node.x(centerX(CODE_FLAG, WORK_S), 0.7, easeInOutCubic),
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

    // 5b — the body builds instantly (no flash) then CASCADES in top→bottom, AND THE CARD
    // ARRIVES WITH IT (Anton: «карточка появится вместе с появлением тела метода»): the
    // published card descends + settles in the SAME beat the method body grows, not as a
    // later step. Each body line starts hidden + lifted 24px toward the line above, then
    // fades + settles DOWN into its slot. The signature does NOT move (left edge fixed).
    yield* fn.morphTo(CODE_FLAG, BODY_BUILD);
    dressBlock(fn);

    const IF_LINE     = 1;
    const RET_PUBLISH = 2;
    const IF_CLOSE    = 3;
    const RET_DRAFT   = 5;   // blank line sits above it (index 4)

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

    // The card — sharp, "placed & settles" (short descent + shadow tightening); set up flat,
    // then revealed CONCURRENTLY with the body cascade below. Parked above the method, centred
    // between KUROSHIMA (y=-820) and the signature (y=0).
    const SHEET_Y = -410;
    const card = buildDraftCard();
    view.add(card.jsx);
    // disabled-look driver: when OFF/draft the card content fades + desaturates (not the surface)
    const cardSat = createSignal(1);
    card.content().filters(() => [saturate(cardSat())]);
    card.node().y(SHEET_Y - 44);
    card.ambient().shadowBlur(48); card.ambient().shadowOffset([0, 26]);
    card.panel().shadowBlur(15);   card.panel().shadowOffset([0, 9]);

    // body grows AND card lands — TOGETHER, one beat.
    yield* all(
        sequence(0.10, ...cascade),
        card.node().y(SHEET_Y, 0.8, easeOutCubic),
        card.ambient().shadowBlur(30, 0.8, easeOutCubic),
        card.ambient().shadowOffset([0, 15], 0.8, easeOutCubic),
        card.panel().shadowBlur(9, 0.8, easeOutCubic),
        card.panel().shadowOffset([0, 4], 0.8, easeOutCubic),
    );

    // now FOCUS the publish branch — pairs the (published) card with the path that produces it.
    yield* spotlight(fn, [IF_LINE, RET_PUBLISH, IF_CLOSE], 0.5, linear);
    yield* waitFor(1.0);

    // Phase 2 — the flag drops. The DEFAULT branch (saveDraft, bottom) lights AND the
    // card flips back to draft in one gesture. Cause→effect, not a simultaneous recolour
    // blink: the TOGGLE is the cause (knob slides OFF, the publish-green drains out of the
    // track); then 0.12s later the CONSEQUENCE cascades — the pill word Published→Draft
    // (locked width, no reflow) then the visibility line. Title + slug NEVER move: same
    // post, only its state. One name, two contracts.
    yield* all(
        spotlight(fn, [RET_DRAFT], 0.45),
        card.content().opacity(0.68, 0.55, easeInOutCubic),   // OFF → the card goes DISABLED:
        cardSat(0.3, 0.55, easeInOutCubic),                   // content fades + desaturates (avatar greys)
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

    // ════════════════════════════════════════════════════════════════
    //  THE SPLIT — the body already NAMES both methods (publishPost in the if-branch, saveDraft
    //  in the default). (0) flip BACK to the publish branch one more time — re-light the if-block
    //  AND switch the toggle ON, exactly like the entrance (after this the toggle is never touched
    //  again). (1) PLACE — savePost dissolves and the two CALLS fly STRAIGHT to their final stacked
    //  positions (publishPost top, saveDraft bottom — already small, with the card-gap built in via
    //  blank lines); (2) GROW — function/params/bodies sprout AROUND each name, IN PLACE (the two
    //  blocks share one line-structure, so the names never move); (3) the DRAFT card drops into the
    //  gap. publishPost/PUBLISHED on top, saveDraft/DRAFT below.
    // ════════════════════════════════════════════════════════════════
    const GAP = 12;   // blank lines between the two functions = the rigid SEPARATION of the two methods
                      // (they are ONE block; saveDraft = SEP = (3+GAP)·lineSpacing below publishPost).
                      // 12 (not 11): GAP 11 made SEP too SHORT → the bottom group rode up, leaving a big
                      // VOID below saveDraft (it «приливало» to its card). 12 drops the bottom group so
                      // saveDraft sits ~82px above ISSUE — matched to the card↔KUROSHIMA margin up top.
    // THREE shared line-structures. The names travel to their FINAL point in ONE diagonal MOVE
    // (Anton: «методы должны приехать СРАЗУ в целевую точку, не сначала правее потом сдвинулись»):
    //   STRIPPED   (6 lines)  — only the two bare names survive, at their BODY columns (15/11) —
    //                           exactly where the body left them, so STRIP→STRIPPED is teleport-free.
    //   NAMES_ONLY (18 lines) — the same two names re-laid into their FINAL stacked slots AND already
    //                           indented to column 9 (their FINAL column). pairBySimilarity (on in
    //                           MOVE_OPTS) pairs each STRIPPED name-line with its NAMES_ONLY twin by
    //                           trimmed text, so the name SLIDES col15/11→col9 AND relocates its line
    //                           index in one move = a clean diagonal straight to the target. NO later
    //                           horizontal shift.
    //   CODE_GROWN (18 lines) — signatures + bodies sprout AROUND the names, which are ALREADY at col 9
    //                           ("function " is 9 chars) → GROW types `function ` into cols 0..8 and the
    //                           name does NOT move (col9→col9).
    // CRITICAL: all three share TWO leading blank lines so publishPost sits at line index 2
    // in every state. Without them, the LCS line-diff (it maximises matched lines) would rather
    // pair STRIPPED's leading blanks than keep `publishPost`, demoting it to remove+add — which
    // CROSS-FADES the name instead of sliding it. Matched leading blanks keep both names as
    // `keep` lines, so they GLIDE to their stations at full opacity.
    const LEAD = ['', ''];   // two blank lines above publishPost — shared by all three states
    // Target (Anton, verbatim): `function publishPost(post: Post) { return feed.publish(post) }`
    // and the saveDraft twin. So the names carry empty call-parens `NAME()` in STRIPPED/NAMES_ONLY
    // and grow into `function NAME(post: Post) {`. The name lines are indented 9 spaces = width of
    // "function " — so during GROW the `function ` keyword TYPES INTO that reserved indent and the
    // name does NOT move (it was already at its final column 9). The `()` keeps the name a KEPT
    // token: the tokenizer types `publishPost` as 'method' whenever it's followed by '(' (a BARE
    // `publishPost` would be 'plain'); diffTokens keys on text+type, so 'method'→'method' across
    // all three states keeps the name + its `(`/`)` GLIDING, never re-typing. Growth: `function `
    // types into the indent, the `()` fills with `post: Post`, the `)` slides right, the body appears.
    // CRITICAL: the body-slot lines are a SINGLE SPACE ' ' (SLOT), while the GAP lines are EMPTY ''.
    // Both render invisible, but the line-diff (LCS) treats ' ' and '' as DIFFERENT lines — so the
    // GAP blanks can ONLY pair with each other and can't be shuffled into the body slots. Without
    // this, the LCS re-aligns the GAP blanks onto the pub body slots and ORPHANS the second name
    // (saveDraft), demoting it to remove+add so it re-types char-by-char in GROW.
    const SLOT = ' ';
    // BARE names (no parens). STRIPPED holds them at BODY columns (publishPost 15, saveDraft 11) so
    // they appear EXACTLY where the body left them (no teleport on collapse). Because they're
    // customTypes ('type'), diffTokens KEEPS them across every morph; combined with pairBySimilarity
    // (which pairs the col-15/11 line with the col-9 line by trimmed text), the MOVE slides each name
    // col15/11→col9 + relocates its line in ONE diagonal — landing at the FINAL column. GROW then
    // grows `function ` to the LEFT with the name fixed at col 9 (no re-type, no shift).
    // SB = STRIPPED's blank line. It is THREE spaces — a whitespace string that matches NOTHING in
    // NAMES_ONLY (whose blanks are '' for the GAP/LEAD and ' ' for the SLOTs). That makes the MOVE's
    // line-diff score LCS=0 (no shared lines) → every old line is a remove, every new line an add, all
    // in ONE group → pairBySimilarity pairs BOTH name-lines (pub15↔pub9, sav11↔sav9) by trimmed text,
    // so BOTH names become 'modify' = a kept-token SLIDE, neither cross-fades. (The earlier bug: with
    // '' blanks, the LCS kept the LEAD blanks at LATE indices, splitting publishPost's remove from its
    // add into different groups → it cross-faded while saveDraft happened to slide.) SB still renders
    // invisible. publishPost stays at body line 2, saveDraft at line 5 (no collapse teleport).
    const SB = '   ';
    const STRIPPED   = [SB, SB, '               publishPost', SB, SB, '           saveDraft'].join('\n');
    const NAMES_ONLY = [...LEAD, '         publishPost', SLOT, SLOT,
        ...Array(GAP).fill(''), '         saveDraft', SLOT, SLOT].join('\n');
    const CODE_GROWN = [...LEAD, 'function publishPost(post: Post) {', '  return feed.publish(post)', '}',
        ...Array(GAP).fill(''), 'function saveDraft(post: Post) {', '  return drafts.save(post)', '}'].join('\n');

    // STRIP = dissolve everything but the names (fade, no typing); MOVE = glide the names to
    // their stations (slide, no add/remove); GROW = type the structure in around them.
    // STRIP_COLLAPSE runs AFTER a manual simultaneous cruft fade (see below) — the cruft is
    // already invisible, so this morphTo is an instant structural cleanup (it must NOT re-fade
    // anything or re-type the kept names, hence 0.01 durations + no token slide).
    const STRIP_COLLAPSE = {
        addStyle: 'fade' as const, moveDuration: 0.01, removeDuration: 0.01, charDelay: 0,
        blockOrder: 'parallel' as const, lineOrder: 'parallel' as const,
        tokenSlideDuration: 0, scrollStrategy: 'block' as const,
    };
    const MOVE_OPTS = {
        addStyle: 'fade' as const, moveDuration: 0.7, removeDuration: 0.3, charDelay: 0,
        blockOrder: 'parallel' as const, lineOrder: 'parallel' as const,
        tokenSlideDuration: 0.7, pairBySimilarity: true, scrollStrategy: 'block' as const,
    };
    const GROW_OPTS = {
        addStyle: 'typewriter' as const, charDelay: 0.02, moveDuration: 0.6, removeDuration: 0.3,
        blockOrder: 'parallel' as const, lineOrder: 'parallel' as const,
        tokenSlideDuration: 0.6, pairBySimilarity: true, scrollStrategy: 'block' as const,
    };
    // CARDS and CODE are matched in WIDTH so the centred composition reads cleanly (Anton: «геометрия —
    // отступы, позиции компонентов»). The fixed narrow card (680×388) made a big centred code stick out
    // ~147px past it on each side. Fix: bring both to ~the same on-screen width (~720–746px, ~170px/side
    // margins), both centred → left AND right edges line up, consistent margins, nothing near the frame
    // edge. SPLIT_S 1.05 (code still bigger than the body's WORK_S 0.9, +17%); CARD_S 1.05 (the split
    // cards GROW from the early scale-1 card rather than shrink — same width family as the code).
    // SPLIT code scale — BIG, so the method NAMES visibly GROW as they travel (Anton, repeated:
    // «названия должны становиться больше во время движения; разделённый код крупнее в кадре»). The MOVE
    // scales the block WORK_S 0.9 → SPLIT_S 1.05 (+17%), so publishPost/saveDraft enlarge while they fly to
    // their stations. (Widest code line ≈740 > the 680 card by ~30px/side — the code is its own, wider
    // element; the earlier «проблема отступа» was the VERTICAL imbalance below, fixed by GAP 12 + positions.)
    const SPLIT_S = 1.05;
    const CARD_S  = 1.0;                                         // cards = the REFERENCE card size (Anton:
                                                                 // «карточки не делать больше чем карточка
                                                                 // референс») — panel 680 wide, half 194.
    // Vertical — EVERY breathing gap balanced. The two [card|method] groups are placed so the stack is
    // symmetric about y=0 (equal ~82px outer margins card→KUROSHIMA and saveDraft→ISSUE) AND the divider is
    // dead-centre between the groups (equal ~106px each side). Each card sits OFFSET = 303 above ITS function
    // (cardHalf 194 + ~91px CLEAR gap + 17 glyph-top) — SAME top and bottom, so the publishPost↔PUBLISHED and
    // saveDraft↔DRAFT gaps are IDENTICAL (91px). Block is TOP-anchored (line i at localY = i·53.2; at SPLIT_S
    // 1.05 lineSpacing 55.86, publishPost[line2], saveDraft[line17 with GAP 12]).
    const PP_Y    = -347;     // publishPost → sceneY −235, saveDraft → +603
    const PUB_CARD_Y = -538;  // PUBLISHED card — 303 above publishPost (≈91px clear gap)
    const DRAFT_CARD_Y = 300; // DRAFT card — 303 above saveDraft (SAME ≈91px clear gap)
    const DIVIDER_Y = 0;      // beige rule — dead-centre of the gap between the two groups (publishPost } ↔ DRAFT card)
    const DIVIDER_W = VIEW_W; // full-bleed, edge to edge (Anton: «от левого до правого края без гапов»)

    // (0) flip BACK to the publish branch — NO if-block spotlight here (Anton: «верни не
    //     выделение if блока, а просто покажи код без подсветки»): the whole method lights up
    //     FULL, undimmed, while the toggle switches ON once more. The toggle is NOT touched after.
    yield* all(
        fn.showAllLines(0.5),                              // full code, no highlight/dim
        card.content().opacity(1, 0.55, easeInOutCubic),   // ON → the card comes back to life:
        cardSat(1, 0.55, easeInOutCubic),                  // content full opacity + full colour
        (function* () {
            yield* sequence(0.12,
                all(
                    card.knob().x(20, 0.5, easeInOutCubic),
                    card.track().fill('rgba(168,207,152,0.85)', 0.5, easeInOutCubic),
                    card.track().stroke('rgba(168,207,152,0.55)', 0.5, easeInOutCubic),
                ),
                sequence(0.05,
                    all(card.statusDot().fill(PUB_GREEN, 0.42, easeInOutCubic), retextColored(card.statusLabel(), 'PUBLISHED', INK)),
                    retext(card.visibility(), 'Live · anyone can see this'),
                ),
            );
        })(),
    );
    yield* waitFor(1.1);

    // (1) STRIP — everything dissolves except the two method NAMES, left standing at the EXACT
    // spot they held in the body. NO x change, NO recenter (Anton: «savePost зачем-то двинулся
    // вправо… publishPost дергаешь влево — это лишнее движение»). Pure dissolve, names don't budge.
    // Anton: «токены должны ОДНОВРЕМЕННО плавно исчезать… сейчас вразнобой». The morphTo's own
    // remove pass is uneven (whole removed LINES fade over removeDuration, but cruft tokens that
    // sit inside a KEPT name-line get .remove()'d instantly) — so we fade EVERY non-name token by
    // hand in one all(), guaranteeing a single uniform dissolve, THEN collapse the (now-invisible)
    // structure with the instant STRIP_COLLAPSE morphTo. Names (publishPost/saveDraft) are skipped
    // → they hold full opacity at their body line/column the whole time, no budge.
    const cruftFade: ThreadGenerator[] = [];
    for (let li = 0; li < fn.lineCount; li++) {
        const line = fn.getLine(li);
        if (!line) continue;
        for (const td of line.tokens) {
            const t = td.text.trim();
            if (t.length === 0 || t === 'publishPost' || t === 'saveDraft') continue;
            cruftFade.push(td.ref().opacity(0, 0.5, easeInOutCubic));
        }
    }
    yield* all(...cruftFade);
    yield* fn.morphTo(STRIPPED, STRIP_COLLAPSE);
    dressBlock(fn);
    yield* waitFor(0.4);

    // (2) MOVE — the two NAMES travel from the body columns to their stations as a STRAIGHT, LINEAR
    // overlay glide (same mechanism as the merge, forwards), GROWING (fontSize WORK_S→SPLIT_S) as they
    // travel — Anton: «при расщеплении методы тоже по прямой; линейно; уменьшается/растёт во время
    // движения». The block hides under the overlays and re-appears as NAMES_ONLY where they land; the
    // cards + divider settle in concurrently.
    const draftCard = buildStateCard('draft');
    view.add(draftCard.jsx);
    draftCard.node().scale(CARD_S); draftCard.node().x(0); draftCard.node().y(DRAFT_CARD_Y - 16); draftCard.node().opacity(0);
    const divider = createRef<Rect>();
    view.add(<Rect ref={divider} y={DIVIDER_Y} width={DIVIDER_W} height={2}
        fill={INK} opacity={0.32} scale={[0, 1]} />);

    // overlays: body columns (STRIPPED @ WORK_S, y 0) → stations (CODE_GROWN @ SPLIT_S, PP_Y).
    const sPubStart = nameC(CODE_FLAG, '        return ', 'publishPost', 2, WORK_S, 0);
    const sSavStart = nameC(CODE_FLAG, '    return ', 'saveDraft', 5, WORK_S, 0);
    const sPubEnd = nameC(CODE_GROWN, 'function ', 'publishPost', 2, SPLIT_S, PP_Y);
    const sSavEnd = nameC(CODE_GROWN, 'function ', 'saveDraft', 17, SPLIT_S, PP_Y);
    const sOvPub = createRef<Txt>();
    const sOvSav = createRef<Txt>();
    view.add(<>
        <Txt ref={sOvPub} text="publishPost" fontFamily={F_MONO} fontWeight={500} fill={DOMAIN}
            x={sPubStart.x} y={sPubStart.y} fontSize={FS * WORK_S} />
        <Txt ref={sOvSav} text="saveDraft" fontFamily={F_MONO} fontWeight={500} fill={DOMAIN}
            x={sSavStart.x} y={sSavStart.y} fontSize={FS * WORK_S} />
    </>);
    // hide block under the overlays; set it to the stations state/transform (invisible, instant)
    fn.node.opacity(0);
    fn.node.scale(SPLIT_S); fn.node.x(centerX(CODE_GROWN, SPLIT_S)); fn.node.y(PP_Y);
    yield* fn.morphTo(NAMES_ONLY, {addStyle: 'fade' as const, moveDuration: 0, removeDuration: 0, charDelay: 0,
        blockOrder: 'parallel' as const, lineOrder: 'parallel' as const, tokenSlideDuration: 0, scrollStrategy: 'block' as const});
    dressBlock(fn);

    // Anton: «перемещение имён при сплите быстрее» — names 0.7→0.45, the coupled cards/divider sped to match.
    const SGLIDE = 0.45;
    yield* all(
        sOvPub().x(sPubEnd.x, SGLIDE, linear), sOvPub().y(sPubEnd.y, SGLIDE, linear), sOvPub().fontSize(FS * SPLIT_S, SGLIDE, linear),
        sOvSav().x(sSavEnd.x, SGLIDE, linear), sOvSav().y(sSavEnd.y, SGLIDE, linear), sOvSav().fontSize(FS * SPLIT_S, SGLIDE, linear),
        divider().scale([1, 1], 0.33, easeOutCubic),
        card.node().x(0, 0.48, easeInOutCubic),
        card.node().y(PUB_CARD_Y, 0.48, easeInOutCubic),
        card.node().scale(CARD_S, 0.48, easeInOutCubic),
        card.ambient().shadowBlur(0, 0.3, easeInOutCubic),
        card.ambient().shadowOffset([0, 0], 0.3, easeInOutCubic),
        card.panel().shadowBlur(0, 0.3, easeInOutCubic),
        card.panel().shadowOffset([0, 0], 0.3, easeInOutCubic),
        (function* () {
            yield* waitFor(0.22);
            yield* all(
                draftCard.node().opacity(1, 0.3, easeOutCubic),
                draftCard.node().y(DRAFT_CARD_Y, 0.3, easeOutCubic),
                draftCard.ambient().shadowBlur(0, 0.24, easeInOutCubic),
                draftCard.ambient().shadowOffset([0, 0], 0.24, easeInOutCubic),
                draftCard.panel().shadowBlur(0, 0.24, easeInOutCubic),
                draftCard.panel().shadowOffset([0, 0], 0.24, easeInOutCubic),
            );
        })(),
    );
    // hand back to the block (NAMES_ONLY names sit exactly where the overlays ended), drop overlays
    fn.node.opacity(1); dressBlock(fn);
    sOvPub().remove(); sOvSav().remove();
    yield* waitFor(0.32);   // brief hold — both cards + the two bare method names — then bodies grow

    // (3) GROW — function/params/bodies + the close brace TYPE IN around each planted name. Names
    // stay fixed (column 9); x is unchanged. Structure sprouts around them.
    yield* all(
        fn.morphTo(CODE_GROWN, GROW_OPTS),
        fn.node.y(PP_Y, 0.7, easeInOutCubic),
    );
    dressBlock(fn);   // publish/save come up blue from the first frame (RULES, onlyTypes:'method')
    yield* waitFor(1.4);

    // ════════════════════════════════════════════════════════════════
    //  RE-MERGE — the SPLIT run BACKWARDS (GROW⁻¹ → MOVE⁻¹ → STRIP⁻¹). Not a lazy cross-fade:
    //  the two functions shrink back to their bare NAMES, the names glide together, and savePost
    //  re-forms around them — reusing the very same STRIPPED / NAMES_ONLY states as the split.
    //  Cards + divider leave on the first beat.
    // ════════════════════════════════════════════════════════════════
    const MERGE_S = WORK_S;
    const MERGE_TOP = -670;   // signature high — the method GROWS DOWN as logic piles on (final 29 lines
                              // incl. the inner-if framing blanks, centred about y=0). Top-anchored: line 0 stays.

    // The block-transform model (screen = node + scale·local) BENDS a token's path whenever scale
    // changes mid-move (the Δscale·Δlocal cross-term is quadratic in t) — THAT was «имена летят по
    // кривой». So we don't move the names through the block at all: we lift the two NAMES onto overlay
    // Txt nodes and glide them in a perfectly STRAIGHT line with LINEAR easing, fontSize shrinking
    // LINEARLY (Anton: «линейно, по прямой, метод уменьшается во время движения»). The block fades out
    // beneath them (the functions retract) and re-appears as merged savePost exactly where they land.
    const pubStart = nameC(CODE_GROWN, 'function ', 'publishPost', 2, SPLIT_S, PP_Y);
    const savStart = nameC(CODE_GROWN, 'function ', 'saveDraft', 17, SPLIT_S, PP_Y);
    const pubEnd = nameC(CODE_FLAG, '        return ', 'publishPost', 2, MERGE_S, MERGE_TOP);
    const savEnd = nameC(CODE_FLAG, '    return ', 'saveDraft', 5, MERGE_S, MERGE_TOP);
    const ovPub = createRef<Txt>();
    const ovSav = createRef<Txt>();
    view.add(<>
        <Txt ref={ovPub} text="publishPost" fontFamily={F_MONO} fontWeight={500} fill={DOMAIN}
            x={pubStart.x} y={pubStart.y} fontSize={FS * SPLIT_S} />
        <Txt ref={ovSav} text="saveDraft" fontFamily={F_MONO} fontWeight={500} fill={DOMAIN}
            x={savStart.x} y={savStart.y} fontSize={FS * SPLIT_S} />
    </>);

    // (1) RETRACT — the two functions dissolve (block fades to 0); the names persist (overlays sit
    //     exactly over them, so they stay lit while the structure fades). Cards + divider leave.
    yield* all(
        fn.node.opacity(0, 0.3, linear),
        card.node().opacity(0, 0.34, linear),
        draftCard.node().opacity(0, 0.34, linear),
        divider().opacity(0, 0.28, linear),
    );
    // hand the (now invisible) block to the merged STATE/transform instantly — no flicker, no anim
    fn.node.scale(MERGE_S); fn.node.x(centerX(CODE_FLAG, MERGE_S)); fn.node.y(MERGE_TOP);
    yield* fn.morphTo(STRIPPED, {addStyle: 'fade' as const, moveDuration: 0, removeDuration: 0, charDelay: 0,
        blockOrder: 'parallel' as const, lineOrder: 'parallel' as const, tokenSlideDuration: 0, scrollStrategy: 'block' as const});
    dressBlock(fn);

    // (2) GLIDE — the two names travel in a STRAIGHT line, LINEARLY, shrinking linearly.
    //     Anton: «перемещение имён при мердже быстрее» — tightened 0.8→0.55→0.4.
    const GLIDE = 0.4;
    yield* all(
        ovPub().x(pubEnd.x, GLIDE, linear), ovPub().y(pubEnd.y, GLIDE, linear), ovPub().fontSize(FS * MERGE_S, GLIDE, linear),
        ovSav().x(savEnd.x, GLIDE, linear), ovSav().y(savEnd.y, GLIDE, linear), ovSav().fontSize(FS * MERGE_S, GLIDE, linear),
    );
    // hand back to the block (its STRIPPED names sit exactly where the overlays ended); drop overlays
    fn.node.opacity(1); dressBlock(fn);
    ovPub().remove(); ovSav().remove();
    yield* waitFor(0.1);

    // (3) FRAME — the savePost body re-forms as ONE cascade (Anton: «не две анимации появления кода
    //     вокруг имён»). Build the whole body INSTANTLY (0 frames), then reveal top→bottom in a SINGLE
    //     sequence: structural lines drop in from above; the two name lines are anchors kept VISIBLE but
    //     DIM (a faint placeholder, never a bright bare word) until the cascade reaches them, then they
    //     BRIGHTEN and gain their return/(post) wrappers in the same beat. So nothing pops separately —
    //     the body materialises around the names as one continuous motion.
    yield* fn.morphTo(CODE_FLAG, BODY_BUILD);   // instant build (moveDuration 0 / parallel) — no flash
    dressBlock(fn);
    const MERGE_NAMES = new Set(['publishPost', 'saveDraft']);
    const reform: ThreadGenerator[] = [];
    for (let i = 0; i < fn.lineCount; i++) {
        const ln = fn.getLine(i);
        if (!ln || ln.tokens.length === 0) continue;   // skip blank lines
        const nameTok = ln.tokens.find(t => MERGE_NAMES.has(t.text));
        if (nameTok) {
            const wraps = ln.tokens.filter(t => !MERGE_NAMES.has(t.text));
            nameTok.ref().opacity(0.28);                 // faint placeholder until this line's turn
            for (const t of wraps) t.ref().opacity(0);
            reform.push(all(
                nameTok.ref().opacity(1, 0.26, easeOutCubic),
                ...wraps.map(t => t.ref().opacity(1, 0.26, easeOutCubic)),
            ));
        } else {
            const restY = ln.node.y();
            ln.node.opacity(0); ln.node.y(restY - 20);
            reform.push(all(ln.node.opacity(1, 0.2, easeOutCubic), ln.node.y(restY, 0.26, easeOutCubic)));
        }
    }
    yield* sequence(0.07, ...reform);
    yield* waitFor(1.0);

    // ════════════════════════════════════════════════════════════════
    //  DOWNSIDE #1 — each logical block lives its own life. The stripes do NOT replace any code;
    //  they ADD new lines. In each block 3 REAL lines pile on ONE AT A TIME, then placeholder STRIPES
    //  below them — if-block in the reference cream (solid INK), outside in warm tan. A blank line sits
    //  before each `return` (отступ). The signature stays put; everything below is pushed DOWN.
    //  CADENCE matched to the reference Beat-7 (Anton: «не соответствует стилю и скорости референса»):
    //  real lines fade in one-at-a-time on a tight constant beat (the body slides down — «выпадание»);
    //  stripes grow 0.12s easeOutCubic, left-anchored, BACK-TO-BACK, and the gap that holds them OPENS
    //  in the SAME `all` as the grow (exactly как merged.morphTo+bar-loop in the reference).
    // ════════════════════════════════════════════════════════════════
    const LINE_DELAY = 0.12;
    const BAR_GROW = 0.12;
    const ADD_SEQ = {
        addStyle: 'fade' as const, moveDuration: 0.28, removeDuration: 0, charDelay: 0,
        blockOrder: 'parallel' as const, lineOrder: 'sequential' as const, lineDelay: LINE_DELAY,
        tokenSlideDuration: 0, scrollStrategy: 'block' as const,
    };
    const ADD_SLOTS = {
        addStyle: 'fade' as const, moveDuration: 0.3, removeDuration: 0, charDelay: 0,
        blockOrder: 'parallel' as const, lineOrder: 'parallel' as const,
        tokenSlideDuration: 0, scrollStrategy: 'block' as const,
    };
    // Code states — each ADDS lines (returns shift down, never rewritten). A blank line precedes
    // every return; stripe slots open BETWEEN the real lines and that blank. The bloat is WIDER, more
    // realistic code (Anton: «тело замени, придумай более широкий код»), and the inline guards are
    // PROPER braced blocks with indentation (Anton: «блок if {} пишем правильно — с отступами»).
    // The INNER if-blocks (post.scheduled / post.collaborators) are framed with a blank line BEFORE and
    // AFTER (Anton «выдели if блоки отступами, кроме первого») — the trailing blank also serves as the
    // gap before the stripes/return. The FIRST `if (publish)` is NOT framed (sits under the signature).
    const SIG = 'function savePost(post: Post, publish: boolean) {';
    const BIF = '    if (publish) {';
    const IF_BODY = [
        '        const url = buildPublicUrl(post, locale)',
        '        await notifySubscribers(post.author)',
        '',                                              // отступ before the inner if
        '        if (post.scheduled) {',
        '            queuePublication(post, post.runAt)',
        '        }',
        '',                                              // отступ after the inner if
    ];
    const OUT_BODY = [
        '    const snapshot = serializeDraft(post, rev)',
        '    await persistAutosave(snapshot, workspace)',
        '',                                              // отступ before the inner if
        '    if (post.collaborators) {',
        '        broadcastChanges(post, post.team)',
        '    }',
        '',                                              // отступ after the inner if
    ];
    const C_IF_REAL = [
        SIG, BIF, ...IF_BODY,
        '        return publishPost(post)', '    }',
        '',
        '    return saveDraft(post)', '}',
    ].join('\n');
    const C_IF_SLOTS = [
        SIG, BIF, ...IF_BODY,
        '', '', '',                                              // 9,10,11  if-stripe slots
        '',
        '        return publishPost(post)', '    }',
        '',
        '    return saveDraft(post)', '}',
    ].join('\n');
    const C_OUT_REAL = [
        SIG, BIF, ...IF_BODY,
        '', '', '',
        '',
        '        return publishPost(post)', '    }',
        '',
        ...OUT_BODY,
        '    return saveDraft(post)', '}',
    ].join('\n');
    const C_OUT_SLOTS = [
        SIG, BIF, ...IF_BODY,
        '', '', '',
        '',
        '        return publishPost(post)', '    }',
        '',
        ...OUT_BODY,
        '', '', '',                                              // 23,24,25  out-stripe slots
        '',
        '    return saveDraft(post)', '}',
    ].join('\n');

    // stripes ride the code's grid (same x/y/scale as fn). if-stripes at lines 9,10,11 (indent 8);
    // out-stripes at 23,24,25 (indent 4). Insertions are always BELOW existing stripes → no stripe
    // ever moves. Solid bars (reference style); created width 0, grown back-to-back (easeOutCubic).
    // Widths bumped «чуть шире» to sit with the wider real code.
    const STR_LH = 53.2;
    const ind8 = textWidth('        ', F_MONO, FS);
    const ind4 = textWidth('    ', F_MONO, FS);
    const IF_L  = [9, 10, 11];
    const OUT_L = [23, 24, 25];
    const IF_W  = [760, 840, 600];
    const OUT_W = [840, 700, 910];
    const barsNode = createRef<Node>();
    const ifR: Reference<Rect>[] = [];
    const outR: Reference<Rect>[] = [];
    view.add(
        <Node ref={barsNode} x={centerX(CODE_FLAG, MERGE_S)} y={MERGE_TOP} scale={MERGE_S}>
            {IF_L.map((l, i) => {
                const r = createRef<Rect>(); ifR.push(r);
                return <Rect ref={r} width={0} height={14} radius={5} fill={BAR_IF}
                    offset={[-1, 0]} x={LEFT_LOCAL + ind8} y={l * STR_LH} />;
            })}
            {OUT_L.map((l, i) => {
                const r = createRef<Rect>(); outR.push(r);
                return <Rect ref={r} width={0} height={14} radius={5} fill={BAR_OUT}
                    offset={[-1, 0]} x={LEFT_LOCAL + ind4} y={l * STR_LH} />;
            })}
        </Node>,
    );

    // IF-BLOCK grows first: 3 real lines drop in one-at-a-time (body slides down) and flow STRAIGHT into
    // the stripes — NO pause (Anton: «без паузы перед полосками»). The gap OPENS and the 3 stripes grow
    // into it back-to-back, gap-open + stripe-grow in one `all` (reference), continuous with the lines.
    yield* fn.morphTo(C_IF_REAL, ADD_SEQ);
    dressBlock(fn);
    yield* all(
        fn.morphTo(C_IF_SLOTS, ADD_SLOTS),
        (function* (): ThreadGenerator {
            for (let i = 0; i < ifR.length; i++) yield* ifR[i]().width(IF_W[i], BAR_GROW, easeOutCubic);
        })(),
    );
    dressBlock(fn);

    // OUTSIDE block flows STRAIGHT on from the if-block — NO pause between (Anton: «между появлением кода
    // блока if и далее паузы не делай»). 3 real lines one at a time → 3 (tan) stripes, all continuous.
    yield* fn.morphTo(C_OUT_REAL, ADD_SEQ);
    dressBlock(fn);
    yield* all(
        fn.morphTo(C_OUT_SLOTS, ADD_SLOTS),
        (function* (): ThreadGenerator {
            for (let i = 0; i < outR.length; i++) yield* outR[i]().width(OUT_W[i], BAR_GROW, easeOutCubic);
        })(),
    );
    dressBlock(fn);
    yield* waitFor(1.8);
});
