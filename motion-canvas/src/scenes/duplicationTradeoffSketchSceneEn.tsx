import {blur, Line, makeScene2D, Node, Txt} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, easeOutCubic, easeOutSine, linear, spawn, waitFor} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// ── DON'T FIGHT DUPLICATION · отступление после инцидента: ТРИ КОЛБЫ ──────────
// ИТОГ (24.09): общее отступление без деталей депо — три вопроса перед
// слиянием, по колбе на вопрос. Две колбы («Changes to both / to one») автор
// назвал поверхностными; их версия лежит в scratchpad (tradeoff_v4_two_flasks).
// Озвучка (ElevenLabs, 44.2 с, файл автора в Downloads от 24.09 20:17):
//   Whether to merge similar code comes down to three questions.
//   The first is whether tying these parts together is justified at all.
//   Sometimes we can tell from what we already know: identical code may
//   serve different obligations.
//   The second is what we must keep in agreement if we leave them apart.
//   Similarity alone creates no obligation. But when several places express
//   one rule, every change has to reach them all. That's the price of a
//   connection nobody can see.
//   The third is how expensive it will be to change the boundary later. A
//   decision that stays local is cheap to undo. One surrounded by
//   dependencies is not.
//   We always decide with incomplete information. I don't see that as a
//   reason to guess. We can still weigh the obligations we know — and the
//   cost of being wrong.
// ⚠️ Такты стоят по паузам этой записи (silencedetect −38 dB): 17 речевых
// кусков ровно совпали с 17 фразами текста. Начала вопросов: первый 3.35 с,
// второй 13.59 с, третий 27.42 с, вывод 36.04 с, конец 44.20 с (время звука).
// ВЕРСИЯ ~33 с (24.09, 21:20): автор сократил вторую половину. Звук собран
// из трёх файлов ElevenLabs: старая запись 0–17.30 (до «if we leave them
// apart»), файл 18_18_10 0–9.62 («If one rule…» + третий вопрос), файл
// 18_19_33 целиком (новый дубль вывода). Куски опознаны распознаванием речи.
// Начала: первый 3.35, второй 13.59, третий 22.68, вывод 26.92, конец 33.4.
//
// История сцены:
// Сцена началась как два эскиза для сравнения («сделай и то и то для
// сравнения в одной сцене»): сосуды и развилка с двумя будущими. Автор выбрал
// сосуды («колба ок») и убрал развилку («и уберём развилку»); её код лежит в
// scratchpad сессии 6873886f (tradeoff_v2_with_fork.tsx).
// Три сосуда (идея из обсуждения автора с другой моделью): Divergence,
//     Sync cost, Cost to undo появляются и наполняются по очереди. Уровни
//     условные, без процентов и без итогового балла.
//     Правка автора 24.09: «колба ок. но там жидкость должна быть. и
//     утолщенные стенки. и пусть это сосуды будут. и текст не капсом и
//     крупнее». Сосуд — коническая колба: прямое горло, плечо, широкое дно.
//     Стенка толстая: плоская полоса стекла. Жидкость обрезана по внутренней
//     полости, у неё мениск у стенок, светлый слой у поверхности и волна,
//     которая плещет при наливе и гаснет.
//     ⚠️ Вторая правка автора: «ты удешевляешь картинку контурингом. и ещё
//     сверху загибания колбы убери». Никаких обводок: ни по стеклу, ни по
//     поверхности жидкости — форму держат заливки. Губы у горла нет: горло
//     кончается скруглённым торцом стенки.
// Фон — канонический графит (автор вернул его после пробы с чёрным), стенки
// светлее (автор).
// Озвучки пока нет: паузы дают прочитать каждый такт.

const ROSE = 'rgba(232,134,160,0.62)';       // приглушённая розовая жидкость (одобрена автором)

// ── Сосуд: коническая колба с толстой стенкой ────────────────────────────────
// Вся форма выводится из ОДНОЙ средней линии стенки: скругление углов, потом
// смещение на ±T/2 по нормали. Так полоса стекла, оба контура и полость для
// жидкости совпадают до пикселя, а не подгоняются по отдельности.
type P = [number, number];
const V_H = 440;                 // высота сосуда
const V_NECK = 36;               // полуширина горла (по средней линии стенки)
const V_NECK_H = 112;            // высота горла
const V_BOT = 146;               // полуширина дна
const V_R = 30;                  // скругление плеча и дна
const V_T = 14;                  // толщина стенки
const GLASS = 'rgba(244,241,235,0.30)';       // стекло — только заливка, без обводок; светлее по просьбе автора
const SURFACE_BAND = 'rgba(255,198,214,0.38)'; // светлый слой у поверхности жидкости
const SURFACE_DEPTH = 7;                          // толщина этого слоя, px

const vsub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];
const vadd = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]];
const vmul = (a: P, k: number): P => [a[0] * k, a[1] * k];
const vlen = (a: P) => Math.hypot(a[0], a[1]);
const vnorm = (a: P): P => vmul(a, 1 / vlen(a));

