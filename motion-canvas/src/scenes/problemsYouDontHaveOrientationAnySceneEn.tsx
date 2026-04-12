import {makeScene2D, Node} from '@motion-canvas/2d';
import {all, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Fonts, Screen} from '../core/theme';
import {applyBackground} from '../core/utils';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';

// ── Beat 4b — sync-highlight return args, zoom into Orientation.ANY ─────

const INTERFACE_CODE = `public interface GrabStrategy {
    GrabResult grab(Cube cube);
}`;

const RECORD_CODE = `public record GrabResult(
    GripConfidence confidence,
    MotionProfile motionProfile,
    Orientation orientation
) {}`;

const ORC_DONE = `public class CubeHandler {

    private final GrabStrategy grabStrategy = new StandardGrab();

    public void handleCube(Cube cube, Table table) {
        arm.moveTo(cube.position);
        GrabResult result = grabStrategy.grab(cube);
        arm.confirmGrip(result.confidence);
        arm.moveTo(table.position, result.motionProfile);
        arm.release(result.orientation);
    }
}`;

const SOFT_DONE = `public class SoftGrab implements GrabStrategy {

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

const FIRM_DONE = `public class FirmGrab implements GrabStrategy {

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

const STANDARD_DONE = `public class StandardGrab implements GrabStrategy {

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

// ── Constructor arg line indices (0-based in DONE states) ───────────────
// Arg 1 = GripConfidence, Arg 2 = MotionProfile, Arg 3 = Orientation/etc.
const SOFT_ARGS = [9, 10, 11];
const FIRM_ARGS = [8, 9, 10];
const STD_ARGS  = [7, 8, 9];
const STD_ANY_LINE = 9;

// ── Layout — matches CarefulArm final state exactly ─────────────────────
const LEFT_PAD       = 40;
const CODE_FONT_SIZE = 24;
const CODE_W         = Screen.width / 2 - LEFT_PAD;
const CODE_CENTER_X  = -Screen.width / 2 + LEFT_PAD + CODE_W / 2;

const INTERFACE_Y = -382;
const CODE_Y      = -61;
const RECORD_Y    =  300;

const STRAT_FONT   = 20;
const STRAT_LINE_H = Math.round(20 * 1.62 * 10) / 10;  // 32.4
const STRAT_W      = Screen.width / 2 - 20;
const STRAT_X      = Screen.width / 4 + 100;
const STRAT_Y      = {soft: -330, firm: 10, standard: 330};
const SHIFT        = 6 * STRAT_LINE_H;                  // 194.4
const STRAT_GROUP_Y = -520;

// ── Colors ──────────────────────────────────────────────────────────────
const VAR_LIGHT    = 'rgba(244, 241, 235, 0.96)';
const TYPE_CLEAN   = 'rgba(220, 215, 255, 0.80)';
const METHOD_COLOR = DryFiltersV3CodeTheme.method;
const KW_COLOR     = DryFiltersV3CodeTheme.keyword;

const SHARED_KW_RULES: ColorRule[] = [
  {match: /^public$/,     color: KW_COLOR},
  {match: /^private$/,    color: KW_COLOR},
  {match: /^final$/,      color: KW_COLOR},
  {match: /^void$/,       color: KW_COLOR},
  {match: /^return$/,     color: KW_COLOR},
  {match: /^new$/,        color: KW_COLOR},
  {match: /^class$/,      color: KW_COLOR},
  {match: /^implements$/, color: KW_COLOR},
];

const SHARED_VAR_RULES: ColorRule[] = [
  {match: 'cube',     color: VAR_LIGHT},
  {match: 'position', color: VAR_LIGHT},
];

const SHARED_TYPE_RULES: ColorRule[] = [
  {match: /^Cube$/,           color: TYPE_CLEAN},
  {match: /^Table$/,          color: TYPE_CLEAN},
  {match: /^Force$/,          color: TYPE_CLEAN},
  {match: /^GrabStrategy$/,   color: TYPE_CLEAN},
  {match: /^GrabResult$/,     color: TYPE_CLEAN},
  {match: /^CubeHandler$/,    color: TYPE_CLEAN},
  {match: /^StandardGrab$/,   color: TYPE_CLEAN},
  {match: /^SoftGrab$/,       color: TYPE_CLEAN},
  {match: /^FirmGrab$/,       color: TYPE_CLEAN},
  {match: /^GripConfidence$/, color: TYPE_CLEAN},
  {match: /^MotionProfile$/,  color: TYPE_CLEAN},
  {match: /^Orientation$/,    color: TYPE_CLEAN},
];

const CUSTOM_TYPES = [
  'Cube', 'Table', 'Force',
  'GrabStrategy', 'GrabResult',
  'CubeHandler',
  'StandardGrab', 'SoftGrab', 'FirmGrab',
  'GripConfidence', 'MotionProfile', 'Orientation',
];

const ORC_COLOR_RULES: ColorRule[] = [
  ...SHARED_KW_RULES,
  {match: 'handleCube',    color: VAR_LIGHT},
  {match: 'arm',           color: VAR_LIGHT},
  {match: 'table',         color: VAR_LIGHT},
  {match: 'grabStrategy',  color: VAR_LIGHT},
  {match: 'result',        color: VAR_LIGHT},
  {match: 'confidence',    color: VAR_LIGHT},
  {match: 'motionProfile', color: VAR_LIGHT},
  {match: 'orientation',   color: VAR_LIGHT},
  ...SHARED_VAR_RULES,
  ...SHARED_TYPE_RULES,
  {match: 'moveTo',      color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'grab',        color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'confirmGrip', color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'release',     color: METHOD_COLOR, onlyTypes: ['method']},
];

const INTERFACE_COLOR_RULES: ColorRule[] = [
  {match: /^public$/,    color: KW_COLOR},
  {match: /^interface$/, color: KW_COLOR},
  ...SHARED_VAR_RULES,
  ...SHARED_TYPE_RULES,
  {match: 'grab', color: VAR_LIGHT, onlyTypes: ['method', 'plain']},
];

const RECORD_COLOR_RULES: ColorRule[] = [
  {match: /^public$/, color: KW_COLOR},
  {match: /^record$/, color: KW_COLOR},
  ...SHARED_TYPE_RULES,
  {match: 'confidence',    color: VAR_LIGHT},
  {match: 'motionProfile', color: VAR_LIGHT},
  {match: 'orientation',   color: VAR_LIGHT},
];

const STRAT_COLOR_RULES: ColorRule[] = [
  ...SHARED_KW_RULES,
  ...SHARED_VAR_RULES,
  ...SHARED_TYPE_RULES,
  {match: 'approach',         color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'approachSlowly',   color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'waitForSensor',    color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'adjustToFeedback', color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'close',            color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'preAlign',         color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'lockWrist',        color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'orientation',      color: METHOD_COLOR, onlyTypes: ['method']},
];

const CODE_CARD_STYLE = {
  radius: 16, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0, shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
  shadowOffsetX: 0, shadowOffsetY: 0, edge: false,
} as const;

// ═════════════════════════════════════════════════════════════════════════
export default makeScene2D(function* (view) {
  applyBackground(view);

  const root = new Node({});
  view.add(root);

  // ── Left side ─────────────────────────────────────────────────────────
  const fontSize   = CODE_FONT_SIZE;
  const lineHeight = Math.round(fontSize * 1.62 * 10) / 10;

  const codeBlockStyle = {
    width: CODE_W,
    fontSize, lineHeight,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    noClip: true,
    customTypes: CUSTOM_TYPES,
  } as const;

  const mcInterface = Manticore.create(INTERFACE_CODE, {
    x: CODE_CENTER_X, y: INTERFACE_Y, ...codeBlockStyle,
  });
  const mc = Manticore.create(ORC_DONE, {
    x: CODE_CENTER_X, y: CODE_Y, ...codeBlockStyle,
  });
  const mcRecord = Manticore.create(RECORD_CODE, {
    x: CODE_CENTER_X, y: RECORD_Y, ...codeBlockStyle,
  });

  mcInterface.mount(root);
  mc.mount(root);
  mcRecord.mount(root);
  mcInterface.node.opacity(1);
  mc.node.opacity(1);
  mcRecord.node.opacity(1);
  mcInterface.colorize(INTERFACE_COLOR_RULES);
  mc.colorize(ORC_COLOR_RULES);
  mcRecord.colorize(RECORD_COLOR_RULES);

  // ── Right side — strategies in scrolled group ─────────────────────────
  const stratGroup = new Node({y: STRAT_GROUP_Y});
  root.add(stratGroup);

  const stratStyle = {
    width: STRAT_W,
    fontSize: STRAT_FONT,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    customTypes: CUSTOM_TYPES,
    glowAccent: false,
    noClip: true,
  } as const;

  const mcSoft = Manticore.create(SOFT_DONE, {
    x: STRAT_X, y: STRAT_Y.soft, ...stratStyle,
  });
  const mcFirm = Manticore.create(FIRM_DONE, {
    x: STRAT_X, y: STRAT_Y.firm + SHIFT, ...stratStyle,
  });
  const mcStd = Manticore.create(STANDARD_DONE, {
    x: STRAT_X, y: STRAT_Y.standard + SHIFT * 2, ...stratStyle,
  });

  mcSoft.mount(stratGroup);
  mcFirm.mount(stratGroup);
  mcStd.mount(stratGroup);
  mcSoft.node.opacity(1);
  mcFirm.node.opacity(1);
  mcStd.node.opacity(1);
  mcSoft.colorize(STRAT_COLOR_RULES);
  mcFirm.colorize(STRAT_COLOR_RULES);
  mcStd.colorize(STRAT_COLOR_RULES);

  // Start: hold matching CarefulArm final frame
  yield* waitFor(0.3);

  // ═════════════════════════════════════════════════════════════════════
  // 1. DIM everything
  // ═════════════════════════════════════════════════════════════════════
  yield* all(
    mcInterface.node.opacity(0.12, 0.5, easeInOutCubic),
    mc.node.opacity(0.12, 0.5, easeInOutCubic),
    mcRecord.node.opacity(0.12, 0.5, easeInOutCubic),
    mcSoft.dimLines(0, mcSoft.lineCount - 1, 0.12, 0.5),
    mcFirm.dimLines(0, mcFirm.lineCount - 1, 0.12, 0.5),
    mcStd.dimLines(0, mcStd.lineCount - 1, 0.12, 0.5),
  );

  // ═════════════════════════════════════════════════════════════════════
  // 2. SYNC HIGHLIGHT — arg by arg across all three strategies
  // ═════════════════════════════════════════════════════════════════════

  // Arg 1: GripConfidence
  yield* all(
    mcSoft.dimLines(SOFT_ARGS[0], SOFT_ARGS[0], 1, 0.35),
    mcFirm.dimLines(FIRM_ARGS[0], FIRM_ARGS[0], 1, 0.35),
    mcStd.dimLines(STD_ARGS[0], STD_ARGS[0], 1, 0.35),
  );
  yield* waitFor(0.8);

  // Arg 2: MotionProfile (dim prev, light next)
  yield* all(
    mcSoft.dimLines(SOFT_ARGS[0], SOFT_ARGS[0], 0.12, 0.3),
    mcFirm.dimLines(FIRM_ARGS[0], FIRM_ARGS[0], 0.12, 0.3),
    mcStd.dimLines(STD_ARGS[0], STD_ARGS[0], 0.12, 0.3),
    mcSoft.dimLines(SOFT_ARGS[1], SOFT_ARGS[1], 1, 0.35),
    mcFirm.dimLines(FIRM_ARGS[1], FIRM_ARGS[1], 1, 0.35),
    mcStd.dimLines(STD_ARGS[1], STD_ARGS[1], 1, 0.35),
  );
  yield* waitFor(0.8);

  // Arg 3: Orientation / cube.orientation() (dim prev, light next)
  yield* all(
    mcSoft.dimLines(SOFT_ARGS[1], SOFT_ARGS[1], 0.12, 0.3),
    mcFirm.dimLines(FIRM_ARGS[1], FIRM_ARGS[1], 0.12, 0.3),
    mcStd.dimLines(STD_ARGS[1], STD_ARGS[1], 0.12, 0.3),
    mcSoft.dimLines(SOFT_ARGS[2], SOFT_ARGS[2], 1, 0.35),
    mcFirm.dimLines(FIRM_ARGS[2], FIRM_ARGS[2], 1, 0.35),
    mcStd.dimLines(STD_ARGS[2], STD_ARGS[2], 1, 0.35),
  );
  yield* waitFor(1.2);

  // ═════════════════════════════════════════════════════════════════════
  // 3. EVERYTHING FADES except StandardGrab line 9 (Orientation.ANY)
  // ═════════════════════════════════════════════════════════════════════
  yield* all(
    mcInterface.node.opacity(0, 0.6, easeInOutCubic),
    mc.node.opacity(0, 0.6, easeInOutCubic),
    mcRecord.node.opacity(0, 0.6, easeInOutCubic),
    mcSoft.node.opacity(0, 0.6, easeInOutCubic),
    mcFirm.node.opacity(0, 0.6, easeInOutCubic),
    // Dim all StandardGrab lines to 0 EXCEPT line 9
    mcStd.dimLines(0, STD_ANY_LINE - 1, 0, 0.6),
    mcStd.dimLines(STD_ANY_LINE + 1, mcStd.lineCount - 1, 0, 0.6),
  );
  yield* waitFor(0.8);

  // ═════════════════════════════════════════════════════════════════════
  // 4. ZOOM IN + "Orientation." fades during zoom
  // ═════════════════════════════════════════════════════════════════════

  // Y — manual calc, no getLineSceneY surprises:
  //   mcStd cfg.y = 330 + 194.4*2 = 718.8
  //   13-line block: startY = -6 * 32.4, lineY(9) = startY + 9*32.4 = 97.2
  //   in root: STRAT_GROUP_Y + 718.8 + 97.2 = 296
  const stdCenterY = STRAT_Y.standard + SHIFT * 2;
  const lineOffsetY = (-((13 - 1) / 2) + STD_ANY_LINE) * STRAT_LINE_H;
  const targetY = STRAT_GROUP_Y + stdCenterY + lineOffsetY;

  // X — shift from block center towards "ANY" text
  const charW = STRAT_FONT * 0.6;
  const anyTextX = mcStd.getLeftEdge() + 24 * charW + 1.5 * charW;
  const targetX = STRAT_X + anyTextX;

  const ZOOM = 3;

  // "Orientation" and "." fade to transparent during zoom
  const anyLine = mcStd.getLine(STD_ANY_LINE)!;
  const fadeAnims = [
    ...anyLine.colorizeByRuleAnimated('Orientation', 'rgba(0,0,0,0)', 1.5),
    ...anyLine.colorizeByRuleAnimated('.', 'rgba(0,0,0,0)', 1.5),
  ];

  yield* all(
    root.scale(ZOOM, 2.0, easeInOutCubic),
    root.x(-targetX * ZOOM, 2.0, easeInOutCubic),
    root.y(-targetY * ZOOM, 2.0, easeInOutCubic),
    ...fadeAnims,
  );

  yield* waitFor(2.0);
});
