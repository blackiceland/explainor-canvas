import {Circle, Line, Node, Ray, Txt, blur, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  createSignal,
  easeInOutCubic,
  easeOutCubic,
  linear,
  ThreadGenerator,
  waitFor,
} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// One method, eight hidden versions.
// A rotating radar-style WEDGE BEAM sweeps clockwise around the central
// method disk. As its leading edge crosses each of the 8 slot angles,
// the version circle at that slot is born. The counter ticks 1 → 8 in
// sync with the beam. After the sweep, the right panel reveals the
// causality: dryRun × 2, forceSend × 2, isRetry × 2 = 2³ = 8.

// ── Flag identity colors (stable per parameter) ───────────────────────
const COLOR_DRYRUN    = '#7AC9C9';
const COLOR_FORCESEND = '#E0BB6A';
const COLOR_RETRY     = '#F08A8A';
const FLAG_COLORS = [COLOR_DRYRUN, COLOR_FORCESEND, COLOR_RETRY] as const;

const TEXT_PRIMARY = '#F4F1EB';
const TEXT_DIM     = 'rgba(244,241,235,0.62)';
const PUNCT_FILL   = 'rgba(244,241,235,0.42)';

const ACCENT       = '#FF8CA3';
const ACCENT_SOFT  = 'rgba(255, 140, 163, 0.55)';

const CHILD_FILL   = '#1B1D21';
const CHILD_STROKE = 'rgba(244,241,235,0.42)';
const CENTER_FILL  = '#1B1D21';

// ── Geometry — bigger center disk, ring fits left half ───────────────
const RING_CX = -440;
const RING_CY = -10;
const CENTER_R = 210;
const CHILD_R  = 100;
const RING_R   = 360;

const COUNTER_X = 540;
const COUNTER_Y = -200;
const PARAM_LIST_X = 540;
const PARAM_LIST_Y = 60;

const LABEL_BELOW_Y = CHILD_R + 30;  // labels sit strictly under each child circle

const DEG = (a: number) => (a * Math.PI) / 180;

// ── 8 combinations laid out clockwise from 12 o'clock. ────────────────
// Order matches the beam's path: simple → complex, so the binary
// progression reads naturally in sequence.
const COMBOS: Array<{label: string; flags: [boolean, boolean, boolean]}> = [
  {label: 'normal',              flags: [false, false, false]}, // 0  top
  {label: 'dryRun',              flags: [true,  false, false]}, // 1  TR
  {label: 'forceSend',           flags: [false, true,  false]}, // 2  R
  {label: 'retry',               flags: [false, false, true ]}, // 3  BR
  {label: 'dryRun + forceSend',  flags: [true,  true,  false]}, // 4  bottom
  {label: 'dryRun + retry',      flags: [true,  false, true ]}, // 5  BL
  {label: 'forceSend + retry',   flags: [false, true,  true ]}, // 6  L
  {label: 'all three',           flags: [true,  true,  true ]}, // 7  TL
];

const SLOTS = COMBOS.map((_, i) => {
  const a = (-Math.PI / 2) + i * (Math.PI / 4);
  return {x: Math.cos(a) * RING_R, y: Math.sin(a) * RING_R};
});

// Counter-doubling moments: after spawning these slot indices, the
// counter equals 2, 4, 8 respectively. Multiplier lines reveal there.
const DOUBLING_TRIGGER_SLOT = [1, 3, 7]; // counter ticks to 2, 4, 8

