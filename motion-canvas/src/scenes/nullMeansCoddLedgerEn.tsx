import {Circle, Line, Node, Rect, Txt, blur, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  chain,
  createRef,
  createSignal,
  easeInCubic,
  easeInOutCubic,
  easeInOutSine,
  easeOutCubic,
  SimpleSignal,
  waitFor,
  ThreadGenerator,
} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {Canon} from '../core/code/model/paletteCanon';

// ═══════════════════════════════════════════════════════════════════════
// КОДД, 1986 · ДВА СОРТА НИЧЕГО — И ПОЧЕМУ ИХ НЕ ДВА. ЧЁРНЫЙ ЭКРАН.
//
// Мост между главой 1 и главой про `PositionResult`. Открывается ДВУМЯ
// ОГРОМНЫМИ ИМЕНАМИ (перенесены сюда из коды стенда), показывает оба сорта
// на одной записи, стирает разницу одним словом — и ломает сам счёт «два»:
// смыслов столько, сколько вопросов задаёт домен.
//
// ⚠️ ИСТОРИЮ КОДДА РАССКАЗЫВАЕМ ТАБЛИЦЕЙ. Таблица — его изобретение; ни
// портрета, ни подписи «E. F. Codd · 1986» — имя и год произносит голос.
//
// ⚠️ ФОН — ЧИСТЫЙ ЧЁРНЫЙ (просьба автора), как flagCodeGraphSceneRu:
// applyBackground не зовём, кадр держит плоский #000.
//
// ДУГА:
//   0. Из темноты по очереди — `Unknown` (синий) и `Not applicable` (крем).
//   1. Леджер приходит как одно. Три записи, всё на месте.
//   2. Rack-focus: живыми остаются два `null` одной записи.
//   3. Левый (дата рождения) раскрывается ПИКСЕЛЬНОЙ МОЗАИКОЙ ПОД БЛЮРОМ:
//      значение есть, но не разрешается. Правый (девичья фамилия) просто
//      уходит: там нечему разрешаться. Оба состояния держатся одновременно.
//   4. Поверх обоих печатаются те же четыре серые буквы. Разница стёрта.
//   5. ФИНАЛ — ОДНО ДЛИННОЕ ДВИЖЕНИЕ. Соседние записи гаснут совсем, в кадре
//      остаётся ОДНА строка (правка «при перемещении камеры зафокусить
//      центральную строку»), камера едет вдоль схемы, и от каждого её `null`
//      В ДВИЖЕНИИ прорастает ветвление к возможным смыслам. У каждой клетки
//      свой набор, ни один нигде не записан. В конце смыслы гаснут — остаются
//      одинаковые слова.
//
// ⚠️ Финальный статичный такт с фигурами-примитивами СНЯТ автором («слишком
// буквально воспринял ромбы»): словарь foreignResponsibilityShapes нельзя
// цитировать формами, у него берётся принцип — цвет/форма как состояние, —
// а не сами круг-квадрат-ромб-треугольник.
//
// ⚠️ Тезисов и подписей на экране НЕТ: их произносит озвучка. Холды — «VO».
// ═══════════════════════════════════════════════════════════════════════

const MONO = Fonts.code;

// ── краски ─────────────────────────────────────────────────────────────
// ⚠️⚠️ НА ЧЁРНОМ ПРОЗРАЧНОСТЬ = ГРЯЗЬ. Композит на #000 просто умножает цвет
// на альфу: крем 0.44 превращается в rgb(107) — не «тише», а мутно-серо, и
// вся тёплая нота из него уходит (ровно «грязный оттенок, тёмный текст, хотя
// и светлый»). Поэтому иерархии по альфе тут больше НЕТ: все ярусы яркие,
// а разводятся ТЁПЛОСТЬЮ и кеглем — вопросы шапки тёплый тан, данные крем.
const INK = 'rgba(248,245,239,1)';                  // имена
const VAL = 'rgba(240,236,228,1)';                  // значения
// ⚠️ Беж НЕЖНЫЙ, а не канон-насыщенный: у (232,207,174) размах каналов 58 —
// рядом с кремом это читается песочно-жёлтым пятном. Здесь размах ~35:
// тепло остаётся, желтизна уходит.
const KEY_C = 'rgba(238,224,203,0.95)';             // ключ — тёплый
const HEAD_C = 'rgba(236,220,198,0.92)';            // вопросы
const HAIR = 'rgba(244,241,235,0.20)';
const HAIR_HEAD = 'rgba(244,241,235,0.32)';
// ⚠️ `null` — ПЛОСКИЙ и тише данных: присутствует, но ничего не весит.
// Своего оттенка нет — новый цвет сделал бы из него значение. Тише ровно
// настолько, чтобы это читалось как ниже рангом, а не как погасший текст.
const NULL_C = 'rgba(244,241,235,0.84)';
// ⚠️ Мозаика — СИНЯЯ: краска `Unknown` и «сигнал есть» всего ролика.
const FOG_C = Canon.keyword;
// ⚠️⚠️ ДВЕ КРАСКИ-ИМЕНИ. Синяя = `Unknown` (ею же набран гигант в открытии и
// сама мозаика), зелёная = `Not applicable` (гигант тоже зелёный). Больше ни
// на что в сцене они не назначены: это ИМЕНА СОСТОЯНИЙ, а не украшение —
// и беат 4 стирает вместе с ними обе сноски.
const UNK_C = Canon.keyword;
const NA_C = Canon.string;
// ⚠️ Единая краска смыслов ОТМЕНЕНА: у каждого `null` своя (см. MEANINGS).

