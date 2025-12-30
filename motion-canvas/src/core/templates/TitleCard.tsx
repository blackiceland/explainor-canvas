import {Node, Txt} from '@motion-canvas/2d';
import {createRef, easeInOutCubic, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {Fonts, Screen} from '../theme';
import {textWidth} from '../utils/textMeasure';

export type TitleCardAlign = 'left' | 'center';

export interface TitleCardOptions {
  lines: string[];
  fill?: string;
  fontWeight?: 600 | 700 | 800;
  align?: TitleCardAlign;

  marginX?: number;
  marginY?: number;
  leftBias?: number;

  baseSize?: number;
  lineHeightFactor?: number;
  letterSpacingFactor?: number;

  fadeIn?: number;
  hold?: number;
  fadeOut?: number;
}

export function* playTitleCard(view: Node, options: TitleCardOptions): ThreadGenerator {
  const {
    lines,
    fill = '#F6E7D4',
    fontWeight = 700,
    align = 'left',
    marginX = 110,
    marginY = 120,
    leftBias = 70,
    baseSize = 240,
    lineHeightFactor = 0.94,
    letterSpacingFactor = 0.03,
    fadeIn = 0.8,
    hold = 1.4,
    fadeOut = 0.8,
  } = options;

  const text = lines.join('\n');
  const maxWidth = Screen.width - marginX * 2;
  const maxHeight = Screen.height - marginY * 2;
  const left = -Screen.width / 2 + marginX;
  const top = -Screen.height / 2 + marginY;

  const baseMaxLine = Math.max(...lines.map(l => textWidth(l, Fonts.primary, baseSize, fontWeight)));
  const scaleW = baseMaxLine > 0 ? maxWidth / baseMaxLine : 1;
  const scaleH = maxHeight / (lines.length * baseSize * lineHeightFactor);
  const scale = Math.min(scaleW, scaleH);

  const fontSize = Math.max(64, Math.floor(baseSize * scale));
  const lineHeight = Math.floor(fontSize * lineHeightFactor);
  const letterSpacing = Math.max(1, Math.round(fontSize * letterSpacingFactor));

  const container = createRef<Node>();
  view.add(
    <Node ref={container} opacity={0}>
      <Txt
        fontFamily={Fonts.primary}
        fontWeight={fontWeight}
        fontSize={fontSize}
        lineHeight={lineHeight}
        letterSpacing={letterSpacing}
        x={align === 'center' ? 0 : left + maxWidth / 2 - leftBias}
        y={top + maxHeight / 2}
        width={maxWidth}
        fill={fill}
        textAlign={align === 'center' ? 'center' : 'left'}
        text={text}
      />
    </Node>,
  );

  yield* container().opacity(1, fadeIn, easeInOutCubic);
  yield* waitFor(hold);
  yield* container().opacity(0, fadeOut, easeInOutCubic);
}


