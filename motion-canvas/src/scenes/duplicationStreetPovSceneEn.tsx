import {blur, makeScene2D, Node, Rect} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, easeInOutSine, easeOutCubic, linear, ThreadGenerator, useTime, waitFor} from '@motion-canvas/core';
import {AVAIL_AT, buildPovShot, CODE_AT, GONE_AT, GONE_T, MARK_IN, MARK_MOVE, povTimeline} from '../core/three/povStreetShot';
import {Manticore, MorphOptions} from '../core/code/components/Manticore';
import {
  buildCanonRules, Canon, CanonCodeTheme, paintCanonMethodCalls, paintCanonMethodCallsLine,
  paintCanonParams, paintCanonParamsLine,
} from '../core/code/model/paletteCanon';
import {Screen} from '../core/theme';

// ── DON'T FIGHT DUPLICATION · глава 2 целиком (акты 5–6 PDF) ────────────────
// Ночь, дождь, улица. Впереди стойка — ни одного огонька. В руку поднимается
// телефон: «● Available» и зелёная кнопка. Тап «Start charging» → «Starting…» →
// снизу лист «Connector unavailable», а «Available» наверху остаётся.
//
// Продолжение (28.09, идея автора): телефон с рукой уезжает вправо, лист
// уходит вниз, слева на нашем графите — код. Графит плотный слева и плавно
// тает в картинку справа; рука притемнена. (Вуаль «всё кроме телефона почти в
// графите» автор пробовал 02.10 и отверг.)
//
// Код ужат до правила (автор, 02.10: «наш пример объёмный, долго придётся
// логику объяснять»; обзор запроса и разбор полей сняты):
//   • слева — `toView` (что показывает приложение) и под ним enum статусов;
//   • справа — обработчик старта, на одном уровне с `toView` (автор: «классы на
//     одном уровне, enum ниже, а не сверху»). Высоты равны — по 14 строк.
// Указатель — полоска-канон под строкой (роуз 0.18, по длине строки, острые
// углы, слой под кодом; треугольник и полоска в поле отвергнуты). Код не гаснет.
//
// Такты:
//   1. телефон справа: полоска под `available = status != CHARGING` и под
//      «● Available» на экране — одно слово в коде и на экране;
//   2. телефон уходит в графит, справа проявляется обработчик: handle →
//      проверка статуса → throw (лист, который видел водитель) → обе строки
//      правил сразу;
//   3. в enum печатается OUT_OF_ORDER → обработчик его не пускает → приложение
//      спрашивает «не заряжается ли» → обе строки: система говорит две вещи;
//   4. развязка: каждый статус несёт `canStart`, обе строки спрашивают статус.
// Справа, а не скроллом вниз: два правила зритель сравнивает глазами
// одновременно.
//
// ⚠️ Кадр POV целиком собирает core/three/povStreetShot (povTimeline —
// чистая функция времени); стенд scratchpad/pov снимает тот же модуль.
// ⚠️ Звук тапа ставит автор — касание стекла на TAP_AT (5.1 с).
// ⚠️ Такты стоят по черновику озвучки (~2.8 слова/с) — переставить по записи.

// ── Слева: что показывает приложение + статусы ─────────────────────────────
const LEFT = `fun Connector.toView(tariff: Tariff): ConnectorView {
    return ConnectorView(
        plug = plug.displayName,
        maxPowerKw = maxPowerKw,
        pricePerKwh = tariff.pricePerKwh(plug),
        available = status != CHARGING,
    )
}

enum class ConnectorStatus {
    AVAILABLE,
    CHARGING,
    FINISHING,
}`;
// Разъём сломался — в enum ОДНА новая строка, больше ничего не меняется.
const LEFT_BROKEN = LEFT.replace('    FINISHING,\n}', '    FINISHING,\n    OUT_OF_ORDER,\n}');
// Развязка: ответ «можно ли начать» несёт сам статус…
const LEFT_RULE = LEFT_BROKEN
  .replace('enum class ConnectorStatus {', 'enum class ConnectorStatus(val canStart: Boolean) {')
  .replace('    AVAILABLE,', '    AVAILABLE(canStart = true),')
  .replace('    CHARGING,', '    CHARGING(canStart = false),')
  .replace('    FINISHING,', '    FINISHING(canStart = true),')
  .replace('    OUT_OF_ORDER,', '    OUT_OF_ORDER(canStart = false),');
