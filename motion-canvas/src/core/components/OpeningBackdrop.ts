import {Rect} from '@motion-canvas/2d';
import {Screen} from '../theme';

// ── Фон опенинга DON'T FIGHT DUPLICATION ──────────────────────────────────
// Вынесен из openingMergeTimelapseSceneEn, потому что на нём стоит МОСТ между
// опенингом и chargingHeroDemoScene: последний кадр опенинга — это ровно этот
// растр (конвейер к тому моменту погашен), и сцена с машиной обязана начаться
// с того же самого растра, иначе на срезе виден скачок. Один источник правды.
//
// Радиальные градиенты на почти чёрном распадаются на кольца: перепад в
// полтора десятка уровней растянут на тысячу пикселей, и каждый шаг 1/255
// виден как отдельная окружность. Добавлением стопов это не лечится — это
// квантование. Поэтому фон (вертикальная база + подсветка центра + виньетка)
// считается попиксельно и дизерится шумом в пол-уровня.
export const makeBackdrop = (): HTMLCanvasElement => {
  const W = Screen.width;
  const H = Screen.height;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const d = img.data;

  const top = [10, 11, 14];           // #0A0B0E
  const bot = [14, 15, 20];           // #0E0F14
  const lift = [164, 168, 196];       // холодная подсветка центра
  const LIFT_A = 0.075;
  const rLift = W * 0.55;
  const vIn = W * 0.3;
  const vOut = W * 0.8;
  const VIG = 0.42;

  const cx = W / 2;
  const cy = H / 2;
  let p = 0;
  for (let y = 0; y < H; y++) {
    const ty = y / (H - 1);
    const dy = y - cy;
    for (let x = 0; x < W; x++) {
      const dx = x - cx;
      const r = Math.sqrt(dx * dx + dy * dy);
      const kLift = LIFT_A * Math.max(0, 1 - r / rLift);
      const kVig = 1 - VIG * Math.min(1, Math.max(0, (r - vIn) / (vOut - vIn)));
      for (let c = 0; c < 3; c++) {
        const base = top[c] + (bot[c] - top[c]) * ty;
        const v = (base + (lift[c] - base) * kLift) * kVig;
        d[p + c] = Math.max(0, Math.min(255, Math.round(v + Math.random() - 0.5)));
      }
      d[p + 3] = 255;
      p += 4;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
};

// Плёночное зерно: атлас больше кадра, каждый кадр блитуется другой участок.
// Зерно ПОЛУРАЗРЕШЕНИЯ и растягивается вдвое: попиксельный шум, меняющийся
// каждый кадр, на почти чёрном фоне разваливается при любом уменьшении
// картинки — в плеере, на телефоне, в кодеке. Зерно 2×2 переживает
// пересэмплирование, поэтому пустой тёмный кадр остаётся чистым.
export const GRAIN_PX = 2;
export const GRAIN_A = 0.015;
export const makeNoise = (): HTMLCanvasElement => {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(Screen.width / GRAIN_PX) + 320;
  cv.height = Math.ceil(Screen.height / GRAIN_PX) + 180;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(cv.width, cv.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 170;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
};

// Оба атласа считаются один раз на модуль: генератор сцены переигрывается
// при каждой перемотке назад, и попиксельный проход по кадру там недопустим.
let backdropCache: HTMLCanvasElement | null = null;
let noiseCache: HTMLCanvasElement | null = null;
export const backdrop = () => (backdropCache ??= makeBackdrop());
export const noiseAtlas = () => (noiseCache ??= makeNoise());

// Rect, который блитует готовый canvas вместо собственной заливки.
export const blitRect = (draw: (c: CanvasRenderingContext2D) => void) => {
  const rect = new Rect({width: Screen.width, height: Screen.height});
  const orig = (rect as any).draw.bind(rect);
  (rect as any).draw = function (ctx: CanvasRenderingContext2D) {
    ctx.save();
    draw(ctx);
    ctx.restore();
    orig(ctx);
  };
  return rect;
};

// Полнокадровый фон опенинга.
export const backdropRect = () => blitRect(ctx => {
  ctx.drawImage(backdrop(), -Screen.width / 2, -Screen.height / 2);
});

// Зерно поверх: каждый кадр — другой участок атласа.
export const grainRect = () => blitRect(ctx => {
  const noise = noiseAtlas();
  const sw = Screen.width / GRAIN_PX;
  const sh = Screen.height / GRAIN_PX;
  const dx = Math.floor(Math.random() * (noise.width - sw));
  const dy = Math.floor(Math.random() * (noise.height - sh));
  ctx.globalAlpha = GRAIN_A;
  ctx.globalCompositeOperation = 'screen';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    noise, dx, dy, sw, sh,
    -Screen.width / 2, -Screen.height / 2, Screen.width, Screen.height,
  );
});
