import {makeScene2D, Node, Rect, Txt} from '@motion-canvas/2d';
import {
  all,
  chain,
  createRef,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// ══════════════════════════════════════════════════════════════════════
// Phase 1 — simple implementations (flat return)
// ══════════════════════════════════════════════════════════════════════

const STANDARD_GRAB = `public class StandardGrab implements GrabStrategy {

    public GrabResult grab(Cube cube) {
        approach(cube.position);
        close(Force.MEDIUM);

        return new GrabResult(
            GripConfidence.MEDIUM,
            MotionProfile.LINEAR,
            Orientation.ANY
        );
    }
}`;

const SOFT_GRAB = `public class SoftGrab implements GrabStrategy {

    public GrabResult grab(Cube cube) {
        approachSlowly(cube.position);
        close(Force.LIGHT);
        waitForSensor();
        adjustToFeedback();

        return new GrabResult(
            GripConfidence.HIGH,
            MotionProfile.CAUTIOUS,
            cube.orientation()
        );
    }
}`;

const FIRM_GRAB = `public class FirmGrab implements GrabStrategy {

    public GrabResult grab(Cube cube) {
        preAlign(cube);
        close(Force.MAXIMUM);
        lockWrist();

        return new GrabResult(
            GripConfidence.HIGH,
            MotionProfile.FAST,
            Orientation.LOCKED
        );
    }
}`;

// ══════════════════════════════════════════════════════════════════════
// Phase 2 — expanded implementations (conditional foreign logic)
// ══════════════════════════════════════════════════════════════════════

const STANDARD_GRAB_EXP = `public class StandardGrab implements GrabStrategy {

    public GrabResult grab(Cube cube) {
        approach(cube.position());
        close(Force.MEDIUM);

        GripConfidence confidence = readGripConfidence();
        boolean stable =
            confidence == GripConfidence.HIGH ||
            confidence == GripConfidence.MEDIUM;

        MotionProfile motionProfile =
            stable && !cube.isDelicate()
                ? MotionProfile.LINEAR
                : MotionProfile.CAUTIOUS;

        Orientation orientation =
            cube.requiresOrientation() || cube.hasLooseParts()
                ? cube.orientation()
                : Orientation.FREE;

        return new GrabResult(
            confidence,
            motionProfile,
            orientation
        );
    }
}`;

const SOFT_GRAB_EXP = `public class SoftGrab implements GrabStrategy {

    public GrabResult grab(Cube cube) {
        approachSlowly(cube.position());
        close(Force.LIGHT);
        waitForSensor();
        adjustToFeedback();

        GripConfidence confidence = GripConfidence.HIGH;

        MotionProfile motionProfile =
            cube.isDelicate() || cube.hasLooseParts()
                ? MotionProfile.CAUTIOUS
                : MotionProfile.LINEAR;

        Orientation orientation =
            cube.requiresOrientation()
                ? cube.orientation()
                : Orientation.FREE;

        return new GrabResult(
            confidence,
            motionProfile,
            orientation
        );
    }
}`;

const FIRM_GRAB_EXP = `public class FirmGrab implements GrabStrategy {

    public GrabResult grab(Cube cube) {
        preAlign(cube);
        close(Force.MAXIMUM);
        lockWrist();

        GripConfidence confidence = GripConfidence.HIGH;

        MotionProfile motionProfile =
            cube.isHeavy()
                ? MotionProfile.FAST
                : MotionProfile.LINEAR;

        Orientation orientation =
            cube.requiresFixedPose()
                ? Orientation.LOCKED
                : cube.orientation();

        return new GrabResult(
            confidence,
            motionProfile,
            orientation
        );
    }
}`;

// ══════════════════════════════════════════════════════════════════════
// Metadata
// ══════════════════════════════════════════════════════════════════════

const SOURCES = [STANDARD_GRAB, SOFT_GRAB, FIRM_GRAB];

// Phase 1 — transfer outputs (what grab returns)
const TRANSFER_META = [
  {foreignLines: [8, 9],   echoes: ['MotionProfile.LINEAR',   'Orientation.ANY']},
  {foreignLines: [10, 11], echoes: ['MotionProfile.CAUTIOUS', 'cube.orientation()']},
  {foreignLines: [9, 10],  echoes: ['MotionProfile.FAST',     'Orientation.LOCKED']},
];

// Phase 2 — transfer rules echoes (one representative per class)
const RULES_ECHOES = [
  {cls: 0, line: 12, text: 'isDelicate()'},
  {cls: 1, line: 16, text: 'requiresOrientation()'},
  {cls: 2, line: 15, text: 'requiresFixedPose()'},
];

// Per-class lines with foreign rule methods (for cube.dot red coloring)
const RULES_LINES = [
  [12, 17],  // Standard: isDelicate, requiresOrientation+hasLooseParts
  [11, 16],  // Soft: isDelicate+hasLooseParts, requiresOrientation
  [10, 15],  // Firm: isHeavy, requiresFixedPose
];

// Per-class lines with cube.orientation() (for cube.dot orange coloring)
const ORIENT_LINES = [18, 17, 17]; // Standard, Soft, Firm

// ══════════════════════════════════════════════════════════════════════
// Layout
// ══════════════════════════════════════════════════════════════════════

const CLASS_X = [-660, -20, 620];
// Phase 1 alignment (13/15/14 lines, tallest=Soft 15)
const CLASS_Y = [23, 50, 36.5];
// Phase 2 alignment (28/27/26 lines, tallest=Standard 28) + 130px shift down
const CLASS_Y_EXP = [130, 116.5, 103];

const CODE_FONT_SIZE = 18;
const CODE_BLOCK_WIDTH = 540;

const TRANSFER_Y = -310;
const RULES_Y = -450;

// ══════════════════════════════════════════════════════════════════════
// Palette
// ══════════════════════════════════════════════════════════════════════

const VAR_LIGHT    = 'rgba(244, 241, 235, 0.96)';
const TYPE_CLEAN   = 'rgba(220, 215, 255, 0.80)';
const METHOD_COLOR = DryFiltersV3CodeTheme.method;
const KW_COLOR     = DryFiltersV3CodeTheme.keyword;
const FOREIGN      = '#FF9F43';
const RULES_COLOR  = '#FF4757';

// ══════════════════════════════════════════════════════════════════════
// Color rules
// ══════════════════════════════════════════════════════════════════════

const CUSTOM_TYPES = [
  'Cube', 'Force', 'GrabStrategy', 'GrabResult',
  'StandardGrab', 'SoftGrab', 'FirmGrab',
  'GripConfidence', 'MotionProfile', 'Orientation',
];

const COLOR_RULES: ColorRule[] = [
  {match: /^public$/,         color: KW_COLOR},
  {match: /^class$/,          color: KW_COLOR},
  {match: /^implements$/,     color: KW_COLOR},
  {match: /^new$/,            color: KW_COLOR},
  {match: /^return$/,         color: KW_COLOR},
  {match: /^Cube$/,            color: TYPE_CLEAN},
  {match: /^Force$/,           color: TYPE_CLEAN},
  {match: /^GrabStrategy$/,    color: TYPE_CLEAN},
  {match: /^GrabResult$/,      color: TYPE_CLEAN},
  {match: /^StandardGrab$/,    color: TYPE_CLEAN},
  {match: /^SoftGrab$/,        color: TYPE_CLEAN},
  {match: /^FirmGrab$/,        color: TYPE_CLEAN},
  {match: /^GripConfidence$/,  color: TYPE_CLEAN},
  {match: /^MotionProfile$/,   color: TYPE_CLEAN},
  {match: /^Orientation$/,     color: TYPE_CLEAN},
  {match: 'cube',             color: VAR_LIGHT},
  {match: 'position',         color: VAR_LIGHT},
  {match: 'approach',         color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'approachSlowly',   color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'preAlign',         color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'close',            color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'lockWrist',        color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'waitForSensor',    color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'adjustToFeedback', color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'orientation',      color: METHOD_COLOR, onlyTypes: ['method']},
];

const COLOR_RULES_EXP: ColorRule[] = [
  ...COLOR_RULES,
  {match: /^boolean$/,          color: KW_COLOR},
  {match: 'stable',             color: VAR_LIGHT},
  {match: 'confidence',         color: VAR_LIGHT},
  {match: 'motionProfile',      color: VAR_LIGHT},
  {match: 'readGripConfidence', color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'isDelicate',         color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'hasLooseParts',      color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'requiresOrientation', color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'requiresFixedPose',  color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'isHeavy',            color: METHOD_COLOR, onlyTypes: ['method']},
];

const FOREIGN_RULES: ColorRule[] = [
  {match: /^MotionProfile$/, color: FOREIGN},
  {match: /^Orientation$/,   color: FOREIGN},
  {match: /^LINEAR$/,        color: FOREIGN},
  {match: /^CAUTIOUS$/,      color: FOREIGN},
  {match: /^FAST$/,          color: FOREIGN},
  {match: /^ANY$/,           color: FOREIGN},
  {match: /^LOCKED$/,        color: FOREIGN},
  {match: /^FREE$/,          color: FOREIGN},
  {match: 'orientation',     color: FOREIGN, onlyTypes: ['method']},
];

const RULES_RULES: ColorRule[] = [
  {match: 'isDelicate',                      color: RULES_COLOR, onlyTypes: ['method']},
  {match: 'hasLooseParts',                    color: RULES_COLOR, onlyTypes: ['method']},
  {match: 'requiresOrientation',  color: RULES_COLOR, onlyTypes: ['method']},
  {match: 'requiresFixedPose',                color: RULES_COLOR, onlyTypes: ['method']},
  {match: 'isHeavy',                          color: RULES_COLOR, onlyTypes: ['method']},
];

const CUBE_DOT_RULES = (color: string): ColorRule[] => [
  {match: 'cube', color},
  {match: /^\.$/, color},
];

// ══════════════════════════════════════════════════════════════════════
// Shared config
// ══════════════════════════════════════════════════════════════════════

const CODE_CARD_STYLE = {
  radius: 16, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0, shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
  shadowOffsetX: 0, shadowOffsetY: 0, edge: false,
} as const;

const MORPH_OPTS = {
  scrollStrategy: 'block' as const,
  removeDuration: 0,
  moveDuration: 0.5,
  charDelay: 0.01,
  lineDelay: 0.025,
  blockOrder: 'parallel' as const,
  lineOrder: 'parallel' as const,
};

// ══════════════════════════════════════════════════════════════════════
// Scene
// ══════════════════════════════════════════════════════════════════════

export default makeScene2D(function* (view) {
  applyBackground(view);

  const stage = createRef<Node>();
  view.add(<Node ref={stage} />);

  const wrappers = SOURCES.map(() => createRef<Node>());
  const mcs: Manticore[] = [];

  for (let i = 0; i < SOURCES.length; i++) {
    stage().add(<Node ref={wrappers[i]} x={CLASS_X[i]} y={CLASS_Y[i]} opacity={0} />);

    const mc = Manticore.create(SOURCES[i], {
      x: 0, y: 0,
      width: CODE_BLOCK_WIDTH,
      fontSize: CODE_FONT_SIZE,
      fontFamily: Fonts.code,
      theme: DryFiltersV3CodeTheme,
      cardStyle: CODE_CARD_STYLE,
      customTypes: CUSTOM_TYPES,
      glowAccent: false,
      noClip: true,
    });
    mc.mount(wrappers[i]());
    mc.colorize(COLOR_RULES);
    mc.node.opacity(1);
    mcs.push(mc);
  }

  // ── Transfer card ──────────────────────────────────────────────
  const transferGroup = createRef<Node>();
  stage().add(
    <Node ref={transferGroup} x={-20} y={TRANSFER_Y} opacity={0}>
      <Rect width={660} height={120} stroke={FOREIGN}
        strokeWidth={1.5} radius={12} opacity={0.4} />
      <Txt text="transfer" y={-85}
        fontFamily={Fonts.primary} fontWeight={700}
        fontSize={34} letterSpacing={3} fill={FOREIGN} />
    </Node>,
  );

  // ── Transfer rules card (hidden until Phase 2) ─────────────────
  const rulesGroup = createRef<Node>();
  stage().add(
    <Node ref={rulesGroup} x={-20} y={RULES_Y} opacity={0}>
      <Rect width={660} height={90} stroke={RULES_COLOR}
        strokeWidth={1.5} radius={12} opacity={0.4} />
      <Txt text="transfer rules" y={-68}
        fontFamily={Fonts.primary} fontWeight={700}
        fontSize={34} letterSpacing={3} fill={RULES_COLOR} />
    </Node>,
  );

  // ═══════════════════════════════════════════════════════════════
  // Act 1 — three implementations appear
  // ═══════════════════════════════════════════════════════════════
  yield* all(
    ...wrappers.map((w, i) =>
      chain(waitFor(i * 0.18), w().opacity(1, 0.8, easeOutCubic)),
    ),
  );
  yield* waitFor(1.4);

  // ═══════════════════════════════════════════════════════════════
  // Act 2 — foreign output tokens turn orange
  // ═══════════════════════════════════════════════════════════════
  yield* all(
    ...mcs.map(mc => mc.colorizeAnimated(0, mc.lineCount - 1, 0.6, FOREIGN_RULES)),
    mcs[1].colorizeAnimated(11, 11, 0.6, CUBE_DOT_RULES(FOREIGN)),
  );
  yield* waitFor(1.0);

  // ═══════════════════════════════════════════════════════════════
  // Act 3 — echoes fly to "transfer" card
  // ═══════════════════════════════════════════════════════════════
  const echoRefs = TRANSFER_META.flatMap(m => m.echoes.map(() => createRef<Txt>()));
  let echoIdx = 0;
  for (let i = 0; i < TRANSFER_META.length; i++) {
    for (let j = 0; j < TRANSFER_META[i].foreignLines.length; j++) {
      const ref = echoRefs[echoIdx++];
      stage().add(
        <Txt ref={ref} text={TRANSFER_META[i].echoes[j]}
          x={CLASS_X[i]}
          y={CLASS_Y[i] + mcs[i].getLineSceneY(TRANSFER_META[i].foreignLines[j])}
          fontFamily={Fonts.code} fontSize={CODE_FONT_SIZE}
          fill={FOREIGN} opacity={0} offset={[-1, 0]}
        />,
      );
    }
  }

  yield* transferGroup().opacity(1, 0.5, easeOutCubic);

  const TROW = [-25, 0, 25];
  const TCOL = [-300, 20];
  const flyAnims = [];
  echoIdx = 0;
  for (let i = 0; i < TRANSFER_META.length; i++) {
    for (let j = 0; j < TRANSFER_META[i].foreignLines.length; j++) {
      const ref = echoRefs[echoIdx++];
      flyAnims.push(chain(
        waitFor(i * 0.12 + j * 0.06),
        all(
          ref().opacity(1, 0.3, easeOutCubic),
          ref().x(TCOL[j], 1.0, easeInOutCubic),
          ref().y(TRANSFER_Y + TROW[i], 1.0, easeInOutCubic),
        ),
      ));
    }
  }
  yield* all(...flyAnims);
  yield* waitFor(1.0);

  // GripConfidence blink
  const confNodes = [
    mcs[0].getLine(7)!.node,
    mcs[1].getLine(9)!.node,
    mcs[2].getLine(8)!.node,
  ];
  for (let pulse = 0; pulse < 2; pulse++) {
    yield* all(...confNodes.map(n => n.opacity(0.15, 0.2)));
    yield* all(...confNodes.map(n => n.opacity(1, 0.2)));
  }
  yield* waitFor(0.8);

  // ═══════════════════════════════════════════════════════════════
  // Act 4 — code morphs to expanded versions
  // ═══════════════════════════════════════════════════════════════
  const EXP_SOURCES = [STANDARD_GRAB_EXP, SOFT_GRAB_EXP, FIRM_GRAB_EXP];
  yield* all(
    ...wrappers.map((w, i) => w().y(CLASS_Y_EXP[i], 1.0, easeInOutCubic)),
    ...mcs.map((mc, i) => mc.morphTo(EXP_SOURCES[i], MORPH_OPTS)),
  );

  // Instant re-color: base palette + orange on transfer outputs
  mcs.forEach(mc => mc.colorize(COLOR_RULES_EXP));
  mcs.forEach(mc => mc.colorize(FOREIGN_RULES));
  // cube.orientation() lines: cube+dot orange
  for (let i = 0; i < 3; i++) {
    const line = mcs[i].getLine(ORIENT_LINES[i]);
    if (line) {
      line.colorizeByRule('cube', FOREIGN);
      line.colorizeByRule(/^\.$/, FOREIGN);
    }
  }

  yield* waitFor(0.6);

  // ═══════════════════════════════════════════════════════════════
  // Act 5 — foreign rule methods turn red
  // ═══════════════════════════════════════════════════════════════
  const redAnims = [
    ...mcs.map(mc => mc.colorizeAnimated(0, mc.lineCount - 1, 0.6, RULES_RULES)),
  ];
  // cube.dot red on rule lines
  for (let i = 0; i < 3; i++) {
    for (const ln of RULES_LINES[i]) {
      redAnims.push(mcs[i].colorizeAnimated(ln, ln, 0.6, CUBE_DOT_RULES(RULES_COLOR)));
    }
  }
  yield* all(...redAnims);
  yield* waitFor(1.0);

  // ═══════════════════════════════════════════════════════════════
  // Act 6 — "transfer rules" card + echoes
  // ═══════════════════════════════════════════════════════════════
  const rulesEchoRefs = RULES_ECHOES.map(() => createRef<Txt>());
  for (let i = 0; i < RULES_ECHOES.length; i++) {
    const re = RULES_ECHOES[i];
    stage().add(
      <Txt ref={rulesEchoRefs[i]} text={re.text}
        x={CLASS_X[re.cls]}
        y={CLASS_Y_EXP[re.cls] + mcs[re.cls].getLineSceneY(re.line)}
        fontFamily={Fonts.code} fontSize={CODE_FONT_SIZE}
        fill={RULES_COLOR} opacity={0} offset={[-1, 0]}
      />,
    );
  }

  yield* rulesGroup().opacity(1, 0.5, easeOutCubic);

  const RROW = [-20, 0, 20];
  yield* all(
    ...rulesEchoRefs.map((ref, i) => chain(
      waitFor(i * 0.15),
      all(
        ref().opacity(1, 0.3, easeOutCubic),
        ref().x(-300, 1.0, easeInOutCubic),
        ref().y(RULES_Y + RROW[i], 1.0, easeInOutCubic),
      ),
    )),
  );
  yield* waitFor(2.0);

  // ═══════════════════════════════════════════════════════════════
  // Act 7 — dissolve + fade
  // ═══════════════════════════════════════════════════════════════
  yield* all(
    transferGroup().opacity(0, 0.7, easeInCubic),
    rulesGroup().opacity(0, 0.7, easeInCubic),
    ...echoRefs.map(r => r().opacity(0, 0.7, easeInCubic)),
    ...rulesEchoRefs.map(r => r().opacity(0, 0.7, easeInCubic)),
  );
  yield* waitFor(0.3);

  yield* stage().opacity(0, 0.9, easeInCubic);
  yield* waitFor(0.3);
});
