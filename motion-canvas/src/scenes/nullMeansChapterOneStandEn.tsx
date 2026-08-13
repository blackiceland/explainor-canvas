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
// Первая сцена главы. Дуга: наш вопрос возвращается уже другим → под ним
// проявляется продукт (карта трекера рейсов) → продукт отступает вправо и
// рядом встаёт механизм (контракт) → контракт дрейфует три года, а его
// сигнатура не меняется ни на символ.
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
const ASK_FS = 52;
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
const ASK_Y = -406;
const ASK_IN = 0.8;
const ASK_HOLD = 2.2;                // ⚠️ VO
const ASK_SWAP = 0.85;
const ASK_READ = 2.4;                // ⚠️ VO
const ASK_OUT = 1.0;

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
const SOFT = 'rgba(244,241,235,0.66)';
const DIM = 'rgba(244,241,235,0.40)';

const MAP_IN = 1.5;
const MAP_BLUR = 14;
const MAP_READ = 3.4;                // ⚠️ VO — знакомство с продуктом

// кадрировка под код: окно СУЖАЕТСЯ, а карта внутри остаётся в масштабе 1:1
// ⚠️ Так честнее уменьшения: в настоящем приложении карта не сжимается при
// изменении окна — она кадрируется. И борт остаётся того же размера, то есть
// читаемым на телефоне.
// ⚠️ Пан подобран по числам генератора, не на глаз: борт при этом прогрессе
// стоит на x=−210, Британия занимает 500…631, Лондон 592. При сдвиге −200 в
// окно попадает и борт (слева), и берег с целью маршрута (справа) — то есть
// кадр сам говорит «летит туда», и для этого ничего не надо подписывать.
const WIN_C = 860;
const MAP_X_C = 495;
const CONTENT_DX_C = -200;
// ⚠️ И вниз тоже: в узком окне борт с дугой уходили в верхнюю треть, а под
// ними оставалось поле пустой воды. Трасса на этом участке идёт по y≈−100,
// так что сдвиг ставит её ровно в середину окна.
const CONTENT_DY_C = 105;
const FRAME_MOVE = 1.4;

// борт ползёт всю сцену: это данные, а не украшение
const PROG_FROM = 0.28;
const PROG_TO = 0.56;

// ── код ─────────────────────────────────────────────────────────────────
const CODE_FS = 25;
const CODE_LH = 40;
const CODE_W = 830;
const CODE_X = -530;
const CODE_IN = 0.8;
const CODE_READ = 3.2;               // ⚠️ VO — контракт выглядит разумно

// ⚠️⚠️ СИГНАТУРА НЕ ЕЗДИТ — на её неподвижности держится весь тезис главы.
// Без этого первая строка уползала вверх при росте тела с 4 строк до 10.
// Решение: ЗАДАННАЯ ВЫСОТА С ЗАПАСОМ. При ней Manticore прижимает контент к
// верху блока и не доскролливает его к изменённому месту, поэтому строка 0
// стоит на одном локальном смещении при любом числе строк, и двигать узел
// не нужно вовсе. ⚠️ Запаса должно хватать на ФИНАЛЬНОЕ состояние (10 строк
// ×40 + поля): при 480 скролл возвращался и сигнатура снова поехала.
const CODE_H = 560;
const CODE_Y = 63;                   // подобрано так, что сигнатура ≈ −150
const YEAR_ANCHOR = -150;

const YEAR_FS = 17;
const YEAR_Y = YEAR_ANCHOR - 58;
const YEAR_SWAP = 0.32;

const DRIFT = 1.5;
const DRIFT_HOLD = 3.0;              // ⚠️ VO — на каждый год
const RACK = 1.1;
const RACK_HOLD = 3.2;               // ⚠️ VO — сигнатура не изменилась
const TAIL = 0.9;

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
// на экране появляется `if (flight.isBlocked)`, и это и есть то изменение,
// про которое говорит голос. Каждая правка по отдельности разумна.
const CODE_2023 = `fun currentPosition(flightId: FlightId): Coordinates? {
    val flight = flights.find(flightId)
    return provider.position(flight)
}`;

