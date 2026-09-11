import {makeScene2D, Node, Rect} from '@motion-canvas/2d';
import {
  all,
  chain,
  createSignal,
  easeInOutCubic,
  easeInOutSine,
  linear,
  spawn,
  ThreadGenerator,
  waitFor,
} from '@motion-canvas/core';
import {Box3, Color, MeshStandardMaterial, OrthographicCamera, PointLight, Scene, ShadowMaterial, Vector3, WebGLRenderer} from 'three';
import {createThreeView} from '../core/three/ThreeCanvas';
import {
  buildChargingStage, capsText, D2R, DEPOT_POS, mountGroundPool, mountWorldCard,
  PANEL, panelBody, POST_IDLE, POST_LIVE, roundRect,
} from '../core/three/chargingStage';
import {mountDepotNight} from '../core/three/depotNight';
import {Screen} from '../core/theme';
import {applyBackground} from '../core/utils';
import {Manticore} from '../core/code/components/Manticore';
import {
  buildCanonRules, Canon, CanonCodeTheme, paintCanonMethodCalls,
  paintCanonMethodCallsLine,
} from '../core/code/model/paletteCanon';

// ── DON'T FIGHT DUPLICATION · акт 3: инцидент ──────────────────────────────
// Сюжет (Dont_Fight_Duplication_final.pdf, акт 3, 2:20–3:00): одна правка,
// одно поле. «Someone decides the four-hour limit should apply everywhere. One
// boolean. It looks like consistency.» Депо ночью: в 23:00 фургоны подключены,
// в 03:00 останавливаются, в 06:30 водитель находит фургон на 41 проценте.
// Тишина, кадр держится. «The bug is one boolean. But it was born the day we
// decided two trajectories were one — because their snapshot matched.»
//
// ⚠️ Наше отличие от PDF — в нашу пользу. В сюжете депо держит СВОЙ набор опций
// (SessionOptions.depot()) и правят его. У нас факторок нет: обёртка депо просто
// НЕ ЗАДАЁТ enforceTimeLimit и живёт на дефолте класса. Значит правка акта —
// одно `false → true` в самом классе, а файл депо никто не открывал. Это и
// есть ловушка главы: депо сломалось, хотя депо никто не трогал.
//
// ── Режиссура ──────────────────────────────────────────────────────────────
// Сцена открывается РОВНО последним кадром акта 2 (класс сверху, обе обёртки,
// голова функции приглушена, обе половины мира в резкости) — стык невидим.
// Такт 1 — три целевые СТРОКИ одновременно под полоской: дефолт в классе,
//   `= true` в публичной обёртке, `val options = SessionOptions(` у депо — то
//   место, где третьего поля нет. Полоска — канон проекта (STRIPE_COLOR из
//   codeWithActionsSceneRu / fiveFacesSafety): роуз 0.18, на всю ширину блока,
//   высота 1.15 строки, углы ОСТРЫЕ (автор). ⚠️ Блок кода не хайлайтится
//   никогда — только строка (автор). Остальной код не гасится. Мир отвечает
//   теми же пятнами на асфальте, что и в акте 2. Это фитиль, а не иллюстрация.
// Такт 2 — правка. Один токен: `false` стирается, печатается `true`. Никакого
//   комментария в коде: «One boolean» в озвучке должно совпасть ровно с одним
//   меняющимся словом на экране.
// Такт 3 — ночь. Код уходит, улица уходит, камера ОДИН раз едет к депо, свет
//   садится по дороге — «позже, там». На подъезде из темноты и тумана
//   проявляется место: фонари двора, силуэты складов с редкими окнами, кроны
//   деревьев, мокрый асфальт, дождь в конусах фонарей (depotNight.ts). Кольца
//   шести стоек и пятна под фургонами — тёплый свет во дворе; в 03:00 они
//   гаснут по одному. Дождь тихий, фоном: он не спорит с кольцами.
// Такт 4 — рассвет и число. Свет чуть поднимается, над одним фургоном
//   появляется 41 %. Это не счётчик и не дашборд: число появляется один раз,
//   как то, что увидел водитель.
// Такт 5 — тишина и вывод. Кадр держится, ничего не движется.
//
// ⚠️ Камера едет ОДИН раз за сцену, и у переезда есть причина: история уходит
// из кода во двор. Всё остальное время вид стоит ([[feedback_lock_the_camera]]).

