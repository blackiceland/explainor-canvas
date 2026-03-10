import {makeScene2D} from '@motion-canvas/2d';
import {all, easeInOutCubic, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Colors, Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

const CODE_CARD_STYLE = {
  radius: 24,
  fill: 'rgba(0,0,0,0)',
  stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0,
  shadowColor: 'rgba(0,0,0,0)',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  edge: false,
} as const;

// v0: clean start — no pass-through
const V0 = `byte[] exportVideo(byte[] sourceFrames, String outputFormat) {
    validateInput(sourceFrames, outputFormat);
    byte[] encoded = runEncoder(sourceFrames);
    return wrapContainer(encoded, outputFormat);
}`;

// v1: added prepareFrames — still clean
const V1 = `byte[] exportVideo(byte[] sourceFrames, String outputFormat) {
    validateInput(sourceFrames, outputFormat);
    byte[] prepared = prepareFrames(sourceFrames);
    byte[] encoded = runEncoder(prepared);
    return wrapContainer(encoded, outputFormat);
}

byte[] prepareFrames(byte[] frames) {
    byte[] normalized = normalizeFrames(frames);
    return applyColorProfile(normalized, "REC709");
}`;

// v2: added encodeWithRetry — first pass-through of outputFormat
const V2 = `byte[] exportVideo(byte[] sourceFrames, String outputFormat) {
    validateInput(sourceFrames, outputFormat);
    byte[] prepared = prepareFrames(sourceFrames);
    return encodeWithRetry(prepared, outputFormat);
}

// outputFormat is not used here — just passed through
byte[] encodeWithRetry(byte[] preparedFrames, String outputFormat) {
    int attemptsLeft = 3;
    while (attemptsLeft-- > 0) {
        try {
            return encode(preparedFrames, outputFormat);
        } catch (RuntimeException ex) { /* retry */ }
    }
    throw new IllegalStateException("Encoding failed");
}

byte[] prepareFrames(byte[] frames) {
    byte[] normalized = normalizeFrames(frames);
    return applyColorProfile(normalized, "REC709");
}`;

// v3: added encode layer — second pass-through
const V3 = `byte[] exportVideo(byte[] sourceFrames, String outputFormat) {
    validateInput(sourceFrames, outputFormat);
    byte[] prepared = prepareFrames(sourceFrames);
    return encodeWithRetry(prepared, outputFormat);
}

// pass-through #1
byte[] encodeWithRetry(byte[] preparedFrames, String outputFormat) {
    int attemptsLeft = 3;
    while (attemptsLeft-- > 0) {
        try {
            return encode(preparedFrames, outputFormat);
        } catch (RuntimeException ex) { /* retry */ }
    }
    throw new IllegalStateException("Encoding failed");
}

// pass-through #2
byte[] encode(byte[] preparedFrames, String outputFormat) {
    byte[] encoded = runEncoder(preparedFrames);
    return finalizeExport(encoded, outputFormat);
}

byte[] finalizeExport(byte[] encodedVideo, String outputFormat) {
    if (!isSupportedFormat(outputFormat)) {
        throw new IllegalArgumentException("Unsupported: " + outputFormat);
    }
    return wrapContainer(encodedVideo, outputFormat);
}`;

// v4: added prepareAndEncode — third pass-through, full chain
const V4 = `byte[] exportVideo(byte[] sourceFrames, String outputFormat) {
    validateInput(sourceFrames, outputFormat);
    return prepareAndEncode(sourceFrames, outputFormat);
}

// pass-through #1
byte[] prepareAndEncode(byte[] sourceFrames, String outputFormat) {
    byte[] prepared = prepareFrames(sourceFrames);
    return encodeWithRetry(prepared, outputFormat);
}

// pass-through #2
byte[] encodeWithRetry(byte[] preparedFrames, String outputFormat) {
    int attemptsLeft = 3;
    while (attemptsLeft-- > 0) {
        try {
            return encode(preparedFrames, outputFormat);
        } catch (RuntimeException ex) { /* retry */ }
    }
    throw new IllegalStateException("Encoding failed");
}

// pass-through #3
byte[] encode(byte[] preparedFrames, String outputFormat) {
    byte[] encoded = runEncoder(preparedFrames);
    return finalizeExport(encoded, outputFormat);
}

byte[] finalizeExport(byte[] encodedVideo, String outputFormat) {
    if (!isSupportedFormat(outputFormat)) {
        throw new IllegalArgumentException("Unsupported: " + outputFormat);
    }
    return wrapContainer(encodedVideo, outputFormat);
}`;

const VERSIONS = [V0, V1, V2, V3, V4];

const CUSTOM_TYPES = [
  'String',
  'RuntimeException',
  'IllegalStateException',
  'IllegalArgumentException',
];

function* applyColoring(code: CodeBlock, source: string): Generator<any, void, any> {
  const lines = source.split('\n');
  const SOFT_GREEN = 'rgba(168, 214, 178, 0.88)';
  const VAR_LIGHT = 'rgba(244, 241, 235, 0.96)';
  const KEYWORD_COLOR = DryFiltersV3CodeTheme.keyword;
  const TYPE_CLEAN = 'rgba(220, 215, 255, 0.80)';
  const METHOD_COLOR = DryFiltersV3CodeTheme.method;

  const variableTokens = [
    'sourceFrames', 'outputFormat', 'prepared', 'encoded',
    'preparedFrames', 'encodedVideo', 'frames', 'normalized',
    'attemptsLeft', 'ex', 'lastError',
  ];

  const methodTokens = [
    'validateInput', 'runEncoder', 'wrapContainer',
    'prepareFrames', 'normalizeFrames', 'applyColorProfile',
    'encodeWithRetry', 'finalizeExport',
    'isSupportedFormat', 'prepareAndEncode',
  ];

  const typeTokens = [
    'RuntimeException', 'IllegalStateException', 'IllegalArgumentException',
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const varsOnLine = variableTokens.filter(t => new RegExp(`\\b${t}\\b`).test(line));
    if (varsOnLine.length > 0) {
      yield* code.recolorTokens(i, varsOnLine, VAR_LIGHT, 0);
    }

    const quoted: string[] = [];
    const re = /"[^"\n]*"/g;
    let m = re.exec(line);
    while (m) {
      quoted.push(m[0]);
      m = re.exec(line);
    }
    if (quoted.length > 0) {
      yield* code.recolorTokens(i, quoted, SOFT_GREEN, 0);
    }

    if (line.includes('null')) {
      yield* code.recolorTokens(i, ['null'], KEYWORD_COLOR, 0);
    }

    const typesOnLine = typeTokens.filter(t => line.includes(t));
    if (typesOnLine.length > 0) {
      yield* code.recolorTokens(i, typesOnLine, TYPE_CLEAN, 0);
    }

    const methodsOnLine = methodTokens.filter(t => line.includes(t));
    if (methodsOnLine.length > 0) {
      yield* code.recolorTokens(i, methodsOnLine, METHOD_COLOR, 0);
    }

    // method declarations get VAR_LIGHT (after method color, to override)
    if (line.includes('exportVideo(')) {
      yield* code.recolorTokens(i, ['exportVideo'], VAR_LIGHT, 0);
    }
    // encode as method call (not declaration) — needs special handling
    // only color 'encode(' when it's a call, not a declaration
    if (line.includes('encode(') && !line.includes('byte[]')) {
      yield* code.recolorTokens(i, ['encode'], METHOD_COLOR, 0);
    }
  }
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  const fontSize = 22;
  const lineHeight = Math.round(fontSize * 1.62 * 10) / 10;
  const paddingY = getCodePaddingY(fontSize);
  const topInset = Math.max(8, paddingY - 8);

  const blockHeight = SafeZone.bottom - SafeZone.top - 36;
  const blockWidth = SafeZone.right - SafeZone.left + 100;

  const codeBlockConfig = {
    x: 0,
    y: 0,
    width: blockWidth,
    height: blockHeight,
    fontSize,
    lineHeight,
    contentOffsetY: topInset,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    customTypes: CUSTOM_TYPES,
  };

  // create all 5 code blocks upfront
  const codeBlocks: CodeBlock[] = [];
  for (const src of VERSIONS) {
    const cb = CodeBlock.fromCode(src, codeBlockConfig);
    codeBlocks.push(cb);
  }

  // mount first version
  const current = codeBlocks[0];
  current.mount(view);
  yield* applyColoring(current, VERSIONS[0]);
  yield* current.appear(Timing.normal);

  yield* waitFor(3);

  // transitions v0 -> v1 -> v2 -> v3 -> v4
  for (let v = 1; v < VERSIONS.length; v++) {
    const prev = codeBlocks[v - 1];
    const next = codeBlocks[v];

    next.mount(view);
    yield* applyColoring(next, VERSIONS[v]);
    next.node.opacity(0);

    // crossfade
    yield* all(
      prev.disappear(0.5),
      next.appear(0.5),
    );

    yield* waitFor(0.5);

    // on v2+ highlight outputFormat as pass-through
    if (v >= 2) {
      yield* highlightPassThrough(next, VERSIONS[v]);
    }

    yield* waitFor(3);

    // unmount previous
    prev.node.remove();
  }

  // final chain animation on v4
  const finalBlock = codeBlocks[4];
  yield* animatePassThroughChain(finalBlock, VERSIONS[4]);

  yield* waitFor(2);

  // fade out
  yield* finalBlock.disappear(1.2);
  yield* waitFor(0.5);
});

