/**
 * Система размещения кода на экране.
 * См. CODE_PLACEMENT.txt в корне проекта.
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

/**
 * Координаты центра для каждой позиции на экране.
 * 
 *     TL   TC   TR
 *     ML   C    MR
 *     BL   BC   BR
 */
export const Position: Record<PositionKey, Point> = {
  // Top row
  TL: { x: -550, y: -280 },
  TC: { x: 0,    y: -280 },
  TR: { x: 550,  y: -280 },
  
  // Middle row
  ML: { x: -550, y: 0 },
  C:  { x: 0,    y: 0 },
  MR: { x: 550,  y: 0 },
  
  // Bottom row
  BL: { x: -550, y: 280 },
  BC: { x: 0,    y: 280 },
  BR: { x: 550,  y: 280 },
  
  // Aliases
  L: { x: -550, y: 0 },
  R: { x: 550,  y: 0 },
  T: { x: 0,    y: -280 },
  B: { x: 0,    y: 280 },
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