// ── Код ─────────────────────────────────────────────────────────────────────
// ⚠️ Строки ниже — ТОЧНАЯ копия состояния DOC_5 из duplicationDivergeSceneEn:
// акт 3 обязан открыться тем же документом, которым кончился акт 2. Совпадение
// проверяется скриптом (check_inc.mjs), а не глазами. Акт 2 принят и не
// трогается; объединение констант в общий модуль — вместе с миграцией акта 1.
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
const OPTIONS = `data class SessionOptions(
    val preAuthorizeCard: Boolean,
    val balanceLoad: Boolean,
    val enforceTimeLimit: Boolean = false,
)`;
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

// Правка акта: ОДНО поле. Ни комментария, ни второй строки — «one boolean».
// Хвостовая запятая после смены уходит (автор): в кадре остаётся чистое `= true`.
const OPTIONS_FLIPPED = OPTIONS.replace('= false,', '= true');

const doc = (...parts: string[]) => parts.join('\n\n');
const DOC_5 = doc(OPTIONS, W_FLEET_1, W_PUBLIC_1, FN_3);          // 51 строка, как в акте 2
const DOC_6 = doc(OPTIONS_FLIPPED, W_FLEET_1, W_PUBLIC_1, FN_3);  // то же, дефолт true

// Индексы в DOC_5 (проверены скриптом): класс 0..4, обёртка депо 6..15,
// обёртка улицы 17..27, функция 29..50.
const L_DEFAULT = 3;                     // val enforceTimeLimit: Boolean = false,
const L_DEPOT_OPTS = 9;                  // val options = SessionOptions(  — у депо
const L_PUBLIC_ON = 23;                  // enforceTimeLimit = true,
const FN: [number, number] = [29, 50];

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
  {match: /^data$/, color: Canon.keyword},
];

// ── Геометрия — та же, что в акте 2, до пикселя ───────────────────────────
const CODE_FS = 20;
const CODE_W = 850;
const CODE_X = -455;
const LH = CODE_FS * 1.5;
const CODE_PAD_Y = 38;                   // getCodePaddingY(20)
const CLIP_H = Screen.height;            // окно = кадр: морф не скроллит сам
const CODE_H = CLIP_H + CODE_PAD_Y * 2;
const START_Y = -CLIP_H / 2 + LH / 2;
const TOP_MARGIN = 75;
const Y_VIEW = TOP_MARGIN - Screen.height / 2 - START_Y;   // 60

// ── Камера ночного двора ───────────────────────────────────────────────────
// Единственный переезд сцены. Депо целиком, чуть ниже центра — шесть колец и
// шесть пятен обязаны быть в кадре все: на них держится «гаснут по одному».
// dist 20 / el 22°: при 17.5 передний ряд резало левой и нижней кромкой, а с
// более низкой точки фургоны закрывали кольца и пятна.
// ⚠️ Значения — из солвера (scratchpad/center_depot.mjs): габариты шести фургонов
// и шести стоек проецируются через ту же камеру, и ищется положение, при котором
// bbox двора стоит в центре кадра (961, 543) при ширине 73% и высоте 57%. На
// глаз ставил (20 / 22° / y 1.0 / off 0) — двор уходил влево-вниз на 110×160 px.
const NIGHT_CAM = {
  dist: 21.0, el: 20 * D2R,
  x: DEPOT_POS.x + 0.4, y: -0.5, z: DEPOT_POS.z - 0.6, off: -1.1,
};
// Фургон, у которого водитель утром увидит 41 %. Индекс — по раскладке депо.
const DRIVER_VAN = 2;
const SOC = 41;

