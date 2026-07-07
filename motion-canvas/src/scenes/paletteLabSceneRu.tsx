import {makeScene2D, Rect, Gradient} from '@motion-canvas/2d';
import {waitFor, Vector2} from '@motion-canvas/core';
import {Manticore, ColorRule} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingX} from '../core/code/shared/TextMeasure';
import {Fonts} from '../core/theme';
import {CODE_RULES, TRANSPARENT_CARD} from './fiveFacesBooleanV2Setup';

// ── PALETTE LAB · выбранный костяк, крупно ────────────────────────────
// Фон поднятый графит; типы освежены ~5%; поля (котлин-дефолты) свежие;
// константы — воздушный тил (BL); методы — продакшн rose (тон вызовов ещё
// не зафиксирован).

const BG_FROM = '#15161A';
const BG_TO   = '#1C1E24';

const FIX_TYPE  = 'rgba(205,198,250,0.90)';  // тип, освежён ~5%
const FIX_PARAM = '#85B0DC';                 // поля-аргументы (fee =), свежие
const FIX_CONST = '#A2CDD6';                 // константы — воздушный тил (BL)
const CALL_TONE = '#FFAEC0';                 // вызовы — чистый пастельный роуз (тинт К БЕЛОМУ, не к серому)

const METHODS = new Set(['place', 'charge', 'save']);

const SAMPLE = `@Service
class OrderService(
    private val repo: OrderRepository,
    private val payments: PaymentGateway,
) {
    fun place(order: Order, express: Boolean = false): Result {
        val fee = if (express) EXPRESS_FEE else STANDARD_FEE
        val payment = payments.charge(
            account = order.account,
            amount = order.total + fee,
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

const RULES: ColorRule[] = [
  ...CODE_RULES,
  {match: /^[A-Z][a-zA-Z0-9]*$/, color: FIX_TYPE, onlyTypes: ['type'] as const},
  {match: new RegExp('^(' + SAMPLE_TYPES.join('|') + ')$'), color: FIX_TYPE},
  {match: /^[A-Z][A-Z0-9_]+$/, color: FIX_CONST},
];

const prevNonSpace = (toks: any[], i: number): string => {
  let p = i - 1;
  while (p >= 0 && toks[p].text.trim() === '') p--;
  return p >= 0 ? toks[p].text.trim() : '';
};

const paintParams = (mc: Manticore): void => {
  for (let li = 0; li < mc.lineCount; li++) {
    const line = mc.getLine(li);
    if (!line) continue;
    const toks = line.tokens;
    for (let i = 0; i < toks.length; i++) {
      if (!/^[a-z][a-zA-Z0-9_]*$/.test(toks[i].text.trim())) continue;
      let n = i + 1;
      while (n < toks.length && toks[n].text.trim() === '') n++;
      if (n >= toks.length || toks[n].text.trim() !== '=') continue;
      const prev = prevNonSpace(toks, i);
      if (prev === 'val' || prev === 'var') continue;
      toks[i].ref().fill(FIX_PARAM);
    }
  }
};

// Вызовы метода → CALL_TONE; определение (после `fun`) остаётся rose.
const paintCalls = (mc: Manticore): void => {
  for (let li = 0; li < mc.lineCount; li++) {
    const line = mc.getLine(li);
    if (!line) continue;
    const toks = line.tokens;
    for (let i = 0; i < toks.length; i++) {
      if (!METHODS.has(toks[i].text.trim())) continue;
      if (prevNonSpace(toks, i) === 'fun') continue;   // определение — не трогаем
      toks[i].ref().fill(CALL_TONE);
    }
  }
};

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
        stops: [{offset: 0, color: BG_FROM}, {offset: 1, color: BG_TO}],
      })}
    />,
  );

  const mc = Manticore.create(SAMPLE, {
    x: -504, y: 0,
    width: getCodePaddingX(FS) * 2,
    fontSize: FS, lineHeight: LH,
    fontFamily: Fonts.code, theme: DryFiltersV3CodeTheme,
    noClip: true, cardStyle: TRANSPARENT_CARD, glowAccent: false,
    customTypes: SAMPLE_TYPES,
  });
  mc.mount(view);
  mc.node.opacity(1);
  mc.colorize(RULES);
  paintParams(mc);
  paintCalls(mc);

  yield* waitFor(2);
});
