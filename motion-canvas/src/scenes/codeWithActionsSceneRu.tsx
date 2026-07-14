import {Rect, makeScene2D} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, easeOutCubic, linear, waitFor} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {Canon, CanonCodeTheme, buildCanonRules} from '../core/code/model/paletteCanon';
import {getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Fonts, Screen, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';
import {JavaClass, method, param} from '../core/code/model/JavaModel';
import {Medusa} from '../core/code/director/Medusa';
import {
  CODE_CARD_STYLE,
  CODE_W,
  FRAME_STROKE_DONE,
  LEFT_CENTER_X,
  MAX_LINE_CHARS,
  PANEL_X,
  PASS_THROUGH,
} from './codeWithActionsSceneRu.config';
import {createRightPanel} from './codeWithActionsSceneRu.rightPanel';

// ── Канон-раскраска (как в fiveFacesShortcutSceneRuV2) ────────────────────
// CanonCodeTheme (тема) + canon-правила. Методы делим на определение (якорь
// #FF8CA3) и вызовы (пастель #FFAEC0), но определение детектится по Java-признаку
// (тип перед именем), т.к. в Java нет `fun`. param-цвет не применяем — в Java нет
// именованных аргументов, иначе покрасились бы локальные объявления `Type x =`.
const CANON_RULES: ColorRule[] = [
  ...buildCanonRules({
    types: ['String', 'RuntimeException', 'IllegalStateException',
      'IllegalArgumentException', 'Muxer', 'Container', 'byte', 'int'],
    methods: ['exportVideo', 'validateInput', 'runEncoder', 'finalizeExport',
      'prepareFrames', 'normalizeFrames', 'applyColorProfile', 'overlaySubtitles',
      'encodeWithRetry', 'encode', 'isSupportedFormat', 'applyWatermark',
      'normalizeAudio', 'mux'],
  }),
  {match: /^(new|this)$/, color: Canon.keyword},
];

const RET_TYPES = new Set(['byte', 'int', 'void', 'long', 'boolean', 'char', 'short', 'float', 'double']);
const CALL_STOP = new Set(['if', 'for', 'while', 'catch', 'switch', 'synchronized']);
const nonSpacePrev = (toks: any[], i: number): string => {
  let p = i - 1;
  while (p >= 0 && toks[p].text.trim() === '') p--;
  return p >= 0 ? toks[p].text.trim() : '';
};
const nonSpaceNext = (toks: any[], i: number): string => {
  let n = i + 1;
  while (n < toks.length && toks[n].text.trim() === '') n++;
  return n < toks.length ? toks[n].text.trim() : '';
};
// Java-вариант paintCanonMethodCalls: имя + `(` = метод; определение, если перед
// именем стоит тип (`]`, `>`, примитив или Type). Иначе — вызов.
const paintJavaMethodsLine = (line: any): void => {
  const toks = line.tokens;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i].text.trim();
    if (!/^[a-z][a-zA-Z0-9_]*$/.test(t) || CALL_STOP.has(t)) continue;
    if (nonSpaceNext(toks, i) !== '(') continue;
    const prev = nonSpacePrev(toks, i);
    const isDef = prev === ']' || prev === '>' || RET_TYPES.has(prev) || /^[A-Z]/.test(prev);
    toks[i].ref().fill(isDef ? Canon.methodDef : Canon.methodCall);
  }
};
const paintJavaMethods = (mc: Manticore): void => {
  for (let li = 0; li < mc.lineCount; li++) {
    const line = mc.getLine(li);
    if (line) paintJavaMethodsLine(line);
  }
};

