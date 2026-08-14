import {Circle, Line, Node, Path, Rect, Txt, blur, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  chain,
  createRef,
  createSignal,
  easeInCubic,
  easeInOutCubic,
  easeInOutSine,
  easeOutCubic,
  linear,
  waitFor,
  Vector2,
} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Fonts} from '../core/theme';
import {Manticore} from '../core/code/components/Manticore';
import {
  Canon,
  CanonCodeTheme,
  buildCanonRules,
  paintCanonMethodCalls,
} from '../core/code/model/paletteCanon';
import {
  COAST_EU,
  COAST_GB,
  COAST_IE,
  COAST_US,
  GRID_X,
  GRID_Y,
  LAND_EU,
  LAND_US,
  MAP_H,
  MAP_W,
  P_JFK,
  P_LHR,
  ROUTE,
  ROUTE_LL,
} from './atlanticGeo';

// ═══════════════════════════════════════════════════════════════════════
// ГЛАВА 1 «NO SIGNAL» · СТЕНД №1 И ДРЕЙФ КОНТРАКТА.
//
// Первая сцена главы. Дуга: наш вопрос возвращается уже другим → он уходит,
// и на его месте открывается продукт (карта трекера рейсов) → продукт
// отступает вправо и рядом встаёт механизм (контракт) → контракт дрейфует
// три года, а его сигнатура не меняется ни на символ → борт пропадает →
// и оказывается, что он не один: пять рейсов с одинаковым NO SIGNAL, пять
// разных причин снаружи экрана, и все они схлопываются в одно слово.
//
// ⚠️ ДОМЕН ВСЕГО РОЛИКА — отслеживание рейсов (сценарий V2, заменил камеры).
//    Продакшн-причина: карта, дуга, борт и табло целиком собираются из линий
//    и текста — ни видеофидов, ни нейрогенерации. Смысловая: «борт исчез над
//    океаном» — знакомый страх, а правда за пустым экраном безобидна.
//
// ⚠️ КАРТЫ В ПРОЕКТЕ НЕ БЫЛО — это новый визуальный словарь. Поэтому
//    география НАСТОЯЩАЯ и посчитана офлайн (`_atlantic_geo.mjs` →
//    `atlanticGeo.ts`): Меркатор, реальные берега, дуга большого круга
//    JFK→LHR, и координаты в панели — тоже настоящие, а не декоративные.
//    Рейс BA 117 существует и летает этим маршрутом.
//
// ⚠️ Цвет = состояние (канон): голубой Canon.keyword означает «сигнал есть».
//    Пройденный след горит им, будущий путь — кремовый почти в ноль. Когда
//    в следующей сцене сигнал пропадёт, гаснуть будет ИМЕННО этот цвет.
// ═══════════════════════════════════════════════════════════════════════

const MONO = Fonts.code;

// ── вопрос ──────────────────────────────────────────────────────────────
// ⚠️ Реприза коды акта 1: там глава закрылась розовым `Can it be missing?`.
// Здесь та же краска задаёт следующий вопрос — и это ОДНА строка через два
// состояния, а не две разные надписи. Обе фразы ровно 18 моношироких знаков
// и слова стоят в одних слотах:
//     C a n _ i t _ b e _ m i s s i n g ?
//     W h y _ i s _ i t _ m i s s i n g ?
// поэтому `missing?` НЕ ДВИГАЕТСЯ — переживший элемент не трогаем (канон),
// а меняются только три первых слова, и меняются ОДНИМ движением через
// расфокус: постадийный вход слов читался бы стоковой библиотекой.
// ⚠️ Вопрос стоит В ЦЕНТРЕ КАДРА и уходит ДО продукта: он не подпись над
// картой, а отдельный кадр — сначала вопрос, потом то, о чём он.
const ASK_FS = 60;
const ASK_ADV = ASK_FS * 0.6;
const SOFT_PINK = 'rgba(236, 189, 200, 0.95)';
const ASK_SLOTS: [number, string, string][] = [
  [0, 'Can', 'Why'],
  [4, 'it', 'is'],
  [7, 'be', 'it'],
];
const ASK_TAIL = 'missing?';
const ASK_TAIL_SLOT = 10;
const ASK_LEN = 18;
const ASK_Y = -12;                   // оптический центр — чуть выше геометрии
const ASK_IN = 0.8;
const ASK_HOLD = 2.2;                // ⚠️ VO
const ASK_SWAP = 0.85;
const ASK_READ = 2.4;                // ⚠️ VO
const ASK_OUT = 1.0;
const ASK_GAP = 0.3;                 // тьма между вопросом и продуктом

// ── карта ───────────────────────────────────────────────────────────────
const MAP_Y = 46;
// карта УТОПЛЕНА в фон (темнее его), а не наклеена на него: глубина слоями —
// это то, что отличает продуктовый UI от плоской фигуры
const MAP_FILL = 'rgba(0,0,0,0.22)';
const MAP_EDGE = 'rgba(244,241,235,0.09)';
const MAP_HAIR = 'rgba(244,241,235,0.07)';       // разделители хедера и футера
const MAP_RADIUS = 18;
// ⚠️ Плотности подняты после первого прогона: на кадре берега почти не
// читались, а на телефоне исчезли бы совсем. Карта всё равно остаётся тише
// трассы — иерархия «данные важнее подложки» не нарушена.
const GRID_C = 'rgba(244,241,235,0.075)';
const COAST_C = 'rgba(244,241,235,0.30)';
const COAST_W = 1.6;
// суша чуть светлее воды — ровно настолько, чтобы кадр читался картой
const LAND_C = 'rgba(244,241,235,0.038)';

