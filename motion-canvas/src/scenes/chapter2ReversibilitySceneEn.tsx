import {Line, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  all, chain, createRef, createSignal,
  easeInCubic, easeInOutCubic, easeOutCubic, ThreadGenerator, waitFor,
} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

// ══════════════════════════════════════════════════════════════════════
// Chapter 2 — Reversibility / Tracer Bullet
//
//   1 entanglement   — code centered; long read.
//   2 reversibility  — token-glow + recolor red over the code.
//   3 tracer bullet  — code SLIDES from centre to left; tree-graph of
//                      structural cost reveals on the right (already
//                      red), then dims to a faint echo. Code morphs to
//                      a thin working path.
//   4 reality        — token-glow on grab / moveTo / release.
//   5 local profile  — code morphs to HandlingProfile with green-type.
//   6 easy rollback  — code morphs back; the tree on the right does not
//                      move (the contrast with Beat 2's cascade).
//   7 contrast       — tree returns to higher alpha; both panels visible.
//   8 final formula  — clean two-line takeaway.
//
//   No labels under panels, no stripes, no chips, no decorative
//   pointing arrows. Only canon: code as protagonist, tree-graph as
//   structural-cost metaphor, token-glow / recolor as in-code emphasis.
// ══════════════════════════════════════════════════════════════════════

// ── Palette ──────────────────────────────────────────────────────────
const TEXT_BRIGHT  = 'rgba(244, 241, 235, 0.96)';
const TEXT_TAG     = 'rgba(244, 241, 235, 0.78)';
const TYPE_CLEAN   = 'rgba(220, 215, 255, 0.85)';
const VAR_LIGHT    = 'rgba(244, 241, 235, 0.96)';
const METHOD_COLOR = DryFiltersV3CodeTheme.method;
const SOFT_GREEN   = 'rgba(168, 214, 178, 0.88)';
const SIGNAL_LINE  = 'rgba(120, 220, 255, 0.85)';

// Tree-graph palette (mirrors correctBoundariesSceneRu).
const HUB_FILL     = 'rgba(160, 190, 255, 0.28)';
const LEAF_FILL    = 'rgba(244, 241, 235, 0.07)';
const BOX_STROKE   = 'rgba(244, 241, 235, 0.30)';
const HUB_STROKE   = 'rgba(244, 241, 235, 0.55)';
const CONN_COLOR   = 'rgba(244, 241, 235, 0.22)';
const CODE_FG_BOX  = 'rgba(244, 241, 235, 0.92)';

// Cascade-red palette.
const ACCENT_RED   = 'rgba(255, 100, 100, 0.95)';
const RED_FILL     = 'rgba(255, 100, 100, 0.22)';
const RED_GLOW     = 'rgba(255, 100, 130, 0.85)';
const RED_BLUR     = 14;

// ── Code states ──────────────────────────────────────────────────────
const ENTANGLED = `class CubeHandler {

    private final RobotArm arm = new RobotArm();
    private final GrabStrategy grabStrategy = new StandardGrab();

    public void handleCube(Cube cube, Table table) {
        arm.moveTo(cube.position);
        GrabResult result = grabStrategy.grab(cube);
        arm.confirmGrip(result.confidence);
        arm.moveTo(table.position, result.motionProfile);
        arm.release(result.orientation);
    }
}`;

const TRACER = `public void handleCube(Cube cube, Table table) {
    arm.moveTo(cube.position);
    arm.grab(cube);
    arm.confirmGrip();
    arm.moveTo(table.position);
    arm.release();
}`;

const PROFILE = `public void handleCube(Cube cube, Table table) {
    HandlingProfile handling = HandlingProfile.forTransfer(cube, table);

    arm.moveTo(cube.position);
    arm.grab(cube, handling.gripForce);
    arm.confirmGrip();
    arm.moveTo(table.position, handling.motionProfile);
    arm.release(handling.releaseStyle);
}`;

