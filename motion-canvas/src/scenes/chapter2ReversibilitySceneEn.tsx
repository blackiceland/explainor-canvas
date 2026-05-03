import {Line, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  all, chain, createRef, createSignal,
  easeInOutCubic, easeOutCubic, ThreadGenerator, waitFor,
} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Colors, Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

// ══════════════════════════════════════════════════════════════════════
// Chapter 2 — Beats 1 + 2
//
//   Beat 1 ("here is the centre we baked our guess into"):
//     - CubeHandler centred → slides left at full size.
//     - GrabStrategy materialises as a typographic anchor (accent).
//     - 8 mirror-symmetric peripheries on a single ellipse appear by
//       cardinal-sector chords. Connector thickness encodes weight.
//     - Mechanical-attachment chord: centre nudges, peripheries drag
//       slightly along — proves the graph is rigid.
//
//   Beat 2 ("here is what happens when we try to extract it"):
//     - One surgical edit in the code — the grabStrategy.grab(cube)
//       chain collapses to direct arm.grab/.confirmGrip/.moveTo/.release
//       calls. The GrabStrategy field disappears entirely.
//     - As the morph plays, the right-half graph FAILS in cascade:
//         GrabResult (and its fields MotionProfile / ReleaseStyle)
//             flash red, lines snap (end → 0)
//         SoftGrab / StandardGrab / FirmGrab orphaned: lines fade
//             grey, labels dim
//         TransferCode flickers — broken downstream
//         Tests light up red, slight scale pulse — failure beacon
//         GrabStrategy centre fades to a ghost
//     - The new code is "clean" but the graph is in ruins. Drama is
//       the rollback ATTEMPT, not a static schema.
// ══════════════════════════════════════════════════════════════════════

// ── Palette ──────────────────────────────────────────────────────────
const ACCENT      = Colors.accent;            // #FF8CA3
const ACCENT_GLOW = 'rgba(255, 140, 163, 0.40)';
const TYPE_CLEAN  = 'rgba(220, 215, 255, 0.85)';
const VAR_LIGHT   = 'rgba(244, 241, 235, 0.96)';

const LABEL_FILL  = 'rgba(244, 241, 235, 0.92)';
const LINK_STROKE = 'rgba(244, 241, 235, 0.30)';

// Beat 2 — failure cascade.
const BROKEN_RED  = 'rgba(255, 100, 100, 0.95)';
const BROKEN_LINK = 'rgba(255, 100, 100, 0.85)';
const ORPHAN_DIM  = 'rgba(244, 241, 235, 0.32)';
const TEST_FAIL   = 'rgba(255, 80, 80, 1.00)';

// ── Code state ───────────────────────────────────────────────────────
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

