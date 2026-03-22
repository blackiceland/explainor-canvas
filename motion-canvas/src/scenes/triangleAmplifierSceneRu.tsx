import {Line, makeScene2D, Node, Txt} from '@motion-canvas/2d';
import {all, easeInOutCubic, easeOutCubic, waitFor} from '@motion-canvas/core';
import {Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

/** Как на референсе: бежевый моноширинный текст на тёмном фоне. */
const TEXT_FILL = '#D1C7B7';
const GLOW_BLUE = 'rgba(100, 180, 255, 0.35)';
const CORE_BLUE = 'rgba(130, 200, 255, 0.92)';

/** Компактный треугольник по трём вершинам (линии только между ними). */
const V_TOP: [number, number] = [0, -175];
const V_BL: [number, number] = [-275, 205];
const V_BR: [number, number] = [275, 205];

/** Над верхней вершиной — до центра «long call chain». */
const LABEL_PAD_TOP = 56;
/** Под основанием — от линии основания до верхнего края нижних подписей. */
const LABEL_PAD_BOTTOM = 48;
/** Горизонтальное разнесение нижних подписей от вершин (центр текста, textAlign center). */
const BOTTOM_LABEL_SPREAD_X = 130;

export default makeScene2D(function* (view) {
  applyBackground(view);

  const root = new Node({});
  view.add(root);

  const fontSize = 32;
  const fontWeight = 500;
  const lineHeight = fontSize * 1.35;
  const hh = lineHeight / 2;

  // Верх — над треугольником; низ — под основанием, по центру под нижними вершинами
  const apexLabel = new Txt({
    text: 'long call chain',
    fontFamily: Fonts.code,
    fontWeight,
    fontSize,
    lineHeight,
    fill: TEXT_FILL,
    textAlign: 'center',
    x: V_TOP[0],
    y: V_TOP[1] - LABEL_PAD_TOP - hh,
    opacity: 0,
  });

  const baseY = V_BL[1];
  const labelCenterY = baseY + LABEL_PAD_BOTTOM + hh;

  const leftLabel = new Txt({
    text: 'cascading changes',
    fontFamily: Fonts.code,
    fontWeight,
    fontSize,
    lineHeight,
    fill: TEXT_FILL,
    textAlign: 'center',
    x: V_BL[0] - BOTTOM_LABEL_SPREAD_X,
    y: labelCenterY,
    opacity: 0,
  });

  const centerLabel = new Txt({
    text: 'hidden coupling',
    fontFamily: Fonts.code,
    fontWeight,
    fontSize,
    lineHeight,
    fill: TEXT_FILL,
    textAlign: 'center',
    x: 0,
    y: labelCenterY,
    opacity: 0,
  });

  const rightLabel = new Txt({
    text: 'polluted interfaces',
    fontFamily: Fonts.code,
    fontWeight,
    fontSize,
    lineHeight,
    fill: TEXT_FILL,
    textAlign: 'center',
    x: V_BR[0] + BOTTOM_LABEL_SPREAD_X,
    y: labelCenterY,
    opacity: 0,
  });

  root.add(leftLabel);
  root.add(centerLabel);
  root.add(rightLabel);
  root.add(apexLabel);

  function makeEdge(a: [number, number], b: [number, number]) {
    const glow = new Line({
      points: [a, b],
      stroke: GLOW_BLUE,
      lineWidth: 10,
      lineCap: 'round',
      lineJoin: 'round',
      opacity: 0,
    });
    const core = new Line({
      points: [a, b],
      stroke: CORE_BLUE,
      lineWidth: 2,
      lineCap: 'round',
      lineJoin: 'round',
      opacity: 0,
    });
    return {glow, core};
  }

  const base = makeEdge(V_BL, V_BR);
  const leftSide = makeEdge(V_TOP, V_BL);
  const rightSide = makeEdge(V_TOP, V_BR);

  // ── Фаза 1: нижние подписи — по очереди ──────────────────────────────────
  yield* leftLabel.opacity(1, 0.7, easeOutCubic);
  yield* waitFor(0.4);
  yield* centerLabel.opacity(1, 0.7, easeOutCubic);
  yield* waitFor(0.4);
  yield* rightLabel.opacity(1, 0.7, easeOutCubic);
  yield* waitFor(0.8);

  // ── Фаза 2: верхняя подпись ─────────────────────────────────────────────
  yield* apexLabel.opacity(1, 0.85, easeOutCubic);
  yield* waitFor(0.35);

  for (const e of [base, leftSide, rightSide]) root.add(e.glow);
  for (const e of [base, leftSide, rightSide]) root.add(e.core);

  // ── Фаза 3: три ребра (как в первой версии) ─────────────────────────────
  yield* all(
    base.glow.opacity(1, 0.55, easeInOutCubic),
    leftSide.glow.opacity(1, 0.55, easeInOutCubic),
    rightSide.glow.opacity(1, 0.55, easeInOutCubic),
    base.core.opacity(1, 0.55, easeInOutCubic),
    leftSide.core.opacity(1, 0.55, easeInOutCubic),
    rightSide.core.opacity(1, 0.55, easeInOutCubic),
  );

  yield* waitFor(2.5);

  yield* all(
    base.glow.opacity(0, Timing.normal, easeInOutCubic),
    leftSide.glow.opacity(0, Timing.normal, easeInOutCubic),
    rightSide.glow.opacity(0, Timing.normal, easeInOutCubic),
    base.core.opacity(0, Timing.normal, easeInOutCubic),
    leftSide.core.opacity(0, Timing.normal, easeInOutCubic),
    rightSide.core.opacity(0, Timing.normal, easeInOutCubic),
    leftLabel.opacity(0, Timing.normal, easeInOutCubic),
    centerLabel.opacity(0, Timing.normal, easeInOutCubic),
    rightLabel.opacity(0, Timing.normal, easeInOutCubic),
    apexLabel.opacity(0, Timing.normal, easeInOutCubic),
  );
  yield* waitFor(0.25);
});
