import {Node, Rect, Txt, blur, makeScene2D} from '@motion-canvas/2d';
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
const F_SANS  = 'Space Grotesk, Inter, sans-serif';   // product-UI chrome

const VIEW_W = 1080;
const VIEW_H = 1920;

const BG       = '#151A28';
const INK      = '#E7E1D6';
const KEY      = '#CAB4EA';
const DOMAIN   = '#8AC7EF';
const TYPE_CLR = 'rgba(213, 209, 245, 0.92)';   // types (boolean, string…) — distinct from method blue & keyword lilac
const STRING   = '#A8CF98';
const PUNC     = '#D2D8E2';
const OPERATOR = '#8F9AAA';
const HERO     = '#E7E1D6';
const ACCENT   = '#E8C656';
const QUIET    = 'rgba(231, 225, 214, 0.50)';
const GHOST    = 'rgba(231, 225, 214, 0.60)';
const GOLD_QUIET = '#DDBF5C';   // muted gold — warmth without RGB-cheapening the palette
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
    {match: /^(boolean|string|number)$/, color: TYPE_CLR},
    {match: /^(saveFile|writeNewFile|overwriteFile|disk)$/, color: DOMAIN},
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
const NAME_ONLY = `saveFile()`;

// Two parameters resolve inside the parens. Still honest: a path, its content.
const SIGNATURE = `saveFile(path, content)`;

// One boolean, typed in as a foreign element the name never accounted for.
const SIGNATURE_FLAG = `saveFile(path, content, overwrite: boolean)`;

// The body the name hides: save means write a new file — unless the flag is
// set, and then it doesn't save, it overwrites what was already there. (No
// `function` keyword anywhere — the hero is the bare name, so every morph keeps
// its left edge fixed; reads as a method.)
const CODE_FLAG = `saveFile(path, content, overwrite) {
    if (overwrite) {
        return overwriteFile(path, content)
    }
    return writeNewFile(path, content)
}`;

const CALL_TRUE  = `saveFile(path, content, true)`;
const CALL_FALSE = `saveFile(path, content, false)`;

// The split: one flagged call → two honest names. The boolean's meaning
// migrates into the name; the `, true/false` argument dissolves.
const SPLIT_NAMES = `writeNewFile(path, content)
overwriteFile(path, content)`;

