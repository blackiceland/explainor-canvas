import {Circle, Gradient, Node, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  createSignal,
  easeInOutSine,
  ThreadGenerator,
  Vector2,
  waitFor,
} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Fonts, Screen} from '../core/theme';

// Five Faces of Boolean — director's cut v3.
// Pitch-black stage. Five role names sit across the top, sized for
// mobile viewing and casting real light-driven shadows. A spotlight
// crawls from left to right; whichever name the light lands on lifts
// out of the dark and casts its shadow away from the source. For each
// face the centre of the frame plays the same beat: code arrives,
// breathes, then a five-dot weight gauge fades in DIRECTLY UNDER the
// active name — small punctuation of risk. After the hold, scale and
// code dissolve and the light moves on. The last face — POOR MODEL —
// burns longest; its `true` literal dissolves and the six-state
// life-cycle blooms in its place. Finally the other four names
// extinguish and POOR MODEL is left alone in the spotlight.

// ── Palette: project rose accent + cream typography, no yellow. ───────
const TEXT_PRIMARY  = '#F4F1EB';
const ACCENT        = '#FF8CA3';        // project rose — weight gauge
const STATE_CREAM   = '#F4F1EB';        // POOR MODEL mutation reveal

// Code colour constants — matches chapter1YudanSceneEn canon.
const PARAM_LIGHT = 'rgba(244, 241, 235, 0.92)';
const TYPE_CLEAN  = 'rgba(220, 215, 255, 0.85)';

// ── Top row layout ────────────────────────────────────────────────────
const NAMES  = ['PERMISSION', 'MODE', 'SHORTCUT', 'SAFETY', 'POOR MODEL'] as const;
const SCALES = [2, 3, 4, 2, 5] as const;
const NAME_XS = [-720, -360, 0, 360, 720] as const;

const NAMES_Y         = -400;
const DOTS_Y          = -310;
const NAME_FONT_SIZE  = 44;
const NAME_LETTER_SP  = 4;
const DOT_R           = 9;
const DOT_GAP         = 34;

// ── Spotlight physics (in spirit of pipelineGrabGrowthSceneEn) ────────
const LIGHT_REACH = 250;
const SPOT_R      = 290;
const SHADOW_MAX  = 18;

// ── Faces ─────────────────────────────────────────────────────────────
interface Face {
  code: string;
}

const FACES: Face[] = [
  {code: [
    'fileStorage.save(',
    '    file = report,',
    '    overwrite = true,',
    ')',
  ].join('\n')},
  {code: [
    'notifier.send(',
    '    user = user,',
    '    message = "Order shipped",',
    '    silent = true,',
    ')',
  ].join('\n')},
  {code: [
    'orderProcessor.process(',
    '    order = newOrder,',
    '    skipValidation = true,',
    ')',
  ].join('\n')},
  {code: [
    'userRepository.delete(',
    '    userId = user.id,',
    '    soft = true,',
    ')',
  ].join('\n')},
  {code: [
    'campaignRepository.update(',
    '    campaignId = campaign.id,',
    '    active = true,',
    ')',
  ].join('\n')},
];

const STATE_LIST = 'draft  /  scheduled  /  running  /  paused  /  completed  /  archived';

