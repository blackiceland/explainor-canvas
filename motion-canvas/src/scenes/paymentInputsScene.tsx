import {Circle, Line, makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {textWidth} from '../core/utils/textMeasure';
import {Colors, Fonts, Timing} from '../core/theme';

type Point = [number, number];

export default makeScene2D(function* (view) {
  applyBackground(view);

  const leftOpacity = createSignal(0);
  const midOpacity = createSignal(0);
  const rightOpacity = createSignal(0);

  const leftPortOpacity = createSignal(0);
  const rightPortOpacity = createSignal(0);
  const leftLeaderEnd = createSignal(0);
  const rightLeaderEnd = createSignal(0);
  const endpointsOpacity = createSignal(0);
  const wiresOpacity = createSignal(0);
  const dtoOpacity = createSignal(0);

  const c: Point = [0, 40];
  const leftC: Point = [-560, 40];
  const rightC: Point = [560, 40];

  const leftR = 150;
  const midR = 175;
  const rightR = 150;

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

  const wireStroke = 'rgba(244,241,235,0.20)';
  const chipFill = 'rgba(244,241,235,0.030)';
  const methodFill = 'rgba(244,241,235,0.76)';
  const portBlue = 'rgba(110,168,255,0.95)';
  const pathFill = 'rgba(110,168,255,0.84)';
  const serviceFontSize = 34;
  const serviceFontWeight = 650;
  const midServiceFontSize = 30;
  const dtoText = 'rgba(244,241,235,0.88)';
  const dtoKeyword = 'rgba(110,168,255,0.95)';
  const dtoType = 'rgba(107,229,214,0.92)';

  const dtoFontSize = 30;
  const dtoLineGap = 10;
  const dtoPadX = 40;
  const dtoPadY = 32;
  const dtoFill = 'rgba(248,235,216,0.05)';
  const dtoStroke = 'rgba(248,235,216,0.22)';
  const dtoRadius = 26;
  const dtoLift = createSignal(18);
  const dtoTokenGap = 6;

  const dtoLines = [
    [
      {t: 'record', w: 700},
      {t: 'PaymentDto', w: 650},
      {t: '(', w: 650},
    ],
    [
      {t: '  ', w: 600},
      {t: 'String', w: 650},
      {t: ' id,', w: 600},
    ],
    [
      {t: '  ', w: 600},
      {t: 'BigDecimal', w: 650},
      {t: ' amount,', w: 600},
    ],
    [
      {t: '  ', w: 600},
      {t: 'String', w: 650},
      {t: ' currency,', w: 600},
    ],
    [
      {t: '  ', w: 600},
      {t: 'String', w: 650},
      {t: ' status,', w: 600},
    ],
    [
      {t: '  ', w: 600},
      {t: 'Instant', w: 650},
      {t: ' updatedAt', w: 600},
    ],
    [{t: ') {}', w: 650}],
  ] as const;

  const dtoLineWidth = (line: ReadonlyArray<{t: string; w: number}>) =>
    line.reduce((acc, seg) => acc + textWidth(seg.t, Fonts.code, dtoFontSize, seg.w), 0) +
    Math.max(0, line.length - 1) * dtoTokenGap;
  const dtoContentWidth = Math.max(...dtoLines.map(dtoLineWidth));
  const dtoWidth = Math.ceil(dtoContentWidth + dtoPadX * 2);
  const dtoHeight = Math.ceil(dtoPadY * 2 + dtoLines.length * dtoFontSize + (dtoLines.length - 1) * dtoLineGap);

  const stageScale = createSignal(1);
  const stageY = createSignal(0);

  const leftWireY = leftC[1];
  const leftWireStartX = leftC[0] + leftR;
  const leftWireEndX = c[0] - midR;

  const rightWireY = rightC[1];
  const rightWireStartX = rightC[0] - rightR;
  const rightWireEndX = c[0] + midR;

  const leftPort: Point = [leftWireEndX, c[1]];
  const rightPort: Point = [rightWireEndX, c[1]];

  const leaderDx = 160;
  const leaderDy = -210;
  const leftLeaderEndPoint: Point = [leftPort[0] - leaderDx, leftPort[1] + leaderDy];
  const rightLeaderEndPoint: Point = [rightPort[0] + leaderDx, rightPort[1] + leaderDy];

  const leftEndpointLabelX = leftLeaderEndPoint[0] - 95;
  const rightEndpointLabelX = rightLeaderEndPoint[0] + 95;
  const endpointLabelY = leftLeaderEndPoint[1] - 2;

  view.add(
    <>
      <Rect scale={() => [stageScale(), stageScale()]} y={stageY}>
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
          x={leftPort[0]}
          y={leftPort[1]}
          width={22}
          height={22}
          fill={portBlue}
          opacity={() => midOpacity() * leftPortOpacity()}
        />
        <Line
          points={[leftPort, leftLeaderEndPoint]}
          stroke={wireStroke}
          lineWidth={3}
          end={leftLeaderEnd}
          opacity={() => midOpacity() * wiresOpacity()}
        />
        <Rect
          x={leftEndpointLabelX}
          y={endpointLabelY}
          layout
          direction={'row'}
          alignItems={'center'}
          gap={10}
          opacity={() => midOpacity() * endpointsOpacity()}
        >
          <Rect radius={999} fill={chipFill} padding={[5, 9]}>
            <Txt
              text={'GET'}
              fontFamily={Fonts.code}
              fontSize={18}
              fontWeight={700}
              letterSpacing={-0.2}
              fill={methodFill}
            />
          </Rect>
          <Txt
            text={'/payments/{id}'}
            fontFamily={Fonts.code}
            fontSize={20}
            fontWeight={600}
            letterSpacing={-0.2}
            fill={pathFill}
          />
        </Rect>

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
          text={'payment-service'}
          fontFamily={Fonts.primary}
          fontSize={midServiceFontSize}
          fontWeight={serviceFontWeight}
          letterSpacing={-0.2}
          fill={whiteText}
          opacity={midOpacity}
        />

        <Circle
          x={rightPort[0]}
          y={rightPort[1]}
          width={22}
          height={22}
          fill={portBlue}
          opacity={() => midOpacity() * rightPortOpacity()}
        />
        <Line
          points={[rightPort, rightLeaderEndPoint]}
          stroke={wireStroke}
          lineWidth={3}
          end={rightLeaderEnd}
          opacity={() => midOpacity() * wiresOpacity()}
        />
        <Rect
          x={rightEndpointLabelX}
          y={endpointLabelY}
          layout
          direction={'row'}
          alignItems={'center'}
          gap={10}
          opacity={() => midOpacity() * endpointsOpacity()}
        >
          <Rect radius={999} fill={chipFill} padding={[5, 9]}>
            <Txt
              text={'POST'}
              fontFamily={Fonts.code}
              fontSize={18}
              fontWeight={700}
              letterSpacing={-0.2}
              fill={methodFill}
            />
          </Rect>
          <Txt
            text={'/webhooks/payment'}
            fontFamily={Fonts.code}
            fontSize={20}
            fontWeight={600}
            letterSpacing={-0.2}
            fill={pathFill}
          />
        </Rect>

        <Line
          points={[
            [rightWireStartX, rightWireY],
            [rightWireEndX, rightWireY],
          ]}
          stroke={wireStroke}
          lineWidth={3}
          opacity={() => rightOpacity() * wiresOpacity()}
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
          fontSize={serviceFontSize}
          fontWeight={serviceFontWeight}
          letterSpacing={-0.1}
          fill={whiteText}
          opacity={rightOpacity}
        />
      </Rect>

      <Rect
        x={c[0]}
        y={() =>
          stageY() +
          stageScale() * c[1] -
          stageScale() * midR -
          dtoHeight / 2 -
          34 -
          dtoLift()
        }
        width={dtoWidth}
        height={dtoHeight}
        radius={dtoRadius}
        fill={dtoFill}
        stroke={dtoStroke}
        lineWidth={2}
        shadowColor={'rgba(0,0,0,0)'}
        shadowBlur={0}
        shadowOffset={[0, 0]}
        clip
        opacity={() => midOpacity() * dtoOpacity()}
        layout
        direction={'column'}
        alignItems={'start'}
        justifyContent={'center'}
        padding={[dtoPadY, dtoPadX]}
        gap={dtoLineGap}
      >
        <Rect layout direction={'row'} alignItems={'center'} gap={dtoTokenGap}>
          <Txt offset={[-1, 0]} text={'record'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={700} letterSpacing={-0.2} fill={dtoKeyword} />
          <Txt offset={[-1, 0]} text={'PaymentDto'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={650} letterSpacing={-0.2} fill={dtoText} />
          <Txt offset={[-1, 0]} text={'('} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={650} letterSpacing={-0.2} fill={dtoText} />
        </Rect>
        <Rect layout direction={'row'} alignItems={'center'} gap={dtoTokenGap}>
          <Txt offset={[-1, 0]} text={'  '} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={600} letterSpacing={-0.2} fill={dtoText} />
          <Txt offset={[-1, 0]} text={'String'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={650} letterSpacing={-0.2} fill={dtoType} />
          <Txt offset={[-1, 0]} text={' id,'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={600} letterSpacing={-0.2} fill={dtoText} />
        </Rect>
        <Rect layout direction={'row'} alignItems={'center'} gap={dtoTokenGap}>
          <Txt offset={[-1, 0]} text={'  '} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={600} letterSpacing={-0.2} fill={dtoText} />
          <Txt offset={[-1, 0]} text={'BigDecimal'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={650} letterSpacing={-0.2} fill={dtoType} />
          <Txt offset={[-1, 0]} text={' amount,'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={600} letterSpacing={-0.2} fill={dtoText} />
        </Rect>
        <Rect layout direction={'row'} alignItems={'center'} gap={dtoTokenGap}>
          <Txt offset={[-1, 0]} text={'  '} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={600} letterSpacing={-0.2} fill={dtoText} />
          <Txt offset={[-1, 0]} text={'String'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={650} letterSpacing={-0.2} fill={dtoType} />
          <Txt offset={[-1, 0]} text={' currency,'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={600} letterSpacing={-0.2} fill={dtoText} />
        </Rect>
        <Rect layout direction={'row'} alignItems={'center'} gap={dtoTokenGap}>
          <Txt offset={[-1, 0]} text={'  '} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={600} letterSpacing={-0.2} fill={dtoText} />
          <Txt offset={[-1, 0]} text={'String'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={650} letterSpacing={-0.2} fill={dtoType} />
          <Txt offset={[-1, 0]} text={' status,'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={600} letterSpacing={-0.2} fill={dtoText} />
        </Rect>
        <Rect layout direction={'row'} alignItems={'center'} gap={dtoTokenGap}>
          <Txt offset={[-1, 0]} text={'  '} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={600} letterSpacing={-0.2} fill={dtoText} />
          <Txt offset={[-1, 0]} text={'Instant'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={650} letterSpacing={-0.2} fill={dtoType} />
          <Txt offset={[-1, 0]} text={' updatedAt'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={600} letterSpacing={-0.2} fill={dtoText} />
        </Rect>
        <Rect layout direction={'row'} alignItems={'center'} gap={dtoTokenGap}>
          <Txt offset={[-1, 0]} text={') {}'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={650} letterSpacing={-0.2} fill={dtoText} />
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

  yield* all(leftLeaderEnd(1, 0.75, easeInOutCubic), rightLeaderEnd(1, 0.75, easeInOutCubic), endpointsOpacity(1, 0.75, easeInOutCubic));

  yield* waitFor(0.4);
  yield* all(stageScale(0.78, 1.15, easeInOutCubic), stageY(135, 1.15, easeInOutCubic));
  yield* waitFor(0.15);
  yield* all(dtoOpacity(1, 0.9, easeInOutCubic), dtoLift(0, 0.9, easeInOutCubic));

  yield* waitFor(2.2);
});