const COLOR_RULES: ColorRule[] = [
  {match: 'handleCube',     color: VAR_LIGHT},
  {match: 'arm',            color: VAR_LIGHT},
  {match: 'cube',           color: VAR_LIGHT},
  {match: 'table',          color: VAR_LIGHT},
  {match: 'position',       color: VAR_LIGHT},
  {match: 'grabStrategy',   color: VAR_LIGHT},
  {match: 'result',         color: VAR_LIGHT},
  {match: 'confidence',     color: VAR_LIGHT},
  {match: 'orientation',    color: VAR_LIGHT},
  {match: 'handling',       color: VAR_LIGHT},
  {match: 'gripForce',      color: VAR_LIGHT},
  {match: 'motionProfile',  color: VAR_LIGHT},
  {match: 'releaseStyle',   color: VAR_LIGHT},
  {match: /^Cube$/,                  color: TYPE_CLEAN},
  {match: /^Table$/,                 color: TYPE_CLEAN},
  {match: /^GrabResult$/,            color: TYPE_CLEAN},
  {match: /^RobotArm$/,              color: TYPE_CLEAN},
  {match: /^GrabStrategy$/,          color: TYPE_CLEAN},
  {match: /^StandardGrab$/,          color: TYPE_CLEAN},
  {match: /^HandlingProfile$/,       color: TYPE_CLEAN},
  {match: 'moveTo',       color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'grab',         color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'confirmGrip',  color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'release',      color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'forTransfer',  color: METHOD_COLOR, onlyTypes: ['method']},
];

const RED_RULES: ColorRule[] = [
  ...COLOR_RULES,
  {match: /^GrabStrategy$/,    color: ACCENT_RED},
  {match: /^StandardGrab$/,    color: ACCENT_RED},
  {match: /^GrabResult$/,      color: ACCENT_RED},
  {match: 'grabStrategy',      color: ACCENT_RED},
  {match: 'result',            color: ACCENT_RED},
  {match: 'confidence',        color: ACCENT_RED},
  {match: 'motionProfile',     color: ACCENT_RED},
  {match: 'orientation',       color: ACCENT_RED},
];

const GREEN_RULES: ColorRule[] = [
  ...COLOR_RULES,
  {match: 'forTransfer',       color: SOFT_GREEN, onlyTypes: ['method']},
  {match: 'gripForce',         color: SOFT_GREEN},
  {match: 'motionProfile',     color: SOFT_GREEN},
  {match: 'releaseStyle',      color: SOFT_GREEN},
  {match: 'handling',          color: SOFT_GREEN},
  {match: /^HandlingProfile$/, color: SOFT_GREEN},
];

const CUSTOM_TYPES = [
  'Cube', 'Table', 'GrabResult', 'RobotArm',
  'GrabStrategy', 'StandardGrab',
  'HandlingProfile', 'GripForce', 'MotionProfile', 'ReleaseStyle',
];

// Tokens that get red-glow when the hub gets yanked.
const COST_TOKENS = [
  'GrabStrategy', 'grabStrategy', 'StandardGrab',
  'GrabResult', 'result', 'confidence',
  'motionProfile', 'orientation',
];

// ── Geometry ─────────────────────────────────────────────────────────
const FONT_SIZE = 22;
const LINE_H    = Math.round(FONT_SIZE * 1.62 * 10) / 10;  // 35.6

const CODE_W      = 920;
const CODE_X_CTR  = 0;
const CODE_X_LEFT = -480;
const CODE_Y      = 30;

const CARD_STYLE = {
  radius: 0,
  fill: 'rgba(0,0,0,0)',
  stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0,
  shadowColor: 'rgba(0,0,0,0)',
  shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
  edge: false,
} as const;

// Tree-graph layout (right half).
const TREE_CX = 460;
const HUB_W = 240, HUB_H = 56, BOX_R = 12;
const LEAF_W = 200, LEAF_H = 46;

const HUB_POS = {x: TREE_CX, y: -300};
const ROW1_Y = -110;
const ROW2_Y =  +90;
const COL_DX = 240;

interface BoxPos {x: number; y: number}
const LEAVES: Record<string, BoxPos> = {
  grabResult:    {x: TREE_CX - COL_DX, y: ROW1_Y},
  motionProfile: {x: TREE_CX,          y: ROW1_Y},
  releaseStyle:  {x: TREE_CX + COL_DX, y: ROW1_Y},
  impls:         {x: TREE_CX - COL_DX, y: ROW2_Y},
  transferCode:  {x: TREE_CX,          y: ROW2_Y},
  tests:         {x: TREE_CX + COL_DX, y: ROW2_Y},
};

const HUB_BOTTOM = HUB_POS.y + HUB_H / 2;     // -272
const ROW1_TOP   = ROW1_Y - LEAF_H / 2;       // -133
const ROW1_BOT   = ROW1_Y + LEAF_H / 2;       //  -87
const ROW2_TOP   = ROW2_Y - LEAF_H / 2;       //  +67

