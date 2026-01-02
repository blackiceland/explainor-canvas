import {Line, Node, Rect, Txt} from '@motion-canvas/2d';
import {Reference} from '@motion-canvas/core';
import {SafeZone} from '../ScreenGrid';
import {worldBBox} from '../utils/bounds';

export type DebugItem = {
  name: string;
  // Motion Canvas' Reference<T> is invariant, so we accept any Node ref here.
  ref: Reference<any>;
  color?: string;
};

export function DebugOverlay(props: {
  items: DebugItem[];
  baselinesY?: number[];
  showSafeZone?: boolean;
  opacity?: number;
}) {
  const opacity = props.opacity ?? 0.95;
  const showSafeZone = props.showSafeZone ?? true;
  const baselinesY = props.baselinesY ?? [];

  return (
    <Rect layout={false} opacity={opacity}>
      {showSafeZone && (
        <Rect
          layout={false}
          x={(SafeZone.left + SafeZone.right) / 2}
          y={(SafeZone.top + SafeZone.bottom) / 2}
          width={SafeZone.right - SafeZone.left}
          height={SafeZone.bottom - SafeZone.top}
          stroke={'rgba(255,255,255,0.14)'}
          lineWidth={2}
          fill={'rgba(0,0,0,0)'}
        />
      )}

      {baselinesY.map((y, i) => (
        <Line
          key={`baseline-${i}`}
          layout={false}
          points={[
            [SafeZone.left, y],
            [SafeZone.right, y],
          ]}
          stroke={'rgba(255,140,163,0.22)'}
          lineWidth={2}
          lineDash={[10, 10]}
        />
      ))}

      {props.items.map(item => {
        const color = item.color ?? 'rgba(110,168,255,0.55)';
        const bbox = () => {
          const node = item.ref();
          if (!node) return null;
          return worldBBox(node as Node);
        };

        const left = () => bbox()?.left ?? 0;
        const top = () => bbox()?.top ?? 0;
        const width = () => bbox()?.width ?? 0;
        const height = () => bbox()?.height ?? 0;
        const labelX = () => left() + 10;
        const labelY = () => top() + 8;

        return (
          <Rect key={item.name} layout={false}>
            <Rect
              layout={false}
              x={left}
              y={top}
              width={width}
              height={height}
              stroke={color}
              lineWidth={2}
              fill={'rgba(0,0,0,0)'}
              offset={[-1, -1]}
            />
            <Txt
              layout={false}
              x={labelX}
              y={labelY}
              text={item.name}
              fontFamily={'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'}
              fontSize={18}
              fontWeight={700}
              fill={color}
              offset={[-1, -1]}
            />
          </Rect>
        );
      })}
    </Rect>
  );
}


