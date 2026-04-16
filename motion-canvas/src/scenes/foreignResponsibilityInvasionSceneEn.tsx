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

// ── Sources — match the canonical _DONE variants in problemsYouDontHaveCarefulArmSceneEn ──
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

const CLASS_META = [
  {source: STANDARD_GRAB, foreignLines: [8, 9],   echoes: ['MotionProfile.LINEAR',   'Orientation.ANY']},
  {source: SOFT_GRAB,     foreignLines: [10, 11], echoes: ['MotionProfile.CAUTIOUS', 'cube.orientation()']},
  {source: FIRM_GRAB,     foreignLines: [9, 10],  echoes: ['MotionProfile.FAST',     'Orientation.LOCKED']},
];

// Code block centers — shifted left by 20 per user's note.
const CLASS_X = [-660, -20, 620];
// Align class declarations to the same baseline; shift all 50px down.
// lineHeight = fontSize * 1.5 = 27. Manticore centers: startY = -((n-1)/2)*27.
// SoftGrab (15 lines) is tallest → baseline 0; others compensated.
const CLASS_Y = [23, 50, 36.5];

const CUSTOM_TYPES = [
  'Cube', 'Force', 'GrabStrategy', 'GrabResult',
  'StandardGrab', 'SoftGrab', 'FirmGrab',
  'GripConfidence', 'MotionProfile', 'Orientation',
];

// ── Palette (matches problemsYouDontHaveCarefulArmSceneEn) ──────────────
const VAR_LIGHT    = 'rgba(244, 241, 235, 0.96)';
const TYPE_CLEAN   = 'rgba(220, 215, 255, 0.80)';
const METHOD_COLOR = DryFiltersV3CodeTheme.method;
const KW_COLOR     = DryFiltersV3CodeTheme.keyword;
const FOREIGN      = '#FF9F43';

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

const FOREIGN_RULES: ColorRule[] = [
  {match: /^MotionProfile$/, color: FOREIGN},
  {match: /^Orientation$/,   color: FOREIGN},
  {match: /^LINEAR$/,        color: FOREIGN},
  {match: /^CAUTIOUS$/,      color: FOREIGN},
  {match: /^FAST$/,          color: FOREIGN},
  {match: /^ANY$/,           color: FOREIGN},
  {match: /^LOCKED$/,        color: FOREIGN},
  {match: 'orientation',     color: FOREIGN, onlyTypes: ['method']},
];

const CODE_CARD_STYLE = {
  radius: 16, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0, shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
  shadowOffsetX: 0, shadowOffsetY: 0, edge: false,
} as const;

const CODE_FONT_SIZE = 18;
const CODE_BLOCK_WIDTH = 540;

