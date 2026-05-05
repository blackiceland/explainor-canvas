import {Line, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  all, chain, createRef, createSignal,
  easeInCubic, easeInOutCubic, easeOutCubic, ThreadGenerator, waitFor,
} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Colors, Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// ══════════════════════════════════════════════════════════════════════
// Chapter 2 — Reversibility
//
//   Beat 0a — opening question (matches the earnedAbstraction lead-in).
//   Beat 0b — title "Reversibility" — the answer.
//   Beat 1  — code on the LEFT and graph on the RIGHT appear together.
//   Beat 1d — pulling the centre flashes all threads red briefly.
//   Beat 2  — morph cascade with reflow:
//               (1) handleCube body morphs (call site removed).
//               (2-4) SoftGrab → StandardGrab → FirmGrab — each block
//                   becomes RED CODE (colorizeAnimated), then morphTo
//                   removes its lines; survivors slide up. Box orphans.
//               (5) interface — same; centre orphans.
//               (6) Downstream: GrabResult code goes red+dim;
//                   MotionProfile / ReleaseStyle boxes red; Tests code
//                   goes red and box gets the strikethrough.
//   Initial view shows CubeHandler + interface + 3 impls clearly; the
//   record GrabResult / TransferLoop / CubeHandlerTests sit just below
//   the fold and emerge into view as the cascade trims the top.
// ══════════════════════════════════════════════════════════════════════

// ── Palette ──────────────────────────────────────────────────────────
const ACCENT       = Colors.accent;            // #FF8CA3
const ACCENT_FILL  = 'rgba(255, 140, 163, 0.18)';
const TYPE_CLEAN   = 'rgba(220, 215, 255, 0.85)';
const WARM_CREAM   = 'rgba(244, 230, 200, 0.96)';

// Tree-box style (correctBoundariesSceneRu canon)
const BOX_FILL     = 'rgba(244, 241, 235, 0.16)';
const BOX_STROKE   = 'rgba(244, 241, 235, 0.25)';
const BOX_LABEL    = 'rgba(244, 241, 235, 0.90)';
const LINK_STROKE  = 'rgba(244, 241, 235, 0.22)';

// Cascade (red CODE, not red GLOW)
const BROKEN_RED   = 'rgba(255, 100, 100, 0.95)';
const BROKEN_FILL  = 'rgba(255, 100, 100, 0.18)';
const BROKEN_LINK  = 'rgba(255, 100, 100, 0.78)';
const ORPHAN_DIM   = 'rgba(244, 241, 235, 0.30)';

// ── Code blocks ──────────────────────────────────────────────────────
//   Implementation bodies are taken verbatim from the invasion scene.
//   Reasonable blanks: after class declaration, before `return`.
const CUBE_HANDLER_FULL = `class CubeHandler {

    private final RobotArm arm = new RobotArm();
    private final GrabStrategy grabStrategy = new StandardGrab();

    public void handleCube(Cube cube, Table table) {
        arm.moveTo(cube.position);
        GrabResult result = grabStrategy.grab(cube);
        arm.confirmGrip(result.confidence);
        arm.moveTo(table.position, result.motionProfile);
        arm.release(result.releaseStyle);
    }
}`;

const CUBE_HANDLER_DIRECT = `class CubeHandler {

    private final RobotArm arm = new RobotArm();

    public void handleCube(Cube cube, Table table) {
        arm.moveTo(cube.position);
        arm.grab(cube);
        arm.confirmGrip();
        arm.moveTo(table.position);
        arm.release();
    }
}`;

const INTERFACE_BLOCK = `interface GrabStrategy {
    GrabResult grab(Cube cube);
}`;

const SOFT = `class SoftGrab implements GrabStrategy {

    public GrabResult grab(Cube cube) {
        approachSlowly(cube.position);
        close(Force.LIGHT);
        waitForSensor();
        adjustToFeedback();

        return new GrabResult(GripConfidence.HIGH, MotionProfile.CAUTIOUS, cube.orientation());
    }
}`;

const STANDARD = `class StandardGrab implements GrabStrategy {

    public GrabResult grab(Cube cube) {
        approach(cube.position);
        close(Force.MEDIUM);

        return new GrabResult(GripConfidence.MEDIUM, MotionProfile.LINEAR, Orientation.ANY);
    }
}`;

