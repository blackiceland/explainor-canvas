import {makeScene2D} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, linear, tween, waitFor} from '@motion-canvas/core';
import {Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Colors, Fonts, Screen} from '../core/theme';
import {applyBackground} from '../core/utils';
import {createCodePlaneScene, renderCodeToCanvas, updateTexture} from '../core/three/CodePlaneScene';
import {createThreeView} from '../core/three/ThreeCanvas';
import {CODE_V3f} from './codeWithActionsSceneRu.states';
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
  const customTypes = ['String', 'RuntimeException', 'IllegalStateException', 'IllegalArgumentException', 'Muxer', 'Container'];

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

  yield* waitFor(0.6);

  yield* all(
    dividerOp(0, 0.8, easeInOutCubic),
    labelOp(0, 0.8, easeInOutCubic),
    frameOpNorm(0, 0.8, easeInOutCubic),
    frameOpColor(0, 0.8, easeInOutCubic),
    frameOpSubtitles(0, 0.8, easeInOutCubic),
    frameOpWatermark(0, 0.8, easeInOutCubic),
    frameOpAudio(0, 0.8, easeInOutCubic),
    frameOpEncoderV3(0, 0.8, easeInOutCubic),
    frameOpFinalizeV3(0, 0.8, easeInOutCubic),
    formatLabelOpV3(0, 0.8, easeInOutCubic),
  );

  yield* waitFor(0.4);

  // --- 3D Star Wars crawl ---
  const w = Screen.width;
  const h = Screen.height;
  const codeLines = cb.currentCode;
  const opaque = (c: string) => c.replace(
    /rgba\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*[^)]+\)/gi,
    'rgb($1,$2,$3)',
  );
  const crawlTheme = {
    ...DryFiltersV3CodeTheme,
    plain: opaque(DryFiltersV3CodeTheme.plain),
    punctuation: opaque(DryFiltersV3CodeTheme.punctuation),
    operator: opaque(DryFiltersV3CodeTheme.operator),
    keyword: opaque(DryFiltersV3CodeTheme.keyword),
    annotation: opaque(DryFiltersV3CodeTheme.annotation),
    type: opaque(DryFiltersV3CodeTheme.type),
    constant: opaque(DryFiltersV3CodeTheme.constant),
    method: opaque(DryFiltersV3CodeTheme.method),
    string: opaque(DryFiltersV3CodeTheme.string),
    number: opaque(DryFiltersV3CodeTheme.number),
    comment: opaque(DryFiltersV3CodeTheme.comment),
  };

  // Build centered texture so code sits in the middle of camera frame.
  const rawCodeCanvas = renderCodeToCanvas(
    codeLines,
    crawlTheme,
    Fonts.code,
    fontSize,
    customTypes,
    CODE_W,
    'rgba(0,0,0,0)',
  );
  const textureW = w;
  const textureH = rawCodeCanvas.height / 2;
  const codeCanvas = document.createElement('canvas');
  codeCanvas.width = textureW * 2;
  codeCanvas.height = textureH * 2;
  const codeCtx = codeCanvas.getContext('2d')!;
  codeCtx.scale(2, 2);
  codeCtx.drawImage(
    rawCodeCanvas,
    (textureW - CODE_W) / 2,
    0,
    CODE_W,
    textureH,
  );

  // Plane sized to fill screen width. Height = proportional to texture.
  const FOV = 50;
  const CAMERA_Z = 4.0;
  const fovRad = (FOV * Math.PI) / 180;
  const visibleH = 2 * CAMERA_Z * Math.tan(fovRad / 2);
  const visibleW = visibleH * (w / h);

  // Keep a margin so the whole crawl sheet is fully visible in frame.
  const planeW = visibleW * 0.88;
  const codeCanvasLogicalH = codeCanvas.height / 2;
  const planeH = planeW * (codeCanvasLogicalH / textureW);

  const {scene: threeScene, camera, plane, texture} = createCodePlaneScene({
    planeWidth: planeW,
    planeHeight: planeH,
    cameraFov: FOV,
    cameraZ: CAMERA_Z,
    aspect: w / h,
  });
  updateTexture(texture, codeCanvas);

  const TILT = -0.92;
  const projectedHalfH = (planeH * Math.cos(Math.abs(TILT))) / 2;
  const planeBaseY = -visibleH / 2 + projectedHalfH + visibleH * 0.08;

  // Keep plane fixed and scroll text via UV offset.
  const progress = createSignal(0);
  texture.offset.set(0, -0.06);

  const threeView = createThreeView({
    width: w,
    height: h,
    scene: threeScene,
    camera,
    quality: 2,
    onRender: (renderer, s, cam) => {
      plane.rotation.x = TILT;
      plane.position.y = planeBaseY;
      plane.position.z = 0;
      texture.offset.y = -0.06 + progress() * 0.96;
      renderer.render(s, cam);
    },
  });

  threeView.node.opacity(0);
  view.add(threeView.node);

  // Cross-fade: Manticore out, 3D crawl in.
  yield* all(
    cb.node.opacity(0, 0.6, easeInOutCubic),
    threeView.node.opacity(1, 0.6, easeInOutCubic),
  );

  // Crawl: advance along plane local axis.
  const crawlDuration = 22;
  yield* tween(crawlDuration, v => {
    progress(linear(v));
  });

  yield* waitFor(0.5);
  threeView.dispose();
});
