import {Rect, Txt} from '@motion-canvas/2d';
import {createRef, Reference} from '@motion-canvas/core';
import {PanelStyle} from '../panelStyle';
import {Colors, Fonts} from '../theme';
import {fitText} from '../utils/textMeasure';
import {ExplainorCodeTheme} from '../code/model/SyntaxTheme';

export type TableEllipsisMode = 'end' | 'middle';
export type TableAlign = 'left' | 'center' | 'right';

export interface TableColumnSpec<T extends Record<string, string>> {
  key: keyof T & string;
  header: string;
  align?: TableAlign;
  ellipsis?: TableEllipsisMode;
  color?: (value: string) => string;
}

export interface TableCardOptions<T extends Record<string, string>> {
  title: string;
  rows: T[];
  columns: TableColumnSpec<T>[];

  x: number;
  y: number;
  width: number;
  height: number;

  padding?: number;
  rowHeight?: number;
  cellPx?: number;
  titleHeight?: number;
  titleFontSize?: number;
  fontSize?: number;
  fontWeight?: number;

  titleFill?: string;
  headerFill?: string;
  headerFontWeight?: number;
  dividerFill?: string;
}

export interface TableCardRefs<T extends Record<string, string>> {
  cardRef: Reference<Rect>;
  rowRefs: Reference<Rect>[];
  cellRefs: Record<number, Partial<Record<keyof T & string, Reference<Rect>>>>;
}

export function createTableCard<T extends Record<string, string>>(
  options: TableCardOptions<T>,
): {element: any; refs: TableCardRefs<T>} {
  const {
    title,
    rows,
    columns,
    x,
    y,
    width,
    height,
    padding = 24,
    rowHeight = 48,
    cellPx = 16,
    titleHeight = 24,
    titleFontSize = 14,
    fontSize = 16,
    fontWeight = 400,
    titleFill = PanelStyle.labelFillMuted,
    headerFill = ExplainorCodeTheme.method,
    headerFontWeight = 600,
    dividerFill = 'rgba(255, 255, 255, 0.08)',
  } = options;

  const cardRef = createRef<Rect>();
  const rowRefs: Reference<Rect>[] = rows.map(() => createRef<Rect>());
  const cellRefs: Record<number, Partial<Record<keyof T & string, Reference<Rect>>>> = {};
  for (let i = 0; i < rows.length; i++) {
    cellRefs[i] = {};
    for (const col of columns) {
      cellRefs[i][col.key] = createRef<Rect>();
    }
  }

  const contentWidth = width - padding * 2;
  const colCount = Math.max(1, columns.length);
  const cellWidth = contentWidth / colCount;
  const avail = cellWidth - cellPx * 2;

  const element = (
    <Rect
      ref={cardRef}
      x={x}
      y={y}
      width={width}
      height={height}
      layout
      direction={'column'}
      gap={0}
      padding={padding}
      radius={PanelStyle.radius}
      fill={Colors.surface}
      stroke={PanelStyle.stroke}
      lineWidth={PanelStyle.lineWidth}
      shadowColor={PanelStyle.shadowColor}
      shadowBlur={PanelStyle.shadowBlur}
      shadowOffset={PanelStyle.shadowOffset}
      clip
      opacity={0}
    >
      <Rect
        layout
        direction={'row'}
        height={titleHeight}
        width={contentWidth}
        justifyContent={'start'}
        alignItems={'center'}
        clip
        marginBottom={10}
      >
        <Txt
          fontFamily={Fonts.code}
          fontSize={titleFontSize}
          fontWeight={600}
          fill={titleFill}
          text={title}
        />
      </Rect>

      <Rect layout direction={'row'} height={rowHeight} width={contentWidth} justifyContent={'start'} clip>
        {columns.map((col, i) => (
          <>
            <Rect
              layout
              grow={1}
              shrink={1}
              basis={0}
              minWidth={0}
              height={'100%'}
              paddingLeft={cellPx}
              paddingRight={cellPx}
              alignItems={'center'}
              justifyContent={'start'}
              clip
            >
              <Txt
                width={'100%'}
                minWidth={0}
                textWrap={false}
                textAlign={col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left'}
                fontFamily={Fonts.code}
                fontSize={fontSize}
                fontWeight={headerFontWeight}
                fill={headerFill}
                text={col.header}
              />
            </Rect>
            {i < columns.length - 1 && <Rect width={1} height={'100%'} fill={dividerFill} shrink={0} />}
          </>
        ))}
      </Rect>

      {rows.map((row, rowIndex) => (
        <Rect
          ref={rowRefs[rowIndex]}
          layout
          direction={'row'}
          height={rowHeight}
          width={contentWidth}
          justifyContent={'start'}
          clip
          marginTop={rowIndex === 0 ? 8 : 0}
        >
          {columns.map((col, i) => {
            const raw = row[col.key];
            const shown = fitText(raw, avail, col.ellipsis ?? 'end', Fonts.code, fontSize, fontWeight);
            const textColor = col.color ? col.color(raw) : Colors.text.primary;
            const cellRef = cellRefs[rowIndex][col.key]!;

            return (
              <>
                <Rect
                  ref={cellRef}
                  layout
                  grow={1}
                  shrink={1}
                  basis={0}
                  minWidth={0}
                  height={'100%'}
                  paddingLeft={cellPx}
                  paddingRight={cellPx}
                  alignItems={'center'}
                  justifyContent={'start'}
                  clip
                >
                  <Txt
                    width={'100%'}
                    minWidth={0}
                    textWrap={false}
                    textAlign={col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left'}
                    fontFamily={Fonts.code}
                    fontSize={fontSize}
                    fontWeight={fontWeight}
                    fill={textColor}
                    text={shown}
                  />
                </Rect>
                {i < columns.length - 1 && <Rect width={1} height={'100%'} fill={dividerFill} shrink={0} />}
              </>
            );
          })}
        </Rect>
      ))}
    </Rect>
  );

  return {element, refs: {cardRef, rowRefs, cellRefs}};
}


