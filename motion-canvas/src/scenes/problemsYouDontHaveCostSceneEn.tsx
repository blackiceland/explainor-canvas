import {makeScene2D} from '@motion-canvas/2d';
import {all, chain, easeInOutCubic, easeOutCubic, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Fonts} from '../core/theme';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';

// ── Beat 4 — ЦЕНА ─────────────────────────────────────────────────────
//
// "Strategy promised to localize variation. Instead it multiplied the
//  surface of every future change."
//
// The orchestrator opens centered, alone — carrying the mood of Beat 3
// forward (the requirement has just been spoken). Then the camera
// "pulls back": the orchestrator shifts up, three Strategy files
// cascade in below, and four files are now on screen at once.
//
// The mutations land in a deliberate order:
//   1. Orchestrator        — the callsite grows a GrabResult. Three
//                            of its lines change. The bill begins.
//   2. SoftGrab            — expected. "This is the soft case."
//   3. FirmGrab            — still expected.
//   4. StandardGrab        — ← THE PUNCHLINE. The class that has
//                            literally nothing to do with fragility
//                            still has to be opened. This is where
//                            the viewer *feels* the wrong abstraction.
//
// The punchline lands on StandardGrab because it is the only class
// whose existence is not justified by the new requirement. Its diff
// is the smoking gun. Spatially it sits on the right — the last place
// the eye rests after reading left-to-right — so the final morph
// lands exactly where the eye already is.
//
// No on-screen subtitle. VO carries the thesis; the visual carries
// the count: four files open, four files changed, three of them for
// a reason that has nothing to do with grabbing.
//
// NOTE on the witness arm: the 3D arm that was on the right in Beat 3
// is intentionally absent here. This beat is pure code drama. Bringing
// the arm back as a corner "witness" was considered, but dropped so
// the eye has nowhere else to go — the four files must own the frame.
// The contrast "world barely changed, code radically did" is delivered
// by the *absence* of the arm, not by miniaturising it.
// ─────────────────────────────────────────────────────────────────────

// ── Code snapshots ───────────────────────────────────────────────────

const ORC_INIT = `private final GrabStrategy grabStrategy = new StandardGrab();

public void handleCube(Cube cube, Table table) {
    arm.moveTo(cube.position);
    grabStrategy.grab(cube);
    arm.lift();
    arm.moveTo(table.position);
    arm.release();
}`;

const ORC_DONE = `private final GrabStrategy grabStrategy = new StandardGrab();

public void handleCube(Cube cube, Table table) {
    arm.moveTo(cube.position);
    GrabResult result = grabStrategy.grab(cube);
    arm.lift(result.liftSpeed);
    arm.moveTo(table.position, result.orientation);
    arm.release(result.releaseMode);
}`;

const SOFT_INIT = `public class SoftGrab implements GrabStrategy {
    public void grab(Cube cube) {
        approachSlowly(cube.position);
        close(Force.LIGHT);
        waitForSensor();
        adjustToFeedback();
    }
}`;

const SOFT_DONE = `public class SoftGrab implements GrabStrategy {
    public GrabResult grab(Cube cube) {
        approachSlowly(cube.position);
        close(Force.LIGHT);
        waitForSensor();
        adjustToFeedback();
        return GrabResult.gentle(cube);
    }
}`;

const FIRM_INIT = `public class FirmGrab implements GrabStrategy {
    public void grab(Cube cube) {
        preAlign(cube);
        close(Force.MAXIMUM);
        lockWrist();
    }
}`;

const FIRM_DONE = `public class FirmGrab implements GrabStrategy {
    public GrabResult grab(Cube cube) {
        preAlign(cube);
        close(Force.MAXIMUM);
        lockWrist();
        return GrabResult.firm(cube);
    }
}`;

const STANDARD_INIT = `public class StandardGrab implements GrabStrategy {
    public void grab(Cube cube) {
        approach(cube.position);
        close(Force.MEDIUM);
    }
}`;

const STANDARD_DONE = `public class StandardGrab implements GrabStrategy {
    public GrabResult grab(Cube cube) {
        approach(cube.position);
        close(Force.MEDIUM);
        return GrabResult.standard(cube);
    }
}`;

// ── Styling ──────────────────────────────────────────────────────────
const ORC_FONT_SIZE = 32;
const ORC_WIDTH = 1280;

const STRAT_FONT_SIZE = 20;
const STRAT_WIDTH = 580;