// ── имена (открытие) ───────────────────────────────────────────────────
const NM_FS = 150;
const NM_STACK = 118;
const NM_IN = 0.9;
const NM_MID = 1.1;                  // ⚠️ VO — между именами
const NM_HOLD = 2.6;                 // ⚠️ VO
const NM_OUT = 0.9;
const NM_GAP = 0.35;

// ── сетка ───────────────────────────────────────────────────────────────
// ⚠️ КРУПНЕЕ И ПРОСТОРНЕЕ (правка «строки в начале разнести и сделать
// больше»): кегль 42→48, шаг строки 94→120. Ширины колонок пересчитаны по
// самому длинному содержимому при новом кегле, не масштабированы на глаз.
const FS = 48;
// ⚠️ Шапка 25→28: мелкий разряженный капс на телефоне — первое, что
// перестаёт читаться. Ширины колонок проверены, самая длинная (`EXIT
// INTERVIEW`) при 28 занимает 269px против 305 доступных.
const HEAD_FS = 28;
const HEAD_LS = 2.4;

const HEADS = [
  'ID', 'NAME', 'DATE OF BIRTH', 'MAIDEN NAME',
  'COMMISSION', 'SPOUSE', 'CLEARANCE', 'TERMINATED',
  'PENSION PLAN', 'LAST REVIEW', 'NEXT OF KIN', 'EXIT INTERVIEW',
];
const COL_W = [190, 470, 355, 330, 250, 295, 225, 355, 275, 355, 320, 305];
const BASE_COLS = 4;
const X0 = -637;

const COL_X: number[] = [];
{
  let x = X0;
  for (const w of COL_W) {
    COL_X.push(x);
    x += w;
  }
}
const SHEET_R = COL_X[COL_X.length - 1] + COL_W[COL_W.length - 1];

const RULE_L = -690;
const RULE_W_BASE = 1380;
const RULE_W_FULL = SHEET_R + 53 - RULE_L;

const ROW_Y0 = -120;
const ROW_H = 120;
const rowY = (i: number) => ROW_Y0 + i * ROW_H;
// ⚠️ СТРОКИ РАВНОЙ ВЫСОТЫ: линейка шапки ровно пол-шага над первой строкой.
// Раньше верхняя полоса была выше остальных, автор это увидел.
const HEAD_RULE_Y = rowY(0) - ROW_H / 2;
const HEAD_Y = HEAD_RULE_Y - 44;

// ⚠️ Запись 0413 — наша. У соседей обе базовые клетки заполнены, иначе
// неоткуда узнать, что колонки бывают со значениями; дальше по схеме камера
// едет вдоль ЕЁ ОДНОЙ, и её `null` разной природы — предмет финала.
const NUL = 'null';
const ROWS: string[][] = [
  ['0412', 'Margaret Ellis', '1979-07-19', 'Whitfield',
   '4 200', 'T. Ellis', 'L3', NUL, NUL, '2025-04-11', NUL, NUL],
  ['0413', 'Peter Hallam', NUL, NUL,
   NUL, NUL, NUL, NUL, 'AVC-2', NUL, NUL, NUL],
  ['0414', 'Anna Boyd', '1988-02-03', 'Carrow',
   NUL, 'R. Boyd', NUL, '2024-11-02', NUL, NUL, 'M. Carrow', NUL],
];
const SUBJ_ROW = 1;
const COL_DOB = 2;
const COL_MAIDEN = 3;

// ── мозаика: «значение есть, но не разрешается» ─────────────────────────
// ⚠️ Гауссов блюр по дате заменён пиксельной мозаикой, а мозаика ПОСТАВЛЕНА
// ПОД БЛЮР (правка автора): голые плитки читались как графический приём,
// под расфокусом — как нерешаемый сигнал. Плитка крупнее глифа, паттерн
// живой (пересеивается ~8 раз в секунду) и никогда не садится в читаемое.
const CADV = FS * 0.6;
const FOG_CHARS = 10;
const PX = 18;
const PX_GAP = 2;
const MOS_COLS = Math.round((FOG_CHARS * CADV) / PX);
const MOS_ROWS = 3;
const MOS_TICK = 0.13;
const MOS_BLUR_FROM = 26;
const MOS_BLUR_TO = 7;

