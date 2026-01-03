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
  const stripeJsonExtraLines = createSignal(0);
  const clientJsonExtraLines = createSignal(0);
  const clientCircleRed = createSignal(0);
  const focusRisk = createSignal(0);
  const focusX = createSignal(0);
  const riskScoreSig = createSignal('0.91');
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

  const sceneShiftY = 70;
  const yBase = 120 + sceneShiftY;
  const edgeGap = 365;
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
  const focusW = (k: number) => Math.max(0, 1 - Math.abs(focusX() - k));
  const dimRiskOthers = () => 1 - focusRisk() * 0.9;
  const dangerRed = 'rgba(255,0,0,1)';
  const parseRgba = (s: string) => {
    const m = s.replace(/\s+/g, '').match(/^rgba\((\d+),(\d+),(\d+),([0-9.]+)\)$/);
    if (!m) return {r: 255, g: 255, b: 255, a: 1};
    return {r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: Number(m[4])};
  };
  const mixRgba = (a: string, b: string, t: number) => {
    const x = parseRgba(a);
    const y = parseRgba(b);
    const k = Math.max(0, Math.min(1, t));
    const r = x.r + (y.r - x.r) * k;
    const g = x.g + (y.g - x.g) * k;
    const bb = x.b + (y.b - x.b) * k;
    const aa = x.a + (y.a - x.a) * k;
    return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(bb)},${aa})`;
  };
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
  const codeTopY = -450 + sceneShiftY;
  const dtoValueFill = 'rgba(255,140,163,0.92)';
  const dtoKeyFill = Colors.text.primary;

  const dtoHeaderType = 'PaymentDto';
  const dtoHeaderRest = ' {';
  const dtoBodyKeyLines = [' id:', ' amount:', ' currency:', ' status:', ' updatedAt:', '}'];
  const dtoKeyLinesSig = createSignal(dtoBodyKeyLines.join('\n'));

  const dtoBodyValueLines = ['"pay_550e8400"', '99.00', '"USD"', '"CAPTURED"', '"2024-12-15T14:32:00Z"', ''];

  const dtoKeysText = dtoBodyKeyLines.join('\n');
  const dtoValuesText = createSignal(dtoBodyValueLines.join('\n'));
  const dtoExtraLines = createSignal(0);

  const dtoValuesDxBase = Math.max(
    ...dtoBodyKeyLines.map(l => {
      const norm = l.replace(/\s+/g, ' ');
      const idx = norm.indexOf(':');
      if (idx < 0) return 0;
      const prefix = norm.slice(0, idx + 2);
      return textWidth(prefix, Fonts.code, codeStyle.fontSize, codeStyle.fontWeight);
    }),
  ) + 25;
  const dtoValuesDxRisk =
    Math.max(
      ...[...dtoBodyKeyLines.slice(0, -1), ' riskScore:', dtoBodyKeyLines[dtoBodyKeyLines.length - 1]].map(l => {
        const norm = l.replace(/\s+/g, ' ');
        const idx = norm.indexOf(':');
        if (idx < 0) return 0;
        const prefix = norm.slice(0, idx + 2);
        return textWidth(prefix, Fonts.code, codeStyle.fontSize, codeStyle.fontWeight);
      }),
    ) + 25;
  const dtoValuesDx = createSignal(dtoValuesDxBase);

  const dtoHeaderY = codeTopY;
  const dtoBodyY = codeTopY + codeStyle.lineHeight;

  const codeCardShrinkW = 0;
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
  const dtoBoxHBase = dtoLineCount * codeStyle.lineHeight + codeBorderPadY * 2;
  const dtoBoxH = () => dtoBoxHBase + dtoExtraLines() * codeStyle.lineHeight;
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
  const stripeJsonKeyLines = stripeJsonLines.map(line => {
    const idx = line.indexOf(':');
    if (idx < 0) return line;
    return line.slice(0, idx + 2);
  });
  const stripeJsonKeysText = stripeJsonKeyLines.join('\n');
  const stripeJsonKeysTextSig = createSignal(stripeJsonKeysText);

  const stripeJsonValueLines = stripeJsonLines.map(line => {
    const idx = line.indexOf(':');
    if (idx < 0) return '';
    return line.slice(idx + 2);
  });
  const stripeJsonValuesText = stripeJsonValueLines.join('\n');
  const stripeJsonValuesTextSig = createSignal(stripeJsonValuesText);

  const jsonGapTighten = 14;
  const stripeJsonValuesDx = Math.max(
    ...[...stripeJsonLines.slice(0, -1), '  "riskScore": 0', stripeJsonLines[stripeJsonLines.length - 1]].map(line => {
      const idx = line.indexOf(':');
      if (idx < 0) return 0;
      const prefix = line.slice(0, idx + 2);
      return textWidth(prefix, Fonts.code, codeStyle.fontSize, 600);
    }),
  ) - jsonGapTighten;

  const jsonTextW = dtoTextW;
  const jsonBoxW = jsonTextW + codeBorderPadX * 2;
  const jsonBoxH = () => dtoBoxHBase + stripeJsonExtraLines() * codeStyle.lineHeight;
  const jsonBoxX = rightC[0] + rightR - jsonBoxW;
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
  const clientJsonKeyLines = clientJsonLines.map(line => {
    const idx = line.indexOf(':');
    if (idx < 0) return line;
    return line.slice(0, idx + 2);
  });
  const clientJsonKeysTextSig = createSignal(clientJsonKeyLines.join('\n'));

  const clientJsonValueLines = clientJsonLines.map(line => {
    const idx = line.indexOf(':');
    if (idx < 0) return '';
    return line.slice(idx + 2);
  });
  const clientJsonValuesTextSig = createSignal(clientJsonValueLines.join('\n'));
  const clientJsonValuesDx = Math.max(
    ...[...clientJsonLines.slice(0, -1), '  "riskScore": 0', clientJsonLines[clientJsonLines.length - 1]].map(line => {
      const idx = line.indexOf(':');
      if (idx < 0) return 0;
      const prefix = line.slice(0, idx + 2);
      return textWidth(prefix, Fonts.code, codeStyle.fontSize, 600);
    }),
  ) - jsonGapTighten;

  const clientJsonY = codeTopY;
  const clientJsonAvailW = dtoTextW;
  const clientJsonBoxW = clientJsonAvailW + codeBorderPadX * 2;
  const clientJsonBoxH = () => dtoBoxHBase + clientJsonExtraLines() * codeStyle.lineHeight;
  const clientJsonBoxX = leftC[0] - leftR;
  const clientJsonBoxY = clientJsonY - codeBorderPadY;
  const clientJsonX = clientJsonBoxX + codeBorderPadX;

  const clientJsonRef = createRef<Txt>();
  const clientJsonValuesRef = createRef<Txt>();

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const makeCycleData = (i: number) => {
    const id = `pay_550e84${pad2(i)}${pad2((i * 7) % 100)}`;
    const amount = (49 + i * 3.5).toFixed(2);
    const status = i % 5 === 0 ? 'FAILED' : i % 3 === 0 ? 'PENDING' : 'CAPTURED';
    const mm = (32 + i) % 60;
    const ss = (10 + i * 7) % 60;
    const updatedAt = `2024-12-15T14:${pad2(mm)}:${pad2(ss)}Z`;
    const riskScore = Math.min(0.99, 0.55 + i * 0.03).toFixed(2);
    return {id, amount, status, updatedAt, riskScore};
  };

  const setStripePayload = (
    d: {id: string; amount: string; status: string; updatedAt: string; riskScore: string},
    withNewField: boolean,
  ) => {
    if (withNewField) {
      const keys = [...stripeJsonKeyLines.slice(0, -1), '  "riskScore": ', stripeJsonKeyLines[stripeJsonKeyLines.length - 1]];
      stripeJsonKeysTextSig(keys.join('\n'));
      stripeJsonValuesTextSig(
        ['', `"${d.id}",`, `${d.amount},`, `"USD",`, `"${d.status}",`, `"${d.updatedAt}",`, d.riskScore, ''].join('\n'),
      );
      return;
    }

    stripeJsonKeysTextSig(stripeJsonKeyLines.join('\n'));
    stripeJsonValuesTextSig(['', `"${d.id}",`, `${d.amount},`, `"USD",`, `"${d.status}",`, `"${d.updatedAt}"`, ''].join('\n'));
  };

  const setClientPayload = (d: {id: string; amount: string; status: string; riskScore: string}, withNewField: boolean) => {
    if (withNewField) {
      const keys = [...clientJsonKeyLines.slice(0, -1), '  "riskScore": ', clientJsonKeyLines[clientJsonKeyLines.length - 1]];
      clientJsonKeysTextSig(keys.join('\n'));
      clientJsonValuesTextSig(['', `"${d.id}",`, `${d.amount},`, `"USD",`, `"${d.status}",`, d.riskScore, ''].join('\n'));
      return;
    }

    clientJsonKeysTextSig(clientJsonKeyLines.join('\n'));
    clientJsonValuesTextSig(['', `"${d.id}",`, `${d.amount},`, `"USD",`, `"${d.status}"`, ''].join('\n'));
  };

  const setDtoPayload = (d: {id: string; amount: string; status: string; updatedAt: string; riskScore: string}, withNewField: boolean) => {
    if (withNewField) {
      dtoExtraLines(1);
      dtoValuesDx(dtoValuesDxRisk);
      dtoKeyLinesSig([...dtoBodyKeyLines.slice(0, -1), ' riskScore:', dtoBodyKeyLines[dtoBodyKeyLines.length - 1]].join('\n'));
      dtoValuesText([`"${d.id}"`, d.amount, `"USD"`, `"${d.status}"`, `"${d.updatedAt}"`, d.riskScore, ''].join('\n'));
      return;
    }

    dtoExtraLines(0);
    dtoValuesDx(dtoValuesDxBase);
    dtoKeyLinesSig(dtoBodyKeyLines.join('\n'));
    dtoValuesText([`"${d.id}"`, d.amount, `"USD"`, `"${d.status}"`, `"${d.updatedAt}"`, ''].join('\n'));
  };

  const setCycleTexts = (i: number, opts?: {stripeNewField?: boolean; dtoNewField?: boolean; clientNewField?: boolean}) => {
    const d = makeCycleData(i);
    riskScoreSig(d.riskScore);
    setStripePayload(d, Boolean(opts?.stripeNewField));
    setDtoPayload(d, Boolean(opts?.dtoNewField));
    setClientPayload(d, Boolean(opts?.clientNewField));
  };

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
          opacity={() => leftOpacity() * wiresOpacity() * dimOthers() * dimRiskOthers()}
        />

        <Circle
          x={leftC[0]}
          y={leftC[1]}
          width={leftR * 2}
          height={leftR * 2}
          fill={() => mixRgba(leftFill, 'rgba(255,0,0,0.22)', clientCircleRed())}
          stroke={() => mixRgba(leftStroke, dangerRed, clientCircleRed())}
          lineWidth={strokeW}
          opacity={() => leftOpacity() * dimOthers() * dimRiskOthers()}
        />
        <Circle
          x={leftC[0]}
          y={leftC[1]}
          width={leftR * 2 + 40}
          height={leftR * 2 + 40}
          fill={'rgba(0,0,0,0)'}
          stroke={dangerRed}
          lineWidth={18}
          opacity={() => leftOpacity() * dimOthers() * dimRiskOthers() * clientCircleRed() * 0.22}
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
          opacity={() => leftOpacity() * dimOthers() * dimRiskOthers()}
        />

        <Circle
          x={c[0]}
          y={c[1]}
          width={midR * 2}
          height={midR * 2}
          fill={midFill}
          stroke={midStroke}
          lineWidth={strokeW}
          opacity={() => midOpacity() * dimRiskOthers()}
        />
        <Circle
          x={leftPort[0]}
          y={leftPort[1]}
          width={22}
          height={22}
          fill={portBlue}
          opacity={() => midOpacity() * leftPortOpacity() * (0.55 + 0.45 * dtoPulse()) * dimRiskOthers()}
        />
        <Circle
          x={rightPort[0]}
          y={rightPort[1]}
          width={22}
          height={22}
          fill={portBlue}
          opacity={() => midOpacity() * rightPortOpacity() * (0.55 + 0.45 * dtoPulse()) * dimRiskOthers()}
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
          opacity={() => midOpacity() * dimRiskOthers()}
        />

        <Line
          points={[
            [rightWireStartX, rightWireY],
            [rightWireEndX, rightWireY],
          ]}
          stroke={wireStroke}
          lineWidth={3}
          opacity={() => rightOpacity() * wiresOpacity() * dimOthers() * dimRiskOthers()}
        />

        <Rect
          x={(leftWireStartX + leftWireEndX) / 2}
          y={leftWireY - 46}
          layout
          direction={'row'}
          alignItems={'center'}
          gap={10}
          opacity={() => wiresOpacity() * leftOpacity() * dimOthers() * dimRiskOthers()}
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
          opacity={() => wiresOpacity() * rightOpacity() * dimOthers() * dimRiskOthers()}
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
          opacity={() => rightOpacity() * dimOthers() * dimRiskOthers()}
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
          opacity={() => rightOpacity() * dimOthers() * dimRiskOthers()}
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
        opacity={() => midOpacity() * dtoObjectOpacity() * dimRiskOthers()}
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
        opacity={() => midOpacity() * dtoObjectOpacity() * dimRiskOthers()}
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
        opacity={() => midOpacity() * dtoObjectOpacity() * dimRiskOthers()}
      />

      <CodeBlockWithOverlay
        x={dtoCodeX}
        y={dtoBodyY}
        style={{...codeStyle, width: dtoTextW}}
        keysText={dtoKeyLinesSig}
        valuesText={dtoValuesText}
        keysFill={dtoKeyFill}
        valuesFill={dtoValueFill}
        opacity={() => midOpacity() * dtoObjectOpacity() * dimRiskOthers()}
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
        keysText={stripeJsonKeysTextSig}
        valuesText={stripeJsonValuesTextSig}
        keysFill={Colors.text.primary}
        valuesFill={pink}
        opacity={() => stripeJsonOpacity() * dimOthers() * dimRiskOthers()}
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
        opacity={() => stripeJsonOpacity() * dimOthers() * dimRiskOthers()}
      />

      <Circle
        x={packetX}
        y={packetY}
        width={18}
        height={18}
        fill={pink}
        opacity={() => packetOpacity() * dimRiskOthers()}
      />

      <CodeBlockWithOverlay
        x={clientJsonX}
        y={clientJsonY}
        style={{...codeStyle, fontWeight: 600, width: clientJsonAvailW}}
        keysText={clientJsonKeysTextSig}
        valuesText={clientJsonValuesTextSig}
        keysFill={Colors.text.primary}
        valuesFill={pink}
        opacity={() => clientJsonOpacity() * dimOthers() * dimRiskOthers()}
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
        opacity={() => clientJsonOpacity() * dimOthers() * dimRiskOthers()}
      />

      <Circle
        x={packet2X}
        y={packet2Y}
        width={18}
        height={18}
        fill={pink}
        opacity={() => packet2Opacity() * dimRiskOthers()}
      />

      <Txt
        x={stripeJsonX}
        y={() => stripeJsonY + codeStyle.lineHeight * 6}
        width={jsonTextW}
        text={'  "riskScore": '}
        fontFamily={Fonts.code}
        fontSize={codeStyle.fontSize}
        fontWeight={650}
        lineHeight={codeStyle.lineHeight}
        fill={Colors.text.primary}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={() => focusRisk() * focusW(0)}
      />
      <Txt
        x={() => stripeJsonX + stripeJsonValuesDx}
        y={() => stripeJsonY + codeStyle.lineHeight * 6}
        width={jsonTextW}
        text={riskScoreSig}
        fontFamily={Fonts.code}
        fontSize={codeStyle.fontSize}
        fontWeight={650}
        lineHeight={codeStyle.lineHeight}
        fill={pink}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={() => focusRisk() * focusW(0)}
      />

      <Txt
        x={dtoCodeX}
        y={() => dtoBodyY + codeStyle.lineHeight * 5}
        width={dtoTextW}
        text={' riskScore:'}
        fontFamily={Fonts.code}
        fontSize={codeStyle.fontSize}
        fontWeight={650}
        lineHeight={codeStyle.lineHeight}
        fill={dtoKeyFill}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={() => focusRisk() * focusW(1)}
      />
      <Txt
        x={() => dtoCodeX + dtoValuesDxRisk}
        y={() => dtoBodyY + codeStyle.lineHeight * 5}
        width={dtoTextW}
        text={riskScoreSig}
        fontFamily={Fonts.code}
        fontSize={codeStyle.fontSize}
        fontWeight={650}
        lineHeight={codeStyle.lineHeight}
        fill={dtoValueFill}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={() => focusRisk() * focusW(1)}
      />

      <Txt
        x={clientJsonX}
        y={() => clientJsonY + codeStyle.lineHeight * 5}
        width={clientJsonAvailW}
        text={'  "riskScore": '}
        fontFamily={Fonts.code}
        fontSize={codeStyle.fontSize}
        fontWeight={650}
        lineHeight={codeStyle.lineHeight}
        fill={Colors.text.primary}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={() => focusRisk() * focusW(2)}
      />
      <Txt
        x={() => clientJsonX + clientJsonValuesDx}
        y={() => clientJsonY + codeStyle.lineHeight * 5}
        width={clientJsonAvailW}
        text={riskScoreSig}
        fontFamily={Fonts.code}
        fontSize={codeStyle.fontSize}
        fontWeight={650}
        lineHeight={codeStyle.lineHeight}
        fill={pink}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={() => focusRisk() * focusW(2)}
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
    yield* all(dtoPulse(1, 0.28, easeInOutCubic), leftPortOpacity(1, 0.28, easeInOutCubic), rightPortOpacity(1, 0.28, easeInOutCubic));
    yield* all(dtoPulse(0.2, 0.28, easeInOutCubic), leftPortOpacity(0.55, 0.28, easeInOutCubic), rightPortOpacity(0.55, 0.28, easeInOutCubic));
  }
  yield* all(shadowOthers(0, 0.6, easeInOutCubic), dtoPulse(0, 0.6, easeInOutCubic));
  yield* waitFor(0.35);

  yield* all(stripeJsonOpacity(1, 1.1, easeInOutCubic), clientJsonOpacity(1, 1.1, easeInOutCubic));
  yield* waitFor(0.35);

  packetT(0);
  packetOpacity(0);
  packet2T(0);
  packet2Opacity(0);
  stripeJsonValuesOpacity(0);
  dtoValuesOpacity(0);
  clientJsonValuesOpacity(0);

  const totalCycles = 20;
  const cycles = 9;
  const cycleOffset = totalCycles - cycles;
  const slowDur = 1.15;
  const fastDur = 0.18;

  for (let i = 0; i < cycles; i++) {
    const isLast = i === cycles - 1;
    const t = totalCycles <= 1 ? 1 : (i + cycleOffset) / (totalCycles - 1);
    const travel = slowDur + (fastDur - slowDur) * t;
    const fadeIn = Math.max(0.1, Math.min(0.28, travel * 0.3));
    const fadeX = Math.max(0.1, Math.min(0.24, travel * 0.26));
    const hold = Math.max(0.05, Math.min(0.16, travel * 0.18));

    stripeJsonExtraLines(isLast ? 1 : 0);
    clientJsonExtraLines(0);
    clientCircleRed(0);
    focusRisk(0);
    focusX(0);
    setCycleTexts(i + cycleOffset, {stripeNewField: isLast});

    packetT(0);
    packetOpacity(0);
    stripeJsonValuesOpacity(0);
    dtoValuesOpacity(0);
    clientJsonValuesOpacity(0);
    packet2T(0);
    packet2Opacity(0);

    const isFirst = i === 0;
    const fadeInSoft = isFirst ? Math.max(0.6, fadeIn * 1.9) : fadeIn;
    const preMove = Math.max(0.12, Math.min(0.28, fadeInSoft * 0.6));
    yield* all(packetOpacity(1, fadeInSoft, easeInOutCubic), stripeJsonValuesOpacity(1, fadeInSoft, easeInOutCubic));
    yield* waitFor(preMove);

    yield* packetT(0.7, travel * 0.7, linear);
    if (isLast) setCycleTexts(i + cycleOffset, {stripeNewField: true, dtoNewField: true});
    yield* all(
      packetT(1, travel * 0.3, linear),
      packetOpacity(0, travel * 0.3, easeInOutCubic),
      stripeJsonValuesOpacity(0, travel * 0.3, easeInOutCubic),
      dtoValuesOpacity(1, travel * 0.3, easeInOutCubic),
    );

    yield* waitFor(hold);

    yield* all(packet2Opacity(1, fadeX, easeInOutCubic), dtoValuesOpacity(1, 0));
    yield* packet2T(0.7, travel * 0.7, linear);
    if (isLast) {
      clientJsonExtraLines(1);
      setCycleTexts(i + cycleOffset, {stripeNewField: true, dtoNewField: true, clientNewField: true});
    }
    yield* all(
      packet2T(1, travel * 0.3, linear),
      packet2Opacity(0, travel * 0.3, easeInOutCubic),
      dtoValuesOpacity(0, travel * 0.3, easeInOutCubic),
      clientJsonValuesOpacity(1, travel * 0.3, easeInOutCubic),
    );

    if (isLast) {
      yield* clientCircleRed(1, 0.55, easeInOutCubic);
      yield* focusRisk(1, 1.15, easeInOutCubic);
      break;
    }

    yield* waitFor(hold);
    if (!isLast) yield* clientJsonValuesOpacity(0, fadeX, easeInOutCubic);

    if (i === cycles - 2) {
      const microTravel = Math.max(0.08, fastDur * 0.55);
      const microFade = 0.09;
      const microHold = 0.035;

      for (let j = 0; j < 5; j++) {
        stripeJsonExtraLines(0);
        clientJsonExtraLines(0);
        clientCircleRed(0);
        focusRisk(0);
        focusX(0);

        setCycleTexts(i + cycleOffset + j + 1);

        packetT(0);
        packetOpacity(0);
        stripeJsonValuesOpacity(0);
        dtoValuesOpacity(0);
        clientJsonValuesOpacity(0);
        packet2T(0);
        packet2Opacity(0);

        yield* all(packetOpacity(1, microFade, easeInOutCubic), stripeJsonValuesOpacity(1, microFade, easeInOutCubic));
        yield* packetT(1, microTravel, linear);
        yield* all(
          packetOpacity(0, microFade, easeInOutCubic),
          stripeJsonValuesOpacity(0, microFade, easeInOutCubic),
          dtoValuesOpacity(1, microFade, easeInOutCubic),
        );

        yield* waitFor(microHold);

        yield* packet2Opacity(1, microFade, easeInOutCubic);
        yield* packet2T(1, microTravel, linear);
        yield* all(
          packet2Opacity(0, microFade, easeInOutCubic),
          dtoValuesOpacity(0, microFade, easeInOutCubic),
          clientJsonValuesOpacity(1, microFade, easeInOutCubic),
        );

        yield* waitFor(microHold);
        yield* clientJsonValuesOpacity(0, microFade, easeInOutCubic);
      }
    }
  }

  if (focusRisk() > 0) {
    yield* waitFor(0.35);
    yield* focusX(1, 0.9, easeInOutCubic);
    yield* waitFor(0.35);
    yield* focusX(2, 0.9, easeInOutCubic);
  }

  yield* waitFor(1.5);
});


