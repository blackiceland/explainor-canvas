import {makeScene2D} from '@motion-canvas/2d';
import {waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Fonts} from '../core/theme';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY, getLineHeight} from '../core/code/shared/TextMeasure';

// ── Beat 3 — РЕАЛЬНОСТЬ ──────────────────────────────────────────────
//
// The orchestrator from Beat 2 stays on screen, unchanged. The new
// requirement (sensitive components → keep upright, avoid shocks) does
// NOT morph the code — it just reveals which lines it touches.
//
// The highlight sequence is a literal "map of impact":
//   arm.lift()             ← affected (shocks)
//   arm.moveTo(table)      ← affected (orientation)
//   arm.release()          ← affected (shocks)
//
// `grabStrategy.execute(...)` is deliberately NOT touched — this silence
// is the setup for Beat 4, where that exact line turns out to be the
// one that carries all the mutation. The irony has to be *visible* before
// it can land.
//
// No on-screen subtitle. Voiceover carries the requirement. Code +
// highlights + voice = three channels, each doing different work.
// ─────────────────────────────────────────────────────────────────────

const CODE = `public void handleCube(Cube cube, Table table) {
    arm.moveTo(cube.position);
    grabStrategy.execute(cube, gripper);
    arm.lift();
    arm.moveTo(table.position);
    arm.release();
}`;

// Line indices (0-based) into CODE.
const LINE_LIFT = 3;        // arm.lift();
const LINE_MOVE_TABLE = 4;  // arm.moveTo(table.position);
const LINE_RELEASE = 5;     // arm.release();
// Line 2 (grabStrategy.execute) stays silent on purpose — it is the foil.

// ── Styling ──────────────────────────────────────────────────────────
const CODE_FONT_SIZE = 52;
const CODE_BLOCK_WIDTH = 1400;

const VAR_LIGHT = 'rgba(244, 241, 235, 0.96)';
const TYPE_CLEAN = 'rgba(220, 215, 255, 0.80)';
const METHOD_COLOR = DryFiltersV3CodeTheme.method;
const KW_COLOR = DryFiltersV3CodeTheme.keyword;

const COLOR_RULES: ColorRule[] = [
  {match: /^public$/,   color: KW_COLOR},
  {match: /^void$/,     color: KW_COLOR},
  {match: 'handleCube', color: VAR_LIGHT},
  {match: 'arm',        color: VAR_LIGHT},
  {match: 'cube',       color: VAR_LIGHT},
  {match: 'gripper',    color: VAR_LIGHT},
  {match: 'position',   color: VAR_LIGHT},
  {match: 'table',      color: VAR_LIGHT},
  {match: 'grabStrategy', color: VAR_LIGHT},
  {match: /^Cube$/,     color: TYPE_CLEAN},
  {match: /^Table$/,    color: TYPE_CLEAN},
  {match: 'moveTo',     color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'execute',    color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'lift',       color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'release',    color: METHOD_COLOR, onlyTypes: ['method']},
];

// Subtle warm band — the same accent family used elsewhere for
// "this line is what we're talking about right now". Opacity is kept
// low so the highlight *suggests* attention, never shouts it. Three of
// these stacked should feel like reading-marks, not alarms.
const IMPACT_BG = 'rgba(255, 140, 163, 0.18)';

// Fully transparent card — the code floats on the scene background.
const CODE_CARD_STYLE = {
  radius: 16,
  fill: 'rgba(0,0,0,0)',
  stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0,
  shadowColor: 'rgba(0,0,0,0)',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  edge: false,
} as const;

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ─── Mount the orchestrator exactly as it stood at the end of Beat 2 ─
  const fontSize = CODE_FONT_SIZE;
  const lineHeight = getLineHeight(fontSize);
  const paddingY = getCodePaddingY(fontSize);

  const mc = Manticore.create(CODE, {
    x: 0,
    y: 0,
    width: CODE_BLOCK_WIDTH,
    fontSize,
    lineHeight,
    contentOffsetY: paddingY,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    noClip: true,
  });
  mc.mount(view);
  mc.colorize(COLOR_RULES);

  // Short fade assumes visual continuity with Beat 2 — we're not
  // "opening a new slide", the code is already in the viewer's head.
  yield* mc.appear(0.5);
  yield* waitFor(0.6);

  // ─────────────────────────────────────────────────────────────────
  // Voiceover sync (each waitFor below corresponds to a VO phrase):
  //
  //   "А потом приходит реальность."        → settle
  //   "Это не про хват."                      → deliberate silence on
  //                                              the grab line
  //   "Это подъём."                          → highlight LINE_LIFT
  //   "Перемещение."                          → highlight LINE_MOVE_TABLE
  //   "Отпускание."                          → highlight LINE_RELEASE
  //   "Но менять всё равно будут              → three highlights hold.
  //    GrabStrategy. Не потому что там         Voice names the line that
  //    правильное место. А потому что          is NOT lit. The viewer's
  //    оно уже есть."                          eye finds it on its own.
  // ─────────────────────────────────────────────────────────────────

  // "А потом приходит реальность."
  yield* waitFor(1.2);

  // "Это не про хват." — the grab line is in the middle of the
  // orchestrator and already caught the eye during the first read.
  // We do NOT highlight it, we do NOT dim it — we let the voice declare
  // the negative and the absence of a visual answer *is* the answer.
  yield* waitFor(1.1);

  // "Это подъём."
  yield* mc.showBackground(LINE_LIFT, LINE_LIFT, IMPACT_BG, 0.35);
  yield* waitFor(0.2);

  // "Перемещение."
  yield* mc.showBackground(LINE_MOVE_TABLE, LINE_MOVE_TABLE, IMPACT_BG, 0.35);
  yield* waitFor(0.2);

  // "Отпускание."
  yield* mc.showBackground(LINE_RELEASE, LINE_RELEASE, IMPACT_BG, 0.35);

  // Hold the full impact map. Three targets lit, grab line unlit.
  // This moment of stillness *is* the tension — three things were
  // hit, but the story isn't done yet.
  yield* waitFor(0.9);

  // "Но менять всё равно будут GrabStrategy.
  //  Не потому что там правильное место.
  //  А потому что оно уже есть."
  //
  // No new visual move. The voice names the line that is demonstrably
  // NOT in the impact map, and the viewer's eye flicks to `grabStrategy.
  // execute` on its own. Beat 4 will then mutate exactly that line; the
  // irony becomes mechanical because the viewer watched themselves
  // rule it out a moment earlier.
  yield* waitFor(4.8);

  // Let the highlights linger through the fade so the last frame still
  // carries the impact map — no clean-up-then-fade, no extra motion.
  yield* mc.disappear(0.8);
  yield* waitFor(0.2);
});
