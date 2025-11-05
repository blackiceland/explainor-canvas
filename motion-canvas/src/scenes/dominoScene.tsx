import {Line, makeScene2D, Node} from '@motion-canvas/2d';
import {createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {fetchDominoFallScene} from '../services/animationClient';

const FOCAL_LENGTH = 300;
const PERSPECTIVE_STRENGTH = 1.5;

function projectPoint(x: number, y: number, z: number): [number, number] {
  const scale = FOCAL_LENGTH / (FOCAL_LENGTH + z * PERSPECTIVE_STRENGTH);
  return [x * scale, y * scale];
}

function rotateX(x: number, y: number, z: number, angle: number): [number, number, number] {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [x, y * cos - z * sin, y * sin + z * cos];
}

export default makeScene2D(function* (view) {
  const scene = yield fetchDominoFallScene();

  if (scene.background) {
    view.fill(scene.background);
  }

  const animations: any[] = [];

  for (const element of scene.elements) {
    if (element.primitiveType !== 'DOMINO' || !element.domino) continue;

    const domino = element.domino;
    const angle = createSignal(0);

    const hw = domino.width / 2;
    const hh = domino.height / 2;
    const hd = domino.depth / 2;

    const baseVertices: [number, number, number][] = [
      [-hw, -hh, -hd], [hw, -hh, -hd], [hw, hh, -hd], [-hw, hh, -hd],
      [-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd],
    ];

    const edges: [number, number][] = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];

    view.add(
      <Node x={domino.x} y={domino.y}>
        {edges.map(([i, j], idx) => (
          <Line
            key={`${element.elementId}-${idx}`}
            stroke={domino.style.strokeColor}
            lineWidth={domino.style.lineWidth}
            lineCap="round"
            points={() => {
              const currentAngle = angle();
              const rotated = baseVertices.map(([x, y, z]) =>
                rotateX(x, y, z, currentAngle),
              );
              const [x1, y1, z1] = rotated[i];
              const [x2, y2, z2] = rotated[j];
              const [px1, py1] = projectPoint(x1, y1, z1);
              const [px2, py2] = projectPoint(x2, y2, z2);
              return [
                [px1, py1],
                [px2, py2],
              ];
            }}
          />
        ))}
      </Node>,
    );

    for (const tween of element.tweens) {
      if (tween.propertyPath !== 'rotationX') continue;

      const first = tween.keyframes[0];
      const last = tween.keyframes[tween.keyframes.length - 1];
      const duration = (last.timeMillis - first.timeMillis) / 1000;

      animations.push({
        startTime: first.timeMillis / 1000,
        duration: duration,
        run: () => angle(last.value, duration, easeInOutCubic),
      });
    }
  }

  animations.sort((a, b) => a.startTime - b.startTime);

  let currentTime = 0;
  for (const anim of animations) {
    const waitTime = anim.startTime - currentTime;
    if (waitTime > 0) {
      yield* waitFor(waitTime);
    }
    yield* anim.run();
    currentTime = anim.startTime + anim.duration;
  }

  yield* waitFor(0.5);
});

