import {makeScene2D, Rect} from '@motion-canvas/2d';
import {createSignal, linear} from '@motion-canvas/core';
import {buildFaces, FACES_DURATION, facesTimeline} from '../core/three/goodCodeFaces';
import {Screen} from '../core/theme';

// ── GOOD CODE, BUT I HATE IT · шесть лиц (8.6 с) ────────────────────────────
// Камера на месте монитора: программист читает код — смотрит почти в объектив.
// Щелчок клавиши — склейка на следующего; планы короче и короче: 2.4 → 1.8 →
// 1.3 → 0.9 → 0.6 → 0.4 с, щелчки учащаются. После последнего — 1.2 с черноты.
//
// ⚠️ Кадр целиком собирает core/three/goodCodeFaces (facesTimeline — чистая
// функция времени), сцена только ведёт часы. Щелчки — на 2.4, 4.2, 5.5, 6.4,
// 7.0, 7.4 с; звук ставит автор.

const P = (fbx: string, tex: string) => ({fbx: `/goodcode/people/${fbx}.fbx`, tex: `/goodcode/people/${tex}`, ext: 'webp', eyeUV: [540, 1898, 140] as [number, number, number]});

export default makeScene2D(function* (view) {
  view.fill('#000000');
  const shot = yield* buildFaces({
    people: [
      P('Male_Adult_09', 'm017'), P('Female_Adult_07', 'f007'), P('Male_Adult_03', 'm004'),
      P('Male_Adult_10', 'm024'), P('Female_Adult_04', 'f004'), {...P('Male_Adult_12', 'm007'), hairCards: false},
    ],
    assets: '/goodcode',
  });
  const clock = createSignal(0);

  const frame = new Rect({width: Screen.width, height: Screen.height});
  (frame as any).draw = function (context: CanvasRenderingContext2D) {
    const m = context.getTransform();
    const k = Math.max(1, Math.hypot(m.a, m.b));
    const img = shot.render(facesTimeline(clock()), Math.round(Screen.width * k), Math.round(Screen.height * k));
    context.drawImage(img, -Screen.width / 2, -Screen.height / 2, Screen.width, Screen.height);
  };
  view.add(frame);

  yield* clock(FACES_DURATION, FACES_DURATION, linear);
});
