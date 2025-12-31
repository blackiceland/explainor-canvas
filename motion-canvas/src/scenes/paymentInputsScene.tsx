import {Circle, makeScene2D, Txt} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Colors, Fonts, Timing} from '../core/theme';

type Point = [number, number];

export default makeScene2D(function* (view) {
  applyBackground(view);

  const leftOpacity = createSignal(0);
  const midOpacity = createSignal(0);
  const rightOpacity = createSignal(0);

  const c: Point = [0, 40];
  const leftC: Point = [-560, 40];
  const rightC: Point = [560, 40];

  const leftR = 150;
  const midR = 220;
  const rightR = 150;

  const strokeW = 2;
  const beigeFill = 'rgba(246,231,212,0.10)';
  const softStroke = 'rgba(244,241,235,0.18)';
  const leftStroke = softStroke;
  const midStroke = softStroke;
  const rightStroke = softStroke;

  const leftFill = beigeFill;
  const midFill = beigeFill;
  const rightFill = beigeFill;

  const whiteText = Colors.text.primary;

  view.add(
    <>
      <Circle
        x={leftC[0]}
        y={leftC[1]}
        width={leftR * 2}
        height={leftR * 2}
        fill={leftFill}
        stroke={leftStroke}
        lineWidth={strokeW}
        opacity={leftOpacity}
      />
      <Txt
        x={leftC[0]}
        y={leftC[1] - 5}
        text={'client'}
        fontFamily={Fonts.primary}
        fontSize={30}
        fontWeight={650}
        letterSpacing={-0.1}
        fill={whiteText}
        opacity={leftOpacity}
      />

      <Circle
        x={c[0]}
        y={c[1]}
        width={midR * 2}
        height={midR * 2}
        fill={midFill}
        stroke={midStroke}
        lineWidth={strokeW}
        opacity={midOpacity}
      />
      <Txt
        x={c[0]}
        y={c[1] - 6}
        text={'payment'}
        fontFamily={Fonts.primary}
        fontSize={38}
        fontWeight={700}
        letterSpacing={-0.2}
        fill={whiteText}
        opacity={midOpacity}
      />

      <Circle
        x={rightC[0]}
        y={rightC[1]}
        width={rightR * 2}
        height={rightR * 2}
        fill={rightFill}
        stroke={rightStroke}
        lineWidth={strokeW}
        opacity={rightOpacity}
      />
      <Txt
        x={rightC[0]}
        y={rightC[1] - 5}
        text={'stripe'}
        fontFamily={Fonts.primary}
        fontSize={30}
        fontWeight={650}
        letterSpacing={-0.1}
        fill={whiteText}
        opacity={rightOpacity}
      />
    </>,
  );

  yield* all(
    leftOpacity(1, Timing.slow, easeInOutCubic),
    midOpacity(1, Timing.slow, easeInOutCubic),
    rightOpacity(1, Timing.slow, easeInOutCubic),
  );

  yield* waitFor(2.2);
});


