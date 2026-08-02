import {blur, makeScene2D, Node} from '@motion-canvas/2d';
import {all, chain, createRef, createSignal, easeInCubic, easeInOutCubic, easeOutCubic, linear, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {Manticore} from '../core/code/components/Manticore';
import {Canon, CanonCodeTheme, buildCanonRules, paintCanonParams, paintCanonMethodCalls} from '../core/code/model/paletteCanon';
import {getCodePaddingX, measureText} from '../core/code/shared/TextMeasure';
import {applyBackground} from '../core/utils';
import {Fonts} from '../core/theme';

// ── DON'T FIGHT DUPLICATION · опенинг-таймлапс слияний ──────────────────────
// СИММЕТРИЧНЫЙ мердж: две одинаковые копии блока сходятся к центру и садятся
// друг в друга пиксель-в-пиксель — двойной оттиск сходится в один чистый блок.
// Точка слияния неподвижна (still point), камера не двигается.
// Пустых кадров нет: слитый блок утапливается в глубину (scale+fade) В ТО ЖЕ
// время, как следующая пара уже проявилась по бокам и сходится — конвейер
// слияний течёт сквозь центр. Ускоряется ЧАСТОТА слияний, не жест.
// Финал: последняя пара слилась — и всё останавливается. Тишина, уход.
//
// Правило контента: каждый блок — дубликат, который можно НАЗВАТЬ (метод
// экстракции в комменте). Голых стейтментов нет — сливаются только блоки.
// Копии идентичны: «похожи, но не одинаковы» — аргумент 3:20, в интро
// слияние выглядит чисто и приятно.

const FS = 60;                       // кегль duplicationHateIntroScene — одна линия мысли
const LH = Math.round(FS * 1.35);    // 81
const SPREAD = 430;                  // старт копий: центры на ±SPREAD, сходятся к 0
const PAD_X = getCodePaddingX(FS);

const CUSTOM_TYPES = ['Tag', 'Buf', 'Bad', 'T'];
const RULES = [
  ...buildCanonRules({types: CUSTOM_TYPES}),
  // Java-словарь, которого нет в котлин-каноне.
  {match: /^(new|int)$/, color: Canon.keyword},
];

const TRANSPARENT_CARD = {
  radius: 0, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)', strokeWidth: 0,
  edge: false, opacity: 0, shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
  shadowOffsetX: 0, shadowOffsetY: 0,
} as const;

// Каждый раунд — блок с очевидной экстракцией. ≤20 знаков в строке: пара
// копий при ширине ≤720px и SPREAD 430 целиком живёт в safe-zone.
const CONTENTS: string[] = [
  ['if (temporary) {', '  retry();', '}'],                                                  // retryIfTemporary()
  ['s = trim(s);', 's = lower(s);'],                                                        // normalize(s)
  ['try {', '  charge();', '} catch (e) {', '  fail();', '}'],                              // runOrFail()
  ['if (v == null) {', '  v = DEFAULT;', '}'],                                              // orDefault(v)
  ['t = tags.get(k);', 'if (t == null) {', '  t = new Tag(k);', '  tags.put(k, t);', '}'],  // computeIfAbsent(k)
  ['audit("save", id);', 'metrics.inc("save");'],                                           // track(op, id)
  ['h = sha(body);', 'if (h != sig) {', '  return FORGED;', '}'],                           // verify(body, sig)
  ['if (n > MAX) {', '  n = MAX;', '}'],                                                    // clamp(n)
  ['s = open(src);', 'copy(s);', 's.close();'],                                             // withStream(path)
  ['lock.lock();', 'try {', '  commit();', '} finally {', '  lock.unlock();', '}'],         // guarded(...)
  ['for (T x : items) {', '  visit(x);', '}'],                                              // visitAll(items)
  ['b = new Buf();', 'b.add(head);', 'return b.done();'],                                   // assemble(head)
  ['if (!ok(req)) {', '  return BAD;', '}'],                                                // validate(req)
  ['ctx.push(scope);', 'body.run();', 'ctx.pop();'],                                        // inScope(scope, body)
  ['tmp = a;', 'a = b;', 'b = tmp;'],                                                       // swap(a, b)
  ['if (v < 0) {', '  throw new Bad(v);', '}'],                                             // requirePositive(v)
  ['c = conn.get();', 'run(c);', 'c.close();'],                                             // withConn(...)
  ['if (t == null) {', '  t = clock();', '}'],                                              // nowIfAbsent(t)
  ['out.write(head);', 'out.write(body);', 'out.flush();'],                                 // emit(head, body)
  ['try {', '  parse(s);', '} catch (e) {', '  return null;', '}'],                         // tryParse(s)
  ['sum = 0;', 'for (int x : v) {', '  sum += x;', '}'],                                    // total(v)
  ['if (dirty) {', '  save(doc);', '  dirty = false;', '}'],                                // flushIfDirty()
  ['w.begin();', 'render(node);', 'w.end();'],                                              // draw(node)
  ['if (seen.has(id)) {', '  return;', '}'],                                                // skipIfSeen(id)
].map(ls => ls.join('\n'));

