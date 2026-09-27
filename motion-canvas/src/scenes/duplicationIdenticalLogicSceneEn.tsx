import {blur, Line, makeScene2D, Node, Txt} from '@motion-canvas/2d';
import {all, chain, easeInOutCubic, easeInOutSine, easeOutCubic, useTime, waitFor} from '@motion-canvas/core';
import {Manticore} from '../core/code/components/Manticore';
import {buildCanonRules, Canon, CanonCodeTheme, paintCanonMethodCalls, paintCanonMethodCallsLine} from '../core/code/model/paletteCanon';
import {Fonts, Screen} from '../core/theme';
import {applyBackground} from '../core/utils';
import {mountFlasks} from '../core/flasks';

// ── DON'T FIGHT DUPLICATION · вступление к колбам: одинаковый код ≠ одна логика
// Стоит между затемнением акта 3 и колбами и продолжается колбами (сцены
// объединены 26.09). Голос читает цитату, пока она стоит в кадре, и дальше идёт
// по парам (27.09, автор: «полная фраза, с розовой цитатой»). Озвучка — ход
// мысли, а не перечень пар (такты стоят по оценке темпа автора ~3.3 сл/с —
// переставить по записи):
//   Identical code doesn't mean identical logic. An API request and a database
//   entity share every field, yet only the request faces clients. Once payments
//   need refunds, the two status lists stop meaning the same thing. Even one
//   limit can have two owners, a regulator and our finance team. The code
//   matched, but it would never change for the same reasons.
// ⚠️ Не «so one class for both feels obvious»: сразу после цитаты это защищает
// слияние, а опровергнуть его у DTO нечем — пара не меняется (автор: «вводим
// зрителя в заблуждение, начинаем путать»).
//
// ── Пятая версия (27.09): три пары ──────────────────────────────────────────
// Пара таймаутов убрана: она повторяла механизм лимитов (значение меняет его
// хозяин), а четыре пары за 23 с давали ~4 с на пару — голос успевал только
// перечислить («робот», «быстро всё происходит»). Трём парам достаётся в
// полтора раза больше времени. Зум-аут с колбами среди кода пробовали — автор:
// «нет, как было, но без одной пары: не зум-аут, а сдвиг».
//
// ── Четвёртая версия (автор 26.09): ПО РЕФЕРЕНСУ nullMeansChapter2En ─────────
// Правка автора: «движения в референсе выглядят хорошо; код без рамок и лишних
// анимаций, ничего не подсвечивать; дешёвые UI-анимации не нужны; при движении
// от розовой цитаты плавно добавь сетку».
// Отменено всё, что было «эффектом»: стеклянные рамки, гашение строк, полоска,
// съезд коробок, крен, дыхание, отъезды масштабом. Остаётся грамматика
// референса:
//   • камера ТОЛЬКО ЕДЕТ и не зумит; один масштаб на всю сцену; каждый проезд —
//     одна easeInOutCubic, без пауз и посадок;
//   • код в мире УЖЕ СТОИТ, резкий, за кромкой кадра: мы к нему приезжаем, а не
//     зажигаем его;
//   • сетка — шёпот (0.055, шаг 180), живёт в мире, приходит, когда камера
//     трогается от цитаты, и на проезде даёт параллакс;
//   • цитата — канон вопроса главы NULL («Why is it missing?»): моно 60,
//     SOFT_PINK, в центре, приходит через фокус.
// Маршрут по карте — три пары, три разных движения, потом сдвиг к колбам:
//   1. ВПРАВО от цитаты к паре DTO / сущность (данные);
//   2. ПО ДИАГОНАЛИ вправо-вниз к паре статусов (перечисления); в PaymentStatus
//      допечатывается REFUNDED;
//   3. ВВЕРХ к паре лимитов (правило: одна проверка, два хозяина правил); регулятор
//      снижает лимит платежей — в PaymentPolicy 10_000 → 5_000, RefundPolicy не тронут.
//      Не наоборот: регуляторные пороги обычно про платежи, а лимит возвратов —
//      внутренняя политика финансов (правка 27.09, «эффект дядюшки Боба»);
// ⚠️ Первая пара (DTO) не меняется: она — посылка «код одинаковый». Дальше каждая
// пара расходится по-своему: статусы — новой строкой, лимиты — значением
// (автор: «раз в enum что-то происходит, пусть и там поменяется значение»).
// Правка — после того, как камера встала, не на ходу; без подсветок: старое
// значение стирается обратной печатью, новое печатается (как флип в акте 3).
//   4. кадр стоит на лимитах, пока звучит вывод, потом камера сдвигается ВПРАВО
//      к колбам: они стоят в мире и въезжают в кадр, как код; сетка гаснет на
//      ходу, и колбы идут на чистом графите.
// Лейблов над блоками нет (автор убрал): что это за код, называет озвучка.
// shared.Status убран (автор: «не понимаю, зачем shared»).

