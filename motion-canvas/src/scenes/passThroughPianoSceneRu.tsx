import {makeScene2D, Rect} from '@motion-canvas/2d';
import {all, easeInOutCubic, easeOutCubic, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Fonts, Screen, Timing} from '../core/theme';
import {CODE_V3f} from './codeWithActionsSceneRu.states';
import {CODE_CARD_STYLE, CODE_W, LEFT_CENTER_X} from './codeWithActionsSceneRu.config';

interface BeatFlash {
  at: number;
  tokens: string[];
  lineHints: string[];
}

const BASE_ALPHA = 0.06;
const METHOD_PEAK = 1.0;
const ARGS_PEAK = 0.88;
const SCROLL_DURATION = 28;

// Акт 1: вспышки сигнатур методов — по одному, сверху вниз
const METHOD_FLASHES: BeatFlash[] = [
  {at: 1.2, tokens: ['exportVideo'], lineHints: ['exportVideo(']},
  {at: 2.9, tokens: ['prepareFrames'], lineHints: ['prepareFrames(']},
  {at: 4.6, tokens: ['encodeWithRetry'], lineHints: ['encodeWithRetry(']},
  {at: 6.3, tokens: ['encode'], lineHints: ['private byte[] encode(', 'return encode(']},
  {at: 8.0, tokens: ['finalizeExport'], lineHints: ['finalizeExport(']},
];

// Акт 2: вспышки pass-through аргументов — повторяющиеся имена
const ARG_FLASHES: BeatFlash[] = [
  {at: 10.2, tokens: ['outputFormat'], lineHints: ['outputFormat']},
  {at: 11.4, tokens: ['watermarkMode'], lineHints: ['watermarkMode']},
  {at: 12.6, tokens: ['audioProfile'], lineHints: ['audioProfile']},
  {at: 14.0, tokens: ['outputFormat', 'watermarkMode', 'audioProfile'], lineHints: ['outputFormat', 'watermarkMode', 'audioProfile']},
];

// Акт 3: цепочка — метод, потом его аргументы, потом следующий метод...
const CHAIN_FLASHES: BeatFlash[] = [
  {at: 16.5, tokens: ['exportVideo'], lineHints: ['exportVideo(']},
  {at: 17.2, tokens: ['outputFormat', 'watermarkMode', 'audioProfile'], lineHints: ['exportVideo(']},
  {at: 18.4, tokens: ['prepareFrames'], lineHints: ['prepareFrames(']},
  {at: 19.1, tokens: ['watermarkMode', 'audioProfile'], lineHints: ['prepareFrames(']},
  {at: 20.3, tokens: ['encodeWithRetry'], lineHints: ['encodeWithRetry(']},
  {at: 21.0, tokens: ['outputFormat', 'watermarkMode', 'audioProfile'], lineHints: ['encodeWithRetry(']},
  {at: 22.2, tokens: ['encode'], lineHints: ['private byte[] encode(']},
  {at: 22.9, tokens: ['outputFormat', 'watermarkMode', 'audioProfile'], lineHints: ['encode(']},
  {at: 24.1, tokens: ['finalizeExport'], lineHints: ['finalizeExport(']},
  {at: 24.8, tokens: ['outputFormat', 'watermarkMode', 'audioProfile'], lineHints: ['finalizeExport(']},
];

// Финал: все pass-through аргументы горят, остальное тонет
const FINALE_AT = 26.0;
const FINALE_TOKENS = ['outputFormat', 'watermarkMode', 'audioProfile'];

