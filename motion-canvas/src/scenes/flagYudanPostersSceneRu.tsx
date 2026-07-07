import {makeScene2D} from '@motion-canvas/2d';
import {Node, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, waitFor} from '@motion-canvas/core';
import {Fonts} from '../core/theme';

// ─────────────────────────────────────────────────────────────────────────
// POSTER BOARD — "show the yudan idea WITHOUT code, through colour".
// Five held static frames so the author can choose by eye:
//   1  ① THE CURED FIELD            — rest
//   2  ① THE CURED FIELD            — flag flipped
//   3  ③ TUNED TO THE ROOM          — rest
//   4  ③ TUNED TO THE ROOM          — flag flipped
//   5  DARK TWIN (ground was hiding) — flag flipped
// Every state is a STATIC hold; only quick crossfades between them, so a
// frame sampled anywhere mid-hold is the correct composition (drift-safe).
// Muted on purpose: one carried temperature, never a palette.
// ─────────────────────────────────────────────────────────────────────────

const LABEL = Fonts.code;
const UI = Fonts.primary;

// Shared bento footprint — same six rectangles for every concept so they
// are visually comparable. cx,cy = centre; w,h = size.
type Slot = {cx: number; cy: number; w: number; h: number};
const SLOTS: Slot[] = [
  {cx: -520, cy: -150, w: 380, h: 210}, // 0 — the special one (Validation)
  {cx: -90, cy: -150, w: 300, h: 190},  // 1
  {cx: 270, cy: -150, w: 320, h: 210},  // 2
  {cx: -470, cy: 110, w: 400, h: 190},  // 3
  {cx: -20, cy: 110, w: 300, h: 200},   // 4
  {cx: 350, cy: 110, w: 400, h: 190},   // 5
];

const CURED_NAMES = ['Validation', 'Inventory', 'Payments', 'Shipping', 'Audit', 'Notifications'];
const TUNED_NAMES = ['Orders', 'Inventory', 'Payments', 'Pricing', 'Audit', 'Shipping'];

function card(s: Slot, opts: {
  fill: string;
  stroke: string;
  shadow: string;
  shadowBlur: number;
  shadowY: number;
  label: string;
  labelColor: string;
  wash?: string;
  seal?: 'solid' | 'hollowWarm' | 'hollowCold' | null;
}): Node {
  const g = new Node({x: s.cx, y: s.cy});
  g.add(new Rect({
    width: s.w, height: s.h, radius: 16, fill: opts.fill,
    stroke: opts.stroke, lineWidth: 1,
    shadowColor: opts.shadow, shadowBlur: opts.shadowBlur, shadowOffset: [0, opts.shadowY],
  }));
  if (opts.wash) {
    g.add(new Rect({width: s.w, height: s.h, radius: 16, fill: opts.wash}));
  }
  if (opts.seal) {
    const sx = s.w / 2 - 26, sy = -s.h / 2 + 26;
    if (opts.seal === 'solid') {
      g.add(new Rect({x: sx, y: sy, width: 22, height: 22, radius: 6, fill: '#C8A06A'}));
    } else {
      const col = opts.seal === 'hollowWarm' ? 'rgba(200,160,106,0.45)' : 'rgba(170,176,188,0.30)';
      g.add(new Rect({x: sx, y: sy, width: 22, height: 22, radius: 6, stroke: col, lineWidth: 1.5}));
    }
  }
  g.add(new Txt({
    text: opts.label, fontFamily: LABEL, fontSize: 24, fontWeight: 500,
    fill: opts.labelColor, x: -s.w / 2 + 24, y: -s.h / 2 + 32, offset: [-1, 0],
  }));
  return g;
}

