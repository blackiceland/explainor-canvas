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
const SIG_ONE       = `fun save(file: File, data: Data, overwrite: Boolean = false)`;
const SIG_ONE_TRUE  = `fun save(file: File, data: Data, overwrite: Boolean = true)`;
// SIG_FINAL keeps the post-swap first line intact, then packs four new
// Boolean parameters into rows two and three (two per row, no closing
// line for `)`).
const SIG_FINAL = `fun save(file: File, data: Data, overwrite: Boolean = true,
    createDirs: Boolean = false, skipBackup: Boolean = false,
    force: Boolean = false, silent: Boolean = false)`;
const SIG_FINAL_SILENT_TRUE = `fun save(file: File, data: Data, overwrite: Boolean = true,
    createDirs: Boolean = false, skipBackup: Boolean = false,
    force: Boolean = false, silent: Boolean = true)`;

const F = Fonts.code;
const SZ = 50;
const LH = 76;
const MC_W = 2200;

const MC_LEFT_EDGE = -MC_W / 2 + getCodePaddingX(SZ);

// Anchor positions for the staged reveal:
//   - Boolean alone (Phase 2a)
//   - "overwrite: Boolean = false" fragment (Phase 2b1)
//   - full single-line signature   (Phase 2b2)
const BOOLEAN_PREFIX_PX = textWidth('fun save(file: File, data: Data, overwrite: ', F, SZ);
const BOOLEAN_PX = textWidth('Boolean', F, SZ);
const BOOLEAN_CENTER = MC_LEFT_EDGE + BOOLEAN_PREFIX_PX + BOOLEAN_PX / 2;

const FRAGMENT_PREFIX_PX = textWidth('fun save(file: File, data: Data, ', F, SZ);
const FRAGMENT_PX = textWidth('overwrite: Boolean = false', F, SZ);
const FRAGMENT_CENTER = MC_LEFT_EDGE + FRAGMENT_PREFIX_PX + FRAGMENT_PX / 2;

const SIG_ONE_W = textWidth(SIG_ONE, F, SZ);
const SIG_ONE_OFFSET_X = -(MC_LEFT_EDGE + SIG_ONE_W / 2);

