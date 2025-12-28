/**
 * Система размещения кода на экране.
 * См. CODE_PLACEMENT.txt в корне проекта.
 * 
 * Экран: 1920×1080, центр (0, 0)
 * Safe zone: 80px сверху/снизу, 120px слева/справа
 * Рабочая область: 1680×920 (от -840 до +840 по X, от -460 до +460 по Y)
 */

export type PositionKey = 
  | 'TL' | 'TC' | 'TR'
  | 'ML' | 'C'  | 'MR'
  | 'BL' | 'BC' | 'BR'
  | 'L'  | 'R'  | 'T' | 'B';

export type SizeKey = 'S' | 'M' | 'L' | 'F';

export interface Point {
  x: number;
  y: number;
}

// Safe zone boundaries
const SAFE_TOP = -380;    // Учитывает высоту блока ~160px (верх блока будет ~-460)
const SAFE_BOTTOM = 380;
const SAFE_LEFT = -500;   // Учитывает ширину блока M (левый край ~-800)
const SAFE_RIGHT = 500;

/**
 * Координаты центра для каждой позиции на экране.
 * Позиции учитывают safe zone — код не будет прилипать к краям.
 * 
 *     TL   TC   TR
 *     ML   C    MR
 *     BL   BC   BR
 */
export const Position: Record<PositionKey, Point> = {
  // Top row (y = -300, внутри safe zone с запасом)
  TL: { x: SAFE_LEFT,  y: -300 },
  TC: { x: 0,          y: -300 },
  TR: { x: SAFE_RIGHT, y: -300 },
  
  // Middle row (y = 0, центр экрана)
  ML: { x: SAFE_LEFT,  y: 0 },
  C:  { x: 0,          y: 0 },
  MR: { x: SAFE_RIGHT, y: 0 },
  
  // Bottom row (y = +300, внутри safe zone с запасом)
  BL: { x: SAFE_LEFT,  y: 300 },
  BC: { x: 0,          y: 300 },
  BR: { x: SAFE_RIGHT, y: 300 },
  
  // Aliases
  L: { x: SAFE_LEFT,  y: 0 },
  R: { x: SAFE_RIGHT, y: 0 },
  T: { x: 0,          y: -300 },
  B: { x: 0,          y: 300 },
};

/**
 * Ширина блока кода для каждого размера.
 */
export const Size: Record<SizeKey, number> = {
  S: 400,   // Small — узкий блок
  M: 600,   // Medium — стандартный
  L: 900,   // Large — широкий
  F: 1600,  // Full — почти весь экран
};

/**
 * Стиль карточки для режима "nocard" — полностью прозрачная.
 */
export const NoCardStyle = {
  fill: '#00000000',
  stroke: '#00000000',
  strokeWidth: 0,
  shadowBlur: 0,
  shadowColor: '#00000000',
};

// ============================================================================
// SAFE ZONE + ANCHOR POSITIONING
// ============================================================================

/**
 * Safe zone — рабочая область экрана (внутри отступов от краёв).
 * Экран 1920×1080, центр (0,0).
 */
export const SafeZone = {
  top: -480,
  bottom: 480,
  left: -840,
  right: 840,
};

/**
 * Тип якоря: к какому краю/углу привязан блок.
 */
export type AnchorType = 'top-left' | 'top-center' | 'top-right'
                       | 'middle-left' | 'center' | 'middle-right'
                       | 'bottom-left' | 'bottom-center' | 'bottom-right';

const ANCHOR_MAP: Record<PositionKey, AnchorType> = {
  TL: 'top-left',     TC: 'top-center',     TR: 'top-right',
  ML: 'middle-left',  C:  'center',         MR: 'middle-right',
  BL: 'bottom-left',  BC: 'bottom-center',  BR: 'bottom-right',
  L:  'middle-left',  R:  'middle-right',
  T:  'top-center',   B:  'bottom-center',
};

import {getCodePaddingX, getCodePaddingY, getLineHeight} from './code/shared/TextMeasure';
import {textWidth} from './utils/textMeasure';
import {Fonts} from './theme';

function measureCodeWidth(code: string, fontSize: number, fontFamily: string = Fonts.code): number {
  const lines = code.split('\n');
  let maxWidth = 0;
  for (const line of lines) {
    const w = textWidth(line, fontFamily, fontSize);
    if (w > maxWidth) maxWidth = w;
  }
  return maxWidth;
}

const MIN_CARD_WIDTH = 300;
const MAX_CARD_WIDTH = 1600;
const STACK_GAP = 60;