// Attempted simple rollback — strategy field gone, calls go straight
// to arm. Looks innocent; the right-side graph will say otherwise.
const DIRECT = `class CubeHandler {

    private final RobotArm arm = new RobotArm();

    public void handleCube(Cube cube, Table table) {
        arm.moveTo(cube.position);
        arm.grab(cube);
        arm.confirmGrip();
        arm.moveTo(table.position);
        arm.release();
    }
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
  {match: /^Cube$/,         color: TYPE_CLEAN},
  {match: /^Table$/,        color: TYPE_CLEAN},
  {match: /^GrabResult$/,   color: TYPE_CLEAN},
  {match: /^RobotArm$/,     color: TYPE_CLEAN},
  {match: /^GrabStrategy$/, color: TYPE_CLEAN},
  {match: /^StandardGrab$/, color: TYPE_CLEAN},
  {match: 'moveTo',         color: ACCENT, onlyTypes: ['method']},
  {match: 'grab',           color: ACCENT, onlyTypes: ['method']},
  {match: 'confirmGrip',    color: ACCENT, onlyTypes: ['method']},
  {match: 'release',        color: ACCENT, onlyTypes: ['method']},
];

const CUSTOM_TYPES = [
  'Cube', 'Table', 'GrabResult', 'RobotArm', 'GrabStrategy', 'StandardGrab',
];

// ── Geometry ─────────────────────────────────────────────────────────
const FONT_SIZE = 22;
const LINE_H    = Math.round(FONT_SIZE * 1.62 * 10) / 10;

const ENT_W      = 760;
const ENT_X_CTR  = 0;
const ENT_X_LEFT = -540;
const ENT_Y      = 30;

// Central typographic anchor — only accented role on screen.
// Pushed left of centre so right cluster has room to breathe.
const NODE_X       = +300;
const NODE_Y       = 0;
const NODE_FS      = 60;
const NODE_LABEL   = 'GrabStrategy';

// Periphery labels — readable on mobile, sized so the longest
// (MotionProfile) still fits inside SafeZone.right.
const LABEL_FS     = 26;

interface NodeSpec {
  label:     string;
  baseX:     number;
  baseY:     number;
  lineWidth: number;     // weight of dependency
}

// Eight nodes sit on a single ellipse around the centre, mirror-
// symmetric about the x-axis. Pairs:
//   SoftGrab     ↔ TransferCode    (upper-left  ↔ lower-left)
//   StandardGrab ↔ ReleaseStyle    (top-centre  ↔ bottom-centre)
//   FirmGrab     ↔ Tests           (upper-right ↔ lower-right)
//   GrabResult   ↔ MotionProfile   (right-up    ↔ right-down)
const ELLIPSE_RX = 420;
const ELLIPSE_RY = 350;
const angleXY = (angleDeg: number): {baseX: number; baseY: number} => {
  const a = (angleDeg * Math.PI) / 180;
  return {
    baseX: Math.round(NODE_X + ELLIPSE_RX * Math.cos(a)),
    baseY: Math.round(ELLIPSE_RY * Math.sin(a)),
  };
};

const NODES: NodeSpec[] = [
  // TOP semicircle — implementations
  {label: 'SoftGrab',     ...angleXY(-130),  lineWidth: 1.8},
  {label: 'StandardGrab', ...angleXY( -90),  lineWidth: 2.2},
  {label: 'FirmGrab',     ...angleXY( -50),  lineWidth: 1.8},

  // RIGHT — downstream data
  {label: 'GrabResult',    ...angleXY(-22.5), lineWidth: 3.5},
  {label: 'MotionProfile', ...angleXY( 22.5), lineWidth: 2.6},

  // BOTTOM semicircle — mirror of TOP
  {label: 'Tests',         ...angleXY( +50), lineWidth: 1.6},
  {label: 'ReleaseStyle',  ...angleXY( +90), lineWidth: 2.2},
  {label: 'TransferCode',  ...angleXY(+130), lineWidth: 3.5},
];

// Mechanical attachment.
const NUDGE_NODE_DX  = 24;
const NUDGE_BLOCK_DX =  9;

// ── Helpers ──────────────────────────────────────────────────────────
// Approx mono-font character width.
const charW = (fs: number) => fs * 0.6;

// Where the line should LEAVE the centre anchor — natural ray-bbox
// exit so different angles produce different start points (lines
// fan out instead of all sharing one hub).
const labelEdgeToward = (
  cx: number, cy: number, label: string, fs: number,
  tx: number, ty: number,
  pad: number,
): [number, number] => {
  const halfW = (label.length * charW(fs)) / 2 + pad;
  const halfH = (fs * 1.2) / 2 + pad;
  const dx = tx - cx;
  const dy = ty - cy;
  const eps = 0.001;
  const tX = halfW / Math.max(Math.abs(dx), eps);
  const tY = halfH / Math.max(Math.abs(dy), eps);
  const t = Math.min(tX, tY);
  return [cx + dx * t, cy + dy * t];
};

// Where the line should ARRIVE at a periphery label — clamped to
// the actual glyph's facing edge so the line meets the text instead
// of dying in the corner-region of a bbox.
const approachLabel = (
  cx: number, cy: number, label: string, fs: number,
  tx: number, ty: number,
  pad: number,
): [number, number] => {
  const halfW = (label.length * charW(fs)) / 2;
  const halfH = (fs * 1.2) / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  const eps = 0.001;
  // Choose facing edge by direction dominance (relative to glyph
  // aspect ratio).
  if (Math.abs(dx) * halfH > Math.abs(dy) * halfW) {
    // Horizontal entry — left or right edge.
    const sign = Math.sign(dx) || 1;
    const edgeX = cx + sign * (halfW + pad);
    const t = (halfW + pad) / Math.max(Math.abs(dx), eps);
    const yAtEdge = cy + dy * t;
    const yClamp = Math.min(cy + halfH, Math.max(cy - halfH, yAtEdge));
    return [edgeX, yClamp];
  } else {
    // Vertical entry — top or bottom edge.
    const sign = Math.sign(dy) || 1;
    const edgeY = cy + sign * (halfH + pad);
    const t = (halfH + pad) / Math.max(Math.abs(dy), eps);
    const xAtEdge = cx + dx * t;
    const xClamp = Math.min(cx + halfW, Math.max(cx - halfW, xAtEdge));
    return [xClamp, edgeY];
  }
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

// ──────────────────────────────────────────────────────────────────────
export default makeScene2D(function* (view) {
  applyBackground(view);

  // ─── Panel A: ENTANGLED (centered, slides left at full size) ─────
  const entangled = Manticore.create(ENTANGLED, {
    x: ENT_X_CTR, y: ENT_Y,
    width: ENT_W,
    height: 0,
    fontSize: FONT_SIZE, lineHeight: LINE_H,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    noClip: true,
    customTypes: CUSTOM_TYPES,
  });
  entangled.mount(view);
  entangled.colorize(COLOR_RULES);

  // ─── Right-half: position signals so connectors react reactively ─
  const nodeXSig    = createSignal(NODE_X);
  const nodeYSig    = createSignal(NODE_Y);
  const nodeOpaSig  = createSignal(0);
  const nodeScaleSig = createSignal(0.92);
  const nXSigs = NODES.map(n => createSignal(n.baseX));
  const nYSigs = NODES.map(n => createSignal(n.baseY));

  // Connector lines — endpoints clamped to invisible label bboxes so
  // no line crosses through any glyph. Mounted before labels.
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
          const start = labelEdgeToward(cx, cy, NODE_LABEL, NODE_FS, px, py, 18);
          const end   = approachLabel(px, py, n.label, LABEL_FS, cx, cy, 8);
          return [start, end];
        }}
        stroke={LINK_STROKE}
        lineWidth={n.lineWidth}
        lineCap={'round'}
        end={0}
        opacity={0}
      />,
    );
  });

  // Periphery — bare typography, no containers.
  const labelRefs = NODES.map(() => createRef<Txt>());
  NODES.forEach((n, i) => {
    view.add(
      <Txt
        ref={labelRefs[i]}
        x={nXSigs[i]} y={nYSigs[i]}
        text={n.label}
        fontFamily={Fonts.code}
        fontSize={LABEL_FS}
        fill={LABEL_FILL}
        opacity={0}
      />,
    );
  });

  // Central anchor — the only accented role.
  const nodeRef = createRef<Txt>();
  view.add(
    <Txt
      ref={nodeRef}
      x={nodeXSig} y={nodeYSig}
      scale={nodeScaleSig}
      text={NODE_LABEL}
      fontFamily={Fonts.code}
      fontSize={NODE_FS}
      fontWeight={600}
      fill={ACCENT}
      opacity={nodeOpaSig}
    />,
  );

  // ═══ Beat 1a — code centered, alone ══════════════════════════════
  yield* entangled.appear(Timing.slow);
  yield* waitFor(1.4);

  // ═══ Beat 1b — slide left + central anchor materialises ══════════
  yield* all(
    entangled.node.x(ENT_X_LEFT, 0.7, easeInOutCubic),
    chain(
      waitFor(0.25),
      all(
        nodeOpaSig(1, 0.45, easeOutCubic),
        nodeScaleSig(1, 0.55, easeOutCubic),
      ),
    ),
  );
  yield* waitFor(0.15);

  // ═══ Beat 1c — periphery snaps in by group, fast chord stagger ═══
  // 4 cardinal groups, each its own chord; total ≈ 1.4s.
  function* revealGroup(indices: number[]): Generator {
    yield* all(
      ...indices.map(i =>
        all(
          labelRefs[i]().opacity(1, 0.28, easeOutCubic),
          chain(
            waitFor(0.06),
            all(
              // Make the line visible only at draw-time so its end-cap
              // does not show as a dot before the line grows.
              lineRefs[i]().opacity(1, 0.05),
              lineRefs[i]().end(1, 0.32, easeOutCubic),
            ),
          ),
        ),
      ),
    );
  }

  yield* revealGroup([0, 1, 2]);          // top — implementations
  yield* waitFor(0.10);
  yield* revealGroup([3, 4]);             // right — downstream data
  yield* waitFor(0.10);
  yield* revealGroup([5, 6, 7]);          // bottom — Tests / Release / Transfer
  yield* waitFor(0.45);

  // ═══ Beat 1d — mechanical attachment chord ═══════════════════════
  // Center moves a clear delta; every periphery follows by a smaller
  // delta. Connector lines react reactively from the position signals.
  yield* all(
    nodeXSig(NODE_X + NUDGE_NODE_DX, 0.55, easeInOutCubic),
    ...nXSigs.map((sig, i) =>
      sig(NODES[i].baseX + NUDGE_BLOCK_DX, 0.55, easeInOutCubic),
    ),
  );
  yield* all(
    nodeXSig(NODE_X, 0.5, easeInOutCubic),
    ...nXSigs.map((sig, i) =>
      sig(NODES[i].baseX, 0.5, easeInOutCubic),
    ),
  );

  yield* waitFor(0.7);

  // ═══ Beat 2 — surgical edit + cascade ════════════════════════════
  // Brief beat-trigger: the call-line glows pink; the centre echoes.
  const grabIdx = entangled.findLine('grabStrategy.grab(cube)');
  const grabLine = entangled.getLine(grabIdx);
  yield* all(
    grabLine
      ? grabLine.setTokensGlow(['grabStrategy', 'grab'], 14, ACCENT_GLOW, 0.35)
      : waitFor(0.35),
    nodeRef().scale(1.04, 0.35, easeOutCubic),
  );
  yield* nodeRef().scale(1, 0.35, easeInOutCubic);
  yield* waitFor(0.25);

  // Indices in NODES (after the symmetric layout):
  //   0 SoftGrab  1 StandardGrab  2 FirmGrab
  //   3 GrabResult  4 MotionProfile
  //   5 Tests  6 ReleaseStyle  7 TransferCode
  const IDX_DIRECT_DEPS = [3, 4, 6];   // GrabResult, MotionProfile, ReleaseStyle
  const IDX_IMPLS       = [0, 1, 2];   // SoftGrab, StandardGrab, FirmGrab
  const IDX_TRANSFER    = 7;
  const IDX_TESTS       = 5;

  function* killDep(i: number, delay: number): ThreadGenerator {
    yield* chain(
      waitFor(delay),
      all(
        lineRefs[i]().stroke(BROKEN_LINK, 0.18, easeOutCubic),
        labelRefs[i]().fill(BROKEN_RED, 0.35, easeInOutCubic),
      ),
      waitFor(0.12),
      all(
        lineRefs[i]().end(0, 0.4, easeInOutCubic),
        labelRefs[i]().opacity(0.55, 0.5, easeInOutCubic),
      ),
    );
  }
  function* orphan(i: number, delay: number): ThreadGenerator {
    yield* chain(
      waitFor(delay),
      all(
        labelRefs[i]().fill(ORPHAN_DIM, 0.5, easeInOutCubic),
        labelRefs[i]().opacity(0.45, 0.5, easeInOutCubic),
        lineRefs[i]().end(0, 0.55, easeInOutCubic),
      ),
    );
  }
  function* flickerBroken(i: number, delay: number): ThreadGenerator {
    yield* chain(
      waitFor(delay),
      labelRefs[i]().fill(BROKEN_RED, 0.1, easeOutCubic),
      labelRefs[i]().opacity(0.25, 0.07),
      labelRefs[i]().opacity(1.0, 0.07),
      labelRefs[i]().opacity(0.25, 0.07),
      labelRefs[i]().opacity(1.0, 0.07),
      labelRefs[i]().opacity(0.4, 0.18),
      lineRefs[i]().stroke(BROKEN_LINK, 0.2, easeInOutCubic),
    );
  }
  function* failTests(i: number, delay: number): ThreadGenerator {
    yield* chain(
      waitFor(delay),
      all(
        labelRefs[i]().fill(TEST_FAIL, 0.22, easeOutCubic),
        lineRefs[i]().stroke(BROKEN_LINK, 0.22, easeOutCubic),
        labelRefs[i]().scale(1.18, 0.22, easeOutCubic),
      ),
      labelRefs[i]().scale(1.0, 0.35, easeInOutCubic),
    );
  }

  // Surgical morph on the code; cascade plays in parallel.
  // Removed tokens flash red and reverse-type out.
  const morph = entangled.morphTo(DIRECT, {
    addStyle: 'fade',
    moveDuration: 0.7,
    removeDuration: 0.55,
    flashRemovedColor: BROKEN_RED,
    flashRemovedDuration: 0.05,
    flashRemovedErase: 'reverseType',
    flashRemovedEraseCharDelay: 0.012,
    flashRemovedExcludeTypes: [],
    lineOrder: 'parallel',
    scrollStrategy: 'auto',
  });

  yield* all(
    morph,
    // Centre fades to a ghost — strategy is being yanked.
    chain(waitFor(0.15), nodeOpaSig(0.22, 0.7, easeInOutCubic)),
    // Direct deps die first, in dependency order.
    killDep(IDX_DIRECT_DEPS[0], 0.05),  // GrabResult
    killDep(IDX_DIRECT_DEPS[1], 0.18),  // MotionProfile
    killDep(IDX_DIRECT_DEPS[2], 0.28),  // ReleaseStyle
    // Implementations orphan (greyed out, lines fade silently).
    orphan(IDX_IMPLS[0], 0.40),
    orphan(IDX_IMPLS[1], 0.46),
    orphan(IDX_IMPLS[2], 0.52),
    // Transfer code blinks broken.
    flickerBroken(IDX_TRANSFER, 0.32),
    // Tests light up — failure beacon.
    failTests(IDX_TESTS, 0.55),
  );

  // Hold the broken state — viewer sees: clean code, ruined system.
  yield* waitFor(2.5);
});
