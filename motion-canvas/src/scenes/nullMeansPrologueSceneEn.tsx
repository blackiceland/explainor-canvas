import {blur, Gradient, Img, makeScene2D, Node, Rect, Txt} from '@motion-canvas/2d';
import {
  all,
  chain,
  createRef,
  createSignal,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  easeInOutSine,
  linear,
  SimpleSignal,
  Vector2,
  waitFor,
} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Colors, Screen} from '../core/theme';

// ПРОЛОГ «Your null means too much»: 1965 (консольная печать, моно + мигающая
// каретка; титул живёт ОТДЕЛЬНОЙ сценой nullMeansTitleSerifSceneEn и здесь его
// нет) → ЕДИНОЕ движение камеры: 1965 улетает влево со смазом, фон светлеет и
// оказывается ДВИЖУЩИМСЯ фото (панорама Хоара, 2 слоя: фон-с-тенью + вырезка;
// параллакс сдержанный: дрейф камеры, Хоар едва расходится с собственной тенью)
// → настенная цитата “MY BILLION-DOLLAR MISTAKE.” (референс 35a13f9c: тёмная
// краска, caps, тень вправо-вниз) → КРОСС-ФЕЙД в страницу CACM → зум в шапку →
// хайлайтер бледно-розовым красит строки (имя → заголовок → June, 1966) →
// расфокус + `reference T + null` ОДНОЙ строкой → камера едет вправо →
// сужение кадра в тонкую фото-полосу → лента языков со слот-защёлкиванием
// null-конструкций (равные зазоры, тёплые цвета) → полоса СМЫКАЕТСЯ блоками
// сверху/снизу — остаётся графитовый канвас.
//
// ⚠️ Ассеты: public/hoare/*-3200x1350.* — ОБА слоя абсолютно в одних координатах
// и масштабе (вырезка выровнена по полному кадру солвером в _hoare_prep.mjs,
// сдвиг -22/+1 уже запечён в PNG). Тень Хоара встроена в ФОН — едет со стеной.
// Фигура в панораме: центр x=1593 (49.8%), bbox x[1335..1851] y[241..1064].
//
// ⚠️ Стены правее фигуры всего ~1350px×S — «Хоар уходит за левую границу» при
// полной ширине полосы физически требует продолжения стены: справа пристыкована
// ЗЕРКАЛЬНАЯ копия фона (шов x_img=1600 за правым краем экрана до старта пана;
// стена однородна, горизонтальная линия на ней продолжается зеркально без скачка).

// ── изображение и композиция ────────────────────────────────────────────
const IMG_W = 3200;
const IMG_H = 1350;
const FIG_CX = 1593;                 // центр фигуры в пикселях ассета
const PHOTO_S = 0.88;                // базовый масштаб панорамы (высота 1188 ≥ 1080)
const toLayer = (imgX: number) => imgX - IMG_W / 2;   // img-пиксели → координаты слоя

// Хоар на ~32% ширины экрана после влёта:
const FIG_SCREEN_X = 0.32 * Screen.width - Screen.width / 2;           // −345.6
const PAN_X0 = Math.round(FIG_SCREEN_X - toLayer(FIG_CX) * PHOTO_S);   // −340

const SERIF = 'Newsreader, serif';

// ── тайминги (все ключевые — константами) ───────────────────────────────
const YEAR_KEY = 0.13;               // интервал печати цифр (консоль)
const YEAR_HOLD = 1.15;              // курсор мигает
const YEAR_FLY = 0.5;                // 1965 улетает влево ПОЛНОСТЬЮ (блокирующе)
const SHUTTER_DUR = 1.0;             // затем МЯГКОЕ проявление движущегося фото
const SHUTTER_TRAVEL = 300;
const SETTLE = 0.85;
const QUOTE_IN = 0.8;
const HOARE_BLOCK = 8.0;             // ⚠️ VO: от полного появления Хоара до срыва в страницу
const QUOTE_HOLD = HOARE_BLOCK - SETTLE - QUOTE_IN;
const QUOTE_OUT = 0.5;               // гаснет УЖЕ В ДВИЖЕНИИ срыва

