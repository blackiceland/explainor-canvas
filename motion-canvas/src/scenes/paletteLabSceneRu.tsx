import {makeScene2D, Rect, Gradient} from '@motion-canvas/2d';
import {waitFor, Vector2} from '@motion-canvas/core';
import {Manticore} from '../core/code/components/Manticore';
import {getCodePaddingX} from '../core/code/shared/TextMeasure';
import {Fonts} from '../core/theme';
import {TRANSPARENT_CARD} from './fiveFacesBooleanV2Setup';
import {
  CanonBg,
  CanonCodeTheme,
  buildCanonRules,
  paintCanonParams,
  paintCanonMethodCalls,
} from '../core/code/model/paletteCanon';

// ── PALETTE LAB · эталон из paletteCanon (дог-фуд) ────────────────────
// Сцена теперь НЕ хардкодит цвета — всё из канон-модуля. Служит референсом.

const SAMPLE = `@Service
class OrderService(
    private val repo: OrderRepository,
    private val payments: PaymentGateway,
) {
    // places an order and charges the customer
    fun place(order: Order, express: Boolean = false): Result {
        require(order.total > 0) { "amount must be positive" }

        val fee = if (express) EXPRESS_FEE else STANDARD_FEE
        val payment = payments.charge(
            account = order.account,
            amount = order.total + fee,
            attempts = 3,
            capture = true,
        )
        val saved = repo.save(order = order, fee = fee, status = PLACED)
        return Result.Placed(saved.id, payment.id)
    }
}`;

const SAMPLE_TYPES = [
  'Service', 'OrderService', 'OrderRepository', 'PaymentGateway',
  'Order', 'Boolean', 'Result', 'Placed', 'OrderStatus',
];
const SAMPLE_METHODS = ['place', 'charge', 'save', 'require'];

const FS = 24;
const LH = 34;

export default makeScene2D(function* (view) {
  view.add(
    <Rect
      x={0} y={0} width={1920} height={1080}
      fill={new Gradient({
        type: 'linear',
        from: new Vector2(0, -540),
        to: new Vector2(0, 540),
        stops: [{offset: 0, color: CanonBg.from}, {offset: 1, color: CanonBg.to}],
      })}
    />,
  );

  const mc = Manticore.create(SAMPLE, {
    x: -504, y: 0,
    width: getCodePaddingX(FS) * 2,
    fontSize: FS, lineHeight: LH,
    fontFamily: Fonts.code, theme: CanonCodeTheme,
    noClip: true, cardStyle: TRANSPARENT_CARD, glowAccent: false,
    customTypes: SAMPLE_TYPES,
  });
  mc.mount(view);
  mc.node.opacity(1);
  mc.colorize(buildCanonRules({types: SAMPLE_TYPES, methods: SAMPLE_METHODS}));
  paintCanonParams(mc);
  paintCanonMethodCalls(mc);

  yield* waitFor(2);
});
