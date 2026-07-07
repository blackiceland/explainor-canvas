import {Circle, Gradient, Line, Node, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  chain,
  createRef,
  createSignal,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  linear,
  spawn as runConcurrent,
  Vector2,
  waitFor,
} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';
import {Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {textWidth} from '../core/utils/textMeasure';
import {getCodePaddingX} from '../core/code/shared/TextMeasure';

// ── Code colors ─────────────────────────────────────────────────────────
const WARM_CREAM  = 'rgba(244, 241, 235, 0.95)';
const QUOTE_BEIGE = 'rgba(232, 207, 174, 0.96)';
const MUTED       = 'rgba(244, 241, 235, 0.6)';
const PARAM_LIGHT = 'rgba(244, 241, 235, 0.92)';
const TYPE_CLEAN  = 'rgba(220, 215, 255, 0.85)';

// ── Code signatures ─────────────────────────────────────────────────────
const SIG_ONE   = `fun save(file: File, data: Data, overwrite: Boolean = false)`;
const SIG_FINAL = `fun save(file: File, data: Data, overwrite: Boolean = false,
    createDirs: Boolean = false, skipBackup: Boolean = false,
    silent: Boolean = false)`;

const F = Fonts.code;
const SZ = 50;
const LH = 76;
const MC_W = 2200;

const MC_LEFT_EDGE = -MC_W / 2 + getCodePaddingX(SZ);

const BOOLEAN_PREFIX_PX = textWidth('fun save(file: File, data: Data, overwrite: ', F, SZ);
const BOOLEAN_PX = textWidth('Boolean', F, SZ);
const BOOLEAN_CENTER = MC_LEFT_EDGE + BOOLEAN_PREFIX_PX + BOOLEAN_PX / 2;

const FRAGMENT_PREFIX_PX = textWidth('fun save(file: File, data: Data, ', F, SZ);
const FRAGMENT_PX = textWidth('overwrite: Boolean = false', F, SZ);
const FRAGMENT_CENTER = MC_LEFT_EDGE + FRAGMENT_PREFIX_PX + FRAGMENT_PX / 2;

const SIG_FINAL_MAX_W = Math.max(
  ...[
    'fun save(file: File, data: Data, overwrite: Boolean = false,',
    '    createDirs: Boolean = false, skipBackup: Boolean = false,',
    '    silent: Boolean = false)',
  ].map(l => textWidth(l, F, SZ)),
);
const SIG_FINAL_OFFSET_X = -(MC_LEFT_EDGE + SIG_FINAL_MAX_W / 2);

// During TREE-1 + PHASE 2c the code lives in the LEFT half of the frame
// at a smaller scale, leaving the RIGHT half clear for the branch.
const BEAT1_CODE_SCALE = 0.62;
const BEAT1_CODE_X     = -250;
const BEAT1_CODE_Y     = -100;

const CODE_RULES = [
  {match: /^fun$/,      color: DryFiltersV3CodeTheme.keyword},
  {match: /^false$/,    color: DryFiltersV3CodeTheme.keyword},
  {match: /^true$/,     color: DryFiltersV3CodeTheme.keyword},
  {match: 'save',       color: DryFiltersV3CodeTheme.method, onlyTypes: ['method'] as const},
  {match: /^Boolean$/,  color: TYPE_CLEAN},
  {match: /^File$/,     color: TYPE_CLEAN},
  {match: /^Data$/,     color: TYPE_CLEAN},
  {match: 'file',       color: PARAM_LIGHT},
  {match: 'data',       color: PARAM_LIGHT},
  {match: 'overwrite',  color: PARAM_LIGHT},
  {match: 'createDirs', color: PARAM_LIGHT},
  {match: 'skipBackup', color: PARAM_LIGHT},
  {match: 'silent',     color: PARAM_LIGHT},
];

const CODE_OPTS_BASE = {
  width: MC_W,
  fontSize: SZ,
  lineHeight: LH,
  fontFamily: F,
  theme: DryFiltersV3CodeTheme,
  noClip: true,
  cardStyle: {
    radius: 0,
    fill: 'rgba(0,0,0,0)',
    stroke: 'rgba(0,0,0,0)',
    strokeWidth: 0,
    edge: false,
    opacity: 0,
    shadowBlur: 0,
    shadowColor: 'rgba(0,0,0,0)',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  },
  glowAccent: false,
  customTypes: ['Boolean', 'File', 'Data'],
};

// ── Procedural tree (V3 lineage, with trunk lean) ───────────────────────
const SCREEN_W = 1920;
const SCREEN_H = 1080;

const TREE_MAX_DEPTH    = 6;
const TREE_BASE_LENGTH  = 540;
const TREE_BASE_WIDTH   = 82;
const WITHIN_TAPER      = 0.78;
const TIP_RATIO         = 0.55;
const BRANCH_ANGLE_MIN  = 26;
const BRANCH_ANGLE_MAX  = 62;
const LEN_SCALE_MIN     = 0.55;
const LEN_SCALE_MAX     = 0.84;
const CURVE_S_AMOUNT    = 0.42;
const TRUNK_BEND_BOOST  = 1.6;    // trunk bezier curve amplified for sinuous shape
const TRUNK_LUMP_BOOST  = 2.6;    // trunk edge lumps amplified
const KEEP_PROB         = 0.85;
const TRIPLE_PROB       = 0.45;
const LATERAL_PROB      = 0.30;
const ROOT_X_LOCAL      = 0;
const ROOT_Y_LOCAL      = 480;
const N_SAMPLES         = 22;
const CHILD_HANDOFF     = 0.60;
const TRUNK_LEAN_DEG    = 18;     // root grows up-and-right by this many deg

const TREE_FILL    = 'rgba(244, 240, 234, 1.0)';
const HILITE_FILL  = 'rgba(255, 252, 245, 1.0)';
const DROP_SHADOW  = 'rgba(0, 0, 0, 0.55)';
const TREE_GLOW    = 'rgba(255, 246, 222, 0.45)';   // soft cream halo
const LABEL_TRUE_COL  = 'rgba(150, 215, 200, 0.85)';
const LABEL_FALSE_COL = 'rgba(225, 165, 155, 0.85)';

// Beat 2 final composition: trunk-base sits low in the frame so its roots
// can splay along the lower edge; tree leans up-and-right.
const TREE_X_FINAL      = -640;
const TREE_Y_FINAL      = 160;
const TREE_SCALE_FINAL  = 0.62;

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pnoise(t: number, seed: number): number {
  return (
    Math.sin(t * 4.73 + seed * 1.0) * 0.55 +
    Math.sin(t * 9.31 + seed * 1.7) * 0.30 +
    Math.sin(t * 17.1 + seed * 2.3) * 0.15
  );
}

function strokeShape(
  start: Vector2, end: Vector2, c1: Vector2, c2: Vector2,
  startW: number, endW: number, isTip: boolean, seed: number,
  growT: number, widthScale: number, widthBias: number, lumpAmt: number,
): Vector2[] {
  if (growT <= 0) return [start, start];
  const top: Vector2[] = [];
  const bot: Vector2[] = [];
  for (let i = 0; i <= N_SAMPLES; i++) {
    const localT = i / N_SAMPLES;
    const t = localT * growT;
    const u = 1 - t;
    const u2 = u * u, u3 = u2 * u;
    const t2 = t * t, t3 = t2 * t;
    const px = start.x*u3 + 3*c1.x*u2*t + 3*c2.x*u*t2 + end.x*t3;
    const py = start.y*u3 + 3*c1.y*u2*t + 3*c2.y*u*t2 + end.y*t3;
    const tx = 3*u2*(c1.x-start.x) + 6*u*t*(c2.x-c1.x) + 3*t2*(end.x-c2.x);
    const ty = 3*u2*(c1.y-start.y) + 6*u*t*(c2.y-c1.y) + 3*t2*(end.y-c2.y);
    const tlen = Math.max(0.0001, Math.sqrt(tx*tx + ty*ty));
    const nx = -ty / tlen;
    const ny =  tx / tlen;
    const tipFactor = isTip ? 0.0 : 0.88;
    let pressure;
    if (t < 0.10) {
      const u_ = t / 0.10;
      pressure = 0.75 + 0.25 * (1 - (1 - u_)*(1 - u_));
    } else if (t < 0.62) {
      pressure = 1.0;
    } else {
      const u_ = (t - 0.62) / 0.38;
      pressure = 1.0 - (1.0 - tipFactor) * (u_ * u_);
    }
    const lump = pnoise(t * 5, seed) * lumpAmt;
    const w = (startW + (endW - startW) * t) * pressure * widthScale + lump;
    const wTop = w * widthBias;
    const wBot = w * (1 - widthBias);
    top.push(new Vector2(px + nx*wTop, py + ny*wTop));
    bot.push(new Vector2(px - nx*wBot, py - ny*wBot));
  }
  return [...top, ...bot.reverse()];
}

export default makeScene2D(function* (view) {
  view.removeChildren();

  // Same background as other title scenes (gradient + warm spotlight).
  applyBackground(view);

  type GrowSig = ReturnType<typeof createSignal<number>>;
  type TreeLabel = {
    x: number; y: number; text: string; col: string;
    opacity: GrowSig;
  };
  type Branch = {
    start: Vector2;
    end: Vector2;
    ctrl1: Vector2;
    ctrl2: Vector2;
    startW: number;
    endW: number;
    isTip: boolean;
    depth: number;
    seed: number;
    grow: GrowSig;
    children: Branch[];
    parent: Branch | null;
    forkLabels: TreeLabel[];   // labels created at THIS branch's tip-fork
  };

  // ── Tree generation ────────────────────────────────────────────────────
  // treeGroup contains TWO sub-groups whose opacity we toggle by beat:
  //   beat1Group — only the sub-tree we focus on in BEAT 1.
  //   restGroup  — everything else; pre-grown but invisible until INVERSION
  //                fades it in as the camera pulls back.
  const treeGroup = createRef<Node>();
  const beat1Group = createRef<Node>();
  const restGroup = createRef<Node>();
  view.add(
    <Node ref={treeGroup} opacity={0}>
      <Node ref={restGroup} opacity={0} />
      <Node ref={beat1Group} opacity={1} />
    </Node>,
  );

  const allBranches: Branch[] = [];
  const rand = mulberry32(29);

  const spawn = (
    start: Vector2,
    parentAngleDeg: number,
    length: number,
    baseWidth: number,
    depth: number,
    parent: Branch | null,
  ): Branch | null => {
    if (depth > TREE_MAX_DEPTH) return null;
    const angleRad = (parentAngleDeg - 90) * Math.PI / 180;
    const dirX = Math.cos(angleRad);
    const dirY = Math.sin(angleRad);
    const end = start.add(new Vector2(dirX * length, dirY * length));
    const perpX = -dirY;
    const perpY =  dirX;
    const bendBoost = depth === 0 ? TRUNK_BEND_BOOST : 1.0;
    const bend1 = (rand() - 0.5) * 2 * CURVE_S_AMOUNT * length * bendBoost;
    const bend2 = -bend1 * (0.4 + rand() * 0.5);
    const c1 = new Vector2(
      start.x + dirX*length*0.33 + perpX*bend1,
      start.y + dirY*length*0.33 + perpY*bend1,
    );
    const c2 = new Vector2(
      start.x + dirX*length*0.66 + perpX*bend2,
      start.y + dirY*length*0.66 + perpY*bend2,
    );
    const isTip = depth >= TREE_MAX_DEPTH - 1;
    const startW = baseWidth;
    const endW = isTip ? 0.0 : Math.max(0.4, baseWidth * WITHIN_TAPER);
    const grow = createSignal(0);
    const seed = rand() * 1000;
    const branch: Branch = {
      start, end, ctrl1: c1, ctrl2: c2,
      startW, endW, isTip, depth, seed, grow,
      children: [], parent,
      forkLabels: [],
    };
    allBranches.push(branch);
    if (depth === TREE_MAX_DEPTH) return branch;

    const tilts: number[] = [];
    tilts.push(-(BRANCH_ANGLE_MIN + rand() * (BRANCH_ANGLE_MAX - BRANCH_ANGLE_MIN)));
    tilts.push(+(BRANCH_ANGLE_MIN + rand() * (BRANCH_ANGLE_MAX - BRANCH_ANGLE_MIN)));
    if (depth >= 1 && rand() < TRIPLE_PROB) tilts.push((rand() - 0.5) * 12);

    const childBase = endW * (TIP_RATIO + (rand() - 0.5) * 0.06);
    const childRefs: {b: Branch | null; tilt: number}[] = [];
    for (const tilt of tilts) {
      if (rand() >= KEEP_PROB && tilts.length > 2) {
        childRefs.push({b: null, tilt});
        continue;
      }
      const lenC = length * (LEN_SCALE_MIN + rand() * (LEN_SCALE_MAX - LEN_SCALE_MIN));
      const child = spawn(end, parentAngleDeg + tilt, lenC, childBase, depth + 1, branch);
      if (child) {
        branch.children.push(child);
        childRefs.push({b: child, tilt});
      }
    }

    if (depth >= 1 && depth <= TREE_MAX_DEPTH - 2 && rand() < LATERAL_PROB) {
      const tParam = 0.45 + rand() * 0.35;
      const lateralStart = new Vector2(
        start.x + (end.x - start.x) * tParam,
        start.y + (end.y - start.y) * tParam,
      );
      const lateralAngle = parentAngleDeg + (rand() < 0.5 ? -1 : 1) * (BRANCH_ANGLE_MIN + rand() * 30);
      const lateralLen = length * (0.35 + rand() * 0.25);
      const lateralBase = baseWidth * (0.45 + rand() * 0.15);
      const lat = spawn(lateralStart, lateralAngle, lateralLen, lateralBase, depth + 2, branch);
      if (lat) branch.children.push(lat);
    }

    // Generate true/false label pair at every binary fork. Labels are
    // attached to THIS branch (the parent of the fork) so they can be
    // shown/hidden along with their fork's reveal phase.
    if (depth <= 4) {
      // Render a label pair if the fork actually has 2+ real children
      // (KEEP_PROB may have dropped a slot — we still want both labels).
      const realChildren = childRefs.filter(c => c.b !== null) as {b: Branch; tilt: number}[];
      if (realChildren.length >= 2) {
        const leftR = realChildren[0];
        const rightR = realChildren[realChildren.length - 1];
        // Place each label NEAR ITS OWN child arm — push along the arm
        // direction past the fork start, then perpendicular to the arm
        // (away from the sibling). false sits a bit further out so it
        // doesn't graze the right arm.
        const along = 38;
        const truePerpAway  = 50;
        const falsePerpAway = 78;
        const aL = (parentAngleDeg + leftR.tilt - 90) * Math.PI / 180;
        const aR = (parentAngleDeg + rightR.tilt - 90) * Math.PI / 180;
        const lX = end.x + Math.cos(aL) * along - Math.cos(aL + Math.PI / 2) * truePerpAway;
        const lY = end.y + Math.sin(aL) * along - Math.sin(aL + Math.PI / 2) * truePerpAway;
        const rX = end.x + Math.cos(aR) * along + Math.cos(aR + Math.PI / 2) * falsePerpAway;
        const rY = end.y + Math.sin(aR) * along + Math.sin(aR + Math.PI / 2) * falsePerpAway;
        branch.forkLabels.push({
          x: lX, y: lY, text: 'true',
          col: LABEL_TRUE_COL, opacity: createSignal(0),
        });
        branch.forkLabels.push({
          x: rX, y: rY, text: 'false',
          col: LABEL_FALSE_COL, opacity: createSignal(0),
        });
      }
    }
    return branch;
  };

  const root = spawn(
    new Vector2(ROOT_X_LOCAL, ROOT_Y_LOCAL), TRUNK_LEAN_DEG,
    TREE_BASE_LENGTH, TREE_BASE_WIDTH, 0, null,
  )!;

  // ── Root system splaying along the ground ──────────────────────────────
  // Recursive: each main root sprouts 1-2 sub-roots so the base of the
  // trunk doesn't end in cone-shaped pikes. Tapers retain non-zero width
  // at their tips. All roots are pre-grown and live in restGroup.
  const spawnRoot = (
    start: Vector2, angleDeg: number, length: number, baseWidth: number,
    subdepth: number,
  ): void => {
    if (subdepth > 1) return;
    const angleRad = (angleDeg - 90) * Math.PI / 180;
    const dirX = Math.cos(angleRad);
    const dirY = Math.sin(angleRad);
    const end = start.add(new Vector2(dirX * length, dirY * length));
    const perpX = -dirY;
    const perpY =  dirX;
    const bend1 = (rand() - 0.4) * 2 * CURVE_S_AMOUNT * length * 1.2;
    const bend2 = -bend1 * (0.5 + rand() * 0.4);
    const c1 = new Vector2(
      start.x + dirX*length*0.33 + perpX*bend1,
      start.y + dirY*length*0.33 + perpY*bend1,
    );
    const c2 = new Vector2(
      start.x + dirX*length*0.66 + perpX*bend2,
      start.y + dirY*length*0.66 + perpY*bend2,
    );
    const branch: Branch = {
      start, end, ctrl1: c1, ctrl2: c2,
      startW: baseWidth,
      endW: subdepth >= 1 ? baseWidth * 0.18 : baseWidth * 0.42,
      isTip: false,
      depth: 0, seed: rand() * 1000,
      grow: createSignal(1),
      children: [], parent: null, forkLabels: [],
    };
    allBranches.push(branch);

    // Sub-roots: short branches splitting off the main root.
    if (subdepth < 1) {
      const numSubs = rand() < 0.55 ? 1 : 2;
      for (let i = 0; i < numSubs; i++) {
        const tParam = 0.4 + rand() * 0.45;
        const subStart = new Vector2(
          start.x + (end.x - start.x) * tParam,
          start.y + (end.y - start.y) * tParam,
        );
        const subAngle = angleDeg + (rand() < 0.5 ? -1 : 1) * (15 + rand() * 35);
        const subLen = length * (0.45 + rand() * 0.30);
        const subWidth = baseWidth * (0.50 + rand() * 0.18);
        spawnRoot(subStart, subAngle, subLen, subWidth, subdepth + 1);
      }
    }
  };

  const rootBase = new Vector2(ROOT_X_LOCAL, ROOT_Y_LOCAL);
  const ROOT_SPREAD = [
    {angle: 108, length: 380, width: 38},
    {angle: 130, length: 300, width: 46},
    {angle: 150, length: 220, width: 50},
    {angle: 168, length: 150, width: 44},
    {angle: 198, length: 200, width: 46},
    {angle: 218, length: 270, width: 50},
    {angle: 244, length: 340, width: 40},
  ];
  for (const rs of ROOT_SPREAD) {
    spawnRoot(rootBase, rs.angle, rs.length, rs.width, 0);
  }

  // ── Find a sub-tree with EXACTLY 3 visible forks for BEAT 1 ────────────
  // Visible forks = forks whose children are within the rendered depth
  // window. We limit beat-1 rendering to relDepth ≤ BEAT1_REL_DEPTH so
  // the composition has a clean 3-fork structure (no deeper sub-bushes).
  const BEAT1_REL_DEPTH = 2;
  const countForksLimited = (b: Branch, maxRel: number): number => {
    let n = 0;
    const visit = (x: Branch, rd: number) => {
      if (rd > maxRel) return;
      if (x.children.length >= 2 && rd + 1 <= maxRel) n++;
      for (const c of x.children) visit(c, rd + 1);
    };
    visit(b, 0);
    return n;
  };
  const subBranchesLimited = (b: Branch, maxRel: number): Set<Branch> => {
    const set = new Set<Branch>();
    const visit = (x: Branch, rd: number) => {
      if (rd > maxRel) return;
      set.add(x);
      for (const c of x.children) visit(c, rd + 1);
    };
    visit(b, 0);
    return set;
  };
  const countForks = (b: Branch): number => countForksLimited(b, BEAT1_REL_DEPTH);
  const subBranches = (b: Branch): Set<Branch> => subBranchesLimited(b, BEAT1_REL_DEPTH);
  const computeBBox = (set: Set<Branch>): {minX: number; minY: number; maxX: number; maxY: number} => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of set) {
      for (const p of [b.start, b.end, b.ctrl1, b.ctrl2]) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
    }
    return {minX, minY, maxX, maxY};
  };

  // Prefer depth-2 sub-trees with 4–6 forks for a longer, branchier
  // beat-1 composition. Sub-trees at depth-2 span more depths (longer
  // body) and naturally produce multiple visible Y-junctions.
  const candidates: Branch[] = [];
  const collectAt = (b: Branch, predicate: (x: Branch) => boolean) => {
    if (predicate(b)) candidates.push(b);
    for (const c of b.children) collectAt(c, predicate);
  };
  collectAt(root, b => b.depth === 2 && countForks(b) === 3);
  if (candidates.length === 0) collectAt(root, b => b.depth === 3 && countForks(b) === 3);
  if (candidates.length === 0) collectAt(root, b => b.depth >= 2 && countForks(b) === 3);
  if (candidates.length === 0) collectAt(root, b => b.depth >= 2 && countForks(b) >= 2 && countForks(b) <= 4);
  const beat1Tree: Branch = candidates[0] ?? root;
  const beat1Set = subBranches(beat1Tree);

  // Pre-grow every branch that is NOT in beat-1 sub-tree. They are
  // pre-drawn but kept invisible (in `restGroup`) until INVERSION fades
  // the rest of the tree in as the camera pulls back.
  for (const b of allBranches) {
    if (!beat1Set.has(b)) b.grow(1);
  }

  // Beat-1 LEAVES taper to a true point — internal beat-1 branches keep
  // the natural V3 taper (parent.endW → child.startW * 0.55) so the
  // chain reads as a continuous narrowing from trunk to fork-tip.
  for (const b of allBranches) {
    if (!beat1Set.has(b)) continue;
    const childrenInBeat = b.children.filter(c => beat1Set.has(c)).length;
    if (childrenInBeat === 0) {
      b.endW = 0;
      b.isTip = true;
    }
  }

  // ── Drop the SIBLING of beat-1 sub-tree slightly lower ─────────────────
  // The depth-2 branch that diverges from beat-1's parent fork is gently
  // pulled downward — keeps its start connected to the parent's tip but
  // the branch droops and its descendants follow.
  const SIBLING_DROOP = 50;
  const beat1Siblings = beat1Tree.parent
    ? beat1Tree.parent.children.filter(c => c !== beat1Tree)
    : [];
  const shiftSubtree = (b: Branch, dy: number) => {
    b.start = new Vector2(b.start.x, b.start.y + dy);
    b.end   = new Vector2(b.end.x,   b.end.y + dy);
    b.ctrl1 = new Vector2(b.ctrl1.x, b.ctrl1.y + dy);
    b.ctrl2 = new Vector2(b.ctrl2.x, b.ctrl2.y + dy);
    for (const lbl of b.forkLabels) lbl.y += dy;
    for (const c of b.children) shiftSubtree(c, dy);
  };
  for (const s of beat1Siblings) {
    // Sibling itself: keep start anchored to parent, droop only end + ctrls.
    s.end   = new Vector2(s.end.x,   s.end.y + SIBLING_DROOP);
    s.ctrl1 = new Vector2(s.ctrl1.x, s.ctrl1.y + SIBLING_DROOP);
    s.ctrl2 = new Vector2(s.ctrl2.x, s.ctrl2.y + SIBLING_DROOP);
    for (const lbl of s.forkLabels) lbl.y += SIBLING_DROOP;
    // Descendants ride along with the new end position.
    for (const c of s.children) shiftSubtree(c, SIBLING_DROOP);
  }

  // ── The lone "capillary" arm — make it read woodier ────────────────────
  // The thin arm that droops LEFT off the beat-1 sub-tree's first fork read
  // like a blood vessel, not a branch: too thin, too smooth, uniform taper.
  // Select ONLY that arm's subtree (the first-fork child reaching furthest
  // LEFT) and later render it thicker + with irregular woody edges. Every
  // other branch is left exactly as-is.
  const capillarySet = new Set<Branch>();
  {
    const beat1Child = (b: Branch) => b.children.filter(c => beat1Set.has(c));
    let firstFork: Branch | null = null;
    const queue: Branch[] = [beat1Tree];
    while (queue.length) {
      const x = queue.shift()!;
      if (beat1Child(x).length >= 2) { firstFork = x; break; }
      queue.push(...beat1Child(x));
    }
    if (firstFork) {
      const leftmostX = (b: Branch): number => {
        let m = Math.min(b.start.x, b.end.x, b.ctrl1.x, b.ctrl2.x);
        for (const c of beat1Child(b)) m = Math.min(m, leftmostX(c));
        return m;
      };
      let pick: Branch | null = null;
      let best = Infinity;
      for (const k of beat1Child(firstFork)) {
        const lx = leftmostX(k);
        if (lx < best) { best = lx; pick = k; }
      }
      if (pick) {
        const paint = (b: Branch) => {
          capillarySet.add(b);
          for (const c of beat1Child(b)) paint(c);
        };
        paint(pick);
      }
    }
  }

  // Branches that descend from beat-1 LEAVES are excluded from rendering
  // entirely — that way the camera pull-back doesn't sprout extra twigs
  // out of the visible fork-tips. The big tree continues to grow ELSEWHERE
  // (other depth-1 paths), so the canopy still reads, just not as a
  // continuation of the beat-1 sub-tree.
  const beat1Leaves: Branch[] = [];
  for (const b of allBranches) {
    if (!beat1Set.has(b)) continue;
    if (b.children.every(c => !beat1Set.has(c))) beat1Leaves.push(b);
  }
  const skipFromBigTree = new Set<Branch>();
  const collectDescendants = (b: Branch) => {
    for (const c of b.children) {
      if (skipFromBigTree.has(c)) continue;
      if (beat1Set.has(c)) continue;     // still part of beat-1 sub-tree
      skipFromBigTree.add(c);
      collectDescendants(c);
    }
  };
  for (const leaf of beat1Leaves) collectDescendants(leaf);

  // ── Render branches: route to beat1Group or restGroup ──────────────────
  for (const b of allBranches) {
    if (skipFromBigTree.has(b)) continue;   // descendants of beat-1 leaves
    const target = beat1Set.has(b) ? beat1Group() : restGroup();
    const lumpAmt = b.depth === 0 ? TRUNK_LUMP_BOOST : (b.depth === 1 ? 1.0 : 0.4);
    // Capillary arm: thicker (wScale) + woody irregular edges (lumpMain).
    const isCapillary = capillarySet.has(b);
    const wScale = isCapillary ? 2.1 : 1.0;
    const lumpMain = isCapillary ? 1.7 : lumpAmt;
    target.add(
      <Line
        points={() => strokeShape(
          b.start, b.end, b.ctrl1, b.ctrl2, b.startW, b.endW, b.isTip, b.seed,
          b.grow(), wScale, 0.5, lumpMain,
        )}
        closed
        fill={DROP_SHADOW}
        lineWidth={0}
        shadowBlur={18}
        shadowColor={DROP_SHADOW}
        shadowOffsetX={4}
        shadowOffsetY={6}
        opacity={0.55}
      />,
    );
    target.add(
      <Line
        points={() => strokeShape(
          b.start, b.end, b.ctrl1, b.ctrl2, b.startW, b.endW, b.isTip, b.seed,
          b.grow(), wScale, 0.5, lumpMain,
        )}
        closed
        fill={TREE_FILL}
        lineWidth={0}
        shadowBlur={14}
        shadowColor={TREE_GLOW}
      />,
    );
    target.add(
      <Line
        points={() => strokeShape(
          b.start, b.end, b.ctrl1, b.ctrl2, b.startW, b.endW, b.isTip, b.seed,
          b.grow(), 0.32 * wScale, 0.95, lumpMain * 0.4,
        )}
        closed
        fill={HILITE_FILL}
        lineWidth={0}
      />,
    );
    // Only show fork-labels when the fork's children are actually rendered
    // in this group — otherwise we'd see floating true/false next to a
    // branch tip that has no visible split.
    const childrenRendered = b.children.length > 0 &&
      b.children.every(c => (target === beat1Group() ? beat1Set.has(c) : true));
    if (childrenRendered) {
      // Labels in beat-1 sit at scale 1.92 (group transform), big tree
      // sits at scale 0.5 — so big-tree labels need a bigger native size
      // to stay readable.
      const inBeat1 = beat1Set.has(b);
      const labelSize = inBeat1 ? 22 : 38;
      for (const lbl of b.forkLabels) {
        target.add(
          <Txt
            text={lbl.text}
            x={lbl.x}
            y={lbl.y}
            fontFamily={Fonts.code}
            fontSize={labelSize}
            fill={lbl.col}
            opacity={lbl.opacity}
          />,
        );
      }
    }
  }

  // Beat-1 framing: sub-tree fills the RIGHT HALF of the frame so the
  // code (centered) lives in the left+center region without competing
  // visually with the branch. Sub-tree's start anchors at the bottom
  // edge — branch enters from outside, not floating in the air.
  const BEAT1_CENTER_X = SCREEN_W * 0.27;       // sub-tree centered in right half
  const BEAT1_AVAILABLE_W = SCREEN_W * 0.5;     // fit inside right half
  const bbox1 = computeBBox(beat1Set);
  const w1 = bbox1.maxX - bbox1.minX;
  const h1 = bbox1.maxY - bbox1.minY;
  const cx1 = (bbox1.minX + bbox1.maxX) / 2;
  const startY1 = beat1Tree.start.y;
  const beat1Scale = Math.min(
    BEAT1_AVAILABLE_W / Math.max(1, w1),
    SCREEN_H * 0.94 / Math.max(1, h1),
    4.0,
  );
  const targetStartWorldY = SCREEN_H / 2;       // sub-tree start at frame bottom
  const beat1X = BEAT1_CENTER_X - beat1Scale * cx1;
  const beat1Y = targetStartWorldY - beat1Scale * startY1;

  treeGroup().x(beat1X);
  treeGroup().y(beat1Y);
  treeGroup().scale(beat1Scale);

  console.log(`[yudan] branches=${allBranches.length} beat1=${beat1Set.size} forks=${countForks(beat1Tree)} depth=${beat1Tree.depth}`);
  console.log(`[yudan] beat1Scale=${beat1Scale.toFixed(2)} pos=(${beat1X.toFixed(0)}, ${beat1Y.toFixed(0)})`);

  // ── SNOW / atmospherics layer (fog + drifting motes + snow) ────────────
  // limboGroup starts INVISIBLE (opacity 0) and fades in during the
  // INVERSION camera pull-back, so the snow appears TOGETHER with the tree
  // — not during the opening titles. Snow's motion runs at a constant rate
  // from scene t=0 (off-stage, behind opacity 0), so by the time it fades
  // in the field is ALREADY in steady state. No vignette.
  const limboGroup = createRef<Node>();
  view.add(<Node ref={limboGroup} opacity={0} />);

  for (const fog of [
    {x: -200, y: 200, r: 720, op: 0.10},
    {x:  300, y:  60, r: 620, op: 0.07},
    {x: -120, y: -160, r: 520, op: 0.05},
    {x:  500, y: 240, r: 560, op: 0.06},
  ]) {
    limboGroup().add(
      <Circle
        x={fog.x}
        y={fog.y}
        width={fog.r * 2}
        height={fog.r * 2}
        fill={new Gradient({
          type: 'radial',
          from: new Vector2(0, 0),
          to: new Vector2(0, 0),
          fromRadius: 0,
          toRadius: fog.r,
          stops: [
            {offset: 0,    color: `rgba(150, 160, 180, ${fog.op})`},
            {offset: 0.55, color: `rgba(150, 160, 180, ${fog.op * 0.4})`},
            {offset: 1,    color: 'rgba(150, 160, 180, 0)'},
          ],
        })}
      />,
    );
  }

  // Drifting motes — rising up like embers from below.
  const moteTime = createSignal(0);
  const moteRand = mulberry32(89);
  for (let i = 0; i < 32; i++) {
    const startX = (moteRand() - 0.5) * SCREEN_W * 0.95;
    const startY = SCREEN_H / 2 - 60 + moteRand() * 80;
    const driftX = (moteRand() - 0.5) * 60;
    const driftY = -(700 + moteRand() * 350);
    const radius = 1 + moteRand() * 2;
    const op = 0.18 + moteRand() * 0.22;
    limboGroup().add(
      <Circle
        x={() => startX + driftX * moteTime()}
        y={() => startY + driftY * moteTime()}
        width={radius * 2}
        height={radius * 2}
        fill={'rgba(232, 226, 215, 1.0)'}
        opacity={() => op * Math.sin(moteTime() * Math.PI)}
      />,
    );
  }

  // LIMBO-style snowflakes — rising from below the frame upward, gently
  // swayed by horizontal sine. Each flake has its own phase + delay so
  // they don't drift in lockstep.
  const snowTime = createSignal(0);
  const snowRand = mulberry32(137);
  for (let i = 0; i < 80; i++) {
    const startX = (snowRand() - 0.5) * SCREEN_W * 1.2;
    // Both endpoints CLEAR of the frame so the modulo wrap is invisible:
    //   start at +740..+940 (well below)
    //   end   at -740..-1100 (well above, since |riseDist| ≥ SCREEN_H + 740)
    const startY = SCREEN_H / 2 + 200 + snowRand() * 200;
    const riseDist = -(SCREEN_H + 740 + snowRand() * 360);
    const swayAmp = 18 + snowRand() * 36;
    const swayFreq = 1.2 + snowRand() * 1.8;
    const phase = snowRand() * Math.PI * 2;
    // Per-flake delay before motion begins. Until snowTime crosses this
    // threshold, the flake sits at startY (below frame, invisible). After
    // that, it rises at constant speed, wrapping mod 1.
    const startDelay = snowRand();
    const radius = 0.7 + snowRand() * 1.4;
    const op = 0.30 + snowRand() * 0.45;
    limboGroup().add(
      <Circle
        x={() => startX + Math.sin(phase + snowTime() * swayFreq * Math.PI * 2) * swayAmp}
        y={() => {
          const eff = Math.max(0, snowTime() - startDelay);
          const progress = ((eff % 1) + 1) % 1;
          return startY + riseDist * progress;
        }}
        width={radius * 2}
        height={radius * 2}
        fill={'rgba(244, 244, 250, 1.0)'}
        opacity={op}
      />,
    );
  }

  // ── Code group ─────────────────────────────────────────────────────────
  const codeGroup = createRef<Node>();
  view.add(<Node ref={codeGroup} />);

  // Snow advances at ONE constant rate from the very first frame of the
  // scene. limboGroup is invisible (opacity 0) until INVERSION, so the snow
  // circulates off-stage during the titles + code beats; by the time it
  // fades in with the tree the field is already in steady state.
  runConcurrent(snowTime(0.115 * 30, 30, linear));

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 1 — opening line in two beats, each centered.
  // ═══════════════════════════════════════════════════════════════════════
  yield* waitFor(0.15);

  const QUOTE_FONT = 60;

  const t1 = new Txt({
    text: "Bad code isn't complex",
    fontFamily: F,
    fontSize: QUOTE_FONT,
    fill: QUOTE_BEIGE,
    textAlign: 'center',
    x: 0,
    y: 0,
    opacity: 0,
  });
  view.add(t1);

  yield* t1.opacity(1, 0.35, easeInOutCubic);
  yield* waitFor(0.85);
  yield* t1.opacity(0, 0.35, easeInOutCubic);
  yield* waitFor(0.05);

  const t2 = new Txt({
    text: "It's code that pretends to be simple.",
    fontFamily: F,
    fontSize: QUOTE_FONT,
    fill: QUOTE_BEIGE,
    textAlign: 'center',
    x: 0,
    y: 0,
    opacity: 0,
  });
  view.add(t2);

  yield* t2.opacity(1, 0.35, easeInOutCubic);
  yield* waitFor(1.4);
  yield* t2.opacity(0, 0.45, easeInOutCubic);
  yield* waitFor(0.05);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2 setup — Manticore for SIG_ONE.
  // ═══════════════════════════════════════════════════════════════════════
  const codeRoot = createRef<Node>();
  codeGroup().add(<Node ref={codeRoot} opacity={0} />);
  const code = Manticore.create(SIG_ONE, {x: 0, y: 0, ...CODE_OPTS_BASE});
  code.mount(codeRoot());
  code.colorize(CODE_RULES);
  code.node.opacity(1);
  type TokenRef = ReturnType<NonNullable<ReturnType<typeof code.getLine>>['tokens'][number]['ref']>;

  const tokens = code.getLine(0)!.tokens;
  let overwriteIdx = -1;
  let booleanIdx = -1;
  let falseIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    const t = String(tokens[i].ref().text());
    if (overwriteIdx === -1 && t === 'overwrite') overwriteIdx = i;
    if (booleanIdx === -1 && t === 'Boolean') booleanIdx = i;
    if (t === 'false') falseIdx = i;
  }

  const stageB1Reveal: TokenRef[] = [];
  const stageB2Reveal: TokenRef[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const ref = tokens[i].ref();
    if (i === booleanIdx) continue;
    if (i >= overwriteIdx && i <= falseIdx) {
      ref.opacity(0);
      stageB1Reveal.push(ref);
    } else {
      ref.opacity(0);
      stageB2Reveal.push(ref);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2a — only "Boolean" is visible, large, dead-center.
  // ═══════════════════════════════════════════════════════════════════════
  const SCALE_2A = 2.4;
  codeRoot().scale(SCALE_2A);
  codeRoot().x(-BOOLEAN_CENTER * SCALE_2A);
  codeRoot().y(0);

  yield* codeRoot().opacity(1, 0.7, easeOutCubic);
  yield* waitFor(1.0);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2b1 — fragment.
  // ═══════════════════════════════════════════════════════════════════════
  const SCALE_2B1 = 1.55;
  yield* all(
    codeRoot().scale(SCALE_2B1, 0.95, easeInOutCubic),
    codeRoot().x(-FRAGMENT_CENTER * SCALE_2B1, 0.95, easeInOutCubic),
    ...stageB1Reveal.map(r => r.opacity(1, 0.8, easeOutCubic)),
  );
  yield* waitFor(1.1);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2b2 — full sig_one. The code scales DOWN and slides LEFT to
  //             clear the right half of the frame for the upcoming branch.
  // ═══════════════════════════════════════════════════════════════════════
  yield* all(
    codeRoot().scale(BEAT1_CODE_SCALE, 1.0, easeInOutCubic),
    codeRoot().x(BEAT1_CODE_X, 1.0, easeInOutCubic),
    codeRoot().y(BEAT1_CODE_Y, 1.0, easeInOutCubic),
    ...stageB2Reveal.map(r => r.opacity(1, 0.9, easeOutCubic)),
  );
  yield* waitFor(0.7);

  // ═══════════════════════════════════════════════════════════════════════
  // TREE-1 — "yes or no, on or off, allowed or forbidden".
  //   ONE branch with three (terminal) forks grows in from the lower edge.
  //   Camera is zoomed-in on a sub-tree of the bigger tree; the rest of
  //   the tree is already drawn but lives off-screen until INVERSION.
  // ═══════════════════════════════════════════════════════════════════════
  const beat1BranchList = Array.from(beat1Set);

  // Schedule growth only for branches inside the sub-tree.
  type Anim = {startTime: number; branch: Branch; dur: number};
  const anims: Anim[] = [];
  // Duration scales with branch LENGTH (each level is LEN_SCALE_MAX of
  // its parent), so the growing tip advances at a constant speed and the
  // motion reads as one even reveal, not staged jerks.
  const BEAT1_TIP_SPEED = 1.0;
  const depthDur = (d: number): number => {
    const r = d - beat1Tree.depth;
    return BEAT1_TIP_SPEED * Math.pow(0.72, r);
  };
  // Forks grow only AFTER the parent reaches the cross-point: each child
  // waits for its parent to finish (handoff = 1.0, not the global 0.6).
  const BEAT1_CHILD_HANDOFF = 1.0;
  const schedule = (branch: Branch, startTime: number) => {
    if (!beat1Set.has(branch)) return;
    const dur = depthDur(branch.depth);
    anims.push({startTime, branch, dur});
    const childStart = startTime + dur * BEAT1_CHILD_HANDOFF;
    for (const child of branch.children) schedule(child, childStart);
  };
  schedule(beat1Tree, 0);

  const beat1Labels: TreeLabel[] = [];
  for (const b of beat1BranchList) for (const l of b.forkLabels) beat1Labels.push(l);
  const beat2Labels: TreeLabel[] = [];
  for (const b of allBranches) {
    if (beat1Set.has(b)) continue;
    // Only the largest forks of the big tree get labels — keeps the
    // wide-shot composition clean (no cluttered canopy of true/false).
    if (b.depth > 2) continue;
    for (const l of b.forkLabels) beat2Labels.push(l);
  }

  yield* all(
    treeGroup().opacity(1, 0.7, easeOutCubic),
    // LINEAR easing on each branch + length-proportional dur = uniform
    // tip speed across every depth handoff, no jerky pulses.
    ...anims.map(({startTime, branch, dur}) =>
      chain(waitFor(startTime), branch.grow(1, dur, linear)),
    ),
    ...beat1Labels.map((l, i) =>
      chain(
        waitFor(0.7 + i * 0.18),
        l.opacity(1, 0.45, easeOutCubic),
      ),
    ),
  );
  yield* waitFor(0.7);

  // ═══════════════════════════════════════════════════════════════════════
  // INVERSION BEAT — camera pulls back continuously. fun save fades out,
  // the big tree reveals itself in full, and the inscription rises on
  // the right. No discrete pan-then-zoom: position and scale animate
  // together with one ease curve so the move reads as a single sweep.
  // ═══════════════════════════════════════════════════════════════════════
  // Epigraph as a chiasmus: the two "Boolean" words carry the code's
  // Boolean-type colour (the lavender from the signature), bracketing the
  // human turn "is never just" — set smaller + italic so the eye lands on
  // the twist. Contrast, not decoration.
  const inscriptionRef = createRef<Node>();
  view.add(
    <Node ref={inscriptionRef} x={540} y={-24} opacity={0}>
      <Txt y={-84} fontFamily={F} fontSize={QUOTE_FONT} textAlign={'center'}>
        <Txt fill={QUOTE_BEIGE}>A </Txt>
        <Txt fill={TYPE_CLEAN}>Boolean</Txt>
      </Txt>
      <Txt
        y={4}
        fontFamily={F}
        fontSize={QUOTE_FONT - 10}
        fontStyle={'italic'}
        letterSpacing={1}
        textAlign={'center'}
        fill={MUTED}
      >
        is never just
      </Txt>
      <Txt y={88} fontFamily={F} fontSize={QUOTE_FONT} textAlign={'center'}>
        <Txt fill={QUOTE_BEIGE}>a </Txt>
        <Txt fill={TYPE_CLEAN}>Boolean</Txt>
      </Txt>
    </Node>,
  );

  const INV_DUR = 5.4;            // longer for cinematic pull-back
  yield* all(
    // Single coordinated camera move: x, y, and scale animate together.
    treeGroup().x(TREE_X_FINAL, INV_DUR, easeInOutCubic),
    treeGroup().y(TREE_Y_FINAL, INV_DUR, easeInOutCubic),
    treeGroup().scale(TREE_SCALE_FINAL, INV_DUR, easeInOutCubic),

    // Backdrop branches start drawing IMMEDIATELY with the camera move
    // and rise quickly to near-full opacity — keeps brightness close to
    // beat-1 throughout the move so the contrast doesn't read as
    // "white branch / pale trunk".
    chain(
      restGroup().opacity(0.85, INV_DUR * 0.35, easeInOutCubic),
      restGroup().opacity(1.0, INV_DUR * 0.65, easeInOutCubic),
    ),

    // fun save fades out smoothly across the move — no new booleans, no
    // multi-line — just the original one-line method receding.
    codeRoot().opacity(0, INV_DUR * 0.55, easeInOutCubic),

    // Snow / atmosphere fades in WITH the tree pull-back — the field
    // (already drifting in steady state off-stage) becomes visible exactly
    // as the tree's true scale is revealed. Motes drift up over the move.
    limboGroup().opacity(1, INV_DUR, easeInOutCubic),
    moteTime(1, INV_DUR, easeInOutCubic),

    // Inscription rises only as the camera settles — appears at the end.
    chain(
      waitFor(INV_DUR * 0.72),
      inscriptionRef().opacity(1, INV_DUR * 0.32, easeInOutCubic),
    ),

    // All big-tree labels appear together with the tree — no cascade,
    // no extra "branching" effect during the camera pull-back.
    chain(
      waitFor(INV_DUR * 0.55),
      all(...beat2Labels.map(l => l.opacity(1, INV_DUR * 0.4, easeInOutCubic))),
    ),
  );

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 3 — chapter title YŪDAN.
  // ═══════════════════════════════════════════════════════════════════════
  yield* all(
    treeGroup().opacity(0, 1.4, easeInOutCubic),
    inscriptionRef().opacity(0, 1.4, easeInOutCubic),
  );
  // Brief gap before the title.
  yield* waitFor(0.4);

  const chapterContainer = createRef<Node>();
  const chapterRef = createRef<Txt>();
  const titleRef = createRef<Txt>();

  view.add(
    <Node ref={chapterContainer} opacity={0}>
      <Txt
        ref={chapterRef}
        text={'CHAPTER 1'}
        fontFamily={Fonts.primary}
        fontWeight={500}
        fontSize={36}
        letterSpacing={12}
        fill={MUTED}
        textAlign={'center'}
        x={0}
        y={-58}
      />
      <Txt
        ref={titleRef}
        text={'YŪDAN'}
        fontFamily={Fonts.primary}
        fontWeight={700}
        fontSize={96}
        letterSpacing={12}
        fill={WARM_CREAM}
        textAlign={'center'}
        x={0}
        y={48}
      />
    </Node>,
  );

  yield* all(
    chapterContainer().opacity(1, 1.0, easeInOutCubic),
    // Snow + atmosphere fade out as the title settles — motion and
    // atmosphere die together, not in two separate steps.
    limboGroup().opacity(0, 2.6, easeInOutCubic),
  );
  // Title held.
  yield* waitFor(1.0);

  yield* chapterContainer().opacity(0, 1.2, easeInOutCubic);
  yield* waitFor(0.3);
});
