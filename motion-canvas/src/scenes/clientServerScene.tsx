import {Circle, Line, makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {ElementResponse, fetchClientServerScene, SceneResponse} from '../services/animationClient';

function findTween(element: ElementResponse, propertyPath: string) {
  return element.tweens.find((tween) => tween.propertyPath === propertyPath);
}

export default makeScene2D(function* (view) {
  const scene = yield fetchClientServerScene();

  if (scene.background) {
    view.fill(scene.background);
  }

  const refs = new Map<string, any>();

  for (const element of scene.elements) {
    const ref = createRef<any>();
    refs.set(element.elementId, ref);

    if (element.primitiveType === 'RECT' && element.rect) {
      const rect = element.rect;
      const props: any = {
        ref,
        x: rect.centerX,
        y: rect.centerY,
        width: rect.width,
        height: rect.height,
        radius: rect.radius,
        fill: rect.style.fillColor,
        stroke: rect.style.strokeColor,
        lineWidth: rect.style.lineWidth,
      };

      if (rect.style.shadow) {
        props.shadowColor = rect.style.shadow.color;
        props.shadowBlur = rect.style.shadow.blur;
        props.shadowOffsetX = rect.style.shadow.offsetX;
        props.shadowOffsetY = rect.style.shadow.offsetY;
      }

      view.add(<Rect {...props} />);
    } else if (element.primitiveType === 'LINE' && element.line) {
      const line = element.line;
      view.add(
        <Line
          ref={ref}
          points={[
            [line.startX, line.startY],
            [line.endX, line.endY],
          ]}
          stroke={line.style.strokeColor}
          lineWidth={line.style.lineWidth}
          end={0}
          endArrow
          arrowSize={12}
        />
      );
    } else if (element.primitiveType === 'TEXT' && element.text) {
      const text = element.text;
      view.add(
        <Txt
          ref={ref}
          text={text.text}
          x={text.centerX}
          y={text.centerY}
          fontSize={text.fontSize}
          fill={text.color}
          fontWeight={parseInt(text.fontWeight)}
          fontFamily="Inter, sans-serif"
        />
      );
    } else if (element.primitiveType === 'CIRCLE' && element.circle) {
      const circle = element.circle;
      view.add(
        <Circle
          ref={ref}
          width={circle.radius * 2}
          height={circle.radius * 2}
          stroke={circle.style.strokeColor}
          fill={circle.style.fillColor}
          lineWidth={circle.style.lineWidth}
        />
      );
    }
  }

  const animations: any[] = [];

  for (const element of scene.elements) {
    const ref = refs.get(element.elementId);
    if (!ref || !ref()) continue;

    for (const tween of element.tweens) {
      const firstKeyframe = tween.keyframes[0];
      const lastKeyframe = tween.keyframes[tween.keyframes.length - 1];
      const durationMillis = lastKeyframe.timeMillis - firstKeyframe.timeMillis;
      const durationSeconds = durationMillis / 1000;
      const startSeconds = firstKeyframe.timeMillis / 1000;

      if (tween.propertyPath === 'end') {
        ref().end(firstKeyframe.value);
        animations.push({
          time: startSeconds,
          duration: durationSeconds,
          action: function* () {
            yield* ref().end(lastKeyframe.value, durationSeconds);
          },
        });
      } else if (tween.propertyPath === 'opacity') {
        ref().opacity(firstKeyframe.value);
        animations.push({
          time: startSeconds,
          duration: durationSeconds,
          action: function* () {
            yield* ref().opacity(lastKeyframe.value, durationSeconds);
          },
        });
      } else if (tween.propertyPath === 'positionX') {
        ref().position.x(firstKeyframe.value);
        animations.push({
          time: startSeconds,
          duration: durationSeconds,
          action: function* () {
            yield* ref().position.x(lastKeyframe.value, durationSeconds);
          },
        });
      }
    }
  }

  animations.sort((a, b) => a.time - b.time);

  let currentTime = 0;
  for (const anim of animations) {
    if (anim.time > currentTime) {
      yield* waitFor(anim.time - currentTime);
      currentTime = anim.time;
    }
    yield* anim.action();
    currentTime += anim.duration;
  }

  yield* waitFor(0.4);
});
