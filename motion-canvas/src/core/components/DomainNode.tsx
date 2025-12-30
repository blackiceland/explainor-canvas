import {Rect} from '@motion-canvas/2d';
import {Reference} from '@motion-canvas/core';
import {Panel, PanelProps} from './Panel';
import {PanelStyle} from '../panelStyle';

export interface DomainNodeProps extends Omit<PanelProps, 'radius'> {
  rectRef?: Reference<Rect>;
}

export function DomainNode({rectRef, width = 480, height = 120, ...rest}: DomainNodeProps) {
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