// ⚠️ Код — не игрушечный (автор: «мы делаем видео для инженеров; не полотна, но
// и не однострочные куски»). Каждая пара — 8–11 строк настоящего кода. Тела в
// паре совпадают до символа; различаются только шапки: пакет, аннотации, имя.
const API = `package api.sessions

@Serializable
data class SessionRequest(
    val stationId: String,
    val connectorId: Int,
    val maxPowerKw: Int,
    val tariffId: String?,
    val requestedAt: Instant,
)`;
const STORAGE = `package storage.sessions

@Entity @Table(name = "sessions")
data class SessionEntity(
    val stationId: String,
    val connectorId: Int,
    val maxPowerKw: Int,
    val tariffId: String?,
    val requestedAt: Instant,
)`;
const ORDERS = `package orders

enum class OrderStatus(val done: Boolean) {
    PENDING(done = false),
    PAID(done = true),
    FAILED(done = true),
    CANCELLED(done = true),
}`;
const PAYMENTS = `package payments

enum class PaymentStatus(val done: Boolean) {
    PENDING(done = false),
    PAID(done = true),
    FAILED(done = true),
    CANCELLED(done = true),
}`;
const PAYMENTS_R = `package payments

enum class PaymentStatus(val done: Boolean) {
    PENDING(done = false),
    PAID(done = true),
    FAILED(done = true),
    CANCELLED(done = true),
    REFUNDED(done = true),
}`;
// ⚠️ Проверки срока карты здесь нет (была): возврат идёт на исходный платёж и на
// просроченную карту обычно проходит — сеньор-платёжник придрался бы. Вместе с
// ней ушёл и параметр card: неиспользуемый параметр — такая же зацепка.
const LIMIT_PAY = `package payments

class PaymentPolicy {

    fun check(amount: Money) {
        require(amount > Money.ZERO)
        require(amount <= Money(10_000))
    }
}`;
const LIMIT_REFUND = `package refunds

class RefundPolicy {

    fun check(amount: Money) {
        require(amount > Money.ZERO)
        require(amount <= Money(10_000))
    }
}`;
// Правка значения — выводится из исходного текста, чтобы двойник не разошёлся с
// ним ни в чём, кроме правки. HOLE — промежуточное состояние: значение стёрто.
const LIMIT_PAY_HOLE = LIMIT_PAY.replace('Money(10_000)', 'Money()');
const LIMIT_PAY_NEW = LIMIT_PAY.replace('Money(10_000)', 'Money(5_000)');

