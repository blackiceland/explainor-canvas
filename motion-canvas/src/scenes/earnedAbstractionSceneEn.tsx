import {Txt, makeScene2D} from '@motion-canvas/2d';
import {
  all, createSignal,
  easeInOutCubic, waitFor,
} from '@motion-canvas/core';
import {Manticore, ColorRule} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// ══════════════════════════════════════════════════════════════════════
// Chapter 2 · Beat 1
//   1) Center question.
//   2) Compact side-by-side: GrabStrategy interface + impl skeletons
//      vs class HandlingProfile with three public-final fields.
//   3) morphTo full forms — both sides grow a CubeHandler on top:
//        - left  → chapter-1 sprawl (CubeHandler that uses GrabStrategy).
//        - right → exact resolution from prematureAbstractionResolutionSceneEn.
//      Top edges of both full panels land at the same y so the comparison
//      reads as a true side-by-side.
// ══════════════════════════════════════════════════════════════════════

const WARM_CREAM   = 'rgba(244, 230, 200, 0.96)';
const TYPE_CLEAN   = 'rgba(220, 215, 255, 0.85)';
const VAR_LIGHT    = 'rgba(244, 241, 235, 0.96)';
const KW_COLOR     = DryFiltersV3CodeTheme.keyword;
const METHOD_COLOR = DryFiltersV3CodeTheme.method;
const ERASE_TINT   = 'rgba(244, 241, 235, 0.96)';

const CARD_STYLE = {
  radius: 0, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0, shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
  shadowOffsetX: 0, shadowOffsetY: 0, edge: false,
} as const;

// ─── Compact (skeleton) forms ────────────────────────────────────────
// Same `class` keyword on both sides so colouring is consistent.
// LEFT compact gets a blank after the interface's closing brace (8 lines).
// RIGHT compact stays 7 lines. Compact tops are aligned by shifting
// RIGHT down by half a line via RIGHT_COMPACT_Y. Each compact is the
// verbatim bottom of its FULL form so the morph stays additive.
const LEFT_COMPACT = `interface GrabStrategy {

    void grab(Cube cube);
}

class StandardGrab implements GrabStrategy { }
class SoftGrab     implements GrabStrategy { }
class FirmGrab     implements GrabStrategy { }`;

const RIGHT_COMPACT = `class HandlingProfile {

    public final GripForce gripForce;
    public final MotionProfile motionProfile;
    public final ReleaseStyle releaseStyle;

}`;

// ─── Full chapter forms ──────────────────────────────────────────────
// Each side simply grows a CubeHandler on top of the compact form. The
// compact lines stay verbatim — pure additive morph on both sides.
// Both FULL forms are exactly 25 lines. After the morph each top-level
// class declaration is followed by a blank line ("после определения
// верхних классов нужен отступ"). CubeHandler-close at line 17 and the
// secondary class declaration at line 19 align on both sides.
const LEFT_FULL = `class CubeHandler {

    private final RobotArm arm = new RobotArm();
    private final GrabStrategy grabStrategy = new StandardGrab();

    public void handleCube(Cube cube, Table table) {
        arm.moveTo(cube.position);
        grabStrategy.grab(cube);

        arm.lift();
        arm.moveTo(table.position);
        arm.release();

    }

}

interface GrabStrategy {

    void grab(Cube cube);
}

class StandardGrab implements GrabStrategy { }
class SoftGrab     implements GrabStrategy { }
class FirmGrab     implements GrabStrategy { }`;

const RIGHT_FULL = `class CubeHandler {

    private final RobotArm arm = new RobotArm();

    public void handleCube(Cube cube, Table table) {
        HandlingProfile handling = new HandlingProfile(
            GripForce.forMass(cube.mass),
            MotionProfile.forTransfer(cube, table),
            ReleaseStyle.forTable(table.surface)
        );

        arm.moveTo(cube.position);
        arm.grab(cube, handling.gripForce);
        arm.moveTo(table.position, handling.motionProfile);
        arm.release(handling.releaseStyle);
    }
}

class HandlingProfile {

    public final GripForce gripForce;
    public final MotionProfile motionProfile;
    public final ReleaseStyle releaseStyle;

}`;

