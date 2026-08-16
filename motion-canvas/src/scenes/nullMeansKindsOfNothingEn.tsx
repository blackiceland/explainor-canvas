import {Circle, Line, Node, Path, Txt, blur, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  createSignal,
  easeInCubic,
  easeInOutSine,
  easeOutCubic,
  linear,
  waitFor,
  ThreadGenerator,
} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Fonts} from '../core/theme';
import {Canon} from '../core/code/model/paletteCanon';
import {ROUTE_LL} from './atlanticGeo';

// ═══════════════════════════════════════════════════════════════════════
// ГЛАВА 2 · ДВА СОРТА НИЧЕГО.
//
// Ответ на розовый вопрос, которым кончилась глава 1: сколько бывает «ничего».
// Мысль Кодда (1986): пустое поле может значить две принципиально разные вещи —
// значение ПРИМЕНИМО, НО НЕИЗВЕСТНО, и значение НЕПРИМЕНИМО, его не существует.
//
// ⚠️⚠️ ПОЧЕМУ ИМЕННО ТАК, А НЕ ИНАЧЕ (история решений, чтобы не ходить по кругу):
//  • Отвергнут беат «последствия null» (мониторинг молчит + тикет саппорта +
//    тезис текстом). Автор: «тупо проговаривать очевидное». Он прав: зритель это
//    уже видел на слот-машине главы 1, а мы показали то же самое ещё дважды и
//    подписали словами. ПРАВИЛО: беат обязан ломать то, во что зритель верит, а
//    не повторять то, что он видел.
//  • Отвергнут беат «а если Optional?»: `Coordinates?` — УЖЕ обёртка. Вся
//    катастрофа главы 1 произошла внутри явного типа, при довольном компиляторе.
//    Морфить одну коробку в другую и называть это экспериментом нечестно.
//  • Отвергнута версия на `ACTUAL ARRIVAL` (летящий рейс vs отменённый): у
//    летящего время прибытия не «неизвестно» — его ЕЩЁ НЕ СЛУЧИЛОСЬ. Это ось
//    «потом / никогда», а Кодд про ось «есть, но не знаем / нет вообще».
//  • Отвергнута версия с маркерами `?` и `∅`: это придуманные значки на
//    продуктовом экране (всю первую главу мы печатали только то, что система
//    печатает на самом деле), а финал «два значка схлопываются в один null» был
//    бы ТРЕТЬИМ за ролик жестом «разное схлопнулось в одно» — после пяти строк
//    слот-машины это мельчание.
//
// ⚠️ КАМЕРА СМЕНИЛА МЕСТО, и на этом держится всё. В главе 1 мы сидели ВНУТРИ
// системы: борт замер серым призраком, потому что система перестала знать.
// Здесь мы в РЕАЛЬНОСТИ — борт летит, не замирая ни на кадр, и видно его
// глазами, пока поле координат говорит «не знаю». Значение существует, вон оно,
// движется; просто никто его не сообщает. Без этой смены точки съёмки беат был
// бы третьим показом дыры покрытия.
//
// ⚠️ Продуктовой карточки здесь НЕТ намеренно: это не экран, это мир. Словарь
// тот же, что у карты главы 1 (линия маршрута, силуэт борта, моноширинный
// ledger), только без рамы.
// ═══════════════════════════════════════════════════════════════════════

const MONO = Fonts.code;

const INK = 'rgba(244,241,235,0.96)';
const DIM = 'rgba(244,241,235,0.40)';
const SIGNAL = Canon.keyword;                    // #A3CDFF — «сигнал есть»
const TRACK_DONE = 'rgba(163,205,255,0.72)';
const TRACK_COLD = 'rgba(244,241,235,0.15)';     // непройденное и непролетаемое
const SOFT_PINK = 'rgba(236, 189, 200, 0.95)';