const FIRM = `class FirmGrab implements GrabStrategy {

    public GrabResult grab(Cube cube) {
        preAlign(cube);
        close(Force.MAXIMUM);
        lockWrist();

        return new GrabResult(GripConfidence.HIGH, MotionProfile.FAST, Orientation.LOCKED);
    }
}`;

const GRAB_RESULT_REC = `record GrabResult(
    GripConfidence confidence,
    MotionProfile motionProfile,
    Orientation orientation
) {}`;

const TRANSFER_LOOP = `class TransferLoop {

    private static final Logger log = LoggerFactory.getLogger(TransferLoop.class);

    private final CubeHandler handler;
    private final Table target;

    public TransferLoop(CubeHandler handler, Table target) {
        this.handler = handler;
        this.target = target;
    }

    public void process(List<Cube> queue) {
        for (Cube cube : queue) {
            try {
                handler.handleCube(cube, target);
            } catch (TransferException e) {
                log.warn("Transfer failed for {}", cube, e);
            }
        }
    }
}`;

const TESTS = `@ExtendWith(MockitoExtension.class)
class CubeHandlerTests {

    @Mock private RobotArm arm;
    @Mock private GrabStrategy strategy;

    @InjectMocks
    private CubeHandler handler;

    @Test
    void runsTheFullSequenceInOrder() {
        Cube cube = new Cube(origin());
        Table table = new Table(destination());
        when(strategy.grab(cube)).thenReturn(
            new GrabResult(GripConfidence.HIGH, MotionProfile.LINEAR, Orientation.ANY)
        );

        handler.handleCube(cube, table);

        InOrder order = inOrder(arm, strategy);
        order.verify(arm).moveTo(cube.position);
        order.verify(strategy).grab(cube);
        order.verify(arm).confirmGrip(GripConfidence.HIGH);
        order.verify(arm).moveTo(table.position, MotionProfile.LINEAR);
        order.verify(arm).release(any(ReleaseStyle.class));
    }

    @Test
    void usesConfidenceFromGrabResult() {
        Cube cube = new Cube(origin());
        when(strategy.grab(cube)).thenReturn(
            new GrabResult(GripConfidence.LOW, MotionProfile.CAUTIOUS, Orientation.LOCKED)
        );

        handler.handleCube(cube, new Table(destination()));

        verify(arm).confirmGrip(GripConfidence.LOW);
    }
}`;

const compose = (parts: string[]): string => parts.join('\n\n');

// Sequence of code states the codebase passes through.
// Records / TransferLoop / Tests stay throughout — they sit below the
// fold initially, and surface as the impl slabs above them die.
const TAIL = [GRAB_RESULT_REC, TRANSFER_LOOP, TESTS];
const S0 = compose([CUBE_HANDLER_FULL,   INTERFACE_BLOCK, SOFT,     STANDARD, FIRM, ...TAIL]);
const S1 = compose([CUBE_HANDLER_DIRECT, INTERFACE_BLOCK, SOFT,     STANDARD, FIRM, ...TAIL]);
const S2 = compose([CUBE_HANDLER_DIRECT, INTERFACE_BLOCK,           STANDARD, FIRM, ...TAIL]);
const S3 = compose([CUBE_HANDLER_DIRECT, INTERFACE_BLOCK,                     FIRM, ...TAIL]);
const S4 = compose([CUBE_HANDLER_DIRECT, INTERFACE_BLOCK,                           ...TAIL]);
const S5 = compose([CUBE_HANDLER_DIRECT,                                            ...TAIL]);

