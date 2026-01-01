import {blur, Circle, Line, makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Colors, Fonts, Timing} from '../core/theme';
import {SafeZone} from '../core/ScreenGrid';
import {PanelStyle} from '../core/panelStyle';
import {textWidth} from '../core/utils/textMeasure';

type Point = [number, number];

export default makeScene2D(function* (view) {
  applyBackground(view);

  const diagramRef = createRef<Rect>();

  const leftOpacity = createSignal(0);
  const midOpacity = createSignal(0);
  const rightOpacity = createSignal(0);

  const leftPortOpacity = createSignal(0);
  const rightPortOpacity = createSignal(0);
  const wiresOpacity = createSignal(0);
  const dtoOpacity = createSignal(0);
  const blurServices = createSignal(0);
  const dtoObjectOpacity = createSignal(0);
  const dtoValuesOpacity = createSignal(0);
  const stripeJsonOpacity = createSignal(0);
  const packetT = createSignal(0);
  const stripeArrowOpacity = createSignal(0);

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
  const pink = Colors.accent;
  const serviceFontSize = 34;
  const serviceFontWeight = 650;
  const midServiceFontSize = 30;

  const dtoFontSize = 56;
  const dtoLineGap = 18;
  const dtoText = Colors.text.primary;
  const dtoBlue = portBlue;
  const dtoPadX = 72;
  const dtoPadY = 56;
  const dtoLineHeight = 78;
  const dtoH = dtoPadY * 2 + dtoLineHeight * 7 + dtoLineGap * 6;
  const dtoRowWeight = 600;
  const dtoHeaderWeight = 650;
  const dtoMeasure = (s: string, w: number) => textWidth(s, Fonts.code, dtoFontSize, w);
  const dtoW =
    Math.ceil(
      Math.max(
        dtoMeasure('record', dtoHeaderWeight) + 16 + dtoMeasure('PaymentDto', dtoHeaderWeight) + 8 + dtoMeasure('(', dtoHeaderWeight),
        dtoMeasure('  String id,', dtoRowWeight),
        dtoMeasure('  BigDecimal amount,', dtoRowWeight),
        dtoMeasure('  String currency,', dtoRowWeight),
        dtoMeasure('  String status,', dtoRowWeight),
        dtoMeasure('  Instant updatedAt', dtoRowWeight),
        dtoMeasure(') {}', dtoHeaderWeight),
      ) + dtoPadX * 2,
    );

  const dtoCardX = 0;
  const dtoCardY = -40;

  const dtoObjFontSize = 32;
  const dtoObjLineHeight = 46;
  const dtoObjGap = 8;
  const dtoObjPadX = 28;
  const dtoObjPadY = 22;
  const dtoObjW = 520;
  const dtoObjH = dtoObjPadY * 2 + dtoObjLineHeight * 7 + dtoObjGap * 6;
  const dtoObjX = c[0] + 56;
  const dtoObjY = c[1] - midR - dtoObjH / 2 - 28;
  const dtoObjScaleY = 0.9;
  const dtoValueFill = 'rgba(255,140,163,0.92)';
  const dtoKeyFill = Colors.text.primary;

  const stripeJson = `{
  "id": "pay_550e8400",
  "amount": 99.00,
  "currency": "USD",
  "status": "CAPTURED",
  "updatedAt": "2024-12-15T14:32:00Z"
}`;
  const stripeJsonX = rightC[0] - 300;
  const stripeJsonY = dtoObjY - (dtoObjH * dtoObjScaleY) / 2;
  const stripeJsonW = 600;

  const leftWireY = leftC[1];
  const leftWireStartX = leftC[0] + leftR;
  const leftWireEndX = c[0] - midR;

  const rightWireY = rightC[1];
  const rightWireStartX = rightC[0] - rightR;
  const rightWireEndX = c[0] + midR;

  const packetStart: Point = [rightWireStartX, rightWireY];
  const packetEnd: Point = [rightWireEndX, rightWireY];
  const packetX = () => packetStart[0] + (packetEnd[0] - packetStart[0]) * packetT();
  const packetY = () => packetStart[1] + (packetEnd[1] - packetStart[1]) * packetT();

  const leftPort: Point = [leftWireEndX, c[1]];
  const rightPort: Point = [rightWireEndX, c[1]];

  view.add(
    <>
      <Rect ref={diagramRef}>
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
        x={dtoCardX}
        y={dtoCardY}
        width={dtoW}
        height={dtoH}
        radius={PanelStyle.radius}
        fill={PanelStyle.fill}
        stroke={PanelStyle.stroke}
        lineWidth={PanelStyle.lineWidth}
        shadowColor={PanelStyle.shadowColor}
        shadowBlur={PanelStyle.shadowBlur}
        shadowOffset={PanelStyle.shadowOffset}
        opacity={() => midOpacity() * dtoOpacity()}
        clip
        layout
        direction={'column'}
        alignItems={'start'}
        padding={[dtoPadY, dtoPadX]}
        gap={dtoLineGap}
      >
        <Rect layout direction={'row'} alignItems={'center'} gap={0}>
          <Txt text={'record'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={650} letterSpacing={-0.2} fill={dtoBlue} />
          <Rect width={36} height={1} fill={'rgba(0,0,0,0)'} />
          <Txt text={'PaymentDto'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={650} letterSpacing={-0.2} fill={dtoText} />
          <Rect width={8} height={1} fill={'rgba(0,0,0,0)'} />
          <Txt text={'('} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={650} letterSpacing={-0.2} fill={dtoText} />
        </Rect>
        <Txt text={'  String id,'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={600} letterSpacing={-0.2} lineHeight={dtoLineHeight} fill={dtoText} />
        <Txt text={'  BigDecimal amount,'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={600} letterSpacing={-0.2} lineHeight={dtoLineHeight} fill={dtoText} />
        <Txt text={'  String currency,'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={600} letterSpacing={-0.2} lineHeight={dtoLineHeight} fill={dtoText} />
        <Txt text={'  String status,'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={600} letterSpacing={-0.2} lineHeight={dtoLineHeight} fill={dtoText} />
        <Txt text={'  Instant updatedAt'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={600} letterSpacing={-0.2} lineHeight={dtoLineHeight} fill={dtoText} />
        <Rect layout direction={'row'} alignItems={'center'} gap={0}>
          <Txt text={')'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={650} letterSpacing={-0.2} lineHeight={dtoLineHeight} fill={dtoText} />
          <Txt text={' {}'} fontFamily={Fonts.code} fontSize={dtoFontSize} fontWeight={650} letterSpacing={-0.2} lineHeight={dtoLineHeight} fill={dtoText} />
        </Rect>
      </Rect>

      <Rect
        x={dtoObjX}
        y={dtoObjY}
        width={dtoObjW}
        height={dtoObjH}
        radius={0}
        fill={'rgba(0,0,0,0)'}
        stroke={'rgba(0,0,0,0)'}
        lineWidth={0}
        shadowColor={'rgba(0,0,0,0)'}
        shadowBlur={0}
        shadowOffset={[0, 0]}
        opacity={() => midOpacity() * dtoObjectOpacity()}
        scale={() => [1, dtoObjScaleY]}
        layout
        direction={'column'}
        alignItems={'start'}
        padding={[dtoObjPadY, dtoObjPadX]}
        gap={dtoObjGap}
      >
        <Rect layout direction={'row'} alignItems={'center'} gap={10}>
          <Txt text={'PaymentDto'} fontFamily={Fonts.code} fontSize={dtoObjFontSize} fontWeight={700} lineHeight={dtoObjLineHeight} fill={dtoBlue} />
          <Txt text={'{'} fontFamily={Fonts.code} fontSize={dtoObjFontSize} fontWeight={650} lineHeight={dtoObjLineHeight} fill={dtoText} />
        </Rect>
        <Rect layout direction={'row'} alignItems={'center'} gap={10}>
          <Txt text={'  id:'} fontFamily={Fonts.code} fontSize={dtoObjFontSize} fontWeight={600} lineHeight={dtoObjLineHeight} fill={dtoKeyFill} />
          <Txt text={'"pay_550e8400"'} fontFamily={Fonts.code} fontSize={dtoObjFontSize} fontWeight={650} lineHeight={dtoObjLineHeight} fill={dtoValueFill} opacity={dtoValuesOpacity} />
        </Rect>
        <Rect layout direction={'row'} alignItems={'center'} gap={10}>
          <Txt text={'  amount:'} fontFamily={Fonts.code} fontSize={dtoObjFontSize} fontWeight={600} lineHeight={dtoObjLineHeight} fill={dtoKeyFill} />
          <Txt text={'99.00'} fontFamily={Fonts.code} fontSize={dtoObjFontSize} fontWeight={650} lineHeight={dtoObjLineHeight} fill={dtoValueFill} opacity={dtoValuesOpacity} />
        </Rect>
        <Rect layout direction={'row'} alignItems={'center'} gap={10}>
          <Txt text={'  currency:'} fontFamily={Fonts.code} fontSize={dtoObjFontSize} fontWeight={600} lineHeight={dtoObjLineHeight} fill={dtoKeyFill} />
          <Txt text={'"USD"'} fontFamily={Fonts.code} fontSize={dtoObjFontSize} fontWeight={650} lineHeight={dtoObjLineHeight} fill={dtoValueFill} opacity={dtoValuesOpacity} />
        </Rect>
        <Rect layout direction={'row'} alignItems={'center'} gap={10}>
          <Txt text={'  status:'} fontFamily={Fonts.code} fontSize={dtoObjFontSize} fontWeight={600} lineHeight={dtoObjLineHeight} fill={dtoKeyFill} />
          <Txt text={'"CAPTURED"'} fontFamily={Fonts.code} fontSize={dtoObjFontSize} fontWeight={650} lineHeight={dtoObjLineHeight} fill={dtoValueFill} opacity={dtoValuesOpacity} />
        </Rect>
        <Rect layout direction={'row'} alignItems={'center'} gap={10}>
          <Txt text={'  updatedAt:'} fontFamily={Fonts.code} fontSize={dtoObjFontSize} fontWeight={600} lineHeight={dtoObjLineHeight} fill={dtoKeyFill} />
          <Txt text={'"2024-12-15T14:32:00Z"'} fontFamily={Fonts.code} fontSize={dtoObjFontSize} fontWeight={650} lineHeight={dtoObjLineHeight} fill={dtoValueFill} opacity={dtoValuesOpacity} />
        </Rect>
        <Txt text={'}'} fontFamily={Fonts.code} fontSize={dtoObjFontSize} fontWeight={650} lineHeight={dtoObjLineHeight} fill={dtoText} />
      </Rect>

      <Txt
        x={stripeJsonX}
        y={stripeJsonY}
        width={stripeJsonW}
        text={stripeJson}
        fontFamily={Fonts.code}
        fontSize={26}
        fontWeight={600}
        lineHeight={38}
        fill={Colors.text.primary}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={stripeJsonOpacity}
      />

      <Circle
        x={packetX}
        y={packetY}
        width={18}
        height={18}
        fill={pink}
        opacity={stripeArrowOpacity}
      />
    </>,
  );

  diagramRef().cache(true);
  diagramRef().cachePadding(180);
  diagramRef().filters(() => [blur(blurServices())]);

  yield* all(leftOpacity(1, 1.6, easeInOutCubic), midOpacity(1, 1.6, easeInOutCubic), rightOpacity(1, 1.6, easeInOutCubic));

  yield* waitFor(1.8);

  yield* wiresOpacity(1, 0.9, easeInOutCubic);

  yield* all(leftPortOpacity(1, 0.42, easeInOutCubic), rightPortOpacity(1, 0.42, easeInOutCubic));
  yield* all(leftPortOpacity(0.5, 0.28, easeInOutCubic), rightPortOpacity(0.5, 0.28, easeInOutCubic));
  yield* all(leftPortOpacity(1, 0.34, easeInOutCubic), rightPortOpacity(1, 0.34, easeInOutCubic));

  yield* waitFor(0.7);
  yield* all(
    blurServices(16, 1.6, easeInOutCubic),
    dtoOpacity(1, 1.6, easeInOutCubic),
  );

  yield* waitFor(1.3);
  yield* all(
    dtoOpacity(0, 1.2, easeInOutCubic),
    blurServices(0, 1.2, easeInOutCubic),
  );

  yield* waitFor(0.25);
  yield* dtoObjectOpacity(1, 1.2, easeInOutCubic);

  yield* waitFor(0.6);
  yield* stripeJsonOpacity(1, 0.9, easeInOutCubic);
  yield* stripeArrowOpacity(0.35, 0.12, easeInOutCubic);
  yield* stripeArrowOpacity(1, 0.18, easeInOutCubic);
  yield* stripeArrowOpacity(0.6, 0.12, easeInOutCubic);
  yield* stripeArrowOpacity(1, 0.22, easeInOutCubic);

  yield* packetT(1, 1.6, easeInOutCubic);

  yield* all(
    dtoValuesOpacity(1, 0.5, easeInOutCubic),
    stripeJsonOpacity(0, 0.8, easeInOutCubic),
  );

  yield* waitFor(2.2);
});


