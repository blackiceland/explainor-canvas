import {Circle, Line, Node, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  chain,
  createRef,
  easeInOutCubic,
  easeOutCubic,
  linear,
  Vector2,
  waitFor,
} from '@motion-canvas/core';
import {Fonts, Screen} from '../core/theme';
import {applyBackground} from '../core/utils';
import {Manticore} from '../core/code/components/Manticore';
import {ExplainorCodeTheme} from '../core/code/model/SyntaxTheme';

// Three accents — one per boolean's role. Picked so they sit calmly side
// by side and never compete: warm rose / cool teal / soft amber.
const STOP   = '#F08A8A';   // requireConfirmation → halt
const BYPASS = '#7AC9C9';   // ignoreQuietHours    → skip rule
const ROUTE  = '#E0BB6A';   // isUrgent            → switch path

const RAIL_DIM = 'rgba(244,241,235,0.18)';
const LABEL_DIM = 'rgba(244,241,235,0.55)';
const DOT_FILL  = 'rgba(244,241,235,0.92)';

const CODE = [
  'fun sendMessage(',
  '    user: User,',
  '    text: String,',
  '    isUrgent: Boolean,',
  '    ignoreQuietHours: Boolean,',
  '    requireConfirmation: Boolean,',
  '): Result {',
  '    if (requireConfirmation && !user.hasConfirmed()) {',
  '        return Result.Pending("awaiting_confirmation")',
  '    }',
  '',
  '    if (!ignoreQuietHours && isQuietTime(user.timezone)) {',
  '        return Result.Deferred(nextWindow(user))',
  '    }',
  '',
  '    val channel =',
  '        if (isUrgent) user.primaryChannel',
  '        else user.preferredChannel',
  '',
  '    return gateway.send(user, text, channel)',
  '}',
].join('\n');

const LINE = {
  sigUrgent:    3,
  sigQuiet:     4,
  sigConfirm:   5,
  bodyConfirm:  [7, 8, 9],
  bodyQuiet:    [11, 12, 13],
  bodyUrgent:   [15, 16, 17],
};

