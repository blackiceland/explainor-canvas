import {makeScene2D} from '@motion-canvas/2d';
import {easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {Medusa} from '../core/code/director/Medusa';
import {JavaClass, method, param} from '../core/code/model/JavaModel';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingX, measureChar} from '../core/code/shared/TextMeasure';

// ── Beat 5 — resolution. Two classes, stacked and centered. ───────────────

const CODE_FONT_SIZE = 24;
const CODE_W = 1600;
const LINE_HEIGHT = Math.round(CODE_FONT_SIZE * 1.62 * 10) / 10;
const CLIP_PAD_Y = 20;

const CH_LINES = 17;                                // STATE_3 max
const HP_LINES = 6;
const GAP = 30;

const CH_HEIGHT = CH_LINES * LINE_HEIGHT + CLIP_PAD_Y * 2;   // ≈ 766
const HP_HEIGHT = HP_LINES * LINE_HEIGHT + CLIP_PAD_Y * 2;   // ≈ 267
const STACK_TOP = -(CH_HEIGHT + GAP + HP_HEIGHT) / 2;
const CH_Y = STACK_TOP + CH_HEIGHT / 2;
const HP_Y = STACK_TOP + CH_HEIGHT + GAP + HP_HEIGHT / 2;

const MAX_LINE_CHARS = Math.floor(
  (CODE_W - getCodePaddingX(CODE_FONT_SIZE)) / measureChar(CODE_FONT_SIZE),
);

// ── Palette ────────────────────────────────────────────────────────────────
const VAR_LIGHT = 'rgba(244, 241, 235, 0.96)';
const TYPE_CLEAN = 'rgba(220, 215, 255, 0.80)';
const METHOD_COLOR = DryFiltersV3CodeTheme.method;
const ERASE_TINT = 'rgba(244, 241, 235, 0.96)';

const COLOR_RULES: ColorRule[] = [
  // vars
  {match: 'handleCube',    color: VAR_LIGHT},
  {match: 'arm',           color: VAR_LIGHT},
  {match: 'cube',          color: VAR_LIGHT},
  {match: 'table',         color: VAR_LIGHT},
  {match: 'position',      color: VAR_LIGHT},
  {match: 'grabStrategy',  color: VAR_LIGHT},
  {match: 'handling',      color: VAR_LIGHT},
  {match: 'result',        color: VAR_LIGHT},
  {match: 'confidence',    color: VAR_LIGHT},
  {match: 'motionProfile', color: VAR_LIGHT},
  {match: 'orientation',   color: VAR_LIGHT},
  {match: 'gripForce',     color: VAR_LIGHT},
  {match: 'releaseStyle',  color: VAR_LIGHT},
  {match: 'mass',          color: VAR_LIGHT},
  {match: 'surface',       color: VAR_LIGHT},
  // types
  {match: /^Cube$/,                  color: TYPE_CLEAN},
  {match: /^Table$/,                 color: TYPE_CLEAN},
  {match: /^GrabResult$/,            color: TYPE_CLEAN},
  {match: /^RobotArm$/,              color: TYPE_CLEAN},
  {match: /^GrabStrategy$/,          color: TYPE_CLEAN},
  {match: /^StandardGrab$/,          color: TYPE_CLEAN},
  {match: /^HandlingProfile$/,       color: TYPE_CLEAN},
  {match: /^GripForce$/,             color: TYPE_CLEAN},
  {match: /^MotionProfile$/,         color: TYPE_CLEAN},
  {match: /^ReleaseStyle$/,          color: TYPE_CLEAN},
  // methods
  {match: 'moveTo',       color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'grab',         color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'confirmGrip',  color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'release',      color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'forMass',      color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'forTransfer',  color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'forTable',     color: METHOD_COLOR, onlyTypes: ['method']},
];

const CUSTOM_TYPES = [
  'Cube', 'Table', 'GrabResult', 'RobotArm',
  'GrabStrategy', 'StandardGrab',
  'HandlingProfile', 'GripForce', 'MotionProfile', 'ReleaseStyle',
];

const CODE_CARD_STYLE = {
  radius: 16, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0, shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
  shadowOffsetX: 0, shadowOffsetY: 0, edge: false,
} as const;