const VAR_LIGHT = 'rgba(244, 241, 235, 0.96)';
const TYPE_CLEAN = 'rgba(220, 215, 255, 0.80)';
const METHOD_COLOR = DryFiltersV3CodeTheme.method;
const KW_COLOR = DryFiltersV3CodeTheme.keyword;

const COLOR_RULES: ColorRule[] = [
  {match: /^public$/,         color: KW_COLOR},
  {match: /^private$/,        color: KW_COLOR},
  {match: /^final$/,          color: KW_COLOR},
  {match: /^new$/,            color: KW_COLOR},
  {match: /^class$/,          color: KW_COLOR},
  {match: /^void$/,           color: KW_COLOR},
  {match: /^implements$/,     color: KW_COLOR},
  {match: /^return$/,         color: KW_COLOR},
  {match: 'handleCube',       color: VAR_LIGHT},
  {match: 'arm',              color: VAR_LIGHT},
  {match: 'cube',             color: VAR_LIGHT},
  {match: 'position',         color: VAR_LIGHT},
  {match: 'table',            color: VAR_LIGHT},
  {match: 'grabStrategy',     color: VAR_LIGHT},
  {match: 'result',           color: VAR_LIGHT},
  {match: 'liftSpeed',        color: VAR_LIGHT},
  {match: 'orientation',      color: VAR_LIGHT},
  {match: 'releaseMode',      color: VAR_LIGHT},
  {match: /^Cube$/,           color: TYPE_CLEAN},
  {match: /^Table$/,          color: TYPE_CLEAN},
  {match: /^Force$/,          color: TYPE_CLEAN},
  {match: /^GrabStrategy$/,   color: TYPE_CLEAN},
  {match: /^GrabResult$/,     color: TYPE_CLEAN},
  {match: /^StandardGrab$/,   color: TYPE_CLEAN},
  {match: /^SoftGrab$/,       color: TYPE_CLEAN},
  {match: /^FirmGrab$/,       color: TYPE_CLEAN},
  {match: 'moveTo',           color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'grab',             color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'lift',             color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'release',          color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'approach',         color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'approachSlowly',   color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'waitForSensor',    color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'adjustToFeedback', color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'close',            color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'preAlign',         color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'lockWrist',        color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'standard',         color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'gentle',           color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'firm',             color: METHOD_COLOR, onlyTypes: ['method']},
];

const CUSTOM_TYPES = [
  'Cube', 'Table', 'Force',
  'GrabStrategy', 'GrabResult',
  'StandardGrab', 'SoftGrab', 'FirmGrab',
];

// Fully transparent card — code floats on the scene background.
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

// Layout coordinates — derived once so every phase references the same
// numbers. Orchestrator ends up on top, the three strategies sit in a
// row below.
const ORC_ENTRY_Y = 0;      // where orchestrator opens (alone, centered)
const ORC_FINAL_Y = -240;   // where it sits during the wide shot

const STRAT_ROW_Y = 250;
const STRAT_COL_X = {
  soft: -620,
  firm: 0,
  standard: 620,
} as const;

