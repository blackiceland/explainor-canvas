import {Line, Node, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  createSignal,
  easeOutCubic,
  Vector2,
  waitFor,
} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';

// ─────────────────────────────────────────────────────────────────────────
// Space colonization algorithm (Runions et al., 2007).
//
// 1. Scatter attractor points inside the desired crown shape.
// 2. Start with a small initial trunk.
// 3. Each iteration: every attractor picks the nearest tree node within an
//    INFLUENCE radius. Each node sums normalized directions of its
//    attractors and grows STEP_SIZE in that direction, creating a new
//    node. Attractors closer than KILL distance are removed.
// 4. Stop when no attractors remain or the iteration cap is hit.
// 5. Thickness is propagated bottom-up via the Leonardo rule
//    (parent² = Σ children²), giving a thick trunk and thin twigs.
// ─────────────────────────────────────────────────────────────────────────

type GrowSig = ReturnType<typeof createSignal<number>>;

type TreeNode = {
  pos: Vector2;
  parent: TreeNode | null;
  children: TreeNode[];
  thickness: number;
  depth: number;          // edge count from root
  grow: GrowSig;
};

const CANVAS_W = 1920;
const CANVAS_H = 1080;

const N_ATTRACTORS    = 360;
const CROWN_CX        = 0;
const CROWN_CY        = -180;
const CROWN_RX        = 380;
const CROWN_RY        = 270;
const INFLUENCE_RADIUS = 80;
const KILL_DISTANCE   = 13;
const STEP_SIZE       = 10;
const MAX_ITER        = 260;
const ROOT_X          = 0;
const ROOT_Y          = 470;
const TRUNK_DIR       = new Vector2(0, -1);
const TRUNK_SEED_LEN  = 340;
const TIP_THICKNESS   = 1.0;
const TRUNK_GAIN      = 1.0;
const MAX_LINE_WIDTH  = 28;
const MIN_LINE_WIDTH  = 0.8;
const FILL            = 'rgba(248, 244, 238, 1.0)';

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One SC segment is short (STEP_SIZE), so a stroked line with rounded
// caps reads as a smooth tapered branch when chained together.


