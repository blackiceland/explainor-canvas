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
  ThreadGenerator,
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
  paintCanonMethodCallsLine,
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
// ⚠️ ОКНО КАДРИРУЕТСЯ И ПО ВЫСОТЕ. Пока оно оставалось 680, панель справа была
// выше кода слева и начиналась на 84px раньше — два блока разной высоты, стоящие
// на разных уровнях, и композиция разъезжалась. Теперь окно ровно по оптической
// высоте финального кода: 15 строк × LH = 600, первая строка на YEAR_ANCHOR,
// значит блок занимает −210…+390, центр 90. Панель встаёт в те же границы.
const WIN_H_C = 600;
const WIN_Y_C = 90;
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
// ⚠️⚠️ ВСЯ ДРАМА В ОДНОЙ КОЛОНКЕ — требование когнитивной простоты (автор:
// «дальше хаос какой-то»). Была версия с колонкой правды СНАРУЖИ панели: идея
// «внутри продукта / снаружи продукта» честная, но на экране никакого
// «снаружи» не читается — читаются два текстовых массива, конкурирующих за
// внимание, плюс события происходили одновременно в пяти местах, и следить
// было не за чем. Теперь третья колонка проходит три состояния на месте:
//     причина → null → NO SIGNAL
// одно место в кадре, три такта, один и тот же приём смены (расфокус), так что
// после первой смены зритель уже знает язык и вторую читает мгновенно.
// ⚠️ Цвет во всех трёх состояниях ОДИН: меняется ровно одна переменная —
// слово. Любая доп. краска здесь добавляет то, за чем ещё надо следить.
const TABLE_W = 1000;
const TABLE_H = 500;
// ⚠️ Панель встаёт в ЦЕНТР кадра: в кадре больше нет ничего другого, и смещать
// её вправо было бы наследством от версии с колонкой правды слева.
const TABLE_X = 0;
const ROW_H = 76;
const ROW_FS = 30;
const HEAD_FS = 15;
const COL_FLIGHT = -400;
const COL_ROUTE = -130;
// ⚠️ Самая длинная причина (`owner-restricted`) должна укладываться ВНУТРИ
// волосяной линии строки, иначе текст торчит за таблицу.
const COL_STATUS = 145;
const HEAD_Y = -196;
const ROW_DY = 22;                   // контент таблицы к оптическому центру

const FLIGHTS: [string, string, string][] = [
  ['BA 117', 'JFK → LHR', 'out of coverage'],
  ['AF 1680', 'CDG → FCO', 'not departed'],
  ['UA 964', 'EWR → LIS', 'landed 06:12'],
  ['N884JC', 'TEB → VNY', 'owner-restricted'],
  ['IB 6585', 'MAD → BOG', 'feed timeout'],
];
const CELL_C = 'rgba(244,241,235,0.90)';

// ⚠️⚠️ ХОРЕОГРАФИЯ ФИНАЛА САМА ДОКАЗЫВАЕТ ТЕЗИС (третья переделка; автор:
// «не нравится всё ещё»). Прошлая версия читалась слайдами: три текстовых
// состояния сменяли друг друга расфокусом, то есть в кадре никто ничего не
// ДЕЛАЛ, а мы просто читали подписи. Теперь такты отличаются не содержимым,
// а движением:
//   • пока значения РАЗНЫЕ — они и приходят вразнобой, по одному;
//   • обнуление идёт ВОЛНОЙ сверху вниз, обратной печатью — тем же жестом,
//     каким в этой же сцене переписывал себя код (видно не «поменялось», а
//     как это распространяется);
//   • став неразличимыми, ячейки двигаются СТРОЕМ: последний флип в NO SIGNAL
//     синхронный. Единственное синхронное движение сцены законно ровно с той
//     секунды, когда данные стали одинаковыми.
const RETYPE_CD = 0.02;              // скорость обратной печати
const WAVE_STEP = 0.28;              // задержка волны между строками
const ICON_X = -462;                 // силуэт борта как иконка строки
const ICON_S = 0.85;
const DISSOLVE = 1.5;
const ALONE = 1.6;                   // ⚠️ VO — один над океаном
// Позиции одинокого такта подобраны так, чтобы ПАРА была центрирована в кадре
// (борт + статус кеглем 34 с разрядкой 7 = 240px), иначе двое читаются двумя
// разбросанными объектами, а не одним оставшимся.
const ALONE_PLANE_X = -154;
const ALONE_NS_X = -74;
// ⚠️ Пуш-ин почти незаметный — он не «эффект», а то, что сшивает три такта в
// один непрерывный кадр вместо трёх слайдов.
const PUSH_IN = 1.045;

