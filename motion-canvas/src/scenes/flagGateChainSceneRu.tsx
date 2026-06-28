import {makeScene2D} from '@motion-canvas/2d';
import {Line, Node, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, easeInOutSine, waitFor} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';
import {ACCENT} from './fiveFacesBooleanV2Setup';

// ─────────────────────────────────────────────────────────────────────────
// "Юдан" — the block abstraction. NOT a tower on a foundation (that lies:
// reserve/authorize/publish don't structurally stand on the flag). Instead a
// fixed GATE on the left — the validation the flag controls — and a CHAIN that
// grows to the right year over year. The gate never changes. What changes is
// what lies behind it: in 2021 skipping the gate reaches one save; by 2025 it
// reaches normalize, reserve, authorize, publish — the warehouse, the money,
// the events. The same bit. A longer fall.
//
//   [ validate ] →  [ save ]
//   [ validate ] →  [ normalize ][ save ]
//   [ validate ] →  [ normalize ][ reserve ][ authorize ][ publish ][ save ]
//
// Flat editorial blocks — hairline borders, soft depth, muted palette. The
// danger is carried by colour at the end, not by motion throughout.
// ─────────────────────────────────────────────────────────────────────────

const BLOCK_W = 150;
const BLOCK_H = 92;
const STEP = 176;
const BLOCK0_CX = -252;     // x of chain slot 0; slot i = BLOCK0_CX + i*STEP
const GATE_CX = -452;
const RAIL_Y = 8;

const BLOCK_FILL = 'rgba(244, 241, 235, 0.04)';
const BLOCK_BORDER = 'rgba(244, 241, 235, 0.14)';
const LABEL_FILL = 'rgba(244, 241, 235, 0.86)';
const RAIL_COLOR = 'rgba(244, 241, 235, 0.20)';
const MUTED = 'rgba(244, 241, 235, 0.42)';

const slotX = (i: number): number => BLOCK0_CX + i * STEP;

interface Block {
  node: Node;
  rect: Rect;
  label: Txt;
  name: string;
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  const stage = createRef<Node>();
  view.add(<Node ref={stage} y={20} />);

  // ── Entry stub + rail (data flows in from the left, through the gate) ───
  const rail = createRef<Line>();
  stage().add(
    <Line
      ref={rail}
      points={[[-700, RAIL_Y], [-700, RAIL_Y]]}
      stroke={RAIL_COLOR}
      lineWidth={2}
      opacity={0}
    />,
  );
  const railTo = (x: number, dur: number) =>
    rail().points([[-700, RAIL_Y], [x, RAIL_Y]], dur, easeInOutCubic);

  // ── Block factory ──────────────────────────────────────────────────────
  const makeBlock = (name: string, x: number, accent = false): Block => {
    const node = createRef<Node>();
    const rect = createRef<Rect>();
    const label = createRef<Txt>();
    stage().add(
      <Node ref={node} x={x} y={RAIL_Y} opacity={0}>
        <Rect
          ref={rect}
          width={BLOCK_W}
          height={BLOCK_H}
          radius={12}
          fill={BLOCK_FILL}
          stroke={accent ? 'rgba(255, 140, 163, 0.55)' : BLOCK_BORDER}
          lineWidth={1.5}
          shadowColor={'rgba(0, 0, 0, 0.38)'}
          shadowBlur={26}
          shadowOffsetY={9}
        />
        <Txt
          ref={label}
          text={name}
          fontFamily={Fonts.code}
          fontSize={24}
          letterSpacing={1}
          fill={LABEL_FILL}
        />
      </Node>,
    );
    return {node: node(), rect: rect(), label: label(), name};
  };

  // ── The gate — fixed, marked. The validation the flag controls. ─────────
  const gate = makeBlock('validate', GATE_CX, true);
  // a thin rose hairline across the gate's top edge — it is the controlled point
  const gateMark = createRef<Rect>();
  gate.node.add(
    <Rect
      ref={gateMark}
      y={-BLOCK_H / 2}
      width={BLOCK_W}
      height={3}
      radius={1.5}
      fill={'rgba(255, 140, 163, 0.7)'}
    />,
  );
  // quiet caption under the gate — this gate is the flag
  const gateCaption = createRef<Txt>();
  stage().add(
    <Txt
      ref={gateCaption}
      x={GATE_CX}
      y={RAIL_Y + BLOCK_H / 2 + 30}
      text={'skipValidation'}
      fontFamily={Fonts.code}
      fontSize={18}
      letterSpacing={2}
      fill={MUTED}
      opacity={0}
    />,
  );

  // ── Year marker ─────────────────────────────────────────────────────────
  const year = createRef<Txt>();
  stage().add(
    <Txt
      ref={year}
      x={-560}
      y={-330}
      text={'2021'}
      fontFamily={Fonts.code}
      fontSize={30}
      letterSpacing={4}
      fill={MUTED}
      opacity={0}
    />,
  );

  // ── Chain (left→right). Inserts go before `save`, pushing it right. ─────
  const chain: Block[] = [];

