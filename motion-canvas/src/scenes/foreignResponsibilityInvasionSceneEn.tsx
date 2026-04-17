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

// ══════════════════════════════════════════════════════════════════════
// Layout
// ══════════════════════════════════════════════════════════════════════

const CLASS_X = [-680, -40, 560];
// Tops align at Y_TOP=-270 (CLASS_Y = Y_TOP + startY_abs per class).
// Phase 1: 13/15/14 lines. Phase 2 expanded bottoms all ≤ 460.
const CLASS_Y = [-108, -81, -94.5];

const CODE_FONT_SIZE = 16;
const CODE_BLOCK_WIDTH = 540;

// Two cards side-by-side at top
const CARDS_Y        = -400;
const TRANSFER_X     = -300;
const TRANSFER_W     = 620;
const RULES_X        = 350;
const RULES_W        = 400;
const CARD_H         = 120;
const CARD_TITLE_Y   = -85;

// ══════════════════════════════════════════════════════════════════════
// Palette
// ══════════════════════════════════════════════════════════════════════

const FOREIGN         = '#FF9F43';
const RULES_COLOR     = '#FF4757';
const CONFIDENCE_BLUE = 'rgba(100, 180, 255, 0.95)';
const TYPE_CLEAN      = 'rgba(220, 215, 255, 0.80)';

// ══════════════════════════════════════════════════════════════════════
// Color rules
// ══════════════════════════════════════════════════════════════════════

const CUSTOM_TYPES = [
  'Cube', 'Force', 'GrabStrategy', 'GrabResult',
  'StandardGrab', 'SoftGrab', 'FirmGrab',
  'GripConfidence', 'MotionProfile', 'Orientation',
];

const FOREIGN_RULES: ColorRule[] = [
  {match: /^MotionProfile$/, color: FOREIGN},
  {match: /^Orientation$/,   color: FOREIGN},
  {match: 'orientation',     color: FOREIGN, onlyTypes: ['method']},
  {match: /^(LINEAR|CAUTIOUS|FAST|FREE|LOCKED|ANY)$/, color: FOREIGN, onlyTypes: ['constant']},
];

const TYPE_CLEAN_RULES: ColorRule[] = [
  ...CUSTOM_TYPES.map(t => ({
    match: new RegExp(`^${t}$`),
    color: TYPE_CLEAN,
  } as ColorRule)),
];

// Colors every token on the line — line-scoped in colorizeAnimated(l, l, …).
const CONFIDENCE_RULES: ColorRule[] = [
  {match: /./, color: CONFIDENCE_BLUE},
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
    mc.node.opacity(1);
    mcs.push(mc);
  }

  // ── Transfer card (left) ───────────────────────────────────────
  const transferGroup = createRef<Node>();
  stage().add(
    <Node ref={transferGroup} x={TRANSFER_X} y={CARDS_Y} opacity={0}>
      <Rect width={TRANSFER_W} height={CARD_H} stroke={FOREIGN}
        strokeWidth={1.5} radius={12} opacity={0.4} />
      <Txt text="transfer" y={CARD_TITLE_Y}
        fontFamily={Fonts.primary} fontWeight={700}
        fontSize={34} letterSpacing={3} fill={FOREIGN} />
    </Node>,
  );

  // ── Transfer rules card (right, hidden until Phase 2) ──────────
  const rulesGroup = createRef<Node>();
  stage().add(
    <Node ref={rulesGroup} x={RULES_X} y={CARDS_Y} opacity={0}>
      <Rect width={RULES_W} height={CARD_H} stroke={RULES_COLOR}
        strokeWidth={1.5} radius={12} opacity={0.4} />
      <Txt text="transfer rules" y={CARD_TITLE_Y}
        fontFamily={Fonts.primary} fontWeight={700}
        fontSize={34} letterSpacing={3} fill={RULES_COLOR} />
    </Node>,
  );

  // ═══════════════════════════════════════════════════════════════
  // Act 1 — three implementations appear
  // ═══════════════════════════════════════════════════════════════
  mcs.forEach(mc => mc.colorize(TYPE_CLEAN_RULES));
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

  const TROW = [-22, 8, 38];
  // Two columns inside transfer card (global coords, left-anchored echoes)
  const TCOL = [TRANSFER_X - TRANSFER_W / 2 + 30, TRANSFER_X - 20];
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
          ref().y(CARDS_Y + TROW[i], 1.0, easeInOutCubic),
        ),
      ));
    }
  }
  yield* all(...flyAnims);
  yield* waitFor(1.0);

  // GripConfidence — one blink, then turns blue with glow (echoes the membrane circle)
  const confLines: [number, number][] = [[0, 7], [1, 9], [2, 8]];
  const confNodes = confLines.map(([m, l]) => mcs[m].getLine(l)!.node);
  yield* all(...confNodes.map(n => n.opacity(0.28, 0.22)));
  yield* all(...confNodes.map(n => n.opacity(1, 0.22)));
  yield* all(
    ...confLines.flatMap(([m, l]) => [
      mcs[m].colorizeAnimated(l, l, 0.5, CONFIDENCE_RULES),
      mcs[m].getLine(l)!.setTokensGlow([''], 12, CONFIDENCE_BLUE, 0.5),
    ]),
  );
  yield* waitFor(0.6);

  // ═══════════════════════════════════════════════════════════════
  // Act 4 — code morphs to expanded versions (standard palette, no re-color)
  // ═══════════════════════════════════════════════════════════════
  const EXP_SOURCES = [STANDARD_GRAB_EXP, SOFT_GRAB_EXP, FIRM_GRAB_EXP];
  yield* all(
    ...mcs.map((mc, i) => mc.morphTo(EXP_SOURCES[i], MORPH_OPTS)),
  );
  yield* waitFor(0.8);

  // ═══════════════════════════════════════════════════════════════
  // Act 5 — restore foreign orange + highlight rule predicates in red
  // ═══════════════════════════════════════════════════════════════
  mcs.forEach(mc => mc.colorize(TYPE_CLEAN_RULES));
  yield* all(
    ...mcs.map(mc => mc.colorizeAnimated(0, mc.lineCount - 1, 0.6, FOREIGN_RULES)),
  );
  yield* waitFor(1.2);
  const RULE_PREDICATES: ColorRule[] = [
    {match: /^(isDelicate|hasLooseParts|requiresOrientation|requiresFixedPose|isHeavy)$/,
     color: RULES_COLOR, onlyTypes: ['method']},
  ];
  yield* all(
    ...mcs.map(mc => mc.colorizeAnimated(0, mc.lineCount - 1, 0.6, RULE_PREDICATES)),
  );
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
        y={CLASS_Y[re.cls] + mcs[re.cls].getLineSceneY(re.line)}
        fontFamily={Fonts.code} fontSize={CODE_FONT_SIZE}
        fill={RULES_COLOR} opacity={0} offset={[-1, 0]}
      />,
    );
  }

  yield* rulesGroup().opacity(1, 0.5, easeOutCubic);

  const RROW = [-22, 8, 38];
  const RCOL = RULES_X - RULES_W / 2 + 30;
  yield* all(
    ...rulesEchoRefs.map((ref, i) => chain(
      waitFor(i * 0.15),
      all(
        ref().opacity(1, 0.3, easeOutCubic),
        ref().x(RCOL, 1.0, easeInOutCubic),
        ref().y(CARDS_Y + RROW[i], 1.0, easeInOutCubic),
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
