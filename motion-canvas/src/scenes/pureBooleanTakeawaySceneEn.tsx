import {Node, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  easeInOutCubic,
  easeInOutSine,
  easeOutCubic,
  makeRef,
  waitFor,
} from '@motion-canvas/core';
import {Manticore} from '../core/code/components/Manticore';
import {
  CanonCodeTheme,
  buildCanonRules,
  paintCanonParams,
  paintCanonMethodCalls,
} from '../core/code/model/paletteCanon';
import {Fonts, Colors, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

// ── Palette ─────────────────────────────────────────────────────────────
// Тёмный полюс = графитовый фон (сливается — так и задумано). Светлый — костяной.
const DARK_POLE = '#0F1116';   // ≈ графитовый фон
const LIGHT_POLE = '#ECE6DA';  // костяной беж
const CREAM     = '#F4F1EB';
const WARM      = 'rgba(232, 207, 174, 0.96)';
const WARM_MUTED = 'rgba(232, 207, 174, 0.55)';
// Текст на бежевой (светлой) половине — тёмный:
const INK_HEAD  = '#1B1712';
const INK_BODY  = '#2E2A22';
const INK_DASH  = 'rgba(27, 23, 18, 0.42)';

const FLAT_CARD = {
  radius: 0,
  fill: 'rgba(0,0,0,0)',
  stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0,
  edge: false,
  opacity: 0,
  shadowColor: 'rgba(0,0,0,0)',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
} as const;

// Линейная интерполяция двух hex (единственная в проекте — из chapter2IntroScene).
function mixHex(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const p = (s: string) => ({
    r: parseInt(s.slice(1, 3), 16),
    g: parseInt(s.slice(3, 5), 16),
    b: parseInt(s.slice(5, 7), 16),
  });
  const x = p(a), y = p(b);
  const c = (u: number, v: number) => Math.round(u + (v - u) * k);
  return `rgb(${c(x.r, y.r)}, ${c(x.g, y.g)}, ${c(x.b, y.b)})`;
}

// ── Full-screen grade geometry ──────────────────────────────────────────
const N   = 6;
const VW  = 1920;
const VH  = 1080;
const SEG = VW / N;                                   // 320
const segLeft = (i: number): number => -VW / 2 + i * SEG;      // left edge of segment i
const segCenter = (i: number): number => segLeft(i) + SEG / 2; // -800..800
// Lifecycle states written onto each grade (contrast flips with the tone).
const DOMAIN6 = ['DRAFT', 'SCHEDULED', 'SENDING', 'PAUSED', 'DELIVERED', 'ARCHIVED'];
const labelFill = (i: number): string =>
  i <= 2 ? 'rgba(244,241,235,0.82)' : 'rgba(20,17,13,0.82)';

// ── Legit-boolean code (composition & indentation kept clean) ───────────
const CODE_MAIN = `fun setCommentsEnabled(
    postId: PostId,
    enabled: Boolean,
) {
    posts.updateCommentsEnabled(
        postId = postId,
        enabled = enabled,
    )
}`;

const CODE_RULES = buildCanonRules({
  types: ['PostId', 'Boolean'],
  methods: ['setCommentsEnabled', 'updateCommentsEnabled'],
  vars: ['postId', 'enabled', 'posts'],
});

// ── Criteria (light half) ───────────────────────────────────────────────
const CRITERIA_HEAD = 'A boolean is clean when it';
const CRITERIA = [
  'names one honest binary fact',
  'has two clear, symmetric values',
  'never chooses the operation',
  'never disables a required rule',
  'never hides several decisions',
];

// ── Takeaway ────────────────────────────────────────────────────────────
const TAKE_TITLE = 'Takeaways';
const POINTS = [
  'A boolean is fine when the question is genuinely binary.',
  'If the flag chooses the operation, give the operations separate names.',
  'The higher the cost of a wrong value, the more explicit the decision.',
  'When one flag carries several meanings, the model has outgrown it.',
];

// ── Further reading ─────────────────────────────────────────────────────
// Живёт в ОДНОМ такте с takeaways: две колонки (takeaways слева | этот список
// справа), потом обе гаснут в тезис.
const READ_TITLE = 'Further reading';
const BOOKS = [
  {title: 'Refactoring', meta: 'Martin Fowler · 2nd Edition'},
  {title: 'A Philosophy of Software Design', meta: 'John Ousterhout'},
  {title: 'Domain Modeling Made Functional', meta: 'Scott Wlaschin'},
];

// ═══════════════════════════════════════════════════════════════════════
export default makeScene2D(function* (view) {
  applyBackground(view);

  // ── The whole screen becomes a grade: graphite → bone ─────────────────
  // DRAFT (полюс false) = РОВНО фон сцены. Не воспроизводим фон заливкой (у
  // applyBackground два слоя — линейный градиент + тёплый радиальный спот, и
  // одна только линейная копия выходит темнее). seg0 прозрачен → сквозь него
  // виден настоящий фон, оба слоя, пиксель-в-пиксель.
  const TRANSPARENT = 'rgba(0,0,0,0)';

  const ramp = createRef<Node>();
  const segs: Rect[] = [];
  const segLbls: Txt[] = [];
  view.add(
    <Node ref={ramp}>
      {Array.from({length: N}, (_, i) => (
        <Rect ref={makeRef(segs, i)} x={segLeft(i)} y={0} offset={[-1, 0]}
              width={SEG} height={VH}
              fill={i === 0 ? TRANSPARENT : mixHex(DARK_POLE, LIGHT_POLE, i / (N - 1))}
              opacity={i === 0 ? 1 : 0} />
      ))}
      {DOMAIN6.map((d, i) => (
        <Txt ref={makeRef(segLbls, i)} x={segCenter(i)} y={0} text={d}
             fontFamily={Fonts.code} fontSize={22} letterSpacing={2}
             fill={labelFill(i)} opacity={0} />
      ))}
    </Node>,
  );

  // DRAFT (seg0) IS the background — already here from frame 0. Name it, then ADD
  // the gradients that live beyond the false pole, one step at a time, left →
  // right: reality holds more than two states between false and true.
  yield* segLbls[0].opacity(1, 0.38, easeInOutSine);
  for (let i = 1; i < N; i++) {
    yield* all(
      segs[i].opacity(1, 0.38, easeInOutSine),
      segLbls[i].opacity(1, 0.38, easeInOutSine),
    );
  }
  yield* waitFor(1.6);

  // ── Collapse to two: graphite (false) | bone (true) ───────────────────
  // Direction matters: many states → the middle vanishes → two opposites.
  yield* all(
    // the state labels fade as their tones merge
    ...segLbls.map(t => t.opacity(0, 0.5, easeInOutSine)),
    // middle segments collapse to nothing
    segs[1].width(0, 0.9, easeInOutCubic),
    segs[2].width(0, 0.9, easeInOutCubic),
    segs[3].width(0, 0.9, easeInOutCubic),
    segs[4].width(0, 0.9, easeInOutCubic),
    segs[1].position.x(0, 0.9, easeInOutCubic),
    segs[2].position.x(0, 0.9, easeInOutCubic),
    segs[3].position.x(0, 0.9, easeInOutCubic),
    segs[4].position.x(0, 0.9, easeInOutCubic),
    // graphite (= background) grows to the left half, bone to the right half
    segs[0].width(VW / 2, 0.9, easeInOutCubic),
    segs[5].position.x(0, 0.9, easeInOutCubic),
    segs[5].width(VW / 2, 0.9, easeInOutCubic),
    segs[5].fill(LIGHT_POLE, 0.9, easeInOutSine),
  );
  yield* waitFor(1.2);

  // ── Left (graphite): the clean boolean ────────────────────────────────
  const mainMC = Manticore.create(CODE_MAIN, {
    x: -472, y: 0, width: 760,
    fontSize: 27, lineHeight: 39, fontFamily: Fonts.code,
    theme: CanonCodeTheme, noClip: true, glowAccent: false, cardStyle: FLAT_CARD,
    customTypes: ['PostId', 'Boolean'],
  });
  mainMC.mount(view);
  mainMC.colorize(CODE_RULES);
  paintCanonParams(mainMC);
  paintCanonMethodCalls(mainMC);
  mainMC.node.opacity(0);

  // ── Right (bone): the criteria for a clean boolean ────────────────────
  const criteria = createRef<Node>();
  const critHead = createRef<Txt>();
  const critRows: Node[] = [];
  const CRIT_X = 250;
  view.add(
    <Node ref={criteria}>
      <Txt ref={critHead} x={CRIT_X} y={-196} text={CRITERIA_HEAD} fontFamily={Fonts.primary}
           fontSize={31} fontWeight={600} fill={INK_HEAD} offset={[-1, 0]} textAlign={'left'} opacity={0} />
      {CRITERIA.map((c, i) => (
        <Node ref={makeRef(critRows, i)} opacity={0}>
          <Txt x={CRIT_X} y={-92 + i * 66} text={'—'} fontFamily={Fonts.code}
               fontSize={25} fill={INK_DASH} offset={[-1, 0]} textAlign={'left'} />
          <Txt x={CRIT_X + 44} y={-92 + i * 66} text={c} fontFamily={Fonts.code}
               fontSize={25} fill={INK_BODY} offset={[-1, 0]} textAlign={'left'} />
        </Node>
      ))}
    </Node>,
  );

  yield* mainMC.node.opacity(1, 0.6, easeInOutSine);
  yield* waitFor(0.5);
  yield* critHead().opacity(1, 0.45, easeInOutSine);
  for (let i = 0; i < CRITERIA.length; i++) {
    yield* critRows[i].opacity(1, 0.32, easeInOutSine);
    yield* waitFor(0.22);
  }
  yield* waitFor(2.6);

  // ── The dark half pushes the light one off; the takeaway lands ────────
  yield* mainMC.node.opacity(0, 0.5, easeInOutSine);
  yield* all(
    segs[0].width(VW, 1.0, easeInOutCubic),               // graphite expands right
    segs[5].position.x(VW, 1.0, easeInOutCubic),          // bone panel slides off
    criteria().position.x(criteria().position.x() + VW, 1.0, easeInOutCubic),
  );
  criteria().remove();
  yield* waitFor(0.3);

  // ── Takeaways (left) + Further reading (right) — one beat ─────────────
  // Единая типографика: обе шапки Fonts.primary/56/cream, всё тело — Fonts.code/28.
  // Обе колонки на ОДНОЙ строчной сетке rowY(i)=ROW0+i·PITCH, строки заметок и
  // строки книг стоят на одних линиях (название книги ↔ 1-я строка заметки,
  // автор ↔ 2-я строка; HALF=lineHeight/2 разносит пару). Further reading
  // проявляется ПОСЛЕ того как выехал весь текст takeaway.
  const LEFT_X = -860;
  const READ_X = 170;
  const NOTE_W = 780;
  const HEAD_Y = -350;
  const ROW0 = -200;   // центр первой строки тела
  const PITCH = 116;   // шаг строк
  const HALF = 21;     // половина lineHeight(42) — разносит две линии книги
  const rowY = (i: number): number => ROW0 + i * PITCH;

  const take = createRef<Node>();
  const title = createRef<Txt>();
  const bullets: Txt[] = [];
  const notes: Txt[] = [];
  view.add(
    <Node ref={take}>
      <Txt ref={title} x={LEFT_X + 44} y={HEAD_Y} text={TAKE_TITLE} fontFamily={Fonts.primary}
           fontSize={56} fontWeight={600} fill={CREAM} offset={[-1, 0]} textAlign={'left'} opacity={0} />
      {POINTS.map((p, i) => (
        <Txt ref={makeRef(bullets, i)} x={LEFT_X} y={rowY(i)} text={'—'}
             fontFamily={Fonts.code} fontSize={28} lineHeight={42} fill={WARM_MUTED}
             offset={[-1, 0]} textAlign={'left'} opacity={0} />
      ))}
      {POINTS.map((p, i) => (
        <Txt ref={makeRef(notes, i)} x={LEFT_X + 44} y={rowY(i)} text={p}
             fontFamily={Fonts.code} fontSize={28} lineHeight={42} fill={WARM} offset={[-1, 0]}
             textAlign={'left'} width={NOTE_W} textWrap opacity={0} />
      ))}
    </Node>,
  );

  const reading = createRef<Node>();
  view.add(
    <Node ref={reading} opacity={0}>
      <Txt x={READ_X} y={HEAD_Y} text={READ_TITLE} fontFamily={Fonts.primary}
           fontSize={56} fontWeight={600} fill={CREAM} offset={[-1, 0]} textAlign={'left'} />
      {BOOKS.map((b, i) => (
        <Txt x={READ_X} y={rowY(i) - HALF} text={b.title} fontFamily={Fonts.code}
             fontSize={28} lineHeight={42} fill={WARM} offset={[-1, 0]} textAlign={'left'} />
      ))}
      {BOOKS.map((b, i) => (
        <Txt x={READ_X} y={rowY(i) + HALF} text={b.meta} fontFamily={Fonts.code}
             fontSize={28} lineHeight={42} fill={WARM_MUTED} offset={[-1, 0]} textAlign={'left'} />
      ))}
    </Node>,
  );

  // Сначала — весь текст takeaway (шапка, затем пункты по одному).
  yield* title().opacity(1, 0.5, easeInOutCubic);
  yield* waitFor(0.4);
  for (let i = 0; i < POINTS.length; i++) {
    yield* all(
      bullets[i].opacity(1, 0.4, easeInOutCubic),
      notes[i].opacity(1, 0.4, easeInOutCubic),
    );
    yield* waitFor(2.4);
  }
  // Затем — справочная панель, разворачивается КАК ОДНО.
  yield* waitFor(0.4);
  yield* reading().opacity(1, 0.7, easeInOutCubic);
  yield* waitFor(2.8);

  yield* all(
    take().opacity(0, Timing.slow, easeInOutCubic),
    reading().opacity(0, Timing.slow, easeInOutCubic),
  );
  take().remove();
  reading().remove();
  yield* waitFor(0.3);

  // ── Final thesis ──────────────────────────────────────────────────────
  const thesis = createRef<Node>();
  view.add(
    <Node ref={thesis} opacity={0} y={-20}>
      <Txt fontFamily={Fonts.primary} fontSize={46} fontWeight={300}
           fill={Colors.text.primary} textAlign={'center'} y={-36}>
        The problem is not the boolean.
      </Txt>
      <Txt fontFamily={Fonts.primary} fontSize={46} fontWeight={300}
           fill={Colors.text.primary} textAlign={'center'} y={36}>
        The problem is the{' '}
        <Txt fill={Colors.accent} fontWeight={600}>decision it hides</Txt>.
      </Txt>
    </Node>,
  );

  yield* thesis().opacity(1, Timing.slow, easeOutCubic);
  yield* waitFor(3.0);
  yield* thesis().opacity(0, Timing.slow, easeInOutCubic);
  yield* waitFor(0.4);
});