// Project code-rendering canon (chapter1YudanSceneEn-style): transparent
// card with opacity 0, no clipping, per-token colour rules.
const TRANSPARENT_CARD = {
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

const CODE_RULES: ColorRule[] = [
  // Keywords — theme blue.
  {match: /^true$/,  color: DryFiltersV3CodeTheme.keyword},
  {match: /^false$/, color: DryFiltersV3CodeTheme.keyword},
  // Methods — theme rose.
  {match: 'save',    color: DryFiltersV3CodeTheme.method, onlyTypes: ['method'] as const},
  {match: 'send',    color: DryFiltersV3CodeTheme.method, onlyTypes: ['method'] as const},
  {match: 'process', color: DryFiltersV3CodeTheme.method, onlyTypes: ['method'] as const},
  {match: 'delete',  color: DryFiltersV3CodeTheme.method, onlyTypes: ['method'] as const},
  {match: 'update',  color: DryFiltersV3CodeTheme.method, onlyTypes: ['method'] as const},
  // Receivers — soft cream.
  {match: 'fileStorage',         color: PARAM_LIGHT},
  {match: 'notifier',             color: PARAM_LIGHT},
  {match: 'orderProcessor',       color: PARAM_LIGHT},
  {match: 'userRepository',       color: PARAM_LIGHT},
  {match: 'campaignRepository',   color: PARAM_LIGHT},
  // Param names — soft cream.
  {match: 'file',           color: PARAM_LIGHT},
  {match: 'overwrite',      color: PARAM_LIGHT},
  {match: 'user',           color: PARAM_LIGHT},
  {match: 'message',        color: PARAM_LIGHT},
  {match: 'silent',         color: PARAM_LIGHT},
  {match: 'order',          color: PARAM_LIGHT},
  {match: 'skipValidation', color: PARAM_LIGHT},
  {match: 'userId',         color: PARAM_LIGHT},
  {match: 'soft',           color: PARAM_LIGHT},
  {match: 'campaignId',     color: PARAM_LIGHT},
  {match: 'active',         color: PARAM_LIGHT},
  // Value identifiers — soft cream.
  {match: 'report',   color: PARAM_LIGHT},
  {match: 'newOrder', color: PARAM_LIGHT},
  {match: 'campaign', color: PARAM_LIGHT},
  {match: 'id',       color: PARAM_LIGHT},
];

export default makeScene2D(function* (view) {
  // ── Pitch-black stage ──────────────────────────────────────────────
  view.add(<Rect width={Screen.width} height={Screen.height} fill={'#000000'} />);

  // ── Spotlight ──────────────────────────────────────────────────────
  // The aim point is a tweenable signal. On top of it, layered sines
  // add organic hand-jitter so the light is never perfectly still — the
  // wobble is borrowed from pipelineGrabGrowthSceneEn.
  const baseX = createSignal(NAME_XS[0] - 760);   // off-screen left
  const baseY = NAMES_Y - 6;

  const tremorX = (): number => {
    const t = view.globalTime();
    return (
      Math.sin(t * 1.9 + 0.3) * 3.4 +
      Math.sin(t * 4.3 + 1.4) * 1.7 +
      Math.sin(t * 7.6 + 2.7) * 0.8
    );
  };
  const tremorY = (): number => {
    const t = view.globalTime();
    return (
      Math.cos(t * 2.1 + 0.7) * 3.4 +
      Math.cos(t * 4.6 + 1.8) * 1.6 +
      Math.cos(t * 8.1 + 0.3) * 0.7
    );
  };

  const lightX = (): number => baseX() + tremorX();
  const lightY = (): number => baseY + tremorY();

  const brightnessAt = (wx: number, wy: number = NAMES_Y): number => {
    const dx = wx - lightX();
    const dy = wy - lightY();
    const d = Math.sqrt(dx * dx + dy * dy);
    const t = Math.max(0, Math.min(1, 1 - d / LIGHT_REACH));
    return t * t * (3 - 2 * t);
  };

  // Drawn under the names so its glow reads behind the type.
  view.add(
    <Circle
      x={() => lightX()}
      y={() => lightY()}
      width={SPOT_R * 2}
      height={SPOT_R * 2}
      compositeOperation={'screen'}
      fill={new Gradient({
        type: 'radial',
        from: new Vector2(0, 0),
        to: new Vector2(0, 0),
        fromRadius: 0,
        toRadius: SPOT_R,
        stops: [
          {offset: 0.00, color: 'rgba(244, 241, 235, 0.55)'},
          {offset: 0.28, color: 'rgba(244, 241, 235, 0.22)'},
          {offset: 0.62, color: 'rgba(244, 241, 235, 0.05)'},
          {offset: 1.00, color: 'rgba(0, 0, 0, 0)'},
        ],
      })}
    />,
  );

  // ── Five names with derived brightness + cast shadow ───────────────
  const nameRefs: ReturnType<typeof createRef<Txt>>[] = [];
  for (let i = 0; i < NAMES.length; i++) {
    const x = NAME_XS[i];
    const nameRef = createRef<Txt>();
    nameRefs.push(nameRef);

    view.add(
      <Txt
        ref={nameRef}
        x={x}
        y={NAMES_Y}
        text={NAMES[i]}
        fontFamily={Fonts.code}
        fontSize={NAME_FONT_SIZE}
        fontWeight={500}
        letterSpacing={NAME_LETTER_SP}
        // Grey ramp from "barely there" (12) to pure white (255).
        fill={() => {
          const b = brightnessAt(x);
          const v = Math.round(12 + b * 243);
          return `rgb(${v}, ${v}, ${v})`;
        }}
        // Shadow only exists where light hits — proportional to b.
        shadowColor={() => `rgba(0, 0, 0, ${brightnessAt(x) * 0.9})`}
        shadowBlur={() => 6 + (1 - brightnessAt(x)) * 10}
        shadowOffset={() => {
          const b = brightnessAt(x);
          if (b <= 0) return [0, 0] as [number, number];
          const dx = x - lightX();
          const dy = NAMES_Y - lightY();
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 0.001) return [0, 0] as [number, number];
          const len = Math.min(d * 0.28, SHADOW_MAX);
          return [(dx / d) * len, (dy / d) * len] as [number, number];
        }}
      />,
    );
  }

  // ── Scale dots — one group of 5 dots under EACH name, hidden until
  //    the active face's code has shown. Stored as opacity-controlled
  //    Nodes so we can fade the whole gauge as a unit.
  const scaleNodes: ReturnType<typeof createRef<Node>>[] = [];
  for (let i = 0; i < NAMES.length; i++) {
    const x = NAME_XS[i];
    const groupRef = createRef<Node>();
    scaleNodes.push(groupRef);

    const dots: any[] = [];
    for (let j = 0; j < 5; j++) {
      const isFilled = j < SCALES[i];
      dots.push(
        <Circle
          x={(j - 2) * DOT_GAP}
          y={0}
          width={DOT_R * 2}
          height={DOT_R * 2}
          fill={isFilled ? ACCENT : 'rgba(0,0,0,0)'}
          stroke={isFilled ? 'rgba(0,0,0,0)' : 'rgba(244,241,235,0.55)'}
          lineWidth={isFilled ? 0 : 1.6}
        />,
      );
    }

    view.add(
      <Node ref={groupRef} x={x} y={DOTS_Y} opacity={0}>
        {dots}
      </Node>,
    );
  }

  // ── Code instances — DryFiltersV3CodeTheme, transparent, centred ───
  const codes = FACES.map(face => {
    const code = Manticore.create(face.code, {
      x: 0,
      y: 0,
      width: 1100,
      fontSize: 40,
      lineHeight: 58,
      fontFamily: Fonts.code,
      theme: DryFiltersV3CodeTheme,
      noClip: true,
      cardStyle: TRANSPARENT_CARD,
      glowAccent: false,
      customTypes: [],
    });
    code.mount(view);
    code.colorize(CODE_RULES);
    code.node.opacity(0);
    return code;
  });

  // ── State-list overlay for the POOR MODEL mutation ─────────────────
  const stateListRef = createRef<Txt>();
  view.add(
    <Txt
      ref={stateListRef}
      x={0}
      y={0}
      text={STATE_LIST}
      fontFamily={Fonts.code}
      fontSize={30}
      fontWeight={500}
      fill={STATE_CREAM}
      opacity={0}
      letterSpacing={1}
    />,
  );

  // ─────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────
  function* showCode(i: number, dur = 0.7): ThreadGenerator {
    yield* codes[i].node.opacity(1, dur, easeInOutSine);
  }

  function* hideCode(i: number, dur = 0.6): ThreadGenerator {
    yield* codes[i].node.opacity(0, dur, easeInOutSine);
  }

  function* showScale(i: number, dur = 0.6): ThreadGenerator {
    yield* scaleNodes[i]().opacity(1, dur, easeInOutSine);
  }

  function* hideScale(i: number, dur = 0.5): ThreadGenerator {
    yield* scaleNodes[i]().opacity(0, dur, easeInOutSine);
  }

  // Per-face beat: light → code → breath → scale → hold → fade out.
  // Inter-face pause is intentionally tight — most of the pace lives
  // inside the per-face hold (where the voice-over sits).
  function* runFace(i: number, slideDur: number, hold: number): ThreadGenerator {
    yield* baseX(NAME_XS[i], slideDur, easeInOutSine);
    yield* waitFor(0.15);
    yield* showCode(i);
    yield* waitFor(0.65);
    yield* showScale(i);
    yield* waitFor(hold);
    yield* all(hideScale(i), hideCode(i));
  }

  // ─────────────────────────────────────────────────────────────────────
  // TIMELINE — short opening, then five beats, then mutation finale.
  // ─────────────────────────────────────────────────────────────────────

  // 0.0 – 0.5 s   Tiny pure-black hold so the eye adapts.
  yield* waitFor(0.5);

  // PERMISSION    (initial slide brings the light into frame)
  yield* runFace(0, 2.0, 9.5);

  // MODE
  yield* runFace(1, 0.85, 9.5);

  // SHORTCUT
  yield* runFace(2, 0.85, 9.5);

  // SAFETY
  yield* runFace(3, 0.85, 9.5);

  // POOR MODEL    (heaviest beat, the mutation lives here)
  yield* baseX(NAME_XS[4], 0.85, easeInOutSine);
  yield* waitFor(0.15);
  yield* showCode(4);
  yield* waitFor(0.65);
  yield* showScale(4);
  yield* waitFor(7.0);

  // Mutation: blue `true` dissolves; the six life-cycle states rise in
  // its place in calm cream — the bool reveals itself as a model.
  const activeLine = codes[4].getLine(2);
  if (activeLine) {
    const trueTok = activeLine.tokens.find(t => t.text === 'true');
    if (trueTok) {
      const tokTxt = trueTok.ref();
      const worldPos = tokTxt.absolutePosition();
      const local = view.worldToLocal().transformPoint(worldPos);
      stateListRef().position([local.x, local.y]);
      yield* all(
        tokTxt.opacity(0, 1.3, easeInOutSine),
        stateListRef().opacity(1, 1.3, easeInOutSine),
      );
    }
  }

  // Hold on the revealed model.
  yield* waitFor(5.0);

  // Final beat: the other four names die out, the centre quietly clears
  // and the light remains on POOR MODEL.
  yield* all(
    nameRefs[0]().opacity(0, 1.3, easeInOutSine),
    nameRefs[1]().opacity(0, 1.3, easeInOutSine),
    nameRefs[2]().opacity(0, 1.3, easeInOutSine),
    nameRefs[3]().opacity(0, 1.3, easeInOutSine),
    hideCode(4, 1.3),
    hideScale(4, 1.3),
    stateListRef().opacity(0, 1.3, easeInOutSine),
  );

  yield* waitFor(2.2);
});
