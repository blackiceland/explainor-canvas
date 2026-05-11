import {Circle, Node, Txt, makeScene2D} from '@motion-canvas/2d';
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
// OPTION 4 — return-value outcomes.
//   Right column lists the three possible return values of the method
//   as compact rows, each pinned vertically to the body block that
//   produces it. Reads as "this part of the code → this outcome", so
//   the boolean's effect is expressed in terms of the method's RESULT
//   rather than its control-flow shape.
// ════════════════════════════════════════════════════════════════════════

const ROW_X       = 280;
const DOT_R       = 7;
const F_LABEL     = Fonts.primary;
const F_CODE      = Fonts.code;
const LABEL_DIM   = 'rgba(244,241,235,0.55)';

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

  // ── outcomes on the right ──
  const out = createRef<Node>();
  view.add(<Node ref={out} opacity={0} />);

  // Each row sits at the y of the line that actually contains the
  // return-statement, so the eye can trace left-to-right.
  // dryRun     → Preview  (line 10 in code)
  // forceSend  → continue past Deferred (line 17 anchors to the Deferred return)
  // isRetry    → Sent     (line 27 is `return DeliveryResult.Sent(receipt)`)
  const yPreview = code.getLineSceneY(10);
  const yDeferred = code.getLineSceneY(17);
  const ySent    = code.getLineSceneY(27);

  const row = (y: number, color: string, caption: string, hint: string) => (
    <>
      {/* Accent dot — small marker for the outcome. */}
      <Circle x={ROW_X} y={y} width={DOT_R * 2} height={DOT_R * 2} fill={color} />
      {/* Outcome — mono, in the accent. */}
      <Txt
        text={caption}
        fontFamily={F_CODE}
        fontSize={22}
        fill={color}
        x={ROW_X + 30}
        y={y - 2}
        textAlign={'left'}
      />
      {/* Tiny hint — sans, dim, what flag drives this outcome. */}
      <Txt
        text={hint}
        fontFamily={F_LABEL}
        fontSize={13}
        letterSpacing={2}
        fill={LABEL_DIM}
        x={ROW_X + 30}
        y={y + 22}
        textAlign={'left'}
      />
    </>
  );

  out().add(
    <>
      {row(yPreview,  DRYRUN_COLOR,    'Preview(message)',         'dryRun = true')}
      {row(yDeferred, FORCESEND_COLOR, 'Deferred(decision.reason)', 'forceSend = false & blocked')}
      {row(ySent,     ISRETRY_COLOR,   'Sent(receipt)',            'isRetry chooses attempt')}
    </>,
  );

  yield* code.appear(0.7);
  yield* all(
    code.getLine(LINE.sigDryRun)!.setTokensGlow(['dryRun'],       10, DRYRUN_COLOR,    0.6),
    code.getLine(LINE.sigForceSend)!.setTokensGlow(['forceSend'], 10, FORCESEND_COLOR, 0.6),
    code.getLine(LINE.sigIsRetry)!.setTokensGlow(['isRetry'],     10, ISRETRY_COLOR,   0.6),
    out().opacity(1, 0.8, easeInOutCubic),
  );

  yield* waitFor(4.0);
});