// Types only — methods inherit theme.method (#FF8CA3); `class` and
// other keywords inherit theme.keyword (light blue).
const COLOR_RULES: ColorRule[] = [
  {match: /^Cube$/,             color: TYPE_CLEAN},
  {match: /^Table$/,            color: TYPE_CLEAN},
  {match: /^GrabResult$/,       color: TYPE_CLEAN},
  {match: /^RobotArm$/,         color: TYPE_CLEAN},
  {match: /^GrabStrategy$/,     color: TYPE_CLEAN},
  {match: /^StandardGrab$/,     color: TYPE_CLEAN},
  {match: /^SoftGrab$/,         color: TYPE_CLEAN},
  {match: /^FirmGrab$/,         color: TYPE_CLEAN},
  {match: /^GripConfidence$/,   color: TYPE_CLEAN},
  {match: /^MotionProfile$/,    color: TYPE_CLEAN},
  {match: /^Orientation$/,      color: TYPE_CLEAN},
  {match: /^Force$/,            color: TYPE_CLEAN},
  {match: /^CubeHandler$/,      color: TYPE_CLEAN},
  {match: /^CubeHandlerTests$/, color: TYPE_CLEAN},
  {match: /^TransferLoop$/,     color: TYPE_CLEAN},
  {match: /^List$/,             color: TYPE_CLEAN},
  {match: /^ReleaseStyle$/,     color: TYPE_CLEAN},
  {match: /^Logger$/,           color: TYPE_CLEAN},
  {match: /^LoggerFactory$/,    color: TYPE_CLEAN},
  {match: /^TransferException$/, color: TYPE_CLEAN},
  {match: /^MockitoExtension$/,  color: TYPE_CLEAN},
  {match: /^InOrder$/,           color: TYPE_CLEAN},
  // Concrete-wiring panel
  {match: /^Conveyor$/,            color: TYPE_CLEAN},
  {match: /^MotionController$/,    color: TYPE_CLEAN},
  {match: /^Gripper$/,             color: TYPE_CLEAN},
  {match: /^ForceSensor$/,         color: TYPE_CLEAN},
  {match: /^Position$/,            color: TYPE_CLEAN},
  {match: /^GripFailedException$/, color: TYPE_CLEAN},
];

const RED_ALL_RULES: ColorRule[] = [{match: /./, color: BROKEN_RED}];
const DIM_ALL_RULES: ColorRule[] = [{match: /./, color: ORPHAN_DIM}];

const CUSTOM_TYPES = [
  'Cube', 'Table', 'GrabResult', 'ReleaseStyle', 'RobotArm', 'GrabStrategy',
  'StandardGrab', 'SoftGrab', 'FirmGrab',
  'GripConfidence', 'MotionProfile', 'Orientation', 'Force',
  'CubeHandler', 'CubeHandlerTests', 'TransferLoop', 'List',
  'Logger', 'LoggerFactory', 'TransferException', 'MockitoExtension', 'InOrder',
  // Concrete-wiring panel (Beat 3)
  'Conveyor', 'MotionController', 'Gripper', 'ForceSensor',
  'Position', 'GripFailedException',
];

// ── Geometry ─────────────────────────────────────────────────────────
const FONT_SIZE  = 13;
const LINE_H     = 21;

const ENT_W      = 760;
const ENT_H      = SafeZone.bottom - SafeZone.top - 36;  // 924
const ENT_X_LEFT = -480;
const ENT_Y      = 0;

const NODE_X      = +400;
const NODE_Y      = 0;
const NODE_W      = 240;
const NODE_H      = 80;
const NODE_RADIUS = 14;
const NODE_FS     = 26;

const BOX_W      = 200;
const BOX_H      = 52;
const BOX_RADIUS = 12;
const BOX_FS     = 18;

const LINK_WIDTH = 2;

const ELLIPSE_RX = 340;
const ELLIPSE_RY = 280;
const angleXY = (deg: number): {baseX: number; baseY: number} => {
  const a = (deg * Math.PI) / 180;
  return {
    baseX: Math.round(NODE_X + ELLIPSE_RX * Math.cos(a)),
    baseY: Math.round(ELLIPSE_RY * Math.sin(a)),
  };
};

interface NodeSpec {
  label: string;
  baseX: number;
  baseY: number;
}

const NODES: NodeSpec[] = [
  {label: 'SoftGrab',     ...angleXY(-130)},
  {label: 'StandardGrab', ...angleXY( -90)},
  {label: 'FirmGrab',     ...angleXY( -50)},
  {label: 'GrabResult',    ...angleXY(-22.5)},
  {label: 'MotionProfile', ...angleXY( 22.5)},
  {label: 'Tests',         ...angleXY( +50)},
  {label: 'ReleaseStyle',  ...angleXY( +90)},
  {label: 'TransferCode',  ...angleXY(+130)},
];

const SOFT_IDX     = 0;
const STANDARD_IDX = 1;
const FIRM_IDX     = 2;
const GR_IDX       = 3;
const MP_IDX       = 4;
const TESTS_IDX    = 5;
const RS_IDX       = 6;

const NUDGE_NODE_DX = 22;
const NUDGE_BOX_DX  = 8;

