import {makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {ExplainorCodeTheme} from '../core/code/model/SyntaxTheme';
import type {CodeCardStyle} from '../core/code/components/CodeCard';
import {getSlots} from '../core/layouts';
import {Colors, Fonts, Screen, Timing} from '../core/theme';
import {PanelStyle} from '../core/panelStyle';
import {applyBackground} from '../core/utils';
import {fitText} from '../core/utils/textMeasure';
import {appear, disappear} from '../core/beats';
import {getCodePaddingX, getCodePaddingY} from '../core/code/shared/TextMeasure';

type Row = Record<string, string>;

interface Column {
  key: string;
  header: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  ellipsis?: 'end' | 'middle';
  color?: (value: string) => string;
}

function hexToRgba(hex: string, alpha: number): string {
  const raw = String(hex ?? '').trim().replace('#', '');
  const full = raw.length === 3 ? raw.split('').map(c => `${c}${c}`).join('') : raw;
  const n = parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(n)) return `rgba(255,255,255,${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${a})`;
}

function statusTextColor(statusRaw: string): string {
  const s = (statusRaw ?? '').toUpperCase();
  if (['CAPTURED', 'SHIPPED', 'PAID', 'SUCCEEDED', 'COMPLETED'].includes(s)) return 'rgba(155, 227, 197, 0.86)';
  if (['PENDING', 'PROCESSING', 'CREATED', 'NEW'].includes(s)) return 'rgba(163, 205, 255, 0.86)';
  if (['DECLINED', 'FAILED', 'CANCELLED', 'CANCELED'].includes(s)) return 'rgba(255, 170, 185, 0.86)';
  if (['REFUNDED', 'CHARGEBACK', 'REVERSED'].includes(s)) return 'rgba(201, 180, 255, 0.86)';
  return PanelStyle.labelFillMuted;
}

const TABLE_DIVIDER = PanelStyle.stroke;
const PANEL_STROKE = hexToRgba(Colors.text.primary, 0.11);
const PANEL_FILL = hexToRgba(Colors.surface, 0.34);
const HAIRLINE = 1;

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

const FONT_FAMILY = Fonts.code;
const FONT_SIZE = 17;
const FONT_WEIGHT = 400;
const ROW_H = 48;
const CELL_PX = 16;
const CODE_FONT_SIZE = 16;
const TABLE_PADDING = Math.round((getCodePaddingX(CODE_FONT_SIZE) + getCodePaddingY(CODE_FONT_SIZE)) / 2);
const TITLE_H = 24;
const TITLE_FONT_SIZE = 22;
const TITLE_COLOR = PanelStyle.labelFill;
const CELL_FILL_OFF = 'rgba(0, 0, 0, 0)';
const CELL_HIGHLIGHT = hexToRgba(Colors.accent, 0.18);

const FILTER_FROM = '2024-12-10 00:00';
const SCAN_PULSE_ON = Timing.beat;
const SCAN_PULSE_OFF = Timing.beat;
const SCAN_ROW_DELAY = Timing.micro;
const SCAN_BETWEEN_PASSES = Timing.normal;

