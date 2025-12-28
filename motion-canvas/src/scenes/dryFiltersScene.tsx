import {Layout, makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {ExplainorCodeTheme} from '../core/code/model/SyntaxTheme';
import {placeCodeStack, SafeZone} from '../core/ScreenGrid';
import {Colors, Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';
import {fitText} from '../core/utils/textMeasure';

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

type Row = Record<string, string>;

interface Column {
  key: string;
  header: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  ellipsis?: 'end' | 'middle';
  color?: (value: string) => string;
}

const FONT_FAMILY = Fonts.code;
const FONT_SIZE = 16;
const FONT_WEIGHT = 400;
const ROW_H = 48;
const CELL_PX = 16;
const TABLE_PADDING = 24;
const TITLE_H = 24;
const TITLE_FONT_SIZE = 14;
const TITLE_COLOR = 'rgba(219, 213, 202, 0.72)';
const CELL_FILL_OFF = 'rgba(0, 0, 0, 0)';
const CELL_HIGHLIGHT = 'rgba(255, 140, 163, 0.28)';

const FILTER_FROM = '2024-12-10 00:00';
const SCAN_PULSE_ON = 0.22;
const SCAN_PULSE_OFF = 0.22;
const SCAN_ROW_DELAY = 0.08;
const SCAN_BETWEEN_PASSES = 0.28;
const SCAN_CYCLES = 1;

const paymentColumns: Omit<Column, 'width'>[] = [
  {key: 'id', header: 'id', ellipsis: 'middle', align: 'left'},
  {
    key: 'status',
    header: 'status',
    ellipsis: 'end',
    align: 'left',
    color: (v) => v === 'CAPTURED' ? '#A8D8C0' : v === 'PENDING' ? '#E6B47C' : Colors.text.muted,
  },
  {key: 'amount', header: 'amount', ellipsis: 'end', align: 'left'},
  {key: 'created_at', header: 'created_at', ellipsis: 'end', align: 'left'},
];

const paymentRows: Row[] = [
  {id: '550e8400-e29b-41d4-a716-446655440000', status: 'CAPTURED', amount: '$99.00', created_at: '2024-12-15 14:32'},
  {id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8', status: 'DECLINED', amount: '$150.00', created_at: '2024-12-14 09:15'},
  {id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', status: 'CAPTURED', amount: '$245.00', created_at: '2024-12-12 18:47'},
  {id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', status: 'PENDING', amount: '$78.00', created_at: '2024-12-10 11:03'},
  {id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', status: 'CAPTURED', amount: '$312.50', created_at: '2024-12-08 22:19'},
];

const orderColumns: Omit<Column, 'width'>[] = [
  {key: 'id', header: 'id', ellipsis: 'middle', align: 'left'},
  {
    key: 'status',
    header: 'status',
    ellipsis: 'end',
    align: 'left',
    color: (v) => v === 'SHIPPED' ? '#A8D8C0' : v === 'PROCESSING' ? '#E6B47C' : Colors.text.muted,
  },
  {key: 'total', header: 'total', ellipsis: 'end', align: 'left'},
  {key: 'created_at', header: 'created_at', ellipsis: 'end', align: 'left'},
];

const orderRows: Row[] = [
  {id: 'ord-8a4b2c1d-3e5f-6789-abcd-ef0123456789', status: 'SHIPPED', total: '$299.00', created_at: '2024-12-14 16:20'},
  {id: 'ord-1f2e3d4c-5b6a-7890-1234-567890abcdef', status: 'PROCESSING', total: '$450.00', created_at: '2024-12-13 11:45'},
  {id: 'ord-9c8b7a6d-5e4f-3210-fedc-ba9876543210', status: 'SHIPPED', total: '$125.50', created_at: '2024-12-11 09:30'},
  {id: 'ord-2d3e4f5a-6b7c-8901-2345-6789abcdef01', status: 'CANCELLED', total: '$89.00', created_at: '2024-12-09 14:15'},
  {id: 'ord-7a8b9c0d-1e2f-3456-7890-abcdef012345', status: 'SHIPPED', total: '$567.00', created_at: '2024-12-07 20:00'},
];

export default makeScene2D(function* (view) {
  applyBackground(view);

  function* pulseCell(cell: Rect, on: number = SCAN_PULSE_ON, off: number = SCAN_PULSE_OFF) {
    yield* cell.fill(CELL_HIGHLIGHT, on, easeInOutCubic);
    yield* cell.fill(CELL_FILL_OFF, off, easeInOutCubic);
  }

  function passesDateFrom(v: string): boolean {
    return v >= FILTER_FROM;
  }

  function paymentPassesDate(row: Row): boolean {
    return passesDateFrom(row.created_at);
  }

  function paymentPassesStatus(row: Row): boolean {
    return row.status === 'CAPTURED';
  }

  function orderPassesDate(row: Row): boolean {
    return passesDateFrom(row.created_at);
  }

  function orderPassesStatus(row: Row): boolean {
    return row.status === 'SHIPPED';
  }

  const gap = 120;
  const totalWidth = SafeZone.right - SafeZone.left;
  const cardWidth = (totalWidth - gap) / 2;
  const codeX = SafeZone.left + cardWidth / 2;
  const tableX = SafeZone.right - cardWidth / 2;

  const baseLayouts = placeCodeStack([PAYMENT_REPO_CODE, ORDER_REPO_CODE], 'L', 16);
  
  const paymentLayout = {...baseLayouts[0], x: codeX, width: cardWidth};
  const orderLayout = {...baseLayouts[1], x: codeX, width: cardWidth};

  const paymentTableRef = createRef<Rect>();
  const orderTableRef = createRef<Rect>();
  const tableWidth = cardWidth;
  const contentWidth = tableWidth - TABLE_PADDING * 2;

  const paymentHighlightCells = paymentRows.map(() => ({
    status: createRef<Rect>(),
    created_at: createRef<Rect>(),
  }));

  const orderHighlightCells = orderRows.map(() => ({
    status: createRef<Rect>(),
    created_at: createRef<Rect>(),
  }));

  view.add(
    <Rect
      ref={paymentTableRef}
      x={tableX}
      y={paymentLayout.y}
      width={tableWidth}
      height={paymentLayout.height}
      layout
      direction={'column'}
      gap={0}
      padding={TABLE_PADDING}
      radius={28}
      fill={Colors.surface}
      stroke={'rgba(255, 255, 255, 0.03)'}
      lineWidth={2}
      shadowColor={'rgba(0, 0, 0, 0.28)'}
      shadowBlur={74}
      shadowOffset={[0, 22]}
      opacity={0}
      clip
    >
      <Rect
        layout
        direction={'row'}
        height={TITLE_H}
        width={contentWidth}
        justifyContent={'start'}
        alignItems={'center'}
        clip
        marginBottom={10}
      >
        <Txt
          fontFamily={FONT_FAMILY}
          fontSize={TITLE_FONT_SIZE}
          fontWeight={600}
          fill={TITLE_COLOR}
          text={'PAYMENTS'}
        />
      </Rect>
      <Rect layout direction={'row'} height={ROW_H} width={contentWidth} justifyContent={'start'} clip>
        {paymentColumns.map((col, i) => (
          <>
            <Rect
              layout
              grow={1}
              shrink={1}
              basis={0}
              minWidth={0}
              height={'100%'}
              paddingLeft={CELL_PX}
              paddingRight={CELL_PX}
              alignItems={'center'}
              justifyContent={'start'}
              clip
            >
              <Txt
                width={'100%'}
                minWidth={0}
                textWrap={false}
                textAlign={col.align === 'right' ? 'right' : 'left'}
                fontFamily={FONT_FAMILY}
                fontSize={FONT_SIZE}
                fontWeight={600}
                fill={'rgba(252, 251, 248, 0.5)'}
                text={col.header}
              />
            </Rect>
            {i < paymentColumns.length - 1 && (
              <Rect width={1} height={'100%'} fill={'rgba(255, 255, 255, 0.08)'} shrink={0} />
            )}
          </>
        ))}
      </Rect>

      {paymentRows.map((row, rowIndex) => (
        <Rect
          layout
          direction={'row'}
          height={ROW_H}
          width={contentWidth}
          justifyContent={'start'}
          clip
          marginTop={rowIndex === 0 ? 6 : 0}
        >
          {paymentColumns.map((col, i) => {
            const raw = row[col.key];
            const cellWidth = contentWidth / paymentColumns.length;
            const avail = cellWidth - CELL_PX * 2;
            const shown = fitText(raw, avail, col.ellipsis ?? 'end', FONT_FAMILY, FONT_SIZE, FONT_WEIGHT);
            const textColor = col.color ? col.color(raw) : Colors.text.primary;
            const highlightRef =
              col.key === 'status' ? paymentHighlightCells[rowIndex].status :
              col.key === 'created_at' ? paymentHighlightCells[rowIndex].created_at :
              undefined;

            return (
              <>
                <Rect
                  ref={highlightRef}
                  layout
                  grow={1}
                  shrink={1}
                  basis={0}
                  minWidth={0}
                  height={'100%'}
                  paddingLeft={CELL_PX}
                  paddingRight={CELL_PX}
                  alignItems={'center'}
                  justifyContent={'start'}
                  clip
                  fill={highlightRef ? CELL_FILL_OFF : undefined}
                >
                  <Txt
                    width={'100%'}
                    minWidth={0}
                    textWrap={false}
                    textAlign={col.align === 'right' ? 'right' : 'left'}
                    fontFamily={FONT_FAMILY}
                    fontSize={FONT_SIZE}
                    fontWeight={FONT_WEIGHT}
                    fill={textColor}
                    text={shown}
                  />
                </Rect>
                {i < paymentColumns.length - 1 && (
                  <Rect width={1} height={'100%'} fill={'rgba(255, 255, 255, 0.08)'} shrink={0} />
                )}
              </>
            );
          })}
        </Rect>
      ))}
    </Rect>,
  );

  view.add(
    <Rect
      ref={orderTableRef}
      x={tableX}
      y={orderLayout.y}
      width={tableWidth}
      height={orderLayout.height}
      layout
      direction={'column'}
      gap={0}
      padding={TABLE_PADDING}
      radius={28}
      fill={Colors.surface}
      stroke={'rgba(255, 255, 255, 0.03)'}
      lineWidth={2}
      shadowColor={'rgba(0, 0, 0, 0.28)'}
      shadowBlur={74}
      shadowOffset={[0, 22]}
      opacity={0}
      clip
    >
      <Rect
        layout
        direction={'row'}
        height={TITLE_H}
        width={contentWidth}
        justifyContent={'start'}
        alignItems={'center'}
        clip
        marginBottom={10}
      >
        <Txt
          fontFamily={FONT_FAMILY}
          fontSize={TITLE_FONT_SIZE}
          fontWeight={600}
          fill={TITLE_COLOR}
          text={'ORDERS'}
        />
      </Rect>
      <Rect layout direction={'row'} height={ROW_H} width={contentWidth} justifyContent={'start'} clip>
        {orderColumns.map((col, i) => (
          <>
            <Rect
              layout
              grow={1}
              shrink={1}
              basis={0}
              minWidth={0}
              height={'100%'}
              paddingLeft={CELL_PX}
              paddingRight={CELL_PX}
              alignItems={'center'}
              justifyContent={'start'}
              clip
            >
              <Txt
                width={'100%'}
                minWidth={0}
                textWrap={false}
                textAlign={col.align === 'right' ? 'right' : 'left'}
                fontFamily={FONT_FAMILY}
                fontSize={FONT_SIZE}
                fontWeight={600}
                fill={'rgba(252, 251, 248, 0.5)'}
                text={col.header}
              />
            </Rect>
            {i < orderColumns.length - 1 && (
              <Rect width={1} height={'100%'} fill={'rgba(255, 255, 255, 0.08)'} shrink={0} />
            )}
          </>
        ))}
      </Rect>

      {orderRows.map((row, rowIndex) => (
        <Rect
          layout
          direction={'row'}
          height={ROW_H}
          width={contentWidth}
          justifyContent={'start'}
          clip
          marginTop={rowIndex === 0 ? 6 : 0}
        >
          {orderColumns.map((col, i) => {
            const raw = row[col.key];
            const cellWidth = contentWidth / orderColumns.length;
            const avail = cellWidth - CELL_PX * 2;
            const shown = fitText(raw, avail, col.ellipsis ?? 'end', FONT_FAMILY, FONT_SIZE, FONT_WEIGHT);
            const textColor = col.color ? col.color(raw) : Colors.text.primary;
            const highlightRef =
              col.key === 'status' ? orderHighlightCells[rowIndex].status :
              col.key === 'created_at' ? orderHighlightCells[rowIndex].created_at :
              undefined;

            return (
              <>
                <Rect
                  ref={highlightRef}
                  layout
                  grow={1}
                  shrink={1}
                  basis={0}
                  minWidth={0}
                  height={'100%'}
                  paddingLeft={CELL_PX}
                  paddingRight={CELL_PX}
                  alignItems={'center'}
                  justifyContent={'start'}
                  clip
                  fill={highlightRef ? CELL_FILL_OFF : undefined}
                >
                  <Txt
                    width={'100%'}
                    minWidth={0}
                    textWrap={false}
                    textAlign={col.align === 'right' ? 'right' : 'left'}
                    fontFamily={FONT_FAMILY}
                    fontSize={FONT_SIZE}
                    fontWeight={FONT_WEIGHT}
                    fill={textColor}
                    text={shown}
                  />
                </Rect>
                {i < orderColumns.length - 1 && (
                  <Rect width={1} height={'100%'} fill={'rgba(255, 255, 255, 0.08)'} shrink={0} />
                )}
              </>
            );
          })}
        </Rect>
      ))}
    </Rect>,
  );

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
  yield* all(
    paymentRepo.appear(Timing.slow),
    paymentTableRef().opacity(1, Timing.slow, easeInOutCubic),
  );

  const conditionLineIndex = 9;
  const whereLineIndex = 12;

  yield* waitFor(2);

  orderRepo.mount(view);
  yield* all(
    orderRepo.appear(Timing.slow),
    orderTableRef().opacity(1, Timing.slow, easeInOutCubic),
  );

  yield* waitFor(0.4);

  yield* all(
    all(
      paymentRepo.highlightLines([[conditionLineIndex, conditionLineIndex], [whereLineIndex, whereLineIndex]], Timing.slow),
      paymentRepo.recolorLine(conditionLineIndex, Colors.accent, Timing.slow),
      paymentRepo.recolorLine(whereLineIndex, Colors.accent, Timing.slow),
    ),
    all(
      orderRepo.highlightLines([[conditionLineIndex, conditionLineIndex], [whereLineIndex, whereLineIndex]], Timing.slow),
      orderRepo.recolorLine(conditionLineIndex, Colors.accent, Timing.slow),
      orderRepo.recolorLine(whereLineIndex, Colors.accent, Timing.slow),
    ),
  );

  yield* waitFor(0.6);

  for (let c = 0; c < SCAN_CYCLES; c++) {
    // 1) Даты (created_at)
    for (let i = 0; i < Math.max(paymentRows.length, orderRows.length); i++) {
      yield* all(
        i < paymentRows.length && paymentPassesDate(paymentRows[i])
          ? pulseCell(paymentHighlightCells[i].created_at())
          : waitFor(0),
        i < orderRows.length && orderPassesDate(orderRows[i])
          ? pulseCell(orderHighlightCells[i].created_at())
          : waitFor(0),
      );
      yield* waitFor(SCAN_ROW_DELAY);
    }

    yield* waitFor(SCAN_BETWEEN_PASSES);

    // 2) Статусы (status)
    for (let i = 0; i < Math.max(paymentRows.length, orderRows.length); i++) {
      yield* all(
        i < paymentRows.length && paymentPassesStatus(paymentRows[i])
          ? pulseCell(paymentHighlightCells[i].status())
          : waitFor(0),
        i < orderRows.length && orderPassesStatus(orderRows[i])
          ? pulseCell(orderHighlightCells[i].status())
          : waitFor(0),
      );
      yield* waitFor(SCAN_ROW_DELAY);
    }

    yield* waitFor(SCAN_BETWEEN_PASSES);
  }

  const restoreDur = 0.8;

  yield* all(
    paymentRepo.resetLineColors(conditionLineIndex, restoreDur),
    paymentRepo.resetLineColors(whereLineIndex, restoreDur),
    orderRepo.resetLineColors(conditionLineIndex, restoreDur),
    orderRepo.resetLineColors(whereLineIndex, restoreDur),
    paymentRepo.showAllLines(restoreDur),
    orderRepo.showAllLines(restoreDur),
  );

  yield* waitFor(6);
});
