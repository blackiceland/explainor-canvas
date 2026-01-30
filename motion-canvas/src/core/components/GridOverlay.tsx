import {Line, Rect, Txt} from '@motion-canvas/2d';
import {Screen} from '../theme';

type GridOverlayProps = {
  minorStep?: number;
  majorStep?: number;
  opacity?: number;
  showLabels?: boolean;
  showAxes?: boolean;
  showEdgeLabels?: boolean;
  showCellLabels?: boolean | (() => boolean);
};

export function GridOverlay(props: GridOverlayProps) {
  const minorStep = props.minorStep ?? 50;
  const majorStep = props.majorStep ?? 200;
  const opacity = props.opacity ?? 0.55;
  // If we render edge labels, internal labels become duplicates/noise.
  const showEdgeLabels = props.showEdgeLabels ?? true;
  const showLabels = (props.showLabels ?? true) && !showEdgeLabels;
  const showAxes = props.showAxes ?? true;
  const showCellLabels = typeof props.showCellLabels === 'function'
    ? props.showCellLabels()
    : (props.showCellLabels ?? false);

  // Avoid depending on the global JSX namespace (tsconfig may not include it).
  const lines = [];
  const labels = [];

  // Grid/labels should be measured against the full frame by default.
  // SafeZone is still useful conceptually, but for "ruler" work we want frame edges.
  const left = -Screen.width / 2;
  const right = Screen.width / 2;
  const top = -Screen.height / 2;
  const bottom = Screen.height / 2;

  const minorStroke = 'rgba(255,255,255,0.06)';
  const majorStroke = 'rgba(255,255,255,0.12)';
  const axisStroke = 'rgba(110,168,255,0.22)';
  const labelFill = 'rgba(244,241,235,0.38)';
  const edgeLabelFill = 'rgba(244,241,235,0.52)';
  const cellFill = 'rgba(244,241,235,0.18)';

  const mono =
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

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

    // Internal top label (major only)
    if (showLabels && isMajor && x !== 0) {
      labels.push(
        <Txt
          key={`lx-${x}`}
          layout={false}
          x={x}
          y={top + 10}
          text={`${x}`}
          fontFamily={mono}
          fontSize={16}
          fontWeight={700}
          fill={labelFill}
          offset={[0, -1]}
          opacity={opacity}
        />,
      );
    }

    // Edge labels (every minorStep) — on the frame edges.
    // Add as separate nodes (no fragment), otherwise some runtimes may drop them.
    if (showEdgeLabels) {
      labels.push(
        <Txt
          key={`ex-top-${x}`}
          layout={false}
          x={x}
          y={top + 10}
          text={`${x}`}
          fontFamily={mono}
          fontSize={13}
          fontWeight={700}
          fill={edgeLabelFill}
          offset={[0, -1]}
          opacity={opacity}
        />,
      );
      labels.push(
        <Txt
          key={`ex-bot-${x}`}
          layout={false}
          x={x}
          y={bottom - 10}
          text={`${x}`}
          fontFamily={mono}
          fontSize={13}
          fontWeight={700}
          fill={edgeLabelFill}
          offset={[0, 1]}
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

    // Internal left label (major only)
    if (showLabels && isMajor && y !== 0) {
      labels.push(
        <Txt
          key={`ly-${y}`}
          layout={false}
          x={left + 10}
          y={y}
          text={`${y}`}
          fontFamily={mono}
          fontSize={16}
          fontWeight={700}
          fill={labelFill}
          offset={[-1, 0]}
          opacity={opacity}
        />,
      );
    }

    // Edge labels (every minorStep) — on the frame edges.
    if (showEdgeLabels) {
      labels.push(
        <Txt
          key={`ey-left-${y}`}
          layout={false}
          x={left + 12}
          y={y}
          text={`${y}`}
          fontFamily={mono}
          fontSize={13}
          fontWeight={700}
          fill={edgeLabelFill}
          offset={[-1, 0]}
          opacity={opacity}
        />,
      );
      labels.push(
        <Txt
          key={`ey-right-${y}`}
          layout={false}
          x={right - 12}
          y={y}
          text={`${y}`}
          fontFamily={mono}
          fontSize={13}
          fontWeight={700}
          fill={edgeLabelFill}
          offset={[1, 0]}
          opacity={opacity}
        />,
      );
    }
  }

  if (showCellLabels) {
    // Label each minor cell by its center coordinates (x,y).
    // This is intentionally subtle and can be toggled off.
    for (let x = Math.ceil(left / minorStep) * minorStep; x < right; x += minorStep) {
      for (let y = Math.ceil(top / minorStep) * minorStep; y < bottom; y += minorStep) {
        const cx = x + minorStep / 2;
        const cy = y + minorStep / 2;

        // Avoid edge clutter (we already print edge labels).
        if (cx < left + 60 || cx > right - 60 || cy < top + 40 || cy > bottom - 40) continue;

        labels.push(
          <Txt
            key={`cell-${x}-${y}`}
            layout={false}
            x={cx}
            y={cy}
            text={`${Math.round(cx)},${Math.round(cy)}`}
            fontFamily={mono}
            fontSize={10}
            fontWeight={600}
            fill={cellFill}
            opacity={opacity}
          />,
        );
      }
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
            fontFamily={mono}
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
            fontFamily={mono}
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