const SIGNAL = Canon.keyword;                    // #A3CDFF — «сигнал есть»
const TRACK_DONE = 'rgba(163,205,255,0.72)';
const TRACK_AHEAD = 'rgba(244,241,235,0.15)';
const PORT_C = 'rgba(244,241,235,0.52)';
const PLANE_S = 1.4;

const INK = 'rgba(244,241,235,0.96)';
const SOFT = 'rgba(244,241,235,0.52)';
const DIM = 'rgba(244,241,235,0.40)';

const MAP_IN = 1.5;
const MAP_BLUR = 14;
const MAP_READ = 3.4;                // ⚠️ VO — знакомство с продуктом

// кадрировка под код: окно СУЖАЕТСЯ, а карта внутри остаётся в масштабе 1:1
// ⚠️ Так честнее уменьшения: в настоящем приложении карта не сжимается при
// изменении окна — она кадрируется. И борт остаётся того же размера, то есть
// читаемым на телефоне.
// ⚠️ Пан подобран по числам генератора, не на глаз: при этом прогрессе борт
// стоит около x=−210, Британия занимает 500…631, Лондон 592. При сдвиге −200
// в окно попадает и борт (слева), и берег с целью маршрута (справа) — то есть
// кадр сам говорит «летит туда», и для этого ничего не надо подписывать.
const WIN_C = 860;
const MAP_X_C = 482;
const CONTENT_DX_C = -200;
// ⚠️ И вниз тоже: в узком окне борт с дугой уходили в верхнюю треть, а под
// ними оставалось поле пустой воды. Трасса на этом участке идёт по y≈−100,
// так что сдвиг ставит её ровно в середину окна.
const CONTENT_DY_C = 105;
const FRAME_MOVE = 1.4;

// ── полёт ───────────────────────────────────────────────────────────────
// ⚠️⚠️ БОРТ ИДЁТ РОВНО. Пробовал шаг отсчётами (точка принятого фикса впереди
// → борт подтягивается → стоит) — ОТВЕРГНУТО автором, и он прав по существу:
// главное событие главы — ПРОПАЖА борта, а замирание между фиксами выглядит
// ровно так же, как замирание от потери сигнала. Ритм, который сам по себе
// останавливает борт, крадёт у кульминации её единственный жест. Ровный полёт
// здесь — нейтральный фон, на котором обрыв читается однозначно. Не возвращать.
// ⚠️ PROG_FROM подобран под КАДРИРОВКУ: при меньшем старте борт к моменту
// прихода кода вставал вплотную к левой кромке узкого окна.
const PROG_FROM = 0.44;
const RATE = 0.014;                  // доля трассы в секунду

// ── код ─────────────────────────────────────────────────────────────────
const CODE_FS = 25;
const CODE_LH = 40;
const CODE_W = 830;
const CODE_X = -530;
const CODE_IN = 0.8;
const CODE_READ = 3.2;               // ⚠️ VO — контракт выглядит разумно

// ⚠️⚠️ СИГНАТУРА НЕ ЕЗДИТ — на её неподвижности держится весь тезис главы.
// Без этого первая строка уползала вверх при росте тела с 4 строк до 13.
// Решение: ЗАДАННАЯ ВЫСОТА С ЗАПАСОМ. При ней Manticore прижимает контент к
// верху блока и не доскролливает его к изменённому месту, поэтому строка 0
// стоит на одном локальном смещении при любом числе строк, и двигать узел не
// нужно вовсе. ⚠️ Запаса должно хватать на ФИНАЛЬНОЕ состояние: скролл
// включается при `clipHeight < lines·LH + LH`, то есть при 15 строках нужно
// `CODE_H ≥ 15·40 + 40 + 2·46 = 732`. Взято 780 — с запасом на строку.
const CODE_H = 780;
const YEAR_ANCHOR = -190;
// startY блока = −(CODE_H − 2·padY)/2 + LH/2, padY = getCodePaddingY(25) = 46
const CODE_Y = YEAR_ANCHOR - (-(CODE_H - 92) / 2 + CODE_LH / 2);

// ⚠️ Метка года была 17пт — на телефоне не читалась вовсе. Год здесь несёт
// смысл (он и есть дрейф), поэтому кегль продуктовый, а тише кода он остаётся
// за счёт приглушённой краски, а не за счёт мелкости.
const YEAR_FS = 34;
const YEAR_C = 'rgba(244,241,235,0.46)';
const YEAR_Y = YEAR_ANCHOR - 66;
const YEAR_SWAP = 0.32;

const DRIFT = 1.5;
const DRIFT_HOLD = 3.0;              // ⚠️ VO — на каждый год
const RACK = 1.1;
const RACK_HOLD = 1.8;               // ⚠️ VO — сигнатура не изменилась
const TAIL = 0.9;

