import {Txt, makeScene2D} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// Two beats:
//   1. Quote: "Flags have a bad reputation."
//   2. Four call-sites of the same method come in together. Camera
//      starts pushing in immediately — a slow 7s zoom — so only the
//      bright-blue boolean column remains in frame. Then every token
//      except one `false` fades out, leaving a single boolean alone in
//      the kadr. Finally that one fades too. Total ≈10s.

const ROSE         = 'rgba(255, 170, 185, 0.86)';
const METHOD_COLOR = '#FF8CA3';
const VAR_LIGHT    = 'rgba(244, 241, 235, 0.96)';
const BRIGHT_BLUE  = '#3FBFFF';

const CALLS = [
  'deliver(user, msg, true,  false, false)',
  'deliver(user, msg, false, true,  false)',
  'deliver(user, msg, true,  true,  true)',
  'deliver(user, msg, false, false, true)',
];

const CODE_TEXT = CALLS.join('\n');

const RULES: ColorRule[] = [
  {match: /^deliver$/, color: METHOD_COLOR, onlyTypes: ['method']},
  {match: /^(user|msg)$/, color: VAR_LIGHT},
  {match: /^(true|false)$/, color: BRIGHT_BLUE},
];

const TRANSPARENT_STYLE = {
  radius: 0,
  fill: 'rgba(0,0,0,0)',
  stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0,
  shadowColor: 'rgba(0,0,0,0)',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  edge: false,
} as const;

const FONT_SIZE   = 40;
const LINE_HEIGHT = 56;
const CODE_WIDTH  = 1200;

// Empirical: bool 2 (mid boolean) of line 0 sits at content-x ≈ 134 px
// from the container origin once Manticore lays out the lines.
const BOOL_REL_X   = 134;
const TARGET_SCALE = 4.1;
const TARGET_X     = -BOOL_REL_X * TARGET_SCALE;

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ── BEAT 1 — quote. ───────────────────────────────────────────────────
  const setup = createRef<Txt>();
  view.add(
    <Txt
      ref={setup}
      text={'Flags have a bad reputation.'}
      fontFamily={Fonts.primary}
      fontSize={72}
      fontWeight={600}
      fill={ROSE}
      textAlign={'center'}
      opacity={0}
    />,
  );

  yield* setup().opacity(1, 0.6, easeInOutCubic);
  yield* waitFor(1.6);
  yield* setup().opacity(0, 0.5, easeInOutCubic);

  // ── BEAT 2 — call-sites + slow zoom + isolate one `false`. ≈10s. ──────
  const code = Manticore.create(CODE_TEXT, {
    x: 0,
    y: 0,
    width: CODE_WIDTH,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: TRANSPARENT_STYLE,
    glowAccent: false,
    customTypes: [],
  });
  code.mount(view);
  code.colorize(RULES);

  // Pick the token to survive: first `false` in line 0 (bool 2, sits at
  // view-x ≈ 0, top-middle once the camera lands).
  const targetLine = code.getLine(0)!;
  const targetToken = targetLine.tokens.find(t => t.text === 'false');

  // 0–7.0s: lines fade in together; camera pushes in immediately.
  yield* all(
    code.appear(0.6),
    code.node.scale(TARGET_SCALE, 7.0, easeInOutCubic),
    code.node.x(TARGET_X, 7.0, easeInOutCubic),
  );

  // 7.0–8.0s: hold the boolean column.
  yield* waitFor(1.0);

  // 8.0–8.5s: every token except the chosen `false` fades to 0.
  const isolateAnims: ThreadGenerator[] = [];
  for (let i = 0; i < CALLS.length; i++) {
    const line = code.getLine(i);
    if (!line) continue;
    for (const td of line.tokens) {
      if (td === targetToken) continue;
      isolateAnims.push(td.ref().opacity(0, 0.5, easeInOutCubic));
    }
  }
  yield* all(...isolateAnims);

  // 8.5–9.3s: hold the lone `false`.
  yield* waitFor(0.8);

  // 9.3–10.0s: final fade.
  if (targetToken) {
    yield* targetToken.ref().opacity(0, 0.7, easeInOutCubic);
  }
});
