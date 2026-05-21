import {Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {ThreadGenerator, waitFor} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {SyntaxTheme} from '../core/code/model/SyntaxTheme';
import {textWidth} from '../core/utils/textMeasure';

// Code-first vertical mobile frame, not a poster. Dense code block +
// short bold sans caption on a dark non-black ground. No brand, no
// footer, no editorial chrome, no decorative braces, no italic accent.
// The frame reads as a piece of code with a punchline.

export interface CodeFirstPalette {
    BG: string;
    INK: string;        // body text, locals, punctuation base, caption
    KEY: string;        // keyword: function / const / if / return
    METHOD: string;     // function def + calls (verify / resolve / …)
    STRING: string;     // status literals "sent" / "blocked" / …
    PROP: string;       // .token / .to / .active / .body / .ok
    PARAM: string;      // msg / user / room / clean
    PUNC: string;       // brackets, commas, !
    OPERATOR: string;   // =
    QUIET: string;      // dim accent (comments, etc.)
    /** @deprecated — caption no longer uses a warm accent word. */
    ACCENT?: string;
    /** @deprecated — caption no longer uses split cool/warm coloring. */
    CAP_COOL?: string;
}

// JetBrains Mono first — geometric, rigid letterforms match the s4
// reference. Monaspace Argon (humanist, rounder) only as fallback.
const F_MONO = '"JetBrains Mono", "Monaspace Argon", monospace';
// Caption is sans-serif bold (Inter / Geist) for a punchy, social-first
// reading — explicitly NOT serif. Falls back to system sans if Inter is
// not installed.
const F_SANS = 'Inter, "Helvetica Neue", "Segoe UI", system-ui, sans-serif';

const VIEW_W = 1080;
const VIEW_H = 1920;

// Nested if-else shape with explicit pyramid. The guard-clause form
// is cleaner code but visually flat; this nested form gives the frame
// "drama" — the staircase indentation is the point.
// 16 lines, longest 43 chars (`        broadcast(channel, sender, content)`).
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
        document.fonts.load(`700 72px Inter`);
    } catch {}

    for (let i = 0; i < 60; i++) {
        if (document.fonts.check(`400 38px "JetBrains Mono"`)) {
            return;
        }
        yield* waitFor(0.05);
    }
}

export function buildCodeFirstScene(palette: CodeFirstPalette) {
    const {BG, INK, KEY, METHOD, STRING, PROP, PARAM, PUNC, OPERATOR, QUIET, ACCENT} = palette;
    const captionAccent = ACCENT ?? KEY;

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
        {match: /^(msg|sender|channel|content)$/, color: PARAM},
        {match: /^(token|to|active|text|ok)$/, color: PROP},
    ];

    return makeScene2D(function* (view) {
        yield* awaitFontsReady();

        view.add(<Rect width={VIEW_W} height={VIEW_H} fill={BG} />);

        // The code — nested if-else pyramid. 16 lines, longest 43.
        // fontSize 38 (+5.5 % from 36 — closing on the ТЗ target of
        // +8 % without overflowing the clip). lineHeight 42 (ratio
        // 1.105 — still tight). Card width = frame width 1080. x=+30
        // shifts the block ~30 px right so the left edge breathes,
        // matching the ТЗ's "+25-35 px right" ask. y=-200 keeps the
        // top edge of the code visible inside the frame.
        const code = Manticore.create(CODE, {
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

        // Bottom caption — second anchor, lowercased per ТЗ (more
        // natural social-voice, less corporate Title Case). Accent
        // word "decisions" in KEY (lavender) echoes the code keyword.
        // y=+290 — moved 70 px down so a proper pause sits between
        // the closing brace and "One function." (per ТЗ).
        const CAP_Y = 290;
        const CAP_SIZE = 72;
        const CAP_LH = 76;
        const line1Y = CAP_Y - CAP_LH / 2;
        const line2Y = CAP_Y + CAP_LH / 2;

        view.add(<Txt
            text={'One function.'}
            fontFamily={F_SANS} fontSize={CAP_SIZE} fontWeight={700}
            fill={INK}
            letterSpacing={-0.5}
            textAlign="center"
            y={line1Y}
        />);

        const l2Prefix = 'Five ';
        const l2Accent = 'decisions';
        const l2Suffix = '.';
        const l2pW = textWidth(l2Prefix, F_SANS, CAP_SIZE, 700);
        const l2aW = textWidth(l2Accent, F_SANS, CAP_SIZE, 700);
        const l2TotalW = l2pW + l2aW + textWidth(l2Suffix, F_SANS, CAP_SIZE, 700);
        const l2StartX = -l2TotalW / 2;

        view.add(<Txt
            text={l2Prefix}
            fontFamily={F_SANS} fontSize={CAP_SIZE} fontWeight={700}
            fill={INK} letterSpacing={-0.5}
            offset={[-1, 0]} x={l2StartX} y={line2Y}
        />);
        view.add(<Txt
            text={l2Accent}
            fontFamily={F_SANS} fontSize={CAP_SIZE} fontWeight={700}
            fill={captionAccent} letterSpacing={-0.5}
            offset={[-1, 0]} x={l2StartX + l2pW} y={line2Y}
        />);
        view.add(<Txt
            text={l2Suffix}
            fontFamily={F_SANS} fontSize={CAP_SIZE} fontWeight={700}
            fill={INK} letterSpacing={-0.5}
            offset={[-1, 0]} x={l2StartX + l2pW + l2aW} y={line2Y}
        />);

        yield* waitFor(8);
    });
}
