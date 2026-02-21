import {Line, makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, easeOutCubic, linear, waitFor} from '@motion-canvas/core';
import {Fonts, Screen, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

const PANEL_W = Screen.width * 5 / 16;
const PANEL_X = Screen.width / 2 - PANEL_W / 2;

const FRAME_W = 420;
const FRAME_H = 236;
const ITEM_GAP = 48;

// y-positions for each step
const Y0 = -280;                        // normalizeFrames
const Y1 = Y0 + FRAME_H + ITEM_GAP;    // applyColorProfile
const Y2 = Y1 + FRAME_H + ITEM_GAP;    // overlaySubtitles

const FRAME_FILL_NEUTRAL = 'rgba(244, 241, 235, 0.07)';
const FRAME_FILL_WARM = 'rgba(255, 182, 193, 0.22)';
const FRAME_STROKE = 'rgba(244, 241, 235, 0.30)';
const FRAME_STROKE_DONE = 'rgba(244, 241, 235, 0.55)';
const SCANLINE_COLOR = 'rgba(244, 241, 235, 0.06)';
const GUIDE_COLOR = 'rgba(244, 241, 235, 0.15)';
const DIVIDER_COLOR = 'rgba(244, 241, 235, 0.08)';
const SWEEP_COLOR = 'rgba(244, 230, 200, 0.18)';
const SCANLINE_COUNT = 10;

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ── normalizeFrames signals ──────────────────────────────────────────────
  const dividerOpacity = createSignal(0);
  const skewX = createSignal(6);
  const skewY = createSignal(-3);
  const scaleX = createSignal(0.91);
  const scaleY = createSignal(1.07);
  const rotation = createSignal(-2.8);
  const radius0 = createSignal(2);
  const strokeColor0 = createSignal(FRAME_STROKE);
  const frameOpacity0 = createSignal(0);
  const guidesOpacity = createSignal(0);

  // ── overlaySubtitles signals ─────────────────────────────────────────────
  const frameOpacity2 = createSignal(0);
  const subtitleOpacity = createSignal(0);
  const subtitleY = FRAME_H / 2 - 52;

  // ── applyColorProfile signals ────────────────────────────────────────────
  const frameOpacity1 = createSignal(0);
  const sweepOpacity = createSignal(0);
  // progress 0..1 — how much of the frame is painted
  const paintProgress = createSignal(0);
  // sweep x derived from paintProgress — always in sync
  const sweepX = () => PANEL_X - FRAME_W / 2 + FRAME_W * paintProgress();

  view.add(
    <>
      {/* divider */}
      <Line
        points={[[PANEL_X - PANEL_W / 2, -Screen.height / 2], [PANEL_X - PANEL_W / 2, Screen.height / 2]]}
        stroke={DIVIDER_COLOR}
        lineWidth={1}
        opacity={dividerOpacity}
      />

      {/* guides for step 0 */}
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
        x={PANEL_X}
        y={Y0}
        width={FRAME_W}
        height={FRAME_H}
        fill={'rgba(244, 241, 235, 0.07)'}
        stroke={strokeColor0}
        lineWidth={2}
        radius={radius0}
        opacity={frameOpacity0}
        skewX={skewX}
        skewY={skewY}
        scaleX={scaleX}
        scaleY={scaleY}
        rotation={rotation}
      >
        {Array.from({length: SCANLINE_COUNT}, (_, i) => {
          const y = -FRAME_H / 2 + ((i + 1) / (SCANLINE_COUNT + 1)) * FRAME_H;
          return (
            <Line
              points={[[-FRAME_W / 2 + 10, y], [FRAME_W / 2 - 10, y]]}
              stroke={SCANLINE_COLOR}
              lineWidth={1}
            />
          );
        })}
      </Rect>

      {/* step 1: applyColorProfile — all layers clipped inside frame */}
      <Rect
        x={PANEL_X}
        y={Y1}
        width={FRAME_W}
        height={FRAME_H}
        fill={FRAME_FILL_NEUTRAL}
        stroke={FRAME_STROKE_DONE}
        lineWidth={2}
        radius={10}
        opacity={frameOpacity1}
        clip
      >
        {Array.from({length: SCANLINE_COUNT}, (_, i) => {
          const y = -FRAME_H / 2 + ((i + 1) / (SCANLINE_COUNT + 1)) * FRAME_H;
          return (
            <Line
              points={[[-FRAME_W / 2 + 10, y], [FRAME_W / 2 - 10, y]]}
              stroke={SCANLINE_COLOR}
              lineWidth={1}
            />
          );
        })}

        {/* painted region + sweep — single clipped container anchored to left edge */}
        <Rect
          x={() => -FRAME_W / 2 + (FRAME_W * paintProgress()) / 2}
          y={0}
          width={() => FRAME_W * paintProgress()}
          height={FRAME_H}
          fill={FRAME_FILL_WARM}
          clip
        >
          {/* sweep line sits at the right edge of the painted region */}
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
      {/* step 2: overlaySubtitles — inherits warm fill from previous step */}
      <Rect
        x={PANEL_X}
        y={Y2}
        width={FRAME_W}
        height={FRAME_H}
        fill={FRAME_FILL_WARM}
        stroke={FRAME_STROKE_DONE}
        lineWidth={2}
        radius={10}
        opacity={frameOpacity2}
        clip
      >
        {Array.from({length: SCANLINE_COUNT}, (_, i) => {
          const y = -FRAME_H / 2 + ((i + 1) / (SCANLINE_COUNT + 1)) * FRAME_H;
          return (
            <Line
              points={[[-FRAME_W / 2 + 10, y], [FRAME_W / 2 - 10, y]]}
              stroke={SCANLINE_COLOR}
              lineWidth={1}
            />
          );
        })}

        {/* subtitle bar */}
        <Rect
          x={0}
          y={subtitleY}
          width={FRAME_W - 40}
          height={44}
          fill={'rgba(0, 0, 0, 0.55)'}
          radius={4}
          opacity={subtitleOpacity}
        />
        <Txt
          x={0}
          y={subtitleY}
          text={'kuroshima'}
          fontFamily={Fonts.code}
          fontSize={26}
          fill={'rgba(244, 241, 235, 0.96)'}
          letterSpacing={2}
          opacity={subtitleOpacity}
        />
      </Rect>
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

  // sweep across frame left → right, painting pink behind it
  paintProgress(0);
  yield* sweepOpacity(1, 0.15, easeInOutCubic);
  yield* paintProgress(1, 1.1, linear);
  yield* sweepOpacity(0, 0.2, easeInOutCubic);
  yield* waitFor(0.4);

  // ── animate overlaySubtitles ─────────────────────────────────────────────
  yield* frameOpacity2(1, Timing.normal, easeInOutCubic);
  yield* waitFor(0.3);

  // subtitle fades in in place
  yield* subtitleOpacity(1, 0.6, easeInOutCubic);

  yield* waitFor(1.2);
});
