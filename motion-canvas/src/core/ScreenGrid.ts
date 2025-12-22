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

import {getCodePadding, getLineHeight, measureCode} from './code/shared/TextMeasure';

const MIN_CARD_WIDTH = 300;
const MAX_CARD_WIDTH = 1600;
const STACK_GAP = 60;
const MIN_FONT_SIZE = 14;

export function placeCode(
  code: string,
  position: PositionKey,
  fontSize: number = 20
): { x: number; y: number; width: number; fontSize: number } {
  const lineCount = code.split('\n').length;
  const padding = getCodePadding(fontSize);

  const metrics = measureCode(code, fontSize);
  const calculatedWidth = metrics.width + padding * 2;
  const blockWidth = Math.min(MAX_CARD_WIDTH, Math.max(MIN_CARD_WIDTH, calculatedWidth));

  const blockHeight = lineCount * getLineHeight(fontSize) + padding * 2;
  
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

  let fs = fontSize;
  while (fs >= MIN_FONT_SIZE) {
    const sizes = codes.map(code => {
      const padding = getCodePadding(fs);
      const metrics = measureCode(code, fs);
      const width = Math.min(MAX_CARD_WIDTH, Math.max(MIN_CARD_WIDTH, metrics.width + padding * 2));
      const height = code.split('\n').length * getLineHeight(fs) + padding * 2;
      return {width, height};
    });

    const maxWidth = Math.max(...sizes.map(s => s.width));
    const maxHeight = Math.max(...sizes.map(s => s.height));

    const totalHeight = codes.length * maxHeight + (codes.length - 1) * STACK_GAP;
    const fits = totalHeight <= (SafeZone.bottom - SafeZone.top);
    if (fits) {
      const x =
        align === 'L' ? (SafeZone.left + maxWidth / 2) :
        align === 'R' ? (SafeZone.right - maxWidth / 2) :
        0;

      const topY = SafeZone.top + maxHeight / 2;
      return codes.map((_, i) => ({
        x,
        y: topY + i * (maxHeight + STACK_GAP),
        width: maxWidth,
        height: maxHeight,
        fontSize: fs,
      }));
    }
    fs -= 2;
  }

  const fallback = placeCode(codes[0], 'C', MIN_FONT_SIZE);
  return codes.map((_, i) => ({
    x: fallback.x,
    y: fallback.y + i * 200,
    width: fallback.width,
    height: 0,
    fontSize: MIN_FONT_SIZE,
  }));
}