const conn4 = (
  x1: number, y1: number,
  x2: number, y2: number,
): [number, number][] => {
  const mid = (y1 + y2) / 2;
  return [[x1, y1], [x1, mid], [x2, mid], [x2, y2]];
};

// ──────────────────────────────────────────────────────────────────────
export default makeScene2D(function* (view) {
  applyBackground(view);

  // ─── Code panel — centered initially ─────────────────────────────
  const code = Manticore.create(ENTANGLED, {
    x: CODE_X_CTR, y: CODE_Y,
    width: CODE_W,
    height: 0,
    fontSize: FONT_SIZE, lineHeight: LINE_H,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CARD_STYLE,
    glowAccent: false,
    noClip: true,
    customTypes: CUSTOM_TYPES,
  });
  code.mount(view);
  code.colorize(COLOR_RULES);

  // ─── Tree-graph (created up front, opacity 0 until Beat 3) ──────
  type BoxHandle = {
    rectRef: ReturnType<typeof createRef<Rect>>;
    txtRef: ReturnType<typeof createRef<Txt>>;
  };

  function makeBox(pos: BoxPos, label: string, isHub = false): BoxHandle {
    const rectRef = createRef<Rect>();
    const txtRef  = createRef<Txt>();
    const w = isHub ? HUB_W : LEAF_W;
    const h = isHub ? HUB_H : LEAF_H;
    view.add(
      <Rect
        ref={rectRef}
        x={pos.x} y={pos.y}
        width={w} height={h}
        radius={BOX_R}
        // Tree appears already red (Beat 2's cascade is conceptually
        // already on the code; the tree merely externalises it).
        fill={isHub ? RED_FILL : RED_FILL}
        stroke={ACCENT_RED}
        lineWidth={isHub ? 1.8 : 1.4}
        opacity={0}
      >
        <Txt
          ref={txtRef}
          text={label}
          fontFamily={Fonts.code}
          fontSize={isHub ? 20 : 18}
          fontWeight={isHub ? 600 : 400}
          fill={ACCENT_RED}
          textAlign={'center'}
        />
      </Rect>,
    );
    return {rectRef, txtRef};
  }

  const hub = makeBox(HUB_POS, 'GrabStrategy', true);
  const leaves = {
    grabResult:    makeBox(LEAVES.grabResult,    'GrabResult'),
    motionProfile: makeBox(LEAVES.motionProfile, 'MotionProfile'),
    releaseStyle:  makeBox(LEAVES.releaseStyle,  'ReleaseStyle'),
    impls:         makeBox(LEAVES.impls,         'Standard / Soft / Firm'),
    transferCode:  makeBox(LEAVES.transferCode,  'transfer code'),
    tests:         makeBox(LEAVES.tests,         'tests'),
  };
  leaves.impls.txtRef().fontSize(15);

  function makeConn(points: [number, number][]) {
    const ref = createRef<Line>();
    view.add(
      <Line
        ref={ref}
        points={points}
        stroke={ACCENT_RED}
        lineWidth={2}
        radius={10}
        end={0}
        opacity={1}
      />,
    );
    return {ref};
  }

  const c_hub_gr  = makeConn(conn4(HUB_POS.x, HUB_BOTTOM, LEAVES.grabResult.x,    ROW1_TOP));
  const c_hub_mp  = makeConn(conn4(HUB_POS.x, HUB_BOTTOM, LEAVES.motionProfile.x, ROW1_TOP));
  const c_hub_rs  = makeConn(conn4(HUB_POS.x, HUB_BOTTOM, LEAVES.releaseStyle.x,  ROW1_TOP));
  const c_gr_xc   = makeConn(conn4(LEAVES.grabResult.x,    ROW1_BOT, LEAVES.impls.x,        ROW2_TOP));
  const c_mp_tc   = makeConn(conn4(LEAVES.motionProfile.x, ROW1_BOT, LEAVES.transferCode.x, ROW2_TOP));
  const c_rs_te   = makeConn(conn4(LEAVES.releaseStyle.x,  ROW1_BOT, LEAVES.tests.x,        ROW2_TOP));

  // Hide all conn opacity until Beat 3.
  for (const c of [c_hub_gr, c_hub_mp, c_hub_rs, c_gr_xc, c_mp_tc, c_rs_te]) {
    c.ref().opacity(0);
  }

  const allConns  = [c_hub_gr, c_hub_mp, c_hub_rs, c_gr_xc, c_mp_tc, c_rs_te];
  const allBoxes  = [hub, leaves.grabResult, leaves.motionProfile, leaves.releaseStyle,
                     leaves.impls, leaves.transferCode, leaves.tests];

  // ═══ Beat 1 — entanglement (code alone, centered) ════════════════
  yield* code.appear(Timing.slow);
  yield* waitFor(3.4);

  // ═══ Beat 2 — reversibility test (cascade red on the code) ═══════
  function* glowCostTokens(): ThreadGenerator {
    const anims: ThreadGenerator[] = [];
    for (let i = 0; i < code.lineCount; i++) {
      const line = code.getLine(i);
      if (line) anims.push(line.setTokensGlow(COST_TOKENS, RED_BLUR, RED_GLOW, 0.5));
    }
    yield* all(...anims);
  }
  yield* all(
    glowCostTokens(),
    code.colorizeAnimated(0, code.lineCount - 1, 0.6, RED_RULES),
  );
  code.colorize(RED_RULES);
  yield* waitFor(3.0);

  // ═══ Beat 3 — slide left + reveal tree + morph to tracer ═════════
  // The slide-left moment: the centred code makes room for the cost it
  // can't afford to pay back. Tree-graph (already red) reveals as the
  // structural surface that would have to move with the hub.
  yield* all(
    code.node.x(CODE_X_LEFT, 0.9, easeInOutCubic),

    // Tree builds up on the right, in waves outward from the hub.
    chain(
      waitFor(0.15),
      hub.rectRef().opacity(1, 0.45, easeOutCubic),
    ),
    chain(
      waitFor(0.30),
      all(
        c_hub_gr.ref().end(1, 0.4, easeInOutCubic),
        c_hub_mp.ref().end(1, 0.4, easeInOutCubic),
        c_hub_rs.ref().end(1, 0.4, easeInOutCubic),
        c_hub_gr.ref().opacity(1, 0.4, easeOutCubic),
        c_hub_mp.ref().opacity(1, 0.4, easeOutCubic),
        c_hub_rs.ref().opacity(1, 0.4, easeOutCubic),
      ),
    ),
    chain(
      waitFor(0.40),
      all(
        leaves.grabResult.rectRef().opacity(1, 0.4, easeOutCubic),
        leaves.motionProfile.rectRef().opacity(1, 0.4, easeOutCubic),
        leaves.releaseStyle.rectRef().opacity(1, 0.4, easeOutCubic),
      ),
    ),
    chain(
      waitFor(0.55),
      all(
        c_gr_xc.ref().end(1, 0.4, easeInOutCubic),
        c_mp_tc.ref().end(1, 0.4, easeInOutCubic),
        c_rs_te.ref().end(1, 0.4, easeInOutCubic),
        c_gr_xc.ref().opacity(1, 0.4, easeOutCubic),
        c_mp_tc.ref().opacity(1, 0.4, easeOutCubic),
        c_rs_te.ref().opacity(1, 0.4, easeOutCubic),
      ),
    ),
    chain(
      waitFor(0.70),
      all(
        leaves.impls.rectRef().opacity(1, 0.4, easeOutCubic),
        leaves.transferCode.rectRef().opacity(1, 0.4, easeOutCubic),
        leaves.tests.rectRef().opacity(1, 0.4, easeOutCubic),
      ),
    ),
  );
  yield* waitFor(1.6);

  // Tree dims to a faint echo so the working code can take focus.
  function* resetCodeGlow(): ThreadGenerator {
    const anims: ThreadGenerator[] = [];
    for (let i = 0; i < code.lineCount; i++) {
      const line = code.getLine(i);
      if (line) anims.push(line.resetColors(0.4));
    }
    yield* all(...anims);
  }

  yield* all(
    ...allBoxes.map(b => b.rectRef().opacity(0.32, 0.7, easeInOutCubic)),
    ...allConns.map(c => c.ref().opacity(0.22, 0.7, easeInOutCubic)),
    resetCodeGlow(),
  );

  // Code morphs ENTANGLED → TRACER.
  yield* code.morphTo(TRACER, {
    addStyle: 'fade',
    moveDuration: 0.8,
    removeDuration: 0.4,
    flashRemovedColor: 'rgba(244, 241, 235, 0.50)',
    flashRemovedDuration: 0.05,
    flashRemovedErase: 'reverseType',
    flashRemovedEraseCharDelay: 0.012,
    flashRemovedExcludeTypes: [],
    lineOrder: 'parallel',
  });
  code.colorize(COLOR_RULES);
  yield* waitFor(2.4);

  // ═══ Beat 4 — reality presses (token-glow only) ══════════════════
  // The real signal lands on the lines that real shapes will cling to.
  // No stripes, no chips. Just the code's own tokens lighting up.
  const grabIdx    = code.findLine('arm.grab');
  const moveIdx    = code.findLine('arm.moveTo(table.position)');
  const releaseIdx = code.findLine('arm.release()');

  function* glowLine(lineIdx: number, tokens: string[]): ThreadGenerator {
    const line = code.getLine(lineIdx);
    if (line) yield* line.setTokensGlow(tokens, 12, SIGNAL_LINE, 0.45);
  }

  yield* glowLine(grabIdx, ['grab']);
  yield* waitFor(0.3);
  yield* glowLine(moveIdx, ['moveTo']);
  yield* waitFor(0.3);
  yield* glowLine(releaseIdx, ['release']);
  yield* waitFor(2.4);

  // ═══ Beat 5 — local profile (morph + green-type) ═════════════════
  yield* resetCodeGlow();

  code.colorize(GREEN_RULES);
  yield* code.morphTo(PROFILE, {
    addStyle: 'fade',
    moveDuration: 0.8,
    removeDuration: 0,
    lineOrder: 'parallel',
  });
  yield* waitFor(0.5);

  yield* code.colorizeAnimated(0, code.lineCount - 1, 0.6, COLOR_RULES);
  code.colorize(COLOR_RULES);
  yield* waitFor(2.2);

  // ═══ Beat 6 — easy rollback ══════════════════════════════════════
  // Code morphs back. The tree on the right does not move — that is
  // the whole point: contrast with Beat 2's cascade.
  yield* code.morphTo(TRACER, {
    addStyle: 'fade',
    moveDuration: 0.7,
    removeDuration: 0.5,
    flashRemovedColor: 'rgba(244, 241, 235, 0.50)',
    flashRemovedDuration: 0.05,
    flashRemovedErase: 'reverseType',
    flashRemovedEraseCharDelay: 0.012,
    flashRemovedExcludeTypes: [],
    lineOrder: 'parallel',
  });
  code.colorize(COLOR_RULES);
  yield* waitFor(2.2);

  // Restore profile state for the contrast beat.
  code.colorize(GREEN_RULES);
  yield* code.morphTo(PROFILE, {
    addStyle: 'fade',
    moveDuration: 0.5,
    removeDuration: 0,
    lineOrder: 'parallel',
  });
  yield* code.colorizeAnimated(0, code.lineCount - 1, 0.4, COLOR_RULES);
  code.colorize(COLOR_RULES);

  // ═══ Beat 7 — contrast (accord) ══════════════════════════════════
  yield* all(
    ...allBoxes.map(b => b.rectRef().opacity(0.78, 0.7, easeInOutCubic)),
    ...allConns.map(c => c.ref().opacity(0.62, 0.7, easeInOutCubic)),
  );
  yield* waitFor(3.6);

  // ═══ Beat 8 — final formula ══════════════════════════════════════
  yield* all(
    code.disappear(0.9),
    ...allBoxes.map(b => b.rectRef().opacity(0, 0.9, easeInOutCubic)),
    ...allConns.map(c => c.ref().opacity(0, 0.9, easeInOutCubic)),
  );
  yield* waitFor(0.4);

  const finalOp = createSignal(0);
  view.add(
    <Txt
      text={'Bad architecture is not a wrong guess.'}
      x={0} y={-36}
      fontFamily={Fonts.primary}
      fontSize={42}
      fontWeight={400}
      fill={TEXT_TAG}
      opacity={finalOp}
    />,
  );
  view.add(
    <Txt
      text={"It's a guess you can't afford to undo."}
      x={0} y={32}
      fontFamily={Fonts.primary}
      fontSize={48}
      fontWeight={500}
      fill={TEXT_BRIGHT}
      opacity={finalOp}
    />,
  );

  yield* finalOp(1, Timing.slow, easeInOutCubic);
  yield* waitFor(4.6);
  yield* finalOp(0, Timing.slow, easeInCubic);
  yield* waitFor(0.4);
});
