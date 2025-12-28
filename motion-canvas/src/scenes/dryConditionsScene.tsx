import {makeScene2D} from '@motion-canvas/2d';
import {all, waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {ExplainorCodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Colors, Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

const ORDER_CONDITIONS_CODE = `final class OrderConditions {

  static Condition fromFilter(OrderSearchFilter filter) {
    Condition conditions = DSL.trueCondition();

    if (filter.createdSince() != null) {
      conditions = conditions.and(
        ORDERS.CREATED_AT.ge(filter.createdSince())
      );
    }

    if (filter.status() != null) {
      conditions = conditions.and(ORDERS.STATUS.eq(filter.status()));
    }

    return conditions;
  }
}`;

const PAYMENT_CONDITIONS_CODE = `final class PaymentConditions {

  static Condition fromFilter(PaymentSearchFilter filter) {
    Condition conditions = DSL.trueCondition();

    if (filter.createdSince() != null) {
      conditions = conditions.and(
        PAYMENTS.CREATED_AT.ge(filter.createdSince())
      );
    }

    if (filter.status() != null) {
      conditions = conditions.and(PAYMENTS.STATUS.eq(filter.status()));
    }

    return conditions;
  }
}`;

function codeCardHeight(code: string, lineHeight: number, paddingY: number): number {
  const lines = code.split('\n').length;
  return lines * lineHeight + paddingY * 2;
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  const fontSize = 16;
  const lineHeight = Math.round(fontSize * 1.7 * 10) / 10;
  const paddingY = getCodePaddingY(fontSize);
  const gap = 120;
  const totalWidth = SafeZone.right - SafeZone.left;
  const cardWidth = (totalWidth - gap) / 2;
  const leftX = SafeZone.left + cardWidth / 2;
  const rightX = SafeZone.right - cardWidth / 2;

  const height = Math.max(
    codeCardHeight(ORDER_CONDITIONS_CODE, lineHeight, paddingY),
    codeCardHeight(PAYMENT_CONDITIONS_CODE, lineHeight, paddingY),
  );

  const orderBlock = CodeBlock.fromCode(ORDER_CONDITIONS_CODE, {
    x: leftX,
    y: 0,
    width: cardWidth,
    height,
    fontSize,
    lineHeight,
    fontFamily: Fonts.code,
    theme: ExplainorCodeTheme,
    customTypes: ['OrderConditions', 'OrderSearchFilter', 'Condition', 'DSL'],
  });

  const paymentBlock = CodeBlock.fromCode(PAYMENT_CONDITIONS_CODE, {
    x: rightX,
    y: 0,
    width: cardWidth,
    height,
    fontSize,
    lineHeight,
    fontFamily: Fonts.code,
    theme: ExplainorCodeTheme,
    customTypes: ['PaymentConditions', 'PaymentSearchFilter', 'Condition', 'DSL'],
  });

  orderBlock.mount(view);
  paymentBlock.mount(view);

  yield* all(
    orderBlock.appear(Timing.slow),
    paymentBlock.appear(Timing.slow),
  );

  const stepDur = 0.5;
  const stepGap = 0.16;

  function* syncLine(orderLine: number, paymentLine: number) {
    yield* all(
      all(
        orderBlock.highlightLines([[orderLine, orderLine]], stepDur),
        orderBlock.recolorLine(orderLine, Colors.accent, stepDur),
      ),
      all(
        paymentBlock.highlightLines([[paymentLine, paymentLine]], stepDur),
        paymentBlock.recolorLine(paymentLine, Colors.accent, stepDur),
      ),
    );
    yield* waitFor(stepGap);
    yield* waitFor(stepGap);
  }

  yield* waitFor(0.35);

  yield* syncLine(2, 2);
  yield* syncLine(3, 3);
  yield* syncLine(5, 5);
  yield* syncLine(6, 6);
  yield* syncLine(7, 7);
  yield* syncLine(8, 8);
  yield* syncLine(11, 11);
  yield* syncLine(12, 12);
  yield* syncLine(15, 15);

  yield* all(
    orderBlock.resetLineColors(2, 0.35),
    orderBlock.resetLineColors(3, 0.35),
    orderBlock.resetLineColors(5, 0.35),
    orderBlock.resetLineColors(6, 0.35),
    orderBlock.resetLineColors(7, 0.35),
    orderBlock.resetLineColors(8, 0.35),
    orderBlock.resetLineColors(11, 0.35),
    orderBlock.resetLineColors(12, 0.35),
    orderBlock.resetLineColors(15, 0.35),
    paymentBlock.resetLineColors(2, 0.35),
    paymentBlock.resetLineColors(3, 0.35),
    paymentBlock.resetLineColors(5, 0.35),
    paymentBlock.resetLineColors(6, 0.35),
    paymentBlock.resetLineColors(7, 0.35),
    paymentBlock.resetLineColors(8, 0.35),
    paymentBlock.resetLineColors(11, 0.35),
    paymentBlock.resetLineColors(12, 0.35),
    paymentBlock.resetLineColors(15, 0.35),
    orderBlock.showAllLines(0.35),
    paymentBlock.showAllLines(0.35),
  );

  yield* waitFor(0.35);

  yield* all(
    all(
      orderBlock.highlightLines([[0, 0], [2, 2], [7, 7], [12, 12]], Timing.slow),
      orderBlock.recolorTokens(0, ['OrderConditions'], Colors.accent, Timing.slow),
      orderBlock.recolorTokens(2, ['OrderSearchFilter'], Colors.accent, Timing.slow),
      orderBlock.recolorTokens(7, ['ORDERS'], Colors.accent, Timing.slow),
      orderBlock.recolorTokens(12, ['ORDERS'], Colors.accent, Timing.slow),
    ),
    all(
      paymentBlock.highlightLines([[0, 0], [2, 2], [7, 7], [12, 12]], Timing.slow),
      paymentBlock.recolorTokens(0, ['PaymentConditions'], Colors.accent, Timing.slow),
      paymentBlock.recolorTokens(2, ['PaymentSearchFilter'], Colors.accent, Timing.slow),
      paymentBlock.recolorTokens(7, ['PAYMENTS'], Colors.accent, Timing.slow),
      paymentBlock.recolorTokens(12, ['PAYMENTS'], Colors.accent, Timing.slow),
    ),
  );

  const diffPulseLow = 'rgba(255, 140, 163, 0.72)';
  const diffPulseDur = 0.16;

  yield* waitFor(0.25);

  for (let i = 0; i < 2; i++) {
    yield* all(
      all(
        orderBlock.recolorTokens(0, ['OrderConditions'], diffPulseLow, diffPulseDur),
        orderBlock.recolorTokens(2, ['OrderSearchFilter'], diffPulseLow, diffPulseDur),
        orderBlock.recolorTokens(7, ['ORDERS'], diffPulseLow, diffPulseDur),
        orderBlock.recolorTokens(12, ['ORDERS'], diffPulseLow, diffPulseDur),
      ),
      all(
        paymentBlock.recolorTokens(0, ['PaymentConditions'], diffPulseLow, diffPulseDur),
        paymentBlock.recolorTokens(2, ['PaymentSearchFilter'], diffPulseLow, diffPulseDur),
        paymentBlock.recolorTokens(7, ['PAYMENTS'], diffPulseLow, diffPulseDur),
        paymentBlock.recolorTokens(12, ['PAYMENTS'], diffPulseLow, diffPulseDur),
      ),
    );

    yield* all(
      all(
        orderBlock.recolorTokens(0, ['OrderConditions'], Colors.accent, diffPulseDur),
        orderBlock.recolorTokens(2, ['OrderSearchFilter'], Colors.accent, diffPulseDur),
        orderBlock.recolorTokens(7, ['ORDERS'], Colors.accent, diffPulseDur),
        orderBlock.recolorTokens(12, ['ORDERS'], Colors.accent, diffPulseDur),
      ),
      all(
        paymentBlock.recolorTokens(0, ['PaymentConditions'], Colors.accent, diffPulseDur),
        paymentBlock.recolorTokens(2, ['PaymentSearchFilter'], Colors.accent, diffPulseDur),
        paymentBlock.recolorTokens(7, ['PAYMENTS'], Colors.accent, diffPulseDur),
        paymentBlock.recolorTokens(12, ['PAYMENTS'], Colors.accent, diffPulseDur),
      ),
    );
  }

  yield* waitFor(2);

  yield* all(
    orderBlock.resetLineColors(0, 0.4),
    orderBlock.resetLineColors(2, 0.4),
    orderBlock.resetLineColors(7, 0.4),
    orderBlock.resetLineColors(12, 0.4),
    paymentBlock.resetLineColors(0, 0.4),
    paymentBlock.resetLineColors(2, 0.4),
    paymentBlock.resetLineColors(7, 0.4),
    paymentBlock.resetLineColors(12, 0.4),
    orderBlock.showAllLines(0.4),
    paymentBlock.showAllLines(0.4),
  );

  yield* waitFor(16);
});