export default makeScene2D(function* (view) {
  view.add(
    <Rect
      width={Screen.width}
      height={Screen.height}
      fill={'#050608'}
    />,
  );

  const fontSize = 24;
  const lineHeight = Math.round(fontSize * 1.62 * 10) / 10;
  const topInset = Math.max(8, getCodePaddingY(fontSize) - 8);
  const blockHeight = SafeZone.bottom - SafeZone.top - 44;

  const coldTheme = {
    ...DryFiltersV3CodeTheme,
    plain: 'rgba(210,216,228,0.92)',
    punctuation: 'rgba(180,188,206,0.80)',
    operator: 'rgba(175,185,205,0.78)',
    keyword: 'rgba(140,170,220,0.88)',
    type: 'rgba(175,162,215,0.85)',
    method: 'rgba(220,228,245,0.95)',
    string: 'rgba(180,190,210,0.82)',
    number: 'rgba(170,158,215,0.85)',
    comment: 'rgba(120,128,148,0.65)',
  };

  const code = CodeBlock.fromCode(CODE_V3f, {
    x: LEFT_CENTER_X - 50,
    y: -20,
    width: CODE_W,
    height: blockHeight,
    fontSize,
    lineHeight,
    contentOffsetY: topInset,
    fontFamily: Fonts.code,
    theme: coldTheme,
    cardStyle: {
      ...CODE_CARD_STYLE,
      fill: 'rgba(0,0,0,0)',
      stroke: 'rgba(255,255,255,0.03)',
      strokeWidth: 1,
    },
    glowAccent: false,
    customTypes: ['String', 'RuntimeException', 'IllegalStateException', 'IllegalArgumentException', 'Muxer', 'Container'],
  });
  code.mount(view);

  yield* code.appear(Timing.normal);
  yield* waitFor(0.15);

  const dimAnims: ThreadGenerator[] = [];
  for (let i = 0; i < code.lineCount; i++) {
    dimAnims.push(code.setLineTokensOpacity(i, BASE_ALPHA, 0.5));
  }
  yield* all(...dimAnims);

  const lines = CODE_V3f.split('\n');

  const findLines = (hints: string[]) =>
    lines
      .map((line: string, idx: number) => ({line, idx}))
      .filter(({line}: {line: string}) => hints.some(h => line.includes(h)))
      .map(({idx}: {idx: number}) => idx);

  function* flash(event: BeatFlash, peak: number): ThreadGenerator {
    const targets = findLines(event.lineHints);
    if (targets.length === 0) return;

    const up: ThreadGenerator[] = [];
    for (const i of targets) {
      up.push(code.setLineTokensOpacityMatching(i, event.tokens, peak, 0.08));
    }
    yield* all(...up);

    yield* waitFor(0.12);

    const down: ThreadGenerator[] = [];
    for (const i of targets) {
      down.push(code.setLineTokensOpacityMatching(i, event.tokens, BASE_ALPHA, 0.5));
    }
    yield* all(...down);
  }

  const allEvents = [
    ...METHOD_FLASHES.map(e => ({...e, peak: METHOD_PEAK})),
    ...ARG_FLASHES.map(e => ({...e, peak: ARGS_PEAK})),
    ...CHAIN_FLASHES.map(e => ({...e, peak: METHOD_PEAK})),
  ].sort((a, b) => a.at - b.at);

  function* runBeats(): ThreadGenerator {
    let cursor = 0;
    for (const event of allEvents) {
      const delta = Math.max(0, event.at - cursor);
      if (delta > 0) yield* waitFor(delta);
      cursor = event.at;
      yield* flash(event, event.peak);
      cursor += 0.7;
    }

    // Финал: все pass-through аргументы загораются и остаются
    const finaleWait = Math.max(0, FINALE_AT - cursor);
    if (finaleWait > 0) yield* waitFor(finaleWait);

    const finaleLines = findLines(FINALE_TOKENS);
    const finaleUp: ThreadGenerator[] = [];
    for (const i of finaleLines) {
      finaleUp.push(code.setLineTokensOpacityMatching(i, FINALE_TOKENS, ARGS_PEAK, 0.6));
    }
    yield* all(...finaleUp);
  }

  const clipHeight = blockHeight - topInset * 2;
  const targetLastY = clipHeight / 2 - lineHeight / 2 - 16;
  const startY = -clipHeight / 2 + topInset + lineHeight / 2;
  const currentLastY = startY + (lines.length - 1) * lineHeight;
  const scrollAmount = Math.max(0, currentLastY - targetLastY + 40);

  yield* all(
    code.animateScrollY(scrollAmount, SCROLL_DURATION),
    runBeats(),
  );

  yield* waitFor(2.0);
  yield* code.disappear(0.8);
});
