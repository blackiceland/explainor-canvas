import {Line, Rect, Txt} from '@motion-canvas/2d';
import {SafeZone} from '../ScreenGrid';

type GridOverlayProps = {
  minorStep?: number;
  majorStep?: number;
  opacity?: number;
  showLabels?: boolean;
  showAxes?: boolean;
};

export function GridOverlay(props: GridOverlayProps) {
  const minorStep = props.minorStep ?? 50;
  const majorStep = props.majorStep ?? 200;
  const opacity = props.opacity ?? 0.55;
  const showLabels = props.showLabels ?? true;
  const showAxes = props.showAxes ?? true;

  // Avoid depending on the global JSX namespace (tsconfig may not include it).
  const lines = [];
  const labels = [];

  const left = SafeZone.left;
  const right = SafeZone.right;
  const top = SafeZone.top;
  const bottom = SafeZone.bottom;

  const minorStroke = 'rgba(255,255,255,0.06)';
  const majorStroke = 'rgba(255,255,255,0.12)';
  const axisStroke = 'rgba(110,168,255,0.22)';
  const labelFill = 'rgba(244,241,235,0.38)';

  // Vertical grid lines
  for (let x = Math.ceil(left / minorStep) * minorStep; x <= right; x += minorStep) {
    const isMajor = x % majorStep === 0;
    lines.push(
      <Line
        key={`vx-${x}`}
        layout={false}
        points={[
          [x, top],
          [x, bottom],
        ]}
        stroke={isMajor ? majorStroke : minorStroke}
        lineWidth={1}
        opacity={opacity}
      />,
    );

    if (showLabels && isMajor && x !== 0) {
      labels.push(
        <Txt
          key={`lx-${x}`}
          layout={false}
          x={x}
          y={top + 10}
          text={`${x}`}
          fontFamily={'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'}
          fontSize={16}
          fontWeight={700}
          fill={labelFill}
          offset={[0, -1]}
          opacity={opacity}
        />,
      );
    }
  }

  // Horizontal grid lines
  for (let y = Math.ceil(top / minorStep) * minorStep; y <= bottom; y += minorStep) {
    const isMajor = y % majorStep === 0;
    lines.push(
      <Line
        key={`hy-${y}`}
        layout={false}
        points={[
          [left, y],
          [right, y],
        ]}
        stroke={isMajor ? majorStroke : minorStroke}
        lineWidth={1}
        opacity={opacity}
      />,
    );

    if (showLabels && isMajor && y !== 0) {
      labels.push(
        <Txt
          key={`ly-${y}`}
          layout={false}
          x={left + 10}
          y={y}
          text={`${y}`}
          fontFamily={'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'}
          fontSize={16}
          fontWeight={700}
          fill={labelFill}
          offset={[-1, 0]}
          opacity={opacity}
        />,
      );
    }
  }

  return (
    <Rect layout={false}>
      {/* Axes */}
      {showAxes && (
        <>
          <Line
            layout={false}
            points={[
              [0, top],
              [0, bottom],
            ]}
            stroke={axisStroke}
            lineWidth={2}
            opacity={opacity}
          />
          <Line
            layout={false}
            points={[
              [left, 0],
              [right, 0],
            ]}
            stroke={axisStroke}
            lineWidth={2}
            opacity={opacity}
          />
          <Txt
            layout={false}
            x={6}
            y={top + 10}
            text={'x=0'}
            fontFamily={'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'}
            fontSize={16}
            fontWeight={800}
            fill={axisStroke}
            offset={[-1, -1]}
            opacity={opacity}
          />
          <Txt
            layout={false}
            x={left + 10}
            y={6}
            text={'y=0'}
            fontFamily={'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'}
            fontSize={16}
            fontWeight={800}
            fill={axisStroke}
            offset={[-1, -1]}
            opacity={opacity}
          />
        </>
      )}

      {/* Grid */}
      {lines}

      {/* Labels */}
      {labels}
    </Rect>
  );
}


