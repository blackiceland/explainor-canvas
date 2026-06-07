import {makeScene2D, Txt, blur} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, easeInOutSine, waitFor} from '@motion-canvas/core';
import {
  createFiveFacesStage,
  NAME_XS,
  DOTS_Y,
  DOT_R,
  BIG_R,
  FACES,
  CODE_LH,
  IMPL_LH,
  IMPL_SAVE_CLEAN,
  IMPL_WRITE,
  IMPL_SAVE_OR_REPLACE,
  CALL_PERMISSION_CLEAN,
  CODE_RULES,
  METHOD_COLOR,
  blockLines,
  yForCode,
  paintNamedParams,
} from './fiveFacesBooleanV2Setup';

export default makeScene2D(function* (view) {
  const s = createFiveFacesStage(view);

  // Pre-roll — brief darkness while the eye adapts.
  yield* waitFor(0.45);

  // Light slides in from off-screen left. bgCover fades revealing the stage.
  yield* all(
    s.baseX(NAME_XS[0], 1.9, easeInOutSine),
    s.bgCover().opacity(0, 1.4, easeInOutSine),
  );
  s.arrivalTime(view.globalTime());
  yield* waitFor(0.2);
  yield* s.showCallCode(0);
  yield* waitFor(4.5);
  yield* all(
    s.spotlightLines(s.callCodes[0], blockLines(FACES[0].callBlock), 0.32, 0.55),
    s.showImplCode(0),
    s.showViz(0),
  );
  yield* waitFor(2.0);
  yield* s.permissionDriver();
  yield* s.restoreLines(s.callCodes[0], 0.8);
  yield* waitFor(1.2);
  yield* s.hideViz(0, 0.5);
  yield* waitFor(0.8);

  // ── Rack-focus: trace the boolean through the code ────────────────────
  // The blur lifts one landing at a time, walking the path the flag travels:
  // it enters at the call as `overwrite = true`, lands in the signature
  // param, decides the `if`, which guards the `val key` work and the
  // `return`. Per-token blur (not the whole-block blur) so only the boolean's
  // path holds focus while the surrounding plumbing stays soft.
  {
    const callMC = s.callCodes[0];
    const implMC = s.implCodes[0];
    const DEFOCUS = 6;

    const nonWs = (code: typeof callMC, lineIdx: number) => {
      const line = code.getLine(lineIdx);
      // Filter on the RENDERED glyph, not the logical token text: a ligature
      // like `&&` is two Txt nodes where the 2nd carries text='' but still
      // draws a `&`. Keying on t.text would skip it and leave a sharp `&`
      // floating in the blur. t.ref().text() catches both halves.
      return line ? line.tokens.filter(t => t.ref().text().trim().length > 0) : [];
    };
    const attach = (txt: Txt, sig: () => number): void => {
      txt.cache(true);
      txt.cachePadding(26);
      txt.filters(() => [blur(sig())]);
    };

    // One blur signal per region; all start sharp (0) to match the screen.
    const bLeft = createSignal(0);   // call site, minus `overwrite = true`
    const bArg  = createSignal(0);   // impl: overwrite: Boolean = false   (2)
    const bIf   = createSignal(0);   // impl: the if block                  (3)
    const bKey  = createSignal(0);   // impl: val key = storage.put(...)    (4)
    const bRet  = createSignal(0);   // impl: return StoredFile(key)        (5)
    const bRest = createSignal(0);   // impl: fun signature, `): tail`, brace

    // CALL — everything soft except `overwrite = true,` (line 15).
    for (let i = 0; i < callMC.lineCount; i++) {
      if (i === 15) continue;
      for (const t of nonWs(callMC, i)) attach(t.ref(), bLeft);
    }

    // IMPL — partition into the boolean's path vs the plumbing.
    for (const t of nonWs(implMC, 0)) attach(t.ref(), bRest);
    {
      // Line 1 splits: `overwrite: Boolean = false` | `): StoredFile {`.
      let tail = false;
      for (const t of nonWs(implMC, 1)) {
        attach(t.ref(), tail ? bRest : bArg);
        if (t.text === 'false') tail = true;
      }
    }
    for (const li of [2, 3, 4])         for (const t of nonWs(implMC, li)) attach(t.ref(), bIf);
    for (const li of [6, 7, 8, 9, 10])  for (const t of nonWs(implMC, li)) attach(t.ref(), bKey);
    for (const t of nonWs(implMC, 12)) attach(t.ref(), bRet);
    for (const t of nonWs(implMC, 13)) attach(t.ref(), bRest);

    // 1) Defocus everything but `overwrite = true`.
    yield* all(
      bLeft(DEFOCUS, 0.7, easeInOutSine),
      bArg(DEFOCUS, 0.7, easeInOutSine),
      bIf(DEFOCUS, 0.7, easeInOutSine),
      bKey(DEFOCUS, 0.7, easeInOutSine),
      bRet(DEFOCUS, 0.7, easeInOutSine),
      bRest(DEFOCUS, 0.7, easeInOutSine),
    );
    yield* waitFor(0.6);

    // 2) Walk the path — sharpen each landing in turn.
    yield* bArg(0, 0.6, easeInOutSine);
    yield* waitFor(0.5);
    yield* bIf(0, 0.6, easeInOutSine);
    yield* waitFor(0.5);
    yield* bKey(0, 0.6, easeInOutSine);
    yield* waitFor(0.5);
    yield* bRet(0, 0.6, easeInOutSine);
    yield* waitFor(0.9);

    // 3) Release focus back to the whole picture before the split.
    yield* all(
      bLeft(0, 0.7, easeInOutSine),
      bRest(0, 0.7, easeInOutSine),
    );

    // Drop the per-token blur machinery so the morph runs on pristine nodes.
    for (const code of [callMC, implMC]) {
      for (let i = 0; i < code.lineCount; i++) {
        for (const t of nonWs(code, i)) {
          t.ref().filters([]);
          t.ref().cache(false);
        }
      }
    }
  }

  yield* waitFor(0.8);

  // MORPH: boolean → three explicit methods.
  {
    const sigLine = s.implCodes[0].getLine(1);
    const ifLine = s.implCodes[0].getLine(2);
    if (sigLine) yield* sigLine.colorizeByRuleAnimated('overwrite', METHOD_COLOR, 0.4);
    if (ifLine) yield* ifLine.colorizeByRuleAnimated('overwrite', METHOD_COLOR, 0.4);
  }
  yield* waitFor(1.5);
  yield* s.implCodes[0].morphTo(IMPL_SAVE_CLEAN, {
    removeDuration: 0.3,
    moveDuration: 0.4,
    charDelay: 0.015,
    flashRemovedColor: METHOD_COLOR,
    flashRemovedDuration: 0.2,
    addStyle: 'typewriter',
    scrollStrategy: 'block',
  });
  s.implCodes[0].colorize(CODE_RULES);
  paintNamedParams(s.implCodes[0]);
  s.implCodes[0].recenterContent();
  yield* waitFor(0.8);

  // Step 2: write appears.
  const callLines = FACES[0].callCode.split('\n').length;
  const callY = yForCode(FACES[0].callCode);
  const publishBraceY = callY - ((callLines - 1) * CODE_LH) / 2 + 25 * CODE_LH;
  const writeLines = IMPL_WRITE.split('\n').length;
  const writeY = publishBraceY - ((writeLines - 1) * IMPL_LH) / 2;
  const sorLines = IMPL_SAVE_OR_REPLACE.split('\n').length;
  const gap = IMPL_LH * 2;

  s.writeMC.node.position.y(writeY);
  yield* s.writeMC.node.opacity(1, 0.5, easeInOutSine);
  yield* waitFor(0.6);

  // Step 3: saveOrReplace inserts between save and write.
  const writeTop = writeY - ((writeLines - 1) * IMPL_LH) / 2;
  const sorY = writeTop - gap - ((sorLines - 1) * IMPL_LH) / 2;
  const sorTop = sorY - ((sorLines - 1) * IMPL_LH) / 2;
  const saveLines = IMPL_SAVE_CLEAN.split('\n').length;
  const saveTargetY = sorTop - gap - ((saveLines - 1) * IMPL_LH) / 2;
  s.saveOrReplaceMC.node.position.y(sorY);
  yield* all(
    s.saveOrReplaceMC.node.opacity(1, 0.5, easeInOutSine),
    s.implCodes[0].node.position.y(saveTargetY, 0.5, easeInOutCubic),
  );
  yield* waitFor(0.8);

  // The left call adopts the named method. The boolean argument doesn't earn a
  // clearer label here — it disappears into the verb:
  // fileStorage.save(…, overwrite = true) → fileStorage.saveOrReplace(…).
  yield* s.callCodes[0].morphTo(CALL_PERMISSION_CLEAN, {
    removeDuration: 0.3,
    moveDuration: 0.4,
    charDelay: 0.015,
    flashRemovedColor: METHOD_COLOR,
    flashRemovedDuration: 0.2,
    addStyle: 'typewriter',
    scrollStrategy: 'block',
  });
  s.callCodes[0].colorize(CODE_RULES);
  paintNamedParams(s.callCodes[0]);
  yield* waitFor(1.8);

  // BIG METHOD — trade-off reveal: one real save(), no class, no injects.
  yield* all(
    s.hideCallCode(0, 0.55),
    s.hideImplCode(0, 0.55),
    s.writeMC.node.opacity(0, 0.55, easeInOutSine),
    s.saveOrReplaceMC.node.opacity(0, 0.55, easeInOutSine),
  );
  // Raise the method and drop it in — no slow scroll-through now.
  s.complexSaveCode.node.position.y(0);
  yield* s.complexSaveCode.node.opacity(1, 1.0, easeInOutSine);
  yield* waitFor(0.6);

  // Per-token blur: the guard block — where `!overwrite` is actually applied —
  // holds focus while the rest of the method softens around it.
  const bGuard = createSignal(0); // if (existing != null && !overwrite) { throw }
  const bRest = createSignal(0); //  everything else
  {
    const GUARD = new Set([35, 36, 37]);
    for (let i = 0; i < s.complexSaveCode.lineCount; i++) {
      const line = s.complexSaveCode.getLine(i);
      if (!line) continue;
      const sig = GUARD.has(i) ? bGuard : bRest;
      for (const t of line.tokens) {
        const txt = t.ref();
        // Key on the rendered glyph so ligatures (!=, &&) blur as one piece.
        if (txt.text().trim().length === 0) continue;
        txt.cache(true);
        txt.cachePadding(20);
        txt.filters(() => [blur(sig())]);
      }
    }
  }

  // ── 9s episode: one scroll to the boolean's use site, soften everything else ──
  yield* s.complexSaveCode.scrollTo(29, 1.4, easeInOutCubic);
  yield* bRest(6, 1.0, easeInOutSine);
  yield* waitFor(6.6);

  // Then the whole method blurs and the verdict blooms on top of it.
  yield* all(
    bRest(9, 1.0, easeInOutSine),
    bGuard(9, 1.0, easeInOutSine),
  );

  // ── PERMISSION verdict — blooms on TOP of the fully-blurred method ──
  s.bigScale().moveToTop();
  s.bigScale().position([0, 0]);
  s.bigScale().scale(1);
  yield* s.bigScale().opacity(1, 0.6, easeInOutSine);

  // A couple of seconds later the blurred code dissolves, leaving only the verdict.
  yield* waitFor(2.0);
  yield* s.complexSaveCode.node.opacity(0, 1.4, easeInOutSine);

  // Dock the verdict up under PERMISSION — drop the safe/risky labels first, then
  // migrate the dots to the small rating slot at top-left (as it was before).
  yield* all(
    s.bigSafeLabel().opacity(0, 0.4, easeInOutSine),
    s.bigRiskyLabel().opacity(0, 0.4, easeInOutSine),
  );
  const SMALL_TARGET_SCALE = (DOT_R * 2) / (BIG_R * 2);
  yield* all(
    s.bigScale().position([NAME_XS[0], DOTS_Y], 1.0, easeInOutSine),
    s.bigScale().scale(SMALL_TARGET_SCALE, 1.0, easeInOutSine),
  );
  yield* waitFor(1.2);
  yield* s.bigScale().opacity(0, 0.5, easeInOutSine);
});