const TYPES = [
  'SessionRequest', 'SessionEntity', 'OrderStatus', 'PaymentStatus', 'String', 'Int', 'Boolean',
  'Instant', 'Money', 'PaymentPolicy', 'RefundPolicy',
];
const RULES = [
  ...buildCanonRules({
    types: TYPES,
    methods: ['check'],
    vars: [
      'stationId', 'connectorId', 'maxPowerKw', 'tariffId', 'requestedAt', 'done', 'amount', 'name',
      'api', 'sessions', 'storage', 'orders', 'payments', 'refunds',
    ],
  }),
  {match: /^(data|enum|class|fun)$/, color: Canon.keyword},
  // число с разделителем (10_000) токенайзер режет на куски — красим целиком
  {match: /^_?[0-9][0-9_]*$|^_[0-9_]+$/, color: Canon.number},
];

// ── цитата: канон вопроса главы NULL ──
const ASK_FS = 60;
const SOFT_PINK = 'rgba(236, 189, 200, 0.95)';
const ASK_Y = -12;

// ── код ──
const FS = 30;
const LH = FS * 1.5;
const ADV = FS * 0.605;
const GAP = 150;                          // просвет между текстами пары
const WIN_H = Screen.height + 104;        // окно Manticore = кадр: морф не скроллит сам
const textW = (code: string) => Math.max(...code.split('\n').map(l => l.length)) * ADV;

// ── сетка: шёпот, как под бортом в главе 2 NULL ──
const GRID_C = 'rgba(244,241,235,0.055)';
const GRID_STEP = 180;
const GRID_IN = 2.4;

// ── карта ──
// Сетка 2×2, шаг как в первой версии (автор: «по диагонали слишком далеко»).
// Маршрут: вправо, диагональ вниз-вправо, вверх, вправо к колбам. Нижняя левая
// клетка пустая — там стояли таймауты; камера туда не заезжает.
// ⚠️ Чтобы на переезде не мелькал код чужой пары (на диагонали камера проходит
// центр сетки, мимо лимитов), в мире видны только ДВЕ пары: откуда едем и
// куда. Цель включается, пока она ещё за кромкой; покинутая выключается, когда
// уже за кромкой — поэтому ни появления, ни исчезновения в кадре не видно.
// Колбы от этого не зависят: до сдвига они ни в один кадр не попадают.
const P_ASK = {x: 0, y: 0};
const COL = 1920, ROW = 1080;
const P_DTO = {x: 1920, y: 0};                  // вправо
const P_ENUM = {x: 1920 + COL, y: ROW};         // по диагонали вправо-вниз
const P_LIMIT = {x: 1920 + COL, y: 0};          // вверх
const P_OUT = {x: 1920 + 2 * COL, y: 0};        // сдвиг вправо — к колбам (центр колб)
const PAN_T = 1.7;                              // каждый проезд — одним движением
const OUT_T = 2.7;                              // сдвиг к колбам — медленнее: смена части