function buildCured(cold: boolean): Node {
  const root = new Node({});
  SLOTS.forEach((s, i) => {
    const special = i === 0;
    root.add(card(s, {
      fill: cold ? '#16171B' : '#211F1D',
      stroke: cold ? 'rgba(244,241,235,0.05)' : 'rgba(244,241,235,0.08)',
      shadow: 'rgba(0,0,0,0.36)', shadowBlur: 24, shadowY: 8,
      label: CURED_NAMES[i],
      labelColor: cold ? 'rgba(244,241,235,0.30)' : 'rgba(244,241,235,0.72)',
      wash: cold ? undefined : 'rgba(212,170,124,0.08)',
      seal: special
        ? (cold ? 'hollowCold' : 'solid')
        : (cold ? 'hollowCold' : 'hollowWarm'),
    }));
  });
  return root;
}

function buildTuned(mode: 'rest' | 'flip' | 'twin'): Node {
  const root = new Node({});
  const cool = mode === 'twin';
  SLOTS.forEach((s, i) => {
    root.add(card(s, {
      fill: cool ? '#1E232B' : '#231F1A',
      stroke: 'rgba(244,241,235,0.08)',
      shadow: 'rgba(0,0,0,0.45)', shadowBlur: 28, shadowY: 10,
      label: TUNED_NAMES[i],
      labelColor: cool ? 'rgba(244,241,235,0.80)' : 'rgba(244,241,235,0.66)',
    }));
  });
  return root;
}

export default makeScene2D(function* (view) {
  const bg = createRef<Rect>();
  const eyebrow = createRef<Txt>();
  const caption = createRef<Txt>();

  view.add(<Rect ref={bg} width={1920} height={1080} fill={'#0B0C10'} />);
  view.add(
    <Txt
      ref={eyebrow} text={''} fontFamily={UI} fontSize={27} fontWeight={600}
      letterSpacing={5} fill={'rgba(244,241,235,0.52)'} x={-880} y={-462} offset={[-1, 0]}
    />,
  );
  view.add(
    <Txt
      ref={caption} text={''} fontFamily={UI} fontSize={26} fill={'rgba(244,241,235,0.60)'}
      x={0} y={428} textAlign={'center'}
    />,
  );

  let current: Node | null = null;

  function* go(node: Node, bgColor: string, eyebrowText: string, captionText: string) {
    node.opacity(0);
    view.add(node);
    yield* all(
      node.opacity(1, 0.45),
      current ? current.opacity(0, 0.45) : node.opacity(1, 0.45),
      bg().fill(bgColor, 0.45),
      eyebrow().opacity(0, 0.22),
      caption().opacity(0, 0.22),
    );
    if (current) current.remove();
    current = node;
    eyebrow().text(eyebrowText);
    caption().text(captionText);
    yield* all(eyebrow().opacity(0.52, 0.22), caption().opacity(0.60, 0.22));
    yield* waitFor(1.9);
  }

  // 1 — Cured Field, rest
  yield* go(
    buildCured(false), '#0B0C10',
    '①  THE CURED FIELD',
    'rest — every card already wears one inherited warmth;  Validation alone holds the solid seal',
  );
  // 2 — Cured Field, flipped
  yield* go(
    buildCured(true), '#0B0C10',
    '①  THE CURED FIELD',
    'flag flipped — the seal dies and the warmth drains from every card at once  →  hollow, cold',
  );
  // 3 — Tuned To The Room, rest
  yield* go(
    buildTuned('rest'), '#1B1814',
    '③  TUNED TO THE ROOM',
    'rest — the warm ground IS the guarantee;  cards are tuned into it, almost invisible',
  );
  // 4 — Tuned To The Room, flipped
  yield* go(
    buildTuned('flip'), '#12161D',
    '③  TUNED TO THE ROOM',
    'flag flipped — only the ground turns cold;  every card is stranded the wrong temperature',
  );
  // 5 — Dark twin, flipped
  yield* go(
    buildTuned('twin'), '#141414',
    'DARK TWIN  ·  WHAT THE GROUND WAS HIDING',
    'flag flipped — the ground hid a cold cast in every card;  remove it and they were always off',
  );

  yield* waitFor(0.4);
});
