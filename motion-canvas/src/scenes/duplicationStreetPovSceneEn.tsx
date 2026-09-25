import {makeScene2D, Rect} from '@motion-canvas/2d';
import {createSignal, linear} from '@motion-canvas/core';
import {buildPovShot, POV_DURATION, povTimeline} from '../core/three/povStreetShot';
import {Screen} from '../core/theme';

// ── DON'T FIGHT DUPLICATION · глава 2, кадр от первого лица ─────────────────
// Ночь, дождь, улица. Впереди стойка — ни одного огонька. За ней наша Honda e.
// В руку поднимается телефон: приложение говорит «Available» и даёт зелёную
// кнопку. Большой палец жмёт «Start charging» → «Starting…» → снизу выезжает
// «Connector unavailable». Статус «Available» наверху при этом остаётся:
// приложение одновременно говорит «свободна» и «недоступна». Фокус уходит
// обратно на мёртвую стойку. Склейка.
//
// ⚠️ Кадр целиком собирает core/three/povStreetShot: мир, рука, экран,
// объектив И РАСКАДРОВКА (povTimeline — чистая функция времени). Сцена только
// ведёт часы. Тот же модуль снимает стенд scratchpad/pov без редактора, поэтому
// проверенное там и есть то, что здесь в кадре.
// ⚠️ Звук тапа (ES «User Interface … Phone Tap») ставит автор — касание
// стекла приходится на TAP_AT (5.1 с).

export default makeScene2D(function* (view) {
  view.fill('#000000');
  const shot = yield* buildPovShot();
  const clock = createSignal(0);

  const frame = new Rect({width: Screen.width, height: Screen.height});
  (frame as any).draw = function (context: CanvasRenderingContext2D) {
    const m = context.getTransform();
    const k = Math.max(1, Math.hypot(m.a, m.b));
    const img = shot.render(povTimeline(clock()), Math.round(Screen.width * k), Math.round(Screen.height * k));
    context.drawImage(img, -Screen.width / 2, -Screen.height / 2, Screen.width, Screen.height);
  };
  view.add(frame);

  yield* clock(POV_DURATION, POV_DURATION, linear);
});