const ROWS_IN = 1.2;
const ROWS_HOLD = 2.6;               // ⚠️ VO — он не один
const NULL_HOLD = 2.4;               // ⚠️ VO — под словом одно и то же
const FACTS_HOLD = 3.4;              // ⚠️ VO — а под ним пять разных правд
const PUSH_DUR = 7.5;                // = 0.26 (флип) + NULL_HOLD + 1.44 (волна) + FACTS_HOLD

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
  // ⚠️ И к ВЕРХНЕЙ/НИЖНЕЙ кромке тоже — окно кадрируется по обеим осям, а хром
  // обязан ехать вместе с ней, иначе хедер уезжает под клип.
  const left = () => -winW() / 2 + 38;
  const top = () => -winH() / 2;
  const bot = () => winH() / 2;
  const bar = (y: () => number, h: number) =>
    overlay().add(
      <Rect width={() => winW()} height={h} y={y} fill="rgba(9,10,13,0.72)" />,
    );
  const rule = (y: () => number) =>
    overlay().add(
      <Rect width={() => winW()} height={1} y={y} fill={MAP_HAIR} />,
    );
  bar(() => top() + 50, 100);
  bar(() => bot() - 38, 76);
  rule(() => top() + 100);
  rule(() => bot() - 76);
  overlay().add(
    <Txt
      text="BA 117"
      x={left}
      y={() => top() + 44}
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
      y={() => top() + 80}
      offset={[-1, 0]}
      fontFamily={MONO}
      fontSize={18}
      letterSpacing={2.4}
      fill={DIM}
    />,
  );

  // строка данных: настоящий ledger, tabular figures, никаких плашек
  const dataY = () => bot() - 44;
  const cell = (i: number, label: string, value: () => string) => {
    const x = () => left() + i * 250;
    overlay().add(
      <Txt
        text={label}
        x={x}
        y={() => dataY() - 17}
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
        y={() => dataY() + 12}
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
  // ⚠️ Выключка ЛЕВАЯ (offset −1) со сдвигом на половину ширины: на карте он
  // выглядит центрированным, но потом переезжает в ячейку таблицы, а там
  // колонка левовыключная — так объект переживает переезд без смены выключки.
  const noSignal = createRef<Txt>();
  overlay().add(
    <Txt
      ref={noSignal}
      text="NO SIGNAL"
      x={-120}
      y={NS_Y}
      offset={[-1, 0]}
      opacity={0}
      cache
      cachePadding={70}
      fontFamily={MONO}
      fontSize={NS_FS}
      fontWeight={500}
      letterSpacing={7}
      fill="rgba(244,241,235,0.60)"
    />,
  );

  // ── список рейсов: собирается ВОКРУГ переживших ──────────────────────
  // ⚠️ Отдельная карточка, а не то же окно: окно карты растворяется целиком,
  // и список рождается вокруг борта со статусом. Живёт в `mapNode` рядом с
  // окном, поэтому общий пуш-ин двигает всё вместе.
  const rowY = (i: number) => (i - (FLIGHTS.length - 1) / 2) * ROW_H + ROW_DY;
  const RULE_W = TABLE_W - 120;
  const table = createRef<Node>();
  mapNode().add(<Node ref={table} opacity={0} cache cachePadding={70} />);
  table().add(
    <Rect
      width={TABLE_W}
      height={TABLE_H}
      radius={MAP_RADIUS}
      fill={MAP_FILL}
      stroke={MAP_EDGE}
      lineWidth={1}
      shadowColor="rgba(0,0,0,0.45)"
      shadowBlur={30}
      shadowOffset={[0, 12]}
    />,
  );

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
  // ⚠️ У третьей колонки заголовка НЕТ намеренно: она меняет смысл трижды
  // (что случилось → что вернул код → что видит человек), и любое одно имя
  // для неё было бы враньём.
  head(COL_FLIGHT, 'FLIGHT');
  head(COL_ROUTE, 'ROUTE');
  table().add(
    <Rect width={RULE_W} height={1} y={HEAD_Y + 36} fill="rgba(244,241,235,0.11)" />,
  );

  // ⚠️ Ячейка первой строки НЕ создаётся: ею станет `NO SIGNAL`, переживший
  // растворение карты. Остальные четыре приходят уже с тем же словом.
  const cellTxt: Txt[] = [];

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

    if (i > 0) {
      const c = new Txt({
        text: 'NO SIGNAL',
        x: COL_STATUS,
        y: rowY(i),
        offset: [-1, 0],
        fontFamily: MONO,
        fontSize: ROW_FS - 2,
        fill: CELL_C,
      });
      table().add(c);
      cellTxt.push(c);
    }
  });

  // ⚠️ Борт и статус переезжают сюда перед растворением окна — иначе они
  // погасли бы вместе с ним. Узел добавлен ПОСЛЕ таблицы, поэтому пережившие
  // остаются поверх собирающегося вокруг них списка.
  const keep = createRef<Node>();
  mapNode().add(<Node ref={keep} />);

  // Обратная печать: старое стирается с конца, новое допечатывается на его
  // месте. Тот же жест, которым в этой сцене переписывала себя строка кода.
  const retype = function* (t: Txt, next: string): ThreadGenerator {
    const cur = t.text();
    for (let i = cur.length - 1; i >= 0; i--) {
      t.text(cur.slice(0, i));
      yield* waitFor(RETYPE_CD);
    }
    for (let i = 1; i <= next.length; i++) {
      t.text(next.slice(0, i));
      yield* waitFor(RETYPE_CD);
    }
  };

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

  // ⚠️ Rack-focus гасит код ПОТОКЕННО, а не построчно, и оставляет гореть не
  // только сигнатуру, но и КАЖДЫЙ `return null`. Смысл такта от этого меняется:
  // видно не «сигнатура не изменилась», а «сигнатура не изменилась, ЗАТО под ней
  // теперь три разных повода вернуть одно и то же слово» — то есть ровно тезис
  // главы, доказанный самим кодом. Построчно это не сделать: второй `return null`
  // живёт внутри рабочей строки `val fix = … ?: return null`, и её нельзя ни
  // погасить целиком, ни целиком оставить.
  // ⚠️ Совпадение ищем по СОБРАННОМУ тексту строки, а не по одному токену:
  // после typewriter-морфа токен может быть разложен на отдельные символы.
  const RACK_DIM = 0.16;
  const rackFocus = function* (dur: number): ThreadGenerator {
    const anims: ThreadGenerator[] = [];
    for (let li = 1; li < code.lineCount; li++) {
      const line = code.getLine(li);
      if (!line) continue;
      const toks = line.tokens;
      let text = '';
      const span: [number, number][] = [];
      for (const t of toks) {
        const from = text.length;
        text += t.text;
        span.push([from, text.length]);
      }
      const lit = new Set<number>();
      const re = /return\s+null/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const [a, b] = [m.index, m.index + m[0].length];
        span.forEach(([from, to], i) => {
          if (from < b && to > a) lit.add(i);
        });
      }
      toks.forEach((t, i) =>
        anims.push(t.ref().opacity(lit.has(i) ? 1 : RACK_DIM, dur, easeInOutSine)),
      );
    }
    yield* all(...anims);
  };

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
    winH(WIN_H_C, FRAME_MOVE, easeInOutCubic),
    mapNode().x(MAP_X_C, FRAME_MOVE, easeInOutCubic),
    mapNode().y(WIN_Y_C, FRAME_MOVE, easeInOutCubic),
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
      // ⚠️ БЕЗ recolorLine ВЫЗОВЫ ВСПЫХИВАЮТ. Морф прогоняет каждую тронутую
      // строку через applyRules, а по теме `method` красится в methodDef
      // (#FF8CA3, яркий якорь определения) — и вызовы, которым по канону
      // положена бледная роуз #FFAEC0, после первой же правки становились
      // ярче определения. `paintCanonMethodCalls` при создании их красит один
      // раз, повторно никто не звал. Хук чинит и сам морф, и то, что после.
      code.morphTo(next, {
        recolorLine: paintCanonMethodCallsLine,
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
    rackFocus(RACK),
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

  // ═══ G. Всё растворяется, кроме борта и его статуса ═════════════════
  // ⚠️ Пережить переход должен ПЕРСОНАЖ, а не его подпись: сорок секунд
  // смотрели на силуэт, а не на текст «BA 117». И пустота вокруг — это и есть
  // эмоция момента: один серый борт над океаном и единственные слова, которые
  // у системы про него есть. Рифма со still point из интро.
  // ⚠️ Сначала ВЫНИМАЕМ их из окна (иначе погаснут вместе с ним), сохранив
  // экранные позиции: борт стоит в `content` со своими сдвигами, статус — в
  // `overlay` по центру окна.
  const [bx, by] = routeXY(shown());
  plane().remove();
  plane().position([CONTENT_DX_C + bx, CONTENT_DY_C + by]);
  plane().rotation(routeDeg(shown()));
  keep().add(plane());

  noSignal().remove();
  noSignal().position([-120, NS_Y]);
  keep().add(noSignal());

  // ⚠️ Пара сходится к центру кадра ЗАОДНО с растворением: отдельным
  // движением после него это читалось бы как переезд мебели, а так — как
  // оседание того, что осталось. Борт пока сохраняет свой размер — он ещё
  // самолёт, а не строка списка.
  yield* all(
    code.node.opacity(0, DISSOLVE * 0.7, easeInCubic),
    year().opacity(0, DISSOLVE * 0.7, easeInCubic),
    win().opacity(0, DISSOLVE * 0.75, easeInCubic),
    mapNode().x(TABLE_X, DISSOLVE, easeInOutCubic),
    mapNode().y(0, DISSOLVE, easeInOutCubic),
    plane().position([ALONE_PLANE_X, 0], DISSOLVE, easeInOutCubic),
    plane().rotation(90, DISSOLVE, easeInOutCubic),
    noSignal().position([ALONE_NS_X, 0], DISSOLVE, easeInOutCubic),
  );
  win().remove();

  // ═══ H. Одни ════════════════════════════════════════════════════════
  yield* waitFor(ALONE);

  // ═══ I. И вокруг них собирается список ══════════════════════════════
  // ⚠️ Список не просто появляется — он РАСТАСКИВАЕТ пару по колонкам: борт
  // доседает до иконки строки, статус — до кегля ячейки. Четыре соседа
  // приходят СТРОЕМ и с тем же самым словом: одинаковое читается одним
  // блоком, и это ровно смысл — «он не один».
  table().filters([blur(9)]);
  yield* all(
    table().opacity(1, ROWS_IN, easeOutCubic),
    table().filters.blur(0, ROWS_IN, easeInOutSine),
    plane().position([ICON_X, rowY(0)], ROWS_IN, easeInOutCubic),
    plane().scale(ICON_S, ROWS_IN, easeInOutCubic),
    noSignal().position([COL_STATUS, rowY(0)], ROWS_IN, easeInOutCubic),
    noSignal().fontSize(ROW_FS - 2, ROWS_IN, easeInOutCubic),
    noSignal().letterSpacing(0, ROWS_IN, easeInOutCubic),
    noSignal().fill(CELL_C, ROWS_IN, easeInOutCubic),
  );
  table().filters([]);
  yield* waitFor(ROWS_HOLD);

  // ═══ J. Снимаем слои: экран → тип → правда ══════════════════════════
  // ⚠️ Направление обратное карте: там пять причин сходились в одно, здесь мы
  // ВСКРЫВАЕМ. Пока значения одинаковые — они и меняются строем; как только
  // под ними обнаруживается разное, оно приходит вразнобой, волной. Кадр
  // кончается на различии, и это тезис ролика: слово одно, значений слишком
  // много. ⚠️ Пуш-ин сшивает такты в один кадр вместо трёх слайдов.
  const survivors = [noSignal(), ...cellTxt];
  yield* all(
    // ⚠️ Длительность пуш-ина = фактической длине такта, иначе `all` ждёт его
    // одного и в хвосте повисает мёртвая пауза (насчитал 4 лишние секунды).
    mapNode().scale(PUSH_IN, PUSH_DUR, linear),
    chain(
      all(...survivors.map(t => retype(t, 'null'))),
      waitFor(NULL_HOLD),
      all(
        ...survivors.map((t, i) =>
          chain(waitFor(i * WAVE_STEP), retype(t, FLIGHTS[i][2])),
        ),
      ),
      waitFor(FACTS_HOLD),
    ),
  );

  yield* all(
    table().opacity(0, TAIL, easeInCubic),
    keep().opacity(0, TAIL, easeInCubic),
  );
  yield* waitFor(0.3);
});
