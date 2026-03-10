import {Line, makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Screen} from '../core/theme';

const PARCHMENT = '#E7D8BF';
const PARCHMENT_DARK = '#DCC9A9';
const INK = '#3C2F23';
const INK_SOFT = 'rgba(60, 47, 35, 0.62)';
const PATH = 'rgba(76, 58, 43, 0.65)';
const PINK = '#FF8CA3';

export default makeScene2D(function* (view) {
  const mapOpacity = createSignal(0);
  const stationOpacity = createSignal(0);
  const lineAEnd = createSignal(0);
  const lineBEnd = createSignal(0);
  const lineCEnd = createSignal(0);
  const markerY = createSignal(-360);
  const markerOpacity = createSignal(0);
  const finalGlow = createSignal(0);

  const x = 0;
  const y0 = -360;
  const y1 = -130;
  const y2 = 100;
  const y3 = 330;

  const stationW = 980;
  const stationH = 128;

  view.add(
    <>
      <Rect width={Screen.width} height={Screen.height} fill={PARCHMENT} opacity={mapOpacity} />
      <Rect width={Screen.width - 120} height={Screen.height - 120} radius={24} stroke={PARCHMENT_DARK} lineWidth={2} fill={'rgba(0,0,0,0)'} opacity={mapOpacity} />

      <Line
        points={[
          [x, y0 + stationH / 2 + 28],
          [x, y1 - stationH / 2 - 28],
        ]}
        stroke={PATH}
        lineWidth={5}
        lineCap={'round'}
        lineDash={[14, 14]}
        end={lineAEnd}
        opacity={stationOpacity}
      />
      <Line
        points={[
          [x, y1 + stationH / 2 + 28],
          [x, y2 - stationH / 2 - 28],
        ]}
        stroke={PATH}
        lineWidth={5}
        lineCap={'round'}
        lineDash={[14, 14]}
        end={lineBEnd}
        opacity={stationOpacity}
      />
      <Line
        points={[
          [x, y2 + stationH / 2 + 28],
          [x, y3 - stationH / 2 - 28],
        ]}
        stroke={PATH}
        lineWidth={5}
        lineCap={'round'}
        lineDash={[14, 14]}
        end={lineCEnd}
        opacity={stationOpacity}
      />

      <Rect x={x} y={y0} width={stationW} height={stationH} radius={16} fill={'rgba(0,0,0,0)'} stroke={INK_SOFT} lineWidth={2} opacity={stationOpacity} />
      <Rect x={x} y={y1} width={stationW} height={stationH} radius={16} fill={'rgba(0,0,0,0)'} stroke={INK_SOFT} lineWidth={2} opacity={stationOpacity} />
      <Rect x={x} y={y2} width={stationW} height={stationH} radius={16} fill={'rgba(0,0,0,0)'} stroke={INK_SOFT} lineWidth={2} opacity={stationOpacity} />
      <Rect x={x} y={y3} width={stationW} height={stationH} radius={16} fill={'rgba(0,0,0,0)'} stroke={INK_SOFT} lineWidth={2} opacity={stationOpacity} />

      <Txt
        x={x}
        y={y0 - 14}
        text={'Export'}
        fontFamily={'Cormorant Garamond, Georgia, Times New Roman, serif'}
        fontSize={58}
        fontWeight={700}
        fill={INK}
        opacity={stationOpacity}
      />
      <Txt x={x} y={y0 + 28} text={'Result export(VideoClip clip, String format)'} fontFamily={'JetBrains Mono, monospace'} fontSize={28} fill={INK_SOFT} opacity={stationOpacity} />

      <Txt
        x={x}
        y={y1 - 14}
        text={'Prepare And Encode'}
        fontFamily={'Cormorant Garamond, Georgia, Times New Roman, serif'}
        fontSize={52}
        fontWeight={700}
        fill={INK}
        opacity={stationOpacity}
      />
      <Txt x={x} y={y1 + 28} text={'prepareAndEncode(clip, format)'} fontFamily={'JetBrains Mono, monospace'} fontSize={28} fill={INK_SOFT} opacity={stationOpacity} />

      <Txt
        x={x}
        y={y2 - 14}
        text={'Encode With Retry'}
        fontFamily={'Cormorant Garamond, Georgia, Times New Roman, serif'}
        fontSize={52}
        fontWeight={700}
        fill={INK}
        opacity={stationOpacity}
      />
      <Txt x={x} y={y2 + 28} text={'encodeWithRetry(frames, format)'} fontFamily={'JetBrains Mono, monospace'} fontSize={28} fill={INK_SOFT} opacity={stationOpacity} />

      <Txt
        x={x}
        y={y3 - 14}
        text={'Finalize Export'}
        fontFamily={'Cormorant Garamond, Georgia, Times New Roman, serif'}
        fontSize={52}
        fontWeight={700}
        fill={INK}
        opacity={stationOpacity}
      />
      <Txt x={x} y={y3 + 28} text={'finalizeExport(payload, format)'} fontFamily={'JetBrains Mono, monospace'} fontSize={28} fill={INK_SOFT} opacity={stationOpacity} />

      <Rect x={0} y={markerY} width={150} height={38} radius={12} fill={PINK} opacity={markerOpacity} />
      <Txt
        x={0}
        y={markerY}
        text={'format'}
        fontFamily={'JetBrains Mono, monospace'}
        fontSize={22}
        fontWeight={700}
        fill={'rgba(26,18,22,0.95)'}
        opacity={markerOpacity}
      />

      <Rect
        x={0}
        y={y3}
        width={stationW + 26}
        height={stationH + 24}
        radius={20}
        fill={'rgba(255,140,163,0.16)'}
        stroke={'rgba(255,140,163,0.7)'}
        lineWidth={2}
        opacity={finalGlow}
      />
    </>,
  );

  yield* mapOpacity(1, 0.8, easeInOutCubic);
  yield* stationOpacity(1, 0.7, easeInOutCubic);
  yield* markerOpacity(1, 0.3, easeInOutCubic);

  yield* all(lineAEnd(1, 1.05, easeInOutCubic), markerY(y1, 1.05, easeInOutCubic));
  yield* all(lineBEnd(1, 1.05, easeInOutCubic), markerY(y2, 1.05, easeInOutCubic));
  yield* all(lineCEnd(1, 1.05, easeInOutCubic), markerY(y3, 1.05, easeInOutCubic));

  yield* finalGlow(1, 0.45, easeInOutCubic);
  yield* waitFor(1.1);
});

