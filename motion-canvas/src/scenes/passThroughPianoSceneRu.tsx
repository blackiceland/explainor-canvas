import {makeScene2D, Rect} from '@motion-canvas/2d';
import {all, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Fonts, Screen} from '../core/theme';
import {CODE_V3f} from './codeWithActionsSceneRu.states';
import {CODE_CARD_STYLE} from './codeWithActionsSceneRu.config';

const DARK = 0.06;
const GLOW = 0.98;
const RISE = 0.16;
const HOLD = 0.18;
const DECAY = 0.60;

interface FlashEvent {
  lineHint: string;
  method: string;
  arg: string;
  waitAfter: number;
}

// Один удар = одна пара (вызов + 1 pass-through аргумент).
const FLASH_EVENTS: FlashEvent[] = [
  {lineHint: 'validateInput(sourceFrames, outputFormat);', method: 'validateInput', arg: 'outputFormat', waitAfter: 1.0},
  {lineHint: 'prepareFrames(sourceFrames, colorProfile, subtitleTrack);', method: 'prepareFrames', arg: 'colorProfile', waitAfter: 1.1},
  {lineHint: 'encodeWithRetry(preparedFrames, outputFormat, watermarkMode, audioProfile);', method: 'encodeWithRetry', arg: 'watermarkMode', waitAfter: 1.2},
  {lineHint: 'return encode(preparedFrames, outputFormat, watermarkMode, audioProfile);', method: 'encode', arg: 'audioProfile', waitAfter: 1.1},
  {lineHint: 'runEncoder(preparedFrames);', method: 'runEncoder', arg: 'preparedFrames', waitAfter: 1.0},
  {lineHint: 'return finalizeExport(encodedVideo, outputFormat, watermarkMode, audioProfile);', method: 'finalizeExport', arg: 'outputFormat', waitAfter: 1.2},
  {lineHint: 'Muxer.mux(encodedVideo, outputFormat);', method: 'mux', arg: 'outputFormat', waitAfter: 1.0},
  {lineHint: 'container.applyWatermark(watermarkMode);', method: 'applyWatermark', arg: 'watermarkMode', waitAfter: 0.95},
  {lineHint: 'container.normalizeAudio(audioProfile);', method: 'normalizeAudio', arg: 'audioProfile', waitAfter: 1.2},
];

export default makeScene2D(function* (view) {
  view.add(<Rect width={Screen.width} height={Screen.height} fill={'#03050a'} />);

  // Крупный код в центре.
  const fontSize = 31;
  const lineHeight = Math.round(fontSize * 1.62 * 10) / 10;
  const topInset = Math.max(8, getCodePaddingY(fontSize) - 8);
  const blockHeight = SafeZone.bottom - SafeZone.top - 22;
  const blockWidth = SafeZone.right - SafeZone.left + 240;

  const code = CodeBlock.fromCode(CODE_V3f, {
    x: 0,
    y: 0,
    width: blockWidth,
    height: blockHeight,
    fontSize,
    lineHeight,
    contentOffsetX: 20,
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
  const findFirstLine = (hint: string): number => lines.findIndex((line: string) => line.includes(hint));

  yield* code.appear(0.6);

  // Базовая тень на весь код.
  const dimAll: ThreadGenerator[] = [];
  for (let i = 0; i < code.lineCount; i++) {
    dimAll.push(code.setLineTokensOpacity(i, DARK, 0.8));
  }
  yield* all(...dimAll);

  // Сначала крупняком светится сигнатура метода.
  const startSigLine = findFirstLine('public byte[] exportVideo');
  if (startSigLine >= 0) {
    yield* code.setLineTokensOpacity(startSigLine, GLOW, 0.45);
    yield* waitFor(1.2);
    yield* code.setLineTokensOpacity(startSigLine, DARK, 0.9);
  } else {
    yield* waitFor(1.2);
  }

  // Плавный скролл.
  const clipHeight = blockHeight - topInset * 2;
  const startY = -clipHeight / 2 + topInset + lineHeight / 2;
  const currentLastY = startY + (lines.length - 1) * lineHeight;
  const targetLastY = clipHeight / 2 - lineHeight / 2 - 16;
  const scrollAmount = Math.max(0, currentLastY - targetLastY + 40);

  function* flashPair(lineIdx: number, method: string, arg: string): ThreadGenerator {
    yield* all(
      code.setLineTokensOpacityMatching(lineIdx, [method], GLOW, RISE),
      code.setLineTokensOpacityMatching(lineIdx, [arg], GLOW, RISE),
    );
    yield* waitFor(HOLD);
    yield* all(
      code.setLineTokensOpacityMatching(lineIdx, [method], DARK, DECAY),
      code.setLineTokensOpacityMatching(lineIdx, [arg], DARK, DECAY),
    );
  }

  function* runFlashes(): ThreadGenerator {
    for (const event of FLASH_EVENTS) {
      const lineIdx = findFirstLine(event.lineHint);
      if (lineIdx < 0) continue;
      yield* flashPair(lineIdx, event.method, event.arg);
      yield* waitFor(event.waitAfter);
    }
  }

  yield* all(
    code.animateScrollY(scrollAmount, 38),
    runFlashes(),
  );

  yield* waitFor(0.8);
  yield* code.disappear(1.2);
});