// ── вопрос ──────────────────────────────────────────────────────────────
// ⚠️ Тот же розовый, тот же кегль, что у вопросов главы 1: это одна и та же
// краска, которой ролик спрашивает, и третье её появление подряд.
const ASK_FS = 60;
const ASK_Y = -12;
const ASK_IN = 0.9;
const ASK_HOLD = 2.6;                // ⚠️ VO
const ASK_OUT = 0.9;
const ASK_GAP = 0.45;

// ── две линии ───────────────────────────────────────────────────────────
const LANE_UP = -140;
const LANE_DN = 140;
const X0 = -610;
const X1 = 270;
const LANE_W = X1 - X0;
const POS_X = 370;                   // колонка показаний, общая для обеих линий
const LABEL_DY = -46;                // строка имён — над линиями

const LABEL_FS = 24;
const EYEBROW_FS = 15;
const VALUE_FS = 28;
const PLANE_S = 1.6;

// ⚠️ Дыра покрытия — примерно середина маршрута: борт входит в неё уже разогнав
// ритм, и выходит, не долетев до конца. Отметок у дыры НЕТ: её обозначает то,
// что происходит (след обрывается, показания гаснут), а не подпись или плашка.
const GAP_A = 0.4;
const GAP_B = 0.63;
const FLY_FROM = 0.05;
const FLY_TO = 0.88;                 // ⚠️ борт НЕ долетает: посадка открыла бы
                                     // спор «а у севшего позиция есть» — ровно
                                     // ту шаткость, из-за которой мы отказались
                                     // от версии с ACTUAL ARRIVAL
const LANES_IN = 1.2;
const LANES_HOLD = 1.6;              // ⚠️ VO — один летит, второй отменён
const FLY_DUR = 9.5;
const DASH_IN = 0.3;                 // показания гаснут
const RETYPE_CD = 0.032;             // и возвращаются печатью
const TAIL_HOLD = 2.6;               // ⚠️ VO — прочерк один, а за ним разное

// ── два имени ───────────────────────────────────────────────────────────
// ⚠️ Имена приходят ПОСЛЕ показа, и это не вкус: перед сценой стоит вопрос
// «сколько бывает сортов ничего». Назови мы их первыми — вопрос отвечен, и
// смотреть на полёт незачем. Порядок: вопрос → показ → имя.
// ⚠️ Цвет довозит смысл: синее «ничего» умеет стать значением (мы только что
// видели, как оно им стало), холодное — не умеет никогда.
const NAME_FS = 112;
const NAME_UP_C = SIGNAL;
const NAME_DN_C = 'rgba(244,241,235,0.58)';
const NAME_Y = 102;                  // при 88 слова почти касались
const NAME_IN = 0.9;
const NAME_HOLD = 3.4;               // ⚠️ VO
const OUT = 1.0;

// ── борт в кадре имён: расфокус вместо гибели ───────────────────────────
// ⚠️⚠️ САМОЕ ТОНКОЕ МЕСТО СЦЕНЫ. Целый, чётко видимый самолёт рядом со словом
// UNKNOWN СПОРИТ со словом: «вот же он, что тут неизвестного» (поймал автор).
// Показать неизвестность напрямую нельзя — но можно показать её структуру:
// СУЩЕСТВУЕТ, НО НЕ В ТОЧКЕ. Борт долетает до слова и рассыпается в облако
// точек, которое ПРОДОЛЖАЕТ ЛЕТЕТЬ и медленно расходится.
// ⚠️ Облако обязано лететь дальше. Если частицы просто растают — борт умер, и
// кадр станет неотличим от NOT APPLICABLE, а заодно прочитается катастрофой.
// ⚠️ Ни падения вниз, ни разлёта во все стороны: первое читается крушением,
// второе взрывом. Только мягкое расхождение при общем сносе вперёд.
// ⚠️ Это не только метафора: когда борт пропадает с радара, честное
// представление его позиции — растущая область неопределённости вокруг
// последнего фикса, её так и рисуют поисковые службы. Самолёт перестаёт быть
// точкой и становится пятном. Поэтому облако ещё и медленно растёт.
// ⚠️ Рядом с NOT APPLICABLE не появляется НИКТО и ничего: у несуществования
// единственная честная визуализация — пустота. Отвергнут вариант «самолёт
// собирается из точек и не может собраться»: почти-возникший борт читается как
// «вот-вот появится», то есть как UNKNOWN, — та же размазня «потом/никогда»,
// из-за которой была отвергнута версия с ACTUAL ARRIVAL.
const CODA_SPEED = 70;               // px/с — тот же порядок, что в полёте
const CODA_Y = -NAME_Y;              // борт идёт по строке своего имени
const DUST = 1.2;                    // борт теряет цельность
const DUST_SPREAD = 3.0;             // во сколько раз расходится силуэт
const DUST_JITTER = 34;
const DUST_R = 3;
const CLOUD_GROW = 1.32;             // область неопределённости растёт

