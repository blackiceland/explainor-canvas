import {makeScene2D} from '@motion-canvas/2d';
import {waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

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

const VALIDATE_CODE = `private static ValidationResult validate(WhatsappChannelCreateRequest request) {
    String displayName = StringUtils.trimToNull(request.getDisplayName());

    if (displayName == null) {
        return ValidationError.of(Violations.notNullViolation("displayName"));
    }

    if (displayName.length() > 255) {
        return ValidationError.of(Violations.sizeMaxViolation("displayName", displayName, 255));
    }

    String connectionTypeRaw = StringUtils.trimToNull(request.getConnectionType());

    if (connectionTypeRaw == null) {
        return ValidationError.of(Violations.notNullViolation("connectionType"));
    }

    ConnectionType connectionType;

    try {
        connectionType = ConnectionType.valueOf(connectionTypeRaw);
    } catch (IllegalArgumentException e) {
        return ValidationError.of(Violations.enumViolation("connectionType", connectionTypeRaw));
    }

    if (connectionType != ConnectionType.QR_CODE && connectionType != ConnectionType.DIGITAL_CODE) {
        return ValidationError.of(Violations.enumViolation("connectionType", connectionTypeRaw));
    }

    String phoneNumber = StringUtils.trimToNull(request.getPhoneNumber());

    if (phoneNumber != null) {
        if (!phoneNumber.matches("\\\\+?\\\\d{11}")) {
            return ValidationError.of(Violations.patternViolation("phoneNumber", phoneNumber, "must match XXXXXXXXXXX or +XXXXXXXXXXX"));
        }
    }

    if (connectionType == ConnectionType.DIGITAL_CODE) {
        if (phoneNumber == null) {
            return ValidationError.of(Violations.notNullViolation("phoneNumber"));
        }
    }

    Instant syncMessagesFromRaw = request.getSyncMessagesFrom();
    Timestamp syncMessagesFrom = null;

    if (syncMessagesFromRaw != null) {
        long minEpochSecond = OffsetDateTime.now(ZoneOffset.UTC).minusMonths(1).toEpochSecond();
        long valueEpochSecond = syncMessagesFromRaw.getEpochSecond();

        if (valueEpochSecond < minEpochSecond) {
            return ValidationError.of(Violations.minDateViolation("syncMessagesFrom", syncMessagesFromRaw));
        }

        syncMessagesFrom = Timestamp.from(syncMessagesFromRaw.truncatedTo(ChronoUnit.MILLIS));
    }

    return ValidationSuccess.of(connectionType, syncMessagesFrom);
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
      'ValidationResult',
      'WhatsappChannelCreateRequest',
      'ValidationError',
      'Violations',
      'ConnectionType',
      'IllegalArgumentException',
      'Instant',
      'Timestamp',
      'OffsetDateTime',
      'ZoneOffset',
      'ChronoUnit',
      'ValidationSuccess',
    ],
  });

  code.mount(view);
  const lines = VALIDATE_CODE.split('\n');
  const SOFT_GREEN = 'rgba(168, 214, 178, 0.88)';
  const VAR_LIGHT = 'rgba(244, 241, 235, 0.96)';
  const KEYWORD_COLOR = DryFiltersV3CodeTheme.keyword;
  const TYPE_CLEAN = 'rgba(185, 168, 245, 0.76)';
  const variableTokens = [
    'request',
    'displayName',
    'connectionTypeRaw',
    'connectionType',
    'phoneNumber',
    'syncMessagesFromRaw',
    'syncMessagesFrom',
    'minEpochSecond',
    'valueEpochSecond',
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
      'ValidationResult', 'ValidationError', 'ValidationSuccess',
      'Violations', 'ConnectionType', 'StringUtils',
      'OffsetDateTime', 'ZoneOffset', 'Timestamp', 'ChronoUnit',
    ];
    const typesOnLine = staticTypes.filter(t => line.includes(t));
    if (typesOnLine.length > 0) {
      yield* code.recolorTokens(i, typesOnLine, TYPE_CLEAN, 0);
    }
  }
  yield* code.appear(Timing.normal);

  const clipHeight = blockHeight - paddingY * 2;
  const targetLastY = clipHeight / 2 - lineHeight / 2 - 12;
  const startY = -clipHeight / 2 + topInset + lineHeight / 2;
  const currentLastY = startY + (lines.length - 1) * lineHeight;
  const scrollAmount = Math.max(0, currentLastY - targetLastY + 18);

  yield* code.animateScrollY(scrollAmount, 14);
  yield* waitFor(0.4);
});
