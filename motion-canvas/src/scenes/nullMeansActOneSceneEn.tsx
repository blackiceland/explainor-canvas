import {blur, Gradient, Img, makeScene2D, Node, Rect, Txt} from '@motion-canvas/2d';
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
  SimpleSignal,
  Vector2,
  waitFor,
} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Colors, Fonts, Screen} from '../core/theme';

// ═══════════════════════════════════════════════════════════════════════
// АКТ 1 «YOUR NULL MEANS TOO MUCH» — ОДНОЙ СЦЕНОЙ.
// Заменяет nullMeansPrologueSceneEn + nullMeansRecordHandlingSceneEn.
//
// Дуга: приговор → вопрос → алиби → улика → цена решения → современный
// ответ → новый вопрос.
//
// 1. 1965 консолью, улёт влево со смазом → фото Хоара (2 слоя, сдержанный
//    параллакс) → «MY BILLION-DOLLAR MISTAKE.» краской на стене + подпись
//    `Tony Hoare · 2009` (фото отсылает к 1965, признание прозвучало через
//    сорок лет — без подписи мы врём соседством).
// 2. Цитата НА МЕСТЕ сменяется вопросом: стена сначала произносит приговор,
//    потом задаёт вопрос. Один объект через два состояния, не новый элемент.
// 3. Камера едет вправо — и там, на стене, висит страница CACM. Пан наконец
//    получает смысл. Наезд идёт прямо в шапку, комната по дороге отпадает.
// 4. Акцент на шапке — СВЕТ, а не рамка и не второй зум: радиальный скрим
//    гасит всё, кроме заголовка и авторов. Странице-алиби достаётся свет,
//    странице-улике достанется маркер: разные глаголы для разных ролей.
// 5. Лист ОТКЛАДЫВАЮТ — он уезжает, а под ним лежит Record Handling. Физическая
//    склейка вместо растворения: в этом ответа нет, ответ здесь.
// 6. Record Handling (NATO Summer School, сентябрь 1966), стр. 9: объявление →
//    частичные отношения → введение null. Три маркера, затем страница
//    растворяется, а объявление ОСТАЁТСЯ нашим набором, и печатается его же
//    строка создания записи с тремя null.
// 7. Цена решения: «so easy to implement» → один ОТСЕК, унаследованный от его
//    собственного рисунка, и в нём null у каждого ссылочного типа → тезис.
// 8. Лента языков — теперь ПОСЛЕ аргумента, поэтому читается как ответ, а не
//    как список. → закрывающий вопрос в главу.
//
// ⚠️ Даты: ALGOL — июнь 1966, Record Handling — сентябрь 1966. 1965 — год
// работы над языком; подписывать этим годом сами документы нельзя.
// ═══════════════════════════════════════════════════════════════════════

// ── фотография ──────────────────────────────────────────────────────────
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
const YEAR = '1965';
const YEAR_FS = 110;
const YEAR_ADV = YEAR_FS * 0.6;
const YEAR_BEIGE = 'rgba(232, 207, 174, 0.96)';
const YEAR_KEY = 0.13;
const YEAR_HOLD = 1.15;
const YEAR_FLY = 0.5;
// ⚠️ Смаз строится ПЛОТНОСТЬЮ, а не силой блюра: блюр изотропен и на дальних
// копиях раздувает хвост по вертикали — выходит конус, а не смаз. Шаг копий
// мельче блюра (иначе видна периодичность) и не кратен YEAR_ADV (иначе цифры
// выстраиваются в читаемый ряд). Радиус намеренно небольшой — эффект должен
// быть заметен движением, а не пятном.
const YEAR_TAIL_N = 44;
const YEAR_TAIL_SPAN = 340;
const YEAR_TAIL_BLUR = 4;
const YEAR_TAIL_OP = 0.085;

const PHOTO_IN = 1.0;
const SETTLE = 0.85;

