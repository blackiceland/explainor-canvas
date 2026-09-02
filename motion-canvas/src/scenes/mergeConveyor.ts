import {blur, Filter, Node, Rect, Txt} from '@motion-canvas/2d';
import {
  all, chain, createSignal, easeInCubic, easeInOutCubic, easeOutCubic, linear,
  spawn, ThreadGenerator, waitFor,
} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {
  CanonCodeTheme, buildCanonRules, paintCanonMethodCalls, paintCanonParams,
} from '../core/code/model/paletteCanon';
import {getCodePaddingX, measureChar} from '../core/code/shared/TextMeasure';
import {Fonts, Screen} from '../core/theme';

// ── DON'T FIGHT DUPLICATION · конвейер слияний ─────────────────────────────
// Не сцена, а деталь: монтируется в любой Node и умеет прогнать своё
// расписание. Живёт в двух местах — в одиночном превью
// (openingMergeTimelapseSceneEn) и в сцене с машиной, где его хвост догорает
// уже поверх улицы. Поэтому финальное затемнение здесь НЕ зашито: чем
// кончается конвейер, решает хозяин.
//
// VO над ним: «It feels so obviously right that we rarely stop to ask what,
// exactly, we're removing.» Первую фразу забрал эпиграф, поэтому конвейеру
// достаётся одно предложение — отсюда и темп.
//
// Пары фрагментов летят навстречу, сталкиваются в центре, становятся одним
// фрагментом. Результат НЕ собирает большую функцию: коротко фиксируется и
// растворяется. Это монтаж, а не сборка компилируемого кода.

const FPS = 60;                       // rendering.fps проекта
const FRAME = 1 / FPS;

// ── Геометрия ──────────────────────────────────────────────────────────────
// Кегль выбран из ограничения «две копии одновременно читаемы»: при ширине
// блока W край кадра требует SPREAD + W/2 <= 900, а видимый зазор в момент
// старта 2*SPREAD - W >= 150. Отсюда W <= 825 px, то есть 32 знака при FS 42.
const FS = 42;
const LH = Math.round(FS * 1.35);     // 57
const CW = measureChar(FS);           // ширина знака моноширинного
const PAD_X = getCodePaddingX(FS);    // width = 2*PAD_X ⇒ левый край текста = node.x
const SPREAD = 490;                   // старт копий: центры на ±SPREAD
const ECHO_AT = 0.5;                  // фантомы — на полпути от старта к центру

// ── Глубина резкости ───────────────────────────────────────────────────────
// Входящий фрагмент: blur 6 → 0, scale 0.96 → 1, opacity 0.55 → 1.
// Резкость приходит ПОЗДНО (easeInCubic): размыта очередь в глубине, а не
// кульминационные столкновения. Активная пара всегда резка в центре.
const IN_BLUR = 6;
const IN_SCALE = 0.96;
const IN_OP = 0.55;

// Появление первой пары — ОДИН жест, фокус-пул. Расфокус сам и гасит, и
// размазывает: свет размазан по вчетверо большей площади, поэтому пятно
// стартует тусклым без всякой анимации прозрачности. Накладывать сверху ещё
// и плавное проявление — два появления подряд.
const FIRST_BLUR = 12;

// Смыкание. Две копии одинакового текста неизбежно проходят друг сквозь
// друга: чтобы стать одной строкой, каждая обязана пройти полширины блока.
// Гасить одну из них на подлёте нельзя — это читается как «одна коснулась
// другой и убила её». Поэтому обе идут до конца на полной яркости, а
// проникновение прячется оптикой: на входе в наложение обе одинаково
// притухают и уходят в смаз, в точке совпадения строка вспыхивает ореолом и
// выходит из смаза в резкость. Лишняя копия снимается уже ПОСЛЕ совпадения —
// под ней лежит пиксель-в-пиксель такая же, и снятия не видно.
const SLAM_BLUR = 3.6;
const SLAM_DIP = 0.7;                 // притухание на наложении — сдержанное

// ── Покраска — канон проекта ───────────────────────────────────────────────
const CUSTOM_TYPES = [
  'SessionOwner', 'SessionStarted',
  'StartPublicSession', 'StartFleetSession', 'StartSession',
];
const RULES: ColorRule[] = buildCanonRules({types: CUSTOM_TYPES});

