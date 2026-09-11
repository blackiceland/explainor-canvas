import {blur, makeScene2D, Node} from '@motion-canvas/2d';
import {
  all,
  createSignal,
  easeInOutCubic,
  easeInOutSine,
  easeOutCubic,
  SimpleSignal,
  ThreadGenerator,
  waitFor,
} from '@motion-canvas/core';
import {Box3, MeshStandardMaterial, Scene, Vector3, WebGLRenderer} from 'three';
import {createThreeView} from '../core/three/ThreeCanvas';
import {
  buildChargingStage, mountGroundPool, mountWorldCard,
  POST_IDLE, POST_LIVE,
} from '../core/three/chargingStage';
import {Screen} from '../core/theme';
import {applyBackground} from '../core/utils';
import {Manticore} from '../core/code/components/Manticore';
import type {CodeLine} from '../core/code/components/CodeLine';
import {
  buildCanonRules, Canon, CanonCodeTheme, paintCanonMethodCalls,
  paintCanonMethodCallsLine,
} from '../core/code/model/paletteCanon';

// ── DON'T FIGHT DUPLICATION · акт 2: расхождение требований ────────────────
// Глава 1, сразу после титра THE TRAP. За сцену зритель видит, как в ОБЩЕЙ
// функции поселяются правила двух разных сценариев. Всё работает — баг будет
// следующим актом; здесь ничего не ломается и ничего не подсвечено тревожно.
//
// Порядок требований: улица (авторизация) → депо (доля мощности) → улица
// (лимит длительности). Лимит приходит ТРЕТЬИМ и последним не для симметрии:
// именно поэтому у него дефолт. «Поле добавили позже и дали дефолт, чтобы не
// трогать существующие вызовы» — реалистичная причина, и она же механизм бага
// акта 3: депо не задаёт лимит, а когда общий дефолт станет true, поведение
// депо изменится, хотя депо никто не трогал.
//
// ⚠️ Мир не рисует плашек. Авторизация и лимит живут на ЭКРАНЕ СТОЙКИ —
// настоящей поверхности; доля мощности — на индикаторах шести стоек депо,
// яркость = доля. Никаких баров, чипов и подписей поверх кадра.

// ── Код: ОДИН ФАЙЛ, а не три блока ────────────────────────────────────────
// ⚠️ Кроссфейды между отдельными блоками ОТМЕНЕНЫ (автор: «ты меняешь код на
// два метода и делаешь это грубо»). Всё время сцены в кадре один и тот же
// документ — тот, которым кончился акт 1. Две обёртки сверху с самого начала,
// но ПРИГЛУШЕНЫ: они уже написаны, просто сейчас речь не о них.
//
// ⚠️ ПОРЯДОК ПРАВОК: сначала тип настроек СВЕРХУ файла, и только потом тела
// (автор: «сразу его сверху введи перед заполнением тел»). Так и делают в
// редакторе — сперва объявляют, потом пользуются; и так у документа с самого
// начала есть окончательная шапка, а дальше он растёт только ВНИЗ. Ни одна
// уже написанная строка от этого не уезжает вверх без причины.
//
// Ширина блока 62 знака: вызов с тремя аргументами обязан быть в ОДНУ строку
// (автор), а это 61 знак.
const W_FLEET_0 = `fun startFleetSession(cmd: StartFleet) {
    val owner = SessionOwner.Vehicle(cmd.vehicle)
    startSession(StartSession(cmd.connector, owner))
}`;
const W_PUBLIC_0 = `fun startPublicSession(cmd: StartPublic) {
    val owner = SessionOwner.Driver(cmd.driver)
    startSession(StartSession(cmd.connector, owner))
}`;

// ⚠️ У депо на строку МЕНЬШЕ: enforceTimeLimit он не задаёт вовсе. Вся
// асимметрия акта видна без единого выделения — просто короче блок.
const W_FLEET_1 = `fun startFleetSession(cmd: StartFleet) {
    val owner = SessionOwner.Vehicle(cmd.vehicle)

    val options = SessionOptions(
        preAuthorizeCard = false,
        balanceLoad = true,
    )

    startSession(StartSession(cmd.connector, owner, options))
}`;
const W_PUBLIC_1 = `fun startPublicSession(cmd: StartPublic) {
    val owner = SessionOwner.Driver(cmd.driver)

    val options = SessionOptions(
        preAuthorizeCard = true,
        balanceLoad = false,
        enforceTimeLimit = true,
    )

    startSession(StartSession(cmd.connector, owner, options))
}`;

// Ружьё акта 3 висит здесь и не выделено ничем: дефолт есть только у поля,
// которое добавили последним.
const OPTIONS = `data class SessionOptions(
    val preAuthorizeCard: Boolean,
    val balanceLoad: Boolean,
    val enforceTimeLimit: Boolean = false,
)`;

