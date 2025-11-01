import {Circle, makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {SceneResponse, fetchCircleSlideScene} from '../services/animationClient';

function resolveTween(scene: SceneResponse, propertyPath: string) {
  const element = scene.elements[0];
  return element.tweens.find((tween) => tween.propertyPath === propertyPath);
}

export default makeScene2D(function* (view) {
  const scene = yield fetchCircleSlideScene();
  const element = scene.elements[0];
  const circle = createRef<Circle>();

  if (!element.circle) {
    console.error('Circle properties not found');
    return;
  }

  view.add(
    <Circle
      ref={circle}
      width={element.circle.radius * 2}
      height={element.circle.radius * 2}
      stroke={element.circle.style.strokeColor}
      fill={element.circle.style.fillColor}
      lineWidth={element.circle.style.lineWidth}
    />
  );

  const positionTween = resolveTween(scene, 'positionX');
  if (!positionTween) {
    return;
  }

  const firstKeyframe = positionTween.keyframes[0];
  const lastKeyframe = positionTween.keyframes[positionTween.keyframes.length - 1];

  circle().position.x(firstKeyframe.value);
  circle().position.y(element.circle.centerY);

  const durationSeconds = (lastKeyframe.timeMillis - firstKeyframe.timeMillis) / 1000;
  yield* circle().position.x(lastKeyframe.value, durationSeconds);
  yield* waitFor(0.2);
});