const GHOST = '#EDE9E1';              // призраки и хвосты — нейтральный крем
const HALO = '#FFE6C0';               // ореол слияния — тёплый

const TRANSPARENT_CARD = {
  radius: 0, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)', strokeWidth: 0,
  edge: false, opacity: 0, shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
  shadowOffsetX: 0, shadowOffsetY: 0,
} as const;

// ── Четырнадцать пар ───────────────────────────────────────────────────────
// Порядок от очевидного сходства к скрытому различию: первые восемь пар
// идентичны с обеих сторон, девятая — расходящиеся сигнатуры, десятая —
// смысловая: Driver и Vehicle, превращающиеся в command.owner. Последние
// четыре машина домалывает уже в уходящем свете.
interface Frag {left: string; right: string; result?: string}
const same = (s: string): Frag => ({left: s, right: s});

const FRAGS: Frag[] = [
  same('metering.start(session.id)'),
  same('val connector = connectors.find(\n    command.connectorId,\n)'),
  same('val startedAt = clock.instant()'),
  same('charger.energize(\n    connector.id,\n    session.id,\n)'),
  same('sessions.activate(\n    session.id,\n)'),
  same('events.publish(\n    SessionStarted(session.id),\n)'),
  same('sessionLog.record(session)\nreturn session.id'),
  same('val session = sessions.open(\n    connector.id,\n    owner,\n    startedAt,\n)'),
  {
    left: 'fun startPublicSession(\n    command: StartPublicSession,\n)',
    right: 'fun startFleetSession(\n    command: StartFleetSession,\n)',
    result: 'fun startSession(\n    command: StartSession,\n)',
  },
  {
    // Первая строка обеих копий ОДИНАКОВА и садится пиксель-в-пиксель.
    // Различие живёт ровно в одной строке — это и есть содержание беата.
    left: 'val owner = SessionOwner\n    .Driver(command.driverId)',
    right: 'val owner = SessionOwner\n    .Vehicle(command.vehicleId)',
    result: 'val owner = command.owner',
  },
  same('payments.preAuthorize(actorId)'),
  same('depotBalancer.register(id)'),
  same('scheduler.stopAfter(session.id)'),
  same('connectors.release(connector.id)'),
];

// ── Расписание ─────────────────────────────────────────────────────────────
// Первая пара конденсируется из расфокуса и коротко стоит: тезис «их две и
// они одинаковые» уже произнесён эпиграфом, поэтому длинная стойка здесь не
// нужна — хватает полусекунды.
export const T_SHARP = 0.55;   // первая пара сконденсировалась из расфокуса
export const T_GO = 0.85;      // тронулась
export const MERGE0 = 1.5;     // первое слияние
export const LAST_MERGE = 6.45;

const REL = [
  1.0, 0.8, 0.64, 0.51, 0.41, 0.33, 0.26, 0.21, 0.17,
  0.136, 0.109, 0.087, 0.07,
];
const K = (LAST_MERGE - MERGE0) / REL.reduce((a, b) => a + b, 0);
export const MERGE_AT: number[] = [MERGE0];
for (const r of REL) MERGE_AT.push(MERGE_AT[MERGE_AT.length - 1] + r * K);
// → 1.50 2.55 3.38 4.05 4.59 5.02 5.36 5.63 5.85 6.03 6.17 6.29 6.38 6.45
//   (сухой щелчок строго по центру на каждом из этих моментов)

const travelAt = (i: number) =>
  i === 0 ? MERGE0 - T_GO : Math.max(0.3, 0.65 - 0.3 * Math.pow((i - 1) / 8, 1.6));
// Остывание после удара: строка выходит из смаза в резкость, ореол гаснет.
// Оно же и есть «короткая фиксация» результата в центре.
const coolAt = (travel: number) => Math.min(0.3, Math.max(0.1, travel * 0.36));
const holdAt = (i: number) => Math.max(0, 0.05 - 0.004 * i);
// Длительность гашения — из самого расписания: столько, сколько есть до
// следующего удара в ту же точку. Чистому гашению нужно больше времени, чем
// уходу со сдвигом: глазу не за чем следить, кроме яркости.
const windowAt = (i: number) => i >= MERGE_AT.length - 1
  ? 0.3
  : MERGE_AT[i + 1] - MERGE_AT[i] - coolAt(travelAt(i)) - holdAt(i);
const departAt = (i: number) => Math.min(0.85, Math.max(0.2, windowAt(i) * 1.15));

