import {blur, makeScene2D, Node, Rect} from '@motion-canvas/2d';
import {all, createSignal, delay, easeInOutCubic, easeInOutSine, easeOutCubic, linear, ThreadGenerator, useTime, waitFor} from '@motion-canvas/core';
import {
  BOTH_AT, buildPovShot, CODE_AT, ERROR_AT, FIELD_AT, GONE_AT, GONE_T, GUARD_AT, HANDLE_AT, MARK_IN, MARK_MOVE,
  AVAIL_OFF_AT, povTimeline, TAP2_AT, VIEW_AT,
} from '../core/three/povStreetShot';
import {Manticore, MorphOptions} from '../core/code/components/Manticore';
import {
  buildCanonRules, Canon, CanonCodeTheme, paintCanonMethodCalls, paintCanonMethodCallsLine,
  paintCanonParams, paintCanonParamsLine,
} from '../core/code/model/paletteCanon';
import {Screen} from '../core/theme';

// ── DON'T FIGHT DUPLICATION · глава 2 целиком (акты 5–6 PDF) ────────────────
// Ночь, дождь, улица — в кинограйде тил/янтарь (автор, 04.10; грейд уходит,
// пока телефон едет к коду). Впереди стойка — ни одного огонька. В руку
// поднимается телефон: на нём карта и карточка ближней станции «Mill Street».
// Телефон с рукой уезжает вправо, слева на нашем графите — код (графит плотный
// слева и тает в картинку справа, рука притемнена; вуаль «всё кроме телефона»
// отвергнута).
//
// Связь toView и handle показана телефоном (автор, 03.10): одна функция рисует
// кнопку, другая получает её нажатие.
//   • Тап 1 — карточка станции: страница собирается по строкам toView. Полоска
//     встаёт на строку — в тот же момент её кусок появляется на экране: plug →
//     «CCS», maxPowerKw → «· 50 kW», pricePerKwh → цена, available → «● Available»
//     и зелёная кнопка. Полоска с `available` уходит ДО нажатия Start.
//   • Яркость блоков следует за действием: пока работает toView, файл handle
//     приглушён; на нажатии Start toView гаснет, handle загорается и сразу
//     получает полоску (подсветку строк `package` автор снял); дальше проверка
//     статуса → throw, и на `throw` на телефоне выезжает «Connector unavailable».
//   • Обе строки правил сразу (оба блока в полную яркость), на телефоне — оба
//     конца противоречия.
// Разные части системы — строкой `package` у каждого файла (не подписи, не
// рамки): app.screens и charging.sessions. Оба файла — одной колонкой рядом с
// телефоном (скролл не нужен: 28 строк при кегле 22).
//
// Дальше графит выталкивает руку с телефоном вправо за кадр, на его месте —
// enum: печатается OUT_OF_ORDER → обработчик его не пускает → приложение
// спрашивает «не заряжается ли» → обе строки: система говорит две вещи.
// Развязка: каждый статус несёт `canStart`, обе строки спрашивают статус.
//
// ⚠️ Кадр POV целиком собирает core/three/povStreetShot (povTimeline —
// чистая функция времени; там же такты, общие с экраном). Стенд scratchpad/pov
// снимает тот же модуль. Звуки тапов (TAP1_AT, TAP2_AT) ставит автор.
// ⚠️ Такты сжаты для отладки (автор, 04.10: «сократи паузы») — по записи
// озвучки растянуть.

// ── Слева: два файла — экран приложения и обработчик старта ────────────────
const LEFT = `package com.chargeco.app.screens

fun Connector.toView(tariff: Tariff): ConnectorView {
    return ConnectorView(
        plug = plug.displayName,
        maxPowerKw = maxPowerKw,
        pricePerKwh = tariff.pricePerKwh(plug),
        available = status != CHARGING,
    )
}


package com.chargeco.charging.sessions

fun handle(command: StartCharging): SessionId {
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
// Развязка: оба места спрашивают статус.
const LEFT_FIX = LEFT
  .replace('available = status != CHARGING,', 'available = status.canStart,')
  .replace('if (connector.status !in setOf(AVAILABLE, FINISHING)) {', 'if (!connector.status.canStart) {');

// ── Справа (после ухода телефона): статусы ─────────────────────────────────
const RIGHT = `package com.chargeco.stations

