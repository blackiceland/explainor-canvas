import {blur, makeScene2D, Node, Rect} from '@motion-canvas/2d';
import {
  all,
  createSignal,
  easeInOutCubic,
  easeInOutSine,
  easeOutCubic,
  linear,
  spawn,
  ThreadGenerator,
  useTime,
  waitFor,
} from '@motion-canvas/core';
import {Box3, MeshStandardMaterial, Scene, Vector3, WebGLRenderer} from 'three';
import {createThreeView} from '../core/three/ThreeCanvas';
import {buildChargingStage, D2R, mountWorldCard, PANEL, panelBody, POST_IDLE, roundRect} from '../core/three/chargingStage';
import {Screen} from '../core/theme';
import {applyBackground} from '../core/utils';
import {Manticore} from '../core/code/components/Manticore';
import {
  buildCanonRules, Canon, CanonCodeTheme, paintCanonMethodCalls,
  paintCanonMethodCallsLine,
} from '../core/code/model/paletteCanon';

// ── DON'T FIGHT DUPLICATION · глава 2 (SYNC COST): ложная независимость ─────
// Сюжет: Dont_Fight_Duplication_final.pdf, акт 5. Идёт сразу после POV под
// дождём (duplicationStreetPovSceneEn) и объясняет его: почему приложение
// сказало «Available», а нажатие кончилось «Connector unavailable».
//
// Правило «можно ли начать зарядку на этом разъёме» живёт в ДВУХ местах, и
// ничего здесь не выглядит дублированным: API приложения считает флаг
// (`status != CHARGING`), обработчик команды проверяет список (`in AVAILABLE,
// FINISHING`). На трёх статусах это одно и то же множество. Их держали порознь,
// как учила вставка с парами, — и зря: они отвечают на ОДИН вопрос.
// Ломается разъём, в enum добавляют OUT_OF_ORDER, больше ничего не меняют.
// Обработчик новый статус отвергает (его нет в списке), приложение пропускает
// (он не CHARGING) — и система говорит две вещи сразу.
//
// ⚠️ ЧЕРНОВИК ДЛЯ ПРОСМОТРА (27.09, автор: «сцену сначала собери, я должен
// понять, как она будет выглядеть»). Озвучки нет, такты стоят на глаз и
// переставляются по записи. Исправление (одно решение canStart — акт 6) —
// следующая сцена, она продолжит этот кадр.
//
// ── Режиссура ──────────────────────────────────────────────────────────────
// Язык актов 1–3: код слева одним документом, мир справа отвечает на строки
// ПРАВДИВЫМИ состояниями ([[feedback_world_state_chain]]), вид не двигается.
//   • Мир — та же улица: стойка и Honda e (chargingStage), только ближе; депо в
//     главе 2 ни при чём, его вьюпорта нет.
//   • Три файла стоят напротив своих объектов: API приложения сверху — напротив
//     карточки приложения над машиной; enum статусов снизу — напротив стойки.
//   • Карточка приложения — тот же экран, что был в POV («Mill Street»,
//     «● Available», зелёная «Start charging», лист «Connector unavailable»),
//     собранный на панели мира: тёмное стекло + волосяная кромка, плоскость
//     −31° — как все приборы главы 1, не билборд.
//   • Стойка отвечает индикатором: зелёный «свободна» → тёмная «сломана».
//     Сначала ломается мир, потом код догоняет его новой строкой.
//   • Выделение — канон: полоска роуз 0.18 на строке и гашение остального.

