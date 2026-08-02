import {blur, Gradient, Img, Line, makeScene2D, Node, Rect, Txt} from '@motion-canvas/2d';
import {
  all,
  chain,
  createRef,
  createSignal,
  easeInCubic,
  easeInOutCubic,
  easeInOutSine,
  easeOutCubic,
  easeOutSine,
  SimpleSignal,
  Vector2,
  waitFor,
} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Colors, Fonts, Screen} from '../core/theme';
import {Canon} from '../core/code/model/paletteCanon';

// ═══════════════════════════════════════════════════════════════════════
// АКТ 1 «YOUR NULL MEANS TOO MUCH» — ОДНОЙ СЦЕНОЙ.
//
// Драматургия: приговор → вопрос → язык, который он строил → УЛИКА, и в ней
// три перехода «бумага ↔ графит», каждый несёт текст, а не камера:
//
//   1) печатная строка объявления  → наш код НА ТОМ ЖЕ МЕСТЕ И ТОГО ЖЕ
//      РАЗМЕРА (шаг литеры машинописи 18.05 pt листа × RH_READ_S = наш
//      CODE_ADV, замер _rh9_rows.mjs). Связь держит НЕПОДВИЖНОСТЬ;
//   2) наша фраза своими словами → его печатная строка (обратный ход);
//   3) слово null снимается с его страницы и дописывает нашу строку.
//
// Между ними — графит: код слева, карточка справа, строка N и клетка N на
// ОДНОЙ высоте. Карточка растёт ИЗ кода по одному полю и существует ради
// единственной вещи, которой в тексте нет: стрелки наружу. На `father`
// стрелка уходит за кадр — камера отъезжает и находит вторую карточку.
// На `elder sibling` указывать не на кого: клетка остаётся ПУСТОЙ, строка
// создания встаёт на третьем аргументе. Ответ приходит не от нас, а с его
// страницы.
//
// ⚠️ Порядок «карточка учит → страница подтверждает → чертёж опознаётся».
//    Ничего не вводить дважды в разном виде; термин после вещи, не до.
// ⚠️ Текстовых тезисов в акте нет: их произносит озвучка.
// ⚠️ Даты: ALGOL — июнь 1966, Record Handling — сентябрь 1966. 1965 — год
//    работы над языком; подписывать этим годом сами документы нельзя.
// ═══════════════════════════════════════════════════════════════════════

const BG_SRC = '/hoare/hoare-background-3200x1350.jpg';
const CUT_SRC = '/hoare/hoare-cutout-3200x1350.png';
const IMG_W = 3200;
const IMG_H = 1350;
const FIG_CX = 1593;
const PHOTO_S = 0.88;
const toLayer = (imgX: number) => imgX - IMG_W / 2;
const FIG_SCREEN_X = 0.32 * Screen.width - Screen.width / 2;
const PAN_X0 = Math.round(FIG_SCREEN_X - toLayer(FIG_CX) * PHOTO_S);
const MIRROR_SEAM = 3120;

const SERIF = 'Newsreader, serif';
const MONO = Fonts.code;

// ── 1965 ────────────────────────────────────────────────────────────────
// ⚠️ Год НЕ улетает: печатается, мигает курсором и просто гаснет.
const YEAR = '1965';
const YEAR_FS = 110;
const YEAR_ADV = YEAR_FS * 0.6;
const YEAR_BEIGE = 'rgba(232, 207, 174, 0.96)';
const YEAR_KEY = 0.13;
const YEAR_HOLD = 1.15;
const YEAR_OUT = 0.32;

// ⚠️ Влёт фото резкий: короткий ход, easeOutCubic, и проявка ещё быстрее —
// иначе движение кончается раньше, чем кадр становится виден.
const PHOTO_TRAVEL = 440;
const PHOTO_IN = 0.92;
const PHOTO_FADE = 0.3;
const SETTLE = 0.7;

// ── краска на стене ─────────────────────────────────────────────────────
const QUOTE_X = 2465;
const QUOTE_Y = 430;
const QUOTE_FS = 100;
const QUOTE_PITCH = 128;
const QUOTE_FILL = 'rgba(44, 44, 48, 0.85)';
const QUOTE_SHADOW = 'rgba(0, 0, 0, 0.5)';
const ATTRIB_FS = 34;
const ATTRIB_FILL = 'rgba(44, 44, 48, 0.58)';
const QUOTE_IN = 0.8;
const ATTRIB_IN = 0.5;
const QUOTE_HOLD = 5.0;              // ⚠️ VO
// смена приговора на вопрос — ГОРИЗОНТАЛЬНЫЙ СМАЗ, БЕЗ ПАУЗЫ МЕЖДУ НИМИ:
// уход и приход идут в одном all(), вопрос стартует, пока приговор ещё жив.
const SMEAR_N = 26;
const SMEAR_SPREAD = 340;
const SMEAR_OP = 0.12;
const SMEAR_BLUR = 4;
const ASK_SWAP = 0.9;
// ⚠️ Настоящая причина «паузы» была в том, что уход и приход стояли двумя
// отдельными yield*. Теперь они в одном all(), а перекрытие держим коротким:
// при 0.22 обе фразы читаются одновременно и получается двойная экспозиция.
const ASK_OVERLAP = 0.36;
const ASK_HOLD = 2.6;                // ⚠️ VO

const CAMERA_DRIFT = -96;
const HOARE_DRIFT = -20;
const HOARE_SCALE = 1.016;

// ── страница ALGOL (алиби) ──────────────────────────────────────────────
const ALGOL_SRC = '/hoare/algol-sheet-1181x1594.jpg';
const SH_W = 1181;
const SH_H = 1594;
const toSheet = (x: number, y: number) => [x - SH_W / 2, y - SH_H / 2] as const;
const WALL_X = 1900;
const WALL_Y = -10;
const WALL_SCALE = 0.46;
const PAN_DUR = 1.7;
const APPROACH = 1.8;
const SH_READ = 1.72;
const SH_HEAD = {x: 594, y: 330};
const LIGHT_HOLD = 2.0;              // ⚠️ VO
const SET_ASIDE = 1.0;

// ── страницы Record Handling ────────────────────────────────────────────
const RH9_SRC = '/hoare/record-handling-p9-4800x2700.jpg';
const RH11_SRC = '/hoare/record-handling-p11-4800x2700.jpg';
const RH_W = 4800;
const RH_H = 2700;
const PAPER_W = 1672;
const PAPER_H = 2440;
const TILT = -0.45;
const RH_REVEAL_S = 0.78;
const RH_AT_REVEAL = {x: 836, y: 1180};
const RH_READ_S = 1.2;
const RH_HOLD_0 = 0.9;
const RH_PUSH = 1.1;
const AT_DECL = {x: 810, y: 1158};
// кадровки для двух цитат: печатная строка попадает ровно туда, где стояла
// наша фраза (y = OBS_Y и NULL_Y на графите)
const OBS_Y = 300;
const AT_PARTIAL = {x: 810, y: 1851 - OBS_Y / RH_READ_S};
const AT_NULL = {x: 810, y: 2011 - OBS_Y / RH_READ_S};

