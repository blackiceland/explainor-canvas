import {Node, Path, Rect, Txt, blur, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  chain,
  createRef,
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
// РЕШЕНИЕ · У ПРИЧИН ПОЯВЛЯЮТСЯ ИМЕНА.
//
// ⚠️⚠️ ПОСТАНОВКА АВТОРА, дословно: «в начале показать типы, затем сдвинуть
// вправо на место таблицы, таблицу не показывать пока, код слева обогащается
// типами, выделяется возвращаемый тип, появляется таблица с нормальными
// табличными статусами».
//
// ⚠️⚠️ СЛОВАРЬ ВСТАЁТ НА МЕСТО ТАБЛО — в этом вся сила постановки. Тип занимает
// ту точку кадра, где потом будет продуктовый экран, и экран приходит ему на
// смену: «то, что видит человек, — проекция контракта» сказано МЕСТОМ, без
// стрелок и подписей. Побочно закрыта арифметика: к моменту, когда табло
// называет пять причин, словарь уже отстоял рядом с кодом.
//
// ⚠️⚠️ РАСПЛАТА ИДЁТ НА ТОМ ЖЕ КОДЕ, ЧТО И БОЛЕЗНЬ. Это `currentPosition` из
// `nullMeansChapterOneStandEn` — функция, чья сигнатура не менялась три года,
// пока тело обрастало гардами. Выстрел «сигнатура наконец изменилась» заряжен
// неподвижностью ПРЕДЫДУЩЕЙ сцены; на чужом коде его бы не было.
//
// ДУГА (~24с):
//   A. Словарь причин один в кадре. Конструктор `Tracked` стоит одной строкой.
//   B. Словарь уезжает ВПРАВО ПО ПРЯМОЙ, и по дороге длинная строка
//      ПЕРЕВЁРСТЫВАЕТСЯ: хвост физически съезжает вниз-влево на свои места,
//      запятая проявляется на разрыве. Слева въезжает код с тремя `return null`.
//   C. Подстановка по одному имени. Каждое имя приходит СВОИМ цветом, и тем же
//      цветом в тот же момент вспыхивает его двойник в словаре; когда приходит
//      следующее, предыдущее оседает в канон-лаванду.
//   D. Последним меняется возвращаемый тип: гаснет всё, кроме слова `Position`
//      в сигнатуре и слова `Position` в шапке словаря.
//   E. Словарь растворяется, на его месте проступает табло. Код возвращается
//      в полную силу — финальный кадр здоровый.
// ═══════════════════════════════════════════════════════════════════════

const MONO = Fonts.code;

// ── общий верхний уровень ───────────────────────────────────────────────
// ⚠️⚠️ ОДНА КОНСТАНТА НА ВСЮ КОМПОЗИЦИЮ (правка автора: «код не на одном
// уровне»). Первая строка кода, первая строка словаря и верхняя кромка
// карточки табло считаются отсюда. Раньше словарь центровался по своей высоте
// и вставал на 16px ниже кода — на глаз мелочь, в кадре видно сразу.
const TOP = -250;

// ── словарь причин ──────────────────────────────────────────────────────
// ⚠️ Блок собран СРАЗУ в перенесённом виде, а широкое состояние отыгрывается
// смещением строк (см. WRAP_* ниже). Так перенос — настоящая перевёрстка одних
// и тех же токенов, а не подмена одного текста другим.
// ⚠️ Шесть одинаковых `object X : Position` стоят ровной колонкой, и только
// случай с данными имеет другую ФОРМУ — многострочную. Форма сама говорит, кто
// здесь исключение; отступы при этом у всех одинаковые.
// ⚠️ Причин ШЕСТЬ, а функция возвращает ТРИ — так и должно быть: тип это словарь
// всей системы, функция — один его говорящий. Поэтому табло умеет сказать
// «NOT DEPARTED» и «LANDED», хотя этих гардов в кадре нет.
const DECL = `sealed interface Position {
    data class Tracked(
        val coordinates: Coordinates,
    ) : Position

    object NotDeparted : Position
    object Landed : Position
    object Restricted : Position
    object OutOfCoverage : Position
    object Stale : Position
    object FeedTimeout : Position
}`;

const L_HEAD = 0;
const L_TRACKED = 1;
const L_RESTRICTED = 7;
const L_COVERAGE = 8;
const L_STALE = 9;

const DECL_FS = 30;
const DECL_LH = 48;
const DECL_ADV = DECL_FS * 0.6;
// ⚠️ Ширина считана по ШИРОКОМУ состоянию строки `data class Tracked(...)`:
// 63 знака × 18 = 1134 плюс поля Manticore (padX при кегле 30 = 56) с обеих
// сторон. Тогда при x = 0 широкий вариант стоит ровно по центру кадра.
const DECL_W = 1246;
const DECL_PAD_X = 56;
const DECL_PAD_Y = 48;
// ⚠️ Высота ЗАДАНА (не auto): при auto Manticore центрирует блок по контенту,
// и строка 0 уехала бы. С заданной высотой контент прижат к верху и строка 0
// стоит намертво — на этом держится общий уровень блоков.
const DECL_H = 760;
const DECL_START_Y = -(DECL_H - 2 * DECL_PAD_Y) / 2 + DECL_LH / 2;
// ⚠️⚠️ ВЕРТИКАЛИ В ДВИЖЕНИИ НЕТ (правка автора: «sealed пусть движется в одну
// линию по горизонтали, не смещаясь»). Значит и стартовать блок обязан на
// конечном уровне: y один на всю сцену, едет только x.
const DECL_Y = TOP - DECL_START_Y;

// ⚠️⚠️ ПЕРЕВЁРСТКА СЧИТАНА В ЗНАКАХ, не на глаз. Широкая строка:
//   `    data class Tracked(val coordinates: Coordinates) : Position`
//    0123 4..22 = `data class Tracked(`   23..50 = `val ... Coordinates`
//    51 = `)`   52..62 = ` : Position`
// В перенесённом виде `val` стоит на 8-м знаке своей строки, а должен на 23-м →
// смещение 15 знаков. `)` стоит на 4-м, а должен на 51-м → смещение 47 знаков.
// Запятая переноса приходится ровно под `)` — поэтому в широком виде её просто
// не видно, и она проявляется на разрыве, когда строки разъезжаются.
const WRAP_DX_VAL = 15 * DECL_ADV;
const WRAP_DX_TAIL = 47 * DECL_ADV;
const WRAP_ROWS = 2;                 // на столько строк вырастает блок

// ── код ─────────────────────────────────────────────────────────────────
const CODE_FS = 25;
const CODE_LH = 40;
const CODE_W = 830;
const CODE_X = -530;
// ⚠️ Заданная высота с запасом на ФИНАЛЬНОЕ состояние (15 строк), иначе блок
// доскроллится к изменённой строке и сигнатура уедет. Условие:
// CODE_H ≥ lines·LH + LH + 2·padY, padY = getCodePaddingY(25) = 46.
const CODE_H = 760;
const CODE_Y = TOP - (-(CODE_H - 92) / 2 + CODE_LH / 2);

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

// ⚠️⚠️ ПОДСТАНОВКА ИДЁТ ПО ОДНОМУ ИМЕНИ (правка автора: «при подстановке
// значения слева каждый тип пусть подсвечивается справа»). Поэтому не один
// большой морф, а пять маленьких состояний: на каждом шаге меняется ровно одна
// строка кода и вспыхивает ровно один тип в словаре.
// ⚠️ Возвращаемый тип меняется ПОСЛЕДНИМ: пока меняются возвраты, сигнатура —
// неподвижный якорь из главы 1, и её движение обязано быть отдельным событием.
const S0 = `fun currentPosition(flightId: FlightId): Coordinates? {
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

const S1 = `fun currentPosition(flightId: FlightId): Coordinates? {
    val flight = flights.byId(flightId)

    if (flight.isTrackingRestricted) {
        return Restricted
    }

    val fix = tracking.latestFix(flight) ?: return null

    if (fix.isStale()) {
        return null
    }

    return fix.coordinates
}`;

// ⚠️ Здесь единственная новая строка кода — ПЕРЕНОС: `?: return OutOfCoverage`
// длиннее `?: return null` на девять знаков и честно перестал помещаться.
// Побочно три названных возврата встают на собственные строки на одном отступе,
// и «три одинаковых стали тремя разными» читается вертикально, одним взглядом.
const S2 = `fun currentPosition(flightId: FlightId): Coordinates? {
    val flight = flights.byId(flightId)

    if (flight.isTrackingRestricted) {
        return Restricted
    }

    val fix = tracking.latestFix(flight)
        ?: return OutOfCoverage

    if (fix.isStale()) {
        return null
    }

    return fix.coordinates
}`;

const S3 = `fun currentPosition(flightId: FlightId): Coordinates? {
    val flight = flights.byId(flightId)

    if (flight.isTrackingRestricted) {
        return Restricted
    }

    val fix = tracking.latestFix(flight)
        ?: return OutOfCoverage

    if (fix.isStale()) {
        return Stale
    }

    return fix.coordinates
}`;

const S4 = `fun currentPosition(flightId: FlightId): Coordinates? {
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

// строки кода, на которых стоит очередное имя (в СВОЁМ состоянии)
const CL_RESTRICTED = 4;
const CL_COVERAGE = 8;
const CL_STALE = 11;
const CL_TRACKED = 14;

// ⚠️⚠️ ЦВЕТА ПОДСВЕТКИ — ТОЛЬКО НА МОМЕНТ (правка автора: «подсветка должна
// быть только у типа и пусть разными цветами в моменте выделяется»). Имя
// приходит своим цветом, тем же цветом вспыхивает двойник в словаре, и когда
// приходит следующее — предыдущее оседает в канон-лаванду. Цвет делает ровно
// одну работу: связывает левое слово с правым, и уходит.
// ⚠️ Постоянными их держать нельзя: код, который мы защищаем, не должен
// выглядеть радугой — урок в том, что смысл несут ИМЕНА, а не краска.
// ⚠️ Взяты из свободных зон палитры: лаванда занята типами, синий — ключевыми
// словами, роуз — вызовами, крем — идентификаторами. Соседние шаги никогда не
// горят похожими: терракота → тил → амбер → зелёный.
const ACC_RESTRICTED = '#E4977F';
const ACC_COVERAGE = '#A2CDD6';
const ACC_STALE = '#E0BE8A';
const ACC_TRACKED = '#94C086';

const TYPE_NAMES = [
  'FlightId', 'Coordinates', 'Position', 'Tracked',
  'NotDeparted', 'Landed', 'Restricted', 'OutOfCoverage', 'Stale', 'FeedTimeout',
];

// ⚠️ `sealed` и `data` токенайзер ключевыми не считает — дописываем правилом
// поверх канона (последнее совпадение побеждает).
const CODE_RULES = [
  ...buildCanonRules({
    types: TYPE_NAMES,
    vars: ['flight', 'flights', 'tracking', 'fix', 'flightId', 'coordinates'],
  }),
  {match: /^(sealed|data)$/, color: Canon.keyword},
];

const MORPH = {
  addStyle: 'typewriter' as const,
  lineOrder: 'sequential' as const,
  settleBeforeType: true,
  diffPreferEarlyMatches: true,
  moveDuration: 0.5,
  removeDuration: 0,
  charDelay: 0.012,
  lineDelay: 0.12,
  // ⚠️⚠️ 0, а НЕ 0.4 как в главе 1. При 0.4 пережившие токены ЕДУТ на новые
  // места, пока туда же печатается новый текст: на строке возврата `Tracked(`
  // набиралось поверх ещё не уехавшего `fix.coordinates` — каша на полсекунды.
  // В главе 1 такого не было: там правки дописывали строки целиком, а здесь
  // текст ВСТАВЛЯЕТСЯ ВНУТРЬ существующей.
  tokenSlideDuration: 0,
  flashRemovedColor: 'rgba(244,241,235,0.32)',
  flashRemovedDuration: 0.22,
  flashRemovedErase: 'reverseType' as const,
  flashRemovedEraseCharDelay: 0.011,
};

// ── табло ───────────────────────────────────────────────────────────────
// ⚠️ Карточка: заливку не трогаем (её выбирали отдельно, «не улучшать») —
// границу рисуют КРОМКА и ТЕНЬ. Карточка отделяется краем и высотой, а не
// новым оттенком.
const MAP_FILL = '#121419';
const MAP_EDGE = 'rgba(244,241,235,0.16)';
const MAP_HAIR = 'rgba(244,241,235,0.07)';
const MAP_SHADOW = 'rgba(0,0,0,0.55)';
const MAP_RADIUS = 18;
const INK = 'rgba(244,241,235,0.96)';
const DIM = 'rgba(244,241,235,0.40)';
const CELL_C = 'rgba(244,241,235,0.90)';
const LOST_C = 'rgba(244,241,235,0.30)';

// ⚠️⚠️ КОЛОНКИ РАЗВЕДЕНЫ ПО СМЫСЛУ: 46px между рейсом и маршрутом (одна вещь —
// кто летит) и 89px перед статусом (другая вещь — что с ним). Раньше между
// маршрутом и статусом было 34px при кегле 34, и две колонки данных читались
// одной строкой. Ширины: 7 знаков × 20.4 = 143 · 9 × 15.6 = 140 · 15 × 19.2 = 288.
const BOARD_W = 900;
const BOARD_H = 600;
const BOARD_X = 462;                 // правое поле 48px — как у окна карты в главе 1
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
// ⚠️ Силуэт борта живёт ВНЕ волосяных линий, в поле карточки — как в главе 1.
const ICON_X = -413;
const ICON_S = 1.02;

// ⚠️⚠️ СТАТУСЫ НАБРАНЫ ТАК ЖЕ, КАК `NO SIGNAL` В ГЛАВЕ 1 (вопрос автора:
// «почему NO SIGNAL выглядел иначе чем новые статусы?»). Это одна и та же
// ячейка одного и того же продукта: шрифт, кегль и РЕГИСТР обязаны совпадать,
// меняется только слово. `NO SIGNAL` был капсом — значит и правда капсом.
// Заодно колонка окончательно перестаёт читаться строками из журнала: настоящее
// табло говорит короткими прописными статусами.
// ⚠️ Цвет при этом ДРУГОЙ и это единственное различие по делу: розовым в ролике
// говорит экран, когда он угадывает; крем — это факт. Форма та же, правдивость
// разная.
// ⚠️ Четыре статуса из пяти дословно повторяют имена случаев типа, пятый —
// человеческий перевод `FeedTimeout`.
const FLIGHTS: [string, string, string][] = [
  ['BA 117', 'JFK → LHR', 'OUT OF COVERAGE'],
  ['AF 1680', 'CDG → FCO', 'NOT DEPARTED'],
  ['UA 964', 'EWR → LIS', 'LANDED 06:12'],
  ['N884JC', 'TEB → VNY', 'RESTRICTED'],
  ['IB 6585', 'MAD → BOG', 'NO DATA'],
];

// силуэт борта (вид сверху, нос в −y)
const PLANE = [
  'M 0 -13', 'L 2.2 -7', 'L 2.2 -2', 'L 13 5', 'L 13 7.6', 'L 2.2 4',
  'L 2.2 9', 'L 5 12.4', 'L 5 14', 'L 0 12.6', 'L -5 14', 'L -5 12.4',
  'L -2.2 9', 'L -2.2 4', 'L -13 7.6', 'L -13 5', 'L -2.2 -2', 'L -2.2 -7', 'Z',
].join(' ');

// ── такты ───────────────────────────────────────────────────────────────
const DECL_IN = 1.1;
const DECL_READ = 3.2;               // ⚠️ VO — словарь причин
const MOVE = 1.5;                    // словарь едет вправо и перевёрстывается
const CODE_READ = 2.2;               // ⚠️ VO — вот та самая функция
const ACC_IN = 0.45;
const ACC_OUT = 0.5;
const STEP_HOLD = 0.45;              // между именами
const NAMED_HOLD = 0.9;              // ⚠️ VO — после последнего имени
const SIG_HOLD = 1.2;                // ⚠️ VO — сигнатура наконец изменилась
const RACK = 0.8;
const RACK_DIM = 0.18;
const RACK_HOLD = 1.6;               // ⚠️ VO — тип, который она возвращает
const DECL_OUT = 0.6;
const TABLE_IN = 0.95;
const TABLE_HOLD = 3.6;              // ⚠️ VO — и экран наконец может это сказать
const TAIL = 0.9;

// ═══════════════════════════════════════════════════════════════════════
export default makeScene2D(function* (view) {
  applyBackground(view);

  // ⚠️ Совпадение ищем по СОБРАННОМУ тексту строки, а не по одному токену:
  // после typewriter-морфа токен может быть разложен на отдельные символы.
  const matchIdx = (toks: {text: string}[], re: RegExp): Set<number> => {
    let text = '';
    const span: [number, number][] = [];
    for (const t of toks) {
      const from = text.length;
      text += t.text;
      span.push([from, text.length]);
    }
    const hit = new Set<number>();
    const rx = new RegExp(re.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text)) !== null) {
      const [a, b] = [m.index, m.index + m[0].length];
      span.forEach(([from, to], i) => {
        if (from < b && to > a) hit.add(i);
      });
    }
    return hit;
  };

  // ⚠️ Слово ЦЕЛИКОМ, а не подстрока: в первой же строке кода стоит
  // `currentPosition`, а в гарде — `isTrackingRestricted`.
  const whole = (w: string) => new RegExp('(?<![A-Za-z])' + w + '(?![A-Za-z])');
  const wordToks = (mc: Manticore, li: number, w: string): Txt[] => {
    const line = mc.getLine(li);
    if (!line) return [];
    return [...matchIdx(line.tokens, whole(w))].map(i => line.tokens[i].ref());
  };

  // фокус-пулл: объект проявляется КАК ОДНО, а не по частям
  const pull = function* (n: Node, dur: number, amt: number): ThreadGenerator {
    n.filters([blur(amt)]);
    yield* all(
      n.opacity(1, dur, easeOutCubic),
      n.filters.blur(0, dur, easeInOutSine),
    );
    n.filters([]);
  };

  // ── словарь причин ────────────────────────────────────────────────────
  const declWrap = createRef<Node>();
  view.add(<Node ref={declWrap} opacity={0} cachePadding={100} />);
  const decl = Manticore.create(DECL, {
    x: 0,
    y: DECL_Y,
    width: DECL_W,
    height: DECL_H,
    fontSize: DECL_FS,
    lineHeight: DECL_LH,
    fontFamily: MONO,
    theme: CanonCodeTheme,
    cardStyle: CODE_CARD,
    glowAccent: false,
    noClip: true,
    customTypes: TYPE_NAMES,
  });
  decl.mount(declWrap());
  decl.colorize(CODE_RULES);
  paintCanonMethodCalls(decl);
  decl.node.opacity(1);

  // ⚠️ Конечное место: левое поле словаря встаёт ровно на будущую колонку
  // рейсов. Имена причин и коды бортов оказываются на одном левом краю —
  // соответствие, которое не надо ни подписывать, ни рисовать.
  const DECL_X1 = BOARD_X + COL_FLIGHT + DECL_W / 2 - DECL_PAD_X;

  // ⚠️⚠️ ШИРОКОЕ СОСТОЯНИЕ СОБИРАЕТСЯ СМЕЩЕНИЕМ УЖЕ СУЩЕСТВУЮЩИХ СТРОК, а не
  // вторым текстом (правка автора: «перенос дата класса ты сделал дешево,
  // должно анимироваться во время движения»). Хвост строки физически стоит на
  // первой строке, и во время переезда СЪЕЗЖАЕТ вниз-влево на своё место — та
  // же перевёрстка, что делает редактор. Фейд одного текста в другой этого не
  // показывает вовсе.
  const lineNode = (i: number) => decl.getLine(i)!.node;
  const rowY0 = decl.getLineY(L_TRACKED);
  lineNode(2).position([WRAP_DX_VAL, rowY0]);
  lineNode(3).position([WRAP_DX_TAIL, rowY0]);
  for (let i = 4; i < decl.lineCount; i++) {
    lineNode(i).y(decl.getLineY(i) - WRAP_ROWS * DECL_LH);
  }
  // запятая переноса: в широком виде её место занимает `)`, поэтому её просто
  // нет, и она проявляется на разрыве
  const commaTok = (() => {
    const toks = decl.getLine(2)!.tokens;
    for (let i = toks.length - 1; i >= 0; i--) {
      if (toks[i].text.trim() === ',') return toks[i].ref();
    }
    return null;
  })();
  commaTok?.opacity(0);

  const reflow = (dur: number): ThreadGenerator[] => {
    const anims: ThreadGenerator[] = [
      lineNode(2).position([0, decl.getLineY(2)], dur, easeInOutCubic),
      lineNode(3).position([0, decl.getLineY(3)], dur, easeInOutCubic),
    ];
    for (let i = 4; i < decl.lineCount; i++) {
      anims.push(lineNode(i).y(decl.getLineY(i), dur, easeInOutCubic));
    }
    if (commaTok) {
      anims.push(chain(waitFor(dur * 0.35), commaTok.opacity(1, dur * 0.4, easeOutCubic)));
    }
    return anims;
  };

  // ── код ───────────────────────────────────────────────────────────────
  // ⚠️ Manticore.mount() ставит своему контейнеру opacity 0. Держим блок
  // непрозрачным, а входом управляет обёртка.
  const codeWrap = createRef<Node>();
  view.add(<Node ref={codeWrap} opacity={0} cachePadding={90} />);
  const code = Manticore.create(S0, {
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

  // ⚠️ Имя печатается СРАЗУ своим цветом (хук `recolorLine` идёт после
  // канон-правил), а не вспыхивает после набора: иначе получилось бы два
  // события там, где смысл один.
  const stepMorph = (w: string, accent: string) => ({
    ...MORPH,
    recolorLine: (line: any) => {
      paintCanonMethodCallsLine(line);
      matchIdx(line.tokens, whole(w)).forEach(i => line.tokens[i].ref().fill(accent));
    },
  });

  // потокенный рэк: гаснет всё, кроме указанного слова в указанной строке
  const rackTo = (mc: Manticore, keepLine: number, w: string, dim: number, dur: number) => {
    const anims: ThreadGenerator[] = [];
    for (let li = 0; li < mc.lineCount; li++) {
      const line = mc.getLine(li);
      if (!line) continue;
      const lit = li === keepLine ? matchIdx(line.tokens, whole(w)) : new Set<number>();
      line.tokens.forEach((t, i) =>
        anims.push(t.ref().opacity(lit.has(i) ? 1 : dim, dur, easeInOutSine)),
      );
    }
    return anims;
  };
  const rackBack = (mc: Manticore, dur: number) => {
    const anims: ThreadGenerator[] = [];
    for (let li = 0; li < mc.lineCount; li++) {
      const line = mc.getLine(li);
      if (!line) continue;
      line.tokens.forEach(t => anims.push(t.ref().opacity(1, dur, easeInOutSine)));
    }
    return anims;
  };

  // ── табло ─────────────────────────────────────────────────────────────
  // Строится сразу целиком и ждёт своей секунды прозрачным: продуктовый экран
  // приходит КАК ОДНО, а не собирается по элементам на глазах.
  const board = createRef<Node>();
  view.add(<Node ref={board} x={BOARD_X} y={BOARD_Y} opacity={0} cachePadding={90} />);

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

  const head = (x: number, t: string) =>
    board().add(
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
  board().add(
    <Rect width={RULE_W} height={1} y={HEAD_Y + 36} fill="rgba(244,241,235,0.11)" />,
  );

  const rowY = (i: number) => (i - (FLIGHTS.length - 1) / 2) * ROW_H + ROW_DY;

  board().add(
    <Path data={PLANE} x={ICON_X} y={rowY(0)} rotation={90} scale={ICON_S} fill={LOST_C} />,
  );

  FLIGHTS.forEach(([id, route, status], i) => {
    if (i > 0) {
      board().add(
        <Rect width={RULE_W} height={1} y={rowY(i) - ROW_H / 2} fill={MAP_HAIR} />,
      );
    }
    const put = (x: number, t: string, size: number, fill: string, weight = 400) =>
      board().add(
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
    put(COL_FLIGHT, id, FLIGHT_FS, INK, 500);
    put(COL_ROUTE, route, ROUTE_FS, DIM);
    put(COL_STATUS, status, STATUS_FS, CELL_C);
  });

  // ═══════════════ ТАЙМЛАЙН ════════════════════════════════════════════
  // ═══ A. Словарь причин — один в кадре ═══════════════════════════════
  yield* pull(declWrap(), DECL_IN, 14);
  yield* waitFor(DECL_READ);

  // ═══ B. Едет вправо ПО ПРЯМОЙ и перевёрстывается ════════════════════
  // ⚠️ Только x. Вертикали в движении нет вовсе — блок с самого начала стоит на
  // конечном уровне. Перевёрстка, переезд и приход кода идут одним `all`: это
  // одно событие, а не три.
  yield* all(
    decl.node.x(DECL_X1, MOVE, easeInOutCubic),
    ...reflow(MOVE),
    chain(waitFor(MOVE * 0.35), pull(codeWrap(), MOVE * 0.7, 12)),
  );
  yield* waitFor(CODE_READ);

  // ═══ C. Подстановка по одному имени, отклик справа цветом ═══════════
  // ⚠️ Подсвечивается ТОЛЬКО ТИП — ни строка, ни фон. Цвет держится ровно до
  // прихода следующего имени и оседает в канон-лаванду: он связывает левое
  // слово с правым и уходит, не оставаясь украшением.
  let lit: Txt[] = [];
  const step = function* (
    next: string, w: string, accent: string, dl: number, cl: number,
  ): ThreadGenerator {
    const settle = lit;
    const twin = wordToks(decl, dl, w);
    yield* all(
      ...settle.map(t => t.fill(Canon.type, ACC_OUT, easeInOutSine)),
      code.morphTo(next, stepMorph(w, accent)),
      ...twin.map(t => t.fill(accent, ACC_IN, easeInOutSine)),
    );
    lit = [...wordToks(code, cl, w), ...twin];
    yield* waitFor(STEP_HOLD);
  };

  yield* step(S1, 'Restricted', ACC_RESTRICTED, L_RESTRICTED, CL_RESTRICTED);
  yield* step(S2, 'OutOfCoverage', ACC_COVERAGE, L_COVERAGE, CL_COVERAGE);
  yield* step(S3, 'Stale', ACC_STALE, L_STALE, CL_STALE);
  yield* step(S4, 'Tracked', ACC_TRACKED, L_TRACKED, CL_TRACKED);
  yield* waitFor(NAMED_HOLD);

  // ═══ D. Последним меняется возвращаемый тип ═════════════════════════
  // ⚠️ Сигнатура — тот самый якорь, который три года не двигался. Её правка
  // обязана быть отдельным событием, а не строкой в общем списке. Последний
  // акцент оседает ровно на этом движении.
  yield* all(
    ...lit.map(t => t.fill(Canon.type, ACC_OUT, easeInOutSine)),
    code.morphTo(S5, {...MORPH, recolorLine: paintCanonMethodCallsLine}),
  );
  yield* waitFor(SIG_HOLD);

  // ⚠️ Гаснет ВСЁ, кроме слова `Position` в сигнатуре и слова `Position` в шапке
  // словаря. Два одинаковых слова, горящие в двух блоках, — это и есть вся
  // связь; ни стрелки, ни подписи, ни линии не нужны.
  yield* all(
    ...rackTo(code, 0, 'Position', RACK_DIM, RACK),
    ...rackTo(decl, L_HEAD, 'Position', RACK_DIM, RACK),
  );
  yield* waitFor(RACK_HOLD);

  // ═══ E. На месте словаря проступает табло ═══════════════════════════
  // ⚠️ Перекрытия почти нет: при щедром кроссфейде размытое табло проступало
  // СКВОЗЬ ещё читаемый словарь — двойная экспозиция. Табло трогается, когда от
  // словаря осталось ~6%.
  // ⚠️ Код возвращается в полную силу ровно тогда же: финальный кадр — здоровый
  // близнец стенда главы 1, и он не имеет права быть приглушённым.
  yield* all(
    decl.node.opacity(0, DECL_OUT, easeInOutSine),
    chain(waitFor(DECL_OUT * 0.85), pull(board(), TABLE_IN, 10)),
    ...rackBack(code, DECL_OUT + 0.4),
  );
  declWrap().remove();
  yield* waitFor(TABLE_HOLD);

  yield* all(
    codeWrap().opacity(0, TAIL, easeInCubic),
    board().opacity(0, TAIL, easeInCubic),
  );
  yield* waitFor(0.3);
});