export default makeScene2D(function* (view) {
  applyBackground(view);

  const fontSize   = 22;
  const lineHeight = Math.round(fontSize * 1.62 * 10) / 10;
  const paddingY   = getCodePaddingY(fontSize);
  const topInset   = Math.max(8, paddingY - 8);

  const {
    ICON_SCALE, ICON_Y, ICON_Y2, ICON_SPACING,
    skewX, skewY, scaleXn, scaleYn, rotation, radius0, strokeColor0,
    frameOpNorm, guidesOp, collapseX0, collapseY0, collapseS0,
    frameOpColor, sweepOpacity, paintProgress, collapseX1, collapseY1, collapseS1,
    frameOpEncoderV1, collapseX2, collapseY2, collapseS2, blockOpacitiesV1,
    frameOpFinalizeV1, formatLabelOpV1, collapseXFin, collapseYFin, collapsesFin,
    frameOpSubtitles, subtitleBarOp, collapseXSub, collapseYSub, collapseSSub,
    frameOpWatermark, watermarkOp, collapseXW, collapseYW, collapseSW,
    BAR_COUNT, BAR_W, BAR_MAX_H, BAR_MIN_H, NORMALIZED_H,
    frameOpAudio, collapseXA, collapseYA, collapseSA, barHeights, barsOpacity,
    COLS, ROWS, frameOpEncoderV3, blockOpacitiesV3,
    frameOpFinalizeV3, formatLabelOpV3,
    labelOp, frameOpEncoder, frameOpFinalize, formatLabelOp, blockOpacities,
    dividerOp,
  } = createRightPanel(view);

  // ── Модель ──────────────────────────────────────────────────────────────
  const model = JavaClass.create([
    method('public', 'byte[]', 'exportVideo',
      [param('byte[]', 'sourceFrames'), param('String', 'outputFormat')],
      ['validateInput(sourceFrames, outputFormat);',
       'byte[] encodedVideo = runEncoder(sourceFrames);',
       '',
       'return finalizeExport(encodedVideo, outputFormat);']),
    // +6: чтобы 3-строчная сигнатура prepareFrames (~94 симв.) влезала в строку,
    // а не переносила третий параметр (MAX_LINE_CHARS=93 не хватало одного символа).
  ], MAX_LINE_CHARS + 6);

  // ── Manticore ───────────────────────────────────────────────────────────
  const manticore = Manticore.create(model.render(), {
    x: LEFT_CENTER_X - 50, y: -50,
    width: CODE_W,
    height: SafeZone.bottom - SafeZone.top - 36,
    fontSize, lineHeight,
    contentOffsetY: topInset,
    fontFamily: Fonts.code,
    theme: CanonCodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    noClip: true,   // убрать нижний обрез клипа (ограничитель фрейма — артефакт Manticore)
    customTypes: ['String', 'RuntimeException', 'IllegalStateException', 'IllegalArgumentException', 'Muxer', 'Container'],
  });
  manticore.mount(view);
  manticore.colorize(CANON_RULES);
  paintJavaMethods(manticore);

  // ── Медуза ──────────────────────────────────────────────────────────────
  const dir = new Medusa(model, manticore, {
    // recolorLine repaints method calls/defs on every morph so new lines keep canon.
    morphDefaults: {scrollStrategy: 'block', removeDuration: 0, moveDuration: 0.6, recolorLine: paintJavaMethodsLine},
    pauseAfterMorph: 0.5,
  });

  const FADE_IN = Timing.slow;

  // ── v0: появление ─────────────────────────────────────────────────────
  yield* dir.cb.appear(FADE_IN);
  yield* waitFor(0.5);

  yield* all(
    labelOp(1, FADE_IN, easeInOutCubic),
    frameOpEncoder(1, FADE_IN, easeInOutCubic),
  );
  yield* waitFor(0.3);

  const blockDelay = 0.01; const blockOp = 0.05;
  for (let idx = 0; idx < COLS * ROWS; idx++) {
    yield* blockOpacities[idx](1, blockOp, easeInOutCubic);
    if (idx < COLS * ROWS - 1) yield* waitFor(blockDelay);
  }
  yield* waitFor(0.5);

  yield* frameOpFinalize(1, FADE_IN, easeInOutCubic);
  yield* waitFor(0.4);
  yield* formatLabelOp(1, FADE_IN, easeInOutCubic);
  yield* waitFor(2);

  // ── v0 → v1: normalizeFrames + applyColorProfile ──────────────────────

  yield* all(
    frameOpEncoder(0, FADE_IN, easeInOutCubic),
    frameOpFinalize(0, FADE_IN, easeInOutCubic),
    formatLabelOp(0, FADE_IN, easeInOutCubic),
  );
  for (const sig of blockOpacities) sig(0);
  yield* waitFor(0.3);

  yield* frameOpNorm(1, FADE_IN, easeInOutCubic);
  yield* waitFor(0.4);
  yield* guidesOp(1, 0.3, easeInOutCubic);
  yield* waitFor(0.2);
  yield* all(
    skewX(0, 0.9, easeOutCubic),
    skewY(0, 0.9, easeOutCubic),
    scaleXn(1, 0.9, easeOutCubic),
    scaleYn(1, 0.9, easeOutCubic),
    rotation(0, 0.9, easeOutCubic),
    radius0(10, 0.9, easeOutCubic),
    strokeColor0(FRAME_STROKE_DONE, 0.9, easeOutCubic),
  );
  yield* guidesOp(0, 0.4, easeInOutCubic);
  yield* waitFor(0.3);

  yield* frameOpColor(1, FADE_IN, easeInOutCubic);
  yield* waitFor(0.2);
  paintProgress(0);
  yield* sweepOpacity(1, 0.15, easeInOutCubic);
  yield* paintProgress(1, 1.0, linear);
  yield* sweepOpacity(0, 0.2, easeInOutCubic);
  yield* waitFor(0.3);

  // v1a: +colorProfile
  yield* dir.addParam('exportVideo', param('String', 'colorProfile'));

  // v1b: prepareFrames call + pass preparedFrames
  yield* dir.apply(m => m.replaceLine('exportVideo',
    'byte[] encodedVideo = runEncoder(sourceFrames);',
    'byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile);',
    'byte[] encodedVideo = runEncoder(preparedFrames);',
  ));
  yield* waitFor(0.3);

  // v1c: prepareFrames появляется
  yield* dir.addMethod(
    method('private', 'byte[]', 'prepareFrames',
      [param('byte[]', 'sourceFrames'), param('String', 'colorProfile')],
      ['byte[] normalizedFrames = normalizeFrames(sourceFrames);',
       '',
       'return applyColorProfile(normalizedFrames, colorProfile);']),
    'exportVideo',
  );

  yield* frameOpEncoderV1(1, FADE_IN, easeInOutCubic);
  yield* waitFor(0.1);
  const blockDelayV1 = 0.004; const blockOpV1 = 0.025;
  for (let idx = 0; idx < COLS * ROWS; idx++) {
    yield* blockOpacitiesV1[idx](1, blockOpV1, easeInOutCubic);
    if (idx < COLS * ROWS - 1) yield* waitFor(blockDelayV1);
  }
  yield* waitFor(0.8);

  yield* all(
    collapseS0(ICON_SCALE, 0.8, easeInOutCubic),
    collapseS1(ICON_SCALE, 0.8, easeInOutCubic),
    collapseS2(ICON_SCALE, 0.8, easeInOutCubic),
    collapseY0(ICON_Y, 0.8, easeInOutCubic),
    collapseY1(ICON_Y, 0.8, easeInOutCubic),
    collapseY2(ICON_Y, 0.8, easeInOutCubic),
    collapseX0(PANEL_X - ICON_SPACING, 0.8, easeInOutCubic),
    collapseX1(PANEL_X, 0.8, easeInOutCubic),
    collapseX2(PANEL_X + ICON_SPACING, 0.8, easeInOutCubic),
  );
  yield* waitFor(0.3);

  yield* all(
    frameOpFinalizeV1(1, FADE_IN, easeInOutCubic),
    formatLabelOpV1(1, FADE_IN, easeInOutCubic),
  );
  yield* waitFor(2);

  // ── v1 → v2: subtitles + encodeWithRetry + encode ─────────────────────

  yield* all(
    frameOpFinalizeV1(0, FADE_IN, easeInOutCubic),
    formatLabelOpV1(0, FADE_IN, easeInOutCubic),
    frameOpEncoderV1(0, FADE_IN, easeInOutCubic),
  );
  for (const sig of blockOpacitiesV1) sig(0);
  yield* waitFor(0.3);

  yield* frameOpSubtitles(1, FADE_IN, easeInOutCubic);
  yield* waitFor(0.3);
  yield* subtitleBarOp(1, 0.5, easeInOutCubic);
  yield* waitFor(0.5);

  // v2a_export: +subtitleTrack в exportVideo + обновить вызов prepareFrames
  yield* dir.scrollTo(0, 0.6);
  yield* dir.apply(m => {
    m.addParam('exportVideo', param('String', 'subtitleTrack'));
    m.updateCallArgs('exportVideo', 'prepareFrames', ['sourceFrames', 'colorProfile', 'subtitleTrack']);
  });

  // v2a_prepare: +subtitleTrack в prepareFrames (только сигнатура)
  yield* dir.addParam('prepareFrames', param('String', 'subtitleTrack'));

  // v2a: тело prepareFrames обогащается
  yield* dir.setBody('prepareFrames', [
    'byte[] normalizedFrames = normalizeFrames(sourceFrames);',
    'byte[] coloredFrames = applyColorProfile(normalizedFrames, colorProfile);',
    '',
    'return overlaySubtitles(coloredFrames, subtitleTrack);',
  ]);
  yield* waitFor(0.3);

  // v2b_export: заменить runEncoder → encodeWithRetry в exportVideo
  yield* dir.scrollTo(0, 0.8);
  yield* dir.apply(m => {
    m.removeLine('exportVideo', 'byte[] encodedVideo = runEncoder(preparedFrames);');
    m.replaceLine('exportVideo',
      'return finalizeExport(encodedVideo, outputFormat);',
      'return encodeWithRetry(preparedFrames, outputFormat);',
    );
  }, {profile: 'argSwap'});

  // v2b: encodeWithRetry появляется
  yield* dir.addMethod(
    method('private', 'byte[]', 'encodeWithRetry',
      [param('byte[]', 'preparedFrames'), param('String', 'outputFormat')],
      ['int attemptsLeft = this.maxAttempts;',
       '',
       'while (attemptsLeft-- > 0) {',
       '    try {',
       '        return encode(preparedFrames, outputFormat);',
       '    } catch (RuntimeException ex) { /* retry */ }',
       '}',
       '',
       'throw new IllegalStateException("Encoding failed");']),
    'prepareFrames',
  );

  // v2b: encode появляется
  yield* dir.addMethod(
    method('private', 'byte[]', 'encode',
      [param('byte[]', 'preparedFrames'), param('String', 'outputFormat')],
      ['byte[] encodedVideo = runEncoder(preparedFrames);',
       '',
       'return finalizeExport(encodedVideo, outputFormat);']),
    'encodeWithRetry',
  );
  yield* waitFor(0.5);

  // ── highlight: outputFormat pass-through ──────────────────────────────
  const cb = dir.cb;
  const passRule = [{match: 'outputFormat', color: PASS_THROUGH}];

  yield* cb.scrollTo(0, 1.0);
  yield* waitFor(0.8);

  const exportVideoLine  = cb.findLine('public byte[] exportVideo');
  const exportCallLine   = cb.findLine('return encodeWithRetry(preparedFrames, outputFormat)');
  const retrySignature   = cb.findLine('private byte[] encodeWithRetry');
  const encodeCall       = cb.findLine('return encode(preparedFrames');
  const encodeSignature  = cb.findLine('private byte[] encode(');
  const finalizeCallIdx  = cb.findLine('return finalizeExport(encodedVideo, outputFormat)');

  const highlight = (from: number, to: number) => all(
    cb.dimLines(from, to, 1, 0.4),
    cb.colorizeAnimated(from, to, 0.4, passRule),
  );

  // ── Одна полоска: непрерывно ползёт к finalizeExport и ждёт там ПРИГЛУШЁННОЙ,
  //    пока цепочка выделений кода не дойдёт до этой строки — тогда разгорается. ──
  const STRIPE_COLOR = 'rgba(255, 80, 120, 0.18)';   // исходный цвет полоски (не оранжевый)
  const stripeW = CODE_W + 40;
  const stripeH = lineHeight * 1.15;
  const stripeX = -Screen.width / 2 + stripeW / 2;
  const DIM_OP  = 0.34;   // приглушённая, пока трасса не дошла

  // y интерполируется от строки-входа (exportVideo) к ЖИВОЙ позиции finalizeExport
  // (getLineSceneY реактивен по scroll) — полоска остаётся приклеенной к finalize.
  const yEntry = cb.getLineSceneY(exportVideoLine);
  const glide  = createSignal(0);
  const stripe = new Rect({
    width: stripeW, height: stripeH, x: stripeX,
    y: () => yEntry + (cb.getLineSceneY(finalizeCallIdx) - yEntry) * glide(),
    fill: STRIPE_COLOR, opacity: 0, radius: 4,
  });
  view.add(stripe);

  // появляется приглушённой у входа; остальной код тускнеет, exportVideo — ярко
  yield* all(
    cb.dimLines(0, exportVideoLine - 1, 0.25, 0.5),
    cb.dimLines(exportVideoLine + 2, cb.lineCount - 1, 0.25, 0.5),
    highlight(exportVideoLine, exportVideoLine + 1),
    stripe.opacity(DIM_OP, 0.5, easeInOutCubic),
  );
  yield* waitFor(0.8);

  yield* highlight(exportCallLine, exportCallLine);
  yield* waitFor(1.0);

  // непрерывно ползёт к finalizeExport ВМЕСТЕ со скроллом, оставаясь приглушённой
  yield* all(
    glide(1, 1.2, easeInOutCubic),
    cb.scrollTo(retrySignature, 1.2),
  );

  // цепочка выделений идёт вниз по цепочке; полоска ждёт у finalize приглушённой
  yield* highlight(retrySignature, retrySignature);
  yield* waitFor(0.8);

  yield* highlight(encodeCall, encodeCall);
  yield* waitFor(0.8);

  yield* highlight(encodeSignature, encodeSignature);
  yield* waitFor(0.8);

  // трасса дошла до finalizeExport — полоска разгорается
  yield* all(
    highlight(finalizeCallIdx, finalizeCallIdx),
    stripe.opacity(1, 0.4, easeInOutCubic),
  );
  yield* waitFor(1.2);

  // мигание транзитного метода encodeWithRetry
  yield* cb.dimLines(retrySignature, retrySignature, 1.0, 0.18);
  yield* cb.dimLines(retrySignature, retrySignature, 0.25, 0.18);
  yield* cb.dimLines(retrySignature, retrySignature, 1.0, 0.18);
  yield* cb.dimLines(retrySignature, retrySignature, 0.25, 0.18);
  yield* cb.dimLines(retrySignature, retrySignature, 1.0, 0.18);
  yield* waitFor(0.5);

  // плавный выход
  yield* stripe.opacity(0, 0.8, easeInOutCubic);
  yield* all(
    cb.showAllLines(0.8),
    // возвращаем ТОЛЬКО outputFormat (оранжевый → ink). Методы не перекрашиваем —
    // иначе вызовы на миг уходят в methodDef (розово-красный) до пост-repaint (лаг+вспышка).
    cb.colorizeAnimated(0, cb.lineCount - 1, 0.8, [{match: 'outputFormat', color: Canon.ink}]),
  );
  yield* waitFor(1.0);

  // ── v3: watermark ─────────────────────────────────────────────────────
  yield* cb.scrollTo(0, 0.8);
  yield* waitFor(0.3);

  yield* frameOpWatermark(1, Timing.slow, easeInOutCubic);
  yield* waitFor(0.3);
  yield* watermarkOp(1, 0.5, easeInOutCubic);
  yield* waitFor(0.3);

  yield* dir.addParam('exportVideo', param('String', 'watermarkMode'));

  // ── v3: audio ─────────────────────────────────────────────────────────
  yield* frameOpAudio(1, Timing.slow, easeInOutCubic);
  yield* waitFor(0.2);
  yield* barsOpacity(1, 0.3, easeInOutCubic);

  for (let round = 0; round < 6; round++) {
    yield* all(
      ...barHeights.map((h, i) =>
        h(BAR_MIN_H + Math.abs(Math.sin(i * 2.3 + round * 1.1)) * (BAR_MAX_H - BAR_MIN_H), 0.08, easeInOutCubic)
      ),
    );
  }
  yield* all(...barHeights.map(h => h(NORMALIZED_H, 0.4, easeInOutCubic)));
  yield* waitFor(0.5);

  yield* dir.addParam('exportVideo', param('String', 'audioProfile'));

  // ── схлопывание ───────────────────────────────────────────────────────
  yield* all(
    collapseSSub(ICON_SCALE, 0.8, easeInOutCubic),
    collapseYSub(ICON_Y, 0.8, easeInOutCubic),
    collapseXSub(PANEL_X + ICON_SPACING, 0.8, easeInOutCubic),
    collapseSW(ICON_SCALE, 0.8, easeInOutCubic),
    collapseYW(ICON_Y2, 0.8, easeInOutCubic),
    collapseXW(PANEL_X - ICON_SPACING, 0.8, easeInOutCubic),
    collapseSA(ICON_SCALE, 0.8, easeInOutCubic),
    collapseYA(ICON_Y2, 0.8, easeInOutCubic),
    collapseXA(PANEL_X, 0.8, easeInOutCubic),
  );
  yield* waitFor(0.3);

  // ── v3: runEncoder визуал ─────────────────────────────────────────────
  yield* frameOpEncoderV3(1, Timing.slow, easeInOutCubic);
  yield* waitFor(0.2);
  const blockDelayV3 = 0.004; const blockOpV3 = 0.025;
  for (let idx = 0; idx < COLS * ROWS; idx++) {
    yield* blockOpacitiesV3[idx](1, blockOpV3, easeInOutCubic);
    if (idx < COLS * ROWS - 1) yield* waitFor(blockDelayV3);
  }
  yield* waitFor(0.5);

  // ── v3: finalizeExport визуал ─────────────────────────────────────────
  yield* all(
    frameOpFinalizeV3(1, Timing.slow, easeInOutCubic),
    formatLabelOpV3(1, Timing.slow, easeInOutCubic),
  );
  yield* waitFor(1.0);

  // ── v3c: обновляем вызов encodeWithRetry в exportVideo ────────────────
  yield* dir.scrollTo(0, 0.8);
  yield* dir.apply(m => {
    m.updateCallArgs('exportVideo', 'encodeWithRetry', ['preparedFrames', 'outputFormat', 'watermarkMode', 'audioProfile']);
  });

  // ── v3e: encodeWithRetry — сигнатура + вызов encode ───────────────────
  yield* dir.scrollTo('private byte[] encodeWithRetry', 0.8);
  yield* dir.apply(m => {
    m.addParam('encodeWithRetry', param('String', 'watermarkMode'));
    m.addParam('encodeWithRetry', param('String', 'audioProfile'));
    m.replaceLine('encodeWithRetry',
      'return encode(preparedFrames, outputFormat);',
      'return encode(preparedFrames, outputFormat, watermarkMode, audioProfile);',
    );
  });

  // ── v3f_encode: encode — сигнатура + вызов finalizeExport ─────────────
  yield* dir.scrollTo('private byte[] encode(', 0.8);
  yield* dir.apply(m => {
    m.addParam('encode', param('String', 'watermarkMode'));
    m.addParam('encode', param('String', 'audioProfile'));
    m.replaceLine('encode',
      'return finalizeExport(encodedVideo, outputFormat);',
      'return finalizeExport(encodedVideo, outputFormat, watermarkMode, audioProfile);',
    );
  });

  // ── v3f: finalizeExport появляется ────────────────────────────────────
  yield* dir.addMethodFade(
    method('private', 'byte[]', 'finalizeExport',
      [param('byte[]', 'encodedVideo'), param('String', 'outputFormat'), param('String', 'watermarkMode'), param('String', 'audioProfile')],
      ['if (!isSupportedFormat(outputFormat)) {',
       '    throw new IllegalArgumentException("Unsupported: " + outputFormat);',
       '}',
       '',
       'Container container = Muxer.mux(encodedVideo, outputFormat);',
       'container.applyWatermark(watermarkMode);',
       'container.normalizeAudio(audioProfile);',
       '',
       'return container;']),
    'encode',
  );
  yield* waitFor(1.0);
});
