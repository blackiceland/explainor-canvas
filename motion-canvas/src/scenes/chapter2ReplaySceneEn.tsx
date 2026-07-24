import {makeScene2D} from '@motion-canvas/2d';
import {all, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {Medusa} from '../core/code/director/Medusa';
import {JavaClass, method, param} from '../core/code/model/JavaModel';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingX, measureChar} from '../core/code/shared/TextMeasure';

// ══════════════════════════════════════════════════════════════════════
// Chapter 2 — REPLAY. One block, one story, run again without the guess.
//   A  rollback: the GrabResult plumbing is erased edit by edit
//   C  the requirement returns: an honest guard branch is TYPED above the
//      surviving path — the survivors never move sideways, only down
//   D  evidence: the three differing arguments rise to gold, one by one
//   E  the fold: the branch collapses upward into HandlingProfile.forCube;
//      the profile class lands below — same predicate, same font, centered
// Morph idiom follows codeWithActionsSceneRu: small semantic edits,
// removeDuration 0, moveDuration 0.6, bodies never re-indent.
// ══════════════════════════════════════════════════════════════════════

const CODE_FONT_SIZE = 24;
const CODE_W = 1180;
const LINE_HEIGHT = Math.round(CODE_FONT_SIZE * 1.62 * 10) / 10;
const CLIP_PAD_Y = 20;

// Tallest state: guard-C plus the typed handling line (24 rendered lines).
const MAX_LINES = 24;
const MAIN_H = MAX_LINES * LINE_HEIGHT + CLIP_PAD_Y * 2;
const MAIN_Y = 0;

// Beat E stack: folded handler (15 lines) + gap + profile panel (8 lines),
// vertically balanced — equal air above and below.
const FINAL_MAIN_LINES = 15;
const PANEL_LINES = 8;
// Same width as the main block: Manticore's text-left edge is x−width/2+pad,
// so equal widths put both class declarations on the same vertical line.
const PANEL_W = CODE_W;
const PANEL_H = PANEL_LINES * LINE_HEIGHT + CLIP_PAD_Y * 2;
const STACK_GAP = 36;
const STACK_CONTENT =
  FINAL_MAIN_LINES * LINE_HEIGHT + STACK_GAP + PANEL_LINES * LINE_HEIGHT;
const STACK_TOP = -STACK_CONTENT / 2;
const MAIN_Y_FINAL = STACK_TOP + MAIN_H / 2 - CLIP_PAD_Y;
const PANEL_Y = STACK_TOP + FINAL_MAIN_LINES * LINE_HEIGHT + STACK_GAP
  + PANEL_H / 2 - CLIP_PAD_Y;

const MAX_LINE_CHARS = Math.floor(
  (CODE_W - getCodePaddingX(CODE_FONT_SIZE)) / measureChar(CODE_FONT_SIZE),
);

// ── Palette ────────────────────────────────────────────────────────────────
const VAR_LIGHT = 'rgba(244, 241, 235, 0.96)';
const TYPE_CLEAN = 'rgba(220, 215, 255, 0.80)';
const METHOD_COLOR = DryFiltersV3CodeTheme.method;
// Enum-константы носят цвет констант темы (как в сценах главы 3), не крем
// переменных. Явные правила нужны: после золота бита D settle через
// colorizeAnimated обязан вернуть их именно сюда.
const CONST_COLOR = DryFiltersV3CodeTheme.constant;

// New code types in green, then settles into the normal palette.
const CREATE_GREEN = 'rgba(150, 230, 165, 0.96)';

// One accent vocabulary for the whole video: gold + film halation.
const ACCENT = 'rgba(255, 214, 140, 1.0)';
const HALATION_COLOR = 'rgba(255, 104, 36, 0.8)';
const HALATION_BLUR = 16;

const ACCENT_TOKENS = new Set([
  'GripForce', 'GENTLE',
  'MotionProfile', 'CAUTIOUS',
  'ReleaseStyle', 'ALIGNED',
]);

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
  // constants
  {match: /^SENSITIVE$/,   color: CONST_COLOR},
  {match: /^STANDARD$/,    color: CONST_COLOR},
  {match: /^GENTLE$/,      color: CONST_COLOR},
  {match: /^CAUTIOUS$/,    color: CONST_COLOR},
  {match: /^ALIGNED$/,     color: CONST_COLOR},
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
  {match: 'moveTo',                 color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'grab',                   color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'confirmGrip',            color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'release',                color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'hasSensitiveComponents', color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'forCube',                color: METHOD_COLOR, onlyTypes: ['method']},
];

