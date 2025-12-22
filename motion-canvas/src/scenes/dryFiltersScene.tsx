import {makeScene2D} from '@motion-canvas/2d';
import {waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {ExplainorCodeTheme} from '../core/code/model/SyntaxTheme';
import {placeCodeStack} from '../core/ScreenGrid';
import {Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

const PAYMENT_REPO_CODE = `final class PaymentRepository {

  private final DSLContext dsl;

  PaymentRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  List<PaymentRecord> find(PaymentSearchFilter filter) {
    Condition condition = PaymentConditions.fromFilter(filter);

    return dsl.selectFrom(PAYMENTS)
      .where(condition)
      .fetch();
  }
}`;

const ORDER_REPO_CODE = `final class OrderRepository {

  private final DSLContext dsl;

  OrderRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  List<OrderRecord> find(OrderSearchFilter filter) {
    Condition condition = OrderConditions.fromFilter(filter);

    return dsl.selectFrom(ORDERS)
      .where(condition)
      .fetch();
  }
}`;

export default makeScene2D(function* (view) {
  applyBackground(view);

  const layouts = placeCodeStack([PAYMENT_REPO_CODE, ORDER_REPO_CODE], 'L', 16);
  const [paymentLayout, orderLayout] = layouts;
  
  const paymentRepo = CodeBlock.fromCode(PAYMENT_REPO_CODE, {
    x: paymentLayout.x,
    y: paymentLayout.y,
    width: paymentLayout.width,
    height: paymentLayout.height,
    fontSize: paymentLayout.fontSize,
    fontFamily: Fonts.code,
    theme: ExplainorCodeTheme,
    customTypes: [
      'PaymentRepository',
      'DSLContext', 
      'PaymentRecord',
      'PaymentSearchFilter',
      'Condition',
      'PaymentConditions',
    ],
  });

  const orderRepo = CodeBlock.fromCode(ORDER_REPO_CODE, {
    x: orderLayout.x,
    y: orderLayout.y,
    width: orderLayout.width,
    height: orderLayout.height,
    fontSize: orderLayout.fontSize,
    fontFamily: Fonts.code,
    theme: ExplainorCodeTheme,
    customTypes: [
      'OrderRepository',
      'DSLContext',
      'OrderRecord',
      'OrderSearchFilter',
      'Condition',
      'OrderConditions',
    ],
  });

  paymentRepo.mount(view);
  yield* paymentRepo.appear(Timing.slow);
  
  yield* waitFor(2);
  
  orderRepo.mount(view);
  yield* orderRepo.appear(Timing.slow);
  
  yield* waitFor(3);
});
