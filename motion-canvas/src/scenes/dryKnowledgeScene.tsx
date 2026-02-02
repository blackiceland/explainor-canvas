import {makeScene2D, Node, Txt} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, Vector2, waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {ExplainorCodeTheme} from '../core/code/model/SyntaxTheme';
import {SafeZone} from '../core/ScreenGrid';
import {getCodePaddingY, getLineHeight} from '../core/code/shared/TextMeasure';
import {Colors, Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

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

export default makeScene2D(function* (view) {
  applyBackground(view);

  // Put all animated content into a stage so we can zoom without moving the background.
  const stage = createRef<Node>();
  view.add(<Node ref={stage} />);

  const quoteContainer = createRef<Node>();
  const knowledgeWord = createRef<Txt>();
  const knowledgeClone = createRef<Txt>();

  stage().add(
    <Node ref={quoteContainer} opacity={0} y={-20}>
      <Txt
        fontFamily={Fonts.primary}
        fontSize={36}
        fill={Colors.text.primary}
        textAlign="center"
        y={-50}
      >
        Every piece of <Txt ref={knowledgeWord} fill={Colors.accent} fontWeight={600}>knowledge</Txt> must have
      </Txt>
      <Txt
        fontFamily={Fonts.primary}
        fontSize={36}
        fill={Colors.text.primary}
        textAlign="center"
        y={0}
      >
        a single, unambiguous, authoritative
      </Txt>
      <Txt
        fontFamily={Fonts.primary}
        fontSize={36}
        fill={Colors.text.primary}
        textAlign="center"
        y={50}
      >
        representation within a system
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

  stage().add(
    <Txt
      ref={knowledgeClone}
      text="knowledge"
      fontFamily={Fonts.primary}
      fontSize={36}
      fontWeight={600}
      fill={Colors.accent}
      opacity={0}
    />,
  );

  yield* quoteContainer().opacity(1, Timing.slow, easeInOutCubic);
  yield* waitFor(2);

  const wordPos = knowledgeWord().absolutePosition();
  knowledgeClone().absolutePosition(new Vector2(Math.round(wordPos.x), Math.round(wordPos.y)));
  knowledgeClone().opacity(1);
  knowledgeWord().opacity(0);

  yield* quoteContainer().opacity(0, Timing.slow, easeInOutCubic);
  yield* waitFor(2.2);
  yield* knowledgeClone().opacity(0, Timing.slow, easeInOutCubic);
  yield* waitFor(0.4);

  // Layout like `dryFiltersScene`: two cards on the left column, one card on the right (top).
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
    theme: ExplainorCodeTheme,
    customTypes: ['PaymentRetryPolicy', 'PspCode'],
  });
  retryCard.mount(stage());

  const statusCard = CodeBlock.fromCode(STATUS_MAPPER_CODE, {
    x: codeX,
    y: topY + cardHeight + stackGap,
    width: cardWidth,
    height: cardHeight,
    fontSize,
    fontFamily: Fonts.code,
    theme: ExplainorCodeTheme,
    customTypes: ['PaymentStatusMapper', 'PspCode', 'PaymentStatus'],
  });
  statusCard.mount(stage());

  const nextStepCard = CodeBlock.fromCode(CHECKOUT_NEXT_STEP_CODE, {
    x: tableX,
    y: topY,
    width: cardWidth,
    height: cardHeight,
    fontSize,
    fontFamily: Fonts.code,
    theme: ExplainorCodeTheme,
    customTypes: ['CheckoutNextStep', 'CheckoutNextStepMapper', 'PspCode'],
  });
  nextStepCard.mount(stage());

  // Empty placeholder card (no text) that we zoom into.
  const outcomeEmptyCard = CodeBlock.fromCode('', {
    x: tableX,
    y: topY + cardHeight + stackGap,
    width: cardWidth,
    height: cardHeight,
    fontSize,
    fontFamily: Fonts.code,
    theme: ExplainorCodeTheme,
    customTypes: [],
  });
  outcomeEmptyCard.mount(stage());
  outcomeEmptyCard.node.opacity(0);

  // Full implementation shown after zoom (smaller font so it fits).
  const outcomeFullCard = CodeBlock.fromCode(OUTCOME_MAPPER_CODE, {
    x: tableX,
    y: topY + cardHeight + stackGap,
    width: cardWidth,
    height: cardHeight,
    fontSize: 13,
    fontFamily: Fonts.code,
    theme: ExplainorCodeTheme,
    customTypes: ['PspOutcomeMapper', 'Outcome', 'PspCode', 'PaymentStatus', 'CheckoutNextStep'],
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

      const line = statusCard.getLine(statusIdx);
      const pendingToken = line?.findToken('PENDING') ?? null;
      const overlayRef = createRef<Txt>();

      // Pink background just for the changing line (under tokens).
      if (line) {
        yield* line.showBackground(timeoutBg, timeoutBgIn);
      }

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

      const swapDur = 0.6;
      yield* all(
        statusCard.setLineTokensOpacityMatching(statusIdx, ['PENDING', ';'], 0, swapDur),
        overlayRef() ? overlayRef().opacity(1, swapDur, easeInOutCubic) : waitFor(0),
      );

      yield* waitFor(0.55);

      // Release dimming.
      yield* all(
        prevRetry >= 0 ? retryCard.resetLineColors(prevRetry, highlightOut) : waitFor(0),
        prevStatus >= 0 ? statusCard.resetLineColors(prevStatus, highlightOut) : waitFor(0),
        prevNext >= 0 ? nextStepCard.resetLineColors(prevNext, highlightOut) : waitFor(0),
        retryCard.showAllLines(highlightOut),
        line ? line.hideBackground(highlightOut) : waitFor(0),
        statusCard.showAllLines(highlightOut),
        nextStepCard.showAllLines(highlightOut),
      );

      // Empty card → zoom → show full code in smaller font.
      yield* waitFor(0.25);
      yield* outcomeEmptyCard.appear(Timing.slow);

      const zoomScale = 1.7;
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

  // Outro: smoothly fade out all components (keep background).
  yield* waitFor(0.35);
  yield* stage().opacity(0, Timing.slow * 1.1, easeInOutCubic);
  yield* waitFor(0.2);
});