// силуэт борта (вид сверху, нос в −y) — тот же, что летал в главе 1
const PLANE_PTS: [number, number][] = [
  [0, -13], [2.2, -7], [2.2, -2], [13, 5], [13, 7.6], [2.2, 4],
  [2.2, 9], [5, 12.4], [5, 14], [0, 12.6], [-5, 14], [-5, 12.4],
  [-2.2, 9], [-2.2, 4], [-13, 7.6], [-13, 5], [-2.2, -2], [-2.2, -7],
];
const PLANE =
  PLANE_PTS.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ') + ' Z';

// ⚠️ Псевдослучай ДЕТЕРМИНИРОВАННЫЙ: `Math.random` дал бы разное облако на
// каждом рендере, и покадровая сверка стиллов перестала бы работать.
const rnd = (i: number, s: number) => {
  const x = Math.sin((i + 1) * 12.9898 + s * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// ⚠️ Координаты НАСТОЯЩИЕ: те же ROUTE_LL, по которым в главе 1 считалась дуга
// JFK→LHR. Линия здесь схематичная, но числа врать не должны — на них зритель
// смотрит вблизи, и это тот же принцип, по которому карта считалась офлайн.
const llAt = (p: number): string => {
  const t = Math.max(0, Math.min(1, p)) * (ROUTE_LL.length - 1);
  const i = Math.min(Math.floor(t), ROUTE_LL.length - 2);
  const f = t - i;
  const lon = ROUTE_LL[i][0] + (ROUTE_LL[i + 1][0] - ROUTE_LL[i][0]) * f;
  const lat = ROUTE_LL[i][1] + (ROUTE_LL[i + 1][1] - ROUTE_LL[i][1]) * f;
  const ns = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`;
  const ew = `${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
  return `${ns}  ${ew}`;
};

// ═══════════════════════════════════════════════════════════════════════
export default makeScene2D(function* (view) {
  applyBackground(view);

  // ── вопрос ────────────────────────────────────────────────────────────
  const ask = createRef<Txt>();
  view.add(
    <Txt
      ref={ask}
      text="How many kinds of nothing are there?"
      y={ASK_Y}
      opacity={0}
      cache
      cachePadding={80}
      fontFamily={MONO}
      fontSize={ASK_FS}
      fontWeight={500}
      fill={SOFT_PINK}
    />,
  );

  // ── две линии ─────────────────────────────────────────────────────────
  const lanes = createRef<Node>();
  view.add(<Node ref={lanes} opacity={0} />);

  const prog = createSignal(FLY_FROM);
  const lost = createSignal(0);                  // 1 = показаний нет
  const reveal = createSignal(99);               // сколько знаков показаний видно
  const xAt = (p: number) => X0 + p * LANE_W;

  const label = (y: number, text: string, fill: string) =>
    lanes().add(
      <Txt
        text={text}
        x={X0}
        y={y + LABEL_DY}
        offset={[-1, 0]}
        fontFamily={MONO}
        fontSize={LABEL_FS}
        fontWeight={500}
        letterSpacing={1.4}
        fill={fill}
      />,
    );
  const readout = (y: number, value: () => string) => {
    lanes().add(
      <Txt
        text="POSITION"
        x={POS_X}
        y={y + LABEL_DY}
        offset={[-1, 0]}
        fontFamily={MONO}
        fontSize={EYEBROW_FS}
        letterSpacing={2.2}
        fill={DIM}
      />,
    );
    lanes().add(
      <Txt
        text={value}
        x={POS_X}
        y={y}
        offset={[-1, 0]}
        fontFamily={MONO}
        fontSize={VALUE_FS}
        fontWeight={500}
        fill={INK}
      />,
    );
  };
  const coldLine = (y: number) =>
    lanes().add(
      <Line points={[[X0, y], [X1, y]]} stroke={TRACK_COLD} lineWidth={1.8} />,
    );

  // ── верхняя: борт в воздухе, значение существует ─────────────────────
  label(LANE_UP, 'BA 117 · EN ROUTE', INK);
  coldLine(LANE_UP);
  // ⚠️ Пройденный след — ДВА отрезка с дырой между ними. Из дыры фиксы не
  // приходят, поэтому в записанном следе она остаётся навсегда: борт там летел,
  // а система об этом ничего не знает. Одна `Line` с `end` такого не умеет.
  lanes().add(
    <Line
      points={[[X0, LANE_UP], [xAt(GAP_A), LANE_UP]]}
      stroke={TRACK_DONE}
      lineWidth={2.4}
      end={() => Math.max(0, Math.min(1, prog() / GAP_A))}
    />,
  );
  lanes().add(
    <Line
      points={[[xAt(GAP_B), LANE_UP], [X1, LANE_UP]]}
      stroke={TRACK_DONE}
      lineWidth={2.4}
      end={() => Math.max(0, Math.min(1, (prog() - GAP_B) / (1 - GAP_B)))}
    />,
  );
  readout(LANE_UP, () =>
    lost() > 0.5 ? '—' : llAt(prog()).slice(0, Math.round(reveal())),
  );
  // ⚠️ Борт НЕ меняет ни цвет, ни скорость, ни при входе в дыру, ни в ней. Он
  // вообще не знает, что его перестали видеть, — в этом весь беат.
  const plane = createRef<Path>();
  lanes().add(
    <Path
      ref={plane}
      data={PLANE}
      fill={SIGNAL}
      scale={PLANE_S}
      rotation={90}
      x={() => xAt(prog())}
      y={LANE_UP}
    />,
  );

  // ── нижняя: рейса нет, значения не существует ────────────────────────
  // ⚠️ Маршрут нарисован — он был запланирован; но по нему никто не полетит, и
  // холодная линия здесь означает ровно это. Никакого борта в кадре нет и не
  // появится: посылать некого.
  label(LANE_DN, 'AF 1680 · CANCELLED', DIM);
  coldLine(LANE_DN);
  readout(LANE_DN, () => '—');

  // ── борт и его облако в коде ─────────────────────────────────────────
  // ⚠️ Отдельный узел на `view` и ДО имён: борт обязан пережить растворение
  // линий (иначе кода начнётся с монтажной склейки, а он летит всю сцену без
  // единой остановки), и он должен уходить ЗА буквы — ярлык заслоняет
  // реальность, но между литерами борт видно. Это тезис ролика одним пролётом.
  const flight = createRef<Node>();
  view.add(<Node ref={flight} />);

  const cloudX = createSignal(0);
  const dust = createSignal(0);                  // 0 = силуэт, 1 = облако
  const cloud = createRef<Node>();
  flight().add(
    <Node ref={cloud} x={cloudX} y={CODA_Y} opacity={0} />,
  );
  // ⚠️ Частицы сидят В ВЕРШИНАХ силуэта (и в серединах его рёбер — иначе облако
  // выходит редким): в первый момент облако ЕЩЁ имеет форму самолёта, и видно,
  // что рассыпался именно он, а не «появились точки».
  const seeds: [number, number][] = [];
  PLANE_PTS.forEach(([x, y], i) => {
    const [nx, ny] = PLANE_PTS[(i + 1) % PLANE_PTS.length];
    seeds.push([x * PLANE_S, y * PLANE_S]);
    seeds.push([((x + nx) / 2) * PLANE_S, ((y + ny) / 2) * PLANE_S]);
  });
  seeds.forEach(([bx, by], i) => {
    // ⚠️ Борт летит носом вправо (rotation 90), поэтому силуэт разворачиваем:
    // локальный −y становится +x. Иначе облако «вылупляется» боком.
    const b = [-by, bx];
    const t = [
      b[0] * DUST_SPREAD + (rnd(i, 1) - 0.5) * 2 * DUST_JITTER,
      b[1] * DUST_SPREAD + (rnd(i, 2) - 0.5) * 2 * DUST_JITTER,
    ];
    cloud().add(
      <Circle
        width={DUST_R * 2}
        height={DUST_R * 2}
        fill={SIGNAL}
        opacity={0.34 + rnd(i, 3) * 0.5}
        x={() => b[0] + (t[0] - b[0]) * dust()}
        y={() => b[1] + (t[1] - b[1]) * dust()}
      />,
    );
  });

  // ── два имени ─────────────────────────────────────────────────────────
  const names = createRef<Node>();
  view.add(<Node ref={names} />);
  const name = (text: string, y: number, fill: string) => {
    const n = new Txt({
      text,
      y,
      opacity: 0,
      cache: true,
      cachePadding: 90,
      fontFamily: MONO,
      fontSize: NAME_FS,
      fontWeight: 500,
      letterSpacing: 2,
      fill,
    });
    names().add(n);
    return n;
  };
  const nameUp = name('UNKNOWN', -NAME_Y, NAME_UP_C);
  const nameDn = name('NOT APPLICABLE', NAME_Y, NAME_DN_C);

  const pullIn = function* (n: Node, dur: number, amount = 12): ThreadGenerator {
    n.filters([blur(amount)]);
    yield* all(
      n.opacity(1, dur, easeOutCubic),
      n.filters.blur(0, dur, easeInOutSine),
    );
    n.filters([]);
  };

  // ═══════════════ ТАЙМЛАЙН ════════════════════════════════════════════
  // ═══ A. Вопрос ══════════════════════════════════════════════════════
  yield* pullIn(ask(), ASK_IN);
  yield* waitFor(ASK_HOLD);
  yield* ask().opacity(0, ASK_OUT, easeInCubic);
  ask().remove();
  yield* waitFor(ASK_GAP);

  // ═══ B. Две линии ═══════════════════════════════════════════════════
  // ⚠️ Обе приходят СРАЗУ и вместе: нижняя объявлена отменённой с первой
  // секунды, поэтому она не «пустое место в ожидании контента», а полноценная
  // строка, которая просто никогда не оживёт.
  yield* pullIn(lanes(), LANES_IN, 10);
  yield* waitFor(LANES_HOLD);

  // ═══ C. Полёт: до дыры ══════════════════════════════════════════════
  const seg = (from: number, to: number) =>
    prog(to, (FLY_DUR * (to - from)) / (FLY_TO - FLY_FROM), linear);
  yield* seg(FLY_FROM, GAP_A);

  // ═══ D. В дыре: борт летит, показаний нет ═══════════════════════════
  // ⚠️⚠️ КЛЮЧЕВОЙ КАДР СЦЕНЫ. Прочерк сверху и прочерк снизу — один и тот же
  // символ. Но над верхним у всех на глазах едет самолёт, а над нижним пусто.
  // Полёт сквозь дыру идёт БЕЗ ПАУЗ и без замедления: любая остановка здесь
  // означала бы «система потеряла борт», а мы показываем обратное — борт цел,
  // потеряны только сведения о нём.
  yield* all(
    (function* () {
      lost(1);
      yield* waitFor(DASH_IN);
    })(),
    seg(GAP_A, GAP_B),
  );

  // ═══ E. Выход: показания возвращаются печатью ═══════════════════════
  // ⚠️ Не подменой кадра, а печатью — тем же жестом, которым в этой истории
  // переписывался код и умирали ячейки табло. Значение не «нашлось»: оно всё
  // это время было, и теперь его наконец сообщают.
  lost(0);
  reveal(0);
  const full = llAt(GAP_B).length;
  yield* all(
    seg(GAP_B, FLY_TO),
    reveal(full, full * RETYPE_CD, linear),
  );
  yield* waitFor(TAIL_HOLD);

  // ═══ F. Линии уходят, борт летит дальше ═════════════════════════════
  // ⚠️ Борт ВЫНИМАЕМ из линий, чтобы он их пережил: между показом и именами не
  // должно быть склейки, он идёт сквозь неё не останавливаясь. Позицию с
  // сигнала переводим в статическую — дальше ею правит кода.
  const x0 = xAt(FLY_TO);
  plane().remove();
  plane().position([x0, LANE_UP]);
  flight().add(plane());
  cloudX(x0);

  // ⚠️ Снос борта задан ОДНОЙ скоростью на всю коду (`CODA_SPEED`), поэтому
  // движение непрерывно через все такты: ни ускорений, ни остановок.
  const drift = (dur: number) => cloudX(cloudX() + CODA_SPEED * dur, dur, linear);
  const rideOut = function* (dur: number): ThreadGenerator {
    yield* all(plane().x(cloudX() + CODA_SPEED * dur, dur, linear), drift(dur));
  };

  yield* all(
    lanes().opacity(0, OUT, easeInCubic),
    (function* () {
      lanes().filters([blur(0)]);
      yield* lanes().filters.blur(9, OUT, easeInOutSine);
    })(),
    plane().y(CODA_Y, OUT, easeInOutSine),
    rideOut(OUT),
  );
  lanes().remove();

  // ═══ G. Имя приходит ПОВЕРХ борта ═══════════════════════════════════
  yield* all(pullIn(nameUp, NAME_IN), rideOut(NAME_IN));

  // ═══ H. Борт теряет цельность ═══════════════════════════════════════
  // ⚠️ Не гибель, а расфокус: силуэт гаснет, облако проступает на его месте и
  // расходится, продолжая тот же снос. «Есть, но не в точке».
  yield* all(
    rideOut(DUST * 0.35),
    cloud().opacity(1, DUST * 0.45, easeOutCubic),
    plane().opacity(0, DUST * 0.35, easeInCubic),
  );
  plane().remove();
  yield* all(
    drift(DUST * 0.65),
    dust(1, DUST * 0.65, easeOutCubic),
  );

  // ═══ I. Второе имя — и рядом с ним никого ═══════════════════════════
  yield* all(pullIn(nameDn, NAME_IN), drift(NAME_IN));
  // ⚠️ Облако продолжает и лететь, и МЕДЛЕННО РАСТИ: область неопределённости
  // со временем расширяется — это и есть «где-то здесь».
  yield* all(
    drift(NAME_HOLD),
    cloud().scale(CLOUD_GROW, NAME_HOLD, linear),
  );

  yield* all(
    nameUp.opacity(0, OUT, easeInCubic),
    nameDn.opacity(0, OUT, easeInCubic),
    cloud().opacity(0, OUT, easeInCubic),
    drift(OUT),
  );
  yield* waitFor(0.3);
});
