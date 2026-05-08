import {Node, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';
import {Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {textWidth} from '../core/utils/textMeasure';
import {getCodePaddingX} from '../core/code/shared/TextMeasure';

// ── Colors ──────────────────────────────────────────────────────────────
const WARM_CREAM  = 'rgba(244, 241, 235, 0.95)';
const QUOTE_BEIGE = 'rgba(232, 207, 174, 0.96)';
const MUTED       = 'rgba(244, 241, 235, 0.6)';
const PARAM_LIGHT = 'rgba(244, 241, 235, 0.92)';
const TYPE_CLEAN  = 'rgba(220, 215, 255, 0.85)';
const FLASH_WHITE = 'rgba(255, 255, 255, 1.0)';

// ── Code ────────────────────────────────────────────────────────────────
const SIG_ONE_FALSE = `fun save(file: File, data: Data, overwrite: Boolean = false)`;
const SIG_ONE_TRUE  = `fun save(file: File, data: Data, overwrite: Boolean = true)`;
const SIG_MANY = `fun save(
    file: File,
    data: Data,
    overwrite: Boolean = true,
    createDirs: Boolean = false,
    skipBackup: Boolean = false,
    force: Boolean = false,
    silent: Boolean = false,
)`;

const F = Fonts.code;
const SZ = 50;
const LH = 76;
const MC_W = 2200;

// Position of "overwrite: Boolean = false" inside SIG_ONE_FALSE.
const MC_LEFT_EDGE = -MC_W / 2 + getCodePaddingX(SZ);
const PREFIX_PX = textWidth('fun save(file: File, data: Data, ', F, SZ);
const TARGET_PX = textWidth('overwrite: Boolean = false', F, SZ);
const TARGET_CENTER = MC_LEFT_EDGE + PREFIX_PX + TARGET_PX / 2;

// Block-centering offsets — keep both signatures visually centered on x=0.
const SIG_ONE_W = textWidth(SIG_ONE_FALSE, F, SZ);
const SIG_ONE_OFFSET_X = -(MC_LEFT_EDGE + SIG_ONE_W / 2);

const SIG_MANY_MAX_W = Math.max(
  ...SIG_MANY.split('\n').map(l => textWidth(l, F, SZ)),
);
const SIG_MANY_OFFSET_X = -(MC_LEFT_EDGE + SIG_MANY_MAX_W / 2);

const CODE_RULES = [
  {match: /^fun$/,      color: DryFiltersV3CodeTheme.keyword},
  {match: /^false$/,    color: DryFiltersV3CodeTheme.keyword},
  {match: /^true$/,     color: DryFiltersV3CodeTheme.keyword},
  {match: 'save',       color: DryFiltersV3CodeTheme.method, onlyTypes: ['method'] as const},
  {match: /^Boolean$/,  color: TYPE_CLEAN},
  {match: /^File$/,     color: TYPE_CLEAN},
  {match: /^Data$/,     color: TYPE_CLEAN},
  {match: 'file',       color: PARAM_LIGHT},
  {match: 'data',       color: PARAM_LIGHT},
  {match: 'overwrite',  color: PARAM_LIGHT},
  {match: 'createDirs', color: PARAM_LIGHT},
  {match: 'skipBackup', color: PARAM_LIGHT},
  {match: 'force',      color: PARAM_LIGHT},
  {match: 'silent',     color: PARAM_LIGHT},
];

const CODE_OPTS_BASE = {
  width: MC_W,
  fontSize: SZ,
  lineHeight: LH,
  fontFamily: F,
  theme: DryFiltersV3CodeTheme,
  noClip: true,
  cardStyle: {
    radius: 0,
    fill: 'rgba(0,0,0,0)',
    stroke: 'rgba(0,0,0,0)',
    strokeWidth: 0,
    edge: false,
    opacity: 0,
    shadowBlur: 0,
    shadowColor: 'rgba(0,0,0,0)',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  },
  glowAccent: false,
  customTypes: ['Boolean', 'File', 'Data'],
};

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 1 — opening line in two beats, each centered. Fits inside ~4s.
  // ═══════════════════════════════════════════════════════════════════════
  yield* waitFor(0.15);

  const QUOTE_FONT = 60;

  const t1 = new Txt({
    text: "Bad code isn't complex",
    fontFamily: F,
    fontSize: QUOTE_FONT,
    fill: QUOTE_BEIGE,
    textAlign: 'center',
    x: 0,
    y: 0,
    opacity: 0,
  });
  view.add(t1);

  yield* t1.opacity(1, 0.35, easeInOutCubic);
  yield* waitFor(0.85);
  yield* t1.opacity(0, 0.35, easeInOutCubic);
  yield* waitFor(0.05);

  const t2 = new Txt({
    text: "It's code that pretends to be simple.",
    fontFamily: F,
    fontSize: QUOTE_FONT,
    fill: QUOTE_BEIGE,
    textAlign: 'center',
    x: 0,
    y: 0,
    opacity: 0,
  });
  view.add(t2);

  yield* t2.opacity(1, 0.35, easeInOutCubic);
  yield* waitFor(1.4);
  yield* t2.opacity(0, 0.45, easeInOutCubic);
  yield* waitFor(0.05);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2 setup — single Manticore for SIG_ONE; multi-line built upfront
  //                 so the catastrophe is a snap, not a lazy mount.
  // ═══════════════════════════════════════════════════════════════════════
  const codeRoot = createRef<Node>();
  view.add(<Node ref={codeRoot} opacity={0} />);
  const code = Manticore.create(SIG_ONE_FALSE, {x: 0, y: 0, ...CODE_OPTS_BASE});
  code.mount(codeRoot());
  code.colorize(CODE_RULES);
  code.node.opacity(1);
  type TokenRef = ReturnType<NonNullable<ReturnType<typeof code.getLine>>['tokens'][number]['ref']>;

  // Hide every token except the [overwrite … false] range.
  const tokens = code.getLine(0)!.tokens;
  let overwriteIdx = -1;
  let falseIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    const t = String(tokens[i].ref().text());
    if (overwriteIdx === -1 && t === 'overwrite') overwriteIdx = i;
    if (t === 'false') falseIdx = i;
  }
  const hiddenTokens: ReturnType<typeof tokens[number]['ref']>[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (i < overwriteIdx || i > falseIdx) {
      tokens[i].ref().opacity(0);
      hiddenTokens.push(tokens[i].ref());
    }
  }


  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2a — same Manticore, scaled UP, x-shifted so
  //            "overwrite: Boolean = false" sits dead-center.
  // ═══════════════════════════════════════════════════════════════════════
  const SCALE_BIG = 1.5;
  codeRoot().scale(SCALE_BIG);
  codeRoot().x(-TARGET_CENTER * SCALE_BIG);

  yield* codeRoot().opacity(1, 0.7, easeOutCubic);
  yield* waitFor(1.7);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2b — honest zoom-out: same glyphs, scale → 1, hidden tokens fade in
  // ═══════════════════════════════════════════════════════════════════════
  yield* all(
    codeRoot().scale(1, 1.1, easeInOutCubic),
    codeRoot().x(SIG_ONE_OFFSET_X, 1.1, easeInOutCubic),
    ...hiddenTokens.map(t => t.opacity(1, 0.95, easeOutCubic)),
  );
  yield* waitFor(1.8);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2b.5 — false → true. Three beats:
  //    (a) the existing `false` dims and warms — a hint of doubt;
  //    (b) Manticore swaps the token at zero motion;
  //    (c) the fresh `true` glows warm-cream, then settles to keyword color.
  // ═══════════════════════════════════════════════════════════════════════
  // (a) Find `false` — pre-flash: dim + warm.
  let falseRef: TokenRef | null = null;
  for (let i = 0; i < code.lineCount; i++) {
    const line = code.getLine(i);
    if (!line) continue;
    for (const tok of line.tokens) {
      if (String(tok.ref().text()) === 'false') {
        falseRef = tok.ref();
        break;
      }
    }
    if (falseRef) break;
  }
  if (falseRef) {
    yield* all(
      falseRef.fill(QUOTE_BEIGE, 0.35, easeInOutCubic),
      falseRef.opacity(0.55, 0.35, easeInOutCubic),
    );
  }
  yield* waitFor(0.25);

  // (b) Token swap, no slide, no flash from Manticore — just exchange.
  yield* code.morphTo(SIG_ONE_TRUE, {
    addStyle: 'fade',
    moveDuration: 0,
    removeDuration: 0.3,
    tokenSlideDuration: 0,
  });
  code.colorize(CODE_RULES);

  // (c) Find `true` — glow from warm-cream into the keyword color.
  let trueRef: TokenRef | null = null;
  for (let i = 0; i < code.lineCount; i++) {
    const line = code.getLine(i);
    if (!line) continue;
    for (const tok of line.tokens) {
      if (String(tok.ref().text()) === 'true') {
        trueRef = tok.ref();
        break;
      }
    }
    if (trueRef) break;
  }
  if (trueRef) {
    trueRef.fill(WARM_CREAM);
    yield* trueRef.fill(DryFiltersV3CodeTheme.keyword, 0.75, easeInOutCubic);
  }
  yield* waitFor(1.0);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2c — seamless transformation: tokens DON'T slide. The single
  //            line dissolves in place; the multi-line shape emerges
  //            in its new positions through fade. `save` doesn't fly —
  //            it dims out and re-appears as part of the broader form.
  // ═══════════════════════════════════════════════════════════════════════
  yield* all(
    code.morphTo(SIG_MANY, {
      addStyle: 'fade',
      lineOrder: 'parallel',
      blockOrder: 'parallel',
      tokenSlideDuration: 0,
      moveDuration: 0,
      removeDuration: 0.55,
    }),
    codeRoot().x(SIG_MANY_OFFSET_X, 0.75, easeInOutCubic),
  );
  code.colorize(CODE_RULES);
  yield* waitFor(0.9);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2d — inverted reveal: Booleans STAY, everything else fades.
  //            One pattern, repeated. The names don't matter; the type does.
  // ═══════════════════════════════════════════════════════════════════════
  const boolRefs: TokenRef[] = [];
  const otherRefs: TokenRef[] = [];
  for (let i = 0; i < code.lineCount; i++) {
    const line = code.getLine(i);
    if (!line) continue;
    for (const tok of line.tokens) {
      const ref = tok.ref();
      if (String(ref.text()) === 'Boolean') {
        boolRefs.push(ref);
      } else {
        otherRefs.push(ref);
      }
    }
  }

  // Brief strike: Booleans rise to pure white in unison.
  yield* all(
    ...boolRefs.map(r => r.fill(FLASH_WHITE, 0.20, easeOutCubic)),
  );
  yield* waitFor(0.45);

  // Decay: everything else dims to a whisper; Booleans settle back to TYPE_CLEAN.
  yield* all(
    ...otherRefs.map(r => r.opacity(0.16, 1.5, easeInOutCubic)),
    ...boolRefs.map(r => r.fill(TYPE_CLEAN, 1.3, easeInOutCubic)),
  );

  // Hold on the Booleans — let the pattern register before the title arrives.
  yield* waitFor(2.5);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 3 — chapter title: clean handoff, not an overlay.
  //           Code goes first, breath, then YŪDAN rises into empty space.
  // ═══════════════════════════════════════════════════════════════════════
  yield* codeRoot().opacity(0, 1.0, easeInOutCubic);
  yield* waitFor(0.5);

  const chapterContainer = createRef<Node>();
  const chapterRef = createRef<Txt>();
  const titleRef = createRef<Txt>();

  view.add(
    <Node ref={chapterContainer} opacity={0}>
      <Txt
        ref={chapterRef}
        text={'CHAPTER 1'}
        fontFamily={Fonts.primary}
        fontWeight={500}
        fontSize={40}
        letterSpacing={18}
        fill={MUTED}
        y={-50}
      />
      <Txt
        ref={titleRef}
        text={'YŪDAN'}
        fontFamily={Fonts.primary}
        fontWeight={700}
        fontSize={72}
        letterSpacing={14}
        fill={WARM_CREAM}
        y={28}
      />
    </Node>,
  );

  yield* chapterContainer().opacity(1, 1.0, easeInOutCubic);
  yield* waitFor(2.6);

  yield* chapterContainer().opacity(0, 1.2, easeInOutCubic);
  yield* waitFor(0.3);
});