export default makeScene2D(function* (view) {
  applyBackground(view);
  const stage = new Node({});
  view.add(stage);

  const world = yield* buildChargingStage();

  // Ровно финальные значения акта 2: тот же кадр, стык невидим.
  world.camDist(17.0);
  world.camEl(22 * D2R);
  world.tgtX(0.62);
  world.tgtY(1.45);
  world.tgtZ(-1.2);
  world.lookOff(-5.6);

  // ── Свет ─────────────────────────────────────────────────────────────────
  const night = createSignal(0);           // 0 день → 1 ночь
  const dawn = createSignal(0);            // 0 → 1 предрассветный подъём
  const STREET_LIT = 0.55;                 // улица: ровный зелёный, как в акте 2
  // Кольцо каждой стойки депо и пятно под каждым фургоном — по своему сигналу:
  // гаснуть им предстоит по одному.
  const rings = Array.from({length: 6}, () => createSignal(0));
  const pools = Array.from({length: 6}, () => createSignal(0));
  const streetPool = createSignal(0);

  const PANEL_ROT = world.car.rotation.y;
  const carBox = new Box3().setFromObject(world.car);
  const carMid = carBox.getCenter(new Vector3());

  // Пятна — те же, что в акте 2: тот же инструмент, та же площадка.
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

  // ── Ночное окружение двора ───────────────────────────────────────────────
  // Базис «от камеры» считается по ночной камере: здания встают за двором.
  const nightCamPos = (() => {
    const t = new Vector3(NIGHT_CAM.x, NIGHT_CAM.y, NIGHT_CAM.z);
    const ce = Math.cos(NIGHT_CAM.el);
    return new Vector3(
      t.x + Math.sin(world.camAz) * ce * NIGHT_CAM.dist,
      t.y + Math.sin(NIGHT_CAM.el) * NIGHT_CAM.dist,
      t.z + Math.cos(world.camAz) * ce * NIGHT_CAM.dist,
    );
  })();
  const city = mountDepotNight(world.sceneD, world.depot, {
    toCamera: nightCamPos.clone().sub(DEPOT_POS).setY(0).normalize(),
  });
  // Свет кольца: маленький тёплый источник у разъёма каждой стойки. Кольцо
  // светит на морду фургона и на землю между ними — свет привязан к телу, а не
  // «странная подсветка под машиной» (пятна под фургонами ночью автор снял).
  const ringLights = world.depotPosts.map((post, i) => {
    const row = (i / 3) | 0;
    const local = post.node.position.clone().add(new Vector3(0, 1.0, row ? 0.5 : -0.5));
    const wp = world.depot.localToWorld(local);
    const l = new PointLight(POST_LIVE, 0, 3.6, 2);
    l.position.copy(wp);
    world.sceneD.add(l);
    return l;
  });
  const RING_LIGHT_I = 2.8;
  const envIn = createSignal(0);           // проявление окружения
  const rainStr = createSignal(0);         // сила дождя
  const clock = createSignal(0);           // секунды сцены — для дождя
  spawn(clock(600, 600, linear));
  const FOG_NIGHT = new Color(0x0b0d13), FOG_DAWN = new Color(0x4a5568);
  const fogColor = new Color();

  // ── Заряд над фургоном водителя ──────────────────────────────────────────
  // Та же панель, что показывала кВт в акте 2, — теперь проценты. Появляется
  // ОДИН раз, на рассвете: это не показание прибора всю ночь, а то, что увидел
  // водитель. Счётчиков, бегущих по ночи, здесь нет намеренно.
  const socPos = world.depot.localToWorld(
    world.vans[DRIVER_VAN].position.clone().add(new Vector3(0, 2.85, 0)));
  const soc = mountWorldCard(world.sceneD, {
    x: socPos.x, y: socPos.y, z: socPos.z,
    planeW: 2.6, planeH: 1.3, rotationY: PANEL_ROT, px: 1024, py: 512,
  });
  const socOp = createSignal(0);
  const socBlur = createSignal(14);
  let socKey = '';
  function drawSoc() {
    const b = Math.round(socBlur() * 4) / 4;
    const key = `${b}`;
    if (key === socKey) return;
    socKey = key;
    const c = soc.ctx;
    c.clearRect(0, 0, soc.width, soc.height);
    c.save();
    if (b > 0.05) c.filter = `blur(${b}px)`;
    panelBody(c, soc.width, soc.height);
    c.textBaseline = 'alphabetic';
    c.font = '600 300px "JetBrains Mono", monospace';
    c.fillStyle = PANEL.ink;
    const v = String(SOC);
    c.fillText(v, 64, 330);
    capsText(c, '%', 64 + c.measureText(v).width + 28, 330, 88, 4, PANEL.inkDim);
    // Полоса заряда: полная дорожка — 100 %.
    const TX = 64, TW = soc.width - 128, TY = 392, TH = 56;
    c.lineWidth = PANEL.hair;
    c.strokeStyle = 'rgba(244, 238, 224, 0.22)';
    roundRect(c, TX, TY, TW, TH, 10);
    c.stroke();
    c.fillStyle = PANEL.amber + '0.88)';
    roundRect(c, TX, TY, TW * SOC / 100, TH, 10);
    c.fill();
    c.restore();
    soc.tex.needsUpdate = true;
  }

  const paint = (mats: MeshStandardMaterial[], hue: number, level: number) => {
    for (const m of mats) {
      m.emissive.copy(POST_IDLE).lerp(POST_LIVE, hue);
      m.emissiveIntensity = level * 3.4;
    }
  };

  // Ночь: ключевой свет уходит совсем, окружение почти гаснет, небо синеет и
  // темнеет, контровой остаётся холодным ободком. Единственный тёплый свет во
  // дворе — кольца стоек и пятна под фургонами. Рассвет — не солнце, а подъём
  // холодного рассеянного: ещё не утро, уже не ночь.
  const HEMI_DAY = new Color(0xa8c4ff), HEMI_NIGHT = new Color(0x2e3d63);
  const HEMI_MORNING = new Color(0xbfd3f2);
  const GROUND_DAY = new Color(0x141a26), GROUND_NIGHT = new Color(0x04060a);
  const GROUND_MORNING = new Color(0x2a2c30);
  const RIM_DAY = new Color(0x9ec0ff), RIM_NIGHT = new Color(0x7a93c8);
  const KEY_DAY = new Color(0xfff2e0), SUN = new Color(0xffc48c);
  // Утро — это солнце: низкий тёплый ключевой свет сбоку, длинные тени, небо
  // светлеет, туман редеет, дождь кончается, окна гаснут, фонари выключаются.
  // Положение ключа днём — из chargingStage; на рассвете он уходит вниз и вбок.
  const KEY_POS_DAY = world.lightsD.key.position.clone();
  const KEY_POS_SUN = DEPOT_POS.clone().add(new Vector3(-20, 4.5, 9));
  const RING_NIGHT = 1.15;                 // уровень кольца, когда оно — весь свет

  const frame = (r: WebGLRenderer, s: Scene) => {
    const n = night(), d = dawn();
    paint(world.postMats, 0, STREET_LIT);
    // Днём — тёплый ровный 0.62, как кончился акт 2; ночью — свет кольца.
    world.depotPosts.forEach((p, i) =>
      paint(p.mats, 1, (1 - n) * 0.62 + n * rings[i]() * RING_NIGHT));
    poolStreet.set(streetPool());
    vanPools.forEach((p, i) => p.set(pools[i]()));
    ringLights.forEach((l, i) => { l.intensity = rings[i]() * RING_LIGHT_I; });

    const L = world.lightsD, DAY = world.DAY;
    // Ночь: ключ гаснет, рассеянный 0.15 (при 0.09 после 03:00 фургоны
    // пропадали), контровой чуть сильнее — силуэты держатся.
    L.key.intensity = DAY.key * (1 - n) + d * 2.2;      // низкое солнце — главный свет утра
    L.key.color.copy(KEY_DAY).lerp(SUN, d);
    L.key.position.copy(KEY_POS_DAY).lerp(KEY_POS_SUN, d);
    L.rim.intensity = DAY.rim * (1 - n) + n * 0.38 + d * 0.2;
    L.rim.color.copy(RIM_DAY).lerp(RIM_NIGHT, n);
    L.hemi.intensity = DAY.hemi * (1 - n) + n * 0.12 + d * 0.22;
    L.hemi.color.copy(HEMI_DAY).lerp(HEMI_NIGHT, n).lerp(HEMI_MORNING, d);
    L.hemi.groundColor.copy(GROUND_DAY).lerp(GROUND_NIGHT, n).lerp(GROUND_MORNING, d);
    (world.sceneD as any).environmentIntensity = DAY.env * (1 - n) + n * 0.16 + d * 0.28;
    // ⚠️ ShadowMaterial не следит за светом: без этого под фургонами ночью
    // висела дневная тень и «дёргалась», когда её накрывал асфальт.
    (world.catcherD.material as ShadowMaterial).opacity = 0.4 * Math.min(1, L.key.intensity / DAY.key);

    soc.mat.opacity = socOp();
    drawSoc();

    // Окружение: проявляется по envIn, туман — по ночи, фонари — по envIn.
    const e = envIn();
    city.setReveal(e);
    fogColor.copy(FOG_NIGHT).lerp(FOG_DAWN, d);
    city.setFog(n * e * (1 - 0.7 * d), fogColor);    // утром туман редеет
    city.setLamps(e * (1 - d));                        // фонари выключаются
    city.setWindows(1 - d);                            // окна гаснут
    city.setRain(clock(), rainStr());
    world.frame(r, s);
  };

  // Ночью фон обязан быть темнее дневного графита: вуаль под миром.
  const nightVeil = new Rect({
    width: Screen.width, height: Screen.height, fill: '#090b0f', opacity: 0,
  });
  stage.add(nightVeil);

  // Депо под улицей, как в акте 2. Обе половины в резкости — так кончился акт 2.
  const depotView = createThreeView({
    width: Screen.width, height: Screen.height, scene: world.sceneD,
    camera: world.camera, onRender: r => frame(r, world.sceneD),
  });
  const depShot = depotView.node;
  stage.add(depShot);

  const mainView = createThreeView({
    width: Screen.width, height: Screen.height, scene: world.scene3,
    camera: world.camera, onRender: r => frame(r, world.scene3),
  });
  const shot = mainView.node;
  stage.add(shot);

  // ── Документ — последний кадр акта 2 ─────────────────────────────────────
  const docWrap = new Node({});
  stage.add(docWrap);
  const plateLayer = new Node({});          // под кодом: добавлен ДО mount()
  docWrap.add(plateLayer);
  const code = Manticore.create(DOC_5, {
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
  // Функция «выключена» — ровно так она стояла в конце акта 2.
  const OFF = 0.24;
  for (let i = FN[0]; i <= FN[1]; i++) code.getLine(i)!.node.opacity(OFF);

  // ── Полоска под целевой строкой ──────────────────────────────────────────
  // Канон проекта: STRIPE_COLOR роуз 0.18, ширина блока, высота 1.15 строки.
  // Углы острые — по просьбе автора. Слой лежит ПОД кодом (добавлен раньше
  // контейнера Manticore); документ в этой сцене не скроллит, поэтому y строки
  // считается один раз.
  const STRIPE_COLOR = 'rgba(255, 80, 120, 0.18)';
  const STRIPE_H = LH * 1.15;
  const STRIPE_PAD = 10;
  const MARK_IN = 0.42;
  const ADV = CODE_FS * 0.605;           // ширина знака моноширинного
  const ROWS = DOC_5.split('\n');
  // Полоска по ДЛИНЕ СТРОКИ (от первого непробельного знака до последнего) —
  // на всю ширину блока она была необоснованно длинной (автор).
  const stripe = (line: number): Rect => {
    const t = ROWS[line];
    const c0 = t.length - t.trimStart().length, c1 = t.length;
    const r = new Rect({
      x: CODE_X + code.getLeftEdge() + c0 * ADV - STRIPE_PAD,
      y: Y_VIEW + code.getLineY(line),
      offset: [-1, 0],
      width: (c1 - c0) * ADV + STRIPE_PAD * 2, height: STRIPE_H,
      radius: 0, fill: STRIPE_COLOR, opacity: 0,
    });
    plateLayer.add(r);
    return r;
  };
  const stripes = [stripe(L_DEFAULT), stripe(L_PUBLIC_ON), stripe(L_DEPOT_OPTS)];
  // Гашение шапки (класс + обёртки, 0..27) вокруг одной строки. Функция ниже
  // и так «выключена». Яркость — на контейнере строки, и только на нём.
  const HEAD_LAST = 27;
  const DIM = 0.3;
  function* spot(keep: number | null, dur: number): ThreadGenerator {
    const anims: ThreadGenerator[] = [];
    for (let i = 0; i <= HEAD_LAST; i++) {
      anims.push(code.getLine(i)!.setOpacity(keep === null || i === keep ? 1 : DIM, dur));
    }
    yield* all(...anims);
  }
  const marks = (v: number) => all(...stripes.map(r => r.opacity(v, MARK_IN, easeInOutSine)));

  // Правка: ОДИН токен. `false` стирается обратной печатью, `true` печатается.
  // Замена обязана анимироваться, а не подменяться кадром; окно Manticore равно
  // кадру, поэтому морф ничего не скроллит.
  function* flip(): ThreadGenerator {
    yield* code.morphTo(DOC_6, {
      addStyle: 'typewriter', charDelay: 0.013, lineDelay: 0.04,
      moveDuration: 0.6, removeDuration: 0.3, scrollStrategy: 'block',
      lineOrder: 'sequential', blockOrder: 'sequential',
      tokenSlideDuration: 0.4,
      flashRemovedErase: 'reverseType', flashRemovedEraseCharDelay: 0.011,
      flashRemovedColor: 'rgba(244,241,235,0.32)',
      recolorLine: paintCanonMethodCallsLine,
    });
  }

  const showSoc = (on: boolean, dur: number) =>
    all(socOp(on ? 1 : 0, dur, easeInOutSine), socBlur(on ? 0 : 14, dur, easeInOutSine));

  // ═══ ТАЙМЛАЙН ═══════════════════════════════════════════════════════════

  // Такт 1. Фитиль. Три маркера и оба света на асфальте — ОДНИМ жестом.
  // «The time limit is off by default, so we explicitly turn it on for public
  //  charging. The depot just inherits the default.»
  yield* waitFor(1.0);
  yield* all(
    marks(1),
    streetPool(1, 0.8, easeInOutSine),
    ...pools.map(p => p(1, 0.8, easeInOutSine)),
  );
  yield* waitFor(6.0);

  // Такт 2. Правка — ОТДЕЛЬНО, и не полоской, а гашением остального кода
  // (автор: «булеан лучше понижением опасити другого кода»). Полоски были
  // хвостом озвучки акта 2 — все три уходят вместе со светом на асфальте, и в
  // шапке остаётся яркой одна строка: дефолт в классе.
  // «Someone decides the four-hour limit should apply everywhere.»
  yield* all(
    marks(0),
    streetPool(0, 0.8, easeInOutSine),
    ...pools.map(p => p(0, 0.8, easeInOutSine)),
    spot(L_DEFAULT, 0.8),
  );
  yield* waitFor(2.8);
  // «One boolean.»
  yield* flip();
  // «It looks like consistency.»
  yield* waitFor(2.6);
  yield* spot(null, 0.8);
  yield* waitFor(1.5);

  // Такт 3. Ночь. Код и улица уходят, камера один раз едет ко двору, свет
  // садится по дороге. Кольца и пятна зажигаются, когда двор уже тёмный.
  // «At 23:00 the vans are plugged in.»
  // ⚠️ Сначала ТОЛЬКО камера — ни гаммы, ни света, ни пола (автор: «фон
  // меняется при передвижении камеры и это даёт лаги; сначала просто камера
  // пусть приблизится — потом всё остальное»). Код и улица уходят — это
  // 2D-слои, не мир.
  yield* all(
    docWrap.opacity(0, 1.6, easeInOutCubic),
    shot.opacity(0, 2.0, easeInOutCubic),
    world.camDist(NIGHT_CAM.dist, 3.6, easeInOutCubic),
    world.camEl(NIGHT_CAM.el, 3.6, easeInOutCubic),
    world.tgtX(NIGHT_CAM.x, 3.6, easeInOutCubic),
    world.tgtY(NIGHT_CAM.y, 3.6, easeInOutCubic),
    world.tgtZ(NIGHT_CAM.z, 3.6, easeInOutCubic),
    world.lookOff(NIGHT_CAM.off, 3.6, easeInOutCubic),
  );
  // Камера встала, кадр устоялся — и СКЛЕЙКА. Ночь приходит одним кадром, как
  // монтажный стык «позже, той же ночью»: свет, вуаль, место, кольца и дождь —
  // мгновенно. Плавный вход автор снял: «сделай мгновенный переход между
  // графитом и ночью с дождём». Фургоны стоят там же — это и делает стык
  // прыжком во времени, а не сменой места.
  yield* waitFor(0.6);
  night(1);
  nightVeil.opacity(0.85);
  envIn(1);
  rainStr(1);
  rings.forEach(r => r(1));
  yield* waitFor(3.4);

  // Пока темно и теней нет — расширить матрицу тени ключевого света под
  // низкое солнце: утром тени деревьев и складов должны лечь на весь двор
  // (дневная матрица ±12 м обрезала бы их у деревьев на 14–27 м).
  {
    const sc = world.lightsD.key.shadow.camera as OrthographicCamera;
    sc.left = -52; sc.right = 52; sc.top = 52; sc.bottom = -52; sc.near = 1; sc.far = 160;
    sc.updateProjectionMatrix();
    world.lightsD.key.shadow.needsUpdate = true;
  }

  // «At 03:00 they stop.» — по одному. Кольцо и пятно под тем же фургоном
  // уходят вместе: это одна стойка, один фургон.
  yield* waitFor(1.2);
  for (let i = 0; i < 6; i++) {
    spawn(rings[i](0, 0.4, easeInOutSine));
    yield* waitFor(0.45);
  }
  yield* waitFor(3.0);

  // Такт 4. Рассвет и число.
  // «At 06:30 a driver finds a van at 41 percent — and a route that needs eighty.»
  yield* all(
    dawn(1, 3.6, easeInOutSine),
    rainStr(0, 3.0, easeInOutSine),
    nightVeil.opacity(0.22, 3.6, easeInOutSine),
  );
  yield* showSoc(true, 0.9);
  yield* waitFor(4.5);

  // Такт 5. Тишина. Потом вывод — кадр не движется.
  // «The bug is one boolean. But it was born the day we decided two trajectories
  //  were one — because their snapshot matched. The duplication disappeared. The
  //  reasons to change did not.»
  yield* waitFor(3.0);
  yield* waitFor(12.0);
  yield* waitFor(1.5);
  yield* stage.opacity(0, 1.5, easeInOutCubic);
});