// ── сноски: у двух пустот появляются ИМЕНА ──────────────────────────────
// ⚠️ Грамматика ЛЕДЖЕРА, а не подписи-ярлыки: надстрочный маркер сразу за
// клеткой + расшифровка внизу таблицы с висячим отступом. Так аккуратный
// архивариус и пометил бы две разные пустоты — двумя сносками.
// ⚠️ Рамки на месте девичьей фамилии НЕТ (снята автором): клетка просто
// пустая, и этого достаточно — контур делал из пустоты объект.
// ⚠️ Маркер ОБЯЗАН быть надстрочным и прижатым к своей клетке: поставленный
// вровень со строкой и на отлёте, он слипается со значением СОСЕДНЕЙ колонки
// и читается как сноска к нему («* null»). У даты он идёт ЗА мозаикой (она
// занимает место значения), у пустой клетки — с её левого края, оттуда, где
// значение начиналось бы.
const MOS_W = MOS_COLS * PX - PX_GAP;
const MARK_FS = 34;
const MARK_DY = -20;
// ⚠️ ОБА маркера на ОДНОМ отступе от начала своей колонки — за слотом
// значения. Это и делает их парой, и уводит из поля: поставленный по левому
// краю пустой клетки `**` встаёт НА МЕСТО значения (читается как содержимое)
// и вдобавок липнет к `*` соседа — два маркера читаются группой «* **».
const MARK_DX = MOS_W + 12;
// ⚠️ Сноски КРУПНЫЕ: это имена состояний, а не служебная мелочь, и на
// телефоне мелкий разряженный текст пропадает первым.
const NOTE_FS = 52;
const NOTE_X = COL_X[COL_DOB];
const NOTE_MARK_DX = -16;            // висячий отступ
const NOTE_Y0 = rowY(ROWS.length - 1) + ROW_H / 2 + 100;
const NOTE_PITCH = 68;
const NOTE_IN = 0.55;
// ⚠️ Уходят МЕДЛЕННО и своей длительностью, а не заодно с мозаикой: имена —
// текст, его читают, и синхронный с печатью щелчок гасит их слишком резко.
const NOTE_OUT = 1.4;

