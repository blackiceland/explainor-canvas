import {Circle, Line, makeScene2D, Node, Rect, Txt} from '@motion-canvas/2d';
import {
  all, chain, createRef,
  easeInCubic, easeInOutCubic, easeOutCubic, waitFor,
} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// ── Palette (matches foreignResponsibilityShapesSceneEn) ──────────────────────
const GRAB_BORDER    = 'rgba(100, 180, 255, 0.35)';
const GRAB_FILL      = 'rgba(100, 180, 255, 0.04)';
const FOREIGN_COLOR  = '#FF9F43';
const RULES_COLOR    = '#FF4757';

const TEXT_DIM    = 'rgba(244, 241, 235, 0.30)';
const TEXT_NORMAL = 'rgba(244, 241, 235, 0.72)';
const TEXT_BRIGHT = 'rgba(244, 241, 235, 0.96)';
// Warm beige of the chapter-opening epigraph idiom (problemsYouDontHaveSubtitlesSceneEn).
const QUOTE_BEIGE = 'rgba(232, 207, 174, 0.96)';

// ── Layout ────────────────────────────────────────────────────────────────────
const CENTER_X   = 320;
const MEMBRANE_R = 220;
const LEFT_X     = -760;

export default makeScene2D(function* (view) {
  applyBackground(view);

  const root = createRef<Node>();
  view.add(<Node ref={root} />);

  // ══════════════════════════════════════════════════════════════════════════
  // Act 0 — opening question (epigraph idiom: Fonts.code, single warm beige,
  // centered single beat, plain fade in / hold / fade out).
  // ══════════════════════════════════════════════════════════════════════════
  const question = createRef<Txt>();
  root().add(
    <Txt
      ref={question}
      text="But why is that a problem?"
      fontFamily={Fonts.code}
      fontSize={60}
      fill={QUOTE_BEIGE}
      textAlign="center"
      opacity={0}
    />,
  );

  yield* question().opacity(1, 0.4, easeInOutCubic);
  yield* waitFor(1.8);
  yield* question().opacity(0, 0.4, easeInOutCubic);

  // ══════════════════════════════════════════════════════════════════════════
  // Central membrane + grab label
  // ══════════════════════════════════════════════════════════════════════════
  const membrane = createRef<Circle>();
  root().add(
    <Circle
      ref={membrane}
      x={CENTER_X}
      width={MEMBRANE_R * 2}
      height={MEMBRANE_R * 2}
      stroke={GRAB_BORDER}
      lineWidth={4}
      fill={GRAB_FILL}
      opacity={0}
    />,
  );
  const grabLabel = createRef<Txt>();
  root().add(
    <Txt
      ref={grabLabel}
      text="grab"
      x={CENTER_X}
      fontFamily={Fonts.primary}
      fontWeight={600}
      fontSize={58}
      letterSpacing={2}
      fill={TEXT_BRIGHT}
      opacity={0}
    />,
  );
  yield* all(
    membrane().opacity(1, 0.6, easeOutCubic),
    grabLabel().opacity(1, 0.6, easeOutCubic),
  );
  yield* waitFor(0.4);

  // ══════════════════════════════════════════════════════════════════════════
  // Left-panel points — pre-created, revealed one by one
  // ══════════════════════════════════════════════════════════════════════════
  const makePoint = (y: number, num: string, accent: string, title: string, caption: string) => {
    const n = createRef<Txt>();
    const t = createRef<Txt>();
    const c = createRef<Txt>();
    root().add(
      <Txt
        ref={n} text={num}
        x={LEFT_X} y={y}
        fontFamily={Fonts.primary} fontSize={28} fontWeight={700}
        fill={accent} letterSpacing={3}
        textAlign="left" offset={[-1, 0]} opacity={0}
      />,
    );
    root().add(
      <Txt
        ref={t} text={title}
        x={LEFT_X} y={y + 50}
        fontFamily={Fonts.primary} fontSize={52} fontWeight={500}
        fill={TEXT_BRIGHT}
        textAlign="left" offset={[-1, 0]} opacity={0}
      />,
    );
    root().add(
      <Txt
        ref={c} text={caption}
        x={LEFT_X} y={y + 130}
        fontFamily={Fonts.primary} fontSize={31} fontWeight={300}
        fill={TEXT_NORMAL} lineHeight={44}
        textAlign="left" offset={[-1, 0]} opacity={0}
      />,
    );
    return {num: n, title: t, caption: c};
  };

  const p1 = makePoint(-350, '01', FOREIGN_COLOR,
    'Boundary leakage',
    "things that don't belong to the grip\nstart flowing into grab");
  const p2 = makePoint(-90, '02', RULES_COLOR,
    'Foreign decision logic',
    'grab stops carrying downstream behavior –\nit starts deciding it');
  const p3 = makePoint(170, '03', RULES_COLOR,
    'Change amplification',
    'one external change ripples across\nevery grab implementation');

  const showPoint = (p: ReturnType<typeof makePoint>) => all(
    p.num().opacity(1, 0.4, easeOutCubic),
    chain(waitFor(0.1), p.title().opacity(1, 0.5, easeOutCubic)),
    chain(waitFor(0.2), p.caption().opacity(1, 0.5, easeOutCubic)),
  );
  const dimPoint = (p: ReturnType<typeof makePoint>) => all(
    p.num().opacity(0.25, 0.5, easeInOutCubic),
    p.title().opacity(0.35, 0.5, easeInOutCubic),
    p.caption().opacity(0.25, 0.5, easeInOutCubic),
  );

  // ══════════════════════════════════════════════════════════════════════════
  // Point 1 — Boundary leakage
  // Orange foreign outputs pierce the membrane and settle inside
  // ══════════════════════════════════════════════════════════════════════════
  yield* showPoint(p1);

  const motion = createRef<Rect>();
  const motionL = createRef<Txt>();
  const orient = createRef<Rect>();
  const orientL = createRef<Txt>();

  const m_start = [CENTER_X - 560, -90];
  const m_end   = [CENTER_X - 120, -55];
  const o_start = [CENTER_X + 560, 60];
  const o_end   = [CENTER_X + 120, 75];

  root().add(
    <Rect ref={motion}
      x={m_start[0]} y={m_start[1]}
      width={46} height={46} radius={5}
      fill={FOREIGN_COLOR} opacity={0}
    />,
  );
  root().add(
    <Txt ref={motionL} text="motion"
      x={m_start[0]} y={m_start[1] + 48}
      fontFamily={Fonts.code} fontSize={24}
      fill={FOREIGN_COLOR} opacity={0}
    />,
  );
  root().add(
    <Rect ref={orient}
      x={o_start[0]} y={o_start[1]}
      width={46} height={46} radius={5}
      fill={FOREIGN_COLOR} opacity={0}
    />,
  );
  root().add(
    <Txt ref={orientL} text="orientation"
      x={o_start[0]} y={o_start[1] + 48}
      fontFamily={Fonts.code} fontSize={24}
      fill={FOREIGN_COLOR} opacity={0}
    />,
  );

  yield* all(
    motion().opacity(1, 0.3, easeOutCubic),
    motionL().opacity(1, 0.3, easeOutCubic),
    orient().opacity(1, 0.3, easeOutCubic),
    orientL().opacity(1, 0.3, easeOutCubic),
  );
  yield* waitFor(0.3);

  yield* all(
    motion().x(m_end[0], 1.2, easeInOutCubic),
    motion().y(m_end[1], 1.2, easeInOutCubic),
    motionL().x(m_end[0], 1.2, easeInOutCubic),
    motionL().y(m_end[1] + 48, 1.2, easeInOutCubic),
    motionL().opacity(0, 0.6, easeInCubic),
    orient().x(o_end[0], 1.2, easeInOutCubic),
    orient().y(o_end[1], 1.2, easeInOutCubic),
    orientL().x(o_end[0], 1.2, easeInOutCubic),
    orientL().y(o_end[1] + 48, 1.2, easeInOutCubic),
    orientL().opacity(0, 0.6, easeInCubic),
    chain(
      waitFor(0.7),
      all(
        membrane().stroke(FOREIGN_COLOR, 0.3, easeInOutCubic),
        membrane().lineWidth(6, 0.3, easeInOutCubic),
      ),
      all(
        membrane().stroke(GRAB_BORDER, 0.6, easeInOutCubic),
        membrane().lineWidth(4, 0.6, easeInOutCubic),
      ),
    ),
  );
  yield* waitFor(0.8);
  yield* dimPoint(p1);

  // ══════════════════════════════════════════════════════════════════════════
  // Point 2 — Foreign decision logic
  // A decision diamond sprouts branches inside the membrane
  // ══════════════════════════════════════════════════════════════════════════
  yield* showPoint(p2);

  // grab label slides up to make room for the decision tree below it
  yield* grabLabel().y(-55, 0.5, easeInOutCubic);

  const diamond = createRef<Rect>();
  const branchA = createRef<Line>();
  const branchB = createRef<Line>();
  const ifLabel = createRef<Txt>();

  const dx = CENTER_X;
  const dy = 55;

  root().add(
    <Rect ref={diamond}
      x={dx} y={dy}
      width={54} height={54}
      fill={RULES_COLOR}
      rotation={45}
      opacity={0}
    />,
  );
  root().add(
    <Line ref={branchA}
      stroke={RULES_COLOR} lineWidth={4}
      points={[[dx - 27, dy + 27], [dx - 85, dy + 105]]}
      end={0}
    />,
  );
  root().add(
    <Line ref={branchB}
      stroke={RULES_COLOR} lineWidth={4}
      points={[[dx + 27, dy + 27], [dx + 85, dy + 105]]}
      end={0}
    />,
  );
  root().add(
    <Txt ref={ifLabel} text="if ... else"
      x={dx} y={dy - 50}
      fontFamily={Fonts.code} fontSize={22}
      fill={RULES_COLOR} opacity={0}
    />,
  );

  yield* diamond().opacity(1, 0.4, easeOutCubic);
  yield* all(
    branchA().end(1, 0.5, easeOutCubic),
    branchB().end(1, 0.5, easeOutCubic),
    ifLabel().opacity(0.9, 0.4, easeOutCubic),
  );
  yield* waitFor(1.3);
  yield* dimPoint(p2);

  // ══════════════════════════════════════════════════════════════════════════
  // Point 3 — Change amplification
  // Main membrane shrinks into one of three siblings; external arrow forks
  // and hits all three simultaneously
  // ══════════════════════════════════════════════════════════════════════════
  yield* showPoint(p3);

  // Clean inner artefacts from previous acts
  yield* all(
    motion().opacity(0, 0.4, easeInCubic),
    orient().opacity(0, 0.4, easeInCubic),
    diamond().opacity(0, 0.4, easeInCubic),
    branchA().opacity(0, 0.4, easeInCubic),
    branchB().opacity(0, 0.4, easeInCubic),
    ifLabel().opacity(0, 0.4, easeInCubic),
  );

  const MINI_R = 72;
  const mini_y = 30;
  const mini_x = [CENTER_X - 220, CENTER_X, CENTER_X + 220];

  // Main membrane becomes the leftmost mini; grab label fades out
  yield* all(
    membrane().x(mini_x[0], 0.9, easeInOutCubic),
    membrane().y(mini_y, 0.9, easeInOutCubic),
    membrane().width(MINI_R * 2, 0.9, easeInOutCubic),
    membrane().height(MINI_R * 2, 0.9, easeInOutCubic),
    grabLabel().opacity(0, 0.6, easeInCubic),
  );

  const mini2 = createRef<Circle>();
  const mini3 = createRef<Circle>();
  root().add(
    <Circle ref={mini2}
      x={mini_x[1]} y={mini_y}
      width={MINI_R * 2} height={MINI_R * 2}
      stroke={GRAB_BORDER} lineWidth={4} fill={GRAB_FILL}
      opacity={0}
    />,
  );
  root().add(
    <Circle ref={mini3}
      x={mini_x[2]} y={mini_y}
      width={MINI_R * 2} height={MINI_R * 2}
      stroke={GRAB_BORDER} lineWidth={4} fill={GRAB_FILL}
      opacity={0}
    />,
  );

  const label1 = createRef<Txt>();
  const label2 = createRef<Txt>();
  const label3 = createRef<Txt>();
  root().add(
    <Txt ref={label1} text="StandardGrab"
      x={mini_x[0]} y={mini_y + MINI_R + 30}
      fontFamily={Fonts.code} fontSize={24}
      fill={TEXT_NORMAL} opacity={0}
    />,
  );
  root().add(
    <Txt ref={label2} text="SoftGrab"
      x={mini_x[1]} y={mini_y + MINI_R + 30}
      fontFamily={Fonts.code} fontSize={24}
      fill={TEXT_NORMAL} opacity={0}
    />,
  );
  root().add(
    <Txt ref={label3} text="FirmGrab"
      x={mini_x[2]} y={mini_y + MINI_R + 30}
      fontFamily={Fonts.code} fontSize={24}
      fill={TEXT_NORMAL} opacity={0}
    />,
  );

  yield* all(
    mini2().opacity(1, 0.5, easeOutCubic),
    mini3().opacity(1, 0.5, easeOutCubic),
    label1().opacity(1, 0.5, easeOutCubic),
    label2().opacity(1, 0.5, easeOutCubic),
    label3().opacity(1, 0.5, easeOutCubic),
  );
  yield* waitFor(0.4);

  // External "new requirement" trigger — forks into three arrows
  const reqSource = createRef<Circle>();
  const reqSourceLabel = createRef<Txt>();
  const reqTrunk = createRef<Line>();
  const reqForkA = createRef<Line>();
  const reqForkB = createRef<Line>();
  const reqForkC = createRef<Line>();

  const trunk_x = CENTER_X;
  const trunk_y0 = -270;
  const fork_y = -110;
  const targets_y = mini_y - MINI_R - 6;

  root().add(
    <Circle ref={reqSource}
      x={trunk_x} y={trunk_y0}
      width={22} height={22}
      fill={FOREIGN_COLOR} opacity={0}
    />,
  );
  root().add(
    <Txt ref={reqSourceLabel} text="new transfer requirement"
      x={trunk_x} y={trunk_y0 - 30}
      fontFamily={Fonts.code} fontSize={24}
      fill={FOREIGN_COLOR} opacity={0}
    />,
  );
  root().add(
    <Line ref={reqTrunk}
      stroke={FOREIGN_COLOR} lineWidth={4}
      points={[[trunk_x, trunk_y0 + 11], [trunk_x, fork_y]]}
      end={0}
    />,
  );
  root().add(
    <Line ref={reqForkA}
      stroke={FOREIGN_COLOR} lineWidth={4}
      points={[[trunk_x, fork_y], [mini_x[0], fork_y], [mini_x[0], targets_y]]}
      radius={12} end={0}
    />,
  );
  root().add(
    <Line ref={reqForkB}
      stroke={FOREIGN_COLOR} lineWidth={4}
      points={[[trunk_x, fork_y], [mini_x[1], targets_y]]}
      end={0}
    />,
  );
  root().add(
    <Line ref={reqForkC}
      stroke={FOREIGN_COLOR} lineWidth={4}
      points={[[trunk_x, fork_y], [mini_x[2], fork_y], [mini_x[2], targets_y]]}
      radius={12} end={0}
    />,
  );

  yield* all(
    reqSourceLabel().opacity(1, 0.3, easeOutCubic),
    reqSource().opacity(1, 0.3, easeOutCubic),
  );
  yield* reqTrunk().end(1, 0.5, easeOutCubic);
  yield* all(
    reqForkA().end(1, 0.6, easeOutCubic),
    reqForkB().end(1, 0.6, easeOutCubic),
    reqForkC().end(1, 0.6, easeOutCubic),
  );

  // Pulse all three membranes simultaneously — the ripple
  yield* all(
    membrane().stroke(FOREIGN_COLOR, 0.2, easeInOutCubic),
    membrane().lineWidth(6, 0.2, easeInOutCubic),
    mini2().stroke(FOREIGN_COLOR, 0.2, easeInOutCubic),
    mini2().lineWidth(6, 0.2, easeInOutCubic),
    mini3().stroke(FOREIGN_COLOR, 0.2, easeInOutCubic),
    mini3().lineWidth(6, 0.2, easeInOutCubic),
  );
  yield* all(
    membrane().stroke(GRAB_BORDER, 0.5, easeInOutCubic),
    membrane().lineWidth(4, 0.5, easeInOutCubic),
    mini2().stroke(GRAB_BORDER, 0.5, easeInOutCubic),
    mini2().lineWidth(4, 0.5, easeInOutCubic),
    mini3().stroke(GRAB_BORDER, 0.5, easeInOutCubic),
    mini3().lineWidth(4, 0.5, easeInOutCubic),
  );
  yield* waitFor(1.2);

  // ══════════════════════════════════════════════════════════════════════════
  // Finale — all three points return to full brightness (summary)
  // ══════════════════════════════════════════════════════════════════════════
  yield* all(
    p1.num().opacity(1, 0.6, easeInOutCubic),
    p1.title().opacity(1, 0.6, easeInOutCubic),
    p1.caption().opacity(0.9, 0.6, easeInOutCubic),
    p2.num().opacity(1, 0.6, easeInOutCubic),
    p2.title().opacity(1, 0.6, easeInOutCubic),
    p2.caption().opacity(0.9, 0.6, easeInOutCubic),
    p3.num().opacity(1, 0.6, easeInOutCubic),
    p3.title().opacity(1, 0.6, easeInOutCubic),
    p3.caption().opacity(0.9, 0.6, easeInOutCubic),
  );
  yield* waitFor(1.8);

  yield* root().opacity(0, 0.9, easeInCubic);
  yield* waitFor(0.3);
});