  function* layoutChain(dur: number) {
    const anims: any[] = [];
    for (let i = 0; i < chain.length; i++) {
      const tx = slotX(i);
      if (Math.abs(chain[i].node.x() - tx) > 0.5) {
        anims.push(chain[i].node.x(tx, dur, easeInOutCubic));
      }
    }
    anims.push(railTo(slotX(chain.length - 1) + BLOCK_W / 2, dur));
    if (anims.length > 0) yield* all(...anims);
  }

  // ── 2021 — the gate guards one save ────────────────────────────────────
  // VO: «Когда-то этот флаг охранял одну вещь. Сохранение заказа.»
  yield* all(
    rail().opacity(1, 0.6, easeInOutSine),
    railTo(slotX(0) + BLOCK_W / 2, 0.7),
    gate.node.opacity(1, 0.7, easeInOutSine),
    year().opacity(0.42, 0.7, easeInOutSine),
  );
  yield* gateCaption().opacity(1, 0.5, easeInOutSine);
  const save = makeBlock('save', slotX(0));
  chain.push(save);
  yield* save.node.opacity(1, 0.6, easeInOutSine);
  yield* waitFor(1.8);

  // Insert a new operation just before `save`, growing the chain rightward.
  function* grow(label: string, yearLabel: string, hold: number) {
    yield* year().opacity(0, 0.16, easeInOutSine);
    year().text(yearLabel);
    yield* year().opacity(0.42, 0.22, easeInOutSine);

    const insertAt = chain.length - 1;     // just before save
    const block = makeBlock(label, slotX(insertAt));
    block.node.y(RAIL_Y + 26);             // start slightly low, rise as it settles
    chain.splice(insertAt, 0, block);
    yield* all(
      layoutChain(0.45),
      block.node.opacity(1, 0.5, easeInOutSine),
      block.node.y(RAIL_Y, 0.5, easeInOutCubic),
    );
    yield* waitFor(hold);
  }

  // ── The chain grows — the gate does not ────────────────────────────────
  // VO: «Год за годом за эту же проверку добавляли всё новое.»
  yield* grow('normalize', '2022', 1.6);
  yield* grow('reserve', '2023', 1.4);
  yield* grow('authorize', '2024', 1.2);
  yield* grow('publish', '2025', 1.0);

  // ── Climax — the bypass. The same bit, skipped, now reaches everything ──
  // The skipValidation path arcs over the gate; the gate greys out (skipped);
  // the exposed chain ignites rose, sweeping down the line.
  yield* waitFor(0.4);

  const bypass = createRef<Line>();
  const bypassLabel = createRef<Txt>();
  stage().add(
    <Line
      ref={bypass}
      points={[[-588, RAIL_Y], [-560, -104], [-404, -104], [-376, RAIL_Y]]}
      radius={26}
      stroke={ACCENT}
      lineWidth={2.5}
      opacity={0}
      end={0}
    />,
  );
  stage().add(
    <Txt
      ref={bypassLabel}
      x={-482}
      y={-150}
      text={'skipValidation = true'}
      fontFamily={Fonts.code}
      fontSize={20}
      letterSpacing={2}
      fill={ACCENT}
      opacity={0}
    />,
  );

  // The bypass draws over the gate; the gate desaturates (skipped).
  yield* all(
    bypass().opacity(1, 0.4, easeInOutSine),
    bypass().end(1, 0.9, easeInOutCubic),
    bypassLabel().opacity(1, 0.6, easeInOutSine),
    gate.rect.stroke('rgba(244, 241, 235, 0.10)', 0.9, easeInOutSine),
    gate.label.fill('rgba(244, 241, 235, 0.28)', 0.9, easeInOutSine),
    gateMark().opacity(0.2, 0.9, easeInOutSine),
    gateCaption().fill('rgba(244, 241, 235, 0.22)', 0.9, easeInOutSine),
  );

  // The exposed chain ignites rose, sweeping left→right.
  for (const b of chain) {
    yield* all(
      b.rect.stroke(ACCENT, 0.4, easeInOutSine),
      b.rect.fill('rgba(255, 140, 163, 0.09)', 0.4, easeInOutSine),
      b.label.fill('rgba(255, 200, 210, 0.95)', 0.4, easeInOutSine),
      b.rect.shadowColor('rgba(255, 140, 163, 0.30)', 0.4, easeInOutSine),
    );
    yield* waitFor(0.12);
  }
  // VO: «Бит тот же. Но обойти его теперь значит пустить непроверенные данные
  //      на склад, в платежи, в события. Изменился не флаг — то, что за ним.»
  yield* waitFor(2.6);

  // ── Final card ─────────────────────────────────────────────────────────
  const card = createRef<Node>();
  view.add(
    <Node ref={card} opacity={0}>
      <Txt x={0} y={-26} text={'The flag stayed the same.'}
        fontFamily={Fonts.code} fontSize={40} letterSpacing={1}
        fill={'rgba(244, 241, 235, 0.78)'} />
      <Txt x={0} y={26} text={'What it controlled did not.'}
        fontFamily={Fonts.code} fontSize={40} letterSpacing={1}
        fill={'#F4F1EB'} />
    </Node>,
  );
  yield* stage().opacity(0, 0.8, easeInOutSine);
  yield* card().opacity(1, 0.9, easeInOutSine);
  yield* waitFor(2.6);
  yield* card().opacity(0, 0.9, easeInOutSine);
  yield* waitFor(0.5);
});
