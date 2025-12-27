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

type ColKey = 'id' | 'status' | 'amount' | 'created_at';
type Row = Record<ColKey, string>;

interface Column {
  key: ColKey;
  header: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  ellipsis?: 'end' | 'middle';
  color?: (value: string) => string;
}

const FONT_FAMILY = Fonts.code;
const FONT_SIZE = 16;
const FONT_WEIGHT = 400;
const ROW_H = 52;
const CELL_PX = 16;
const TABLE_PADDING = 24;

const baseColumns: Omit<Column, 'width'>[] = [
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

const rows: Row[] = [
  {id: '550e8400-e29b-41d4-a716-446655440000', status: 'CAPTURED', amount: '$99.00', created_at: '2024-12-15 14:32'},
  {id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8', status: 'DECLINED', amount: '$150.00', created_at: '2024-12-14 09:15'},
  {id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', status: 'CAPTURED', amount: '$245.00', created_at: '2024-12-12 18:47'},
  {id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', status: 'PENDING', amount: '$78.00', created_at: '2024-12-10 11:03'},
  {id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', status: 'CAPTURED', amount: '$312.50', created_at: '2024-12-08 22:19'},
];

export default makeScene2D(function* (view) {
  applyBackground(view);

  const layouts = placeCodeStack([PAYMENT_REPO_CODE, ORDER_REPO_CODE], 'L', 16);
  const [paymentLayout, orderLayout] = layouts;

  const tableRef = createRef<Rect>();
  const codeRight = paymentLayout.x + paymentLayout.width / 2;
  const edgeMargin = 120;
  const tableLeft = codeRight + edgeMargin;
  const tableRight = SafeZone.right;
  const tableWidth = tableRight - tableLeft;
  const tableX = tableLeft + tableWidth / 2;
  const tableY = paymentLayout.y;
  
  const contentWidth = tableWidth - TABLE_PADDING * 2;

  view.add(
    <Rect
      ref={tableRef}
      x={tableX}
      y={tableY}
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
      scale={0.98}
      clip
    >
      <Rect layout direction={'row'} height={ROW_H} width={contentWidth} justifyContent={'start'} clip>
        {baseColumns.map((col, i) => (
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
        ))}
      </Rect>

      {rows.map((row, rowIndex) => (
        <Rect
          layout
          direction={'row'}
          height={ROW_H}
          width={contentWidth}
          justifyContent={'start'}
          clip
          marginTop={rowIndex === 0 ? 8 : 0}
        >
          {baseColumns.map((col, i) => {
            const raw = row[col.key];
            const cellWidth = contentWidth / baseColumns.length;
            const avail = cellWidth - CELL_PX * 2;
            const shown = fitText(raw, avail, col.ellipsis ?? 'end', FONT_FAMILY, FONT_SIZE, FONT_WEIGHT);
            const textColor = col.color ? col.color(raw) : Colors.text.primary;

            return (
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
                  fontWeight={FONT_WEIGHT}
                  fill={textColor}
                  text={shown}
                />
              </Rect>
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
    tableRef().opacity(1, Timing.slow, easeInOutCubic),
    tableRef().scale(1, Timing.slow, easeInOutCubic),
  );

  yield* waitFor(2);

  orderRepo.mount(view);
  yield* orderRepo.appear(Timing.slow);

  yield* waitFor(3);
});
