import {Circle, CubicBezier, Line, Node, Rect, Txt, blur, makeScene2D} from '@motion-canvas/2d';
import {createSignal, easeInOutCubic, easeInOutSine, easeOutCubic, easeOutQuint, linear} from '@motion-canvas/core';
import {HouseShot, loadHouseDiorama} from '../core/three/houseDiorama';
import {Fonts, Screen} from '../core/theme';
import {applyBackground} from '../core/utils';
import {Manticore} from '../core/code/components/Manticore';
import {Canon, CanonCodeTheme, buildCanonRules, paintCanonMethodCalls} from '../core/code/model/paletteCanon';

// ── GOOD CODE, BUT I HATE IT · 1.1 «Дом и один файл» ─────────────────────────
// Одна композиция на графите, как у сцены с машиной и депо (chargingHeroDemoScene): код слева, дом
// справа. Сначала проявляется код, на «this house» — подставка, на неё модулями собирается дом.
// На «thirty devices» крыша и верхний этаж уходят вверх — видны комнаты с устройствами. Камера
// наезжает к гостиной, остальной дом растворяется в графит: остаётся одна гостиная — модулем на своей
// плите («Дом и один файл»: комната = файл), без теней. Свет вечерний.
// Рядом с комнатой проявляется панель приложения (не телефон: в кадре одна зона внимания — панель,
// торшер и связь между ними). Полоска в коде идёт по шести строкам, каждая отзывается в мире:
//   handle   — пришла команда: ползунок на панели едет с 80 до 25;
//   проверка — у шкалы проступают «0» и «100»: 25 внутри диапазона;
//   поиск    — от панели к торшеру прорисовывается связь, на торшере встаёт якорь с одной волной;
//   отправка — по связи к торшеру проходит луч, торшер притухает, на панели «Sending…»;
//   запись   — у якоря галочка;
//   ответ    — на панели «Accepted».
// ⚠️ Без наезда к торшеру на поиске (автор: «не используй зум при нахождении»): торшер выделяет
// якорь на конце связи — в стиле самой связи.
// ⚠️ В коде — только полоска, остальной код не гаснет; меток на полях нет (автор).
//
// Озвучка (EN):
// Every device in this house — lamps, blinds, thermostats, locks — is controlled through a
// command handler. Thirty devices, thirty handlers. When you dim a lamp in the app, this one
// runs. It checks the input, because brightness has to stay between zero and a hundred, then
// finds the lamp, sends the command, records that it was accepted, and answers the app.
//
// Озвучка (RU):
// Каждым устройством в этом доме — лампами, шторами, термостатами, замками — управляет
// обработчик команд. Тридцать устройств, тридцать обработчиков. Когда ты убавляешь яркость
// лампы в приложении, срабатывает вот этот. Он проверяет входные данные, потому что яркость
// должна оставаться от нуля до ста, затем находит лампу, отправляет команду, записывает, что
// её приняли, и отвечает приложению.
//
// ⚠️ Записи ещё нет: такты — по темпу автора (~3.3 слова/с, паузы ~0.8 с между фразами).
// Придёт запись — переставить числа в BEAT, остальное считается от них.
// ⚠️ Код — фрагмент A сценария v6.1 с правилами автора для кода в кадре: `if` со скобками, пустая
// строка между логическими блоками, и правками ниже у CODE.

// ⚠️ Порядок входа (автор, 04.10): СНАЧАЛА код, потом дом. Дом проявляется на слове «house».
const BEAT = {
  code: 0.0,        // код проявляется целиком наводкой резкости
  appear: 1.0,      // «Every device in this house» — подставка проявляется на своём месте
  build: 1.5,       // на неё опускаются модули дома (сборка 3 с)
  open: 6.8,        // «Thirty devices, thirty handlers» — крыша и этаж уходят вверх
  dive: 8.4,        // «When you dim a lamp…» — наезд к гостиной
  panel: 11.1,      // «…in the app» — панель приложения проявляется рядом с комнатой
  handle: 11.8,     // «this one runs» — полоска на handle, ползунок едет
  check: 13.25,     // «It checks the input, because brightness has to stay between zero and a hundred»
  find: 18.2,       // «then finds the lamp»
  send: 19.1,       // «sends the command»
  record: 20.2,     // «records that it was accepted»
  answer: 22.35,    // «and answers the app»
  end: 25.0,
};
const APPEAR_T = 0.8, CODE_T = 0.9, OPEN_T = 1.6, DIVE_T = 2.8, PANEL_T = 0.8;
const MOVE_T = 0.45;              // полоска со строки на строку
const LAMP_FROM = 0.8, LAMP_TO = 0.25;
const LINK_T = 0.6, BEAM_T = 0.55;

