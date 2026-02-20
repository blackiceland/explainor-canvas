import {makeScene2D} from '@motion-canvas/2d';
import {all, chain, linear, ThreadGenerator, waitFor} from '@motion-canvas/core';
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
  const TYPE_CLEAN = 'rgba(200, 186, 255, 0.82)';
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
  yield* waitFor(1.2);

  const dimOpacity = 0.15;
  const dimDuration = 0.8;
  const pauseOnBlock = 1.5;
  const scrollDuration = 1.2;

  const clipHeight = blockHeight - paddingY * 2;
  const visibleLines = Math.floor(clipHeight / lineHeight);

  const checkBlocks = [
    [3, 5],
    [7, 9],
    [13, 15],
    [19, 23],
    [25, 27],
    [29, 35],
    [37, 41],
    [46, 54],
  ];

  function scrollForBlock(start: number, end: number): number {
    const blockCenter = (start + end) / 2;
    const screenCenter = visibleLines / 2;
    const offset = (blockCenter - screenCenter) * lineHeight;
    return Math.max(0, offset);
  }

  function* dimAllExcept(start: number, end: number): ThreadGenerator {
    const anims: ThreadGenerator[] = [];
    for (let i = 0; i < lines.length; i++) {
      const bright = i >= start && i <= end;
      anims.push(code.setLineTokensOpacity(i, bright ? 1 : dimOpacity, dimDuration));
    }
    yield* all(...anims);
  }

  const lastPausedBlock = 1;
  let currentScroll = 0;
  yield* dimAllExcept(checkBlocks[0][0], checkBlocks[0][1]);

  for (let b = 1; b <= lastPausedBlock; b++) {
    yield* waitFor(pauseOnBlock);
    yield* dimAllExcept(checkBlocks[b][0], checkBlocks[b][1]);
  }

  yield* waitFor(pauseOnBlock);

  const lastBlock = checkBlocks[checkBlocks.length - 1];
  const finalScroll = scrollForBlock(lastBlock[0], lastBlock[1]);
  const continuousScrollDuration = 10;

  const remainingBlocks = checkBlocks.slice(lastPausedBlock + 1);
  const blockScrollPositions = remainingBlocks.map(
    ([s, e]) => scrollForBlock(s, e),
  );

  function* highlightDuringScroll(): ThreadGenerator {
    for (let i = 0; i < remainingBlocks.length; i++) {
      const [start, end] = remainingBlocks[i];
      const scrollPos = blockScrollPositions[i];
      const nextScrollPos = i < remainingBlocks.length - 1
        ? blockScrollPositions[i + 1]
        : finalScroll;
      const fraction = finalScroll > 0
        ? (nextScrollPos - scrollPos) / finalScroll
        : 1 / remainingBlocks.length;
      const segmentTime = continuousScrollDuration * fraction;

      yield* dimAllExcept(start, end);
      yield* waitFor(Math.max(0.3, segmentTime - dimDuration));
    }
  }

  yield* all(
    code.animateScrollY(finalScroll, continuousScrollDuration, linear),
    highlightDuringScroll(),
  );

  yield* waitFor(2);
});
