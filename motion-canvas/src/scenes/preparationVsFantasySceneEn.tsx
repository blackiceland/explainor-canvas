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
// Chapter 2 · opening
//   Beat 1 — How do you tell preparation from fantasy?
//
//   Layout (no morph, no compact phase):
//     - Top centre: the chapter question.
//     - Two code panels side-by-side, sized at the FULL chapter forms:
//         LEFT  → chapter-1 CubeHandler with GrabStrategy + impls (the "guess")
//         RIGHT → chapter-2 resolution: CubeHandler with HandlingProfile (the "earned")
//     - Above each panel a quiet annotation: GUESS / EARNED.
//
//   These are not "wrong vs right". Both are attempts to prepare for change.
//   One was a guess about a future that didn't arrive; the other is a shape
//   that the present already justified. The chapter exists to give the
//   viewer a criterion for telling them apart.
//
//   Beats 2 (the three-way fork) and 3 (signal convergence on the robot
//   arm code) will be added below as additional sections.
// ══════════════════════════════════════════════════════════════════════

const WARM_CREAM   = 'rgba(244, 230, 200, 0.96)';
const TEXT_DIM     = 'rgba(244, 241, 235, 0.42)';
const TEXT_TAG     = 'rgba(244, 241, 235, 0.78)';
const TYPE_CLEAN   = 'rgba(220, 215, 255, 0.85)';
const VAR_LIGHT    = 'rgba(244, 241, 235, 0.96)';
const KW_COLOR     = DryFiltersV3CodeTheme.keyword;
const METHOD_COLOR = DryFiltersV3CodeTheme.method;

const CARD_STYLE = {
  radius: 0, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0, shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
  shadowOffsetX: 0, shadowOffsetY: 0, edge: false,
} as const;

const LEFT_CODE = `class CubeHandler {

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

const RIGHT_CODE = `class CubeHandler {

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

const FONT_SIZE = 20;
const LINE_H = Math.round(FONT_SIZE * 1.62 * 10) / 10;

const LEFT_X  = -490;
const LEFT_W  = 880;
const RIGHT_X = 490;
const RIGHT_W = 820;

// Manticore renders content well below the configured cfg.y (see
// refactoring.md — the formula `cfg.y - (N-1)/2 * lineHeight` underestimates
// the top by ~250px). PANEL_Y is tuned empirically so the first code line
// lands ~80px below the canvas top, leaving room for the question + tags
// at the very top of the frame.
const PANEL_Y = 90;

const QUESTION_Y = -470;
const TAG_Y      = -395;

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ─── Question (top centre) ────────────────────────────────────────
  const questionOp = createSignal(0);
  view.add(
    <Txt
      text={'How do you tell preparation from fantasy?'}
      x={0} y={QUESTION_Y}
      fontFamily={Fonts.primary}
      fontSize={38}
      fontWeight={400}
      letterSpacing={0.4}
      fill={WARM_CREAM}
      opacity={questionOp}
    />,
  );

  // ─── Annotations (above each panel) ───────────────────────────────
  const guessOp  = createSignal(0);
  const earnedOp = createSignal(0);
  view.add(
    <Txt
      text={'GUESS'}
      x={LEFT_X} y={TAG_Y}
      fontFamily={Fonts.primary}
      fontSize={18}
      fontWeight={600}
      letterSpacing={6}
      fill={TEXT_TAG}
      opacity={guessOp}
    />,
  );
  view.add(
    <Txt
      text={'EARNED'}
      x={RIGHT_X} y={TAG_Y}
      fontFamily={Fonts.primary}
      fontSize={18}
      fontWeight={600}
      letterSpacing={6}
      fill={TEXT_TAG}
      opacity={earnedOp}
    />,
  );

  // ─── Code panels ──────────────────────────────────────────────────
  const left = Manticore.create(LEFT_CODE, {
    x: LEFT_X, y: PANEL_Y,
    width: LEFT_W,
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
  left.mount(view);
  left.colorize(COLOR_RULES);

  const right = Manticore.create(RIGHT_CODE, {
    x: RIGHT_X, y: PANEL_Y,
    width: RIGHT_W,
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
  right.mount(view);
  right.colorize(COLOR_RULES);

  // ─── Sequence ─────────────────────────────────────────────────────
  yield* questionOp(1, 1.0, easeInOutCubic);
  yield* waitFor(2.0);

  yield* all(
    left.appear(1.1),
    right.appear(1.1),
  );
  yield* waitFor(0.4);

  yield* all(
    guessOp(1, 0.8, easeInOutCubic),
    earnedOp(1, 0.8, easeInOutCubic),
  );
  yield* waitFor(4.5);

  yield* all(
    questionOp(0, 0.8, easeInOutCubic),
    guessOp(0, 0.8, easeInOutCubic),
    earnedOp(0, 0.8, easeInOutCubic),
    left.disappear(0.8),
    right.disappear(0.8),
  );
  yield* waitFor(0.3);
});
