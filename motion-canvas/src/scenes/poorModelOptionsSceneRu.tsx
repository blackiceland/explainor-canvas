import {Node, Rect, Txt, View2D, makeScene2D} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  all,
  chain,
  createRef,
  easeInOutCubic,
  easeInOutSine,
  makeRef,
  waitFor,
} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';
import {Canon} from '../core/code/model/paletteCanon';

// ── FLAT-словарь лиц (тот же, что в fiveFacesBooleanV2Setup) ────────────
const PARAM  = Canon.param;                 // #85B0DC — активно / true / поток
const ROSE   = Canon.methodDef;             // #FF8CA3 — флаг / потеря
const DIM    = 'rgba(244,241,235,0.14)';    // VIZ_DIM — нейтральный примитив
const FALSE  = 'rgba(244,241,235,0.22)';    // «покрашен в false» — чуть плотнее нейтрали
const INK    = '#F4F1EB';
const INK70  = 'rgba(244,241,235,0.70)';
const DIMTXT = 'rgba(244,241,235,0.42)';
const DARK   = '#0B0C10';                    // текст на ярком баре

const STATES6 = ['draft', 'scheduled', 'running', 'paused', 'completed', 'archived'];

// ═══════════════════════════════════════════════════════════════════════
export default makeScene2D(function* (view) {
  applyBackground(view);

  view.add(
    <Txt x={0} y={-470} text={'POOR MODEL · active: Boolean'}
         fontFamily={Fonts.primary} fontSize={22} letterSpacing={2} fill={DIMTXT} />,
  );

  yield* waitFor(0.3);
  yield* variant1(view);
  yield* waitFor(0.3);
  yield* variant2(view);
  yield* waitFor(0.3);
  yield* variant3(view);
  yield* waitFor(0.4);
});

