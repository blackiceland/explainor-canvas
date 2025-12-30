import {Rect} from '@motion-canvas/2d';
import {Reference} from '@motion-canvas/core';
import {Panel, PanelProps} from './Panel';
import {PanelStyle} from '../panelStyle';

export interface HubNodeProps extends Omit<PanelProps, 'radius'> {
  rectRef?: Reference<Rect>;
}

export function HubNode({rectRef, width = 220, height = 220, ...rest}: HubNodeProps) {
  return (
    <Panel
      rectRef={rectRef}
      width={width}
      height={height}
      radius={PanelStyle.radiusSmall}
      {...rest}
    />
  );
}