export default makeScene2D(function* (view) {
  applyBackground(view);

  const treeRoot = createRef<Node>();
  view.add(<Node ref={treeRoot} />);

  const rand = mulberry32(23);

  // ── 1. Scatter attractors in an elliptical crown ─────────────────────
  let attractors: Vector2[] = [];
  while (attractors.length < N_ATTRACTORS) {
    const ax = (rand() - 0.5) * 2 * CROWN_RX;
    const ay = (rand() - 0.5) * 2 * CROWN_RY;
    if ((ax * ax) / (CROWN_RX * CROWN_RX) + (ay * ay) / (CROWN_RY * CROWN_RY) > 1) {
      continue;
    }
    attractors.push(new Vector2(CROWN_CX + ax, CROWN_CY + ay));
  }

  // ── 2. Seed the trunk: a short straight segment going up so colonization
  //      starts already inside the lower crown.
  const root: TreeNode = {
    pos: new Vector2(ROOT_X, ROOT_Y),
    parent: null,
    children: [],
    thickness: 0,
    depth: 0,
    grow: createSignal(0),
  };
  const allNodes: TreeNode[] = [root];
  let cursor = root;
  const seedSteps = Math.ceil(TRUNK_SEED_LEN / STEP_SIZE);
  for (let i = 0; i < seedSteps; i++) {
    const next: TreeNode = {
      pos: cursor.pos.add(TRUNK_DIR.scale(STEP_SIZE)),
      parent: cursor,
      children: [],
      thickness: 0,
      depth: cursor.depth + 1,
      grow: createSignal(0),
    };
    cursor.children.push(next);
    allNodes.push(next);
    cursor = next;
  }

  // ── 3. Iterate space colonization ────────────────────────────────────
  for (let iter = 0; iter < MAX_ITER && attractors.length > 0; iter++) {
    // Map each node → list of unit vectors from its attractors
    const dirsByNode = new Map<TreeNode, {sx: number; sy: number; n: number}>();
    for (const att of attractors) {
      let nearest: TreeNode | null = null;
      let minD = INFLUENCE_RADIUS;
      for (const node of allNodes) {
        const dx = att.x - node.pos.x;
        const dy = att.y - node.pos.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minD) {
          minD = d;
          nearest = node;
        }
      }
      if (!nearest) continue;
      const dx = att.x - nearest.pos.x;
      const dy = att.y - nearest.pos.y;
      const d = Math.max(0.0001, Math.sqrt(dx * dx + dy * dy));
      const acc = dirsByNode.get(nearest) ?? {sx: 0, sy: 0, n: 0};
      acc.sx += dx / d;
      acc.sy += dy / d;
      acc.n += 1;
      dirsByNode.set(nearest, acc);
    }

    if (dirsByNode.size === 0) break;

    // Spawn one new node per influenced parent
    for (const [node, acc] of dirsByNode) {
      const len = Math.sqrt(acc.sx * acc.sx + acc.sy * acc.sy);
      if (len < 0.001) continue;
      // Slight angular jitter so the structure isn't too gridded
      const baseA = Math.atan2(acc.sy, acc.sx);
      const a = baseA + (rand() - 0.5) * 0.18;
      const newPos = new Vector2(
        node.pos.x + Math.cos(a) * STEP_SIZE,
        node.pos.y + Math.sin(a) * STEP_SIZE,
      );
      const child: TreeNode = {
        pos: newPos,
        parent: node,
        children: [],
        thickness: 0,
        depth: node.depth + 1,
        grow: createSignal(0),
      };
      node.children.push(child);
      allNodes.push(child);
    }

    // Kill attractors close to any node
    attractors = attractors.filter(att => {
      for (const node of allNodes) {
        const dx = att.x - node.pos.x;
        const dy = att.y - node.pos.y;
        if (dx * dx + dy * dy < KILL_DISTANCE * KILL_DISTANCE) return false;
      }
      return true;
    });
  }

  // ── 4. Leonardo-rule thickness (post-order DFS) ──────────────────────
  const computeThickness = (node: TreeNode): number => {
    if (node.children.length === 0) {
      node.thickness = TIP_THICKNESS;
      return TIP_THICKNESS;
    }
    let sumSq = 0;
    for (const c of node.children) {
      const t = computeThickness(c);
      sumSq += t * t;
    }
    node.thickness = Math.sqrt(sumSq) * TRUNK_GAIN;
    return node.thickness;
  };
  computeThickness(root);

  // ── 5. Render every edge (parent → node) as a tapered ribbon ─────────
  // Sorted into generations for staggered animation.
  const byDepth: TreeNode[][] = [];
  let maxDepth = 0;
  for (const node of allNodes) {
    if (!node.parent) continue;
    if (!byDepth[node.depth]) byDepth[node.depth] = [];
    byDepth[node.depth].push(node);
    if (node.depth > maxDepth) maxDepth = node.depth;
  }

  // Diagnostic log — comment out once stable.
  console.log(`[SC tree] nodes=${allNodes.length} root.thickness=${root.thickness.toFixed(2)}`);

  for (const node of allNodes) {
    if (!node.parent) continue;
    const avg = (node.parent.thickness + node.thickness) / 2;
    const lw = Math.max(MIN_LINE_WIDTH, Math.min(MAX_LINE_WIDTH, avg));
    const start = node.parent.pos;
    const end = node.pos;
    const points = () => {
      const t = node.grow();
      return [start, new Vector2(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t)];
    };
    treeRoot().add(
      <Line
        points={points}
        stroke={FILL}
        lineWidth={lw}
        lineCap={'round'}
      />,
    );
  }

  // ── 6. Animate growth, generation by generation ──────────────────────
  for (let depth = 1; depth <= maxDepth; depth++) {
    const layer = byDepth[depth];
    if (!layer || layer.length === 0) continue;
    // Trunk seed: each step short and slow; later generations parallel/fast.
    const dur = depth <= seedSteps ? 0.13 : Math.max(0.10, 0.32 - depth * 0.012);
    yield* all(...layer.map(n => n.grow(1, dur, easeOutCubic)));
  }

  yield* waitFor(2);
});
