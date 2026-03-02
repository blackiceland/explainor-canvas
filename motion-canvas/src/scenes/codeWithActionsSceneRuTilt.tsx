import {makeScene2D} from '@motion-canvas/2d';
import {all, chain, easeInCubic, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';
import {CODE_V3f, CODE_V4} from './codeWithActionsSceneRu.states';
import {
  CODE_CARD_STYLE,
  CODE_W,
  COLOR_RULES,
  FRAME_STROKE_DONE,
  LEFT_CENTER_X,
  PANEL_X,
} from './codeWithActionsSceneRu.config';
import {createRightPanel} from './codeWithActionsSceneRu.rightPanel';

export default makeScene2D(function* (view) {
  applyBackground(view);

  const {
    ICON_SCALE, ICON_Y, ICON_Y2, ICON_SPACING,
    skewX, skewY, scaleXn, scaleYn, rotation, radius0, strokeColor0,
    frameOpNorm, guidesOp, collapseX0, collapseY0, collapseS0,
    frameOpColor, sweepOpacity, paintProgress, collapseX1, collapseY1, collapseS1,
    frameOpEncoderV1, collapseX2, collapseY2, collapseS2, blockOpacitiesV1,
    frameOpFinalizeV1, formatLabelOpV1,
    frameOpSubtitles, subtitleBarOp, collapseXSub, collapseYSub, collapseSSub,
    frameOpWatermark, watermarkOp, collapseXW, collapseYW, collapseSW,
    NORMALIZED_H,
    frameOpAudio, collapseXA, collapseYA, collapseSA, barHeights, barsOpacity,
    frameOpEncoderV3, blockOpacitiesV3,
    frameOpFinalizeV3, formatLabelOpV3,
    labelOp, frameOpEncoder, frameOpFinalize, formatLabelOp, blockOpacities,
    dividerOp,
  } = createRightPanel(view);

  dividerOp(1);
  labelOp(1);
  frameOpEncoder(0);
  frameOpFinalize(0);
  formatLabelOp(0);
  for (const sig of blockOpacities) sig(0);

  frameOpNorm(1);
  guidesOp(0);
  skewX(0);
  skewY(0);
  scaleXn(1);
  scaleYn(1);
  rotation(0);
  radius0(10);
  strokeColor0(FRAME_STROKE_DONE);

  frameOpColor(1);
  sweepOpacity(0);
  paintProgress(1);

  frameOpEncoderV1(0);
  frameOpFinalizeV1(0);
  formatLabelOpV1(0);
  for (const sig of blockOpacitiesV1) sig(0);

  collapseS0(ICON_SCALE);
  collapseS1(ICON_SCALE);
  collapseS2(ICON_SCALE);
  collapseY0(ICON_Y);
  collapseY1(ICON_Y);
  collapseY2(ICON_Y);
  collapseX0(PANEL_X - ICON_SPACING);
  collapseX1(PANEL_X);
  collapseX2(PANEL_X + ICON_SPACING);

  frameOpSubtitles(1);
  subtitleBarOp(1);
  collapseSSub(ICON_SCALE);
  collapseYSub(ICON_Y2);
  collapseXSub(PANEL_X + ICON_SPACING);

  frameOpWatermark(1);
  watermarkOp(1);
  collapseSW(ICON_SCALE);
  collapseYW(ICON_Y2);
  collapseXW(PANEL_X - ICON_SPACING);

  frameOpAudio(1);
  barsOpacity(1);
  for (const h of barHeights) h(NORMALIZED_H);
  collapseSA(ICON_SCALE);
  collapseYA(ICON_Y2);
  collapseXA(PANEL_X);

  frameOpEncoderV3(1);
  for (const sig of blockOpacitiesV3) sig(1);
  frameOpFinalizeV3(1);
  formatLabelOpV3(1);

  const fontSize = 22;
  const lineHeight = Math.round(fontSize * 1.62 * 10) / 10;
  const paddingY = getCodePaddingY(fontSize);
  const topInset = Math.max(8, paddingY - 8);
  const customTypes = ['String', 'RuntimeException', 'IllegalStateException', 'IllegalArgumentException', 'Muxer', 'Container', 'Metadata', 'MetadataWriter', 'ContentSigner', 'Instant'];

  const cb = Manticore.create(CODE_V3f, {
    x: LEFT_CENTER_X - 50,
    y: -50,
    width: CODE_W,
    height: SafeZone.bottom - SafeZone.top - 36,
    fontSize,
    lineHeight,
    contentOffsetY: topInset,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    customTypes,
  });

  cb.mount(view);
  cb.colorize(COLOR_RULES);
  cb.node.opacity(1);
  yield* cb.scrollTo('private byte[] encode(', 0);

  yield* waitFor(0.8);

  yield* all(
    dividerOp(0, 1.0, easeInOutCubic),
    labelOp(0, 1.0, easeInOutCubic),
    frameOpNorm(0, 1.0, easeInOutCubic),
    frameOpColor(0, 1.0, easeInOutCubic),
    frameOpSubtitles(0, 1.0, easeInOutCubic),
    frameOpWatermark(0, 1.0, easeInOutCubic),
    frameOpAudio(0, 1.0, easeInOutCubic),
    frameOpEncoderV3(0, 1.0, easeInOutCubic),
    frameOpFinalizeV3(0, 1.0, easeInOutCubic),
    formatLabelOpV3(0, 1.0, easeInOutCubic),
  );

  yield* waitFor(0.25);

  const cbV4 = Manticore.create(CODE_V4, {
    x: LEFT_CENTER_X - 50,
    y: -50,
    width: CODE_W,
    height: SafeZone.bottom - SafeZone.top - 36,
    fontSize,
    lineHeight,
    contentOffsetY: topInset,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    customTypes,
  });

  cbV4.mount(view);
  cbV4.colorize(COLOR_RULES);
  cbV4.node.opacity(0);
  yield* cbV4.scrollTo('private byte[] encode(', 0);

  const codeLines = cbV4.currentCode;
  const methodStarts = codeLines
    .map((line, index) => ({line, index}))
    .filter(({line}) => /^\s*(public|private)\s+\S+\s+\w+\s*\(/.test(line))
    .map(({index}) => index);

  const buildMethodGroup = (methodName: string): number[] => {
    const start = methodStarts.find(index => codeLines[index].includes(methodName));
    if (start === undefined) return [];
    const next = methodStarts.find(index => index > start);
    const end = next === undefined ? codeLines.length - 1 : next - 1;
    return Array.from({length: end - start + 1}, (_, i) => start + i);
  };

  const newMethodGroups = [
    buildMethodGroup('packageOutput'),
    buildMethodGroup('signContent'),
    buildMethodGroup('attachMetadata'),
  ].filter(group => group.length > 0);

  for (const group of newMethodGroups) {
    for (const lineIndex of group) {
      cbV4.getLine(lineIndex)?.node.opacity(0);
    }
  }

  yield* all(
    cb.node.opacity(0, 0.25, easeInOutCubic),
    cbV4.node.opacity(1, 0.25, easeInOutCubic),
  );

  const reveal = chain(
    waitFor(0.12),
    ...newMethodGroups.map(group =>
      chain(
        all(...group
          .map(lineIndex => cbV4.getLine(lineIndex))
          .filter((line): line is NonNullable<typeof line> => line !== null)
          .map(line => line.node.opacity(1, 0.18, easeInOutCubic))),
        waitFor(0.12),
      ),
    ),
  );

  yield* all(
    cbV4.scrollTo('private byte[] attachMetadata(', 1.8, easeInOutCubic),
    reveal,
  );

  yield* waitFor(0.6);
});
