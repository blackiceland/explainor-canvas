import {Code, Line, lines, makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {getSlots} from '../core/layouts';
import {SafeZone} from '../core/ScreenGrid';
import {Colors, Fonts, Screen, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';
import {fitText, textWidth} from '../core/utils/textMeasure';
import {appear, disappear} from '../core/beats';

type Row = Record<string, string>;

interface Column {
  key: string;
  header: string;
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
  return 'rgba(244,241,235,0.62)';
}

const PAYMENT_FILTER_CODE =
  'final class PaymentRepository {\n\n' +
  '  private final DSLContext dsl;\n\n' +
  '  PaymentRepository(DSLContext dsl) {\n' +
  '    this.dsl = dsl;\n' +
  '  }\n\n' +
  '  List<PaymentRecord> find(PaymentSearchFilter filter) {\n' +
  '    Condition condition = PaymentConditions.fromFilter(filter);\n\n' +
  '    return dsl.selectFrom(PAYMENTS)\n' +
  '      .where(condition)\n' +
  '      .fetch();\n' +
  '  }\n' +
  '}';

const ORDER_FILTER_CODE =
  'final class OrderRepository {\n\n' +
  '  private final DSLContext dsl;\n\n' +
  '  OrderRepository(DSLContext dsl) {\n' +
  '    this.dsl = dsl;\n' +
  '  }\n\n' +
  '  List<OrderRecord> find(OrderSearchFilter filter) {\n' +
  '    Condition condition = OrderConditions.fromFilter(filter);\n\n' +
  '    return dsl.selectFrom(ORDERS)\n' +
  '      .where(condition)\n' +
  '      .fetch();\n' +
  '  }\n' +
  '}';

const FONT_FAMILY = Fonts.code;
const FONT_SIZE = 18;
const FONT_WEIGHT = 450;
const ROW_H = 50;
const CELL_PX = 18;
const HEADER_H = 28;
const HEADER_FONT = 18;
const HEADER_TRACKING = 2.2;
const QUAD_INSET = 44;
// getSlots() размечает контент внутри SafeZone, но визуально “верхняя граница кадра”
// — это верх экрана (а для нижних квадрантов — центральная линия y=0).
// Чтобы отступы выглядели симметрично, добавляем safe-margin только нижним квадрантам.
const SCREEN_TOP = -Screen.height / 2;
const SAFE_MARGIN_TOP = SafeZone.top - SCREEN_TOP; // ожидаемо 60px при SafeZone.top=-480 и Screen.height=1080
const GRID_STROKE = hexToRgba(Colors.text.primary, 0.12);
const GRID_W = 1;
const CELL_FILL_OFF = 'rgba(0, 0, 0, 0)';
const CELL_HIGHLIGHT = hexToRgba(Colors.accent, 0.16);
// Manual composition trims (requested):
// Move code blocks up slightly inside their quadrants.
const PAYMENT_REPO_RISE_Y = 50;
const ORDER_REPO_RISE_Y = 50;

const FILTER_FROM = '2024-12-10 00:00';
const SCAN_PULSE_ON = Timing.beat;
const SCAN_PULSE_OFF = Timing.beat;
const SCAN_ROW_DELAY = Timing.micro;
const SCAN_BETWEEN_PASSES = Timing.normal;

const paymentColumns: Column[] = [
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

const orderColumns: Column[] = [
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

  const dividerV = createRef<Line>();
  const dividerH = createRef<Line>();

  view.add(
    <>
      <Line
        ref={dividerV}
        points={[[0, -Screen.height / 2], [0, Screen.height / 2]]}
        stroke={GRID_STROKE}
        lineWidth={GRID_W}
        lineCap={'round'}
        opacity={0}
      />
      <Line
        ref={dividerH}
        points={[[-Screen.width / 2, 0], [Screen.width / 2, 0]]}
        stroke={GRID_STROKE}
        lineWidth={GRID_W}
        lineCap={'round'}
        opacity={0}
      />
    </>,
  );

  const slots = getSlots('2L-2R', {gap: 0, paddingX: 0, paddingY: 0});
  const leftTop = slots.L1;
  const leftBottom = slots.L2;
  const rightTop = slots.R1;
  const rightBottom = slots.R2;
  const tableDx = -50;

  const quadTopInset = (slot: {y: number}) => QUAD_INSET + (slot.y > 0 ? SAFE_MARGIN_TOP : 0);

  const paymentTableRef = createRef<Rect>();
  const orderTableRef = createRef<Rect>();

  const paymentRowsRefs = paymentRows.map(() => createRef<Rect>());
  const orderRowsRefs = orderRows.map(() => createRef<Rect>());

  const paymentHighlightCells = paymentRows.map(() => ({
    status: createRef<Rect>(),
    created_at: createRef<Rect>(),
  }));

  const orderHighlightCells = orderRows.map(() => ({
    status: createRef<Rect>(),
    created_at: createRef<Rect>(),
  }));

  const contentWidthL = leftTop.width;
  const colCountL = paymentColumns.length;
  const cellWidthL = contentWidthL / colCountL;

  const buildTable = (
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
      paddingTop={quadTopInset(slot)}
      paddingLeft={CELL_PX}
      paddingRight={CELL_PX}
      fill={'rgba(0,0,0,0)'}
      opacity={0}
      clip
    >
      <Rect layout direction={'row'} height={HEADER_H} width={slot.width} justifyContent={'start'} alignItems={'center'} clip>
        <Txt
          fontFamily={Fonts.primary}
          fontSize={HEADER_FONT}
          fontWeight={700}
          letterSpacing={HEADER_TRACKING}
          fill={'rgba(244,241,235,0.62)'}
          text={title}
        />
      </Rect>
      <Rect layout direction={'row'} height={ROW_H} width={slot.width} justifyContent={'start'} clip>
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
              fill={'rgba(244,241,235,0.48)'}
              text={col.header}
            />
          </Rect>
        ))}
      </Rect>
      {rows.map((row, idx) => (
        <Rect ref={rowRefs[idx]} layout direction={'row'} height={ROW_H} width={slot.width} justifyContent={'start'} clip>
          {cols.map(col => {
            const raw = row[col.key];
            const avail = cellWidthL - CELL_PX * 2;
            const shown = fitText(raw, avail, col.ellipsis ?? 'end', FONT_FAMILY, FONT_SIZE, FONT_WEIGHT);
            const textColor = col.color ? col.color(raw) : 'rgba(244,241,235,0.78)';
            const highlightRef =
              col.key === 'status' ? highlightCells[idx].status :
              col.key === 'created_at' ? highlightCells[idx].created_at :
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
            );
          })}
        </Rect>
      ))}
    </Rect>
  );

  view.add(
    <>
      {buildTable(paymentTableRef, {...leftTop, x: leftTop.x + tableDx}, 'PAYMENTS', paymentColumns, paymentRows, paymentRowsRefs, paymentHighlightCells)}
      {buildTable(orderTableRef, {...leftBottom, x: leftBottom.x + tableDx}, 'ORDERS', orderColumns, orderRows, orderRowsRefs, orderHighlightCells)}
    </>,
  );

  const codeTopOn = createSignal(0);
  const codeBottomOn = createSignal(0);
  // Прогресс подсветки: 0 = обычный код, 1 = dim остальных строк + recolor target строк в accent
  const codeTopHighlight = createSignal(0);
  const codeBottomHighlight = createSignal(0);

  const base = 'rgba(244,241,235,0.72)';
  const punctuation = 'rgba(244,241,235,0.58)';
  const keyword = 'rgba(163,205,255,0.82)';
  const method = Colors.accent;
  const type = 'rgba(201,180,255,0.78)';

  const KEYWORDS = new Set(['return', 'final', 'class', 'private', 'public', 'new', 'this']);
  const TYPES = new Set([
    'PaymentRepository',
    'OrderRepository',
    'DSLContext',
    'List',
    'PaymentRecord',
    'OrderRecord',
    'PaymentSearchFilter',
    'OrderSearchFilter',
    'Condition',
    'PaymentConditions',
    'OrderConditions',
    'PAYMENTS',
    'ORDERS',
  ]);

  const maxCodeW = rightTop.width - QUAD_INSET * 2;
  const maxCodeH = rightTop.height - QUAD_INSET * 2 - 10;
  const fontFamily = Fonts.code;
  const fontWeight = 400;
  const lineHeightRatio = 1.45;

  const maxLineW = (text: string, size: number) => {
    const lines = text.split('\n');
    let max = 0;
    for (const line of lines) {
      max = Math.max(max, textWidth(line, fontFamily, size, fontWeight));
    }
    return max;
  };

  const fitFont = (text: string, maxW: number, maxH: number, min: number, max: number) => {
    const lines = Math.max(1, text.split('\n').length);
    let lo = min;
    let hi = max;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const wOk = maxLineW(text, mid) <= maxW;
      const hOk = lines * (mid * lineHeightRatio) <= maxH;
      if (wOk && hOk) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  const fontSizeTop = fitFont(PAYMENT_FILTER_CODE, maxCodeW, maxCodeH, 20, 48);
  const fontSizeBottom = fitFont(ORDER_FILTER_CODE, maxCodeW, maxCodeH, 20, 48);
  const fontSize = Math.min(fontSizeTop, fontSizeBottom);
  const lineHeight = Math.round(fontSize * lineHeightRatio);

  const blockSize = (text: string) => {
    const lines = text.split('\n');
    const w = maxLineW(text, fontSize);
    const h = lines.length * lineHeight;
    return {w, h};
  };

  const topBlock = blockSize(PAYMENT_FILTER_CODE);
  const bottomBlock = blockSize(ORDER_FILTER_CODE);

  const unifiedW = Math.max(topBlock.w, bottomBlock.w);

  const codeClipTop = createRef<Rect>();
  const codeClipBottom = createRef<Rect>();
  const codeTopRef = createRef<Code>();
  const codeBottomRef = createRef<Code>();

  function parseColorToRgba(color: string): {r: number; g: number; b: number; a: number} | null {
    const c = String(color ?? '').trim();
    if (!c) return null;
    if (c.startsWith('#')) {
      const hex = c.slice(1);
      const full = hex.length === 3 ? hex.split('').map(x => x + x).join('') : hex;
      if (full.length !== 6) return null;
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      return {r, g, b, a: 1};
    }
    const m = c.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*([0-9.]+)\s*)?\)$/i);
    if (!m) return null;
    return {
      r: Number(m[1]),
      g: Number(m[2]),
      b: Number(m[3]),
      a: m[4] === undefined ? 1 : Number(m[4]),
    };
  }

  function lerpColor(from: string, to: string, t: number): string {
    const a = parseColorToRgba(from);
    const b = parseColorToRgba(to);
    if (!a || !b) return t >= 0.5 ? to : from;
    const k = Math.max(0, Math.min(1, t));
    const r = Math.round(a.r + (b.r - a.r) * k);
    const g = Math.round(a.g + (b.g - a.g) * k);
    const bb = Math.round(a.b + (b.b - a.b) * k);
    const alpha = a.a + (b.a - a.a) * k;
    return `rgba(${r},${g},${bb},${alpha})`;
  }

  view.add(
    <>
      <Rect
        ref={codeClipTop}
        x={rightTop.x}
        y={rightTop.y}
        width={rightTop.width}
        height={rightTop.height}
        fill={'rgba(0,0,0,0)'}
        clip
        opacity={() => codeTopOn()}
        layout
        direction={'column'}
        gap={0}
        paddingTop={quadTopInset(rightTop) - PAYMENT_REPO_RISE_Y}
        paddingLeft={QUAD_INSET}
      >
      <Rect layout width={rightTop.width} fill={'rgba(0,0,0,0)'}>
        <Code
          ref={codeTopRef}
          code={PAYMENT_FILTER_CODE}
          fontFamily={Fonts.code}
          fontSize={fontSize}
          lineHeight={lineHeight}
          opacity={1}
          x={unifiedW / 2}
          y={0}
          selection={lines(0, Infinity)}
          drawHooks={{
          token: (
            canvasCtx: CanvasRenderingContext2D,
            text: string,
            position: {x: number; y: number},
            color: string,
            selection: number,
          ) => {
            const raw = String(text ?? '');
            const prevAlpha = canvasCtx.globalAlpha;

            const p = codeTopHighlight();
            const selected = selection > 0.5;
            // Dim only when highlight is active; selection is a reliable mask (lines(9), lines(12))
            const alphaMultiplier = selected ? 1 : 1 - p * (1 - 0.22);
            
            canvasCtx.globalAlpha *= alphaMultiplier;

            let x = position.x;
            const y = position.y;

            const flush = (seg: string, segColor: string) => {
              if (seg.length === 0) return;
              const finalColor = selected ? lerpColor(segColor, Colors.accent, p) : segColor;
              canvasCtx.fillStyle = finalColor;
              canvasCtx.fillText(seg, x, y);
              x += canvasCtx.measureText(seg).width;
            };

            let i = 0;
            while (i < raw.length) {
              const ch = raw[i];

              if (/[A-Za-z_]/.test(ch)) {
                let j = i + 1;
                while (j < raw.length && /[A-Za-z0-9_]/.test(raw[j])) j += 1;
                const word = raw.slice(i, j);
                if (KEYWORDS.has(word)) flush(word, keyword);
                else if (TYPES.has(word)) flush(word, type);
                else if (word === 'where' || word === 'fetch' || word === 'fromFilter' || word === 'selectFrom')
                  flush(word, method);
                else flush(word, base);
                i = j;
                continue;
              }

              if (ch === '(' || ch === ')' || ch === ':' || ch === '=' || ch === '.') {
                flush(ch, punctuation);
                i += 1;
                continue;
              }

              flush(ch, base);
              i += 1;
            }

            canvasCtx.globalAlpha = prevAlpha;
          },
        }}
        />
      </Rect>
      </Rect>
      <Rect
        ref={codeClipBottom}
        x={rightBottom.x}
        y={rightBottom.y}
        width={rightBottom.width}
        fill={'rgba(0,0,0,0)'}
        opacity={() => codeBottomOn()}
        layout
        direction={'column'}
        gap={0}
        paddingTop={quadTopInset(rightBottom) - ORDER_REPO_RISE_Y}
        paddingLeft={QUAD_INSET}
        paddingBottom={0}
      >
      <Rect layout width={rightBottom.width} fill={'rgba(0,0,0,0)'}>
        <Code
          ref={codeBottomRef}
          code={ORDER_FILTER_CODE}
          fontFamily={Fonts.code}
          fontSize={fontSize}
          lineHeight={lineHeight}
          opacity={1}
          x={unifiedW / 2}
          y={0}
          selection={lines(0, Infinity)}
          drawHooks={{
          token: (
            canvasCtx: CanvasRenderingContext2D,
            text: string,
            position: {x: number; y: number},
            color: string,
            selection: number,
          ) => {
            const raw = String(text ?? '');
            const prevAlpha = canvasCtx.globalAlpha;

            const p = codeBottomHighlight();
            const selected = selection > 0.5;
            const alphaMultiplier = selected ? 1 : 1 - p * (1 - 0.22);
            
            canvasCtx.globalAlpha *= alphaMultiplier;

            let x = position.x;
            const y = position.y;

            const flush = (seg: string, segColor: string) => {
              if (seg.length === 0) return;
              const finalColor = selected ? lerpColor(segColor, Colors.accent, p) : segColor;
              canvasCtx.fillStyle = finalColor;
              canvasCtx.fillText(seg, x, y);
              x += canvasCtx.measureText(seg).width;
            };

            let i = 0;
            while (i < raw.length) {
              const ch = raw[i];

              if (/[A-Za-z_]/.test(ch)) {
                let j = i + 1;
                while (j < raw.length && /[A-Za-z0-9_]/.test(raw[j])) j += 1;
                const word = raw.slice(i, j);
                if (KEYWORDS.has(word)) flush(word, keyword);
                else if (TYPES.has(word)) flush(word, type);
                else if (word === 'where' || word === 'fetch' || word === 'fromFilter' || word === 'selectFrom')
                  flush(word, method);
                else flush(word, base);
                i = j;
                continue;
              }

              if (ch === '(' || ch === ')' || ch === ':' || ch === '=' || ch === '.') {
                flush(ch, punctuation);
                i += 1;
                continue;
              }

              flush(ch, base);
              i += 1;
            }

            canvasCtx.globalAlpha = prevAlpha;
          },
        }}
        />
      </Rect>
      </Rect>
    </>,
  );

  const pulseCell = function* (cell: Rect, on: number = SCAN_PULSE_ON, off: number = SCAN_PULSE_OFF) {
    yield* cell.fill(CELL_HIGHLIGHT, on, easeInOutCubic);
    yield* cell.fill(CELL_FILL_OFF, off, easeInOutCubic);
  };

  const passesDateFrom = (v: string) => v >= FILTER_FROM;
  const paymentPassesDate = (row: Row) => passesDateFrom(row.created_at);
  const orderPassesDate = (row: Row) => passesDateFrom(row.created_at);
  const paymentPassesStatus = (row: Row) => row.status === 'CAPTURED';
  const orderPassesStatus = (row: Row) => row.status === 'SHIPPED';
  const paymentMatches = (row: Row) => paymentPassesDate(row) && paymentPassesStatus(row);
  const orderMatches = (row: Row) => orderPassesDate(row) && orderPassesStatus(row);

  yield* all(
    appear(dividerV(), Timing.slow),
    appear(dividerH(), Timing.slow),
  );

  yield* all(
    appear(paymentTableRef(), Timing.slow),
    appear(orderTableRef(), Timing.slow),
  );

  yield* all(
    codeTopOn(1, Timing.slow, easeInOutCubic),
    codeBottomOn(1, Timing.slow, easeInOutCubic),
  );

  // Refs: dryFiltersScene.tsx — hold before highlight ≈ 0.4s
  yield* waitFor(0.4);

  // Индексы строк для подсветки (как в оригинале)
  const conditionLineIndex = 9; // строка "Condition condition = ..."
  const whereLineIndex = 12; // строка ".where(condition)"

  // Подсветка строк кода и затемнение остального.
  // Стандарт плавности (DAEDALUS): easing = easeInOutCubic по умолчанию.
  // Логику строк берём из Code.selection(lines(...)) — без гаданий по position.y.
  codeTopRef().selection([lines(conditionLineIndex), lines(whereLineIndex)]);
  codeBottomRef().selection([lines(conditionLineIndex), lines(whereLineIndex)]);
  yield* all(
    codeTopHighlight(1, Timing.slow, easeInOutCubic),
    codeBottomHighlight(1, Timing.slow, easeInOutCubic),
  );

  // Ref: dryFiltersScene.tsx — hold after highlight ≈ 0.6s
  yield* waitFor(0.6);

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
    const rowRef = paymentRowsRefs[i]();
    hideAnimations.push(all(rowRef.opacity(0, hideDur, easeInOutCubic), rowRef.height(0, hideDur, easeInOutCubic)));
  }

  for (let i = 0; i < orderRows.length; i++) {
    if (orderMatches(orderRows[i])) continue;
    const rowRef = orderRowsRefs[i]();
    hideAnimations.push(all(rowRef.opacity(0, hideDur, easeInOutCubic), rowRef.height(0, hideDur, easeInOutCubic)));
  }

  if (hideAnimations.length > 0) {
    yield* all(...hideAnimations);
  }

  yield* waitFor(Timing.beat);

  // Возврат кода к нормальному виду (снять подсветку и затемнение)
  // В референсе это 0.45, но для более "плавного" выхода делаем чуть дольше.
  const highlightExitDur = Timing.normal;
  yield* all(
    codeTopHighlight(0, highlightExitDur, easeInOutCubic),
    codeBottomHighlight(0, highlightExitDur, easeInOutCubic),
  );
  codeTopRef().selection(lines(0, Infinity));
  codeBottomRef().selection(lines(0, Infinity));

  yield* waitFor(Timing.normal);

  yield* all(
    codeTopOn(0, Timing.slow, easeInOutCubic),
    codeBottomOn(0, Timing.slow, easeInOutCubic),
    disappear(paymentTableRef(), Timing.slow),
    disappear(orderTableRef(), Timing.slow),
    disappear(dividerV(), Timing.slow),
    disappear(dividerH(), Timing.slow),
  );
});


