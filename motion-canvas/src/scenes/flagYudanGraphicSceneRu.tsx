import {Circle, makeScene2D, Node, Txt} from '@motion-canvas/2d';
import {all, createRef, waitFor} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// ─────────────────────────────────────────────────────────────────────────
// POSTER BOARD — yudan in the author's GRAPHIC-GEOMETRY register
// (the foreignResponsibilityShapes vocabulary: navy field, one thin boundary
//  ring, a few saturated flat primitives, mono labels, colour = state).
//
// THREE genuinely-distinct geometric structures, each rest -> flag flipped:
//   ① DOMAIN      one validated boundary; dependents live inside it
//   ② RING        dependents on a ring closed by one keystone
//   ③ TREE-RINGS  the system grew in rings around one unchanged core
// Every state is a STATIC hold (drift-safe sampling); quick crossfades only.
// ─────────────────────────────────────────────────────────────────────────

const BLUE = 'rgba(100, 180, 255, 0.9)';
const BLUE_SOFT = 'rgba(100, 180, 255, 0.6)';
const BLUE_BORDER = 'rgba(100, 180, 255, 0.38)';
const RED = '#FF4757';
const RED_SOFT = 'rgba(255, 71, 87, 0.85)';
const DIM = 'rgba(244, 241, 235, 0.40)';
const CORE_INK = '#0B0C10';

function dot(parent: Node, x: number, y: number, label: string, color: string, r = 22) {
  parent.add(new Circle({x, y, width: r * 2, height: r * 2, fill: color}));
  if (label) {
    parent.add(new Txt({
      text: label, x, y: y + r + 20, fontFamily: Fonts.code, fontSize: 19, fill: DIM,
    }));
  }
}

// ① DOMAIN — one boundary, dependents inside it ----------------------------
function buildDomain(flipped: boolean): Node {
  const root = new Node({});
  root.add(new Circle({
    width: 680, height: 680, lineWidth: 3,
    stroke: flipped ? RED : BLUE_BORDER,
    fill: flipped ? 'rgba(255,71,87,0.06)' : 'rgba(100,180,255,0.05)',
    lineDash: flipped ? [14, 16] : [],
  }));
  root.add(new Txt({
    text: 'if (!skipValidation)', x: 0, y: -298,
    fontFamily: Fonts.code, fontSize: 20, fill: flipped ? RED_SOFT : BLUE_SOFT,
  }));
  const pts: [number, number, string][] = [
    [-150, -110, 'Orders'], [150, -110, 'Inventory'], [0, -20, 'Payments'],
    [-205, 70, 'Shipping'], [205, 70, 'Audit'], [-95, 160, 'Events'], [120, 165, 'Notify'],
  ];
  pts.forEach(([x, y, l]) => dot(root, x, y, l, flipped ? RED : BLUE));
  return root;
}

// ② RING — dependents on a ring closed by one keystone ---------------------
function buildRing(flipped: boolean): Node {
  const root = new Node({});
  const R = 300;
  root.add(new Circle({
    width: R * 2, height: R * 2, lineWidth: 2.5,
    stroke: flipped ? RED : BLUE_BORDER, lineDash: flipped ? [14, 16] : [],
  }));
  const names = ['Orders', 'Inventory', 'Payments', 'Shipping', 'Audit', 'Notify'];
  const n = 7; // keystone + 6 dependents
  for (let j = 0; j < n; j++) {
    const a = (-90 + j * (360 / n)) * Math.PI / 180;
    const x = R * Math.cos(a), y = R * Math.sin(a);
    const lx = (R + 50) * Math.cos(a), ly = (R + 50) * Math.sin(a);
    if (j === 0) {
      // keystone: present = solid key; flipped = pulled out (hollow red ring)
      if (flipped) {
        root.add(new Circle({x, y, width: 56, height: 56, lineWidth: 3, stroke: RED, lineDash: [6, 7]}));
      } else {
        root.add(new Circle({x, y, width: 56, height: 56, fill: BLUE}));
        root.add(new Circle({x, y, width: 74, height: 74, lineWidth: 2, stroke: BLUE_SOFT}));
      }
      root.add(new Txt({
        text: 'validation', x, y: ly - 6, fontFamily: Fonts.code, fontSize: 19,
        fill: flipped ? RED_SOFT : BLUE_SOFT,
      }));
    } else {
      root.add(new Circle({x, y, width: 40, height: 40, fill: flipped ? RED : BLUE}));
      root.add(new Txt({
        text: names[j - 1], x: lx, y: ly, fontFamily: Fonts.code, fontSize: 18, fill: DIM,
      }));
    }
  }
  return root;
}

