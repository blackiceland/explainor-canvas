import {Gradient, Img, Node, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  chain,
  createRef,
  createSignal,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
  Vector2,
} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Colors, Fonts, Screen} from '../core/theme';

// ═══════════════════════════════════════════════════════════════════════
// КОДА АКТА 1 «YOUR NULL MEANS TOO MUCH».
//
// Вынесена из nullMeansActOneSceneEn отдельной сценой (правка автора).
// Причина не косметическая: акт смонтирован под озвучку кадр в кадр, а её
// хвост дорос примерно на 11 секунд сверх него. Отдельная сцена ничем не
// связана — её длина ровно такая, какой её сделает голос, и сам акт трогать
// не пришлось. ⚠️ Приём на будущее: если хвост не влезает в замороженный
// монтаж — резать сцену, а не растягивать её.
//
// ⚠️ СТЫК. Акт кончается полосой НА ЗАБЛЮРЕННОЙ СТРАНИЦЕ: в 164px видна
// размытая машинопись с розовыми полосками маркера по null, сверху и снизу
// фон. Кода начинается ровно этим кадром, и берётся он не пересборкой
// геометрии, а САМИМ КАДРОМ: `act-one-tail-1920x1080.png` — это отрендеренный
// последний кадр акта (2173). Так стык гарантированно пиксель в пиксель, и в
// коде не дублируются замороженные константы второй половины (rigAt, AT_NULL,
// RH_READ_S, полоски маркера) — их рассинхрон отследить было бы нечем.
// ⚠️ Если меняешь конец акта — перегенерируй подложку: включи сцену в
// project.ts и сними её последний кадр в этот файл.
//
// Драматургия коды: чем это лечили (лента языков) → чего мы добились
// (розовым: Can it be missing?) → как это называлось (CHAPTER ONE / NO SIGNAL).
// ═══════════════════════════════════════════════════════════════════════

const TAIL_SRC = '/hoare/act-one-tail-1920x1080.png';
const MONO = Fonts.code;

// полоса — ровно та, в которую схлопывается акт
const BAND_H = 164;
// ⚠️ Схлопывание делает САМА ПОЛОСА (frameH → 0), а не шторки поверх кадра.
// Шторки закрывали бы всё сверху, и строка оказалась бы ПЕРЕД полосой —
// именно это автор и забраковал. Полоса же сходится вместе со своим
// содержимым и открывает то, что лежит под ней. Ход длиннее прежних 0.6:
// строка 52px прячется, пока полоса шире неё, значит на сам выход остаётся
// только хвост движения — его надо дать разглядеть.
const COLLAPSE = 1.1;

// ── лента языков ────────────────────────────────────────────────────────
const LANGS: {name: string; form: string}[] = [
  {name: 'Kotlin', form: 'T?'},
  {name: 'Swift', form: 'Optional<T>'},
  {name: 'TypeScript', form: 'T | null'},
  {name: 'C#', form: 'T?'},
  {name: 'Rust', form: 'Option<T>'},
  {name: 'Java', form: 'Optional<T>'},
];
const BELT_FS = 44;
const BELT_CHAR = BELT_FS * 0.6;
const BELT_INNER = 52;
const BELT_GAP = 200;
const BELT_NAME = 'rgba(232, 207, 174, 0.78)';
const BELT_FORM = 'rgba(244, 230, 200, 0.96)';
const BELT_DIM = 0.28;
const BELT_IN = 0.6;
const BELT_STEP = 0.5;
const BELT_READ = 0.6;               // ⚠️ VO — на каждый язык
const BELT_OUT = 0.45;

// ── вопрос ──────────────────────────────────────────────────────────────
// ⚠️ Розовый взят у chapter2ClosingQuoteSceneEn — там он держит РОВНО ТУ ЖЕ
// роль: кода главы, осадок после голоса. Прежний Canon.methodCall (#FFAEC0)
// автор забраковал: он кодовый, для вызовов, и на полосе звучит крикливо.
const SOFT_PINK = 'rgba(236, 189, 200, 0.95)';
const ASK_FS = 52;
const ASK_IN = 0.7;
const ASK_HOLD = 3.0;                // ⚠️ автор: держится три секунды
const ASK_OUT = 0.7;

