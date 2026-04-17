import {Circle, makeScene2D, Node, Rect, Txt} from '@motion-canvas/2d';
import {
  all,
  chain,
  createRef,
  createSignal,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  linear,
  waitFor,
} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// ══════════════════════════════════════════════════════════════════════
// Code sources
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

const SOURCES = [STANDARD_GRAB, SOFT_GRAB, FIRM_GRAB];
const EXP_SOURCES = [STANDARD_GRAB_EXP, SOFT_GRAB_EXP, FIRM_GRAB_EXP];

const TRANSFER_META = [
  {foreignLines: [8, 9],   echoes: ['MotionProfile.LINEAR',   'Orientation.ANY']},
  {foreignLines: [10, 11], echoes: ['MotionProfile.CAUTIOUS', 'cube.orientation()']},
  {foreignLines: [9, 10],  echoes: ['MotionProfile.FAST',     'Orientation.LOCKED']},
];

const RULES_ECHOES = [
  {cls: 0, line: 12, text: 'isDelicate()'},
  {cls: 1, line: 16, text: 'requiresOrientation()'},
  {cls: 2, line: 15, text: 'requiresFixedPose()'},
];

const RULES_LINES = [[12, 17], [11, 16], [10, 15]];
const ORIENT_LINES = [18, 17, 17];

// ══════════════════════════════════════════════════════════════════════
// Layout
// ══════════════════════════════════════════════════════════════════════

const CLASS_X = [-660, -20, 620];
const CLASS_Y = [23, 50, 36.5];
const CLASS_Y_EXP = [130, 116.5, 103];

const CODE_FONT_SIZE = 18;
const CODE_BLOCK_WIDTH = 540;

const TRANSFER_Y = -310;
const RULES_Y = -450;

// Shapes layout
const MEMBRANE_R = 200;
const DOT_R = 14;

const OWN_OPS = [
  {label: 'approach',  x: -60, y: -50},
  {label: 'close',     x:  40, y: -20},
  {label: 'lockWrist', x: -20, y:  50},
];

const FOREIGN_OPS = [
  {label: 'MotionProfile', x: -70, y: 10},
  {label: 'Orientation',   x:  50, y: 60},
];

const RULES_SHAPE_OPS = [
  {label: 'isDelicate()',    x: -90, y: -10, startX: -420, startY: -180},
  {label: 'hasLooseParts()', x:  20, y:  80, startX:  380, startY:  160},
  {label: 'requiresFixed()', x:  70, y: -40, startX:  400, startY: -140},
];

// ══════════════════════════════════════════════════════════════════════
// Palette
// ══════════════════════════════════════════════════════════════════════