const paymentColumns: Omit<Column, 'width'>[] = [
  {key: 'id', header: 'id', ellipsis: 'middle', align: 'left'},
  {key: 'status', header: 'status', ellipsis: 'end', align: 'left', color: statusTextColor},
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
  {key: 'status', header: 'status', ellipsis: 'end', align: 'left', color: statusTextColor},
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
  view.add(<Rect width={Screen.width} height={Screen.height} fill={'rgba(168,217,255,0.03)'} />);

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

  function paymentMatches(row: Row): boolean {
    return paymentPassesDate(row) && paymentPassesStatus(row);
  }

  function orderMatches(row: Row): boolean {
    return orderPassesDate(row) && orderPassesStatus(row);
  }

  const slots = getSlots('2L-2R');
  const paymentTableSlot = slots.L1;
  const orderTableSlot = slots.L2;
  const paymentCodeSlot = slots.R1;
  const orderCodeSlot = slots.R2;

  const paymentTableRef = createRef<Rect>();
  const orderTableRef = createRef<Rect>();
  const tableWidth = paymentTableSlot.width;
  const contentWidth = tableWidth - TABLE_PADDING * 2;

  const paymentHighlightCells = paymentRows.map(() => ({
    status: createRef<Rect>(),
    created_at: createRef<Rect>(),
  }));

  const orderHighlightCells = orderRows.map(() => ({
    status: createRef<Rect>(),
    created_at: createRef<Rect>(),
  }));

  const paymentRowRefs = paymentRows.map(() => createRef<Rect>());
  const orderRowRefs = orderRows.map(() => createRef<Rect>());

  view.add(
    <Rect
      ref={paymentTableRef}
      x={paymentTableSlot.x}
      y={paymentTableSlot.y}
      width={tableWidth}
      height={paymentTableSlot.height}
      layout
      direction={'column'}
      gap={0}
      padding={TABLE_PADDING}
      radius={PanelStyle.radiusSmall}
      fill={PANEL_FILL}
      stroke={PANEL_STROKE}
      lineWidth={HAIRLINE}
      shadowColor={'rgba(0,0,0,0)'}
      shadowBlur={0}
      shadowOffset={[0, 0]}
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
          fontFamily={Fonts.primary}
          fontSize={TITLE_FONT_SIZE}
          fontWeight={600}
          fill={TITLE_COLOR}
          text={'PAYMENTS'}
        />
      </Rect>
      <Rect layout width={contentWidth} height={1} fill={PANEL_STROKE} opacity={0.55} marginBottom={10} />
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
                fill={PanelStyle.labelFillMuted}
                text={col.header}
              />
            </Rect>
          </>
        ))}
      </Rect>

      {paymentRows.map((row, rowIndex) => (
        <Rect
          ref={paymentRowRefs[rowIndex]}
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
      x={orderTableSlot.x}
      y={orderTableSlot.y}
      width={tableWidth}
      height={orderTableSlot.height}
      layout
      direction={'column'}
      gap={0}
      padding={TABLE_PADDING}
      radius={PanelStyle.radiusSmall}
      fill={PANEL_FILL}
      stroke={PANEL_STROKE}
      lineWidth={HAIRLINE}
      shadowColor={'rgba(0,0,0,0)'}
      shadowBlur={0}
      shadowOffset={[0, 0]}
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
          fontFamily={Fonts.primary}
          fontSize={TITLE_FONT_SIZE}
          fontWeight={600}
          fill={TITLE_COLOR}
          text={'ORDERS'}
        />
      </Rect>
      <Rect layout width={contentWidth} height={1} fill={PANEL_STROKE} opacity={0.55} marginBottom={10} />
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
                fill={PanelStyle.labelFillMuted}
                text={col.header}
              />
            </Rect>
          </>
        ))}
      </Rect>

      {orderRows.map((row, rowIndex) => (
        <Rect
          ref={orderRowRefs[rowIndex]}
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
              </>
            );
          })}
        </Rect>
      ))}
    </Rect>,
  );

  const cardless: CodeCardStyle = {
    radius: PanelStyle.radiusSmall,
    fill: PANEL_FILL,
    stroke: PANEL_STROKE,
    strokeWidth: HAIRLINE,
    opacity: 1,
    shadowColor: 'rgba(0,0,0,0)',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    edge: true,
  };

  const paymentRepo = CodeBlock.fromCode(PAYMENT_REPO_CODE, {
    x: paymentCodeSlot.x,
    y: paymentCodeSlot.y,
    width: paymentCodeSlot.width,
    height: paymentCodeSlot.height,
    fontSize: CODE_FONT_SIZE,
    fontFamily: Fonts.code,
    theme: ExplainorCodeTheme,
    cardStyle: cardless,
    customTypes: ['PaymentRepository', 'DSLContext', 'PaymentRecord', 'PaymentSearchFilter', 'Condition', 'PaymentConditions'],
  });

  const orderRepo = CodeBlock.fromCode(ORDER_REPO_CODE, {
    x: orderCodeSlot.x,
    y: orderCodeSlot.y,
    width: orderCodeSlot.width,
    height: orderCodeSlot.height,
    fontSize: CODE_FONT_SIZE,
    fontFamily: Fonts.code,
    theme: ExplainorCodeTheme,
    cardStyle: cardless,
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

  yield* all(
    paymentRepo.appear(Timing.slow),
    orderRepo.appear(Timing.slow),
  );

  yield* all(
    paymentRepo.highlightLines([[conditionLineIndex, conditionLineIndex], [whereLineIndex, whereLineIndex]], Timing.slow),
    paymentRepo.recolorLine(conditionLineIndex, Colors.accent, Timing.normal),
    paymentRepo.recolorLine(whereLineIndex, Colors.accent, Timing.normal),
    orderRepo.highlightLines([[conditionLineIndex, conditionLineIndex], [whereLineIndex, whereLineIndex]], Timing.slow),
    orderRepo.recolorLine(conditionLineIndex, Colors.accent, Timing.normal),
    orderRepo.recolorLine(whereLineIndex, Colors.accent, Timing.normal),
  );

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

  yield* waitFor(Timing.normal);

  const hideDur = Timing.slow;
  const hideAnimations: any[] = [];

  for (let i = 0; i < paymentRows.length; i++) {
    if (paymentMatches(paymentRows[i])) continue;
    const rowRef = paymentRowRefs[i]();
    hideAnimations.push(all(
      rowRef.opacity(0, hideDur, easeInOutCubic),
      rowRef.height(0, hideDur, easeInOutCubic),
    ));
  }

  for (let i = 0; i < orderRows.length; i++) {
    if (orderMatches(orderRows[i])) continue;
    const rowRef = orderRowRefs[i]();
    hideAnimations.push(all(
      rowRef.opacity(0, hideDur, easeInOutCubic),
      rowRef.height(0, hideDur, easeInOutCubic),
    ));
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

  yield* all(
    paymentTableRef().opacity(1, Timing.normal, easeInOutCubic),
    orderTableRef().opacity(1, Timing.normal, easeInOutCubic),
    paymentRepo.node.opacity(1, Timing.normal, easeInOutCubic),
    orderRepo.node.opacity(1, Timing.normal, easeInOutCubic),
  );

  yield* waitFor(Timing.normal);

  yield* all(
    disappear(paymentRepo, Timing.slow),
    disappear(orderRepo, Timing.slow),
    disappear(paymentTableRef(), Timing.slow),
    disappear(orderTableRef(), Timing.slow),
  );

  yield* waitFor(Timing.fast);
});


