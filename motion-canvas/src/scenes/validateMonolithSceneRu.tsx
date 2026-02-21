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
}

private static void validateDisplayName(WhatsappChannelCreateRequest request) {
    String displayName = StringUtils.trimToNull(request.getDisplayName());

    if (displayName == null) {
        throw new ValidationException(Violations.notNullViolation("displayName"));
    }

    if (displayName.length() > 255) {
        throw new ValidationException(Violations.sizeMaxViolation("displayName", displayName, 255));
    }
}

private static void validateConnectionType(WhatsappChannelCreateRequest request) {
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
}

private static void validatePhoneNumber(WhatsappChannelCreateRequest request, ConnectionType connectionType) {
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
  const TYPE_CLEAN = 'rgba(220, 215, 255, 0.80)';
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
    if (line.includes('validateDisplayName(')) {
      yield* code.recolorTokens(i, ['validateDisplayName'], VAR_LIGHT, 0);
    } else if (line.includes('validateConnectionType(')) {
      yield* code.recolorTokens(i, ['validateConnectionType'], VAR_LIGHT, 0);
    } else if (line.includes('validatePhoneNumber(')) {
      yield* code.recolorTokens(i, ['validatePhoneNumber'], VAR_LIGHT, 0);
    } else if (line.includes('validate(')) {
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
    const staticTypes = [
      'WhatsappChannelCreateRequest', 'ValidationException', 'Violations',
      'ConnectionType', 'StringUtils', 'IllegalArgumentException',
    ];
    const typesOnLine = staticTypes.filter(t => line.includes(t));
    if (typesOnLine.length > 0) {
      yield* code.recolorTokens(i, typesOnLine, TYPE_CLEAN, 0);
    }
    const methodCalls = [
      'getDisplayName', 'getConnectionType', 'getPhoneNumber',
      'trimToNull', 'valueOf', 'matches', 'length',
      'notNullViolation', 'sizeMaxViolation', 'enumViolation', 'patternViolation',
    ];
    const methodsOnLine = methodCalls.filter(t => line.includes(t));
    if (methodsOnLine.length > 0) {
      yield* code.recolorTokens(i, methodsOnLine, DryFiltersV3CodeTheme.method, 0);
    }
  }
  const privateMethodStart = 39;
  const validateEnd = 38;
  for (let i = privateMethodStart; i < lines.length; i++) {
    const ln = code.getLine(i);
    if (ln) ln.node.opacity(0);
  }

  yield* code.appear(Timing.normal);
  yield* waitFor(2);

  const leftEdge = code.getContentLeftEdge();
  const callIndent = textWidth('    ', Fonts.code, fontSize);
  const PUNCT_COLOR = 'rgba(244, 241, 235, 0.7)';
  const METHOD_COLOR = DryFiltersV3CodeTheme.method;
  const dimOpacity = 0.15;

  const blocks = [
    {from: 1, to: 9, name: 'validateDisplayName', args: '(request)'},
    {from: 11, to: 27, name: 'validateConnectionType', args: '(request)'},
    {from: 29, to: 37, name: 'validatePhoneNumber', args: '(request, connectionType)'},
  ];

  let totalCollapsed = 0;
  const createdCalls: Node[] = [];

  for (let b = 0; b < blocks.length; b++) {
    const block = blocks[b];
    const from = block.from;
    const to = block.to;
    const isLastBlock = b === blocks.length - 1;

    // highlight this block, dim everything else
    const dimAnims: ThreadGenerator[] = [];
    for (let i = 0; i <= validateEnd; i++) {
      const ln = code.getLine(i)!;
      if (ln.node.opacity() === 0) continue;
      const bright = i >= from && i <= to;
      dimAnims.push(code.setLineTokensOpacity(i, bright ? 1 : dimOpacity, 0.8));
    }
    for (const prevCall of createdCalls) {
      dimAnims.push(prevCall.opacity(dimOpacity, 0.8, easeInOutCubic));
    }
    for (let i = privateMethodStart; i < lines.length; i++) {
      const ln = code.getLine(i)!;
      if (ln.node.opacity() > 0) {
        dimAnims.push(code.setLineTokensOpacity(i, dimOpacity, 0.8));
      }
    }
    yield* all(...dimAnims);

    yield* waitFor(1);

    // create method call node
    const anchorLine = code.getLine(from)!;
    const callY = anchorLine.node.y();

    const callParts = [
      {text: block.name, color: METHOD_COLOR},
      {text: block.args.charAt(0), color: PUNCT_COLOR},
    ];
    const argText = block.args.slice(1, -1);
    const argTokens = argText.split(', ');
    for (let a = 0; a < argTokens.length; a++) {
      if (a > 0) callParts.push({text: ', ', color: PUNCT_COLOR});
      callParts.push({text: argTokens[a], color: VAR_LIGHT});
    }
    callParts.push({text: ');', color: PUNCT_COLOR});

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
    createdCalls.push(callContainer);

    const blockLines = to - from;
    const collapseDistance = blockLines * lineHeight;
    const targetY = anchorLine.node.y();

    // step A: squeeze + fade out block, fade in call, collapse below — all together
    const anims: ThreadGenerator[] = [];
    for (let i = from; i <= to; i++) {
      const ln = code.getLine(i)!;
      anims.push(ln.node.y(targetY, 0.8, easeInOutCubic));
      anims.push(ln.node.opacity(0, 0.6, easeInOutCubic));
    }
    anims.push(callContainer.opacity(1, 0.8, easeInOutCubic));

    for (let i = to + 1; i < lines.length; i++) {
      const ln = code.getLine(i)!;
      if (ln.node.opacity() === 0 && i >= privateMethodStart) {
        if (isLastBlock) {
          anims.push(ln.node.opacity(1, 0.8, easeInOutCubic));
          anims.push(ln.node.y(ln.node.y() - collapseDistance, 0.8, easeInOutCubic));
        } else {
          ln.node.y(ln.node.y() - collapseDistance);
        }
      } else {
        anims.push(ln.node.y(ln.node.y() - collapseDistance, 0.8, easeInOutCubic));
      }
    }

    yield* all(...anims);
    totalCollapsed += collapseDistance;

    yield* waitFor(0.5);
  }

  // restore brightness on everything
  const restoreAnims: ThreadGenerator[] = [];
  for (let i = 0; i <= validateEnd; i++) {
    const ln = code.getLine(i)!;
    if (ln.node.opacity() > 0) {
      restoreAnims.push(code.setLineTokensOpacity(i, 1, 0.6));
    }
  }
  for (const call of createdCalls) {
    restoreAnims.push(call.opacity(1, 0.6, easeInOutCubic));
  }
  for (let i = privateMethodStart; i < lines.length; i++) {
    const ln = code.getLine(i)!;
    if (ln.node.opacity() > 0) {
      restoreAnims.push(code.setLineTokensOpacity(i, 1, 0.6));
    }
  }
  yield* all(...restoreAnims);

  yield* waitFor(2);
});