// ── ПАУТИНА СМЫСЛОВ ─────────────────────────────────────────────────────
// ⚠️ Жёсткие скобки (стебель + прямые отростки) СНЯТЫ автором. Постановка:
// нити ведут себя ФИЗИЧНО — провисают под собственным весом, выходят из одной
// точки под словом и ЦЕПЛЯЮТСЯ к точкам у смыслов. Паук тянет шёлк: сначала
// нить дошла, потом на её конце появился узелок, и только потом слово.
// ⚠️ У КАЖДОГО `null` СВОЯ КРАСКА (нити + узелки + подписи). Ровно это и
// позволяет паутинам пересекаться, не превращаясь в кашу: сами слова серые
// и одинаковые, различить можно только смыслы — по цвету.
// ⚠️ Смыслы живут В НИЖНЕЙ ЧАСТИ КАДРА, тремя ярусами: нить успевает стать
// нитью, а не подписью под клеткой.
// ⚠️ Число ветвей РАЗНОЕ (2 или 3): ровно по две у каждой клетки означало бы,
// что сортов ничего всё-таки два, а беат — про то, что их столько, сколько
// вопросов у домена.
// ⚠️ Краски — канон (`paletteCanon`) плюс приглушённые тёплые: палитра
// холодная, и без них семь нитей читались бы одним синим пятном. Все на
// близкой светлоте и низкой насыщенности, чтобы это была палитра, а не радуга.
// ⚠️⚠️ СИНЕГО `#A3CDFF` И ЗЕЛЁНОГО `#94C086` ЗДЕСЬ БЫТЬ НЕ ДОЛЖНО: за двадцать
// секунд до этого они назначены именами состояний (`* Unknown` / `** Not
// applicable`), и веер такой краски прочитается продолжением легенды — причём
// СОВРЁТ (у «синего» COMMISSION смыслы как раз неприменимости). Были на col 4
// и col 7, заменены на охру и орхидею; менять фан-краски — сверяться с
// легендой.
// ⚠️ `at` — не на глаз: это момент, когда левый край колонки доходит до
// экранных +700 при трапецеидальном профиле проезда. Меняешь профиль или
// длительность — пересчитывай, иначе паутина растёт за краем кадра.
// ⚠️ `at` — не на глаз: это момент, когда левый край колонки доходит до
// экранных +700 при трапецеидальном профиле проезда. Меняешь профиль или
// длительность — пересчитывай, иначе паутина растёт за краем кадра.
const MEANINGS: {col: number; at: number; color: string; items: string[]}[] = [
  {col: 4,  at: 0.18, color: '#C6BE84',                 items: ['salaried', 'not paid yet']},
  {col: 5,  at: 1.15, color: '#FFAEC0',                 items: ['unmarried', 'not recorded']},
  {col: 6,  at: 2.05, color: '#A2CDD6',                 items: ['never asked', 'still pending']},
  {col: 7,  at: 2.73, color: '#C89BC9',                 items: ['still employed', 'on leave', 'date lost']},
  {col: 9,  at: 4.66, color: '#E0BE8A',                 items: ['hired last month', 'review skipped']},
  {col: 10, at: 5.74, color: 'rgba(205,198,250,0.92)',  items: ['declined', 'no family', 'not on file']},
  {col: 11, at: 6.72, color: '#E79A8E',                 items: ['never left', 'not offered']},
];
// ⚠️ Кегль поднят 22→30 (правка автора «на мобилках не будут видны»).
const MEAN_FS = 30;
const ORIGIN_DX = 50;                // точка крепления под серединой слова
const ORIGIN_Y = 44;
// ⚠️⚠️ ШЕСТЬ ЯРУСОВ, А НЕ ТРИ, И ЧЕРЕДОВАНИЕ ПО ЧЁТНОСТИ ПАУТИНЫ: соседние
// паутины не делят ни одного яруса, поэтому подписи не могут столкнуться
// буквами — сколько бы нити ни пересекались. Только это и позволяет держать
// крупный кегль вместе с широким разлётом; при трёх общих ярусах длинная
// подпись немедленно налезала на соседнюю колонку.
// ⚠️ Нижний ярус держим в 70+px от кромки кадра: при крупном кегле подпись
// шестого яруса вставала почти вплотную к краю.
const LANE_Y = [228, 272, 316, 360, 404, 448];
// ⚠️ РАЗЛЁТ И ГЛУБИНА — СВОИ У КАЖДОГО ВЕЕРА. Общий `ITEM_DX` и общая пара
// ярусов давали одну и ту же букву «Л» семь раз подряд, и повтор штампа глаз
// ловил раньше, чем дочитывал слова. Правки НАМЕРЕННО скромные: тот же язык,
// та же чётность ярусов (она и держит подписи от столкновений), меняются
// только ширина расщепа и то, какие два яруса из своего набора берёт веер.
// ⚠️ Пробовали радикальнее — свободные точки от солвера и промежуточные
// узлы-развилки (силуэт Y вместо Λ): автор отверг, «экстрим».
const FAN_LANES = [[0, 2], [0, 1], [0, 1], [0, 1, 2], [1, 2], [0, 1, 2], [0, 2]];
const FAN_DX = [
  [-150, 70], [-100, 120], [-140, 65], [-120, 110, -30],
  [-250, 105], [-145, 75, -10], [-180, 95],
];
// ⚠️ Левые ветви у col 9 и col 11 уведены дальше остальных не для красоты:
// иначе вторая нить веера проходит ПО СЛОВУ («hired last month», «never left»)
// и оно читается перечёркнутым. Подпись висит справа от узелка, поэтому нить
// обязана либо остаться левее её начала, либо уйти правее её конца.
const laneOf = (fan: number, item: number) => LANE_Y[(fan % 2) + FAN_LANES[fan][item] * 2];
const DOT_R = 8;
const LBL_DX = 18;
const THREAD_W = 1.7;
const THREAD_DUR = 0.4;
const THREAD_STEP = 0.22;
const DOT_DUR = 0.14;
const LBL_DUR = 0.28;

