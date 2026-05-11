import {Circle, Line, Node, Txt, makeScene2D} from '@motion-canvas/2d';
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
// OPTION 3 — tree-graph (execution flow).
//   Right column is a vertical "subway" spine with three side branches.
//   Each branch is one boolean's fork: the spine continues down for
//   false, the branch exits right for true. Three boolean params on the
//   left, three forks on the right — one-to-one mapping.
// ════════════════════════════════════════════════════════════════════════

const SPINE_X    = 320;
const BRANCH_END = SPINE_X + 240;
const NODE_R     = 7;
const SPINE_COL  = 'rgba(244,241,235,0.30)';
const SPINE_FILL = 'rgba(244,241,235,0.92)';
const LABEL_DIM  = 'rgba(244,241,235,0.55)';
const F_LABEL    = Fonts.primary;

export default makeScene2D(function* (view) {
  applyBackground(view);

  const code = Manticore.create(CODE, {
    x: CODE_X,
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

  // ── tree-graph on the right ──
  const tree = createRef<Node>();
  view.add(<Node ref={tree} opacity={0} />);

  // Spine endpoints — vertical line at SPINE_X.
  const yStart = -400;
  const yEnd   = +400;

  // Fork Y positions — evenly spread on the spine.
  const yFork1 = -200;   // dryRun
  const yFork2 = 0;      // forceSend
  const yFork3 = +200;   // isRetry

  // Spine line.
  tree().add(
    <Line points={[[SPINE_X, yStart], [SPINE_X, yEnd]]} stroke={SPINE_COL} lineWidth={1.5} />,
  );

  // Endpoint markers (start = render, end = Sent).
  const endpoint = (y: number, label: string) => (
    <>
      <Circle x={SPINE_X} y={y} width={NODE_R * 2} height={NODE_R * 2} fill={SPINE_FILL} />
      <Txt
        text={label}
        fontFamily={F_LABEL}
        fontSize={14}
        letterSpacing={3}
        fill={LABEL_DIM}
        x={SPINE_X - 20}
        y={y}
        textAlign={'right'}
      />
    </>
  );
  tree().add(<>{endpoint(yStart, 'render')}{endpoint(yEnd, 'Sent')}</>);

  // Three forks — each one a small node on the spine + a horizontal
  // branch + a terminal node + an outcome label.
  const fork = (y: number, boolLabel: string, outcome: string, color: string) => (
    <>
      {/* Fork node on the spine */}
      <Circle x={SPINE_X} y={y} width={NODE_R * 2} height={NODE_R * 2} fill={color} />
      {/* Horizontal branch to the right */}
      <Line points={[[SPINE_X, y], [BRANCH_END, y]]} stroke={color} lineWidth={2} />
      {/* Terminal node at branch end */}
      <Circle x={BRANCH_END} y={y} width={NODE_R * 2} height={NODE_R * 2} fill={color} />
      {/* Boolean label above the branch */}
      <Txt
        text={boolLabel}
        fontFamily={Fonts.code}
        fontSize={15}
        fill={color}
        x={(SPINE_X + BRANCH_END) / 2}
        y={y - 14}
        textAlign={'center'}
      />
      {/* Outcome label past the terminal node */}
      <Txt
        text={outcome}
        fontFamily={F_LABEL}
        fontSize={16}
        letterSpacing={2}
        fill={color}
        x={BRANCH_END + 14}
        y={y}
        textAlign={'left'}
      />
    </>
  );

  tree().add(
    <>
      {fork(yFork1, 'dryRun',    'Preview',   DRYRUN_COLOR)}
      {fork(yFork2, 'forceSend', 'skip rules', FORCESEND_COLOR)}
      {fork(yFork3, 'isRetry',   'nextRetry', ISRETRY_COLOR)}
    </>,
  );

  yield* code.appear(0.7);
  yield* all(
    code.getLine(LINE.sigDryRun)!.setTokensGlow(['dryRun'],       10, DRYRUN_COLOR,    0.6),
    code.getLine(LINE.sigForceSend)!.setTokensGlow(['forceSend'], 10, FORCESEND_COLOR, 0.6),
    code.getLine(LINE.sigIsRetry)!.setTokensGlow(['isRetry'],     10, ISRETRY_COLOR,   0.6),
    tree().opacity(1, 0.8, easeInOutCubic),
  );

  yield* waitFor(4.0);
});
