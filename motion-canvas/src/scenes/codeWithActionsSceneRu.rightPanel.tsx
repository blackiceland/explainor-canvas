import {Line, Node, Rect, Txt} from '@motion-canvas/2d';
import {createSignal} from '@motion-canvas/core';
import {Fonts, Screen} from '../core/theme';
import {
  DIVIDER_X,
  FRAME_FILL_NEUTRAL,
  FRAME_FILL_WARM,
  FRAME_H,
  FRAME_STROKE,
  FRAME_STROKE_DONE,
  FRAME_W,
  GUIDE_COLOR,
  ITEM_GAP,
  PANEL_X,
  SCANLINE_COLOR,
  SCANLINE_COUNT,
  SWEEP_COLOR,
  Y_ENCODER,
  Y_FINALIZE,
} from './codeWithActionsSceneRu.config';

export function createRightPanel(view: Node) {
  const ICON_SCALE = 0.38;
  const ICON_Y = -Screen.height / 2 + 135;
  const ICON_Y2 = ICON_Y + FRAME_H * ICON_SCALE + 20;
  const ICON_SPACING = FRAME_W * ICON_SCALE + 24;

  const Y_NORMALIZE = Y_ENCODER;
  const skewX = createSignal(6);
  const skewY = createSignal(-3);
  const scaleXn = createSignal(0.91);
  const scaleYn = createSignal(1.07);
  const rotation = createSignal(-2.8);
  const radius0 = createSignal(2);
  const strokeColor0 = createSignal(FRAME_STROKE);
  const frameOpNorm = createSignal(0);
  const guidesOp = createSignal(0);
  const collapseX0 = createSignal(PANEL_X);
  const collapseY0 = createSignal(Y_NORMALIZE);
  const collapseS0 = createSignal(1);

  const Y_COLOR_PROFILE = Y_ENCODER + FRAME_H + ITEM_GAP;
  const frameOpColor = createSignal(0);
  const sweepOpacity = createSignal(0);
  const paintProgress = createSignal(0);
  const collapseX1 = createSignal(PANEL_X);
  const collapseY1 = createSignal(Y_COLOR_PROFILE);
  const collapseS1 = createSignal(1);

  const Y_ENCODER_V1 = Y_COLOR_PROFILE + FRAME_H + ITEM_GAP;
  const frameOpEncoderV1 = createSignal(0);
  const collapseX2 = createSignal(PANEL_X);
  const collapseY2 = createSignal(Y_ENCODER_V1);
  const collapseS2 = createSignal(1);

  const Y_FINALIZE_V1 = Y_ENCODER + FRAME_H / 2;
  const frameOpFinalizeV1 = createSignal(0);
  const formatLabelOpV1 = createSignal(0);
  const collapseXFin = createSignal(PANEL_X);
  const collapseYFin = createSignal(Y_FINALIZE_V1);
  const collapsesFin = createSignal(1);

  const Y_SUBTITLES = Y_FINALIZE_V1;
  const SUBTITLE_Y = FRAME_H / 2 - 52;
  const frameOpSubtitles = createSignal(0);
  const subtitleBarOp = createSignal(0);
  const collapseXSub = createSignal(PANEL_X);
  const collapseYSub = createSignal(Y_SUBTITLES);
  const collapseSSub = createSignal(1);

  const Y_WATERMARK = Y_SUBTITLES + FRAME_H + 50;
  const frameOpWatermark = createSignal(0);
  const watermarkOp = createSignal(0);
  const collapseXW = createSignal(PANEL_X);
  const collapseYW = createSignal(Y_WATERMARK);
  const collapseSW = createSignal(1);

  const BAR_COUNT = 9;
  const BAR_W = 18;
  const BAR_MAX_H = 80;
  const BAR_MIN_H = 10;
  const NORMALIZED_H = 36;
  const Y_AUDIO = Y_WATERMARK + FRAME_H + 50;
  const frameOpAudio = createSignal(0);
  const collapseXA = createSignal(PANEL_X);
  const collapseYA = createSignal(Y_AUDIO);
  const collapseSA = createSignal(1);
  const barHeights = Array.from({length: BAR_COUNT}, (_, i) =>
    createSignal(BAR_MIN_H + Math.abs(Math.sin(i * 1.7 + 0.5)) * (BAR_MAX_H - BAR_MIN_H))
  );
  const barsOpacity = createSignal(0);

  const COLS = 8;
  const ROWS = 5;
  const Y_ENCODER_V3 = ICON_Y2 + FRAME_H * ICON_SCALE / 2 + 50 + FRAME_H / 2;
  const frameOpEncoderV3 = createSignal(0);
  const blockOpacitiesV3 = Array.from({length: COLS * ROWS}, () => createSignal(0));

  const Y_FINALIZE_V3 = Y_ENCODER_V3 + FRAME_H + 50;
  const frameOpFinalizeV3 = createSignal(0);
  const formatLabelOpV3 = createSignal(0);

  const labelOp = createSignal(0);
  const frameOpEncoder = createSignal(0);
  const frameOpFinalize = createSignal(0);
  const formatLabelOp = createSignal(0);
  const blockOpacities = Array.from({length: COLS * ROWS}, () => createSignal(0));
  const blockOpacitiesV1 = Array.from({length: COLS * ROWS}, () => createSignal(0));

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
    <Line points={[[PANEL_X - FRAME_W * 0.55, Y_NORMALIZE], [PANEL_X + FRAME_W * 0.55, Y_NORMALIZE]]}
      stroke={GUIDE_COLOR} lineWidth={1} lineDash={[8, 8]} opacity={guidesOp}/>
    <Line points={[[PANEL_X, Y_NORMALIZE - FRAME_H * 0.7], [PANEL_X, Y_NORMALIZE + FRAME_H * 0.7]]}
      stroke={GUIDE_COLOR} lineWidth={1} lineDash={[8, 8]} opacity={guidesOp}/>

    <Rect
      x={collapseX0} y={collapseY0}
      width={FRAME_W} height={FRAME_H}
      fill={FRAME_FILL_NEUTRAL} stroke={strokeColor0} lineWidth={2} radius={radius0}
      opacity={frameOpNorm}
      skewX={skewX} skewY={skewY} scaleX={() => scaleXn() * collapseS0()} scaleY={() => scaleYn() * collapseS0()} rotation={rotation}
    >
      {Array.from({length: SCANLINE_COUNT}, (_, i) => {
        const y = -FRAME_H / 2 + ((i + 1) / (SCANLINE_COUNT + 1)) * FRAME_H;
        return <Line points={[[-FRAME_W / 2 + 10, y], [FRAME_W / 2 - 10, y]]} stroke={SCANLINE_COLOR} lineWidth={1}/>;
      })}
    </Rect>

    <Rect x={collapseX1} y={collapseY1} width={FRAME_W} height={FRAME_H}
      fill={FRAME_FILL_NEUTRAL} stroke={FRAME_STROKE_DONE} lineWidth={3} radius={6}
      opacity={frameOpColor} scale={collapseS1} clip
    >
      {Array.from({length: SCANLINE_COUNT}, (_, i) => {
        const y = -FRAME_H / 2 + ((i + 1) / (SCANLINE_COUNT + 1)) * FRAME_H;
        return <Line points={[[-FRAME_W / 2 + 10, y], [FRAME_W / 2 - 10, y]]} stroke={SCANLINE_COLOR} lineWidth={1}/>;
      })}
      <Rect
        x={() => -FRAME_W / 2 + (FRAME_W * paintProgress()) / 2}
        y={0} width={() => FRAME_W * paintProgress()} height={FRAME_H}
        fill={FRAME_FILL_WARM} clip
      >
        <Rect x={() => (FRAME_W * paintProgress()) / 2 - 8} y={0} width={16} height={FRAME_H} fill={SWEEP_COLOR} opacity={sweepOpacity}/>
      </Rect>
    </Rect>

    <Rect x={collapseX2} y={collapseY2} width={FRAME_W} height={FRAME_H}
      fill={FRAME_FILL_WARM} stroke={FRAME_STROKE_DONE} lineWidth={3} radius={6}
      opacity={frameOpEncoderV1} scale={collapseS2} clip
    >
      {Array.from({length: SCANLINE_COUNT}, (_, i) => {
        const y = -FRAME_H / 2 + ((i + 1) / (SCANLINE_COUNT + 1)) * FRAME_H;
        return <Line points={[[-FRAME_W / 2 + 10, y], [FRAME_W / 2 - 10, y]]} stroke={SCANLINE_COLOR} lineWidth={1}/>;
      })}
      {Array.from({length: COLS * ROWS}, (_, idx) => {
        const col = idx % COLS; const row = Math.floor(idx / COLS);
        const bw = FRAME_W / COLS; const bh = FRAME_H / ROWS;
        const x = -FRAME_W / 2 + col * bw + bw / 2; const y = -FRAME_H / 2 + row * bh + bh / 2;
        return <Rect key={`ev1-${idx}`} x={x} y={y} width={bw - 2} height={bh - 2}
          fill={'rgba(180,175,220,0.45)'} radius={2} opacity={blockOpacitiesV1[idx]}/>;
      })}
    </Rect>

    <Rect x={collapseXFin} y={collapseYFin} width={FRAME_W + 16} height={FRAME_H + 16}
      fill={'rgba(0,0,0,0)'} stroke={'rgba(244,241,235,0.50)'} lineWidth={2}
      lineDash={[10, 7]} radius={14} scale={collapsesFin} opacity={frameOpFinalizeV1}
    />
    <Rect x={collapseXFin} y={collapseYFin} width={FRAME_W} height={FRAME_H}
      fill={FRAME_FILL_WARM} stroke={FRAME_STROKE_DONE} lineWidth={3}
      radius={6} scale={collapsesFin} opacity={frameOpFinalizeV1} clip
    >
      {Array.from({length: SCANLINE_COUNT}, (_, i) => {
        const y = -FRAME_H / 2 + ((i + 1) / (SCANLINE_COUNT + 1)) * FRAME_H;
        return <Line points={[[-FRAME_W / 2 + 10, y], [FRAME_W / 2 - 10, y]]} stroke={SCANLINE_COLOR} lineWidth={1}/>;
      })}
      {Array.from({length: COLS * ROWS}, (_, idx) => {
        const col = idx % COLS; const row = Math.floor(idx / COLS);
        const bw = FRAME_W / COLS; const bh = FRAME_H / ROWS;
        const x = -FRAME_W / 2 + col * bw + bw / 2; const y = -FRAME_H / 2 + row * bh + bh / 2;
        return <Rect key={`fv1-${idx}`} x={x} y={y} width={bw - 2} height={bh - 2}
          fill={'rgba(180,175,220,0.45)'} radius={2}/>;
      })}
    </Rect>
    <Rect
      x={() => collapseXFin() + (FRAME_W / 2 - 24) * collapsesFin()}
      y={() => collapseYFin() + (-FRAME_H / 2 + 36) * collapsesFin()}
      width={() => 96 * collapsesFin()} height={() => 40 * collapsesFin()}
      fill={'rgba(30,28,40,0.90)'}
      stroke={'rgba(244,241,235,0.85)'} lineWidth={1.5} radius={6}
      offset={[1, 0]} opacity={formatLabelOpV1}
    >
      <Txt x={0} y={0} text={'.mp4'} fontFamily={Fonts.code} fontSize={() => 24 * collapsesFin()} fill={'rgba(244,241,235,1.0)'}/>
    </Rect>

    <Rect x={collapseXSub} y={collapseYSub} width={FRAME_W} height={FRAME_H}
      fill={FRAME_FILL_WARM} stroke={FRAME_STROKE_DONE} lineWidth={3}
      radius={6} opacity={frameOpSubtitles} scale={collapseSSub} clip
    >
      {Array.from({length: SCANLINE_COUNT}, (_, i) => {
        const y = -FRAME_H / 2 + ((i + 1) / (SCANLINE_COUNT + 1)) * FRAME_H;
        return <Line points={[[-FRAME_W / 2 + 10, y], [FRAME_W / 2 - 10, y]]} stroke={SCANLINE_COLOR} lineWidth={1}/>;
      })}
      <Rect x={0} y={SUBTITLE_Y} width={FRAME_W - 40} height={44} fill={'rgba(0,0,0,0.55)'} radius={4} opacity={subtitleBarOp}/>
      <Txt x={0} y={SUBTITLE_Y} text={'kuroshima'} fontFamily={Fonts.code} fontSize={26} fill={'rgba(244,241,235,0.96)'} letterSpacing={2} opacity={subtitleBarOp}/>
    </Rect>

    <Rect x={collapseXW} y={collapseYW} width={FRAME_W} height={FRAME_H}
      fill={FRAME_FILL_WARM} stroke={FRAME_STROKE_DONE} lineWidth={2}
      radius={10} opacity={frameOpWatermark} scale={collapseSW} clip
    >
      {Array.from({length: SCANLINE_COUNT}, (_, i) => {
        const y = -FRAME_H / 2 + ((i + 1) / (SCANLINE_COUNT + 1)) * FRAME_H;
        return <Line points={[[-FRAME_W / 2 + 10, y], [FRAME_W / 2 - 10, y]]} stroke={SCANLINE_COLOR} lineWidth={1}/>;
      })}
      <Rect x={0} y={SUBTITLE_Y} width={FRAME_W - 40} height={44} fill={'rgba(0,0,0,0.55)'} radius={4}/>
      <Txt x={0} y={SUBTITLE_Y} text={'kuroshima'} fontFamily={Fonts.code} fontSize={26} fill={'rgba(244,241,235,0.96)'} letterSpacing={2}/>
      <Txt x={-FRAME_W / 2 + 26} y={-FRAME_H / 2 + 44} text={'©'} fontFamily={Fonts.primary}
        fontSize={48} fill={'rgba(244, 241, 235, 0.60)'} offset={[-1, 0]} opacity={watermarkOp}/>
    </Rect>

    <Rect x={collapseXA} y={collapseYA} width={FRAME_W} height={FRAME_H}
      fill={FRAME_FILL_WARM} stroke={FRAME_STROKE_DONE} lineWidth={2}
      radius={10} opacity={frameOpAudio} scale={collapseSA} clip
    >
      {Array.from({length: SCANLINE_COUNT}, (_, i) => {
        const y = -FRAME_H / 2 + ((i + 1) / (SCANLINE_COUNT + 1)) * FRAME_H;
        return <Line points={[[-FRAME_W / 2 + 10, y], [FRAME_W / 2 - 10, y]]} stroke={SCANLINE_COLOR} lineWidth={1}/>;
      })}
      <Rect x={0} y={SUBTITLE_Y} width={FRAME_W - 40} height={44} fill={'rgba(0,0,0,0.55)'} radius={4}/>
      <Txt x={0} y={SUBTITLE_Y} text={'kuroshima'} fontFamily={Fonts.code} fontSize={26} fill={'rgba(244,241,235,0.96)'} letterSpacing={2}/>
      <Txt x={-FRAME_W / 2 + 26} y={-FRAME_H / 2 + 44} text={'©'} fontFamily={Fonts.primary} fontSize={48} fill={'rgba(244,241,235,0.60)'} offset={[-1,0]}/>
      {Array.from({length: BAR_COUNT}, (_, i) => {
        const totalW = BAR_COUNT * BAR_W + (BAR_COUNT - 1) * 6;
        const x = -totalW / 2 + i * (BAR_W + 6) + BAR_W / 2;
        return <Rect key={`ab-${i}`} x={x} y={0} width={BAR_W} height={barHeights[i]} fill={'rgba(244, 241, 235, 0.90)'} radius={3} opacity={barsOpacity}/>;
      })}
    </Rect>

    <Rect x={PANEL_X} y={Y_ENCODER_V3} width={FRAME_W} height={FRAME_H}
      fill={FRAME_FILL_WARM} stroke={FRAME_STROKE_DONE} lineWidth={2}
      radius={10} opacity={frameOpEncoderV3} clip
    >
      {Array.from({length: SCANLINE_COUNT}, (_, i) => {
        const y = -FRAME_H / 2 + ((i + 1) / (SCANLINE_COUNT + 1)) * FRAME_H;
        return <Line points={[[-FRAME_W / 2 + 10, y], [FRAME_W / 2 - 10, y]]} stroke={SCANLINE_COLOR} lineWidth={1}/>;
      })}
      {Array.from({length: COLS * ROWS}, (_, idx) => {
        const col = idx % COLS; const row = Math.floor(idx / COLS);
        const bw = FRAME_W / COLS; const bh = FRAME_H / ROWS;
        const x = -FRAME_W / 2 + col * bw + bw / 2; const y = -FRAME_H / 2 + row * bh + bh / 2;
        return <Rect key={`ev3-${idx}`} x={x} y={y} width={bw - 2} height={bh - 2}
          fill={'rgba(20,20,35,0.65)'} radius={2} opacity={blockOpacitiesV3[idx]}/>;
      })}
      {Array.from({length: BAR_COUNT}, (_, i) => {
        const totalW = BAR_COUNT * BAR_W + (BAR_COUNT - 1) * 6;
        const x = -totalW / 2 + i * (BAR_W + 6) + BAR_W / 2;
        return <Rect key={`ev3b-${i}`} x={x} y={0} width={BAR_W} height={NORMALIZED_H} fill={'rgba(244,241,235,0.90)'} radius={3}/>;
      })}
      <Txt x={-FRAME_W / 2 + 26} y={-FRAME_H / 2 + 44} text={'©'} fontFamily={Fonts.primary} fontSize={48} fill={'rgba(244,241,235,0.85)'} offset={[-1,0]}/>
      <Rect x={0} y={SUBTITLE_Y} width={FRAME_W - 40} height={44} fill={'rgba(0,0,0,0.55)'} radius={4}/>
      <Txt x={0} y={SUBTITLE_Y} text={'kuroshima'} fontFamily={Fonts.code} fontSize={26} fill={'rgba(244,241,235,0.96)'} letterSpacing={2}/>
    </Rect>

    <Rect x={PANEL_X} y={Y_FINALIZE_V3} width={FRAME_W + 16} height={FRAME_H + 16}
      fill={'rgba(0,0,0,0)'} stroke={'rgba(244,241,235,0.50)'} lineWidth={2}
      lineDash={[10,7]} radius={14} opacity={frameOpFinalizeV3}
    />
    <Rect x={PANEL_X} y={Y_FINALIZE_V3} width={FRAME_W} height={FRAME_H}
      fill={'rgba(255,182,193,0.50)'} stroke={FRAME_STROKE_DONE} lineWidth={2}
      radius={10} opacity={frameOpFinalizeV3} clip
    >
      {Array.from({length: SCANLINE_COUNT}, (_, i) => {
        const y = -FRAME_H / 2 + ((i + 1) / (SCANLINE_COUNT + 1)) * FRAME_H;
        return <Line points={[[-FRAME_W / 2 + 10, y], [FRAME_W / 2 - 10, y]]} stroke={SCANLINE_COLOR} lineWidth={1}/>;
      })}
      {Array.from({length: COLS * ROWS}, (_, idx) => {
        const col = idx % COLS; const row = Math.floor(idx / COLS);
        const bw = FRAME_W / COLS; const bh = FRAME_H / ROWS;
        const x = -FRAME_W / 2 + col * bw + bw / 2; const y = -FRAME_H / 2 + row * bh + bh / 2;
        return <Rect key={`fv3-${idx}`} x={x} y={y} width={bw - 2} height={bh - 2} fill={'rgba(20,20,35,0.65)'} radius={2}/>;
      })}
      {Array.from({length: BAR_COUNT}, (_, i) => {
        const totalW = BAR_COUNT * BAR_W + (BAR_COUNT - 1) * 6;
        const x = -totalW / 2 + i * (BAR_W + 6) + BAR_W / 2;
        return <Rect key={`fv3b-${i}`} x={x} y={0} width={BAR_W} height={NORMALIZED_H} fill={'rgba(244,241,235,0.90)'} radius={3}/>;
      })}
      <Txt x={-FRAME_W / 2 + 26} y={-FRAME_H / 2 + 44} text={'©'} fontFamily={Fonts.primary} fontSize={48} fill={'rgba(244,241,235,0.85)'} offset={[-1,0]}/>
      <Rect x={0} y={SUBTITLE_Y} width={FRAME_W - 40} height={44} fill={'rgba(0,0,0,0.55)'} radius={4}/>
      <Txt x={0} y={SUBTITLE_Y} text={'kuroshima'} fontFamily={Fonts.code} fontSize={26} fill={'rgba(244,241,235,0.96)'} letterSpacing={2}/>
    </Rect>
    <Rect
      x={PANEL_X + FRAME_W / 2 - 24} y={Y_FINALIZE_V3 - FRAME_H / 2 + 40}
      width={96} height={40} fill={'rgba(30,28,40,0.90)'}
      stroke={'rgba(244,241,235,0.85)'} lineWidth={1.5} radius={6}
      offset={[1,0]} opacity={() => frameOpFinalizeV3() * formatLabelOpV3()}
    >
      <Txt x={0} y={0} text={'.mp4'} fontFamily={Fonts.code} fontSize={24} fill={'rgba(244,241,235,1.0)'}/>
    </Rect>

    <Txt
      x={PANEL_X} y={-Screen.height / 2 + 52}
      text={'VIDEO EXPORT'} fontFamily={Fonts.primary}
      fontSize={26} fill={'rgba(244,241,235,0.90)'}
      letterSpacing={6} fontWeight={700} opacity={labelOp}
    />

    <Rect x={PANEL_X} y={Y_ENCODER} width={FRAME_W} height={FRAME_H}
      fill={FRAME_FILL_NEUTRAL} stroke={FRAME_STROKE_DONE} lineWidth={3} radius={6}
      opacity={frameOpEncoder} clip
    >
      {Array.from({length: SCANLINE_COUNT}, (_, i) => {
        const y = -FRAME_H / 2 + ((i + 1) / (SCANLINE_COUNT + 1)) * FRAME_H;
        return <Line points={[[-FRAME_W / 2 + 10, y], [FRAME_W / 2 - 10, y]]} stroke={SCANLINE_COLOR} lineWidth={1}/>;
      })}
      {Array.from({length: COLS * ROWS}, (_, idx) => {
        const col = idx % COLS; const row = Math.floor(idx / COLS);
        const bw = FRAME_W / COLS; const bh = FRAME_H / ROWS;
        const x = -FRAME_W / 2 + col * bw + bw / 2; const y = -FRAME_H / 2 + row * bh + bh / 2;
        return <Rect key={`eg-${idx}`} x={x} y={y} width={bw - 2} height={bh - 2}
          fill={'rgba(180,175,220,0.45)'} radius={2} opacity={blockOpacities[idx]}/>;
      })}
    </Rect>

    <Rect x={PANEL_X} y={Y_FINALIZE} width={FRAME_W + 16} height={FRAME_H + 16}
      fill={'rgba(0,0,0,0)'} stroke={'rgba(244,241,235,0.50)'} lineWidth={2}
      lineDash={[10,7]} radius={14} opacity={frameOpFinalize}
    />
    <Rect x={PANEL_X} y={Y_FINALIZE} width={FRAME_W} height={FRAME_H}
      fill={FRAME_FILL_NEUTRAL} stroke={FRAME_STROKE_DONE} lineWidth={3}
      radius={6} opacity={frameOpFinalize} clip
    >
      {Array.from({length: SCANLINE_COUNT}, (_, i) => {
        const y = -FRAME_H / 2 + ((i + 1) / (SCANLINE_COUNT + 1)) * FRAME_H;
        return <Line points={[[-FRAME_W / 2 + 10, y], [FRAME_W / 2 - 10, y]]} stroke={SCANLINE_COLOR} lineWidth={1}/>;
      })}
      {Array.from({length: COLS * ROWS}, (_, idx) => {
        const col = idx % COLS; const row = Math.floor(idx / COLS);
        const bw = FRAME_W / COLS; const bh = FRAME_H / ROWS;
        const x = -FRAME_W / 2 + col * bw + bw / 2; const y = -FRAME_H / 2 + row * bh + bh / 2;
        return <Rect key={`fg-${idx}`} x={x} y={y} width={bw - 2} height={bh - 2}
          fill={'rgba(180,175,220,0.45)'} radius={2}/>;
      })}
    </Rect>
    <Rect
      x={PANEL_X + FRAME_W / 2 - 24} y={Y_FINALIZE - FRAME_H / 2 + 36}
      width={96} height={40} fill={'rgba(30,28,40,0.90)'}
      stroke={'rgba(244,241,235,0.85)'} lineWidth={1.5} radius={6}
      offset={[1,0]} opacity={formatLabelOp}
    >
      <Txt x={0} y={0} text={'.mp4'} fontFamily={Fonts.code} fontSize={24} fill={'rgba(244,241,235,1.0)'}/>
    </Rect>
  </>);

  return {
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
  };
}
