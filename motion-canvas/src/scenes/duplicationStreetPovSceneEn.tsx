import {blur, makeScene2D, Node, Rect} from '@motion-canvas/2d';
import {all, createSignal, easeInOutSine, easeOutCubic, linear, ThreadGenerator, useTime, waitFor} from '@motion-canvas/core';
import {buildPovShot, POV_DURATION, povTimeline, SIDE_AT, SIDE_T} from '../core/three/povStreetShot';
import {Manticore} from '../core/code/components/Manticore';
import {buildCanonRules, Canon, CanonCodeTheme, paintCanonMethodCalls, paintCanonParams} from '../core/code/model/paletteCanon';
import {Screen} from '../core/theme';

// ── DON'T FIGHT DUPLICATION · глава 2, кадр от первого лица ─────────────────
// Ночь, дождь, улица. Впереди стойка — ни одного огонька. За ней наша Honda e.
// В руку поднимается телефон: приложение говорит «Available» и даёт зелёную
// кнопку. Большой палец жмёт «Start charging» → «Starting…» → снизу выезжает
// «Connector unavailable». Статус «Available» наверху при этом остаётся:
// приложение одновременно говорит «свободна» и «недоступна».
//
// ── Продолжение (28.09, идея автора) ────────────────────────────────────────
// «Телефон в руке уходит вправо (с момента, где он выделен и фон заблюрен),
// экран делится на две части, можно зазумить немного, а слева код». Раньше
// после ошибки фокус уходил обратно на мёртвую стойку, и была склейка; теперь
// фокус остаётся на телефоне, телефон с рукой уезжает вправо и чуть ближе,
// левая половина фона уходит в тень (под слоем руки — телефон её не получает),
// и слева проявляется код запроса экрана. На экране уже оба конца
// противоречия: «Available» (запрос) и лист «Connector unavailable»
// (обработчик) — код объясняет ровно то, что справа.
//   • Код запроса — продуктовый, тот же, что в сцене с карточкой (она отменена:
//     копировала экран из POV, а здесь это сам телефон). Полоска-канон идёт по
//     полям в порядке экрана: name → «Mill Street», label → «Connector 2»,
//     plug + maxPowerKw → «CCS · 50 kW», pricePerKwh → «0.39 € / kWh»,
//     последним available → «Available». На экране ничего не подсвечивается —
//     он уже показан, глаз сам находит своё.
//   • Кегль 20: 26 строк = 780 px — почти ровно высота телефона в кадре;
//     верхняя кромка кода на уровне верха телефона.
// Дальше (часть 2, после согласования): обработчик — откуда «Connector
// unavailable».
//
// ⚠️ Кадр целиком собирает core/three/povStreetShot: мир, рука, экран,
// объектив И РАСКАДРОВКА (povTimeline — чистая функция времени). Сцена только
// ведёт часы и кладёт код. Тот же модуль снимает стенд scratchpad/pov без
// редактора, поэтому проверенное там и есть то, что здесь в кадре.
// ⚠️ Звук тапа (ES «User Interface … Phone Tap») ставит автор — касание
// стекла приходится на TAP_AT (5.1 с).
// ⚠️ Такты кода стоят на глаз — переставить по записи озвучки.

// ── Код запроса экрана ──────────────────────────────────────────────────────
const QUERY = `class StationScreenQuery(
    private val stations: StationRepository,
    private val tariffs: TariffCatalog,
) {

    fun load(stationId: StationId, driverId: DriverId): StationScreen {
        val station = stations.get(stationId)
        val tariff = tariffs.forDriver(driverId, station.operator)

        return StationScreen(
            name = station.name,
            connectors = station.connectors.map { it.toView(tariff) },
        )
    }

    private fun Connector.toView(tariff: Tariff): ConnectorView {
        return ConnectorView(
            id = id.value,
            label = "Connector $number",
            plug = plug.displayName,
            maxPowerKw = maxPowerKw,
            pricePerKwh = tariff.pricePerKwh(plug),
            available = status != CHARGING,
        )
    }
}`;
const TYPES = [
  'StationScreenQuery', 'StationRepository', 'TariffCatalog', 'StationId', 'DriverId',
  'StationScreen', 'Connector', 'Tariff', 'ConnectorView',
];
const RULES = buildCanonRules({
  types: TYPES,
  methods: ['load', 'toView'],
  vars: [
    'stations', 'tariffs', 'station', 'tariff', 'stationId', 'driverId', 'operator',
    'connectors', 'value', 'number', 'plug', 'displayName', 'maxPowerKw', 'status', 'it', 'id',
  ],
});

