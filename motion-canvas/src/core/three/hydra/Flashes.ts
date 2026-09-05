// Hydra / Flashes — расписание вспышек связей и правило «третья не гаснет».
//
// Тезис сцен с сетью лежит в контрасте: связь, которую держат в голове люди,
// вспыхивает и гаснет; связь, которую запомнила система, горит. Геройская нить
// вспыхивает несколько раз — и на последний раз остаётся. Остальные могут
// залипнуть тем же механизмом (persistRatio): залипает та самая нить, что
// только что мигнула, а не появляется новая.
//
// Всё — чистая функция сетевого времени: сцена обязана скраббиться.

import type {Rng} from './noise';

/** Быстрая атака, длинный хвост: нить протягивается и тает, а не моргает. */
export function pulse(dt: number, dur: number): number {
  if (dt < 0 || dt > dur) return 0;
  const p = dt / dur;
  const a = p < 0.16 ? p / 0.16 : 1 - (p - 0.16) / 0.84;
  return a <= 0 ? 0 : a * a * a;
}

/** Пик по всем прошедшим вспышкам; flashes отсортированы по возрастанию. */
export function peakAt(flashes: number[], t: number, dur: number): number {
  let a = 0;
  for (const t0 of flashes) {
    if (t0 > t) break;
    a = Math.max(a, pulse(t - t0, dur));
  }
  return a;
}

export interface ScheduleOptions {
  /** Всего событий за окно. Считаем не «сколько мигает у каждой», а сколько
   * событий в сумме: одновременно в кадре должно быть 3–6 нитей. */
  events: number;
  /** Длина окна сетевого времени, сек. */
  length: number;
  /** Шанс, что за вспышкой почти сразу идёт вторая у другой нити. */
  pairChance?: number;
  /** Индексы, которые расписание не трогает (обычно герой = 0). */
  skip?: number[];
}

/** Расписание фоновых вспышек: массив времён на каждую нить, отсортированный. */
export function scheduleFlashes(rnd: Rng, count: number, opts: ScheduleOptions): number[][] {
  const skip = new Set(opts.skip ?? [0]);
  const pool: number[] = [];
  for (let i = 0; i < count; i++) if (!skip.has(i)) pool.push(i);
  const out: number[][] = Array.from({length: count}, () => []);
  if (pool.length === 0) return out;
  const pick = () => pool[(rnd() * pool.length) | 0];
  const pairChance = opts.pairChance ?? 0.25;

  for (let e = 0; e < opts.events; e++) {
    const i = pick();
    const t = 0.5 + rnd() * (opts.length - 2.5);
    out[i].push(t);
    // Неровный ритм: иногда пара нитей вспыхивает почти одновременно.
    if (rnd() < pairChance) {
      const j = pick();
      out[j].push(t + 0.15 + rnd() * 0.45);
    }
  }
  for (const f of out) f.sort((p, q) => p - q);
  return out;
}

export interface NetworkState {
  /** Сетевое время, сек. */
  t: number;
  /** Сила мерцающих связей, 0..1. */
  flicker: number;
  /** Геройская нить осталась гореть, 0..1. */
  heroHold: number;
  /** Доля фоновых нитей, что залипают (такт «система запомнила»). */
  persistRatio: number;
  flashDur: number;
  /** Множитель яркости мерцающих относительно постоянных. */
  flickerLevel?: number;
  /** Яркость залипшей фоновой нити. */
  latchLevel?: number;
}

export interface LinkLight {
  alpha: number;
  hold: number;
}

/**
 * Свет одной нити. hero — индекс геройской (обычно 0); latchAt/total — ранг
 * нити в очереди залипания.
 */
export function evalLink(
  i: number, hero: number, flashes: number[], latchAt: number, total: number, s: NetworkState,
): LinkLight {
  let a = peakAt(flashes, s.t, s.flashDur) * s.flicker * (s.flickerLevel ?? 1);
  let hold = 0;

  if (i === hero) {
    // Держим ровно, лёгкое дыхание в 4% — чтобы не выглядело мёртвым пикселем.
    const h = s.heroHold * (0.94 + 0.06 * Math.sin(s.t * 1.7));
    if (h > a) {a = h; hold = 1;}
    else if (s.heroHold > 0.5) hold = 1;
  } else if (s.persistRatio > 0 && latchAt / total <= s.persistRatio) {
    a = Math.max(a, s.latchLevel ?? 0.9);
    hold = 1;
  }
  return {alpha: a, hold};
}