const SMOOTH_MORPH = {
  scrollStrategy: 'block' as const,
  removeDuration: 0.35,
  moveDuration: 0.7,
  flashRemovedColor: ERASE_TINT,
  flashRemovedDuration: 0.01,
  flashRemovedErase: 'reverseType' as const,
  flashRemovedEraseCharDelay: 0.014,
  flashRemovedExcludeTypes: [],
  charDelay: 0.014,
};

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ── Main model: CubeHandler, evolves across three states ──────────────
  const handlerModel = JavaClass.create([
    method('public', 'void', 'handleCube',
      [param('Cube', 'cube'), param('Table', 'table')],
      [
        'arm.moveTo(cube.position);',
        'GrabResult result = grabStrategy.grab(cube);',
        'arm.confirmGrip(result.confidence);',
        'arm.moveTo(table.position, result.motionProfile);',
        'arm.release(result.orientation);',
      ]),
  ], MAX_LINE_CHARS, {
    className: 'CubeHandler',
    fields: [
      'private final RobotArm arm = new RobotArm();',
      'private final GrabStrategy grabStrategy = new StandardGrab();',
    ],
  });

  const handler = Manticore.create(handlerModel.render(), {
    x: 0, y: CH_Y,
    width: CODE_W,
    height: CH_HEIGHT,
    fontSize: CODE_FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    clipPaddingY: CLIP_PAD_Y,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    noClip: true,
    customTypes: CUSTOM_TYPES,
  });
  handler.mount(view);
  handler.colorize(COLOR_RULES);

  const dir = new Medusa(handlerModel, handler, {
    morphDefaults: SMOOTH_MORPH,
    profiles: {stableExpand: SMOOTH_MORPH},
    pauseAfterMorph: 0.25,
  });

  // ── Secondary model: HandlingProfile class, static, revealed at end ───
  const profileModel = JavaClass.create(
    [],
    MAX_LINE_CHARS,
    {
      className: 'HandlingProfile',
      fields: [
        'public final GripForce gripForce;',
        'public final MotionProfile motionProfile;',
        'public final ReleaseStyle releaseStyle;',
      ],
    },
  );

  const profile = Manticore.create(profileModel.render(), {
    x: 0, y: HP_Y,
    width: CODE_W,
    height: HP_HEIGHT,
    fontSize: CODE_FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    clipPaddingY: CLIP_PAD_Y,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    noClip: true,
    customTypes: CUSTOM_TYPES,
  });
  profile.mount(view);
  profile.colorize(COLOR_RULES);
  profile.node.opacity(0);

  // ─── Appear on the tangled state ──────────────────────────────────────
  yield* handler.appear(Timing.slow);
  yield* waitFor(1.2);

  // ─── STATE_1 → STATE_2: strategy field gone, body collapsed ───────────
  yield* dir.apply(
    m => {
      m.setFields(['private final RobotArm arm = new RobotArm();']);
      m.replaceLine('handleCube',
        'GrabResult result = grabStrategy.grab(cube);',
        'arm.grab(cube);');
      m.replaceLine('handleCube',
        'arm.confirmGrip(result.confidence);',
        'arm.confirmGrip();');
      m.replaceLine('handleCube',
        'arm.moveTo(table.position, result.motionProfile);',
        'arm.moveTo(table.position);');
      m.replaceLine('handleCube',
        'arm.release(result.orientation);',
        'arm.release();');
    },
    {...SMOOTH_MORPH, flashRemovedErase: 'none', removeDuration: 0.25},
  );
  yield* waitFor(1.2);

  // ─── STATE_2 → STATE_3: HandlingProfile, inlined, appears by fade ─────
  yield* dir.apply(
    m => {
      m.replaceLine('handleCube',
        'arm.moveTo(cube.position);',
        'HandlingProfile handling = new HandlingProfile(',
        '        GripForce.forMass(cube.mass),',
        '        MotionProfile.forTransfer(cube, table),',
        '        ReleaseStyle.forTable(table.surface)',
        ');',
        '',
        'arm.moveTo(cube.position);');
      m.replaceLine('handleCube',
        'arm.grab(cube);',
        'arm.grab(cube, handling.gripForce);');
      m.replaceLine('handleCube',
        'arm.moveTo(table.position);',
        'arm.moveTo(table.position, handling.motionProfile);');
      m.replaceLine('handleCube',
        'arm.release();',
        'arm.release(handling.releaseStyle);');
    },
    {...SMOOTH_MORPH, addStyle: 'fade', lineOrder: 'parallel'},
  );
  yield* waitFor(0.8);

  // ─── Reveal HandlingProfile class below ───────────────────────────────
  yield* profile.node.opacity(1, 0.9, easeInOutCubic);
  yield* waitFor(4.0);

  // ─── Fade everything out ──────────────────────────────────────────────
  yield* handler.node.opacity(0, Timing.slow, easeInOutCubic);
  yield* profile.node.opacity(0, Timing.slow, easeInOutCubic);
  yield* waitFor(0.3);
});