// ── карточка главы ──────────────────────────────────────────────────────
// ⚠️ Дизайн взят из problemsYouDontHaveLieIntroSceneEn (указание автора):
// кегли 40/72, трекинг 18/16, смещения −60/+30, и приход ПО ОЧЕРЕДИ простым
// фейдом — сначала eyebrow, пауза, потом титул. Никакого фокус-пулла.
const CHAPTER_FS = 40;
const TITLE_FS = 72;
const TEXT_COLOR = 'rgba(244, 241, 235, 0.95)';
const MUTED = 'rgba(244, 241, 235, 0.6)';
const CARD_WAIT = 0.4;
const EYEBROW_IN = 0.8;
const EYEBROW_HOLD = 0.8;
const TITLE_IN = 0.7;
const CARD_HOLD = 3.0;
const CARD_OUT = 1.2;

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ⚠️ ВОПРОС ЛЕЖИТ ПОД ПОЛОСОЙ и добавляется РАНЬШЕ неё. В этом вся суть
  // перехода: полоса не «уезжает, а потом появляется текст» — она СХОДИТСЯ И
  // ОТКРЫВАЕТ его. Пока полоса шире строки, розовый спрятан за ней целиком;
  // когда она сужается, буквы выходят сверху и снизу; когда сходится в ноль —
  // строка стоит одна. Прозрачность поднимается заранее и в кадре не читается:
  // открывает не фейд, а сама полоса.
  const ask = createRef<Node>();
  view.add(<Node ref={ask} opacity={0} />);
  ask().add(
    new Txt({
      text: 'Can it be missing?',
      fontFamily: MONO,
      fontSize: ASK_FS,
      fontWeight: 500,
      fill: SOFT_PINK,
    }),
  );

  // ⚠️ Подложка (последний кадр акта) лежит ВНУТРИ полосы, а не на весь
  // экран: полоса схлопывается вместе со своим содержимым, и за кадром
  // остаётся только общий фон — тот же, что и в акте.
  const frameH = createSignal(BAND_H);
  const stage = createRef<Rect>();
  view.add(<Rect ref={stage} width={Screen.width} height={() => frameH()} clip />);
  stage().add(<Img src={TAIL_SRC} width={Screen.width} height={Screen.height} />);

  // ── лента ─────────────────────────────────────────────────────────────
  const belt = createRef<Node>();
  stage().add(<Node ref={belt} opacity={0} />);
  const pairCenters: number[] = [];
  const pairOps: ReturnType<typeof createSignal<number>>[] = [];
  {
    let cursorX = 0;
    LANGS.forEach((lang, i) => {
      const nameW = lang.name.length * BELT_CHAR;
      const formW = lang.form.length * BELT_CHAR;
      const pairW = nameW + BELT_INNER + formW;
      const pairX = cursorX;
      cursorX += pairW + BELT_GAP;
      pairCenters.push(pairX + pairW / 2);

      const op = createSignal(i === 0 ? 1 : BELT_DIM);
      pairOps.push(op);
      const pair = new Node({x: pairX, opacity: () => op()});
      pair.add(
        new Txt({
          text: lang.name,
          offset: [-1, 0],
          fontFamily: MONO,
          fontSize: BELT_FS,
          fontWeight: 500,
          fill: BELT_NAME,
        }),
      );
      pair.add(
        new Txt({
          text: lang.form,
          x: nameW + BELT_INNER,
          offset: [-1, 0],
          fontFamily: MONO,
          fontSize: BELT_FS,
          fontWeight: 500,
          fill: BELT_FORM,
        }),
      );
      belt().add(pair);
    });
  }



  // ── карточка главы: на view, ПОВЕРХ закрытых шторок ───────────────────
  const eyebrow = new Txt({
    text: 'CHAPTER 1',
    fontFamily: Fonts.primary,
    fontWeight: 500,
    fontSize: CHAPTER_FS,
    letterSpacing: 18,
    fill: MUTED,
    y: -60,
    opacity: 0,
  });
  const title = new Txt({
    text: 'NO SIGNAL',
    fontFamily: Fonts.primary,
    fontWeight: 700,
    fontSize: TITLE_FS,
    letterSpacing: 16,
    fill: TEXT_COLOR,
    y: 30,
    opacity: 0,
  });
  const card = new Node({});
  card.add(eyebrow);
  card.add(title);
  view.add(card);

  // ═══════════════ ТАЙМЛАЙН ════════════════════════════════════════════
  // ═══ 1. Чем это лечили ══════════════════════════════════════════════
  belt().position.x(-pairCenters[0]);
  yield* belt().opacity(1, BELT_IN, easeOutCubic);
  yield* waitFor(BELT_READ);
  for (let i = 1; i < LANGS.length; i++) {
    yield* all(
      belt().position.x(-pairCenters[i], BELT_STEP, easeInOutCubic),
      ...pairOps.map((op, j) => op(j === i ? 1 : BELT_DIM, BELT_STEP, easeInOutCubic)),
    );
    yield* waitFor(BELT_READ);
  }
  yield* belt().opacity(0, BELT_OUT, easeInCubic);
  belt().remove();
  yield* waitFor(0.25);

  // ═══ 2. СХЛОПЫВАНИЕ И ЕСТЬ ПЕРЕХОД ══════════════════════════════════
  // ⚠️ Вопрос НЕ ждёт, пока полоса закроется, — он проступает ПРЯМО В ХОДЕ
  // схлопывания и к его концу уже стоит. Сначала я развёл их по очереди
  // (закрылось → пауза → вопрос), и автор это забраковал: получались два
  // отдельных события вместо одного перехода. Розовый начинает подниматься
  // с 40% хода шторок — раньше нельзя, иначе он ляжет на ещё открытую
  // полосу с заблюренной машинописью.
  yield* all(
    frameH(0, COLLAPSE, easeInOutCubic),
    chain(waitFor(COLLAPSE * 0.15), ask().opacity(1, ASK_IN, easeOutCubic)),
  );
  yield* waitFor(ASK_HOLD);
  yield* ask().opacity(0, ASK_OUT, easeInCubic);
  ask().remove();
  yield* waitFor(CARD_WAIT);
  yield* eyebrow.opacity(1, EYEBROW_IN, easeInOutCubic);
  yield* waitFor(EYEBROW_HOLD);
  yield* title.opacity(1, TITLE_IN, easeInOutCubic);
  yield* waitFor(CARD_HOLD);
  yield* card.opacity(0, CARD_OUT, easeInOutCubic);
  yield* waitFor(0.3);
});