function* highlightPassThrough(
  code: CodeBlock,
  source: string,
): Generator<any, void, any> {
  const lines = source.split('\n');
  const dimOpacity = 0.2;
  const ACCENT = Colors.accent;

  // find lines containing "outputFormat" that are in pass-through methods (comments with "pass-through")
  const passThroughMethodStarts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('pass-through') || lines[i].includes('not used here')) {
      passThroughMethodStarts.push(i);
    }
  }

  // dim everything
  const dimAnims: ThreadGenerator[] = [];
  for (let i = 0; i < lines.length; i++) {
    dimAnims.push(code.setLineTokensOpacity(i, dimOpacity, 0.8));
  }
  yield* all(...dimAnims);

  // highlight outputFormat in pass-through methods
  for (const commentLine of passThroughMethodStarts) {
    const methodStart = commentLine + 1;
    // find method end (next empty line or end)
    let methodEnd = methodStart;
    let braceCount = 0;
    for (let j = methodStart; j < lines.length; j++) {
      if (lines[j].includes('{')) braceCount++;
      if (lines[j].includes('}')) braceCount--;
      if (braceCount === 0 && j > methodStart) {
        methodEnd = j;
        break;
      }
    }

    // brighten method lines
    const brightAnims: ThreadGenerator[] = [];
    for (let i = methodStart; i <= methodEnd; i++) {
      brightAnims.push(code.setLineTokensOpacity(i, 1, 0.6));
    }
    brightAnims.push(code.setLineTokensOpacity(commentLine, 0.5, 0.6));
    yield* all(...brightAnims);

    // recolor outputFormat to accent in this method
    for (let i = methodStart; i <= methodEnd; i++) {
      if (lines[i].includes('outputFormat')) {
        yield* code.recolorTokens(i, ['outputFormat'], ACCENT, 0.4);
      }
    }

    yield* waitFor(1.5);

    // dim method back
    const reDimAnims: ThreadGenerator[] = [];
    for (let i = commentLine; i <= methodEnd; i++) {
      reDimAnims.push(code.setLineTokensOpacity(i, dimOpacity, 0.4));
    }
    yield* all(...reDimAnims);
  }

  // restore all
  const restoreAnims: ThreadGenerator[] = [];
  for (let i = 0; i < lines.length; i++) {
    restoreAnims.push(code.setLineTokensOpacity(i, 1, 0.6));
  }
  yield* all(...restoreAnims);
}

