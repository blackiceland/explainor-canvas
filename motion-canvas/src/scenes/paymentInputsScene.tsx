import {Circle, Line, makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Colors, Fonts, Timing} from '../core/theme';
import {SafeZone} from '../core/ScreenGrid';

type Point = [number, number];

export default makeScene2D(function* (view) {
  applyBackground(view);

  const leftOpacity = createSignal(0);
  const midOpacity = createSignal(0);
  const rightOpacity = createSignal(0);

  const leftPortOpacity = createSignal(0);
  const rightPortOpacity = createSignal(0);
  const wiresOpacity = createSignal(0);
  const dtoOpacity = createSignal(0);

  const leftR = 150;
  const midR = 175;
  const rightR = 150;

  const yBase = 120;
  const edgeGap = 315;
  const safeW = SafeZone.right - SafeZone.left;
  const diagramW = leftR * 2 + edgeGap + midR * 2 + edgeGap + rightR * 2;
  const marginX = (safeW - diagramW) / 2;

  const leftCx = SafeZone.left + marginX + leftR;
  const midCx = leftCx + leftR + edgeGap + midR;
  const rightCx = midCx + midR + edgeGap + rightR;

  const c: Point = [midCx, yBase];
  const leftC: Point = [leftCx, yBase];
  const rightC: Point = [rightCx, yBase];
  const strokeW = 2.5;
  const beigeFill = 'rgba(248,235,216,0.18)';
  const softStroke = 'rgba(248,235,216,0.26)';
  const leftStroke = softStroke;
  const midStroke = softStroke;
  const rightStroke = softStroke;

  const leftFill = beigeFill;
  const midFill = beigeFill;
  const rightFill = beigeFill;

  const whiteText = Colors.text.primary;

  const wireStroke = 'rgba(110,168,255,0.28)';
  const portBlue = 'rgba(110,168,255,0.95)';
  const pathFill = 'rgba(110,168,255,0.84)';
  const serviceFontSize = 34;
  const serviceFontWeight = 650;
  const midServiceFontSize = 30;

  const dtoFontSize = 28;
  const dtoLineGap = 12;
  const dtoText = Colors.text.primary;
  const dtoBlue = portBlue;
  const dtoX = SafeZone.left + 40;
  const dtoY = SafeZone.top + 60;

  const leftWireY = leftC[1];
  const leftWireStartX = leftC[0] + leftR;
  const leftWireEndX = c[0] - midR;

  const rightWireY = rightC[1];
  const rightWireStartX = rightC[0] - rightR;
  const rightWireEndX = c[0] + midR;

  const leftPort: Point = [leftWireEndX, c[1]];
  const rightPort: Point = [rightWireEndX, c[1]];

  view.add(
    <>
      <Rect>
        <Line
          points={[
            [leftWireStartX, leftWireY],
            [leftWireEndX, leftWireY],
          ]}
          stroke={wireStroke}
          lineWidth={3}
          opacity={() => leftOpacity() * wiresOpacity()}
        />

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
          fontSize={serviceFontSize}
          fontWeight={serviceFontWeight}
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
        <Circle
          x={leftPort[0]}
          y={leftPort[1]}
          width={22}
          height={22}
          fill={portBlue}
          opacity={() => midOpacity() * leftPortOpacity()}
        />
        <Circle
          x={rightPort[0]}
          y={rightPort[1]}
          width={22}
          height={22}
          fill={portBlue}
          opacity={() => midOpacity() * rightPortOpacity()}
        />
        <Txt
          x={c[0]}
          y={c[1] - 6}
          text={'payment-service'}
          fontFamily={Fonts.primary}
          fontSize={midServiceFontSize}
          fontWeight={serviceFontWeight}
          letterSpacing={-0.2}
          fill={whiteText}
          opacity={midOpacity}
        />

        <Line
          points={[
            [rightWireStartX, rightWireY],
            [rightWireEndX, rightWireY],
          ]}
          stroke={wireStroke}
          lineWidth={3}
          opacity={() => rightOpacity() * wiresOpacity()}
        />

        <Rect
          x={(leftWireStartX + leftWireEndX) / 2}
          y={leftWireY - 46}
          layout
          direction={'row'}
          alignItems={'center'}
          gap={10}
          opacity={() => wiresOpacity() * leftOpacity()}
        >
          <Txt
            text={'GET'}
            fontFamily={Fonts.code}
            fontSize={20}
            fontWeight={700}
            letterSpacing={-0.2}
            fill={'rgba(244,241,235,0.82)'}
          />
          <Txt
            text={'/payments/{id}'}
            fontFamily={Fonts.code}
            fontSize={22}
            fontWeight={650}
            letterSpacing={-0.2}
            fill={pathFill}
          />
        </Rect>

        <Rect
          x={(rightWireStartX + rightWireEndX) / 2}
          y={rightWireY - 46}
          layout
          direction={'row'}
          alignItems={'center'}
          gap={10}
          opacity={() => wiresOpacity() * rightOpacity()}
        >
          <Txt
            text={'POST'}
            fontFamily={Fonts.code}
            fontSize={20}
            fontWeight={700}
            letterSpacing={-0.2}
            fill={'rgba(244,241,235,0.82)'}
          />
          <Txt
            text={'/webhooks/payment'}
            fontFamily={Fonts.code}
            fontSize={22}
            fontWeight={650}
            letterSpacing={-0.2}
            fill={pathFill}
          />
        </Rect>

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
          fontSize={serviceFontSize}
          fontWeight={serviceFontWeight}
          letterSpacing={-0.1}
          fill={whiteText}
          opacity={rightOpacity}
        />
      </Rect>

      <Rect
        x={dtoX}
        y={dtoY}
        layout
        direction={'column'}
        alignItems={'start'}
        gap={dtoLineGap}
        opacity={() => midOpacity() * dtoOpacity()}
        offset={[-1, -1]}
      >
        <Rect layout direction={'row'} alignItems={'center'} gap={8}>
          <Txt text={'record'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={650} letterSpacing={-0.2} fill={dtoBlue} />
          <Txt text={'PaymentDto'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={650} letterSpacing={-0.2} fill={dtoText} />
          <Txt text={'('} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={650} letterSpacing={-0.2} fill={dtoText} />
        </Rect>
        <Txt text={'  String id,'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={600} letterSpacing={-0.2} fill={dtoText} />
        <Txt text={'  BigDecimal amount,'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={600} letterSpacing={-0.2} fill={dtoText} />
        <Txt text={'  String currency,'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={600} letterSpacing={-0.2} fill={dtoText} />
        <Txt text={'  String status,'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={600} letterSpacing={-0.2} fill={dtoText} />
        <Txt text={'  Instant updatedAt'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={600} letterSpacing={-0.2} fill={dtoText} />
        <Rect layout direction={'row'} alignItems={'center'} gap={0}>
          <Txt text={')'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={650} letterSpacing={-0.2} fill={dtoText} />
          <Txt text={' {}'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={650} letterSpacing={-0.2} fill={dtoText} />
        </Rect>
      </Rect>
    </>,
  );

  yield* all(leftOpacity(1, 1.35, easeInOutCubic), midOpacity(1, 1.35, easeInOutCubic), rightOpacity(1, 1.35, easeInOutCubic));

  yield* waitFor(2.1);

  yield* wiresOpacity(1, 0.65, easeInOutCubic);

  yield* all(leftPortOpacity(1, 0.30, easeInOutCubic), rightPortOpacity(1, 0.30, easeInOutCubic));
  yield* all(leftPortOpacity(0.45, 0.22, easeInOutCubic), rightPortOpacity(0.45, 0.22, easeInOutCubic));
  yield* all(leftPortOpacity(1, 0.24, easeInOutCubic), rightPortOpacity(1, 0.24, easeInOutCubic));

  yield* waitFor(0.4);
  yield* dtoOpacity(1, 0.9, easeInOutCubic);

  yield* waitFor(2.2);
});


