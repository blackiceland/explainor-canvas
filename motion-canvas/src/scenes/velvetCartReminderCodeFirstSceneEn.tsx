import {Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
    ThreadGenerator,
    all,
    createRef,
    easeInCubic,
    easeInOutCubic,
    easeOutCubic,
    waitFor,
} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {SyntaxTheme} from '../core/code/model/SyntaxTheme';

const F_MONO = '"JetBrains Mono", "Monaspace Argon", monospace';
const VIEW_W = 1080;
const VIEW_H = 1920;

const BG       = '#111722';
const INK      = '#E7E1D6';
const KEY      = '#BFADE1';
const METHOD   = '#83BCE2';
const TYPE     = '#D8CEEC';
const STRING   = '#9CC4A0';
const LITERAL  = '#8BA1C1';
const PUNC     = '#CBD1DC';
const OPERATOR = '#8F9AAA';
const QUIET    = 'rgba(231, 225, 214, 0.50)';
const ACCENT   = '#E8C656';
const DIM_OP   = 0.22;

const THEME: SyntaxTheme = {
    keyword:     INK,
    type:        TYPE,
    string:      STRING,
    number:      LITERAL,
    operator:    OPERATOR,
    punctuation: PUNC,
    method:      METHOD,
    comment:     QUIET,
    annotation:  INK,
    constant:    LITERAL,
    plain:       INK,
};

const ALL_KEYWORDS = [
    'function', 'const', 'let', 'var', 'class', 'interface', 'type', 'enum',
    'async', 'await', 'new', 'extends', 'implements',
    'public', 'private', 'protected', 'static', 'readonly',
    'export', 'import', 'from', 'default', 'as',
    'if', 'else', 'return', 'throw', 'for', 'while', 'switch', 'case',
    'break', 'continue', 'do', 'try', 'catch', 'finally',
    'in', 'of', 'instanceof', 'typeof',
    'fun', 'val', 'suspend', 'when', 'is', 'data', 'sealed', 'object',
    'override', 'open', 'internal', 'companion', 'lateinit', 'abstract',
    'this', 'super', 'void', 'yield',
];

function namedRegex(names: string[]): RegExp {
    return new RegExp(`^(${names.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`);
}

const RULES: ColorRule[] = [
    {match: namedRegex(ALL_KEYWORDS), color: KEY},
    {match: namedRegex(['true', 'false', 'null', 'undefined']), color: LITERAL},
    {match: namedRegex(['User', 'Cart', 'SendResult']), color: TYPE},
    {match: namedRegex(['sendCartReminder', 'render', 'send', 'record']), color: METHOD},
    {match: namedRegex(['user', 'cart']), color: INK},
    {match: namedRegex(['phone']), color: INK},
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

const CODE = `suspend fun sendCartReminder(user: User, cart: Cart): SendResult {
    val message = templates.render("cart_reminder", cart)
    val result = whatsapp.send(user.phone, message)
    deliveries.record(user, message, result)
    return result
}`;

function bumpWeight(block: Manticore, weight: number): void {
    for (let i = 0; i < block.lineCount; i++) {
        const line = block.getLine(i);
        if (!line) continue;
        for (const tokenData of line.tokens) {
            tokenData.ref().fontWeight(weight);
        }
    }
}

function* highlightOnly(
    block: Manticore, idx: number, dur = 0.4,
): ThreadGenerator {
    const ops: ThreadGenerator[] = [];
    for (let i = 0; i < block.lineCount; i++) {
        const line = block.getLine(i);
        if (line) ops.push(line.setOpacity(i === idx ? 1 : DIM_OP, dur));
    }
    if (ops.length) yield* all(...ops);
}

function* restoreAll(block: Manticore, dur = 0.4): ThreadGenerator {
    const ops: ThreadGenerator[] = [];
    for (let i = 0; i < block.lineCount; i++) {
        const line = block.getLine(i);
        if (line) ops.push(line.setOpacity(1, dur));
    }
    if (ops.length) yield* all(...ops);
}

function* awaitFontsReady(): ThreadGenerator {
    if (typeof document === 'undefined') return;
    try {
        document.fonts.load(`400 38px "JetBrains Mono"`);
        document.fonts.load(`500 38px "JetBrains Mono"`);
        document.fonts.load(`400 38px "Monaspace Argon"`);
    } catch {}
    for (let i = 0; i < 60; i++) {
        if (document.fonts.check(`400 38px "JetBrains Mono"`)) return;
        yield* waitFor(0.05);
    }
}

function* swapSubtitle(sub: ReturnType<typeof createRef<Txt>>, text: string): ThreadGenerator {
    yield* sub().opacity(0, 0.18, easeInCubic);
    sub().text(text);
    yield* sub().opacity(1, 0.32, easeOutCubic);
}

// Line indices in the 6-line code block:
//   0: suspend fun sendCartReminder(...)
//   1: val message = templates.render(...)
//   2: val result = whatsapp.send(...)
//   3: deliveries.record(...)
//   4: return result
//   5: }

export default makeScene2D(function* (view) {
    yield* awaitFontsReady();

    view.add(<Rect width={VIEW_W} height={VIEW_H} fill={BG} />);

    const code = Manticore.create(CODE, {
        x: 15, y: -180,
        width: 1080,
        fontSize: 35, lineHeight: 39,
        fontFamily: F_MONO,
        theme: THEME,
        cardStyle: FLAT_CARD,
        glowAccent: false,
    });
    code.mount(view);
    bumpWeight(code, 500);
    code.colorize(RULES);
    code.node.opacity(0);

    const subtitle = createRef<Txt>();
    view.add(<Txt
        ref={subtitle}
        text=""
        fontFamily={F_MONO} fontSize={42} fontWeight={500}
        fill={ACCENT}
        offset={[-1, 0]}
        x={-480} y={540}
        opacity={0}
    />);

    // Beat 1 — code appears
    yield* code.node.opacity(1, 0.5, easeOutCubic);
    yield* waitFor(1.0);

    // Beat 2 — sequential highlight: render → send → record → return
    subtitle().text('// render');
    yield* all(
        highlightOnly(code, 1, 0.5),
        subtitle().opacity(1, 0.4, easeOutCubic),
    );
    yield* waitFor(1.2);

    yield* all(
        highlightOnly(code, 2, 0.4),
        swapSubtitle(subtitle, '// send'),
    );
    yield* waitFor(1.2);

    yield* all(
        highlightOnly(code, 3, 0.4),
        swapSubtitle(subtitle, '// record'),
    );
    yield* waitFor(1.2);

    yield* all(
        highlightOnly(code, 4, 0.4),
        swapSubtitle(subtitle, '// return result'),
    );
    yield* waitFor(1.2);

    // Beat 3 — restore all lines, subtitle stays
    yield* all(
        restoreAll(code, 0.5),
        swapSubtitle(subtitle, '// render, send, record'),
    );
    yield* waitFor(3.0);
});