// ── цитата, подпись, вопрос — краска на стене ───────────────────────────
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
const ASK_SWAP = 0.9;                // цитата уступает вопрос НА МЕСТЕ
const ASK_HOLD = 2.6;                // ⚠️ VO

// параллакс: дрейф камеры есть, расхождение фигуры со своей тенью — минимально
const CAMERA_DRIFT = -96;
const HOARE_DRIFT = -20;
const HOARE_SCALE = 1.016;

// ── страница ALGOL (алиби) ──────────────────────────────────────────────
// лист вырезан из плиты в _algol_sheet.mjs: без серого поля, развёрнут в ось
const ALGOL_SRC = '/hoare/algol-sheet-1181x1594.jpg';
const SH_W = 1181;
const SH_H = 1594;
const toSheet = (x: number, y: number) => [x - SH_W / 2, y - SH_H / 2] as const;
const WALL_X = 1900;                 // положение листа на стене, координаты слоя
const WALL_Y = -10;
const WALL_SCALE = 0.46;             // внутри слоя; на экране ×PHOTO_S
const PAN_DUR = 1.7;                 // камера едет вправо к листу
const APPROACH = 1.8;                // наезд из стены прямо в шапку
const SH_READ = 1.72;                // на экране заголовок ~1314px
const SH_HEAD = {x: 594, y: 330};    // шапка листа (замер _algol_sheet.mjs)
const LIGHT_IN = 0.9;
const LIGHT_HOLD = 2.0;              // ⚠️ VO
const SET_ASIDE = 1.0;               // лист откладывают

// ── страница Record Handling (улика) ────────────────────────────────────
const RH_SRC = '/hoare/record-handling-p9-4800x2700.jpg';
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
const AT_PARTIAL = {x: 810, y: 1851};
const AT_NULL = {x: 810, y: 1975};
const HL_FILL = 'rgb(247, 179, 196)';
const HL_DECL = {x0: 500, x1: 1395, cy: 1050, h: 44};
const HL_PARTIAL = {x0: 120, x1: 849, cy: 1851, h: 46};
const HL_NULL_A = {x0: 1040, x1: 1428, cy: 2011, h: 45};
const HL_NULL_B = {x0: 120, x1: 266, cy: 2051, h: 43};
const HL_DUR = 0.55;
const READ_DECL = 1.0;               // ⚠️ VO
const MOVE_DUR = 0.95;
const READ_PARTIAL = 1.2;            // ⚠️ VO
const MOVE_SHORT = 0.6;
const HL_WRAP = 0.28;
const READ_NULL = 1.4;               // ⚠️ VO
const BACK_DUR = 0.9;
const DISSOLVE = 1.15;
const CODE_HOLD = 0.45;
const CHAR = 0.028;
const NULL_BEAT = 0.34;
const TAIL_HOLD = 1.2;
const DIM_DUR = 0.8;

// ── наш набор ───────────────────────────────────────────────────────────
const CODE_FS = 36;
const CODE_ADV = CODE_FS * 0.6;
const INK = 'rgba(232, 207, 174, 0.68)';
const ACCENT = 'rgba(255, 240, 212, 1)';
const SAY = 'rgba(232, 207, 174, 0.92)';

// ── цена решения ────────────────────────────────────────────────────────
const EASY_IN = 0.8;
const EASY_HOLD = 2.6;               // ⚠️ VO
const SLOT_W = 560;
const SLOT_H = 132;
const SLOT_TYPES = ['reference (person)', 'User', 'Order', 'Camera', 'Connection'];
const SLOT_IN = 0.9;
const SLOT_FIRST = 1.5;
const SLOT_STEP = 0.78;
const THESIS_IN = 0.7;
const THESIS_HOLD = 2.3;             // ⚠️ VO