// ── страница ALGOL: КРОСС-ФЕЙД из фото (толчок вправо читался дёшево);
// единственная функция — доказать связь Хоар ↔ 1965 ↔ ALGOL W ───────────
const PAGE_SRC = '/hoare/algol-paper-horizontal-3200x1800.jpg';
const PAGE_W = 3200;
const PAGE_H = 1800;
const PAGE_S = 0.6;                  // 3200×1800 → ровно 1920×1080
const XFADE = 1.15;                  // кросс-фейд фото → страница
const PAGE_XF_S = 1.055;             // страница приходит чуть крупнее и оседает
const PHOTO_XF_S = 1.05;             // фото на выходе продолжает еле заметный пуш
const PAGE_HOLD_0 = 0.55;            // страница целиком, в полном контрасте
// ⚠️ Эта страница — АЛИБИ: она доказывает только связку Хоар↔Wirth↔1966 и
// проходит БЫСТРО. Разбор по строкам ведёт второй документ (Record Handling,
// nullMeansRecordHandlingSceneEn) — два подробных зума в бумагу подряд читались
// бы как приём, а не как расследование. Поэтому здесь: имя + заголовок и всё,
// без спуска к колонтитулу.
// зум в шапку: имя, заголовок и аффилиации становятся читаемыми (мобилка).
// ⚠️ кадр обязан оставаться ВНУТРИ ассета: при масштабе s точка p может уехать
// в центр только если p.y*s ≥ 540 сверху и (1800−p.y)*s ≥ 540 снизу — иначе за
// краем jpg открывается пустота. При s = PAGE_S*ZOOM_S = 1.5 шапка проходит,
// колонтитул (y≈1642) — нет, поэтому он ставится в нижнюю треть кадра.
const ZOOM_DUR = 1.0;
const ZOOM_S = 2.5;
const ZOOM_AT = {x: 1585, y: 400};   // точка страницы, которая уезжает в центр
const HL_DUR = 0.45;                 // хайлайтер проводит по строке
const HL_GAP = 0.22;
const PAGE_HOLD_1 = 0.5;
const DEFOCUS = 0.7;                 // страница уходит в расфокус
const PAGE_SCRIM = 0.8;              // белая страница под скримом всё равно светлая:
                                     // 0.72 давало серый фон под кремовым текстом
const SCHEME_IN = 0.6;
const SCHEME_HOLD = 2.4;             // ⚠️ VO: «...and implemented as ALGOL W»
const SCHEME_OUT = 0.4;
const CAM_RIGHT = 560;               // камера едет вправо ПЕРЕД сужением кадра
const CAM_RIGHT_DUR = 1.15;

// ── хайлайтер: бледно-розовый маркер поверх набора (multiply — как краска
// по бумаге, а не плашка). Координаты — замеренные экстенты краски на ассете
// (_measure_page.mjs), не на глаз: маркер шире строки читается как плашка ───
const HL_FILL = 'rgb(247, 179, 196)';
const PAGE_MARGIN = 'rgb(209, 209, 210)';   // тон поля вокруг листа на ассете
const HL_LINES = [
  {x0: 1743, x1: 1908, cy: 417, h: 44},   // C. A. R. Hoare
  {x0: 1204, x1: 1968, cy: 362, h: 52},   // A Contribution to the Development of ALGOL
];
// «June, 1966» в колонтитуле (x0 1224, x1 1316, cy 1642) НЕ выделяем: спуск к
// низу листа стоил ~2с и делал алиби подробным. Дату несёт озвучка.

const SQUEEZE_DUR = 1.4;
const BAND_H = 164;                  // финальная фото-полоса
const BELT_STEP_DUR = 0.85;          // на один язык
const SHUT_H = 700;                  // высота блоков-шторок финала
const SHUT_DUR = 0.6;                // блоки смыкаются сверху и снизу