const rectEdgeToward = (
  cx: number, cy: number, w: number, h: number,
  tx: number, ty: number, pad: number,
): [number, number] => {
  const halfW = w / 2 + pad;
  const halfH = h / 2 + pad;
  const dx = tx - cx;
  const dy = ty - cy;
  const eps = 0.001;
  const tX = halfW / Math.max(Math.abs(dx), eps);
  const tY = halfH / Math.max(Math.abs(dy), eps);
  const t = Math.min(tX, tY);
  return [cx + dx * t, cy + dy * t];
};

const CODE_CARD_STYLE = {
  radius: 0,
  fill: 'rgba(0,0,0,0)',
  stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0,
  shadowColor: 'rgba(0,0,0,0)',
  shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
  edge: false,
} as const;

// Removed lines hold red for flashRemovedDuration (visible "becomes red"
// state) and then erase char-by-char via reverseType. Kept tokens never
// touched — no sticky red brackets.
const KILL_MORPH = {
  scrollStrategy: 'auto' as const,
  removeDuration: 0.5,
  moveDuration: 0.95,
  tokenSlideDuration: 0.7,
  flashRemovedColor: BROKEN_RED,
  flashRemovedDuration: 0.5,
  flashRemovedErase: 'reverseType' as const,
  flashRemovedEraseCharDelay: 0.018,
  flashRemovedExcludeTypes: [],
  lineOrder: 'parallel' as const,
};