// ── Состояния общего метода ────────────────────────────────────────────────
const FN_0 = `fun startSession(cmd: StartSession) {
    val connector = connectors.acquire(cmd.connector)
    val session = sessions.open(connector, cmd.owner)
    metering.start(session.id)
    charger.energize(connector.id)
    events.publish(SessionStarted(session.id))
}`;

// ⚠️ Авторизация стоит ПЕРВОЙ, до acquire. Это ворота, а ворота стоят до
// обязательств: если карту отклонят после захвата коннектора и открытия
// сессии, останется занятый коннектор и открытая сессия. Исключение до любых
// побочных эффектов пути отказа не требует — поэтому его и нет в кадре.
const FN_1 = `fun startSession(cmd: StartSession) {
    if (cmd.options.preAuthorizeCard) {
        billing.preAuthorize(cmd.owner)
    }

    val connector = connectors.acquire(cmd.connector)
    val session = sessions.open(connector, cmd.owner)
    metering.start(session.id)
    charger.energize(connector.id)
    events.publish(SessionStarted(session.id))
}`;

// Балансировка стоит ДО energize: сначала выделяется допустимая мощность,
// потом ею настраивается зарядник, и только потом идёт ток.
const FN_2 = `fun startSession(cmd: StartSession) {
    if (cmd.options.preAuthorizeCard) {
        billing.preAuthorize(cmd.owner)
    }

    val connector = connectors.acquire(cmd.connector)
    val session = sessions.open(connector, cmd.owner)

    if (cmd.options.balanceLoad) {
        val limit = depotBalancer.allocate(connector)
        charger.setPowerLimit(connector.id, limit)
    }

    metering.start(session.id)
    charger.energize(connector.id)
    events.publish(SessionStarted(session.id))
}`;

const FN_3 = `fun startSession(cmd: StartSession) {
    if (cmd.options.preAuthorizeCard) {
        billing.preAuthorize(cmd.owner)
    }

    val connector = connectors.acquire(cmd.connector)
    val session = sessions.open(connector, cmd.owner)

    if (cmd.options.balanceLoad) {
        val limit = depotBalancer.allocate(connector)
        charger.setPowerLimit(connector.id, limit)
    }

    metering.start(session.id)
    charger.energize(connector.id)

    if (cmd.options.enforceTimeLimit) {
        scheduler.stopAfter(session.id, 4.hours)
    }

    events.publish(SessionStarted(session.id))
}`;

const doc = (...parts: string[]) => parts.join('\n\n');
// ⚠️ Тип настроек появляется ПОСЛЕДНИМ, вместе с обёртками, которые его строят
// (автор: «он же появляется потом логично, когда расширяются два верхних
// метода»). Сначала растёт только тело общей функции — сверху вниз, в уже
// отведённую под него часть кадра.
const DOC_0 = doc(W_FLEET_0, W_PUBLIC_0, FN_0);                   // 17 строк
const DOC_1 = doc(W_FLEET_0, W_PUBLIC_0, FN_1);                   // 21
const DOC_2 = doc(W_FLEET_0, W_PUBLIC_0, FN_2);                   // 27
const DOC_3 = doc(W_FLEET_0, W_PUBLIC_0, FN_3);                   // 32
const DOC_4 = doc(W_FLEET_1, W_PUBLIC_1, FN_3);                   // 45
const DOC_5 = doc(OPTIONS, W_FLEET_1, W_PUBLIC_1, FN_3);          // 51

const CODE_TYPES = [
  'StartSession', 'StartPublic', 'StartFleet', 'SessionStarted',
  'SessionOwner', 'SessionOptions', 'Driver', 'Vehicle', 'Boolean',
];
const CODE_RULES = [
  ...buildCanonRules({
    types: CODE_TYPES,
    methods: ['startSession', 'startPublicSession', 'startFleetSession'],
    vars: [
      'cmd', 'options', 'owner', 'connector', 'connectors', 'session',
      'sessions', 'metering', 'charger', 'events', 'billing', 'scheduler',
      'depotBalancer', 'limit', 'id', 'driver', 'vehicle',
      'preAuthorizeCard', 'balanceLoad', 'enforceTimeLimit',
    ],
  }),
  // Котлиновского `data` в общем словаре нет — токенайзер джавовый.
  {match: /^data$/, color: Canon.keyword},
];

// ⚠️ Кегль −20% против акта 1 (автор). Дело не во вкусе, а в геометрии: при
// 25 pt документ в 38 строк занимает 1130 px и не помещается в кадр НИ В КАКОЙ
// позиции. При 20 pt и функция целиком (22 строки), и шапка файла целиком
// (28 строк) влезают с запасом — поэтому вид за всю сцену едет ровно дважды.
const CODE_FS = 20;
const CODE_W = 850;                      // те же 62 знака при 20 pt
const CODE_X = -455;                     // левое поле там же, где в акте 1
const LH = CODE_FS * 1.5;                // 30