// Shared morph options — 'block' scroll strategy keeps each block in
// place (no scrolling), typewriter adds feel like the change is being
// typed by whoever is being forced to write it.
const MORPH_OPTS = {
  scrollStrategy: 'block' as const,
  removeDuration: 0,
  moveDuration: 0.55,
  charDelay: 0.010,
  lineDelay: 0.025,
};

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ─── Mount orchestrator at entry position (centered, alone) ────────
  const mcOrc = Manticore.create(ORC_INIT, {
    x: 0,
    y: ORC_ENTRY_Y,
    width: ORC_WIDTH,
    fontSize: ORC_FONT_SIZE,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    customTypes: CUSTOM_TYPES,
    glowAccent: false,
    noClip: true,
  });
  mcOrc.mount(view);
  mcOrc.colorize(COLOR_RULES);

  // ─── Mount the three strategies, initially invisible & below ───────
  const mcSoft = Manticore.create(SOFT_INIT, {
    x: STRAT_COL_X.soft,
    y: STRAT_ROW_Y + 80,
    width: STRAT_WIDTH,
    fontSize: STRAT_FONT_SIZE,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    customTypes: CUSTOM_TYPES,
    glowAccent: false,
    noClip: true,
  });
  mcSoft.mount(view);
  mcSoft.colorize(COLOR_RULES);

  const mcFirm = Manticore.create(FIRM_INIT, {
    x: STRAT_COL_X.firm,
    y: STRAT_ROW_Y + 80,
    width: STRAT_WIDTH,
    fontSize: STRAT_FONT_SIZE,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    customTypes: CUSTOM_TYPES,
    glowAccent: false,
    noClip: true,
  });
  mcFirm.mount(view);
  mcFirm.colorize(COLOR_RULES);

  const mcStd = Manticore.create(STANDARD_INIT, {
    x: STRAT_COL_X.standard,
    y: STRAT_ROW_Y + 80,
    width: STRAT_WIDTH,
    fontSize: STRAT_FONT_SIZE,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    customTypes: CUSTOM_TYPES,
    glowAccent: false,
    noClip: true,
  });
  mcStd.mount(view);
  mcStd.colorize(COLOR_RULES);

  // ═════════════════════════════════════════════════════════════════
  // PHASE 1 — Orchestrator enters alone
  // "The requirement has been spoken. The code has not moved yet."
  // ═════════════════════════════════════════════════════════════════
  yield* mcOrc.appear(0.6);
  yield* waitFor(0.9);

  // ═════════════════════════════════════════════════════════════════
  // PHASE 2 — Camera pulls back: orchestrator shifts up, three
  // strategy files cascade in from below.
  // "These three files exist. They are about to matter whether you
  //  wanted them to or not."
  // ═════════════════════════════════════════════════════════════════
  yield* all(
    mcOrc.node.y(ORC_FINAL_Y, 0.9, easeInOutCubic),
    chain(
      waitFor(0.25),
      all(
        mcSoft.node.y(STRAT_ROW_Y, 0.7, easeOutCubic),
        mcSoft.appear(0.7),
      ),
    ),
    chain(
      waitFor(0.45),
      all(
        mcFirm.node.y(STRAT_ROW_Y, 0.7, easeOutCubic),
        mcFirm.appear(0.7),
      ),
    ),
    chain(
      waitFor(0.65),
      all(
        mcStd.node.y(STRAT_ROW_Y, 0.7, easeOutCubic),
        mcStd.appear(0.7),
      ),
    ),
  );

  // Hold the wide shot briefly so the viewer *counts* the files
  // before anything starts changing.
  yield* waitFor(0.9);

  // ═════════════════════════════════════════════════════════════════
  // PHASE 3 — Orchestrator mutates first.
  // The callsite grows a GrabResult; three lines change. The bill
  // begins to arrive at the place the viewer was already looking.
  // ═════════════════════════════════════════════════════════════════
  yield* mcOrc.morphTo(ORC_DONE, MORPH_OPTS);
  yield* waitFor(0.6);

  // ═════════════════════════════════════════════════════════════════
  // PHASE 4 — SoftGrab mutates. Expected. "Well, of course, this is
  // the soft case — it had to change."
  // ═════════════════════════════════════════════════════════════════
  yield* mcSoft.morphTo(SOFT_DONE, MORPH_OPTS);
  yield* waitFor(0.35);

  // ═════════════════════════════════════════════════════════════════
  // PHASE 5 — FirmGrab mutates. Still expected — the interface
  // changed, so every implementor has to follow. But notice: the
  // requirement was never about firm grabbing.
  // ═════════════════════════════════════════════════════════════════
  yield* mcFirm.morphTo(FIRM_DONE, MORPH_OPTS);

  // Small extra hold before the punchline — a beat of silence where
  // the viewer's eye drifts LEFT of centre and lands on StandardGrab,
  // which is still unchanged.
  yield* waitFor(0.8);

  // ═════════════════════════════════════════════════════════════════
  // PHASE 6 — StandardGrab mutates. THE PUNCHLINE.
  //
  // This class has nothing to do with fragility. Its only crime is
  // that it implements the interface the whole system agreed to go
  // through. So it gets touched anyway. This is the beat where the
  // viewer feels — not is told — that the wrong door makes every
  // change go through it.
  // ═════════════════════════════════════════════════════════════════
  yield* mcStd.morphTo(STANDARD_DONE, MORPH_OPTS);

  // ═════════════════════════════════════════════════════════════════
  // PHASE 7 — Wide-shot hold. Four files, four diffs. VO lands.
  //
  // "Strategy promised to localize variation. Instead it multiplied
  //  the surface of every future change."
  // ═════════════════════════════════════════════════════════════════
  yield* waitFor(3.8);

  // Gentle exit. Hold the frame through the fade so the last thing
  // the viewer sees is the full count of damage.
  yield* all(
    mcOrc.disappear(0.8),
    mcSoft.disappear(0.8),
    mcFirm.disappear(0.8),
    mcStd.disappear(0.8),
  );
  yield* waitFor(0.2);
});