// ── тайминги ────────────────────────────────────────────────────────────
const IN = 1.2;
const HOLD_LEDGER = 3.2;             // ⚠️ VO — Кодд вернулся в 1986
const RACK = 1.0;
// ⚠️⚠️ ТРИ ПЛАНА РАЗВОДИТ РАСФОКУС, А НЕ ПРОЗРАЧНОСТЬ. Раньше дальний план
// уезжал в 0.12 — на чёрном это rgb(28), угольная каша под текстом, из-за
// которой кадр и читался грязным. Теперь дальний остаётся ЯРКИМ и уходит из
// фокуса: буквы видно как буквы, но прочесть их нельзя, поэтому глаз садится
// на резкое. Шапки двух наших колонок не гаснут и не мылятся вовсе — без
// прочитанного `MAIDEN NAME` второго беата не существует.
const RACK_DIM = 0.4;
const NEAR_DIM = 0.72;
const FAR_BLUR = 7;
const NEAR_BLUR = 2.4;
const HOLD_ROW = 1.6;                // ⚠️ VO — одна запись, две пустые клетки
const FOG_IN = 0.9;
const HOLD_FOG = 2.6;                // ⚠️ VO — значение есть, мы его не знаем
const VOID_OUT = 1.1;
const HOLD_VOID = 2.8;               // ⚠️ VO — узнавать нечего
const CRIME = 0.5;
const CRIME_CD = 0.055;
const HOLD_CRIME = 3.0;              // ⚠️ VO — один символ на оба случая
const OPEN_UP = 1.0;
const TRUCK = 8.2;
const TRUCK_R = 0.12;                // доля разгона/торможения
const HOLD_TRUCK = 2.6;              // ⚠️ VO — а записано нигде ничего
const OUT = 1.2;

// ⚠️⚠️ ПРОФИЛЬ ПРОЕЗДА — ТРАПЕЦИЯ ПО СКОРОСТИ: синус-разгон, ровный ход,
// синус-торможение, ОДНИМ твином. Три отдельных твина (easeInSine → linear →
// easeOutSine) дают РЫВОК на обоих стыках: у easeInSine конечная скорость в
// π/2 раза выше средней, поэтому на входе в линейный участок камера резко
// тормозила (513→294 px/с), а на выходе так же резко дёргалась вперёд —
// ровно то, что автор увидел. Здесь скорость непрерывна и обнуляется на
// концах. easeInOutSine не годится по-прежнему: его пик вдвое выше средней,
// и подписи смыслов пролетают быстрее, чем читаются; у трапеции пик +10%.
const truckEase = (() => {
  const r = TRUCK_R;
  const V = 1 / (1 - 2 * r + (4 * r) / Math.PI);
  const A = (V * 2 * r) / Math.PI;
  return (t: number): number => {
    if (t <= r) return A * (1 - Math.cos((Math.PI * t) / (2 * r)));
    if (t >= 1 - r) return 1 - A * (1 - Math.cos((Math.PI * (1 - t)) / (2 * r)));
    return A + V * (t - r);
  };
})();

const TRUCK_DX = RULE_L + RULE_W_BASE - (SHEET_R + 53);
const BLUR_IN = 14;