// ── раскладка: код слева, дом справа ─────────────────────────────────────────
// Код на 15 % мельче прежних 24/35 (автор). Самая длинная строка — сигнатура handle (76 знаков,
// 930 px): кончается на 1000 px.
const FS = 20.4, LH = 29.75, ADV = FS * 0.6;
const TEXT_LEFT = -890;                                // левая кромка текста кода (70 px)
const MC_W = 920;
const MC_X = TEXT_LEFT + MC_W / 2 - 49;                // 49 = getCodePaddingX(20.4)
// Общий план — в правой части, на 10 % меньше прежнего: правое поле ≈ левому полю кода.
const HOUSE_FRAME = {x0: 0.151, x1: 0.917, y0: -0.78, y1: 0.78};
// Гостиная модулем — ниже и левее (1060…1600 × 250…820 px): торшер у верхнего угла модуля, справа
// от него на пустом графите — панель приложения; связь между ними короткая и не идёт поверх комнаты.
const ROOM_BOX = {x0: 1060 / 960 - 1, x1: 1600 / 960 - 1, y0: 1 - 820 / 540, y1: 1 - 250 / 540};
// Подставка растворяется под кодом мягкой дугой, а не вертикальной шторкой: эллипс вокруг гостиной
// (центр 1600×420 px, вытянут по вертикали в 2.2 раза). Профиль — smootherstep.
const FADE = {cx: 1600, cy: 420, rIn: 380, rOut: 620, aspect: 2.2};
const smoother = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);
const STRIPE_C = 'rgba(255, 80, 120, 0.18)';
const CREAM = 'rgba(244, 241, 235, 0.96)';

// ⚠️ Правки автора к фрагменту A (03.10): `caller` не использовался (авторизация — на внешней
// границе) — убран, сигнатура в одну строку; яркость одним словом с озвучкой — `brightness`, а не
// `level`; аргументы `submit` — каждый на своей строке; пустая строка перед `handle`.
const CODE = [
  'class SetLampBrightnessHandler(',
  '    private val devices: DeviceRepository,',
  '    private val gateway: DeviceGateway,',
  '    private val journal: CommandJournal,',
  ') : CommandHandler<SetLampBrightness> {',
  '',
  '    override suspend fun handle(command: SetLampBrightness): CommandResult {',
  '        if (command.brightness !in 0..100) {',
  '            return CommandResult.Invalid("brightness must be in 0..100")',
  '        }',
  '',
  '        val lamp = devices.findLamp(command.homeId, command.deviceId)',
  '            ?: return CommandResult.NotFound',
  '',
  '        val receipt = withTimeoutOrNull(LAMP_ACK_TIMEOUT) {',
  '            gateway.submit(',
  '                lamp.address,',
  '                command.requestId,',
  '                LampPayload.SetBrightness(command.brightness),',
  '            )',
  '        } ?: return CommandResult.Unconfirmed(command.requestId)',
  '',
  '        journal.recordAccepted(command.requestId, lamp.id, receipt)',
  '',
  '        return CommandResult.Accepted(command.requestId)',
  '    }',
  '}',
];

/** Остановки полоски: вход в метод и пять шагов. */
const STEPS = [
  {at: BEAT.handle, line: 6},
  {at: BEAT.check, line: 7},
  {at: BEAT.find, line: 11},
  {at: BEAT.send, line: 15},
  {at: BEAT.record, line: 22},
  {at: BEAT.answer, line: 24},
];

