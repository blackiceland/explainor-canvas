import {makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import type {CodeCardStyle} from '../core/code/components/CodeCard';
import {OpenLightCodeTheme} from '../core/code/model';
import {getSlots} from '../core/layouts';
import {OpenStyle} from '../core/openStyle';
import {OpenText} from '../core/openText';
import {Timing} from '../core/theme';
import {fitText} from '../core/utils/textMeasure';
import {appear, disappear} from '../core/beats';

type Row = Record<string, string>;

interface Column {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  ellipsis?: 'end' | 'middle';
  color?: (value: string) => string;
}

function statusTextColor(statusRaw: string): string {
  const s = (statusRaw ?? '').toUpperCase();
  if (['CAPTURED', 'SHIPPED', 'PAID', 'SUCCEEDED', 'COMPLETED'].includes(s)) return OpenStyle.colors.olive;
  if (['PENDING', 'PROCESSING', 'CREATED', 'NEW'].includes(s)) return OpenStyle.colors.blue;
  if (['DECLINED', 'FAILED', 'CANCELLED', 'CANCELED'].includes(s)) return OpenStyle.colors.terracotta;
  if (['REFUNDED', 'CHARGEBACK', 'REVERSED'].includes(s)) return OpenStyle.colors.transport;
  return OpenStyle.colors.muted;
}

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

const FONT_FAMILY = OpenStyle.fonts.mono;
const FONT_SIZE = 17;
const FONT_WEIGHT = 450;
const ROW_H = 48;
const CELL_PX = 16;
const TABLE_PADDING = 22;
const TITLE_H = 24;

const FILTER_FROM = '2024-12-10 00:00';
const SCAN_PULSE_ON = Timing.beat;
const SCAN_PULSE_OFF = Timing.beat;
const SCAN_ROW_DELAY = Timing.micro;
const SCAN_BETWEEN_PASSES = Timing.normal;

const columnsPayments: Column[] = [
  {key: 'id', header: 'id', ellipsis: 'middle', align: 'left'},
  {key: 'status', header: 'status', ellipsis: 'end', align: 'left', color: statusTextColor},
  {key: 'amount', header: 'amount', ellipsis: 'end', align: 'left'},
  {key: 'created_at', header: 'created_at', ellipsis: 'end', align: 'left'},
];

const rowsPayments: Row[] = [
  {id: '550e8400-e29b-41d4-a716-446655440000', status: 'CAPTURED', amount: '$99.00', created_at: '2024-12-15 14:32'},
  {id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8', status: 'DECLINED', amount: '$150.00', created_at: '2024-12-14 09:15'},
  {id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', status: 'CAPTURED', amount: '$245.00', created_at: '2024-12-12 18:47'},
  {id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', status: 'PENDING', amount: '$78.00', created_at: '2024-12-10 11:03'},
  {id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', status: 'CAPTURED', amount: '$312.50', created_at: '2024-12-08 22:19'},
];

const columnsOrders: Column[] = [
  {key: 'id', header: 'id', ellipsis: 'middle', align: 'left'},
  {key: 'status', header: 'status', ellipsis: 'end', align: 'left', color: statusTextColor},
  {key: 'total', header: 'total', ellipsis: 'end', align: 'left'},
  {key: 'created_at', header: 'created_at', ellipsis: 'end', align: 'left'},
];

const rowsOrders: Row[] = [
  {id: 'ord-8a4b2c1d-3e5f-6789-abcd-ef0123456789', status: 'SHIPPED', total: '$299.00', created_at: '2024-12-14 16:20'},
  {id: 'ord-1f2e3d4c-5b6a-7890-1234-567890abcdef', status: 'PROCESSING', total: '$450.00', created_at: '2024-12-13 11:45'},
  {id: 'ord-9c8b7a6d-5e4f-3210-fedc-ba9876543210', status: 'SHIPPED', total: '$125.50', created_at: '2024-12-11 09:30'},
  {id: 'ord-2d3e4f5a-6b7c-8901-2345-6789abcdef01', status: 'CANCELLED', total: '$89.00', created_at: '2024-12-09 14:15'},
  {id: 'ord-7a8b9c0d-1e2f-3456-7890-abcdef012345', status: 'SHIPPED', total: '$567.00', created_at: '2024-12-07 20:00'},
];

export default makeScene2D(function* (view) {
  view.fill(OpenStyle.colors.bg);

  function* pulseCell(cell: Rect, on: number = SCAN_PULSE_ON, off: number = SCAN_PULSE_OFF) {
    yield* cell.fill(OpenStyle.colors.accentSubtle, on, easeInOutCubic);
    yield* cell.fill('rgba(0,0,0,0)', off, easeInOutCubic);
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

  function paymentMatches(row: Row): boolean {
    return paymentPassesDate(row) && paymentPassesStatus(row);
  }

  function orderMatches(row: Row): boolean {
    return orderPassesDate(row) && orderPassesStatus(row);
  }

  const slots = getSlots('2L-2R', {gap: 70});
  const paymentTableSlot = slots.L1;
  const orderTableSlot = slots.L2;
  const paymentCodeSlot = slots.R1;
  const orderCodeSlot = slots.R2;

  const paymentTableRef = createRef<Rect>();
  const orderTableRef = createRef<Rect>();
  const contentWidth = paymentTableSlot.width - TABLE_PADDING * 2;

  const paymentHighlightCells = rowsPayments.map(() => ({
    status: createRef<Rect>(),
    created_at: createRef<Rect>(),
  }));

  const orderHighlightCells = rowsOrders.map(() => ({
    status: createRef<Rect>(),
    created_at: createRef<Rect>(),
  }));

  const paymentRowRefs = rowsPayments.map(() => createRef<Rect>());
  const orderRowRefs = rowsOrders.map(() => createRef<Rect>());

  const panelStroke = OpenStyle.colors.border;
  const panelFill = OpenStyle.colors.card;

  const addTable = (
    ref: ReturnType<typeof createRef<Rect>>,
    slot: {x: number; y: number; width: number; height: number},
    title: string,
    cols: Column[],
    rows: Row[],
    rowRefs: Array<ReturnType<typeof createRef<Rect>>>,
    highlightCells: Array<{status: ReturnType<typeof createRef<Rect>>; created_at: ReturnType<typeof createRef<Rect>>}>,
  ) => (
    <Rect
      ref={ref}
      x={slot.x}
      y={slot.y}
      width={slot.width}
      height={slot.height}
      layout
      direction={'column'}
      gap={0}
      padding={TABLE_PADDING}
      radius={22}
      fill={panelFill}
      stroke={panelStroke}
      lineWidth={1}
      shadowColor={'rgba(0,0,0,0)'}
      shadowBlur={0}
      shadowOffset={[0, 0]}
      opacity={0}
      clip
    >
      <Rect layout direction={'row'} height={TITLE_H} width={contentWidth} justifyContent={'start'} alignItems={'center'} clip marginBottom={10}>
        <Txt
          fontFamily={OpenStyle.fonts.sans}
          fontSize={OpenText.endpointVerb.fontSize}
          fontWeight={OpenText.endpointVerb.fontWeight}
          letterSpacing={OpenText.endpointVerb.letterSpacing}
          fill={OpenStyle.colors.muted}
          text={title}
        />
      </Rect>
      <Rect layout width={contentWidth} height={1} fill={panelStroke} opacity={0.75} marginBottom={10} />

      <Rect layout direction={'row'} height={ROW_H} width={contentWidth} justifyContent={'start'} clip>
        {cols.map(col => (
          <Rect layout grow={1} shrink={1} basis={0} minWidth={0} height={'100%'} paddingLeft={CELL_PX} paddingRight={CELL_PX} alignItems={'center'} justifyContent={'start'} clip>
            <Txt
              width={'100%'}
              minWidth={0}
              textWrap={false}
              textAlign={col.align === 'right' ? 'right' : 'left'}
              fontFamily={FONT_FAMILY}
              fontSize={FONT_SIZE}
              fontWeight={600}
              fill={OpenStyle.colors.muted}
              text={col.header}
            />
          </Rect>
        ))}
      </Rect>

      {rows.map((row, rowIndex) => (
        <Rect
          ref={rowRefs[rowIndex]}
          layout
          direction={'row'}
          height={ROW_H}
          width={contentWidth}
          justifyContent={'start'}
          clip
          marginTop={rowIndex === 0 ? 6 : 0}
        >
          {cols.map(col => {
            const raw = row[col.key];
            const cellWidth = contentWidth / cols.length;
            const avail = cellWidth - CELL_PX * 2;
            const shown = fitText(raw, avail, col.ellipsis ?? 'end', FONT_FAMILY, FONT_SIZE, FONT_WEIGHT);
            const textColor = col.color ? col.color(raw) : OpenStyle.colors.ink;
            const highlightRef =
              col.key === 'status' ? highlightCells[rowIndex].status :
              col.key === 'created_at' ? highlightCells[rowIndex].created_at :
              undefined;

            return (
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
                fill={highlightRef ? 'rgba(0,0,0,0)' : undefined}
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
            );
          })}
        </Rect>
      ))}
    </Rect>
  );

  view.add(
    <>
      {addTable(paymentTableRef, paymentTableSlot, 'PAYMENTS', columnsPayments, rowsPayments, paymentRowRefs, paymentHighlightCells)}
      {addTable(orderTableRef, orderTableSlot, 'ORDERS', columnsOrders, rowsOrders, orderRowRefs, orderHighlightCells)}
    </>,
  );

  const cardStyle: CodeCardStyle = {
    radius: 22,
    fill: panelFill,
    stroke: panelStroke,
    strokeWidth: 1,
    opacity: 1,
    shadowColor: 'rgba(0,0,0,0)',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    edge: false,
  };

  const paymentRepo = CodeBlock.fromCode(PAYMENT_REPO_CODE, {
    x: paymentCodeSlot.x,
    y: paymentCodeSlot.y,
    width: paymentCodeSlot.width,
    height: paymentCodeSlot.height,
    fontSize: 16,
    fontFamily: OpenStyle.fonts.mono,
    theme: OpenLightCodeTheme,
    cardStyle,
    customTypes: ['PaymentRepository', 'DSLContext', 'PaymentRecord', 'PaymentSearchFilter', 'Condition', 'PaymentConditions'],
  });

  const orderRepo = CodeBlock.fromCode(ORDER_REPO_CODE, {
    x: orderCodeSlot.x,
    y: orderCodeSlot.y,
    width: orderCodeSlot.width,
    height: orderCodeSlot.height,
    fontSize: 16,
    fontFamily: OpenStyle.fonts.mono,
    theme: OpenLightCodeTheme,
    cardStyle,
    customTypes: ['OrderRepository', 'DSLContext', 'OrderRecord', 'OrderSearchFilter', 'Condition', 'OrderConditions'],
  });

  paymentRepo.mount(view);
  orderRepo.mount(view);

  const conditionLineIndex = 9;
  const whereLineIndex = 12;

  yield* appear(paymentTableRef(), Timing.slow);
  yield* waitFor(Timing.normal);
  yield* appear(orderTableRef(), Timing.slow);
  yield* waitFor(Timing.normal);
  yield* all(paymentRepo.appear(Timing.slow), orderRepo.appear(Timing.slow));

  yield* all(
    paymentRepo.highlightLines([[conditionLineIndex, conditionLineIndex], [whereLineIndex, whereLineIndex]], Timing.slow),
    orderRepo.highlightLines([[conditionLineIndex, conditionLineIndex], [whereLineIndex, whereLineIndex]], Timing.slow),
  );

  for (let i = 0; i < Math.max(rowsPayments.length, rowsOrders.length); i++) {
    yield* all(
      i < rowsPayments.length && paymentPassesDate(rowsPayments[i])
        ? pulseCell(paymentHighlightCells[i].created_at())
        : waitFor(0),
      i < rowsOrders.length && orderPassesDate(rowsOrders[i])
        ? pulseCell(orderHighlightCells[i].created_at())
        : waitFor(0),
    );
    yield* waitFor(SCAN_ROW_DELAY);
  }

  yield* waitFor(SCAN_BETWEEN_PASSES);

  for (let i = 0; i < Math.max(rowsPayments.length, rowsOrders.length); i++) {
    yield* all(
      i < rowsPayments.length && paymentPassesStatus(rowsPayments[i])
        ? pulseCell(paymentHighlightCells[i].status())
        : waitFor(0),
      i < rowsOrders.length && orderPassesStatus(rowsOrders[i])
        ? pulseCell(orderHighlightCells[i].status())
        : waitFor(0),
    );
    yield* waitFor(SCAN_ROW_DELAY);
  }

  yield* waitFor(Timing.normal);

  const hideDur = Timing.slow;
  const hideAnimations: any[] = [];

  for (let i = 0; i < rowsPayments.length; i++) {
    if (paymentMatches(rowsPayments[i])) continue;
    const rowRef = paymentRowRefs[i]();
    hideAnimations.push(all(rowRef.opacity(0, hideDur, easeInOutCubic), rowRef.height(0, hideDur, easeInOutCubic)));
  }

  for (let i = 0; i < rowsOrders.length; i++) {
    if (orderMatches(rowsOrders[i])) continue;
    const rowRef = orderRowRefs[i]();
    hideAnimations.push(all(rowRef.opacity(0, hideDur, easeInOutCubic), rowRef.height(0, hideDur, easeInOutCubic)));
  }

  if (hideAnimations.length > 0) {
    yield* all(...hideAnimations);
  }

  yield* waitFor(Timing.beat);

  yield* all(
    paymentRepo.resetLineColors(conditionLineIndex, Timing.normal),
    paymentRepo.resetLineColors(whereLineIndex, Timing.normal),
    paymentRepo.showAllLines(Timing.normal),
    orderRepo.resetLineColors(conditionLineIndex, Timing.normal),
    orderRepo.resetLineColors(whereLineIndex, Timing.normal),
    orderRepo.showAllLines(Timing.normal),
  );

  yield* waitFor(Timing.normal);

  yield* all(
    disappear(paymentRepo, Timing.slow),
    disappear(orderRepo, Timing.slow),
    disappear(paymentTableRef(), Timing.slow),
    disappear(orderTableRef(), Timing.slow),
  );
});



