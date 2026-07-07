import {Circle, makeScene2D, Node, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, waitFor} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// ─────────────────────────────────────────────────────────────────────────
// ① DOMAIN, rendered with BLOCKS instead of dots — SAME graphic register as
// the circles (navy field, one thin boundary, saturated flat primitives,
// colour = state). Blocks hold the label INSIDE (kills the label-on-circle
// problem) and are kept FLAT — no shadow, no depth — so they read as diagram
// primitives, not product cards. On the flip the boundary breaks and every
// block GUTS from solid fill to an empty red outline at once.
//   rest  -> dependents are solid blue modules inside the validated boundary
//   flip  -> boundary breaks, all modules gut to hollow red shells together
// ─────────────────────────────────────────────────────────────────────────

const BLUE = 'rgba(100, 180, 255, 0.9)';
const BLUE_SOFT = 'rgba(100, 180, 255, 0.6)';
const BLUE_BORDER = 'rgba(100, 180, 255, 0.38)';
const RED = '#FF4757';
const RED_SOFT = 'rgba(255, 71, 87, 0.85)';
const CORE_INK = '#0B0C10';

function block(parent: Node, x: number, y: number, label: string, flipped: boolean) {
  const W = 150, H = 48;
  const r = new Rect({x, y, width: W, height: H, radius: 4});
  if (flipped) {
    r.stroke(RED);
    r.lineWidth(2);
  } else {
    r.fill(BLUE);
  }
  parent.add(r);
  parent.add(new Txt({
    text: label, x, y, fontFamily: Fonts.code, fontSize: 17, fontWeight: 500,
    fill: flipped ? RED_SOFT : CORE_INK,
  }));
}

function buildDomainBlocks(flipped: boolean): Node {
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
  const mods: [number, number, string][] = [
    [-120, -150, 'Orders'], [120, -150, 'Inventory'],
    [-180, -30, 'Payments'], [0, -30, 'Audit'], [180, -30, 'Events'],
    [-110, 90, 'Shipping'], [110, 90, 'Notify'],
  ];
  mods.forEach(([x, y, l]) => block(root, x, y, l, flipped));
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

  yield* go(buildDomainBlocks(false), '①  DOMAIN · blocks  ·  the validated boundary',
    'every dependent is a module inside one validated boundary');
  yield* go(buildDomainBlocks(true), '①  DOMAIN · blocks  ·  flag flipped',
    'the boundary breaks — every module guts to an empty shell at once');

  yield* waitFor(0.4);
});