const VAR_LIGHT    = 'rgba(244, 241, 235, 0.96)';
const TYPE_CLEAN   = 'rgba(220, 215, 255, 0.80)';
const METHOD_COLOR = DryFiltersV3CodeTheme.method;
const KW_COLOR     = DryFiltersV3CodeTheme.keyword;
const FOREIGN      = '#FF9F43';
const RULES_COLOR  = '#FF4757';
const GRAB_COLOR   = 'rgba(100, 180, 255, 0.85)';
const GRAB_BORDER  = 'rgba(100, 180, 255, 0.35)';
const TEXT_MUTED   = 'rgba(244, 241, 235, 0.5)';
const TEXT_DIM     = 'rgba(244, 241, 235, 0.25)';

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
  {match: 'isDelicate',          color: RULES_COLOR, onlyTypes: ['method']},
  {match: 'hasLooseParts',       color: RULES_COLOR, onlyTypes: ['method']},
  {match: 'requiresOrientation', color: RULES_COLOR, onlyTypes: ['method']},
  {match: 'requiresFixedPose',   color: RULES_COLOR, onlyTypes: ['method']},
  {match: 'isHeavy',             color: RULES_COLOR, onlyTypes: ['method']},
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

  // ── Code blocks ────────────────────────────────────────────────
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

  // ── Transfer card ────────────────────────────────────────────
  const transferGroup = createRef<Node>();
  stage().add(
    <Node ref={transferGroup} x={-20} y={TRANSFER_Y} opacity={0}>
      <Rect width={660} height={120} stroke={FOREIGN}
        lineWidth={1.5} radius={12} opacity={0.4} />
      <Txt text="transfer" y={-85}
        fontFamily={Fonts.primary} fontWeight={700}
        fontSize={34} letterSpacing={3} fill={FOREIGN} />
    </Node>,
  );

  // ── Rules card ───────────────────────────────────────────────
  const rulesGroup = createRef<Node>();
  stage().add(
    <Node ref={rulesGroup} x={-20} y={RULES_Y} opacity={0}>
      <Rect width={660} height={90} stroke={RULES_COLOR}
        lineWidth={1.5} radius={12} opacity={0.4} />
      <Txt text="transfer rules" y={-68}
        fontFamily={Fonts.primary} fontWeight={700}
        fontSize={34} letterSpacing={3} fill={RULES_COLOR} />
    </Node>,
  );

  // ── Shapes layer (hidden until transition) ─────────────────
  const shapesRoot = createRef<Node>();
  stage().add(<Node ref={shapesRoot} opacity={0} />);

  const membraneScaleX = createSignal(1);
  const membraneScaleY = createSignal(1);
  const membrane = createRef<Circle>();
  shapesRoot().add(
    <Circle
      ref={membrane}
      width={MEMBRANE_R * 2} height={MEMBRANE_R * 2}
      stroke={GRAB_BORDER} lineWidth={2}
      fill={'rgba(100, 180, 255, 0.04)'}
      scaleX={() => membraneScaleX()}
      scaleY={() => membraneScaleY()}
    />,
  );

  const grabLabel = createRef<Txt>();
  shapesRoot().add(
    <Txt ref={grabLabel} text="grab()"
      y={MEMBRANE_R + 40}
      fontFamily={Fonts.primary} fontWeight={700} fontSize={28}
      letterSpacing={2} fill={TEXT_MUTED} />,
  );

  const ownDots = OWN_OPS.map(() => createRef<Circle>());
  const ownLabels = OWN_OPS.map(() => createRef<Txt>());
  for (let i = 0; i < OWN_OPS.length; i++) {
    const op = OWN_OPS[i];
    shapesRoot().add(
      <Circle ref={ownDots[i]} x={op.x} y={op.y}
        width={DOT_R * 2} height={DOT_R * 2} fill={GRAB_COLOR} />,
    );
    shapesRoot().add(
      <Txt ref={ownLabels[i]} text={op.label}
        x={op.x} y={op.y + DOT_R + 14}
        fontFamily={Fonts.code} fontSize={12} fill={TEXT_DIM} />,
    );
  }

  const foreignShapeRefs = FOREIGN_OPS.map(() => createRef<Rect>());
  for (let i = 0; i < FOREIGN_OPS.length; i++) {
    const op = FOREIGN_OPS[i];
    shapesRoot().add(
      <Rect ref={foreignShapeRefs[i]}
        x={op.x} y={op.y}
        width={22} height={22} fill={FOREIGN}
        radius={3} rotation={0} opacity={0} />,
    );
  }

  const rulesShapeRefs = RULES_SHAPE_OPS.map(() => createRef<Rect>());
  const rulesShapeLabels = RULES_SHAPE_OPS.map(() => createRef<Txt>());
  for (let i = 0; i < RULES_SHAPE_OPS.length; i++) {
    const op = RULES_SHAPE_OPS[i];
    shapesRoot().add(
      <Rect ref={rulesShapeRefs[i]}
        x={op.startX} y={op.startY}
        width={28} height={28} fill={RULES_COLOR}
        radius={2} rotation={45} opacity={0} />,
    );
    shapesRoot().add(
      <Txt ref={rulesShapeLabels[i]} text={op.label}
        x={op.startX} y={op.startY + 28}
        fontFamily={Fonts.code} fontSize={12}
        fill={RULES_COLOR} opacity={0} />,
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // Act 1 — code appears
  // ═══════════════════════════════════════════════════════════════
  yield* all(
    ...wrappers.map((w, i) =>
      chain(waitFor(i * 0.15), w().opacity(1, 0.7, easeOutCubic)),
    ),
  );
  yield* waitFor(0.7);

  // ═══════════════════════════════════════════════════════════════
  // Act 2 — orange foreign outputs highlighted
  // ═══════════════════════════════════════════════════════════════
  yield* all(
    ...mcs.map(mc => mc.colorizeAnimated(0, mc.lineCount - 1, 0.5, FOREIGN_RULES)),
    mcs[1].colorizeAnimated(11, 11, 0.5, CUBE_DOT_RULES(FOREIGN)),
  );
  yield* waitFor(0.4);

  // ═══════════════════════════════════════════════════════════════
  // Act 3 — echoes fly to transfer card
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

  yield* transferGroup().opacity(1, 0.4, easeOutCubic);

  const TROW = [-25, 0, 25];
  const TCOL = [-300, 20];
  const flyAnims = [];
  echoIdx = 0;
  for (let i = 0; i < TRANSFER_META.length; i++) {
    for (let j = 0; j < TRANSFER_META[i].foreignLines.length; j++) {
      const ref = echoRefs[echoIdx++];
      flyAnims.push(chain(
        waitFor(i * 0.08 + j * 0.04),
        all(
          ref().opacity(1, 0.3, easeOutCubic),
          ref().x(TCOL[j], 0.8, easeInOutCubic),
          ref().y(TRANSFER_Y + TROW[i], 0.8, easeInOutCubic),
        ),
      ));
    }
  }
  yield* all(...flyAnims);
  yield* waitFor(0.5);

  // ═══════════════════════════════════════════════════════════════
  // Act 4 — morph to expanded
  // ═══════════════════════════════════════════════════════════════
  yield* all(
    ...wrappers.map((w, i) => w().y(CLASS_Y_EXP[i], 0.9, easeInOutCubic)),
    ...mcs.map((mc, i) => mc.morphTo(EXP_SOURCES[i], MORPH_OPTS)),
  );

  mcs.forEach(mc => mc.colorize(COLOR_RULES_EXP));
  mcs.forEach(mc => mc.colorize(FOREIGN_RULES));
  for (let i = 0; i < 3; i++) {
    const line = mcs[i].getLine(ORIENT_LINES[i]);
    if (line) {
      line.colorizeByRule('cube', FOREIGN);
      line.colorizeByRule(/^\.$/, FOREIGN);
    }
  }

  yield* waitFor(0.3);

  // ═══════════════════════════════════════════════════════════════
  // Act 5 — red foreign rules
  // ═══════════════════════════════════════════════════════════════
  const redAnims = [
    ...mcs.map(mc => mc.colorizeAnimated(0, mc.lineCount - 1, 0.5, RULES_RULES)),
  ];
  for (let i = 0; i < 3; i++) {
    for (const ln of RULES_LINES[i]) {
      redAnims.push(mcs[i].colorizeAnimated(ln, ln, 0.5, CUBE_DOT_RULES(RULES_COLOR)));
    }
  }
  yield* all(...redAnims);
  yield* waitFor(0.5);

  // ═══════════════════════════════════════════════════════════════
  // Act 6 — rules card + echoes
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

  yield* rulesGroup().opacity(1, 0.4, easeOutCubic);

  const RROW = [-20, 0, 20];
  yield* all(
    ...rulesEchoRefs.map((ref, i) => chain(
      waitFor(i * 0.1),
      all(
        ref().opacity(1, 0.3, easeOutCubic),
        ref().x(-300, 0.8, easeInOutCubic),
        ref().y(RULES_Y + RROW[i], 0.8, easeInOutCubic),
      ),
    )),
  );
  yield* waitFor(0.9);

  // ═══════════════════════════════════════════════════════════════
  // Act 7 — TRANSITION: cards collapse inward, shapes emerge
  // ═══════════════════════════════════════════════════════════════
  yield* all(
    ...mcs.map(mc => mc.node.opacity(0, 0.8, easeInCubic)),
    ...echoRefs.map(r => r().opacity(0, 0.8, easeInCubic)),
    ...rulesEchoRefs.map(r => r().opacity(0, 0.8, easeInCubic)),
    transferGroup().opacity(0, 0.8, easeInCubic),
    transferGroup().scale(0.4, 0.8, easeInCubic),
    transferGroup().y(-80, 0.8, easeInCubic),
    rulesGroup().opacity(0, 0.8, easeInCubic),
    rulesGroup().scale(0.4, 0.8, easeInCubic),
    rulesGroup().y(-80, 0.8, easeInCubic),
    shapesRoot().opacity(1, 0.8, easeOutCubic),
  );

  // ═══════════════════════════════════════════════════════════════
  // Act 8 — orange outputs settle inside membrane
  // ═══════════════════════════════════════════════════════════════
  yield* all(
    ...foreignShapeRefs.map((r, i) =>
      chain(waitFor(i * 0.15), r().opacity(1, 0.4, easeOutCubic)),
    ),
  );
  yield* waitFor(0.5);

  // ═══════════════════════════════════════════════════════════════
  // Act 9 — rules appear outside, then invade
  // ═══════════════════════════════════════════════════════════════
  yield* all(
    ...rulesShapeRefs.map((r, i) => chain(
      waitFor(i * 0.15),
      all(
        r().opacity(1, 0.4, easeOutCubic),
        rulesShapeLabels[i]().opacity(1, 0.4, easeOutCubic),
      ),
    )),
  );
  yield* waitFor(0.4);

  yield* all(
    ...rulesShapeRefs.map((r, i) => all(
      r().x(RULES_SHAPE_OPS[i].x, 0.9, easeInOutCubic),
      r().y(RULES_SHAPE_OPS[i].y, 0.9, easeInOutCubic),
    )),
    ...rulesShapeLabels.map((l, i) => all(
      l().x(RULES_SHAPE_OPS[i].x, 0.9, easeInOutCubic),
      l().y(RULES_SHAPE_OPS[i].y + 28, 0.9, easeInOutCubic),
      l().opacity(0, 0.4, easeInCubic),
    )),
    membraneScaleX(1.25, 0.9, easeInOutCubic),
    membraneScaleY(0.85, 0.9, easeInOutCubic),
    membrane().stroke(RULES_COLOR, 0.7, easeInOutCubic),
    membrane().lineWidth(2.5, 0.7, easeInOutCubic),
  );

  yield* membrane().lineWidth(4, 0.1, linear);
  yield* membrane().lineWidth(2.5, 0.2, easeOutCubic);

  yield* waitFor(1.0);

  // ═══════════════════════════════════════════════════════════════
  // Act 10 — settle: membrane stays deformed, label dims
  // ═══════════════════════════════════════════════════════════════
  yield* all(
    grabLabel().fill(TEXT_DIM, 0.5, easeInOutCubic),
    membrane().fill('rgba(255, 71, 87, 0.06)', 0.5, easeInOutCubic),
  );
  yield* waitFor(1.2);

  // ═══════════════════════════════════════════════════════════════
  // Act 11 — fade
  // ═══════════════════════════════════════════════════════════════
  yield* stage().opacity(0, 0.9, easeInCubic);
  yield* waitFor(0.3);
});
