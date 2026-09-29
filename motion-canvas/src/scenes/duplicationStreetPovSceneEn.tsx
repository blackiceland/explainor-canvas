import {blur, makeScene2D, Node, Rect} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, easeInOutSine, easeOutCubic, linear, ThreadGenerator, useTime, waitFor} from '@motion-canvas/core';
import {
  buildPovShot, CODE_AT, FIELD_PARTS, FIELDS_AT, FIELDS_STEP, OVERVIEW_AT, OVERVIEW_COUNT,
  OVERVIEW_STEP, POINTER_T, POV_DURATION, povTimeline,
} from '../core/three/povStreetShot';
import {POINTER_PINK} from '../core/three/chargeAppUi';
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
//     копировала экран из POV, а здесь это сам телефон).
//   • РОЗОВЫЙ УКАЗАТЕЛЬ (автор, 29.09: «пора вводить указатель розовый слева
//     от строки кода, чтобы не пачкать его и не затемнять, и десяток секунд
//     уделять на то, чтобы рассказать зрителю, что делает код»). Тонкая
//     вертикальная розовая полоска в поле слева от кода, высотой в строку,
//     углы острые; между строками переезжает плавно — её путь и есть ход
//     чтения. Код не гаснет и не пачкается. Такая же полоска на экране
//     телефона — слева от куска, который рисует поле: «эта строка — вот эти
//     пиксели». Два этапа:
//       1. обзор (~10 с): класс → load → станция → тариф водителя → каждый
//          разъём в вид;
//       2. поля ↔ экран: name → «Mill Street», label → «Post 3 · Connector 2»,
//          plug + maxPowerKw → «CCS · 50 kW», pricePerKwh → «0.39 € / kWh»,
//          последним available → «● Available».
//     Такты — одна таблица в povStreetShot (OVERVIEW_*, FIELDS_*): указатели в
//     коде и на экране не могут разойтись.
//     Отменено по дороге: полоска-канон под строкой (первая версия) и гашение
//     остального кода и экрана до 0.3 («код затемняется до того, как зритель
//     успеет его прочесть»).
//   • label = "Post ${post.number} · Connector $number" — строка даёт ровно
//     то, что на экране; при указателе расхождение бросилось бы в глаза.
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
            label = "Post \${post.number} · Connector $number",
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
    'connectors', 'value', 'number', 'plug', 'displayName', 'maxPowerKw', 'status', 'it', 'id', 'post',
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

// ── Такты (время сцены = время POV) — из povStreetShot, общие с экраном ─────
// Этап 1 — обзор: указатель идёт по коду за голосом, что делает запрос.
const OVERVIEW_LINES: string[][] = [
  ['class StationScreenQuery('],                       // запрос экрана станции
  ['fun load('],                                       // грузит экран для станции и водителя
  ['val station = stations.get'],                      // берёт станцию
  ['val tariff = tariffs.forDriver'],                  // тариф — по договору водителя
  ['connectors = station.connectors.map'],             // каждый разъём — в вид
];
// Этап 2 — поля ↔ куски экрана (FIELD_PARTS), в том же порядке.
const FIELD_LINES: string[][] = [
  ['name = station.name'],
  ['label ='],
  ['plug = plug', 'maxPowerKw = maxPowerKw'],
  ['pricePerKwh ='],
  ['available ='],
];
if (OVERVIEW_LINES.length !== OVERVIEW_COUNT || FIELD_LINES.length !== FIELD_PARTS.length) {
  throw new Error('такты кода и экрана разошлись');
}
// Указатель — тонкая розовая полоска в поле слева от кода, углы острые.
const POINTER_W = 4;
const POINTER_GAP = 22;                   // от левого края текста
const POINTER_H = LH * 0.8;               // высота на одну строку

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

  // ── указатель у строки ──
  // Полоска стоит в поле слева от кода; для нескольких строк вытягивается на
  // все. Код при этом не гаснет и не пачкается.
  const pointer = new Rect({
    x: CODE_LEFT - POINTER_GAP, width: POINTER_W, offset: [1, 0],
    height: POINTER_H, fill: POINTER_PINK, radius: 0, opacity: 0,
  });
  codeLayer.add(pointer);
  const span = (needles: string[]) => {
    const idx = needles.map(lineOf);
    const i0 = Math.min(...idx), i1 = Math.max(...idx);
    return {y: TOP_LINE_Y + (i0 + i1) / 2 * LH, h: (i1 - i0) * LH + POINTER_H};
  };

  function* at(t: number) {
    const dt = t - useTime();
    if (dt > 0) yield* waitFor(dt);
  }
  // Указатель к строкам: первый раз проявляется на месте, дальше переезжает.
  function* point(needles: string[]): ThreadGenerator {
    const s = span(needles);
    if (pointer.opacity() < 0.01) {
      pointer.y(s.y);
      pointer.height(s.h);
      yield* pointer.opacity(1, POINTER_T, easeInOutSine);
      return;
    }
    yield* all(pointer.y(s.y, POINTER_T, easeInOutCubic), pointer.height(s.h, POINTER_T, easeInOutCubic));
  }

  function* codeTimeline(): ThreadGenerator {
    // Код проявляется целиком, одним фокусом, пока телефон садится справа.
    yield* at(CODE_AT);
    const open = blur(10);
    codeLayer.filters([open]);
    yield* all(codeLayer.opacity(1, 1.0, easeOutCubic), open.value(0, 1.1, easeInOutSine));
    codeLayer.filters([]);
    // Этап 1: обзор — что делает запрос.
    for (let i = 0; i < OVERVIEW_LINES.length; i++) {
      yield* at(OVERVIEW_AT + i * OVERVIEW_STEP);
      yield* point(OVERVIEW_LINES[i]);
    }
    // Этап 2: поля ↔ экран; тот же такт ставит указатель на экране
    // (povStreetShot). Последним — флаг: «доступно» = «не заряжается».
    for (let i = 0; i < FIELD_LINES.length; i++) {
      yield* at(FIELDS_AT + i * FIELDS_STEP);
      yield* point(FIELD_LINES[i]);
    }
  }

  yield* all(clock(POV_DURATION, POV_DURATION, linear), codeTimeline());
});