// ── Геометрия кода ──────────────────────────────────────────────────────────
// Телефон после ухода вправо — x ~1255..1700, y ~190..950 (стенд, кадр 12 с).
// Код слева: поле 110 px, верх — на уровне верха телефона.
const FS = 20;
const LH = FS * 1.5;
const ADV = FS * 0.605;
const WIN_H = Screen.height + 104;        // окно Manticore = кадр: морф не скроллит сам
const ROWS = QUERY.split('\n');
const CODE_W = Math.max(...ROWS.map(l => l.length)) * ADV;
const CODE_LEFT = -Screen.width / 2 + 110;
const CODE_TOP = -Screen.height / 2 + 190;             // оптический верх = верх телефона
const TOP_LINE_Y = CODE_TOP + LH / 2;
const lineOf = (needle: string): number => {
  const i = ROWS.findIndex(r => r.includes(needle));
  if (i < 0) throw new Error(`нет строки: ${needle}`);
  return i;
};

// ── Такты кода (время сцены = время POV) ────────────────────────────────────
const CODE_AT = SIDE_AT + SIDE_T - 0.4;   // код проявляется, пока телефон садится
const READ_AT = CODE_AT + 1.4;            // первая полоска — кадр уже стоит
const READ_STEP = 2.0;

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

  // ── код слева ──
  const codeLayer = new Node({opacity: 0});
  view.add(codeLayer);
  const stripes = new Node({});
  codeLayer.add(stripes);                  // полоски — под кодом
  const code = Manticore.create(QUERY, {
    x: 0, y: 0, width: CODE_W + 240, height: WIN_H, fontSize: FS, lineHeight: LH,
    theme: CanonCodeTheme, glowAccent: false, customTypes: TYPES,
    cardStyle: {fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)', radius: 0, edge: false},
    noClip: true,
  });
  code.mount(codeLayer);
  code.colorize(RULES);
  paintCanonMethodCalls(code);
  paintCanonParams(code);                  // именованные аргументы — цветом полей
  // `private fun Connector.toView(` — определение, хотя перед именем точка:
  // пейнтер вызовов красит его как вызов, возвращаем цвет определения.
  {
    const line = code.getLine(lineOf('private fun Connector.toView')) as any;
    for (const tok of line.tokens) if (tok.text.trim() === 'toView') tok.ref().fill(Canon.methodDef);
  }
  code.node.opacity(1);
  code.node.x(CODE_LEFT - code.getLeftEdge());
  code.node.y(TOP_LINE_Y - code.getLineY(0));

  // Полоска-канон: роуз 0.18, 1.15 строки, углы острые, по длине текста строки.
  const stripe = (i: number): Rect => {
    const t = ROWS[i];
    const c0 = t.length - t.trimStart().length;
    const r = new Rect({
      x: CODE_LEFT + c0 * ADV - 10, y: TOP_LINE_Y + i * LH, offset: [-1, 0],
      width: (t.length - c0) * ADV + 20, height: LH * 1.15,
      radius: 0, fill: 'rgba(255, 80, 120, 0.18)', opacity: 0,
    });
    stripes.add(r);
    return r;
  };

  function* at(t: number) {
    const dt = t - useTime();
    if (dt > 0) yield* waitFor(dt);
  }
  const MARK = 0.45;
  let lit: Rect[] = [];
  function* read(needles: string[]): ThreadGenerator {
    const next = needles.map(n => stripe(lineOf(n)));
    yield* all(...lit.map(r => r.opacity(0, MARK, easeInOutSine)), ...next.map(r => r.opacity(1, MARK, easeInOutSine)));
    lit = next;
  }

  function* codeTimeline(): ThreadGenerator {
    // Код проявляется целиком, одним фокусом, пока телефон садится справа.
    yield* at(CODE_AT);
    const open = blur(10);
    codeLayer.filters([open]);
    yield* all(codeLayer.opacity(1, 1.0, easeOutCubic), open.value(0, 1.1, easeInOutSine));
    codeLayer.filters([]);
    // Поля — в порядке экрана справа.
    yield* at(READ_AT);
    yield* read(['name = station.name']);
    yield* at(READ_AT + READ_STEP);
    yield* read(['label =']);
    yield* at(READ_AT + READ_STEP * 2);
    yield* read(['plug = plug', 'maxPowerKw = maxPowerKw']);
    yield* at(READ_AT + READ_STEP * 3);
    yield* read(['pricePerKwh =']);
    // Последним — флаг: «доступно» = «не заряжается». Отсюда «Available».
    yield* at(READ_AT + READ_STEP * 4);
    yield* read(['available =']);
  }

  yield* all(clock(POV_DURATION, POV_DURATION, linear), codeTimeline());
});
