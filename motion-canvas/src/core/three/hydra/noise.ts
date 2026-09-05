// Hydra / noise — детерминированный шум для точечных полей.
//
// Всё, что строит поле, обязано быть одинаковым при каждом прогоне: сцена
// скраббится, стилл должен совпадать с плеером точка в точку, а перемотка не
// имеет права перестраивать рельеф. Поэтому никакого Math.random — только
// сид.

export type Rng = () => number;

/** mulberry32: маленький, быстрый, воспроизводимый. */
export function rng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Целочисленный хеш узла решётки → [0, 1). */
export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Value noise с кубическим сглаживанием, [0, 1). */
export function vnoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

/**
 * Гребневой фрактал. Обычный fBm даёт мягкие холмы — а точечному полю нужны
 * СКЛАДКИ: белый в нём рисуют кромки, где поверхность встаёт ребром к камере,
 * и яркость набирается числом складок на луче.
 *
 * gain — затухание октав. 0.55 — рабочая середина: при 0.66 рельеф
 * вырождается в равномерный снег без крупных гребней, при 0.4 — в дюны.
 */
export function ridged(
  x: number, y: number, oct: number, seed: number,
  gain = 0.55, lacunarity = 2.07,
): number {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let o = 0; o < oct; o++) {
    const n = vnoise(x * freq, y * freq, seed + o * 101);
    const r = 1 - Math.abs(n * 2 - 1);
    sum += r * r * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}