// …и приложение спрашивает его.
const LEFT_FIX = LEFT_RULE.replace('available = status != CHARGING,', 'available = status.canStart,');

// ── Справа: обработчик старта ───────────────────────────────────────────────
// Проверка оплаты — для правды: правило статуса — одна из причин отказа, как
// в настоящем коде. Голос о ней молчит.
const RIGHT = `fun handle(command: StartCharging): SessionId {
    val connector = connectors.get(command.connectorId)
    val driver = drivers.get(command.driverId)

    if (connector.status !in setOf(AVAILABLE, FINISHING)) {
        throw ConnectorUnavailable(connector.id)
    }

    if (driver.paymentMethod == null) {
        throw PaymentMethodMissing(driver.id)
    }

    return sessions.start(connector, driver)
}`;
const RIGHT_FIX = RIGHT.replace(
  'if (connector.status !in setOf(AVAILABLE, FINISHING)) {', 'if (!connector.status.canStart) {');

const TYPES = [
  'Connector', 'Tariff', 'ConnectorView', 'ConnectorStatus', 'Boolean',
  'StartCharging', 'SessionId', 'ConnectorUnavailable', 'PaymentMethodMissing',
];
const RULES = buildCanonRules({
  types: TYPES,
  methods: ['toView', 'handle'],
  vars: [
    'plug', 'displayName', 'maxPowerKw', 'tariff', 'status', 'canStart', 'connector', 'connectors',
    'command', 'connectorId', 'driver', 'drivers', 'driverId', 'paymentMethod', 'sessions', 'id',
  ],
});
const RECOLOR = (line: any) => {
  paintCanonMethodCallsLine(line);
  paintCanonParamsLine(line);
};
// Вставка строки: код сначала расступается, потом строка печатается;
// повторяющиеся `}` — ранним совпадением.
const INSERT: MorphOptions = {
  addStyle: 'typewriter', charDelay: 0.05, lineDelay: 0.04,
  moveDuration: 0.6, removeDuration: 0.3, scrollStrategy: 'block',
  lineOrder: 'sequential', blockOrder: 'sequential',
  settleBeforeType: true, diffPreferEarlyMatches: true,
  recolorLine: RECOLOR,
};
// Правка строк на месте: общие токены едут, лишнее стирается обратной печатью.
// diffByText: `AVAILABLE,` и `AVAILABLE(canStart = true),` — для токенизатора
// константа и вызов; без флага имя статуса стиралось и печаталось заново.
const EDIT: MorphOptions = {
  addStyle: 'typewriter', charDelay: 0.03, lineDelay: 0.04,
  moveDuration: 0.6, removeDuration: 0.3, scrollStrategy: 'block',
  lineOrder: 'sequential', blockOrder: 'sequential',
  tokenSlideDuration: 0.4,
  flashRemovedErase: 'reverseType', flashRemovedEraseCharDelay: 0.011,
  flashRemovedColor: 'rgba(244,241,235,0.32)',
  diffPreferEarlyMatches: true, diffByText: true,
  recolorLine: RECOLOR,
};