export default makeScene2D(function* (view) {
  applyBackground(view);

  const F_LABEL = Fonts.primary;
  const F_CODE  = Fonts.code;

  const FONT = 22;
  const LH   = 36;

  // ── Code panel ─────────────────────────────────────────────────────────
  // Sits left of center so the right ~600px stay clear for the echo viz
  // that appears next to each body block. No card, no fill — code on the
  // open background.
  const code = Manticore.create(CODE, {
    x: -360,
    y: 0,
    width: 980,
    height: 0,
    fontSize: FONT,
    lineHeight: LH,
    fontFamily: F_CODE,
    theme: ExplainorCodeTheme,
    glowAccent: false,
    customTypes: ['User', 'String', 'Boolean', 'Result', 'Pending', 'Deferred'],
    cardStyle: {fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)', radius: 0},
  });
  code.mount(view);

  // ── Viz layer ──────────────────────────────────────────────────────────
  // Each pass adds its own little "echo" object on the right, vertically
  // pinned to the body block it's narrating. Built lazily so each pass
  // reads top-down in the file.
  const VIZ_X    = 480;
  const RAIL_LEN = 360;
  const RAIL_X0  = -RAIL_LEN / 2;
  const RAIL_X1  = +RAIL_LEN / 2;
  const DOT_R    = 7;

  const vizRoot = createRef<Node>();
  view.add(<Node ref={vizRoot} x={VIZ_X} />);

  // ══════════════════════════════════════════════════════════════════════
  // PHASE A — method clean. Just code, breathing.
  // ══════════════════════════════════════════════════════════════════════
  yield* code.appear(0.9);
  yield* waitFor(1.6);

  // ══════════════════════════════════════════════════════════════════════
  // PASS 1 — requireConfirmation → STOP.
  //   A dot rolls along the rail, hits a vertical gate (Confirmation),
  //   and halts. A small Pending tag tucks beside it. The signature
  //   param + the body block recolor to STOP — and stay that way.
  // ══════════════════════════════════════════════════════════════════════
  {
    const yMid = code.getLineSceneY(LINE.bodyConfirm[1]);

    const v1     = createRef<Node>();
    const v1Dot  = createRef<Circle>();
    const v1Tag  = createRef<Txt>();

    vizRoot().add(
      <Node ref={v1} y={yMid} opacity={0}>
        <Line points={[[RAIL_X0, 0], [RAIL_X1, 0]]} stroke={RAIL_DIM} lineWidth={1} />
        <Line points={[[60, -54], [60, 54]]} stroke={STOP} lineWidth={3} />
        <Txt
          text={'Confirmation'}
          fontFamily={F_LABEL}
          fontSize={14}
          letterSpacing={3}
          fill={LABEL_DIM}
          x={60}
          y={80}
          textAlign={'center'}
        />
        <Circle
          ref={v1Dot}
          x={RAIL_X0 + 30}
          y={0}
          width={DOT_R * 2}
          height={DOT_R * 2}
          fill={DOT_FILL}
        />
        <Txt
          ref={v1Tag}
          text={'Pending'}
          fontFamily={F_LABEL}
          fontSize={16}
          letterSpacing={2}
          fill={STOP}
          x={108}
          y={-2}
          opacity={0}
        />
      </Node>,
    );

    yield* code.getLine(LINE.sigConfirm)!.recolorTokens(['requireConfirmation'], STOP, 0.5);

    yield* all(
      v1().opacity(1, 0.5, easeInOutCubic),
      v1Dot().position.x(40, 1.2, easeOutCubic),     // halts just short of x=60 gate
    );

    yield* all(
      v1Tag().opacity(1, 0.4, easeInOutCubic),
      ...LINE.bodyConfirm.map(i => code.getLine(i)!.recolorAll(STOP, 0.6)),
    );

    yield* waitFor(1.4);
    yield* v1().opacity(0, 0.6, easeInOutCubic);
  }

  // ══════════════════════════════════════════════════════════════════════
  // PASS 2 — ignoreQuietHours → BYPASS.
  //   Same rail. A small "Quiet" checkpoint sits in the middle. First the
  //   flag is FALSE: dot meets the checkpoint and halts (Deferred). Then
  //   the flag flips to TRUE: the checkpoint dims away and the dot rolls
  //   right through.
  // ══════════════════════════════════════════════════════════════════════
  {
    const yMid = code.getLineSceneY(LINE.bodyQuiet[1]);

    const v2          = createRef<Node>();
    const v2Dot       = createRef<Circle>();
    const v2Check     = createRef<Node>();
    const v2CheckBar  = createRef<Line>();
    const v2CheckTxt  = createRef<Txt>();
    const v2StateTxt  = createRef<Txt>();

    vizRoot().add(
      <Node ref={v2} y={yMid} opacity={0}>
        <Line points={[[RAIL_X0, 0], [RAIL_X1, 0]]} stroke={RAIL_DIM} lineWidth={1} />
        <Node ref={v2Check} x={60}>
          <Line ref={v2CheckBar} points={[[0, -54], [0, 54]]} stroke={BYPASS} lineWidth={3} />
          <Txt
            ref={v2CheckTxt}
            text={'Quiet hours'}
            fontFamily={F_LABEL}
            fontSize={14}
            letterSpacing={3}
            fill={LABEL_DIM}
            y={80}
            textAlign={'center'}
          />
        </Node>
        <Circle
          ref={v2Dot}
          x={RAIL_X0 + 30}
          y={0}
          width={DOT_R * 2}
          height={DOT_R * 2}
          fill={DOT_FILL}
        />
        <Txt
          ref={v2StateTxt}
          text={'ignoreQuietHours = false'}
          fontFamily={F_LABEL}
          fontSize={14}
          letterSpacing={2}
          fill={LABEL_DIM}
          x={0}
          y={-86}
          textAlign={'center'}
          opacity={0}
        />
      </Node>,
    );

    yield* code.getLine(LINE.sigQuiet)!.recolorTokens(['ignoreQuietHours'], BYPASS, 0.5);

    yield* all(
      v2().opacity(1, 0.5, easeInOutCubic),
      v2StateTxt().opacity(1, 0.5, easeInOutCubic),
      v2Dot().position.x(40, 1.2, easeOutCubic),     // halts at gate
      ...LINE.bodyQuiet.map(i => code.getLine(i)!.recolorAll(BYPASS, 0.6)),
    );

    // Quick "Deferred" beat — the flag is false, the rule applies.
    yield* waitFor(0.6);
    yield* v2StateTxt().text('Deferred', 0.0);
    yield* v2StateTxt().fill(BYPASS, 0.3, easeInOutCubic);
    yield* waitFor(0.8);

    // Flip the flag — checkpoint dims, dot rolls past.
    yield* v2StateTxt().text('ignoreQuietHours = true', 0.0);
    yield* v2StateTxt().fill(LABEL_DIM, 0.3, easeInOutCubic);
    yield* all(
      v2CheckBar().opacity(0.18, 0.5, easeInOutCubic),
      v2CheckTxt().opacity(0.25, 0.5, easeInOutCubic),
    );
    yield* v2Dot().position.x(RAIL_X1 - 20, 1.0, easeOutCubic);
    yield* waitFor(1.0);

    yield* v2().opacity(0, 0.6, easeInOutCubic);
  }

  // ══════════════════════════════════════════════════════════════════════
  // PASS 3 — isUrgent → ROUTE.
  //   The rail forks: lower path = preferred, upper path = primary. Two
  //   beats. Beat 1, isUrgent=false: dot continues on the lower path.
  //   Beat 2, isUrgent=true: dot switches to the upper path.
  // ══════════════════════════════════════════════════════════════════════
  {
    const yMid = code.getLineSceneY(LINE.bodyUrgent[1]);

    const v3         = createRef<Node>();
    const v3Dot      = createRef<Circle>();
    const v3Top      = createRef<Line>();
    const v3Bot      = createRef<Line>();
    const v3LblTop   = createRef<Txt>();
    const v3LblBot   = createRef<Txt>();
    const v3StateTxt = createRef<Txt>();

    const FORK_X = 0;
    const TIP_X  = RAIL_X1;
    const TIP_Y  = 56;

    vizRoot().add(
      <Node ref={v3} y={yMid} opacity={0}>
        {/* incoming rail */}
        <Line points={[[RAIL_X0, 0], [FORK_X, 0]]} stroke={RAIL_DIM} lineWidth={1} />
        {/* upper path — primary */}
        <Line ref={v3Top} points={[[FORK_X, 0], [TIP_X, -TIP_Y]]} stroke={RAIL_DIM} lineWidth={1} />
        {/* lower path — preferred */}
        <Line ref={v3Bot} points={[[FORK_X, 0], [TIP_X, +TIP_Y]]} stroke={RAIL_DIM} lineWidth={1} />
        <Txt
          ref={v3LblTop}
          text={'primary'}
          fontFamily={F_LABEL}
          fontSize={14}
          letterSpacing={3}
          fill={LABEL_DIM}
          x={TIP_X + 14}
          y={-TIP_Y}
          textAlign={'left'}
        />
        <Txt
          ref={v3LblBot}
          text={'preferred'}
          fontFamily={F_LABEL}
          fontSize={14}
          letterSpacing={3}
          fill={LABEL_DIM}
          x={TIP_X + 14}
          y={+TIP_Y}
          textAlign={'left'}
        />
        <Circle
          ref={v3Dot}
          x={RAIL_X0 + 30}
          y={0}
          width={DOT_R * 2}
          height={DOT_R * 2}
          fill={DOT_FILL}
        />
        <Txt
          ref={v3StateTxt}
          text={'isUrgent = false'}
          fontFamily={F_LABEL}
          fontSize={14}
          letterSpacing={2}
          fill={LABEL_DIM}
          x={0}
          y={-86}
          textAlign={'center'}
          opacity={0}
        />
      </Node>,
    );

    yield* code.getLine(LINE.sigUrgent)!.recolorTokens(['isUrgent'], ROUTE, 0.5);

    yield* all(
      v3().opacity(1, 0.5, easeInOutCubic),
      v3StateTxt().opacity(1, 0.5, easeInOutCubic),
      ...LINE.bodyUrgent.map(i => code.getLine(i)!.recolorAll(ROUTE, 0.6)),
    );

    // Beat 1 — false: lower path.
    yield* all(
      v3Dot().position([TIP_X - 4, TIP_Y - 1], 1.4, easeOutCubic),
      v3Bot().stroke(ROUTE, 0.6, easeInOutCubic),
      v3LblBot().fill(ROUTE, 0.6, easeInOutCubic),
    );
    yield* waitFor(0.8);

    // Reset for beat 2 — bring the dot back, fade lower-path highlight.
    yield* all(
      v3Dot().opacity(0, 0.3, easeInOutCubic),
      v3Bot().stroke(RAIL_DIM, 0.4, easeInOutCubic),
      v3LblBot().fill(LABEL_DIM, 0.4, easeInOutCubic),
    );
    v3Dot().position([RAIL_X0 + 30, 0]);
    yield* v3StateTxt().text('isUrgent = true', 0.0);
    yield* v3StateTxt().fill(ROUTE, 0.3, easeInOutCubic);
    yield* v3Dot().opacity(1, 0.3, easeInOutCubic);

    // Beat 2 — true: upper path.
    yield* all(
      v3Dot().position([TIP_X - 4, -TIP_Y + 1], 1.4, easeOutCubic),
      v3Top().stroke(ROUTE, 0.6, easeInOutCubic),
      v3LblTop().fill(ROUTE, 0.6, easeInOutCubic),
    );
    yield* waitFor(1.0);

    yield* v3().opacity(0, 0.6, easeInOutCubic);
  }

  // ══════════════════════════════════════════════════════════════════════
  // FINAL — three booleans, three roles. Code is already in its final
  // colored state from the cumulative passes; we just slide a compact
  // legend in next to the corresponding body blocks.
  // ══════════════════════════════════════════════════════════════════════
  const legend = createRef<Node>();
  view.add(<Node ref={legend} x={VIZ_X} y={0} opacity={0} />);

  const roleRow = (y: number, color: string, role: string) => (
    <Node y={y}>
      <Circle x={-90} width={10} height={10} fill={color} />
      <Txt
        text={role}
        fontFamily={F_LABEL}
        fontSize={28}
        letterSpacing={6}
        fill={color}
        x={-60}
        textAlign={'left'}
      />
    </Node>
  );

  legend().add(
    <>
      {roleRow(code.getLineSceneY(LINE.bodyConfirm[1]), STOP,   'stop')}
      {roleRow(code.getLineSceneY(LINE.bodyQuiet[1]),   BYPASS, 'bypass')}
      {roleRow(code.getLineSceneY(LINE.bodyUrgent[1]),  ROUTE,  'route')}
    </>,
  );

  yield* legend().opacity(1, 0.8, easeInOutCubic);
  yield* waitFor(2.6);

  yield* all(
    legend().opacity(0, 0.8, easeInOutCubic),
    code.disappear(0.8),
  );
});