// Beat C: the genuinely new material arrives in green.
const GREEN_RULES: ColorRule[] = [
  ...COLOR_RULES,
  {match: 'hasSensitiveComponents', color: CREATE_GREEN, onlyTypes: ['method']},
  {match: /^GripForce$/,     color: CREATE_GREEN},
  {match: /^GENTLE$/,        color: CREATE_GREEN},
  {match: /^MotionProfile$/, color: CREATE_GREEN},
  {match: /^CAUTIOUS$/,      color: CREATE_GREEN},
  {match: /^ReleaseStyle$/,  color: CREATE_GREEN},
  {match: /^ALIGNED$/,       color: CREATE_GREEN},
];

// Beat E: the profile is the new object — it types in green too.
const FOLD_GREEN_RULES: ColorRule[] = [
  ...COLOR_RULES,
  {match: /^HandlingProfile$/, color: CREATE_GREEN},
  {match: 'handling',          color: CREATE_GREEN},
  {match: 'forCube',           color: CREATE_GREEN, onlyTypes: ['method']},
];

// Panel arrives wearing the gold the evidence earned.
const PANEL_ACCENT_RULES: ColorRule[] = [
  ...COLOR_RULES,
  {match: /^GripForce$/,     color: ACCENT},
  {match: /^GENTLE$/,        color: ACCENT},
  {match: /^MotionProfile$/, color: ACCENT},
  {match: /^CAUTIOUS$/,      color: ACCENT},
  {match: /^ReleaseStyle$/,  color: ACCENT},
  {match: /^ALIGNED$/,       color: ACCENT},
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

// The canonical morph feel (codeWithActionsSceneRu): removals are instant,
// survivors glide, additions read as editor typing.
const CANON_MORPH = {
  scrollStrategy: 'block' as const,
  removeDuration: 0,
  moveDuration: 0.6,
};

// Beat A erasure: removed tokens tint to neutral and backspace out char by
// char, then the parentheses slide shut and replacements type in. The tint
// color is required — it is what arms the erase pass in the engine.
// tokenSlideDuration keeps the surviving `);` gliding into the shortened
// position instead of snapping; safe here because every erase edit is a
// 1-to-1 replaceLine — the slide is horizontal only.
const ERASE_TINT = 'rgba(244, 241, 235, 0.96)';
const ERASE_MORPH = {
  ...CANON_MORPH,
  removeDuration: 0.3,
  flashRemovedColor: ERASE_TINT,
  flashRemovedDuration: 0.12,
  flashRemovedErase: 'reverseType' as const,
  flashRemovedEraseCharDelay: 0.02,
  flashRemovedExcludeTypes: [],
  tokenSlideDuration: 0.35,
  addStyle: 'typewriter' as const,
  charDelay: 0.02,
};

const TYPE_MORPH = {
  ...CANON_MORPH,
  addStyle: 'typewriter' as const,
  charDelay: 0.02,
  lineDelay: 0.1,
};

// ── Profile panel (beat E payoff): the if did not disappear — it moved ────
const PANEL_CODE = `class HandlingProfile {
    static final HandlingProfile SENSITIVE = new HandlingProfile(
            GripForce.GENTLE, MotionProfile.CAUTIOUS, ReleaseStyle.ALIGNED);

    static HandlingProfile forCube(Cube cube, Table table) {
        return cube.hasSensitiveComponents() ? SENSITIVE : STANDARD;
    }
}`;

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ── The orchestrator, distorted state — where the first half left it ──
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

  const mc = Manticore.create(handlerModel.render(), {
    x: 0, y: MAIN_Y,
    width: CODE_W,
    height: MAIN_H,
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
  mc.mount(view);
  mc.colorize(COLOR_RULES);

  const dir = new Medusa(handlerModel, mc, {
    morphDefaults: CANON_MORPH,
    profiles: {stableExpand: CANON_MORPH},
    pauseAfterMorph: 0.5,
  });

  // ══ BEAT A — replay: the guess is erased, edit by edit ════════════════
  yield* mc.appear(Timing.slow);
  yield* waitFor(0.9);

  // "Roll it back" — the whole guess leaves in one breath: every erased
  // token across every line backspaces in the same erase pass, the parens
  // slide shut together. All edits are 1-to-1 replaceLine, so the pairing
  // stays positional and the slide stays horizontal.
  yield* dir.apply(m => {
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
  }, ERASE_MORPH);
  mc.colorize(COLOR_RULES);

  // The whole job — five bare lines, and nothing to defend.
  yield* waitFor(2.4);

  // ══ BEAT C — the requirement returns: the guard is typed in above ═════
  // The surviving path never moves sideways — it only makes room below.
  mc.colorize(GREEN_RULES);
  yield* dir.apply(m => {
    m.addLine('handleCube', 'arm.moveTo(cube.position);',
      '',
      'if (cube.hasSensitiveComponents()) {',
      '    arm.grab(cube, GripForce.GENTLE);',
      '    arm.confirmGrip();',
      '    arm.moveTo(table.position, MotionProfile.CAUTIOUS);',
      '    arm.release(ReleaseStyle.ALIGNED);',
      '    return;',
      '}',
      '');
  }, TYPE_MORPH);
  mc.colorize(GREEN_RULES);
  yield* waitFor(1.4);

  // Green settles into the normal palette — the new code is just code now.
  yield* mc.colorizeAnimated(0, mc.lineCount - 1, 0.9, COLOR_RULES);
  yield* waitFor(1.0);

  // ══ BEAT D — evidence: the three differences rise to gold and stay ════
  const accentRefsOnLine = (lineIdx: number) =>
    mc.getLine(lineIdx)!.tokens
      .filter(t => ACCENT_TOKENS.has(t.text))
      .map(t => t.ref());

  const goldLines = [
    mc.findLine('arm.grab(cube, GripForce.GENTLE)'),
    mc.findLine('arm.moveTo(table.position, MotionProfile.CAUTIOUS)'),
    mc.findLine('arm.release(ReleaseStyle.ALIGNED)'),
  ];

  for (const lineIdx of goldLines) {
    const refs = accentRefsOnLine(lineIdx);
    for (const r of refs) r.shadowColor(HALATION_COLOR);
    yield* all(...refs.flatMap(r => [
      r.fill(ACCENT, 0.7, easeInOutCubic),
      r.shadowBlur(HALATION_BLUR, 0.7, easeInOutCubic),
    ]));
    yield* waitFor(0.45);
  }
  yield* waitFor(2.2);

  // ══ BEAT E — the fold ═════════════════════════════════════════════════
  // E1: the profile enters the story — typed in green above the branch.
  mc.colorize(FOLD_GREEN_RULES);
  yield* dir.apply(m => {
    m.addLine('handleCube', 'arm.moveTo(cube.position);',
      '',
      'HandlingProfile handling = HandlingProfile.forCube(cube, table);');
  }, TYPE_MORPH);
  mc.colorize(FOLD_GREEN_RULES);
  yield* waitFor(0.7);

  // E2: the branch folds shut — the surviving path rises into place and
  // receives the profile; the whole block settles into the final stack.
  yield* all(
    dir.apply(m => {
      m.setBody('handleCube', [
        'arm.moveTo(cube.position);',
        '',
        'HandlingProfile handling = HandlingProfile.forCube(cube, table);',
        '',
        'arm.grab(cube, handling.gripForce);',
        'arm.confirmGrip();',
        'arm.moveTo(table.position, handling.motionProfile);',
        'arm.release(handling.releaseStyle);',
      ]);
    }, {...TYPE_MORPH, removeDuration: 0.25}),
    mc.node.y(MAIN_Y_FINAL, 0.9, easeInOutCubic),
  );
  mc.colorize(FOLD_GREEN_RULES);
  yield* waitFor(0.4);

  // The if did not disappear. It moved — same predicate, new owner.
  const panel = Manticore.create(PANEL_CODE, {
    x: 0, y: PANEL_Y,
    width: PANEL_W,
    height: PANEL_H,
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
  panel.mount(view);
  panel.colorize(PANEL_ACCENT_RULES);
  panel.node.opacity(0);

  const goldRefs = [] as any[];
  for (let i = 0; i < panel.lineCount; i++) {
    const line = panel.getLine(i);
    if (!line) continue;
    for (const t of line.tokens) {
      if (ACCENT_TOKENS.has(t.text)) goldRefs.push(t.ref());
    }
  }
  for (const r of goldRefs) {
    r.shadowColor(HALATION_COLOR);
    r.shadowBlur(HALATION_BLUR);
  }

  yield* panel.node.opacity(1, 0.9, easeInOutCubic);
  yield* waitFor(2.2);

  // Everything settles: green becomes code, gold becomes vocabulary.
  yield* all(
    mc.colorizeAnimated(0, mc.lineCount - 1, 1.1, COLOR_RULES),
    panel.colorizeAnimated(0, panel.lineCount - 1, 1.1, COLOR_RULES),
    ...goldRefs.map(r => r.shadowBlur(0, 1.1, easeInOutCubic)),
  );
  yield* waitFor(3.0);

  // ══ Quiet exit ════════════════════════════════════════════════════════
  yield* all(
    mc.node.opacity(0, Timing.slow, easeInOutCubic),
    panel.node.opacity(0, Timing.slow, easeInOutCubic),
  );
  yield* waitFor(0.3);
});
