import {makeScene2D, Node, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {SafeZone} from '../core/ScreenGrid';
import {getCodePaddingX, getCodePaddingY, getLineHeight} from '../core/code/shared/TextMeasure';
import {Colors, Fonts, Screen, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';
import {textWidth} from '../core/utils/textMeasure';

const RETRY_POLICY_CODE = `class PaymentRetryPolicy {

  boolean shouldRetry(PspCode code) {
    return switch (code) {
      case TEMPORARY_FAILURE -> true;
      case PERMANENT_FAILURE -> false;
      case ACTION_REQUIRED -> false;
      case TIMEOUT -> true;
      default -> false;
    };
  }
}`;

const STATUS_MAPPER_CODE = `class PaymentStatusMapper {

  PaymentStatus toPaymentStatus(PspCode code) {
    return switch (code) {
      case TEMPORARY_FAILURE -> PaymentStatus.RETRYING;
      case PERMANENT_FAILURE -> PaymentStatus.DECLINED;
      case ACTION_REQUIRED -> PaymentStatus.REQUIRES_ACTION;
      case TIMEOUT -> PaymentStatus.PENDING;
      default -> PaymentStatus.FAILED;
    };
  }
}`;

const CHECKOUT_NEXT_STEP_CODE = `class CheckoutNextStepMapper {

  CheckoutNextStep toNextStep(PspCode code) {
    return switch (code) {
      case TEMPORARY_FAILURE -> CheckoutNextStep.RETRY;
      case PERMANENT_FAILURE -> CheckoutNextStep.USE_OTHER_CARD;
      case ACTION_REQUIRED -> CheckoutNextStep.CONFIRM_ACTION;
      case TIMEOUT -> CheckoutNextStep.WAIT;
      default -> CheckoutNextStep.FAIL;
    };
  }
}`;

const OUTCOME_MAPPER_CODE = `class PspOutcomeMapper {

  Outcome classify(PspCode code) {
    return switch (code) {
      case TEMPORARY_FAILURE ->
          Outcome.of(true, PaymentStatus.RETRYING, CheckoutNextStep.RETRY);
      case PERMANENT_FAILURE ->
          Outcome.of(false, PaymentStatus.DECLINED, CheckoutNextStep.USE_OTHER_CARD);
      case ACTION_REQUIRED ->
          Outcome.of(false, PaymentStatus.REQUIRES_ACTION, CheckoutNextStep.CONFIRM_ACTION);
      case TIMEOUT ->
          Outcome.of(true, PaymentStatus.PENDING, CheckoutNextStep.WAIT);
      default ->
          Outcome.of(false, PaymentStatus.FAILED, CheckoutNextStep.FAIL);
    };
  }
}`;

function codeBlockWidthRaw(code: string, fontFamily: string, fontSize: number, paddingX: number): number {
  const maxLinePx = Math.max(
    0,
    ...code.split('\n').map(line => textWidth(line, fontFamily, fontSize, 400)),
  );
  return Math.ceil(maxLinePx + paddingX * 2);
}

function codeBlockWidth(code: string, fontFamily: string, fontSize: number, paddingX: number): number {
  const raw = codeBlockWidthRaw(code, fontFamily, fontSize, paddingX);
  // Add a bit of extra slack so leftmost tokens (e.g. "class") never get clipped by the inner clip rect.
  const slack = 64;
  return Math.min(Screen.width - 80, Math.max(900, raw + slack));
}

function codeLineWorldY(cardY: number, code: string, lineIndex: number, fontSize: number, cardHeight: number): number {
  const lineHeight = getLineHeight(fontSize);
  const paddingY = getCodePaddingY(fontSize);
  const lineCount = code.split('\n').length;
  const contentHeight = lineCount * lineHeight + paddingY * 2;
  const clipHeight = Math.max(0, cardHeight - paddingY * 2);

  // Mirrors CodeBlock.ts: top-align when fixed height differs from content height.
  const shouldTopAlign = cardHeight !== contentHeight;
  const topAlignedStartY = -clipHeight / 2 + lineHeight / 2;
  const centerAlignedStartY = -((lineCount - 1) / 2) * lineHeight;
  const startY = shouldTopAlign ? topAlignedStartY : centerAlignedStartY;

  return cardY + startY + lineIndex * lineHeight;
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  // V3: code directly on background (no cards) — match dryConditionsSceneV3.
  const transparentCardStyle = {
    fill: 'rgba(0,0,0,0)',
    stroke: 'rgba(0,0,0,0)',
    strokeWidth: 0,
    shadowColor: 'rgba(0,0,0,0)',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    edge: false,
  } as const;

  // Full-width pink strip for the "case" highlight.
  const caseStrip = createRef<Rect>();
  view.add(
    <Rect
      ref={caseStrip}
      x={0}
      y={0}
      width={Screen.width}
      height={56}
      fill={'rgba(255, 140, 163, 0.22)'}
      opacity={0}
    />,
  );

  // Put all animated content into a stage so we can zoom without moving the background.
  const stage = createRef<Node>();
  view.add(<Node ref={stage} />);

  const quoteContainer = createRef<Node>();

  stage().add(
    <Node ref={quoteContainer} opacity={0} y={-20}>
      <Txt
        fontFamily={Fonts.primary}
        fontSize={36}
        fill={Colors.text.primary}
        textAlign="center"
        y={-50}
      >
        Каждый фрагмент <Txt fill={Colors.accent} fontWeight={600}>знания</Txt> должен иметь
      </Txt>
      <Txt
        fontFamily={Fonts.primary}
        fontSize={36}
        fill={Colors.text.primary}
        textAlign="center"
        y={0}
      >
        единственное, однозначное, авторитетное
      </Txt>
      <Txt
        fontFamily={Fonts.primary}
        fontSize={36}
        fill={Colors.text.primary}
        textAlign="center"
        y={50}
      >
        представление внутри системы
      </Txt>
      <Txt
        fontFamily={Fonts.primary}
        fontSize={20}
        fill={Colors.text.muted}
        opacity={0.8}
        fontStyle="italic"
        textAlign="center"
        y={130}
      >
        — The Pragmatic Programmer
      </Txt>
    </Node>,
  );

  yield* quoteContainer().opacity(1, Timing.slow, easeInOutCubic);
  yield* waitFor(2);
  // Quote disappears all at once (no clone trick).
  yield* quoteContainer().opacity(0, Timing.slow, easeInOutCubic);
  yield* waitFor(0.4);

  // Layout like `dryFiltersScene`: two blocks on the left column, one block on the right (top).
  const gap = 120;
  const totalWidth = SafeZone.right - SafeZone.left;
  const cardWidth = (totalWidth - gap) / 2;
  const codeX = SafeZone.left + cardWidth / 2;
  const tableX = SafeZone.right - cardWidth / 2;

  const fontSize = 18;
  const stackGap = 60; // Same as STACK_GAP in ScreenGrid.ts
  const targetLines = 14;
  const lineHeight = getLineHeight(fontSize);
  const paddingY = getCodePaddingY(fontSize);
  const cardHeight = targetLines * lineHeight + paddingY * 2;

  const safeHeight = SafeZone.bottom - SafeZone.top;
  const stackHeight = 2 * cardHeight + stackGap;
  const marginY = Math.max(0, (safeHeight - stackHeight) / 2);
  const topY = SafeZone.top + marginY + cardHeight / 2;

  const retryCard = CodeBlock.fromCode(RETRY_POLICY_CODE, {
    x: codeX,
    y: topY,
    width: cardWidth,
    height: cardHeight,
    fontSize,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    customTypes: ['PaymentRetryPolicy', 'PspCode'],
    cardStyle: transparentCardStyle,
  });
  retryCard.mount(stage());

  const statusCard = CodeBlock.fromCode(STATUS_MAPPER_CODE, {
    x: codeX,
    y: topY + cardHeight + stackGap,
    width: cardWidth,
    height: cardHeight,
    fontSize,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    customTypes: ['PaymentStatusMapper', 'PspCode', 'PaymentStatus'],
    cardStyle: transparentCardStyle,
  });
  statusCard.mount(stage());

  const nextStepCard = CodeBlock.fromCode(CHECKOUT_NEXT_STEP_CODE, {
    x: tableX,
    y: topY,
    width: cardWidth,
    height: cardHeight,
    fontSize,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    customTypes: ['CheckoutNextStep', 'CheckoutNextStepMapper', 'PspCode'],
    cardStyle: transparentCardStyle,
  });
  nextStepCard.mount(stage());

  // Empty placeholder block (no text) that we zoom into.
  const outcomeFontSize = 15;
  const outcomeWidth = codeBlockWidth(OUTCOME_MAPPER_CODE, Fonts.code, outcomeFontSize, getCodePaddingX(outcomeFontSize));
  // Choose zoom scale so the whole code block fits into the frame after zoom (no right-edge clipping).
  const zoomScale = Math.min(1.85, (Screen.width - 120) / Math.max(1, outcomeWidth));

  const outcomeEmptyCard = CodeBlock.fromCode('', {
    x: tableX,
    y: topY + cardHeight + stackGap,
    width: outcomeWidth,
    height: cardHeight,
    fontSize,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    customTypes: [],
    cardStyle: transparentCardStyle,
  });
  outcomeEmptyCard.mount(stage());
  outcomeEmptyCard.node.opacity(0);

  // Full implementation shown after zoom (smaller font so it fits).
  const outcomeFullCard = CodeBlock.fromCode(OUTCOME_MAPPER_CODE, {
    x: tableX,
    y: topY + cardHeight + stackGap,
    width: outcomeWidth,
    height: cardHeight,
    fontSize: outcomeFontSize,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    customTypes: ['PspOutcomeMapper', 'Outcome', 'PspCode', 'PaymentStatus', 'CheckoutNextStep'],
    cardStyle: transparentCardStyle,
  });
  outcomeFullCard.mount(stage());
  outcomeFullCard.node.opacity(0);

  // Appear one-by-one.
  yield* retryCard.appear(Timing.slow);
  yield* waitFor(0.15);
  yield* statusCard.appear(Timing.slow);
  yield* waitFor(0.15);
  yield* nextStepCard.appear(Timing.slow);
  yield* waitFor(0.35);

  function findCaseLine(code: string, caseName: string): number {
    return code.split('\n').findIndex(l => l.includes(`case ${caseName}`));
  }

  const scanCases = ['TEMPORARY_FAILURE', 'PERMANENT_FAILURE', 'ACTION_REQUIRED', 'TIMEOUT'] as const;
  const retryLines = scanCases.map(c => findCaseLine(RETRY_POLICY_CODE, c));
  const statusLines = scanCases.map(c => findCaseLine(STATUS_MAPPER_CODE, c));
  const nextLines = scanCases.map(c => findCaseLine(CHECKOUT_NEXT_STEP_CODE, c));

  const highlightIn = 0.45;
  const highlightOut = 0.35;
  const hold = 0.55;
  const between = 0.18;
  const timeoutBg = 'rgba(255, 140, 163, 0.18)';
  const timeoutBgIn = 0.55;

  let prevRetry = -1;
  let prevStatus = -1;
  let prevNext = -1;

  for (let i = 0; i < scanCases.length; i++) {
    const isTimeout = scanCases[i] === 'TIMEOUT';
    const retryIdx = retryLines[i];
    const statusIdx = statusLines[i];
    const nextIdx = nextLines[i];

    // Move the accent to the next line, keeping dimming sticky.
    yield* all(
      prevRetry >= 0 ? retryCard.resetLineColors(prevRetry, highlightOut) : waitFor(0),
      prevStatus >= 0 ? statusCard.resetLineColors(prevStatus, highlightOut) : waitFor(0),
      prevNext >= 0 ? nextStepCard.resetLineColors(prevNext, highlightOut) : waitFor(0),
      retryIdx >= 0
        ? all(
            retryCard.highlightLines([[retryIdx, retryIdx]], highlightIn),
            retryCard.recolorLine(retryIdx, Colors.accent, highlightIn),
          )
        : waitFor(0),
      statusIdx >= 0
        ? all(
            statusCard.highlightLines([[statusIdx, statusIdx]], highlightIn),
            statusCard.recolorLine(statusIdx, Colors.accent, highlightIn),
          )
        : waitFor(0),
      nextIdx >= 0
        ? all(
            nextStepCard.highlightLines([[nextIdx, nextIdx]], highlightIn),
            nextStepCard.recolorLine(nextIdx, Colors.accent, highlightIn),
          )
        : waitFor(0),
    );

    prevRetry = retryIdx;
    prevStatus = statusIdx;
    prevNext = nextIdx;

    yield* waitFor(hold);

    if (isTimeout && statusIdx >= 0) {
      // Change the value while everything is still dimmed/highlighted.
      yield* waitFor(0.2);

      // Full-width strip aligned with the CASE line (smooth).
      // Use deterministic math (mirrors CodeBlock layout) to avoid missing strip due to world-pos issues.
      caseStrip().y(codeLineWorldY(topY + cardHeight + stackGap, STATUS_MAPPER_CODE, statusIdx, fontSize, cardHeight));
      caseStrip().height(lineHeight * 1.25);
      yield* caseStrip().opacity(1, timeoutBgIn, easeInOutCubic);

      const retryLineIdx = retryIdx;
      const nextLineIdx = nextIdx;

      const line = statusCard.getLine(statusIdx);
      const pendingToken = line?.findToken('PENDING') ?? null;
      const overlayRef = createRef<Txt>();

      if (line && pendingToken) {
        const overlay = new Txt({
          text: 'DECLINED;',
          fontFamily: Fonts.code,
          fontSize,
          fill: Colors.accent,
          opacity: 0,
          offset: [-1, 0],
          x: pendingToken.localX - pendingToken.width / 2,
          y: 0,
        });
        overlayRef(overlay);
        line.node.add(overlay);
      }

      // Additional smooth value swaps on other cards (multiple values change).
      const retryLine = retryLineIdx >= 0 ? retryCard.getLine(retryLineIdx) : null;
      const retryTrue = retryLine?.findToken('true') ?? null;
      const retryOverlayRef = createRef<Txt>();
      const retryLineText = retryLineIdx >= 0 ? (RETRY_POLICY_CODE.split('\n')[retryLineIdx] ?? '') : '';
      const retrySuffix = retryLineText.includes('true,') ? ',' : retryLineText.includes('true;') ? ';' : '';
      if (retryLine && retryTrue) {
        const overlay = new Txt({
          text: `false${retrySuffix}`,
          fontFamily: Fonts.code,
          fontSize,
          fill: Colors.accent,
          opacity: 0,
          offset: [-1, 0],
          x: retryTrue.localX - retryTrue.width / 2,
          y: 0,
        });
        retryOverlayRef(overlay);
        retryLine.node.add(overlay);
      }

      const nextLine = nextLineIdx >= 0 ? nextStepCard.getLine(nextLineIdx) : null;
      const nextWait = nextLine?.findToken('WAIT') ?? null;
      const nextOverlayRef = createRef<Txt>();
      const nextLineText = nextLineIdx >= 0 ? (CHECKOUT_NEXT_STEP_CODE.split('\n')[nextLineIdx] ?? '') : '';
      const nextSuffix = nextLineText.includes('WAIT,') ? ',' : nextLineText.includes('WAIT;') ? ';' : '';
      if (nextLine && nextWait) {
        const overlay = new Txt({
          text: `FAIL${nextSuffix}`,
          fontFamily: Fonts.code,
          fontSize,
          fill: Colors.accent,
          opacity: 0,
          offset: [-1, 0],
          x: nextWait.localX - nextWait.width / 2,
          y: 0,
        });
        nextOverlayRef(overlay);
        nextLine.node.add(overlay);
      }

      const swapDur = 0.6;
      yield* all(
        statusCard.setLineTokensOpacityMatching(statusIdx, ['PENDING', ';'], 0, swapDur),
        overlayRef() ? overlayRef().opacity(1, swapDur, easeInOutCubic) : waitFor(0),
        retryLineIdx >= 0
          ? retryCard.setLineTokensOpacityMatching(retryLineIdx, ['true', retrySuffix].filter(Boolean), 0, swapDur)
          : waitFor(0),
        retryOverlayRef() ? retryOverlayRef().opacity(1, swapDur, easeInOutCubic) : waitFor(0),
        nextLineIdx >= 0
          ? nextStepCard.setLineTokensOpacityMatching(nextLineIdx, ['WAIT', nextSuffix].filter(Boolean), 0, swapDur)
          : waitFor(0),
        nextOverlayRef() ? nextOverlayRef().opacity(1, swapDur, easeInOutCubic) : waitFor(0),
      );

      // Hold so the viewer registers the TIMEOUT transformations.
      yield* waitFor(0.7);

      // Release dimming.
      yield* all(
        prevRetry >= 0 ? retryCard.resetLineColors(prevRetry, highlightOut) : waitFor(0),
        prevStatus >= 0 ? statusCard.resetLineColors(prevStatus, highlightOut) : waitFor(0),
        prevNext >= 0 ? nextStepCard.resetLineColors(prevNext, highlightOut) : waitFor(0),
        retryCard.showAllLines(highlightOut),
        statusCard.showAllLines(highlightOut),
        nextStepCard.showAllLines(highlightOut),
        caseStrip().opacity(0, highlightOut, easeInOutCubic),
      );

      // Empty block → zoom → show full code in smaller font.
      yield* waitFor(0.25);
      yield* outcomeEmptyCard.appear(Timing.slow);

      yield* all(
        stage().scale(zoomScale, Timing.slow, easeInOutCubic),
        stage().position([-tableX * zoomScale, -(topY + cardHeight + stackGap) * zoomScale], Timing.slow, easeInOutCubic),
      );

      yield* waitFor(0.15);
      yield* all(
        outcomeEmptyCard.node.opacity(0, 0.55, easeInOutCubic),
        outcomeFullCard.node.opacity(1, 0.55, easeInOutCubic),
      );

      // Scan each "knowledge" rule inside the unified mapper.
      const outcomeCases = scanCases;
      const outcomeCaseLines = outcomeCases.map(c =>
        OUTCOME_MAPPER_CODE.split('\n').findIndex(l => l.includes(`case ${c} ->`)),
      );

      let prevOutcomeStart = -1;
      let prevOutcomeEnd = -1;
      const jumpDur = 0.28;

      for (let k = 0; k < outcomeCases.length; k++) {
        const start = outcomeCaseLines[k];
        const end = start >= 0 ? Math.min(start + 1, outcomeFullCard.lineCount - 1) : -1;
        if (start < 0) continue;

        yield* all(
          prevOutcomeStart >= 0 ? outcomeFullCard.resetLineColors(prevOutcomeStart, jumpDur) : waitFor(0),
          prevOutcomeEnd >= 0 && prevOutcomeEnd !== prevOutcomeStart ? outcomeFullCard.resetLineColors(prevOutcomeEnd, jumpDur) : waitFor(0),
          outcomeFullCard.highlightLines([[start, end]], jumpDur),
          outcomeFullCard.recolorLine(start, Colors.accent, jumpDur),
          outcomeFullCard.recolorLine(end, Colors.accent, jumpDur),
        );

        prevOutcomeStart = start;
        prevOutcomeEnd = end;

        yield* waitFor(0.75);
      }

      yield* all(
        prevOutcomeStart >= 0 ? outcomeFullCard.resetLineColors(prevOutcomeStart, 0.35) : waitFor(0),
        prevOutcomeEnd >= 0 && prevOutcomeEnd !== prevOutcomeStart ? outcomeFullCard.resetLineColors(prevOutcomeEnd, 0.35) : waitFor(0),
        outcomeFullCard.showAllLines(0.45),
      );
      yield* waitFor(1.0);
      break;
    }

    yield* waitFor(between);
  }

  // End: fade all components out (background stays).
  yield* waitFor(0.6);
  yield* stage().opacity(0, Timing.slow, easeInOutCubic);
});


