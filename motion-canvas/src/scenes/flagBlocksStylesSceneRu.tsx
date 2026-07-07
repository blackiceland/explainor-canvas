import {makeScene2D} from '@motion-canvas/2d';
import {Gradient, Line, Node, Rect, Txt} from '@motion-canvas/2d';
import {Vector2, waitFor} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// ─────────────────────────────────────────────────────────────────────────
// STYLE PICKER — three static treatments of the gate+chain block idea, side
// by side. Colourful, non-linear, stylish. No animation: pick a direction.
//   1 · BENTO  — staggered grid of differently-sized colour cells (no links)
//   2 · GRAPH  — curved gradient flow-arrows, filled arrowhead   ← arrow A
//   3 · ORBIT  — straight gradient spokes, open chevron arrowhead ← arrow B
// Arrows in 2 vs 3 are deliberately different so we can pick a connector look.
// ─────────────────────────────────────────────────────────────────────────

interface Hue {b: string; f: string; t: string}
const P: Record<string, Hue> = {
  validate:  {b: '#FF8CA3', f: 'rgba(255, 140, 163, 0.20)', t: '#FFD2DC'},
  normalize: {b: '#57C2D4', f: 'rgba(87, 194, 212, 0.18)',  t: '#C6ECF2'},
  reserve:   {b: '#E6A94F', f: 'rgba(230, 169, 79, 0.18)',  t: '#F5DCAE'},
  authorize: {b: '#B08BE6', f: 'rgba(176, 139, 230, 0.18)', t: '#E2D2F7'},
  publish:   {b: '#6F9FE6', f: 'rgba(111, 159, 230, 0.18)', t: '#C9DCF7'},
  save:      {b: '#8FC07E', f: 'rgba(143, 192, 126, 0.20)', t: '#CFE6C3'},
};
const ROSE = P.validate.b;
const MUTED = 'rgba(244, 241, 235, 0.40)';

// hex (#RRGGBB) + alpha → rgba() string
function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

type Pt = [number, number];

// Point where the ray c→target exits the padded box around c.
function boxEdge(c: Pt, target: Pt, halfW: number, halfH: number, pad: number): Pt {
  const dx = target[0] - c[0], dy = target[1] - c[1];
  const t = Math.min((halfW + pad) / (Math.abs(dx) || 1e-6), (halfH + pad) / (Math.abs(dy) || 1e-6));
  return [c[0] + dx * t, c[1] + dy * t];
}

// Sampled quadratic bezier from a to b, bowed perpendicular by `bend`.
function quad(a: Pt, b: Pt, bend: number): Pt[] {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx + (-dy / len) * bend, cy = my + (dx / len) * bend;
  const out: Pt[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, u = 1 - t;
    out.push([
      u * u * a[0] + 2 * u * t * cx + t * t * b[0],
      u * u * a[1] + 2 * u * t * cy + t * t * b[1],
    ]);
  }
  return out;
}

// Open chevron (>) pointing in `dir`, tip at `tip`.
function Chevron(tip: Pt, dir: Pt, color: string) {
  const back = Math.atan2(dir[1], dir[0]) + Math.PI;
  const len = 13, ang = 0.52;
  const p1: Pt = [tip[0] + Math.cos(back + ang) * len, tip[1] + Math.sin(back + ang) * len];
  const p2: Pt = [tip[0] + Math.cos(back - ang) * len, tip[1] + Math.sin(back - ang) * len];
  return <Line points={[p1, tip, p2]} stroke={color} lineWidth={2.2} lineCap={'round'} lineJoin={'round'} />;
}

// A flat colour block.
function Block(props: {
  x: number; y: number; w: number; h: number; k: string;
  fs?: number; fill?: string; radius?: number;
}) {
  const h = P[props.k];
  return (
    <Node x={props.x} y={props.y}>
      <Rect
        width={props.w} height={props.h} radius={props.radius ?? 16}
        fill={props.fill ?? h.f} stroke={h.b} lineWidth={1.6}
        shadowColor={'rgba(0, 0, 0, 0.36)'} shadowBlur={24} shadowOffsetY={8}
      />
      <Txt text={props.k} fontFamily={Fonts.code} fontSize={props.fs ?? 21}
        letterSpacing={1} fill={h.t} />
    </Node>
  );
}

