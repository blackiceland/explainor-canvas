import {makeScene2D, Rect} from '@motion-canvas/2d';
import {all, easeInOutCubic, easeOutCubic, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Fonts, Screen, Timing} from '../core/theme';
import {CODE_V3f} from './codeWithActionsSceneRu.states';
import {CODE_CARD_STYLE, CODE_W, LEFT_CENTER_X} from './codeWithActionsSceneRu.config';

const DARK = 0.05;
const GLOW = 0.95;
const RISE = 0.3;
const HOLD = 0.5;
const DECAY = 1.4;

const PASS_THROUGH_ARGS = ['outputFormat', 'watermarkMode', 'audioProfile'];

const METHODS = [
  {name: 'exportVideo',     sig: 'exportVideo('},
  {name: 'prepareFrames',   sig: 'prepareFrames('},
  {name: 'encodeWithRetry', sig: 'encodeWithRetry('},
  {name: 'encode',          sig: 'private byte[] encode('},
  {name: 'finalizeExport',  sig: 'finalizeExport('},
];

export default makeScene2D(function* (view) {
  view.add(
    <Rect width={Screen.width} height={Screen.height} fill={'#04060a'} />,
  );

  const fontSize = 24;
  const lineHeight = Math.round(fontSize * 1.62 * 10) / 10;
  const topInset = Math.max(8, getCodePaddingY(fontSize) - 8);
  const blockHeight = SafeZone.bottom - SafeZone.top - 44;

  const code = CodeBlock.fromCode(CODE_V3f, {
    x: LEFT_CENTER_X - 50,
    y: -20,
    width: CODE_W,
    height: blockHeight,
    fontSize,
    lineHeight,
    contentOffsetY: topInset,
    fontFamily: Fonts.code,
    theme: {
      ...DryFiltersV3CodeTheme,
      plain: 'rgba(200,208,224,0.90)',
      punctuation: 'rgba(170,180,200,0.75)',
      operator: 'rgba(165,178,200,0.72)',
      keyword: 'rgba(130,165,215,0.85)',
      type: 'rgba(168,155,210,0.82)',
      method: 'rgba(215,225,245,0.94)',
      string: 'rgba(172,184,206,0.80)',
      number: 'rgba(162,150,210,0.82)',
      comment: 'rgba(110,118,140,0.60)',
    },
    cardStyle: {...CODE_CARD_STYLE, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)'},
    glowAccent: false,
    customTypes: ['String', 'RuntimeException', 'IllegalStateException', 'IllegalArgumentException', 'Muxer', 'Container'],
  });
  code.mount(view);

  const lines = CODE_V3f.split('\n');

  const findLines = (hint: string): number[] =>
    lines
      .map((l: string, i: number) => ({l, i}))
      .filter(({l}: {l: string}) => l.includes(hint))
      .map(({i}: {i: number}) => i);

  const findLinesAny = (hints: string[]): number[] => {
    const set = new Set<number>();
    for (const h of hints) for (const i of findLines(h)) set.add(i);
    return [...set];
  };

  yield* code.appear(0.6);

  // Весь код уходит в темноту
  const dimAll: ThreadGenerator[] = [];
  for (let i = 0; i < code.lineCount; i++) {
    dimAll.push(code.setLineTokensOpacity(i, DARK, 0.8));
  }
  yield* all(...dimAll);

  yield* waitFor(1.2);

  // Медленное свечение: быстрый подъём, пауза, долгое угасание
  function* glowLine(lineIdx: number, duration?: number): ThreadGenerator {
    yield* code.setLineTokensOpacity(lineIdx, GLOW, RISE);
    yield* waitFor(duration ?? HOLD);
    yield* code.setLineTokensOpacity(lineIdx, DARK, DECAY);
  }

  function* glowTokens(lineIndexes: number[], tokens: string[], duration?: number): ThreadGenerator {
    const up: ThreadGenerator[] = [];
    for (const i of lineIndexes) {
      up.push(code.setLineTokensOpacityMatching(i, tokens, GLOW, RISE));
    }
    yield* all(...up);
    yield* waitFor(duration ?? HOLD);
    const down: ThreadGenerator[] = [];
    for (const i of lineIndexes) {
      down.push(code.setLineTokensOpacityMatching(i, tokens, DARK, DECAY));
    }
    yield* all(...down);
  }

  // Скролл-параметры
  const clipHeight = blockHeight - topInset * 2;
  const startY = -clipHeight / 2 + topInset + lineHeight / 2;
  const currentLastY = startY + (lines.length - 1) * lineHeight;
  const targetLastY = clipHeight / 2 - lineHeight / 2 - 16;
  const scrollAmount = Math.max(0, currentLastY - targetLastY + 40);

  // Пять пар: имя метода → pass-through аргументы.
  // Между парами — тишина и скролл.
  // ~3.5с на фразу пианино ≈ один такт Atlantean Twilight (~80 BPM, 3/4)
  function* directedBeats(): ThreadGenerator {
    for (let m = 0; m < METHODS.length; m++) {
      const method = METHODS[m];
      const sigLines = findLines(method.sig);
      const argLines = findLinesAny(PASS_THROUGH_ARGS)
        .filter(i => sigLines.length > 0 && Math.abs(i - sigLines[0]) < 12);

      // Имя метода светится
      for (const i of sigLines) {
        yield* glowLine(i);
      }

      yield* waitFor(1.0);

      // Pass-through аргументы на соседних строках
      if (argLines.length > 0) {
        yield* glowTokens(argLines, PASS_THROUGH_ARGS);
      }

      // Дыхание перед следующим методом
      if (m < METHODS.length - 1) {
        yield* waitFor(1.8);
      }
    }

    // Финал: все pass-through аргументы во всём коде загораются и остаются
    yield* waitFor(1.5);
    const allArgLines = findLinesAny(PASS_THROUGH_ARGS);
    const finaleUp: ThreadGenerator[] = [];
    for (const i of allArgLines) {
      finaleUp.push(code.setLineTokensOpacityMatching(i, PASS_THROUGH_ARGS, GLOW, 0.8));
    }
    yield* all(...finaleUp);

    yield* waitFor(3.0);
  }

  yield* all(
    code.animateScrollY(scrollAmount, 38),
    directedBeats(),
  );

  yield* waitFor(0.8);
  yield* code.disappear(1.2);
});
