import {Node, Rect, Txt, blur, makeScene2D} from '@motion-canvas/2d';
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
import {Canon} from '../core/code/model/paletteCanon';

// ═══════════════════════════════════════════════════════════════════════
// КОДД, 1986 · ДВА СОРТА НИЧЕГО — И ПОЧЕМУ ИХ НЕ ДВА.
//
// Мост между кодой главы 1 (два огромных имени `Unknown` / `Not applicable`)
// и главой про `PositionResult`. Кода НАЗЫВАЕТ, эта сцена ПОКАЗЫВАЕТ и тут же
// ломает: Кодд предложил две метки, ему ответили «почему две», и это не
// возражение, а инструкция — число пустот принадлежит предметной области.
// Отсюда ровно один шаг до «назови все причины у себя в типе».
//
// ⚠️ ИСТОРИЮ КОДДА РАССКАЗЫВАЕМ ТАБЛИЦЕЙ. Таблица — его изобретение; весь
// ролик живёт в табло и леджерах, и человек, давший миру эту форму, получает
// рассказ на своём же материале. Ни портрета, ни подписи «E. F. Codd · 1986»
// в кадре нет — имя и год произносит голос.
//
// ⚠️ КАРТОЧКИ ПОД ЛЕДЖЕРОМ НЕТ (в отличие от табло рейсов): чистая типографика
// и волосяные линии на графите. Это ДРУГОЙ мир — не наш продукт, а его модель.
//
// ⚠️ ПРИМЕР — ОДНА ЗАПИСЬ, ДВЕ ЯЧЕЙКИ (решение автора: «вместить и девичьи
// фамилии»). Галереи примеров нет: три параллельные иллюстрации превратили бы
// беат в перечисление. `MAIDEN NAME` взята вместо коддовской `COMMISSION`
// потому, что понятна за полсекунды без единого слова, а `DATE OF BIRTH` —
// потому, что это дословно поле из объявления Хоара (`integer date of birth`)
// из акта 1. Рейс в кадр не пускаем: возвращение в мир табло — козырь входа
// в следующую главу, третий пример унесёт голос.
//
// ДУГА:
//   1. Из темноты focus-pull'ом приходит леджер. Три записи, всё на месте.
//   2. Rack-focus: таблица гаснет до шёпота, живыми остаются ДВА `null`
//      в одной строке — под разными вопросами, одним словом.
//   3. Они раскрываются ПО-РАЗНОМУ. Левый (дата рождения) становится
//      РАЗМЫТЫМ ЗНАЧЕНИЕМ: видно, что что-то есть, не видно что. Правый
//      (девичья фамилия) просто уходит: там нечему быть в фокусе. Оба
//      состояния держатся в кадре ОДНОВРЕМЕННО — это и есть главный кадр.
//   4. ПРЕСТУПЛЕНИЕ одним жестом: поверх обоих печатаются те же четыре серые
//      буквы. Разница стёрта на глазах.
//   5. «А почему две» — свет возвращается, линейки уходят вправо за кадр, и
//      камера едет вдоль схемы. Столбец за столбцом: у каждого свой вопрос,
//      и в половине клеток одно и то же слово. Пустот столько, сколько
//      вопросов задаёт домен.
//   6. Темнота — и тот же самый первый кадр. Таблица не изменилась; изменилось
//      то, что зритель про неё знает.
//
// ⚠️ Тезисов и подписей на экране НЕТ (канон акта): их произносит озвучка.
// Все холды помечены «VO» и подогнаны под неё.
// ═══════════════════════════════════════════════════════════════════════

const MONO = Fonts.code;

// ── краски ──────────────────────────────────────────────────────────────
const INK = 'rgba(244,241,235,0.96)';            // имя — ключ записи
const VAL = 'rgba(244,241,235,0.84)';            // значения
const KEY_C = 'rgba(244,241,235,0.44)';          // ID
const HEAD_C = 'rgba(244,241,235,0.38)';         // шапка
const HAIR = 'rgba(244,241,235,0.10)';           // линейки строк
const HAIR_HEAD = 'rgba(244,241,235,0.17)';      // линейка под шапкой
// ⚠️ `null` — ПЛОСКИЙ и тише данных, но не тусклее шапки: он присутствует,
// он просто ничего не весит. Никакого своего оттенка у него нет — новый цвет
// сделал бы из него значение.
const NULL_C = 'rgba(244,241,235,0.55)';
// ⚠️ Размытое значение — СИНЕЕ. Это краска `Unknown` из коды главы 1 и краска
// «сигнал есть» всего ролика: цвет говорит «значение существует», блюр —
// «мы его не знаем». Рифма работает, только если сцены стоят подряд.
const FOG_C = Canon.keyword;

