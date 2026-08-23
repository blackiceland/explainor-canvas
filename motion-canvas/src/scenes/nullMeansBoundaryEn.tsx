import {Node, Path, Rect, Txt, blur, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  chain,
  createRef,
  createSignal,
  easeInCubic,
  easeInOutCubic,
  easeInOutSine,
  easeOutCubic,
  waitFor,
  ThreadGenerator,
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

// ═══════════════════════════════════════════════════════════════════════
// ГРАНИЦА · КТО РЕШАЕТ, ЧТО УВИДИТ МИР.
//
// ⚠️⚠️ СЦЕНА — ОДИН НЕПРЕРЫВНЫЙ ПРОЕЗД ПО ОДНОМУ МИРУ, СЛЕВА НАПРАВО.
// Все части лежат на ОДНОЙ физической сцене и существуют с первого кадра;
// «переходы» — это движение камеры и перевод фокуса, а не смена картинок.
// Ни одного кроссфейда между мирами, ни одного пустого кадра: всё, что
// появилось, остаётся до конца. Ось та же, на которой построен весь ролик:
// код слева, продуктовый экран справа.
//
// ⚠️⚠️ СКВОЗНОЙ ГЕРОЙ — ОДНО СЛОВО. `Restricted` рождается в коде, переводится
// на границе, стоит на табло и уходит с табло. Путь слова наружу и есть сюжет.
//
// ДУГА (~40с):
//   0. Кадр, которым кончилась предыдущая сцена: код слева, табло справа.
//      Между ними — пустой зазор. Граница существовала всегда.
//   1. Камера ныряет в код. Единственный переживший `null` — и он честный:
//      строка получает явный тип `Fix?`, а элвис разворачивается в гард с
//      единственным литеральным `null` — и тот немедленно получает имя.
//      Nullable живёт в маленьком контракте, где у «нет» ровно один смысл.
//   2. Всплытие к границе: слева `Restricted`, справа уходит в мир
//      `HTTP/1.1 403 Forbidden`. Честный перевод.
//   3. Документ: RFC 9110 §15.5.4. Страница уходит в расфокус, и свет чтения
//      находит одно предложение.
//   4. Возврат ровно туда, где были. `403 Forbidden` перепечатывается в
//      `404 Not Found`. Слева не двигается ничего.
//   5. Строка борта беззвучно исчезает с публичного табло, соседи смыкаются.
//      Следов нет.
//   6. Общий план: правда слева, тишина справа, между ними пустой зазор.
//
// ⚠️⚠️ ПОЧЕМУ ДОКУМЕНТ ИДЁТ ДО ПОДМЕНЫ, А НЕ ПОСЛЕ (правка, принятая после
// разбора; мой первоначальный порядок был обратным и он был неверен).
// Глава про то, КТО РЕШАЕТ. Если сначала флип, а потом документ — показано
// нарушение, которое задним числом простили. Если сначала документ — показано
// РЕШЕНИЕ, принятое по правилу. Второе и есть тезис главы: случайная потеря
// (преступление null) против намеренной (право границы).
//
// ⚠️⚠️ `403 Forbidden` и `404 Not Found` — РОВНО ПО 22 ЗНАКА вместе с
// `HTTP/1.1 `. Строка не меняет ширину, подмена происходит только в словах.
// Ни то, ни другое не подкрашено: ложь обязана выглядеть так же, как правда.
//
// ⚠️ HTTP здесь свидетель ИМЕНОВАНИЯ исходов, но НЕ закрытого списка: реестр
// статусов расширяем, клиент обязан уметь встретить незнакомый код. Аргумент
// про sealed остаётся внутренним, его несёт компилятор. В кадре об этом ничего
// не утверждается — и не должно.
// ⚠️ И `Restricted → 403` — не «правильное написание», а перевод, ВЫБРАННЫЙ
// контрактом: законны и 403, и 404, и 200 с полем в теле. Это и усиливает
// главу: на границе решает не словарь, а тот, кто её проводит.
// ═══════════════════════════════════════════════════════════════════════

const MONO = Fonts.code;

// ── общий верхний уровень (тот же, что в предыдущей сцене) ──────────────
const TOP = -250;

// ── код: ДОСЛОВНОЕ ПРОДОЛЖЕНИЕ ──────────────────────────────────────────
// ⚠️⚠️ Числа один в один из `nullMeansAllTheReasonsEn`: тот же кегль, та же
// ширина, та же позиция. Сцена открывается кадром, которым кончилась
// предыдущая, и любое расхождение здесь порвало бы стык.
// ⚠️ `noClip: true` — поэтому сигнатура (51 знак) и выросшее на три строки тело
// выходят за номинальную коробку блока и всё равно рисуются целиком. Геометрию
// трогать не понадобилось.
const CODE_FS = 25;
const CODE_LH = 40;
const CODE_W = 830;
const CODE_X = -530;
const CODE_H = 760;
const CODE_Y = TOP - (-(CODE_H - 92) / 2 + CODE_LH / 2);
const CODE_ADV = CODE_FS * 0.6;
const CODE_PAD_X = 56;
const CODE_LEFT = -CODE_W / 2 + CODE_PAD_X;

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

// финальное состояние предыдущей сцены
const S5 = `fun currentPosition(flightId: FlightId): Position {
    val flight = flights.byId(flightId)

    if (flight.isTrackingRestricted) {
        return Restricted
    }

    val fix = tracking.latestFix(flight)
        ?: return OutOfCoverage

    if (fix.isStale()) {
        return Stale
    }

    return Tracked(fix.coordinates)
}`;

// ⚠️⚠️ ЕДИНСТВЕННАЯ ПРАВКА КОДА ЗА СЦЕНУ — ЯВНЫЙ ТИП И РАЗВЁРНУТЫЙ ГАРД. Она
// доказывает то, что иначе пришлось бы утверждать голосом: `latestFix`
// возвращает `Fix?`, то есть nullable здесь живёт в САМОМ МАЛЕНЬКОМ контракте,
// где у отсутствия ровно один смысл — антенна не дала точку. И гард тут же
// переводит этот единственный смысл в имя. Без этих строк «последний честный
// null» остался бы недоказанным исключением.
// ⚠️ Тип именно `Fix`, а не `Coordinates` (вопрос автора: «почему fix начал
// возвращать координатес?»). Двумя строками ниже код спрашивает `fix.isStale()`
// и берёт `fix.coordinates` — значит это замер (точка плюс время), а координаты
// о своей свежести ничего не знают.
// ⚠️⚠️ ЭЛВИС РАЗВЁРНУТ В ЯВНЫЙ ГАРД (решение автора). Причина смысловая:
// `?:` устраняет null молча, и в кадре не остаётся самого слова. В развёрнутом
// виде в финальном коде фильма стоит ЕДИНСТВЕННЫЙ литеральный `null` — ровно
// там, где он честен, и в следующей строке получает имя.
// ⚠️ Логические блоки разведены пустой строкой ВЕЗДЕ, гард — тоже. Резким рэк
// держит весь диапазон 7…11: объявление, пустая строка и гард целиком.
const S5A = `fun currentPosition(flightId: FlightId): Position {
    val flight = flights.byId(flightId)

    if (flight.isTrackingRestricted) {
        return Restricted
    }

    val fix: Fix? = tracking.latestFix(flight)

    if (fix == null) {
        return OutOfCoverage
    }

    if (fix.isStale()) {
        return Stale
    }

    return Tracked(fix.coordinates)
}`;

// строки доказательства: объявление с типом + гард целиком
const CL_PROOF_FROM = 7;             // val fix: Fix? = tracking.latestFix(flight)
const CL_PROOF_TO = 11;              // закрывающая скобка гарда

const TYPE_NAMES = [
  'FlightId', 'Coordinates', 'Fix', 'Position', 'Tracked',
  'NotDeparted', 'Landed', 'Restricted', 'OutOfCoverage', 'Stale', 'FeedTimeout',
];

const CODE_RULES = [
  ...buildCanonRules({
    types: TYPE_NAMES,
    vars: ['flight', 'flights', 'tracking', 'fix', 'flightId', 'coordinates'],
  }),
  {match: /^(sealed|data)$/, color: Canon.keyword},
];

const MORPH = {
  recolorLine: paintCanonMethodCallsLine,
  addStyle: 'typewriter' as const,
  lineOrder: 'sequential' as const,
  settleBeforeType: true,
  diffPreferEarlyMatches: true,
  moveDuration: 0.5,
  removeDuration: 0,
  charDelay: 0.014,
  lineDelay: 0.12,
  // ⚠️ 0, как в предыдущей сцене: текст ВСТАВЛЯЕТСЯ ВНУТРЬ существующей строки,
  // и при ненулевом слайде хвост едет туда же, куда печатается новое.
  tokenSlideDuration: 0,
  flashRemovedColor: 'rgba(244,241,235,0.32)',
  flashRemovedDuration: 0.22,
  flashRemovedErase: 'reverseType' as const,
  flashRemovedEraseCharDelay: 0.011,
};

// ── табло (геометрия предыдущей сцены, один в один) ─────────────────────
const MAP_FILL = '#121419';
const MAP_EDGE = 'rgba(244,241,235,0.16)';
const MAP_HAIR = 'rgba(244,241,235,0.07)';
const MAP_SHADOW = 'rgba(0,0,0,0.55)';
const MAP_RADIUS = 18;
const INK = 'rgba(244,241,235,0.96)';
const DIM = 'rgba(244,241,235,0.40)';
const CELL_C = 'rgba(244,241,235,0.90)';
const LOST_C = 'rgba(244,241,235,0.30)';

const BOARD_W = 900;
const BOARD_H = 600;
const BOARD_X = 462;
const BOARD_Y = TOP + BOARD_H / 2 - CODE_LH / 2;
const ROW_H = 91;
const ROW_DY = 26;
const FLIGHT_FS = 34;
const ROUTE_FS = 26;
const STATUS_FS = 32;
const HEAD_FS = 18;
const HEAD_Y = -235;
const RULE_W = 780;
const COL_FLIGHT = -353;
const COL_ROUTE = -164;
const COL_STATUS = 65;
const ICON_X = -413;
const ICON_S = 1.02;

// ⚠️⚠️ ЗАГОЛОВКА `PUBLIC TRACKER` НЕТ (правка автора: «просто убери и всё, в
// изначальной версии его не было»). Он был набран тем же кеглем, разрядкой и
// краской, что `FLIGHT` / `ROUTE` / `STATUS`, — четыре одинаковые мелкие
// надписи стопкой в углу, и имя панели читалось как ещё одна колонка. Табло
// остаётся ровно тем же объектом, что в главах 1 и 4.

const FLIGHTS: [string, string, string][] = [
  ['BA 117', 'JFK → LHR', 'OUT OF COVERAGE'],
  ['AF 1680', 'CDG → FCO', 'NOT DEPARTED'],
  ['UA 964', 'EWR → LIS', 'LANDED 06:12'],
  ['N884JC', 'TEB → VNY', 'RESTRICTED'],
  ['IB 6585', 'MAD → BOG', 'NO DATA'],
];
const ROW_GONE = 3;                  // N884JC — тот самый борт

const PLANE = [
  'M 0 -13', 'L 2.2 -7', 'L 2.2 -2', 'L 13 5', 'L 13 7.6', 'L 2.2 4',
  'L 2.2 9', 'L 5 12.4', 'L 5 14', 'L 0 12.6', 'L -5 14', 'L -5 12.4',
  'L -2.2 9', 'L -2.2 4', 'L -13 7.6', 'L -13 5', 'L -2.2 -2', 'L -2.2 -7', 'Z',
].join(' ');

// ── шов ─────────────────────────────────────────────────────────────────
// ⚠️⚠️ ГРАНИЦА — НЕ ПРИВОЗНОЙ ПРЕДМЕТ, А ЗАЗОР МЕЖДУ ДВУМЯ КОЛОНКАМИ, НА
// КОТОРЫХ ПОСТРОЕН ВЕСЬ РОЛИК. Мост был бы неточной метафорой: глагол моста —
// «соединять и переносить всё», а глагол границы — «решать, что пройдёт», и
// для отказа у моста образа нет. Видимой линии НЕТ (правка автора: «серая
// вертикальная полоска по центру не нужна») — граница остаётся пустым зазором,
// SEAM_X лишь якорит пару «внутри | наружу» по обе его стороны.
// ⚠️ Подписи вроде `API BOUNDARY` не ставим: слева код, справа экран — это
// выучено композицией, а мини-подпись была бы из отвергнутого словаря.
const SEAM_X = -50;

// ── граница: пара «внутри | наружу» ─────────────────────────────────────
// ⚠️ Пара живёт в свободной полосе НАД обоими блоками (код начинается с −250,
// карточка табло — с −270), поэтому в финальном общем плане она никому не
// мешает и читается шапкой кадра.
const BND_FS = 50;
const BND_ADV = BND_FS * 0.6;
const BND_Y = -390;
const BND_GAP = 90;                  // отступ каждой стороны от шва
const IN_WORD = 'Restricted';
const OUT_HEAD = 'HTTP/1.1 ';
const OUT_OK = '403 Forbidden';
const OUT_LIE = '404 Not Found';
const IN_X = SEAM_X - BND_GAP;       // правый край слова (выключка вправо)
const OUT_X = SEAM_X + BND_GAP;      // левый край строки
const WIRE_C = 'rgba(244,241,235,0.52)';

// ── документ ────────────────────────────────────────────────────────────
// ⚠️⚠️ БУМАГУ НЕ ПОДДЕЛЫВАЕМ. Сканы Хоара работали, потому что тот документ
// ЖИВЁТ на бумаге. RFC на бумаге не живёт: его подлинная форма — моноширинный
// текст с беговым колонтитулом. Поэтому «сверстать своим моно» и «показать
// настоящий документ» здесь одно и то же, а состаренный скан был бы
// фальшивкой.
// ⚠️ Текст §15.5.4 приведён целиком, включая абзац с `SHOULD NOT` и вторым
// `MAY`: это язык стандарта, и он должен быть виден. Наш `MAY` не теряется —
// его находит маркер, а весь остальной лист к этому моменту в расфокусе.
// ⚠️ Двойные пробелы RFC сведены к одинарным: MC-Txt схлопывает пробельные
// серии, и по ним нельзя считать колонки.
const DOC_FS = 26;
const DOC_LH = 40;
const DOC_COLS = 66;
const DOC_HEAD_L = 'RFC 9110';
const DOC_HEAD_C = 'HTTP Semantics';
const DOC_HEAD_R = 'June 2022';
const DOC_SECTION = '15.5.4. 403 Forbidden';
const DOC_BODY: string[] = [
  '',
  DOC_SECTION,
  '',
  'The 403 (Forbidden) status code indicates that the server',
  'understood the request but refuses to fulfill it. A server that',
  'wishes to make public why the request has been forbidden can',
  'describe that reason in the response content (if any).',
  '',
  'If authentication credentials were provided in the request, the',
  'server considers them insufficient to grant access. The client',
  'SHOULD NOT automatically repeat the request with the same',
  'credentials. The client MAY repeat the request with new or',
  'different credentials. However, a request might be forbidden',
  'for reasons unrelated to the credentials.',
  '',
  'An origin server that wishes to "hide" the current existence of a',
  'forbidden target resource MAY instead respond with a status code',
  'of 404 (Not Found).',
  '',
  // ⚠️ Следующий раздел стандарта — буквально `404 Not Found`, и он остаётся
  // в кадре под уликой: страница продолжается, лист не обрывается пустотой, а
  // тот, кто читает по-настоящему, видит, куда всё идёт, раньше голоса. Это не
  // подмигивание — это то, что на странице и написано.
  '15.5.5. 404 Not Found',
];
const DOC_R0 = 1;                    // строка 0 — колонтитул, рисуется отдельно
const DOC_SEC_ROWS = [2, 20];
const MARK_FROM = 16;                // предложение-улика: три строки
const MARK_TO = 18;
const MAY_ROW = 17;
const MAY_COL = 26;                  // 'forbidden target resource ' = 26 знаков
const DOC_ROWS = DOC_BODY.length + 1;
const DOC_MID = (DOC_ROWS - 1) / 2;
const DOC_PUSH_S = 1.7;              // наезд на предложение

const DOC_INK = 'rgba(244,241,235,0.80)';
const DOC_RUN = 'rgba(232,207,174,0.50)';
const DOC_SEC_C = 'rgba(232,207,174,0.95)';
const DOC_SCRIM = '#0B0C10';

// ⚠️⚠️ МЕТКИ-ПЛАШКИ НЕТ (правка автора: «розовых фраз больше не нужно
// добавлять»). Первая версия несла розовый маркер из акта 1 — рифму с чтением
// Хоара, — но это была ещё одна розовая фраза, то есть прямое нарушение.
// Взамен работает то, что у сцены уже есть: страница ушла в расфокус, а
// предложение осталось резким. Метка — не предмет поверх бумаги, а СВЕТ
// ЧТЕНИЯ: три строки по очереди набирают полную краску, остальные остаются
// приглушёнными. Это канон автора — состояние через краску и типографику,
// а не через плашку.
const DOC_MARK_C = 'rgba(246,243,238,0.98)';

// ── такты ───────────────────────────────────────────────────────────────
const ARRIVE_IN = 1.2;
const ARRIVE_HOLD = 1.4;             // ⚠️ VO — кадр, на котором мы остановились
const DIVE = 1.6;
const DIVE_HOLD = 0.5;
const ANNOT_HOLD = 0.6;
// ⚠️ Наезд считан по ВЫСОТЕ ФИНАЛЬНОГО кода: 19 строк × 40 = 760px. При 1.5
// функция вставала больше кадра и нижняя скобка срезалась; 1.28 оставляет по
// ~40px воздуха сверху и снизу.
const DIVE_S = 1.28;
const RACK = 0.9;
const RACK_HOLD = 2.2;               // ⚠️ VO — последний честный null
const CODE_BLUR = 5;
// ⚠️ У кода и табло РАЗНЫЕ значения расфокуса, и это не вкусовщина: кегль
// табло (34) сильно крупнее кода (25), и при одинаковом блюре его строки
// продолжают читаться и тянут глаз, пока мы смотрим в код.
const CODE_AWAY = 7;
const BOARD_AWAY = 11;
const RISE = 1.8;
const BND_S = 1.4;                   // масштаб границы; на проезде НЕ меняется
const IN_IN = 0.6;
const IN_HOLD = 0.7;                 // слово внутри стоит одно, до ответа наружу
const CROSS = 1.5;                   // боковой проезд через зазор
const TYPE_CD = 0.032;
const BND_HOLD = 1.6;                // ⚠️ VO — честный перевод
const DOC_IN = 1.1;
const DOC_READ = 1.8;                // ⚠️ VO — сухая страница стандарта
const DOC_PUSH = 1.5;
const DOC_BLUR = 4;
const MARK_STEP = 0.14;
const MARK_IN = 0.42;
const MARK_HOLD = 0.8;
const MAY_IN = 0.45;
const MAY_HOLD = 2.4;                // ⚠️ VO — стандарт разрешает скрыть
const DOC_OUT = 0.9;
const BACK_HOLD = 0.7;
const FLIP_GAP = 0.3;
const FLIP_HOLD = 2.0;               // ⚠️ VO — внутри не изменилось ничего
const TO_BOARD = 1.6;
const BOARD_HOLD = 1.2;
const ROW_OUT = 0.95;
const ROW_CLOSE = 0.7;
const GONE_HOLD = 1.6;               // ⚠️ VO — следов не осталось
const TO_WIDE = 1.8;
const WIDE_HOLD = 4.0;               // ⚠️ VO — правда слева, тишина справа
const TAIL = 1.0;

// ═══════════════════════════════════════════════════════════════════════
export default makeScene2D(function* (view) {
  applyBackground(view);

  // де-эмфазис делается РАСФОКУСОМ, не прозрачностью: цель остаётся резкой,
  // контекст уходит в мягкое. cache(true) нужен, чтобы фильтру было к чему
  // применяться, cachePadding — чтобы блюр не срезало по краю ноды.
  const attachBlur = (node: Node, padding = 56) => {
    const s = createSignal(0);
    node.cache(true);
    node.cachePadding(padding);
    node.filters(() => [blur(s())]);
    return s;
  };
  type Blur = ReturnType<typeof attachBlur>;

  // объект приходит и уходит КАК ОДНО — расфокусом вместе с прозрачностью,
  // а не постадийным проявлением частей
  const proveIn = function* (n: Node, b: Blur, dur: number, amt: number): ThreadGenerator {
    b(amt);
    n.opacity(0);
    yield* all(n.opacity(1, dur, easeOutCubic), b(0, dur, easeInOutSine));
  };
  const proveOut = function* (n: Node, b: Blur, dur: number, amt: number): ThreadGenerator {
    yield* all(n.opacity(0, dur, easeInCubic), b(amt, dur, easeInOutSine));
  };

  const typeOn = function* (t: Txt, full: string, cd = TYPE_CD): ThreadGenerator {
    for (let i = 1; i <= full.length; i++) {
      t.text(full.slice(0, i));
      yield* waitFor(cd);
    }
  };
  const typeOff = function* (t: Txt, cd = TYPE_CD * 0.8): ThreadGenerator {
    const s = t.text();
    for (let i = s.length - 1; i >= 0; i--) {
      t.text(s.slice(0, i));
      yield* waitFor(cd);
    }
  };

  // ── мир ───────────────────────────────────────────────────────────────
  // ⚠️ Одна нода на всю сцену: камера — это её position/scale. Всё, что
  // появляется, появляется ВНУТРИ неё и остаётся там до конца.
  const world = createRef<Node>();
  view.add(<Node ref={world} />);
  const worldBlur = attachBlur(world(), 120);

  // ⚠️ look() — единственный способ двигать камеру в сцене. Чтобы мировая
  // точка (x,y) встала в центр кадра при масштабе s, нода мира обязана стоять
  // в −s·(x,y): другого места у неё нет.
  const look = (x: number, y: number, s: number, dur: number, ease = easeInOutCubic) => [
    world().scale([s, s], dur, ease),
    world().position([-x * s, -y * s], dur, ease),
  ];
  const put = (x: number, y: number, s: number) => {
    world().scale([s, s]);
    world().position([-x * s, -y * s]);
  };

  // ── код ───────────────────────────────────────────────────────────────
  const codeWrap = createRef<Node>();
  world().add(<Node ref={codeWrap} />);
  const codeBlur = attachBlur(codeWrap(), 90);
  const code = Manticore.create(S5, {
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
    customTypes: TYPE_NAMES,
  });
  code.mount(codeWrap());
  code.colorize(CODE_RULES);
  paintCanonMethodCalls(code);
  code.node.opacity(1);

  // мировые координаты строки кода — нужны камере
  const codeLineY = (i: number) => CODE_Y + code.getLineY(i);

  // ── табло ─────────────────────────────────────────────────────────────
  // ⚠️ Строки собраны ОТДЕЛЬНЫМИ НОДАМИ (в предыдущей сцене они были россыпью
  // текстов): строка обязана уметь исчезнуть КАК ОДНО и увести с собой свою
  // волосяную линейку, иначе на её месте останется след — а вся мысль в том,
  // что следа нет.
  const boardWrap = createRef<Node>();
  world().add(<Node ref={boardWrap} />);
  const boardBlur = attachBlur(boardWrap(), 90);

  const board = createRef<Node>();
  boardWrap().add(<Node ref={board} x={BOARD_X} y={BOARD_Y} />);

  board().add(
    <Rect
      width={BOARD_W}
      height={BOARD_H}
      radius={MAP_RADIUS}
      fill={MAP_FILL}
      stroke={MAP_EDGE}
      lineWidth={1}
      shadowColor={MAP_SHADOW}
      shadowBlur={34}
      shadowOffset={[0, 16]}
    />,
  );

  const chrome = (x: number, y: number, t: string) =>
    board().add(
      <Txt
        text={t}
        x={x}
        y={y}
        offset={[-1, 0]}
        fontFamily={MONO}
        fontSize={HEAD_FS}
        letterSpacing={2.4}
        fill={DIM}
      />,
    );
  chrome(COL_FLIGHT, HEAD_Y, 'FLIGHT');
  chrome(COL_ROUTE, HEAD_Y, 'ROUTE');
  chrome(COL_STATUS, HEAD_Y, 'STATUS');
  board().add(
    <Rect width={RULE_W} height={1} y={HEAD_Y + 36} fill="rgba(244,241,235,0.11)" />,
  );

  const rowY = (i: number) => (i - (FLIGHTS.length - 1) / 2) * ROW_H + ROW_DY;

  board().add(
    <Path data={PLANE} x={ICON_X} y={rowY(0)} rotation={90} scale={ICON_S} fill={LOST_C} />,
  );

  const rows: Node[] = [];
  const rowBlur: Blur[] = [];
  FLIGHTS.forEach(([id, route, status], i) => {
    const row = new Node({y: rowY(i)});
    if (i > 0) {
      row.add(new Rect({width: RULE_W, height: 1, y: -ROW_H / 2, fill: MAP_HAIR}));
    }
    const cell = (x: number, t: string, size: number, fill: string, weight = 400) =>
      row.add(
        new Txt({
          text: t, x, offset: [-1, 0], fontFamily: MONO,
          fontSize: size, fontWeight: weight, fill,
        }),
      );
    cell(COL_FLIGHT, id, FLIGHT_FS, INK, 500);
    cell(COL_ROUTE, route, ROUTE_FS, DIM);
    cell(COL_STATUS, status, STATUS_FS, CELL_C);
    board().add(row);
    rows.push(row);
    rowBlur.push(attachBlur(row, 40));
  });

  // ── граница ───────────────────────────────────────────────────────────
  const bnd = createRef<Node>();
  world().add(<Node ref={bnd} />);

  const inWord = createRef<Txt>();
  bnd().add(
    <Txt
      ref={inWord}
      text={IN_WORD}
      x={IN_X}
      y={BND_Y}
      offset={[1, 0]}
      fontFamily={MONO}
      fontSize={BND_FS}
      fill={Canon.type}
      opacity={0}
    />,
  );
  const inBlur = attachBlur(inWord(), 40);

  const outHead = createRef<Txt>();
  const outTail = createRef<Txt>();
  bnd().add(
    <Txt
      ref={outHead}
      text=""
      x={OUT_X}
      y={BND_Y}
      offset={[-1, 0]}
      fontFamily={MONO}
      fontSize={BND_FS}
      fill={WIRE_C}
    />,
  );
  bnd().add(
    <Txt
      ref={outTail}
      text=""
      x={OUT_X + OUT_HEAD.length * BND_ADV}
      y={BND_Y}
      offset={[-1, 0]}
      fontFamily={MONO}
      fontSize={BND_FS}
      fill={INK}
    />,
  );

  // ── документ ──────────────────────────────────────────────────────────
  // ⚠️ Шаг литеры МЕРЯЕТСЯ В РАНТАЙМЕ пробой, а не берётся как 0.6·кегль:
  // по нему считается колонка слова `MAY`, и ошибка в сотых развалила бы строку.
  const probe = new Txt({text: '0000000000', fontFamily: MONO, fontSize: DOC_FS});
  view.add(probe);
  const DOC_ADV = probe.width() / 10;
  probe.remove();

  const DOC_LEFT = -(DOC_COLS * DOC_ADV) / 2;
  const docRowY = (i: number) => (i - DOC_MID) * DOC_LH;

  const doc = createRef<Node>();
  view.add(<Node ref={doc} opacity={0} />);
  const docBlur = attachBlur(doc(), 90);

  // ⚠️ Скрим в цвет фона и НА ВЕСЬ КАДР: у него нет ни одной видимой кромки,
  // поэтому он не читается плашкой — он просто гасит мир под документом,
  // оставляя его мерцать. Тот же приём, что подложка под субтитрами.
  doc().add(<Rect width={2600} height={1500} fill={DOC_SCRIM} opacity={0.88} />);

  const docBody = createRef<Node>();
  doc().add(<Node ref={docBody} />);

  docBody().add(
    <Txt text={DOC_HEAD_L} x={DOC_LEFT} y={docRowY(0)} offset={[-1, 0]}
      fontFamily={MONO} fontSize={DOC_FS} fill={DOC_RUN} letterSpacing={1.2} />,
  );
  docBody().add(
    <Txt text={DOC_HEAD_C} x={0} y={docRowY(0)}
      fontFamily={MONO} fontSize={DOC_FS} fill={DOC_RUN} letterSpacing={1.2} />,
  );
  docBody().add(
    <Txt text={DOC_HEAD_R} x={-DOC_LEFT} y={docRowY(0)} offset={[1, 0]}
      fontFamily={MONO} fontSize={DOC_FS} fill={DOC_RUN} letterSpacing={1.2} />,
  );

  const docRow: Node[] = [];
  const docRowBlur: Blur[] = [];
  DOC_BODY.forEach((text, k) => {
    const i = k + DOC_R0;
    const row = new Node({y: docRowY(i)});
    if (text.length > 0) {
      if (i === MAY_ROW) {
        // ⚠️ Строка режется на три куска, чтобы `MAY` можно было перекрасить,
        // не подкладывая второй текст поверх первого (двойной набор жирнит).
        // Позиции — по измеренному шагу литеры, стык в стык.
        row.add(new Txt({
          text: text.slice(0, MAY_COL), x: DOC_LEFT, offset: [-1, 0],
          fontFamily: MONO, fontSize: DOC_FS, fill: DOC_INK,
        }));
        row.add(new Txt({
          text: 'MAY', x: DOC_LEFT + MAY_COL * DOC_ADV, offset: [-1, 0],
          fontFamily: MONO, fontSize: DOC_FS, fill: DOC_INK,
        }));
        row.add(new Txt({
          text: text.slice(MAY_COL + 3), x: DOC_LEFT + (MAY_COL + 3) * DOC_ADV,
          offset: [-1, 0], fontFamily: MONO, fontSize: DOC_FS, fill: DOC_INK,
        }));
      } else {
        row.add(new Txt({
          text, x: DOC_LEFT, offset: [-1, 0], fontFamily: MONO, fontSize: DOC_FS,
          fill: DOC_SEC_ROWS.includes(i) ? DOC_SEC_C : DOC_INK,
          fontWeight: DOC_SEC_ROWS.includes(i) ? 600 : 400,
        }));
      }
    }
    docBody().add(row);
    docRow.push(row);
    docRowBlur.push(attachBlur(row, 40));
  });
  const mayTxt = docRow[MAY_ROW - DOC_R0].children()[1] as Txt;

  // строки помеченного предложения — по ним пойдёт свет чтения
  const markRows: Txt[][] = [];
  for (let i = MARK_FROM; i <= MARK_TO; i++) {
    markRows.push(docRow[i - DOC_R0].children() as Txt[]);
  }

  // ═══════════════ ТАЙМЛАЙН ════════════════════════════════════════════
  // ═══ 0. Кадр, которым кончилась предыдущая сцена ═════════════════════
  // ⚠️ Мир проявляется КАК ОДНО: граница не «приходит» позже — зазор между
  // колонками был здесь всегда, мы просто до него доедем.
  put(0, 0, 1);
  yield* proveIn(world(), worldBlur, ARRIVE_IN, 14);
  yield* waitFor(ARRIVE_HOLD);

  // ═══ 1. Ныряем в код ════════════════════════════════════════════════
  // ⚠️ Табло уходит в расфокус ВО ВРЕМЯ наезда, одним движением с камерой:
  // мы не «выключаем» его, мы просто смотрим не туда.
  const fixY = (codeLineY(CL_PROOF_FROM) + codeLineY(CL_PROOF_TO)) / 2;
  yield* all(
    ...look(CODE_X + CODE_LEFT + 23 * CODE_ADV, fixY, DIVE_S, DIVE),
    boardBlur(BOARD_AWAY, DIVE, easeInOutSine),
  );
  yield* waitFor(DIVE_HOLD);

  // ⚠️ Морф идёт по НЕзаблюренному блоку: блюр требует cache на нодах строк,
  // а Manticore при морфе эти ноды пересобирает. Сначала правка, потом рэк.
  yield* code.morphTo(S5A, MORPH);
  yield* waitFor(ANNOT_HOLD);

  // ⚠️ Рэк по СТРОКАМ, а не по токенам: доказательство — это ПАРА строк
  // (тип и его перевод в имя), и рвать её подсветкой одного слова нельзя.
  const lineBlur: Blur[] = [];
  for (let i = 0; i < code.lineCount; i++) {
    const ln = code.getLine(i);
    lineBlur.push(ln ? attachBlur(ln.node, 40) : createSignal(0));
  }
  yield* all(
    ...lineBlur.map((b, i) =>
      b(i >= CL_PROOF_FROM && i <= CL_PROOF_TO ? 0 : CODE_BLUR, RACK, easeInOutSine),
    ),
  );
  yield* waitFor(RACK_HOLD);

  // ═══ 2. Всплытие к границе ══════════════════════════════════════════
  // ⚠️ ОДНО ДВИЖЕНИЕ: камера идёт вверх-вправо, рэк отпускается ПО ДОРОГЕ, и
  // тем же движением весь код уходит в мягкое целиком. Читается как «мы
  // оставили код позади», а не как три отдельных события.
  // ⚠️⚠️ `Restricted` ПРОЯВЛЯЕТСЯ ПО ДОРОГЕ, а не по приезде. Без этого камера
  // почти две секунды едет в пустой верх кадра и приезжает в ничто — ровно тот
  // показ зарезервированной пустоты, который здесь не нужен. Теперь мы едем К
  // ЧЕМУ-ТО: слово собирается из расфокуса, пока камера ещё в движении, и это
  // же снимает лишний такт после прибытия.
  // ⚠️⚠️ ВСПЛЫТИЕ ИДЁТ К САМОМУ СЛОВУ, А НЕ К ЦЕНТРУ ПАРЫ. Когда камера сразу
  // вставала на пару, она приезжала в кадр, где слово прижато влево, а две
  // трети экрана держат пустоту в ожидании ещё не напечатанного ответа. Теперь
  // мы приезжаем к слову, стоящему в центре: внутренняя правда сначала одна.
  const bndL = IN_X - IN_WORD.length * BND_ADV;
  const bndR = OUT_X + (OUT_HEAD + OUT_OK).length * BND_ADV;
  const inMid = (bndL + IN_X) / 2;     // центр слова
  const bndMid = (bndL + bndR) / 2;    // центр пары
  yield* all(
    ...look(inMid, BND_Y, BND_S, RISE),
    ...lineBlur.map(b => b(0, RISE * 0.7, easeInOutSine)),
    chain(waitFor(RISE * 0.35), codeBlur(CODE_AWAY, RISE * 0.65, easeInOutSine)),
    chain(waitFor(RISE * 0.55), proveIn(inWord(), inBlur, IN_IN, 10)),
  );

  // ═══ 3. Честный перевод ═════════════════════════════════════════════
  // ⚠️ Две стороны приходят РАЗНЫМИ жестами, и это не приём, а смысл.
  // `Restricted` проявился как одно — он уже существует, он внутренняя правда.
  // Строка ответа ПЕЧАТАЕТСЯ — её пишут прямо сейчас, в провод, и она есть
  // следствие того, что слева уже лежит.
  // ⚠️⚠️ КАМЕРА ЕДЕТ ВБОК НА ТОМ ЖЕ МАСШТАБЕ, И ЭТО САМО ПЕРЕСЕЧЕНИЕ ГРАНИЦЫ:
  // кадр уходит от внутреннего слова наружу, зазор проходит через центр, и
  // ответ печатается ровно в то место, которое проезд только что открыл.
  // Пустоты не остаётся ни на одном кадре — она не «ждёт текста», она едет.
  yield* waitFor(IN_HOLD);
  yield* all(
    ...look(bndMid, BND_Y, BND_S, CROSS),
    chain(
      waitFor(CROSS * 0.28),
      typeOn(outHead(), OUT_HEAD),
      typeOn(outTail(), OUT_OK),
    ),
  );
  yield* waitFor(BND_HOLD);

  // ═══ 4. Документ ════════════════════════════════════════════════════
  // ⚠️ Мир не гаснет и никуда не уходит — он уходит в расфокус под скримом и
  // продолжает жить под страницей. Возврат будет ровно в ту же точку.
  yield* all(
    worldBlur(9, DOC_IN, easeInOutSine),
    proveIn(doc(), docBlur, DOC_IN, 12),
  );
  yield* waitFor(DOC_READ);

  // наезд на предложение + рэк остального листа — одним движением
  const markY = docRowY((MARK_FROM + MARK_TO) / 2);
  yield* all(
    docBody().scale([DOC_PUSH_S, DOC_PUSH_S], DOC_PUSH, easeInOutCubic),
    docBody().position([0, -markY * DOC_PUSH_S], DOC_PUSH, easeInOutCubic),
    ...docRowBlur.map((b, k) => {
      const i = k + DOC_R0;
      return b(i >= MARK_FROM && i <= MARK_TO ? 0 : DOC_BLUR, DOC_PUSH, easeInOutSine);
    }),
  );

  // ⚠️ Свет чтения идёт СВЕРХУ ВНИЗ по трём строкам — один непрерывный спуск.
  // Предложение одно, значит и метка одна: три строки добираются до полной
  // краски по очереди, но читаются как одно движение глаза по фразе.
  yield* all(
    ...markRows.map((txts, i) =>
      chain(
        waitFor(i * MARK_STEP),
        all(...txts.map(t => t.fill(DOC_MARK_C, MARK_IN, easeOutCubic))),
      ),
    ),
  );
  yield* waitFor(MARK_HOLD);

  // ⚠️ `MAY` не вспыхивает и не увеличивается — он просто становится синим,
  // то есть КЛЮЧЕВЫМ СЛОВОМ по канону палитры. Это и есть правда: в RFC 2119
  // заглавное MAY — зарезервированное слово стандарта, а не ударение автора.
  yield* mayTxt.fill(Canon.keyword, MAY_IN, easeOutCubic);
  yield* waitFor(MAY_HOLD);

  // ═══ 5. Возврат ═════════════════════════════════════════════════════
  // ⚠️ Пока мы читали, снаружи не изменилось НИЧЕГО: `403` на месте. Пауза
  // здесь обязательна — без неё подмена слипнется с уходом документа и
  // перестанет быть решением.
  yield* all(
    proveOut(doc(), docBlur, DOC_OUT, 12),
    worldBlur(0, DOC_OUT, easeInOutSine),
  );
  yield* waitFor(BACK_HOLD);

  // ═══ 6. Решение ═════════════════════════════════════════════════════
  // ⚠️ ПЕРЕПЕЧАТКА, а не кроссфейд и не морф: подмена обязана выглядеть как
  // правка, сделанная руками. Слева при этом не двигается ни один пиксель —
  // внутренняя правда в этом событии не участвует вовсе.
  yield* typeOff(outTail());
  yield* waitFor(FLIP_GAP);
  yield* typeOn(outTail(), OUT_LIE, TYPE_CD * 1.1);
  yield* waitFor(FLIP_HOLD);

  // ═══ 7. Публичная запись исчезает ═══════════════════════════════════
  yield* all(
    ...look(380, -130, 1.15, TO_BOARD),
    boardBlur(0, TO_BOARD, easeInOutSine),
  );
  yield* waitFor(BOARD_HOLD);

  // ⚠️ БЕЗ КРАСНОГО И БЕЗ ДРОЖИ — сознательная инверсия аварийного такта
  // главы 1, где сбой кричал. Здесь не инцидент, а политика: строка уходит
  // беззвучно, КАК ОДНО, вместе со своей линейкой.
  yield* all(
    rows[ROW_GONE].opacity(0, ROW_OUT, easeInCubic),
    rowBlur[ROW_GONE](12, ROW_OUT, easeInOutSine),
  );
  rows[ROW_GONE].remove();

  // ⚠️ Соседи СМЫКАЮТСЯ. Останься зазор — он и был бы следом, а вся мысль в
  // том, что следа не остаётся.
  yield* all(
    ...rows.slice(ROW_GONE + 1).map((r, k) =>
      r.y(rowY(ROW_GONE + k), ROW_CLOSE, easeInOutCubic),
    ),
  );
  yield* waitFor(GONE_HOLD);

  // ═══ 8. Общий план ══════════════════════════════════════════════════
  // ⚠️ Финальный кадр — тот же, с которого сцена началась, и в этом всё:
  // слева в коде по-прежнему `return Restricted`, справа — `404 Not Found`,
  // между ними пустой зазор. Ничего не подсвечиваем: читается форма.
  yield* all(
    ...look(0, 0, 1, TO_WIDE),
    codeBlur(0, TO_WIDE, easeInOutSine),
  );
  yield* waitFor(WIDE_HOLD);

  yield* proveOut(world(), worldBlur, TAIL, 10);
  yield* waitFor(0.3);
});
