import {Line, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  all, chain, createRef, createSignal,
  easeInCubic, easeInOutCubic, easeOutCubic, waitFor,
} from '@motion-canvas/core';
import {Manticore, ColorRule} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// ══════════════════════════════════════════════════════════════════════
// Chapter 2 · open
//   Beat 1 — question alone in centre, then fades. Chapter-1 code (the
//            already-shipped GrabStrategy form) appears alone.
//   Beat 2 — same code, three overlay modes that share one visual language:
//            requirements as chips, arrows of pressure, a local frame.
//              2a "need now"      → one chip lands on the class.
//              2b "strong signal" → four chips converge into transfer block.
//              2c "noisy future"  → chips scatter, arrows diverge.
//   Beat 3 — signal climax. Chips briefly aim at grab, miss, converge into
//            the transfer block, frame "handling" lights up, a small
//            HandlingProfile seam emerges from inside the frame. A surface
//            cost counter ticks in the corner.
// ══════════════════════════════════════════════════════════════════════

// ── Palette ──────────────────────────────────────────────────────────
const WARM_CREAM   = 'rgba(244, 230, 200, 0.96)';
const TEXT_BRIGHT  = 'rgba(244, 241, 235, 0.96)';
const TEXT_TAG     = 'rgba(244, 241, 235, 0.78)';
const TEXT_MUTED   = 'rgba(244, 241, 235, 0.55)';
const TEXT_DIM     = 'rgba(244, 241, 235, 0.32)';
const TYPE_CLEAN   = 'rgba(220, 215, 255, 0.85)';
const VAR_LIGHT    = 'rgba(244, 241, 235, 0.96)';
const KW_COLOR     = DryFiltersV3CodeTheme.keyword;
const METHOD_COLOR = DryFiltersV3CodeTheme.method;

const CHIP_FILL    = 'rgba(244, 241, 235, 0.04)';
const CHIP_STROKE  = 'rgba(244, 241, 235, 0.45)';
const CHIP_TEXT    = 'rgba(244, 241, 235, 0.92)';

const SIGNAL_LINE  = 'rgba(120, 220, 255, 0.85)';   // converging signal
const NOISE_LINE   = 'rgba(255, 158, 100, 0.55)';   // diverging noise
const OK_FRAME     = 'rgba(120, 220, 255, 0.95)';
const SEAM_STROKE  = 'rgba(120, 220, 255, 0.85)';
const ACCENT_RED   = 'rgba(255, 100, 100, 0.85)';

// ── Code ─────────────────────────────────────────────────────────────
const CODE = `class CubeHandler {

    private final RobotArm arm = new RobotArm();
    private final GrabStrategy grabStrategy = new StandardGrab();

    public void handleCube(Cube cube, Table table) {
        arm.moveTo(cube.position);
        grabStrategy.grab(cube);

        arm.lift();
        arm.moveTo(table.position);
        arm.release();
    }
}`;

const CODE_LINES = CODE.split('\n').length; // 13

const COLOR_RULES: ColorRule[] = [
  {match: 'handleCube',   color: VAR_LIGHT},
  {match: 'arm',          color: VAR_LIGHT},
  {match: 'cube',         color: VAR_LIGHT},
  {match: 'table',        color: VAR_LIGHT},
  {match: 'position',     color: VAR_LIGHT},
  {match: 'grabStrategy', color: VAR_LIGHT},
  {match: /^Cube$/,                  color: TYPE_CLEAN},
  {match: /^Table$/,                 color: TYPE_CLEAN},
  {match: /^RobotArm$/,              color: TYPE_CLEAN},
  {match: /^GrabStrategy$/,          color: TYPE_CLEAN},
  {match: /^StandardGrab$/,          color: TYPE_CLEAN},
  {match: 'moveTo',  color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'grab',    color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'lift',    color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'release', color: METHOD_COLOR, onlyTypes: ['method']},
];

const CUSTOM_TYPES = ['Cube', 'Table', 'RobotArm', 'GrabStrategy', 'StandardGrab'];

// ── Geometry ─────────────────────────────────────────────────────────
const FONT_SIZE = 24;
const LINE_H    = Math.round(FONT_SIZE * 1.62 * 10) / 10;  // 38.9
const PANEL_W   = 940;
const PANEL_X   = 0;

// Manticore ships content with a vertical offset (~250px on top of the
// math derived from cfg.y — see refactoring.md). PANEL_Y is tuned by eye:
// content bottom lands ~+260, leaving room below for chip rows / labels.
const PANEL_Y = 30;

