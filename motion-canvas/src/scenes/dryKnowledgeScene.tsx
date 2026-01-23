import {makeScene2D, Node, Txt} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, Vector2, waitFor} from '@motion-canvas/core';
import {Colors, Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {ExplainorCodeTheme} from '../core/code/model/SyntaxTheme';
import {SafeZone} from '../core/ScreenGrid';
import {getCodePaddingY, getLineHeight} from '../core/code/shared/TextMeasure';

const RETRY_POLICY_CODE = `class PaymentRetryPolicy {

  boolean shouldRetry(PspCode code) {
    return switch (code) {
      case TIMEOUT, SOFT_DECLINE, DO_NOT_HONOR -> true;
      default -> false;
    };
  }
}`;

const STATUS_MAPPER_CODE = `class PaymentStatusMapper {

  PaymentStatus map(PspCode code) {
    return switch (code) {
      case TIMEOUT -> PaymentStatus.PENDING;
      case SOFT_DECLINE -> PaymentStatus.RETRYING;
      case DO_NOT_HONOR -> PaymentStatus.DECLINED;
      case THREE_DS_REQUIRED -> PaymentStatus.REQUIRES_3DS;
      default -> PaymentStatus.FAILED;
    };
  }
}`;

const USER_MESSAGE_CODE = `class CheckoutUserMessage {

  CheckoutHint message(PspCode code) {
    return switch (code) {
      case SOFT_DECLINE -> CheckoutHint.TRY_AGAIN;
      case DO_NOT_HONOR -> CheckoutHint.TRY_ANOTHER_CARD;
      case THREE_DS_REQUIRED -> CheckoutHint.CONFIRM_3DS;
      case TIMEOUT -> CheckoutHint.RETRY_LATER;
      default -> CheckoutHint.GENERIC_FAIL;
    };
  }
}`;

export default makeScene2D(function* (view) {
    applyBackground(view);

    const quoteContainer = createRef<Node>();
    const knowledgeWord = createRef<Txt>();
    const knowledgeClone = createRef<Txt>();

    view.add(
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
        </Node>
    );

    view.add(
        <Txt
            ref={knowledgeClone}
            text="knowledge"
            fontFamily={Fonts.primary}
            fontSize={36}
            fontWeight={600}
            fill={Colors.accent}
            opacity={0}
        />
    );

    yield* quoteContainer().opacity(1, Timing.slow, easeInOutCubic);

    yield* waitFor(2);

    const wordPos = knowledgeWord().absolutePosition();
    // Snap to full pixels to avoid tiny "jitter" during fade-out.
    knowledgeClone().absolutePosition(new Vector2(Math.round(wordPos.x), Math.round(wordPos.y)));
    knowledgeClone().opacity(1);
    knowledgeWord().opacity(0);

    // Fade out the quote, but keep the extracted word on screen.
    yield* quoteContainer().opacity(0, Timing.slow, easeInOutCubic);

    // Keep the word in-place for a beat, then fade it out (no movement).
    yield* waitFor(2.2);

    yield* knowledgeClone().opacity(0, Timing.slow, easeInOutCubic);

    yield* waitFor(0.4);

    // Layout like `dryFiltersScene`: two cards on the left column, one card on the right (top).
    const gap = 120;
    const totalWidth = SafeZone.right - SafeZone.left;
    const cardWidth = (totalWidth - gap) / 2;
    const codeX = SafeZone.left + cardWidth / 2;
    const tableX = SafeZone.right - cardWidth / 2;

    const fontSize = 16;
    const stackGap = 60; // Same as STACK_GAP in ScreenGrid.ts
    const targetLines = 14; // Matches the "tall" cards feel from dryFiltersScene.
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
    retryCard.mount(view);

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
    statusCard.mount(view);

    const messageCard = CodeBlock.fromCode(USER_MESSAGE_CODE, {
        x: tableX,
        y: topY,
        width: cardWidth,
        height: cardHeight,
        fontSize,
        fontFamily: Fonts.code,
        theme: ExplainorCodeTheme,
        customTypes: ['CheckoutHint', 'CheckoutUserMessage', 'PspCode'],
    });
    messageCard.mount(view);

    yield* all(retryCard.appear(Timing.slow), statusCard.appear(Timing.slow), messageCard.appear(Timing.slow));

    yield* waitFor(3);
});