// ── сетка ───────────────────────────────────────────────────────────────
const FS = 42;                       // мобильная читаемость: не мельче табло
const HEAD_FS = 22;
const HEAD_LS = 2.4;

const HEADS = [
  'ID', 'NAME', 'DATE OF BIRTH', 'MAIDEN NAME',
  'COMMISSION', 'SPOUSE', 'CLEARANCE', 'TERMINATED',
  'PENSION PLAN', 'LAST REVIEW', 'NEXT OF KIN', 'EXIT INTERVIEW',
];
// ширины считаны по самому длинному содержимому колонки (шапка или значение)
// плюс поле; первые четыре — базовый кадр, остальные восемь ждут за краем.
// ⚠️ «За краем» — не фигура речи и не следствие ширин: кадр 1920 шире базовой
// таблицы, поэтому пятая-шестая колонки ФИЗИЧЕСКИ попадают в него и в первом
// кадре были видны. Их держит сигнал `grow` (0 до беата разрастания).
const COL_W = [165, 418, 317, 292, 225, 265, 205, 317, 250, 317, 292, 282];
const BASE_COLS = 4;
const X0 = -564;                     // базовые четыре колонки центрированы

const COL_X: number[] = [];
{
  let x = X0;
  for (const w of COL_W) {
    COL_X.push(x);
    x += w;
  }
}
const SHEET_R = COL_X[COL_X.length - 1] + COL_W[COL_W.length - 1];   // 2781

const RULE_L = -612;                 // линейки с напуском по 48px
const RULE_W_BASE = 1224;
const RULE_W_FULL = SHEET_R + 48 - RULE_L;

const HEAD_Y = -172;
const HEAD_RULE_Y = -133;
const ROW_Y0 = -62;
const ROW_H = 94;
const rowY = (i: number) => ROW_Y0 + i * ROW_H;

// ⚠️ Запись 0413 — наша: у неё ОБЕ клетки пусты. У соседей обе заполнены,
// иначе неоткуда узнать, что колонки вообще бывают со значениями. Дальше по
// схеме `null` рассыпан у всех троих — так выглядит настоящая таблица, а не
// один сломанный человек.
const NUL = 'null';
const ROWS: string[][] = [
  ['0412', 'Margaret Ellis', '1979-07-19', 'Whitfield',
   '4 200', 'T. Ellis', 'L3', NUL, NUL, '2025-04-11', NUL, NUL],
  ['0413', 'Peter Hallam', NUL, NUL,
   NUL, NUL, 'L2', NUL, 'AVC-2', '2025-02-27', 'S. Hallam', NUL],
  ['0414', 'Anna Boyd', '1988-02-03', 'Carrow',
   NUL, 'R. Boyd', NUL, '2024-11-02', NUL, NUL, 'M. Carrow', NUL],
];
const SUBJ_ROW = 1;
const COL_DOB = 2;
const COL_MAIDEN = 3;

const FOG_TEXT = '1962-11-04';       // значение, которого мы не знаем

// ── тайминги ────────────────────────────────────────────────────────────
const IN = 1.2;
const HOLD_LEDGER = 3.2;             // ⚠️ VO — Кодд вернулся в 1986
const RACK = 1.0;
// ⚠️ У наводки ТРИ ПЛАНА, а не два. Дальний (вся таблица) уходит в шёпот;
// ближний (ключ и имя нашей записи) остаётся тенью — иначе непонятно, что обе
// клетки принадлежат одному человеку; а шапки двух наших колонок НЕ ГАСНУТ
// ВООБЩЕ: без прочитанного `MAIDEN NAME` второй беат не существует — там весь
// смысл в том, какой вопрос задан этой клетке.
const RACK_DIM = 0.12;
const NEAR_DIM = 0.35;
const HOLD_ROW = 1.6;                // ⚠️ VO — одна запись, две пустые клетки
const FOG_IN = 0.9;
const HOLD_FOG = 2.6;                // ⚠️ VO — значение есть, мы его не знаем
const VOID_OUT = 1.1;
const HOLD_VOID = 2.8;               // ⚠️ VO — узнавать нечего
const CRIME = 0.5;
const CRIME_CD = 0.055;              // печать четырёх букв
const HOLD_CRIME = 3.0;              // ⚠️ VO — один символ на оба случая
const OPEN_UP = 0.9;
const TRUCK = 6.6;                   // ⚠️ VO — почему две; шесть; двенадцать
const HOLD_TRUCK = 1.6;
const DARK_OUT = 1.0;
const DARK = 0.8;                    // ⚠️ VO — и они оставили один
const HOLD_END = 3.4;                // ⚠️ VO — а смыслы никуда не делись
const OUT = 1.0;