enum class ConnectorStatus {
    AVAILABLE,
    CHARGING,
    FINISHING,
}`;
// Разъём сломался — в enum ОДНА новая строка, больше ничего не меняется.
const RIGHT_BROKEN = RIGHT.replace('    FINISHING,\n}', '    FINISHING,\n    OUT_OF_ORDER,\n}');
// Развязка: ответ «можно ли начать» несёт сам статус.
const RIGHT_RULE = RIGHT_BROKEN
  .replace('enum class ConnectorStatus {', 'enum class ConnectorStatus(val canStart: Boolean) {')
  .replace('    AVAILABLE,', '    AVAILABLE(canStart = true),')
  .replace('    CHARGING,', '    CHARGING(canStart = false),')
  .replace('    FINISHING,', '    FINISHING(canStart = true),')
  .replace('    OUT_OF_ORDER,', '    OUT_OF_ORDER(canStart = false),');

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
    'com', 'chargeco', 'app', 'screens', 'charging', 'stations',
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
// Слева 28 строк (два файла) — кегль 22, по центру кадра по высоте. Справа
// после ухода телефона — enum (8 строк после OUT_OF_ORDER), тоже по центру.
const FS = 22;
const LH = FS * 1.5;
const ADV = FS * 0.605;
const MARGIN = 96;
const WIN_H = Screen.height + 104;        // окно Manticore = кадр: морф не скроллит сам
const rows = (src: string) => src.split('\n');
const widest = (...srcs: string[]) => Math.max(...srcs.flatMap(rows).map(l => l.length)) * ADV;
const LEFT_W = widest(LEFT, LEFT_FIX);
const RIGHT_W = widest(RIGHT, RIGHT_BROKEN, RIGHT_RULE);
const LEFT_X = -Screen.width / 2 + MARGIN;
const RIGHT_X = Screen.width / 2 - MARGIN - RIGHT_W;
const LEFT_TOP = -rows(LEFT).length * LH / 2 + LH / 2;            // y первой строки
const RIGHT_TOP = -rows(RIGHT_BROKEN).length * LH / 2 + LH / 2;

// ── Такты после ухода телефона (только код) ────────────────────────────────
// ⚠️ 04.10, автор: «сократи паузы, сейчас отладка» — сжаты до действия; по
// записи озвучки растянуть заново.
const RIGHT_AT = GONE_AT + GONE_T + 0.2;  // справа проявляется enum
const B = {
  breaks: RIGHT_AT + 1.2,                 // «Then a connector breaks, so we add one status…»
  rejects: RIGHT_AT + 3.6,                // «The handler rejects it…»
  asks: RIGHT_AT + 5.4,                   // «The app asks a different question…»
  twice: RIGHT_AT + 7.2,                  // «…the system says two things at once…»
  fix: RIGHT_AT + 9.7,                    // «The fix isn't merging the app and the handler…»
  rule: RIGHT_AT + 10.3,                  // «What has to live in one place is the decision.»
  ask: RIGHT_AT + 13.8,                   // «Each status now carries its own answer…»
  end: RIGHT_AT + 17.5,                   // после «…understand one decision.»
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

  // Колонка кода: слой (проявляется целиком), под кодом — слой полосок.
  const column = (src: string, width: number, left: number, top: number, stripes: number) => {
    const layer = new Node({opacity: 0});
    view.add(layer);
    const marks = Array.from({length: stripes}, () => {
      const r = new Rect({offset: [-1, 0], height: STRIPE_H, fill: STRIPE_COLOR, radius: 0, opacity: 0});
      layer.add(r);
      return r;
    });
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
    code.node.y(top - code.getLineY(0));
    return {layer, marks, code, left, top};
  };
  type Column = ReturnType<typeof column>;

  const L = column(LEFT, LEFT_W, LEFT_X, LEFT_TOP, 2);
  // `fun Connector.toView(` — определение, хотя перед именем точка: пейнтер
  // вызовов красит его как вызов, возвращаем цвет определения.
  {
    const line = L.code.getLine(rows(LEFT).findIndex(r => r.includes('fun Connector.toView'))) as any;
    for (const tok of line.tokens) if (tok.text.trim() === 'toView') tok.ref().fill(Canon.methodDef);
  }
  const R = column(RIGHT, RIGHT_W, RIGHT_X, RIGHT_TOP, 1);
  // Яркость блоков следует за действием: пока работает toView, файл handle
  // приглушён; на нажатии Start — наоборот (автор: «сразу снимается опасити у
  // верхнего блока, мы же нижний показываем»); на двух строках правил — оба в
  // полную яркость. 0.35 на графите — буквы видны как буквы, ниже на почти
  // чёрном фоне прозрачность уже «грязнит».
  const DIM = 0.35;
  const handleFrom = rows(LEFT).findIndex(r => r.includes('package com.chargeco.charging'));
  const viewLines = rows(LEFT).map((_, i) => i).filter(i => i < handleFrom);
  const handleLines = rows(LEFT).map((_, i) => i).filter(i => i >= handleFrom);
  for (const i of handleLines) L.code.getLine(i)!.node.opacity(DIM);
  const fade = (lines: number[], v: number, dur = 0.6) => all(...lines.map(i => L.code.getLine(i)!.setOpacity(v, dur)));

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
  // Полоска `n` колонки — под строку `needle` документа `src`: первый раз
  // проявляется на месте, дальше переезжает и меняет длину.
  function* mark(c: Column, n: number, src: string, needle: string, move = MARK_MOVE): ThreadGenerator {
    const lines = rows(src);
    const i = lines.findIndex(r => r.includes(needle));
    if (i < 0) throw new Error(`нет строки: ${needle}`);
    const t = lines[i];
    const c0 = t.length - t.trimStart().length, c1 = t.trimEnd().length;
    const x = c.left + c0 * ADV - STRIPE_PAD, y = c.top + i * LH, w = (c1 - c0) * ADV + STRIPE_PAD * 2;
    const s = c.marks[n];
    if (s.opacity() < 0.01) {
      s.position([x, y]);
      s.width(w);
      yield* s.opacity(1, MARK_IN, easeInOutSine);
      return;
    }
    yield* all(s.position([x, y], move, easeInOutCubic), s.width(w, move, easeInOutCubic));
  }
  const unmark = (c: Column, n: number) => c.marks[n].opacity(0, MARK_IN, easeInOutSine);
  const AVAIL = 'available =';
  const GUARD = 'if (connector.status !in';

  function* timeline(): ThreadGenerator {
    // ── телефон справа: тап 1 — страница станции собирается по строкам toView ──
    yield* at(CODE_AT);
    yield* develop(L);
    yield* at(VIEW_AT);
    yield* mark(L, 0, LEFT, 'fun Connector.toView(');
    const fields = ['plug = plug', 'maxPowerKw = maxPowerKw', 'pricePerKwh =', AVAIL];
    for (let i = 0; i < fields.length; i++) {
      yield* at(FIELD_AT[i]);              // тот же момент — кусок появляется на экране
      yield* mark(L, 0, LEFT, fields[i]);
    }

    // подсветка `available` уходит ДО нажатия Start
    yield* at(AVAIL_OFF_AT);
    yield* unmark(L, 0);

    // ── тап 2 — Start: нажатие уходит в другую часть системы ──
    // на нажатии toView гаснет, handle загорается, и сразу — полоска на handle
    yield* at(TAP2_AT);
    yield* all(
      fade(viewLines, DIM),
      fade(handleLines, 1),
      delay(HANDLE_AT - TAP2_AT, mark(L, 0, LEFT, 'fun handle(')),
    );
    yield* at(GUARD_AT);
    yield* mark(L, 0, LEFT, GUARD);
    yield* at(ERROR_AT);                   // тот же момент — лист ошибки на телефоне
    yield* mark(L, 0, LEFT, 'throw ConnectorUnavailable');
    // два места, две формы одного правила; на телефоне — оба конца противоречия
    yield* at(BOTH_AT);
    yield* all(fade(viewLines, 1, 0.5), mark(L, 0, LEFT, AVAIL), mark(L, 1, LEFT, GUARD));

    // ── графит выталкивает телефон, справа — статусы ──
    yield* at(GONE_AT);
    yield* all(unmark(L, 0), unmark(L, 1));
    yield* at(RIGHT_AT);
    yield* develop(R);
    // разъём сломался: один новый статус
    yield* at(B.breaks);
    yield* R.code.morphTo(RIGHT_BROKEN, INSERT);
    yield* mark(R, 0, RIGHT_BROKEN, 'OUT_OF_ORDER,');
    // обработчик его не пускает: новый статус и правило обработчика — вместе
    yield* at(B.rejects);
    yield* mark(L, 0, LEFT, GUARD);
    // приложение спрашивает другое
    yield* at(B.asks);
    yield* mark(L, 0, LEFT, AVAIL);
    // система говорит две вещи сразу
    yield* at(B.twice);
    yield* all(unmark(R, 0), mark(L, 1, LEFT, GUARD));

    // ── развязка: ответ живёт в статусе, оба места его спрашивают ──
    yield* at(B.fix);
    yield* all(unmark(L, 0), unmark(L, 1));
    yield* at(B.rule);
    yield* R.code.morphTo(RIGHT_RULE, EDIT);
    yield* at(B.ask);
    yield* all(mark(L, 0, LEFT, AVAIL), mark(L, 1, LEFT, GUARD));
    yield* all(
      L.code.morphTo(LEFT_FIX, {...EDIT, blockOrder: 'parallel'}),
      mark(L, 0, LEFT_FIX, AVAIL, 0.9),
      mark(L, 1, LEFT_FIX, 'if (!connector.status.canStart)', 0.9),
    );
    yield* at(B.end);
  }

  yield* all(clock(B.end, B.end, linear), timeline());
});