// ── ⚠️ ВИД НЕПОДВИЖЕН ВСЮ СЦЕНУ ───────────────────────────────────────────
// Ни одного скролла: ни за растущей функцией, ни к обёрткам в конце (автор:
// «зачем ты проскроллил к startPublicSession в конце, всё же умещалось на
// экране»). Это возможно ровно потому, что кегль опустили на 20%: документ в
// своём самом высоком состоянии — 32 строки, 950 px, — влезает в кадр целиком.
// Файл растёт СВЕРХУ ВНИЗ, как в редакторе: место под все будущие строки
// отведено с первого кадра, и ни одна написанная строка не съезжает.
//
// ⚠️⚠️ ВЫСОТА КАРТЫ ЗАДАЁТСЯ ЯВНО, И ЭТО НЕ КОСМЕТИКА. При height: 0 Manticore
// делает карту по РАЗМЕРУ СМОНТИРОВАННОГО кода (17 строк → «окно» 510 px), и
// morphTo на каждый изменённый блок зовёт ensureRangeVisible — БЕЗУСЛОВНО, мимо
// scrollStrategy, который управляет только хвостовым скроллом. Пока правки
// были чисто добавляющими, работала быстрая ветка морфа, которая этот вызов
// проскакивает, — потому первые такты и стояли смирно. Как только в правке
// появился modify (обёртки: в вызов дописывается запятая с options), морф пошёл по
// полной ветке и уехал на 90 px. Лечится тем, что окно Manticore приравнивается
// к настоящему кадру: тогда «сделать блок видимым» — всегда no-op.
const CODE_PAD_Y = 38;                   // getCodePaddingY(20)
const CLIP_H = Screen.height;            // окно = кадр, скроллить нечего
const CODE_H = CLIP_H + CODE_PAD_Y * 2;
// При height > 0 Manticore выравнивает текст ПО ВЕРХУ окна, а не по центру.
const START_Y = -CLIP_H / 2 + LH / 2;    // −525: первая строка у верхней кромки
const TOP_MARGIN = 75;                   // поле над первой строкой
const Y_VIEW = TOP_MARGIN - Screen.height / 2 - START_Y;   // 60

