import {Circle, makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {SceneResponse, fetchCircleSlideScene} from '../services/animationClient';

function resolveTween(scene: SceneResponse, propertyName: string) {
  const element = scene.elements[0];
  return element.tweens.find((tween) => tween.propertyName === propertyName);
}

export default makeScene2D(function* (view) {
  const scene = yield fetchCircleSlideScene();
  const element = scene.elements[0];
  const circle = createRef<Circle>();
  view.add(
    <Circle
      ref={circle}
      width={element.circle.radius * 2}
      height={element.circle.radius * 2}
      stroke={element.circle.strokeColor}
      fill={element.circle.fillColor}
      lineWidth={12}
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
  yield* circle().position.x(lastKeyframe.value, scene.durationSeconds);
  yield* waitFor(0.2);
});