// ── Геометрия ───────────────────────────────────────────────────────────────
// Кегль 24 — больше не влезает: строка проверки статуса (59 знаков) задаёт
// ширину правой колонки. Поля по 96 px, между колонками ~100 px. Обе колонки
// по 14 строк, общий верх; блок стоит по центру кадра (и по центру телефона,
// пока тот справа).
const FS = 24;
const LH = FS * 1.5;
const ADV = FS * 0.605;
const MARGIN = 96;
const WIN_H = Screen.height + 104;        // окно Manticore = кадр: морф не скроллит сам
const rows = (src: string) => src.split('\n');
const widest = (...srcs: string[]) => Math.max(...srcs.flatMap(rows).map(l => l.length)) * ADV;
const LEFT_W = widest(LEFT, LEFT_BROKEN, LEFT_RULE, LEFT_FIX);
const RIGHT_W = widest(RIGHT, RIGHT_FIX);
const CODE_LEFT = -Screen.width / 2 + MARGIN;
const RIGHT_LEFT = Screen.width / 2 - MARGIN - RIGHT_W;
const CODE_TOP = -Math.max(rows(LEFT).length, rows(RIGHT).length) * LH / 2;
const TOP_LINE_Y = CODE_TOP + LH / 2;

// ── Такты обработчика и развязки (только код) — по черновику озвучки ───────
const RIGHT_AT = GONE_AT + GONE_T + 0.2;  // справа проявляется обработчик
const B = {
  handle: RIGHT_AT + 1.4,                 // «…to the handler that actually starts a session»
  guard: RIGHT_AT + 3.9,                  // «It lets a driver start only on two statuses…»
  thrown: RIGHT_AT + 8.4,                 // «On anything else, it throws Connector unavailable.»
  both: RIGHT_AT + 11.4,                  // «Two places, two different shapes…»
  breaks: RIGHT_AT + 24.8,                // «Then a connector breaks, so we add one status…»
  rejects: RIGHT_AT + 29.7,               // «The handler rejects it…»
  asks: RIGHT_AT + 33.9,                  // «The app asks a different question…»
  twice: RIGHT_AT + 41.7,                 // «…the system says two things at once…»
  fix: RIGHT_AT + 60.9,                   // «The fix isn't merging the app and the handler…»
  rule: RIGHT_AT + 65.5,                  // «What has to live in one place is the decision.»
  ask: RIGHT_AT + 69.8,                   // «Each status now carries its own answer…»
  end: RIGHT_AT + 91.3,                   // после «…understand one decision.»
};

