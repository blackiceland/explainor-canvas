import {Rect, RectProps, Txt} from '@motion-canvas/2d';
import {Reference} from '@motion-canvas/core';
import {PanelStyle} from '../panelStyle';
import {Fonts} from '../theme';

export interface PanelProps extends RectProps {
  rectRef?: Reference<Rect>;
  label?: string;
  labelRef?: Reference<Txt>;
  labelFill?: string;
  labelFontSize?: number;
  labelFontWeight?: number;
  labelLetterSpacing?: number;
  labelY?: number;
  children?: any;
  edge?: boolean;
}

export function Panel({
  rectRef,
  label,
  labelRef,
  labelFill = PanelStyle.labelFill,
  labelFontSize = 32,
  labelFontWeight = 600,
  labelLetterSpacing = 2,
  labelY = 0,
  radius = PanelStyle.radius,
  fill = PanelStyle.fill,
  stroke = PanelStyle.stroke,
  lineWidth = PanelStyle.lineWidth,
  shadowColor = PanelStyle.shadowColor,
  shadowBlur = PanelStyle.shadowBlur,
  shadowOffset = PanelStyle.shadowOffset,
  edge = true,
  clip,
  width,
  height,
  children,
  ...rest
}: PanelProps) {
  const inset = 2;
  const canEdge = edge && typeof width === 'number' && typeof height === 'number';
  const w = canEdge ? (width as number) : 0;
  const h = canEdge ? (height as number) : 0;
  const r = typeof radius === 'number' ? radius : PanelStyle.radius;
  const innerRadius = Math.max(0, r - inset);

  return (
    <Rect
      ref={rectRef}
      radius={radius}
      fill={fill}
      stroke={stroke}
      lineWidth={lineWidth}
      shadowColor={shadowColor}
      shadowBlur={shadowBlur}
      shadowOffset={shadowOffset}
      clip={clip ?? true}
      width={width}
      height={height}
      {...rest}
    >
      {canEdge ? (
        <>
          <Rect
            layout={false}
            width={'100%'}
            height={2}
            y={-h / 2 + 1}
            fill={'rgba(255,255,255,0.06)'}
            opacity={0.7}
          />
          <Rect
            layout={false}
            width={w - inset * 2}
            height={h - inset * 2}
            radius={innerRadius}
            fill={'rgba(0,0,0,0)'}
            stroke={'rgba(255,255,255,0.045)'}
            lineWidth={1}
          />
        </>
      ) : null}
      {children}
      {label ? (
        <Txt
          ref={labelRef}
          fontFamily={Fonts.primary}
          fontSize={labelFontSize}
          fontWeight={labelFontWeight}
          letterSpacing={labelLetterSpacing}
          fill={labelFill}
          textAlign="center"
          y={labelY}
          text={label}
        />
      ) : null}
    </Rect>
  );
}