// Approximate world-y of each code line for arrow targeting. Calibrated
// after a render: with PANEL_Y=30 and lineHeight=38.9 the first line
// sits roughly at -200, lines step ~+38.9 from there.
const lineWorldY = (i: number) => -200 + i * 38.9;

// Lines that matter visually:
const Y_GRAB     = lineWorldY(7);   // grabStrategy.grab(cube);
const Y_LIFT     = lineWorldY(9);   // arm.lift();
const Y_MOVE2    = lineWorldY(10);  // arm.moveTo(table.position);
const Y_RELEASE  = lineWorldY(11);  // arm.release();
const Y_TRANSFER_TOP    = Y_LIFT - 20;
const Y_TRANSFER_BOTTOM = Y_RELEASE + 20;
const Y_TRANSFER_CENTER = (Y_LIFT + Y_RELEASE) / 2;

const CARD_STYLE = {
  radius: 0, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0, shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
  shadowOffsetX: 0, shadowOffsetY: 0, edge: false,
} as const;

// ── Chip primitive ───────────────────────────────────────────────────
interface ChipHandle {
  rect: Rect;
  rectRef: ReturnType<typeof createRef<Rect>>;
  txtRef: ReturnType<typeof createRef<Txt>>;
  width: number;
  height: number;
}

function makeChip(text: string, x: number, y: number): ChipHandle {
  const rectRef = createRef<Rect>();
  const txtRef  = createRef<Txt>();
  const padX = 28, padY = 12;
  // Approximate width — Motion Canvas Rect can auto-size with `layout`.
  const approxCharW = 13;
  const w = text.length * approxCharW + padX * 2;
  const h = 50;
  const rect = (
    <Rect
      ref={rectRef}
      x={x} y={y}
      width={w} height={h}
      radius={26}
      fill={CHIP_FILL}
      stroke={CHIP_STROKE}
      lineWidth={1.6}
      opacity={0}
    >
      <Txt
        ref={txtRef}
        text={text}
        fontFamily={Fonts.primary}
        fontSize={22}
        fontWeight={500}
        letterSpacing={0.4}
        fill={CHIP_TEXT}
      />
    </Rect>
  ) as unknown as Rect;
  return {rect, rectRef, txtRef, width: w, height: h};
}

// ── Arrow primitive ──────────────────────────────────────────────────
function makeArrow(
  from: [number, number],
  to: [number, number],
  color: string,
) {
  const ref = createRef<Line>();
  const node = (
    <Line
      ref={ref}
      points={[from, to]}
      stroke={color}
      lineWidth={1.8}
      endArrow
      arrowSize={9}
      end={0}
      opacity={0.85}
    />
  ) as unknown as Line;
  return {node, ref};
}

// ── Cost counter ─────────────────────────────────────────────────────
function makeCounter(x: number, y: number) {
  const opSig = createSignal(0);
  const filesSig    = createSignal(1);
  const conceptsSig = createSignal(2);
  const placesSig   = createSignal(1);

  const node = (
    <Rect
      x={x} y={y}
      width={260} height={140}
      radius={12}
      fill={'rgba(0,0,0,0.0)'}
      stroke={'rgba(244, 241, 235, 0.18)'}
      lineWidth={1}
      opacity={opSig}
      layout
      direction={'column'}
      padding={16}
      gap={6}
    >
      <Txt
        text={'surface cost'}
        fontFamily={Fonts.primary}
        fontSize={14}
        fontWeight={600}
        letterSpacing={4}
        fill={TEXT_TAG}
      />
      <Txt
        text={() => `files       ${filesSig().toFixed(0)}`}
        fontFamily={Fonts.code}
        fontSize={18}
        fill={TEXT_MUTED}
      />
      <Txt
        text={() => `concepts    ${conceptsSig().toFixed(0)}`}
        fontFamily={Fonts.code}
        fontSize={18}
        fill={TEXT_MUTED}
      />
      <Txt
        text={() => `call-sites  ${placesSig().toFixed(0)}`}
        fontFamily={Fonts.code}
        fontSize={18}
        fill={TEXT_MUTED}
      />
    </Rect>
  ) as unknown as Rect;

  return {node, opSig, filesSig, conceptsSig, placesSig};
}

