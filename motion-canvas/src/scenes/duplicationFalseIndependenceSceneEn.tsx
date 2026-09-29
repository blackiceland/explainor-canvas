import {blur, Circle, Line, makeScene2D, Node, Rect, Txt} from '@motion-canvas/2d';
import {all, easeInOutSine, easeOutCubic, ThreadGenerator, useTime, waitFor} from '@motion-canvas/core';
import {Manticore} from '../core/code/components/Manticore';
import {buildCanonRules, Canon, CanonCodeTheme, paintCanonMethodCalls, paintCanonParams} from '../core/code/model/paletteCanon';
import {Screen} from '../core/theme';
import {applyBackground} from '../core/utils';

// ── DON'T FIGHT DUPLICATION · глава 2 (SYNC COST): ложная независимость ─────
// Сюжет: Dont_Fight_Duplication_final.pdf, акт 5. Идёт сразу после POV под
// дождём и объясняет его: почему приложение сказало «Available», а нажатие
// кончилось «Connector unavailable». Правило «можно ли начать зарядку на этом
// разъёме» живёт в двух местах: в запросе экрана станции (`status !=
// CHARGING`) и в обработчике команды (`in AVAILABLE, FINISHING`).
//
// ── Четвёртая версия (28.09), ЧАСТЬ 1: запрос экрана = экран из POV ─────────
// Автор: «сначала надо показать только код слева; его имеет смысл
// визуализировать, чтобы зритель понял, что происходит» — и «да» на мой ответ:
// визуализация уже есть, это экран из POV. Каждое поле запроса — кусок экрана.
//   • Слева один код запроса. Справа карточка экрана приложения — тот же экран,
//     что был в руке под дождём (раскладка в миллиметрах из chargeAppUi,
//     цвета и шрифт оттуда же). Карточка по канону пары «код + продуктовая
//     панель» (whatsappCodePairSceneEn): тёмная панель, скругление, мягкая
//     тень; высота карточки = высота кода, верхняя кромка общая.
//   • Экран собирается из полей по мере чтения: полоска на строке поля →
//     на экране проявляется его кусок. name → «Mill Street», label →
//     «Connector 2», plug + maxPowerKw → «CCS · 50 kW», pricePerKwh →
//     «0.39 € / kWh», последним available → «● Available» и кнопка.
//   • Вид неподвижен, ни сетки, ни камеры (автор: «всё должно быть на одном
//     фрейме»); полоска — канон (роуз 0.18, 1.15 строки, углы острые).
// Отменено по дороге (не возвращать): файлы на карте с камерой и сеткой (v2),
// расфокус как выделение (v3: «странные выделения, ничего не понятно»), улица с
// машиной и карточкой над ней (v1). Копии — scratchpad/ch2/.
// Дальше (часть 2, после согласования): нажатие отправляет команду, слева код
// сменяется обработчиком, экран справа остаётся.
// ⚠️ Озвучки нет, такты на глаз.

// ── Код ─────────────────────────────────────────────────────────────────────
// Пустые строки — между логическими блоками, как принято (автор): после
// заголовка класса и перед return.
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

// ── Геометрия ───────────────────────────────────────────────────────────────
// Кегль 24: код один, место есть — крупнее, чем 20 в главе 1 (смотрят с
// телефонов). 26 строк = 936 px, самая длинная строка (70 знаков) = 1016 px.
// Карточка: высота = высота кода, ширина — по пропорции экрана телефона из POV
// (61.4 × 135.5 мм) → 424 px. Между кодом и карточкой 140 px, поля по 170.
const FS = 24;
const LH = FS * 1.5;
const ADV = FS * 0.605;
const WIN_H = Screen.height + 104;        // окно Manticore = кадр: морф не скроллит сам
const ROWS = QUERY.split('\n');
const CODE_W = Math.max(...ROWS.map(l => l.length)) * ADV;
const CODE_H = ROWS.length * LH;
const PHONE = {w: 61.4, h: 135.5};         // мм — экран телефона из POV (chargeAppUi)
const K = CODE_H / PHONE.h;                // px на мм
const CARD_W = PHONE.w * K;
const CARD_H = CODE_H;
const GAP = 140;
const CODE_LEFT = -(CODE_W + GAP + CARD_W) / 2;
const CARD_X = CODE_LEFT + CODE_W + GAP + CARD_W / 2;
const TOP_LINE_Y = -CODE_H / 2 + LH / 2;  // центр первой строки; верх кода = верх карточки

