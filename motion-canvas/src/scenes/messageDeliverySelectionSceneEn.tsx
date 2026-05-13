import {Circle, Node, Rect, Txt, blur, makeScene2D} from '@motion-canvas/2d';
import {SimpleSignal, ThreadGenerator, all, createRef, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';
import {
  CODE,
  CODE_CARD_STYLE,
  CODE_FONT,
  CODE_LH,
  CODE_W,
  CODE_X,
  COLOR_RULES,
  CUSTOM_TYPES,
  LINE,
} from './messageDeliveryShared';

// One continuous shot for the boolean-parameter beat:
//   A. Zoom on the signature alone — five params, three of them Boolean.
//   B. Camera pulls back, body fades in, three toggles fade in on the
//      right column aligned to each boolean's body zone.
//   C–E. Each boolean takes a turn: its sig line and body block stay
//      sharp while the rest blurs; the matching toggle flips ON, the
//      previous one flips OFF.
//   F. Blur lifts, all toggles return to OFF, code & toggles dissolve.

const TOTAL_LINES  = CODE.split('\n').length;
const BODY_FIRST   = 7;
const BODY_LAST    = TOTAL_LINES - 1;
const SIG_MID_LINE = 3;
const SIG_MID_Y    = -((TOTAL_LINES - 1) / 2) * CODE_LH + SIG_MID_LINE * CODE_LH;
const SIG_MID_X    = -204;

const ZOOM_IN  = 2.5;
const X_OFFSET = -SIG_MID_X * ZOOM_IN;
const Y_OFFSET = -SIG_MID_Y * ZOOM_IN;

const BLUR_OUT = 6;
const HOLD     = 1.4;
const FADE     = 0.4;

// Right-column toggle UI.
// Toggles live as children of code.node, so they share its transform —
// they don't float on the canvas while the code zooms in/out.
// Coordinates below are LOCAL to code.node; in Phase B the container
// rests at world x=CODE_X, scale=1, so local_x = world_x - CODE_X.
const COL_TRACK_X  = 1030;
const COL_LABEL_X  = 920;     // right edge of label
const TRACK_W      = 132;
const TRACK_H      = 72;
const HANDLE_R     = 28;
const HANDLE_OFF_X = -TRACK_W / 2 + HANDLE_R + 8;
const HANDLE_ON_X  =  TRACK_W / 2 - HANDLE_R - 8;
const LABEL_SIZE   = 32;
const LABEL_FILL   = 'rgba(244, 241, 235, 1.0)';
const HANDLE_FILL  = 'rgba(244, 241, 235, 0.95)';
const GLOW_COLOR   = 'rgba(255, 170, 185, 0.7)';

type Range = readonly [number, number];

export default makeScene2D(function* (view) {
  applyBackground(view);

  const code = Manticore.create(CODE, {
    x: 0,
    y: 0,
    width: CODE_W,
    fontSize: CODE_FONT,
    lineHeight: CODE_LH,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    customTypes: CUSTOM_TYPES,
  });
  code.mount(view);
  code.colorize(COLOR_RULES);

  const blurs: SimpleSignal<number>[] = [];
  for (let i = 0; i < code.lineCount; i++) {
    const sig = createSignal(0);
    blurs.push(sig);
    const line = code.getLine(i);
    if (line) line.node.filters(() => [blur(sig())]);
  }

  function* focusRanges(keep: Range[], duration: number): ThreadGenerator {
    const anims: ThreadGenerator[] = [];
    for (let i = 0; i < blurs.length; i++) {
      const inRange = keep.some(([a, b]) => i >= a && i <= b);
      anims.push(blurs[i](inRange ? 0 : BLUR_OUT, duration));
    }
    yield* all(...anims);
  }

  // ── Toggle column ──────────────────────────────────────────────────────
  // One toggle per boolean. Each toggle's Y is locked to the vertical
  // mid-line of the body block the boolean controls — when the code zone
  // lights up on the left, the toggle on the right is at the same height.
  const dryRunOn    = createSignal(0);
  // forceSend starts ON: override is "set" by default, so the toggle
  // fades in already flipped right. In phase D it audibly clicks OFF
  // — that flip is itself the cue that `if (!forceSend)` just woke up.
  const forceSendOn = createSignal(1);
  const isRetryOn   = createSignal(0);

  const togglesNode = createRef<Node>();
  code.node.add(<Node ref={togglesNode} opacity={0} />);

  const rows = [
    {label: 'dryRun',    y: code.getLineSceneY(Math.round((LINE.zoneDryRun[0]    + LINE.zoneDryRun[1])    / 2)), sig: dryRunOn},
    {label: 'forceSend', y: code.getLineSceneY(Math.round((LINE.zoneForceSend[0] + LINE.zoneForceSend[1]) / 2)), sig: forceSendOn},
    {label: 'isRetry',   y: code.getLineSceneY(Math.round((LINE.zoneIsRetry[0]   + LINE.zoneIsRetry[1])   / 2)), sig: isRetryOn},
  ];

  for (const r of rows) {
    togglesNode().add(
      <Txt
        text={r.label}
        x={COL_LABEL_X}
        y={r.y}
        offset={[1, 0]}
        fontFamily={Fonts.code}
        fontSize={LABEL_SIZE}
        fill={LABEL_FILL}
        opacity={() => 0.35 + r.sig() * 0.6}
      />,
    );
    togglesNode().add(
      <Rect
        x={COL_TRACK_X}
        y={r.y}
        width={TRACK_W}
        height={TRACK_H}
        radius={TRACK_H / 2}
        fill={() => `rgba(255, 170, 185, ${0.10 + r.sig() * 0.45})`}
        stroke={() => `rgba(244, 241, 235, ${0.18 + r.sig() * 0.10})`}
        lineWidth={1}
        shadowColor={GLOW_COLOR}
        shadowBlur={() => 14 * r.sig()}
      />,
    );
    togglesNode().add(
      <Circle
        x={() => COL_TRACK_X + HANDLE_OFF_X + r.sig() * (HANDLE_ON_X - HANDLE_OFF_X)}
        y={r.y}
        width={HANDLE_R * 2}
        height={HANDLE_R * 2}
        fill={HANDLE_FILL}
        shadowColor={'rgba(0, 0, 0, 0.45)'}
        shadowBlur={10}
        shadowOffsetY={3}
      />,
    );
  }

  // ── Phase A — signature centered and enlarged, body hidden. ────────────
  code.node.scale(ZOOM_IN);
  code.node.position([X_OFFSET, Y_OFFSET]);
  yield* code.dimLines(BODY_FIRST, BODY_LAST, 0, 0);
  yield* code.appear(0.6);
  yield* waitFor(1.0);

  // ── Phase B — pull back; body fades in; toggles slide in. ──────────────
  yield* all(
    code.node.scale(1, 1.1, easeInOutCubic),
    code.node.position([CODE_X, 0], 1.1, easeInOutCubic),
    code.dimLines(BODY_FIRST, BODY_LAST, 1, 0.9),
    togglesNode().opacity(1, 0.9, easeInOutCubic),
  );
  yield* waitFor(0.4);

  // ── C — dryRun in focus. ───────────────────────────────────────────────
  yield* all(
    focusRanges([[LINE.sigDryRun, LINE.sigDryRun], LINE.zoneDryRun], FADE),
    dryRunOn(1, FADE),
  );
  yield* waitFor(HOLD);

  // ── D — forceSend takes over. The toggle reflects the parameter VALUE,
  //        not the focused block: the `if (!forceSend)` branch fires when
  //        forceSend == false, so the forceSend toggle stays OFF here.
  yield* all(
    focusRanges([[LINE.sigForceSend, LINE.sigForceSend], LINE.zoneForceSend], FADE),
    dryRunOn(0, FADE),
    forceSendOn(0, FADE),
  );
  yield* waitFor(HOLD);

  // ── E — isRetry takes over. ────────────────────────────────────────────
  yield* all(
    focusRanges([[LINE.sigIsRetry, LINE.sigIsRetry], LINE.zoneIsRetry], FADE),
    isRetryOn(1, FADE),
  );
  yield* waitFor(HOLD);

  // ── F — lift blur, switch the last toggle off, dissolve. ───────────────
  yield* all(
    ...blurs.map(s => s(0, FADE)),
    isRetryOn(0, FADE),
  );
  yield* all(
    code.disappear(0.7),
    togglesNode().opacity(0, 0.7, easeInOutCubic),
  );
});
