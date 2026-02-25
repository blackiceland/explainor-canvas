import {Line, makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, easeOutCubic, linear, waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Fonts, Screen, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

const PANEL_W       = Screen.width * 5 / 16;
const PANEL_X       = Screen.width / 2 - PANEL_W / 2;
const DIVIDER_X     = PANEL_X - PANEL_W / 2;

const CODE_RIGHT    = DIVIDER_X;
const CODE_W        = CODE_RIGHT - (-Screen.width / 2 + 40);
const LEFT_CENTER_X = -Screen.width / 2 + 40 + CODE_W / 2;

const FRAME_W            = 420;
const FRAME_H            = 236;
const FRAME_FILL_NEUTRAL = 'rgba(244, 241, 235, 0.10)';
const FRAME_FILL_WARM    = 'rgba(255, 182, 193, 0.35)';
const FRAME_STROKE_DONE  = 'rgba(244, 241, 235, 0.85)';
const SCANLINE_COLOR     = 'rgba(244, 241, 235, 0.06)';
const SCANLINE_COUNT     = 10;

const ITEM_GAP   = 73;
const Y_ENCODER  = -305;
const Y_FINALIZE = Y_ENCODER + FRAME_H + ITEM_GAP;

const FRAME_STROKE = 'rgba(244, 241, 235, 0.50)';
const GUIDE_COLOR  = 'rgba(244, 241, 235, 0.15)';
const SWEEP_COLOR  = 'rgba(244, 230, 200, 0.18)';

const SOFT_GREEN    = 'rgba(168, 214, 178, 0.88)';
const VAR_LIGHT     = 'rgba(244, 241, 235, 0.96)';
const TYPE_CLEAN    = 'rgba(220, 215, 255, 0.80)';
const METHOD_COLOR  = DryFiltersV3CodeTheme.method;
const PASS_THROUGH  = 'rgba(255, 100, 130, 0.95)';

const CODE_CARD_STYLE = {
  radius: 24, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0, shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
  shadowOffsetX: 0, shadowOffsetY: 0, edge: false,
} as const;

const V0 = `public byte[] exportVideo(byte[] sourceFrames, String outputFormat) {
    validateInput(sourceFrames, outputFormat);
    byte[] encodedVideo = runEncoder(sourceFrames);

    return finalizeExport(encodedVideo, outputFormat);
}`;

const COLOR_RULES = [
  {match: 'sourceFrames',      color: VAR_LIGHT},
  {match: 'outputFormat',      color: VAR_LIGHT},
  {match: 'colorProfile',      color: VAR_LIGHT},
  {match: 'encodedVideo',      color: VAR_LIGHT},
  {match: /^byte$/,            color: TYPE_CLEAN},
  {match: 'preparedFrames',    color: VAR_LIGHT},
  {match: 'normalizedFrames',  color: VAR_LIGHT},
  {match: 'exportVideo',       color: VAR_LIGHT},
  {match: 'String',            color: TYPE_CLEAN},
  {match: 'validateInput',     color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'runEncoder',        color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'finalizeExport',    color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'normalizeFrames',   color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'applyColorProfile', color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'overlaySubtitles',  color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'encodeWithRetry',   color: METHOD_COLOR, onlyTypes: ['method']},
  {match: /^encode$/,          color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'subtitleTrack',     color: VAR_LIGHT},
  {match: 'coloredFrames',     color: VAR_LIGHT},
  {match: 'attemptsLeft',      color: VAR_LIGHT},
  {match: 'maxAttempts',       color: VAR_LIGHT},
  {match: /^"[^"]*"$/,         color: SOFT_GREEN},
];

export default makeScene2D(function* (view) {
  applyBackground(view);

  const fontSize   = 22;
  const lineHeight = Math.round(fontSize * 1.62 * 10) / 10;
  const paddingY   = getCodePaddingY(fontSize);
  const topInset   = Math.max(8, paddingY - 8);

  // ── иконки (collapse) ─────────────────────────────────────────────────
  const ICON_SCALE   = 0.38;
  const ICON_Y       = -Screen.height / 2 + 135;
  const ICON_SPACING = FRAME_W * ICON_SCALE + 24;

  // ── normalizeFrames ────────────────────────────────────────────────────
  const Y_NORMALIZE  = Y_ENCODER;
  const skewX        = createSignal(6);
  const skewY        = createSignal(-3);
  const scaleXn      = createSignal(0.91);
  const scaleYn      = createSignal(1.07);
  const rotation     = createSignal(-2.8);
  const radius0      = createSignal(2);
  const strokeColor0 = createSignal(FRAME_STROKE);
  const frameOpNorm  = createSignal(0);
  const guidesOp     = createSignal(0);
  const collapseX0   = createSignal(PANEL_X);
  const collapseY0   = createSignal(Y_NORMALIZE);
  const collapseS0   = createSignal(1);

  // ── applyColorProfile ──────────────────────────────────────────────────
  const Y_COLOR_PROFILE  = Y_ENCODER + FRAME_H + ITEM_GAP;
  const frameOpColor     = createSignal(0);
  const sweepOpacity     = createSignal(0);
  const paintProgress    = createSignal(0);
  const collapseX1       = createSignal(PANEL_X);
  const collapseY1       = createSignal(Y_COLOR_PROFILE);
  const collapseS1       = createSignal(1);

  // ── runEncoder v1 (покрашенный, третий фрейм) ─────────────────────────
  const Y_ENCODER_V1     = Y_COLOR_PROFILE + FRAME_H + ITEM_GAP;
  const frameOpEncoderV1 = createSignal(0);
  const collapseX2       = createSignal(PANEL_X);
  const collapseY2       = createSignal(Y_ENCODER_V1);
  const collapseS2       = createSignal(1);

  // ── finalizeExport v1 ─────────────────────────────────────────────────
  const Y_FINALIZE_V1     = Y_ENCODER + FRAME_H / 2;
  const frameOpFinalizeV1 = createSignal(0);
  const formatLabelOpV1   = createSignal(0);
  const collapseXFin      = createSignal(PANEL_X);
  const collapseYFin      = createSignal(Y_FINALIZE_V1);
  const collapsesFin      = createSignal(1);

  // ── overlaySubtitles v2 ───────────────────────────────────────────────
  const Y_SUBTITLES       = Y_FINALIZE_V1;
  const SUBTITLE_Y        = FRAME_H / 2 - 52;
  const frameOpSubtitles  = createSignal(0);
  const subtitleBarOp     = createSignal(0);

  // ── applyWatermark v3 ─────────────────────────────────────────────────
  const Y_WATERMARK       = Y_SUBTITLES + FRAME_H + 50;
  const frameOpWatermark  = createSignal(0);
  const watermarkOp       = createSignal(0);
  const collapseXW        = createSignal(PANEL_X);
  const collapseYW        = createSignal(Y_WATERMARK);
  const collapseSW        = createSignal(1);

  // ── normalizeAudio v3 ─────────────────────────────────────────────────
  const BAR_COUNT         = 9;
  const BAR_W             = 18;
  const BAR_MAX_H         = 80;
  const BAR_MIN_H         = 10;
  const NORMALIZED_H      = 36;
  const Y_AUDIO           = Y_WATERMARK + FRAME_H + 50;
  const frameOpAudio      = createSignal(0);
  const collapseXA        = createSignal(PANEL_X);
  const collapseYA        = createSignal(Y_AUDIO);
  const collapseSA        = createSignal(1);
  const barHeights        = Array.from({length: BAR_COUNT}, (_, i) =>
    createSignal(BAR_MIN_H + Math.abs(Math.sin(i * 1.7 + 0.5)) * (BAR_MAX_H - BAR_MIN_H))
  );
  const barsOpacity       = createSignal(0);

  // ── runEncoder / finalizeExport v0 ────────────────────────────────────
  const COLS              = 8; const ROWS = 5;
  const labelOp           = createSignal(0);
  const frameOpEncoder    = createSignal(0);
  const frameOpFinalize   = createSignal(0);
  const formatLabelOp     = createSignal(0);
  const blockOpacities    = Array.from({length: COLS * ROWS}, () => createSignal(0));
  const blockOpacitiesV1  = Array.from({length: COLS * ROWS}, () => createSignal(0));

  const dividerOp = createSignal(0);
  view.add(
    <Line
      points={[[DIVIDER_X, -Screen.height / 2], [DIVIDER_X, Screen.height / 2]]}
      stroke={'rgba(244,241,235,0.08)'}
      lineWidth={1}
      opacity={dividerOp}
    />,
  );

  view.add(<>
    {/* normalizeFrames — snap guides */}
    <Line points={[[PANEL_X - FRAME_W*0.55, Y_NORMALIZE],[PANEL_X + FRAME_W*0.55, Y_NORMALIZE]]}
      stroke={GUIDE_COLOR} lineWidth={1} lineDash={[8,8]} opacity={guidesOp}/>
    <Line points={[[PANEL_X, Y_NORMALIZE - FRAME_H*0.7],[PANEL_X, Y_NORMALIZE + FRAME_H*0.7]]}
      stroke={GUIDE_COLOR} lineWidth={1} lineDash={[8,8]} opacity={guidesOp}/>

    {/* normalizeFrames — distorted frame */}
    <Rect
      x={collapseX0} y={collapseY0}
      width={FRAME_W} height={FRAME_H}
      fill={FRAME_FILL_NEUTRAL} stroke={strokeColor0} lineWidth={2} radius={radius0}
      opacity={frameOpNorm}
      skewX={skewX} skewY={skewY} scaleX={() => scaleXn() * collapseS0()} scaleY={() => scaleYn() * collapseS0()} rotation={rotation}
    >
      {Array.from({length: SCANLINE_COUNT}, (_, i) => {
        const y = -FRAME_H/2 + ((i+1)/(SCANLINE_COUNT+1))*FRAME_H;
        return <Line points={[[-FRAME_W/2+10,y],[FRAME_W/2-10,y]]} stroke={SCANLINE_COLOR} lineWidth={1}/>;
      })}
    </Rect>

    {/* applyColorProfile */}
    <Rect x={collapseX1} y={collapseY1} width={FRAME_W} height={FRAME_H}
      fill={FRAME_FILL_NEUTRAL} stroke={FRAME_STROKE_DONE} lineWidth={3} radius={6}
      opacity={frameOpColor} scale={collapseS1} clip
    >
      {Array.from({length: SCANLINE_COUNT}, (_, i) => {
        const y = -FRAME_H/2 + ((i+1)/(SCANLINE_COUNT+1))*FRAME_H;
        return <Line points={[[-FRAME_W/2+10,y],[FRAME_W/2-10,y]]} stroke={SCANLINE_COLOR} lineWidth={1}/>;
      })}
      <Rect
        x={() => -FRAME_W/2 + (FRAME_W * paintProgress()) / 2}
        y={0} width={() => FRAME_W * paintProgress()} height={FRAME_H}
        fill={FRAME_FILL_WARM} clip
      >
        <Rect
          x={() => (FRAME_W * paintProgress()) / 2 - 8}
          y={0} width={16} height={FRAME_H}
          fill={SWEEP_COLOR} opacity={sweepOpacity}
        />
      </Rect>
    </Rect>

    {/* runEncoder v1 — покрашенный, кубики анимируются */}
    <Rect x={collapseX2} y={collapseY2} width={FRAME_W} height={FRAME_H}
      fill={FRAME_FILL_WARM} stroke={FRAME_STROKE_DONE} lineWidth={3} radius={6}
      opacity={frameOpEncoderV1} scale={collapseS2} clip
    >
      {Array.from({length: SCANLINE_COUNT}, (_, i) => {
        const y = -FRAME_H/2 + ((i+1)/(SCANLINE_COUNT+1))*FRAME_H;
        return <Line points={[[-FRAME_W/2+10,y],[FRAME_W/2-10,y]]} stroke={SCANLINE_COLOR} lineWidth={1}/>;
      })}
      {Array.from({length: COLS * ROWS}, (_, idx) => {
        const col = idx % COLS; const row = Math.floor(idx / COLS);
        const bw = FRAME_W/COLS; const bh = FRAME_H/ROWS;
        const x = -FRAME_W/2 + col*bw + bw/2; const y = -FRAME_H/2 + row*bh + bh/2;
        return <Rect key={String(idx)} x={x} y={y} width={bw-2} height={bh-2}
          fill={'rgba(180,175,220,0.45)'} radius={2} opacity={blockOpacitiesV1[idx]}/>;
      })}
    </Rect>

    {/* finalizeExport v1 — dashed border */}
    <Rect x={collapseXFin} y={collapseYFin} width={FRAME_W+16} height={FRAME_H+16}
      fill={'rgba(0,0,0,0)'} stroke={'rgba(244,241,235,0.50)'} lineWidth={2}
      lineDash={[10,7]} radius={14} scale={collapsesFin} opacity={frameOpFinalizeV1}
    />
    {/* finalizeExport v1 — frame */}
    <Rect x={collapseXFin} y={collapseYFin} width={FRAME_W} height={FRAME_H}
      fill={FRAME_FILL_WARM} stroke={FRAME_STROKE_DONE} lineWidth={3}
      radius={6} scale={collapsesFin} opacity={frameOpFinalizeV1} clip
    >
      {Array.from({length: SCANLINE_COUNT}, (_, i) => {
        const y = -FRAME_H/2 + ((i+1)/(SCANLINE_COUNT+1))*FRAME_H;
        return <Line points={[[-FRAME_W/2+10,y],[FRAME_W/2-10,y]]} stroke={SCANLINE_COLOR} lineWidth={1}/>;
      })}
      {Array.from({length: COLS * ROWS}, (_, idx) => {
        const col = idx % COLS; const row = Math.floor(idx / COLS);
        const bw = FRAME_W/COLS; const bh = FRAME_H/ROWS;
        const x = -FRAME_W/2 + col*bw + bw/2; const y = -FRAME_H/2 + row*bh + bh/2;
        return <Rect key={String(idx)} x={x} y={y} width={bw-2} height={bh-2}
          fill={'rgba(180,175,220,0.45)'} radius={2}/>;
      })}
    </Rect>
    {/* .mp4 badge v1 */}
    <Rect
      x={() => collapseXFin() + (FRAME_W/2 - 24) * collapsesFin()}
      y={() => collapseYFin() + (-FRAME_H/2 + 36) * collapsesFin()}
      width={() => 96 * collapsesFin()} height={() => 40 * collapsesFin()}
      fill={'rgba(30,28,40,0.90)'}
      stroke={'rgba(244,241,235,0.85)'} lineWidth={1.5} radius={6}
      offset={[1,0]} opacity={formatLabelOpV1}
    >
      <Txt x={0} y={0} text={'.mp4'} fontFamily={Fonts.code}
        fontSize={() => 24 * collapsesFin()} fill={'rgba(244,241,235,1.0)'}/>
    </Rect>

    {/* overlaySubtitles v2 — на базе покраски, без макроблоков */}
    <Rect x={PANEL_X} y={Y_SUBTITLES} width={FRAME_W} height={FRAME_H}
      fill={FRAME_FILL_WARM} stroke={FRAME_STROKE_DONE} lineWidth={3}
      radius={6} opacity={frameOpSubtitles} clip
    >
      {Array.from({length: SCANLINE_COUNT}, (_, i) => {
        const y = -FRAME_H/2 + ((i+1)/(SCANLINE_COUNT+1))*FRAME_H;
        return <Line points={[[-FRAME_W/2+10,y],[FRAME_W/2-10,y]]} stroke={SCANLINE_COLOR} lineWidth={1}/>;
      })}
      <Rect x={0} y={SUBTITLE_Y} width={FRAME_W - 40} height={44}
        fill={'rgba(0,0,0,0.55)'} radius={4} opacity={subtitleBarOp}/>
      <Txt x={0} y={SUBTITLE_Y} text={'kuroshima'} fontFamily={Fonts.code}
        fontSize={26} fill={'rgba(244,241,235,0.96)'} letterSpacing={2} opacity={subtitleBarOp}/>
    </Rect>

    {/* applyWatermark v3 — inherits subtitle from previous step */}
    <Rect x={collapseXW} y={collapseYW} width={FRAME_W} height={FRAME_H}
      fill={FRAME_FILL_WARM} stroke={FRAME_STROKE_DONE} lineWidth={2}
      radius={10} opacity={frameOpWatermark} scale={collapseSW} clip
    >
      {Array.from({length: SCANLINE_COUNT}, (_, i) => {
        const y = -FRAME_H/2 + ((i+1)/(SCANLINE_COUNT+1))*FRAME_H;
        return <Line points={[[-FRAME_W/2+10,y],[FRAME_W/2-10,y]]} stroke={SCANLINE_COLOR} lineWidth={1}/>;
      })}
      <Rect x={0} y={SUBTITLE_Y} width={FRAME_W-40} height={44} fill={'rgba(0,0,0,0.55)'} radius={4}/>
      <Txt x={0} y={SUBTITLE_Y} text={'kuroshima'} fontFamily={Fonts.code} fontSize={26} fill={'rgba(244,241,235,0.96)'} letterSpacing={2}/>
      <Txt
        x={-FRAME_W/2 + 26} y={-FRAME_H/2 + 44}
        text={'©'} fontFamily={Fonts.primary}
        fontSize={48} fill={'rgba(244, 241, 235, 0.60)'}
        offset={[-1, 0]} opacity={watermarkOp}
      />
    </Rect>

    {/* normalizeAudio v3 — inherits subtitle + watermark */}
    <Rect x={collapseXA} y={collapseYA} width={FRAME_W} height={FRAME_H}
      fill={FRAME_FILL_WARM} stroke={FRAME_STROKE_DONE} lineWidth={2}
      radius={10} opacity={frameOpAudio} scale={collapseSA} clip
    >
      {Array.from({length: SCANLINE_COUNT}, (_, i) => {
        const y = -FRAME_H/2 + ((i+1)/(SCANLINE_COUNT+1))*FRAME_H;
        return <Line points={[[-FRAME_W/2+10,y],[FRAME_W/2-10,y]]} stroke={SCANLINE_COLOR} lineWidth={1}/>;
      })}
      <Rect x={0} y={SUBTITLE_Y} width={FRAME_W-40} height={44} fill={'rgba(0,0,0,0.55)'} radius={4}/>
      <Txt x={0} y={SUBTITLE_Y} text={'kuroshima'} fontFamily={Fonts.code} fontSize={26} fill={'rgba(244,241,235,0.96)'} letterSpacing={2}/>
      <Txt x={-FRAME_W/2+26} y={-FRAME_H/2+44} text={'©'} fontFamily={Fonts.primary} fontSize={48} fill={'rgba(244,241,235,0.60)'} offset={[-1,0]}/>
      {Array.from({length: BAR_COUNT}, (_, i) => {
        const totalW = BAR_COUNT * BAR_W + (BAR_COUNT - 1) * 6;
        const x = -totalW/2 + i*(BAR_W+6) + BAR_W/2;
        return <Rect key={String(i)} x={x} y={0} width={BAR_W} height={barHeights[i]}
          fill={'rgba(244, 241, 235, 0.90)'} radius={3} opacity={barsOpacity}/>;
      })}
    </Rect>

    {/* section label */}
    <Txt
      x={PANEL_X} y={-Screen.height / 2 + 52}
      text={'VIDEO EXPORT'} fontFamily={Fonts.primary}
      fontSize={26} fill={'rgba(244,241,235,0.90)'}
      letterSpacing={6} fontWeight={700} opacity={labelOp}
    />

    {/* runEncoder */}
    <Rect x={PANEL_X} y={Y_ENCODER} width={FRAME_W} height={FRAME_H}
      fill={FRAME_FILL_NEUTRAL} stroke={FRAME_STROKE_DONE} lineWidth={3} radius={6}
      opacity={frameOpEncoder} clip
    >
      {Array.from({length: SCANLINE_COUNT}, (_, i) => {
        const y = -FRAME_H/2 + ((i+1)/(SCANLINE_COUNT+1))*FRAME_H;
        return <Line points={[[-FRAME_W/2+10,y],[FRAME_W/2-10,y]]} stroke={SCANLINE_COLOR} lineWidth={1}/>;
      })}
      {Array.from({length: COLS * ROWS}, (_, idx) => {
        const col = idx % COLS; const row = Math.floor(idx / COLS);
        const bw = FRAME_W/COLS; const bh = FRAME_H/ROWS;
        const x = -FRAME_W/2 + col*bw + bw/2; const y = -FRAME_H/2 + row*bh + bh/2;
        return <Rect key={String(idx)} x={x} y={y} width={bw-2} height={bh-2}
          fill={'rgba(180,175,220,0.45)'} radius={2} opacity={blockOpacities[idx]}/>;
      })}
    </Rect>

    {/* finalizeExport — dashed border */}
    <Rect x={PANEL_X} y={Y_FINALIZE} width={FRAME_W+16} height={FRAME_H+16}
      fill={'rgba(0,0,0,0)'} stroke={'rgba(244,241,235,0.50)'} lineWidth={2}
      lineDash={[10,7]} radius={14} opacity={frameOpFinalize}
    />
    {/* finalizeExport — frame */}
    <Rect x={PANEL_X} y={Y_FINALIZE} width={FRAME_W} height={FRAME_H}
      fill={FRAME_FILL_NEUTRAL} stroke={FRAME_STROKE_DONE} lineWidth={3}
      radius={6} opacity={frameOpFinalize} clip
    >
      {Array.from({length: SCANLINE_COUNT}, (_, i) => {
        const y = -FRAME_H/2 + ((i+1)/(SCANLINE_COUNT+1))*FRAME_H;
        return <Line points={[[-FRAME_W/2+10,y],[FRAME_W/2-10,y]]} stroke={SCANLINE_COLOR} lineWidth={1}/>;
      })}
      {Array.from({length: COLS * ROWS}, (_, idx) => {
        const col = idx % COLS; const row = Math.floor(idx / COLS);
        const bw = FRAME_W/COLS; const bh = FRAME_H/ROWS;
        const x = -FRAME_W/2 + col*bw + bw/2; const y = -FRAME_H/2 + row*bh + bh/2;
        return <Rect key={String(idx)} x={x} y={y} width={bw-2} height={bh-2}
          fill={'rgba(180,175,220,0.45)'} radius={2}/>;
      })}
    </Rect>
    {/* .mp4 badge */}
    <Rect
      x={PANEL_X + FRAME_W/2 - 24} y={Y_FINALIZE - FRAME_H/2 + 36}
      width={96} height={40} fill={'rgba(30,28,40,0.90)'}
      stroke={'rgba(244,241,235,0.85)'} lineWidth={1.5} radius={6}
      offset={[1,0]} opacity={formatLabelOp}
    >
      <Txt x={0} y={0} text={'.mp4'} fontFamily={Fonts.code} fontSize={24} fill={'rgba(244,241,235,1.0)'}/>
    </Rect>
  </>);

  // ── CodeBlock ──────────────────────────────────────────────────────────
  const cb = CodeBlock.fromCode(V0, {
    x: LEFT_CENTER_X - 50, y: -50,
    width: CODE_W,
    height: SafeZone.bottom - SafeZone.top - 36,
    fontSize, lineHeight,
    contentOffsetY: topInset,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    customTypes: ['String', 'RuntimeException', 'IllegalStateException', 'IllegalArgumentException'],
  });
  cb.mount(view);
  cb.colorize(COLOR_RULES);

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

  // ── v0 → v1 ────────────────────────────────────────────────────────────

  // 1) старые фреймы плавно исчезают
  yield* all(
    frameOpEncoder(0, FADE_IN, easeInOutCubic),
    frameOpFinalize(0, FADE_IN, easeInOutCubic),
    formatLabelOp(0, FADE_IN, easeInOutCubic),
  );
  for (const sig of blockOpacities) sig(0);
  yield* waitFor(0.3);

  // 2) normalizeFrames появляется на том же месте
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

  // 3) applyColorProfile появляется под normalizeFrames
  yield* frameOpColor(1, FADE_IN, easeInOutCubic);
  yield* waitFor(0.2);
  paintProgress(0);
  yield* sweepOpacity(1, 0.15, easeInOutCubic);
  yield* paintProgress(1, 1.0, linear);
  yield* sweepOpacity(0, 0.2, easeInOutCubic);
  yield* waitFor(0.3);

  // 4) код: colorProfile в сигнатуру — вставка перед ")" в строке 0
  yield* cb.insertInLine(0, ')', ', String colorProfile', {fromEnd: true});
  yield* waitFor(0.5);

  // 6) вставляем вызов prepareFrames (после строки 1: validateInput)
  yield* cb.insertLinesAt(1, '    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile);', {
    extraColorRules: [{match: 'prepareFrames', color: METHOD_COLOR}],
  });
  yield* waitFor(0.3);

  // 7) меняем sourceFrames → preparedFrames в runEncoder (строка 3)
  yield* cb.replaceInLine(3, 'sourceFrames', 'preparedFrames');
  yield* waitFor(0.8);

  // 8) вставляем реализацию prepareFrames (после строки 6)
  yield* cb.insertLinesAt(6, [
    '',
    'private byte[] prepareFrames(byte[] sourceFrames, String colorProfile) {',
    '    byte[] normalizedFrames = normalizeFrames(sourceFrames);',
    '    return applyColorProfile(normalizedFrames, colorProfile);',
    '}',
  ], {
    extraColorRules: [{match: 'prepareFrames', color: VAR_LIGHT}],
  });
  yield* waitFor(0.5);

  // 9) runEncoder v1 появляется после кода — быстрая анимация кубиков
  yield* frameOpEncoderV1(1, FADE_IN, easeInOutCubic);
  yield* waitFor(0.1);
  const blockDelayV1 = 0.004; const blockOpV1 = 0.025;
  for (let idx = 0; idx < COLS * ROWS; idx++) {
    yield* blockOpacitiesV1[idx](1, blockOpV1, easeInOutCubic);
    if (idx < COLS * ROWS - 1) yield* waitFor(blockDelayV1);
  }
  yield* waitFor(0.8);

  // 10) три фрейма уменьшаются и уезжают наверх рядом
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

  // 11) finalizeExport v1 появляется вместе с .mp4 badge
  yield* all(
    frameOpFinalizeV1(1, FADE_IN, easeInOutCubic),
    formatLabelOpV1(1, FADE_IN, easeInOutCubic),
  );
  yield* waitFor(2);

  // ── v1 → v2 ────────────────────────────────────────────────────────────

  // 1) два фрейма исчезают
  yield* all(
    frameOpFinalizeV1(0, FADE_IN, easeInOutCubic),
    formatLabelOpV1(0, FADE_IN, easeInOutCubic),
    frameOpEncoderV1(0, FADE_IN, easeInOutCubic),
  );
  for (const sig of blockOpacitiesV1) sig(0);
  yield* waitFor(0.3);

  // 2) появляется фрейм overlaySubtitles
  yield* frameOpSubtitles(1, FADE_IN, easeInOutCubic);
  yield* waitFor(0.3);
  yield* subtitleBarOp(1, 0.5, easeInOutCubic);
  yield* waitFor(0.5);

  // 3) subtitleTrack в сигнатуру exportVideo — перенос ") {" на новую строку
  yield* cb.splitLine(0, ')', '        String subtitleTrack', {
    insertBeforeSplit: ',',
    fromEnd: true,
  });
  yield* waitFor(0.5);

  // 4) subtitleTrack в вызов prepareFrames — вставка перед ")" в строке 3
  //    (строка 2 стала 3 после split)
  yield* cb.insertInLine(3, ')', ', subtitleTrack', {fromEnd: true});
  yield* waitFor(0.8);

  // 5) мутация prepareFrames: "return applyColorProfile(...)" → две строки
  //    вставляем "byte[] recolored = " перед "return", затем стираем "return"
  const recoloredLineIdx = cb.findLine('return applyColorProfile');
  yield* cb.removeLines(recoloredLineIdx, 1, 0.15);
  yield* cb.insertLinesAt(recoloredLineIdx - 1, [
    '    byte[] coloredFrames = applyColorProfile(normalizedFrames, colorProfile);',
    '',
    '    return overlaySubtitles(coloredFrames, subtitleTrack);',
  ]);

  yield* waitFor(0.8);

  // 6) runEncoder → encodeWithRetry, добавляем outputFormat
  const encoderLineIdx = cb.findLine('runEncoder(preparedFrames)');
  yield* cb.replaceInLine(encoderLineIdx, 'runEncoder', 'encodeWithRetry', 0.012, null);
  cb.colorizeRange(encoderLineIdx, encoderLineIdx, cb.savedRules);
  yield* cb.insertInLine(encoderLineIdx, ')', ', outputFormat', {fromEnd: true});

  yield* waitFor(0.8);

  // 7) вставляем encodeWithRetry после prepareFrames — прокручиваем к месту вставки
  yield* cb.scrollToLine(cb.findLine('return overlaySubtitles') + 1);
  yield* cb.insertLinesAt(cb.findLine('return overlaySubtitles') + 1, [
    '',
    'private byte[] encodeWithRetry(byte[] preparedFrames, String outputFormat) {',
    '    int attemptsLeft = this.maxAttempts;',
    '',
    '    while (attemptsLeft-- > 0) {',
    '        try {',
    '            return encode(preparedFrames, outputFormat);',
    '        } catch (RuntimeException ex) { /* retry */ }',
    '    }',
    '',
    '    throw new IllegalStateException("Encoding failed");',
    '}',
  ], {
    extraColorRules: [{match: 'encodeWithRetry', color: VAR_LIGHT}],
  });

  yield* waitFor(0.8);

  yield* cb.scrollToLine(cb.findLine('throw new IllegalStateException') + 1, 0.8);
  yield* cb.insertLinesAt(cb.findLine('throw new IllegalStateException') + 1, [
    '',
    'private byte[] encode(byte[] preparedFrames, String outputFormat) {',
    '    byte[] encodedVideo = runEncoder(preparedFrames);',
    '',
    '    return finalizeExport(encodedVideo, outputFormat);',
    '}',
  ]);

  yield* waitFor(1.5);

  const passRule = [{match: 'outputFormat', color: PASS_THROUGH}];

  yield* cb.scrollToLine(0, 1.0);
  yield* waitFor(0.8);

  const exportVideoLine  = cb.findLine('public byte[] exportVideo');
  const exportCallLine   = cb.findLine('encodeWithRetry(preparedFrames, outputFormat)');
  const retrySignature   = cb.findLine('private byte[] encodeWithRetry');
  const encodeCall       = cb.findLine('return encode(preparedFrames');
  const encodeSignature  = cb.findLine('private byte[] encode(');
  const finalizeCall     = cb.findLastLine('return finalizeExport(encodedVideo, outputFormat)');

  const highlight = (from: number, to: number) => all(
    cb.dimLines(from, to, 1, 0.4),
    cb.colorizeRangeAnimated(from, to, passRule, 0.4),
  );

  yield* all(
    cb.dimLines(0, exportVideoLine - 1, 0.25, 0.5),
    cb.dimLines(exportVideoLine + 2, cb.lineCount - 1, 0.25, 0.5),
    highlight(exportVideoLine, exportVideoLine + 1),
  );
  yield* waitFor(0.8);

  yield* highlight(exportCallLine, exportCallLine);
  yield* waitFor(1.0);

  yield* cb.scrollToLine(retrySignature, 1.2);
  yield* highlight(retrySignature, retrySignature);
  yield* waitFor(0.8);

  yield* highlight(encodeCall, encodeCall);
  yield* waitFor(0.8);

  yield* highlight(encodeSignature, encodeSignature);
  yield* waitFor(0.8);

  yield* highlight(finalizeCall, finalizeCall);
  yield* waitFor(2.0);

  const STRIPE_COLOR  = 'rgba(255, 80, 120, 0.18)';
  const stripeW       = CODE_W + 40;
  const stripeH       = lineHeight * 1.15;
  const stripeX       = -Screen.width / 2 + stripeW / 2;

  const retryDefLine    = cb.findLine('private byte[] encodeWithRetry');
  const finalizeOutLine = cb.findLastLine('return finalizeExport(encodedVideo, outputFormat)');
  const encodeCallLine  = cb.findLine('return encode(preparedFrames');

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

  yield* cb.dimLines(encodeCallLine, encodeCallLine, 1.0, 0.18);
  yield* cb.dimLines(encodeCallLine, encodeCallLine, 0.25, 0.18);
  yield* cb.dimLines(encodeCallLine, encodeCallLine, 1.0, 0.18);
  yield* cb.dimLines(encodeCallLine, encodeCallLine, 0.25, 0.18);
  yield* cb.dimLines(encodeCallLine, encodeCallLine, 1.0, 0.18);
  yield* waitFor(0.5);

  cb.saveColorRules(COLOR_RULES);
  yield* all(
    stripeRetry.opacity(0, 0.5, easeInOutCubic),
    stripeFinal.opacity(0, 0.5, easeInOutCubic),
    cb.showAllLines(0.5),
    cb.colorizeRangeAnimated(0, cb.lineCount - 1, COLOR_RULES, 0.5),
  );

  yield* waitFor(1.5);

  // ── v3: applyWatermark ────────────────────────────────────────────────
  yield* frameOpWatermark(1, Timing.slow, easeInOutCubic);
  yield* waitFor(0.3);
  yield* watermarkOp(1, 0.5, easeInOutCubic);
  yield* waitFor(1.2);

  // ── v3: normalizeAudio ────────────────────────────────────────────────
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

  yield* all(
    ...barHeights.map(h => h(NORMALIZED_H, 0.4, easeInOutCubic)),
  );

  yield* waitFor(1.2);
});