const HL_FILL = 'rgb(247, 179, 196)';
// ⚠️ объявление занимает ТРИ печатные строки — маркер идёт по всем трём
// (замеры _rh9_rows.mjs, координаты листа)
const HL_DECL_1 = {x0: 117, x1: 1133, cy: 1010, h: 46};
const HL_DECL_2 = {x0: 500, x1: 1395, cy: 1050, h: 46};
const HL_DECL_3 = {x0: 1246, x1: 1427, cy: 1089, h: 46};
const HL_PARTIAL = {x0: 120, x1: 849, cy: 1851, h: 46};
const HL_NULL_A = {x0: 1040, x1: 1428, cy: 2011, h: 45};
const HL_NULL_B = {x0: 120, x1: 266, cy: 2051, h: 43};
const HL_DUR = 0.55;
const HL_STEP = 0.16;
const READ_DECL = 1.1;               // ⚠️ VO
const HL_WRAP = 0.28;
const READ_PARTIAL = 1.6;            // ⚠️ VO
const READ_NULL = 1.5;               // ⚠️ VO

// ── схема Хоара, стр. 11 (замеры _rh11_measure.mjs, координаты листа) ───
const BOX_1908 = {x0: 989, x1: 1177, y0: 471, y1: 737};
// ⚠️ В записи 1908 пусты father и elder sibling, а youngest offspring —
// СТРЕЛКА. Наша графитовая карточка обязана повторять это один в один,
// иначе узнавание на его чертеже ломается.
const NULLS_1908 = [
  {x0: 1038, x1: 1110, cy: 608, h: 46},    // father
  {x0: 1038, x1: 1111, cy: 660, h: 46},    // elder sibling
];
const NULLS_REST = [
  {x0: 1335, x1: 1407, cy: 1122, h: 46},   // 1934 · elder sibling
  {x0: 1335, x1: 1407, cy: 1174, h: 46},   // 1934 · youngest offspring
  {x0: 403, x1: 500, cy: 1194, h: 46},     // 1937 · youngest offspring
  {x0: 732, x1: 806, cy: 1710, h: 46},     // 1964 · elder sibling
  {x0: 732, x1: 806, cy: 1762, h: 46},     // 1964 · youngest offspring
];
const DIAG_IN = 1.1;
const DIAG_AT_WIDE = {x: 915, y: 1115};
const DIAG_S_WIDE = 0.71;
const DIAG_AT_BOX = {x: 1083, y: 604};
const DIAG_S_BOX = 2.0;
const DIAG_PUSH = 1.2;
const CONTOUR_IN = 0.6;
const CONTOUR_HOLD = 0.8;            // ⚠️ VO
const BOX_HL_HOLD = 1.6;             // ⚠️ VO
const DIAG_BACK = 1.3;
const REST_STEP = 0.22;
const DIAG_HOLD = 1.6;               // ⚠️ VO

// ── наш набор: палитра-канон ────────────────────────────────────────────
// ⚠️ По канону строчный идентификатор = ink, тип = лаванда, ключевое слово и
// число = синий. Поля записи — обычные идентификаторы (ink), НЕ param.
const CODE_FS = 36;
const CODE_ADV = CODE_FS * 0.6;
const KW = Canon.keyword;
const TY = Canon.type;
const IDENT = Canon.ink;
const PUN = Canon.punctuation;
const ROSE = Canon.methodCall;

// ── графит: код слева, карточка справа ──────────────────────────────────
// COL_X совпадает с экранным началом первой печатной строки, поэтому при
// перестроении в столбец шапка объявления по горизонтали НЕ едет.
const COL_X = -829;
const COL_Y0 = -228;
const ROW_H = 76;
const colAt = (row: number, col: number) => [COL_X + col * CODE_ADV, COL_Y0 + row * ROW_H] as const;

const CARD_X = 470;
const CARD_W = 300;
const CARD_H = ROW_H * 5;
const cellY = (i: number) => COL_Y0 + ROW_H * (i + 1);   // клетка i ↔ строка i+1
const CARD_STROKE = 'rgba(244, 241, 235, 0.34)';
const CARD_LABEL_FS = 34;
const CARD_VAL_FS = 34;

// вторая карточка — младший потомок, ниже-правее: семья растёт вниз, как на
// его листе
const OTHER_X = 1290;
const OTHER_Y = 300;

const REFLOW = 1.1;
const CARD_IN = 0.7;
const FIELD_STEP = 0.75;             // ⚠️ VO — по одному полю
const ARROW_DRAW = 0.6;
const REF_HOLD = 1.1;                // ⚠️ VO — «не значение, а указатель наружу»
const RETRACT = 0.7;
// ⚠️ Отъезд ЧЕСТНЫЙ: масштаб подобран так, чтобы в кадр целиком влезли и код,
// и обе карточки. Ничего не гасим и не обрезаем — обрезанный текст читается
// поломкой, а не композицией.
const PULL_S = 0.78;
const PULL_DUR = 1.4;
const PULL_HOLD = 1.3;               // ⚠️ VO
const BACK_DUR = 1.1;
const EMPTY_HOLD = 1.5;              // ⚠️ VO — клетке указывать не на кого

const MAKE_Y = 300;
const MAKE_CHAR = 0.03;
const STALL_HOLD = 1.8;              // ⚠️ VO — строка встала
const OBS_IN = 0.7;
const OBS_HOLD = 1.4;                // ⚠️ VO
const WORK_OUT = 0.75;
const HARDEN = 1.0;
const NULL_FLY = 0.8;
const NULL_STEP = 0.3;
const PAYOFF_HOLD = 2.0;             // ⚠️ VO

const EASY_IN = 0.8;
const EASY_HOLD = 2.8;               // ⚠️ VO

const SQUEEZE_DUR = 1.4;
const BAND_H = 164;
const BAND_HOLD = 0.7;
const SHUT_H = 700;
const SHUT_DUR = 0.6;

