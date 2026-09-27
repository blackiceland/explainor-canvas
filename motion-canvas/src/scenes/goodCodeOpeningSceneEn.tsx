import {makeScene2D, Rect} from '@motion-canvas/2d';
import {createSignal, linear} from '@motion-canvas/core';
import {buildOpening, OPENING_DURATION, openingTimeline} from '../core/three/goodCodeOpening';
import {Screen} from '../core/theme';

// ── GOOD CODE, BUT I HATE IT · открытие (16 с) ──────────────────────────────
// Ночь, кабинет с цветами. Один проезд без склеек: барвинок на столе в фокусе →
// фокус на лицо программиста → камера обходит голову → из-за плеча наезд в
// экран, он допечатывает строку → код на весь кадр, мигает каретка.
//
// ⚠️ Кадр целиком собирает core/three/goodCodeOpening: мир, человек, объектив
// И РАСКАДРОВКА (openingTimeline — чистая функция времени). Сцена только ведёт
// часы. Тот же модуль снимает стенд без редактора.
// ⚠️ Ассеты — public/goodcode (~2.9 МБ): первый запуск на WSL-сервере долгий.

export default makeScene2D(function* (view) {
  view.fill('#000000');
  const shot = yield* buildOpening({
    person: {fbx: '/goodcode/people/Male_Adult_09.fbx', tex: '/goodcode/people/m017', ext: 'webp', eyeUV: [540, 1898, 140]},
    assets: '/goodcode',
  });
  const clock = createSignal(0);

  const frame = new Rect({width: Screen.width, height: Screen.height});
  (frame as any).draw = function (context: CanvasRenderingContext2D) {
    const m = context.getTransform();
    const k = Math.max(1, Math.hypot(m.a, m.b));
    const img = shot.render(openingTimeline(clock()), Math.round(Screen.width * k), Math.round(Screen.height * k));
    context.drawImage(img, -Screen.width / 2, -Screen.height / 2, Screen.width, Screen.height);
  };
  view.add(frame);

  yield* clock(OPENING_DURATION, OPENING_DURATION, linear);
});