// ──────────────────────────────────────────────────────────────────────
export default makeScene2D(function* (view) {
  applyBackground(view);

  // ═══ Beat 0a — opening question ══════════════════════════════════
  const questionOp = createSignal(0);
  const questionRef = createRef<Txt>();
  view.add(
    <Txt
      ref={questionRef}
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
  yield* questionOp(1, 0.95, easeOutCubic);
  yield* waitFor(2.4);
  yield* questionOp(0, 0.7, easeInCubic);
  questionRef().remove();
  yield* waitFor(0.2);

  // ═══ Beat 0b — title "Reversibility" ═════════════════════════════
  const titleOp = createSignal(0);
  const titleRef = createRef<Txt>();
  view.add(
    <Txt
      ref={titleRef}
      text={'Reversibility'}
      x={0} y={-30}
      fontFamily={Fonts.primary}
      fontSize={150}
      fontWeight={500}
      letterSpacing={4}
      fill={WARM_CREAM}
      opacity={titleOp}
    />,
  );
  yield* titleOp(1, 0.85, easeOutCubic);
  yield* waitFor(1.6);
  yield* titleOp(0, 0.65, easeInCubic);
  titleRef().remove();
  yield* waitFor(0.2);

  // ─── Code panel created at LEFT directly (no centred phase) ──────
  const topInset = Math.max(8, getCodePaddingY(FONT_SIZE) - 8);
  const code = Manticore.create(S0, {
    x: ENT_X_LEFT, y: ENT_Y,
    width: ENT_W,
    height: ENT_H,
    clipPaddingY: 6,
    fontSize: FONT_SIZE, lineHeight: LINE_H,
    contentOffsetY: topInset,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    customTypes: CUSTOM_TYPES,
  });
  code.mount(view);
  code.colorize(COLOR_RULES);

  // ─── Graph signals ───────────────────────────────────────────────
  const nodeXSig = createSignal(NODE_X);
  const nodeYSig = createSignal(NODE_Y);
  const nodeOpaSig = createSignal(0);
  const nXSigs = NODES.map(n => createSignal(n.baseX));
  const nYSigs = NODES.map(n => createSignal(n.baseY));

  const lineRefs = NODES.map(() => createRef<Line>());
  NODES.forEach((n, i) => {
    view.add(
      <Line
        ref={lineRefs[i]}
        points={() => {
          const cx = nodeXSig();
          const cy = nodeYSig();
          const px = nXSigs[i]();
          const py = nYSigs[i]();
          const start = rectEdgeToward(cx, cy, NODE_W, NODE_H, px, py, 0);
          const end   = rectEdgeToward(px, py, BOX_W, BOX_H, cx, cy, 0);
          return [start, end];
        }}
        stroke={LINK_STROKE}
        lineWidth={LINK_WIDTH}
        radius={4}
        end={0}
        opacity={0}
        shadowColor={'rgba(0, 0, 0, 0.50)'}
        shadowBlur={20}
        shadowOffset={[-6, 10]}
      />,
    );
  });

  const boxRefs = NODES.map(() => createRef<Rect>());
  const labelRefs = NODES.map(() => createRef<Txt>());
  NODES.forEach((n, i) => {
    view.add(
      <Rect
        ref={boxRefs[i]}
        x={nXSigs[i]} y={nYSigs[i]}
        width={BOX_W} height={BOX_H}
        radius={BOX_RADIUS}
        fill={BOX_FILL}
        stroke={BOX_STROKE}
        lineWidth={1.5}
        opacity={0}
        shadowColor={'rgba(0, 0, 0, 0.50)'}
        shadowBlur={44}
        shadowOffset={[-16, 22]}
      >
        <Txt
          ref={labelRefs[i]}
          text={n.label}
          fontFamily={Fonts.code}
          fontSize={BOX_FS}
          fill={BOX_LABEL}
          textAlign={'center'}
        />
      </Rect>,
    );
  });

  const nodeRef = createRef<Rect>();
  const nodeLbl = createRef<Txt>();
  view.add(
    <Rect
      ref={nodeRef}
      x={nodeXSig} y={nodeYSig}
      width={NODE_W} height={NODE_H}
      radius={NODE_RADIUS}
      fill={ACCENT_FILL}
      stroke={ACCENT}
      lineWidth={2}
      opacity={nodeOpaSig}
    >
      <Txt
        ref={nodeLbl}
        text={'GrabStrategy'}
        fontFamily={Fonts.code}
        fontSize={NODE_FS}
        fontWeight={500}
        fill={ACCENT}
        textAlign={'center'}
      />
    </Rect>,
  );

  const strikeRef = createRef<Line>();
  view.add(
    <Line
      ref={strikeRef}
      points={() => {
        const cx = nXSigs[TESTS_IDX]();
        const cy = nYSigs[TESTS_IDX]();
        const halfW = BOX_W / 2 - 14;
        return [[cx - halfW, cy + 1], [cx + halfW, cy + 1]];
      }}
      stroke={BROKEN_RED}
      lineWidth={2.5}
      lineCap={'butt'}
      end={0}
      opacity={0}
    />,
  );

  // ═══ Beat 1 — code + graph appear together ═══════════════════════
  yield* all(
    code.appear(0.95),
    chain(waitFor(0.20), nodeOpaSig(1, 0.55, easeOutCubic)),
    ...NODES.map((_, i) =>
      chain(
        waitFor(0.30 + i * 0.05),
        all(
          boxRefs[i]().opacity(1, 0.32, easeOutCubic),
          chain(
            waitFor(0.08),
            all(
              lineRefs[i]().opacity(1, 0.05),
              lineRefs[i]().end(1, 0.32, easeOutCubic),
            ),
          ),
        ),
      ),
    ),
  );
  yield* waitFor(0.55);

  // ═══ Beat 1d — pull the centre, threads flash red ════════════════
  yield* all(
    nodeXSig(NODE_X + NUDGE_NODE_DX, 0.55, easeInOutCubic),
    ...nXSigs.map((sig, i) => sig(NODES[i].baseX + NUDGE_BOX_DX, 0.55, easeInOutCubic)),
    ...lineRefs.map(ref => chain(
      ref().stroke(BROKEN_LINK, 0.18, easeInOutCubic),
      waitFor(0.12),
      ref().stroke(LINK_STROKE, 0.25, easeInOutCubic),
    )),
  );
  yield* all(
    nodeXSig(NODE_X, 0.5, easeInOutCubic),
    ...nXSigs.map((sig, i) => sig(NODES[i].baseX, 0.5, easeInOutCubic)),
  );
  yield* waitFor(0.45);

  // ═══ Beat 2 — surgical morph, then strategy-by-strategy reflow ═══

  // (1) handleCube body — call site disappears (red hold + reverseType).
  yield* code.morphTo(S1, KILL_MORPH);
  yield* waitFor(0.35);

  function* boxRedFlash(i: number): ThreadGenerator {
    yield* all(
      boxRefs[i]().fill(BROKEN_FILL, 0.32, easeInOutCubic),
      boxRefs[i]().stroke(BROKEN_RED, 0.32, easeInOutCubic),
      labelRefs[i]().fill(BROKEN_RED, 0.32, easeInOutCubic),
      lineRefs[i]().stroke(BROKEN_LINK, 0.32, easeInOutCubic),
    );
  }
  function* boxOrphan(i: number): ThreadGenerator {
    yield* all(
      boxRefs[i]().fill('rgba(0,0,0,0)', 0.4, easeInOutCubic),
      boxRefs[i]().stroke(ORPHAN_DIM, 0.4, easeInOutCubic),
      labelRefs[i]().fill(ORPHAN_DIM, 0.4, easeInOutCubic),
      lineRefs[i]().end(0, 0.4, easeInOutCubic),
      lineRefs[i]().opacity(0, 0.4, easeInOutCubic),
    );
  }
  function* boxStriken(i: number): ThreadGenerator {
    yield* all(
      boxRedFlash(i),
      chain(
        waitFor(0.08),
        all(
          strikeRef().opacity(1, 0.05),
          strikeRef().end(1, 0.32, easeOutCubic),
        ),
      ),
    );
  }

  // killBlock: morph removes the targeted block; deleted tokens hold
  // red for flashRemovedDuration and then erase char-by-char. Kept
  // tokens are never recoloured, so closing braces don't stick red.
  function* killBlock(
    nextCode: string,
    boxIdx: number | null,
  ): ThreadGenerator {
    yield* all(
      code.morphTo(nextCode, KILL_MORPH),
      boxIdx !== null ? boxRedFlash(boxIdx) : waitFor(0),
    );
    if (boxIdx !== null) {
      yield* boxOrphan(boxIdx);
    }
    yield* waitFor(0.18);
  }

  // (2-5) Strategies and interface die top-to-bottom.
  yield* killBlock(S2, SOFT_IDX);
  yield* killBlock(S3, STANDARD_IDX);
  yield* killBlock(S4, FIRM_IDX);
  yield* killBlock(S5, null);
  yield* all(
    nodeRef().fill('rgba(0,0,0,0)', 0.45, easeInOutCubic),
    nodeRef().stroke(ORPHAN_DIM, 0.45, easeInOutCubic),
    nodeLbl().fill(ORPHAN_DIM, 0.45, easeInOutCubic),
  );
  yield* waitFor(0.35);

  // (6) Downstream — scroll DOWN through the surviving codebase so
  //     each affected block is on screen as its state changes.
  //     GrabResult: dim (no users). MotionProfile / ReleaseStyle: box
  //     red. TransferLoop: silent (handleCube signature intact).
  //     Tests: red code + box strike.
  {
    yield* code.scrollTo('record GrabResult', 0.55);
    const grStart = code.findLine('record GrabResult');
    const grEnd   = code.findLine(') {}');
    yield* all(
      code.colorizeAnimated(grStart, grEnd, 0.4, DIM_ALL_RULES),
      boxRedFlash(GR_IDX),
      chain(waitFor(0.20), boxRedFlash(MP_IDX)),
      chain(waitFor(0.40), boxRedFlash(RS_IDX)),
    );
    yield* waitFor(0.45);
  }

  {
    // Anchor at the @ExtendWith annotation, NOT at the `class` line —
    // otherwise the annotation row stays in default colour.
    const tStart = code.findLine('@ExtendWith');
    const tEnd   = code.lineCount - 1;
    yield* all(
      code.colorizeAnimated(tStart, tEnd, 0.45, RED_ALL_RULES),
      boxStriken(TESTS_IDX),
    );
  }

  // Scroll Tests fully into view so the whole red block is visible.
  yield* waitFor(0.5);
  yield* code.scrollTo('@ExtendWith', 0.6);
  yield* waitFor(1.6);

  // Scroll back up to the top of the file before the right-panel reveal.
  yield* code.scrollTo('class CubeHandler', 0.7);
  yield* waitFor(0.3);

  // ═══ Beat 4 — bullet halves: RobotArm (left), CubeHandler (right) ═══
  //   Graph and central node fade out at the SAME TIME as the left
  //   code dims to a ghost backdrop. RobotArm appears on the left,
  //   then CubeHandler — full classes, no chips, no merge gymnastics.
  //   Two pieces of the bullet, side by side, top-aligned. They are
  //   read together; then BOTH disappear; only afterwards the caption.
  const ROBOT_ARM_FULL = `public final class RobotArm {

    private final MotionController motion;
    private final Gripper gripper;
    private final ForceSensor forceSensor;

    public void moveTo(Position position) {
        motion.moveTo(position);
    }

    public void grab(Cube cube) {
        gripper.closeUntilContact();
        forceSensor.waitForStableGrip();
    }

    public void release() {
        gripper.open();
    }
}`;

  const CUBE_HANDLER_RIGHT = `public final class CubeHandler {

    private final RobotArm arm;
    private final Table table;

    public void handleCube(Cube cube) {
        arm.moveTo(cube.position());
        arm.grab(cube);
        arm.confirmGrip();
        arm.moveTo(table.position());
        arm.release();
    }
}`;

  // Both panels share height + contentOffsetY → first lines top-align
  // at the same world Y irrespective of line counts.
  const PANEL_FONT      = 22;
  const PANEL_LINE      = 33;
  const PANEL_W         = 780;
  const PANEL_H         = 660;
  const PANEL_TOP_PAD   = 12;
  const PANEL_X_LEFT    = -360;
  const PANEL_X_RIGHT   = +360;

  const PANEL_OPTS = {
    width: PANEL_W,
    height: PANEL_H,
    contentOffsetY: PANEL_TOP_PAD,
    fontSize: PANEL_FONT,
    lineHeight: PANEL_LINE,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    noClip: true,
    customTypes: CUSTOM_TYPES,
  };

  const panelArm = Manticore.create(ROBOT_ARM_FULL, {
    ...PANEL_OPTS,
    x: PANEL_X_LEFT, y: 0,
  });
  panelArm.mount(view);
  panelArm.node.opacity(0);
  panelArm.colorize(COLOR_RULES);

  const panelHandler = Manticore.create(CUBE_HANDLER_RIGHT, {
    ...PANEL_OPTS,
    x: PANEL_X_RIGHT, y: 0,
  });
  panelHandler.mount(view);
  panelHandler.node.opacity(0);
  panelHandler.colorize(COLOR_RULES);

  // 4a — graph + central node fade out AT THE SAME TIME as the left
  // code dims. One synchronous step.
  yield* all(
    nodeOpaSig(0, 0.65, easeInCubic),
    ...boxRefs.map(r => r().opacity(0, 0.65, easeInCubic)),
    ...lineRefs.map(r => r().opacity(0, 0.65, easeInCubic)),
    strikeRef().opacity(0, 0.65, easeInCubic),
    code.node.opacity(0.16, 0.65, easeInOutCubic),
  );

  // 4b — RobotArm appears on the LEFT. Read time.
  yield* panelArm.node.opacity(1, 0.85, easeOutCubic);
  yield* waitFor(2.0);

  // 4c — CubeHandler appears on the RIGHT. Read time for the pair.
  yield* panelHandler.node.opacity(1, 0.85, easeOutCubic);
  yield* waitFor(3.2);

  // 4d — both panels disappear. ONLY AFTER they are gone the caption
  // shows up (Beat 5 below).
  yield* all(
    panelArm.node.opacity(0, 0.7, easeInCubic),
    panelHandler.node.opacity(0, 0.7, easeInCubic),
    code.node.opacity(0, 0.7, easeInCubic),
  );
  yield* waitFor(0.35);

  // ═══ Beat 5 — explanation card: tracer bullet ═══════════════════
  const trTitleOp = createSignal(0);
  const trSubOp   = createSignal(0);
  const trTitleRef = createRef<Txt>();
  const trSubRef   = createRef<Txt>();
  view.add(
    <Txt
      ref={trTitleRef}
      text={'Tracer bullet'}
      x={0} y={-44}
      fontFamily={Fonts.primary}
      fontSize={104}
      fontWeight={500}
      letterSpacing={3}
      fill={WARM_CREAM}
      opacity={trTitleOp}
    />,
  );
  view.add(
    <Txt
      ref={trSubRef}
      text={'A thin end-to-end slice of real code that proves the path.'}
      x={0} y={50}
      fontFamily={Fonts.primary}
      fontSize={34}
      fontWeight={400}
      letterSpacing={1}
      fill={'rgba(244, 230, 200, 0.65)'}
      opacity={trSubOp}
    />,
  );

  yield* trTitleOp(1, 0.8, easeOutCubic);
  yield* trSubOp(1, 0.6, easeOutCubic);
  yield* waitFor(2.4);
});