const CODE_2024 = `fun currentPosition(flightId: FlightId): Coordinates? {
    val flight = flights.find(flightId)
    if (flight.isBlocked) {
        return null
    }
    return provider.position(flight)
}`;

const CODE_2025 = `fun currentPosition(flightId: FlightId): Coordinates? {
    val flight = flights.find(flightId)
    if (flight.isBlocked) {
        return null
    }
    val fix = provider.position(flight) ?: return null
    if (fix.isStale()) {
        return null
    }
    return fix
}`;

const CODE_RULES = buildCanonRules({
  types: ['FlightId', 'Coordinates'],
  vars: ['flight', 'flights', 'provider', 'fix', 'flightId'],
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
  const contentDX = createSignal(0);
  const contentDY = createSignal(0);
  const prog = createSignal(PROG_FROM);

  const mapNode = createRef<Node>();
  const win = createRef<Rect>();
  const content = createRef<Node>();
  const overlay = createRef<Node>();

  view.add(<Node ref={mapNode} y={MAP_Y} opacity={0} cache cachePadding={60} />);
  mapNode().add(
    <Rect
      ref={win}
      width={() => winW()}
      height={MAP_H}
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
  content().add(<Line points={pts} stroke={TRACK_AHEAD} lineWidth={1.8} />);
  content().add(
    <Line points={pts} stroke={TRACK_DONE} lineWidth={2.2} end={() => prog()} />,
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
        fontSize={16}
        fontWeight={500}
        letterSpacing={1.4}
        fill={DIM}
      />,
    );
  };
  port(P_JFK, 'JFK', 6, 26);
  port(P_LHR, 'LHR', 12, -22);

  // борт
  const plane = createRef<Path>();
  content().add(
    <Path
      ref={plane}
      data={PLANE}
      fill={SIGNAL}
      scale={PLANE_S}
      position={() => new Vector2(...routeXY(prog()))}
      rotation={() => routeDeg(prog())}
    />,
  );

  // ── хром панели: прибит к КРАЯМ ОКНА, поэтому переживает кадрировку ───
  // ⚠️ Хедер и футер отбиты волосяными линиями во всю ширину окна — так это
  // читается собранным продуктом, а не текстом, положенным поверх карты.
  // ⚠️ Хедер и футер лежат на СВОИХ полосах: без них строка данных наезжала
  // на береговую линию и переставала читаться. Это часть продуктового UI,
  // а не декоративная плашка под текстом.
  const left = () => -winW() / 2 + 38;
  const bar = (y: number, h: number) =>
    overlay().add(
      <Rect width={() => winW()} height={h} y={y} fill="rgba(9,10,13,0.72)" />,
    );
  const rule = (y: number) =>
    overlay().add(
      <Rect width={() => winW()} height={1} y={y} fill={MAP_HAIR} />,
    );
  bar(-MAP_H / 2 + 50, 100);
  bar(MAP_H / 2 - 38, 76);
  rule(-MAP_H / 2 + 100);
  rule(MAP_H / 2 - 76);
  overlay().add(
    <Txt
      text="BA 117"
      x={left}
      y={-MAP_H / 2 + 46}
      offset={[-1, 0]}
      fontFamily={MONO}
      fontSize={30}
      fontWeight={500}
      fill={INK}
    />,
  );
  overlay().add(
    <Txt
      text="JFK → LHR"
      x={left}
      y={-MAP_H / 2 + 78}
      offset={[-1, 0]}
      fontFamily={MONO}
      fontSize={15}
      letterSpacing={2.6}
      fill={DIM}
    />,
  );

  // строка данных: настоящий ledger, tabular figures, никаких плашек
  const dataY = MAP_H / 2 - 40;
  const cell = (i: number, label: string, value: () => string) => {
    const x = () => left() + i * 250;
    overlay().add(
      <Txt
        text={label}
        x={x}
        y={dataY - 15}
        offset={[-1, 0]}
        fontFamily={MONO}
        fontSize={12}
        letterSpacing={2.2}
        fill={DIM}
      />,
    );
    overlay().add(
      <Txt
        text={value}
        x={x}
        y={dataY + 9}
        offset={[-1, 0]}
        fontFamily={MONO}
        fontSize={18}
        fontWeight={500}
        fill={SOFT}
      />,
    );
  };
  cell(0, 'ALTITUDE', () => '38 000 ft');
  cell(1, 'GROUND SPEED', () => '512 kt');
  cell(2, 'POSITION', () => fmtLL(prog()));

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
      letterSpacing={5}
      fill={DIM}
      opacity={0}
    />,
  );

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

  // ═══ B. Под вопросом проявляется продукт ════════════════════════════
  // ⚠️ Панель приходит КАК ОДНО через focus-pull: блюр на узле — дети
  // блюрятся вместе. Постадийный вход элементов = стоковая библиотека.
  mapNode().filters([blur(MAP_BLUR)]);
  yield* all(
    mapNode().opacity(1, MAP_IN, easeOutCubic),
    mapNode().filters.blur(0, MAP_IN, easeInOutSine),
    prog(PROG_FROM + 0.02, MAP_IN, linear),
    chain(waitFor(MAP_IN * 0.55), ask().opacity(0, ASK_OUT, easeInCubic)),
  );
  mapNode().filters([]);
  ask().remove();

  yield* all(
    prog(PROG_FROM + 0.08, MAP_READ, linear),
    waitFor(MAP_READ),
  );

  // ═══ C. Рядом с продуктом встаёт механизм ═══════════════════════════
  yield* all(
    winW(WIN_C, FRAME_MOVE, easeInOutCubic),
    mapNode().x(MAP_X_C, FRAME_MOVE, easeInOutCubic),
    contentDX(CONTENT_DX_C, FRAME_MOVE, easeInOutCubic),
    contentDY(CONTENT_DY_C, FRAME_MOVE, easeInOutCubic),
    prog(PROG_FROM + 0.13, FRAME_MOVE, linear),
    chain(
      waitFor(FRAME_MOVE * 0.45),
      all(
        code.appear(CODE_IN),
        year().opacity(1, CODE_IN, easeOutCubic),
      ),
    ),
  );
  yield* all(prog(PROG_FROM + 0.17, CODE_READ, linear), waitFor(CODE_READ));

  // ═══ D. Дрейф: три года, ни одного неверного решения ════════════════
  const driftTo = function* (next: string, label: string, pFrom: number, pTo: number) {
    yield* all(
      chain(
        year().opacity(0, YEAR_SWAP / 2, easeInCubic),
        (function* () {
          year().text(label);
        })(),
        year().opacity(1, YEAR_SWAP / 2, easeOutCubic),
      ),
      code.morphTo(next, {
        addStyle: 'typewriter',
        lineOrder: 'sequential',
        moveDuration: 0.45,
        removeDuration: 0.3,
        charDelay: 0.012,
        lineDelay: 0.06,
      }),
      prog(pFrom, DRIFT, linear),
    );
    yield* all(prog(pTo, DRIFT_HOLD, linear), waitFor(DRIFT_HOLD));
  };

  yield* driftTo(CODE_2024, '2024', PROG_FROM + 0.21, PROG_FROM + 0.235);
  yield* driftTo(CODE_2025, '2025', PROG_FROM + 0.26, PROG_FROM + 0.275);

  // ═══ E. А сигнатура не изменилась ни на символ ══════════════════════
  // ⚠️ Тезис доказывается ТИШИНОЙ вокруг сигнатуры: тело уходит, первая
  // строка остаётся — она одна и та же во всех трёх состояниях.
  yield* all(
    code.dimLines(1, code.lineCount - 1, 0.16, RACK),
    prog(PROG_TO - 0.01, RACK, linear),
  );
  yield* all(prog(PROG_TO, RACK_HOLD, linear), waitFor(RACK_HOLD));

  yield* all(
    code.node.opacity(0, TAIL, easeInCubic),
    year().opacity(0, TAIL, easeInCubic),
    mapNode().opacity(0.001, TAIL, easeInCubic),
  );
  yield* waitFor(0.3);
});