function head(text: string) {
  return (
    <Txt x={0} y={-395} text={text} fontFamily={Fonts.primary}
         fontSize={22} letterSpacing={3} fill={DIMTXT} />
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ВАРИАНТ 1 — СХЛОП: 6 плоских квадратов сходятся и наслаиваются в 2 (false/true).
// Разные состояния совпадают в одной точке — их уже не различить.
// ═══════════════════════════════════════════════════════════════════════
function* variant1(view: View2D): ThreadGenerator {
  const c = createRef<Node>();
  const body = createRef<Node>();
  const cap = createRef<Txt>();
  const fLbl = createRef<Txt>();
  const tLbl = createRef<Txt>();
  const sq: Rect[] = [];
  const lb: Txt[] = [];

  const SQ = 72;
  const V = [
    {n: 'draft',     x: -400, g: 'f'},
    {n: 'scheduled', x: -240, g: 'f'},
    {n: 'running',   x:  -80, g: 't'},
    {n: 'paused',    x:   80, g: 't'},
    {n: 'completed', x:  240, g: 'f'},
    {n: 'archived',  x:  400, g: 'f'},
  ] as const;
  const fC: [number, number] = [-230, 150];
  const tC: [number, number] = [250, 150];

  view.add(
    <Node ref={c}>
      <Node ref={body} opacity={0}>
        {head('ВАРИАНТ 1 · СХЛОП В ДВА ЗНАЧЕНИЯ')}
        {V.map((s, i) => (
          <Rect ref={makeRef(sq, i)} x={s.x} y={-140} width={SQ} height={SQ} radius={8} fill={DIM} />
        ))}
        {V.map((s, i) => (
          <Txt ref={makeRef(lb, i)} x={s.x} y={-86} text={s.n}
               fontFamily={Fonts.code} fontSize={15} letterSpacing={1} fill={INK70} />
        ))}
      </Node>
      <Txt ref={fLbl} x={fC[0]} y={210} text={'active = false'} fontFamily={Fonts.code}
           fontSize={19} letterSpacing={1} fill={INK70} opacity={0} />
      <Txt ref={tLbl} x={tC[0]} y={210} text={'active = true'} fontFamily={Fonts.code}
           fontSize={19} letterSpacing={1} fill={PARAM} opacity={0} />
      <Txt ref={cap} x={0} y={330} text={'шесть состояний → два значения'}
           fontFamily={Fonts.primary} fontSize={23} fill={DIMTXT} opacity={0} />
    </Node>,
  );

  yield* body().opacity(1, 0.55);
  yield* waitFor(0.8);

  let fk = 0, tk = 0;
  const anims: ThreadGenerator[] = [];
  V.forEach((s, i) => {
    const isT = s.g === 't';
    const base = isT ? tC : fC;
    const k = isT ? tk++ : fk++;
    const tgt: [number, number] = [base[0] + k * 4, base[1] + k * 4];
    anims.push(chain(
      waitFor(i * 0.08),
      all(
        sq[i].position(tgt, 0.75, easeInOutCubic),
        sq[i].fill(isT ? PARAM : DIM, 0.75),
        lb[i].opacity(0, 0.45),
      ),
    ));
  });
  yield* all(...anims);
  yield* all(fLbl().opacity(1, 0.5), tLbl().opacity(1, 0.5));
  yield* cap().opacity(1, 0.55);
  yield* waitFor(1.7);
  yield* c().opacity(0, 0.6);
  c().remove();
}

// ═══════════════════════════════════════════════════════════════════════
// ВАРИАНТ 2 — ЛЕСТНИЦА: слева 6 баров-состояний, подсветка идёт по циклу;
// справа один бар active — синий только на running, иначе dim → paused,
// completed, archived сливаются в один и тот же false.
// ═══════════════════════════════════════════════════════════════════════
function* variant2(view: View2D): ThreadGenerator {
  const c = createRef<Node>();
  const body = createRef<Node>();
  const cap = createRef<Txt>();
  const single = createRef<Rect>();
  const stateTxt = createRef<Txt>();
  const bars: Rect[] = [];

  const LX = -250, LW = 250, LH = 42, PITCH = 56;
  const yL = (i: number) => (i - 2.5) * PITCH;   // -140..140

  view.add(
    <Node ref={c}>
      <Node ref={body} opacity={0}>
        {head('ВАРИАНТ 2 · ЛЕСТНИЦА ПРОТИВ ОДНОГО БАРА')}
        {STATES6.map((s, i) => (
          <Rect ref={makeRef(bars, i)} x={LX} y={yL(i)} width={LW} height={LH} radius={6}
                fill={i === 0 ? PARAM : DIM} />
        ))}
        {STATES6.map((s, i) => (
          <Txt x={LX} y={yL(i)} text={s} fontFamily={Fonts.code} fontSize={18}
               letterSpacing={1} fontWeight={600} fill={i === 0 ? DARK : INK} />
        ))}
        <Txt x={250} y={-58} text={'active'} fontFamily={Fonts.code} fontSize={18}
             letterSpacing={1} fill={INK70} />
        <Rect ref={single} x={250} y={0} width={250} height={56} radius={6} fill={DIM} />
        <Txt ref={stateTxt} x={250} y={54} text={'false'} fontFamily={Fonts.code}
             fontSize={20} letterSpacing={1} fill={DIMTXT} />
      </Node>
      <Txt ref={cap} x={0} y={330}
           text={'paused · completed · archived → один false'}
           fontFamily={Fonts.primary} fontSize={23} fill={ROSE} opacity={0} />
    </Node>,
  );

  yield* body().opacity(1, 0.55);
  yield* waitFor(0.5);

  const step = function* (i: number, on: boolean, col: string): ThreadGenerator {
    stateTxt().text(on ? 'true' : 'false');
    yield* all(
      bars[i - 1].fill(DIM, 0.3),
      bars[i].fill(PARAM, 0.35),
      single().fill(on ? PARAM : DIM, 0.35),
      stateTxt().fill(col, 0.3),
    );
    yield* waitFor(0.55);
  };

  yield* waitFor(0.3);
  yield* step(1, false, DIMTXT);   // scheduled
  yield* step(2, true,  PARAM);    // running
  yield* step(3, false, ROSE);     // paused
  yield* step(4, false, ROSE);     // completed
  yield* step(5, false, ROSE);     // archived
  yield* cap().opacity(1, 0.6);
  yield* waitFor(1.7);
  yield* c().opacity(0, 0.6);
  c().remove();
}

// ═══════════════════════════════════════════════════════════════════════
// ВАРИАНТ 3 — ДВА ЦВЕТА НА ШЕСТЬ: 6 квадратов бит красит всего в 2 цвета
// (running/paused → синий, остальные → false). Затем rose-вспышка на паре,
// которая семантически разная, а бит одинаков (draft vs completed).
// ═══════════════════════════════════════════════════════════════════════
function* variant3(view: View2D): ThreadGenerator {
  const c = createRef<Node>();
  const body = createRef<Node>();
  const cap = createRef<Txt>();
  const collide = createRef<Txt>();
  const sq: Rect[] = [];

  const SQ = 78;
  const xs = STATES6.map((_, i) => -400 + i * 160);
  const paint = ['f', 'f', 't', 't', 'f', 'f'];   // running/paused = true

  view.add(
    <Node ref={c}>
      <Node ref={body} opacity={0}>
        {head('ВАРИАНТ 3 · ДВА ЦВЕТА НА ШЕСТЬ')}
        {STATES6.map((s, i) => (
          <Rect ref={makeRef(sq, i)} x={xs[i]} y={-40} width={SQ} height={SQ} radius={8} fill={DIM} />
        ))}
        {STATES6.map((s, i) => (
          <Txt x={xs[i]} y={18} text={s} fontFamily={Fonts.code} fontSize={15}
               letterSpacing={1} fill={INK70} />
        ))}
      </Node>
      <Txt ref={collide} x={0} y={-165} text={'draft ≠ completed — а бит один'}
           fontFamily={Fonts.code} fontSize={19} letterSpacing={1} fill={ROSE} opacity={0} />
      <Txt ref={cap} x={0} y={150} text={'один бит — одинаковый ответ на разные состояния'}
           fontFamily={Fonts.primary} fontSize={23} fill={DIMTXT} opacity={0} />
    </Node>,
  );

  yield* body().opacity(1, 0.55);
  yield* waitFor(0.7);

  // покраска слева направо всего в 2 цвета
  yield* all(
    ...sq.map((r, i) => chain(
      waitFor(i * 0.1),
      r.fill(paint[i] === 't' ? PARAM : FALSE, 0.35, easeInOutSine),
    )),
  );
  yield* waitFor(0.6);

  // коллизия: draft(0) и completed(4) — разные фазы, один и тот же false
  yield* collide().opacity(1, 0.4);
  yield* all(
    sq[0].fill(ROSE, 0.25), sq[4].fill(ROSE, 0.25),
    sq[0].scale(1.12, 0.25), sq[4].scale(1.12, 0.25),
  );
  yield* all(
    sq[0].fill(FALSE, 0.35), sq[4].fill(FALSE, 0.35),
    sq[0].scale(1, 0.35), sq[4].scale(1, 0.35),
  );
  yield* cap().opacity(1, 0.6);
  yield* waitFor(1.8);
  yield* c().opacity(0, 0.6);
  c().remove();
}