const COLOR_RULES: ColorRule[] = [
  // vars
  {match: 'handleCube',     color: VAR_LIGHT},
  {match: 'arm',            color: VAR_LIGHT},
  {match: 'cube',           color: VAR_LIGHT},
  {match: 'table',          color: VAR_LIGHT},
  {match: 'position',       color: VAR_LIGHT},
  {match: 'grabStrategy',   color: VAR_LIGHT},
  {match: 'handling',       color: VAR_LIGHT},
  {match: 'gripForce',      color: VAR_LIGHT},
  {match: 'motionProfile',  color: VAR_LIGHT},
  {match: 'releaseStyle',   color: VAR_LIGHT},
  {match: 'mass',           color: VAR_LIGHT},
  {match: 'surface',        color: VAR_LIGHT},
  // types
  {match: /^Cube$/,                  color: TYPE_CLEAN},
  {match: /^Table$/,                 color: TYPE_CLEAN},
  {match: /^RobotArm$/,              color: TYPE_CLEAN},
  {match: /^GrabStrategy$/,          color: TYPE_CLEAN},
  {match: /^StandardGrab$/,          color: TYPE_CLEAN},
  {match: /^SoftGrab$/,              color: TYPE_CLEAN},
  {match: /^FirmGrab$/,              color: TYPE_CLEAN},
  {match: /^HandlingProfile$/,       color: TYPE_CLEAN},
  {match: /^GripForce$/,             color: TYPE_CLEAN},
  {match: /^MotionProfile$/,         color: TYPE_CLEAN},
  {match: /^ReleaseStyle$/,          color: TYPE_CLEAN},
  // methods
  {match: 'moveTo',       color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'grab',         color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'lift',         color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'release',      color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'forMass',      color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'forTransfer',  color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'forTable',     color: METHOD_COLOR, onlyTypes: ['method']},
];

const CUSTOM_TYPES = [
  'Cube', 'Table', 'RobotArm',
  'GrabStrategy', 'StandardGrab', 'SoftGrab', 'FirmGrab',
  'HandlingProfile', 'GripForce', 'MotionProfile', 'ReleaseStyle',
];

const FONT_SIZE = 22;
const LINE_H = Math.round(FONT_SIZE * 1.62 * 10) / 10;

const LEFT_X  = -480;
const LEFT_W  = 920;
const RIGHT_X = 490;
const RIGHT_W = 860;

// Both panels share the same TOP edge in compact and in full. RIGHT
// has 1 fewer line than LEFT in each phase, so RIGHT panel centre sits
// half a line higher to keep the top edges aligned. Full y is tuned
// empirically so the first code line lands close to the canvas top
// edge (well within the "<=100" budget the user asked for).
const LEFT_COMPACT_Y  = 0;
const RIGHT_COMPACT_Y = -LINE_H / 2;
// Both FULL panels now 25 lines — same height, identical y.
const LEFT_FULL_Y     = -350 - LINE_H / 2;
const RIGHT_FULL_Y    = -350 - LINE_H / 2;

const SMOOTH_MORPH = {
  scrollStrategy: 'block' as const,
  removeDuration: 0.3,
  moveDuration: 0.8,
  flashRemovedColor: ERASE_TINT,
  flashRemovedDuration: 0.01,
  flashRemovedErase: 'reverseType' as const,
  flashRemovedEraseCharDelay: 0.008,
  flashRemovedExcludeTypes: [],
  charDelay: 0.006,
  lineDelay: 0.05,
  addStyle: 'fade' as const,
  lineOrder: 'parallel' as const,
};

function makePanel(code: string, x: number, width: number) {
  return Manticore.create(code, {
    x, y: 0,
    width,
    height: 0,
    fontSize: FONT_SIZE,
    lineHeight: LINE_H,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CARD_STYLE,
    glowAccent: false,
    noClip: true,
    customTypes: CUSTOM_TYPES,
  });
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ─── 1. Center question ────────────────────────────────────────────
  const questionOp = createSignal(0);
  view.add(
    <Txt
      text={"So how do you know when you're preparing for change?"}
      x={0} y={0}
      fontFamily={Fonts.primary}
      fontSize={56}
      fontWeight={400}
      letterSpacing={0.4}
      fill={WARM_CREAM}
      opacity={questionOp}
    />,
  );

  yield* questionOp(1, 1.1, easeInOutCubic);
  yield* waitFor(2.6);
  yield* questionOp(0, 0.8, easeInOutCubic);
  yield* waitFor(0.4);

  // ─── 2. Compact pair — tops aligned (RIGHT sits half a line higher) ─
  const left  = makePanel(LEFT_COMPACT,  LEFT_X,  LEFT_W);
  const right = makePanel(RIGHT_COMPACT, RIGHT_X, RIGHT_W);
  left.mount(view);
  right.mount(view);
  left.node.y(LEFT_COMPACT_Y);
  right.node.y(RIGHT_COMPACT_Y);
  left.colorize(COLOR_RULES);
  right.colorize(COLOR_RULES);

  yield* all(
    left.appear(1.2),
    right.appear(1.2),
  );
  yield* waitFor(2.4);

  // ─── 3. Morph + slide up so the full content tops reach the canvas top ─
  yield* all(
    left.morphTo(LEFT_FULL, SMOOTH_MORPH),
    right.morphTo(RIGHT_FULL, SMOOTH_MORPH),
    left.node.y(LEFT_FULL_Y, 0.8, easeInOutCubic),
    right.node.y(RIGHT_FULL_Y, 0.8, easeInOutCubic),
  );
  left.colorize(COLOR_RULES);
  right.colorize(COLOR_RULES);

  yield* waitFor(5.0);

  // ─── 4. Fade out ──────────────────────────────────────────────────
  yield* all(
    left.disappear(0.8),
    right.disappear(0.8),
  );
  yield* waitFor(0.4);
});
