import {makeScene2D, Node, Rect} from '@motion-canvas/2d';
import {createSignal, linear} from '@motion-canvas/core';
import {Manticore} from '../core/code/components/Manticore';
import {buildCanonRules, Canon, CanonCodeTheme, paintCanonMethodCalls, paintCanonParams} from '../core/code/model/paletteCanon';
import {buildIntro, INTRO_DURATION, introTimeline} from '../core/three/goodCodeIntro';
import {LAMP_HANDLER} from '../core/three/ide';
import {Screen} from '../core/theme';
import {applyBackground} from '../core/utils';

// ── GOOD CODE, BUT I HATE IT · ИНТРО (17 с) ─────────────────────────────────
// Кабинет с цветами: фокус с букета на лицо нового разработчика, камера наезжает
// и встаёт в ракурс «как у всех» → остановка на лице → лицо уходит влево, справа
// его стол с кодом → щелчок, склейки: ещё пятеро, у каждого свой стол, редактор и
// код одной формы → лицо последнего уходит, и камера плавно едет в его экран →
// экран на весь кадр, эффект монитора снимается → обычная код-сцена ролика:
// графит, канон-цвета, код лампы (1.1) слева; справа место под дом (позже).
//
// Озвучка (EN):
// A new developer joins a smart home platform. Thirty people wrote its code.
// They'd argue about naming, about formatting, about almost anything. And yet —
// open any integration, and you'll know exactly where to look. Except one.
//
// Озвучка (RU):
// Новый разработчик приходит на платформу умного дома. Её код писали тридцать
// человек. Они бы спорили об именах, о форматировании — почти обо всём. И всё же
// открой любую интеграцию — и ты точно знаешь, куда смотреть. Кроме одной.
//
// ⚠️ 3D-кадр целиком собирает core/three/goodCodeIntro (introTimeline — чистая
// функция времени, такты — таблица INTRO); сцена ведёт часы и держит код-сцену
// конца. Щелчки клавиш — ставит автор.

const P = (fbx: string, tex: string) => ({fbx: `/goodcode/people/${fbx}.fbx`, tex: `/goodcode/people/${tex}`, ext: 'webp', eyeUV: [540, 1898, 140] as [number, number, number]});

// ── Код-сцена конца: канон «код слева», как в код-сценах DUPLICATION ────────
const CODE_FS = 20;
const CODE_W = 850;
const CODE_X = -455;
const LH = CODE_FS * 1.5;
const CODE_PAD_Y = 38;                   // getCodePaddingY(20)
const CLIP_H = Screen.height;
const CODE_H = CLIP_H + CODE_PAD_Y * 2;
const START_Y = -CLIP_H / 2 + LH / 2;
const TOP_MARGIN = 75;
const Y_VIEW = TOP_MARGIN - Screen.height / 2 - START_Y;   // 60

const CODE_TYPES = [
  'SetLampBrightnessHandler', 'SetLampBrightness', 'CommandHandler', 'CommandResult',
  'DeviceRepository', 'DeviceGateway', 'EventPublisher', 'Metrics', 'Caller',
  'Lamp', 'LampPayload', 'DeviceStateChanged',
  'Invalid', 'NotFound', 'DeviceUnavailable', 'Ok', 'SetLevel',
];
const CODE_RULES = [
  ...buildCanonRules({
    types: CODE_TYPES,
    methods: ['handle'],
    vars: ['devices', 'gateway', 'events', 'metrics', 'log', 'command', 'caller', 'lamp', 'ack', 'updated'],
  }),
  {match: /^(suspend|as)$/, color: Canon.keyword},
  // logger<…>() — тоже вызов, но за именем не «(», пейнтер вызовов его не видит
  {match: /^logger$/, color: Canon.methodCall},
];

export default makeScene2D(function* (view) {
  view.fill('#000000');
  const shot = yield* buildIntro({
    people: [
      P('Male_Adult_09', 'm017'), P('Female_Adult_07', 'f007'), P('Male_Adult_03', 'm004'),
      P('Male_Adult_10', 'm024'), P('Female_Adult_04', 'f004'), {...P('Male_Adult_12', 'm007'), hairCards: false},
    ],
    assets: '/goodcode',
  });
  const clock = createSignal(0);

  // Код-сцена лежит ПОД 3D-кадром: он непрозрачен, пока после наезда не растворится.
  const end = new Node({});
  view.add(end);
  applyBackground(end);
  const code = Manticore.create(LAMP_HANDLER, {
    x: CODE_X, y: Y_VIEW, width: CODE_W, height: CODE_H,
    fontSize: CODE_FS, theme: CanonCodeTheme,
    glowAccent: false, customTypes: CODE_TYPES,
    cardStyle: {fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)', radius: 0, edge: false},
    noClip: true,
  });
  code.mount(end);
  code.colorize(CODE_RULES);
  paintCanonParams(code);
  paintCanonMethodCalls(code);
  code.node.opacity(1);

  // Экран последнего показывает ЭТУ код-сцену: снимок живых нод (весь кадр и
  // отдельно буквы — для ореола) после того, как их разложил первый кадр.
  // ⚠️ Снимать только живые ноды: текст MC меряется через DOM и вне дерева не рисуется.
  const snap = (node: Node) => {
    const c = document.createElement('canvas');
    c.width = 2048; c.height = 1152;
    const g = c.getContext('2d')!;
    const k = c.width / Screen.width;
    g.setTransform(k, 0, 0, k, c.width / 2, c.height / 2);
    node.render(g);
    return c;
  };
  let snapped = false;

  const frame = new Rect({width: Screen.width, height: Screen.height});
  (frame as any).draw = function (context: CanvasRenderingContext2D) {
    if (!snapped) { snapped = true; shot.setEndImage(snap(end), snap(code.node)); }
    const s = introTimeline(clock());
    if (s.clear >= 1) return;                              // дальше — только код-сцена
    const m = context.getTransform();
    const k = Math.max(1, Math.hypot(m.a, m.b));
    const img = shot.render(s, Math.round(Screen.width * k), Math.round(Screen.height * k));
    context.globalAlpha *= 1 - s.clear;
    context.drawImage(img, -Screen.width / 2, -Screen.height / 2, Screen.width, Screen.height);
  };
  view.add(frame);

  yield* clock(INTRO_DURATION, INTRO_DURATION, linear);
});
