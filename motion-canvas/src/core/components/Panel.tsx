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
  ...rest
}: PanelProps) {
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
      {...rest}
    >
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