// ── обрыв ───────────────────────────────────────────────────────────────
// ⚠️ Финал главы приехал В ЭТУ сцену (решение автора): борт пропадает там же,
// где мы полминуты за ним следили, без монтажной склейки — склейка читалась бы
// как новый пример. Порядок физичный: сначала перестают приходить данные (борт
// замирает), потом гаснет цвет сигнала, потом UI признаёт потерю.
// ⚠️ Борт НЕ убираем — он остаётся серым призраком на последней известной
// позиции. Исчез не самолёт, исчезли данные о нём; в этом вся глава.
// ⚠️ Голубой Canon.keyword уходит из кадра ЦЕЛИКОМ (и борт, и след): цвет
// означал «сигнал есть», и его отсутствие — единственное, что нужно показать.
// ⚠️ Сбой на радаре показывает ПРОСТОЕ ПОТУХАНИЕ: борт и пройденный след
// теряют цвет сигнала, поля панели становятся прочерком, проступает статус.
// Плановая линия до Лондона ОСТАЁТСЯ — маршрут известен и без транспондера.
// ⚠️ Пробовал добавить радару отдельный признак аварии, всё отклонено автором
// после просмотра кадров: метка `LAST FIX 19:41 Z` у точки обрыва («не нравится
// last fix»); борт-пустой-контур с гаснущей плановой линией (перебор, вернулись
// к первоначальному потуханию). Круг неопределённости вокруг последней позиции
// остался в резерве и не выбран. Не предлагать это заново.
const LOST_C = 'rgba(244,241,235,0.30)';
const LOST_TRACK_C = 'rgba(244,241,235,0.15)';
const STALL = 0.5;                   // тишина: данные уже не приходят
const LOSS = 0.7;                    // цвет сигнала уходит
const NS_GAP = 0.35;
const NS_IN = 0.9;
const NS_HOLD = 2.6;                 // ⚠️ VO
const NS_FS = 34;
const NS_Y = 44;

const CODE_CARD = {
  radius: 0,
  fill: 'rgba(0,0,0,0)',
  stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0,
  shadowColor: 'rgba(0,0,0,0)',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  edge: false,
} as const;

// ⚠️ Дрейф показывают САМИ ПРАВКИ, без подписей «+ Blocked registrations»:
// на экране появляется `if (flight.isTrackingRestricted)`, и это и есть то
// изменение, про которое говорит голос. Каждая правка по отдельности разумна.
//
// ⚠️ ИМЕНА — часть урока: ролик про дизайн, и код в кадре обязан быть таким,
// какой мы защищаем.
//   • `isTrackingRestricted`, не `isBlocked` — борт не отменён и не заблокирован,
//     он летит нормально; ограничено только право показывать его позицию
//     (настоящая программа FAA LADD). `isBlocked` врал бы про сам рейс.
//   • `flights.byId(...)`, не `flights.find(...)` — в Kotlin `find` возвращает
//     nullable, и следующая же строка на нём не собралась бы. Имя не должно
//     обещать того, чего нет.
//   • `tracking.latestFix(...)`, не `provider.position(...)` — «провайдер» не
//     говорит ничего, а «фикс» — это то же слово, которым карта называет свои
//     точки: код и картинка зовут одно одинаково.
//   • возврат `fix.coordinates`, а не `fix` — у координат нет времени, значит
//     и `isStale()` у них быть не может; протухнуть может отсчёт.
// ⚠️ Логические блоки разделены пустой строкой: так этот код и написали бы.
// ⚠️ Гарды со скобками — правило автора: `if` ВСЕГДА с `{}`, даже когда тело
// в одну строку. ⚠️ Из-за этого на экране появляются повторяющиеся строки
// (`return null` и `}` по три раза), а обычный LCS с обратным обходом на них
// матчит ПОЗДНЕЕ вхождение — старый гард сцеплялся с новым, уже стоявший
// `return null` уезжал вниз и перепечатывался на месте. Лечится в морфе
// флагом `diffPreferEarlyMatches`, а не переписыванием кода.
const CODE_2023 = `fun currentPosition(flightId: FlightId): Coordinates? {
    val flight = flights.byId(flightId)

    return tracking.latestFix(flight)?.coordinates
}`;

const CODE_2024 = `fun currentPosition(flightId: FlightId): Coordinates? {
    val flight = flights.byId(flightId)

    if (flight.isTrackingRestricted) {
        return null
    }

    return tracking.latestFix(flight)?.coordinates
}`;

const CODE_2025 = `fun currentPosition(flightId: FlightId): Coordinates? {
    val flight = flights.byId(flightId)

    if (flight.isTrackingRestricted) {
        return null
    }

    val fix = tracking.latestFix(flight) ?: return null

    if (fix.isStale()) {
        return null
    }

    return fix.coordinates
}`;

const CODE_RULES = buildCanonRules({
  types: ['FlightId', 'Coordinates'],
  vars: ['flight', 'flights', 'tracking', 'fix', 'flightId', 'coordinates'],
});

// ── трасса: положение борта по ДЛИНЕ пути ──────────────────────────────
// ⚠️ Именно по длине, не по индексу точки: сегменты дуги в Меркаторе неравны,
// и борт, поставленный по индексу, отрывался бы от конца собственного следа
// (у Line свойство `end` тоже считается по длине).
const CUM: number[] = [0];
for (let i = 1; i < ROUTE.length; i++) {
  CUM.push(CUM[i - 1] + Math.hypot(ROUTE[i][0] - ROUTE[i - 1][0], ROUTE[i][1] - ROUTE[i - 1][1]));
}
const TOTAL = CUM[CUM.length - 1];