// ── Код: три файла одним документом ────────────────────────────────────────
// Пакеты разные — это три места. Файл статусов СНИЗУ: его новая строка
// толкает вниз только собственную скобку, выше ничего не едет.
const APP = `package api.mobile

fun toDto(connector: Connector): ConnectorDto {
    return ConnectorDto(
        id = connector.id,
        available = connector.status != CHARGING,
    )
}`;
const HANDLER = `package commands

fun handle(cmd: StartSession) {
    val connector = connectors.byId(cmd.connector)

    if (connector.status !in listOf(AVAILABLE, FINISHING)) {
        throw ConnectorUnavailable(connector.id)
    }

    startSession(cmd)
}`;
const STATUS = `package connectors

enum class ConnectorStatus {
    AVAILABLE,
    CHARGING,
    FINISHING,
}`;
const STATUS_BROKEN = STATUS.replace('    FINISHING,\n}', '    FINISHING,\n    OUT_OF_ORDER,\n}');
const doc = (...files: string[]) => files.join('\n\n\n');        // две пустые строки между файлами
const DOC_0 = doc(APP, HANDLER, STATUS);
const DOC_1 = doc(APP, HANDLER, STATUS_BROKEN);

// Индексы строк — поиском по тексту, а не на глаз.
const ROWS = DOC_1.split('\n');
const lineOf = (needle: string): number => {
  const i = ROWS.findIndex(r => r.includes(needle));
  if (i < 0) throw new Error(`нет строки: ${needle}`);
  return i;
};
const span = (from: number, count: number) => Array.from({length: count}, (_, k) => from + k);
const APP_LINES = span(0, APP.split('\n').length);
const HANDLER_LINES = span(lineOf('package commands'), HANDLER.split('\n').length);
const STATUS_LINES = span(lineOf('package connectors'), STATUS_BROKEN.split('\n').length);
const L_AVAILABLE = lineOf('available = connector.status');
const L_GUARD = lineOf('!in listOf');
const L_THROW = lineOf('throw ConnectorUnavailable');
const L_BROKEN = lineOf('OUT_OF_ORDER');

const CODE_TYPES = [
  'Connector', 'ConnectorDto', 'StartSession', 'ConnectorStatus', 'ConnectorUnavailable',
];
const CODE_RULES = [
  ...buildCanonRules({
    types: CODE_TYPES,
    methods: ['toDto', 'handle'],
    vars: ['connector', 'connectors', 'cmd', 'id', 'status', 'available', 'api', 'mobile', 'commands'],
  }),
  {match: /^enum$/, color: Canon.keyword},
];

// ── Геометрия кода — как в актах 2–3 ──────────────────────────────────────
// Кегль 20 и колонка 850 — те же, что в главе 1: код и мир делят кадр так же.
// Вид НЕПОДВИЖЕН: документ в своём самом высоком состоянии (с OUT_OF_ORDER,
// 31 строка) стоит по центру кадра с первого кадра.
const CODE_FS = 20;
const CODE_W = 850;
const CODE_X = -455;
const LH = CODE_FS * 1.5;
const CODE_PAD_Y = 38;                   // getCodePaddingY(20)
const CLIP_H = Screen.height;            // окно = кадр: морф не скроллит сам
const CODE_H = CLIP_H + CODE_PAD_Y * 2;
const START_Y = -CLIP_H / 2 + LH / 2;
const TOP_MARGIN = (Screen.height - ROWS.length * LH) / 2;
const Y_VIEW = TOP_MARGIN - Screen.height / 2 - START_Y;

// ── Камера мира ────────────────────────────────────────────────────────────
// Ближе, чем в главе 1: в кадре только улица. Числа — из солвера
// (scratchpad/ch2/frame_solve5.mjs повторяет orbit/lookAt/fov chargingStage):
// карточка над машиной не наезжает на крышу, стойка целиком правее кода,
// группа по вертикали в центре. Корма машины уходит за правую кромку.
const CAM = {el: 14 * D2R, dist: 9.5, x: -0.70, y: 1.22, z: 0.325, off: -2.5};
// Карточка приложения: над машиной, в плоскости −31°, чуть к стойке.
const CARD_W = 2.4, CARD_H = 1.4, CARD_LIFT = 0.45, CARD_SHIFT = -0.6;

const APP_UI = {
  text: '#F3F5F7', muted: '#8B94A1', green: '#4ADE80', greenInk: '#06140B',
  sheet: '#171C24', red: '#FF6B6B',
};
const APP_FONT = 'Manrope, Inter, sans-serif';
const STREET_LIT = 0.55;                 // ровный зелёный «свободна», как в главе 1

