import {blur, Circle, Line, makeScene2D, Node, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingX, getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Colors, Fonts, Timing} from '../core/theme';
import {PanelStyle} from '../core/panelStyle';
import {applyBackground} from '../core/utils';
import {textWidth} from '../core/utils/textMeasure';

// RU V3 styling: code without cards (no fill/stroke/shadow). сюжет/тайминг = 1:1 с dryConditionsScene.tsx.
const CODE_CARD_STYLE = {
  // Keep rounded corners for moments when the card becomes visible (e.g. commonBlock turns into the blue hub).
  radius: PanelStyle.radius,
  fill: 'rgba(0,0,0,0)',
  stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0,
  shadowColor: 'rgba(0,0,0,0)',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  edge: false,
} as const;

// Quiet contour (warm near-white) — like the "Peace & (Quiet)" reference.
const QUIET_STROKE = 'rgba(252,251,248,0.32)';
const QUIET_GLOW = 'rgba(252,251,248,0.14)';
const QUIET_INNER = 'rgba(252,251,248,0.11)';

// Minimal beige cards (no borders). Text is EXACTLY the same color as the fill.
// Readability comes only from a soft shadow (quiet emboss).
const BEIGE_CARD_FILL = '#E7DCC9';
const BEIGE_TEXT_FILL = BEIGE_CARD_FILL;
const BEIGE_TEXT_SHADOW = 'rgba(0,0,0,0.26)';

// Venn domain circles: subtle beige contour + barely-there fill ("expensive beige").
const DOMAIN_CIRCLE_FILL = 'rgba(231, 220, 201, 0.07)'; // #E7DCC9 @ 7%
const DOMAIN_CIRCLE_STROKE = 'rgba(231, 220, 201, 0.20)'; // #E7DCC9 @ 20%

// Thin framed variant for small code cards (light stroke).
const CODE_CARD_STYLE_FRAMED = {
  ...CODE_CARD_STYLE,
  radius: PanelStyle.radiusSmall,
  stroke: QUIET_STROKE,
  strokeWidth: 1,
  shadowColor: QUIET_GLOW,
  shadowBlur: 3,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
} as const;

// Domain-style cards (same stroke as domain circles, but NO fill) — used for code cards after the lens scene.
const CODE_CARD_STYLE_DOMAIN = {
  ...CODE_CARD_STYLE,
  radius: PanelStyle.radiusSmall,
  fill: 'rgba(0,0,0,0)',
  stroke: DOMAIN_CIRCLE_STROKE,
  strokeWidth: 2,
  shadowColor: 'rgba(0,0,0,0)',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
} as const;

// Same quiet frame, but hidden initially (we reveal after the blue hub appears).
const CODE_CARD_STYLE_FRAMED_HIDDEN = {
  ...CODE_CARD_STYLE_FRAMED,
  strokeWidth: 0,
  shadowBlur: 0,
  shadowColor: 'rgba(0,0,0,0)',
} as const;

function topInsetForFont(fontSize: number): number {
  // Keep a small top margin, but never negative (negative offsets cause top clipping due to clip=true).
  return Math.max(0, 18 - getCodePaddingY(fontSize));
}

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