// ── лента языков ────────────────────────────────────────────────────────
const LANGS: {name: string; form: string}[] = [
  {name: 'Kotlin', form: 'T?'},
  {name: 'Swift', form: 'Optional<T>'},
  {name: 'TypeScript', form: 'T | null'},
  {name: 'C#', form: 'T?'},
  {name: 'Rust', form: 'Option<T>'},
  {name: 'Java', form: 'Optional<T>'},
];
const BELT_FS = 46;
const BELT_CHAR = BELT_FS * 0.6;
const BELT_INNER = 54;
const BELT_GAP = 210;
const SLOT_LH = 58;
const BELT_NAME = 'rgba(232, 207, 174, 0.78)';
const BELT_FORM = 'rgba(244, 230, 200, 0.96)';
const BELT_DIM = 0.26;
const BELT_STEP_DUR = 0.85;
const BAND_H = 230;

const CLOSE_IN = 0.7;
const CLOSE_HOLD = 2.2;              // ⚠️ VO

export default makeScene2D(function* (view) {
  applyBackground(view);

  yield Promise.all(
    [BG_SRC, CUT_SRC, ALGOL_SRC, RH_SRC].map(
      src =>
        new Promise<void>(resolve => {
          const el = document.createElement('img');
          el.onload = () => resolve();
          el.onerror = () => resolve();
          el.src = src;
        }),
    ),
  );

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

  const yearTailOp = createSignal(0);
  const yearTail = new Node({opacity: () => yearTailOp()});
  for (let i = 0; i < YEAR_TAIL_N; i++) {
    const t = i / (YEAR_TAIL_N - 1);
    yearTail.add(
      new Txt({
        text: YEAR,
        x: yearLeft + 12 + t * YEAR_TAIL_SPAN,
        offset: [-1, 0],
        fontFamily: MONO,
        fontSize: YEAR_FS,
        fontWeight: 500,
        fill: YEAR_BEIGE,
        opacity: YEAR_TAIL_OP * Math.pow(1 - t, 1.4),
      }),
    );
  }
  yearTail.cache(true);
  yearTail.cachePadding(YEAR_TAIL_BLUR * 2 + 14);
  yearTail.filters([blur(YEAR_TAIL_BLUR)]);
  yearNode().add(yearTail);

  // ═══ 2. Панорама Хоара ═══════════════════════════════════════════════
  const photo = createRef<Node>();
  const bgLayer = createRef<Node>();
  const hoareLayer = createRef<Node>();
  view.add(<Node ref={photo} x={PAN_X0 + 300} scale={PHOTO_S} opacity={0} />);
  photo().add(<Node ref={bgLayer} />);
  bgLayer().add(<Img src={BG_SRC} width={IMG_W} height={IMG_H} />);
  // зеркальное продолжение стены: отражение вокруг img_x=3120 (ВНУТРИ ровной
  // стены — стык по краю плиты давал видимый вертикальный шов)
  const seamU = MIRROR_SEAM - IMG_W / 2;
  const mirrorW = 3120;
  const mirrorCx = seamU + mirrorW / 2;
  const mirrorImgCx = seamU + (MIRROR_SEAM - IMG_W / 2);
  const mirrorClip = new Rect({x: mirrorCx, width: mirrorW, height: IMG_H, clip: true});
  mirrorClip.add(new Img({src: BG_SRC, width: IMG_W, height: IMG_H, scale: [-1, 1], x: mirrorImgCx - mirrorCx}));
  bgLayer().add(mirrorClip);
  photo().add(<Node ref={hoareLayer} />);
  hoareLayer().add(<Img src={CUT_SRC} width={IMG_W} height={IMG_H} />);

  // ghost-дубли влёта. ⚠️ Половинное разрешение: блюр кэширует ноду по её
  // локальному боксу, и на 3200×1350 это вчетверо дороже без видимой разницы.
  const GHOSTS = [
    {dx: 60, op: 0.3, bl: 1.5},
    {dx: 124, op: 0.22, bl: 2},
    {dx: 196, op: 0.14, bl: 2.5},
    {dx: 276, op: 0.08, bl: 3},
  ];
  const ghostRefs: Node[] = [];
  for (const g of GHOSTS) {
    const gn = new Node({
      x: () => photo().x() + g.dx,
      scale: PHOTO_S * 2,
      opacity: 0,                    // зажигаются ровно на влёте, не с первого кадра
      filters: [blur(g.bl)],
    });
    gn.add(new Img({src: BG_SRC, width: IMG_W / 2, height: IMG_H / 2}));
    gn.add(new Img({src: CUT_SRC, width: IMG_W / 2, height: IMG_H / 2}));
    view.add(gn);
    ghostRefs.push(gn);
  }

  // ── краска на стене: цитата с подписью и вопрос НА ТОМ ЖЕ МЕСТЕ ───────
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
  const quote = createRef<Node>();
  const attrib = createRef<Node>();
  const ask = createRef<Node>();
  bgLayer().add(<Node ref={quote} x={toLayer(QUOTE_X)} y={QUOTE_Y - IMG_H / 2} opacity={0} scale={1.03} />);
  quote().add(wallLine('“MY BILLION-DOLLAR', -QUOTE_PITCH / 2, QUOTE_FS, QUOTE_FILL, true));
  quote().add(wallLine('MISTAKE.”', QUOTE_PITCH / 2, QUOTE_FS, QUOTE_FILL, true));
  quote().add(<Node ref={attrib} opacity={0} />);
  attrib().add(wallLine('TONY HOARE · 2009', QUOTE_PITCH / 2 + 112, ATTRIB_FS, ATTRIB_FILL, false));
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
        fill: 'rgb(236,233,226)',
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

  // ═══ Страница Record Handling — лежит ПОД листом ALGOL ════════════════
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

  const rhBlur = createSignal(0);
  const rhRig = createRef<Node>();
  view.add(
    <Node
      ref={rhRig}
      scale={RH_REVEAL_S}
      position={rigAt(RH_AT_REVEAL, RH_REVEAL_S)}
      opacity={0}
      filters={[blur(() => rhBlur())]}
    />,
  );
  rhRig().add(new Img({src: RH_SRC, width: RH_W, height: RH_H}));
  const makeHighlight = (hl: {x0: number; x1: number; cy: number; h: number}) => {
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
    rhRig().add(r);
    return {rect: r, w: hl.x1 - hl.x0 + pad * 2};
  };
  const hlDecl = makeHighlight(HL_DECL);
  const hlPartial = makeHighlight(HL_PARTIAL);
  const hlNullA = makeHighlight(HL_NULL_A);
  const hlNullB = makeHighlight(HL_NULL_B);

  // ═══ Лист ALGOL, взятый камерой (лёгкий риг поверх) ══════════════════
  const soloSheet = new Node({scale: WALL_SCALE * PHOTO_S, opacity: 0});
  soloSheet.add(makeAlgolSheet());
  // Свет на шапке: не рамка и не окно, а спад — плоский скрим читался бы маской.
  // ⚠️ Пятно обязано быть ЭЛЛИПТИЧЕСКИМ: заголовок широкий и низкий, а прямо под
  // ним аннотация. Круглый спад, накрывающий заголовок по ширине (±382), накрывал
  // и её — гасло только по углам кадра. Эллипс делается неравномерным масштабом
  // ноды: круг r в её системе = эллипс (r, 0.4r) в системе листа.
  const [lx0, ly0] = toSheet(SH_HEAD.x, SH_HEAD.y);
  const lightNode = new Node({x: lx0, y: ly0, scale: [1, 0.4], opacity: 0});
  const lightScrim = new Rect({
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
  });
  lightNode.add(lightScrim);
  soloSheet.add(lightNode);
  view.add(soloSheet);

  // ═══ Наш набор поверх (объявление Хоара + строка создания записи) ════
  const code = createRef<Node>();
  view.add(<Node ref={code} opacity={0} />);
  const dimOthers = createSignal(1);
  // ⚠️ Три ссылочных ПОЛЯ держим кремовым — тем же, каким придут три null.
  // Строка создания позиционная, без имён аргументов: с холода никто не помнит
  // порядок пяти полей. Три кремовых имени сверху и три кремовых null снизу
  // связываются глазом сами — без подписей, стрелок и без нашей перерисовки
  // его схемы.
  const codeLine = (paperX: number, paperY: number, toks: {text: string; field?: boolean}[]) => {
    const [sx, sy] = screenOf(paperX, paperY, AT_DECL, RH_READ_S);
    let n = 0;
    for (const tok of toks) {
      code().add(
        new Txt({
          text: tok.text,
          x: sx + n * CODE_ADV,
          y: sy,
          offset: [-1, 0],
          fontFamily: MONO,
          fontSize: CODE_FS,
          fontWeight: 500,
          fill: tok.field ? ACCENT : INK,
          opacity: () => dimOthers(),
        }),
      );
      n += tok.text.length;
    }
  };
  codeLine(120, 1010, [{text: 'record class person (integer date of birth; Boolean male;'}]);
  codeLine(500, 1050, [
    {text: 'reference (person) '},
    {text: 'father,', field: true},
    {text: ' '},
    {text: 'elder sibling,', field: true},
    {text: ' '},
    {text: 'youngest', field: true},
  ]);
  codeLine(1245, 1089, [{text: 'offspring', field: true}, {text: ');'}]);
  codeLine(120, 1132, [{text: 'reference (person) T, J, K;'}]);

  const [declX, declY] = screenOf(120, 1132, AT_DECL, RH_READ_S);
  const createRow = createRef<Node>();
  code().add(<Node ref={createRow} x={declX} y={declY + CODE_FS * 2.9} />);
  const TOKENS: {text: string; isNull?: boolean}[] = [
    {text: 'T := person (1908, true, '},
    {text: 'null', isNull: true},
    {text: ', '},
    {text: 'null', isNull: true},
    {text: ', '},
    {text: 'null', isNull: true},
    {text: ');'},
  ];
  const nullOps: SimpleSignal<number>[] = [];
  let cur = 0;
  const tokenNodes = TOKENS.map(tok => {
    const own = tok.isNull ? createSignal(1) : null;
    if (own) nullOps.push(own);
    const t = new Txt({
      text: '',
      x: cur * CODE_ADV,
      offset: [-1, 0],
      fontFamily: MONO,
      fontSize: CODE_FS,
      fontWeight: 500,
      fill: tok.isNull ? ACCENT : INK,
      opacity: tok.isNull ? () => own!() : () => dimOthers(),
    });
    cur += tok.text.length;
    createRow().add(t);
    return t;
  });

  // ═══ Цена решения ════════════════════════════════════════════════════
  const easyBlur = createSignal(10);
  const easy = createRef<Node>();
  view.add(<Node ref={easy} opacity={0} filters={[blur(() => easyBlur())]} />);
  easy().add(
    <Txt
      text={'“…simply because it was so easy to implement.”'}
      y={-34}
      fontFamily={MONO}
      fontSize={50}
      fontWeight={500}
      fill={SAY}
    />,
  );
  easy().add(
    <Txt
      text={'TONY HOARE · 2009'}
      y={54}
      fontFamily={MONO}
      fontSize={28}
      fontWeight={500}
      letterSpacing={4}
      fill={'rgba(232, 207, 174, 0.42)'}
    />,
  );

  // ОДИН отсек — форма, унаследованная от его собственного рисунка: коробка с
  // отсеками, где в пустом стоит null. Наша только отрисовка, и она одна: одна
  // фигура, одна граница, без стрелок; состояние передаётся цветом.
  const slotBlur = createSignal(10);
  const slot = createRef<Node>();
  view.add(<Node ref={slot} opacity={0} filters={[blur(() => slotBlur())]} />);
  const slotBox = new Rect({
    x: 150,
    width: SLOT_W,
    height: SLOT_H,
    stroke: 'rgba(232, 207, 174, 0.40)',
    lineWidth: 3,
    fill: 'rgba(232, 207, 174, 0.03)',
  });
  slot().add(slotBox);
  slot().add(
    <Txt
      text={'null'}
      x={150}
      fontFamily={MONO}
      fontSize={54}
      fontWeight={500}
      fill={ACCENT}
    />,
  );
  const slotLabels = SLOT_TYPES.map((name, i) => {
    const t = new Txt({
      text: name,
      x: -180,
      offset: [1, 0],
      fontFamily: MONO,
      fontSize: 48,
      fontWeight: 500,
      fill: SAY,
      opacity: i === 0 ? 1 : 0,
    });
    slot().add(t);
    return t;
  });

  const thesis = createRef<Node>();
  view.add(<Node ref={thesis} opacity={0} />);
  const thesisTxt = new Txt({
    text: '',
    fontFamily: MONO,
    fontSize: 52,
    fontWeight: 500,
    fill: SAY,
    textAlign: 'center',
  });
  thesis().add(thesisTxt);

  // ═══ Лента языков ════════════════════════════════════════════════════
  const band = createRef<Rect>();
  view.add(<Rect ref={band} width={Screen.width} height={BAND_H} clip opacity={0} />);
  const belt = createRef<Node>();
  band().add(<Node ref={belt} />);
  const pairOps: SimpleSignal<number>[] = [];
  const slotCols: Node[] = [];
  const slotGhostOps: SimpleSignal<number>[] = [];
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
    const win = new Rect({x: nameW + BELT_INNER + winW / 2, width: winW, height: SLOT_LH, clip: true});
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
      win.add(ghost);
    }
    win.add(col);
    slotCols.push(col);
    pair.add(win);
    belt().add(pair);
  });

  const closing = createRef<Node>();
  view.add(<Node ref={closing} opacity={0} />);
  const closingTxt = new Txt({
    text: '',
    fontFamily: MONO,
    fontSize: 52,
    fontWeight: 500,
    fill: SAY,
    textAlign: 'center',
  });
  closing().add(closingTxt);

  // ═══════════════ ТАЙМЛАЙН ════════════════════════════════════════════
  yield* waitFor(0.5);

  // 1965 — посимвольная печать, каретка ведёт и мигает
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

  // параллакс на всю вводную (photo.x свободен для влёта и пана — два твина на
  // одном свойстве конфликтуют)
  const driftDur = PHOTO_IN + SETTLE + QUOTE_IN + QUOTE_HOLD;
  yield all(
    bgLayer().x(CAMERA_DRIFT, driftDur, easeInOutSine),
    hoareLayer().x(CAMERA_DRIFT + HOARE_DRIFT, driftDur, easeInOutSine),
    hoareLayer().scale(HOARE_SCALE, driftDur, easeInOutSine),
  );

  // год срывается влево со смазом; темнота светлеет и оказывается уже
  // движущимся фото — одно движение камеры вместо растворения
  cursor.opacity(0);
  yield all(
    yearNode().x(-1560, YEAR_FLY, easeInCubic),
    chain(yearTailOp(1, YEAR_FLY * 0.35, easeOutCubic), yearTailOp(0, YEAR_FLY * 0.65, easeInCubic)),
  );
  yield* waitFor(YEAR_FLY * 0.6);
  ghostRefs.forEach((g, i) => g.opacity(GHOSTS[i].op));
  yield* all(
    photo().opacity(1, PHOTO_IN * 0.85, easeInOutCubic),
    photo().x(PAN_X0, PHOTO_IN, easeOutCubic),
    ...ghostRefs.map(g => g.opacity(0, PHOTO_IN * 0.9, easeOutCubic)),
  );
  ghostRefs.forEach(g => g.remove());
  yearNode().remove();
  yield* waitFor(SETTLE);

  // цитата — краска на стене, не выезд и не печать
  yield* all(quote().opacity(1, QUOTE_IN, easeOutCubic), quote().scale(1, QUOTE_IN, easeOutCubic));
  yield* attrib().opacity(1, ATTRIB_IN, easeOutCubic);
  yield* waitFor(QUOTE_HOLD);

  // ═══ 3. Стена сменяет приговор на вопрос — НА ТОМ ЖЕ МЕСТЕ ═══════════
  yield* all(
    quote().opacity(0, ASK_SWAP * 0.6, easeInOutCubic),
    chain(waitFor(ASK_SWAP * 0.35), ask().opacity(1, ASK_SWAP * 0.65, easeOutCubic)),
  );
  yield* waitFor(ASK_HOLD);

  // ═══ 4. Камера едет вправо — на стене висит страница ═════════════════
  const panTarget = -(CAMERA_DRIFT + WALL_X) * PHOTO_S;
  yield* all(
    ask().opacity(0, PAN_DUR * 0.35, easeInCubic),
    wallSheet.opacity(1, PAN_DUR * 0.4, easeOutCubic),
    photo().x(panTarget, PAN_DUR, easeInOutCubic),
  );

  // наезд из стены прямо в шапку: риг подхватывает лист пиксель в пиксель,
  // комната по дороге отпадает
  soloSheet.position([0, WALL_Y * PHOTO_S]);
  soloSheet.scale(WALL_SCALE * PHOTO_S);
  soloSheet.opacity(1);
  wallSheet.opacity(0);
  const [hx, hy] = toSheet(SH_HEAD.x, SH_HEAD.y);
  yield* all(
    soloSheet.scale(SH_READ, APPROACH, easeInOutCubic),
    soloSheet.position([-hx * SH_READ, -hy * SH_READ], APPROACH, easeInOutCubic),
    photo().opacity(0, APPROACH * 0.62, easeInOutCubic),
  );
  photo().remove();

  // свет падает на шапку — заголовок и оба автора, остальное уходит в тень
  yield* lightNode.opacity(1, LIGHT_IN, easeInOutCubic);
  yield* waitFor(LIGHT_HOLD);

  // ═══ 5. Лист откладывают — под ним лежит второй документ ═════════════
  rhRig().opacity(1);
  yield* all(
    lightNode.opacity(0, SET_ASIDE * 0.45, easeInOutCubic),
    soloSheet.position.x(-2900, SET_ASIDE, easeInCubic),
    soloSheet.position.y(soloSheet.position.y() + 340, SET_ASIDE, easeInCubic),
    soloSheet.rotation(-9, SET_ASIDE, easeInCubic),
  );
  soloSheet.remove();
  yield* waitFor(RH_HOLD_0);

  // ═══ 6. Улика: наезд в блок объявления ══════════════════════════════
  yield* all(
    rhRig().scale(RH_READ_S, RH_PUSH, easeInOutCubic),
    rhRig().position(rigAt(AT_DECL, RH_READ_S), RH_PUSH, easeInOutCubic),
  );

  // что он объявил
  yield* hlDecl.rect.size.x(hlDecl.w, HL_DUR, easeInOutSine);
  yield* waitFor(READ_DECL);
  // какую задачу это ставит
  yield* rhRig().position(rigAt(AT_PARTIAL, RH_READ_S), MOVE_DUR, easeInOutCubic);
  yield* hlPartial.rect.size.x(hlPartial.w, HL_DUR, easeInOutSine);
  yield* waitFor(READ_PARTIAL);
  // его ответ — маркер переносится через конец строки
  yield* rhRig().position(rigAt(AT_NULL, RH_READ_S), MOVE_SHORT, easeInOutCubic);
  yield* hlNullA.rect.size.x(hlNullA.w, HL_DUR, easeInOutSine);
  yield* hlNullB.rect.size.x(hlNullB.w, HL_WRAP, easeInOutSine);
  yield* waitFor(READ_NULL);

  // назад к объявлению — и страница растворяется под уже стоящей строкой
  yield* rhRig().position(rigAt(AT_DECL, RH_READ_S), BACK_DUR, easeInOutCubic);
  yield* all(
    rhRig().opacity(0, DISSOLVE, easeInOutCubic),
    rhBlur(7, DISSOLVE, easeInOutCubic),
    code().opacity(1, DISSOLVE * 0.75, easeInOutCubic),
  );
  rhRig().remove();
  yield* waitFor(CODE_HOLD);

  // печать: перед каждым null короткая пауза, три подряд и есть кадр
  for (let i = 0; i < TOKENS.length; i++) {
    const tok = TOKENS[i];
    if (tok.isNull) yield* waitFor(NULL_BEAT);
    for (let c = 1; c <= tok.text.length; c++) {
      tokenNodes[i].text(tok.text.slice(0, c));
      yield* waitFor(CHAR);
    }
  }
  yield* waitFor(TAIL_HOLD);
  yield* dimOthers(0.22, DIM_DUR, easeInOutCubic);
  yield* waitFor(0.8);

  // ═══ 7. Цена решения ════════════════════════════════════════════════
  yield* all(
    code().opacity(0, 0.7, easeInOutCubic),
    ...nullOps.map(op => op(0, 0.7, easeInOutCubic)),
  );
  yield* all(easy().opacity(1, EASY_IN, easeOutCubic), easyBlur(0, EASY_IN, easeOutCubic));
  yield* waitFor(EASY_HOLD);
  yield* all(easy().opacity(0, 0.6, easeInOutCubic), easyBlur(8, 0.6, easeInOutCubic));

  // отсек проявляется как одно
  yield* all(slot().opacity(1, SLOT_IN, easeOutCubic), slotBlur(0, SLOT_IN, easeOutCubic));
  yield* waitFor(SLOT_FIRST);
  // один и тот же пустой отсек наследует каждый ссылочный тип
  for (let i = 1; i < slotLabels.length; i++) {
    yield* all(
      slotLabels[i - 1].opacity(0, SLOT_STEP * 0.4, easeInOutCubic),
      chain(waitFor(SLOT_STEP * 0.22), slotLabels[i].opacity(1, SLOT_STEP * 0.45, easeOutCubic)),
    );
    yield* waitFor(SLOT_STEP * 0.5);
  }
  yield* waitFor(0.5);
  yield* all(slot().opacity(0, 0.6, easeInOutCubic), slotBlur(8, 0.6, easeInOutCubic));

  // тезис: два предложения ПО ОЧЕРЕДИ в одном центре (канон эпиграфов)
  const say = function* (node: Txt, holder: Node, text: string, hold: number) {
    node.text(text);
    yield* holder.opacity(1, THESIS_IN, easeOutCubic);
    yield* waitFor(hold);
    yield* holder.opacity(0, THESIS_IN * 0.8, easeInOutCubic);
  };
  yield* say(thesisTxt, thesis(), 'The mistake was not representing absence.', THESIS_HOLD);
  yield* waitFor(0.25);
  yield* say(
    thesisTxt,
    thesis(),
    'It was making absence a silent possibility\nof every reference.',
    THESIS_HOLD + 0.6,
  );
  yield* waitFor(0.3);

  // ═══ 8. Современный ответ: лента языков ═════════════════════════════
  belt().x(-pairCenters[0] + 420);
  yield* band().opacity(1, 0.5, easeOutCubic);
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
  yield* waitFor(0.4);
  yield* band().opacity(0, 0.6, easeInOutCubic);

  // ═══ 9. Новый вопрос — в главу ══════════════════════════════════════
  yield* say(closingTxt, closing(), 'Now the compiler knows a value may be absent.', CLOSE_HOLD);
  yield* waitFor(0.25);
  yield* say(closingTxt, closing(), 'It still does not know why.', CLOSE_HOLD);
  yield* waitFor(0.6);
});