const TRUCK_DX = RULE_L + RULE_W_BASE - (SHEET_R + 48);   // правый конец линеек
                                     // встаёт на место правого края базового кадра
const BLUR_IN = 14;                  // focus-pull входа
const FOG_BLUR_FROM = 26;
// ⚠️ Значение обязано остаться НЕЧИТАЕМЫМ. На первом прогоне радиус 5.5 давал
// разборчивую дату — а «мы знаем, что оно есть, но не знаем какое» ломается
// ровно в ту секунду, когда зритель дочитал цифры.
// ⚠️ И не слишком большим: блюр размазывает ту же краску по большей площади,
// поэтому на 10 значение стало бледнее окружающих данных и читалось как «почти
// ничего», а нужно «оно есть». 8.5 — граница, где цифры ещё неразличимы, но
// пятно плотное и синее.
const FOG_BLUR_TO = 8.5;

// ═══════════════════════════════════════════════════════════════════════
export default makeScene2D(function* (view) {
  applyBackground(view);

  // Вся таблица — один узел: она приходит КАК ОДНО (focus-pull на родителе,
  // дети размываются вместе) и едет как одно.
  const ghost = createSignal(1);      // дальний план наводки
  const near = createSignal(1);       // ближний: ключ и имя нашей записи
  const grow = createSignal(0);       // колонки, которых пока «нет»
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

  const rule = (y: number, fill: string) =>
    sheet().add(
      <Rect
        x={RULE_L}
        y={y}
        offset={[-1, 0]}
        width={() => ruleW()}
        height={1}
        fill={fill}
        opacity={() => ghost()}
      />,
    );
  rule(HEAD_RULE_Y, HAIR_HEAD);
  for (let i = 1; i < ROWS.length; i++) rule(rowY(i) - ROW_H / 2, HAIR);
  rule(rowY(ROWS.length - 1) + ROW_H / 2, HAIR);

  HEADS.forEach((h, c) => {
    const subject = c === COL_DOB || c === COL_MAIDEN;
    sheet().add(
      <Txt
        text={h}
        x={COL_X[c]}
        y={HEAD_Y}
        offset={[-1, 0]}
        fontFamily={MONO}
        fontSize={HEAD_FS}
        letterSpacing={HEAD_LS}
        fill={HEAD_C}
        opacity={subject ? 1 : c >= BASE_COLS ? () => ghost() * grow() : () => ghost()}
      />,
    );
  });

  const cellStyle = (c: number, r: number) => ({
    x: COL_X[c],
    y: rowY(r),
    offset: [-1, 0] as [number, number],
    fontFamily: MONO,
    fontSize: FS,
  });

  ROWS.forEach((row, r) =>
    row.forEach((v, c) => {
      // две клетки нашей записи строятся отдельно — они переживут сцену
      if (r === SUBJ_ROW && (c === COL_DOB || c === COL_MAIDEN)) return;
      const fill = c === 0 ? KEY_C : c === 1 ? INK : v === NUL ? NULL_C : VAL;
      const plane = r === SUBJ_ROW && c <= 1 ? near : ghost;
      sheet().add(
        <Txt
          {...cellStyle(c, r)}
          text={v}
          fontWeight={c === 1 ? 500 : 400}
          fill={fill}
          opacity={c >= BASE_COLS ? () => plane() * grow() : () => plane()}
        />,
      );
    }),
  );

  // ── две клетки-предмета ───────────────────────────────────────────────
  // Они НЕ подчиняются `ghost`: пока таблица уходит в шёпот, живыми остаются
  // только они. Дальше у каждой своя судьба, поэтому и сигналы свои.
  const dobNullOp = createSignal(1);
  const dobFogOp = createSignal(0);
  const fogBlur = createSignal(FOG_BLUR_FROM);
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
  // ⚠️ Размытая дата кэшируется отдельно: блюр должен есть ТОЛЬКО её, и ему
  // нужен запас поля, иначе радиус срежется по краю глифов.
  sheet().add(
    <Txt
      {...cellStyle(COL_DOB, SUBJ_ROW)}
      text={FOG_TEXT}
      fill={FOG_C}
      cache
      cachePadding={90}
      filters={[blur(() => fogBlur())]}
      opacity={() => dobFogOp()}
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

  // печать: те же четыре буквы, что были, тем же цветом
  const typeIn = function* (t: Txt, s: string, cd: number): ThreadGenerator {
    for (let i = 1; i <= s.length; i++) {
      t.text(s.slice(0, i));
      yield* waitFor(cd);
    }
  };

  // ═══ ТАЙМЛАЙН ═══════════════════════════════════════════════════════
  // 1. леджер приходит как одно
  yield* all(
    sheet().opacity(1, IN * 0.8, easeOutCubic),
    sheetBlur(0, IN, easeInOutCubic),
  );
  yield* waitFor(HOLD_LEDGER);

  // 2. rack-focus на одну запись: живыми остаются два `null`
  yield* all(
    ghost(RACK_DIM, RACK, easeInOutSine),
    near(NEAR_DIM, RACK, easeInOutSine),
  );
  yield* waitFor(HOLD_ROW);

  // 3a. левая клетка раскрывается ЗНАЧЕНИЕМ — оно есть, но не в фокусе
  yield* all(
    dobNullOp(0, FOG_IN * 0.55, easeInCubic),
    dobFogOp(1, FOG_IN * 0.8, easeOutCubic),
    fogBlur(FOG_BLUR_TO, FOG_IN, easeOutCubic),
  );
  dobNull().text('');
  yield* waitFor(HOLD_FOG);

  // 3b. правая просто уходит: там нечему быть в фокусе. Размытая дата при этом
  // ОСТАЁТСЯ на экране — два разных ничего рядом и есть главный кадр сцены.
  yield* maidenNullOp(0, VOID_OUT, easeInCubic);
  maidenNull().text('');
  yield* waitFor(HOLD_VOID);

  // 4. преступление: поверх обоих печатается одно и то же слово
  dobNullOp(1);
  maidenNullOp(1);
  yield* all(
    dobFogOp(0, CRIME * 0.6, easeInCubic),
    chain(
      waitFor(CRIME * 0.36),
      all(
        typeIn(dobNull(), NUL, CRIME_CD),
        typeIn(maidenNull(), NUL, CRIME_CD),
      ),
    ),
  );
  fogBlur(FOG_BLUR_FROM);
  yield* waitFor(HOLD_CRIME);

  // 5. «а почему две» — свет возвращается, схема оказывается шире кадра
  // и уходит вправо. Линейки уезжают вместе с проявлением новых колонок: это
  // одно движение — таблица разворачивается, — а не две отдельные анимации.
  yield* all(
    ghost(1, OPEN_UP, easeInOutSine),
    near(1, OPEN_UP, easeInOutSine),
    grow(1, OPEN_UP, easeInOutSine),
    ruleW(RULE_W_FULL, OPEN_UP * 1.1, easeInOutCubic),
  );
  yield* sheet().x(TRUCK_DX, TRUCK, easeInOutSine);
  yield* waitFor(HOLD_TRUCK);

  // 6. темнота — и тот же самый первый кадр
  yield* all(
    sheet().opacity(0, DARK_OUT, easeInCubic),
    sheetBlur(9, DARK_OUT, easeInCubic),
  );
  // ⚠️ В темноте возвращаем ВСЁ состояние первого кадра — иначе «тот же кадр»
  // будет неправдой: и положение, и длина линеек, и невидимость колонок роста.
  sheet().x(0);
  ruleW(RULE_W_BASE);
  grow(0);
  sheetBlur(BLUR_IN);
  yield* waitFor(DARK);

  yield* all(
    sheet().opacity(1, IN * 0.8, easeOutCubic),
    sheetBlur(0, IN, easeInOutCubic),
  );
  yield* waitFor(HOLD_END);

  yield* all(
    sheet().opacity(0, OUT, easeInCubic),
    sheetBlur(7, OUT, easeInCubic),
  );
  yield* waitFor(0.3);
});