// Полоска-канон проекта (duplicationIncidentSceneEn): роуз 0.18, по длине
// строки (от первого непробельного знака) + поля 10 px, высота 1.15 строки,
// острые углы, слой под кодом.
const STRIPE_COLOR = 'rgba(255, 80, 120, 0.18)';
const STRIPE_H = LH * 1.15;
const STRIPE_PAD = 10;

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

  // Колонка кода: слой (проявляется целиком), под кодом — слой полоски.
  const column = (src: string, width: number, left: number) => {
    const layer = new Node({opacity: 0});
    view.add(layer);
    const stripe = new Rect({offset: [-1, 0], height: STRIPE_H, fill: STRIPE_COLOR, radius: 0, opacity: 0});
    layer.add(stripe);
    const code = Manticore.create(src, {
      x: 0, y: 0, width: width + 240, height: WIN_H, fontSize: FS, lineHeight: LH,
      theme: CanonCodeTheme, glowAccent: false, customTypes: TYPES,
      cardStyle: {fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)', radius: 0, edge: false},
      noClip: true,
    });
    code.mount(layer);
    code.colorize(RULES);
    paintCanonMethodCalls(code);
    paintCanonParams(code);                // именованные аргументы — цветом полей
    code.node.opacity(1);
    code.node.x(left - code.getLeftEdge());
    code.node.y(TOP_LINE_Y - code.getLineY(0));
    return {layer, stripe, code, left};
  };
  type Column = ReturnType<typeof column>;

  const L = column(LEFT, LEFT_W, CODE_LEFT);
  // `fun Connector.toView(` — определение, хотя перед именем точка: пейнтер
  // вызовов красит его как вызов, возвращаем цвет определения.
  {
    const line = L.code.getLine(0) as any;
    for (const tok of line.tokens) if (tok.text.trim() === 'toView') tok.ref().fill(Canon.methodDef);
  }
  const R = column(RIGHT, RIGHT_W, RIGHT_LEFT);

  function* at(t: number) {
    const dt = t - useTime();
    if (dt > 0) yield* waitFor(dt);
  }
  // Колонка проявляется целиком, одним фокусом.
  function* develop(c: Column): ThreadGenerator {
    const open = blur(10);
    c.layer.filters([open]);
    yield* all(c.layer.opacity(1, 1.0, easeOutCubic), open.value(0, 1.1, easeInOutSine));
    c.layer.filters([]);
  }
  // Полоска под строку `needle` документа `src`: первый раз проявляется на
  // месте, дальше переезжает и меняет длину.
  function* mark(c: Column, src: string, needle: string, move = MARK_MOVE): ThreadGenerator {
    const lines = rows(src);
    const i = lines.findIndex(r => r.includes(needle));
    if (i < 0) throw new Error(`нет строки: ${needle}`);
    const t = lines[i];
    const c0 = t.length - t.trimStart().length, c1 = t.trimEnd().length;
    const x = c.left + c0 * ADV - STRIPE_PAD, y = TOP_LINE_Y + i * LH, w = (c1 - c0) * ADV + STRIPE_PAD * 2;
    if (c.stripe.opacity() < 0.01) {
      c.stripe.position([x, y]);
      c.stripe.width(w);
      yield* c.stripe.opacity(1, MARK_IN, easeInOutSine);
      return;
    }
    yield* all(c.stripe.position([x, y], move, easeInOutCubic), c.stripe.width(w, move, easeInOutCubic));
  }
  const unmark = (c: Column) => c.stripe.opacity(0, MARK_IN, easeInOutSine);
  const GUARD = 'if (connector.status !in';

  function* timeline(): ThreadGenerator {
    // ── телефон справа: одно слово в коде и на экране ──
    yield* at(CODE_AT);
    yield* develop(L);
    yield* at(AVAIL_AT);                   // тот же момент — полоска под «● Available» (povStreetShot)
    yield* mark(L, LEFT, 'available =');

    // ── обработчик: телефон уходит в графит, справа — код старта ──
    yield* at(GONE_AT);
    yield* unmark(L);
    yield* at(RIGHT_AT);
    yield* develop(R);
    yield* at(B.handle);
    yield* mark(R, RIGHT, 'fun handle(');
    yield* at(B.guard);
    yield* mark(R, RIGHT, GUARD);
    yield* at(B.thrown);
    yield* mark(R, RIGHT, 'throw ConnectorUnavailable');
    // два места, две формы одного правила
    yield* at(B.both);
    yield* all(mark(R, RIGHT, GUARD), mark(L, LEFT, 'available ='));

    // ── разъём сломался: один новый статус ──
    yield* at(B.breaks);
    yield* all(unmark(L), unmark(R));
    yield* L.code.morphTo(LEFT_BROKEN, INSERT);
    yield* mark(L, LEFT_BROKEN, 'OUT_OF_ORDER,');
    // обработчик его не пускает: новый статус и правило обработчика — вместе
    yield* at(B.rejects);
    yield* mark(R, RIGHT, GUARD);
    // приложение спрашивает другое: полоска слева уходит со статуса к `available`
    yield* at(B.asks);
    yield* all(unmark(R), mark(L, LEFT_BROKEN, 'available ='));
    // система говорит две вещи сразу
    yield* at(B.twice);
    yield* mark(R, RIGHT, GUARD);

    // ── развязка: ответ живёт в статусе, оба места его спрашивают ──
    yield* at(B.fix);
    yield* all(unmark(L), unmark(R));
    yield* at(B.rule);
    yield* L.code.morphTo(LEFT_RULE, EDIT);
    yield* at(B.ask);
    yield* all(mark(R, RIGHT, GUARD), mark(L, LEFT_RULE, 'available ='));
    yield* all(
      L.code.morphTo(LEFT_FIX, EDIT),
      R.code.morphTo(RIGHT_FIX, EDIT),
      mark(L, LEFT_FIX, 'available =', 0.9),
      mark(R, RIGHT_FIX, 'if (!connector.status.canStart)', 0.9),
    );
    yield* at(B.end);
  }

  yield* all(clock(B.end, B.end, linear), timeline());
});
