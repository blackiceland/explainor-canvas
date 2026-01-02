import {Circle, Line, makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Colors, Fonts, Timing} from '../core/theme';
import {SafeZone} from '../core/ScreenGrid';
import {CodeBlockText, CodeBlockWithOverlay} from '../core/components/CodeBlockText';
import {DebugOverlay} from '../core/components/DebugOverlay';
import {GridOverlay} from '../core/components/GridOverlay';
import {textWidth} from '../core/utils/textMeasure';
import {DEBUG} from '../core/debug';

type Point = [number, number];

export default makeScene2D(function* (view) {
  applyBackground(view);

  // Global DEBUG imported from ../core/debug

  const leftOpacity = createSignal(0);
  const midOpacity = createSignal(0);
  const rightOpacity = createSignal(0);

  const leftPortOpacity = createSignal(0);
  const rightPortOpacity = createSignal(0);
  const wiresOpacity = createSignal(0);
  const dtoObjectOpacity = createSignal(0);
  const dtoValuesOpacity = createSignal(0);
  const stripeJsonOpacity = createSignal(0);
  const packetT = createSignal(0);
  const packetOpacity = createSignal(0);

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

  const dtoText = Colors.text.primary;
  const dtoBlue = portBlue;

  // Code blocks (DTO object + Stripe JSON) must match visually.
  const codeStyle = {
    fontSize: 26,
    lineHeight: 38,
    width: 600,
    fontWeight: 650,
  } as const;
  // Absolute positioning (tuned via GridOverlay commands).
  const codeTopY = -450;
  const dtoCodeX = -250;
  const dtoValueFill = 'rgba(255,140,163,0.92)';
  const dtoKeyFill = Colors.text.primary;

  // Build DTO keys + values with guaranteed alignment (no manual spacing guessing).
  const dtoKeyLines = [
    'PaymentDto {',
    '  id:',
    '  amount:',
    '  currency:',
    '  status:',
    '  updatedAt:',
    '}',
  ];

  const dtoValueLines = [
    '',
    '"pay_550e8400"',
    '99.00',
    '"USD"',
    '"CAPTURED"',
    '"2024-12-15T14:32:00Z"',
    '',
  ];

  const dtoKeysText = dtoKeyLines.join('\n');
  const dtoValuesText = dtoValueLines.join('\n');

  // Shift value overlay to a fixed "value column" to prevent overlap with keys.
  const valueColChars = Math.max(
    ...dtoKeyLines.map(l => {
      const idx = l.indexOf(':');
      return idx >= 0 ? idx + 2 : 0; // ': ' (space) gap
    }),
  );
  const monoCharW = textWidth('0', Fonts.code, codeStyle.fontSize, codeStyle.fontWeight);
  const valuesDx = valueColChars * monoCharW;

  const stripeJson = `{
  "id": "pay_550e8400",
  "amount": 99.00,
  "currency": "USD",
  "status": "CAPTURED",
  "updatedAt": "2024-12-15T14:32:00Z"
}`;
  const stripeJsonX = rightC[0] - 260;
  const stripeJsonY = codeTopY;
  const stripeJsonW = codeStyle.width;

  const dtoKeysRef = createRef<Txt>();
  const dtoValuesRef = createRef<Txt>();
  const stripeJsonRef = createRef<Txt>();

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

      <CodeBlockWithOverlay
        x={dtoCodeX}
        y={codeTopY}
        style={codeStyle}
        keysText={dtoKeysText}
        valuesText={dtoValuesText}
        keysFill={dtoKeyFill}
        valuesFill={dtoValueFill}
        opacity={() => midOpacity() * dtoObjectOpacity()}
        valuesOpacity={dtoValuesOpacity}
        valuesDx={valuesDx}
        ellipsis
        ellipsisText={'...'}
        maxWidthPx={SafeZone.right - dtoCodeX}
        keysRef={dtoKeysRef}
        valuesRef={dtoValuesRef}
      />

      <CodeBlockText
        ref={stripeJsonRef}
        x={stripeJsonX}
        y={stripeJsonY}
        style={{...codeStyle, fontWeight: 600}}
        text={stripeJson}
        fill={Colors.text.primary}
        opacity={stripeJsonOpacity}
        ellipsis
        ellipsisText={'...'}
        maxWidthPx={SafeZone.right - stripeJsonX}
      />

      <Circle
        x={packetX}
        y={packetY}
        width={18}
        height={18}
        fill={pink}
        opacity={packetOpacity}
      />

      {DEBUG && (
        <>
          <GridOverlay minorStep={50} majorStep={100} opacity={0.65} />
          <DebugOverlay
            baselinesY={[codeTopY]}
            items={[
              {name: 'dto.keys', ref: dtoKeysRef, color: 'rgba(110,168,255,0.7)'},
              {name: 'dto.values', ref: dtoValuesRef, color: 'rgba(255,140,163,0.65)'},
              {name: 'stripe.json', ref: stripeJsonRef, color: 'rgba(244,241,235,0.55)'},
            ]}
          />
        </>
      )}
    </>,
  );

  yield* all(leftOpacity(1, 1.6, easeInOutCubic), midOpacity(1, 1.6, easeInOutCubic), rightOpacity(1, 1.6, easeInOutCubic));

  yield* waitFor(1.8);

  yield* wiresOpacity(1, 0.9, easeInOutCubic);

  yield* all(leftPortOpacity(1, 0.42, easeInOutCubic), rightPortOpacity(1, 0.42, easeInOutCubic));
  yield* all(leftPortOpacity(0.5, 0.28, easeInOutCubic), rightPortOpacity(0.5, 0.28, easeInOutCubic));
  yield* all(leftPortOpacity(1, 0.34, easeInOutCubic), rightPortOpacity(1, 0.34, easeInOutCubic));

  yield* waitFor(0.25);
  yield* dtoObjectOpacity(1, 1.2, easeInOutCubic);

  yield* waitFor(0.6);
  yield* stripeJsonOpacity(1, 0.9, easeInOutCubic);
  yield* packetOpacity(1, 0.22, easeInOutCubic);

  yield* packetT(1, 1.6, easeInOutCubic);

  yield* dtoValuesOpacity(1, 0.5, easeInOutCubic);
  yield* packetOpacity(0, 0.22, easeInOutCubic);

  yield* waitFor(1.3);
  // Values disappear, keys remain. JSON stays visible.
  yield* dtoValuesOpacity(0, 0.7, easeInOutCubic);

  yield* waitFor(2.2);
});