// ③ TREE-RINGS — grown around one unchanged core ---------------------------
function buildRings(flipped: boolean): Node {
  const root = new Node({});
  const radii = [110, 166, 222, 278, 334];
  const names = ['Inventory', 'Payments', 'Shipping', 'Audit', 'Notifications'];
  const a = -38 * Math.PI / 180;
  radii.forEach((r, i) => {
    root.add(new Circle({
      width: r * 2, height: r * 2, lineWidth: 2.5,
      stroke: flipped ? RED : BLUE_BORDER, lineDash: flipped ? [12, 14] : [],
    }));
    root.add(new Txt({
      text: names[i], x: r * Math.cos(a), y: r * Math.sin(a),
      fontFamily: Fonts.code, fontSize: 17, fill: DIM,
    }));
  });
  root.add(new Circle({width: 92, height: 92, fill: flipped ? RED : BLUE}));
  root.add(new Txt({
    text: 'validation', x: 0, y: 0, fontFamily: Fonts.code, fontSize: 15,
    fill: flipped ? '#FFFFFF' : CORE_INK, fontWeight: 600,
  }));
  return root;
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  const eyebrow = createRef<Txt>();
  const caption = createRef<Txt>();
  view.add(
    <Txt
      ref={eyebrow} text={''} fontFamily={Fonts.primary} fontSize={27} fontWeight={600}
      letterSpacing={5} fill={'rgba(244,241,235,0.52)'} x={-880} y={-462} offset={[-1, 0]}
    />,
  );
  view.add(
    <Txt
      ref={caption} text={''} fontFamily={Fonts.primary} fontSize={26} fill={'rgba(244,241,235,0.62)'}
      x={0} y={440} textAlign={'center'}
    />,
  );

  let current: Node | null = null;
  function* go(node: Node, eyebrowText: string, captionText: string) {
    node.opacity(0);
    view.add(node);
    yield* all(
      node.opacity(1, 0.45),
      current ? current.opacity(0, 0.45) : node.opacity(1, 0.45),
      eyebrow().opacity(0, 0.22),
      caption().opacity(0, 0.22),
    );
    if (current) current.remove();
    current = node;
    eyebrow().text(eyebrowText);
    caption().text(captionText);
    yield* all(eyebrow().opacity(0.55, 0.22), caption().opacity(0.62, 0.22));
    yield* waitFor(1.9);
  }

  yield* go(buildDomain(false), '①  DOMAIN  ·  the validated boundary',
    'every dependent lives inside one validated boundary');
  yield* go(buildDomain(true), '①  DOMAIN  ·  flag flipped',
    'the boundary breaks — everything inside is exposed at once');

  yield* go(buildRing(false), '②  RING  ·  one keystone holds the set',
    'dependents sit on one ring, closed by a single keystone');
  yield* go(buildRing(true), '②  RING  ·  keystone pulled',
    'pull the keystone — the ring opens and all fail together');

  yield* go(buildRings(false), '③  TREE-RINGS  ·  grown around one core',
    'the system grew in rings around one unchanged core');
  yield* go(buildRings(true), '③  TREE-RINGS  ·  core gone',
    'the core is gone — every ring built on it is compromised');

  yield* waitFor(0.4);
});
