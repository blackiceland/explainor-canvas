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

// ПРОЛОГ «Your null means too much»: титул-эссе → 1965 (консольная печать,
// моно + мигающая каретка) → ЕДИНОЕ движение камеры: 1965 улетает влево со
// смазом, фон светлеет и оказывается ДВИЖУЩИМСЯ фото (панорама Хоара, 2 слоя:
// фон-с-тенью + вырезка; параллакс: дрейф камеры, Хоар едет и растёт
// относительно собственной тени на стене) → настенная цитата “MY BILLION-DOLLAR
// MISTAKE.” (референс 35a13f9c: тёмная краска, caps, тень вправо-вниз) →
// пан вправо + сужение кадра в тонкую фото-полосу → лента языков со слот-
// защёлкиванием null-конструкций (равные зазоры, тёплые цвета) → полоса
// темнеет в графит и СМЫКАЕТСЯ сверху/снизу — остаётся графитовый канвас.
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
const FIG_RIGHT = 1851;
const PHOTO_S = 0.88;                // базовый масштаб панорамы (высота 1188 ≥ 1080)
const toLayer = (imgX: number) => imgX - IMG_W / 2;   // img-пиксели → координаты слоя

// Хоар на ~32% ширины экрана после влёта:
const FIG_SCREEN_X = 0.32 * Screen.width - Screen.width / 2;           // −345.6
const PAN_X0 = Math.round(FIG_SCREEN_X - toLayer(FIG_CX) * PHOTO_S);   // −340
// финальный пан: правый край фигуры полностью за левой границей (+30px запаса)
const PAN_X_END = Math.round(-Screen.width / 2 - 30 - toLayer(FIG_RIGHT) * PHOTO_S); // −1211
const PAN_Y_END = 216;               // вертикальный дрейф: полоса приходит на чистую стену

// ── титул (утверждённый эссе-заголовок) ─────────────────────────────────
const SERIF = 'Newsreader, serif';
const WARM_CREAM = 'rgba(244, 230, 200, 0.96)';
const TITLE_FS = 148;
const TITLE_PITCH = 150;
const TITLE_Y = -24;

// ── тайминги (все ключевые — константами) ───────────────────────────────
const TITLE_IN = 0.85;
const TITLE_HOLD = 2.6;
const TITLE_OUT = 0.8;
const YEAR_KEY = 0.13;               // интервал печати цифр (консоль)
const YEAR_HOLD = 1.15;              // курсор мигает
const YEAR_FLY = 0.5;                // 1965 улетает влево ПОЛНОСТЬЮ (блокирующе)
const SHUTTER_DUR = 1.0;             // затем МЯГКОЕ проявление движущегося фото
const SHUTTER_TRAVEL = 300;
const SETTLE = 0.85;
const QUOTE_IN = 0.8;
const QUOTE_HOLD = 12.0;             // ⚠️ ДЛИНА ВВОДНОЙ ОЗВУЧКИ — сюда встанет VO
const QUOTE_OUT = 0.55;              // гаснет УЖЕ В ДВИЖЕНИИ пана
const PAN_LEAD = 0.15;               // пан стартует чуть раньше сужения
const PAN_DUR = 1.65;
const SQUEEZE_DUR = 1.4;
const BAND_H = 164;                  // финальная фото-полоса
const BELT_STEP_DUR = 0.85;          // на один язык
const SHUT_H = 700;                  // высота блоков-шторок финала
const SHUT_DUR = 0.6;                // блоки смыкаются сверху и снизу

// параллакс: заметный дрейф камеры + Хоар едет и растёт относительно фона
// (фигура расходится с СОБСТВЕННОЙ тенью на стене — главный сигнал глубины)
const CAMERA_DRIFT = -110;           // стена+цитата (камера медленно едет вправо)
const HOARE_DRIFT = -55;             // Хоар дополнительно к стене
const HOARE_SCALE = 1.045;           // Хоар ближе к камере — растёт быстрее фона
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
    [BG_SRC, CUT_SRC].map(
      src =>
        new Promise<void>(resolve => {
          const el = document.createElement('img');
          el.onload = () => resolve();
          el.onerror = () => resolve();
          el.src = src;
        }),
    ),
  );

  // ═══ 1. Титул ═════════════════════════════════════════════════════════
  const title = createRef<Node>();
  view.add(<Node ref={title} y={TITLE_Y} opacity={0} />);
  title().add(
    <Txt text={'Your null'} y={-TITLE_PITCH / 2} fontFamily={SERIF} fontSize={TITLE_FS} fontWeight={500} fill={WARM_CREAM} />,
  );
  title().add(
    <Txt text={'means too much'} y={TITLE_PITCH / 2} fontFamily={SERIF} fontSize={TITLE_FS} fontWeight={500} fill={WARM_CREAM} />,
  );

  // ═══ 1b. 1965 — консольная печать (моно + блочная каретка) ════════════
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
  // ghost-хвосты для улёта влево (смаз позади движения)
  const yearGhosts = [34, 76].map((dx, i) => {
    const g = new Txt({
      text: YEAR,
      x: yearLeft + dx,
      offset: [-1, 0],
      fontFamily: MONO,
      fontSize: YEAR_FS,
      fontWeight: 500,
      fill: YEAR_BEIGE,
      opacity: 0,
    });
    yearNode().add(g);
    return {node: g, op: i === 0 ? 0.3 : 0.14};
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
  const tint = createRef<Node>();
  photoFrame().add(<Node ref={tint} opacity={0} />);
  tint().add(makeBackdrop());

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
  // t≈0.4 титул | 5.0 год | 6.7 влёт | 8.9 цитата | 21.5 пан | 23.8 лента | 30.1 доска
  yield* waitFor(0.4);
  yield* title().opacity(1, TITLE_IN, easeOutCubic);
  yield* waitFor(TITLE_HOLD);
  yield* title().opacity(0, TITLE_OUT, easeInOutCubic);
  yield* waitFor(0.35);

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
  yield* all(
    yearNode().x(-1560, YEAR_FLY, easeInCubic),
    ...yearGhosts.map(g =>
      chain(g.node.opacity(g.op, YEAR_FLY * 0.3, linear), g.node.opacity(0, YEAR_FLY * 0.7, easeOutCubic)),
    ),
  );
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

  // ═══ 5. Пан вправо + сужение в полосу (цитата гаснет УЖЕ В ДВИЖЕНИИ) ══
  yield all(
    panorama().x(PAN_X_END, PAN_DUR, easeInOutCubic),
    panorama().y(PAN_Y_END, PAN_DUR, easeInOutCubic),
  );
  yield quote().opacity(0, QUOTE_OUT, easeInCubic);
  yield* waitFor(PAN_LEAD);
  yield* frameH(BAND_H, SQUEEZE_DUR, easeInOutCubic);
  yield* waitFor(PAN_DUR - SQUEEZE_DUR - PAN_LEAD + 0.25);

  // ═══ 6. Лента языков ══════════════════════════════════════════════════
  // полоса уходит в полутень (светлые тексты ленты иначе тонут на светлой стене);
  // фаза 7 просто ДОВОДИТ это затемнение до полного графита
  belt().x(-pairCenters[0] + 420);
  yield tint().opacity(0.55, 0.55, easeInOutCubic);
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
