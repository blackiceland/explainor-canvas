import {Line, makeScene2D, Node, Rect} from '@motion-canvas/2d';
import {
  all,
  createRef,
  createSignal,
  easeInCubic,
  easeInOutCubic,
  easeOutBounce,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';

const ISO_ANGLE = 26.565;
const ISO_COS = Math.cos((ISO_ANGLE * Math.PI) / 180);
const ISO_SIN = Math.sin((ISO_ANGLE * Math.PI) / 180);

function isoProject(x: number, y: number, z: number): [number, number] {
  const screenX = (x - z) * ISO_COS;
  const screenY = y - (x + z) * ISO_SIN;
  return [screenX, screenY];
}

function rotateAroundBottomEdge(
  vertices: [number, number, number][],
  angle: number,
): [number, number, number][] {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return vertices.map(([x, y, z]) => {
    const newY = y * cos - z * sin;
    const newZ = y * sin + z * cos;
    return [x, newY, newZ];
  });
}

export default makeScene2D(function* (view) {
  view.fill('#E8E4D8');

  const rotationAngle = createSignal(0);
  const positionY = createSignal(0);
  const positionZ = createSignal(0);

  const dominoWidth = 40;
  const dominoHeight = 100;
  const dominoDepth = 15;

  const hw = dominoWidth / 2;
  const hh = dominoHeight / 2;
  const hd = dominoDepth / 2;

  const baseVertices: [number, number, number][] = [
    [-hw, hh, -hd],
    [hw, hh, -hd],
    [hw, -hh, -hd],
    [-hw, -hh, -hd],
    [-hw, hh, hd],
    [hw, hh, hd],
    [hw, -hh, hd],
    [-hw, -hh, hd],
  ];

  const faces: {indices: number[]; color: string}[] = [
    {indices: [4, 5, 6, 7], color: '#1a1a1a'},
    {indices: [1, 2, 6, 5], color: '#2d2d2d'},
    {indices: [0, 1, 5, 4], color: '#0d0d0d'},
    {indices: [3, 2, 6, 7], color: '#0d0d0d'},
    {indices: [0, 3, 7, 4], color: '#000000'},
    {indices: [0, 1, 2, 3], color: '#404040'},
  ];

  const dominoNode = createRef<Node>();
  const shadowNode = createRef<Rect>();

  view.add(
    <>
      <Rect
        ref={shadowNode}
        x={() => {
          const angle = rotationAngle();
          const dz = positionZ();
          const radians = (angle * Math.PI) / 180;
          const forwardOffset = Math.sin(radians) * (dominoHeight / 2);
          const [shadowX] = isoProject(0, 0, dz + forwardOffset);
          return shadowX;
        }}
        y={() => {
          const angle = rotationAngle();
          const dz = positionZ();
          const radians = (angle * Math.PI) / 180;
          const forwardOffset = Math.sin(radians) * (dominoHeight / 2);
          const [, shadowY] = isoProject(0, hh - 5, dz + forwardOffset);
          return shadowY;
        }}
        width={() => {
          const angle = rotationAngle();
          const radians = (angle * Math.PI) / 180;
          const length = dominoWidth + Math.abs(Math.sin(radians)) * dominoHeight * 0.7;
          return length;
        }}
        height={() => {
          const angle = rotationAngle();
          const radians = (angle * Math.PI) / 180;
          return dominoDepth + Math.abs(Math.sin(radians)) * 15;
        }}
        fill={'rgba(0, 0, 0, 0.2)'}
        filters={{blur: () => {
          const dy = positionY();
          return 6 + (dy / hh) * 4;
        }}}
        opacity={() => {
          const angle = rotationAngle();
          const dy = positionY();
          const baseOpacity = 0.35 - (angle / 90) * 0.1;
          const heightFactor = 1 - (dy / (hh + 10));
          return baseOpacity * heightFactor;
        }}
      />
      <Node ref={dominoNode} x={0} y={0}>
        {faces.map((face, faceIdx) => (
          <Node key={`face-${faceIdx}`}>
            {face.indices.map((vertexIdx, i) => {
              const nextIdx = face.indices[(i + 1) % face.indices.length];
              return (
                <Line
                  key={`face-${faceIdx}-edge-${i}`}
                  stroke={'#000000'}
                  lineWidth={2}
                  lineCap="round"
                  lineJoin="round"
                  closed={false}
                  points={() => {
                    const angle = rotationAngle();
                    const dy = positionY();
                    const dz = positionZ();

                    const rotated = rotateAroundBottomEdge(baseVertices, angle);

                    const v1 = rotated[vertexIdx];
                    const v2 = rotated[nextIdx];

                    const [x1, y1] = isoProject(v1[0], v1[1] + dy, v1[2] + dz);
                    const [x2, y2] = isoProject(v2[0], v2[1] + dy, v2[2] + dz);

                    return [
                      [x1, y1],
                      [x2, y2],
                    ];
                  }}
                />
              );
            })}
          </Node>
        ))}
      </Node>
    </>,
  );

  yield* waitFor(0.5);

  yield* rotationAngle(-3, 0.15, easeOutCubic);

  const fallDuration = 0.5;

  yield* all(
    rotationAngle(95, fallDuration, easeInCubic),
    positionY(hh + 10, fallDuration, easeInCubic),
    positionZ(dominoHeight * 0.8, fallDuration, easeInCubic),
  );

  yield* all(
    positionY(hh, 0.15, easeOutBounce),
    rotationAngle(90, 0.15, easeOutCubic),
  );

  yield* waitFor(1);
});