const DEP_BLUE = '#2C6BFF';
const DEP_LINK_STROKE = 'rgba(219, 213, 202, 0.22)';
const DEP_ALARM = '#E35B66';
const DEP_ALARM_LINK = 'rgba(227, 91, 102, 0.55)';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function edgePoint(
  center: [number, number],
  size: [number, number],
  target: [number, number],
): [number, number] {
  const [cx, cy] = center;
  const [tx, ty] = target;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return [cx, cy];

  const hw = size[0] / 2;
  const hh = size[1] / 2;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);

  const t = Math.min(hw / (ax || 1e-9), hh / (ay || 1e-9));
  return [cx + dx * t, cy + dy * t];
}

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

  // RU V3: make code a bit larger (but stay safely inside SafeZone).
  const fontSize = 18;
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
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE_FRAMED_HIDDEN,
    glowAccent: false,
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
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE_FRAMED_HIDDEN,
    glowAccent: false,
    customTypes: ['PaymentConditions', 'PaymentSearchFilter', 'Condition', 'DSL'],
  });

  const commonWidth = codeCardWidth(COMMON_CONDITIONS_CODE, Fonts.code, fontSize, paddingX);
  const commonHeight = 920;
  const commonTopMargin = Math.max(18, paddingY - 10);
  const commonBlock = CodeBlock.fromCode(COMMON_CONDITIONS_CODE, {
    x: 0,
    y: 0,
    width: commonWidth,
    height: commonHeight,
    fontSize,
    lineHeight,
    // В V3-стиле карточка прозрачная, но клип всё равно активен.
    // Не сдвигаем контент выше верхнего padding, иначе верхняя строка режется.
    contentOffsetY: commonTopMargin,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE_FRAMED_HIDDEN,
    glowAccent: false,
    customTypes: [
      'CommonConditions',
      'LocalDateTime',
      'Field',
      'Boolean',
      'Condition',
      'DSL',
    ],
  });

  orderBlock.mount(view);
  paymentBlock.mount(view);

  yield* all(
    orderBlock.appear(Timing.slow),
    paymentBlock.appear(Timing.slow),
  );

  // RU rhythm tweak (artistic differentiation): keep the same beats, slightly different tempo.
  const restoreDur = 0.76;
  const stepDur = 0.47;
  const stepGap = 0.14;

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

  yield* waitFor(0.32);

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

  yield* waitFor(0.33);

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
  const diffPulseDur = 0.15;

  yield* waitFor(0.24);

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

  yield* waitFor(1.85);

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

  const blurOrders = createSignal(0);
  const blurPayments = createSignal(0);

  orderBlock.node.cache(true);
  paymentBlock.node.cache(true);
  orderBlock.node.cachePadding(120);
  paymentBlock.node.cachePadding(120);

  orderBlock.node.filters(() => [blur(blurOrders())]);
  paymentBlock.node.filters(() => [blur(blurPayments())]);

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

  const defocusDur = Timing.slow;
  const commonLead = 0.33;

  function* appearCommonSoon() {
    yield* waitFor(commonLead);
    yield* commonBlock.appear(Timing.slow);
  }

  yield* all(
    blurOrders(6, defocusDur, easeInOutCubic),
    blurPayments(6, defocusDur, easeInOutCubic),
    orderBlock.node.opacity(0.22, defocusDur, easeInOutCubic),
    paymentBlock.node.opacity(0.22, defocusDur, easeInOutCubic),
    appearCommonSoon(),
  );

  yield* waitFor(0.58);

  if (paramsExtraRange) {
    yield* commonBlock.animateInsertLines(paramsExtraRange, currentY, Timing.slow);
  }

  yield* waitFor(0.48);

  if (ifOrdersRange) {
    yield* commonBlock.animateInsertLines(ifOrdersRange, currentY, Timing.slow);
  }

  yield* waitFor(0.42);

  if (ifCurrencyRange) {
    yield* commonBlock.animateInsertLines(ifCurrencyRange, currentY, Timing.slow);
  }

  yield* waitFor(0.42);

  if (ifExecutedRange) {
    yield* commonBlock.animateInsertLines(ifExecutedRange, currentY, Timing.slow);
  }

  yield* waitFor(0.42);

  if (isInvoicesParamRange) {
    yield* all(
      commonBlock.animateInsertLines(isInvoicesParamRange, currentY, Timing.slow),
      commonBlock.animateTokenOpacityAt(pParamsExtra, -1, 1, Timing.slow),
    );
  }

  yield* waitFor(0.42);

  if (invoicesRange) {
    yield* commonBlock.animateInsertLines(invoicesRange, currentY, Timing.slow);
  }

  yield* waitFor(0.28);

  const clipHeight = commonHeight - paddingY * 2;
  const bottomMargin = 8;
  const lastLineIndex = commonLineCount2 - 1;
  const targetLastY = clipHeight / 2 - lineHeight / 2 - bottomMargin;
  const scrollAmount = Math.max(0, currentY[lastLineIndex] - targetLastY);
  yield* commonBlock.animateScrollY(scrollAmount, Timing.slow);

  yield* waitFor(0.33);

  const hub = createRef<Rect>();
  const venn = createRef<Node>();
  const domL = createRef<Circle>();
  const domR = createRef<Circle>();
  const domB = createRef<Circle>();
  const domLLabel = createRef<Txt>();
  const domRLabel = createRef<Txt>();
  const domBLabel = createRef<Txt>();
  const left = createRef<Rect>();
  const right = createRef<Rect>();
  const bottom = createRef<Rect>();

  // Match width with the lower small code cards.
  const nodeW = 520;
  const nodeH = 120;

  // Lens geometry (animated during morph for higher quality).
  // Start as a small circle (all three circles coincide), then expand/separate into the lens.
  const lensSepXFinal = 180;
  const lensSepYTopFinal = -70; // Y offset for left/right circles (above center)
  const lensSepYBotFinal = 140; // Y offset for bottom circle (below center)
  const circleSizeFinal = 520;

  const lensSepX = createSignal(0);
  const lensSepYTop = createSignal(0);
  const lensSepYBot = createSignal(0);
  const circleSize = createSignal(160);


  // Hide previous big code blocks and prepare the hub stage.
  yield* all(
    commonBlock.animateCardFill(DEP_BLUE, 0.7),
    commonBlock.hideLines([[0, commonBlock.lineCount - 1]], 0.7),
    orderBlock.node.opacity(0, 0.7, easeInOutCubic),
    paymentBlock.node.opacity(0, 0.7, easeInOutCubic),
  );

  view.add(
    <>
      {/* Blue hub — starts as the commonBlock visual, just fades out */}
      <Rect
        ref={hub}
        width={commonWidth}
        height={commonHeight}
        radius={PanelStyle.radius}
        fill={DEP_BLUE}
        stroke={QUIET_STROKE}
        lineWidth={1}
        shadowColor={'rgba(0,0,0,0)'}
        shadowBlur={0}
        shadowOffset={[0, 0]}
        opacity={1}
      />

      {/* Lens + domain circles:
          The lens is implemented via nested clip (intersection of 3 disks).
          During the morph we animate circle size + separation so it transforms from a circle into the lens. */}
      <Node
        ref={venn}
        x={() => hub().position.x()}
        y={() => hub().position.y()}
        opacity={1}
        scale={1}
      >
        {/* Domain circles (behind the lens) — symmetric layout */}
        <Circle
          ref={domL}
          size={() => circleSize()}
          x={() => -lensSepX()}
          y={() => lensSepYTop()}
          fill={DOMAIN_CIRCLE_FILL}
          stroke={DOMAIN_CIRCLE_STROKE}
          lineWidth={2}
          opacity={0}
        />
        <Circle
          ref={domR}
          size={() => circleSize()}
          x={() => lensSepX()}
          y={() => lensSepYTop()}
          fill={DOMAIN_CIRCLE_FILL}
          stroke={DOMAIN_CIRCLE_STROKE}
          lineWidth={2}
          opacity={0}
        />
        <Circle
          ref={domB}
          size={() => circleSize()}
          x={0}
          y={() => lensSepYBot()}
          fill={DOMAIN_CIRCLE_FILL}
          stroke={DOMAIN_CIRCLE_STROKE}
          lineWidth={2}
          opacity={0}
        />

        {/* Lens fill via nested clip (stable intersection of 3 circles) — symmetric */}
        <Circle clip size={() => circleSize()} x={() => -lensSepX()} y={() => lensSepYTop()} fill={'#00000000'}>
          {/* 2nd circle is positioned relative to the 1st */}
          <Circle clip size={() => circleSize()} x={() => lensSepX() * 2} y={0} fill={'#00000000'}>
            {/* 3rd circle positioned relative to the 2nd */}
            <Circle
              clip
              size={() => circleSize()}
              x={() => -lensSepX()}
              y={() => lensSepYBot() - lensSepYTop()}
              fill={'#00000000'}
            >
              <Rect
                width={() => circleSize() * 3}
                height={() => circleSize() * 3}
                fill={DEP_BLUE}
              />
            </Circle>
          </Circle>
        </Circle>

      </Node>

      {/* Domain labels — top-level so they can animate independently after venn fades */}
      <Txt
        ref={domLLabel}
        text={'ORDERS'}
        fontFamily={Fonts.primary}
        fontSize={22}
        fontWeight={650}
        fill={'rgba(255,255,255,0.74)'}
        shadowColor={'rgba(0,0,0,0.18)'}
        shadowBlur={10}
        shadowOffset={[0, 2]}
        opacity={0}
        x={() => -lensSepX() - 120}
        y={() => lensSepYTop()}
      />
      <Txt
        ref={domRLabel}
        text={'PAYMENTS'}
        fontFamily={Fonts.primary}
        fontSize={22}
        fontWeight={650}
        fill={'rgba(255,255,255,0.74)'}
        shadowColor={'rgba(0,0,0,0.18)'}
        shadowBlur={10}
        shadowOffset={[0, 2]}
        opacity={0}
        x={() => lensSepX() + 120}
        y={() => lensSepYTop()}
      />
      <Txt
        ref={domBLabel}
        text={'INVOICES'}
        fontFamily={Fonts.primary}
        fontSize={22}
        fontWeight={650}
        fill={'rgba(255,255,255,0.74)'}
        shadowColor={'rgba(0,0,0,0.18)'}
        shadowBlur={10}
        shadowOffset={[0, 2]}
        opacity={0}
        x={0}
        y={() => lensSepYBot() + 140}
      />

      {/* Domain card frames — same fill and stroke as domain circles */}
      <Rect
        ref={left}
        x={() => -lensSepX() - 120}
        y={() => lensSepYTop()}
        width={nodeW}
        height={nodeH}
        radius={PanelStyle.radiusSmall}
        fill={DOMAIN_CIRCLE_FILL}
        stroke={DOMAIN_CIRCLE_STROKE}
        lineWidth={2}
        shadowColor={'rgba(0,0,0,0)'}
        shadowBlur={0}
        shadowOffset={[0, 0]}
        opacity={0}
      />
      <Rect
        ref={right}
        x={() => lensSepX() + 120}
        y={() => lensSepYTop()}
        width={nodeW}
        height={nodeH}
        radius={PanelStyle.radiusSmall}
        fill={DOMAIN_CIRCLE_FILL}
        stroke={DOMAIN_CIRCLE_STROKE}
        lineWidth={2}
        shadowColor={'rgba(0,0,0,0)'}
        shadowBlur={0}
        shadowOffset={[0, 0]}
        opacity={0}
      />
      <Rect
        ref={bottom}
        x={0}
        y={() => lensSepYBot() + 140}
        width={nodeW}
        height={nodeH}
        radius={PanelStyle.radiusSmall}
        fill={DOMAIN_CIRCLE_FILL}
        stroke={DOMAIN_CIRCLE_STROKE}
        lineWidth={2}
        shadowColor={'rgba(0,0,0,0)'}
        shadowBlur={0}
        shadowOffset={[0, 0]}
        opacity={0}
      />
    </>,
  );

  commonBlock.node.opacity(0);

  // Morph hub (square) into the lens:
  // Hub shrinks and becomes rounder while fading out;
  // lens starts as the same small circle and morphs into the final lens (higher quality).
  const morphDur = Timing.slow;
  venn().opacity(0);

  yield* all(
    // Hub shrinks to a small circle and fades out
    hub().size([160, 160], morphDur, easeInOutCubic),
    hub().radius(80, morphDur, easeInOutCubic),
    hub().opacity(0, morphDur, easeInOutCubic),
    // Lens fades in while its geometry morphs from circle -> lens
    circleSize(circleSizeFinal, morphDur, easeInOutCubic),
    lensSepX(lensSepXFinal, morphDur, easeInOutCubic),
    lensSepYTop(lensSepYTopFinal, morphDur, easeInOutCubic),
    lensSepYBot(lensSepYBotFinal, morphDur, easeInOutCubic),
    venn().opacity(1, morphDur, easeInOutCubic),
  );

  // After morph, reveal domain circles + labels.
  yield* all(
    domL().opacity(0.85, Timing.slow, easeInOutCubic),
    domR().opacity(0.85, Timing.slow, easeInOutCubic),
    domB().opacity(0.85, Timing.slow, easeInOutCubic),
    domLLabel().opacity(1, Timing.slow, easeInOutCubic),
    domRLabel().opacity(1, Timing.slow, easeInOutCubic),
    domBLabel().opacity(1, Timing.slow, easeInOutCubic),
  );

  yield* waitFor(0.4);

  // Fade out the lens and circles, but KEEP labels visible.
  yield* venn().opacity(0, 1.2, easeInOutCubic);

  // Final row positioning.
  const topY = -320;
  const rowX: [number, number, number] = [-580, 0, 580];
  const ordersX = rowX[0];
  const invoicesX = rowX[1];
  const paymentsX = rowX[2];

  // Labels animate up to final positions; frames appear around them.
  yield* all(
    // Labels move up
    domLLabel().position([ordersX, topY], 1.15, easeInOutCubic),
    domRLabel().position([paymentsX, topY], 1.15, easeInOutCubic),
    domBLabel().position([invoicesX, topY], 1.15, easeInOutCubic),
    // Frames follow the labels
    left().position([ordersX, topY], 1.15, easeInOutCubic),
    right().position([paymentsX, topY], 1.15, easeInOutCubic),
    bottom().position([invoicesX, topY], 1.15, easeInOutCubic),
    // Frames fade in
    left().opacity(1, Timing.slow, easeInOutCubic),
    right().opacity(1, Timing.slow, easeInOutCubic),
    bottom().opacity(1, Timing.slow, easeInOutCubic),
  );

  // Final blocks: increase card sizes so code fits.
  const cardW = 520;
  const cardH = 250;
  const condY = -60;
  const condFontSize = 17;
  const condLineHeight = Math.round(condFontSize * 1.7 * 10) / 10;

  const testW = cardW;
  const testH = cardH;
  const testY = 250;
  const testFontSize = 17;
  const testLineHeight = Math.round(testFontSize * 1.7 * 10) / 10;

  const ORDERS_COND = `final class OrderConditions {

  static Condition fromFilter(...) {
    ...
  }
}`;

  const INVOICES_COND = `final class InvoiceConditions {

  static Condition fromFilter(...) {
    ...
  }
}`;

  const PAYMENTS_COND = `final class PaymentConditions {

  static Condition fromFilter(...) {
    ...
  }
}`;

  const ordersCondBlock = CodeBlock.fromCode(ORDERS_COND, {
    x: ordersX,
    y: condY,
    width: cardW,
    height: cardH,
    fontSize: condFontSize,
    lineHeight: condLineHeight,
    contentOffsetY: topInsetForFont(condFontSize),
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE_DOMAIN,
    glowAccent: false,
    customTypes: ['Condition', 'OrderSearchFilter', 'OrderConditions', 'DSL'],
  });

  const invoicesCondBlock = CodeBlock.fromCode(INVOICES_COND, {
    x: invoicesX,
    y: condY,
    width: cardW,
    height: cardH,
    fontSize: condFontSize,
    lineHeight: condLineHeight,
    contentOffsetY: topInsetForFont(condFontSize),
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE_DOMAIN,
    glowAccent: false,
    customTypes: ['Condition', 'InvoiceSearchFilter', 'InvoiceConditions', 'DSL'],
  });

  const paymentsCondBlock = CodeBlock.fromCode(PAYMENTS_COND, {
    x: paymentsX,
    y: condY,
    width: cardW,
    height: cardH,
    fontSize: condFontSize,
    lineHeight: condLineHeight,
    contentOffsetY: topInsetForFont(condFontSize),
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE_DOMAIN,
    glowAccent: false,
    customTypes: ['Condition', 'PaymentSearchFilter', 'PaymentConditions', 'DSL'],
  });

  const ORDERS_TEST = `@Test
void orders_filter_combinations() {
  ...
}`;

  const PAYMENTS_TEST = `@Test
void payments_filter_combinations() {
  ...
}`;

  const INVOICES_TEST = `@Test
void invoices_filter_combinations() {
  ...
}`;

  const ordersTestBlock = CodeBlock.fromCode(ORDERS_TEST, {
    x: ordersX,
    y: testY,
    width: testW,
    height: testH,
    fontSize: testFontSize,
    lineHeight: testLineHeight,
    contentOffsetY: topInsetForFont(testFontSize),
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE_DOMAIN,
    glowAccent: false,
    customTypes: ['Test', 'List', 'LocalDateTime', 'Condition', 'OrderSearchFilter', 'OrderConditions'],
  });

  const paymentsTestBlock = CodeBlock.fromCode(PAYMENTS_TEST, {
    x: paymentsX,
    y: testY,
    width: testW,
    height: testH,
    fontSize: testFontSize,
    lineHeight: testLineHeight,
    contentOffsetY: topInsetForFont(testFontSize),
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE_DOMAIN,
    glowAccent: false,
    customTypes: ['Test', 'List', 'LocalDateTime', 'Condition', 'PaymentSearchFilter', 'PaymentConditions'],
  });

  const invoicesTestBlock = CodeBlock.fromCode(INVOICES_TEST, {
    x: invoicesX,
    y: testY,
    width: testW,
    height: testH,
    fontSize: testFontSize,
    lineHeight: testLineHeight,
    contentOffsetY: topInsetForFont(testFontSize),
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE_DOMAIN,
    glowAccent: false,
    customTypes: ['Test', 'List', 'LocalDateTime', 'Condition', 'InvoiceSearchFilter', 'InvoiceConditions'],
  });

  ordersCondBlock.mount(view);
  invoicesCondBlock.mount(view);
  paymentsCondBlock.mount(view);

  ordersTestBlock.mount(view);
  paymentsTestBlock.mount(view);
  invoicesTestBlock.mount(view);

  const condLinkL = createRef<Line>();
  const condLinkM = createRef<Line>();
  const condLinkR = createRef<Line>();
  const testLinkL = createRef<Line>();
  const testLinkM = createRef<Line>();
  const testLinkR = createRef<Line>();
  const testOutlineL = createRef<Rect>();
  const testOutlineM = createRef<Rect>();
  const testOutlineR = createRef<Rect>();

  view.add(
    <>
      <Line
        ref={condLinkL}
        stroke={DEP_LINK_STROKE}
        lineWidth={2}
        end={0}
        opacity={0.6}
        points={() => [
          edgePoint([ordersX, topY], [nodeW, nodeH], [ordersX, condY]),
          edgePoint([ordersX, condY], [cardW, cardH], [ordersX, topY]),
        ]}
      />
      <Line
        ref={condLinkM}
        stroke={DEP_LINK_STROKE}
        lineWidth={2}
        end={0}
        opacity={0.6}
        points={() => [
          edgePoint([invoicesX, topY], [nodeW, nodeH], [invoicesX, condY]),
          edgePoint([invoicesX, condY], [cardW, cardH], [invoicesX, topY]),
        ]}
      />
      <Line
        ref={condLinkR}
        stroke={DEP_LINK_STROKE}
        lineWidth={2}
        end={0}
        opacity={0.6}
        points={() => [
          edgePoint([paymentsX, topY], [nodeW, nodeH], [paymentsX, condY]),
          edgePoint([paymentsX, condY], [cardW, cardH], [paymentsX, topY]),
        ]}
      />

      <Line
        ref={testLinkL}
        stroke={DEP_LINK_STROKE}
        lineWidth={2}
        end={0}
        opacity={0.6}
        points={() => [
          edgePoint([ordersX, condY], [cardW, cardH], [ordersX, testY]),
          edgePoint([ordersX, testY], [testW, testH], [ordersX, condY]),
        ]}
      />
      <Line
        ref={testLinkM}
        stroke={DEP_LINK_STROKE}
        lineWidth={2}
        end={0}
        opacity={0.6}
        points={() => [
          edgePoint([invoicesX, condY], [cardW, cardH], [invoicesX, testY]),
          edgePoint([invoicesX, testY], [testW, testH], [invoicesX, condY]),
        ]}
      />
      <Line
        ref={testLinkR}
        stroke={DEP_LINK_STROKE}
        lineWidth={2}
        end={0}
        opacity={0.6}
        points={() => [
          edgePoint([paymentsX, condY], [cardW, cardH], [paymentsX, testY]),
          edgePoint([paymentsX, testY], [testW, testH], [paymentsX, condY]),
        ]}
      />

      <Rect
        ref={testOutlineL}
        x={ordersX}
        y={testY}
        width={testW}
        height={testH}
        radius={28}
        fill={'rgba(0, 0, 0, 0)'}
        stroke={'rgba(0, 0, 0, 0)'}
        lineWidth={3}
      />
      <Rect
        ref={testOutlineM}
        x={invoicesX}
        y={testY}
        width={testW}
        height={testH}
        radius={28}
        fill={'rgba(0, 0, 0, 0)'}
        stroke={'rgba(0, 0, 0, 0)'}
        lineWidth={3}
      />
      <Rect
        ref={testOutlineR}
        x={paymentsX}
        y={testY}
        width={testW}
        height={testH}
        radius={28}
        fill={'rgba(0, 0, 0, 0)'}
        stroke={'rgba(0, 0, 0, 0)'}
        lineWidth={3}
      />
    </>,
  );

  yield* all(
    ordersCondBlock.appear(Timing.slow),
    invoicesCondBlock.appear(Timing.slow),
    paymentsCondBlock.appear(Timing.slow),
    condLinkL().end(1, 1.0, easeInOutCubic),
    condLinkM().end(1, 1.0, easeInOutCubic),
    condLinkR().end(1, 1.0, easeInOutCubic),
  );

  yield* waitFor(0.35);

  yield* all(
    ordersTestBlock.appear(Timing.slow),
    paymentsTestBlock.appear(Timing.slow),
    invoicesTestBlock.appear(Timing.slow),
    testLinkL().end(1, 1.35, easeInOutCubic),
    testLinkM().end(1, 1.35, easeInOutCubic),
    testLinkR().end(1, 1.35, easeInOutCubic),
  );

  yield* waitFor(0.25);

  yield* testOutlineL().stroke('rgba(106, 219, 156, 0.95)', 0.55, easeInOutCubic);
  yield* waitFor(0.2);
  yield* testOutlineM().stroke('rgba(106, 219, 156, 0.95)', 0.55, easeInOutCubic);
  yield* waitFor(0.2);
  yield* testOutlineR().stroke('rgba(227, 91, 102, 0.95)', 0.55, easeInOutCubic);

  // Outro: after outlines light up, fade everything out so the next scene (dryKnowledgeScene) starts clean.
  yield* waitFor(0.55);
  const fadeDur = Timing.slow * 0.9;
  yield* all(
    ordersCondBlock.disappear(fadeDur),
    invoicesCondBlock.disappear(fadeDur),
    paymentsCondBlock.disappear(fadeDur),
    ordersTestBlock.disappear(fadeDur),
    paymentsTestBlock.disappear(fadeDur),
    invoicesTestBlock.disappear(fadeDur),

    condLinkL().opacity(0, fadeDur, easeInOutCubic),
    condLinkM().opacity(0, fadeDur, easeInOutCubic),
    condLinkR().opacity(0, fadeDur, easeInOutCubic),
    testLinkL().opacity(0, fadeDur, easeInOutCubic),
    testLinkM().opacity(0, fadeDur, easeInOutCubic),
    testLinkR().opacity(0, fadeDur, easeInOutCubic),

    testOutlineL().opacity(0, fadeDur, easeInOutCubic),
    testOutlineM().opacity(0, fadeDur, easeInOutCubic),
    testOutlineR().opacity(0, fadeDur, easeInOutCubic),

    left().opacity(0, fadeDur, easeInOutCubic),
    right().opacity(0, fadeDur, easeInOutCubic),
    bottom().opacity(0, fadeDur, easeInOutCubic),

    domLLabel().opacity(0, fadeDur, easeInOutCubic),
    domRLabel().opacity(0, fadeDur, easeInOutCubic),
    domBLabel().opacity(0, fadeDur, easeInOutCubic),
  );

  yield* waitFor(0.2);
});