export default makeScene2D(function* (view) {
  applyBackground(view);
  const world = new Node({});
  view.add(world);
  const look = (p: {x: number; y: number}, dur: number) =>
    world.position([-p.x, -p.y], dur, easeInOutCubic);
  world.position([-P_ASK.x, -P_ASK.y]);

  // ── сетка — первой, под всем; покрывает весь путь камеры с запасом ──
  const grid = new Node({opacity: 0});
  world.add(grid);
  const gx0 = -8 * GRID_STEP, gx1 = Math.ceil((P_OUT.x + 1400) / GRID_STEP) * GRID_STEP;
  const gy0 = -5 * GRID_STEP, gy1 = Math.ceil((ROW + 900) / GRID_STEP) * GRID_STEP;
  for (let x = gx0; x <= gx1; x += GRID_STEP) grid.add(new Line({points: [[x, gy0], [x, gy1]], stroke: GRID_C, lineWidth: 1}));
  for (let y = gy0; y <= gy1; y += GRID_STEP) grid.add(new Line({points: [[gx0, y], [gx1, y]], stroke: GRID_C, lineWidth: 1}));

  // ── цитата ──
  const ask = new Txt({
    text: 'Identical code doesn’t mean identical logic.',
    fontFamily: Fonts.code, fontSize: ASK_FS, fontWeight: 500,
    fill: SOFT_PINK, x: P_ASK.x, y: P_ASK.y + ASK_Y, opacity: 0,
  });
  const askBlur = blur(10);
  ask.filters([askBlur]);
  world.add(ask);

  // ── код: стоит в мире, резкий, без рамок; краска — канон: определения и
  //    вызовы методов разными цветами (paintCanonMethodCalls) ──
  const lines = (s: string) => s.split('\n').length;
  const block = (parent: Node, text: string, left: number, top: number): Manticore => {
    const m = Manticore.create(text, {
      x: 0, y: 0, width: 900, height: WIN_H, fontSize: FS, lineHeight: LH,
      theme: CanonCodeTheme, glowAccent: false, customTypes: TYPES,
      cardStyle: {fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)', radius: 0, edge: false},
      noClip: true,
    });
    m.mount(parent);
    m.colorize(RULES);
    paintCanonMethodCalls(m);
    m.node.opacity(1);
    m.node.x(left - m.getLeftEdge());
    m.node.y(top - m.getLineY(0));
    return m;
  };
  // пара — одна нода мира; верхние кромки блоков совпадают, пара по центру точки
  // ⚠️ Лейблов над блоками нет (автор убрал их) — что это за код, обязана
  // назвать озвучка: API request / database entity, статусы, лимит платежей.
  const pair = (a: string, b: string, c: {x: number; y: number}) => {
    const g = new Node({opacity: 0});
    world.add(g);
    const wa = textW(a), wb = textW(b);
    const left = c.x - (wa + GAP + wb) / 2;
    const n = Math.max(lines(a), lines(b));
    const top = c.y - (n - 1) * LH / 2;
    const ma = block(g, a, left, top);
    const mb = block(g, b, left + wa + GAP, top);
    return {g, a: ma, b: mb};
  };
  const dto = pair(API, STORAGE, P_DTO);
  const st = pair(ORDERS, PAYMENTS, {x: P_ENUM.x, y: P_ENUM.y - 0.5 * LH});
  const lim = pair(LIMIT_PAY, LIMIT_REFUND, P_LIMIT);
  dto.g.opacity(1);                // DTO видна сразу: к ней едем от цитаты
  // ⚠️ Колбы СТОЯТ в мире резкими, как код: камера к ним приезжает (автор:
  // «колбы должны в кадр въехать, как и код, ты лениво сделал»). Первая версия
  // приезжала в пустоту и проявляла колбы после — не делать так.
  const flaskStage = new Node({x: P_OUT.x, y: P_OUT.y});
  world.add(flaskStage);
  const runFlasks = mountFlasks(flaskStage, {standing: true});

  // ═══ ТАЙМЛАЙН ПО ОЗВУЧКЕ ══════════════════════════════════════════════════
  // ⚠️ Такт считается от РЕАЛЬНОГО времени сцены (useTime), а не ручным
  // счётчиком: печать REFUNDED шла дольше заложенных 0.8 с, счётчик отставал,
  // и всё после неё съезжало на секунду — колбы приезжали не к 23.0.
  const VO = 0.5;
  function* at(tAudio: number) {
    const dt = VO + tAudio - useTime();
    if (dt > 0) yield* waitFor(dt);
  }
  // переезд от пары к паре: цель включается за кромкой, покинутая гаснет за кромкой
  function* travel(from: {g: Node} | null, to: {g: Node} | null, p: {x: number; y: number}, dur = PAN_T) {
    if (to) to.g.opacity(1);
    yield* look(p, dur);
    if (from) from.g.opacity(0);
  }

  // Правка значения в одном из двойников: старое стирается обратной печатью,
  // пауза, новое печатается — как флип false → true в акте 3, только быстрее
  // (стоянка короткая). Строка не меняет свой y, поэтому скольжение токенов
  // идёт строго по горизонтали, без диагонального «крипа».
  const MORPH_BASE = {
    addStyle: 'typewriter' as const, lineDelay: 0.03,
    moveDuration: 0.25, removeDuration: 0.2, scrollStrategy: 'block' as const,
    lineOrder: 'sequential' as const, blockOrder: 'sequential' as const,
    tokenSlideDuration: 0.25,
    recolorLine: paintCanonMethodCallsLine,
  };
  function* retype(m: Manticore, hole: string, next: string) {
    yield* m.morphTo(hole, {
      ...MORPH_BASE, charDelay: 0.06,
      flashRemovedErase: 'reverseType', flashRemovedEraseCharDelay: 0.045,
      flashRemovedColor: 'rgba(244,241,235,0.32)',
    });
    yield* waitFor(0.12);
    yield* m.morphTo(next, {...MORPH_BASE, charDelay: 0.06});
    m.colorize(RULES);
    paintCanonMethodCalls(m);
  }

  // ═══ ДО КОЛБ — 23 с (автор: «23 секунды максимум, ускорь движение») ═══════
  // Время сцены (такт + VO 0.5); озвучка — по оценке темпа автора (~3.3 сл/с):
  //   0.2–3.5   цитата (автор: «чуть дольше розовую фразу»)     «Identical code …»  ~0.5–2.6
  //   3.5–5.2   → DTO,      стоим 3.8   «An API request … faces clients»          ~4.2–9.0
  //   9.0–10.7  → статусы,  стоим 3.2   «Once payments need refunds, …»           ~9.5–13.4
  //             REFUNDED печатается сразу после посадки, на «refunds» (~1.3 с)
  //  13.9–15.6  → лимиты,   стоим 4.7   «Even one limit can have two owners, …»   ~14.2–18.3
  //             5_000 вместо 10_000 сразу после посадки (~1.1 с)
  //             вывод звучит на лимитах  «The code matched, but …»                ~18.3–21.9
  //  20.3–23.0  → колбы (2.7 с); к 23.0 колбы в кадре
  // Было при четырёх парах: стоянки по 2.3–2.7 с — «быстро всё происходит».
  yield* at(-0.3);
  yield* all(ask.opacity(1, 1.0, easeOutCubic), askBlur.value(0, 1.0, easeInOutSine));

  // вправо к DTO; сетка приходит с первым движением камеры
  yield* at(3.0);
  yield* all(look(P_DTO, PAN_T), grid.opacity(1, GRID_IN, easeInOutSine));

  // по диагонали к статусам; там допечатывается REFUNDED
  yield* at(8.5);
  yield* travel(dto, st, P_ENUM);
  yield* st.b.morphTo(PAYMENTS_R, {
    addStyle: 'typewriter', charDelay: 0.04, lineDelay: 0.03,
    moveDuration: 0.3, removeDuration: 0.2, scrollStrategy: 'block',
    lineOrder: 'sequential', blockOrder: 'sequential',
    settleBeforeType: true, diffPreferEarlyMatches: true,
    recolorLine: paintCanonMethodCallsLine,
  });
  st.b.colorize(RULES);
  paintCanonMethodCalls(st.b);

  // вверх к лимитам; регулятор снижает лимит платежей, возвраты не тронуты
  yield* at(13.4);
  yield* travel(st, lim, P_LIMIT);
  yield* waitFor(0.2);
  yield* retype(lim.a, LIMIT_PAY_HOLE, LIMIT_PAY_NEW);

  // вправо — к колбам: они уже стоят и въезжают в кадр, сетка гаснет на ходу.
  // ⚠️ Таймлайн колб (core/flasks.ts) стартует за 0.5 с до приезда: у него свой
  // вход озвучки 0.5 с, и его первое слово ложится ровно на приезд камеры (23.0).
  // Дальше колбы идут в своём прежнем темпе.
  yield* at(19.8);
  yield* all(
    travel(lim, null, P_OUT, OUT_T),
    grid.opacity(0, OUT_T, easeInOutSine),
    chain(waitFor(OUT_T - 0.5), runFlasks()),
  );
});