const lineOf = (needle: string): number => {
  const i = ROWS.findIndex(r => r.includes(needle));
  if (i < 0) throw new Error(`нет строки: ${needle}`);
  return i;
};
const L_NAME = lineOf('name = station.name');
const L_LABEL = lineOf('label =');
const L_PLUG = lineOf('plug = plug');
const L_POWER = lineOf('maxPowerKw = maxPowerKw');
const L_PRICE = lineOf('pricePerKwh =');
const L_AVAILABLE = lineOf('available =');

// ── Экран приложения: цвета и шрифт — из chargeAppUi (POV) ──────────────────
const APP = {
  bg: '#0B0E13', text: '#F3F5F7', muted: '#8B94A1', faint: '#5B636E',
  green: '#4ADE80', greenInk: '#06140B',
};
const APP_FONT = 'Manrope';
const mm = (v: number) => v * K;
const lx = (v: number) => mm(v) - CARD_W / 2;            // мм от левого края → локальный x
const ly = (v: number) => mm(v) - CARD_H / 2;            // мм от верха → локальный y
const baseline = (yMm: number, sizeMm: number) => ly(yMm) - mm(sizeMm) * 0.35;

export default makeScene2D(function* (view) {
  applyBackground(view);
  yield (document as any).fonts.load(`700 60px ${APP_FONT}`);
  yield (document as any).fonts.load(`400 30px ${APP_FONT}`);

  const stage = new Node({opacity: 0});
  view.add(stage);

  // ── полоски — под кодом ──
  const stripes = new Node({});
  stage.add(stripes);

  // ── код ──
  const code = Manticore.create(QUERY, {
    x: 0, y: 0, width: CODE_W + 240, height: WIN_H, fontSize: FS, lineHeight: LH,
    theme: CanonCodeTheme, glowAccent: false, customTypes: TYPES,
    cardStyle: {fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)', radius: 0, edge: false},
    noClip: true,
  });
  code.mount(stage);
  code.colorize(RULES);
  paintCanonMethodCalls(code);
  paintCanonParams(code);                  // именованные аргументы — цветом полей
  // `private fun Connector.toView(` — определение, хотя перед именем точка, а не
  // `fun`: пейнтер вызовов красит его как вызов, возвращаем цвет определения.
  {
    const line = code.getLine(lineOf('private fun Connector.toView')) as any;
    for (const tok of line.tokens) if (tok.text.trim() === 'toView') tok.ref().fill(Canon.methodDef);
  }
  code.node.opacity(1);
  code.node.x(CODE_LEFT - code.getLeftEdge());
  code.node.y(TOP_LINE_Y - code.getLineY(0));

  const stripe = (i: number): Rect => {
    const t = ROWS[i];
    const c0 = t.length - t.trimStart().length;
    const r = new Rect({
      x: CODE_LEFT + c0 * ADV - 12, y: TOP_LINE_Y + i * LH, offset: [-1, 0],
      width: (t.length - c0) * ADV + 24, height: LH * 1.15,
      radius: 0, fill: 'rgba(255, 80, 120, 0.18)', opacity: 0,
    });
    stripes.add(r);
    return r;
  };

  // ── карточка экрана ──
  const card = new Rect({
    x: CARD_X, width: CARD_W, height: CARD_H, radius: mm(6),
    fill: APP.bg, stroke: 'rgba(255,255,255,0.04)', lineWidth: 1,
    shadowColor: 'rgba(0,0,0,0.45)', shadowBlur: 36, shadowOffset: [-10, 16],
    clip: true,
  });
  stage.add(card);
  // Текст экрана — по левому краю, по базовой линии (как в chargeAppUi).
  const text = (t: string, xMm: number, yMm: number, sizeMm: number, fill: string, weight = 400) =>
    new Txt({
      text: t, fontFamily: APP_FONT, fontWeight: weight, fontSize: mm(sizeMm), fill,
      x: lx(xMm), y: baseline(yMm, sizeMm), offset: [-1, 0],
    });

  // Хром телефона — приходит вместе с карточкой: время, сеть, батарея, «домой».
  card.add(text('21:47', 4.6, 6.0, 3.3, APP.text, 700));
  for (let i = 0; i < 4; i++) {
    const bh = 1.1 + i * 0.55;
    card.add(new Rect({
      x: lx(43.2 + i * 1.25 + 0.4), y: ly(6.0 - bh / 2), width: mm(0.8), height: mm(bh),
      radius: mm(0.25), fill: i < 3 ? APP.text : APP.faint,
    }));
  }
  card.add(new Rect({x: lx(49.6 + 2.8), y: ly(3.3 + 1.4), width: mm(5.6), height: mm(2.8),
    radius: mm(0.7), fill: 'rgba(243,245,247,0.32)'}));
  card.add(new Rect({x: lx(49.9 + 1.6), y: ly(3.6 + 1.1), width: mm(3.2), height: mm(2.2),
    radius: mm(0.5), fill: APP.text}));
  card.add(new Rect({x: lx(20.2 + 10.5), y: ly(131.2 + 0.62), width: mm(21), height: mm(1.25),
    radius: mm(0.62), fill: 'rgba(243,245,247,0.85)'}));

  // Куски экрана — каждый проявляется, когда прочитано его поле.
  const piece = (...nodes: Node[]) => {
    const g = new Node({opacity: 0});
    const f = blur(8);
    g.filters([f]);
    nodes.forEach(n => g.add(n));
    card.add(g);
    return {g, f};
  };
  const header = piece(
    new Line({points: [[lx(7.6), ly(13.0)], [lx(5.6), ly(15.2)], [lx(7.6), ly(17.4)]],
      stroke: APP.text, lineWidth: mm(0.55), lineCap: 'round', lineJoin: 'round'}),
    text('Mill Street', 10.4, 16.7, 4.3, APP.text, 700),
  );
  const label = piece(text('Connector 2', 6.0, 30.0, 3.4, APP.muted));
  const plugPower = piece(text('CCS  ·  50 kW', 6.0, 51.0, 3.6, APP.text));
  const price = piece(text('0.39 € / kWh', 6.0, 56.6, 3.4, APP.muted));
  const B = {x: 4.7, y: 79.53, w: 52.0, h: 13.0};
  const available = piece(
    new Circle({x: lx(7.7), y: ly(38.6), size: mm(3.1), fill: APP.green}),
    text('Available', 11.2, 41.4, 8.2, APP.text, 700),
    new Rect({x: lx(B.x + B.w / 2), y: ly(B.y + B.h / 2), width: mm(B.w), height: mm(B.h),
      radius: mm(B.h / 2), fill: APP.green}),
    new Txt({text: 'Start charging', fontFamily: APP_FONT, fontWeight: 700, fontSize: mm(4.6),
      fill: APP.greenInk, x: lx(B.x + B.w / 2), y: ly(B.y + B.h / 2)}),
  );
  const show = (p: {g: Node; f: any}) =>
    all(p.g.opacity(1, 0.55, easeOutCubic), p.f.value(0, 0.6, easeInOutSine));

  // ═══ ТАЙМЛАЙН (черновой: такты на глаз, до записи озвучки) ═════════════
  function* at(t: number) {
    const dt = t - useTime();
    if (dt > 0) yield* waitFor(dt);
  }
  const MARK = 0.45;
  const mark = (r: Rect, v: number) => r.opacity(v, MARK, easeInOutSine);
  // Чтение поля: полоска переходит на его строку, на экране проявляется кусок.
  let lit: Rect[] = [];
  function* read(lineIdx: number[], p: {g: Node; f: any}): ThreadGenerator {
    const next = lineIdx.map(stripe);
    yield* all(...lit.map(r => mark(r, 0)), ...next.map(r => mark(r, 1)), show(p));
    lit = next;
  }

  // 0. После склейки с POV код и экран проявляются вместе, одним фокусом.
  const open = blur(10);
  stage.filters([open]);
  yield* all(stage.opacity(1, 1.0, easeOutCubic), open.value(0, 1.2, easeInOutSine));
  stage.filters([]);

  yield* at(2.0);
  yield* read([L_NAME], header);
  yield* at(4.2);
  yield* read([L_LABEL], label);
  yield* at(6.4);
  yield* read([L_PLUG, L_POWER], plugPower);
  yield* at(8.6);
  yield* read([L_PRICE], price);
  // Последним — флаг: «доступно» = «не заряжается». Отсюда и зелёное
  // «Available», и активная кнопка.
  yield* at(10.8);
  yield* read([L_AVAILABLE], available);
  yield* at(14.5);
});