const CODE_AFTER = `writeNewFile(path, content) {
    return disk.create(path, content)
}

overwriteFile(path, content) {
    return disk.replace(path, content)
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

// Flare a single token (by text) on a given line to a colour, then back.
function* flareToken(
    block: Manticore, lineIdx: number, text: string, color: string, back: string,
    upDur = 0.24, downDur = 0.4, hold = 0.3,
): ThreadGenerator {
    const tok = block.getLine(lineIdx)?.tokens.find(t => t.text === text)?.ref();
    if (!tok) return;
    yield* tok.fill(color, upDur, easeOutCubic);
    yield* waitFor(hold);
    yield* tok.fill(back, downDur, easeInCubic);
}

// ── Premium product cards — the import dialog, one flag apart ─────────
// House card vocabulary (cf. whatsappCodePairSceneEn): an elevated rounded
// panel with a soft drop-shadow, a leading app-glyph + title + handle + close,
// a clean record list, and a footer with the outcome count and a Publish-style
// pill. Premium is built STILL, not animated — no counters ticking, no rules
// sweeping, no glow. The two cards differ only by material + final state: the
// preview draft (translucent, preview: true, 0 written) vs the committed run
// (solid + elevated, preview: false, 1,000 written). Same call, opposite
// outcome, read at a glance.
const RECORDS: {id: string; name: string}[] = [
    {id: '0418', name: 'Avery Brooks'},
    {id: '0419', name: 'Mara Quinn'},
    {id: '0420', name: 'Devon Hale'},
];

const CARD_W      = 660;
const CARD_H      = 340;
const CARD_PAD    = 36;
const CARD_RADIUS = 30;
const RULE_W      = CARD_W - CARD_PAD * 2;            // 588

const HEADER_CY = -CARD_H / 2 + 52;                  // -118
const TILE_X    = -CARD_W / 2 + CARD_PAD + 25;       // -269
const TITLE_X   = TILE_X + 45;                       // -224
const CLOSE_X   = CARD_W / 2 - CARD_PAD - 8;         //  286
const ROW0_Y    = HEADER_CY + 80;                    //  -38
const ROW_GAP   = 42;
const LIST_X    = -CARD_W / 2 + CARD_PAD + 8;        // -286
const NAME_X2   = -176;
const DIVIDER_Y = 88;
const FOOTER_CY = CARD_H / 2 - 44;                   //  126
const NUM_RIGHT = -176;                              // count, right-anchored
const LABEL_X   = -160;                              // "rows written", left-anchored
const PILL_W    = 156;
const PILL_H    = 54;
const PILL_X    = CARD_W / 2 - CARD_PAD - PILL_W / 2; // 216

type Card = {
    node: Reference<Node>;
    jsx: any;
};

function buildCard(o: {
    y: number; variant: 'preview' | 'run';
    handle: string; pillText: string; countText: string;
}): Card {
    const run = o.variant === 'run';

    // Material — solid+elevated (run) vs frosted+lighter draft (preview). The
    // difference is stated, not animated: it lives in material + final state.
    const panelFill   = run ? '#1B2233' : 'rgba(231,225,214,0.05)';
    const panelStroke = run ? 'rgba(231,225,214,0.10)' : 'rgba(231,225,214,0.16)';
    const shadowCol   = run ? 'rgba(0,0,0,0.50)' : 'rgba(0,0,0,0.18)';
    const shadowBlurV = run ? 46 : 22;
    const shadowOff: [number, number] = run ? [0, 24] : [0, 12];

    const titleFill  = run ? INK : GHOST;
    const handleFill = run ? KEY : 'rgba(202,180,234,0.55)';
    const idFill     = run ? QUIET : 'rgba(231,225,214,0.28)';
    const nameFill   = run ? INK : GHOST;
    const countFill  = run ? INK : QUIET;

    const tileFill   = run ? 'rgba(231,225,214,0.10)' : 'rgba(231,225,214,0.05)';
    const tileStroke = run ? 'rgba(231,225,214,0.20)' : 'rgba(231,225,214,0.13)';
    const tileMark   = run ? 'rgba(231,225,214,0.82)' : QUIET;

    const pillFill      = run ? INK : 'rgba(231,225,214,0.09)';
    const pillStroke    = run ? 'rgba(0,0,0,0)' : 'rgba(231,225,214,0.22)';
    const pillLabelFill = run ? BG : QUIET;
    const pillShadow    = run ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0)';

    const node = createRef<Node>();

    const jsx = (
        <Node ref={node} y={o.y}>
            {/* elevated panel */}
            <Rect width={CARD_W} height={CARD_H} radius={CARD_RADIUS}
                fill={panelFill} stroke={panelStroke} lineWidth={1}
                shadowColor={shadowCol} shadowBlur={shadowBlurV} shadowOffset={shadowOff} />

            {/* header — app-glyph tile + title + handle + close */}
            <Rect x={TILE_X} y={HEADER_CY} width={50} height={50} radius={13}
                fill={tileFill} stroke={tileStroke} lineWidth={1}>
                <Rect y={-7} width={22} height={3} radius={1.5} fill={tileMark} />
                <Rect y={0}  width={22} height={3} radius={1.5} fill={tileMark} />
                <Rect y={7}  width={15} height={3} radius={1.5} fill={tileMark} />
            </Rect>
            <Txt text="Import customers" fontFamily={F_SANS} fontSize={27} fontWeight={600}
                letterSpacing={-0.3} fill={titleFill} offset={[-1, 0]} x={TITLE_X} y={HEADER_CY - 11} />
            <Txt text={o.handle} fontFamily={F_MONO} fontSize={18} fontWeight={500}
                fill={handleFill} offset={[-1, 0]} x={TITLE_X} y={HEADER_CY + 14} />
            <Node x={CLOSE_X} y={HEADER_CY}>
                <Rect width={20} height={2} radius={1} fill={QUIET} rotation={45} />
                <Rect width={20} height={2} radius={1} fill={QUIET} rotation={-45} />
            </Node>

            {/* record list — clean and airy, no row rules */}
            {RECORDS.map((rec, i) => {
                const ry = ROW0_Y + i * ROW_GAP;
                return (
                    <Node y={ry}>
                        <Txt text={rec.id} fontFamily={F_MONO} fontSize={19} fontWeight={500}
                            fill={idFill} offset={[-1, 0]} x={LIST_X} y={1} />
                        <Txt text={rec.name} fontFamily={F_SANS} fontSize={23} fontWeight={450}
                            letterSpacing={-0.1} fill={nameFill} offset={[-1, 0]} x={NAME_X2} />
                    </Node>
                );
            })}

            {/* footer — divider, outcome count, Publish-style pill */}
            <Rect width={RULE_W} height={1} fill="rgba(231,225,214,0.10)" y={DIVIDER_Y} />
            <Txt text={o.countText}
                fontFamily={F_MONO} fontSize={27} fontWeight={500}
                fill={countFill} offset={[1, 0]} x={NUM_RIGHT} y={FOOTER_CY} />
            <Txt text="rows written" fontFamily={F_SANS} fontSize={15} fontWeight={400}
                letterSpacing={0.5} fill={QUIET} offset={[-1, 0]} x={LABEL_X} y={FOOTER_CY + 1} />
            <Rect width={PILL_W} height={PILL_H} radius={PILL_H / 2}
                fill={pillFill} stroke={pillStroke} lineWidth={1.4}
                shadowColor={pillShadow} shadowBlur={16} shadowOffset={[0, 6]}
                x={PILL_X} y={FOOTER_CY}>
                <Txt text={o.pillText} fontFamily={F_SANS} fontSize={21} fontWeight={600}
                    letterSpacing={-0.2} fill={pillLabelFill} />
            </Rect>
        </Node>
    );
    return {node, jsx};
}

// ── Subtitle typing (static `//` + typed body) ───────────────────────
function* typeBody(ref: Reference<Txt>, body: string, charDelay = 0.03): ThreadGenerator {
    ref().text('');
    for (let i = 1; i <= body.length; i++) {
        ref().text(body.substring(0, i));
        yield* waitFor(charDelay);
    }
}