// Расписание — авторский темп оригинальной сцены: разогрев 0.9 ×0.82 с
// холдами 0.25/0.18 и вдохом 0.06, строб 0.14 ×0.86 до пола 0.04 с холдом
// 0.02. Проявление = 22% съезда (пол 0.08), как в оригинале.
const WARMUP = 10;
const travelAt = (r: number) =>
  r < WARMUP ? 0.9 * Math.pow(0.82, r) : Math.max(0.04, 0.14 * Math.pow(0.86, r - WARMUP));
const enterAt = (r: number) => Math.max(0.08, travelAt(r) * 0.22);
const holdAt = (r: number) => (r < 3 ? 0.25 : r < WARMUP ? 0.18 : 0.02);
const gapAt = (r: number) => (r < WARMUP ? 0.06 : 0);
// Уход в глубину — не критический путь: вписывается во вход следующей пары.
const recedeFor = (enter: number, travel: number) =>
  Math.min(0.45, Math.max(0.08, (enter + travel) * 0.85));

export default makeScene2D(function* (view) {
  applyBackground(view);

  const codeRoot = createRef<Node>();
  view.add(<Node ref={codeRoot} />);

  interface Copy { wrapper: Node; mc: Manticore; }

  // Копия блока: обёртка стоит в centerX (вижуал-центр), Manticore внутри
  // отцентрован — scale/x обёртки работают вокруг центра массы блока.
  const mkCopy = (text: string, centerX: number): Copy => {
    const lines = text.split('\n');
    const tw = Math.max(...lines.map(l => measureText(l, FS)));
    const wrapper = new Node({x: centerX, y: 0});
    codeRoot().add(wrapper);
    const mc = Manticore.create(text, {
      // Manticore центрует контент вокруг node.y (проверено рендером) — y=0
      // кладёт центр массы блока ровно на центральную горизонталь при любом
      // числе строк. НЕ компенсировать «под line 0».
      x: -tw / 2, y: 0, width: PAD_X * 2,        // width=2·pad ⇒ текст-левый край = node.x
      fontSize: FS, lineHeight: LH, fontFamily: Fonts.code,
      theme: CanonCodeTheme, noClip: true, cardStyle: TRANSPARENT_CARD,
      glowAccent: false, customTypes: CUSTOM_TYPES,
    });
    mc.mount(wrapper);
    mc.colorize(RULES);
    paintCanonParams(mc);
    paintCanonMethodCalls(mc);
    mc.node.opacity(1);                          // mount() создаёт контейнер с opacity 0
    return {wrapper, mc};
  };

  // Слитый блок предыдущего раунда утапливается в глубину, пока следующая
  // пара уже сходится, — экран не пустеет ни на кадр. Разделение планов по
  // фокусу (rack-focus): яркость сбрасывается сразу (easeOut) и блок уходит в
  // блюр — пересечение с резкими копиями читается как задний план, не каша.
  function* recede(f: Copy, dur: number): ThreadGenerator {
    const b = createSignal(0);
    f.wrapper.cache(true);
    f.wrapper.filters(() => [blur(b())]);
    yield* all(
      f.wrapper.scale(0.93, dur, easeInCubic),
      f.wrapper.opacity(0, dur, easeOutCubic),
      b(5, dur, easeOutCubic),
    );
    f.wrapper.remove();
  }

  let fused: Copy | null = null;

  for (let r = 0; r < CONTENTS.length; r++) {
    const text = CONTENTS[r];
    const C = travelAt(r);
    const E = enterAt(r);

    const left = mkCopy(text, -SPREAD);
    const right = mkCopy(text, SPREAD);
    left.wrapper.opacity(0);
    right.wrapper.opacity(0);

    const prev = fused;
    fused = null;

    if (r === 0) {
      // Первое слияние — обучающее: медленное проявление, длинная пауза
      // (зритель читает ДВЕ одинаковые копии), потом первый съезд.
      yield* all(
        left.wrapper.opacity(1, 0.9, easeOutCubic),
        right.wrapper.opacity(1, 0.9, easeOutCubic),
      );
      yield* waitFor(2.0);
      yield* all(
        left.wrapper.x(0, C, easeInOutCubic),
        right.wrapper.x(0, C, easeInOutCubic),
      );
    } else {
      yield* all(
        prev ? recede(prev, recedeFor(E, C)) : waitFor(0),
        chain(
          all(
            left.wrapper.opacity(1, E, easeOutCubic),
            right.wrapper.opacity(1, E, easeOutCubic),
          ),
          all(
            left.wrapper.x(0, C, easeInOutCubic),
            right.wrapper.x(0, C, easeInOutCubic),
          ),
        ),
      );
    }

    // Посадка в регистр: копии совпали, верхняя гаснет — остаётся один
    // чистый блок (короткое уплотнение штриха и всё).
    yield* right.wrapper.opacity(0, 0.06, linear);
    right.wrapper.remove();
    fused = left;

    yield* waitFor(holdAt(r) + gapAt(r));
  }

  // ── Резкая остановка: последний слитый блок один, тишина, уход ───────────
  yield* waitFor(1.35);
  yield* codeRoot().opacity(0, 0.7, easeInOutCubic);
  yield* waitFor(0.25);
});
