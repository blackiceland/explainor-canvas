import {Node, Rect} from '@motion-canvas/2d';
import {createSignal, SimpleSignal} from '@motion-canvas/core';
import {Screen} from '../theme';

// ── Мягкая круговая виньетка ───────────────────────────────────────────────
// ⚠️ Не `Gradient` и ⚠️ НЕ гаснет через opacity узла.
//
// Радиальный градиент на тёмном фоне распадается на кольца: перепад в
// полтора десятка уровней растянут на тысячу пикселей, и каждый шаг 1/255
// виден как отдельная окружность. Стопами это не лечится — это квантование.
// Лечится дизерингом.
//
// Но дизеринг обязан считаться под ТЕКУЩУЮ силу. Если запечь его один раз, а
// потом гасить узел прозрачностью, шум умножится на ту же прозрачность: при
// 0.3 он становится шумом в 0.15 уровня и перестаёт работать. Кольца
// возвращаются, и, поскольку сила меняется непрерывно, границы ступеней едут
// по кадру — картинка выглядит распадающейся. Поэтому альфа пересчитывается
// каждый кадр, а гасится виньетка сигналом strength, не opacity.
//
// Считаем на трети разрешения и блитуем без сглаживания: форма рампы от
// этого не страдает (600 px перепада — это 200 отсчётов), а дизер-блок 3×3
// переживает любое уменьшение картинки, в отличие от попиксельного шума.
// Рампа — smoothstep от 0.45 радиуса угла: у виньетки нет видимого начала,
// центральная треть кадра не тронута вовсе.

const DIV = 3;
const RW = Math.ceil(Screen.width / DIV);
const RH = Math.ceil(Screen.height / DIV);
const CORNER = Math.hypot(Screen.width / 2, Screen.height / 2);
const R_IN = CORNER * 0.45;

// ⚠️ Амплитуда дизера — в уровнях АЛЬФЫ, и считать её надо от ФОНА.
// Виньетка не рисует свой цвет, она умножает фон: out = dst·(1 − a/255).
// Одна ступень выхода стоит 255/dst ступеней альфы: в тёмном углу кадра
// (dst ≈ 12) это два десятка. Дизер должен покрывать ПОЛНУЮ ступень выхода,
// иначе он лишь делает границу кольца рваной, а само кольцо остаётся: замер
// по кромке кадра показывал плато в 57–87 px при ступени в 69 px, то есть
// эффекта не было вовсе. Отсюда 10 — половина ступени при dst ≈ 12.
// В светлых местах кадра виньетка около нуля и шум туда не попадает.
const DITHER = 10;

// Форма рампы не зависит от силы — считается один раз на модуль.
let rampCache: Float32Array | null = null;
function ramp(): Float32Array {
  if (rampCache) return rampCache;
  const r = new Float32Array(RW * RH);
  const cx = Screen.width / 2;
  const cy = Screen.height / 2;
  const span = CORNER - R_IN;
  let p = 0;
  for (let y = 0; y < RH; y++) {
    const dy = (y + 0.5) * DIV - cy;
    for (let x = 0; x < RW; x++) {
      const dx = (x + 0.5) * DIV - cx;
      const d = Math.sqrt(dx * dx + dy * dy);
      const t = Math.min(1, Math.max(0, (d - R_IN) / span));
      r[p++] = t * t * (3 - 2 * t);              // smoothstep
    }
  }
  rampCache = r;
  return r;
}

export interface Vignette {
  node: Rect;
  /** Гасить виньетку нужно ОТСЮДА, а не через opacity узла. */
  strength: SimpleSignal<number>;
}

export function mountVignette(view: Node, initial = 0.45): Vignette {
  const strength = createSignal(initial);

  const off = document.createElement('canvas');
  off.width = RW;
  off.height = RH;
  const octx = off.getContext('2d')!;
  const img = octx.createImageData(RW, RH);
  for (let i = 0; i < RW * RH; i++) img.data[i * 4 + 3] = 0;   // RGB нули = чёрный

  const rect = new Rect({width: Screen.width, height: Screen.height});
  const orig = (rect as any).draw.bind(rect);
  (rect as any).draw = function (ctx: CanvasRenderingContext2D) {
    const s = strength();
    if (s > 0.001) {
      const r = ramp();
      const d = img.data;
      const a = 255 * s;
      for (let i = 0, p = 3; i < r.length; i++, p += 4) {
        const k = r[i];
        // Шум нарастает вместе с виньеткой: там, где её вклад ещё меньше
        // одной ступени выхода, дизерить нечего, а шум на чистом фоне виден.
        // Полная амплитуда набирается к k ≈ 0.1 — как раз к первой ступени.
        const v = k <= 0 ? 0
          : a * k + (Math.random() - 0.5) * 2 * DITHER * Math.min(1, k * 10);
        d[p] = v <= 0 ? 0 : v >= 255 ? 255 : (v + 0.5) | 0;
      }
      octx.putImageData(img, 0, 0);
      const smooth = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, -Screen.width / 2, -Screen.height / 2, Screen.width, Screen.height);
      ctx.imageSmoothingEnabled = smooth;
    }
    orig(ctx);
  };
  view.add(rect);
  return {node: rect, strength};
}