// параллакс: дрейф камеры остаётся, расхождение Хоара со стеной приглушено
// (на полном ходу фигура заметно отрывалась от собственной тени — читалось
// как вырезка, а не как глубина)
const CAMERA_DRIFT = -96;            // стена+цитата (камера медленно едет вправо)
const HOARE_DRIFT = -20;             // Хоар дополнительно к стене
const HOARE_SCALE = 1.016;           // Хоар ближе к камере — растёт чуть быстрее фона
const DRIFT_DUR = SHUTTER_DUR + SETTLE + QUOTE_IN + QUOTE_HOLD;

// ── цитата на стене (по референсу 35a13f9c: CAPS с кавычками, ТЁМНАЯ
// «краска» на стене, классический сериф, выраженная тень вправо-вниз) ────
const QUOTE_X = 2465;
const QUOTE_Y = 430;
const QUOTE_FS = 100;                // ×0.88 ≈ 88 экранных (капс ~62px)
const QUOTE_PITCH = 128;
const QUOTE_FILL = 'rgba(44, 44, 48, 0.85)';
const QUOTE_SHADOW = 'rgba(0, 0, 0, 0.5)';

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
const BELT_CHAR = BELT_FS * 0.6;     // advance моно — для измерения ширин пар
const BELT_INNER = 52;               // зазор имя ↔ конструкция
const BELT_GAP = 200;                // РАВНЫЙ визуальный зазор между парами
const SLOT_LH = 56;                  // шаг барабана
const BELT_NAME = 'rgba(232, 207, 174, 0.78)';   // тёплый беж, НЕ белый
const BELT_FORM = 'rgba(244, 230, 200, 0.96)';
const BELT_DIM = 0.28;               // приглушение соседей
const MONO = 'JetBrains Mono, monospace';

const BG_SRC = '/hoare/hoare-background-3200x1350.jpg';
const CUT_SRC = '/hoare/hoare-cutout-3200x1350.png';

