import {Circle, Line, makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, createSignal, easeInOutCubic, linear, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Colors, Fonts} from '../core/theme';
import {SafeZone} from '../core/ScreenGrid';
import {CodeBlockText, CodeBlockWithOverlay} from '../core/components/CodeBlockText';
import {DebugOverlay} from '../core/components/DebugOverlay';
import {GridOverlay} from '../core/components/GridOverlay';
import {textWidth} from '../core/utils/textMeasure';
import {DEBUG} from '../core/debug';

type Point = [number, number];

export default makeScene2D(function* (view) {
  applyBackground(view);

  const leftOpacity = createSignal(0);
  const midOpacity = createSignal(0);
  const rightOpacity = createSignal(0);

  const leftPortOpacity = createSignal(0);
  const rightPortOpacity = createSignal(0);
  const wiresOpacity = createSignal(0);
  const dtoObjectOpacity = createSignal(0);
  const dtoValuesOpacity = createSignal(0);
  const dtoPulse = createSignal(0);
  const shadowOthers = createSignal(0);
  const stripeJsonOpacity = createSignal(0);
  const stripeJsonValuesOpacity = createSignal(0);
  const packetT = createSignal(0);
  const packetOpacity = createSignal(0);

  const clientJsonOpacity = createSignal(0);
  const clientJsonValuesOpacity = createSignal(0);
  const packet2T = createSignal(0);
  const packet2Opacity = createSignal(0);

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
  const dimOthers = () => 1 - shadowOthers() * 0.78;
  const serviceFontSize = 34;
  const serviceFontWeight = 650;
  const midServiceFontSize = 30;

  const dtoText = Colors.text.primary;
  const dtoBlue = portBlue;

  const codeStyle = {
    fontSize: 26,
    lineHeight: 38,
    width: 600,
    fontWeight: 650,
  } as const;
  const codeTopY = -450;
  const dtoValueFill = 'rgba(255,140,163,0.92)';
  const dtoKeyFill = Colors.text.primary;

  const dtoHeaderType = 'PaymentDto';
  const dtoHeaderRest = ' {';
  const dtoBodyKeyLines = [' id:', ' amount:', ' currency:', ' status:', ' updatedAt:', '}'];

  const dtoBodyValueLines = ['"pay_550e8400"', '99.00', '"USD"', '"CAPTURED"', '"2024-12-15T14:32:00Z"', ''];

  const dtoKeysText = dtoBodyKeyLines.join('\n');
  const dtoValuesText = dtoBodyValueLines.join('\n');

  const dtoValuesDx = Math.max(
    ...dtoBodyKeyLines.map(l => {
      const norm = l.replace(/\s+/g, ' ');
      const idx = norm.indexOf(':');
      if (idx < 0) return 0;
      const prefix = norm.slice(0, idx + 2);
      return textWidth(prefix, Fonts.code, codeStyle.fontSize, codeStyle.fontWeight);
    }),
  ) + 25;

  const dtoHeaderY = codeTopY;
  const dtoBodyY = codeTopY + codeStyle.lineHeight;

  const codeCardShrinkW = 100;
  const codeCardBaseW = 520;
  const codeBorderStroke = 'rgba(110,168,255,0.32)';
  const dtoBorderStroke = () => `rgba(110,168,255,${0.22 + 0.42 * dtoPulse()})`;
  const codeBorderWidth = 2;
  const codeBorderRadius = 10;
  const codeBorderPadX = 14;
  const codeBorderPadY = 12;
  const dtoLineCount = 1 + dtoBodyKeyLines.length;
  const dtoTextW = Math.max(0, Math.min(codeStyle.width, codeCardBaseW - codeCardShrinkW));
  const dtoBoxW = dtoTextW + codeBorderPadX * 2;
  const dtoBoxH = dtoLineCount * codeStyle.lineHeight + codeBorderPadY * 2;
  const dtoBoxX = c[0] - dtoBoxW / 2;
  const dtoBoxY = codeTopY - codeBorderPadY;
  const dtoCodeX = dtoBoxX + codeBorderPadX;
  const dtoHeaderRestX = dtoCodeX + textWidth(dtoHeaderType, Fonts.code, codeStyle.fontSize, codeStyle.fontWeight);

  const stripeJson = `{
  "id": "pay_550e8400",
  "amount": 99.00,
  "currency": "USD",
  "status": "CAPTURED",
  "updatedAt": "2024-12-15T14:32:00Z"
}`;
  const stripeJsonY = codeTopY;

  const dtoKeysRef = createRef<Txt>();
  const dtoValuesRef = createRef<Txt>();
  const stripeJsonRef = createRef<Txt>();
  const stripeJsonValuesRef = createRef<Txt>();

  const stripeJsonLines = stripeJson.split('\n').map(l => l.replace(/\s+/g, ' '));
  const stripeJsonKeysText = stripeJsonLines
    .map(line => {
      const idx = line.indexOf(':');
      if (idx < 0) return line;
      return line.slice(0, idx + 2);
    })
    .join('\n');

  const stripeJsonValuesText = stripeJsonLines
    .map(line => {
      const idx = line.indexOf(':');
      if (idx < 0) return '';
      return line.slice(idx + 2);
    })
    .join('\n');

  const stripeJsonValuesDx = Math.max(
    ...stripeJsonLines.map(line => {
      const idx = line.indexOf(':');
      if (idx < 0) return 0;
      const prefix = line.slice(0, idx + 2);
      return textWidth(prefix, Fonts.code, codeStyle.fontSize, 600);
    }),
  );

  const jsonTextW = dtoTextW;
  const jsonBoxW = jsonTextW + codeBorderPadX * 2;
  const jsonBoxH = dtoBoxH;
  const jsonBoxX = rightC[0] - jsonBoxW / 2;
  const jsonBoxY = stripeJsonY - codeBorderPadY;
  const stripeJsonX = jsonBoxX + codeBorderPadX;
  const jsonAvailW = jsonTextW;

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

  const packet2Start: Point = [leftWireEndX, leftWireY];
  const packet2End: Point = [leftWireStartX, leftWireY];
  const packet2X = () => packet2Start[0] + (packet2End[0] - packet2Start[0]) * packet2T();
  const packet2Y = () => packet2Start[1] + (packet2End[1] - packet2Start[1]) * packet2T();

  const clientJson = `{
  "id": "pay_550e8400",
  "amount": 99.00,
  "currency": "USD",
  "status": "CAPTURED"
}`;
  const clientJsonLines = clientJson.split('\n').map(l => l.replace(/\s+/g, ' '));
  const clientJsonKeysText = clientJsonLines
    .map(line => {
      const idx = line.indexOf(':');
      if (idx < 0) return line;
      return line.slice(0, idx + 2);
    })
    .join('\n');
  const clientJsonValuesText = clientJsonLines
    .map(line => {
      const idx = line.indexOf(':');
      if (idx < 0) return '';
      return line.slice(idx + 2);
    })
    .join('\n');
  const clientJsonValuesDx = Math.max(
    ...clientJsonLines.map(line => {
      const idx = line.indexOf(':');
      if (idx < 0) return 0;
      const prefix = line.slice(0, idx + 2);
      return textWidth(prefix, Fonts.code, codeStyle.fontSize, 600);
    }),
  );

  const clientJsonY = codeTopY;
  const clientJsonAvailW = dtoTextW;
  const clientJsonBoxW = clientJsonAvailW + codeBorderPadX * 2;
  const clientJsonBoxH = dtoBoxH;
  const clientJsonBoxX = leftC[0] - clientJsonBoxW / 2;
  const clientJsonBoxY = clientJsonY - codeBorderPadY;
  const clientJsonX = clientJsonBoxX + codeBorderPadX;

  const clientJsonRef = createRef<Txt>();
  const clientJsonValuesRef = createRef<Txt>();

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
          opacity={() => leftOpacity() * wiresOpacity() * dimOthers()}
        />

        <Circle
          x={leftC[0]}
          y={leftC[1]}
          width={leftR * 2}
          height={leftR * 2}
          fill={leftFill}
          stroke={leftStroke}
          lineWidth={strokeW}
          opacity={() => leftOpacity() * dimOthers()}
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
          opacity={() => leftOpacity() * dimOthers()}
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
          opacity={() => midOpacity() * leftPortOpacity() * (0.55 + 0.45 * dtoPulse())}
        />
        <Circle
          x={rightPort[0]}
          y={rightPort[1]}
          width={22}
          height={22}
          fill={portBlue}
          opacity={() => midOpacity() * rightPortOpacity() * (0.55 + 0.45 * dtoPulse())}
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
          opacity={() => rightOpacity() * wiresOpacity() * dimOthers()}
        />

        <Rect
          x={(leftWireStartX + leftWireEndX) / 2}
          y={leftWireY - 46}
          layout
          direction={'row'}
          alignItems={'center'}
          gap={10}
          opacity={() => wiresOpacity() * leftOpacity() * dimOthers()}
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
          opacity={() => wiresOpacity() * rightOpacity() * dimOthers()}
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
          opacity={() => rightOpacity() * dimOthers()}
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
          opacity={() => rightOpacity() * dimOthers()}
        />
      </Rect>

      <Rect
        x={dtoBoxX}
        y={dtoBoxY}
        width={dtoBoxW}
        height={dtoBoxH}
        radius={codeBorderRadius}
        fill={'rgba(0,0,0,0)'}
        stroke={dtoBorderStroke}
        lineWidth={codeBorderWidth}
        offset={[-1, -1]}
        opacity={() => midOpacity() * dtoObjectOpacity()}
      />
      <Txt
        x={dtoCodeX}
        y={dtoHeaderY}
        text={dtoHeaderType}
        fontFamily={Fonts.code}
        fontSize={codeStyle.fontSize}
        fontWeight={codeStyle.fontWeight}
        lineHeight={codeStyle.lineHeight}
        fill={dtoBlue}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={() => midOpacity() * dtoObjectOpacity()}
      />
      <Txt
        x={dtoHeaderRestX}
        y={dtoHeaderY}
        text={dtoHeaderRest}
        fontFamily={Fonts.code}
        fontSize={codeStyle.fontSize}
        fontWeight={codeStyle.fontWeight}
        lineHeight={codeStyle.lineHeight}
        fill={dtoKeyFill}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={() => midOpacity() * dtoObjectOpacity()}
      />

      <CodeBlockWithOverlay
        x={dtoCodeX}
        y={dtoBodyY}
        style={{...codeStyle, width: dtoTextW}}
        keysText={dtoKeysText}
        valuesText={dtoValuesText}
        keysFill={dtoKeyFill}
        valuesFill={dtoValueFill}
        opacity={() => midOpacity() * dtoObjectOpacity()}
        valuesOpacity={dtoValuesOpacity}
        valuesDx={dtoValuesDx}
        ellipsis
        ellipsisText={'...'}
        maxWidthPx={dtoTextW}
        keysRef={dtoKeysRef}
        valuesRef={dtoValuesRef}
      />

      <CodeBlockWithOverlay
        x={stripeJsonX}
        y={stripeJsonY}
        style={{...codeStyle, fontWeight: 600, width: jsonTextW}}
        keysText={stripeJsonKeysText}
        valuesText={stripeJsonValuesText}
        keysFill={Colors.text.primary}
        valuesFill={pink}
        opacity={() => stripeJsonOpacity() * dimOthers()}
        valuesOpacity={stripeJsonValuesOpacity}
        valuesDx={stripeJsonValuesDx}
        ellipsis
        ellipsisText={'...'}
        maxWidthPx={jsonAvailW}
        keysRef={stripeJsonRef}
        valuesRef={stripeJsonValuesRef}
      />

      <Rect
        x={jsonBoxX}
        y={jsonBoxY}
        width={jsonBoxW}
        height={jsonBoxH}
        radius={codeBorderRadius}
        fill={'rgba(0,0,0,0)'}
        stroke={codeBorderStroke}
        lineWidth={codeBorderWidth}
        offset={[-1, -1]}
        opacity={() => stripeJsonOpacity() * dimOthers()}
      />

      <Circle
        x={packetX}
        y={packetY}
        width={18}
        height={18}
        fill={pink}
        opacity={packetOpacity}
      />

      <CodeBlockWithOverlay
        x={clientJsonX}
        y={clientJsonY}
        style={{...codeStyle, fontWeight: 600, width: clientJsonAvailW}}
        keysText={clientJsonKeysText}
        valuesText={clientJsonValuesText}
        keysFill={Colors.text.primary}
        valuesFill={pink}
        opacity={() => clientJsonOpacity() * dimOthers()}
        valuesOpacity={clientJsonValuesOpacity}
        valuesDx={clientJsonValuesDx}
        ellipsis
        ellipsisText={'...'}
        maxWidthPx={clientJsonAvailW}
        keysRef={clientJsonRef}
        valuesRef={clientJsonValuesRef}
      />

      <Rect
        x={clientJsonBoxX}
        y={clientJsonBoxY}
        width={clientJsonBoxW}
        height={clientJsonBoxH}
        radius={codeBorderRadius}
        fill={'rgba(0,0,0,0)'}
        stroke={codeBorderStroke}
        lineWidth={codeBorderWidth}
        offset={[-1, -1]}
        opacity={() => clientJsonOpacity() * dimOthers()}
      />

      <Circle
        x={packet2X}
        y={packet2Y}
        width={18}
        height={18}
        fill={pink}
        opacity={packet2Opacity}
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

  yield* waitFor(0.3);
  yield* all(
    dtoObjectOpacity(1, 1.05, easeInOutCubic),
    shadowOthers(1, 1.05, easeInOutCubic),
  );
  for (let i = 0; i < 4; i++) {
    yield* all(dtoPulse(1, 0.22, easeInOutCubic), leftPortOpacity(1, 0.22, easeInOutCubic), rightPortOpacity(1, 0.22, easeInOutCubic));
    yield* all(dtoPulse(0.2, 0.22, easeInOutCubic), leftPortOpacity(0.55, 0.22, easeInOutCubic), rightPortOpacity(0.55, 0.22, easeInOutCubic));
  }
  yield* all(shadowOthers(0, 0.6, easeInOutCubic), dtoPulse(0, 0.6, easeInOutCubic));
  yield* waitFor(0.35);

  yield* stripeJsonOpacity(1, 1.4, easeInOutCubic);
  yield* waitFor(0.5);

  yield* all(
    packetOpacity(1, 0.8, easeInOutCubic),
    stripeJsonValuesOpacity(1, 0.8, easeInOutCubic),
  );
  yield* waitFor(0.3);

  yield* packetT(0.7, 0.6, linear);

  yield* all(
    packetT(1, 0.4, linear),
    packetOpacity(0, 0.4, easeInOutCubic),
    stripeJsonValuesOpacity(0, 0.4, easeInOutCubic),
    dtoValuesOpacity(1, 0.4, easeInOutCubic),
  );

  yield* waitFor(1.2);

  yield* clientJsonOpacity(1, 1.0, easeInOutCubic);
  yield* waitFor(0.3);

  yield* all(
    packet2Opacity(1, 0.6, easeInOutCubic),
    dtoValuesOpacity(0, 0.6, easeInOutCubic),
  );
  yield* waitFor(0.2);

  yield* packet2T(0.7, 0.6, linear);

  yield* all(
    packet2T(1, 0.4, linear),
    packet2Opacity(0, 0.4, easeInOutCubic),
    clientJsonValuesOpacity(1, 0.4, easeInOutCubic),
  );

  yield* waitFor(2.0);
  yield* clientJsonValuesOpacity(0, 1.0, easeInOutCubic);
  yield* waitFor(2.0);
});


