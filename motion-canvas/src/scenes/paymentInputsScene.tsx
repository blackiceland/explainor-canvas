  import {Circle, Line, makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, createSignal, easeInOutCubic, linear, waitFor} from '@motion-canvas/core';
import {OpenStyle} from '../core/openStyle';
import {OpenText} from '../core/openText';
import {OpenShapes} from '../core/openShapes';
import {Fonts, Screen, Timing} from '../core/theme';
import {SafeZone} from '../core/ScreenGrid';
import {CodeBlockWithOverlay} from '../core/components/CodeBlockText';
import {DebugOverlay} from '../core/components/DebugOverlay';
import {GridOverlay} from '../core/components/GridOverlay';
import {textWidth} from '../core/utils/textMeasure';
import {DEBUG} from '../core/debug';

type Point = [number, number];

export default makeScene2D(function* (view) {
  const S = OpenStyle;
  const inkRgba = S.colors.ink;
  const mutedRgba = S.colors.muted;
  const borderRgba = S.colors.border;
  const oliveRgba = S.colors.olive;
  const slateBlueRgba = S.colors.blue;
  const transparent = 'rgba(0,0,0,0)';

  const leftOpacity = createSignal(0);
  const midOpacity = createSignal(0);
  const rightOpacity = createSignal(0);

  const leftPortOpacity = createSignal(0);
  const rightPortOpacity = createSignal(0);
  const wiresOpacity = createSignal(0);
  const dtoObjectOpacity = createSignal(0);
  const dtoValuesOpacity = createSignal(0);
  const dtoPulse = createSignal(0);
  const riskDimEnabled = createSignal(1);
  const shadowOthers = createSignal(0);
  const stripeJsonExtraLines = createSignal(0);
  const clientJsonExtraLines = createSignal(0);
  const clientCircleRed = createSignal(0);
  const focusRisk = createSignal(0);
  const focusX = createSignal(0);
  const riskScoreSig = createSignal('0.91');
  const stripeJsonOpacity = createSignal(0);
  const stripeJsonValuesOpacity = createSignal(0);
  const stripeJsonBaseValuesOpacity = createSignal(0);
  const packetT = createSignal(0);
  const packetOpacity = createSignal(0);

  const clientJsonOpacity = createSignal(0);
  const clientJsonValuesOpacity = createSignal(0);
  const clientJsonBaseValuesOpacity = createSignal(0);
  const packet2T = createSignal(0);
  const packet2Opacity = createSignal(0);

  const leakPhase = createSignal(0);
  const leak0 = createSignal(0);
  const leak1 = createSignal(0);
  const leak2 = createSignal(0);
  const leakRiskOut = createSignal(0);
  const leakKey0 = '  "internalStatus": ';
  const leakKey1 = '  "fraudReason": ';
  const leakKey2 = '  "stripeId": ';

  const clientDtoOpacity = createSignal(0);
  const webhookDtoOpacity = createSignal(0);
  const clientDtoValuesOpacity = createSignal(0);
  const webhookDtoValuesOpacity = createSignal(0);
  const splitDtoHi = createSignal(0);
  const splitDtoHiOn = createSignal(0);
  const rightPortYellow = createSignal(0);
  const splitDtoY = createSignal(0);
  const endZoom = createSignal(0);
  const endDark = createSignal(0);

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
  const strokeW = 0;
  const leftStroke = inkRgba;
  const midStroke = inkRgba;
  const rightStroke = inkRgba;

  const leftFill = inkRgba;
  const midFill = inkRgba;
  const rightFill = inkRgba;

  const whiteText = S.colors.card;

  const wireStroke = 'rgba(21,21,21,0.55)';
  const portBlue = slateBlueRgba;
  const pathFill = S.colors.blue;
  const focusPink = S.colors.accent;
  const focusPinkUnderlay = S.colors.accentSubtle;
  const transportAccent = S.colors.transport;
  const dotAlpha = 0.78;
  const dimOthers = () => 1 - shadowOthers() * 0.78;
  const leakDim = () => 1 - leakPhase() * 0.92;
  const focusW = (k: number) => Math.max(0, 1 - Math.abs(focusX() - k));
  const splitDtoW = (k: number) => Math.max(0, 1 - Math.abs(splitDtoHi() - k));
  const dimRiskOthers = () => 1 - focusRisk() * 0.9 * riskDimEnabled();
  const dangerRed = 'rgba(255,0,0,1)';
  const endZoomK = () => 1 + endZoom() * 28;
  const parseRgba = (s: string) => {
    const raw = String(s ?? '').trim();
    const t = raw.replace(/\s+/g, '');

    if (t.startsWith('#')) {
      const hex = t.slice(1);
      if (hex.length === 3) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        return {r, g, b, a: 1};
      }
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return {r, g, b, a: 1};
      }
    }

    const rgb = t.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
    if (rgb) return {r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: 1};

    const rgba = t.match(/^rgba\((\d+),(\d+),(\d+),([0-9.]+)\)$/);
    if (rgba) return {r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]), a: Number(rgba[4])};

    return {r: 255, g: 255, b: 255, a: 1};
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
  const serviceFontSize = OpenText.service.fontSize;
  const serviceFontWeight = OpenText.service.fontWeight;
  const serviceLetterSpacing = OpenText.service.letterSpacing;
  const midServiceFontSize = OpenText.serviceMid.fontSize;
  const midServiceLetterSpacing = OpenText.serviceMid.letterSpacing;
  const portDotSize = OpenShapes.dots.port * 1.35;
  const packetDotSize = portDotSize * 0.82;

  const dtoText = S.colors.ink;
  const dtoBlue = S.colors.blue;

  const codeStyle = {
    fontSize: OpenText.code.fontSize,
    lineHeight: OpenText.code.lineHeight,
    width: 600,
    fontWeight: OpenText.code.fontWeight,
  } as const;
  const codeTopY = -450 + sceneShiftY;
  const dtoValueFill = transportAccent;
  const dtoKeyFill = S.colors.ink;

  const dtoHeaderType = 'PaymentDto';
  const dtoHeaderRest = ' {';
  const dtoBodyKeyLines = [' id:', ' amount:', ' currency:', ' status:', ' updatedAt:', '}'];
  const dtoKeyLinesSig = createSignal(dtoBodyKeyLines.join('\n'));

  const dtoBodyValueLines = ['"550e8400-e29b-41d4-a716-446655440000"', '99.00', '"USD"', '"CAPTURED"', '"2024-12-15T14:32:00Z"', ''];

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

  const codeCardShrinkW = 100;
  const codeCardBaseW = 520;
  const codeBorderStroke = borderRgba;
  const dtoBorderStroke = () => mixRgba(borderRgba, slateBlueRgba, dtoPulse());
  const codeBorderWidth = OpenShapes.stroke.card;
  const codeBorderRadius = OpenShapes.radius.card;
  const codeBorderPadX = OpenShapes.padding.cardX;
  const codeBorderPadY = OpenShapes.padding.cardY;
  const dtoBorderWidth = OpenShapes.stroke.card;
  const cardShadowColor = OpenShapes.shadow.color;
  const cardShadowBlur = OpenShapes.shadow.blur;
  const cardShadowOffset = OpenShapes.shadow.offset;
  const dtoLineCount = 1 + dtoBodyKeyLines.length;
  const dtoTextW = Math.max(0, Math.min(codeStyle.width, codeCardBaseW - codeCardShrinkW));
  const dtoBoxW = dtoTextW + codeBorderPadX * 2;
  const dtoBoxHBase = dtoLineCount * codeStyle.lineHeight + codeBorderPadY * 2;
  const dtoBoxH = () => dtoBoxHBase + dtoExtraLines() * codeStyle.lineHeight;
  const dtoBoxX = c[0] - dtoBoxW / 2;
  const dtoBoxY = codeTopY - codeBorderPadY;
  const dtoCodeX = dtoBoxX + codeBorderPadX;
  const dtoHeaderRestX = dtoCodeX + textWidth(dtoHeaderType, Fonts.code, codeStyle.fontSize, codeStyle.fontWeight);

  const solutionYellow = '#D4A04A';
  const splitDtoGap = 32;
  const splitDtoBoxW = Math.min(dtoBoxW, (safeW - splitDtoGap) / 2);
  const splitDtoLeftX = c[0] - splitDtoGap / 2 - splitDtoBoxW;
  const splitDtoRightX = c[0] + splitDtoGap / 2;
  const splitDtoStartY = dtoBoxY;
  splitDtoY(splitDtoStartY);

  const clientDtoHeaderType = 'ClientDto';
  const clientDtoBodyKeyLines = [' id:', ' amount:', ' currency:', ' status:', '}'];
  
  const webhookDtoHeaderType = 'WebhookDto';
  const webhookDtoBodyKeyLinesNoUpdatedAt = [' id:', ' amount:', ' currency:', ' status:', '}'];
  const webhookDtoBodyKeyLinesWithUpdatedAt = [' id:', ' amount:', ' currency:', ' status:', ' updatedAt:', '}'];
  const webhookDtoBodyKeyLinesWithRisk = [
    ...webhookDtoBodyKeyLinesWithUpdatedAt.slice(0, -1),
    ' riskScore:',
    webhookDtoBodyKeyLinesWithUpdatedAt[webhookDtoBodyKeyLinesWithUpdatedAt.length - 1],
  ];
  
  const clientDtoBoxX = splitDtoLeftX;
  const clientDtoBoxY = () => splitDtoY();
  const clientDtoCodeX = clientDtoBoxX + codeBorderPadX;
  const clientDtoHeaderY = () => clientDtoBoxY() + codeBorderPadY;
  const clientDtoBodyY = () => clientDtoHeaderY() + codeStyle.lineHeight;
  const clientDtoHeaderRestX =
    clientDtoCodeX + textWidth(clientDtoHeaderType, Fonts.code, codeStyle.fontSize, codeStyle.fontWeight);

  const webhookDtoBoxX = splitDtoRightX;
  const webhookDtoBoxY = () => splitDtoY();
  const webhookDtoCodeX = webhookDtoBoxX + codeBorderPadX;
  const webhookDtoHeaderY = () => webhookDtoBoxY() + codeBorderPadY;
  const webhookDtoBodyY = () => webhookDtoHeaderY() + codeStyle.lineHeight;
  const webhookDtoHeaderRestX =
    webhookDtoCodeX + textWidth(webhookDtoHeaderType, Fonts.code, codeStyle.fontSize, codeStyle.fontWeight);

  const calcDx = (keyLines: string[]) =>
    Math.max(
      ...keyLines.map(l => {
        const norm = l.replace(/\s+/g, ' ');
        const idx = norm.indexOf(':');
        if (idx < 0) return 0;
        const prefix = norm.slice(0, idx + 2);
        return textWidth(prefix, Fonts.code, codeStyle.fontSize, codeStyle.fontWeight);
      }),
    ) + 25;

  const clientDtoValuesDx = calcDx(clientDtoBodyKeyLines);
  const webhookDtoValuesDx = Math.max(
    calcDx(webhookDtoBodyKeyLinesNoUpdatedAt),
    calcDx(webhookDtoBodyKeyLinesWithUpdatedAt),
    calcDx(webhookDtoBodyKeyLinesWithRisk),
  );

  const clientDtoKeysSig = createSignal(clientDtoBodyKeyLines.join('\n'));
  const clientDtoValuesSig = createSignal(['', '', '', '', ''].join('\n'));
  const webhookDtoKeysSig = createSignal(webhookDtoBodyKeyLinesNoUpdatedAt.join('\n'));
  const webhookDtoValuesSig = createSignal(['', '', '', '', '', '', ''].join('\n'));

  const stripeJson = `{
  "id": "550e8400-e29b-41d4-a716-446655440000",
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
  const stripeJsonBlankKeysSig = createSignal(stripeJsonValueLines.map(() => '').join('\n'));

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

  const leftPort: Point = [leftWireEndX, c[1]];
  const rightPort: Point = [rightWireEndX, c[1]];

  const packetStart: Point = [rightWireStartX, rightWireY];
  const packetEnd: Point = [rightWireEndX, rightWireY];
  const packetX = () => packetStart[0] + (packetEnd[0] - packetStart[0]) * packetT();
  const packetY = () => packetStart[1] + (packetEnd[1] - packetStart[1]) * packetT();

  const packet2Start: Point = [leftWireEndX, leftWireY];
  const packet2End: Point = [leftWireStartX, leftWireY];
  const packet2X = () => packet2Start[0] + (packet2End[0] - packet2Start[0]) * packet2T();
  const packet2Y = () => packet2Start[1] + (packet2End[1] - packet2Start[1]) * packet2T();

  const clientJson = `{
  "id": "550e8400-e29b-41d4-a716-446655440000",
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
  const clientJsonBlankKeysSig = createSignal(clientJsonValueLines.map(() => '').join('\n'));
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

  const leakDx0 = textWidth(leakKey0, Fonts.code, codeStyle.fontSize, 600);
  const leakDx1 = textWidth(leakKey1, Fonts.code, codeStyle.fontSize, 600);
  const leakDx2 = textWidth(leakKey2, Fonts.code, codeStyle.fontSize, 600);

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const makeCycleData = (i: number) => {
    const head = ((0x550e8400 + i * 0x11111) >>> 0).toString(16).padStart(8, '0');
    const id = `${head}-e29b-41d4-a716-446655440000`;
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

  const reserveClientLeakRow = (d: {id: string; amount: string; status: string}) => {
    const clientKeys = [...clientJsonKeyLines.slice(0, -1), '', clientJsonKeyLines[clientJsonKeyLines.length - 1]];
    clientJsonKeysTextSig(clientKeys.join('\n'));
    clientJsonValuesTextSig(['', `"${d.id}",`, `${d.amount},`, `"USD",`, `"${d.status}",`, '', ''].join('\n'));
  };

  const clearRiskScoreText = (d: {id: string; amount: string; status: string; updatedAt: string}) => {
    const stripeKeys = [...stripeJsonKeyLines.slice(0, -1), '', stripeJsonKeyLines[stripeJsonKeyLines.length - 1]];
    stripeJsonKeysTextSig(stripeKeys.join('\n'));
    stripeJsonValuesTextSig(['', `"${d.id}",`, `${d.amount},`, `"USD",`, `"${d.status}",`, `"${d.updatedAt}"`, '', ''].join('\n'));
    
    dtoKeyLinesSig([...dtoBodyKeyLines.slice(0, -1), '', dtoBodyKeyLines[dtoBodyKeyLines.length - 1]].join('\n'));
    dtoValuesText([`"${d.id}"`, d.amount, `"USD"`, `"${d.status}"`, `"${d.updatedAt}"`, '', ''].join('\n'));
    
    const clientKeys = [...clientJsonKeyLines.slice(0, -1), '', clientJsonKeyLines[clientJsonKeyLines.length - 1]];
    clientJsonKeysTextSig(clientKeys.join('\n'));
    clientJsonValuesTextSig(['', `"${d.id}",`, `${d.amount},`, `"USD",`, `"${d.status}",`, '', ''].join('\n'));
  };

  view.add(
    <>
      <Rect width={Screen.width} height={Screen.height} fill={() => mixRgba(S.colors.bg, '#0B0B0B', endDark())} />
      <Rect>
        <Line
          points={[
            [leftWireStartX, leftWireY],
            [leftWireEndX, leftWireY],
          ]}
          stroke={wireStroke}
          lineWidth={OpenShapes.stroke.connector * 1.0}
          lineCap="round"
          opacity={() => leftOpacity() * wiresOpacity() * dimOthers() * dimRiskOthers() * leakDim()}
        />

        <Circle
          x={leftC[0]}
          y={leftC[1]}
          width={leftR * 2}
          height={leftR * 2}
          fill={() => mixRgba(leftFill, dangerRed, clientCircleRed())}
          stroke={transparent}
          lineWidth={0}
          opacity={() => leftOpacity() * dimOthers() * dimRiskOthers() * leakDim()}
        />
        <Circle
          x={leftC[0]}
          y={leftC[1]}
          width={leftR * 2 + 40}
          height={leftR * 2 + 40}
          fill={'rgba(0,0,0,0)'}
          stroke={dangerRed}
          lineWidth={18}
          opacity={() => leftOpacity() * dimOthers() * dimRiskOthers() * clientCircleRed() * 0.22 * leakDim()}
        />
        <Txt
          x={leftC[0]}
          y={leftC[1] - 5}
          text={'CLIENT'}
          fontFamily={S.fonts.sans}
          fontSize={serviceFontSize}
          fontWeight={serviceFontWeight}
          letterSpacing={serviceLetterSpacing}
          fill={whiteText}
          opacity={() => leftOpacity() * dimOthers() * dimRiskOthers() * leakDim()}
        />

        <Circle
          x={c[0]}
          y={c[1]}
          width={() => midR * 2 * endZoomK()}
          height={() => midR * 2 * endZoomK()}
          fill={() => mixRgba(midFill, '#0B0B0B', endDark())}
          stroke={transparent}
          lineWidth={0}
          opacity={() => midOpacity() * dimRiskOthers() * leakDim()}
        />
        <Circle
          x={leftPort[0]}
          y={leftPort[1]}
          width={portDotSize}
          height={portDotSize}
          fill={portBlue}
          opacity={() =>
            midOpacity() *
            leftPortOpacity() *
            dimRiskOthers() *
            (dotAlpha + dtoPulse() * (1 - dotAlpha)) *
            leakDim()
          }
        />
        <Circle
          x={rightPort[0]}
          y={rightPort[1]}
          width={portDotSize}
          height={portDotSize}
          fill={() => mixRgba(portBlue, solutionYellow, rightPortYellow())}
          opacity={() =>
            midOpacity() *
            rightPortOpacity() *
            dimRiskOthers() *
            (dotAlpha + dtoPulse() * (1 - dotAlpha)) *
            leakDim()
          }
        />
        <Txt
          x={c[0]}
          y={c[1] - 6}
          text={'PAYMENT-SERVICE'}
          fontFamily={S.fonts.sans}
          fontSize={midServiceFontSize}
          fontWeight={serviceFontWeight}
          letterSpacing={midServiceLetterSpacing}
          fill={whiteText}
          opacity={() => midOpacity() * dimRiskOthers() * leakDim() * (1 - endZoom())}
        />

        <Line
          points={[
            [rightWireStartX, rightWireY],
            [rightWireEndX, rightWireY],
          ]}
          stroke={wireStroke}
          lineWidth={OpenShapes.stroke.connector * 1.0}
          lineCap="round"
          opacity={() => rightOpacity() * wiresOpacity() * dimOthers() * dimRiskOthers() * leakDim()}
        />

        <Rect
          x={(leftWireStartX + leftWireEndX) / 2}
          y={leftWireY - OpenShapes.spacing.endpointY}
          layout
          direction={'row'}
          alignItems={'center'}
          gap={OpenShapes.spacing.labelGap}
          opacity={() => wiresOpacity() * leftOpacity() * dimOthers() * dimRiskOthers() * leakDim()}
        >
          <Txt
            text={'GET'}
            fontFamily={S.fonts.mono}
            fontSize={OpenText.endpointVerb.fontSize}
            fontWeight={OpenText.endpointVerb.fontWeight}
            letterSpacing={OpenText.endpointVerb.letterSpacing}
            fill={mutedRgba}
          />
          <Txt
            text={'/payments/{id}'}
            fontFamily={S.fonts.mono}
            fontSize={OpenText.endpointPath.fontSize}
            fontWeight={OpenText.endpointPath.fontWeight}
            letterSpacing={OpenText.endpointPath.letterSpacing}
            fill={pathFill}
          />
        </Rect>

        <Rect
          x={(rightWireStartX + rightWireEndX) / 2}
          y={rightWireY - OpenShapes.spacing.endpointY}
          layout
          direction={'row'}
          alignItems={'center'}
          gap={OpenShapes.spacing.labelGap}
          opacity={() => wiresOpacity() * rightOpacity() * dimOthers() * dimRiskOthers() * leakDim()}
        >
          <Txt
            text={'POST'}
            fontFamily={S.fonts.mono}
            fontSize={OpenText.endpointVerb.fontSize}
            fontWeight={OpenText.endpointVerb.fontWeight}
            letterSpacing={OpenText.endpointVerb.letterSpacing}
            fill={mutedRgba}
          />
          <Txt
            text={'/webhooks/payment'}
            fontFamily={S.fonts.mono}
            fontSize={OpenText.endpointPath.fontSize}
            fontWeight={OpenText.endpointPath.fontWeight}
            letterSpacing={OpenText.endpointPath.letterSpacing}
            fill={pathFill}
          />
        </Rect>

        <Circle
          x={rightC[0]}
          y={rightC[1]}
          width={rightR * 2}
          height={rightR * 2}
          fill={rightFill}
          stroke={transparent}
          lineWidth={0}
          opacity={() => rightOpacity() * dimOthers() * dimRiskOthers() * leakDim()}
        />
        <Txt
          x={rightC[0]}
          y={rightC[1] - 5}
          text={'STRIPE'}
          fontFamily={S.fonts.sans}
          fontSize={serviceFontSize}
          fontWeight={serviceFontWeight}
          letterSpacing={serviceLetterSpacing}
          fill={whiteText}
          opacity={() => rightOpacity() * dimOthers() * dimRiskOthers() * leakDim()}
        />
      </Rect>

      <Rect
        x={dtoBoxX}
        y={dtoBoxY}
        width={dtoBoxW}
        height={dtoBoxH}
        radius={codeBorderRadius}
        fill={S.colors.card}
        stroke={dtoBorderStroke}
        lineWidth={dtoBorderWidth}
        shadowColor={cardShadowColor}
        shadowBlur={cardShadowBlur}
        shadowOffset={cardShadowOffset}
        offset={[-1, -1]}
        opacity={() => midOpacity() * dtoObjectOpacity() * dimRiskOthers() * leakDim()}
      />
      <Txt
        x={dtoCodeX}
        y={dtoHeaderY}
        text={dtoHeaderType}
        fontFamily={S.fonts.mono}
        fontSize={codeStyle.fontSize}
        fontWeight={codeStyle.fontWeight}
        lineHeight={codeStyle.lineHeight}
        fill={dtoBlue}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={() => midOpacity() * dtoObjectOpacity() * dimRiskOthers() * leakDim()}
      />
      <Txt
        x={dtoHeaderRestX}
        y={dtoHeaderY}
        text={dtoHeaderRest}
        fontFamily={S.fonts.mono}
        fontSize={codeStyle.fontSize}
        fontWeight={codeStyle.fontWeight}
        lineHeight={codeStyle.lineHeight}
        fill={dtoKeyFill}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={() => midOpacity() * dtoObjectOpacity() * dimRiskOthers() * leakDim()}
      />

      <CodeBlockWithOverlay
        x={dtoCodeX}
        y={dtoBodyY}
        style={{...codeStyle, width: dtoTextW}}
        keysText={dtoKeyLinesSig}
        valuesText={dtoValuesText}
        keysFill={dtoKeyFill}
        valuesFill={dtoValueFill}
        opacity={() => midOpacity() * dtoObjectOpacity() * dimRiskOthers() * leakDim()}
        valuesOpacity={dtoValuesOpacity}
        valuesDx={dtoValuesDx}
        ellipsis
        ellipsisText={'...'}
        maxWidthPx={dtoTextW}
        keysRef={dtoKeysRef}
        valuesRef={dtoValuesRef}
      />

      <Rect
        x={clientDtoBoxX}
        y={clientDtoBoxY}
        width={splitDtoBoxW}
        height={dtoBoxH}
        radius={codeBorderRadius}
        fill={S.colors.card}
        stroke={borderRgba}
        lineWidth={dtoBorderWidth}
        shadowColor={cardShadowColor}
        shadowBlur={cardShadowBlur}
        shadowOffset={cardShadowOffset}
        offset={[-1, -1]}
        opacity={clientDtoOpacity}
      />
      <Txt
        x={clientDtoCodeX}
        y={clientDtoHeaderY}
        text={clientDtoHeaderType}
        fontFamily={S.fonts.mono}
        fontSize={codeStyle.fontSize}
        fontWeight={codeStyle.fontWeight}
        lineHeight={codeStyle.lineHeight}
        fill={dtoBlue}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={clientDtoOpacity}
      />
      <Txt
        x={clientDtoHeaderRestX}
        y={clientDtoHeaderY}
        text={dtoHeaderRest}
        fontFamily={S.fonts.mono}
        fontSize={codeStyle.fontSize}
        fontWeight={codeStyle.fontWeight}
        lineHeight={codeStyle.lineHeight}
        fill={dtoKeyFill}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={clientDtoOpacity}
      />
      <Rect
        x={() => clientDtoCodeX - 10}
        y={() => clientDtoBodyY() + codeStyle.lineHeight * 0 - 2}
        width={() => splitDtoBoxW - codeBorderPadX * 2 + 20}
        height={() => codeStyle.lineHeight + 4}
        radius={10}
        fill={focusPinkUnderlay}
        offset={[-1, -1]}
        opacity={() => splitDtoHiOn() * splitDtoW(0) * clientDtoOpacity()}
      />
      <Rect
        x={() => clientDtoCodeX - 10}
        y={() => clientDtoBodyY() + codeStyle.lineHeight * 1 - 2}
        width={() => splitDtoBoxW - codeBorderPadX * 2 + 20}
        height={() => codeStyle.lineHeight + 4}
        radius={10}
        fill={focusPinkUnderlay}
        offset={[-1, -1]}
        opacity={() => splitDtoHiOn() * splitDtoW(1) * clientDtoOpacity()}
      />
      <Rect
        x={() => clientDtoCodeX - 10}
        y={() => clientDtoBodyY() + codeStyle.lineHeight * 2 - 2}
        width={() => splitDtoBoxW - codeBorderPadX * 2 + 20}
        height={() => codeStyle.lineHeight + 4}
        radius={10}
        fill={focusPinkUnderlay}
        offset={[-1, -1]}
        opacity={() => splitDtoHiOn() * splitDtoW(2) * clientDtoOpacity()}
      />
      <Rect
        x={() => clientDtoCodeX - 10}
        y={() => clientDtoBodyY() + codeStyle.lineHeight * 3 - 2}
        width={() => splitDtoBoxW - codeBorderPadX * 2 + 20}
        height={() => codeStyle.lineHeight + 4}
        radius={10}
        fill={focusPinkUnderlay}
        offset={[-1, -1]}
        opacity={() => splitDtoHiOn() * splitDtoW(3) * clientDtoOpacity()}
      />
      <CodeBlockWithOverlay
        x={clientDtoCodeX}
        y={clientDtoBodyY}
        style={{...codeStyle, width: splitDtoBoxW - codeBorderPadX * 2}}
        keysText={clientDtoKeysSig}
        valuesText={clientDtoValuesSig}
        keysFill={dtoKeyFill}
        valuesFill={dtoValueFill}
        opacity={clientDtoOpacity}
        valuesOpacity={clientDtoValuesOpacity}
        valuesDx={clientDtoValuesDx}
        ellipsis
        ellipsisText={'...'}
        maxWidthPx={splitDtoBoxW - codeBorderPadX * 2}
      />

      <Rect
        x={webhookDtoBoxX}
        y={webhookDtoBoxY}
        width={splitDtoBoxW}
        height={() => (1 + webhookDtoBodyKeyLinesWithRisk.length) * codeStyle.lineHeight + codeBorderPadY * 2}
        radius={codeBorderRadius}
        fill={S.colors.card}
        stroke={borderRgba}
        lineWidth={dtoBorderWidth}
        shadowColor={cardShadowColor}
        shadowBlur={cardShadowBlur}
        shadowOffset={cardShadowOffset}
        offset={[-1, -1]}
        opacity={webhookDtoOpacity}
      />
      <Txt
        x={webhookDtoCodeX}
        y={webhookDtoHeaderY}
        text={webhookDtoHeaderType}
        fontFamily={S.fonts.mono}
        fontSize={codeStyle.fontSize}
        fontWeight={codeStyle.fontWeight}
        lineHeight={codeStyle.lineHeight}
        fill={solutionYellow}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={webhookDtoOpacity}
      />
      <Txt
        x={webhookDtoHeaderRestX}
        y={webhookDtoHeaderY}
        text={dtoHeaderRest}
        fontFamily={S.fonts.mono}
        fontSize={codeStyle.fontSize}
        fontWeight={codeStyle.fontWeight}
        lineHeight={codeStyle.lineHeight}
        fill={dtoKeyFill}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={webhookDtoOpacity}
      />
      <Rect
        x={() => webhookDtoCodeX - 10}
        y={() => webhookDtoBodyY() + codeStyle.lineHeight * 0 - 2}
        width={() => splitDtoBoxW - codeBorderPadX * 2 + 20}
        height={() => codeStyle.lineHeight + 4}
        radius={10}
        fill={focusPinkUnderlay}
        offset={[-1, -1]}
        opacity={() => splitDtoHiOn() * splitDtoW(0) * webhookDtoOpacity()}
      />
      <Rect
        x={() => webhookDtoCodeX - 10}
        y={() => webhookDtoBodyY() + codeStyle.lineHeight * 1 - 2}
        width={() => splitDtoBoxW - codeBorderPadX * 2 + 20}
        height={() => codeStyle.lineHeight + 4}
        radius={10}
        fill={focusPinkUnderlay}
        offset={[-1, -1]}
        opacity={() => splitDtoHiOn() * splitDtoW(1) * webhookDtoOpacity()}
      />
      <Rect
        x={() => webhookDtoCodeX - 10}
        y={() => webhookDtoBodyY() + codeStyle.lineHeight * 2 - 2}
        width={() => splitDtoBoxW - codeBorderPadX * 2 + 20}
        height={() => codeStyle.lineHeight + 4}
        radius={10}
        fill={focusPinkUnderlay}
        offset={[-1, -1]}
        opacity={() => splitDtoHiOn() * splitDtoW(2) * webhookDtoOpacity()}
      />
      <Rect
        x={() => webhookDtoCodeX - 10}
        y={() => webhookDtoBodyY() + codeStyle.lineHeight * 3 - 2}
        width={() => splitDtoBoxW - codeBorderPadX * 2 + 20}
        height={() => codeStyle.lineHeight + 4}
        radius={10}
        fill={focusPinkUnderlay}
        offset={[-1, -1]}
        opacity={() => splitDtoHiOn() * splitDtoW(3) * webhookDtoOpacity()}
      />
      <CodeBlockWithOverlay
        x={webhookDtoCodeX}
        y={webhookDtoBodyY}
        style={{...codeStyle, width: splitDtoBoxW - codeBorderPadX * 2}}
        keysText={webhookDtoKeysSig}
        valuesText={webhookDtoValuesSig}
        keysFill={dtoKeyFill}
        valuesFill={dtoValueFill}
        opacity={webhookDtoOpacity}
        valuesOpacity={webhookDtoValuesOpacity}
        valuesDx={webhookDtoValuesDx}
        ellipsis
        ellipsisText={'...'}
        maxWidthPx={splitDtoBoxW - codeBorderPadX * 2}
      />

      <Rect
        x={jsonBoxX}
        y={jsonBoxY}
        width={jsonBoxW}
        height={jsonBoxH}
        radius={codeBorderRadius}
        fill={S.colors.card}
        stroke={codeBorderStroke}
        lineWidth={codeBorderWidth}
        shadowColor={cardShadowColor}
        shadowBlur={cardShadowBlur}
        shadowOffset={cardShadowOffset}
        offset={[-1, -1]}
        opacity={() => stripeJsonOpacity() * dimOthers() * dimRiskOthers() * leakDim()}
      />

      <CodeBlockWithOverlay
        x={stripeJsonX}
        y={stripeJsonY}
        style={{...codeStyle, fontWeight: 600, width: jsonTextW}}
        keysText={stripeJsonKeysTextSig}
        valuesText={stripeJsonValuesTextSig}
        keysFill={S.colors.ink}
        valuesFill={mutedRgba}
        opacity={() => stripeJsonOpacity() * dimOthers() * dimRiskOthers() * leakDim()}
        valuesOpacity={stripeJsonBaseValuesOpacity}
        valuesDx={stripeJsonValuesDx}
        ellipsis
        ellipsisText={'...'}
        maxWidthPx={jsonAvailW}
        keysRef={stripeJsonRef}
        valuesRef={stripeJsonValuesRef}
      />

      <CodeBlockWithOverlay
        x={stripeJsonX}
        y={stripeJsonY}
        style={{...codeStyle, fontWeight: 600, width: jsonTextW}}
        keysText={stripeJsonBlankKeysSig}
        valuesText={stripeJsonValuesTextSig}
        keysFill={transparent}
        valuesFill={transportAccent}
        opacity={() => stripeJsonOpacity() * dimOthers() * dimRiskOthers() * leakDim()}
        valuesOpacity={stripeJsonValuesOpacity}
        valuesDx={stripeJsonValuesDx}
        ellipsis
        ellipsisText={'...'}
        maxWidthPx={jsonAvailW}
      />

      <Circle
        x={packetX}
        y={packetY}
        width={packetDotSize}
        height={packetDotSize}
        fill={transportAccent}
        opacity={() => packetOpacity() * dimRiskOthers() * dotAlpha * leakDim()}
      />

      <Rect
        x={clientJsonBoxX}
        y={clientJsonBoxY}
        width={clientJsonBoxW}
        height={clientJsonBoxH}
        radius={codeBorderRadius}
        fill={S.colors.card}
        stroke={codeBorderStroke}
        lineWidth={codeBorderWidth}
        shadowColor={cardShadowColor}
        shadowBlur={cardShadowBlur}
        shadowOffset={cardShadowOffset}
        offset={[-1, -1]}
        opacity={() => clientJsonOpacity() * dimOthers() * dimRiskOthers()}
      />

      <CodeBlockWithOverlay
        x={clientJsonX}
        y={clientJsonY}
        style={{...codeStyle, fontWeight: 600, width: clientJsonAvailW}}
        keysText={clientJsonKeysTextSig}
        valuesText={clientJsonValuesTextSig}
        keysFill={S.colors.ink}
        valuesFill={mutedRgba}
        opacity={() => clientJsonOpacity() * dimOthers() * dimRiskOthers()}
        valuesOpacity={clientJsonBaseValuesOpacity}
        valuesDx={clientJsonValuesDx}
        ellipsis
        ellipsisText={'...'}
        maxWidthPx={clientJsonAvailW}
        keysRef={clientJsonRef}
        valuesRef={clientJsonValuesRef}
      />

      <CodeBlockWithOverlay
        x={clientJsonX}
        y={clientJsonY}
        style={{...codeStyle, fontWeight: 600, width: clientJsonAvailW}}
        keysText={clientJsonBlankKeysSig}
        valuesText={clientJsonValuesTextSig}
        keysFill={transparent}
        valuesFill={transportAccent}
        opacity={() => clientJsonOpacity() * dimOthers() * dimRiskOthers()}
        valuesOpacity={clientJsonValuesOpacity}
        valuesDx={clientJsonValuesDx}
        ellipsis
        ellipsisText={'...'}
        maxWidthPx={clientJsonAvailW}
      />

      <Circle
        x={packet2X}
        y={packet2Y}
        width={packetDotSize}
        height={packetDotSize}
        fill={transportAccent}
        opacity={() => packet2Opacity() * dimRiskOthers() * dotAlpha * leakDim()}
      />

      <Rect
        x={() => stripeJsonX - 10}
        y={() => stripeJsonY + codeStyle.lineHeight * 6 - 2}
        width={() => jsonTextW + 20}
        height={() => codeStyle.lineHeight + 4}
        radius={10}
        fill={focusPinkUnderlay}
        offset={[-1, -1]}
        opacity={() => focusRisk() * focusW(0) * leakDim()}
      />
      <Txt
        x={stripeJsonX}
        y={() => stripeJsonY + codeStyle.lineHeight * 6}
        width={jsonTextW}
        text={'  "riskScore": '}
        fontFamily={S.fonts.mono}
        fontSize={codeStyle.fontSize}
        fontWeight={650}
        lineHeight={codeStyle.lineHeight}
        fill={S.colors.ink}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={() => focusRisk() * focusW(0) * leakDim()}
      />
      <Txt
        x={() => stripeJsonX + stripeJsonValuesDx}
        y={() => stripeJsonY + codeStyle.lineHeight * 6}
        width={jsonTextW}
        text={riskScoreSig}
        fontFamily={S.fonts.mono}
        fontSize={codeStyle.fontSize}
        fontWeight={650}
        lineHeight={codeStyle.lineHeight}
        fill={S.colors.ink}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={() => focusRisk() * focusW(0) * leakDim()}
      />


      <Rect
        x={() => dtoCodeX - 10}
        y={() => dtoBodyY + codeStyle.lineHeight * 5 - 2}
        width={() => dtoTextW + 20}
        height={() => codeStyle.lineHeight + 4}
        radius={10}
        fill={focusPinkUnderlay}
        offset={[-1, -1]}
        opacity={() => focusRisk() * focusW(1) * leakDim()}
      />
      <Txt
        x={dtoCodeX}
        y={() => dtoBodyY + codeStyle.lineHeight * 5}
        width={dtoTextW}
        text={' riskScore:'}
        fontFamily={S.fonts.mono}
        fontSize={codeStyle.fontSize}
        fontWeight={650}
        lineHeight={codeStyle.lineHeight}
        fill={dtoKeyFill}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={() => focusRisk() * focusW(1) * leakDim()}
      />
      <Txt
        x={() => dtoCodeX + dtoValuesDxRisk}
        y={() => dtoBodyY + codeStyle.lineHeight * 5}
        width={dtoTextW}
        text={riskScoreSig}
        fontFamily={S.fonts.mono}
        fontSize={codeStyle.fontSize}
        fontWeight={650}
        lineHeight={codeStyle.lineHeight}
        fill={S.colors.ink}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={() => 0}
      />


      <Rect
        x={() => clientJsonX - 10}
        y={() => clientJsonY + codeStyle.lineHeight * 5 - 2}
        width={() => clientJsonAvailW + 20}
        height={() => codeStyle.lineHeight + 4}
        radius={10}
        fill={focusPinkUnderlay}
        offset={[-1, -1]}
        opacity={() => focusRisk() * focusW(2)}
      />
      <Txt
        x={clientJsonX}
        y={() => clientJsonY + codeStyle.lineHeight * 5}
        width={clientJsonAvailW}
        text={'  "riskScore": '}
        fontFamily={S.fonts.mono}
        fontSize={codeStyle.fontSize}
        fontWeight={650}
        lineHeight={codeStyle.lineHeight}
        fill={S.colors.ink}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={() => focusRisk() * focusW(2)}
      />
      <Txt
        x={() => clientJsonX + clientJsonValuesDx}
        y={() => clientJsonY + codeStyle.lineHeight * 5}
        width={clientJsonAvailW}
        text={riskScoreSig}
        fontFamily={S.fonts.mono}
        fontSize={codeStyle.fontSize}
        fontWeight={650}
        lineHeight={codeStyle.lineHeight}
        fill={S.colors.ink}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={() => focusRisk() * focusW(2)}
      />

      <Rect
        x={() => clientJsonX - 10}
        y={() => clientJsonY + codeStyle.lineHeight * 5 - 2}
        width={() => clientJsonAvailW + 20}
        height={() => codeStyle.lineHeight + 4}
        radius={10}
        fill={S.colors.card}
        offset={[-1, -1]}
        opacity={leakRiskOut}
      />

      {/* Sensitive field 0: internalStatus */}
      <Rect
        x={() => clientJsonX - 10}
        y={() => clientJsonY + codeStyle.lineHeight * 5 - 2}
        width={() => clientJsonAvailW + 20}
        height={() => codeStyle.lineHeight + 4}
        radius={10}
        fill={S.colors.card}
        offset={[-1, -1]}
        opacity={leak0}
      />
      <Rect
        x={() => clientJsonX - 10}
        y={() => clientJsonY + codeStyle.lineHeight * 5 - 2}
        width={() => clientJsonAvailW + 20}
        height={() => codeStyle.lineHeight + 4}
        radius={10}
        fill={'rgba(255,80,80,0.18)'}
        offset={[-1, -1]}
        opacity={leak0}
      />
      <Txt
        x={clientJsonX}
        y={() => clientJsonY + codeStyle.lineHeight * 5}
        width={clientJsonAvailW}
        text={leakKey0}
        fontFamily={S.fonts.mono}
        fontSize={codeStyle.fontSize}
        fontWeight={650}
        lineHeight={codeStyle.lineHeight}
        fill={S.colors.ink}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={leak0}
      />
      <Txt
        x={() => clientJsonX + leakDx0}
        y={() => clientJsonY + codeStyle.lineHeight * 5}
        width={clientJsonAvailW}
        text={'"REVIEW"'}
        fontFamily={S.fonts.mono}
        fontSize={codeStyle.fontSize}
        fontWeight={650}
        lineHeight={codeStyle.lineHeight}
        fill={'rgba(200,60,60,1)'}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={leak0}
      />

      {/* Sensitive field 1: fraudReason */}
      <Rect
        x={() => clientJsonX - 10}
        y={() => clientJsonY + codeStyle.lineHeight * 5 - 2}
        width={() => clientJsonAvailW + 20}
        height={() => codeStyle.lineHeight + 4}
        radius={10}
        fill={S.colors.card}
        offset={[-1, -1]}
        opacity={leak1}
      />
      <Rect
        x={() => clientJsonX - 10}
        y={() => clientJsonY + codeStyle.lineHeight * 5 - 2}
        width={() => clientJsonAvailW + 20}
        height={() => codeStyle.lineHeight + 4}
        radius={10}
        fill={'rgba(255,80,80,0.18)'}
        offset={[-1, -1]}
        opacity={leak1}
      />
      <Txt
        x={clientJsonX}
        y={() => clientJsonY + codeStyle.lineHeight * 5}
        width={clientJsonAvailW}
        text={leakKey1}
        fontFamily={S.fonts.mono}
        fontSize={codeStyle.fontSize}
        fontWeight={650}
        lineHeight={codeStyle.lineHeight}
        fill={S.colors.ink}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={leak1}
      />
      <Txt
        x={() => clientJsonX + leakDx1}
        y={() => clientJsonY + codeStyle.lineHeight * 5}
        width={clientJsonAvailW}
        text={'"velocity"'}
        fontFamily={S.fonts.mono}
        fontSize={codeStyle.fontSize}
        fontWeight={650}
        lineHeight={codeStyle.lineHeight}
        fill={'rgba(200,60,60,1)'}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={leak1}
      />

      {/* Sensitive field 2: stripeAccountId */}
      <Rect
        x={() => clientJsonX - 10}
        y={() => clientJsonY + codeStyle.lineHeight * 5 - 2}
        width={() => clientJsonAvailW + 20}
        height={() => codeStyle.lineHeight + 4}
        radius={10}
        fill={S.colors.card}
        offset={[-1, -1]}
        opacity={leak2}
      />
      <Rect
        x={() => clientJsonX - 10}
        y={() => clientJsonY + codeStyle.lineHeight * 5 - 2}
        width={() => clientJsonAvailW + 20}
        height={() => codeStyle.lineHeight + 4}
        radius={10}
        fill={'rgba(255,80,80,0.18)'}
        offset={[-1, -1]}
        opacity={leak2}
      />
      <Txt
        x={clientJsonX}
        y={() => clientJsonY + codeStyle.lineHeight * 5}
        width={clientJsonAvailW}
        text={'  "stripeId": '}
        fontFamily={S.fonts.mono}
        fontSize={codeStyle.fontSize}
        fontWeight={650}
        lineHeight={codeStyle.lineHeight}
        fill={S.colors.ink}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={leak2}
      />
      <Txt
        x={() => clientJsonX + leakDx2}
        y={() => clientJsonY + codeStyle.lineHeight * 5}
        width={clientJsonAvailW}
        text={'"acct_1Pq9u0...'}
        fontFamily={S.fonts.mono}
        fontSize={codeStyle.fontSize}
        fontWeight={650}
        lineHeight={codeStyle.lineHeight}
        fill={'rgba(200,60,60,1)'}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={leak2}
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

  yield* all(
    wiresOpacity(1, 0.9, easeInOutCubic),
    leftPortOpacity(1, 0.9, easeInOutCubic),
    rightPortOpacity(1, 0.9, easeInOutCubic),
  );

  yield* waitFor(0.3);
  yield* all(
    dtoObjectOpacity(1, 1.05, easeInOutCubic),
    shadowOthers(1, 1.05, easeInOutCubic),
  );
  for (let k = 0; k < 3; k++) {
    yield* dtoPulse(1, 0.26, easeInOutCubic);
    yield* waitFor(0.06);
    yield* dtoPulse(0, 0.34, easeInOutCubic);
    yield* waitFor(0.10);
  }
  yield* all(
    shadowOthers(0, 0.6, easeInOutCubic),
    dtoPulse(0, 0.6, easeInOutCubic),
  );
  yield* waitFor(0.35);

  yield* all(stripeJsonOpacity(1, 1.1, easeInOutCubic), clientJsonOpacity(1, 1.1, easeInOutCubic));
  yield* waitFor(0.35);

  packetT(0);
  packetOpacity(0);
  packet2T(0);
  packet2Opacity(0);
  stripeJsonValuesOpacity(0);
  stripeJsonBaseValuesOpacity(0);
  dtoValuesOpacity(0);
  clientJsonValuesOpacity(0);
  clientJsonBaseValuesOpacity(0);

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
    riskDimEnabled(1);
    focusX(0);
    {
      const d = makeCycleData(i + cycleOffset);
      riskScoreSig(d.riskScore);
      setStripePayload(d, isLast);
    }

    packetT(0);
    packetOpacity(0);
    stripeJsonValuesOpacity(0);
    if (i === 0) stripeJsonBaseValuesOpacity(0);
    dtoValuesOpacity(0);
    if (i === 0) clientJsonValuesOpacity(0);
    if (i === 0) clientJsonBaseValuesOpacity(0);
    packet2T(0);
    packet2Opacity(0);

    const isFirst = i === 0;
    stripeJsonBaseValuesOpacity(isFirst ? 0 : 1);
    clientJsonBaseValuesOpacity(isFirst ? 0 : 1);
    const fadeInSoft = isFirst ? Math.max(0.6, fadeIn * 1.9) : fadeIn;
    const preMove = Math.max(0.12, Math.min(0.28, fadeInSoft * 0.6));
    yield* all(
      packetOpacity(1, fadeInSoft, easeInOutCubic),
      stripeJsonValuesOpacity(1, fadeInSoft, easeInOutCubic),
      i > 0 ? clientJsonValuesOpacity(0, fadeInSoft, easeInOutCubic) : waitFor(0),
    );
    yield* waitFor(preMove);

    yield* packetT(0.7, travel * 0.7, linear);
    {
      const d = makeCycleData(i + cycleOffset);
      if (isLast) setDtoPayload(d, true);
      else setDtoPayload(d, false);
    }
    const packetFadeAfter = Math.max(0.06, Math.min(0.12, travel * 0.12));
    yield* all(
      packetT(1, travel * 0.3, linear),
      stripeJsonValuesOpacity(0, travel * 0.3, easeInOutCubic),
      isFirst ? stripeJsonBaseValuesOpacity(1, travel * 0.3, easeInOutCubic) : waitFor(0),
      dtoValuesOpacity(1, travel * 0.3, easeInOutCubic),
    );
    yield* packetOpacity(0, packetFadeAfter, easeInOutCubic);

    yield* waitFor(hold);

    yield* all(packet2Opacity(1, fadeX, easeInOutCubic), dtoValuesOpacity(1, 0));
    yield* packet2T(0.7, travel * 0.7, linear);
    {
      const d = makeCycleData(i + cycleOffset);
      if (isLast) clientJsonExtraLines(1);
      if (isLast) setClientPayload(d, true);
      else setClientPayload(d, false);
    }
    yield* all(
      packet2T(1, travel * 0.3, linear),
      dtoValuesOpacity(0, travel * 0.3, easeInOutCubic),
      clientJsonValuesOpacity(1, travel * 0.3, easeInOutCubic),
    );
    if (isLast) {
      yield* all(
        clientCircleRed(1, 0.55, easeInOutCubic),
        packet2Opacity(0, packetFadeAfter, easeInOutCubic),
        waitFor(1),
      );
      yield* all(
        riskDimEnabled(0.5, 0.35, easeInOutCubic),
        focusRisk(1, 1.15, easeInOutCubic),
      );
      break;
    }

    yield* packet2Opacity(0, packetFadeAfter, easeInOutCubic);

    yield* waitFor(hold);

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

        {
          const d = makeCycleData(i + cycleOffset + j + 1);
          riskScoreSig(d.riskScore);
          setStripePayload(d, false);
        }

        packetT(0);
        packetOpacity(0);
        stripeJsonValuesOpacity(0);
        dtoValuesOpacity(0);
        if (j === 0) clientJsonValuesOpacity(0);
        packet2T(0);
        packet2Opacity(0);

        yield* all(
          packetOpacity(1, microFade, easeInOutCubic),
          stripeJsonValuesOpacity(1, microFade, easeInOutCubic),
          j > 0 ? clientJsonValuesOpacity(0, microFade, easeInOutCubic) : waitFor(0),
        );
        yield* packetT(1, microTravel, linear);
        {
          const d = makeCycleData(i + cycleOffset + j + 1);
          setDtoPayload(d, false);
        }
        yield* all(
          packetOpacity(0, microFade, easeInOutCubic),
          stripeJsonValuesOpacity(0, microFade, easeInOutCubic),
          dtoValuesOpacity(1, microFade, easeInOutCubic),
        );

        yield* waitFor(microHold);

        yield* packet2Opacity(1, microFade, easeInOutCubic);
        yield* packet2T(1, microTravel, linear);
        {
          const d = makeCycleData(i + cycleOffset + j + 1);
          setClientPayload(d, false);
        }
        yield* all(
          packet2Opacity(0, microFade, easeInOutCubic),
          dtoValuesOpacity(0, microFade, easeInOutCubic),
          clientJsonValuesOpacity(1, microFade, easeInOutCubic),
        );

        yield* waitFor(microHold);
      }
    }
  }

  if (focusRisk() > 0) {
    yield* waitFor(0.35);
    yield* focusX(1, 0.9, easeInOutCubic);
    yield* waitFor(0.35);
    yield* focusX(2, 0.9, easeInOutCubic);
    yield* waitFor(0.45);
    yield* all(
      focusRisk(0, Timing.slow, easeInOutCubic),
      riskDimEnabled(0, Timing.slow, easeInOutCubic),
    );
    focusX(0);
  }

  yield* waitFor(0.5);

  const leakData = makeCycleData(cycleOffset + cycles - 1);
  yield* all(
    leakPhase(1, Timing.slow, easeInOutCubic),
  );
  focusX(0);
  yield* waitFor(0.4);

  leakRiskOut(0);
  yield* leakRiskOut(1, Timing.slow * 1.6, easeInOutCubic);
  reserveClientLeakRow(leakData);
  yield* waitFor(0.15);

  yield* leak0(1, Timing.normal, easeInOutCubic);
  yield* waitFor(0.8);
  yield* leak0(0, Timing.normal, easeInOutCubic);

  yield* leak1(1, Timing.normal, easeInOutCubic);
  yield* waitFor(0.8);
  yield* leak1(0, Timing.normal, easeInOutCubic);

  yield* leak2(1, Timing.normal, easeInOutCubic);
  yield* waitFor(0.8);

  yield* all(
    leakPhase(0, Timing.slow, easeInOutCubic),
    leak2(0, Timing.slow, easeInOutCubic),
    leakRiskOut(0, Timing.slow, easeInOutCubic),
  );

  yield* waitFor(0.8);

  splitDtoY(splitDtoStartY);

  yield* all(
    clientCircleRed(0, Timing.slow, easeInOutCubic),
    dtoObjectOpacity(0, Timing.slow, easeInOutCubic),
    stripeJsonOpacity(0, Timing.slow, easeInOutCubic),
    clientJsonOpacity(0, Timing.slow, easeInOutCubic),
  );
  clearRiskScoreText(leakData);

  yield* waitFor(0.2);

  yield* all(
    clientDtoOpacity(1, Timing.slow, easeInOutCubic),
    webhookDtoOpacity(1, Timing.slow, easeInOutCubic),
    rightPortYellow(1, Timing.slow, easeInOutCubic),
  );

  {
    webhookDtoValuesOpacity(0);
    clientDtoValuesOpacity(0);
    packetT(0);
    packetOpacity(0);
    packet2T(0);
    packet2Opacity(0);

    const d1 = makeCycleData(cycleOffset + cycles);
    const d2 = makeCycleData(cycleOffset + cycles + 1);
    const d3 = makeCycleData(cycleOffset + cycles + 2);

    // Transport #1: DTOs are identical (no updatedAt, no riskScore)
    webhookDtoKeysSig(webhookDtoBodyKeyLinesNoUpdatedAt.join('\n'));
    webhookDtoValuesSig([`"${d1.id}"`, d1.amount, `"USD"`, `"${d1.status}"`, ''].join('\n'));
    clientDtoValuesSig([`"${d1.id}"`, d1.amount, `"USD"`, `"${d1.status}"`, ''].join('\n'));

    yield* all(
      packetOpacity(1, Timing.fast, easeInOutCubic),
      webhookDtoValuesOpacity(1, Timing.fast, easeInOutCubic),
    );
    yield* packetT(1, Timing.normal, linear);
    yield* packetOpacity(0, Timing.fast, easeInOutCubic);

    yield* all(
      packet2Opacity(1, Timing.fast, easeInOutCubic),
      clientDtoValuesOpacity(1, Timing.fast, easeInOutCubic),
    );
    yield* packet2T(1, Timing.normal, linear);
    yield* packet2Opacity(0, Timing.fast, easeInOutCubic);

    yield* waitFor(0.35);

    // Transport #2: update values + updatedAt only on WebhookDto. Right updates only when the dot approaches the payment service.
    packetT(0);
    yield* packetOpacity(1, Timing.fast, easeInOutCubic);
    yield* packetT(0.7, Timing.normal * 0.7, linear);
    webhookDtoKeysSig(webhookDtoBodyKeyLinesWithUpdatedAt.join('\n'));
    webhookDtoValuesSig([`"${d2.id}"`, d2.amount, `"USD"`, `"${d2.status}"`, `"${d2.updatedAt}"`, ''].join('\n'));
    yield* packetT(1, Timing.normal * 0.3, linear);
    yield* packetOpacity(0, Timing.fast, easeInOutCubic);

    packet2T(0);
    yield* packet2Opacity(1, Timing.fast, easeInOutCubic);
    yield* packet2T(1, Timing.normal, linear);
    clientDtoValuesSig([`"${d2.id}"`, d2.amount, `"USD"`, `"${d2.status}"`, ''].join('\n'));
    yield* packet2Opacity(0, Timing.fast, easeInOutCubic);

    yield* waitFor(0.35);

    // Transport #3: update values + add riskScore (and keep updatedAt) only to WebhookDto, then sync safe fields to ClientDto.
    packetT(0);
    yield* packetOpacity(1, Timing.fast, easeInOutCubic);
    yield* packetT(0.7, Timing.normal * 0.7, linear);
    webhookDtoKeysSig(webhookDtoBodyKeyLinesWithRisk.join('\n'));
    webhookDtoValuesSig([`"${d3.id}"`, d3.amount, `"USD"`, `"${d3.status}"`, `"${d3.updatedAt}"`, d3.riskScore, ''].join('\n'));
    yield* packetT(1, Timing.normal * 0.3, linear);
    yield* packetOpacity(0, Timing.fast, easeInOutCubic);

    packet2T(0);
    yield* packet2Opacity(1, Timing.fast, easeInOutCubic);
    yield* packet2T(1, Timing.normal, linear);
    clientDtoValuesSig([`"${d3.id}"`, d3.amount, `"USD"`, `"${d3.status}"`, ''].join('\n'));
    yield* packet2Opacity(0, Timing.fast, easeInOutCubic);

    splitDtoHi(0);
    yield* splitDtoHiOn(1, 0.45, easeInOutCubic);
    yield* splitDtoHi(1, 0.5, easeInOutCubic);
    yield* splitDtoHi(2, 0.5, easeInOutCubic);
    yield* splitDtoHi(3, 0.55, easeInOutCubic);
    yield* splitDtoHiOn(0, 0.85, easeInOutCubic);
  }

  yield* waitFor(1.2);

  yield* all(
    leftOpacity(0, Timing.slow, easeInOutCubic),
    rightOpacity(0, Timing.slow, easeInOutCubic),
    wiresOpacity(0, Timing.slow, easeInOutCubic),
    leftPortOpacity(0, Timing.slow, easeInOutCubic),
    rightPortOpacity(0, Timing.slow, easeInOutCubic),
    clientDtoOpacity(0, Timing.slow, easeInOutCubic),
    webhookDtoOpacity(0, Timing.slow, easeInOutCubic),
    rightPortYellow(0, Timing.slow, easeInOutCubic),
    packetOpacity(0, Timing.slow, easeInOutCubic),
    packet2Opacity(0, Timing.slow, easeInOutCubic),
  );

  yield* waitFor(0.45);
  yield* all(
    endDark(1, 2.8, easeInOutCubic),
    endZoom(1, 3.2, easeInOutCubic),
  );
  yield* waitFor(0.25);
});