export function placeCode(
  code: string,
  position: PositionKey,
  fontSize: number = 20
): { x: number; y: number; width: number; fontSize: number } {
  const lineCount = code.split('\n').length;
  const paddingX = getCodePaddingX(fontSize);
  const paddingY = getCodePaddingY(fontSize);

  const contentWidth = measureCodeWidth(code, fontSize);
  const calculatedWidth = contentWidth + paddingX * 2;
  const blockWidth = Math.min(MAX_CARD_WIDTH, Math.max(MIN_CARD_WIDTH, calculatedWidth));

  const blockHeight = lineCount * getLineHeight(fontSize) + paddingY * 2;
  
  const anchor = ANCHOR_MAP[position];
  
  let x: number;
  let y: number;
  
  if (anchor.includes('left')) {
    x = SafeZone.left + blockWidth / 2;
  } else if (anchor.includes('right')) {
    x = SafeZone.right - blockWidth / 2;
  } else {
    x = 0;
  }
  
  if (anchor.startsWith('top')) {
    y = SafeZone.top + blockHeight / 2;
  } else if (anchor.startsWith('bottom')) {
    y = SafeZone.bottom - blockHeight / 2;
  } else {
    y = 0;
  }
  
  return { x, y, width: blockWidth, fontSize };
}

export type StackAlign = 'L' | 'C' | 'R';

export function placeCodeStack(
  codes: string[],
  align: StackAlign,
  fontSize: number = 20
): { x: number; y: number; width: number; height: number; fontSize: number }[] {
  if (codes.length === 0) return [];

  const sizes = codes.map(code => {
    const paddingX = getCodePaddingX(fontSize);
    const paddingY = getCodePaddingY(fontSize);
    const contentWidth = measureCodeWidth(code, fontSize);
    const width = Math.min(MAX_CARD_WIDTH, Math.max(MIN_CARD_WIDTH, contentWidth + paddingX * 2));
    const height = code.split('\n').length * getLineHeight(fontSize) + paddingY * 2;
    return {width, height};
  });

  const maxWidth = Math.max(...sizes.map(s => s.width));
  const maxHeight = Math.max(...sizes.map(s => s.height));

  const x =
    align === 'L' ? (SafeZone.left + maxWidth / 2) :
    align === 'R' ? (SafeZone.right - maxWidth / 2) :
    0;

  const safeHeight = SafeZone.bottom - SafeZone.top;
  const stackHeight = codes.length * maxHeight + (codes.length - 1) * STACK_GAP;
  const marginY = Math.max(0, (safeHeight - stackHeight) / 2);
  const topY = SafeZone.top + marginY + maxHeight / 2;
  
  return codes.map((_, i) => ({
    x,
    y: topY + i * (maxHeight + STACK_GAP),
    width: maxWidth,
    height: maxHeight,
    fontSize,
  }));
}

export interface TablePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

export interface PlaceTableOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  rowCount?: number;
}

const TABLE_PADDING_X = 48;
const TABLE_PADDING_Y = 40;
const TABLE_ROW_HEIGHT_FACTOR = 2.8;

export function placeTable(
  position: PositionKey,
  options: PlaceTableOptions = {}
): TablePlacement {
  const fontSize = options.fontSize ?? 14;
  const rowCount = options.rowCount ?? 4;
  
  const rowHeight = fontSize * TABLE_ROW_HEIGHT_FACTOR;
  const contentHeight = rowHeight * (rowCount + 1);
  const height = options.height ?? (contentHeight + TABLE_PADDING_Y);
  const width = options.width ?? 500;
  
  const anchor = ANCHOR_MAP[position];
  
  let x: number;
  let y: number;
  
  if (anchor.includes('left')) {
    x = SafeZone.left + width / 2;
  } else if (anchor.includes('right')) {
    x = SafeZone.right - width / 2;
  } else {
    x = 0;
  }
  
  if (anchor.startsWith('top')) {
    y = SafeZone.top + height / 2;
  } else if (anchor.startsWith('bottom')) {
    y = SafeZone.bottom - height / 2;
  } else {
    y = 0;
  }
  
  return { x, y, width, height, fontSize };
}

export function placeTableNextTo(
  codeLayout: { x: number; y: number; width: number; height: number },
  side: 'left' | 'right',
  options: PlaceTableOptions = {}
): TablePlacement {
  const fontSize = options.fontSize ?? 14;
  const rowCount = options.rowCount ?? 4;
  
  const rowHeight = fontSize * TABLE_ROW_HEIGHT_FACTOR;
  const contentHeight = rowHeight * (rowCount + 1);
  const height = options.height ?? codeLayout.height;
  let width = options.width ?? 500;
  
  const gap = STACK_GAP;
  
  let x: number;
  if (side === 'right') {
    const codeRight = codeLayout.x + codeLayout.width / 2;
    const maxWidth = SafeZone.right - (codeRight + gap);
    width = Math.max(MIN_CARD_WIDTH, Math.min(width, maxWidth));
    x = codeRight + gap + width / 2;
    x = Math.min(x, SafeZone.right - width / 2);
  } else {
    const codeLeft = codeLayout.x - codeLayout.width / 2;
    const maxWidth = (codeLeft - gap) - SafeZone.left;
    width = Math.max(MIN_CARD_WIDTH, Math.min(width, maxWidth));
    x = codeLeft - gap - width / 2;
    x = Math.max(x, SafeZone.left + width / 2);
  }
  
  const y = codeLayout.y;
  
  return { x, y, width, height, fontSize };
}