// детерминированный шум
const rnd = (i: number, s: number) => {
  const x = Math.sin((i + 1) * 12.9898 + s * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// ═══════════════════════════════════════════════════════════════════════
export default makeScene2D(function* (view) {
  view.add(<Rect width={1920} height={1080} fill="#000000" />);

  // focus-pull: узел проявляется как одно, дети размываются вместе
  const pull = function* (node: Node, sig: SimpleSignal<number>, dur: number): ThreadGenerator {
    sig(12);
    yield* all(
      node.opacity(1, dur * 0.85, easeOutCubic),
      sig(0, dur, easeInOutCubic),
    );
  };

  // ── имена ─────────────────────────────────────────────────────────────
  const upBlur = createSignal(12);
  const dnBlur = createSignal(12);
  const names = createRef<Node>();
  view.add(<Node ref={names} />);
  const nmUp = createRef<Txt>();
  const nmDn = createRef<Txt>();
  names().add(
    <Txt
      ref={nmUp}
      text="Unknown"
      y={-NM_STACK}
      opacity={0}
      cache
      cachePadding={90}
      filters={[blur(() => upBlur())]}
      fontFamily={MONO}
      fontSize={NM_FS}
      fontWeight={500}
      fill={Canon.keyword}
    />,
  );
  names().add(
    <Txt
      ref={nmDn}
      text="Not applicable"
      y={NM_STACK}
      opacity={0}
      cache
      cachePadding={90}
      filters={[blur(() => dnBlur())]}
      fontFamily={MONO}
      fontSize={NM_FS}
      fontWeight={500}
      fill={NA_C}
    />,
  );

  // ── леджер ────────────────────────────────────────────────────────────
  const rowsOp = createSignal(1);     // соседние записи и их линейки
  const subjOp = createSignal(1);     // наша запись целиком
  const headOp = createSignal(1);     // шапки (кроме двух наших)
  const grow = createSignal(0);       // колонки, которых пока «нет»
  const farBlur = createSignal(0);    // расфокус дальнего плана
  const nearBlur = createSignal(0);   // расфокус ближнего
  const sheetBlur = createSignal(BLUR_IN);
  const ruleW = createSignal(RULE_W_BASE);

  const sheet = createRef<Node>();
  view.add(
    <Node
      ref={sheet}
      opacity={0}
      cache
      cachePadding={90}
      filters={[blur(() => sheetBlur())]}
    />,
  );

  const rule = (y: number, fill: string, op: SimpleSignal<number>) =>
    sheet().add(
      <Rect
        x={RULE_L}
        y={y}
        offset={[-1, 0]}
        width={() => ruleW()}
        height={1}
        fill={fill}
        opacity={() => op()}
      />,
    );
  // линейка под шапкой переживает фокусировку — это черта под вопросами
  rule(HEAD_RULE_Y, HAIR_HEAD, headOp);
  for (let i = 1; i < ROWS.length; i++) rule(rowY(i) - ROW_H / 2, HAIR, rowsOp);
  rule(rowY(ROWS.length - 1) + ROW_H / 2, HAIR, rowsOp);

  // шапка — дальний план целиком, кроме двух наших вопросов: они остаются
  // резкими и яркими, поэтому живут отдельным ребёнком листа
  const headFar = new Node({
    opacity: () => headOp(),
    cache: true,
    cachePadding: 60,
    filters: [blur(() => farBlur())],
  });
  sheet().add(headFar);
  HEADS.forEach((h, c) => {
    const subject = c === COL_DOB || c === COL_MAIDEN;
    const node = new Txt({
      text: h,
      x: COL_X[c],
      y: HEAD_Y,
      offset: [-1, 0],
      fontFamily: MONO,
      fontSize: HEAD_FS,
      letterSpacing: HEAD_LS,
      fill: HEAD_C,
      opacity: subject ? 1 : c >= BASE_COLS ? () => grow() : 1,
    });
    if (subject) sheet().add(node);
    else headFar.add(node);
  });

  const cellStyle = (c: number, r: number) => ({
    x: COL_X[c],
    y: rowY(r),
    offset: [-1, 0] as [number, number],
    fontFamily: MONO,
    fontSize: FS,
  });

  // каждая запись — свой узел: расфокус берётся по плану, а не по букве
  ROWS.forEach((row, r) => {
    const subj = r === SUBJ_ROW;
    const holder = new Node({
      opacity: subj ? () => subjOp() : () => rowsOp(),
      cache: true,
      cachePadding: 60,
      filters: [blur(subj ? () => nearBlur() : () => farBlur())],
    });
    sheet().add(holder);
    row.forEach((v, c) => {
      if (subj && (c === COL_DOB || c === COL_MAIDEN)) return;
      const fill = c === 0 ? KEY_C : c === 1 ? INK : v === NUL ? NULL_C : VAL;
      holder.add(
        new Txt({
          ...cellStyle(c, r),
          text: v,
          fontWeight: c === 1 ? 500 : 400,
          fill,
          opacity: c >= BASE_COLS ? () => grow() : 1,
        }),
      );
    });
  });

  // ── две клетки-предмета ───────────────────────────────────────────────
  const dobNullOp = createSignal(1);
  const fogOp = createSignal(0);
  const maidenNullOp = createSignal(1);

  const dobNull = createRef<Txt>();
  const maidenNull = createRef<Txt>();
  sheet().add(
    <Txt
      ref={dobNull}
      {...cellStyle(COL_DOB, SUBJ_ROW)}
      text={NUL}
      fill={NULL_C}
      opacity={() => dobNullOp()}
    />,
  );
  sheet().add(
    <Txt
      ref={maidenNull}
      {...cellStyle(COL_MAIDEN, SUBJ_ROW)}
      text={NUL}
      fill={NULL_C}
      opacity={() => maidenNullOp()}
    />,
  );

  // ── мозаика под блюром ────────────────────────────────────────────────
  const mosGen = createSignal(0);
  const mosBlur = createSignal(MOS_BLUR_FROM);
  const mosaic = createRef<Node>();
  sheet().add(
    <Node
      ref={mosaic}
      x={COL_X[COL_DOB]}
      y={rowY(SUBJ_ROW)}
      opacity={() => fogOp()}
      cache
      cachePadding={100}
      filters={[blur(() => mosBlur())]}
    />,
  );
  for (let r = 0; r < MOS_ROWS; r++) {
    for (let c = 0; c < MOS_COLS; c++) {
      const i = r * MOS_COLS + c;
      mosaic().add(
        new Rect({
          x: c * PX + PX / 2,
          y: (r - (MOS_ROWS - 1) / 2) * PX,
          width: PX - PX_GAP,
          height: PX - PX_GAP,
          radius: 2,
          fill: FOG_C,
          opacity: () => {
            const v = rnd(i + Math.floor(mosGen()) * 997, 5);
            return 0.08 + 0.9 * Math.pow(v, 1.7);
          },
        }),
      );
    }
  }
  // ── две сноски ────────────────────────────────────────────────────────
  // Каждая = маркер у клетки + строка внизу таблицы; гаснут одним узлом.
  const note = (
    marks: string,
    markX: number,
    color: string,
    label: string,
    line: number,
  ) => {
    const n = createRef<Node>();
    sheet().add(<Node ref={n} opacity={0} />);
    n().add(
      <Txt
        text={marks}
        x={markX}
        y={rowY(SUBJ_ROW) + MARK_DY}
        offset={[-1, 0]}
        fontFamily={MONO}
        fontSize={MARK_FS}
        fill={color}
      />,
    );
    const y = NOTE_Y0 + line * NOTE_PITCH;
    n().add(
      <Txt
        text={marks}
        x={NOTE_X + NOTE_MARK_DX}
        y={y}
        offset={[1, 0]}
        fontFamily={MONO}
        fontSize={NOTE_FS}
        fill={color}
      />,
    );
    n().add(
      <Txt
        text={label}
        x={NOTE_X}
        y={y}
        offset={[-1, 0]}
        fontFamily={MONO}
        fontSize={NOTE_FS}
        fill={color}
      />,
    );
    return n;
  };
  const unkNote = note('*', COL_X[COL_DOB] + MARK_DX, UNK_C, 'Unknown', 0);
  const naNote = note('**', COL_X[COL_MAIDEN] + MARK_DX, NA_C, 'Not applicable', 1);

  let mosLive = false;
  const mosaicClock = function* (): ThreadGenerator {
    while (mosLive) {
      mosGen(mosGen() + 1);
      yield* waitFor(MOS_TICK);
    }
  };

  // печать: те же четыре буквы, что были, тем же цветом
  const typeIn = function* (t: Txt, s: string, cd: number): ThreadGenerator {
    for (let i = 1; i <= s.length; i++) {
      t.text(s.slice(0, i));
      yield* waitFor(cd);
    }
  };

  // ── паутина смыслов: строится заранее, тянется в движении ─────────────
  // ⚠️ Не сигнал-переключатель, а просто плотность нити: гасит их родитель.
  // ⚠️ Нить тоньше волоса и вполсилы на чёрном исчезает на телефоне первой:
  // 1.3px/0.55 → 1.7px/0.72. Она всё ещё тише узелка и подписи.
  const THREAD_OP = 0.72;

  // ⚠️ Нити ПРЯМЫЕ (правка автора). Провисание квадратичной кривой снято:
  // натянутый шёлк честнее — и разлёт ветвей читается как разлёт, а не как
  // мягкая графика. Нить всё так же ТЯНЕТСЯ (`end` по отрезку).
  type Fan = {root: Circle; threads: Line[]; dots: Circle[]; labels: Txt[]};
  const fans: Fan[] = MEANINGS.map((m, fi) => {
    const ox = COL_X[m.col] + ORIGIN_DX;
    const root = new Circle({
      x: ox,
      y: ORIGIN_Y,
      size: DOT_R - 2,
      fill: m.color,
      opacity: 0,
    });
    sheet().add(root);
    const threads: Line[] = [];
    const dots: Circle[] = [];
    const labels: Txt[] = [];
    m.items.forEach((text, i) => {
      const ax = ox + FAN_DX[fi][i];
      const ay = laneOf(fi, i);
      const th = new Line({
        points: [[ox, ORIGIN_Y], [ax, ay]],
        stroke: m.color,
        lineWidth: THREAD_W,
        end: 0,
        opacity: THREAD_OP,
      });
      sheet().add(th);
      threads.push(th);
      const dot = new Circle({
        x: ax, y: ay, size: DOT_R, fill: m.color, opacity: 0,
      });
      sheet().add(dot);
      dots.push(dot);
      const lbl = new Txt({
        text,
        x: ax + LBL_DX,
        y: ay,
        offset: [-1, 0],
        fontFamily: MONO,
        fontSize: MEAN_FS,
        fill: m.color,
        opacity: 0,
      });
      sheet().add(lbl);
      labels.push(lbl);
    });
    return {root, threads, dots, labels};
  });

  // Паук тянет шёлк: нить дошла → на конце появился узелок → и только потом
  // слово. Порядок обязателен, иначе это снова подпись со связкой, а не хват.
  const growFan = function* (f: Fan): ThreadGenerator {
    yield* f.root.opacity(1, 0.18, easeOutCubic);
    yield* all(
      ...f.threads.map((th, i) =>
        chain(
          waitFor(i * THREAD_STEP),
          th.end(1, THREAD_DUR, easeOutCubic),
          all(
            f.dots[i].opacity(1, DOT_DUR, easeOutCubic),
            f.labels[i].opacity(1, LBL_DUR, easeOutCubic),
          ),
        ),
      ),
    );
  };

  // ═══ ТАЙМЛАЙН ═══════════════════════════════════════════════════════
  // 0. имена: по очереди, из фокуса
  yield* pull(nmUp(), upBlur, NM_IN);
  yield* waitFor(NM_MID);
  yield* pull(nmDn(), dnBlur, NM_IN);
  yield* waitFor(NM_HOLD);
  yield* names().opacity(0, NM_OUT, easeInCubic);
  names().remove();
  yield* waitFor(NM_GAP);

  // 1. леджер приходит как одно
  yield* all(
    sheet().opacity(1, IN * 0.8, easeOutCubic),
    sheetBlur(0, IN, easeInOutCubic),
  );
  yield* waitFor(HOLD_LEDGER);

  // 2. rack-focus на одну запись: живыми остаются два `null`
  yield* all(
    rowsOp(RACK_DIM, RACK, easeInOutSine),
    headOp(RACK_DIM, RACK, easeInOutSine),
    subjOp(NEAR_DIM, RACK, easeInOutSine),
    farBlur(FAR_BLUR, RACK, easeInOutCubic),
    nearBlur(NEAR_BLUR, RACK, easeInOutCubic),
  );
  yield* waitFor(HOLD_ROW);

  // 3a. левая клетка раскрывается мозаикой под блюром
  mosLive = true;
  yield mosaicClock();
  yield* all(
    dobNullOp(0, FOG_IN * 0.55, easeInCubic),
    fogOp(1, FOG_IN * 0.8, easeOutCubic),
    mosBlur(MOS_BLUR_TO, FOG_IN, easeOutCubic),
    chain(waitFor(FOG_IN * 0.5), unkNote().opacity(1, NOTE_IN, easeOutCubic)),
  );
  dobNull().text('');
  yield* waitFor(HOLD_FOG);

  // 3b. правая уходит, и на её месте остаётся ПУСТАЯ РАМКА: разрешаться
  // нечему. Мозаика ОСТАЁТСЯ — два разных ничего рядом, под своими именами,
  // и есть главный кадр сцены.
  yield* all(
    maidenNullOp(0, VOID_OUT, easeInCubic),
    chain(waitFor(VOID_OUT * 0.5), naNote().opacity(1, NOTE_IN, easeOutCubic)),
  );
  maidenNull().text('');
  yield* waitFor(HOLD_VOID);

  // 4. преступление: поверх обоих печатается одно и то же слово
  dobNullOp(1);
  maidenNullOp(1);
  // ⚠️ Вместе с мозаикой и рамкой уходят ОБЕ СНОСКИ: стирается не только
  // разница состояний, но и сами их имена — остаются одинаковые буквы.
  yield* all(
    fogOp(0, CRIME * 0.6, easeInCubic),
    unkNote().opacity(0, NOTE_OUT, easeInOutSine),
    naNote().opacity(0, NOTE_OUT, easeInOutSine),
    chain(
      waitFor(CRIME * 0.36),
      all(
        typeIn(dobNull(), NUL, CRIME_CD),
        typeIn(maidenNull(), NUL, CRIME_CD),
      ),
    ),
  );
  mosLive = false;
  yield* waitFor(HOLD_CRIME);

  // 5. фокус на нашей строке: соседние записи уходят СОВСЕМ, вопросы
  // остаются, схема оказывается шире кадра
  yield* all(
    rowsOp(0, OPEN_UP, easeInOutSine),
    headOp(1, OPEN_UP, easeInOutSine),
    subjOp(1, OPEN_UP, easeInOutSine),
    grow(1, OPEN_UP, easeInOutSine),
    farBlur(0, OPEN_UP, easeInOutCubic),
    nearBlur(0, OPEN_UP, easeInOutCubic),
    ruleW(RULE_W_FULL, OPEN_UP * 1.1, easeInOutCubic),
  );

  // 6. проезд вдоль схемы; от каждого `null` в движении прорастают смыслы
  yield* all(
    sheet().x(TRUCK_DX, TRUCK, truckEase),
    ...fans.map((f, i) => chain(waitFor(MEANINGS[i].at), growFan(f))),
  );
  yield* waitFor(HOLD_TRUCK);

  // 7. ВСЁ уходит ОДНИМ движением.
  // ⚠️ Отдельного такта «паутина гаснет — слова остаются» больше нет (правка
  // автора): он читался как две разные концовки подряд. Паутины живут ВНУТРИ
  // `sheet`, поэтому гасить нужно только родителя — прозрачность копится, и
  // нити, узелки, подписи, строка и шапка уходят строго синхронно.
  yield* all(
    sheet().opacity(0, OUT, easeInCubic),
    sheetBlur(8, OUT, easeInCubic),
  );
  yield* waitFor(0.3);
});