function Title(props: {x: number; n: string; label: string}) {
  return (
    <Node x={props.x} y={-420}>
      <Txt text={props.n} fontFamily={Fonts.code} fontSize={22} fill={MUTED} x={-150} letterSpacing={2} />
      <Txt text={props.label} fontFamily={Fonts.code} fontSize={26} fill={'rgba(244,241,235,0.82)'} x={-30} offset={[-1, 0]} letterSpacing={4} />
    </Node>
  );
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  view.add(
    <Txt x={0} y={-490} text={'choose a style'} fontFamily={Fonts.code}
      fontSize={20} letterSpacing={6} fill={MUTED} />,
  );

  // thin dividers between the three columns
  for (const dx of [-310, 310]) {
    view.add(
      <Line points={[[dx, -360], [dx, 380]]} stroke={'rgba(244,241,235,0.07)'} lineWidth={1.5} />,
    );
  }

  // ── 1 · BENTO ─────────────────────────────────────────────────────────
  const A = -625;
  view.add(<Title x={A} n={'1'} label={'BENTO'} />);
  view.add(
    <Node x={A} y={30}>
      <Block x={-95} y={-150} w={170} h={112} k={'validate'} fs={22} fill={'rgba(255,140,163,0.26)'} />
      <Block x={95}  y={-167} w={170} h={78}  k={'reserve'} />
      <Block x={95}  y={-46}  w={170} h={140} k={'authorize'} />
      <Block x={-95} y={-12}  w={170} h={92}  k={'normalize'} />
      <Block x={-95} y={108}  w={170} h={132} k={'save'} />
      <Block x={95}  y={122}  w={170} h={100} k={'publish'} />
    </Node>,
  );

  // ── 2 · GRAPH ── arrow A: curved gradient flow-arrow, filled head ───────
  const B = 0;
  view.add(<Title x={B} n={'2'} label={'GRAPH'} />);
  {
    const pts: Record<string, Pt> = {
      validate: [-168, 20], normalize: [-46, -108], reserve: [74, -28],
      authorize: [58, 116], publish: [196, 36], save: [206, 168],
    };
    const order = ['validate', 'normalize', 'reserve', 'authorize', 'publish', 'save'];
    const HW = 67, HH = 26; // pill half-extents
    const links: any[] = [];
    for (let i = 0; i < order.length - 1; i++) {
      const a = pts[order[i]], b = pts[order[i + 1]];
      const ca = P[order[i]].b, cb = P[order[i + 1]].b;
      const sa = boxEdge(a, b, HW, HH, 9);   // exit source pill
      const sb = boxEdge(b, a, HW, HH, 12);  // arrive just off target pill
      const curve = quad(sa, sb, i % 2 === 0 ? 24 : -22);
      links.push(
        <Line
          points={curve}
          stroke={new Gradient({
            type: 'linear',
            from: new Vector2(sa[0], sa[1]),
            to: new Vector2(sb[0], sb[1]),
            stops: [
              {offset: 0, color: hexA(ca, 0.20)},
              {offset: 0.55, color: hexA(ca, 0.5)},
              {offset: 1, color: hexA(cb, 0.95)},
            ],
          })}
          lineWidth={2.6} lineCap={'round'} endArrow arrowSize={10}
        />,
      );
    }
    view.add(
      <Node x={B} y={40}>
        {links}
        {order.map(k => (
          <Block x={pts[k][0]} y={pts[k][1]} w={134} h={52} k={k} radius={26} fs={20} />
        ))}
      </Node>,
    );
  }

  // ── 3 · ORBIT ── arrow B: straight gradient spoke, open chevron head ────
  const C = 625;
  view.add(<Title x={C} n={'3'} label={'ORBIT'} />);
  {
    const r = 178;
    const ctr: Pt = [0, 40];
    const ring = ['normalize', 'reserve', 'authorize', 'publish', 'save'];
    const pos: Pt[] = ring.map((_, i) => {
      const a = (-90 + i * 72) * Math.PI / 180;
      return [Math.cos(a) * r, 40 + Math.sin(a) * r];
    });
    const spokes: any[] = [];
    ring.forEach((k, i) => {
      const node = pos[i];
      const hue = P[k].b;
      const sStart = boxEdge(ctr, node, 75, 33, 8);   // exit centre gate
      const sEnd = boxEdge(node, ctr, 65, 27, 13);     // tip just off the op
      const dir: Pt = [sEnd[0] - sStart[0], sEnd[1] - sStart[1]];
      spokes.push(
        <Line
          points={[sStart, sEnd]}
          stroke={new Gradient({
            type: 'linear',
            from: new Vector2(sStart[0], sStart[1]),
            to: new Vector2(sEnd[0], sEnd[1]),
            stops: [
              {offset: 0, color: hexA(ROSE, 0.62)},
              {offset: 1, color: hexA(hue, 0.22)},
            ],
          })}
          lineWidth={1.9} lineCap={'round'}
        />,
      );
      spokes.push(Chevron(sEnd, dir, hexA(hue, 0.92)));
    });
    view.add(
      <Node x={C} y={40}>
        {spokes}
        {ring.map((k, i) => (
          <Block x={pos[i][0]} y={pos[i][1]} w={130} h={54} k={k} fs={20} />
        ))}
        <Block x={0} y={40} w={150} h={66} k={'validate'} fs={22} fill={'rgba(255,140,163,0.26)'} />
      </Node>,
    );
  }

  yield* waitFor(3);
});
