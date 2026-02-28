import {Rect, makeScene2D} from '@motion-canvas/2d';
import {all, easeInOutCubic, easeOutCubic, linear, waitFor} from '@motion-canvas/core';
import {Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Fonts, Screen, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';
import {
  CODE_CARD_STYLE,
  CODE_W,
  COLOR_RULES,
  FRAME_STROKE_DONE,
  LEFT_CENTER_X,
  PANEL_X,
  PASS_THROUGH,
} from './codeWithActionsSceneRu.config';
import {
  CODE_V0,
  CODE_V1a,
  CODE_V1b,
  CODE_V1c,
  CODE_V2a_export,
  CODE_V2a,
  CODE_V2b_export,
  CODE_V2b,
  CODE_V3a,
  CODE_V3b,
  CODE_V3c,
  CODE_V3d,
  CODE_V3e,
  CODE_V3f_encode,
  CODE_V3f,
} from './codeWithActionsSceneRu.states';
import {createRightPanel} from './codeWithActionsSceneRu.rightPanel';

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

  // ── CodeBlock ──────────────────────────────────────────────────────────
  const cb = Manticore.create(CODE_V0, {
    x: LEFT_CENTER_X - 50, y: -50,
    width: CODE_W,
    height: SafeZone.bottom - SafeZone.top - 36,
    fontSize, lineHeight,
    contentOffsetY: topInset,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    customTypes: ['String', 'RuntimeException', 'IllegalStateException', 'IllegalArgumentException', 'Muxer', 'Container'],
  });
  cb.mount(view);
  cb.colorize(COLOR_RULES);
  const morph = (code: string, opts: Parameters<typeof cb.morphTo>[1] = {}) =>
    cb.morphTo(code, {scrollStrategy: 'block', removeDuration: 0, moveDuration: 0.5, ...opts});

  const FADE_IN = Timing.slow;

  // ── v0: появление ─────────────────────────────────────────────────────
  yield* dividerOp(1, FADE_IN, easeInOutCubic);
  yield* cb.appear(FADE_IN);
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

  yield* morph(CODE_V1a);
  yield* waitFor(0.5);

  yield* morph(CODE_V1b);
  yield* waitFor(0.8);

  yield* morph(CODE_V1c);
  yield* waitFor(0.5);

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

  yield* cb.scrollTo(0, 0.6);
  yield* morph(CODE_V2a_export);
  yield* waitFor(0.5);

  yield* morph(CODE_V2a);
  yield* waitFor(0.8);

  yield* cb.scrollTo(0, 0.8);
  yield* morph(CODE_V2b_export, {flashRemovedColor: 'rgba(255, 80, 80, 0.95)', flashRemovedDuration: 0.2});
  yield* waitFor(0.5);

  yield* morph(CODE_V2b);
  yield* waitFor(1.5);

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

  yield* all(
    cb.dimLines(0, exportVideoLine - 1, 0.25, 0.5),
    cb.dimLines(exportVideoLine + 2, cb.lineCount - 1, 0.25, 0.5),
    highlight(exportVideoLine, exportVideoLine + 1),
  );
  yield* waitFor(0.8);

  yield* highlight(exportCallLine, exportCallLine);
  yield* waitFor(1.0);

  yield* cb.scrollTo(retrySignature, 1.2);
  yield* highlight(retrySignature, retrySignature);
  yield* waitFor(0.8);

  yield* highlight(encodeCall, encodeCall);
  yield* waitFor(0.8);

  yield* highlight(encodeSignature, encodeSignature);
  yield* waitFor(0.8);

  yield* highlight(finalizeCallIdx, finalizeCallIdx);
  yield* waitFor(2.0);

  const STRIPE_COLOR  = 'rgba(255, 80, 120, 0.18)';
  const stripeW       = CODE_W + 40;
  const stripeH       = lineHeight * 1.15;
  const stripeX       = -Screen.width / 2 + stripeW / 2;

  const retryDefLine    = cb.findLine('private byte[] encodeWithRetry');
  const finalizeOutLine = cb.findLine('return finalizeExport(encodedVideo, outputFormat)');
  const encodeCallLine2 = cb.findLine('return encode(preparedFrames');

  const stripeRetry = new Rect({
    width: stripeW, height: stripeH,
    x: stripeX, y: cb.getLineSceneY(retryDefLine),
    fill: STRIPE_COLOR, opacity: 0, radius: 4,
  });
  const stripeFinal = new Rect({
    width: stripeW, height: stripeH,
    x: stripeX, y: cb.getLineSceneY(finalizeOutLine),
    fill: STRIPE_COLOR, opacity: 0, radius: 4,
  });
  view.add(stripeRetry);
  view.add(stripeFinal);

  yield* all(
    stripeRetry.opacity(1, 0.5, easeInOutCubic),
    stripeFinal.opacity(1, 0.5, easeInOutCubic),
  );
  yield* waitFor(1.2);

  yield* cb.dimLines(encodeCallLine2, encodeCallLine2, 1.0, 0.18);
  yield* cb.dimLines(encodeCallLine2, encodeCallLine2, 0.25, 0.18);
  yield* cb.dimLines(encodeCallLine2, encodeCallLine2, 1.0, 0.18);
  yield* cb.dimLines(encodeCallLine2, encodeCallLine2, 0.25, 0.18);
  yield* cb.dimLines(encodeCallLine2, encodeCallLine2, 1.0, 0.18);
  yield* waitFor(0.5);

  yield* all(
    stripeRetry.opacity(0, 0.5, easeInOutCubic),
    stripeFinal.opacity(0, 0.5, easeInOutCubic),
    cb.showAllLines(0.5),
    cb.colorizeAnimated(0, cb.lineCount - 1, 0.5),
  );

  yield* waitFor(1.5);

  // ── v3: скролл наверх → watermark фрейм → параметр ─────────────────
  yield* cb.scrollTo(0, 0.8);
  yield* waitFor(0.3);

  yield* frameOpWatermark(1, Timing.slow, easeInOutCubic);
  yield* waitFor(0.3);
  yield* watermarkOp(1, 0.5, easeInOutCubic);
  yield* waitFor(0.3);

  yield* morph(CODE_V3a);
  yield* waitFor(0.5);

  // ── v3: audio фрейм → параметр ────────────────────────────────────────
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

  yield* morph(CODE_V3b);
  yield* waitFor(0.5);

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

  // ── v3: обновляем вызовы в exportVideo ────────────────────────────────
  yield* cb.scrollTo(0, 0.8);
  yield* morph(CODE_V3c);
  yield* waitFor(0.5);

  // ── v3: prepareFrames — сигнатура + тело ─────────────────────────────
  yield* morph(CODE_V3d);
  yield* waitFor(0.5);

  // ── v3: encodeWithRetry — сигнатура + вызов encode ───────────────────
  yield* cb.scrollTo('private byte[] encodeWithRetry', 0.8);
  yield* morph(CODE_V3e);
  yield* waitFor(0.5);

  // ── v3: encode — сигнатура + вызов finalizeExport расширяются ──────
  yield* cb.scrollTo('private byte[] encode(', 0.8);
  yield* morph(CODE_V3f_encode);
  yield* waitFor(0.5);

  // ── v3: finalizeExport появляется ─────────────────────────────────
  yield* morph(CODE_V3f);
  yield* waitFor(1.5);
});
