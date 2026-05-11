import {Rect, makeScene2D} from '@motion-canvas/2d';
import {all, easeInOutCubic, waitFor} from '@motion-canvas/core';
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
// OPTION 2 — code skyline (minimap).
//   Right column is a per-line abstract: a thin horizontal stripe for
//   each line, length proportional to the line's content, indented to
//   match the source. The three influence zones light up in their
//   boolean's accent; everything else stays in a dim cream. Reads as a
//   "shadow" of the code — same shape, abstracted to volume + colour.
// ════════════════════════════════════════════════════════════════════════

const SKYLINE_X        = 220;      // left edge of the minimap column
const CHAR_TO_PX       = 4;        // per-char width in skyline units
const STRIPE_HEIGHT    = 5;
const DIM_STRIPE_FILL  = 'rgba(244,241,235,0.20)';
const BOOL_GLOW_BLUR   = 10;

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

  // Build the skyline stripes — one per non-empty line, parented to view.
  const lines = CODE.split('\n');
  const stripes: {rect: Rect; targetOp: number}[] = [];

  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    const trimmed = text.trimStart();
    if (trimmed.length === 0) continue;
    const indent = text.length - trimmed.length;
    const startX = SKYLINE_X + indent * CHAR_TO_PX;
    const width  = trimmed.length * CHAR_TO_PX;
    const y      = code.getLineSceneY(i);

    const inZoneDR = i >= LINE.zoneDryRun[0]    && i <= LINE.zoneDryRun[1];
    const inZoneFS = i >= LINE.zoneForceSend[0] && i <= LINE.zoneForceSend[1];
    const inZoneIR = i >= LINE.zoneIsRetry[0]   && i <= LINE.zoneIsRetry[1];

    const fill = inZoneDR ? DRYRUN_COLOR
               : inZoneFS ? FORCESEND_COLOR
               : inZoneIR ? ISRETRY_COLOR
               : DIM_STRIPE_FILL;
    const targetOp = (inZoneDR || inZoneFS || inZoneIR) ? 0.85 : 1.0;

    const rect = new Rect({
      x: startX + width / 2,
      y,
      width,
      height: STRIPE_HEIGHT,
      fill,
      opacity: 0,
      radius: 1,
    });
    view.add(rect);
    stripes.push({rect, targetOp});
  }

  yield* code.appear(0.7);

  yield* all(
    // sig: three boolean params glow in their accents simultaneously.
    code.getLine(LINE.sigDryRun)!.setTokensGlow(['dryRun'],       BOOL_GLOW_BLUR, DRYRUN_COLOR,    0.6),
    code.getLine(LINE.sigForceSend)!.setTokensGlow(['forceSend'], BOOL_GLOW_BLUR, FORCESEND_COLOR, 0.6),
    code.getLine(LINE.sigIsRetry)!.setTokensGlow(['isRetry'],     BOOL_GLOW_BLUR, ISRETRY_COLOR,   0.6),
    // skyline: stripes fade in.
    ...stripes.map(s => s.rect.opacity(s.targetOp, 0.7, easeInOutCubic)),
  );

  yield* waitFor(4.0);
});
