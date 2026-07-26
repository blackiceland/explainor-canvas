import {makeScene2D, Node, Txt, blur} from '@motion-canvas/2d';
import {all, chain, createRef, easeInOutCubic, easeInOutSine, easeOutSine, linear, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {Manticore} from '../core/code/components/Manticore';
import {CanonCodeTheme, buildCanonRules, paintCanonParams, paintCanonMethodCalls} from '../core/code/model/paletteCanon';
import {getCodePaddingX} from '../core/code/shared/TextMeasure';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// Открытие видео YOUR NULL MEANS TOO MUCH.
//   1. Канон-эпиграф: «Null is nothing, represented as something.»
//   2. Камера медленно наезжает на слово Null, остальные слова растворяются.
//      Слово — still point: центр-пивот, не двигается ни на пиксель до конца.
//   3. N→n (слово становится ключевым словом) — и вокруг него код-таймлапс с
//      ghost-хвостами (идиома flagYudanTimelapseSceneRu). Контексты пивот-строки
//      идут в порядке VO: return / store / compare / pass. null остаётся бежевым
//      (чужеродное тело проходит сквозь систему не меняясь). Зум не встаёт.
//   4. Финал: система гаснет, null один и крупный.
//   VO: "Null is nothing, represented as something. / We can return it, store
//   it, compare it, and pass it through an entire system. / And because it
//   looks so simple, we rarely notice how much meaning we ask it to carry."
//
// ТАЙМИНГ (правка автора): null начинает движение в центр на ~3.6с, сцена
// заканчивается на ~13.4с — подход и таймлапс СЛИТЫ в один непрерывный ~9.6с
// проход (таймлапс стартует в тот же момент, что и смещение Null). Зум не
// прерывается ни разу.

// ── Эпиграф ──────────────────────────────────────────────────────────────
const FS = 60;                       // канон; код таймлапса живёт в том же кегле
const LH = 88;
const CH = FS * 0.6;                 // advance JetBrains Mono = ровно 0.6em
const BEIGE = 'rgba(232, 207, 174, 0.96)';

const WORD = 'Null';
const REST = ' is nothing, represented as something.';
const LINE_LEFT = -((WORD.length + REST.length) * CH) / 2;   // 42 зн. → −756
const PIVOT_LEFT = LINE_LEFT;                                // null — первое слово

// ── Таймлапс ─────────────────────────────────────────────────────────────
// ⚠️ БЛОК НЕ СМЕЩАЕТСЯ (правка автора): каждая голова — РОВНО 15 моно-знаков,
// поэтому measureText(head) одинаков для всех → левое поле файла фиксировано,
// null всегда в одной колонке (центр), ничего не «ездит». Все строки флаш-
// левые на ОДНОМ настоящем поле — это и есть «правильные позиции отступов»
// (верхнеуровневые операторы, без вложенности). Голову/хвост якорим по
// measureText к краям null (иначе появляется щель — advance Manticore ≠ 0.6em).
// Пивот-контексты — глаголы VO (return / store / compare / pass), потом файл
// живёт дальше. Все головы = 15 знаков → null в одной колонке.
const CONTEXTS: Array<{head: string; tail: string}> = [
  {head: 'return user ?: ', tail: ''},   // ...return it
  {head: 'this.current = ', tail: ''},   // ...store it
  {head: 'if (current == ', tail: ')'},  // ...compare it
  {head: 'service.handle(', tail: ')'},  // ...pass it
  {head: 'val previous = ', tail: ''},   // ...through an
  {head: 'events.publish(', tail: ')'},  // ...entire system
];

// Соседние строки системы — без null: его уникальность держит пивот.
const NEIGHBOR_POOL = [
  'val user = users.find(id)',
  'session.touch(actor)',
  'log.debug("load", id)',
  'cache.evict(key)',
  'metrics.increment("get")',
  'val order = repo.load(id)',
  'response.render(order)',
  'queue.publish(event)',
  'val token = auth.issue(id)',
  'retries.reset(actor)',
];

const RULES = buildCanonRules({
  types: [],
  methods: ['handle', 'publish', 'find', 'touch', 'debug', 'evict', 'increment', 'load', 'render', 'issue', 'reset'],
  vars: ['user', 'users', 'id', 'current', 'previous', 'events', 'service', 'session', 'actor', 'log', 'cache', 'key', 'metrics', 'order', 'repo', 'response', 'queue', 'event', 'token', 'auth', 'retries'],
});

const TRANSPARENT_CARD = {
  radius: 0, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)', strokeWidth: 0,
  edge: false, opacity: 0, shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
  shadowOffsetX: 0, shadowOffsetY: 0,
} as const;