function* animatePassThroughChain(
  code: CodeBlock,
  source: string,
): Generator<any, void, any> {
  const lines = source.split('\n');
  const ACCENT = Colors.accent;
  const dimOpacity = 0.15;

  // dim everything first
  const dimAnims: ThreadGenerator[] = [];
  for (let i = 0; i < lines.length; i++) {
    dimAnims.push(code.setLineTokensOpacity(i, dimOpacity, 0.8));
  }
  yield* all(...dimAnims);

  yield* waitFor(0.5);

  // chain: method by method, highlight and trace outputFormat
  const chain = [
    'exportVideo',
    'prepareAndEncode',
    'encodeWithRetry',
    'encode',
    'finalizeExport',
  ];

  for (const methodName of chain) {
    // find method start
    let methodStart = -1;
    let methodEnd = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(methodName + '(') && !lines[i].trim().startsWith('//') && !lines[i].trim().startsWith('return')) {
        // skip lines that are just calls (return encode(...))
        if (lines[i].includes('byte[]') || lines[i].includes('void')) {
          methodStart = i;
          break;
        }
      }
    }

    if (methodStart === -1) continue;

    // find method end
    let braceCount = 0;
    for (let j = methodStart; j < lines.length; j++) {
      if (lines[j].includes('{')) braceCount++;
      if (lines[j].includes('}')) braceCount--;
      if (braceCount === 0 && j > methodStart) {
        methodEnd = j;
        break;
      }
    }

    // also include comment line above if it's a pass-through comment
    const commentLine = methodStart > 0 && lines[methodStart - 1].includes('pass-through')
      ? methodStart - 1
      : -1;

    // brighten this method
    const brightAnims: ThreadGenerator[] = [];
    const from = commentLine >= 0 ? commentLine : methodStart;
    for (let i = from; i <= methodEnd; i++) {
      brightAnims.push(code.setLineTokensOpacity(i, 1, 0.5));
    }
    yield* all(...brightAnims);

    // highlight outputFormat in accent
    for (let i = methodStart; i <= methodEnd; i++) {
      if (lines[i].includes('outputFormat')) {
        yield* code.recolorTokens(i, ['outputFormat'], ACCENT, 0.3);
      }
    }

    yield* waitFor(1.2);
  }

  yield* waitFor(1);

  // restore all brightness (keep accent colors)
  const restoreAnims: ThreadGenerator[] = [];
  for (let i = 0; i < lines.length; i++) {
    restoreAnims.push(code.setLineTokensOpacity(i, 1, 0.8));
  }
  yield* all(...restoreAnims);
}