// ── Scene ─────────────────────────────────────────────────────────────
export default makeScene2D(function* (view) {
  applyBackground(view);

  // ─────────────────────────────────────────────────────────────────────
  // RIGHT PANEL — counter (visible from start) + multiplier list +
  // final tagline (both initially hidden).
  // ─────────────────────────────────────────────────────────────────────
  const counter = createSignal(0);
  const counterRef = createRef<Txt>();
  const paramLineRefs: ReturnType<typeof createRef<Node>>[] = [
    createRef<Node>(),
    createRef<Node>(),
    createRef<Node>(),
  ];

  view.add(
    <Node x={COUNTER_X} y={COUNTER_Y}>
      <Txt
        ref={counterRef}
        text={() => `${Math.floor(counter())}`}
        fontFamily={Fonts.code}
        fontSize={220}
        fontWeight={500}
        fill={TEXT_PRIMARY}
      />
      <Txt
        y={155}
        text={'HIDDEN VERSIONS'}
        fontFamily={Fonts.primary}
        fontSize={26}
        fontWeight={400}
        fill={TEXT_DIM}
        letterSpacing={6}
      />
    </Node>,
  );

  const PARAM_NAMES = ['dryRun', 'forceSend', 'isRetry'];
  for (let i = 0; i < 3; i++) {
    view.add(
      <Node
        ref={paramLineRefs[i]}
        x={PARAM_LIST_X}
        y={PARAM_LIST_Y + i * 64}
        opacity={0}
      >
        <Txt
          x={-10}
          offsetX={1}
          text={PARAM_NAMES[i]}
          fontFamily={Fonts.code}
          fontSize={34}
          fontWeight={600}
          fill={FLAG_COLORS[i]}
        />
        <Txt
          x={30}
          offsetX={-1}
          text={'× 2'}
          fontFamily={Fonts.code}
          fontSize={34}
          fontWeight={500}
          fill={TEXT_DIM}
        />
      </Node>,
    );
  }


  // ─────────────────────────────────────────────────────────────────────
  // RADAR — three rotating layers stacked in one Node:
  //   • A thin polygonal wedge (very transparent) — the fading tail.
  //   • The same wedge, narrower and blurred — soft glow halo.
  //   • A bright Ray along the leading edge — the precise scan line.
  // The Node spins as a unit. Built BEFORE the center disk so it sits
  // underneath the version circles.
  // ─────────────────────────────────────────────────────────────────────
  const radarNode    = createRef<Node>();
  const radarOpacity = createSignal(0);

  const BEAM_LEN = RING_R + CHILD_R + 20;  // tip dissolves past the slot orbit
  const TAIL     = 56;                      // angular spread at the tip (pixels)

  // Stack of overlapping Rays of decreasing length — every layer adds a
  // sliver of alpha near the root, so the leading line is bright at the
  // center and quietly dissolves toward the tip with no visible end.
  const RAY_LAYERS = 10;
  const rayStack: any[] = [];
  for (let i = 0; i < RAY_LAYERS; i++) {
    const t = (i + 1) / RAY_LAYERS;
    rayStack.push(
      <Ray
        fromX={0}
        fromY={0}
        toX={BEAM_LEN * t}
        toY={0}
        stroke={'rgba(255, 255, 255, 0.14)'}
        lineWidth={1.1}
        lineCap={'butt'}
      />,
    );
  }

  view.add(
    <Node
      ref={radarNode}
      x={RING_CX}
      y={RING_CY}
      rotation={-90}
      opacity={radarOpacity}
    >
      {/* Very faint cream wedge — ambient tail */}
      <Line
        points={[[0, 0], [BEAM_LEN, -TAIL], [BEAM_LEN, 0]]}
        closed
        fill={'rgba(244, 241, 235, 0.07)'}
      />
      {/* Soft blurred halo — narrower, glowy */}
      <Line
        points={[[0, 0], [BEAM_LEN, -TAIL * 0.55], [BEAM_LEN, 0]]}
        closed
        fill={'rgba(244, 241, 235, 0.18)'}
        filters={[blur(14)]}
      />
      {/* Stacked Rays — bright at root, dissolving toward the tip */}
      {rayStack}
    </Node>,
  );

  // ─────────────────────────────────────────────────────────────────────
  // CENTER DISK — enlarged method name, params stay in their flag colors
  // throughout (no dimming, no phasing).
  // ─────────────────────────────────────────────────────────────────────
  const centerNode = createRef<Node>();
  view.add(
    <Node ref={centerNode} x={RING_CX} y={RING_CY} opacity={0}>
      <Circle
        width={CENTER_R * 2}
        height={CENTER_R * 2}
        fill={CENTER_FILL}
        stroke={ACCENT}
        lineWidth={2}
        shadowColor={ACCENT_SOFT}
        shadowBlur={48}
      />
      <Txt
        y={-28}
        text={'deliverCampaignMessage'}
        fontFamily={Fonts.code}
        fontSize={24}
        fontWeight={500}
        fill={TEXT_PRIMARY}
      />
      <Txt y={28} fontFamily={Fonts.code} fontSize={18} fontWeight={500} fill={PUNCT_FILL}>
        <Txt text={'('} />
        <Txt text={'dryRun'}    fontWeight={600} fill={COLOR_DRYRUN} />
        <Txt text={', '} />
        <Txt text={'forceSend'} fontWeight={600} fill={COLOR_FORCESEND} />
        <Txt text={', '} />
        <Txt text={'isRetry'}   fontWeight={600} fill={COLOR_RETRY} />
        <Txt text={')'} />
      </Txt>
    </Node>,
  );

  // ─────────────────────────────────────────────────────────────────────
  // CHILDREN — pre-built, hidden. Each shows its (T/F, T/F, T/F) tuple
  // and a version label positioned radially outward from the ring center.
  // ─────────────────────────────────────────────────────────────────────
  const childRefs: ReturnType<typeof createRef<Node>>[] = [];
  for (let i = 0; i < COMBOS.length; i++) {
    const ref = createRef<Node>();
    childRefs.push(ref);
    const c = COMBOS[i];
    const slot = SLOTS[i];

    // Labels sit strictly below every child circle for consistent reading.

    view.add(
      <Node ref={ref} x={RING_CX + slot.x} y={RING_CY + slot.y} opacity={0}>
        <Circle
          width={CHILD_R * 2}
          height={CHILD_R * 2}
          fill={CHILD_FILL}
          stroke={CHILD_STROKE}
          lineWidth={2}
          shadowColor={'rgba(0,0,0,0.55)'}
          shadowBlur={24}
          shadowOffsetY={6}
        />
        <Txt
          y={-26}
          text={'deliver'}
          fontFamily={Fonts.code}
          fontSize={24}
          fontWeight={500}
          fill={TEXT_PRIMARY}
        />
        <Txt y={22} fontFamily={Fonts.code} fontSize={24} fontWeight={500} fill={PUNCT_FILL}>
          <Txt text={'('} />
          <Txt text={c.flags[0] ? 'T' : 'F'} fontWeight={700} fill={FLAG_COLORS[0]} />
          <Txt text={', '} />
          <Txt text={c.flags[1] ? 'T' : 'F'} fontWeight={700} fill={FLAG_COLORS[1]} />
          <Txt text={', '} />
          <Txt text={c.flags[2] ? 'T' : 'F'} fontWeight={700} fill={FLAG_COLORS[2]} />
          <Txt text={')'} />
        </Txt>
        <Txt
          x={0}
          y={LABEL_BELOW_Y}
          text={c.label}
          fontFamily={Fonts.primary}
          fontSize={20}
          fontWeight={400}
          fill={TEXT_DIM}
        />
      </Node>,
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // Helpers — quiet luxury: no scale pops, opacity-only, gentle easing.
  // ─────────────────────────────────────────────────────────────────────
  function* spawnSlot(slotIdx: number): ThreadGenerator {
    const dblIdx = DOUBLING_TRIGGER_SLOT.indexOf(slotIdx);
    yield* all(
      counter(slotIdx + 1, 0.35, easeInOutCubic),
      childRefs[slotIdx]().opacity(1, 0.95, easeInOutCubic),
      dblIdx >= 0
        ? paramLineRefs[dblIdx]().opacity(1, 0.85, easeInOutCubic)
        : (function* (): ThreadGenerator {})(),
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // TIMELINE — measured, slow reveals. Total ≈ 10s.
  // ─────────────────────────────────────────────────────────────────────

  // 0.0 – 1.0s: center disk quietly fades in. Counter sits at "0".
  yield* centerNode().opacity(1, 1.0, easeInOutCubic);

  // 0.85 – 1.3s: radar comes alive at 12 o'clock.
  yield* radarOpacity(1, 0.45, easeInOutCubic);

  // 1.3 – 8.0s: radar makes one slow revolution. Each slot fades in as
  // the leading edge crosses it.
  const SWEEP_DUR = 6.7;
  const spawnTasks: ThreadGenerator[] = [];
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * SWEEP_DUR;
    spawnTasks.push((function* (): ThreadGenerator {
      yield* waitFor(t);
      yield* spawnSlot(i);
    })());
  }
  yield* all(
    radarNode().rotation(270, SWEEP_DUR, linear),
    ...spawnTasks,
  );

  // 8.0 – 8.7s: radar quietly dissolves.
  yield* radarOpacity(0, 0.7, easeInOutCubic);

  // 8.7 – 10s: hold on the constellation.
  yield* waitFor(1.3);
});
