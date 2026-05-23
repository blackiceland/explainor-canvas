import {Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {ThreadGenerator, waitFor} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {SyntaxTheme} from '../core/code/model/SyntaxTheme';

// Universal code-first vertical theme. В отличие от _codeFirstShared
// который захардкожен под одну 16-строчную сцену с фиксированным
// набором имён функций/параметров — этот builder принимает код и
// идентификаторы как параметры, а палитра расширена слотами:
//   PARAM    — отдельный от INK слот для аргументов функций
//   LITERAL  — отдельный слот для чисел и true/false/null/undefined
//   TYPE     — отдельный слот для TypeScript-аннотаций и interface/class
// ВСЕ ключевые слова (включая control flow: if/else/return/throw/...)
// идут в KEY — единый фиолетовый для всех keywords. TYPE сидит в
// той же violet-семье, но лавандовый (светлее KEY).

export interface UniversalCodePalette {
    BG: string;
    INK: string;        // body text default (plain identifiers, locals)
    PARAM: string;      // function parameters
    KEY: string;        // ALL keywords: function, const, let, var, class, interface, async, await, new,
                        // if, else, return, throw, for, while, switch, case, break, continue
    METHOD: string;     // function definitions + calls
    TYPE: string;       // type annotations, interface/class names, primitive types (лавандовый)
    STRING: string;     // string literals
    LITERAL: string;    // numbers, true, false, null, undefined
    PROP: string;       // property access (.foo)
    PUNC: string;       // brackets, commas
    OPERATOR: string;   // =, !==, ===, =>, etc.
    QUIET: string;      // comments
    ACCENT: string;     // subtitle (// comment-style caption)
}

export interface UniversalSceneOpts {
    /** Source code to render. */
    code: string;
    /** Subtitle text (rendered as // comment). */
    caption: string;
    /** Identifier names that should be coloured as parameters. */
    params?: string[];
    /** Identifier names that should be coloured as properties. */
    props?: string[];
    /** Identifier names that should be coloured as types (in addition to tokenizer). */
    typeNames?: string[];
    /** Identifier names that should be coloured as methods (in addition to tokenizer). */
    methodNames?: string[];
}

const F_MONO = '"JetBrains Mono", "Monaspace Argon", monospace';
const VIEW_W = 1080;
const VIEW_H = 1920;

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

function bumpWeight(block: Manticore, weight: number): void {
    for (let i = 0; i < block.lineCount; i++) {
        const line = block.getLine(i);
        if (!line) continue;
        for (const tokenData of line.tokens) {
            tokenData.ref().fontWeight(weight);
        }
    }
}

function* awaitFontsReady(): ThreadGenerator {
    if (typeof document === 'undefined') return;
    try {
        document.fonts.load(`400 38px "JetBrains Mono"`);
        document.fonts.load(`550 38px "JetBrains Mono"`);
        document.fonts.load(`400 38px "Monaspace Argon"`);
        document.fonts.load(`550 38px "Monaspace Argon"`);
    } catch {}

    for (let i = 0; i < 60; i++) {
        if (document.fonts.check(`400 38px "JetBrains Mono"`)) {
            return;
        }
        yield* waitFor(0.05);
    }
}

const LITERAL_KEYWORDS = ['true', 'false', 'null', 'undefined'];
const PRIMITIVE_TYPES = ['number', 'string', 'boolean', 'void', 'any', 'never', 'unknown', 'object', 'bigint', 'symbol'];
// Все keywords которые ДОЛЖНЫ быть в KEY (фиолетовом). Перечисляем
// явно — defensive против того, что токенайзер может категоризовать
// часть как `plain` или `identifier`. Любой keyword в этом списке
// перекрашивается в KEY правилом ниже.
const ALL_KEYWORDS = [
    // declarations
    'function', 'const', 'let', 'var', 'class', 'interface', 'type', 'enum',
    'async', 'await', 'new', 'extends', 'implements',
    'public', 'private', 'protected', 'static', 'readonly',
    'export', 'import', 'from', 'default', 'as',
    // control flow
    'if', 'else', 'return', 'throw', 'for', 'while', 'switch', 'case',
    'break', 'continue', 'do', 'try', 'catch', 'finally',
    'in', 'of', 'instanceof', 'typeof',
    // misc
    'this', 'super', 'void', 'yield',
];

function escapeForRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function namedRegex(names: string[]): RegExp {
    return new RegExp(`^(${names.map(escapeForRegex).join('|')})$`);
}

export function buildUniversalCodeScene(palette: UniversalCodePalette, opts: UniversalSceneOpts) {
    const {BG, INK, PARAM, KEY, METHOD, TYPE, STRING, LITERAL, PROP, PUNC, OPERATOR, QUIET, ACCENT} = palette;

    // Theme — категории, которые токенайзер сам различает. NB:
    // `keyword` намеренно НЕ маршрутится в KEY — токенайзер Manticore
    // ловит ложные срабатывания (например, `defaults` иногда уходит
    // в keyword-категорию), что красит идентификаторы в фиолет. KEY
    // приходит ИСКЛЮЧИТЕЛЬНО через явный whitelist ALL_KEYWORDS ниже.
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

    const RULES: ColorRule[] = [
        // Defensive: ВСЕ keywords явно красим в KEY-фиолетовый.
        // const, function, if, return, и пр. — все идут в фиолет.
        {match: namedRegex(ALL_KEYWORDS), color: KEY},
        // Literal keywords — true/false/null/undefined идут в LITERAL,
        // НЕ в KEY (хотя синтаксически они keyword).
        {match: namedRegex(LITERAL_KEYWORDS), color: LITERAL},
        // Примитивные TypeScript-типы (на случай если токенайзер
        // не маркает их как `type`).
        {match: namedRegex(PRIMITIVE_TYPES), color: TYPE},
    ];

    if (opts.typeNames && opts.typeNames.length > 0) {
        RULES.push({match: namedRegex(opts.typeNames), color: TYPE});
    }
    if (opts.methodNames && opts.methodNames.length > 0) {
        RULES.push({match: namedRegex(opts.methodNames), color: METHOD});
    }
    if (opts.params && opts.params.length > 0) {
        RULES.push({match: namedRegex(opts.params), color: PARAM});
    }
    if (opts.props && opts.props.length > 0) {
        RULES.push({match: namedRegex(opts.props), color: PROP});
    }

    return makeScene2D(function* (view) {
        yield* awaitFontsReady();

        view.add(<Rect width={VIEW_W} height={VIEW_H} fill={BG} />);

        const code = Manticore.create(opts.code, {
            x: 30, y: -200,
            width: 1080,
            fontSize: 38, lineHeight: 42,
            fontFamily: F_MONO,
            theme: THEME,
            cardStyle: FLAT_CARD,
            glowAccent: false,
        });
        code.mount(view);
        bumpWeight(code, 500);
        code.colorize(RULES);
        code.node.opacity(1);

        view.add(<Txt
            text={opts.caption}
            fontFamily={F_MONO} fontSize={42} fontWeight={500}
            fill={ACCENT}
            offset={[-1, 0]}
            x={-465} y={520}
        />);

        yield* waitFor(8);
    });
}