export default makeScene2D(function* (view) {
  applyBackground(view);

  yield Promise.all(
    [BG_SRC, CUT_SRC, ALGOL_SRC, RH9_SRC, RH11_SRC].map(
      src =>
        new Promise<void>(resolve => {
          const el = document.createElement('img');
          el.onload = () => resolve();
          el.onerror = () => resolve();
          el.src = src;
        }),
    ),
  );

  const frameH = createSignal(Screen.height);
  const stage = createRef<Rect>();
  view.add(<Rect ref={stage} width={Screen.width} height={() => frameH()} clip />);

  // ═══ 1. «1965» консолью ══════════════════════════════════════════════
  const yearNode = createRef<Node>();
  view.add(<Node ref={yearNode} />);
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

  // ═══ 2. Панорама Хоара ═══════════════════════════════════════════════
  const photo = createRef<Node>();
  const bgLayer = createRef<Node>();
  const hoareLayer = createRef<Node>();
  stage().add(<Node ref={photo} x={PAN_X0 + PHOTO_TRAVEL} scale={PHOTO_S} opacity={0} />);
  photo().add(<Node ref={bgLayer} />);
  bgLayer().add(<Img src={BG_SRC} width={IMG_W} height={IMG_H} />);
  const seamU = MIRROR_SEAM - IMG_W / 2;
  const mirrorW = 3120;
  const mirrorCx = seamU + mirrorW / 2;
  const mirrorImgCx = seamU + (MIRROR_SEAM - IMG_W / 2);
  const mirrorClip = new Rect({x: mirrorCx, width: mirrorW, height: IMG_H, clip: true});
  mirrorClip.add(new Img({src: BG_SRC, width: IMG_W, height: IMG_H, scale: [-1, 1], x: mirrorImgCx - mirrorCx}));
  bgLayer().add(mirrorClip);
  photo().add(<Node ref={hoareLayer} />);
  hoareLayer().add(<Img src={CUT_SRC} width={IMG_W} height={IMG_H} />);

  const GHOSTS = [
    {dx: 70, op: 0.26, bl: 1.5},
    {dx: 150, op: 0.18, bl: 2},
    {dx: 240, op: 0.11, bl: 2.5},
    {dx: 340, op: 0.06, bl: 3},
  ];
  const ghostRefs: Node[] = [];
  for (const g of GHOSTS) {
    const gn = new Node({x: () => photo().x() + g.dx, scale: PHOTO_S * 2, opacity: 0, filters: [blur(g.bl)]});
    gn.add(new Img({src: BG_SRC, width: IMG_W / 2, height: IMG_H / 2}));
    gn.add(new Img({src: CUT_SRC, width: IMG_W / 2, height: IMG_H / 2}));
    stage().add(gn);
    ghostRefs.push(gn);
  }

  // ── краска на стене + её горизонтальный смаз ─────────────────────────
  const wallLine = (text: string, y: number, fs: number, fill: string, shadow: boolean) => (
    <Txt
      text={text}
      y={y}
      fontFamily={SERIF}
      fontSize={fs}
      fontWeight={500}
      letterSpacing={2}
      fill={fill}
      shadowColor={shadow ? QUOTE_SHADOW : 'rgba(0,0,0,0)'}
      shadowBlur={shadow ? 16 : 0}
      shadowOffset={shadow ? new Vector2(18, 13) : new Vector2(0, 0)}
    />
  );
  const makeSmear = (lines: string[], spread: SimpleSignal<number>) => {
    const layer = new Node({});
    for (let i = 0; i < SMEAR_N; i++) {
      const t = i / (SMEAR_N - 1);
      const cell = new Node({
        x: () => -t * spread(),
        opacity: SMEAR_OP * Math.pow(1 - t, 1.5),
      });
      lines.forEach((ln, k) =>
        cell.add(wallLine(ln, (k - (lines.length - 1) / 2) * QUOTE_PITCH, QUOTE_FS, QUOTE_FILL, false)),
      );
      layer.add(cell);
    }
    layer.cache(true);
    layer.cachePadding(SMEAR_BLUR * 2 + 20);
    layer.filters([blur(SMEAR_BLUR)]);
    return layer;
  };

  // ⚠️ Слой смаза — СИБЛИНГ, а не ребёнок краски: внутри гаснущей ноды он не
  // может быть заметнее её самой, и переход снова читается фейдом.
  const quoteSpread = createSignal(0);
  const askSpread = createSignal(SMEAR_SPREAD);
  const quoteSmearOp = createSignal(0);
  const askSmearOp = createSignal(0);
  const quote = createRef<Node>();
  const attrib = createRef<Node>();
  const ask = createRef<Node>();
  const wallAt = (op: () => number) =>
    new Node({x: toLayer(QUOTE_X), y: QUOTE_Y - IMG_H / 2, opacity: op});

  const quoteSmearWrap = wallAt(() => quoteSmearOp());
  quoteSmearWrap.add(makeSmear(['“MY BILLION-DOLLAR', 'MISTAKE.”'], quoteSpread));
  bgLayer().add(quoteSmearWrap);
  bgLayer().add(<Node ref={quote} x={toLayer(QUOTE_X)} y={QUOTE_Y - IMG_H / 2} opacity={0} scale={1.03} />);
  quote().add(wallLine('“MY BILLION-DOLLAR', -QUOTE_PITCH / 2, QUOTE_FS, QUOTE_FILL, true));
  quote().add(wallLine('MISTAKE.”', QUOTE_PITCH / 2, QUOTE_FS, QUOTE_FILL, true));
  quote().add(<Node ref={attrib} opacity={0} />);
  attrib().add(wallLine('TONY HOARE · 2009', QUOTE_PITCH / 2 + 112, ATTRIB_FS, ATTRIB_FILL, false));

  const askSmearWrap = wallAt(() => askSmearOp());
  askSmearWrap.add(makeSmear(['WHAT EXACTLY', 'WAS THE MISTAKE?'], askSpread));
  bgLayer().add(askSmearWrap);
  bgLayer().add(<Node ref={ask} x={toLayer(QUOTE_X)} y={QUOTE_Y - IMG_H / 2} opacity={0} />);
  ask().add(wallLine('WHAT EXACTLY', -QUOTE_PITCH / 2, QUOTE_FS, QUOTE_FILL, true));
  ask().add(wallLine('WAS THE MISTAKE?', QUOTE_PITCH / 2, QUOTE_FS, QUOTE_FILL, true));

  // ── лист ALGOL на стене ──────────────────────────────────────────────
  const makeAlgolSheet = () => {
    const n = new Node({});
    n.add(
      new Rect({
        width: SH_W,
        height: SH_H,
        fill: 'rgb(232,228,219)',
        shadowColor: 'rgba(0,0,0,0.45)',
        shadowBlur: 46,
        shadowOffset: new Vector2(14, 22),
      }),
    );
    n.add(new Img({src: ALGOL_SRC, width: SH_W, height: SH_H}));
    return n;
  };
  const wallSheet = new Node({x: WALL_X, y: WALL_Y, scale: WALL_SCALE, opacity: 0});
  wallSheet.add(makeAlgolSheet());
  bgLayer().add(wallSheet);

  // ═══ Страницы Record Handling ════════════════════════════════════════
  const T = (TILT * Math.PI) / 180;
  const paperToAsset = (px: number, py: number) => {
    const dx = px - PAPER_W / 2;
    const dy = py - PAPER_H / 2;
    return [
      RH_W / 2 + dx * Math.cos(T) - dy * Math.sin(T),
      RH_H / 2 + dx * Math.sin(T) + dy * Math.cos(T),
    ] as const;
  };
  const toRig = (ax: number, ay: number) => [ax - RH_W / 2, ay - RH_H / 2] as const;
  const rigAt = (p: {x: number; y: number}, s: number) => {
    const [ax, ay] = paperToAsset(p.x, p.y);
    const [lx, ly] = toRig(ax, ay);
    return new Vector2(-lx * s, -ly * s);
  };
  const screenOf = (px: number, py: number, at: {x: number; y: number}, s: number) => {
    const [ax, ay] = paperToAsset(px, py);
    const [lx, ly] = toRig(ax, ay);
    const rig = rigAt(at, s);
    return [rig.x + lx * s, rig.y + ly * s] as const;
  };
  const makeHighlight = (host: Node, hl: {x0: number; x1: number; cy: number; h: number}) => {
    const [ax, ay] = paperToAsset(hl.x0, hl.cy);
    const [lx, ly] = toRig(ax, ay);
    const pad = hl.h * 0.2;
    const r = new Rect({
      x: lx - pad * Math.cos(T),
      y: ly - pad * Math.sin(T),
      offset: [-1, 0],
      rotation: TILT,
      width: 0,
      height: hl.h,
      fill: HL_FILL,
      compositeOperation: 'multiply',
      opacity: 0.82,
    });
    host.add(r);
    return {rect: r, w: hl.x1 - hl.x0 + pad * 2};
  };

  const rh9Blur = createSignal(0);
  const rh9 = createRef<Node>();
  stage().add(
    <Node ref={rh9} scale={RH_REVEAL_S} position={rigAt(RH_AT_REVEAL, RH_REVEAL_S)} opacity={0} filters={[blur(() => rh9Blur())]} />,
  );
  rh9().add(new Img({src: RH9_SRC, width: RH_W, height: RH_H}));
  const hlDecl = [HL_DECL_1, HL_DECL_2, HL_DECL_3].map(h => makeHighlight(rh9(), h));
  const hlPartial = makeHighlight(rh9(), HL_PARTIAL);
  const hlNullA = makeHighlight(rh9(), HL_NULL_A);
  const hlNullB = makeHighlight(rh9(), HL_NULL_B);

  const rh11Blur = createSignal(0);
  const rh11 = createRef<Node>();
  stage().add(
    <Node
      ref={rh11}
      scale={DIAG_S_WIDE}
      position={rigAt(DIAG_AT_WIDE, DIAG_S_WIDE)}
      opacity={0}
      filters={[blur(() => rh11Blur())]}
    />,
  );
  rh11().add(new Img({src: RH11_SRC, width: RH_W, height: RH_H}));
  const [bx, by] = paperToAsset((BOX_1908.x0 + BOX_1908.x1) / 2, (BOX_1908.y0 + BOX_1908.y1) / 2);
  const [blx, bly] = toRig(bx, by);
  const contour = new Rect({
    x: blx,
    y: bly,
    width: BOX_1908.x1 - BOX_1908.x0 + 26,
    height: BOX_1908.y1 - BOX_1908.y0 + 26,
    rotation: TILT,
    stroke: 'rgb(226, 104, 134)',
    lineWidth: 4,
    radius: 6,
    opacity: 0,
    scale: 1.05,
  });
  rh11().add(contour);
  const boxNulls = NULLS_1908.map(n => makeHighlight(rh11(), n));
  const restNulls = NULLS_REST.map(n => makeHighlight(rh11(), n));
  const rh11Scrim = new Rect({width: RH_W, height: RH_H, fill: 'rgb(8, 9, 12)', opacity: 0});
  rh11().add(rh11Scrim);

  // ═══ Лист ALGOL, взятый камерой ══════════════════════════════════════
  const soloSheet = new Node({scale: WALL_SCALE * PHOTO_S, opacity: 0});
  soloSheet.add(makeAlgolSheet());
  const [lx0, ly0] = toSheet(SH_HEAD.x, SH_HEAD.y);
  const lightNode = new Node({x: lx0, y: ly0, scale: [1, 0.4], opacity: 0});
  lightNode.add(
    new Rect({
      width: 7200,
      height: 9600,
      fill: new Gradient({
        type: 'radial',
        from: new Vector2(0, 0),
        to: new Vector2(0, 0),
        fromRadius: 430,
        toRadius: 980,
        stops: [
          {offset: 0, color: 'rgba(8,9,12,0)'},
          {offset: 0.42, color: 'rgba(8,9,12,0.34)'},
          {offset: 1, color: 'rgba(8,9,12,0.88)'},
        ],
      }),
    }),
  );
  soloSheet.add(lightNode);
  stage().add(soloSheet);

  // ⚠️ Виньетка на весь кадр: бумага без неё читается плоским белым листом,
  // а не документом в свете. На графитовых битах почти не видна.
  stage().add(
    new Rect({
      width: Screen.width * 1.2,
      height: Screen.height * 1.2,
      fill: new Gradient({
        type: 'radial',
        from: new Vector2(0, -60),
        to: new Vector2(0, -60),
        fromRadius: 380,
        toRadius: 1320,
        stops: [
          {offset: 0, color: 'rgba(10,11,14,0)'},
          {offset: 0.55, color: 'rgba(10,11,14,0.16)'},
          {offset: 1, color: 'rgba(10,11,14,0.62)'},
        ],
      }),
    }),
  );

  // ═══════════════ ГРАФИТ ══════════════════════════════════════════════
  // Один узел на всю графитовую часть: он же отъезжает камерой, он же
  // приглушается, когда сверху приходит бумага.
  const graphBlur = createSignal(0);
  const graph = createRef<Node>();
  stage().add(<Node ref={graph} opacity={0} filters={[blur(() => graphBlur())]} />);
  // ⚠️ Рабочее пространство (код, карточки, стрелка, строка создания) — своим
  // узлом: перед приходом бумаги графит должен ОПУСТЕТЬ до одной фразы, иначе
  // на кроссфейде код и машинопись накладываются и кадр превращается в кашу.
  const work = createRef<Node>();
  graph().add(<Node ref={work} />);

  // ── объявление: каждый токен знает своё место НА ЛИСТЕ и место В СТОЛБЦЕ
  type Tok = {t: string; c: string; pl: readonly [number, number]; cl: readonly [number, number]};
  const pageAt = (lineX: number, lineY: number, n: number) => {
    const [sx, sy] = screenOf(lineX, lineY, AT_DECL, RH_READ_S);
    return [sx + n * CODE_ADV, sy] as const;
  };
  const L1 = (n: number) => pageAt(120, 1010, n);
  const L2 = (n: number) => pageAt(500, 1050, n);
  const L3 = (n: number) => pageAt(1245, 1089, n);

  const DECL: Tok[] = [
    {t: 'record class ', c: KW, pl: L1(0), cl: colAt(0, 0)},
    {t: 'person ', c: TY, pl: L1(13), cl: colAt(0, 13)},
    {t: '(', c: PUN, pl: L1(20), cl: colAt(0, 20)},
    {t: 'integer ', c: TY, pl: L1(21), cl: colAt(1, 2)},
    {t: 'date of birth', c: IDENT, pl: L1(29), cl: colAt(1, 10)},
    {t: ';', c: PUN, pl: L1(42), cl: colAt(1, 23)},
    {t: 'Boolean ', c: TY, pl: L1(44), cl: colAt(2, 2)},
    {t: 'male', c: IDENT, pl: L1(52), cl: colAt(2, 10)},
    {t: ';', c: PUN, pl: L1(56), cl: colAt(2, 14)},
    {t: 'reference ', c: TY, pl: L2(0), cl: colAt(3, 2)},
    {t: '(', c: PUN, pl: L2(10), cl: colAt(3, 12)},
    {t: 'person', c: TY, pl: L2(11), cl: colAt(3, 13)},
    {t: ') ', c: PUN, pl: L2(17), cl: colAt(3, 19)},
    {t: 'father', c: IDENT, pl: L2(19), cl: colAt(3, 21)},
    {t: ',', c: PUN, pl: L2(25), cl: colAt(3, 27)},
    {t: 'elder sibling', c: IDENT, pl: L2(27), cl: colAt(4, 21)},
    {t: ',', c: PUN, pl: L2(40), cl: colAt(4, 34)},
    {t: 'youngest', c: IDENT, pl: L2(42), cl: colAt(5, 21)},
    {t: 'offspring', c: IDENT, pl: L3(0), cl: colAt(5, 30)},
    {t: ');', c: PUN, pl: L3(9), cl: colAt(6, 0)},
  ];
  const mkTok = (t: string, c: string, p: readonly [number, number], op = 1) =>
    new Txt({
      text: t,
      x: p[0],
      y: p[1],
      offset: [-1, 0],
      fontFamily: MONO,
      fontSize: CODE_FS,
      fontWeight: 500,
      fill: c,
      opacity: op,
    });
  const declNodes = DECL.map(d => {
    const n = mkTok(d.t, d.c, d.pl);
    work().add(n);
    return n;
  });
  // ⚠️ `reference (person)` в столбце повторяется трижды — две копии рождаются
  // на месте оригинала и проявляются по дороге к своим строкам.
  const PREFIX: {t: string; c: string; n: number}[] = [
    {t: 'reference ', c: TY, n: 0},
    {t: '(', c: PUN, n: 10},
    {t: 'person', c: TY, n: 11},
    {t: ') ', c: PUN, n: 17},
  ];
  const dupNodes: {node: Txt; to: readonly [number, number]}[] = [];
  for (const row of [4, 5]) {
    for (const p of PREFIX) {
      const n = mkTok(p.t, p.c, L2(p.n), 0);
      work().add(n);
      dupNodes.push({node: n, to: colAt(row, 2 + p.n)});
    }
  }
  // строки столбца — чтобы гасить всё, кроме читаемого поля
  const rowNodes: Txt[][] = [[], [], [], [], [], [], []];
  declNodes.forEach((n, i) => rowNodes[Math.round((DECL[i].cl[1] - COL_Y0) / ROW_H)].push(n));
  dupNodes.forEach(d => rowNodes[Math.round((d.to[1] - COL_Y0) / ROW_H)].push(d.node));

  // ── карточка: пять отдельных клеток, каждая проявляется на своём поле ─
  const card = createRef<Node>();
  work().add(<Node ref={card} />);
  const cells: Rect[] = [];
  for (let i = 0; i < 5; i++) {
    const r = new Rect({
      x: CARD_X,
      y: cellY(i),
      width: CARD_W,
      height: ROW_H,
      stroke: CARD_STROKE,
      lineWidth: 2,
      opacity: 0,
    });
    card().add(r);
    cells.push(r);
  }
  const cardLabel = new Txt({
    text: 'person',
    x: CARD_X,
    y: cellY(0) - ROW_H / 2 - 44,
    fontFamily: MONO,
    fontSize: CARD_LABEL_FS,
    fontWeight: 500,
    fill: TY,
    opacity: 0,
  });
  card().add(cardLabel);

  const cellVal = (i: number, text: string, fill: string) => {
    const n = new Txt({
      text,
      x: CARD_X,
      y: cellY(i),
      fontFamily: MONO,
      fontSize: CARD_VAL_FS,
      fontWeight: 500,
      fill,
      opacity: 0,
    });
    card().add(n);
    return n;
  };
  const val1908 = cellVal(0, '1908', KW);
  const valTrue = cellVal(1, 'true', KW);
  const cellNulls = [cellVal(2, 'null', KW), cellVal(3, 'null', KW)];

  // ── вторая карточка: младший потомок, куда уходит стрелка ────────────
  const other = createRef<Node>();
  work().add(<Node ref={other} opacity={0} />);
  other().add(
    new Rect({
      x: OTHER_X,
      y: OTHER_Y,
      width: CARD_W,
      height: CARD_H,
      stroke: CARD_STROKE,
      lineWidth: 2,
      radius: 4,
    }),
  );
  for (let i = 1; i < 5; i++) {
    other().add(
      new Line({
        points: [
          [OTHER_X - CARD_W / 2, OTHER_Y - CARD_H / 2 + ROW_H * i],
          [OTHER_X + CARD_W / 2, OTHER_Y - CARD_H / 2 + ROW_H * i],
        ],
        stroke: CARD_STROKE,
        lineWidth: 2,
      }),
    );
  }
  // ⚠️ Имя K — его собственное из статьи (`reference (person) T, J, K;`).
  // Ярлык у второй карточки — имя, а не класс: класс уже показан у первой.
  other().add(
    new Txt({
      text: 'K',
      x: OTHER_X,
      y: OTHER_Y - CARD_H / 2 - 44,
      fontFamily: MONO,
      fontSize: CARD_LABEL_FS,
      fontWeight: 500,
      fill: IDENT,
    }),
  );
  other().add(
    new Txt({
      text: '1935',
      x: OTHER_X,
      y: OTHER_Y - CARD_H / 2 + ROW_H * 0.5,
      fontFamily: MONO,
      fontSize: CARD_VAL_FS,
      fontWeight: 500,
      fill: KW,
    }),
  );

  // ── стрелка на `father` при ЧТЕНИИ строки ───────────────────────────
  // ⚠️ Карточка существует ради этой секунды: в коде написано `father`, и из
  // текста никак не видно, что там не человек внутри, а указатель наружу.
  // Показать это надо на ПЕРВОМ же `reference`, иначе последующий обрыв
  // падает на зрителя, который ещё не знает, что в клетке должно стоять.
  // Цели у неё пока нет — она просто уходит за край кадра; куда именно,
  // покажет отъезд в самом конце. А когда строка создания дойдёт до этого
  // аргумента, стрелка ВТЯНЕТСЯ обратно: указывать не на кого.
  const demoArrow = new Line({
    points: [
      [CARD_X + CARD_W / 2, cellY(2)],
      [Screen.width / 2 + 190, cellY(2)],
    ],
    stroke: 'rgba(244, 241, 235, 0.55)',
    lineWidth: 3,
    end: 0,
  });
  work().add(demoArrow);
  const demoDot = new Rect({
    x: CARD_X,
    y: cellY(2),
    width: 12,
    height: 12,
    radius: 6,
    fill: 'rgba(244, 241, 235, 0.8)',
    opacity: 0,
  });
  work().add(demoDot);

  const ARROW_MID = (CARD_X + CARD_W / 2 + OTHER_X - CARD_W / 2) / 2;
  const arrow = new Line({
    points: [
      [CARD_X + CARD_W / 2, cellY(4)],
      [ARROW_MID, cellY(4)],
      [ARROW_MID, OTHER_Y],
      [OTHER_X - CARD_W / 2, OTHER_Y],
    ],
    stroke: 'rgba(244, 241, 235, 0.55)',
    lineWidth: 3,
    radius: 18,
    endArrow: true,
    arrowSize: 12,
    end: 0,
  });
  work().add(arrow);
  const arrowDot = new Rect({
    x: CARD_X,
    y: cellY(4),
    width: 12,
    height: 12,
    radius: 6,
    fill: 'rgba(244, 241, 235, 0.8)',
    opacity: 0,
  });
  work().add(arrowDot);

  // ── строка создания ─────────────────────────────────────────────────
  // ⚠️ Строка ОБРЫВАЕТСЯ на третьем аргументе. Год и пол пишутся легко, а
  // на `father` писать нечего: курсор мигает, скобка не закрыта. Ровно в
  // этой точке сидел Хоар. Хвост `null, null, K);` дописывается позже — с
  // его же страницы, и последним аргументом приходит НАСТОЯЩАЯ ссылка:
  // контраст «две дырки и одна стрелка» — это и есть его запись 1908.
  const MAKE: {t: string; c: string}[] = [
    {t: 'person', c: TY},
    {t: '(', c: PUN},
    {t: '1908', c: KW},
    {t: ', ', c: PUN},
    {t: 'true', c: KW},
    {t: ', ', c: PUN},
  ];
  const makeRow = createRef<Node>();
  work().add(<Node ref={makeRow} x={COL_X} y={MAKE_Y} opacity={0} />);
  let mc = 0;
  const makeNodes = MAKE.map(t => {
    const n = mkTok('', t.c, [mc * CODE_ADV, 0]);
    mc += t.t.length;
    makeRow().add(n);
    return n;
  });
  const makeEnd = mc;
  const makeCaret = new Rect({
    x: makeEnd * CODE_ADV,
    offset: [-1, 0],
    width: CODE_ADV * 0.72,
    height: CODE_FS * 1.05,
    fill: 'rgba(232, 207, 174, 0.9)',
    opacity: 0,
  });
  makeRow().add(makeCaret);
  // хвост дописывается позже — уже с его страницы: null, null, а последним
  // настоящая ссылка K
  const TAIL: {t: string; c: string}[] = [
    {t: 'null', c: KW},
    {t: ', ', c: PUN},
    {t: 'null', c: KW},
    {t: ', ', c: PUN},
    {t: 'K', c: IDENT},
    {t: ');', c: PUN},
  ];
  const tailNodes: Txt[] = [];
  {
    let n = makeEnd;
    for (const t of TAIL) {
      const node = mkTok(t.t, t.c, [n * CODE_ADV, 0], 0);
      makeRow().add(node);
      tailNodes.push(node);
      n += t.t.length;
    }
  }

  // ── наша фраза своими словами (твердеет в его печатную строку) ───────
  const obs = createRef<Node>();
  graph().add(<Node ref={obs} x={COL_X} y={OBS_Y} opacity={0} />);
  obs().add(
    new Txt({
      text: 'sometimes there is no one to point at',
      offset: [-1, 0],
      fontFamily: MONO,
      fontSize: CODE_FS,
      fontWeight: 500,
      fill: YEAR_BEIGE,
    }),
  );

  // ── слово null, снятое с его страницы ────────────────────────────────
  const flyNull = new Txt({
    text: 'null',
    offset: [-1, 0],
    fontFamily: MONO,
    fontSize: CODE_FS,
    fontWeight: 500,
    fill: KW,
    opacity: 0,
  });
  stage().add(flyNull);

  // ═══ Его слова — нежным роузом ═══════════════════════════════════════
  const easyBlur = createSignal(10);
  const easy = createRef<Node>();
  stage().add(<Node ref={easy} opacity={0} filters={[blur(() => easyBlur())]} />);
  easy().add(
    <Txt
      text={'“…simply because it was so easy to implement.”'}
      fontFamily={MONO}
      fontSize={50}
      fontWeight={500}
      fill={ROSE}
    />,
  );

  // ═══ Шторки финала ═══════════════════════════════════════════════════
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
  const makeShutter = (sign: -1 | 1) => {
    const shut = new Rect({width: Screen.width, height: SHUT_H, y: sign * (Screen.height / 2 + SHUT_H / 2 + 20), clip: true});
    const backdrop = makeBackdrop();
    backdrop.position.y(() => -shut.position.y());
    shut.add(backdrop);
    view.add(shut);
    return shut;
  };
  const shutterTop = makeShutter(-1);
  const shutterBot = makeShutter(1);

  // ═══════════════ ТАЙМЛАЙН ════════════════════════════════════════════
  yield* waitFor(0.5);

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

  const driftDur = PHOTO_IN + SETTLE + QUOTE_IN + QUOTE_HOLD;
  yield all(
    bgLayer().x(CAMERA_DRIFT, driftDur, easeInOutSine),
    hoareLayer().x(CAMERA_DRIFT + HOARE_DRIFT, driftDur, easeInOutSine),
    hoareLayer().scale(HOARE_SCALE, driftDur, easeInOutSine),
  );

  // год просто гаснет — никуда не улетает
  cursor.opacity(0);
  yield* yearNode().opacity(0, YEAR_OUT, easeInCubic);
  yearNode().remove();

  ghostRefs.forEach((g, i) => g.opacity(GHOSTS[i].op));
  yield* all(
    photo().opacity(1, PHOTO_FADE, easeOutCubic),
    photo().x(PAN_X0, PHOTO_IN, easeOutCubic),
    ...ghostRefs.map(g => g.opacity(0, PHOTO_IN * 0.5, easeOutCubic)),
  );
  ghostRefs.forEach(g => g.remove());
  yield* waitFor(SETTLE);

  yield* all(quote().opacity(1, QUOTE_IN, easeOutCubic), quote().scale(1, QUOTE_IN, easeOutCubic));
  yield* attrib().opacity(1, ATTRIB_IN, easeOutCubic);
  yield* waitFor(QUOTE_HOLD);

  // ═══ 3. Приговор смазывается влево, вопрос собирается — БЕЗ ПАУЗЫ ════
  // ⚠️ Уход и приход идут в ОДНОМ all(): вопрос стартует, пока приговор ещё
  // на экране. Раздельные yield* давали дырку между фразами.
  yield* all(
    chain(quoteSmearOp(1, ASK_SWAP * 0.22, easeOutCubic), quoteSmearOp(0, ASK_SWAP * 0.5, easeInCubic)),
    quote().opacity(0, ASK_SWAP * 0.5, easeInCubic),
    quoteSpread(SMEAR_SPREAD, ASK_SWAP * 0.7, easeOutCubic),
    chain(
      waitFor(ASK_SWAP * ASK_OVERLAP),
      all(
        chain(askSmearOp(1, ASK_SWAP * 0.2, easeOutCubic), askSmearOp(0, ASK_SWAP * 0.38, easeInCubic)),
        ask().opacity(1, ASK_SWAP * 0.4, easeOutCubic),
        askSpread(0, ASK_SWAP * 0.58, easeInOutCubic),
      ),
    ),
  );
  quote().remove();
  quoteSmearWrap.remove();
  askSmearWrap.remove();
  yield* waitFor(ASK_HOLD);

  // ═══ 4. Камера едет вправо — на стене висит страница ═════════════════
  const panTarget = -(CAMERA_DRIFT + WALL_X) * PHOTO_S;
  yield* all(
    ask().opacity(0, PAN_DUR * 0.35, easeInCubic),
    wallSheet.opacity(1, PAN_DUR * 0.4, easeOutCubic),
    photo().x(panTarget, PAN_DUR, easeInOutCubic),
  );

  soloSheet.position([0, WALL_Y * PHOTO_S]);
  soloSheet.scale(WALL_SCALE * PHOTO_S);
  soloSheet.opacity(1);
  wallSheet.opacity(0);
  const [hx, hy] = toSheet(SH_HEAD.x, SH_HEAD.y);
  // ⚠️ свет приходит ВМЕСТЕ с наездом, а не после него
  yield* all(
    soloSheet.scale(SH_READ, APPROACH, easeInOutCubic),
    soloSheet.position([-hx * SH_READ, -hy * SH_READ], APPROACH, easeInOutCubic),
    photo().opacity(0, APPROACH * 0.62, easeInOutCubic),
    chain(waitFor(APPROACH * 0.25), lightNode.opacity(1, APPROACH * 0.7, easeInOutCubic)),
  );
  photo().remove();
  yield* waitFor(LIGHT_HOLD);

  // ═══ 5. Лист откладывают ════════════════════════════════════════════
  rh9().opacity(1);
  yield* all(
    lightNode.opacity(0, SET_ASIDE * 0.45, easeInOutCubic),
    soloSheet.position.x(-2900, SET_ASIDE, easeInCubic),
    soloSheet.position.y(soloSheet.position.y() + 340, SET_ASIDE, easeInCubic),
    soloSheet.rotation(-9, SET_ASIDE, easeInCubic),
  );
  soloSheet.remove();
  yield* waitFor(RH_HOLD_0);

  // ═══ 6. Улика: маркер по ВСЕМ ТРЁМ строкам объявления ═══════════════
  yield* all(
    rh9().scale(RH_READ_S, RH_PUSH, easeInOutCubic),
    rh9().position(rigAt(AT_DECL, RH_READ_S), RH_PUSH, easeInOutCubic),
  );
  for (const h of hlDecl) {
    yield h.rect.size.x(h.w, HL_DUR, easeInOutSine);
    yield* waitFor(HL_STEP);
  }
  yield* waitFor(READ_DECL);

  // ═══ 7. Печатная строка → наш код НА ТОМ ЖЕ МЕСТЕ ═══════════════════
  // ⚠️ Буквы НЕ морфим: машинописные и наши глифы слишком разной формы.
  // Связь держит то, что текст не двигается и не меняет кегль.
  graph().opacity(1);
  declNodes.forEach(n => n.opacity(0));
  yield* all(
    ...declNodes.map(n => n.opacity(1, 0.75, easeOutCubic)),
    rh9().opacity(0, 0.85, easeInOutCubic),
    rh9Blur(6, 0.85, easeInOutCubic),
  );
  rh9().position(rigAt(AT_PARTIAL, RH_READ_S));
  rh9Blur(0);
  yield* waitFor(0.5);

  // ═══ 8. Код перестраивается в столбец ═══════════════════════════════
  yield* all(
    ...declNodes.map((n, i) => n.position(new Vector2(DECL[i].cl[0], DECL[i].cl[1]), REFLOW, easeInOutCubic)),
    ...dupNodes.map(d => d.node.position(new Vector2(d.to[0], d.to[1]), REFLOW, easeInOutCubic)),
    ...dupNodes.map(d => chain(waitFor(REFLOW * 0.3), d.node.opacity(1, REFLOW * 0.5, easeOutCubic))),
  );
  yield* waitFor(0.4);

  // ═══ 9. Карточка растёт ИЗ кода, по одному полю ═════════════════════
  // ⚠️ Соответствие показываем ВЫСОТОЙ: строка N и клетка N на одной
  // базовой линии. Читаемое поле горит, остальные приглушены.
  const focusRow = (active: number, dur: number) =>
    all(
      ...rowNodes.flatMap((rn, r) =>
        rn.map(n => n.opacity(active < 0 || r === active ? 1 : 0.28, dur, easeInOutCubic)),
      ),
    );
  yield* cardLabel.opacity(1, CARD_IN, easeOutCubic);
  for (let i = 0; i < 5; i++) {
    yield* all(focusRow(i + 1, 0.35), cells[i].opacity(1, 0.4, easeOutCubic));
    // третье поле — первое `reference`: в клетке не значение, а стрелка наружу
    if (i === 2) {
      yield* waitFor(0.3);
      yield* all(demoDot.opacity(1, 0.3, easeOutCubic), demoArrow.end(1, ARROW_DRAW, easeInOutCubic));
      yield* waitFor(REF_HOLD);
    }
    yield* waitFor(FIELD_STEP);
  }
  yield* focusRow(-1, 0.5);

  // ═══ 10. Строка создания: два значения — и ОБРЫВ на `father` ════════
  makeRow().opacity(1);
  for (let i = 0; i < MAKE.length; i++) {
    const tok = MAKE[i];
    for (let c = 1; c <= tok.t.length; c++) {
      makeNodes[i].text(tok.t.slice(0, c));
      yield* waitFor(MAKE_CHAR);
    }
    if (tok.t === '1908') yield* val1908.opacity(1, 0.3, easeOutCubic);
    if (tok.t === 'true') yield* valTrue.opacity(1, 0.3, easeOutCubic);
  }
  // ⚠️ Стрелка ВТЯГИВАЕТСЯ ровно там, где встала строка: мы только что
  // видели, что в этой клетке положено, и вот указывать не на кого.
  yield* waitFor(0.45);
  yield* all(
    demoArrow.end(0, RETRACT, easeInOutCubic),
    chain(waitFor(RETRACT * 0.5), demoDot.opacity(0, RETRACT * 0.5, easeInCubic)),
  );
  yield* waitFor(EMPTY_HOLD);
  makeCaret.opacity(1);
  for (let b = 0; b < 3; b++) {
    yield* waitFor(0.3);
    makeCaret.opacity(0);
    yield* waitFor(0.24);
    makeCaret.opacity(1);
  }
  yield* waitFor(STALL_HOLD);

  // ═══ 13. Наша фраза → его печатная строка ══════════════════════════
  yield* obs().opacity(1, OBS_IN, easeOutCubic);
  yield* waitFor(OBS_HOLD);
  // ⚠️ Сначала графит ПУСТЕЕТ до одной фразы, и только она встречается с
  // бумагой. Иначе на кроссфейде код лежит поверх машинописи — каша.
  yield* work().opacity(0, WORK_OUT, easeInOutCubic);
  yield* waitFor(0.3);
  yield* all(
    obs().opacity(0, HARDEN * 0.6, easeInCubic),
    rh9().opacity(1, HARDEN, easeOutCubic),
  );

  // ═══ 14. Спуск по листу: проблема, потом решение ════════════════════
  yield* hlPartial.rect.size.x(hlPartial.w, HL_DUR, easeInOutSine);
  yield* waitFor(READ_PARTIAL);
  yield* rh9().position(rigAt(AT_NULL, RH_READ_S), 0.85, easeInOutCubic);
  yield* hlNullA.rect.size.x(hlNullA.w, HL_DUR, easeInOutSine);
  yield* hlNullB.rect.size.x(hlNullB.w, HL_WRAP, easeInOutSine);
  yield* waitFor(READ_NULL);

  // ═══ 15. Слово снимается со страницы и дописывает нашу строку ═══════
  const [nx, ny] = screenOf(1040 + 10 * 18.05, 2011, AT_NULL, RH_READ_S);
  flyNull.position([nx, ny]);
  flyNull.opacity(1);
  yield* all(
    rh9().opacity(0, NULL_FLY, easeInOutCubic),
    work().opacity(1, NULL_FLY * 0.8, easeOutCubic),
    flyNull.position([COL_X + makeEnd * CODE_ADV, MAKE_Y], NULL_FLY, easeInOutCubic),
  );
  rh9().remove();
  makeCaret.opacity(0);
  flyNull.opacity(0);
  // null, — и клетка father заполнена
  tailNodes[0].opacity(1);
  tailNodes[1].opacity(1);
  yield* cellNulls[0].opacity(1, 0.35, easeOutCubic);
  yield* waitFor(NULL_STEP);
  // null, — и elder sibling тоже
  tailNodes[2].opacity(1);
  tailNodes[3].opacity(1);
  yield* cellNulls[1].opacity(1, 0.35, easeOutCubic);
  yield* waitFor(PAYOFF_HOLD);

  // ═══ 15b. Последний аргумент — НАСТОЯЩАЯ ссылка ════════════════════
  // ⚠️ Контраст на одной карточке: две дырки и одна стрелка. Стрелка уходит
  // за край кадра — камера отъезжает и находит вторую запись. Это и есть
  // мини-версия его чертежа, и на неё же мы потом и растворяемся.
  tailNodes[4].opacity(1);
  tailNodes[5].opacity(1);
  yield* all(arrowDot.opacity(1, 0.3, easeOutCubic), arrow.end(1, ARROW_DRAW, easeInOutCubic));
  other().opacity(1);
  const pullX = -((COL_X + OTHER_X + CARD_W / 2) / 2) * PULL_S;
  const pullY = -((cellY(0) - ROW_H / 2 - 44 + OTHER_Y + CARD_H / 2) / 2) * PULL_S;
  yield* all(
    graph().scale(PULL_S, PULL_DUR, easeInOutCubic),
    graph().position([pullX, pullY], PULL_DUR, easeInOutCubic),
  );
  yield* waitFor(PULL_HOLD);

  // ═══ 16. Его собственный чертёж — узнавание ════════════════════════
  yield* all(
    graph().opacity(0, DIAG_IN * 0.6, easeInCubic),
    graphBlur(6, DIAG_IN * 0.6, easeInOutCubic),
    rh11().opacity(1, DIAG_IN, easeOutCubic),
  );
  graph().remove();
  yield* waitFor(0.5);

  yield* all(
    rh11().scale(DIAG_S_BOX, DIAG_PUSH, easeInOutCubic),
    rh11().position(rigAt(DIAG_AT_BOX, DIAG_S_BOX), DIAG_PUSH, easeInOutCubic),
  );
  yield* all(contour.opacity(1, CONTOUR_IN, easeOutCubic), contour.scale(1, CONTOUR_IN, easeOutCubic));
  yield* waitFor(CONTOUR_HOLD);
  for (const n of boxNulls) {
    yield* n.rect.size.x(n.w, HL_DUR * 0.7, easeInOutSine);
  }
  yield* waitFor(BOX_HL_HOLD);

  yield* all(
    contour.opacity(0, DIAG_BACK * 0.4, easeInOutCubic),
    rh11().scale(DIAG_S_WIDE, DIAG_BACK, easeInOutCubic),
    rh11().position(rigAt(DIAG_AT_WIDE, DIAG_S_WIDE), DIAG_BACK, easeInOutCubic),
  );
  for (const n of restNulls) {
    yield n.rect.size.x(n.w, HL_DUR * 0.55, easeInOutSine);
    yield* waitFor(REST_STEP);
  }
  yield* waitFor(DIAG_HOLD);

  // ═══ 17. Его признание — и кадр закрывается на нём ══════════════════
  yield* all(
    rh11Blur(7, EASY_IN, easeInOutCubic),
    rh11Scrim.opacity(0.62, EASY_IN, easeInOutCubic),
    easy().opacity(1, EASY_IN, easeOutCubic),
    easyBlur(0, EASY_IN, easeOutCubic),
  );
  yield* waitFor(EASY_HOLD);

  yield rh11Blur(10, SQUEEZE_DUR, easeInOutCubic);
  yield* frameH(BAND_H, SQUEEZE_DUR, easeInOutCubic);
  yield* waitFor(BAND_HOLD);

  shutterTop.position.y(-(BAND_H / 2 + SHUT_H / 2));
  shutterBot.position.y(BAND_H / 2 + SHUT_H / 2);
  yield* all(
    shutterTop.position.y(-SHUT_H / 2, SHUT_DUR, easeInOutCubic),
    shutterBot.position.y(SHUT_H / 2, SHUT_DUR, easeInOutCubic),
  );
  yield* waitFor(0.5);
});
