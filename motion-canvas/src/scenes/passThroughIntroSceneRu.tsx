import {makeScene2D, Rect} from '@motion-canvas/2d';
import {all, easeInOutCubic, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Fonts, Screen, Timing} from '../core/theme';
import {CODE_CARD_STYLE} from './codeWithActionsSceneRu.config';

const PASS_THROUGH_CODE = `Order checkout(Cart cart, String promoCode, String region) {
    Inventory stock = warehouse.reserve(cart.items());
    Payment payment = billing.charge(cart, promoCode);
    return shipping.dispatch(stock, payment, region);
}

Payment charge(Cart cart, String promoCode) {
    BigDecimal total = calculator.computeTotal(cart);
    Discount discount = promotions.resolve(promoCode);
    BigDecimal finalPrice = total.subtract(discount.amount());
    return gateway.process(finalPrice, promoCode);
}

ShippingResult dispatch(Inventory stock, Payment payment, String region) {
    Carrier carrier = carrierSelector.forRegion(region);
    Parcel parcel = packer.pack(stock, carrier);
    return carrier.ship(parcel, payment, region);
}`;

export default makeScene2D(function* (view) {
  view.add(<Rect width={Screen.width} height={Screen.height} fill={'#03050a'} />);

  const fontSize = 30;
  const lineHeight = Math.round(fontSize * 1.62 * 10) / 10;
  const topInset = Math.max(8, getCodePaddingY(fontSize) - 8);
  const blockHeight = SafeZone.bottom - SafeZone.top - 30;
  const blockWidth = SafeZone.right - SafeZone.left + 200;

  const code = CodeBlock.fromCode(PASS_THROUGH_CODE, {
    x: 0,
    y: 0,
    width: blockWidth,
    height: blockHeight,
    fontSize,
    lineHeight,
    contentOffsetX: 20,
    contentOffsetY: topInset,
    fontFamily: Fonts.code,
    theme: {
      ...DryFiltersV3CodeTheme,
      plain: 'rgba(220,225,238,0.92)',
      punctuation: 'rgba(180,188,206,0.78)',
      operator: 'rgba(175,185,205,0.75)',
      keyword: 'rgba(145,178,225,0.88)',
      type: 'rgba(178,165,218,0.85)',
      method: 'rgba(225,232,250,0.95)',
      string: 'rgba(185,195,215,0.82)',
      number: 'rgba(172,160,218,0.85)',
      comment: 'rgba(120,128,148,0.62)',
    },
    cardStyle: {...CODE_CARD_STYLE, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)'},
    glowAccent: false,
    customTypes: [
      'Order', 'Cart', 'Inventory', 'Payment', 'BigDecimal',
      'Discount', 'ShippingResult', 'Carrier', 'Parcel',
    ],
  });
  code.mount(view);

  const lines = PASS_THROUGH_CODE.split('\n');

  const VAR_LIGHT = 'rgba(244,241,235,0.96)';
  const TYPE_CLEAN = 'rgba(220,215,255,0.80)';
  const SOFT_GREEN = 'rgba(168,214,178,0.88)';

  const variableTokens = [
    'cart', 'promoCode', 'region', 'stock', 'payment',
    'total', 'discount', 'finalPrice', 'carrier', 'parcel',
  ];
  const staticTypes = [
    'Order', 'Cart', 'Inventory', 'Payment', 'BigDecimal',
    'Discount', 'ShippingResult', 'Carrier', 'Parcel', 'String',
  ];
  const methodCalls = [
    'reserve', 'charge', 'dispatch', 'computeTotal', 'resolve',
    'subtract', 'amount', 'process', 'forRegion', 'pack', 'ship',
    'items', 'checkout',
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const vars = variableTokens.filter(t => new RegExp(`\\b${t}\\b`).test(line));
    if (vars.length > 0) yield* code.recolorTokens(i, vars, VAR_LIGHT, 0);
    const types = staticTypes.filter(t => line.includes(t));
    if (types.length > 0) yield* code.recolorTokens(i, types, TYPE_CLEAN, 0);
    const methods = methodCalls.filter(t => line.includes(t));
    if (methods.length > 0) yield* code.recolorTokens(i, methods, DryFiltersV3CodeTheme.method, 0);
  }

  yield* code.appear(Timing.normal);
  yield* waitFor(4);
  yield* code.disappear(Timing.normal);
  yield* waitFor(0.5);
});
