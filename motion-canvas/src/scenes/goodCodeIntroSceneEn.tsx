import {makeScene2D, Node, Rect, Txt} from '@motion-canvas/2d';
import {createSignal, linear} from '@motion-canvas/core';
import {buildIntro, INTRO_DURATION, introTimeline, introTitleOut} from '../core/three/goodCodeIntro';
import {Screen} from '../core/theme';
import {applyBackground} from '../core/utils';

// ── GOOD CODE, BUT I HATE IT · ИНТРО ────────────────────────────────────────
// Ночь, кабинет: барвинок в фокусе, за ним новый разработчик → фокус на лицо,
// камера проходит сбоку от букета и встаёт чуть сбоку от лица → на 3-й секунде
// справа выезжает его стол с кодом → щелчок, склейки: ещё пятеро, у каждого свой
// стол, редактор и код одной формы; у последнего на экране загрузка → его лицо
// уходит, и камера мягко едет в его экран → загрузка доходит, на 17.03 проступает
// титул → эффект монитора снимается: титул на графите стоит и гаснет.
//
// Озвучка (EN):
// Thirty people wrote a smart home platform — one spent twenty years on banking
// software, another came from video games, and someone only started coding last
// year. They'd argue about naming, formatting, almost anything. It all just worked,
// and this is the story of how a newcomer made it better — and broke it.
//
// Озвучка (RU):
// Платформу умного дома написали тридцать человек: один двадцать лет писал
// банковский софт, другой пришёл из видеоигр, а кто-то начал программировать
// только в прошлом году. Они спорили об именах, о форматировании, почти обо всём.
// Платформа работала, и вот история о том, как новенький сделал её лучше — и сломал.
//
// ⚠️ 3D-кадр целиком собирает core/three/goodCodeIntro (introTimeline — чистая
// функция времени, такты — таблица INTRO); сцена ведёт часы и держит титул конца.
// Щелчки клавиш — ставит автор.

const P = (fbx: string, tex: string) => ({fbx: `/goodcode/people/${fbx}.fbx`, tex: `/goodcode/people/${tex}`, ext: 'webp', eyeUV: [540, 1898, 140] as [number, number, number]});

// ── Титул: канон титулов видео (nullMeansTitleCanonSceneEn) ─────────────────
// Один тёплый крем, ровный кегль на обеих строках, простой фейд. Шрифт — JetBrains
// Mono 500 (автор выбрал по сетке в настоящем кадре: «4»). Прежние: Fonts.primary
// рисовался Arial (Space Grotesk в проекте не подключён), Newsreader — «уродливый».
const WARM_CREAM = 'rgba(244, 230, 200, 0.96)';
const TITLE_FONT = 'JetBrains Mono, monospace';
const TITLE_FS = 112;                    // моно шире: 112 ≈ 130 гротеска по ширине строки
const TITLE_PITCH = 152;

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

  // Титул лежит ПОД 3D-кадром: тот непрозрачен, пока после наезда не растворится.
  const end = new Node({});
  view.add(end);
  const bg = new Node({});
  end.add(bg);
  applyBackground(bg);
  // гаснет обёртка, строки — внутри: их снимок не зависит от фейда
  const title = new Node({opacity: () => 1 - introTitleOut(clock())});
  end.add(title);
  const lines = new Node({y: -14});
  title.add(lines);
  for (const [text, y] of [['Good code,', -TITLE_PITCH / 2], ['but I hate it', TITLE_PITCH / 2]] as const) {
    lines.add(new Txt({text, y, fontFamily: TITLE_FONT, fontSize: TITLE_FS, fontWeight: 500, fill: WARM_CREAM}));
  }

  // Экран последнего показывает ЭТОТ титул: снимок живых нод (фон и отдельно буквы —
  // для ореола) после того, как их разложил первый кадр.
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
    if (!snapped) { snapped = true; shot.setEndImages(snap(bg), snap(lines)); }
    const s = introTimeline(clock());
    if (s.clear >= 1) return;                              // дальше — только титул
    const m = context.getTransform();
    const k = Math.max(1, Math.hypot(m.a, m.b));
    const img = shot.render(s, Math.round(Screen.width * k), Math.round(Screen.height * k));
    context.globalAlpha *= 1 - s.clear;
    context.drawImage(img, -Screen.width / 2, -Screen.height / 2, Screen.width, Screen.height);
  };
  view.add(frame);

  yield* clock(INTRO_DURATION, INTRO_DURATION, linear);
});
