import {Circle, Gradient, Line, Node, Rect, Txt, blur, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  createSignal,
  easeInCubic,
  easeInOutCubic,
  easeInOutSine,
  easeOutCubic,
  makeRef,
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

// Code colour constants — soft pastel palette (reference: 33333.png).
// Identifiers/params/values stay calm cream; keywords lift to a quiet
// lavender; method names breathe in soft pastel blue. Nothing screams.
const PARAM_LIGHT    = 'rgba(244, 241, 235, 0.92)';
const KEYWORD_LILAC  = '#C9B0E8';
const METHOD_BLUE    = '#A8CDE8';

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
  // Keywords — soft lavender.
  {match: /^true$/,  color: KEYWORD_LILAC},
  {match: /^false$/, color: KEYWORD_LILAC},
  // Methods — pastel blue.
  {match: 'save',    color: METHOD_BLUE, onlyTypes: ['method'] as const},
  {match: 'send',    color: METHOD_BLUE, onlyTypes: ['method'] as const},
  {match: 'process', color: METHOD_BLUE, onlyTypes: ['method'] as const},
  {match: 'delete',  color: METHOD_BLUE, onlyTypes: ['method'] as const},
  {match: 'update',  color: METHOD_BLUE, onlyTypes: ['method'] as const},
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
  // Manticore left-aligns lines inside its (centred) card. To put each
  // face visually in the middle of the frame, we size the card to the
  // longest line of THAT face — then the longest line lands exactly on
  // origin, with shorter lines stacked beneath it. JetBrains Mono at
  // fontSize 60 ⇒ ~36px per char; padding adds 56px on each side.
  const CODE_FONT_SIZE = 60;
  const CHAR_W         = CODE_FONT_SIZE * 0.6;          // monospace ratio
  const CODE_PAD_X     = 56;                            // getCodePaddingX(60)
  // Code container is pushed left, freeing the right ~750 px of the
  // frame for bold per-face visualisations.
  const CODE_X         = -360;
  const codes = FACES.map(face => {
    const longest = Math.max(...face.code.split('\n').map(l => l.length));
    const width   = Math.round(longest * CHAR_W + CODE_PAD_X * 2);
    const code = Manticore.create(face.code, {
      x: CODE_X,
      y: 0,
      width,
      fontSize: CODE_FONT_SIZE,
      lineHeight: 84,
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

  // PERMISSION code needs a tweenable blur so the scale can bloom over
  // a softened backdrop, then come back into focus when the gauge lands
  // under the name.
  const permissionBlur = createSignal(0);
  codes[0].node.cache(true);
  codes[0].node.cachePadding(60);
  codes[0].node.filters(() => [blur(permissionBlur())]);

  // ── Right-side visualisations ──────────────────────────────────────
  // Each face gets a bold, color-coded scene to the right of the code
  // that LITERALLY shows what the boolean does. Style canon: filled
  // geometric shapes with assertive accent colours, clear hierarchy,
  // confident size — same language as foreignResponsibilityShapesSceneEn
  // (filled blocks with role colour) and reference 1234.png (chromatic
  // outlined shapes connected with hair-lines). Inspired animations
  // mirror the verb in the flag: write/erase, mute, jump-over, dim, fan
  // out the hidden state graph.
  const VIZ_X         = 560;
  const VIZ_INK       = '#F4F1EB';
  const VIZ_DIM       = 'rgba(244, 241, 235, 0.28)';
  const VIZ_LINE      = 'rgba(244, 241, 235, 0.32)';
  const VIZ_TEAL      = '#5DD9B7';
  const VIZ_TEAL_S    = 'rgba(93, 217, 183, 0.18)';
  const VIZ_ORANGE    = '#FFB562';
  const VIZ_RED       = '#FF7373';
  const VIZ_LILAC     = '#C9B0E8';
  const VIZ_BLUE      = '#A8CDE8';
  const VIZ_ROSE      = '#FF8CA3';

  const vizRefs: ReturnType<typeof createRef<Node>>[] = [];
  const vizDrivers: (() => ThreadGenerator)[] = [];

  // ── VIZ 0  PERMISSION  (overwrite=true) ────────────────────────────
  // A bold document. Its old content fills the page (cream filled
  // bars). The bars FLASH ORANGE (warning), shatter to the right (data
  // destroyed), then a new TEAL block of bars writes in from the left.
  // Reads — literally — as "old bytes gone, new bytes in their place."
  {
    const root = createRef<Node>();
    vizRefs.push(root);
    const oldLines: Rect[] = [];
    const newLines: Rect[] = [];
    const LINE_GAP  = 56;
    const LINE_Y0   = -100;
    const LINE_H    = 14;
    const LINE_W_OLD = [240, 210, 230, 200];
    const LINE_W_NEW = [230, 250, 200, 240];
    view.add(
      <Node ref={root} x={VIZ_X} y={0} opacity={0}>
        {/* Page card */}
        <Rect
          width={330}
          height={400}
          stroke={VIZ_INK}
          lineWidth={3}
          fill={'rgba(244, 241, 235, 0.04)'}
          radius={10}
        />
        {/* Top tab strip (suggests a "header") */}
        <Rect x={-80} y={-168} width={110} height={14} fill={VIZ_INK} radius={4} opacity={0.85} />
        {/* Old content lines — cream filled */}
        {[0, 1, 2, 3].map(i => (
          <Rect
            ref={makeRef(oldLines, i)}
            x={-30 - (LINE_W_OLD[i] - 240) / 2}
            y={LINE_Y0 + i * LINE_GAP}
            width={LINE_W_OLD[i]}
            height={LINE_H}
            fill={VIZ_INK}
            radius={3}
            opacity={0}
          />
        ))}
        {/* New content lines — teal filled, initially hidden */}
        {[0, 1, 2, 3].map(i => (
          <Rect
            ref={makeRef(newLines, i)}
            x={-30 - (LINE_W_NEW[i] - 240) / 2}
            y={LINE_Y0 + i * LINE_GAP}
            width={LINE_W_NEW[i]}
            height={LINE_H}
            fill={VIZ_TEAL}
            radius={3}
            opacity={0}
          />
        ))}
      </Node>,
    );
    vizDrivers.push(function* () {
      // Existing data fills the page line by line.
      for (let i = 0; i < oldLines.length; i++) {
        yield* oldLines[i].opacity(0.92, 0.16, easeInOutSine);
      }
      yield* waitFor(0.55);
      // Warning flash — bars go orange (about to be destroyed).
      yield* all(...oldLines.map(l => l.fill(VIZ_ORANGE, 0.18, easeInOutSine)));
      // Bars shatter to the right and dissolve.
      yield* all(
        ...oldLines.map((l, i) => l.position.x(
          l.position.x() + 200,
          0.55 + i * 0.05,
          easeInCubic,
        )),
        ...oldLines.map(l => l.opacity(0, 0.55, easeInOutSine)),
      );
      yield* waitFor(0.18);
      // New data writes in left-to-right.
      for (let i = 0; i < newLines.length; i++) {
        newLines[i].scale([0, 1]);
        yield* all(
          newLines[i].opacity(1, 0.18, easeInOutSine),
          newLines[i].scale(1, 0.32, easeOutCubic),
        );
      }
    });
  }

  // ── VIZ 1  MODE  (silent=true) ─────────────────────────────────────
  // A bold orange-filled bell with sound waves pulsing out. The waves
  // pulse twice (sound is firing), then the bell DESATURATES to grey
  // and a thick red slash slams across it — sound silenced.
  {
    const root = createRef<Node>();
    vizRefs.push(root);
    const wave: Circle[] = [];
    const bell  = createRef<Circle>();
    const clap  = createRef<Circle>();
    const slash = createRef<Line>();
    view.add(
      <Node ref={root} x={VIZ_X} y={0} opacity={0}>
        {/* Sound waves (drawn behind the bell) */}
        {[0, 1, 2].map(i => (
          <Circle
            ref={makeRef(wave, i)}
            x={0}
            y={-10}
            width={130 + i * 70}
            height={130 + i * 70}
            stroke={VIZ_ORANGE}
            lineWidth={4}
            opacity={0}
            startAngle={-150}
            endAngle={-30}
          />
        ))}
        {/* Bell body (filled orange) */}
        <Circle
          ref={bell}
          x={0}
          y={-10}
          width={120}
          height={120}
          fill={VIZ_ORANGE}
        />
        {/* Clapper (small filled circle below the bell) */}
        <Circle
          ref={clap}
          x={0}
          y={68}
          width={26}
          height={26}
          fill={VIZ_ORANGE}
        />
        {/* Slash — thick red line crossing the bell when silenced */}
        <Line
          ref={slash}
          points={[[-95, -85], [95, 85]]}
          stroke={VIZ_RED}
          lineWidth={8}
          lineCap={'round'}
          opacity={0}
          end={0}
        />
      </Node>,
    );
    vizDrivers.push(function* () {
      // Two pulses of sound — waves bloom outward then fade.
      for (let pulse = 0; pulse < 2; pulse++) {
        yield* all(
          wave[0].opacity(0.95, 0.18),
          wave[1].opacity(0.7, 0.25),
          wave[2].opacity(0.4, 0.32),
        );
        yield* all(
          wave[0].opacity(0, 0.32),
          wave[1].opacity(0, 0.32),
          wave[2].opacity(0, 0.32),
        );
        yield* waitFor(0.08);
      }
      // Silenced — bell goes grey, slash slams across.
      yield* all(
        bell().fill(VIZ_DIM, 0.32, easeInOutSine),
        clap().fill(VIZ_DIM, 0.32, easeInOutSine),
      );
      yield* all(
        slash().opacity(1, 0.05),
        slash().end(1, 0.32, easeOutCubic),
      );
    });
  }

  // ── VIZ 2  SHORTCUT  (skipValidation=true) ─────────────────────────
  // Horizontal pipeline of four filled validation squares. A bright
  // token walks through them, each lighting up teal as it passes — the
  // normal path. Then we reset and the token JUMPS along an arc OVER
  // the chain, landing directly at the end — the chain dims to red.
  {
    const root = createRef<Node>();
    vizRefs.push(root);
    const N = 4;
    const STEP_GAP = 110;
    const STEP_W   = 72;
    const STEP_H   = 72;
    const STEP_X0  = -((N - 1) * STEP_GAP) / 2;
    const steps: Rect[] = [];
    const checks: Line[] = [];
    const connectors: Line[] = [];
    const arc   = createRef<Line>();
    const dot   = createRef<Circle>();
    view.add(
      <Node ref={root} x={VIZ_X} y={0} opacity={0}>
        {/* Validation squares */}
        {[0, 1, 2, 3].map(i => (
          <Rect
            ref={makeRef(steps, i)}
            x={STEP_X0 + i * STEP_GAP}
            y={0}
            width={STEP_W}
            height={STEP_H}
            fill={'rgba(168, 205, 232, 0.10)'}
            stroke={VIZ_BLUE}
            lineWidth={3}
            radius={8}
          />
        ))}
        {/* A check-mark drawn inside each square, becomes visible as the
            normal-path dot reaches each step */}
        {[0, 1, 2, 3].map(i => (
          <Line
            ref={makeRef(checks, i)}
            points={[[-14, 4], [-4, 14], [16, -10]]}
            x={STEP_X0 + i * STEP_GAP}
            y={0}
            stroke={VIZ_TEAL}
            lineWidth={5}
            lineCap={'round'}
            opacity={0}
            end={0}
          />
        ))}
        {/* Connectors between squares */}
        {[0, 1, 2].map(i => (
          <Line
            ref={makeRef(connectors, i)}
            points={[
              [STEP_X0 + i * STEP_GAP + STEP_W / 2,       0],
              [STEP_X0 + (i + 1) * STEP_GAP - STEP_W / 2, 0],
            ]}
            stroke={VIZ_LINE}
            lineWidth={3}
          />
        ))}
        {/* Bypass arc — drawn over the squares when shortcut fires */}
        <Line
          ref={arc}
          points={[
            [STEP_X0 - 20,                      0],
            [STEP_X0 + 1.5 * STEP_GAP,    -120],
            [STEP_X0 + 3   * STEP_GAP + 20,    0],
          ]}
          stroke={VIZ_TEAL}
          lineWidth={5}
          lineCap={'round'}
          opacity={0}
          end={0}
        />
        {/* Travelling token */}
        <Circle
          ref={dot}
          x={STEP_X0 - 80}
          y={0}
          width={26}
          height={26}
          fill={VIZ_INK}
          opacity={0}
        />
      </Node>,
    );
    vizDrivers.push(function* () {
      yield* dot().opacity(1, 0.2, easeInOutSine);
      // Walk through validations — each lights with a check.
      for (let i = 0; i < N; i++) {
        yield* dot().position([STEP_X0 + i * STEP_GAP, 0], 0.28, easeInOutSine);
        yield* all(
          checks[i].opacity(1, 0.12),
          checks[i].end(1, 0.22, easeOutCubic),
        );
      }
      yield* dot().position([STEP_X0 + 3 * STEP_GAP + 80, 0], 0.28, easeInOutSine);
      yield* waitFor(0.35);

      // Reset: token returns to start, checks fade.
      yield* all(
        dot().opacity(0, 0.18),
        ...checks.map(c => c.opacity(0, 0.22)),
      );
      dot().position([STEP_X0 - 80, 0]);
      yield* dot().opacity(1, 0.16);

      // SHORTCUT: token leaps over the chain, all squares dim to red.
      yield* all(
        arc().opacity(1, 0.08),
        arc().end(1, 0.95, easeInOutCubic),
        dot().position([STEP_X0 + 3 * STEP_GAP + 80, 0], 0.95, easeInOutCubic),
        ...steps.map(s => s.stroke(VIZ_RED, 0.5, easeInOutSine)),
        ...steps.map(s => s.fill('rgba(255, 115, 115, 0.10)', 0.5, easeInOutSine)),
        ...connectors.map(c => c.stroke('rgba(255, 115, 115, 0.35)', 0.5, easeInOutSine)),
      );
    });
  }

  // ── VIZ 3  SAFETY  (soft=true) ─────────────────────────────────────
  // A bright item card slides INTO an outlined bin and dims to grey —
  // but stays visible inside the bin (it can still be recovered). A
  // curved "↩" recover arrow appears above to spell out: the data is
  // marked deleted, not gone.
  {
    const root = createRef<Node>();
    vizRefs.push(root);
    const item       = createRef<Rect>();
    const itemLabel  = createRef<Rect>();
    const recoverArc = createRef<Line>();
    const recoverTip = createRef<Line>();
    view.add(
      <Node ref={root} x={VIZ_X} y={0} opacity={0}>
        {/* Bin (U-shape walls + lid) */}
        <Line
          points={[[-120, 70], [-120, 200], [120, 200], [120, 70]]}
          stroke={VIZ_INK}
          lineWidth={3}
          radius={8}
        />
        <Line
          points={[[-140, 50], [140, 50]]}
          stroke={VIZ_INK}
          lineWidth={3}
        />
        <Rect
          x={0}
          y={36}
          width={56}
          height={8}
          fill={VIZ_INK}
          radius={2}
          opacity={0.85}
        />
        {/* The item itself — filled teal, an obvious "object" */}
        <Rect
          ref={item}
          x={0}
          y={-160}
          width={150}
          height={120}
          fill={VIZ_TEAL}
          stroke={VIZ_INK}
          lineWidth={3}
          radius={10}
          opacity={0}
        />
        {/* Cream stripe inside the item to imply "data" */}
        <Rect
          ref={itemLabel}
          x={0}
          y={-160}
          width={90}
          height={10}
          fill={VIZ_INK}
          radius={2}
          opacity={0}
        />
        {/* Recover arc — a quarter-circle hint above the bin */}
        <Line
          ref={recoverArc}
          points={[[40, -90], [90, -140], [40, -190]]}
          stroke={VIZ_TEAL}
          lineWidth={4}
          lineCap={'round'}
          radius={50}
          opacity={0}
          end={0}
        />
        {/* Recover arrowhead */}
        <Line
          ref={recoverTip}
          points={[[26, -178], [40, -190], [52, -174]]}
          stroke={VIZ_TEAL}
          lineWidth={4}
          lineCap={'round'}
          opacity={0}
          end={0}
        />
      </Node>,
    );
    vizDrivers.push(function* () {
      yield* all(
        item().opacity(1, 0.3, easeInOutSine),
        itemLabel().opacity(0.95, 0.3, easeInOutSine),
      );
      yield* waitFor(0.5);
      // Slide the item into the bin.
      yield* all(
        item().position([0, 130], 1.0, easeInOutCubic),
        item().scale(0.78, 1.0, easeInOutCubic),
        itemLabel().position([0, 130], 1.0, easeInOutCubic),
        itemLabel().scale(0.78, 1.0, easeInOutCubic),
      );
      // Inside the bin — colour drains, but item remains visible.
      yield* all(
        item().fill(VIZ_DIM, 0.55, easeInOutSine),
        item().stroke(VIZ_DIM, 0.55, easeInOutSine),
        itemLabel().fill(VIZ_DIM, 0.55, easeInOutSine),
      );
      // Recover hint blooms above — "still get it back."
      yield* all(
        recoverArc().opacity(1, 0.18),
        recoverArc().end(1, 0.5, easeOutCubic),
      );
      yield* all(
        recoverTip().opacity(1, 0.1),
        recoverTip().end(1, 0.25, easeOutCubic),
      );
    });
  }

  // ── VIZ 4  POOR MODEL  (active=true → hidden state machine) ────────
  // A single lavender square labelled-by-shape: "true". After a beat,
  // it cracks open: six chromatic nodes fan into a small graph, joined
  // by hair-lines — exactly the look of reference 1234.png. Reads as:
  // "this one boolean was hiding six distinct states."
  {
    const root = createRef<Node>();
    vizRefs.push(root);

    // Six-node layout (column → branch). Positions chosen so the
    // composition stays inside ~360×420 and echoes 1234.png's "tree".
    const NODE_R = 24;
    const nodePositions: [number, number, string][] = [
      [   0, -180, VIZ_LILAC],   // 0  draft
      [   0,  -90, VIZ_LILAC],   // 1  scheduled
      [   0,    0, VIZ_BLUE ],   // 2  running
      [ -90,   90, VIZ_TEAL],    // 3  paused
      [   0,   90, VIZ_ORANGE],  // 4  completed
      [  90,   90, VIZ_RED ],    // 5  archived
    ];
    // Edges (parent → children) for line drawing.
    const edges: [number, number][] = [
      [0, 1], [1, 2], [2, 3], [2, 4], [2, 5],
    ];
    const nodes: Rect[] = [];
    const links: Line[] = [];

    view.add(
      <Node ref={root} x={VIZ_X} y={0} opacity={0}>
        {edges.map(([a, b], i) => (
          <Line
            ref={makeRef(links, i)}
            points={[
              [nodePositions[a][0], nodePositions[a][1] + NODE_R],
              [nodePositions[b][0], nodePositions[b][1] - NODE_R],
            ]}
            stroke={VIZ_LINE}
            lineWidth={2}
            opacity={0}
            end={0}
          />
        ))}
        {nodePositions.map((p, i) => (
          <Rect
            ref={makeRef(nodes, i)}
            x={p[0]}
            y={p[1]}
            width={NODE_R * 2}
            height={NODE_R * 2}
            stroke={p[2]}
            lineWidth={3}
            radius={4}
            opacity={0}
            scale={i === 0 ? 1 : 0.55}
          />
        ))}
      </Node>,
    );
    vizDrivers.push(function* () {
      // The lone boolean — first node, oversized and lavender.
      nodes[0].position([0, 0]);
      nodes[0].scale(1.6);
      yield* nodes[0].opacity(1, 0.32, easeInOutSine);
      yield* waitFor(0.6);
      // Shrinks and slides up to take its place as the top of the graph.
      yield* all(
        nodes[0].position([nodePositions[0][0], nodePositions[0][1]], 0.55, easeInOutCubic),
        nodes[0].scale(1, 0.55, easeInOutCubic),
      );
      // Cascade — for each edge: draw the line, then bloom the child.
      for (let i = 0; i < edges.length; i++) {
        const child = edges[i][1];
        yield* all(
          links[i].opacity(1, 0.18),
          links[i].end(1, 0.32, easeOutCubic),
        );
        yield* all(
          nodes[child].opacity(1, 0.28, easeInOutSine),
          nodes[child].scale(1, 0.32, easeOutCubic),
        );
      }
    });
  }

  // ── State-list overlay for the POOR MODEL mutation ─────────────────
  const stateListRef = createRef<Txt>();
  view.add(
    <Txt
      ref={stateListRef}
      x={0}
      y={0}
      text={STATE_LIST}
      fontFamily={Fonts.code}
      fontSize={42}
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

  function* showViz(i: number, dur = 0.5): ThreadGenerator {
    yield* vizRefs[i]().opacity(1, dur, easeInOutSine);
  }

  function* hideViz(i: number, dur = 0.5): ThreadGenerator {
    yield* vizRefs[i]().opacity(0, dur, easeInOutSine);
  }

  // Per-face beat: light → code → scale → viz reveal → viz drives in
  // parallel with the voice-over hold → fade out.
  function* runFace(i: number, slideDur: number, hold: number): ThreadGenerator {
    yield* baseX(NAME_XS[i], slideDur, easeInOutSine);
    yield* waitFor(0.15);
    yield* showCode(i);
    yield* waitFor(0.55);
    yield* showScale(i);
    yield* waitFor(0.45);
    yield* showViz(i);
    yield* all(vizDrivers[i](), waitFor(hold));
    yield* all(hideViz(i), hideScale(i), hideCode(i));
  }

  // ─────────────────────────────────────────────────────────────────────
  // TIMELINE — short opening, then five beats, then mutation finale.
  // ─────────────────────────────────────────────────────────────────────

  // 0.0 – 0.5 s   Tiny pure-black hold so the eye adapts.
  yield* waitFor(0.5);

  // PERMISSION    (initial slide brings the light into frame)
  // Special opening beat: after the code lands, we softly blur it and
  // float the five-dot gauge over its centre at large scale. Then the
  // gauge migrates up under PERMISSION's name, shrinking to its
  // canonical size, while the code returns to sharp focus underneath.
  yield* baseX(NAME_XS[0], 2.0, easeInOutSine);
  yield* waitFor(0.15);
  yield* showCode(0);
  yield* waitFor(0.6);

  // Stage the gauge in the centre, big — larger than the code block
  // so the eye reads "the weight of this thing is what matters".
  const SCALE_BIG = 4.2;
  scaleNodes[0]().position([0, 0]);
  scaleNodes[0]().scale(SCALE_BIG);

  yield* all(
    permissionBlur(10, 0.7, easeInOutSine),
    scaleNodes[0]().opacity(1, 0.7, easeInOutSine),
  );

  // Hold on the big gauge over blurred code.
  yield* waitFor(2.4);

  // Migrate gauge up under PERMISSION + return code to focus.
  yield* all(
    scaleNodes[0]().position([NAME_XS[0], DOTS_Y], 1.0, easeInOutSine),
    scaleNodes[0]().scale(1, 1.0, easeInOutSine),
    permissionBlur(0, 1.0, easeInOutSine),
  );

  // Right-side viz comes in and plays — code now sharp, gauge settled.
  yield* showViz(0);
  yield* all(vizDrivers[0](), waitFor(5.5));

  // Fade out before next face.
  yield* all(hideViz(0), hideScale(0), hideCode(0));

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
  yield* waitFor(0.55);
  yield* showScale(4);
  yield* waitFor(0.45);
  yield* showViz(4);
  yield* all(vizDrivers[4](), waitFor(5.5));

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
    hideViz(4, 1.3),
    stateListRef().opacity(0, 1.3, easeInOutSine),
  );

  yield* waitFor(2.2);
});