// Момент, когда последний результат догорел. Хозяин планирует передачу от него.
export const CONVEYOR_END =
  LAST_MERGE + coolAt(travelAt(FRAGS.length - 1)) + departAt(FRAGS.length - 1);

// Motion blur — на всех парах: именно смаз отличал быстрые раунды, которые
// выглядели хорошо, от медленных, которые нет. Копий четыре: на терминальной
// скорости кадр проходит около двух знаков, и три ступени читаются как редкие
// двойники, а не как мазок. На медленном темпе хвост слабее.
const MB_LAGS = [1, 2, 3, 4].map(k => k * FRAME);
const MB_OPS = [0.14, 0.09, 0.05, 0.028];
const mbScale = (travel: number) => Math.min(1, Math.max(0.4, 0.45 / travel));

// ── Фон ────────────────────────────────────────────────────────────────────
// Радиальные градиенты на почти чёрном распадаются на кольца: перепад в
// полтора десятка уровней растянут на тысячу пикселей, и каждый шаг 1/255
// виден как отдельная окружность. Добавлением стопов это не лечится — это
// квантование. Поэтому фон (вертикальная база + подсветка центра + виньетка)
// считается попиксельно и дизерится шумом в пол-уровня. Одна генерация.
const makeBackdrop = (): HTMLCanvasElement => {
  const W = Screen.width;
  const H = Screen.height;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const d = img.data;

  const top = [10, 11, 14];           // #0A0B0E
  const bot = [14, 15, 20];           // #0E0F14
  const lift = [164, 168, 196];       // холодная подсветка центра
  const LIFT_A = 0.075;
  const rLift = W * 0.55;
  const vIn = W * 0.3;
  const vOut = W * 0.8;
  const VIG = 0.42;

  const cx = W / 2;
  const cy = H / 2;
  let p = 0;
  for (let y = 0; y < H; y++) {
    const ty = y / (H - 1);
    const dy = y - cy;
    for (let x = 0; x < W; x++) {
      const dx = x - cx;
      const r = Math.sqrt(dx * dx + dy * dy);
      const kLift = LIFT_A * Math.max(0, 1 - r / rLift);
      const kVig = 1 - VIG * Math.min(1, Math.max(0, (r - vIn) / (vOut - vIn)));
      for (let c = 0; c < 3; c++) {
        const base = top[c] + (bot[c] - top[c]) * ty;
        const v = (base + (lift[c] - base) * kLift) * kVig;
        d[p + c] = Math.max(0, Math.min(255, Math.round(v + Math.random() - 0.5)));
      }
      d[p + 3] = 255;
      p += 4;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
};

// Плёночное зерно ПОЛУРАЗРЕШЕНИЯ, растягивается вдвое: попиксельный шум,
// меняющийся каждый кадр, на почти чёрном фоне разваливается при любом
// уменьшении картинки — в плеере, на телефоне, в кодеке. Зерно 2×2 переживает
// пересэмплирование, поэтому пустой тёмный кадр остаётся чистым.
const GRAIN_PX = 2;
const GRAIN_A = 0.015;
const makeNoise = (): HTMLCanvasElement => {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(Screen.width / GRAIN_PX) + 320;
  cv.height = Math.ceil(Screen.height / GRAIN_PX) + 180;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(cv.width, cv.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 170;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
};

// Оба атласа считаются один раз на модуль: генератор сцены переигрывается
// при каждой перемотке назад, и попиксельный проход по кадру там недопустим.
let backdropCache: HTMLCanvasElement | null = null;
let noiseCache: HTMLCanvasElement | null = null;
const backdropAtlas = () => (backdropCache ??= makeBackdrop());
const noiseAtlas = () => (noiseCache ??= makeNoise());

// Rect, который блитует готовый canvas вместо собственной заливки.
const blitRect = (draw: (c: CanvasRenderingContext2D) => void) => {
  const rect = new Rect({width: Screen.width, height: Screen.height});
  const orig = (rect as any).draw.bind(rect);
  (rect as any).draw = function (ctx: CanvasRenderingContext2D) {
    ctx.save();
    draw(ctx);
    ctx.restore();
    orig(ctx);
  };
  return rect;
};

/** Почти чёрный дизеренный фон конвейера. Хозяин решает, гасить ли его. */
export function mountBackdrop(view: Node): Rect {
  const r = blitRect(ctx => {
    ctx.drawImage(backdropAtlas(), -Screen.width / 2, -Screen.height / 2);
  });
  view.add(r);
  return r;
}

/** Плёночное зерно. Ставится последним — поверх всего. */
export function mountGrain(view: Node): Rect {
  const r = blitRect(ctx => {
    const noise = noiseAtlas();
    const sw = Screen.width / GRAIN_PX;
    const sh = Screen.height / GRAIN_PX;
    const dx = Math.floor(Math.random() * (noise.width - sw));
    const dy = Math.floor(Math.random() * (noise.height - sh));
    ctx.globalAlpha = GRAIN_A;
    ctx.globalCompositeOperation = 'screen';
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      noise, dx, dy, sw, sh,
      -Screen.width / 2, -Screen.height / 2, Screen.width, Screen.height,
    );
  });
  view.add(r);
  return r;
}

export interface Conveyor {
  /** Всё, что рисует конвейер: гасить передачу нужно отсюда. */
  cam: Node;
  /** Прогон расписания. Возвращается, когда догорел последний результат. */
  run: () => ThreadGenerator;
}

/**
 * Монтирует конвейер в переданный узел. Наезд камеры на 2% идёт по своим
 * часам и не зависит от порядка спавнов; zoomOver задаёт, за какое время
 * набираются эти 2% (у хозяина сцена может быть длиннее конвейера).
 */
export function mountConveyor(view: Node, zoomOver = CONVEYOR_END + 1.5): Conveyor {
  const clock = createSignal(0);
  const cam = new Node({scale: () => 1 + 0.02 * Math.min(1, clock() / zoomOver)});
  view.add(cam);

  const ghostLayer = new Node({});
  const echoLayer = new Node({});
  const flashLayer = new Node({});
  const codeLayer = new Node({});
  cam.add(ghostLayer);
  cam.add(echoLayer);
  cam.add(flashLayer);
  cam.add(codeLayer);

  // Хвосты motion blur сшиваются лёгким гауссом в мазок; основной текст резок.
  // cache(true) нигде не форсируется: Motion Canvas кеширует узел сам, когда
  // у него активный фильтр или opacity < 1.
  ghostLayer.cachePadding(24);
  ghostLayer.filters([blur(1.5)]);

  interface Copy {wrapper: Node; bf: Filter; lines: string[]; tw: number; x0: number}

  const widthOf = (lines: string[]) => Math.max(...lines.map(l => l.length)) * CW;
  const lineY = (i: number, n: number) => (i - (n - 1) / 2) * LH;

  // Txt схлопывает серии пробелов — строка с отступом уезжает влево и не
  // совпадает с блоком Manticore. Отступ поэтому переносится в координату.
  const addLine = (parent: Node, t: string, i: number, n: number, tw: number,
                   fill: string, opacity: number) => {
    const lead = t.length - t.trimStart().length;
    const node = new Txt({
      x: -tw / 2 + lead * CW, y: lineY(i, n), text: t.trimStart() || ' ',
      offset: [-1, 0], fontFamily: Fonts.code, fontSize: FS, fill, opacity,
    });
    parent.add(node);
    return node;
  };

  const mkCopy = (text: string, centerX: number, parent: Node, blur0: number): Copy => {
    const lines = text.split('\n');
    const tw = widthOf(lines);
    const bf = blur(blur0);
    // Обёртка стоит в визуальном центре блока: scale и x работают вокруг
    // центра массы, а не вокруг левого края.
    const wrapper = new Node({
      x: centerX, y: 0, opacity: 0, scale: blur0 > 0 ? IN_SCALE : 1,
    });
    wrapper.filters([bf]);
    wrapper.cachePadding(Math.max(blur0, SLAM_BLUR) * 4 + 32);
    parent.add(wrapper);
    const mc = Manticore.create(text, {
      x: -tw / 2, y: 0, width: PAD_X * 2,
      fontSize: FS, lineHeight: LH, fontFamily: Fonts.code,
      theme: CanonCodeTheme, noClip: true, cardStyle: TRANSPARENT_CARD,
      glowAccent: false, customTypes: CUSTOM_TYPES,
    });
    mc.mount(wrapper);
    mc.colorize(RULES);
    paintCanonParams(mc);
    paintCanonMethodCalls(mc);
    mc.node.opacity(1);                 // mount() создаёт контейнер с opacity 0
    return {wrapper, bf, lines, tw, x0: centerX};
  };

  // ── Motion blur: копии строк с задержкой в один…четыре кадра ────────────
  const launchTrail = (c: Copy, travel: number) => {
    const ghosts: Txt[] = [];
    const anims: ThreadGenerator[] = [];
    const k0 = mbScale(travel);
    c.lines.forEach((t, i) => {
      MB_LAGS.forEach((lag, k) => {
        const g = addLine(ghostLayer, t, i, c.lines.length, c.tw, GHOST, 0);
        g.position.x(g.position.x() + c.x0);
        ghosts.push(g);
        anims.push(chain(
          waitFor(lag),
          all(
            g.opacity(MB_OPS[k] * k0, FRAME * 2, linear),
            g.position.x(g.position.x() - c.x0, travel, easeInCubic),
          ),
          g.opacity(0, FRAME * 2, linear),
        ));
      });
    });
    spawn(chain(all(...anims), (function* () { ghosts.forEach(g => g.remove()); })()));
  };

  // ── Ореол слияния ────────────────────────────────────────────────────────
  // Замена круглому свечению: свет снимается с САМОЙ строки. Тёплая размытая
  // копия результата ложится ПОД резкую в режиме 'lighter' (канон halation).
  // Круга нет — значит нет и колец, на которые он распадался. Свет не
  // вспыхивает в момент удара, а копится, пока копии сходятся: пик приходится
  // ровно на совпадение.
  const halation = (lines: string[], tw: number, rise: number, decay: number, lead: number) => {
    const g = new Node({x: 0, y: 0, opacity: 0, compositeOperation: 'lighter'});
    g.filters([blur(13)]);
    g.cachePadding(64);
    lines.forEach((t, i) => addLine(g, t, i, lines.length, tw, HALO, 1));
    flashLayer.add(g);
    spawn(chain(
      waitFor(lead),
      g.opacity(0.36, rise, easeInOutCubic),
      g.opacity(0, decay, easeInOutCubic),
      (function* () { g.remove(); })(),
    ));
  };

  // ── Эхо исчезнувшего ─────────────────────────────────────────────────────
  // Тонко: проявляется, а не возникает; расфокусировано, чтобы читалось как
  // остаточный след, а не как ещё одна копия строки.
  const echo = (text: string, x0: number, cool: number) => {
    const lines = text.split('\n');
    const tw = widthOf(lines);
    const g = new Node({x: x0, y: 0, opacity: 0});
    g.filters([blur(2)]);
    g.cachePadding(24);
    echoLayer.add(g);
    lines.forEach((t, i) => addLine(g, t, i, lines.length, tw, GHOST, 1));
    spawn(chain(
      g.opacity(0.055, cool * 0.45, easeOutCubic),
      g.opacity(0, cool + 0.35, easeOutCubic),
      (function* () { g.remove(); })(),
    ));
  };

  // ── Пара ─────────────────────────────────────────────────────────────────
  function* runPair(i: number, f: Frag, travel: number): ThreadGenerator {
    const first = i === 0;
    const left = mkCopy(f.left, -SPREAD, codeLayer, first ? FIRST_BLUR : IN_BLUR);
    const right = mkCopy(f.right, SPREAD, codeLayer, first ? FIRST_BLUR : IN_BLUR);

    if (first) {
      // Возникновение — один жест: два мягких пятна света конденсируются в
      // две резкие одинаковые строки. Яркость не трогаем, работает только
      // фокус. Дальше короткая стойка — и пара трогается.
      left.wrapper.opacity(1);
      right.wrapper.opacity(1);
      yield* all(
        left.bf.value(0, T_SHARP, easeInOutCubic),
        right.bf.value(0, T_SHARP, easeInOutCubic),
        left.wrapper.scale(1, T_SHARP, easeInOutCubic),
        right.wrapper.scale(1, T_SHARP, easeInOutCubic),
      );
      yield* waitFor(T_GO - T_SHARP);
    }

    launchTrail(left, travel);
    launchTrail(right, travel);

    // Ускорение к центру. easeInOutCubic для копий одного и того же текста
    // не годится: он тормозит на подлёте, и последние полсимвола расхождения
    // тянутся восемь кадров — две одинаковые строки читаются как одна,
    // разбитая двойным ударом. easeInCubic держит копии раздельными до
    // последнего кадра и отдаёт удар.
    // Момент касания блоков: доля пути 1 - W/(2*SPREAD), а при easeInCubic
    // доля пути равна u³. До касания копии равноправны и обе читаемы; после
    // касания начинается наложение — обе одинаково притухают и уходят в смаз.
    const uTouch = Math.cbrt(Math.max(0.12, 1 - right.tw / (2 * SPREAD)));
    const tTouch = travel * uTouch;
    const tOver = travel - tTouch;
    const cool = coolAt(travel);

    const opCurve = (c: Copy) => chain(
      first
        ? waitFor(tTouch)               // первая пара уже стоит резкой и яркой
        : chain(
          c.wrapper.opacity(IN_OP, 0.09, linear),
          c.wrapper.opacity(1, Math.max(0.02, tTouch - 0.09), easeInCubic),
        ),
      // Возврат яркости — длиннее провала и с easeInOutCubic, и заканчивается
      // ЗАРАНЕЕ, а не в точке совпадения. С easeInCubic весь набор яркости
      // приходился на последние кадры: строки успевали сойтись ещё бледными и
      // потом скачком выходили на полную непрозрачность.
      c.wrapper.opacity(SLAM_DIP, tOver * 0.3, easeOutCubic),
      c.wrapper.opacity(1, tOver * 0.56, easeInOutCubic),
      waitFor(tOver * 0.14),
    );
    const blurCurve = (c: Copy) => chain(
      first ? waitFor(tTouch) : c.bf.value(0, tTouch, easeInCubic),
      c.bf.value(SLAM_BLUR, tOver * 0.75, easeInCubic),
      waitFor(tOver * 0.25),
    );
    const approach = (c: Copy) => all(
      c.wrapper.x(0, travel, easeInCubic),
      blurCurve(c),
      first ? waitFor(travel) : c.wrapper.scale(1, tTouch, easeInOutCubic),
      opCurve(c),
    );

    // Ореол запускается ЗАРАНЕЕ, чтобы разгореться к моменту совпадения.
    const resText = f.result ?? f.left;
    const resLines = resText.split('\n');
    const rise = Math.min(cool * 0.6, tOver * 0.8);
    halation(resLines, widthOf(resLines), rise, cool * 2, travel - rise);

    yield* all(approach(left), approach(right));

    // ── Точка совпадения ───────────────────────────────────────────────────
    let result: Copy;
    if (f.result) {
      // Разные стороны: результат приходит в ту же точку, в том же смазе.
      result = mkCopy(resText, 0, codeLayer, SLAM_BLUR);
      result.wrapper.scale(1);          // mkCopy стартует с IN_SCALE при blur > 0
      result.wrapper.opacity(1);
      left.wrapper.remove();
      right.wrapper.remove();
    } else {
      // Одинаковые: вторая копия снимается уже ПОСЛЕ совпадения — под ней
      // лежит такая же, пиксель в пиксель, и снятия не видно.
      right.wrapper.remove();
      result = left;
    }

    // Эхо — на полпути от старта к точке слияния: след держится ближе к
    // событию, а не остаётся у самых краёв кадра.
    echo(f.left, -SPREAD * ECHO_AT, cool);
    echo(f.right, SPREAD * ECHO_AT, cool);

    // ── Остывание: строка выходит из смаза в резкость ─────────────────────
    yield* result.bf.value(0, cool, easeOutCubic);

    // ── Уход результата: только гашение, строка не двигается ──────────────
    // easeInOutCubic, а не easeOutCubic: тот срывал яркость на первых же
    // кадрах и оставлял длинный еле заметный хвост — уход читался как рывок.
    yield* waitFor(holdAt(i));
    yield* result.wrapper.opacity(0, departAt(i), easeInOutCubic);
    result.wrapper.remove();
  }

  function* run(): ThreadGenerator {
    spawn(clock(zoomOver, zoomOver, linear));

    const evts = MERGE_AT.map((m, i) => ({
      t: i === 0 ? 0 : m - travelAt(i),
      run: () => { spawn(runPair(i, FRAGS[i], travelAt(i))); },
    }));
    evts.sort((a, b) => a.t - b.t);

    let now = 0;
    for (const e of evts) {
      if (e.t > now) yield* waitFor(e.t - now);
      now = e.t;
      e.run();
    }
    yield* waitFor(Math.max(0, CONVEYOR_END - now));
  }

  return {cam, run};
}
