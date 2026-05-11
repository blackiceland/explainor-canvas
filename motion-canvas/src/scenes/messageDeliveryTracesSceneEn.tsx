import {Line, Node, Txt, makeScene2D} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, waitFor} from '@motion-canvas/core';
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
  DRYRUN_COLOR,
  FORCESEND_COLOR,
  ISRETRY_COLOR,
  LINE,
} from './messageDeliveryShared';

// ════════════════════════════════════════════════════════════════════════
// OPTION 2 — execution traces.
//   Right column has THREE compressed pseudo-method snippets — one per
//   boolean — each showing only the lines that actually run when that
//   flag is true (others at default). The method literally shrinks to a
//   different shape depending on which flag is set. Reads as "same
//   method, three internal lives".
// ════════════════════════════════════════════════════════════════════════

const F_CODE  = Fonts.code;
const F_LABEL = Fonts.primary;

const TRACE_X         = 80;          // left edge of trace lines
const TRACE_LINE_LH   = 28;
const TRACE_FONT      = 19;
const DIVIDER_W       = 320;
const HEADER_FONT     = 15;
const HEADER_DIM_FILL = 'rgba(244,241,235,0.55)';
const PLAIN_FILL      = 'rgba(244,241,235,0.85)';
const SKIPPED_FILL    = 'rgba(244,241,235,0.32)';

type TraceLine =
  | {kind: 'plain'; text: string}
  | {kind: 'skipped'; text: string}
  | {kind: 'accent'; text: string}
  | {kind: 'outcome'; text: string};

type Trace = {
  centerY: number;
  header: string;     // e.g. "dryRun = true"
  accent: string;
  lines: TraceLine[];
};

export default makeScene2D(function* (view) {
  applyBackground(view);

  const code = Manticore.create(CODE, {
    x: CODE_X,
    y: 0,
    width: CODE_W,
    fontSize: CODE_FONT,
    lineHeight: CODE_LH,
    fontFamily: F_CODE,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    customTypes: CUSTOM_TYPES,
  });
  code.mount(view);
  code.colorize(COLOR_RULES);

  const traces: Trace[] = [
    {
      centerY: code.getLineSceneY(10),
      header: 'dryRun = true',
      accent: DRYRUN_COLOR,
      lines: [
        {kind: 'plain',   text: 'render(template, user)'},
        {kind: 'outcome', text: '→ Preview(message)'},
      ],
    },
    {
      centerY: code.getLineSceneY(16),
      header: 'forceSend = true',
      accent: FORCESEND_COLOR,
      lines: [
        {kind: 'plain',   text: 'render(template, user)'},
        {kind: 'skipped', text: '(rules.check skipped)'},
        {kind: 'plain',   text: 'attempts.create(user, message)'},
        {kind: 'plain',   text: 'gateway.send(user, message, attempt)'},
        {kind: 'outcome', text: '→ Sent(receipt)'},
      ],
    },
    {
      centerY: code.getLineSceneY(22),
      header: 'isRetry = true',
      accent: ISRETRY_COLOR,
      lines: [
        {kind: 'plain',   text: 'render(template, user)'},
        {kind: 'plain',   text: 'rules.check(user, message)'},
        {kind: 'accent',  text: 'attempts.nextRetry(user, message)'},
        {kind: 'plain',   text: 'gateway.send(user, message, attempt)'},
        {kind: 'outcome', text: '→ Sent(receipt)'},
      ],
    },
  ];

  const tracesNode = createRef<Node>();
  view.add(<Node ref={tracesNode} opacity={0} />);

  for (const t of traces) {
    // Compute block height so we can center each block on its zone Y.
    // Header (single line) + divider gap + each trace line.
    const blockLines  = t.lines.length;
    const blockHeight = 24 /* header */ + 14 /* divider gap */ + blockLines * TRACE_LINE_LH;
    const topY        = t.centerY - blockHeight / 2;

    let cursorY = topY + 12;
    // Header — sans, dim caps with the flag colour.
    tracesNode().add(
      <Txt
        text={t.header}
        fontFamily={F_LABEL}
        fontSize={HEADER_FONT}
        letterSpacing={3}
        fill={t.accent}
        x={TRACE_X}
        y={cursorY}
        textAlign={'left'}
      />,
    );
    cursorY += 18;
    // Divider — thin line, dim accent.
    tracesNode().add(
      <Line
        points={[[TRACE_X, cursorY], [TRACE_X + DIVIDER_W, cursorY]]}
        stroke={t.accent}
        lineWidth={1}
        opacity={0.35}
      />,
    );
    cursorY += 18;

    for (const line of t.lines) {
      const isOutcome = line.kind === 'outcome';
      const isAccent  = line.kind === 'accent';
      const isSkipped = line.kind === 'skipped';
      const fill =
        isOutcome ? t.accent :
        isAccent  ? t.accent :
        isSkipped ? SKIPPED_FILL :
                    PLAIN_FILL;
      tracesNode().add(
        <Txt
          text={line.text}
          fontFamily={F_CODE}
          fontSize={TRACE_FONT}
          fill={fill}
          x={TRACE_X}
          y={cursorY}
          textAlign={'left'}
        />,
      );
      cursorY += TRACE_LINE_LH;
    }

    // Use blockHeight to silence the unused-warning if the layout
    // computation isn't read elsewhere. (Already used for topY.)
    void blockHeight;
    void HEADER_DIM_FILL;
  }

  yield* code.appear(0.7);
  yield* all(
    code.getLine(LINE.sigDryRun)!.setTokensGlow(['dryRun'],       10, DRYRUN_COLOR,    0.6),
    code.getLine(LINE.sigForceSend)!.setTokensGlow(['forceSend'], 10, FORCESEND_COLOR, 0.6),
    code.getLine(LINE.sigIsRetry)!.setTokensGlow(['isRetry'],     10, ISRETRY_COLOR,   0.6),
    tracesNode().opacity(1, 0.8, easeInOutCubic),
  );

  yield* waitFor(4.0);
});
