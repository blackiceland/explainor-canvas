import {Line, makeScene2D, Rect} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, easeOutCubic, waitFor} from '@motion-canvas/core';
import {Screen, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

const PANEL_W = Screen.width * 5 / 16;
const PANEL_X = Screen.width / 2 - PANEL_W / 2;
const PANEL_H = Screen.height;

const ITEM_Y = -280;

const FRAME_W = 420;
const FRAME_H = 236;
const FRAME_FILL = 'rgba(244, 241, 235, 0.07)';
const FRAME_STROKE = 'rgba(244, 241, 235, 0.30)';
const FRAME_STROKE_DONE = 'rgba(244, 241, 235, 0.55)';
const SCANLINE_COLOR = 'rgba(244, 241, 235, 0.06)';
const GUIDE_COLOR = 'rgba(244, 241, 235, 0.15)';
const DIVIDER_COLOR = 'rgba(244, 241, 235, 0.08)';
const SCANLINE_COUNT = 10;

export default makeScene2D(function* (view) {
  applyBackground(view);

  const dividerOpacity = createSignal(0);

  const skewX = createSignal(6);
  const skewY = createSignal(-3);
  const scaleX = createSignal(0.91);
  const scaleY = createSignal(1.07);
  const rotation = createSignal(-2.8);
  const radius = createSignal(2);
  const strokeColor = createSignal(FRAME_STROKE);
  const strokeWidth = createSignal(2);
  const frameOpacity = createSignal(0);

  const guidesOpacity = createSignal(0);

  view.add(
    <>
      {/* vertical divider between code area and animation panel */}
      <Line
        points={[[PANEL_X - PANEL_W / 2, -Screen.height / 2], [PANEL_X - PANEL_W / 2, Screen.height / 2]]}
        stroke={DIVIDER_COLOR}
        lineWidth={1}
        opacity={dividerOpacity}
      />

      {/* guides inside animation panel */}
      <Line
        points={[[PANEL_X - FRAME_W * 0.55, ITEM_Y], [PANEL_X + FRAME_W * 0.55, ITEM_Y]]}
        stroke={GUIDE_COLOR}
        lineWidth={1}
        lineDash={[8, 8]}
        opacity={guidesOpacity}
      />
      <Line
        points={[[PANEL_X, ITEM_Y - FRAME_H * 0.7], [PANEL_X, ITEM_Y + FRAME_H * 0.7]]}
        stroke={GUIDE_COLOR}
        lineWidth={1}
        lineDash={[8, 8]}
        opacity={guidesOpacity}
      />

      {/* video frame */}
      <Rect
        x={PANEL_X}
        y={ITEM_Y}
        width={FRAME_W}
        height={FRAME_H}
        fill={FRAME_FILL}
        stroke={strokeColor}
        lineWidth={strokeWidth}
        radius={radius}
        opacity={frameOpacity}
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
    </>,
  );

  yield* dividerOpacity(1, 0.4, easeInOutCubic);
  yield* frameOpacity(1, Timing.normal, easeInOutCubic);
  yield* waitFor(0.6);

  yield* guidesOpacity(1, 0.3, easeInOutCubic);
  yield* waitFor(0.2);

  yield* all(
    skewX(0, 0.9, easeOutCubic),
    skewY(0, 0.9, easeOutCubic),
    scaleX(1, 0.9, easeOutCubic),
    scaleY(1, 0.9, easeOutCubic),
    rotation(0, 0.9, easeOutCubic),
    radius(10, 0.9, easeOutCubic),
    strokeColor(FRAME_STROKE_DONE, 0.9, easeOutCubic),
    strokeWidth(2.5, 0.9, easeOutCubic),
  );

  yield* guidesOpacity(0, 0.5, easeInOutCubic);

  yield* waitFor(1.5);
});