// ──────────────────────────────────────────────────────────────────────
export default makeScene2D(function* (view) {
  applyBackground(view);

  // ─── Beat 1 — question alone, then code ──────────────────────────
  const questionOp = createSignal(0);
  view.add(
    <Txt
      text={'How do you tell preparation from fantasy?'}
      x={0} y={0}
      fontFamily={Fonts.primary}
      fontSize={50}
      fontWeight={400}
      letterSpacing={0.4}
      fill={WARM_CREAM}
      opacity={questionOp}
    />,
  );

  yield* questionOp(1, 1.0, easeInOutCubic);
  yield* waitFor(2.4);
  yield* questionOp(0, 0.7, easeInCubic);
  yield* waitFor(0.5);

  const code = Manticore.create(CODE, {
    x: PANEL_X, y: PANEL_Y,
    width: PANEL_W,
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
  code.mount(view);
  code.colorize(COLOR_RULES);
  yield* code.appear(1.1);
  yield* waitFor(1.5);

  // ─── Beat 2a — need now ───────────────────────────────────────────
  const needNow = makeChip('different cube types · today', -360, -340);
  view.add(needNow.rect);

  const arrowNeedNow = makeArrow(
    [-160, -310],
    [-200, lineWorldY(0) + 8],
    SIGNAL_LINE,
  );
  view.add(arrowNeedNow.node);

  const labelNeedNow = createRef<Txt>();
  const labelNeedNowOp = createSignal(0);
  view.add(
    <Txt
      ref={labelNeedNow}
      text={'need now  →  build'}
      x={0} y={350}
      fontFamily={Fonts.primary}
      fontSize={28}
      fontWeight={500}
      letterSpacing={2}
      fill={TEXT_BRIGHT}
      opacity={labelNeedNowOp}
    />,
  );

  yield* needNow.rectRef().opacity(1, 0.5, easeOutCubic);
  yield* waitFor(0.2);
  yield* arrowNeedNow.ref().end(1, 0.55, easeInOutCubic);
  yield* waitFor(0.15);
  yield* labelNeedNowOp(1, 0.6, easeOutCubic);
  yield* waitFor(2.4);

  yield* all(
    needNow.rectRef().opacity(0, 0.45, easeInOutCubic),
    arrowNeedNow.ref().opacity(0, 0.45, easeInOutCubic),
    labelNeedNowOp(0, 0.45, easeInOutCubic),
  );
  yield* waitFor(0.3);

  // ─── Beat 2b — strong signal ──────────────────────────────────────
  const sigChips = [
    makeChip('fragile parts',     -640, -260),
    makeChip('heavy parts',       -640,  -90),
    makeChip('no sudden movement', 640, -260),
    makeChip('soft release',       640,  -90),
  ];
  for (const c of sigChips) view.add(c.rect);

  // Frame around the transfer block (lift / moveTo / release)
  const frameRef = createRef<Rect>();
  const frameOp = createSignal(0);
  const frameW = 700;
  const frameH = (Y_TRANSFER_BOTTOM - Y_TRANSFER_TOP) + 12;
  view.add(
    <Rect
      ref={frameRef}
      x={PANEL_X - 60} y={(Y_TRANSFER_TOP + Y_TRANSFER_BOTTOM) / 2}
      width={frameW} height={frameH}
      radius={8}
      fill={'rgba(0,0,0,0)'}
      stroke={OK_FRAME}
      lineWidth={2}
      opacity={frameOp}
    />,
  );

  // Arrows from each chip → converge into transfer block
  const sigArrows = [
    makeArrow([-450, -240], [-200, Y_TRANSFER_CENTER], SIGNAL_LINE),
    makeArrow([-470,  -70], [-200, Y_TRANSFER_CENTER], SIGNAL_LINE),
    makeArrow([ 460, -240], [ 200, Y_TRANSFER_CENTER], SIGNAL_LINE),
    makeArrow([ 480,  -70], [ 200, Y_TRANSFER_CENTER], SIGNAL_LINE),
  ];
  for (const a of sigArrows) view.add(a.node);

  const labelStrong = createRef<Txt>();
  const labelStrongOp = createSignal(0);
  view.add(
    <Txt
      ref={labelStrong}
      text={'strong signal  →  prepare'}
      x={0} y={350}
      fontFamily={Fonts.primary}
      fontSize={28}
      fontWeight={500}
      letterSpacing={2}
      fill={TEXT_BRIGHT}
      opacity={labelStrongOp}
    />,
  );

  yield* all(
    ...sigChips.map((c, i) => chain(waitFor(i * 0.18), c.rectRef().opacity(1, 0.4, easeOutCubic))),
  );
  yield* waitFor(0.2);
  yield* all(
    ...sigArrows.map((a, i) => chain(waitFor(i * 0.06), a.ref().end(1, 0.55, easeInOutCubic))),
  );
  yield* waitFor(0.15);
  yield* frameOp(1, 0.5, easeOutCubic);
  yield* waitFor(0.2);
  yield* labelStrongOp(1, 0.6, easeOutCubic);
  yield* waitFor(2.6);

  yield* all(
    ...sigChips.map(c => c.rectRef().opacity(0, 0.45, easeInOutCubic)),
    ...sigArrows.map(a => a.ref().opacity(0, 0.45, easeInOutCubic)),
    frameOp(0, 0.45, easeInOutCubic),
    labelStrongOp(0, 0.45, easeInOutCubic),
  );
  yield* waitFor(0.3);

  // ─── Beat 2c — noisy future ──────────────────────────────────────
  const noiseChips = [
    makeChip('what if streaming?',    -660, -310),
    makeChip('plugin support someday', 640, -310),
    makeChip('multi-tenant maybe',    -560,  300),
    makeChip('rule engine?',           560,  300),
  ];
  for (const c of noiseChips) view.add(c.rect);

  // Diverging arrows — each chip points somewhere different and weakly
  const noiseArrows = [
    makeArrow([-450, -290], [-180, Y_GRAB + 8], NOISE_LINE),       // at grab
    makeArrow([ 450, -290], [-220, lineWorldY(3) + 8], NOISE_LINE),// at GrabStrategy field
    makeArrow([-380,  280], [ 920,  280], NOISE_LINE),              // off to imagined system right
    makeArrow([ 380,  280], [-920,  280], NOISE_LINE),              // off to imagined system left
  ];
  for (const a of noiseArrows) view.add(a.node);

  const labelNoise = createRef<Txt>();
  const labelNoiseOp = createSignal(0);
  view.add(
    <Txt
      ref={labelNoise}
      text={'noisy future  →  stay reversible'}
      x={0} y={420}
      fontFamily={Fonts.primary}
      fontSize={28}
      fontWeight={500}
      letterSpacing={2}
      fill={TEXT_BRIGHT}
      opacity={labelNoiseOp}
    />,
  );

  yield* all(
    ...noiseChips.map((c, i) => chain(waitFor(i * 0.15), c.rectRef().opacity(0.6, 0.4, easeOutCubic))),
  );
  yield* waitFor(0.15);
  yield* all(
    ...noiseArrows.map((a, i) => chain(waitFor(i * 0.07), a.ref().end(1, 0.5, easeInOutCubic))),
  );
  yield* waitFor(0.2);
  yield* labelNoiseOp(1, 0.6, easeOutCubic);
  yield* waitFor(2.6);

  yield* all(
    ...noiseChips.map(c => c.rectRef().opacity(0, 0.45, easeInOutCubic)),
    ...noiseArrows.map(a => a.ref().opacity(0, 0.45, easeInOutCubic)),
    labelNoiseOp(0, 0.45, easeInOutCubic),
  );
  yield* waitFor(0.4);

  // ─── Beat 3 — signal climax + emerging seam + counter ────────────
  // Re-create the four chips at calmer positions for the climax.
  const climaxChips = [
    makeChip('fragile parts',     -640, -260),
    makeChip('heavy parts',       -640,  -90),
    makeChip('no sudden movement', 640, -260),
    makeChip('soft release',       640,  -90),
  ];
  for (const c of climaxChips) view.add(c.rect);

  // First — arrows that *try* to land on grab. Briefly. Then redirect.
  const wrongArrows = [
    makeArrow([-450, -240], [-160, Y_GRAB + 8], ACCENT_RED),
    makeArrow([-470,  -70], [-160, Y_GRAB + 8], ACCENT_RED),
    makeArrow([ 460, -240], [ 160, Y_GRAB + 8], ACCENT_RED),
    makeArrow([ 480,  -70], [ 160, Y_GRAB + 8], ACCENT_RED),
  ];
  for (const a of wrongArrows) view.add(a.node);

  yield* all(
    ...climaxChips.map((c, i) => chain(waitFor(i * 0.12), c.rectRef().opacity(1, 0.4, easeOutCubic))),
  );
  yield* waitFor(0.1);
  yield* all(
    ...wrongArrows.map((a, i) => chain(waitFor(i * 0.04), a.ref().end(1, 0.4, easeInOutCubic))),
  );
  yield* waitFor(0.5);
  // Wrong arrows fade — they don't stick on grab.
  yield* all(
    ...wrongArrows.map(a => a.ref().opacity(0, 0.4, easeInOutCubic)),
  );

  // Real signal arrows — converge on transfer block.
  const realArrows = [
    makeArrow([-450, -240], [-200, Y_TRANSFER_CENTER], SIGNAL_LINE),
    makeArrow([-470,  -70], [-200, Y_TRANSFER_CENTER], SIGNAL_LINE),
    makeArrow([ 460, -240], [ 200, Y_TRANSFER_CENTER], SIGNAL_LINE),
    makeArrow([ 480,  -70], [ 200, Y_TRANSFER_CENTER], SIGNAL_LINE),
  ];
  for (const a of realArrows) view.add(a.node);

  yield* all(
    ...realArrows.map((a, i) => chain(waitFor(i * 0.05), a.ref().end(1, 0.5, easeInOutCubic))),
  );

  // Frame "handling" lights up around the transfer block.
  const climaxFrameRef = createRef<Rect>();
  const climaxFrameOp = createSignal(0);
  view.add(
    <Rect
      ref={climaxFrameRef}
      x={PANEL_X - 60} y={(Y_TRANSFER_TOP + Y_TRANSFER_BOTTOM) / 2}
      width={frameW} height={frameH}
      radius={8}
      fill={'rgba(0,0,0,0)'}
      stroke={OK_FRAME}
      lineWidth={2.4}
      opacity={climaxFrameOp}
    />,
  );

  const handlingTagOp = createSignal(0);
  view.add(
    <Txt
      text={'handling'}
      x={PANEL_X - 60 + frameW / 2 - 90} y={Y_TRANSFER_TOP - 18}
      fontFamily={Fonts.primary}
      fontSize={16}
      fontWeight={600}
      letterSpacing={5}
      fill={OK_FRAME}
      opacity={handlingTagOp}
    />,
  );

  yield* climaxFrameOp(1, 0.5, easeOutCubic);
  yield* handlingTagOp(1, 0.4, easeOutCubic);
  yield* waitFor(0.6);

  // Out of the frame, a small HandlingProfile seam emerges below the code.
  const seamRef = createRef<Rect>();
  const seamOp  = createSignal(0);
  const seamY = 360;
  view.add(
    <Rect
      ref={seamRef}
      x={0} y={seamY}
      width={620} height={150}
      radius={10}
      fill={'rgba(120, 220, 255, 0.05)'}
      stroke={SEAM_STROKE}
      lineWidth={1.6}
      opacity={seamOp}
      layout
      direction={'column'}
      padding={18}
      gap={4}
    >
      <Txt
        text={'HandlingProfile'}
        fontFamily={Fonts.code}
        fontSize={20}
        fontWeight={600}
        fill={TYPE_CLEAN}
      />
      <Txt
        text={'GripForce        gripForce'}
        fontFamily={Fonts.code}
        fontSize={18}
        fill={VAR_LIGHT}
      />
      <Txt
        text={'MotionProfile    motionProfile'}
        fontFamily={Fonts.code}
        fontSize={18}
        fill={VAR_LIGHT}
      />
      <Txt
        text={'ReleaseStyle     releaseStyle'}
        fontFamily={Fonts.code}
        fontSize={18}
        fill={VAR_LIGHT}
      />
    </Rect>,
  );

  // Faint connector from the frame to the seam
  const connectorRef = createRef<Line>();
  view.add(
    <Line
      ref={connectorRef}
      points={[[0, Y_TRANSFER_BOTTOM + 6], [0, seamY - 80]]}
      stroke={SEAM_STROKE}
      lineWidth={1}
      lineDash={[6, 6]}
      opacity={0}
    />,
  );

  yield* connectorRef().opacity(0.6, 0.4, easeOutCubic);
  yield* seamOp(1, 0.7, easeOutCubic);
  yield* waitFor(0.4);

  // Surface-cost counter ticks up — small, restrained.
  const counter = makeCounter(720, -380);
  view.add(counter.node);
  yield* counter.opSig(1, 0.5, easeOutCubic);
  yield* waitFor(0.3);
  yield* all(
    counter.filesSig(2, 0.6, easeInOutCubic),
    counter.conceptsSig(5, 0.6, easeInOutCubic),
    counter.placesSig(3, 0.6, easeInOutCubic),
  );

  yield* waitFor(3.2);

  // ─── Fade out ────────────────────────────────────────────────────
  yield* all(
    ...climaxChips.map(c => c.rectRef().opacity(0, 0.7, easeInOutCubic)),
    ...realArrows.map(a => a.ref().opacity(0, 0.7, easeInOutCubic)),
    climaxFrameOp(0, 0.7, easeInOutCubic),
    handlingTagOp(0, 0.7, easeInOutCubic),
    seamOp(0, 0.7, easeInOutCubic),
    connectorRef().opacity(0, 0.7, easeInOutCubic),
    counter.opSig(0, 0.7, easeInOutCubic),
    code.disappear(0.8),
  );
  yield* waitFor(0.3);
});