const W = 1200;
const PAD_X = getCodePaddingX(FS);
const CONTENT_OFF = W / 2 - PAD_X;

// Ghost-хвосты (slow-shutter из flagYudanTimelapseSceneRu, укороченные).
const TRAIL = 7;
const SHUTTER = 0.8;
const GHOST_BLUR = 2;
const THROW = 340;                   // короче прежнего — мягче, менее «свишит»
const N_OP = 0.18;                   // яркость соседей системы (тусклый фон)
const PIVOT_OP = 0.6;                // код пивот-строки вокруг null (тусклее null → null самый яркий)
const GLOW_WARM = 'rgba(255, 228, 190, 1)'; // тёплый свет халации под null
const GLOW_BLUR = 16;                // мягкость свечения
const GLOW_OP = 0.22;                // ЛЕГЧАЙШИЙ глоу — null чуть сильнее выделяется

// Зум: непрерывный наезд, пивот (центр null) прибит к экран-центру
// (pos = −pivot·scale, одинаковые dur/easing на scale и pos → точный пиннинг).
const S_MID = 1.22;                  // конец подхода: null пришёл в центр
const S_END = 1.62;                  // конец таймлапса: null занимает всё больше

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ⚠️ Реальный advance измеряем В РАНТАЙМЕ (measureText в проекте = length·0.6em,
  // но рендер грузит НЕ JetBrains Mono, а системный monospace ≈0.55em → щели;
  // к тому же редактор и рендер могут отличаться). Txt-проба самокорректируется
  // в обоих контекстах. Головы = 15 зн. → HEAD_X константа (0 сдвига), хвост и
  // центр null якорим к тому же advance.
  const probe = new Txt({text: '0000000000', fontFamily: Fonts.code, fontSize: FS, opacity: 0});
  view.add(probe);
  const ADV = probe.width() / 10;
  probe.remove();
  const HEAD_LEN = CONTEXTS[0].head.length;   // 15 у всех
  const HEAD_X = PIVOT_LEFT - HEAD_LEN * ADV; // единое левое поле файла
  const TAIL_X = PIVOT_LEFT + 4 * ADV;        // правый край null
  const NULL_CX = PIVOT_LEFT + 2 * ADV;       // истинный центр null (пивот камеры)

  const cam = createRef<Node>();
  const ghostLayer = createRef<Node>();
  const codeLayer = createRef<Node>();
  const textLayer = createRef<Node>();
  const nbRoot = createRef<Node>();
  const nbGhostLayer = createRef<Node>();
  const nbCodeLayer = createRef<Node>();
  view.add(<Node ref={cam} />);
  cam().add(<Node ref={nbRoot} />);
  nbRoot().add(<Node ref={nbGhostLayer} />);
  nbRoot().add(<Node ref={nbCodeLayer} />);
  cam().add(<Node ref={ghostLayer} />);
  cam().add(<Node ref={codeLayer} />);
  cam().add(<Node ref={textLayer} />);
  ghostLayer().cache(true);
  ghostLayer().cachePadding(GHOST_BLUR * 2 + 16);
  ghostLayer().filters([blur(GHOST_BLUR)]);
  nbGhostLayer().cache(true);
  nbGhostLayer().cachePadding(GHOST_BLUR * 2 + 16);
  nbGhostLayer().filters([blur(GHOST_BLUR)]);
  // соседи — на том же левом поле HEAD_X, что и пивот-строка; поле НЕ двигается.
  nbRoot().position.x(HEAD_X);

  // ── Эпиграф: одна центрованная строка, разрезанная на пивот и остаток ──
  const nullCap = new Txt({text: 'Null', x: PIVOT_LEFT, y: 0, offset: [-1, 0], fontFamily: Fonts.code, fontSize: FS, fill: BEIGE, opacity: 0});
  const nullLow = new Txt({text: 'null', x: PIVOT_LEFT, y: 0, offset: [-1, 0], fontFamily: Fonts.code, fontSize: FS, fill: BEIGE, opacity: 0});
  // ⚠️ Легчайшая ХАЛАЦИЯ под null: тёплый размытый дубль, additive (lighter) —
  // мягкий свет ВОКРУГ null, не дешёвый неон-shadow. В textLayer → растёт с
  // наездом вместе с null. Проявляется на still-point (с nullLow), держится.
  const nullGlow = new Txt({text: 'null', x: PIVOT_LEFT, y: 0, offset: [-1, 0], fontFamily: Fonts.code, fontSize: FS, fill: GLOW_WARM, opacity: 0, filters: [blur(GLOW_BLUR)], compositeOperation: 'lighter'});
  const rest = new Txt({text: REST, x: TAIL_X, y: 0, offset: [-1, 0], fontFamily: Fonts.code, fontSize: FS, fill: BEIGE, opacity: 0});
  textLayer().add(rest);
  textLayer().add(nullGlow);       // за глифами null
  textLayer().add(nullCap);
  textLayer().add(nullLow);

  const mkFrag = (text: string, x: number, y: number, parent: Node = codeLayer()): Manticore => {
    const mc = Manticore.create(text || ' ', {
      x, y, width: W, fontSize: FS, lineHeight: LH, fontFamily: Fonts.code,
      theme: CanonCodeTheme, noClip: true, cardStyle: TRANSPARENT_CARD,
      glowAccent: false, contentOffsetX: CONTENT_OFF,
    });
    mc.mount(parent);
    mc.colorize(RULES);
    paintCanonParams(mc);
    paintCanonMethodCalls(mc);
    return mc;
  };

  const comb = (text: string, y: number, sx: number, ex: number, dur: number, op0: number, layer: Node = ghostLayer()) => {
    const anims: ThreadGenerator[] = [];
    const ghosts: Txt[] = [];
    for (let k = 1; k <= TRAIL; k++) {
      const op = (SHUTTER / (k * 0.72 + 0.55)) * op0;
      const g = new Txt({x: sx, y, text: text || ' ', offset: [-1, 0], fontFamily: Fonts.code, fontSize: FS, fill: `rgba(242,240,235,${op})`});
      layer.add(g);
      ghosts.push(g);
      anims.push(chain(waitFor(k * 0.024), all(g.position.x(ex, dur, linear), g.opacity(0, dur, linear))));
    }
    return {anims, ghosts};
  };

  // ── Пивот-контекст: голова слева от null (поле HEAD_X), хвост справа ──
  let headMC: Manticore | null = null;
  let headText = '';
  let tailMC: Manticore | null = null;
  let tailText = '';

  function* setContext(idx: number, dur: number): ThreadGenerator {
    const ctx = CONTEXTS[idx];
    const anims: ThreadGenerator[] = [];
    const trash: Txt[] = [];
    const dying: Manticore[] = [];
    if (headMC) {
      const g = comb(headText, 0, HEAD_X, HEAD_X - THROW, dur, PIVOT_OP);
      trash.push(...g.ghosts);
      anims.push(...g.anims, headMC.node.opacity(0, dur * 0.32, linear));
      dying.push(headMC);
      headMC = null;
    }
    if (tailMC) {
      const tx = TAIL_X;
      const g = comb(tailText, 0, tx, tx + THROW, dur, PIVOT_OP);
      trash.push(...g.ghosts);
      anims.push(...g.anims, tailMC.node.opacity(0, dur * 0.32, linear));
      dying.push(tailMC);
      tailMC = null;
    }
    if (ctx.head) {
      const mc = mkFrag(ctx.head, HEAD_X, 0);
      mc.node.opacity(0);
      const g = comb(ctx.head, 0, HEAD_X - THROW, HEAD_X, dur, PIVOT_OP);
      trash.push(...g.ghosts);
      anims.push(...g.anims, chain(waitFor(dur * 0.55), mc.node.opacity(PIVOT_OP, dur * 0.45, easeOutSine)));
      headMC = mc;
    }
    headText = ctx.head;
    if (ctx.tail) {
      const tx = TAIL_X;
      const mc = mkFrag(ctx.tail, tx, 0);
      mc.node.opacity(0);
      const g = comb(ctx.tail, 0, tx + THROW, tx, dur, PIVOT_OP);
      trash.push(...g.ghosts);
      anims.push(...g.anims, chain(waitFor(dur * 0.55), mc.node.opacity(PIVOT_OP, dur * 0.45, easeOutSine)));
      tailMC = mc;
    }
    tailText = ctx.tail;
    yield* all(...anims);
    dying.forEach(m => m.node.remove());
    trash.forEach(g => g.remove());
  }

  // ── Соседи системы: тусклые строки над/под пивотом, непрерывный чурн ────
  const slotY = [-3 * LH, -2 * LH, -LH, LH, 2 * LH, 3 * LH];
  const nbMC: (Manticore | null)[] = slotY.map(() => null);
  const nbText: string[] = slotY.map(() => '');
  let churnActive = false;
  let seqPtr = 0;

  // Кандидат не должен совпадать ни с одной ВИДИМОЙ строкой системы — иначе в
  // кадре встречаются два одинаковых соседа.
  const pickNb = (slot: number, seq: number): string => {
    for (let t = 0; t < NEIGHBOR_POOL.length; t++) {
      const h = (Math.imul(seq + t + 1, 2654435761) ^ Math.imul(slot + 1, 40503)) >>> 0;
      const cand = NEIGHBOR_POOL[h % NEIGHBOR_POOL.length];
      if (!nbText.includes(cand)) return cand;
    }
    return NEIGHBOR_POOL[(seq + slot) % NEIGHBOR_POOL.length];
  };

  function* setNeighbor(slot: number, text: string, dur: number, dir: number): ThreadGenerator {
    const y = slotY[slot];
    const anims: ThreadGenerator[] = [];
    const trash: Txt[] = [];
    const old = nbMC[slot];
    if (old) {
      const g = comb(nbText[slot], y, 0, dir * THROW, dur, N_OP, nbGhostLayer());
      trash.push(...g.ghosts);
      anims.push(...g.anims, old.node.opacity(0, dur * 0.32, linear));
    }
    const mc = mkFrag(text, 0, y, nbCodeLayer());
    mc.node.opacity(0);
    const g = comb(text, y, -dir * THROW, 0, dur, N_OP, nbGhostLayer());
    trash.push(...g.ghosts);
    anims.push(...g.anims, chain(waitFor(dur * 0.55), mc.node.opacity(N_OP, dur * 0.45, easeOutSine)));
    nbMC[slot] = mc;
    nbText[slot] = text;
    yield* all(...anims);
    old?.node.remove();
    trash.forEach(gh => gh.remove());
  }

  function* neighborLoop(slot: number): ThreadGenerator {
    yield* waitFor(0.5 + slot * 0.32);
    while (churnActive) {
      const seq = seqPtr++;
      yield* setNeighbor(slot, pickNb(slot, seq), 0.5, seq % 2 === 0 ? 1 : -1);
      yield* waitFor(0.45 + ((slot * 0.618 + seq * 0.382) % 1) * 0.4);
    }
  }

  // ═══ 1. Эпиграф ════════════════════════════════════════════════════════
  yield* all(nullCap.opacity(1, 0.5, easeInOutCubic), rest.opacity(1, 0.5, easeInOutCubic));
  yield* waitFor(3.1);                                    // → null стартует ~3.6с

  // ═══ 2+3. Подход СЛИТ с таймлапсом: null едет в центр, код уже приземляется,
  //          зум идёт непрерывно ~9.6с. Никаких длинных пауз-приземлений. ═══
  churnActive = true;
  yield* all(
    // непрерывная камера: подход (2.0с, null→центр) → таймлапс-зум (7.6с, пин)
    chain(
      all(
        cam().scale(S_MID, 2.0, easeInOutSine),
        cam().position.x(-NULL_CX * S_MID, 2.0, easeInOutSine),
      ),
      all(
        cam().scale(S_END, 7.6, linear),
        cam().position.x(-NULL_CX * S_END, 7.6, linear),
      ),
    ),
    // остаток фразы растворяется, пока null уходит в центр
    rest.opacity(0, 1.2, easeInOutSine),
    // код-события
    chain(
      // первый контекст приземляется В ТОТ ЖЕ МОМЕНТ, что и старт движения Null
      all(
        nullCap.opacity(0, 0.35, linear),
        nullLow.opacity(1, 0.35, linear),
        nullGlow.opacity(GLOW_OP, 0.35, linear),   // легчайшая халация зажигается со still-point null
        setContext(0, 0.8),
      ),
      // ровный поток контекстов, короткие холды — таймлапс течёт, не дёргается
      (function* (): ThreadGenerator {
        for (let i = 1; i < CONTEXTS.length; i++) {
          yield* waitFor(0.62);
          yield* setContext(i, 0.78);
        }
      })(),
      (function* (): ThreadGenerator { churnActive = false; })(),
      // финал: система гаснет — null остаётся один (зум ещё идёт)
      (function* (): ThreadGenerator {
        const outs: ThreadGenerator[] = [];
        if (headMC) outs.push(headMC.node.opacity(0, 1.1, easeInOutSine));
        if (tailMC) outs.push(tailMC.node.opacity(0, 1.1, easeInOutSine));
        nbMC.forEach(m => { if (m) outs.push(m.node.opacity(0, 1.1, easeInOutSine)); });
        yield* all(...outs);
      })(),
    ),
    ...slotY.map((_, i) => neighborLoop(i)),
  );

  // ═══ 4. Финал: null один и крупный — конец сцены ~13.6с ════════════════
  yield* waitFor(0.42);
});
