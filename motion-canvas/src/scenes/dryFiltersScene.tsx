import {makeScene2D} from '@motion-canvas/2d';
import {waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {ExplainorCodeTheme} from '../core/code/model/SyntaxTheme';
import {Position, Size, NoCardStyle} from '../core/ScreenGrid';
import {Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

const PAYMENT_REPO_CODE = `final class PaymentRepository {
  private final DSLContext dsl;

  PaymentRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  List<PaymentRecord> find(PaymentSearchFilter filter) {
    Condition where = PaymentConditions.fromFilter(filter);
    return dsl.selectFrom(PAYMENTS).where(where).fetch();
  }
}`;

export default makeScene2D(function* (view) {
  applyBackground(view);

  // PaymentRepository, TL, M, nocard
  const paymentRepo = CodeBlock.fromCode(PAYMENT_REPO_CODE, {
    x: Position.TL.x,
    y: Position.TL.y,
    width: Size.M,
    fontFamily: Fonts.code,
    theme: ExplainorCodeTheme,
    cardStyle: NoCardStyle,
    customTypes: [
      'PaymentRepository',
      'DSLContext', 
      'PaymentRecord',
      'PaymentSearchFilter',
      'Condition',
      'PaymentConditions',
    ],
  });

  paymentRepo.mount(view);
  yield* paymentRepo.appear(Timing.slow);
  
  yield* waitFor(3);
});