export default makeScene2D(function* (view) {
  applyBackground(view);

  const stage = createRef<Node>();
  view.add(<Node ref={stage} />);

  const wrappers = CLASS_META.map(() => createRef<Node>());
  const mcs: Manticore[] = [];

  for (let i = 0; i < CLASS_META.length; i++) {
    stage().add(<Node ref={wrappers[i]} x={CLASS_X[i]} y={CLASS_Y[i]} opacity={0} />);

    const mc = Manticore.create(CLASS_META[i].source, {
      x: 0,
      y: 0,
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

  // ─── "transfer" group — kept below the ceiling ────────────────────────
  const TRANSFER_Y = -310;
  const transferGroup = createRef<Node>();
  stage().add(
    <Node ref={transferGroup} x={-20} y={TRANSFER_Y} opacity={0}>
      <Rect
        width={660}
        height={180}
        stroke={FOREIGN}
        strokeWidth={1.5}
        radius={12}
        opacity={0.4}
      />
      <Txt
        text="transfer"
        y={-118}
        fontFamily={Fonts.primary}
        fontWeight={700}
        fontSize={34}
        letterSpacing={3}
        fill={FOREIGN}
      />
    </Node>,
  );

  // ═════════════════════════════════════════════════════════════════════
  // Act 1 — three implementations appear, each reads as a normal grab()
  // ═════════════════════════════════════════════════════════════════════
  yield* all(
    ...wrappers.map((w, i) =>
      chain(waitFor(i * 0.18), w().opacity(1, 0.8, easeOutCubic)),
    ),
  );
  yield* waitFor(1.4);

  // ═════════════════════════════════════════════════════════════════════
  // Act 2 — recolor foreign tokens to FOREIGN. No dimming, no overlays.
  // ═════════════════════════════════════════════════════════════════════
  yield* all(
    ...mcs.map(mc => mc.colorizeAnimated(0, mc.lineCount - 1, 0.6, FOREIGN_RULES)),
    // cube. in SoftGrab's cube.orientation() is part of the foreign expression
    mcs[1].colorizeAnimated(11, 11, 0.6, [
      {match: 'cube', color: FOREIGN},
      {match: /^\.$/, color: FOREIGN},
    ]),
  );
  yield* waitFor(1.0);

  // ═════════════════════════════════════════════════════════════════════
  // Act 3 — extract echoes into the "transfer" card
  // ═════════════════════════════════════════════════════════════════════
  const echoRefs = CLASS_META.flatMap(meta => meta.echoes.map(() => createRef<Txt>()));
  let echoIdx = 0;
  for (let i = 0; i < CLASS_META.length; i++) {
    for (let j = 0; j < CLASS_META[i].foreignLines.length; j++) {
      const ref = echoRefs[echoIdx++];
      const startX = CLASS_X[i];
      const startY = CLASS_Y[i] + mcs[i].getLineSceneY(CLASS_META[i].foreignLines[j]);
      stage().add(
        <Txt
          ref={ref}
          text={CLASS_META[i].echoes[j]}
          x={startX}
          y={startY}
          fontFamily={Fonts.code}
          fontSize={CODE_FONT_SIZE}
          fill={FOREIGN}
          opacity={0}
          offset={[-1, 0]}
        />,
      );
    }
  }

  yield* transferGroup().opacity(1, 0.5, easeOutCubic);

  const ROW_Y = [-45, 0, 45];
  const COL_LEFT = [-300, 20];
  const flyAnims = [];
  echoIdx = 0;
  for (let i = 0; i < CLASS_META.length; i++) {
    for (let j = 0; j < CLASS_META[i].foreignLines.length; j++) {
      const ref = echoRefs[echoIdx++];
      flyAnims.push(
        chain(
          waitFor(i * 0.12 + j * 0.06),
          all(
            ref().opacity(1, 0.3, easeOutCubic),
            ref().x(COL_LEFT[j], 1.0, easeInOutCubic),
            ref().y(TRANSFER_Y + ROW_Y[i], 1.0, easeInOutCubic),
          ),
        ),
      );
    }
  }
  yield* all(...flyAnims);
  yield* waitFor(1.0);

  // GripConfidence lines blink — "this one belongs, those don't"
  const confNodes = [
    mcs[0].getLine(7)!.node,  // GripConfidence.MEDIUM
    mcs[1].getLine(9)!.node,  // GripConfidence.HIGH
    mcs[2].getLine(8)!.node,  // GripConfidence.HIGH
  ];
  for (let pulse = 0; pulse < 2; pulse++) {
    yield* all(...confNodes.map(n => n.opacity(0.15, 0.2)));
    yield* all(...confNodes.map(n => n.opacity(1, 0.2)));
  }
  yield* waitFor(0.8);

  // ═════════════════════════════════════════════════════════════════════
  // Act 4 — dissolve transfer
  // ═════════════════════════════════════════════════════════════════════
  yield* all(
    transferGroup().opacity(0, 0.7, easeInCubic),
    ...echoRefs.map(r => r().opacity(0, 0.7, easeInCubic)),
  );
  yield* waitFor(0.5);

  // ═════════════════════════════════════════════════════════════════════
  // Act 5 — fade
  // ═════════════════════════════════════════════════════════════════════
  yield* stage().opacity(0, 0.9, easeInCubic);
  yield* waitFor(0.3);
});