function* swapSub(ref: Reference<Txt>, body: string): ThreadGenerator {
    ref().text('');
    yield* waitFor(0.08);
    yield* typeBody(ref, body);
}

function* awaitFontsReady(): ThreadGenerator {
    if (typeof document === 'undefined') return;
    try {
        document.fonts.load(`400 32px "JetBrains Mono"`);
        document.fonts.load(`500 32px "JetBrains Mono"`);
        document.fonts.load(`400 120px "Newsreader"`);
        document.fonts.load(`italic 400 120px "Newsreader"`);
        document.fonts.load(`500 29px "Space Grotesk"`);
        document.fonts.load(`600 29px "Space Grotesk"`);
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
    view.add(<Txt text="ISSUE 02"
        fontFamily={F_SERIF} fontSize={20} fontWeight={500}
        letterSpacing={4} fill={HERO} y={820} />);

    // Subtitle: static `//` + typed body, left-aligned at a fixed x.
    const SUB_Y = 705;
    const SUB_X = -250;
    const SUB_FS = 37;
    const SLASH_W = 67;
    const subSlashes = createRef<Txt>();
    const subBody = createRef<Txt>();
    view.add(<Txt ref={subSlashes} text="// "
        fontFamily={F_MONO} fontSize={SUB_FS} fontWeight={500}
        fill={ACCENT} offset={[-1, 0]} x={SUB_X} y={SUB_Y} opacity={0} />);
    view.add(<Txt ref={subBody} text=""
        fontFamily={F_MONO} fontSize={SUB_FS} fontWeight={500}
        fill={ACCENT} offset={[-1, 0]} x={SUB_X + SLASH_W} y={SUB_Y} opacity={0} />);

    // ════════════════════════════════════════════════════════════════
    //  Act 1 — THE NAME  (cold open: an honest name, then the lie)
    // ════════════════════════════════════════════════════════════════
    // ONE block, morphed — never replaced (cf. velvetCartReminder Beat 7). The
    // method NAME with parens enters large and alone (a promise of what it does),
    // SHRINKS a little as two parameters resolve inside the parens, then the
    // boolean parameter TYPES in as a foreign element. The name loses its
    // authority — the gold flag is the only thing left lit — and the body grows
    // out of the same line to prove it. Yudan-manner entrance (cf.
    // chapter1YudanSceneEn): focal hero, scale down through stages, then a typed
    // token. saveFile() → +params → type flag → lie → body. Nothing teleports.
    const OPEN_FADE = {
        addStyle: 'fade' as const, moveDuration: 0.5, removeDuration: 0.3,
        blockOrder: 'parallel' as const, lineOrder: 'parallel' as const,
    };
    // The flag is TYPED in. tokenSlideDuration 0 is the whole trick: a kept close
    // paren that sits AFTER the insertion point is hidden and RE-TYPED last (when
    // sliding it would instead glide ahead of the cursor and leave a gap). So the
    // params type strictly left-to-right with nothing to the cursor's right — no
    // pre-parked bracket, no hole. The recentre is COUPLED to the typing by the
    // caller (same all()), so the line grows outward from centre, never lurching.
    const BOOL_TYPE = {
        addStyle: 'typewriter' as const, charDelay: 0.05, lineDelay: 0,
        moveDuration: 0.4, removeDuration: 0.2, tokenSlideDuration: 0,
        blockOrder: 'parallel' as const, lineOrder: 'parallel' as const,
    };
    // The method enters CENTERED: each state is positioned so its content sits
    // in the middle of the frame (Yudan-manner), not pinned to the left margin.
    // centerX solves node.x from the measured content width; the body centres on
    // its widest line (so the block, not just line 0, reads as centred).
    const FS = 38;                                          // larger working size
    const LEFT_LOCAL = -1100 / 2 + getCodePaddingX(FS);    // local x where text starts
    const HERO_SCALE = 1.8;
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
    yield* waitFor(0.5);
    subSlashes().opacity(1);
    subBody().opacity(1);
    yield* typeBody(subBody, 'a name is a promise');
    yield* waitFor(0.7);

    // 2 — shrink a little; two parameters resolve inside the parens.
    yield* all(
        fn.morphTo(SIGNATURE, OPEN_FADE),
        fn.node.scale(1, 0.7, easeInOutCubic),
        fn.node.x(centerX(SIGNATURE, 1), 0.7, easeInOutCubic),
    );
    dressBlock(fn);
    yield* waitFor(0.7);

    // 3 — the boolean parameter TYPES in — a foreign element. (Add one boolean —)
    // No standalone re-centre: the shift rides WITH the typing in one all(), so
    // the line expands outward from centre as it grows. Ends centred → no overflow.
    yield* swapSub(subBody, 'add one boolean');
    yield* all(
        fn.morphTo(SIGNATURE_FLAG, BOOL_TYPE),
        fn.node.x(centerX(SIGNATURE_FLAG, 1), 1.0, easeInOutCubic),
    );
    dressBlock(fn);
    yield* waitFor(0.5);

    // 4 — the name starts to lie: structure recedes, the name loses its glow,
    // and the gold flag is the only thing still lit.
    const sigLine = fn.getLine(0);
    const nameTok = sigLine?.tokens.find(t => t.text === 'saveFile')?.ref();
    const owTok   = sigLine?.tokens.find(t => t.text === 'overwrite')?.ref();
    const boolTok = sigLine?.tokens.find(t => t.text === 'boolean')?.ref();
    const lieDim: ThreadGenerator[] = [];
    if (sigLine) for (const t of sigLine.tokens) {
        if (t.text === 'saveFile' || t.text === 'overwrite' || t.text === 'boolean') continue;
        lieDim.push(t.ref().opacity(DIM_OP, 0.5));
    }
    yield* all(
        ...lieDim,
        nameTok?.opacity(0.45, 0.5) ?? waitFor(0),
        nameTok?.shadowBlur(0, 0.5) ?? waitFor(0),
        owTok?.fill(ACCENT, 0.5, easeOutCubic) ?? waitFor(0),
        boolTok?.fill(ACCENT, 0.5, easeOutCubic) ?? waitFor(0),
        swapSub(subBody, 'the name starts to lie'),
    );
    yield* waitFor(1.5);

    // 5 — the body grows out of the same line: one name, two paths, one of which
    // overwrites. Relight the signature, morph 1 → 6 lines, and recenter as it
    // grows (morphTo holds line 0 fixed and adds lines below — so lift the block).
    const relightSig = (fn.getLine(0)?.tokens ?? []).map(t => t.ref().opacity(1, 0.45));
    yield* all(
        ...relightSig,
        fn.morphTo(CODE_FLAG, OPEN_FADE),
        fn.node.x(centerX(CODE_FLAG, 1), 0.6, easeInOutCubic),
        fn.node.y(-135, 0.6, easeInOutCubic),
        swapSub(subBody, 'two paths, one name'),
    );
    dressBlock(fn);
    yield* waitFor(0.4);

    // The switch, then the two paths it routes between.
    const IF_LINE  = 1;
    const RET_OVER = 2;
    const RET_NEW  = 4;
    yield* flareToken(fn, IF_LINE, 'overwrite', ACCENT, INK);
    yield* spotlight(fn, [IF_LINE], 0.4);
    yield* waitFor(0.4);
    yield* spotlight(fn, [RET_OVER, RET_NEW], 0.45);
    yield* waitFor(0.9);
    yield* fn.showAllLines(0.4);
    yield* waitFor(0.4);

    // ════════════════════════════════════════════════════════════════
    //  Act 2 — THE PHYSICS  (what the two branches really do)
    // ════════════════════════════════════════════════════════════════
    // Two product cards, the same import dialog one flag apart, shown STILL.
    // No counters tick, no rules sweep, no glow — the contrast lives in the
    // final state. Top: the preview draft (preview: true, 0 written). Bottom:
    // the committed run (preview: false, 1,000 written). Identical call,
    // opposite outcome — read at a glance.

    const PREVIEW_Y = -355;
    const RUN_Y     =  315;

    const preview = buildCard({
        y: PREVIEW_Y, variant: 'preview',
        handle: 'preview: true', pillText: 'Preview', countText: '0',
    });
    const run = buildCard({
        y: RUN_Y, variant: 'run',
        handle: 'preview: false', pillText: 'Run import', countText: '1,000',
    });
    view.add(preview.jsx);
    view.add(run.jsx);
    preview.node().opacity(0);
    run.node().opacity(0);

    // Hand off from code to cards — a quiet crossfade, nothing more.
    yield* all(
        fn.node.opacity(0, 0.5, easeInCubic),
        fnBlur(6, 0.5, easeInCubic),
        subSlashes().opacity(0, 0.4, easeInCubic),
        subBody().opacity(0, 0.4, easeInCubic),
    );
    fn.node.remove();

    // The two states simply appear, together, and hold. No motion inside them.
    yield* all(
        run.node().opacity(1, 0.7, easeOutCubic),
        preview.node().opacity(1, 0.7, easeOutCubic),
    );
    yield* waitFor(0.5);

    subSlashes().opacity(1);
    subBody().opacity(1);
    yield* typeBody(subBody, 'one flag, two outcomes');

    // Hold the still contrast — this is the beat.
    yield* waitFor(3.0);

    // Clear.
    yield* all(
        run.node().opacity(0, 0.6, easeInCubic),
        preview.node().opacity(0, 0.6, easeInCubic),
        subSlashes().opacity(0, 0.5, easeInCubic),
        subBody().opacity(0, 0.5, easeInCubic),
    );
    run.node().remove();
    preview.node().remove();

    // ════════════════════════════════════════════════════════════════
    //  Act 3 — THE DECEPTION  (one bit apart)
    // ════════════════════════════════════════════════════════════════
    // Two worlds — nothing vs everything — triggered by a single true/false.
    const callTrue  = makeBlock({code: CALL_TRUE,  y: -42, fontSize: 36, lineHeight: 46, width: 900, noClip: true});
    const callFalse = makeBlock({code: CALL_FALSE, y:  42, fontSize: 36, lineHeight: 46, width: 900, noClip: true});
    callTrue.mount(view);
    callFalse.mount(view);
    dressBlock(callTrue);
    dressBlock(callFalse);
    callTrue.node.opacity(0);
    callFalse.node.opacity(0);

    yield* all(
        callTrue.node.opacity(1, 0.5, easeOutCubic),
        callFalse.node.opacity(1, 0.5, easeOutCubic),
    );
    subSlashes().opacity(1);
    yield* typeBody(subBody, 'the same call');
    yield* waitFor(0.6);

    // Everything identical but one word. Dim the rest; the flag carries it all.
    const dimAroundFlag = (block: Manticore): ThreadGenerator[] => {
        const ops: ThreadGenerator[] = [];
        const line = block.getLine(0);
        if (line) {
            for (const t of line.tokens) {
                if (t.text === 'true' || t.text === 'false') continue;
                ops.push(t.ref().opacity(DIM_OP, 0.4));
            }
        }
        return ops;
    };
    yield* all(
        ...dimAroundFlag(callTrue),
        ...dimAroundFlag(callFalse),
        callTrue.getLine(0)?.tokens.find(t => t.text === 'true')?.ref().fill(ACCENT, 0.4) ?? waitFor(0),
        callFalse.getLine(0)?.tokens.find(t => t.text === 'false')?.ref().fill(ACCENT, 0.4) ?? waitFor(0),
        swapSub(subBody, 'one bit apart'),
    );
    yield* waitFor(1.4);

    // Restore, fade the false call — we'll fix the true one.
    const relight = (block: Manticore): ThreadGenerator[] =>
        (block.getLine(0)?.tokens ?? []).map(t => t.ref().opacity(1, 0.4));
    yield* all(
        ...relight(callTrue),
        callTrue.getLine(0)?.tokens.find(t => t.text === 'true')?.ref().fill(KEY, 0.4) ?? waitFor(0),
        callFalse.node.opacity(0, 0.5, easeInCubic),
        subSlashes().opacity(0, 0.4, easeInCubic),
        subBody().opacity(0, 0.4, easeInCubic),
    );
    callFalse.node.remove();

    // ════════════════════════════════════════════════════════════════
    //  Act 4 — THE SPLIT  (the fix, at the call site)
    // ════════════════════════════════════════════════════════════════
    const NO_SCROLL = {blockOrder: 'parallel' as const, lineOrder: 'parallel' as const};
    const MORPH_FADE = {addStyle: 'fade' as const, moveDuration: 0.45, removeDuration: 0.25, ...NO_SCROLL};

    // Centre the surviving call.
    yield* callTrue.node.y(0, 0.4, easeInOutCubic);
    yield* waitFor(0.3);

    // The boolean flares one last time, then the call splits in two: its meaning
    // moves into the name (true → preview, the other path → run) and the flag
    // argument dissolves. One parallel morph, 1 → 2 — the split, not a shuffle.
    yield* flareToken(callTrue, 0, 'true', ACCENT, ACCENT, 0.24, 0.2, 0.35);
    yield* all(
        callTrue.morphTo(SPLIT_NAMES, MORPH_FADE),
        callTrue.node.y(-23, 0.45, easeInOutCubic),   // recentre 1 → 2 lines
    );
    callTrue.colorize(RULES);
    applyGlow(callTrue);

    subSlashes().opacity(1);
    subBody().opacity(1);
    yield* typeBody(subBody, 'no flag to hide behind');
    yield* waitFor(1.3);

    // Grow the two honest functions. No if, no flag — the name is the truth.
    const after = makeBlock({code: CODE_AFTER, y: 0, fontSize: 32, lineHeight: 46, width: 1100, noClip: true});
    after.mount(view);
    dressBlock(after);
    after.node.opacity(0);
    after.node.y(18);

    yield* all(
        callTrue.node.opacity(0, 0.5, easeInCubic),
        callTrue.node.y(-70, 0.5, easeInCubic),
        after.node.opacity(1, 0.7, easeOutCubic),
        after.node.y(0, 0.7, easeOutCubic),
        subSlashes().opacity(0, 0.4, easeInCubic),
        subBody().opacity(0, 0.4, easeInCubic),
    );
    callTrue.node.remove();
    yield* waitFor(0.5);

    // Settle the eye on each honest name in turn.
    yield* spotlight(after, [0, 1, 2], 0.4);
    yield* waitFor(0.7);
    yield* spotlight(after, [4, 5, 6], 0.45);
    yield* waitFor(0.7);
    yield* after.showAllLines(0.4);
    yield* waitFor(0.8);

    yield* after.node.opacity(0, 0.7, easeInOutCubic);
    after.node.remove();

    // ════════════════════════════════════════════════════════════════
    //  Act 5 — FIELD NOTE  (the verdict)
    // ════════════════════════════════════════════════════════════════
    const eyebrow = createRef<Txt>();
    const condA = createRef<Txt>();
    const condB = createRef<Txt>();
    const conclA = createRef<Txt>();
    const conclB = createRef<Txt>();

    view.add(<Txt ref={eyebrow}
        fontFamily={F_SERIF} fontSize={30} fontWeight={500}
        letterSpacing={5} fill={QUIET} textAlign="center" y={-210} opacity={0}>
        FIELD NOTE
    </Txt>);
    view.add(<Txt ref={condA}
        fontFamily={F_SERIF} fontSize={56} fontWeight={500}
        fill={INK} textAlign="center" y={-96} opacity={0}>
        A boolean flag is the cheapest
    </Txt>);
    view.add(<Txt ref={condB}
        fontFamily={F_SERIF} fontSize={56} fontWeight={500}
        fill={INK} textAlign="center" y={-20} opacity={0}>
        way to change a method —
    </Txt>);
    view.add(<Txt ref={conclA}
        fontFamily={F_SERIF} fontSize={56} fontWeight={500} fontStyle={'italic'}
        fill={GOLD_QUIET} textAlign="center" y={82} opacity={0}>
        and the easiest way to hide
    </Txt>);
    view.add(<Txt ref={conclB}
        fontFamily={F_SERIF} fontSize={56} fontWeight={500} fontStyle={'italic'}
        fill={GOLD_QUIET} textAlign="center" y={158} opacity={0}>
        what it really does.
    </Txt>);

    yield* eyebrow().opacity(1, 0.6, easeInOutCubic);
    yield* waitFor(0.1);
    yield* sequence(0.18,
        condA().opacity(1, 0.7, easeInOutCubic),
        condB().opacity(1, 0.7, easeInOutCubic),
    );
    yield* waitFor(0.5);
    yield* sequence(0.16,
        conclA().opacity(1, 0.85, easeInOutCubic),
        conclB().opacity(1, 0.85, easeInOutCubic),
    );
    yield* waitFor(3.2);
});