const TYPES = [
  'SetLampBrightnessHandler', 'DeviceRepository', 'DeviceGateway', 'CommandJournal', 'CommandHandler',
  'SetLampBrightness', 'CommandResult', 'Invalid', 'NotFound', 'Unconfirmed', 'Accepted',
  'LampPayload', 'SetBrightness',
];
const CODE_RULES = [
  ...buildCanonRules({types: TYPES, vars: ['devices', 'gateway', 'journal', 'command', 'lamp', 'receipt']}),
  {match: /^(suspend|!in)$/, color: Canon.keyword},
];
const CODE_CARD = {
  radius: 0, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)', strokeWidth: 0,
  shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, edge: false,
} as const;

// ── панель приложения ──
const PN_W = 300, PN_H = 250, PN_R = 26;
const UI = 'Manrope, sans-serif';
const LAMP_WARM = 'rgba(255, 212, 160, 0.95)';
const MUTED = 'rgba(244, 241, 235, 0.52)';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ramp = (t: number, t0: number, dur: number) => clamp01((t - t0) / dur);

export default makeScene2D(function* (view) {
  applyBackground(view);
  yield Promise.all(['400 22px Manrope', '700 30px Manrope'].map(f => (document as any).fonts?.load?.(f)));
  const shot: HouseShot = yield loadHouseDiorama('/goodcode/house', {studio: false, frame: HOUSE_FRAME, room: ROOM_BOX});
  const clock = createSignal(0);

  // ── дом по времени: сборка → раскрытие → наезд и вечер → торшер ──
  // торшер притухает, когда до него доходит луч по связи
  const lampLevel = (t: number) => LAMP_FROM + (LAMP_TO - LAMP_FROM) * easeInOutSine(ramp(t, BEAT.send + BEAM_T, 1.3));
  const setHouse = (t: number) => {
    shot.setBuild(t - BEAT.build);
    shot.setOpen(ramp(t, BEAT.open, OPEN_T));
    shot.setDive(ramp(t, BEAT.dive, DIVE_T));
    shot.setLampFocus(0);
    shot.setMood(easeInOutSine(ramp(t, BEAT.dive, DIVE_T)));
    shot.setLamp(lampLevel(t));
  };
  // где торшер в кадре гостиной (камера после пролёта стоит): якорь связи — у абажура
  setHouse(BEAT.end);
  const lp = shot.lampOnScreen();
  const LAMP = {x: (lp.x - 0.5) * Screen.width, y: (lp.y - 0.5) * Screen.height};

  // подставка, уходящая под код, растворяется в графит: эллиптическая маска вокруг гостиной
  const fCanvas = document.createElement('canvas');
  const fadeAround = (img: HTMLCanvasElement, k: number, strength: number) => {
    if (fCanvas.width !== img.width || fCanvas.height !== img.height) { fCanvas.width = img.width; fCanvas.height = img.height; }
    const g = fCanvas.getContext('2d')!;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, fCanvas.width, fCanvas.height);
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    g.save();
    g.translate(FADE.cx * k, FADE.cy * k);
    g.scale(1, FADE.aspect);
    const gr = g.createRadialGradient(0, 0, FADE.rIn * k, 0, 0, FADE.rOut * k);
    for (let i = 0; i <= 8; i++) {
      const u = i / 8, a = 1 - strength * smoother(u);
      gr.addColorStop(u, `rgba(0,0,0,${a.toFixed(4)})`);
    }
    g.fillStyle = gr;
    g.fillRect(-FADE.cx * k, -FADE.cy * k / FADE.aspect, fCanvas.width, fCanvas.height / FADE.aspect);
    g.restore();
    g.globalCompositeOperation = 'source-over';
    return fCanvas;
  };

  // изоляция гостиной: за вторую половину наезда остальной дом растворяется в графит
  const iso = (t: number) => easeInOutSine(ramp(t, BEAT.dive + DIVE_T * 0.35, DIVE_T * 0.6));
  const mCanvas = document.createElement('canvas');
  const mix = (a: HTMLCanvasElement, b: HTMLCanvasElement, u: number) => {
    // a·(1 − u) + b·u в предумноженной альфе: оба слоя — сложением
    if (mCanvas.width !== a.width || mCanvas.height !== a.height) { mCanvas.width = a.width; mCanvas.height = a.height; }
    const g = mCanvas.getContext('2d')!;
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, mCanvas.width, mCanvas.height);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 1 - u;
    g.drawImage(a, 0, 0);
    g.globalAlpha = u;
    g.drawImage(b, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    return mCanvas;
  };

  const house = new Rect({width: Screen.width, height: Screen.height});
  (house as any).draw = function (context: CanvasRenderingContext2D) {
    const t = clock();
    // вход дома: проявляется на своём месте из расфокуса, как машины в сцене с депо
    const a = easeOutCubic(ramp(t, BEAT.appear, APPEAR_T));
    if (a <= 0) return;
    setHouse(t);
    const m = context.getTransform();
    const k = Math.hypot(m.a, m.b);
    const W = Math.round(Screen.width * k), H = Math.round(Screen.height * k);
    const ss = k > 0.99 ? 2 : 1, u = iso(t);
    // весь дом (пока комната не изолирована): подставка, уходящая под код, тает эллипсом
    let img: HTMLCanvasElement | null = null;
    if (u < 0.999) {
      img = shot.render(W, H, ss);
      const fade = easeInOutSine(ramp(t, BEAT.dive, DIVE_T * 0.5));
      if (fade > 0.002) img = fadeAround(img, k, fade);
    }
    // одна комната — модулем на своей плите; переход — растворением остального дома
    if (u > 0.001) {
      const roomImg = shot.renderRoom(W, H, ss);
      img = img ? mix(img, roomImg, u) : roomImg;
    }
    if (!img) return;
    context.save();
    context.globalAlpha *= a;
    if (a < 1) context.filter = `blur(${(1 - a) * 22 * k}px)`;
    context.drawImage(img, -Screen.width / 2, -Screen.height / 2, Screen.width, Screen.height);
    context.restore();
  };
  view.add(house);

  // ── панель приложения: справа от торшера, на пустом графите над правым углом комнаты ──
  // Верх панели — на одной кромке с кодом (код по центру кадра: верх = −строк·LH/2); ниже она ложилась
  // углом на верх правой стены комнаты.
  const PX = Math.min(Screen.width / 2 - 48 - PN_W / 2, LAMP.x + 390), PY = -CODE.length * LH / 2 + PN_H / 2;
  const panelIn = (t: number) => ramp(t, BEAT.panel, PANEL_T);
  const level = () => LAMP_FROM + (LAMP_TO - LAMP_FROM) * easeInOutCubic(ramp(clock(), BEAT.handle + 0.1, 0.9));
  // проявляется целиком: наводка резкости + еле заметное «приближение», без отскока
  const panel = new Node({
    x: PX, y: PY, cachePadding: 80,
    opacity: () => easeOutCubic(clamp01(panelIn(clock()) * 1.4)),
    scale: () => 0.97 + 0.03 * easeOutQuint(panelIn(clock())),
    filters: () => { const b = 10 * (1 - easeOutQuint(panelIn(clock()))); return b > 0.02 ? [blur(b)] : []; },
  });
  // тень в два слоя: широкая мягкая и плотная контактная
  panel.add(new Rect({width: PN_W, height: PN_H, radius: PN_R, fill: '#14161B', shadowColor: 'rgba(0,0,0,0.5)', shadowBlur: 44, shadowOffset: [0, 18]}));
  panel.add(new Rect({width: PN_W, height: PN_H, radius: PN_R, fill: '#16181E', stroke: 'rgba(244,241,235,0.10)', lineWidth: 1.5,
    shadowColor: 'rgba(0,0,0,0.45)', shadowBlur: 10, shadowOffset: [0, 4]}));
  const top = -PN_H / 2, left = -PN_W / 2 + 26;
  panel.add(new Txt({x: left, y: top + 34, offset: [-1, 0], text: 'Living room', fontFamily: UI, fontSize: 17, fontWeight: 400, fill: MUTED}));
  panel.add(new Txt({x: left, y: top + 62, offset: [-1, 0], text: 'Floor lamp', fontFamily: UI, fontSize: 24, fontWeight: 700, fill: CREAM}));
  panel.add(new Txt({x: left, y: top + 116, offset: [-1, 0], text: () => `${Math.round(level() * 100)}%`, fontFamily: UI, fontSize: 46, fontWeight: 700, fill: CREAM}));
  const TRACK_W = PN_W - 52, TRACK_Y = top + 166;
  const track = new Rect({y: TRACK_Y, width: TRACK_W, height: 26, radius: 13, fill: 'rgba(244,241,235,0.10)', clip: true});
  panel.add(track);
  track.add(new Rect({x: -TRACK_W / 2, offset: [-1, 0], width: () => TRACK_W * level(), height: 26, fill: LAMP_WARM}));
  // проверка: у концов шкалы проступает диапазон — 25 внутри 0…100
  const rangeOp = () => easeOutCubic(ramp(clock(), BEAT.check + 0.15, 0.4));
  panel.add(new Txt({x: -TRACK_W / 2, y: TRACK_Y + 30, offset: [-1, 0], text: '0', fontFamily: UI, fontSize: 15, fontWeight: 400, fill: MUTED, opacity: rangeOp}));
  panel.add(new Txt({x: TRACK_W / 2, y: TRACK_Y + 30, offset: [1, 0], text: '100', fontFamily: UI, fontSize: 15, fontWeight: 400, fill: MUTED, opacity: rangeOp}));
  panel.add(new Txt({x: left, y: top + 226, offset: [-1, 0], text: 'Sending…', fontFamily: UI, fontSize: 18, fontWeight: 400, fill: MUTED,
    opacity: () => ramp(clock(), BEAT.send + 0.05, 0.25) * (1 - ramp(clock(), BEAT.answer, 0.2))}));
  panel.add(new Txt({x: left, y: top + 226, offset: [-1, 0], text: 'Accepted', fontFamily: UI, fontSize: 18, fontWeight: 700, fill: CREAM,
    opacity: () => ramp(clock(), BEAT.answer + 0.12, 0.3)}));

  // ── связь панели с торшером ──
  // Современная связь, как коннектор в Figma: плавная кривая без стрелки из «порта» на кромке панели
  // (на уровне ползунка — команда уходит из него) к якорю на абажуре. Прорисовывается на поиске;
  // на отправке по ней проходит тёплый луч — команда идёт к лампе.
  const P0 = {x: PX - PN_W / 2, y: PY + TRACK_Y}, P3 = {x: LAMP.x, y: LAMP.y};
  const dx = Math.abs(P0.x - P3.x);
  const curve = {p0: [P0.x, P0.y] as [number, number], p1: [P0.x - dx * 0.5, P0.y] as [number, number],
    p2: [P3.x + dx * 0.35, P3.y] as [number, number], p3: [P3.x, P3.y] as [number, number]};
  const linkU = () => easeInOutCubic(ramp(clock(), BEAT.find + 0.05, LINK_T));
  const links = new Node({});
  view.add(links);
  links.add(new CubicBezier({...curve, stroke: 'rgba(244,241,235,0.62)', lineWidth: 2, lineCap: 'round', end: linkU, opacity: () => (linkU() > 0 ? 1 : 0)}));
  // луч: короткий светлый отрезок бежит по кривой от панели к торшеру
  const beamU = () => ramp(clock(), BEAT.send + 0.05, BEAM_T);
  links.add(new CubicBezier({...curve, stroke: LAMP_WARM, lineWidth: 3.2, lineCap: 'round',
    start: () => clamp01(easeInOutSine(beamU()) * 1.25 - 0.25), end: () => clamp01(easeInOutSine(beamU()) * 1.25),
    opacity: () => (beamU() > 0 && beamU() < 1 ? 1 : 0)}));
  // порт на кромке панели — появляется с панелью
  links.add(new Circle({x: P0.x, y: P0.y, size: 9, fill: CREAM, opacity: () => easeOutCubic(panelIn(clock()))}));
  // якорь на торшере: точка и одна волна «нашли» — без наезда, в стиле самой связи
  const anchorAt = BEAT.find + 0.05 + LINK_T * 0.85;
  const anchorIn = () => easeOutCubic(ramp(clock(), anchorAt, 0.25));
  links.add(new Circle({x: P3.x, y: P3.y, size: () => 12 * anchorIn(), fill: CREAM}));
  const wave = () => ramp(clock(), anchorAt, 0.7);
  links.add(new Circle({x: P3.x, y: P3.y, size: () => 12 + 46 * easeOutCubic(wave()), stroke: CREAM, lineWidth: 1.5,
    opacity: () => (wave() > 0 && wave() < 1 ? 0.85 * (1 - easeOutCubic(wave())) : 0)}));
  // запись: у якоря галочка
  links.add(new Line({
    x: P3.x + 26, y: P3.y - 22, scale: 0.8,
    points: [[-17, 1], [-5, 13], [18, -13]],
    stroke: CREAM, lineWidth: 5, lineCap: 'round', lineJoin: 'round',
    end: () => easeOutCubic(ramp(clock(), BEAT.record, 0.4)),
    opacity: () => (clock() >= BEAT.record ? 1 : 0),
    shadowColor: 'rgba(0,0,0,0.6)', shadowBlur: 10, shadowOffset: [0, 2],
  }));
  view.add(panel);

  // ── код: проявляется первым, целиком наводкой резкости ──
  // ⚠️ Manticore.mount() ставит контейнеру opacity 0 — видимостью правит обёртка.
  const codeIn = (t: number) => ramp(t, BEAT.code, CODE_T);
  const codeWrap = new Node({
    cachePadding: 60,
    opacity: () => easeOutCubic(clamp01(codeIn(clock()) * 1.6)),
    filters: () => { const b = 14 * (1 - easeOutQuint(codeIn(clock()))); return b > 0.02 ? [blur(b)] : []; },
  });
  view.add(codeWrap);
  // полоска лежит ПОД кодом: добавлена раньше
  const stripeLayer = new Node({});
  codeWrap.add(stripeLayer);
  const mcWrap = new Node({});
  codeWrap.add(mcWrap);
  const mc = Manticore.create(CODE.join('\n'), {
    x: MC_X, y: 0, width: MC_W, fontSize: FS, lineHeight: LH, fontFamily: Fonts.code,
    theme: CanonCodeTheme, cardStyle: CODE_CARD, glowAccent: false, noClip: true, customTypes: TYPES,
  });
  mc.mount(mcWrap);
  mc.colorize(CODE_RULES);
  paintCanonMethodCalls(mc);
  mc.node.opacity(1);

  // полоска: по длине строки (от первого знака до последнего, поля 10), острые углы
  const stripeAt = STEPS.map(s => {
    const text = CODE[s.line], c0 = text.length - text.trimStart().length, c1 = text.trimEnd().length;
    return {x: TEXT_LEFT + c0 * ADV - 10, y: mc.getLineSceneY(s.line), w: (c1 - c0) * ADV + 20};
  });
  const stripeState = (t: number) => {
    if (t < STEPS[0].at) return {x: stripeAt[0].x, y: stripeAt[0].y, w: 0};
    let cur = {...stripeAt[0], w: stripeAt[0].w * easeOutCubic(ramp(t, STEPS[0].at, 0.5))};
    for (let i = 1; i < STEPS.length; i++) {
      const u = easeInOutCubic(ramp(t, STEPS[i].at, MOVE_T));
      if (u <= 0) break;
      const a = cur, b = stripeAt[i];
      cur = {x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, w: a.w + (b.w - a.w) * u};
    }
    return cur;
  };
  stripeLayer.add(new Rect({
    offset: [-1, 0], height: LH * 1.15, radius: 0, fill: STRIPE_C,
    x: () => stripeState(clock()).x, y: () => stripeState(clock()).y, width: () => stripeState(clock()).w,
  }));

  yield* clock(BEAT.end, BEAT.end, linear);
});