const segAt = (p: number): [number, number] => {
  const d = Math.max(0, Math.min(1, p)) * TOTAL;
  let i = 1;
  while (i < CUM.length - 1 && CUM[i] < d) i++;
  const f = (d - CUM[i - 1]) / (CUM[i] - CUM[i - 1] || 1);
  return [i - 1, Math.max(0, Math.min(1, f))];
};
const routeXY = (p: number): [number, number] => {
  const [i, f] = segAt(p);
  return [
    ROUTE[i][0] + (ROUTE[i + 1][0] - ROUTE[i][0]) * f,
    ROUTE[i][1] + (ROUTE[i + 1][1] - ROUTE[i][1]) * f,
  ];
};
const routeDeg = (p: number): number => {
  const [i] = segAt(p);
  const dx = ROUTE[i + 1][0] - ROUTE[i][0];
  const dy = ROUTE[i + 1][1] - ROUTE[i][1];
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
};
const routeLL = (p: number): [number, number] => {
  const [i, f] = segAt(p);
  return [
    ROUTE_LL[i][0] + (ROUTE_LL[i + 1][0] - ROUTE_LL[i][0]) * f,
    ROUTE_LL[i][1] + (ROUTE_LL[i + 1][1] - ROUTE_LL[i][1]) * f,
  ];
};
const fmtLL = (p: number): string => {
  const [lon, lat] = routeLL(p);
  const ns = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`;
  const ew = `${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
  return `${ns}  ${ew}`;
};

// ── список рейсов: продолжение сцены ────────────────────────────────────
// ⚠️ Карта НЕ сменяется склейкой — окно карты САМО становится панелью списка:
// это тот же продукт, только на уровень выше. Так пять рейсов читаются как
// «и не он один», а не как новый пример.
//
// ⚠️⚠️ ПЯТЬ ПРИЧИН НЕ МОГУТ ПРИНАДЛЕЖАТЬ ОДНОМУ БОРТУ: наш BA 117 летит над
// Атлантикой, значит «не вылетел» и «уже сел» для него физически невозможны.
// Поэтому причины разнесены по РАЗНЫМ рейсам — иначе кадр врёт.
//
// ⚠️ Правда живёт СНАРУЖИ панели, на голом фоне: внутри карточки — то, что
// показывает система, снаружи — то, что произошло на самом деле. Из-за этого
// колонку причин не надо никак подписывать, и порядок чтения слева направо
// сам says: факт → null → экран. Ни одной стрелки.
const TABLE_W = 1000;
const TABLE_H = 500;
const TABLE_X = 330;
const ROW_H = 76;
const ROW_FS = 30;
const HEAD_FS = 15;
const COL_FLIGHT = -400;
const COL_ROUTE = -130;
const COL_STATUS = 190;
// ⚠️ Колонка правды выровнена по ПРАВОМУ краю, к панели: строки упираются в
// свой экран, и когда пять разных фактов схлопываются в пять `null`, текст не
// повисает в пустоте, а поджимается к той самой строке, которую объясняет.
const REASON_X = -250;
const HEAD_Y = -196;
const ROW_DY = 22;                   // контент таблицы к оптическому центру

const FLIGHTS: [string, string, string][] = [
  ['BA 117', 'JFK → LHR', 'out of coverage'],
  ['AF 1680', 'CDG → FCO', 'not departed'],
  ['UA 964', 'EWR → LIS', 'landed 06:12'],
  ['N884JC', 'TEB → VNY', 'owner-restricted'],
  ['IB 6585', 'MAD → BOG', 'feed timeout'],
];
const REASON_C = 'rgba(244,241,235,0.90)';
const STATUS_C = 'rgba(244,241,235,0.58)';

const TRANS = 1.4;
const ROWS_IN = 1.1;
const ROWS_HOLD = 2.8;               // ⚠️ VO — у всех одинаково
const REASONS_IN = 1.2;
const REASONS_HOLD = 3.2;            // ⚠️ VO — а случилось разное
const COLLAPSE = 0.9;
const COLLAPSE_HOLD = 3.2;           // ⚠️ VO — тип свёл их в одно

// силуэт борта (вид сверху, нос в −y): фюзеляж, стреловидное крыло, стабилизатор
const PLANE = [
  'M 0 -13', 'L 2.2 -7', 'L 2.2 -2', 'L 13 5', 'L 13 7.6', 'L 2.2 4',
  'L 2.2 9', 'L 5 12.4', 'L 5 14', 'L 0 12.6', 'L -5 14', 'L -5 12.4',
  'L -2.2 9', 'L -2.2 4', 'L -13 7.6', 'L -13 5', 'L -2.2 -2', 'L -2.2 -7', 'Z',
].join(' ');

// ═══════════════════════════════════════════════════════════════════════
export default makeScene2D(function* (view) {
  applyBackground(view);

  // ── вопрос ────────────────────────────────────────────────────────────
  const ask = createRef<Node>();
  const askSwap = createRef<Node>();          // три слова, что меняются
  const askX = (slot: number) => (slot - ASK_LEN / 2) * ASK_ADV;
  const word = (slot: number, t: string) =>
    new Txt({
      text: t,
      x: askX(slot),
      offset: [-1, 0],
      fontFamily: MONO,
      fontSize: ASK_FS,
      fontWeight: 500,
      fill: SOFT_PINK,
    });

  view.add(<Node ref={ask} y={ASK_Y} opacity={0} />);
  ask().add(
    <Node ref={askSwap} cache cachePadding={80} />,
  );
  const before = ASK_SLOTS.map(([s, a]) => word(s, a));
  const after = ASK_SLOTS.map(([s, , b]) => word(s, b));
  before.forEach(w => askSwap().add(w));
  after.forEach(w => {
    w.opacity(0);
    askSwap().add(w);
  });
  ask().add(word(ASK_TAIL_SLOT, ASK_TAIL));

  // ── карта ─────────────────────────────────────────────────────────────
  const winW = createSignal(MAP_W);
  const winH = createSignal(MAP_H);
  const contentDX = createSignal(0);
  const contentDY = createSignal(0);
  const prog = createSignal(PROG_FROM);
  const shown = () => prog();
  // 1 = сигнала больше нет. Поля панели читают его сами, поэтому «данные
  // пропали» — одно переключение, а не три отдельные анимации текста.
  const lost = createSignal(0);
  const dash = (live: () => string) => () => (lost() > 0.5 ? '—' : live());

  const mapNode = createRef<Node>();
  const win = createRef<Rect>();
  const content = createRef<Node>();
  const overlay = createRef<Node>();

  view.add(<Node ref={mapNode} y={MAP_Y} opacity={0} cache cachePadding={60} />);
  mapNode().add(
    <Rect
      ref={win}
      width={() => winW()}
      height={() => winH()}
      radius={MAP_RADIUS}
      fill={MAP_FILL}
      stroke={MAP_EDGE}
      lineWidth={1}
      shadowColor="rgba(0,0,0,0.45)"
      shadowBlur={30}
      shadowOffset={[0, 12]}
      clip
    />,
  );
  win().add(<Node ref={content} x={() => contentDX()} y={() => contentDY()} />);
  win().add(<Node ref={overlay} />);

  // суша под сеткой: земля / вода / линия берега — три разных слоя
  [LAND_US, LAND_EU, COAST_GB, COAST_IE].forEach(d =>
    content().add(<Path data={d} fill={LAND_C} />),
  );

  // сетка меридианов и параллелей — тише всего в кадре
  GRID_X.forEach(x =>
    content().add(
      <Line points={[[x, -MAP_H / 2], [x, MAP_H / 2]]} stroke={GRID_C} lineWidth={1} />,
    ),
  );
  GRID_Y.forEach(y =>
    content().add(
      <Line points={[[-MAP_W, y], [MAP_W, y]]} stroke={GRID_C} lineWidth={1} />,
    ),
  );

  [COAST_US, COAST_EU, COAST_GB, COAST_IE].forEach(d =>
    content().add(
      <Path data={d} stroke={COAST_C} lineWidth={COAST_W} fill={null} lineJoin="round" />,
    ),
  );

  // трасса: весь путь тускло, пройденное — цветом сигнала
  const pts = ROUTE.map(([x, y]) => new Vector2(x, y));
  const trackDone = createRef<Line>();
  content().add(<Line points={pts} stroke={TRACK_AHEAD} lineWidth={1.8} />);
  content().add(
    <Line ref={trackDone} points={pts} stroke={TRACK_DONE} lineWidth={2.2} end={shown} />,
  );

  // концы трассы
  const port = (p: [number, number], name: string, dx: number, dy: number) => {
    content().add(<Circle position={p} width={7} height={7} fill={PORT_C} />);
    content().add(
      <Txt
        text={name}
        x={p[0] + dx}
        y={p[1] + dy}
        fontFamily={MONO}
        fontSize={19}
        fontWeight={500}
        letterSpacing={1.4}
        fill={DIM}
      />,
    );
  };
  port(P_JFK, 'JFK', 8, 28);
  // ⚠️ Метка Лондона стоит СЛЕВА-ВВЕРХУ от точки: справа до кромки узкого окна
  // остаётся меньше её ширины (срезало), а снизу в 22px проходит южный берег
  // Англии (перечёркивало). Слева-вверху — внутренние земли, там чисто.
  port(P_LHR, 'LHR', -48, -28);

  // борт
  const plane = createRef<Path>();
  content().add(
    <Path
      ref={plane}
      data={PLANE}
      fill={SIGNAL}
      lineWidth={1.6}
      scale={PLANE_S}
      position={() => new Vector2(...routeXY(shown()))}
      rotation={() => routeDeg(shown())}
    />,
  );


  // ── хром панели: прибит к КРАЯМ ОКНА, поэтому переживает кадрировку ───
  // ⚠️ Хедер и футер отбиты волосяными линиями во всю ширину окна — так это
  // читается собранным продуктом, а не текстом, положенным поверх карты.
  // ⚠️ Хедер и футер лежат на СВОИХ полосах: без них строка данных наезжала
  // на береговую линию и переставала читаться. Это часть продуктового UI,
  // а не декоративная плашка под текстом.
  const left = () => -winW() / 2 + 38;
  const bar = (y: number, h: number) =>
    overlay().add(
      <Rect width={() => winW()} height={h} y={y} fill="rgba(9,10,13,0.72)" />,
    );
  const rule = (y: number) =>
    overlay().add(
      <Rect width={() => winW()} height={1} y={y} fill={MAP_HAIR} />,
    );
  bar(-MAP_H / 2 + 50, 100);
  bar(MAP_H / 2 - 38, 76);
  rule(-MAP_H / 2 + 100);
  rule(MAP_H / 2 - 76);
  overlay().add(
    <Txt
      text="BA 117"
      x={left}
      y={-MAP_H / 2 + 44}
      offset={[-1, 0]}
      fontFamily={MONO}
      fontSize={34}
      fontWeight={500}
      fill={INK}
    />,
  );
  overlay().add(
    <Txt
      text="JFK → LHR"
      x={left}
      y={-MAP_H / 2 + 80}
      offset={[-1, 0]}
      fontFamily={MONO}
      fontSize={18}
      letterSpacing={2.4}
      fill={DIM}
    />,
  );

  // строка данных: настоящий ledger, tabular figures, никаких плашек
  const dataY = MAP_H / 2 - 44;
  const cell = (i: number, label: string, value: () => string) => {
    const x = () => left() + i * 250;
    overlay().add(
      <Txt
        text={label}
        x={x}
        y={dataY - 17}
        offset={[-1, 0]}
        fontFamily={MONO}
        fontSize={15}
        letterSpacing={2.2}
        fill={DIM}
      />,
    );
    const v = createRef<Txt>();
    overlay().add(
      <Txt
        ref={v}
        text={value}
        x={x}
        y={dataY + 12}
        offset={[-1, 0]}
        fontFamily={MONO}
        fontSize={23}
        fontWeight={500}
        fill={SOFT}
      />,
    );
    return v;
  };
  cell(0, 'ALTITUDE', dash(() => '38 000 ft'));
  cell(1, 'GROUND SPEED', dash(() => '512 kt'));
  // ⚠️ Это и есть то, что возвращает функция слева. Связь показана ЦВЕТОМ:
  // с приходом кода строка координат перекрашивается в лаванду типов — тот же
  // цвет, каким горит `Coordinates?` в сигнатуре. Ни стрелок, ни подписей:
  // когда в следующей сцене здесь встанет прочерк, объяснять будет нечего.
  // ⚠️ Цифры текут непрерывно — это осознанно: скачок раз в полтора вдоха
  // отменён вместе с шагом борта по фиксам (см. блок «полёт»).
  const posValue = cell(2, 'POSITION', dash(() => fmtLL(shown())));

  // ⚠️ Статус потери — часть панели, а не титр поверх кадра: он живёт внутри
  // окна карты, в пустой воде под трассой, и приходит focus-pull'ом, как всё
  // остальное в этой сцене. Имя главы впервые появляется на экране здесь.
  const noSignal = createRef<Node>();
  overlay().add(
    <Node ref={noSignal} y={NS_Y} opacity={0} cache cachePadding={70}>
      <Txt
        text="NO SIGNAL"
        fontFamily={MONO}
        fontSize={NS_FS}
        fontWeight={500}
        letterSpacing={7}
        fill="rgba(244,241,235,0.60)"
      />
    </Node>,
  );

  // ── список рейсов (живёт в том же окне, что и карта) ─────────────────
  const rowY = (i: number) => (i - (FLIGHTS.length - 1) / 2) * ROW_H + ROW_DY;
  const RULE_W = TABLE_W - 120;
  const table = createRef<Node>();
  win().add(<Node ref={table} opacity={0} cache cachePadding={60} />);

  const head = (x: number, t: string) =>
    table().add(
      <Txt
        text={t}
        x={x}
        y={HEAD_Y}
        offset={[-1, 0]}
        fontFamily={MONO}
        fontSize={HEAD_FS}
        letterSpacing={2.4}
        fill={DIM}
      />,
    );
  head(COL_FLIGHT, 'FLIGHT');
  head(COL_ROUTE, 'ROUTE');
  head(COL_STATUS, 'STATUS');
  table().add(
    <Rect width={RULE_W} height={1} y={HEAD_Y + 36} fill="rgba(244,241,235,0.11)" />,
  );

  FLIGHTS.forEach(([code_, route], i) => {
    if (i > 0) {
      table().add(
        <Rect width={RULE_W} height={1} y={rowY(i) - ROW_H / 2} fill={MAP_HAIR} />,
      );
    }
    const put = (x: number, t: string, size: number, fill: string, weight = 400) =>
      table().add(
        <Txt
          text={t}
          x={x}
          y={rowY(i)}
          offset={[-1, 0]}
          fontFamily={MONO}
          fontSize={size}
          fontWeight={weight}
          fill={fill}
        />,
      );
    put(COL_FLIGHT, code_, ROW_FS, INK, 500);
    put(COL_ROUTE, route, ROW_FS - 4, DIM);
    // ⚠️ Одинаковый статус у всех пяти — рифма с картой, где он только что
    // проступил. Именно эта одинаковость и есть предмет сцены.
    put(COL_STATUS, 'NO SIGNAL', ROW_FS - 2, STATUS_C);
  });

  // ── правда: СНАРУЖИ панели, на голом фоне ────────────────────────────
  // Каждая причина и её `null` живут в одной кэш-ячейке, чтобы схлопнуться
  // одним движением через расфокус — тем же приёмом, каким в начале сцены
  // менялся вопрос. Цвет НЕ меняется: видно только то, что пять разных слов
  // стали одним словом.
  const reasons = createRef<Node>();
  view.add(<Node ref={reasons} opacity={0} />);
  const factTxt: Txt[] = [];
  const nullTxt: Txt[] = [];
  const reasonCell: Node[] = [];
  FLIGHTS.forEach(([, , reason], i) => {
    const cell = new Node({y: rowY(i), cache: true, cachePadding: 60});
    const fact = new Txt({
      text: reason,
      x: REASON_X,
      offset: [1, 0],
      fontFamily: MONO,
      fontSize: ROW_FS - 2,
      fill: REASON_C,
    });
    const nul = new Txt({
      text: 'null',
      x: REASON_X,
      offset: [1, 0],
      fontFamily: MONO,
      fontSize: ROW_FS - 2,
      fill: REASON_C,
      opacity: 0,
    });
    cell.add(fact);
    cell.add(nul);
    reasons().add(cell);
    factTxt.push(fact);
    nullTxt.push(nul);
    reasonCell.push(cell);
  });

  // ── код ───────────────────────────────────────────────────────────────
  const code = Manticore.create(CODE_2023, {
    x: CODE_X,
    y: CODE_Y,
    width: CODE_W,
    height: CODE_H,
    fontSize: CODE_FS,
    lineHeight: CODE_LH,
    fontFamily: MONO,
    theme: CanonCodeTheme,
    cardStyle: CODE_CARD,
    glowAccent: false,
    noClip: true,
    customTypes: ['FlightId', 'Coordinates'],
  });
  code.mount(view);
  code.colorize(CODE_RULES);
  paintCanonMethodCalls(code);
  code.node.opacity(0);

  const year = createRef<Txt>();
  view.add(
    <Txt
      ref={year}
      text="2023"
      x={CODE_X - CODE_W / 2 + 58}
      y={YEAR_Y}
      offset={[-1, 0]}
      fontFamily={MONO}
      fontSize={YEAR_FS}
      fontWeight={500}
      letterSpacing={3}
      fill={YEAR_C}
      opacity={0}
    />,
  );

  // полёт идёт ровно, ритм создаёт только квантование по фиксам
  const flying = (dur: number) => prog(prog() + RATE * dur, dur, linear);

  // ═══════════════ ТАЙМЛАЙН ════════════════════════════════════════════
  // ═══ A. Наш вопрос возвращается другим ══════════════════════════════
  yield* ask().opacity(1, ASK_IN, easeOutCubic);
  yield* waitFor(ASK_HOLD);

  // расфокус ОДНИМ движением: три слова уходят в блюр, три приходят из него
  yield* all(
    chain(
      askSwap().filters.blur(11, ASK_SWAP / 2, easeInCubic),
      askSwap().filters.blur(0, ASK_SWAP / 2, easeOutCubic),
    ),
    chain(
      all(...before.map(w => w.opacity(0, ASK_SWAP * 0.42, easeInCubic))),
      all(...after.map(w => w.opacity(1, ASK_SWAP * 0.5, easeOutCubic))),
    ),
  );
  yield* waitFor(ASK_READ);

  // ═══ B. Вопрос уходит, и на его месте открывается продукт ═══════════
  // ⚠️ Строго по очереди: вопрос — отдельный кадр, а не подпись над картой.
  yield* ask().opacity(0, ASK_OUT, easeInCubic);
  ask().remove();
  yield* waitFor(ASK_GAP);

  // ⚠️ Панель приходит КАК ОДНО через focus-pull: блюр на узле — дети
  // блюрятся вместе. Постадийный вход элементов = стоковая библиотека.
  mapNode().filters([blur(MAP_BLUR)]);
  yield* all(
    mapNode().opacity(1, MAP_IN, easeOutCubic),
    mapNode().filters.blur(0, MAP_IN, easeInOutSine),
    flying(MAP_IN),
  );
  mapNode().filters([]);

  yield* flying(MAP_READ);

  // ═══ C. Рядом с продуктом встаёт механизм ═══════════════════════════
  yield* all(
    winW(WIN_C, FRAME_MOVE, easeInOutCubic),
    mapNode().x(MAP_X_C, FRAME_MOVE, easeInOutCubic),
    contentDX(CONTENT_DX_C, FRAME_MOVE, easeInOutCubic),
    contentDY(CONTENT_DY_C, FRAME_MOVE, easeInOutCubic),
    flying(FRAME_MOVE),
    chain(
      waitFor(FRAME_MOVE * 0.45),
      all(
        code.appear(CODE_IN),
        year().opacity(1, CODE_IN, easeOutCubic),
        // связь «возврат функции ↔ строка панели» — одной краской
        posValue().fill(Canon.type, CODE_IN),
      ),
    ),
  );
  yield* flying(CODE_READ);

  // ═══ D. Дрейф: три года, ни одного неверного решения ════════════════
  const driftTo = function* (next: string, label: string) {
    yield* all(
      chain(
        year().opacity(0, YEAR_SWAP / 2, easeInCubic),
        (function* () {
          year().text(label);
        })(),
        year().opacity(1, YEAR_SWAP / 2, easeOutCubic),
      ),
      // ⚠️ Правка вставляется В СЕРЕДИНУ тела, и порядок здесь — смысл:
      // сначала код РАССТУПАЕТСЯ, и только потом в освободившемся месте
      // печатаются строки, сверху вниз — как в редакторе. Без
      // `settleBeforeType` Manticore на чистой вставке (план из одних `add`)
      // игнорирует lineOrder и печатает все строки разом поверх ещё едущих
      // старых: короткий `return null` успевал раньше длинного `if (...)`, и
      // выглядело так, будто null появляется из пустоты, а код строится вокруг.
      // ⚠️ ЗАМЕНА СТРОКИ ТОЖЕ АНИМИРУЕТСЯ, а не подменяется кадром: уходящие
      // токены гаснут и стираются обратной печатью, пережившие ЕДУТ на новые
      // места (tokenSlideDuration), и только освободившееся допечатывается.
      // Так `return tracking.latestFix(flight)?.coordinates` на глазах
      // становится `val fix = tracking.latestFix(flight) ?: return null` —
      // видно, что это та же строка, которую переписали, а не другая.
      code.morphTo(next, {
        addStyle: 'typewriter',
        lineOrder: 'sequential',
        settleBeforeType: true,
        diffPreferEarlyMatches: true,
        moveDuration: 0.55,
        removeDuration: 0,
        charDelay: 0.012,
        lineDelay: 0.12,
        tokenSlideDuration: 0.4,
        flashRemovedColor: 'rgba(244,241,235,0.32)',
        flashRemovedDuration: 0.22,
        flashRemovedErase: 'reverseType',
        flashRemovedEraseCharDelay: 0.011,
      }),
      flying(DRIFT),
    );
    yield* flying(DRIFT_HOLD);
  };

  yield* driftTo(CODE_2024, '2024');
  yield* driftTo(CODE_2025, '2025');

  // ═══ E. А сигнатура не изменилась ни на символ ══════════════════════
  // ⚠️ Тезис доказывается ТИШИНОЙ вокруг сигнатуры: тело уходит, первая
  // строка остаётся — она одна и та же во всех трёх состояниях.
  yield* all(
    code.dimLines(1, code.lineCount - 1, 0.16, RACK),
    flying(RACK),
  );
  yield* flying(RACK_HOLD);

  // ═══ F. И в этой тишине борт пропадает ══════════════════════════════
  // ⚠️ Сигнатура горит слева, ничего не изменив за три года; справа гаснет
  // то, ради чего она существует. Второе утверждение не произносится — его
  // держит цвет: строка POSITION была покрашена в лаванду типов ещё при
  // появлении кода, и теперь эта самая строка становится прочерком.
  yield* waitFor(STALL);            // борт не двигается: отсчёты не приходят
  lost(1);
  yield* all(
    plane().fill(LOST_C, LOSS, easeInOutSine),
    trackDone().stroke(LOST_TRACK_C, LOSS, easeInOutSine),
    posValue().fill(DIM, LOSS, easeInOutSine),
  );

  yield* waitFor(NS_GAP);
  noSignal().filters([blur(10)]);
  yield* all(
    noSignal().opacity(1, NS_IN, easeOutCubic),
    noSignal().filters.blur(0, NS_IN, easeInOutSine),
  );
  noSignal().filters([]);
  yield* waitFor(NS_HOLD);

  // ═══ G. И не он один ════════════════════════════════════════════════
  // ⚠️ Окно карты САМО становится панелью списка — тот же продукт, на уровень
  // выше. Код уходит вместе с картой: его работа сделана, дальше говорит UI.
  // ⚠️ Строки проступают ПОКА окно ещё едет: если ждать конца перехода, между
  // погасшей картой и списком висит секунда пустой панели — «зарезервированная
  // пустота», которую автор читает как брак.
  table().filters([blur(9)]);
  yield* all(
    code.node.opacity(0, TRANS * 0.7, easeInCubic),
    year().opacity(0, TRANS * 0.7, easeInCubic),
    content().opacity(0, TRANS * 0.55, easeInCubic),
    overlay().opacity(0, TRANS * 0.55, easeInCubic),
    winW(TABLE_W, TRANS, easeInOutCubic),
    winH(TABLE_H, TRANS, easeInOutCubic),
    mapNode().x(TABLE_X, TRANS, easeInOutCubic),
    mapNode().y(0, TRANS, easeInOutCubic),
    chain(
      waitFor(TRANS * 0.5),
      all(
        table().opacity(1, ROWS_IN, easeOutCubic),
        table().filters.blur(0, ROWS_IN, easeInOutSine),
      ),
    ),
  );
  table().filters([]);
  yield* waitFor(ROWS_HOLD);

  // ═══ H. А случилось с ними разное ═══════════════════════════════════
  reasons().filters([blur(10)]);
  yield* all(
    reasons().opacity(1, REASONS_IN, easeOutCubic),
    reasons().filters.blur(0, REASONS_IN, easeInOutSine),
  );
  reasons().filters([]);
  yield* waitFor(REASONS_HOLD);

  // ═══ I. Пять фактов становятся одним словом ═════════════════════════
  yield* all(
    ...reasonCell.map(c =>
      chain(
        c.filters.blur(11, COLLAPSE / 2, easeInCubic),
        c.filters.blur(0, COLLAPSE / 2, easeOutCubic),
      ),
    ),
    chain(
      all(...factTxt.map(t => t.opacity(0, COLLAPSE * 0.42, easeInCubic))),
      all(...nullTxt.map(t => t.opacity(1, COLLAPSE * 0.5, easeOutCubic))),
    ),
  );
  yield* waitFor(COLLAPSE_HOLD);

  yield* all(
    mapNode().opacity(0.001, TAIL, easeInCubic),
    reasons().opacity(0, TAIL, easeInCubic),
  );
  yield* waitFor(0.3);
});
