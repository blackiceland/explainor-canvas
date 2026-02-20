import {makeScene2D, Node, Txt} from '@motion-canvas/2d';
import {all, easeInOutCubic, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';
import {textWidth} from '../core/utils/textMeasure';

const CODE_CARD_STYLE = {
  radius: 24,
  fill: 'rgba(0,0,0,0)',
  stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0,
  shadowColor: 'rgba(0,0,0,0)',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  edge: false,
} as const;

const VALIDATE_CODE = `private static void validate(WhatsappChannelCreateRequest request) {
    String displayName = StringUtils.trimToNull(request.getDisplayName());

    if (displayName == null) {
        throw new ValidationException(Violations.notNullViolation("displayName"));
    }

    if (displayName.length() > 255) {
        throw new ValidationException(Violations.sizeMaxViolation("displayName", displayName, 255));
    }

    String connectionTypeRaw = StringUtils.trimToNull(request.getConnectionType());

    if (connectionTypeRaw == null) {
        throw new ValidationException(Violations.notNullViolation("connectionType"));
    }

    ConnectionType connectionType;

    try {
        connectionType = ConnectionType.valueOf(connectionTypeRaw);
    } catch (IllegalArgumentException e) {
        throw new ValidationException(Violations.enumViolation("connectionType", connectionTypeRaw));
    }

    if (connectionType != ConnectionType.QR_CODE && connectionType != ConnectionType.DIGITAL_CODE) {
        throw new ValidationException(Violations.enumViolation("connectionType", connectionTypeRaw));
    }

    String phoneNumber = StringUtils.trimToNull(request.getPhoneNumber());

    if (phoneNumber != null && !phoneNumber.matches("\\\\+?\\\\d{11}")) {
        throw new ValidationException(Violations.patternViolation("phoneNumber", phoneNumber));
    }

    if (connectionType == ConnectionType.DIGITAL_CODE && phoneNumber == null) {
        throw new ValidationException(Violations.notNullViolation("phoneNumber"));
    }
}`;

export default makeScene2D(function* (view) {
  applyBackground(view);

  const fontSize = 22;
  const lineHeight = Math.round(fontSize * 1.62 * 10) / 10;
  const paddingY = getCodePaddingY(fontSize);
  const topInset = Math.max(8, paddingY - 8);

  const blockHeight = SafeZone.bottom - SafeZone.top - 36;
  const blockWidth = SafeZone.right - SafeZone.left + 100;

  const code = CodeBlock.fromCode(VALIDATE_CODE, {
    x: 0,
    y: 0,
    width: blockWidth,
    height: blockHeight,
    fontSize,
    lineHeight,
    contentOffsetY: topInset,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    customTypes: [
      'WhatsappChannelCreateRequest',
      'ValidationException',
      'Violations',
      'ConnectionType',
      'IllegalArgumentException',
    ],
  });

  code.mount(view);
  const lines = VALIDATE_CODE.split('\n');
  const SOFT_GREEN = 'rgba(168, 214, 178, 0.88)';
  const VAR_LIGHT = 'rgba(244, 241, 235, 0.96)';
  const KEYWORD_COLOR = DryFiltersV3CodeTheme.keyword;
  const TYPE_CLEAN = 'rgba(200, 186, 255, 0.82)';
  const variableTokens = [
    'request',
    'displayName',
    'connectionTypeRaw',
    'connectionType',
    'phoneNumber',
  ];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const varsOnLine = variableTokens.filter(token => new RegExp(`\\b${token}\\b`).test(line));
    if (varsOnLine.length > 0) {
      yield* code.recolorTokens(i, varsOnLine, VAR_LIGHT, 0);
    }
    const quoted: string[] = [];
    const re = /"[^"\n]*"/g;
    let m = re.exec(line);
    while (m) {
      quoted.push(m[0]);
      m = re.exec(line);
    }
    if (quoted.length > 0) {
      yield* code.recolorTokens(i, quoted, SOFT_GREEN, 0);
    }
    if (line.includes('validate(')) {
      yield* code.recolorTokens(i, ['validate'], VAR_LIGHT, 0);
    }
    if (line.includes('null')) {
      yield* code.recolorTokens(i, ['null'], KEYWORD_COLOR, 0);
    }
    if (line.includes('255')) {
      yield* code.recolorTokens(i, ['255'], KEYWORD_COLOR, 0);
    }
    if (line.includes('catch (IllegalArgumentException e)')) {
      yield* code.recolorTokens(i, ['e'], VAR_LIGHT, 0);
    }
    if (line.includes('IllegalArgumentException')) {
      yield* code.recolorTokens(i, ['IllegalArgumentException'], TYPE_CLEAN, 0);
    }
    const staticTypes = [
      'ValidationException', 'Violations', 'ConnectionType', 'StringUtils',
    ];
    const typesOnLine = staticTypes.filter(t => line.includes(t));
    if (typesOnLine.length > 0) {
      yield* code.recolorTokens(i, typesOnLine, TYPE_CLEAN, 0);
    }
  }
  yield* code.appear(Timing.normal);
  yield* waitFor(2);

  const dimOpacity = 0.15;
  const dimDuration = 0.8;
  const highlightFrom = 1;
  const highlightTo = 9;

  const dimAnims: ThreadGenerator[] = [];
  for (let i = 0; i < lines.length; i++) {
    const bright = i >= highlightFrom && i <= highlightTo;
    dimAnims.push(code.setLineTokensOpacity(i, bright ? 1 : dimOpacity, dimDuration));
  }
  yield* all(...dimAnims);

  yield* waitFor(1.5);

  // Prepare method call Txt before animation
  const callLine = code.getLine(highlightFrom)!;
  const leftEdge = code.getContentLeftEdge();
  const callY = callLine.node.y();
  const callIndent = textWidth('    ', Fonts.code, fontSize);
  const PUNCT_COLOR = 'rgba(244, 241, 235, 0.7)';

  const METHOD_COLOR = DryFiltersV3CodeTheme.method;

  const callParts = [
    {text: 'validateDisplayName', color: METHOD_COLOR},
    {text: '(', color: PUNCT_COLOR},
    {text: 'request', color: VAR_LIGHT},
    {text: ');', color: PUNCT_COLOR},
  ];

  const callContainer = new Node({y: callY, opacity: 0});
  let cx = leftEdge + callIndent;
  for (const part of callParts) {
    callContainer.add(new Txt({
      text: part.text,
      fontFamily: Fonts.code,
      fontSize,
      fill: part.color,
      x: cx,
      offset: [-1, 0],
    }));
    cx += textWidth(part.text, Fonts.code, fontSize);
  }
  code.getContentContainer().add(callContainer);

  // Step 2: fade out block + fade in method call + collapse — all together
  const collapsedLines = highlightTo - highlightFrom;
  const collapseDistance = collapsedLines * lineHeight;

  const transitionAnims: ThreadGenerator[] = [];

  for (let i = highlightFrom; i <= highlightTo; i++) {
    transitionAnims.push(code.setLineTokensOpacity(i, 0, 1.2));
  }
  transitionAnims.push(callContainer.opacity(1, 1.2, easeInOutCubic));

  for (let i = highlightTo + 1; i < lines.length; i++) {
    const ln = code.getLine(i)!;
    const currentY = ln.node.y();
    transitionAnims.push(ln.node.y(currentY - collapseDistance, 1.2, easeInOutCubic));
  }
  for (let i = highlightFrom; i <= highlightTo; i++) {
    const ln = code.getLine(i)!;
    transitionAnims.push(ln.node.opacity(0, 1.2, easeInOutCubic));
  }

  yield* all(...transitionAnims);

  // restore brightness on remaining lines
  const restoreAnims: ThreadGenerator[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (i >= highlightFrom && i <= highlightTo) continue;
    restoreAnims.push(code.setLineTokensOpacity(i, 1, 0.6));
  }
  yield* all(...restoreAnims);

  yield* waitFor(2);
});