export default makeScene2D(function* (view) {
  applyBackground(view);

  // изображения должны быть готовы до первого кадра со стиллом
  yield Promise.all(
    [BG_SRC, CUT_SRC, PAGE_SRC].map(
      src =>
        new Promise<void>(resolve => {
          const el = document.createElement('img');
          el.onload = () => resolve();
          el.onerror = () => resolve();
          el.src = src;
        }),
    ),
  );

  // ═══ 1. 1965 — консольная печать (моно + блочная каретка) ═════════════
  const yearNode = createRef<Node>();
  view.add(<Node ref={yearNode} />);
  const YEAR = '1965';
  const YEAR_FS = 110;
  const YEAR_ADV = YEAR_FS * 0.6;    // advance моно
  const YEAR_BEIGE = 'rgba(232, 207, 174, 0.96)';
  const yearLeft = -(YEAR.length * YEAR_ADV) / 2;
  const yearTxt = new Txt({
    text: '',
    x: yearLeft,
    offset: [-1, 0],
    fontFamily: MONO,
    fontSize: YEAR_FS,
    fontWeight: 500,
    fill: YEAR_BEIGE,
  });
  const cursor = new Rect({
    x: yearLeft + YEAR_ADV * 0.5,
    offset: [-1, 0],
    width: YEAR_ADV * 0.72,
    height: YEAR_FS * 0.98,
    fill: YEAR_BEIGE,
    opacity: 0,
  });
  yearNode().add(yearTxt);
  yearNode().add(cursor);
  // ghost-хвосты для улёта влево: длинный смаз позади движения.
  // ⚠️ Две ловушки, обе уже наступлены: копий должно быть много (двух хватало
  // ровно на «одна строка отстала»), и блюр обязан ПЕРЕКРЫВАТЬ шаг копий —
  // иначе смещения, кратные моно-advance (YEAR_ADV), выстраивают цифры в
  // читаемый ряд «5 5 5 5» вместо смаза. Поэтому шаг растёт нелинейно и не
  // кратен advance, а блюр догоняет расстояние.
  const YEAR_TAIL = [
    {dx: 19, op: 0.30, bl: 4},
    {dx: 47, op: 0.25, bl: 7},
    {dx: 87, op: 0.20, bl: 11},
    {dx: 141, op: 0.16, bl: 15},
    {dx: 211, op: 0.12, bl: 20},
    {dx: 299, op: 0.08, bl: 26},
    {dx: 407, op: 0.05, bl: 32},
    {dx: 537, op: 0.03, bl: 38},
  ];
  const yearTailOp = createSignal(0);
  YEAR_TAIL.forEach(g => {
    const node = new Txt({
      text: YEAR,
      x: yearLeft + g.dx,
      offset: [-1, 0],
      fontFamily: MONO,
      fontSize: YEAR_FS,
      fontWeight: 500,
      fill: YEAR_BEIGE,
      opacity: () => g.op * yearTailOp(),
      filters: [blur(g.bl)],
      cachePadding: g.bl * 2 + 12,   // без запаса кэша блюр срезает по краю ноды
    });
    yearNode().add(node);
  });

  // ═══ 2-5. Фото-фрейм ══════════════════════════════════════════════════
  const frameH = createSignal(Screen.height);
  const photoFrame = createRef<Rect>();
  view.add(
    <Rect ref={photoFrame} width={Screen.width} height={() => frameH()} clip opacity={0} />,
  );

  const panorama = createRef<Node>();
  const bgLayer = createRef<Node>();
  const hoareLayer = createRef<Node>();
  photoFrame().add(<Node ref={panorama} x={PAN_X0 + SHUTTER_TRAVEL} scale={PHOTO_S} />);

  // слои: оба Img с ОДИНАКОВЫМИ размерами/позицией; глубина — только доп. сдвиг ноды Хоара
  panorama().add(<Node ref={bgLayer} />);
  bgLayer().add(<Img src={BG_SRC} width={IMG_W} height={IMG_H} />);
  // зеркальное продолжение стены: отражение вокруг img_x=MIRROR_SEAM (внутри ровной
  // стены, ДО краевой виньетки — стык у края давал видимую вертикальную линию;
  // симметричная точка на однородной стене шва не показывает). Клип отрезает
  // часть зеркала, которая иначе перекрыла бы оригинал краевыми пикселями.
  const MIRROR_SEAM = 3120;                                  // img_x точки отражения
  const seamU = MIRROR_SEAM - IMG_W / 2;                     // 1520 в координатах слоя
  const mirrorW = 3120;                                      // покрытие правее шва (с запасом на весь пан)
  const mirrorCx = seamU + mirrorW / 2;                      // центр клип-окна
  const mirrorImgCx = seamU + (MIRROR_SEAM - IMG_W / 2);     // центр зеркального Img: u=seam → img_x=seam
  const mirrorClip = new Rect({x: mirrorCx, width: mirrorW, height: IMG_H, clip: true});
  mirrorClip.add(new Img({src: BG_SRC, width: IMG_W, height: IMG_H, scale: [-1, 1], x: mirrorImgCx - mirrorCx}));
  bgLayer().add(mirrorClip);
  panorama().add(<Node ref={hoareLayer} />);
  hoareLayer().add(<Img src={CUT_SRC} width={IMG_W} height={IMG_H} />);

  // цитата — типографика НА СТЕНЕ: ребёнок слоя фона, движется и скейлится с ним
  const quote = createRef<Node>();
  bgLayer().add(<Node ref={quote} x={toLayer(QUOTE_X)} y={QUOTE_Y - IMG_H / 2} opacity={0} scale={1.03} />);
  const quoteLine = (text: string, y: number) => (
    <Txt
      text={text}
      y={y}
      fontFamily={SERIF}
      fontSize={QUOTE_FS}
      fontWeight={500}
      letterSpacing={2}
      fill={QUOTE_FILL}
      shadowColor={QUOTE_SHADOW}
      shadowBlur={16}
      shadowOffset={new Vector2(18, 13)}   // по референсу: выраженная тень вправо-вниз
    />
  );
  quote().add(quoteLine('“MY BILLION-DOLLAR', -QUOTE_PITCH / 2));
  quote().add(quoteLine('MISTAKE.”', QUOTE_PITCH / 2));

  // ghost-копии панорамы для low-shutter (без шейдеров: смещённые полупрозрачные дубли)
  const GHOSTS = [
    {dx: 60, op: 0.3, bl: 3},
    {dx: 124, op: 0.22, bl: 4},
    {dx: 196, op: 0.14, bl: 5},
    {dx: 276, op: 0.08, bl: 6},
  ];
  const ghostRefs: Node[] = [];
  for (const g of GHOSTS) {
    const gn = new Node({x: () => panorama().x() + g.dx, scale: PHOTO_S, opacity: g.op, filters: [blur(g.bl)]});
    gn.add(new Img({src: BG_SRC, width: IMG_W, height: IMG_H}));
    gn.add(new Img({src: CUT_SRC, width: IMG_W, height: IMG_H}));
    photoFrame().add(gn);
    ghostRefs.push(gn);
  }

  // ТОЧНАЯ копия стандартного фона (градиент + тёплый spotlight) — для полутени
  // полосы и для блоков-шторок финала
  const makeBackdrop = () => {
    const n = new Node({});
    n.add(
      new Rect({
        width: Screen.width,
        height: Screen.height,
        fill: new Gradient({
          type: 'linear',
          from: new Vector2(0, -Screen.height / 2),
          to: new Vector2(0, Screen.height / 2),
          stops: [
            {offset: 0, color: Colors.background.from},
            {offset: 1, color: Colors.background.to},
          ],
        }),
      }),
    );
    n.add(
      new Rect({
        width: Screen.width,
        height: Screen.height,
        fill: new Gradient({
          type: 'radial',
          from: new Vector2(Screen.width * 0.12, -Screen.height * 0.12),
          to: new Vector2(Screen.width * 0.12, -Screen.height * 0.12),
          fromRadius: 0,
          toRadius: Screen.width * 0.95,
          stops: [
            {offset: 0, color: 'rgba(246,231,212,0.045)'},
            {offset: 1, color: 'rgba(255,255,255,0)'},
          ],
        }),
      }),
    );
    return n;
  };
  // ═══ Страница ALGOL (внутри фото-фрейма: наследует сужение в полосу) ═══
  // Акцент — не окна света в затемнении, а ЗУМ в шапку и хайлайтер: розовая
  // краска ложится по строке (multiply — бумага просвечивает сквозь маркер).
  const toPage = (px: number, py: number) => [px - PAGE_W / 2, py - PAGE_H / 2] as const;
  // положение рига, при котором точка страницы p оказывается в центре кадра
  const pageAt = (p: {x: number; y: number}, s: number) => {
    const [lx, ly] = toPage(p.x, p.y);
    return new Vector2(-lx * s, -ly * s);
  };
  const pageBlur = createSignal(0);
  const pageRig = createRef<Node>();
  photoFrame().add(
    <Node ref={pageRig} scale={PAGE_S * PAGE_XF_S} opacity={0} filters={[blur(() => pageBlur())]} />,
  );
  // подложка в тон поля: страховка от пустоты за краем ассета на любом
  // промежуточном кадре зума/спуска (сам jpg кадр перекрывает, см. ZOOM_S)
  pageRig().add(new Rect({width: PAGE_W * 3, height: PAGE_H * 3, fill: PAGE_MARGIN}));
  pageRig().add(new Img({src: PAGE_SRC, width: PAGE_W, height: PAGE_H}));

  // хайлайтер: ширина растёт слева направо, как ведут маркером
  const makeHighlight = (hl: {x0: number; x1: number; cy: number; h: number}) => {
    const [lx, ly] = toPage(hl.x0, hl.cy);
    const pad = hl.h * 0.22;
    const r = new Rect({
      x: lx - pad,
      y: ly,
      offset: [-1, 0],
      width: 0,
      height: hl.h,
      fill: HL_FILL,
      compositeOperation: 'multiply',
      opacity: 0.82,
    });
    pageRig().add(r);
    return {rect: r, w: hl.x1 - hl.x0 + pad * 2};
  };
  const highlights = HL_LINES.map(makeHighlight);

  const pageScrim = new Rect({width: PAGE_W * 3, height: PAGE_H * 3, fill: 'rgb(8, 9, 12)', opacity: 0});
  pageRig().add(pageScrim);

  // современная схема поверх расфокусной страницы: первое появление слова null.
  // ОДНОЙ строкой — раскладка по моно-advance, чтобы null стоял на своём месте.
  const scheme = createRef<Node>();
  photoFrame().add(<Node ref={scheme} opacity={0} />);
  const SCHEME_FS = 74;
  const SCHEME_ADV = SCHEME_FS * 0.6;
  const SCHEME_PARTS = [
    {text: 'reference T', fill: 'rgba(232, 207, 174, 0.96)'},
    {text: '+', fill: 'rgba(232, 207, 174, 0.55)'},
    {text: 'null', fill: 'rgba(244, 230, 200, 0.96)'},
  ];
  const SCHEME_SEP = SCHEME_ADV * 1.6;   // воздух вокруг «+»
  const schemeW =
    SCHEME_PARTS.reduce((sum, p) => sum + p.text.length * SCHEME_ADV, 0) + SCHEME_SEP * 2;
  let schemeX = -schemeW / 2;
  for (const part of SCHEME_PARTS) {
    scheme().add(
      <Txt
        text={part.text}
        x={schemeX}
        offset={[-1, 0]}
        fontFamily={MONO}
        fontSize={SCHEME_FS}
        fontWeight={500}
        fill={part.fill}
      />,
    );
    schemeX += part.text.length * SCHEME_ADV + SCHEME_SEP;
  }

  // блоки-шторки финала: графитовые массы сверху и снизу СМЫКАЮТСЯ, закрывая
  // фото-полосу. Заливка = копия фона, компенсированная к экранным координатам
  // (шторка невидима на фоне; видимым остаётся только съедание полосы).
  // До финала паркуются за краями экрана.
  const makeShutter = (sign: -1 | 1) => {
    const shut = new Rect({
      width: Screen.width,
      height: SHUT_H,
      y: sign * (Screen.height / 2 + SHUT_H / 2 + 20),
      clip: true,
    });
    const backdrop = makeBackdrop();
    backdrop.position.y(() => -shut.position.y());
    shut.add(backdrop);
    view.add(shut);
    return shut;
  };
  const shutterTop = makeShutter(-1);
  const shutterBot = makeShutter(1);

  // ═══ 6. Лента языков (внутри полосы) ══════════════════════════════════
  const belt = createRef<Node>();
  photoFrame().add(<Node ref={belt} opacity={0} />);
  const pairOps: SimpleSignal<number>[] = [];
  const slotCols: Node[] = [];
  const slotGhostOps: SimpleSignal<number>[] = [];
  // кумулятивная раскладка: ширина пары = имя + зазор + СВОЯ конструкция,
  // между парами РАВНЫЙ зазор (фиксированный шаг давал плавающие дыры)
  const pairCenters: number[] = [];
  let cursorX = 0;
  LANGS.forEach((lang, i) => {
    const nameW = lang.name.length * BELT_CHAR;
    const formW = lang.form.length * BELT_CHAR;
    const winW = formW + 28;
    const pairW = nameW + BELT_INNER + winW;
    const pairX = cursorX;
    cursorX += pairW + BELT_GAP;
    pairCenters.push(pairX + pairW / 2);

    const op = createSignal(i === 0 ? 1 : BELT_DIM);
    pairOps.push(op);
    const pair = new Node({x: pairX, opacity: () => op()});
    pair.add(
      new Txt({
        text: lang.name,
        x: 0,
        offset: [-1, 0],
        fontFamily: MONO,
        fontSize: BELT_FS,
        fontWeight: 500,
        fill: BELT_NAME,
      }),
    );
    const window = new Rect({x: nameW + BELT_INNER + winW / 2, width: winW, height: SLOT_LH, clip: true});
    // барабан: чужие конструкции пролетают (длинные клипаются окном — смаз), своя защёлкивается
    const others = LANGS.filter((_, j) => j !== i).map(l => l.form);
    const reel = [others[(i + 1) % others.length], others[(i + 3) % others.length], others[(i + 4) % others.length], lang.form];
    const makeReel = () => {
      const n = new Node({});
      reel.forEach((form, r) => {
        n.add(
          new Txt({
            text: form,
            y: r * SLOT_LH,
            offset: [-1, 0],
            x: -winW / 2 + 14,
            fontFamily: MONO,
            fontSize: BELT_FS,
            fontWeight: 500,
            fill: BELT_FORM,
          }),
        );
      });
      return n;
    };
    const col = makeReel();
    const gop = createSignal(0);
    slotGhostOps.push(gop);
    for (const sign of [-1, 1]) {
      const ghost = makeReel();
      ghost.position.y(() => col.position.y() + sign * 26);
      ghost.opacity(() => gop());
      window.add(ghost);
    }
    window.add(col);
    slotCols.push(col);
    pair.add(window);
    belt().add(pair);
  });

  // ═══ ТАЙМЛАЙН ═════════════════════════════════════════════════════════
  // t≈0.5 год | 2.2 влёт | 4.4 цитата | 12.4 кросс-фейд | 14.4 зум | 21 схема | 25 полоса
  yield* waitFor(0.5);

  // 1965 — консольная печать: посимвольно, каретка ведёт и мигает
  cursor.opacity(1);
  for (let i = 1; i <= YEAR.length; i++) {
    yield* waitFor(YEAR_KEY);
    yearTxt.text(YEAR.slice(0, i));
    cursor.position.x(yearLeft + YEAR_ADV * i + YEAR_ADV * 0.18);
  }
  for (let b = 0; b < 2; b++) {
    yield* waitFor(YEAR_HOLD * 0.28);
    cursor.opacity(0);
    yield* waitFor(YEAR_HOLD * 0.22);
    cursor.opacity(1);
  }

  // переход: 1965 сначала ПОЛНОСТЬЮ улетает влево со смазом, и только потом
  // тьма мягко светлеет, оказываясь уже движущимся фото
  yield all(
    // параллакс на всю вводную: дрейф камеры на слоях (panorama.x свободен
    // для влёта/пана) + Хоар едет и растёт относительно стены
    bgLayer().x(CAMERA_DRIFT, DRIFT_DUR + SHUTTER_DUR, easeInOutSine),
    hoareLayer().x(CAMERA_DRIFT + HOARE_DRIFT, DRIFT_DUR + SHUTTER_DUR, easeInOutSine),
    hoareLayer().scale(HOARE_SCALE, DRIFT_DUR + SHUTTER_DUR, easeInOutSine),
  );
  // год срывается влево; фото начинает светлеть на 60% его пути — без паузы-дыры,
  // но и без наложения на стоящие цифры
  cursor.opacity(0);                 // каретка не улетает вместе со строкой
  yield all(
    yearNode().x(-1560, YEAR_FLY, easeInCubic),
    // хвост набирает силу вместе с разгоном и гаснет к концу пролёта
    chain(yearTailOp(1, YEAR_FLY * 0.35, easeOutCubic), yearTailOp(0, YEAR_FLY * 0.65, easeInCubic)),
  );
  yield* waitFor(YEAR_FLY * 0.6);
  yield* all(
    photoFrame().opacity(1, SHUTTER_DUR * 0.85, easeInOutCubic),
    panorama().x(PAN_X0, SHUTTER_DUR, easeOutCubic),
    ...ghostRefs.map(g => g.opacity(0, SHUTTER_DUR * 0.9, easeOutCubic)),
  );
  ghostRefs.forEach(g => g.remove());

  yield* waitFor(SETTLE);

  // цитата на стене: opacity + едва заметный scale, никакого печатания
  yield* all(quote().opacity(1, QUOTE_IN, easeOutCubic), quote().scale(1, QUOTE_IN, easeOutCubic));
  yield* waitFor(QUOTE_HOLD);

  // ═══ 5. Кросс-фейд фото → страница ALGOL ═════════════════════════════
  // толчок вправо на этом стыке читался дёшево: два разных мира не должны
  // толкать друг друга, они должны смениться. Фото досматривает свой пуш и
  // растворяется, страница проступает чуть крупнее и оседает в кадр.
  yield* all(
    quote().opacity(0, QUOTE_OUT, easeInCubic),
    panorama().scale(PHOTO_S * PHOTO_XF_S, XFADE, easeInOutSine),
    panorama().opacity(0, XFADE * 0.85, easeInOutCubic),
    pageRig().opacity(1, XFADE * 0.85, easeInOutCubic),
    pageRig().scale(PAGE_S, XFADE, easeOutCubic),
  );
  yield* waitFor(PAGE_HOLD_0);

  // зум в шапку: имя, заголовок и аффилиации становятся читаемыми
  yield* all(
    pageRig().scale(PAGE_S * ZOOM_S, ZOOM_DUR, easeInOutCubic),
    pageRig().position(pageAt(ZOOM_AT, PAGE_S * ZOOM_S), ZOOM_DUR, easeInOutCubic),
  );

  // хайлайтер ведёт по строкам: сначала имя, затем заголовок — и дальше сразу
  for (const hl of highlights) {
    yield* hl.rect.size.x(hl.w, HL_DUR, easeInOutSine);
    yield* waitFor(HL_GAP);
  }
  yield* waitFor(PAGE_HOLD_1);

  // страница уходит в расфокус, поверх — современная схема (reference T + null)
  yield* all(
    pageBlur(9, DEFOCUS, easeInOutCubic),
    pageScrim.opacity(PAGE_SCRIM, DEFOCUS, easeInOutCubic),
    scheme().opacity(1, SCHEME_IN + 0.2, easeOutCubic),
  );
  yield* waitFor(SCHEME_HOLD);
  yield* scheme().opacity(0, SCHEME_OUT, easeInOutCubic);

  // ═══ 5b. Камера едет вправо и ЛИШЬ ЗАТЕМ кадр сужается в полосу ══════
  yield* pageRig().position.x(pageRig().position.x() - CAM_RIGHT, CAM_RIGHT_DUR, easeInOutCubic);
  yield* frameH(BAND_H, SQUEEZE_DUR, easeInOutCubic);
  yield* waitFor(0.25);

  // ═══ 6. Лента языков (в полосе — расфокусная страница под скримом) ════
  belt().x(-pairCenters[0] + 420);
  yield pageScrim.opacity(0.87, 0.55, easeInOutCubic);
  yield belt().opacity(1, 0.35, easeOutCubic);
  for (let i = 0; i < LANGS.length; i++) {
    const col = slotCols[i];
    const spinTarget = -(col.children().length - 1) * SLOT_LH;
    yield* all(
      belt().x(-pairCenters[i], 0.34, easeInOutCubic),
      ...pairOps.map((op, j) => op(j === i ? 1 : BELT_DIM, 0.3, easeInOutCubic)),
      slotGhostOps[i](0.22, 0.12, linear),
      col.position.y(spinTarget, 0.52, easeOutCubic),
    );
    yield slotGhostOps[i](0, 0.18, linear);
    yield* waitFor(BELT_STEP_DUR - 0.52);
  }
  yield* waitFor(0.35);

  // ═══ 7. Финал: лента уходит, графитовые БЛОКИ сверху и снизу смыкаются,
  // съедая фото-полосу — остаётся чистый графитовый канвас ══════════════
  yield* belt().opacity(0, 0.4, easeInOutCubic);
  shutterTop.position.y(-(BAND_H / 2 + SHUT_H / 2));
  shutterBot.position.y(BAND_H / 2 + SHUT_H / 2);
  yield* all(
    shutterTop.position.y(-SHUT_H / 2, SHUT_DUR, easeInOutCubic),
    shutterBot.position.y(SHUT_H / 2, SHUT_DUR, easeInOutCubic),
  );
  yield* waitFor(0.5);
});