export default makeScene2D(function* (view) {
  applyBackground(view);

  // Всё содержимое живёт в одном узле — так его можно погасить целиком.
  const stage = new Node({});
  view.add(stage);

  const world = yield* buildChargingStage();

  // Камера стоит там, где её оставил акт 1: та же площадка, тот же ракурс.
  // За сцену она не двигается вовсе — акт про код, мир только отвечает.
  world.camDist(17.0);
  world.camEl(22 * Math.PI / 180);
  world.tgtX(0.62);
  world.tgtY(1.45);
  world.tgtZ(-1.2);
  world.lookOff(-5.6);

  // ── Свет стоек ───────────────────────────────────────────────────────────
  // Улица: индикатор горит ровным зелёным — станция свободна, сессию здесь
  // сейчас никто не открывает, акт про код.
  const streetLit = createSignal(0.55);
  // Депо: у КАЖДОЙ стойки своя доля. Общий бюджет площадки постоянен, поэтому
  // сумма долей держится равной единице — перераспределение видно как обмен
  // яркостью между стойками, а не как «стало ярче».
  const depotAmber = createSignal(0);
  const shares: SimpleSignal<number>[] = Array.from({length: 6}, () => createSignal(1 / 6));
  const setShares = (v: number[], dur: number) =>
    all(...shares.map((s, i) => s(v[i], dur, easeInOutCubic)));

  // ── Приборы мира ─────────────────────────────────────────────────────────
  // Каждая настройка отвечает У СВОЕГО объекта: резерв на карте и таймер — над
  // легковушкой, доля мощности — над КАЖДЫМ фургоном.
  //
  // ⚠️ ГЕОМЕТРИЯ. Плоскость прибора обязана принадлежать пространству сцены, а
  // не кадру. Первая версия разворачивала панели лицом к камере — и они не
  // принадлежали ничему: «нарушена геометрия и 3D-пространство» (автор). Все
  // панели теперь стоят в ОДНОЙ мировой плоскости — параллельно бортам машин:
  // легковушка и весь ряд депо развёрнуты на одни и те же −31°, и панели
  // берут ровно этот угол. Их рёбра совпадают с рёбрами кузовов, перспектива
  // сжимает их так же, как машины под ними. Это то, что делает панели частью
  // площадки, а не наклейками под своими углами (канон акта 1: наклон строки
  // совпадает с рёбрами стойки).
  //
  // ⚠️ ДОРОГО = слой с телом. Плоские контурные значки на прозрачной плоскости
  // читались дёшево. У панели теперь есть тело — тёмное стекло чуть темнее
  // фона, волосяная кромка по периметру, и содержимое — продуктовый UI:
  // табличные цифры, маска номера карты, замок как точный глиф, а не картинка.
  // Один набор на все три прибора — они один слой, а не три наклейки.
  const PANEL_ROT = world.car.rotation.y;          // = −31°, как у фургонов
  const INK = 'rgba(244, 238, 224, 0.95)';
  const INK_DIM = 'rgba(244, 238, 224, 0.46)';
  const EDGE = 'rgba(244, 238, 224, 0.30)';
  const GLASS = 'rgba(7, 9, 13, 0.60)';
  const AMBER = 'rgba(255, 168, 90, ';
  const HAIR = 4;

  const rr = (c: CanvasRenderingContext2D, x: number, y: number,
              w: number, h: number, r: number) => {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  };
  // Тело панели: стекло + кромка. Рисуется под содержимым каждого прибора.
  const panelBody = (c: CanvasRenderingContext2D, w: number, h: number) => {
    rr(c, HAIR, HAIR, w - HAIR * 2, h - HAIR * 2, 30);
    c.fillStyle = GLASS;
    c.fill();
    c.lineWidth = HAIR;
    c.strokeStyle = EDGE;
    c.stroke();
  };
  // Разрядка прописных — подпись прибора, не бейдж.
  const caps = (c: CanvasRenderingContext2D, text: string, x: number, y: number,
                size: number, track: number, fill: string) => {
    c.font = `600 ${size}px "JetBrains Mono", monospace`;
    c.fillStyle = fill;
    let cx = x;
    for (const ch of text) { c.fillText(ch, cx, y); cx += size * 0.62 + track; }
    return cx - track;
  };

  const carBox = new Box3().setFromObject(world.car);
  const carMid = carBox.getCenter(new Vector3());
  const CARD_Y = carBox.max.y + 0.66;

  // ── 1. Резерв на карте ───────────────────────────────────────────────────
  // preAuthorizeCard: перед зарядкой на карте временно блокируется сумма.
  // Маска номера, сумма табличными, замок. Ровно то, что произошло.
  const hold = mountWorldCard(world.scene3, {
    x: carMid.x, y: CARD_Y, z: carMid.z,
    planeW: 1.75, planeH: 0.72, rotationY: PANEL_ROT, px: 1024, py: 420,
  });
  const holdOp = createSignal(0);
  const holdBlur = createSignal(14);
  let holdKey = '';
  function drawHold() {
    const b = Math.round(holdBlur() * 4) / 4;
    const key = `${b}`;
    if (key === holdKey) return;
    holdKey = key;
    const c = hold.ctx;
    c.clearRect(0, 0, hold.width, hold.height);
    c.save();
    if (b > 0.05) c.filter = `blur(${b}px)`;
    panelBody(c, hold.width, hold.height);
    c.textBaseline = 'alphabetic';
    caps(c, 'CARD', 64, 128, 44, 8, INK_DIM);
    caps(c, '•••• 4021', 250, 128, 44, 4, INK_DIM);
    c.font = '600 150px "JetBrains Mono", monospace';
    c.fillStyle = INK;
    c.fillText('40.00', 60, 312);
    // Замок — точный глиф: дужка и корпус, волосяной линией. Справа, на месте
    // статуса, а не поверх суммы.
    c.strokeStyle = INK;
    c.lineWidth = HAIR + 2;
    rr(c, 832, 228, 96, 78, 12);
    c.stroke();
    c.beginPath();
    c.arc(880, 228, 30, Math.PI, 2 * Math.PI);
    c.stroke();
    caps(c, 'HOLD', 780, 356, 40, 6, INK_DIM);
    c.restore();
    hold.tex.needsUpdate = true;
  }

  // ── 2. Таймер ────────────────────────────────────────────────────────────
  // enforceTimeLimit: остановка ЭТОЙ сессии через четыре часа. Кольцо — полный
  // отпущенный запас; отсчитывать его будем в следующем акте.
  const timer = mountWorldCard(world.scene3, {
    x: carMid.x, y: CARD_Y, z: carMid.z,
    planeW: 1.75, planeH: 0.72, rotationY: PANEL_ROT, px: 1024, py: 420,
  });
  const timerOp = createSignal(0);
  const timerBlur = createSignal(14);
  let timerKey = '';
  function drawTimer() {
    const b = Math.round(timerBlur() * 4) / 4;
    const key = `${b}`;
    if (key === timerKey) return;
    timerKey = key;
    const c = timer.ctx;
    c.clearRect(0, 0, timer.width, timer.height);
    c.save();
    if (b > 0.05) c.filter = `blur(${b}px)`;
    panelBody(c, timer.width, timer.height);
    c.textBaseline = 'alphabetic';
    caps(c, 'SESSION LIMIT', 64, 128, 44, 8, INK_DIM);
    c.font = '600 150px "JetBrains Mono", monospace';
    c.fillStyle = INK;
    c.fillText('04:00', 60, 312);
    // Циферблат: полный круг запаса и засечка сверху.
    c.strokeStyle = INK_DIM;
    c.lineWidth = HAIR;
    c.beginPath();
    c.arc(866, 268, 74, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = INK;
    c.lineWidth = HAIR + 2;
    c.beginPath();
    c.moveTo(866, 194);
    c.lineTo(866, 222);
    c.stroke();
    c.restore();
    timer.tex.needsUpdate = true;
  }

  // ── 3. Доля мощности — над каждым фургоном ───────────────────────────────
  // balanceLoad: у площадки один предел (120 кВт), и он делится между шестью
  // фургонами. Над каждым — своя панель: полоса доли и её значение табличными.
  // Все шесть в одной плоскости, ряд вывесок над рядом машин; когда один
  // растёт, остальные ужимаются, и сумма чисел стоит на месте.
  const SITE_KW = 120;
  const vanPanels = world.vans.map(v => {
    const pos = world.depot.localToWorld(v.position.clone().add(new Vector3(0, 2.85, 0)));
    return mountWorldCard(world.sceneD, {
      x: pos.x, y: pos.y, z: pos.z,
      planeW: 2.6, planeH: 1.3, rotationY: PANEL_ROT, px: 1024, py: 512,
    });
  });
  const powerOp = createSignal(0);
  const powerBlur = createSignal(14);
  const powerKeys = vanPanels.map(() => '');
  function drawPower() {
    const b = Math.round(powerBlur() * 4) / 4;
    vanPanels.forEach((p, i) => {
      const share = Math.round(shares[i]() * 1000) / 1000;
      const key = `${b}|${share}`;
      if (key === powerKeys[i]) return;
      powerKeys[i] = key;
      const c = p.ctx;
      c.clearRect(0, 0, p.width, p.height);
      c.save();
      if (b > 0.05) c.filter = `blur(${b}px)`;
      panelBody(c, p.width, p.height);
      c.textBaseline = 'alphabetic';
      // Число — главное, оно занимает две трети панели; полоса под ним — доля
      // площадки, которую фургон МОГ БЫ взять целиком, и сколько выделено сейчас.
      c.font = '600 300px "JetBrains Mono", monospace';
      c.fillStyle = INK;
      const kw = String(Math.round(share * SITE_KW));
      c.fillText(kw, 64, 330);
      caps(c, 'kW', 64 + c.measureText(kw).width + 28, 330, 88, 4, INK_DIM);
      const TX = 64, TW = p.width - 128, TY = 392, TH = 56;
      c.lineWidth = HAIR;
      c.strokeStyle = 'rgba(244, 238, 224, 0.22)';
      rr(c, TX, TY, TW, TH, 10);
      c.stroke();
      // Полная дорожка = половина бюджета: одному фургону больше не отдают.
      const fillW = Math.max(0, Math.min(TW, TW * share / 0.5));
      if (fillW > 2) {
        c.fillStyle = AMBER + '0.88)';
        rr(c, TX, TY, fillW, TH, 10);
        c.fill();
      }
      c.restore();
      p.tex.needsUpdate = true;
    });
  }

  // ── Свет на асфальте ─────────────────────────────────────────────────────
  // Связь «эта ветка — вон та машина» держать одним расфокусом слабовато, и
  // автор попросил её усилить. Усиливает СВЕТ, а не графика: под объектом
  // своей ветки загорается тёплое пятно на земле — тем же тёплым, каким горит
  // живая стойка. Никаких пунктиров и рамок: рамка выделения — это UI
  // редактора, а площадка должна остаться местом.
  // Улице — одно пятно под машиной. Депо — по пятну под КАЖДЫМ фургоном.
  //
  // ⚠️ Доля мощности живёт на АСФАЛЬТЕ, а не на стойках (автор: «хочется больше
  // света на асфальте и не давать такой акцент на станции»). Причина не только
  // во вкусе: стойка депо в кадре ~60 px, её светодиодная полоса — четыре, и
  // разница долей в полтора раза там не читается вовсе. Пятно под фургоном —
  // это метры площадки, на них разница видна сразу, и перераспределение
  // балансировщика читается как свет, перетекающий по двору.
  const poolStreet = mountGroundPool(world.scene3, {
    x: carMid.x, z: carMid.z, size: 6.4,
    peak: 0.50, lightY: 0.55, lightRange: 7, lightPeak: 5,
  });
  const vanPools = world.vans.map(v => {
    const pos = world.depot.localToWorld(v.position.clone());
    return mountGroundPool(world.sceneD, {
      x: pos.x, z: pos.z, size: 6.6,
      peak: 0.86, lightY: 0.5, lightRange: 6, lightPeak: 4.0,
    });
  });
  const streetPool = createSignal(0);
  // Общая яркость пола депо и то, насколько её делит доля: в такте про
  // балансировку доля правит светом, в проходе по веткам двор освещён ровно.
  const depotFloor = createSignal(0);
  const depotShare = createSignal(1);
  // ⚠️ Доля → яркость НЕ пропорционально: у ровного дележа (1/6) уже должен
  // гореть свет, иначе такт про балансировку темнее, чем проход по веткам, —
  // а он ровно наоборот, главный по свету. Смещённая шкала даёт ровному дележу
  // половину яркости, а забравшему 0.42 — потолок: разница вдвое, видно сразу.
  const shareLevel = (v: number) => Math.min(1, 0.20 + v * 1.85);

  const paint = (mats: MeshStandardMaterial[], hue: number, level: number) => {
    for (const m of mats) {
      m.emissive.copy(POST_IDLE).lerp(POST_LIVE, hue);
      m.emissiveIntensity = level * 3.4;
    }
  };

  const frame = (r: WebGLRenderer, s: Scene) => {
    paint(world.postMats, 0, streetLit());
    // ⚠️ Стойка меняет ЦВЕТ, а не яркость: зелёный «свободна» → тёплый «идёт
    // сессия». Разницы в яркости почти нет (0.5 → 0.62) и доля её больше не
    // трогает — акцент ушёл на асфальт.
    world.depotPosts.forEach(p =>
      paint(p.mats, depotAmber(), depotAmber() * 0.62 + (1 - depotAmber()) * 0.5));
    poolStreet.set(streetPool());
    const df = depotFloor(), ds = depotShare();
    vanPools.forEach((p, i) => p.set(df * (ds * shareLevel(shares[i]()) + (1 - ds))));
    hold.mat.opacity = holdOp();
    timer.mat.opacity = timerOp();
    for (const p of vanPanels) p.mat.opacity = powerOp();
    drawHold();
    drawTimer();
    drawPower();
    world.frame(r, s);
  };

  // Депо рисуется ПОД улицей — у него свой расфокус и своя прозрачность.
  const depotView = createThreeView({
    width: Screen.width, height: Screen.height, scene: world.sceneD,
    camera: world.camera, onRender: r => frame(r, world.sceneD),
  });
  const depShot = depotView.node;
  const depBlur = blur(8);
  depShot.opacity(0);
  depShot.filters([depBlur]);
  stage.add(depShot);

  const mainView = createThreeView({
    width: Screen.width, height: Screen.height, scene: world.scene3,
    camera: world.camera, onRender: r => frame(r, world.scene3),
  });
  const shot = mainView.node;
  const mainBlur = blur(8);
  shot.opacity(0);
  shot.filters([mainBlur]);
  stage.add(shot);


  // ── Документ ─────────────────────────────────────────────────────────────
  const docWrap = new Node({opacity: 0});
  stage.add(docWrap);
  const code = Manticore.create(DOC_0, {
    x: CODE_X, y: Y_VIEW, width: CODE_W, height: CODE_H,
    fontSize: CODE_FS, theme: CanonCodeTheme,
    glowAccent: false, customTypes: CODE_TYPES,
    cardStyle: {fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)', radius: 0, edge: false},
    noClip: true,
  });
  code.mount(docWrap);
  code.colorize(CODE_RULES);
  paintCanonMethodCalls(code);
  code.node.opacity(1);

  // «Выключено» — приглушённая строка, как неактивный код в редакторе.
  const OFF = 0.24;

  // ⚠️⚠️ ЯРКОСТЬ ПРАВИТСЯ РОВНО НА ОДНОМ УРОВНЕ — на контейнере строки
  // (CodeLine.node === containerRef, туда же пишет setOpacity). Второй уровень —
  // токены (setTokenOpacityAt / setAllTokensOpacity). Применишь оба к одному
  // значению, и они перемножатся: 0.24 × 0.24 = 0.06, строка проваливается почти
  // в чёрное. Это и было «после сдвига код странно потемнел».
  //
  // Морф перенумеровывает строки, поэтому там, где яркость меняется ВМЕСТЕ с
  // правкой, держим сами объекты строк, а не их индексы.
  const grab = (from: number, to: number): CodeLine[] => {
    const out: CodeLine[] = [];
    for (let i = from; i <= to && i < code.lineCount; i++) out.push(code.getLine(i)!);
    return out;
  };
  function* fade(lines: CodeLine[], v: number, dur: number): ThreadGenerator {
    if (lines.length) yield* all(...lines.map(l => l.setOpacity(v, dur)));
  }
  function* setLines(from: number, to: number, v: number, dur = 0.5): ThreadGenerator {
    yield* fade(grab(from, to), v, dur);
  }

  // ⚠️ Скорость печати — ДВЕ, а не одна. Обычная стоит везде; быстрая (−30% по
  // времени) только в одном месте — заполнение тел двух обёрток, где печатается
  // сразу тринадцать строк и обычный темп затягивает (автор просил ускорить
  // ИМЕННО там, а не всю сцену).
  const TYPE = {charDelay: 0.013, lineDelay: 0.04};
  const TYPE_FAST = {charDelay: 0.009, lineDelay: 0.028};

  // ⚠️ recolorLine ОБЯЗАТЕЛЕН. Тема знает только роль «method» и красит её
  // цветом ОПРЕДЕЛЕНИЯ; роль «вызов» даёт пейнтер, и он отрабатывал только на
  // монтаже. Без хука каждая новая или переписанная строка приезжала с вызовом
  // цвета определения — отсюда и разнобой у startSession в обёртках.
  // `together` — правка идёт ОДНИМ жестом: сначала код расступается целиком
  // (settleBeforeType), потом все новые строки печатаются разом. Нужно там, где
  // вставка большая и в двух местах сразу: при последовательной печати
  // закрывающая скобка уже уехала на своё место, а строки между ней и
  // заголовком ещё не приехали — в теле стоит провал
  // ([[feedback_no_empty_reserved_space]]).
  function* edit(src: string, dur: number, speed = TYPE, together = false): ThreadGenerator {
    yield* code.morphTo(src, {
      addStyle: 'typewriter', charDelay: speed.charDelay, lineDelay: speed.lineDelay,
      moveDuration: dur, removeDuration: 0.3, scrollStrategy: 'block',
      lineOrder: together ? 'parallel' : 'sequential',
      blockOrder: together ? 'parallel' : 'sequential',
      settleBeforeType: together,
      recolorLine: paintCanonMethodCallsLine,
    });
  }

  // ── Внимание: улица или депо ─────────────────────────────────────────────
  // Де-эмфазис — расфокусом и прозрачностью, как в акте 1: половина, о которой
  // сейчас не говорят, не исчезает, а отступает.
  const FAR_OP = 0.42, FAR_BLUR = 5;
  function* look(at: 'street' | 'depot' | 'both', dur = 1.0): ThreadGenerator {
    const s = at === 'depot' ? FAR_OP : 1;
    const d = at === 'street' ? FAR_OP : 1;
    yield* all(
      shot.opacity(s, dur, easeInOutCubic),
      mainBlur.value(at === 'depot' ? FAR_BLUR : 0, dur, easeInOutCubic),
      depShot.opacity(d, dur, easeInOutCubic),
      depBlur.value(at === 'street' ? FAR_BLUR : 0, dur, easeInOutCubic),
    );
  }
  // ⚠️ Прибор живёт РОВНО СТОЛЬКО, сколько занимает его такт: приезжает под свой
  // блок кода и уходит, как только блок написан. В проходе по веткам приборов
  // уже нет — там светятся машины, а не значки над ними (автор).
  const showHold = (on: boolean, dur: number) =>
    all(holdOp(on ? 1 : 0, dur, easeInOutSine), holdBlur(on ? 0 : 14, dur, easeInOutSine));
  const showTimer = (on: boolean, dur: number) =>
    all(timerOp(on ? 1 : 0, dur, easeInOutSine), timerBlur(on ? 0 : 14, dur, easeInOutSine));
  const showPower = (on: boolean, dur: number) =>
    all(powerOp(on ? 1 : 0, dur, easeInOutSine), powerBlur(on ? 0 : 14, dur, easeInOutSine));

  // ═══ ТАЙМЛАЙН ═══════════════════════════════════════════════════════════

  // Такт 0. Открытие. Мягче и дольше прежнего: кадр не включается, а проявляется.
  yield* all(
    shot.opacity(1, 2.2, easeInOutCubic),
    depShot.opacity(FAR_OP, 2.2, easeInOutCubic),
    mainBlur.value(0, 2.2, easeInOutCubic),
    depBlur.value(FAR_BLUR, 2.2, easeInOutCubic),
    docWrap.opacity(1, 2.2, easeInOutCubic),
  );
  yield* waitFor(1.4);
  // Обёртки гаснут до «выключено»: они написаны и никуда не делись, но речь
  // сейчас не о них. Ни одна строка при этом не двигается.
  yield* setLines(0, 8, OFF, 0.9);
  yield* waitFor(0.8);

  // ── Такт 1. Улица: резерв на карте ───────────────────────────────────────
  // «Public charging gets its first rule. Before the car draws a single amp,
  //  the card has to be authorized.»
  yield* waitFor(2.4);
  yield* edit(DOC_1, 0.8);                  // функция 10..20
  yield* waitFor(0.4);
  yield* showHold(true, 0.8);
  yield* waitFor(2.6);
  yield* showHold(false, 0.7);

  // ── Такт 2. Депо: доля мощности ──────────────────────────────────────────
  // «The depot needs none of that — the vans are billed internally. What it
  //  does need is a share of the site power.»
  yield* look('depot', 1.2);
  yield* waitFor(2.2);
  yield* edit(DOC_2, 1.0);                  // функция 10..26
  yield* waitFor(0.4);
  yield* all(depotAmber(1, 1.0, easeOutCubic), showPower(true, 1.0),
    depotFloor(1, 1.0, easeInOutSine));
  yield* waitFor(0.6);
  // Подключается ещё один фургон — его доля растёт за счёт остальных, общий
  // бюджет площадки не меняется. Это и есть balanceLoad, показанный светом.
  yield* setShares([0.42, 0.116, 0.116, 0.116, 0.116, 0.116], 1.1);
  yield* waitFor(0.7);
  yield* setShares([0.22, 0.156, 0.156, 0.156, 0.156, 0.156], 1.0);
  yield* waitFor(1.4);
  yield* all(showPower(false, 0.7), depotFloor(0, 0.7, easeInOutSine));

  // ── Такт 3. Улица: лимит длительности ────────────────────────────────────
  // «And the street needs one more: stop after four hours, so nobody holds the
  //  connector all day. It arrives later than the others — so it gets a
  //  default, and nothing already written has to change.»
  yield* look('street', 1.2);
  yield* waitFor(2.4);
  yield* edit(DOC_3, 0.9);                  // функция 10..31 — окончательная
  yield* waitFor(0.4);
  yield* showTimer(true, 0.8);
  yield* waitFor(3.0);
  yield* showTimer(false, 0.7);

  // ── Такт 4. Чьё это правило ──────────────────────────────────────────────
  // «Every branch belongs to somebody. Two of them are the street. One is the
  //  depot. None of them is the function.»
  // Приборов здесь уже нет: они отработали каждый под своим блоком. Светятся
  // сами машины — и код, который к ним относится.
  const B_PREAUTH: [number, number] = [11, 13];
  const B_BALANCE: [number, number] = [18, 21];
  const B_LIMIT: [number, number] = [26, 28];
  const only = function* (ranges: [number, number][], dur = 0.6): ThreadGenerator {
    const on = new Set<number>();
    for (const [a, b] of ranges) for (let i = a; i <= b; i++) on.add(i);
    const anims: ThreadGenerator[] = [];
    for (let i = 10; i <= 31; i++) {
      anims.push(code.getLine(i)!.setOpacity(on.size === 0 || on.has(i) ? 1 : 0.3, dur));
    }
    yield* all(...anims);
  };
  yield* all(only([B_PREAUTH, B_LIMIT]), streetPool(1, 0.9, easeInOutSine));
  yield* waitFor(2.6);
  // Двор освещается РОВНО: такт не про доли, а про то, чья это ветка.
  depotShare(0);
  yield* all(
    only([B_BALANCE]),
    look('depot', 0.9),
    streetPool(0, 0.9, easeInOutSine),
    depotFloor(1, 0.9, easeInOutSine),
  );
  yield* waitFor(2.6);
  yield* all(only([]), look('both', 1.0), depotFloor(0, 0.9, easeInOutSine));
  yield* waitFor(1.6);

  // ── Такт 5. Вызывающие ───────────────────────────────────────────────────
  // «Every caller now has to spell out which rules its world wants.»
  // Ролями меняются: обёртки просыпаются, функция уходит в «выключено».
  // Ни одна из этих строк не двигается — двигаться будет только текст, который
  // приезжает внутрь обёрток.
  const fnLines = grab(10, 31);
  yield* all(setLines(0, 8, 1, 1.0), fade(fnLines, OFF, 1.0));
  yield* waitFor(1.0);
  // ⚠️ ЕДИНСТВЕННОЕ место с ускоренной печатью: тринадцать строк в двух телах.
  yield* edit(DOC_4, 1.1, TYPE_FAST, true);  // обёртки 0..21, функция 23..44
  yield* waitFor(3.2);

  // ── Такт 6. Тип ──────────────────────────────────────────────────────────
  // «The type they both fill in is one and the same. The limit is the only
  //  field with a default — because it arrived last.»
  // Тип появляется ТОГДА, когда он понадобился: обёртки уже его строят.
  // Класс 0..4, обёртка депо 6..15, обёртка улицы 17..27, функция 29..50.
  yield* edit(DOC_5, 1.0);
  yield* waitFor(4.2);
});