export default makeScene2D(function* (view) {
  applyBackground(view);
  const stage = new Node({});
  view.add(stage);

  yield (document as any).fonts.load(`700 100px Manrope`);
  yield (document as any).fonts.load(`400 40px Manrope`);
  const world = yield* buildChargingStage();
  world.camEl(CAM.el);
  world.camDist(CAM.dist);
  world.tgtX(CAM.x);
  world.tgtY(CAM.y);
  world.tgtZ(CAM.z);
  world.lookOff(CAM.off);

  // ── Состояния мира ───────────────────────────────────────────────────────
  const postLit = createSignal(STREET_LIT);
  const appOp = createSignal(0);
  const appBlur = createSignal(14);
  const pressed = createSignal(0);
  const loading = createSignal(0);
  const sheet = createSignal(0);
  const clock = createSignal(0);           // секунды — для спиннера
  spawn(clock(600, 600, linear));

  const PANEL_ROT = world.car.rotation.y;  // −31°, плоскость всех приборов
  const carBox = new Box3().setFromObject(world.car);
  const carMid = carBox.getCenter(new Vector3());
  const along = new Vector3(Math.cos(PANEL_ROT), 0, -Math.sin(PANEL_ROT));
  const cardPos = carMid.clone().addScaledVector(along, CARD_SHIFT);
  const app = mountWorldCard(world.scene3, {
    x: cardPos.x, y: carBox.max.y + CARD_LIFT + CARD_H / 2, z: cardPos.z,
    planeW: CARD_W, planeH: CARD_H, rotationY: PANEL_ROT, px: 1024, py: 600,
  });

  // Экран приложения — тот же, что в POV, разложенный на панели мира.
  let appKey = '';
  function drawApp() {
    const b = Math.round(appBlur() * 4) / 4;
    const pr = Math.round(pressed() * 50) / 50;
    const ld = Math.round(loading() * 50) / 50;
    const sh = Math.round(sheet() * 200) / 200;
    const spin = ld > 0 ? Math.round(clock() * 30) : 0;
    const key = `${b}|${pr}|${ld}|${sh}|${spin}`;
    if (key === appKey) return;
    appKey = key;
    const c = app.ctx, W = app.width, H = app.height;
    c.clearRect(0, 0, W, H);
    c.save();
    if (b > 0.05) c.filter = `blur(${b}px)`;
    panelBody(c, W, H);
    roundRect(c, PANEL.hair, PANEL.hair, W - PANEL.hair * 2, H - PANEL.hair * 2, 30);
    c.clip();
    c.textBaseline = 'alphabetic';
    const text = (t: string, x: number, y: number, px: number, color: string,
                  w = 400, align: CanvasTextAlign = 'left') => {
      c.font = `${w} ${px}px ${APP_FONT}`;
      c.fillStyle = color;
      c.textAlign = align;
      c.fillText(t, x, y);
    };
    text('Mill Street  ·  Post 3', 64, 100, 38, APP_UI.muted);
    c.fillStyle = APP_UI.green;
    c.beginPath(); c.arc(84, 197, 17, 0, Math.PI * 2); c.fill();
    text('Available', 122, 232, 100, APP_UI.text, 700);

    // кнопка
    const BX = 64, BY = 322, BW = W - 128, BH = 150;
    const k = 1 - 0.03 * pr;
    const bw = BW * k, bh = BH * k, bx = BX + (BW - bw) / 2, by = BY + (BH - bh) / 2;
    c.fillStyle = APP_UI.green;
    roundRect(c, bx, by, bw, bh, bh / 2);
    c.fill();
    const dark = 0.16 * Math.max(pr, ld * 0.8);
    if (dark > 0) {
      c.fillStyle = `rgba(0,0,0,${dark})`;
      roundRect(c, bx, by, bw, bh, bh / 2);
      c.fill();
    }
    const cy = BY + BH / 2;
    if (ld < 1) {
      c.globalAlpha = 1 - ld;
      text('Start charging', BX + BW / 2, cy + 22, 62, APP_UI.greenInk, 700, 'center');
      c.globalAlpha = 1;
    }
    if (ld > 0) {
      c.globalAlpha = ld;
      const sx = BX + BW / 2 - 150;
      c.strokeStyle = APP_UI.greenInk;
      c.lineWidth = 8;
      c.lineCap = 'round';
      c.beginPath();
      const a0 = clock() * 6.2;
      c.arc(sx, cy, 24, a0, a0 + Math.PI * 1.45);
      c.stroke();
      text('Starting…', sx + 50, cy + 22, 62, APP_UI.greenInk, 700);
      c.globalAlpha = 1;
    }

    // Лист ошибки снизу; «Available» наверху остаётся — как в POV.
    if (sh > 0) {
      const top = H - 330 * sh;
      const g = c.createLinearGradient(0, top - 40, 0, top);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${0.5 * sh})`);
      c.fillStyle = g;
      c.fillRect(0, top - 40, W, 40);
      c.fillStyle = APP_UI.sheet;
      roundRect(c, 0, top, W, 420, 36);
      c.fill();
      c.fillStyle = 'rgba(243,245,247,0.28)';
      roundRect(c, W / 2 - 40, top + 16, 80, 8, 4);
      c.fill();
      c.fillStyle = APP_UI.red;
      c.beginPath(); c.arc(100, top + 112, 30, 0, Math.PI * 2); c.fill();
      c.fillStyle = APP_UI.sheet;
      roundRect(c, 95, top + 93, 10, 27, 5);
      c.fill();
      c.beginPath(); c.arc(100, top + 130, 5.5, 0, Math.PI * 2); c.fill();
      text('Connector unavailable', 150, top + 134, 66, APP_UI.text, 700);
      text('Try another connector.', 150, top + 198, 40, APP_UI.muted);
    }
    c.restore();
    app.tex.needsUpdate = true;
  }

  const paint = (mats: MeshStandardMaterial[], level: number) => {
    for (const m of mats) {
      m.emissive.copy(POST_IDLE);
      m.emissiveIntensity = level * 3.4;
    }
  };
  const frame = (r: WebGLRenderer, s: Scene) => {
    paint(world.postMats, postLit());
    app.mat.opacity = appOp();
    drawApp();
    world.frame(r, s);
  };

  // Только улица: депо в главе 2 ни при чём.
  const mainView = createThreeView({
    width: Screen.width, height: Screen.height, scene: world.scene3,
    camera: world.camera, onRender: r => frame(r, world.scene3),
  });
  const shot = mainView.node;
  const shotBlur = blur(10);
  shot.filters([shotBlur]);
  shot.opacity(0);
  stage.add(shot);

  // ── Документ ─────────────────────────────────────────────────────────────
  const docWrap = new Node({opacity: 0});
  const docBlur = blur(10);
  docWrap.filters([docBlur]);
  stage.add(docWrap);
  const plateLayer = new Node({});          // под кодом: добавлен ДО mount()
  docWrap.add(plateLayer);
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

  // Полоска под строкой — канон: роуз 0.18, высота 1.15 строки, углы острые,
  // по длине текста строки. Слой под кодом; документ не скроллит.
  const STRIPE_COLOR = 'rgba(255, 80, 120, 0.18)';
  const ADV = CODE_FS * 0.605;
  const stripe = (line: number): Rect => {
    const t = ROWS[line];
    const c0 = t.length - t.trimStart().length, c1 = t.length;
    const r = new Rect({
      x: CODE_X + code.getLeftEdge() + c0 * ADV - 10,
      y: Y_VIEW + code.getLineY(line),
      offset: [-1, 0],
      width: (c1 - c0) * ADV + 20, height: LH * 1.15,
      radius: 0, fill: STRIPE_COLOR, opacity: 0,
    });
    plateLayer.add(r);
    return r;
  };
  const S = {
    available: stripe(L_AVAILABLE),
    guard: stripe(L_GUARD),
    thrown: stripe(L_THROW),
    broken: stripe(L_BROKEN),
  };
  const MARK = 0.42;
  const mark = (r: Rect, v: number) => r.opacity(v, MARK, easeInOutSine);

  // Гашение всего, кроме нужных строк. Яркость — только на контейнере строки.
  const DIM = 0.3;
  function* spot(keep: number[] | null, dur = 0.7): ThreadGenerator {
    const anims: ThreadGenerator[] = [];
    for (let i = 0; i < code.lineCount; i++) {
      anims.push(code.getLine(i)!.setOpacity(keep === null || keep.includes(i) ? 1 : DIM, dur));
    }
    yield* all(...anims);
  }

  // ═══ ТАЙМЛАЙН (черновой: такты на глаз, до записи озвучки) ═════════════
  function* at(t: number) {
    const dt = t - useTime();
    if (dt > 0) yield* waitFor(dt);
  }

  // 0. Кадр проявляется целиком: мир и документ одним фокусом.
  yield* all(
    shot.opacity(1, 1.4, easeOutCubic), shotBlur.value(0, 1.4, easeInOutSine),
    docWrap.opacity(1, 1.2, easeOutCubic), docBlur.value(0, 1.2, easeInOutSine),
  );

  // 1. API приложения: флаг «доступно» = «не заряжается». Приложение над
  //    машиной говорит «Available» и даёт кнопку — стойка при этом зелёная.
  yield* at(2.2);
  yield* all(
    spot(APP_LINES),
    mark(S.available, 1),
    appOp(1, 0.9, easeInOutSine), appBlur(0, 0.9, easeInOutSine),
  );

  // 2. Обработчик команды: начать можно только на AVAILABLE и FINISHING.
  yield* at(6.2);
  yield* all(spot(HANDLER_LINES), mark(S.available, 0), mark(S.guard, 1));

  // 3. Два места, разные файлы, разная форма. Дубликата не видно.
  yield* at(10.2);
  yield* all(spot(null), mark(S.guard, 0));

  // 4. Разъём ломается: сначала мир — индикатор стойки гаснет.
  yield* at(13.0);
  yield* postLit(0, 0.9, easeInOutSine);

  // 5. Код догоняет мир: в enum добавляют OUT_OF_ORDER. Больше ничего.
  yield* at(14.4);
  yield* spot(STATUS_LINES);
  yield* code.morphTo(DOC_1, {
    addStyle: 'typewriter', charDelay: 0.05, lineDelay: 0.03,
    moveDuration: 0.35, removeDuration: 0.2, scrollStrategy: 'block',
    lineOrder: 'sequential', blockOrder: 'sequential',
    settleBeforeType: true, diffPreferEarlyMatches: true,
    recolorLine: paintCanonMethodCallsLine,
  });
  code.colorize(CODE_RULES);
  paintCanonMethodCalls(code);
  yield* spot(STATUS_LINES, 0);
  yield* mark(S.broken, 1);

  // 6. Обработчик новый статус отвергает: его нет в списке.
  yield* at(18.4);
  yield* all(spot(HANDLER_LINES), mark(S.broken, 0), mark(S.guard, 1));

  // 7. Приложение пропускает: сломанный разъём не «заряжается», флаг true —
  //    карточка как говорила «Available», так и говорит.
  yield* at(21.4);
  yield* all(spot(APP_LINES), mark(S.guard, 0), mark(S.available, 1));

  // 8. Нажатие. Запрос уходит в обработчик и падает на throw — снизу выезжает
  //    лист «Connector unavailable», «Available» наверху остаётся.
  yield* at(24.4);
  yield* pressed(1, 0.14, easeInOutSine);
  yield* all(pressed(0, 0.2, easeInOutSine), loading(1, 0.25, easeInOutSine));
  yield* waitFor(0.8);
  yield* all(
    spot([L_AVAILABLE, ...HANDLER_LINES]),
    mark(S.thrown, 1),
    loading(0, 0.3, easeInOutSine),
    sheet(1, 0.6, easeOutCubic),
  );

  // 9. Система говорит две вещи сразу: можно здесь начать — нельзя.
  yield* at(27.6);
  yield* spot([L_AVAILABLE, L_THROW]);
  yield* at(32.0);
});
