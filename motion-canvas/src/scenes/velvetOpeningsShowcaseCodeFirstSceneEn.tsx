import {Node, Rect, Txt, blur, makeScene2D} from '@motion-canvas/2d';
import {
    ThreadGenerator,
    all,
    createRef,
    createSignal,
    easeInCubic,
    easeInOutCubic,
    easeOutCubic,
    waitFor,
} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {SyntaxTheme} from '../core/code/model/SyntaxTheme';

const F_MONO = '"JetBrains Mono", "Monaspace Argon", monospace';
const F_SERIF = 'Newsreader, EB Garamond, serif';

const VIEW_W = 1080;
const VIEW_H = 1920;

const BG       = '#151A28';
const INK      = '#E7E1D6';
const KEY      = '#CAB4EA';
const METHOD   = '#8AC7EF';
const STRING   = '#A8CF98';
const PUNC     = '#D2D8E2';
const OPERATOR = '#8F9AAA';
const QUIET    = 'rgba(231, 225, 214, 0.50)';
const ACCENT   = '#E8C656';

const THEME: SyntaxTheme = {
    keyword:     INK,
    type:        INK,
    string:      STRING,
    number:      INK,
    operator:    OPERATOR,
    punctuation: PUNC,
    method:      INK,
    comment:     QUIET,
    annotation:  INK,
    constant:    METHOD,
    plain:       INK,
};

const RULES: ColorRule[] = [
    {match: /^(function|const|if|else|return|null|let|var|await|async|throw|new)$/, color: KEY},
    {match: /^(sendMessage|verifySession|resolveChannel|moderate|broadcast)$/, color: METHOD},
    {match: /^(msg|sender|channel|content)$/, color: INK},
    {match: /^(token|to|active|text|ok)$/, color: INK},
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

const CODE = `function sendMessage(msg) {
  const sender = verifySession(msg.token)

  if (sender !== null) {
    const channel = resolveChannel(msg.to)

    if (channel.active) {
      const content = moderate(msg.text)

      if (content.ok) {
        broadcast(channel, sender, content)
        return "sent"
      }
      return "blocked"
    }
    return "closed"
  }
  return "expired"
}`;

function applyGlow(block: Manticore): void {
    const glowSet = new Set([KEY, METHOD, STRING]);
    for (let i = 0; i < block.lineCount; i++) {
        const line = block.getLine(i);
        if (!line) continue;
        for (const tokenData of line.tokens) {
            const node = tokenData.ref();
            const fill = String(node.fill());
            if (glowSet.has(fill)) {
                const r = parseInt(fill.slice(1, 3), 16);
                const g = parseInt(fill.slice(3, 5), 16);
                const b = parseInt(fill.slice(5, 7), 16);
                node.shadowColor(`rgba(${r}, ${g}, ${b}, 0.13)`);
                node.shadowBlur(8);
                node.shadowOffset([0, 0]);
            } else {
                node.shadowColor('rgba(0, 0, 0, 0.30)');
                node.shadowBlur(6);
                node.shadowOffset([0, 1]);
            }
        }
    }
}

function bumpWeight(block: Manticore, weight: number): void {
    for (let i = 0; i < block.lineCount; i++) {
        const line = block.getLine(i);
        if (!line) continue;
        for (const tokenData of line.tokens) {
            tokenData.ref().fontWeight(weight);
        }
    }
}

function makeCode(): Manticore {
    return Manticore.create(CODE, {
        x: 15, y: -180,
        width: 1080,
        fontSize: 35, lineHeight: 39,
        fontFamily: F_MONO,
        theme: THEME,
        cardStyle: FLAT_CARD,
        glowAccent: false,
    });
}

function* awaitFontsReady(): ThreadGenerator {
    if (typeof document === 'undefined') return;
    try {
        document.fonts.load(`400 35px "JetBrains Mono"`);
        document.fonts.load(`500 35px "JetBrains Mono"`);
        document.fonts.load(`400 72px "Newsreader"`);
    } catch {}
    for (let i = 0; i < 60; i++) {
        if (document.fonts.check(`400 35px "JetBrains Mono"`)) return;
        yield* waitFor(0.05);
    }
}

export default makeScene2D(function* (view) {
    yield* awaitFontsReady();

    view.add(<Rect width={VIEW_W} height={VIEW_H} fill={BG} />);

    const labelRef = createRef<Txt>();
    view.add(<Txt
        ref={labelRef} text=""
        fontFamily={F_SERIF} fontSize={28} fontWeight={500}
        letterSpacing={4} fill={QUIET}
        y={780} textAlign="center" opacity={0}
    />);

    function* showLabel(text: string): ThreadGenerator {
        labelRef().text(text.toUpperCase());
        yield* labelRef().opacity(1, 0.3, easeOutCubic);
    }
    function* hideLabel(): ThreadGenerator {
        yield* labelRef().opacity(0, 0.25, easeInCubic);
    }

    const DUR = 0.7;
    const BLUR_START = 8;
    const SHIFT = 10;

    function* softReveal(label: string, dx: number, dy: number): ThreadGenerator {
        const code = makeCode();
        code.mount(view);
        bumpWeight(code, 500);
        code.colorize(RULES);
        applyGlow(code);

        const baseY = code.node.y();
        const baseX = code.node.x();
        const blurSig = createSignal(BLUR_START);
        code.node.filters(() => [blur(blurSig())]);
        code.node.opacity(0);
        code.node.x(baseX + dx);
        code.node.y(baseY + dy);

        yield* showLabel(label);
        yield* all(
            code.node.opacity(1, DUR, easeOutCubic),
            blurSig(0, DUR, easeOutCubic),
            code.node.x(baseX, DUR, easeOutCubic),
            code.node.y(baseY, DUR, easeOutCubic),
        );
        yield* waitFor(2.0);
        yield* all(code.node.opacity(0, 0.4, easeInCubic), hideLabel());
        code.node.remove();
    }

    yield* softReveal('From bottom',    0,  SHIFT);    yield* waitFor(0.5);
    yield* softReveal('From top',       0, -SHIFT);    yield* waitFor(0.5);
    yield* softReveal('From left',  -SHIFT,  0);       yield* waitFor(0.5);
    yield* softReveal('From right',  SHIFT,  0);       yield* waitFor(0.5);
    yield* softReveal('From top-left', -7, -7);        yield* waitFor(0.5);
    yield* softReveal('From bot-right', 7,  7);        yield* waitFor(0.5);
    yield* softReveal('No shift',       0,  0);

    yield* waitFor(1.0);
});