/** Скругляет внутренние вершины ломаной дугами (радиусы по вершинам). */
function fillet(pts: P[], radii: number[]): P[] {
  const out: P[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const A = pts[i - 1], B = pts[i], C = pts[i + 1];
    const u1 = vnorm(vsub(B, A)), u2 = vnorm(vsub(C, B));
    const phi = Math.acos(Math.max(-1, Math.min(1, -(u1[0] * u2[0] + u1[1] * u2[1]))));
    let r = radii[i];
    if (r <= 0 || phi > Math.PI - 1e-3) {
      out.push(B);
      continue;
    }
    let t = r / Math.tan(phi / 2);
    const maxT = 0.5 * Math.min(vlen(vsub(B, A)), vlen(vsub(C, B)));
    if (t > maxT) {
      t = maxT;
      r = t * Math.tan(phi / 2);
    }
    const T1 = vsub(B, vmul(u1, t));
    const T2 = vadd(B, vmul(u2, t));
    const turn = u1[0] * u2[1] - u1[1] * u2[0];
    const n1: P = turn > 0 ? [-u1[1], u1[0]] : [u1[1], -u1[0]];
    const c = vadd(T1, vmul(n1, r));
    const a1 = Math.atan2(T1[1] - c[1], T1[0] - c[0]);
    let da = Math.atan2(T2[1] - c[1], T2[0] - c[0]) - a1;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    const n = Math.max(4, Math.ceil(Math.abs(da) / (Math.PI / 32)));
    for (let k = 0; k <= n; k++) {
      const a = a1 + (da * k) / n;
      out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Смещает ломаную на d по нормали (−dy, dx); d > 0 — наружу сосуда. */
function offsetPath(pts: P[], d: number): P[] {
  const segN = (i: number): P => {
    const u = vnorm(vsub(pts[i + 1], pts[i]));
    return [-u[1], u[0]];
  };
  return pts.map((pt, i) => {
    if (i === 0) return vadd(pt, vmul(segN(0), d));
    if (i === pts.length - 1) return vadd(pt, vmul(segN(i - 1), d));
    const a = segN(i - 1), b = segN(i);
    const m = vnorm(vadd(a, b));
    const k = d / Math.max(0.3, m[0] * a[0] + m[1] * a[1]);
    return vadd(pt, vmul(m, k));
  });
}

const V_TOP = -V_H / 2;
const V_SHOULDER = V_TOP + V_NECK_H;
const V_MID = fillet([
  [-V_NECK, V_TOP],
  [-V_NECK, V_SHOULDER],
  [-V_BOT, V_H / 2],
  [V_BOT, V_H / 2],
  [V_NECK, V_SHOULDER],
  [V_NECK, V_TOP],
], [0, V_R, V_R, V_R, V_R, 0]);
const V_OUTER = offsetPath(V_MID, V_T / 2);
const V_INNER = offsetPath(V_MID, -V_T / 2);
/** Полукруглый торец стенки вокруг конца средней линии: от a к b через верх. */
function cap(center: P, from: P, to: P): P[] {
  const a1 = Math.atan2(from[1] - center[1], from[0] - center[0]);
  let da = Math.atan2(to[1] - center[1], to[0] - center[0]) - a1;
  // торец идёт через верх горла (y меньше)
  const mid = a1 + da / 2;
  if (Math.sin(mid) > 0) da = da > 0 ? da - 2 * Math.PI : da + 2 * Math.PI;
  const out: P[] = [];
  for (let k = 1; k < 16; k++) {
    const a = a1 + (da * k) / 16;
    out.push([center[0] + (V_T / 2) * Math.cos(a), center[1] + (V_T / 2) * Math.sin(a)]);
  }
  return out;
}
const V_BAND: P[] = [
  ...V_OUTER,
  ...cap(V_MID[V_MID.length - 1], V_OUTER[V_OUTER.length - 1], V_INNER[V_INNER.length - 1]),
  ...[...V_INNER].reverse(),
  ...cap(V_MID[0], V_INNER[0], V_OUTER[0]),
];
const V_FLOOR = V_H / 2 - V_T / 2;                    // дно полости
const V_CEIL = V_SHOULDER + 20;                        // выше плеча жидкость не поднимается

/** x внутренней левой стенки на высоте y (стенка симметрична). */
function innerHalfWidth(y: number): number {
  let best = 0;
  for (let i = 0; i < V_INNER.length - 1; i++) {
    const [a, b] = [V_INNER[i], V_INNER[i + 1]];
    if (a[0] > 0 || b[0] > 0) continue;
    if ((a[1] - y) * (b[1] - y) > 0 || a[1] === b[1]) continue;
    const t = (y - a[1]) / (b[1] - a[1]);
    best = Math.max(best, -(a[0] + (b[0] - a[0]) * t));
  }
  return best || V_BOT - V_T / 2;
}

export default makeScene2D(function* (view) {
  // Фон — канонический графит (автор вернул его после пробы с чёрным).
  applyBackground(view);
  const stage = new Node({});
  view.add(stage);

  // ═══ A · ТРИ СОСУДА ═════════════════════════════════════════════════════
  const V_GAP = 430;
  const V_Y = -40;
  const SPECS = [
    {label: 'Divergence', level: 0.74},
    {label: 'Sync cost', level: 0.36},
    {label: 'Cost to undo', level: 0.58},
  ];
  // Время для волны: сигнал, а не таймер — сцена скраббится.
  const clock = createSignal(0);
  spawn(clock(300, 300, linear));
  const flasks = new Node({});
  stage.add(flasks);
  const flaskItems = SPECS.map((s, i) => {
    const level = createSignal(0);
    const slosh = createSignal(0);                 // сила волны: плеснуло при наливе
    const g = new Node({x: (i - 1) * V_GAP, y: V_Y, opacity: 0});
    const fb = blur(10);
    g.filters([fb]);

    // Поверхность жидкости: уровень + две волны + мениск у стенок.
    const surfaceY = () => V_FLOOR - level() * (V_FLOOR - V_CEIL);
    const surface = (): P[] => {
      const y0 = surfaceY();
      const half = innerHalfWidth(y0);
      const amp = 6.5 * slosh();
      const ph = clock() * 3.4 + i * 1.7;
      const pts: P[] = [];
      for (let x = -V_BOT - 24; x <= V_BOT + 24; x += 6) {
        const wave = amp * Math.sin((x / 150) * 2 * Math.PI + ph)
          + 0.45 * amp * Math.sin((x / 88) * 2 * Math.PI - ph * 1.3);
        const d = Math.max(0, half - Math.abs(x));
        const meniscus = 5.5 * Math.exp(-d / 9);
        pts.push([x, y0 + wave - meniscus]);
      }
      return pts;
    };
    const cavity = new Line({points: V_INNER, closed: true, clip: true});
    cavity.add(new Line({
      points: () => [...surface(), [V_BOT + 24, V_H / 2 + 20], [-V_BOT - 24, V_H / 2 + 20]],
      closed: true,
      fill: ROSE,
      opacity: () => Math.min(1, level() * 30),
    }));
    // Светлый слой у поверхности — заливкой, не линией.
    cavity.add(new Line({
      points: () => {
        const top = surface();
        const under = top.map(([x, y]) => [x, y + SURFACE_DEPTH] as P).reverse();
        return [...top, ...under];
      },
      closed: true,
      fill: SURFACE_BAND,
      opacity: () => Math.min(1, level() * 30),
    }));
    g.add(cavity);
    // Стекло: одна полоса стенки, без обводок.
    g.add(new Line({points: V_BAND, closed: true, fill: GLASS}));
    g.add(new Txt({
      text: s.label, y: V_H / 2 + 74,
      fontFamily: Fonts.primary, fontSize: 36, fill: 'rgba(244,241,235,0.88)',
    }));
    flasks.add(g);
    return {g, fb, level, slosh, target: s.level};
  });

  // ═══ ТАЙМЛАЙН ПО ЗАПИСИ ОЗВУЧКИ ════════════════════════════════════════
  // Звук стоит в сцене со сдвигом VO: время сцены = время звука + VO.
  const VO = 0.5;
  let now = 0;
  function* at(tAudio: number) {
    const t = VO + tAudio;
    if (t > now) yield* waitFor(t - now);
    now = Math.max(now, t);
  }
  // Колба наполняется как жидкость: плеснуло при наливе, успокоилось после.
  function* fill(f: (typeof flaskItems)[number]) {
    yield* all(f.level(f.target, 1.9, easeInOutCubic), f.slosh(1, 0.5, easeOutSine));
    yield* f.slosh(0, 1.6, easeOutCubic);
    now += 3.5;
  }

  // «Whether to merge similar code comes down to three questions.» — три
  //  пустые колбы проявляются целиком, как один прибор, к словам «three
  //  questions».
  yield* at(0.5);
  yield* all(
    ...flaskItems.map(f => f.g.opacity(1, 1.4, easeOutCubic)),
    ...flaskItems.map(f => f.fb.value(0, 1.5, easeOutCubic)),
  );
  now += 1.5;

  // «The first is whether tying these parts together is justified at all…»
  yield* at(3.55);
  yield* fill(flaskItems[0]);

  // «The second is what we must keep in agreement if we leave them apart…»
  yield* at(13.8);
  yield* fill(flaskItems[1]);

  // «The third is how expensive it will be to change the boundary later…»
  yield* at(22.85);
  yield* fill(flaskItems[2]);

  // «We always decide with incomplete information. I don't see that as a
  //  reason to guess. We can still weigh the obligations we know — and the
  //  cost of being wrong.» — кадр стоит; после конца фразы секунда тишины и
  //  уход.
  yield* at(34.4);
  yield* all(
    flasks.opacity(0, 1.0, easeInOutCubic),
    ...flaskItems.map(f => f.fb.value(8, 1.0, easeInOutCubic)),
  );
});