// Block-centering offset shared by sig_one (Phase 2b2/2b.5) AND the
// 3-row codeFinal (Phase 2c). Using the max line width across the final
// composition keeps `save` at the same world-x in both Manticores.
const SIG_FINAL_MAX_W = Math.max(
  ...[
    'fun save(file: File, data: Data, overwrite: Boolean = true,',
    '    createDirs: Boolean = false, skipBackup: Boolean = false,',
    '    force: Boolean = false, silent: Boolean = false)',
  ].map(l => textWidth(l, F, SZ)),
);
const SIG_FINAL_OFFSET_X = -(MC_LEFT_EDGE + SIG_FINAL_MAX_W / 2);

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
  const code = Manticore.create(SIG_ONE, {x: 0, y: 0, ...CODE_OPTS_BASE});
  code.mount(codeRoot());
  code.colorize(CODE_RULES);
  code.node.opacity(1);
  type TokenRef = ReturnType<NonNullable<ReturnType<typeof code.getLine>>['tokens'][number]['ref']>;

  // Locate the three anchor tokens.
  const tokens = code.getLine(0)!.tokens;
  let overwriteIdx = -1;
  let booleanIdx = -1;
  let falseIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    const t = String(tokens[i].ref().text());
    if (overwriteIdx === -1 && t === 'overwrite') overwriteIdx = i;
    if (booleanIdx === -1 && t === 'Boolean') booleanIdx = i;
    if (t === 'false') falseIdx = i;
  }

  // Stage A — only Boolean visible.
  // Stage B1 — overwrite … false range visible.
  // Stage B2 — everything visible.
  const stageB1Reveal: TokenRef[] = [];   // tokens revealed when going A → B1
  const stageB2Reveal: TokenRef[] = [];   // tokens revealed when going B1 → B2
  for (let i = 0; i < tokens.length; i++) {
    const ref = tokens[i].ref();
    if (i === booleanIdx) continue;          // already visible
    if (i >= overwriteIdx && i <= falseIdx) {
      ref.opacity(0);
      stageB1Reveal.push(ref);
    } else {
      ref.opacity(0);
      stageB2Reveal.push(ref);
    }
  }


  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2a — only "Boolean" is visible, large, dead-center.
  //            The type comes first; identifiers and defaults come later.
  // ═══════════════════════════════════════════════════════════════════════
  const SCALE_2A = 2.4;
  codeRoot().scale(SCALE_2A);
  codeRoot().x(-BOOLEAN_CENTER * SCALE_2A);

  yield* codeRoot().opacity(1, 0.7, easeOutCubic);
  yield* waitFor(1.0);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2b1 — pull back: surrounding fragment "overwrite: Boolean = false"
  //             fades in around the Boolean anchor.
  // ═══════════════════════════════════════════════════════════════════════
  const SCALE_2B1 = 1.55;
  yield* all(
    codeRoot().scale(SCALE_2B1, 0.95, easeInOutCubic),
    codeRoot().x(-FRAGMENT_CENTER * SCALE_2B1, 0.95, easeInOutCubic),
    ...stageB1Reveal.map(r => r.opacity(1, 0.8, easeOutCubic)),
  );
  yield* waitFor(1.1);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2b — honest zoom-out: same glyphs, scale → 1, hidden tokens fade in
  // ═══════════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2b2 — full pull-back: rest of the signature fades in around
  //             the fragment. The line is now the canonical sig_one.
  // ═══════════════════════════════════════════════════════════════════════
  yield* all(
    codeRoot().scale(1, 1.0, easeInOutCubic),
    codeRoot().x(SIG_FINAL_OFFSET_X, 1.0, easeInOutCubic),
    ...stageB2Reveal.map(r => r.opacity(1, 0.9, easeOutCubic)),
  );
  yield* waitFor(1.3);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2b.5 — false → true. The reasonable default flips. Pre-dim,
  //              zero-motion swap, post-glow that settles to keyword color.
  // ═══════════════════════════════════════════════════════════════════════
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
  yield* waitFor(0.2);

  yield* code.morphTo(SIG_ONE_TRUE, {
    addStyle: 'fade',
    moveDuration: 0,
    removeDuration: 0.3,
    tokenSlideDuration: 0,
  });
  code.colorize(CODE_RULES);

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
  yield* waitFor(0.9);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2c — three rows. First row is identical to sig_one_true (with
  //            a trailing comma) and its position is fixed: `save` does
  //            NOT move. Rows two and three fill up parameter-by-parameter,
  //            two per row, in sequence.
  // ═══════════════════════════════════════════════════════════════════════
  // Build the second Manticore at the SHARED block-centering offset so
  // that identical first-row glyphs sit at exactly the same world-x.
  // Vertical: Manticore centers its content around y=0, so row 1 of a
  // 3-line block sits at y = -LH. Push codeFinalRoot DOWN by one LH so
  // row 1 lands on the same world-y as the single-line `code`. `save`
  // physically does not move during the handoff.
  const SIG_FINAL_LINE_COUNT = 3;
  const codeFinalY = ((SIG_FINAL_LINE_COUNT - 1) / 2) * LH;
  const codeFinalRoot = createRef<Node>();
  view.add(
    <Node ref={codeFinalRoot} opacity={0} x={SIG_FINAL_OFFSET_X} y={codeFinalY} />,
  );
  const codeFinal = Manticore.create(SIG_FINAL, {x: 0, y: 0, ...CODE_OPTS_BASE});
  codeFinal.mount(codeFinalRoot());
  codeFinal.colorize(CODE_RULES);
  codeFinal.node.opacity(1);

  // Hide every token of rows 2 and 3 — they reveal one parameter at a time.
  const row2Tokens = codeFinal.getLine(1)!.tokens.map(t => t.ref());
  const row3Tokens = codeFinal.getLine(2)!.tokens.map(t => t.ref());
  for (const r of row2Tokens) r.opacity(0);
  for (const r of row3Tokens) r.opacity(0);

  // Group tokens into "parameter chunks" by trailing commas. Each chunk
  // is everything up to and including the next `,`; the trailing chunk
  // (with `silent` + `)` ) is the leftover after the last comma.
  const splitParams = (refs: TokenRef[]): TokenRef[][] => {
    const groups: TokenRef[][] = [];
    let current: TokenRef[] = [];
    for (const ref of refs) {
      current.push(ref);
      if (String(ref.text()) === ',') {
        groups.push(current);
        current = [];
      }
    }
    if (current.length > 0) groups.push(current);
    return groups;
  };
  const row2Params = splitParams(row2Tokens);   // [createDirs..,, skipBackup..,]
  const row3Params = splitParams(row3Tokens);   // [force..,, silent..)]

  // Instant handoff: code (sig_one_true) hides; codeFinal row 1 takes over.
  yield* all(
    codeRoot().opacity(0, 0.2, easeInCubic),
    codeFinalRoot().opacity(1, 0.2, easeOutCubic),
  );

  // Stagger reveal: createDirs → skipBackup → force → silent (with `)`).
  const PARAM_FADE = 0.45;
  const PARAM_PAUSE = 0.22;
  for (const group of [...row2Params, ...row3Params]) {
    yield* all(...group.map(r => r.opacity(1, PARAM_FADE, easeOutCubic)));
    yield* waitFor(PARAM_PAUSE);
  }

  yield* waitFor(0.7);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2d — focal narrowing: everything dims except `silent: Boolean = false`
  //            on row 3. Then `false` flips to `true` (mirroring the swap
  //            that opened the catastrophe with `overwrite`). The lie that
  //            was loud at the top is now quiet at the bottom.
  // ═══════════════════════════════════════════════════════════════════════
  // Locate the silent group on row 3.
  const row3 = codeFinal.getLine(2)!.tokens;
  let silentStartIdx = -1;
  let silentFalseIdx = -1;
  for (let i = 0; i < row3.length; i++) {
    const t = String(row3[i].ref().text());
    if (silentStartIdx === -1 && t === 'silent') silentStartIdx = i;
    if (silentStartIdx !== -1 && t === 'false') silentFalseIdx = i;
  }

  const otherRefs: TokenRef[] = [];
  let silentFalseRef: TokenRef | null = null;
  for (let lineIdx = 0; lineIdx < codeFinal.lineCount; lineIdx++) {
    const line = codeFinal.getLine(lineIdx);
    if (!line) continue;
    for (let i = 0; i < line.tokens.length; i++) {
      const ref = line.tokens[i].ref();
      if (lineIdx === 2 && i >= silentStartIdx && i <= silentFalseIdx) {
        if (i === silentFalseIdx) silentFalseRef = ref;
        // kept at full opacity
      } else {
        otherRefs.push(ref);
      }
    }
  }

  // Step 1: dim everything except the silent group.
  yield* all(
    ...otherRefs.map(r => r.opacity(0.14, 1.5, easeInOutCubic)),
  );
  yield* waitFor(1.1);

  // Step 2: pre-flash false (warm + dim) — the hint of doubt, again.
  if (silentFalseRef) {
    yield* all(
      silentFalseRef.fill(QUOTE_BEIGE, 0.35, easeInOutCubic),
      silentFalseRef.opacity(0.55, 0.35, easeInOutCubic),
    );
  }
  yield* waitFor(0.2);

  // Step 3: zero-motion swap. Kept tokens stay at their dimmed/full opacity.
  yield* codeFinal.morphTo(SIG_FINAL_SILENT_TRUE, {
    addStyle: 'fade',
    moveDuration: 0,
    removeDuration: 0.3,
    tokenSlideDuration: 0,
  });
  codeFinal.colorize(CODE_RULES);

  // Step 4: glow the fresh `true` from warm-cream into keyword color.
  let silentTrueRef: TokenRef | null = null;
  const newRow3 = codeFinal.getLine(2)!.tokens;
  let inSilent = false;
  for (const tok of newRow3) {
    const t = String(tok.ref().text());
    if (t === 'silent') inSilent = true;
    if (inSilent && t === 'true') {
      silentTrueRef = tok.ref();
      break;
    }
  }
  if (silentTrueRef) {
    silentTrueRef.fill(WARM_CREAM);
    yield* silentTrueRef.fill(DryFiltersV3CodeTheme.keyword, 0.75, easeInOutCubic);
  }

  // Step 5: let it sit. The lie has settled.
  yield* waitFor(1.6);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 3 — chapter title: clean handoff, not an overlay.
  //           Code goes first, breath, then YŪDAN rises into empty space.
  // ═══════════════════════════════════════════════════════════════════════
  yield* codeFinalRoot().opacity(0, 1.0, easeInOutCubic);
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
