import {makeScene2D} from '@motion-canvas/2d';
import {all, waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {ExplainorCodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingX, getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Colors, Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';
import {textWidth} from '../core/utils/textMeasure';

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

const COMMON_CONDITIONS_CODE = `final class CommonConditions {

  static Condition fromFilter(
    Filter filter, Field<LocalDateTime> createdAt, Field<String> statusField,
    Field<Boolean> deleted, boolean isOrders, boolean isPayments,
    boolean isInvoices
  ) {
    Condition conditions = DSL.trueCondition();

    if (filter.createdSince() != null) {
      conditions = conditions.and(createdAt.ge(filter.createdSince()));
    }

    if (filter.status() != null) {
      conditions = conditions.and(statusField.eq(filter.status()));
    }

    if (isOrders && !filter.includeDeleted()) {
      conditions = conditions.and(deleted.isFalse());
    }

    if (isPayments && filter.currency() != null) {
      conditions = conditions.and(PAYMENTS.CURRENCY.eq(filter.currency()));
    }

    if (isPayments && filter.executedSince() != null) {
      conditions = conditions.and(PAYMENTS.EXECUTED_AT.ge(filter.executedSince()));
    }

    if (isInvoices && filter.invoiceNumber() != null) {
      conditions = conditions.and(INVOICES.NUMBER.eq(filter.invoiceNumber()));
    }

    if (isInvoices && filter.invoiceCurrency() != null) {
      conditions = conditions.and(INVOICES.CURRENCY.eq(filter.invoiceCurrency()));
    }

    if (isInvoices && filter.invoiceMinTotal() != null) {
      conditions = conditions.and(INVOICES.TOTAL_CENTS.ge(filter.invoiceMinTotal()));
    }

    return conditions;
  }
}`;

function codeCardHeight(code: string, lineHeight: number, paddingY: number): number {
  const lines = code.split('\n').length;
  return lines * lineHeight + paddingY * 2;
}

function codeCardWidth(code: string, fontFamily: string, fontSize: number, paddingX: number): number {
  const maxLinePx = Math.max(
    0,
    ...code.split('\n').map(line => textWidth(line, fontFamily, fontSize, 400)),
  );
  const raw = Math.ceil(maxLinePx + paddingX * 2);
  return Math.min(1600, Math.max(900, raw));
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  const fontSize = 16;
  const lineHeight = Math.round(fontSize * 1.7 * 10) / 10;
  const paddingY = getCodePaddingY(fontSize);
  const paddingX = getCodePaddingX(fontSize);
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

  const commonWidth = codeCardWidth(COMMON_CONDITIONS_CODE, Fonts.code, fontSize, paddingX);
  const commonHeight = 920;
  const commonTopMargin = 28;
  const commonBlock = CodeBlock.fromCode(COMMON_CONDITIONS_CODE, {
    x: 0,
    y: 0,
    width: commonWidth,
    height: commonHeight,
    fontSize,
    lineHeight,
    contentOffsetY: commonTopMargin,
    fontFamily: Fonts.code,
    theme: ExplainorCodeTheme,
    customTypes: [
      'CommonConditions',
      'LocalDateTime',
      'Field',
      'Boolean',
      'Condition',
      'DSL',
      'INVOICES',
    ],
  });

  orderBlock.mount(view);
  paymentBlock.mount(view);

  yield* all(
    orderBlock.appear(Timing.slow),
    paymentBlock.appear(Timing.slow),
  );

  const restoreDur = 0.8;
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
    orderBlock.resetLineColors(2, restoreDur),
    orderBlock.resetLineColors(3, restoreDur),
    orderBlock.resetLineColors(5, restoreDur),
    orderBlock.resetLineColors(6, restoreDur),
    orderBlock.resetLineColors(7, restoreDur),
    orderBlock.resetLineColors(8, restoreDur),
    orderBlock.resetLineColors(11, restoreDur),
    orderBlock.resetLineColors(12, restoreDur),
    orderBlock.resetLineColors(15, restoreDur),
    paymentBlock.resetLineColors(2, restoreDur),
    paymentBlock.resetLineColors(3, restoreDur),
    paymentBlock.resetLineColors(5, restoreDur),
    paymentBlock.resetLineColors(6, restoreDur),
    paymentBlock.resetLineColors(7, restoreDur),
    paymentBlock.resetLineColors(8, restoreDur),
    paymentBlock.resetLineColors(11, restoreDur),
    paymentBlock.resetLineColors(12, restoreDur),
    paymentBlock.resetLineColors(15, restoreDur),
    orderBlock.showAllLines(restoreDur),
    paymentBlock.showAllLines(restoreDur),
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
    orderBlock.resetLineColors(0, restoreDur),
    orderBlock.resetLineColors(2, restoreDur),
    orderBlock.resetLineColors(7, restoreDur),
    orderBlock.resetLineColors(12, restoreDur),
    paymentBlock.resetLineColors(0, restoreDur),
    paymentBlock.resetLineColors(2, restoreDur),
    paymentBlock.resetLineColors(7, restoreDur),
    paymentBlock.resetLineColors(12, restoreDur),
    orderBlock.showAllLines(restoreDur),
    paymentBlock.showAllLines(restoreDur),
  );

  yield* waitFor(0.6);

  yield* all(
    orderBlock.disappear(Timing.slow),
    paymentBlock.disappear(Timing.slow),
  );

  commonBlock.mount(view);

  const commonLines = COMMON_CONDITIONS_CODE.split('\n');
  const commonLineCount2 = commonLines.length;
  const layouts = commonBlock.getLineLayouts();
  const currentY: number[] = layouts.map(l => l.y);

  const pParamsExtra = commonLines.findIndex(l => l.includes('Field<Boolean> deleted'));
  const pIsInvoices = commonLines.findIndex(l => l.trim().startsWith('boolean isInvoices'));

  function expandRangeUp(range: [number, number]): [number, number] {
    let [start, end] = range;
    while (start > 0 && commonLines[start - 1].trim() === '') start--;
    return [start, end];
  }

  const paramsExtraRange: [number, number] | null =
    pParamsExtra >= 0 ? [pParamsExtra, pParamsExtra] : null;
  const isInvoicesParamRange: [number, number] | null =
    pIsInvoices >= 0 ? [pIsInvoices, pIsInvoices] : null;
  const ifOrdersStart = commonLines.findIndex(l => l.includes('if (isOrders && !filter.includeDeleted())'));
  const ifOrdersEnd = ifOrdersStart >= 0
    ? commonLines.findIndex((l, idx) => idx > ifOrdersStart && l.trim() === '}')
    : -1;
  const ifOrdersRangeRaw: [number, number] | null =
    ifOrdersStart >= 0 && ifOrdersEnd >= ifOrdersStart ? [ifOrdersStart, ifOrdersEnd] : null;
  const ifOrdersRange: [number, number] | null =
    ifOrdersRangeRaw ? expandRangeUp(ifOrdersRangeRaw) : null;

  const ifCurrencyStart = commonLines.findIndex(l => l.includes('if (isPayments && filter.currency() != null)'));
  const ifCurrencyEnd = ifCurrencyStart >= 0
    ? commonLines.findIndex((l, idx) => idx > ifCurrencyStart && l.trim() === '}')
    : -1;
  const ifCurrencyRangeRaw: [number, number] | null =
    ifCurrencyStart >= 0 && ifCurrencyEnd >= ifCurrencyStart ? [ifCurrencyStart, ifCurrencyEnd] : null;
  const ifCurrencyRange: [number, number] | null =
    ifCurrencyRangeRaw ? expandRangeUp(ifCurrencyRangeRaw) : null;

  const ifExecutedStart = commonLines.findIndex(l => l.includes('if (isPayments && filter.executedSince() != null)'));
  const ifExecutedEnd = ifExecutedStart >= 0
    ? commonLines.findIndex((l, idx) => idx > ifExecutedStart && l.trim() === '}')
    : -1;
  const ifExecutedRangeRaw: [number, number] | null =
    ifExecutedStart >= 0 && ifExecutedEnd >= ifExecutedStart ? [ifExecutedStart, ifExecutedEnd] : null;
  const ifExecutedRange: [number, number] | null =
    ifExecutedRangeRaw ? expandRangeUp(ifExecutedRangeRaw) : null;

  const invoiceStarts: number[] = [];
  for (let i = 0; i < commonLineCount2; i++) {
    if (commonLines[i].includes('if (isInvoices')) invoiceStarts.push(i);
  }
  let invoicesRange: [number, number] | null = null;
  if (invoiceStarts.length > 0) {
    const start = invoiceStarts[0];
    let end = -1;
    for (const s of invoiceStarts) {
      const e = commonLines.findIndex((l, idx) => idx > s && l.trim() === '}');
      if (e > end) end = e;
    }
    if (end >= start) invoicesRange = expandRangeUp([start, end]);
  }

  const hidden: boolean[] = new Array(commonLineCount2).fill(false);
  if (paramsExtraRange) {
    for (let i = paramsExtraRange[0]; i <= paramsExtraRange[1]; i++) hidden[i] = true;
  }
  if (isInvoicesParamRange) {
    for (let i = isInvoicesParamRange[0]; i <= isInvoicesParamRange[1]; i++) hidden[i] = true;
  }
  if (ifOrdersRange) {
    for (let i = ifOrdersRange[0]; i <= ifOrdersRange[1]; i++) hidden[i] = true;
  }
  if (ifCurrencyRange) {
    for (let i = ifCurrencyRange[0]; i <= ifCurrencyRange[1]; i++) hidden[i] = true;
  }
  if (ifExecutedRange) {
    for (let i = ifExecutedRange[0]; i <= ifExecutedRange[1]; i++) hidden[i] = true;
  }
  if (invoicesRange) {
    for (let i = invoicesRange[0]; i <= invoicesRange[1]; i++) hidden[i] = true;
  }

  const hiddenAboveCount: number[] = new Array(commonLineCount2).fill(0);
  let hiddenSoFar = 0;
  for (let i = 0; i < commonLineCount2; i++) {
    hiddenAboveCount[i] = hiddenSoFar;
    if (hidden[i]) hiddenSoFar++;
  }

  for (let i = 0; i < commonLineCount2; i++) {
    currentY[i] = layouts[i].y - hiddenAboveCount[i] * lineHeight;
    commonBlock.setLinePosition(i, currentY[i]);
    if (hidden[i]) commonBlock.setLineOpacity(i, 0);
  }

  if (pParamsExtra >= 0) {
    commonBlock.setTokenOpacityAt(pParamsExtra, -1, 0);
  }

  yield* commonBlock.appear(Timing.slow);

  yield* waitFor(0.6);

  if (paramsExtraRange) {
    yield* commonBlock.animateInsertLines(paramsExtraRange, currentY, Timing.slow);
  }

  yield* waitFor(0.5);

  if (ifOrdersRange) {
    yield* commonBlock.animateInsertLines(ifOrdersRange, currentY, Timing.slow);
  }

  yield* waitFor(0.45);

  if (ifCurrencyRange) {
    yield* commonBlock.animateInsertLines(ifCurrencyRange, currentY, Timing.slow);
  }

  yield* waitFor(0.45);

  if (ifExecutedRange) {
    yield* commonBlock.animateInsertLines(ifExecutedRange, currentY, Timing.slow);
  }

  yield* waitFor(0.45);

  if (isInvoicesParamRange) {
    yield* all(
      commonBlock.animateInsertLines(isInvoicesParamRange, currentY, Timing.slow),
      commonBlock.animateTokenOpacityAt(pParamsExtra, -1, 1, Timing.slow),
    );
  }

  yield* waitFor(0.45);

  if (invoicesRange) {
    yield* commonBlock.animateInsertLines(invoicesRange, currentY, Timing.slow);
  }

  yield* waitFor(0.3);

  const clipHeight = commonHeight - paddingY * 2;
  const bottomMargin = 8;
  const lastLineIndex = commonLineCount2 - 1;
  const targetLastY = clipHeight / 2 - lineHeight / 2 - bottomMargin;
  const scrollAmount = Math.max(0, currentY[lastLineIndex] - targetLastY);
  yield* commonBlock.animateScrollY(scrollAmount, Timing.slow);

  yield* waitFor(16);
});


