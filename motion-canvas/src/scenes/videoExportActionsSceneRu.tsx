import {Line, makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, easeOutCubic, linear, waitFor} from '@motion-canvas/core';
import {Fonts, Screen, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

const PANEL_W = Screen.width * 5 / 16;
const PANEL_X = Screen.width / 2 - PANEL_W / 2;

const FRAME_W = 420;
const FRAME_H = 236;
const ITEM_GAP = 48;

const Y0 = -280;                        // normalizeFrames
const Y1 = Y0 + FRAME_H + ITEM_GAP;    // applyColorProfile
const Y2 = Y1 + FRAME_H + ITEM_GAP;    // overlaySubtitles
const Y_ACTIVE = -230;                  // position after collapse — applyWatermark and beyond

const FRAME_FILL_NEUTRAL = 'rgba(244, 241, 235, 0.07)';
const FRAME_FILL_WARM    = 'rgba(255, 182, 193, 0.22)';
const FRAME_STROKE       = 'rgba(244, 241, 235, 0.30)';
const FRAME_STROKE_DONE  = 'rgba(244, 241, 235, 0.55)';
const SCANLINE_COLOR     = 'rgba(244, 241, 235, 0.06)';
const GUIDE_COLOR        = 'rgba(244, 241, 235, 0.15)';
const DIVIDER_COLOR      = 'rgba(244, 241, 235, 0.08)';
const SWEEP_COLOR        = 'rgba(244, 230, 200, 0.18)';
const SCANLINE_COUNT     = 10;

const ICON_Y       = -Screen.height / 2 + 80;
const ICON_Y2      = ICON_Y + FRAME_H * 0.38 + 20;
const ICON_SCALE   = 0.38;
const ICON_SPACING = FRAME_W * 0.38 + 24;

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ── normalizeFrames signals ──────────────────────────────────────────────
  const dividerOpacity = createSignal(0);
  const skewX          = createSignal(6);
  const skewY          = createSignal(-3);
  const scaleX         = createSignal(0.91);
  const scaleY         = createSignal(1.07);
  const rotation       = createSignal(-2.8);
  const radius0        = createSignal(2);
  const strokeColor0   = createSignal(FRAME_STROKE);
  const frameOpacity0  = createSignal(0);
  const guidesOpacity  = createSignal(0);
  const collapseX0     = createSignal(PANEL_X);
  const collapseY0     = createSignal(Y0);
  const collapseScale0 = createSignal(1);

  // ── applyColorProfile signals ────────────────────────────────────────────
  const frameOpacity1  = createSignal(0);
  const sweepOpacity   = createSignal(0);
  const paintProgress  = createSignal(0);
  const collapseX1     = createSignal(PANEL_X);
  const collapseY1     = createSignal(Y1);
  const collapseScale1 = createSignal(1);

  // ── overlaySubtitles signals ─────────────────────────────────────────────
  const frameOpacity2  = createSignal(0);
  const subtitleOpacity = createSignal(0);
  const subtitleY      = FRAME_H / 2 - 52;
  const collapseX2     = createSignal(PANEL_X);
  const collapseY2     = createSignal(Y2);
  const collapseScale2 = createSignal(1);

  // ── applyWatermark signals ───────────────────────────────────────────────
  const frameOpacity3  = createSignal(0);
  const watermarkOp    = createSignal(0);
  const collapseX3     = createSignal(PANEL_X);
  const collapseY3     = createSignal(Y_ACTIVE);
  const collapseScale3 = createSignal(1);

  // ── normalizeAudio signals ───────────────────────────────────────────────
  const BAR_COUNT    = 9;
  const BAR_W        = 14;
  const BAR_MAX_H    = 80;
  const BAR_MIN_H    = 10;
  const NORMALIZED_H = 36;
  const Y_AUDIO      = Y_ACTIVE + FRAME_H + ITEM_GAP;
  const frameOpacity4  = createSignal(0);
  const collapseX4     = createSignal(PANEL_X);
  const collapseY4     = createSignal(Y_AUDIO);
  const collapseScale4 = createSignal(1);
  const barHeights     = Array.from({length: BAR_COUNT}, (_, i) =>
    createSignal(BAR_MIN_H + Math.abs(Math.sin(i * 1.7 + 0.5)) * (BAR_MAX_H - BAR_MIN_H))
  );
  const barsOpacity    = createSignal(0);

  // ── runEncoder signals ───────────────────────────────────────────────────
  const COLS         = 8;
  const ROWS         = 5;
  const Y_ENCODER    = Y_AUDIO + FRAME_H + ITEM_GAP;
  const frameOpacity5  = createSignal(0);
  const collapseX5     = createSignal(PANEL_X);
  const collapseY5     = createSignal(Y_ENCODER);
  const collapseScale5 = createSignal(1);
  const blockOpacities = Array.from({length: COLS * ROWS}, () => createSignal(0));

  // TODO: finalizeExport signals

  view.add(
    <>
      {/* divider */}
      <Line
        points={[[PANEL_X - PANEL_W / 2, -Screen.height / 2], [PANEL_X - PANEL_W / 2, Screen.height / 2]]}
        stroke={DIVIDER_COLOR}
        lineWidth={1}
        opacity={() => frameOpacity0()}
      />

      {/* snap guides */}
      <Line
        points={[[PANEL_X - FRAME_W * 0.55, Y0], [PANEL_X + FRAME_W * 0.55, Y0]]}
        stroke={GUIDE_COLOR}
        lineWidth={1}
        lineDash={[8, 8]}
        opacity={guidesOpacity}
      />
      <Line
        points={[[PANEL_X, Y0 - FRAME_H * 0.7], [PANEL_X, Y0 + FRAME_H * 0.7]]}
        stroke={GUIDE_COLOR}
        lineWidth={1}
        lineDash={[8, 8]}
        opacity={guidesOpacity}
      />

      {/* step 0: normalizeFrames */}
      <Rect
        x={collapseX0}
        y={collapseY0}
        width={FRAME_W}
        height={FRAME_H}
        fill={FRAME_FILL_NEUTRAL}
        stroke={strokeColor0}
        lineWidth={2}
        radius={radius0}
        opacity={frameOpacity0}
        skewX={skewX}
        skewY={skewY}
        scaleX={() => scaleX() * collapseScale0()}
        scaleY={() => scaleY() * collapseScale0()}
        rotation={rotation}
      >
        {Array.from({length: SCANLINE_COUNT}, (_, i) => {
          const y = -FRAME_H / 2 + ((i + 1) / (SCANLINE_COUNT + 1)) * FRAME_H;
          return <Line points={[[-FRAME_W / 2 + 10, y], [FRAME_W / 2 - 10, y]]} stroke={SCANLINE_COLOR} lineWidth={1} />;
        })}
      </Rect>

      {/* step 1: applyColorProfile */}
      <Rect
        x={collapseX1}
        y={collapseY1}
        width={FRAME_W}
        height={FRAME_H}
        fill={FRAME_FILL_NEUTRAL}
        stroke={FRAME_STROKE_DONE}
        lineWidth={2}
        radius={10}
        opacity={frameOpacity1}
        scale={collapseScale1}
        clip
      >
        {Array.from({length: SCANLINE_COUNT}, (_, i) => {
          const y = -FRAME_H / 2 + ((i + 1) / (SCANLINE_COUNT + 1)) * FRAME_H;
          return <Line points={[[-FRAME_W / 2 + 10, y], [FRAME_W / 2 - 10, y]]} stroke={SCANLINE_COLOR} lineWidth={1} />;
        })}
        <Rect
          x={() => -FRAME_W / 2 + (FRAME_W * paintProgress()) / 2}
          y={0}
          width={() => FRAME_W * paintProgress()}
          height={FRAME_H}
          fill={FRAME_FILL_WARM}
          clip
        >
          <Rect
            x={() => (FRAME_W * paintProgress()) / 2 - 8}
            y={0}
            width={16}
            height={FRAME_H}
            fill={SWEEP_COLOR}
            opacity={sweepOpacity}
          />
        </Rect>
      </Rect>

      {/* step 2: overlaySubtitles */}
      <Rect
        x={collapseX2}
        y={collapseY2}
        width={FRAME_W}
        height={FRAME_H}
        fill={FRAME_FILL_WARM}
        stroke={FRAME_STROKE_DONE}
        lineWidth={2}
        radius={10}
        opacity={frameOpacity2}
        scale={collapseScale2}
        clip
      >
        {Array.from({length: SCANLINE_COUNT}, (_, i) => {
          const y = -FRAME_H / 2 + ((i + 1) / (SCANLINE_COUNT + 1)) * FRAME_H;
          return <Line points={[[-FRAME_W / 2 + 10, y], [FRAME_W / 2 - 10, y]]} stroke={SCANLINE_COLOR} lineWidth={1} />;
        })}
        <Rect x={0} y={subtitleY} width={FRAME_W - 40} height={44} fill={'rgba(0,0,0,0.55)'} radius={4} opacity={subtitleOpacity} />
        <Txt x={0} y={subtitleY} text={'kuroshima'} fontFamily={Fonts.code} fontSize={26} fill={'rgba(244,241,235,0.96)'} letterSpacing={2} opacity={subtitleOpacity} />
      </Rect>

      {/* step 3: applyWatermark */}
      <Rect
        x={collapseX3}
        y={collapseY3}
        width={FRAME_W}
        height={FRAME_H}
        fill={FRAME_FILL_WARM}
        stroke={FRAME_STROKE_DONE}
        lineWidth={2}
        radius={10}
        opacity={frameOpacity3}
        scale={collapseScale3}
        clip
      >
        {Array.from({length: SCANLINE_COUNT}, (_, i) => {
          const y = -FRAME_H / 2 + ((i + 1) / (SCANLINE_COUNT + 1)) * FRAME_H;
          return <Line points={[[-FRAME_W / 2 + 10, y], [FRAME_W / 2 - 10, y]]} stroke={SCANLINE_COLOR} lineWidth={1} />;
        })}
        {/* inherited subtitle */}
        <Rect x={0} y={subtitleY} width={FRAME_W - 40} height={44} fill={'rgba(0,0,0,0.55)'} radius={4} />
        <Txt x={0} y={subtitleY} text={'kuroshima'} fontFamily={Fonts.code} fontSize={26} fill={'rgba(244,241,235,0.96)'} letterSpacing={2} />
        {/* watermark — top left corner */}
        <Txt
          x={-FRAME_W / 2 + 26}
          y={-FRAME_H / 2 + 44}
          text={'©'}
          fontFamily={Fonts.primary}
          fontSize={48}
          fill={'rgba(244, 241, 235, 0.60)'}
          offset={[-1, 0]}
          opacity={watermarkOp}
        />
      </Rect>

      {/* step 4: normalizeAudio */}
      <Rect
        x={collapseX4}
        y={collapseY4}
        width={FRAME_W}
        height={FRAME_H}
        fill={FRAME_FILL_WARM}
        stroke={FRAME_STROKE_DONE}
        lineWidth={2}
        radius={10}
        opacity={frameOpacity4}
        scale={collapseScale4}
        clip
      >
        {Array.from({length: SCANLINE_COUNT}, (_, i) => {
          const y = -FRAME_H / 2 + ((i + 1) / (SCANLINE_COUNT + 1)) * FRAME_H;
          return <Line points={[[-FRAME_W / 2 + 10, y], [FRAME_W / 2 - 10, y]]} stroke={SCANLINE_COLOR} lineWidth={1} />;
        })}
        {/* audio bars — on top of everything, centered */}
        {Array.from({length: BAR_COUNT}, (_, i) => {
          const totalW = BAR_COUNT * BAR_W + (BAR_COUNT - 1) * 6;
          const x = -totalW / 2 + i * (BAR_W + 6) + BAR_W / 2;
          return (
            <Rect
              x={x}
              y={0}
              width={BAR_W}
              height={barHeights[i]}
              fill={'rgba(244, 241, 235, 0.90)'}
              radius={3}
              opacity={barsOpacity}
            />
          );
        })}
        {/* inherited watermark — above bars */}
        <Txt x={-FRAME_W / 2 + 26} y={-FRAME_H / 2 + 44} text={'©'} fontFamily={Fonts.primary} fontSize={48} fill={'rgba(244,241,235,0.60)'} offset={[-1, 0]} />
        {/* inherited subtitle — above bars */}
        <Rect x={0} y={subtitleY} width={FRAME_W - 40} height={44} fill={'rgba(0,0,0,0.55)'} radius={4} />
        <Txt x={0} y={subtitleY} text={'kuroshima'} fontFamily={Fonts.code} fontSize={26} fill={'rgba(244,241,235,0.96)'} letterSpacing={2} />
      </Rect>

      {/* step 5: runEncoder */}
      <Rect
        x={collapseX5}
        y={collapseY5}
        width={FRAME_W}
        height={FRAME_H}
        fill={FRAME_FILL_WARM}
        stroke={FRAME_STROKE_DONE}
        lineWidth={2}
        radius={10}
        opacity={frameOpacity5}
        scale={collapseScale5}
        clip
      >
        {Array.from({length: SCANLINE_COUNT}, (_, i) => {
          const y = -FRAME_H / 2 + ((i + 1) / (SCANLINE_COUNT + 1)) * FRAME_H;
          return <Line points={[[-FRAME_W / 2 + 10, y], [FRAME_W / 2 - 10, y]]} stroke={SCANLINE_COLOR} lineWidth={1} />;
        })}
        {/* macroblocks */}
        {Array.from({length: COLS * ROWS}, (_, idx) => {
          const col = idx % COLS;
          const row = Math.floor(idx / COLS);
          const bw  = FRAME_W / COLS;
          const bh  = FRAME_H / ROWS;
          const x   = -FRAME_W / 2 + col * bw + bw / 2;
          const y   = -FRAME_H / 2 + row * bh + bh / 2;
          return (
            <Rect
              key={idx}
              x={x} y={y}
              width={bw - 2} height={bh - 2}
              fill={'rgba(30, 30, 40, 0.55)'}
              radius={2}
              opacity={blockOpacities[idx]}
            />
          );
        })}
        {/* inherited audio bars — normalized, on top of blocks */}
        {Array.from({length: BAR_COUNT}, (_, i) => {
          const totalW = BAR_COUNT * BAR_W + (BAR_COUNT - 1) * 6;
          const x = -totalW / 2 + i * (BAR_W + 6) + BAR_W / 2;
          return (
            <Rect x={x} y={0} width={BAR_W} height={NORMALIZED_H} fill={'rgba(244,241,235,0.90)'} radius={3} />
          );
        })}
        {/* inherited watermark — on top of blocks */}
        <Txt x={-FRAME_W / 2 + 26} y={-FRAME_H / 2 + 44} text={'©'} fontFamily={Fonts.primary} fontSize={48} fill={'rgba(244,241,235,0.85)'} offset={[-1, 0]} />
        {/* inherited subtitle — on top of blocks */}
        <Rect x={0} y={subtitleY} width={FRAME_W - 40} height={44} fill={'rgba(0,0,0,0.55)'} radius={4} />
        <Txt x={0} y={subtitleY} text={'kuroshima'} fontFamily={Fonts.code} fontSize={26} fill={'rgba(244,241,235,0.96)'} letterSpacing={2} />
      </Rect>

      {/* TODO: finalizeExport */}
    </>,
  );

  // ── animate normalizeFrames ──────────────────────────────────────────────
  yield* dividerOpacity(1, 0.4, easeInOutCubic);
  yield* frameOpacity0(1, Timing.normal, easeInOutCubic);
  yield* waitFor(0.6);
  yield* guidesOpacity(1, 0.3, easeInOutCubic);
  yield* waitFor(0.2);
  yield* all(
    skewX(0, 0.9, easeOutCubic),
    skewY(0, 0.9, easeOutCubic),
    scaleX(1, 0.9, easeOutCubic),
    scaleY(1, 0.9, easeOutCubic),
    rotation(0, 0.9, easeOutCubic),
    radius0(10, 0.9, easeOutCubic),
    strokeColor0(FRAME_STROKE_DONE, 0.9, easeOutCubic),
  );
  yield* guidesOpacity(0, 0.5, easeInOutCubic);
  yield* waitFor(0.4);

  // ── animate applyColorProfile ────────────────────────────────────────────
  yield* frameOpacity1(1, Timing.normal, easeInOutCubic);
  yield* waitFor(0.3);
  paintProgress(0);
  yield* sweepOpacity(1, 0.15, easeInOutCubic);
  yield* paintProgress(1, 1.1, linear);
  yield* sweepOpacity(0, 0.2, easeInOutCubic);
  yield* waitFor(0.4);

  // ── animate overlaySubtitles ─────────────────────────────────────────────
  yield* frameOpacity2(1, Timing.normal, easeInOutCubic);
  yield* waitFor(0.3);
  yield* subtitleOpacity(1, 0.6, easeInOutCubic);
  yield* waitFor(1.2);

  // ── первые три уменьшаются и уезжают наверх ──────────────────────────────
  yield* all(
    collapseScale0(ICON_SCALE, 0.8, easeInOutCubic),
    collapseScale1(ICON_SCALE, 0.8, easeInOutCubic),
    collapseScale2(ICON_SCALE, 0.8, easeInOutCubic),
    collapseY0(ICON_Y, 0.8, easeInOutCubic),
    collapseY1(ICON_Y, 0.8, easeInOutCubic),
    collapseY2(ICON_Y, 0.8, easeInOutCubic),
    collapseX0(PANEL_X - ICON_SPACING, 0.8, easeInOutCubic),
    collapseX1(PANEL_X, 0.8, easeInOutCubic),
    collapseX2(PANEL_X + ICON_SPACING, 0.8, easeInOutCubic),
  );
  yield* waitFor(0.2);

  // ── animate applyWatermark ───────────────────────────────────────────────
  yield* frameOpacity3(1, Timing.normal, easeInOutCubic);
  yield* waitFor(0.3);
  yield* watermarkOp(1, 0.5, easeInOutCubic);
  yield* waitFor(1.2);

  // ── animate normalizeAudio ───────────────────────────────────────────────
  yield* frameOpacity4(1, Timing.normal, easeInOutCubic);
  yield* waitFor(0.2);
  yield* barsOpacity(1, 0.3, easeInOutCubic);

  // chaotic phase — bars jump randomly
  for (let round = 0; round < 6; round++) {
    yield* all(
      ...barHeights.map((h, i) =>
        h(BAR_MIN_H + Math.abs(Math.sin(i * 2.3 + round * 1.1)) * (BAR_MAX_H - BAR_MIN_H), 0.08, easeInOutCubic)
      ),
    );
  }

  // normalize — all bars settle to same height
  yield* all(
    ...barHeights.map(h => h(NORMALIZED_H, 0.4, easeInOutCubic)),
  );

  yield* waitFor(1.2);

  // ── animate runEncoder ───────────────────────────────────────────────────

  yield* frameOpacity5(1, Timing.normal, easeInOutCubic);
  yield* waitFor(0.3);

  // fill macroblocks sequentially
  const blockDelay = 0.02;
  const blockOp    = 0.09;
  for (let idx = 0; idx < COLS * ROWS; idx++) {
    yield* blockOpacities[idx](1, blockOp, easeInOutCubic);
    if (idx < COLS * ROWS - 1) yield* waitFor(blockDelay);
  }

  yield* waitFor(1.2);

  // ── фреймы 3,4,5 уменьшаются и уезжают наверх (тот же уровень ICON_Y) ──
  yield* all(
    collapseScale3(ICON_SCALE, 0.8, easeInOutCubic),
    collapseScale4(ICON_SCALE, 0.8, easeInOutCubic),
    collapseScale5(ICON_SCALE, 0.8, easeInOutCubic),
    collapseY3(ICON_Y2, 0.8, easeInOutCubic),
    collapseY4(ICON_Y2, 0.8, easeInOutCubic),
    collapseY5(ICON_Y2, 0.8, easeInOutCubic),
    collapseX3(PANEL_X - ICON_SPACING, 0.8, easeInOutCubic),
    collapseX4(PANEL_X, 0.8, easeInOutCubic),
    collapseX5(PANEL_X + ICON_SPACING, 0.8, easeInOutCubic),
  );
  yield* waitFor(0.5);
});
