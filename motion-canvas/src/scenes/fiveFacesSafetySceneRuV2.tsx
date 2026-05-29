import {makeScene2D} from '@motion-canvas/2d';
import {Rect} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, easeInOutSine, waitFor} from '@motion-canvas/core';
import {CodeLine} from '../core/code/components/CodeLine';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Fonts} from '../core/theme';
import {
  createFiveFacesStage,
  NAME_XS,
  FACES,
  CODE_RULES, CODE_LH,
  CALL_X, CALL_W, IMPL_X, IMPL_W,
  IMPL_FONT_SIZE, IMPL_LH,
  TRANSPARENT_CARD, CUSTOM_TYPES,
  METHOD_COLOR, PARAM_DARK, NAMED_PARAMS,
  blockLines,
  paintNamedParams,
} from './fiveFacesBooleanV2Setup';

// ── Clean split — the boolean method becomes two named operations ─────

// What survives the morph: the soft branch, lifted out into its own method.
const IMPL_SOFT_DELETE = `fun softDelete(userId: UserId, deletedAt: Instant, deletedBy: UserId): DeletedUser {
    val user = users.requireById(userId)

    return users.markDeleted(
        userId = user.id,
        deletedAt = deletedAt,
        deletedBy = deletedBy,
    )
}`;

// Slides in below — the cascade reborn as its own named operation.
const IMPL_HARD_DELETE = `fun hardDelete(userId: UserId) {
    sessions.deleteByUser(userId)
    credentials.deleteByUser(userId)
    users.delete(userId)
}`;

// Cost beat — softDelete implies a way back. One flag became a lifecycle.
const IMPL_RESTORE = `fun restore(userId: UserId): DeletedUser {
    return users.clearDeleted(userId)
}`;

// Call site — the dangerous bit disappears, the verb names itself.
const CALL_SAFETY_AFTER = `@Service
class AccountDeletionService(

    private val users: UserRepository,
    private val sessions: UserSessionRepository,
    private val auditLog: AuditLog,
    private val clock: Clock,
) {

    fun deleteAccount(userId: UserId, actor: UserId): DeletionResult {
        val user = users.requireActive(userId)

        sessions.revokeAll(user.id)

        val deletedUser = deletion.softDelete(
            userId = user.id,
            deletedAt = clock.instant(),
            deletedBy = actor,
        )

        auditLog.record(
            actorId = actor,
            action = "user_deleted",
            resourceId = user.id.value,
        )

        return DeletionResult.Deleted(deletedUser.id)
    }
}`;

const SAFETY_RULES: ColorRule[] = [
  ...CODE_RULES,
  {match: /^(softDelete|hardDelete|restore|clearDeleted)$/, color: METHOD_COLOR},
];

const STRIPE_COLOR = 'rgba(255, 80, 120, 0.18)';

const SOFT_LINES = IMPL_SOFT_DELETE.split('\n').length;
const HARD_LINES = IMPL_HARD_DELETE.split('\n').length;
const RESTORE_LINES = IMPL_RESTORE.split('\n').length;

// Per-line painter for named-argument parameters (the identifier on the LHS
// of `=`). Passed to morphTo's recolorLine hook so they morph in already in
// the param colour instead of flashing white and being repainted afterwards.
const paintNamedArgsLine = (line: CodeLine): void => {
  const toks = line.tokens;
  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];
    if (!NAMED_PARAMS.includes(tok.text)) continue;
    let p = i - 1;
    while (p >= 0 && toks[p].text.trim() === '') p--;
    const prev = p >= 0 ? toks[p].text.trim() : '';
    if (prev === 'val' || prev === 'var') continue;
    let n = i + 1;
    while (n < toks.length && toks[n].text.trim() === '') n++;
    if (n < toks.length && toks[n].text.trim() === '=') {
      tok.ref().fill(PARAM_DARK);
    }
  }
};

// ── Scene ────────────────────────────────────────────────────────────

export default makeScene2D(function* (view) {
  const s = createFiveFacesStage(view);

  // Scene starts with light at MODE's position, bgCover already gone.
  s.baseX(NAME_XS[1]);
  s.bgCover().opacity(0);

  const callMC = s.callCodes[2];
  const implMC = s.implCodes[2];

  // Method blocks stack upward from a floor; each sits one gap above the
  // next. `bottom` is the floor — the bottom-most method's closing brace.
  const GAP = IMPL_LH * 2;
  const stackYs = (fromFloor: number[], bottom: number): number[] => {
    const ys: number[] = [];
    let b = bottom;
    for (const n of fromFloor) {
      const span = (n - 1) * IMPL_LH;
      ys.push(b - span / 2);
      b = b - span - GAP;
    }
    return ys;
  };

  // ── Face beat ──────────────────────────────────────────────────────
  yield* s.baseX(NAME_XS[2], 0.9, easeInOutSine);
  s.arrivalTime(view.globalTime());
  yield* waitFor(0.18);
  yield* s.showCallCode(2);
  yield* waitFor(4.5);
  yield* all(
    s.spotlightLines(callMC, blockLines(FACES[2].callBlock), 0.32, 0.55),
    s.showImplCode(2),
    s.showViz(2),
  );
  yield* waitFor(2.0);
  yield* s.safetyDriver();
  yield* s.restoreLines(callMC, 0.8);
  yield* waitFor(1.0);
  yield* s.hideViz(2, 0.5);
  yield* waitFor(0.8);

  // ── MARK: the dangerous bit (param + the if that branches on it) ────
  {
    const paramLine = implMC.getLine(0);   // fun delete(..., soft: Boolean ...)
    const ifLine = implMC.getLine(5);        // if (soft) {
    const anims: any[] = [];
    if (paramLine) anims.push(...paramLine.colorizeByRuleAnimated('soft', METHOD_COLOR, 0.4));
    if (ifLine) anims.push(...ifLine.colorizeByRuleAnimated('soft', METHOD_COLOR, 0.4));
    if (anims.length) yield* all(...anims);
  }
  yield* waitFor(1.0);

  // ── MORPH: the if-gate and the hard cascade flash out; the soft ─────
  // branch lifts free into softDelete (named args keep their colour).
  yield* implMC.morphTo(IMPL_SOFT_DELETE, {
    removeDuration: 0.35,
    moveDuration: 0.5,
    charDelay: 0.015,
    flashRemovedColor: METHOD_COLOR,
    flashRemovedDuration: 0.25,
    addStyle: 'typewriter',
    scrollStrategy: 'block',
    // The markDeleted block only re-indents — pair it by content so its
    // tokens slide to the new position instead of being re-typed, and run
    // the block's lines in parallel so it travels as one unit (no per-line
    // staggered left-creep). Slide duration matches the vertical settle.
    pairBySimilarity: true,
    tokenSlideDuration: 0.5,
    lineOrder: 'parallel',
    recolorLine: paintNamedArgsLine,
  });
  implMC.colorize(SAFETY_RULES);
  paintNamedParams(implMC);
  implMC.recenterContent();
  yield* waitFor(0.6);

  // ── Call site — the highlight marks the doomed bit, then clears, then
  // the caller names the operation it actually wants. ─────────────────
  const stripeLineY = callMC.node.position.y() + callMC.getLineY(16);   // soft = true,
  const stripe = createRef<Rect>();
  view.add(
    <Rect
      ref={stripe}
      x={CALL_X}
      y={stripeLineY}
      width={CALL_W - 40}
      height={CODE_LH * 1.15}
      fill={STRIPE_COLOR}
      radius={4}
      opacity={0}
    />,
  );
  yield* stripe().opacity(1, 0.4, easeInOutSine);
  yield* waitFor(0.7);
  yield* stripe().opacity(0, 0.3, easeInOutSine);   // clears right before the morph
  yield* callMC.morphTo(CALL_SAFETY_AFTER, {
    removeDuration: 0.3,
    moveDuration: 0.4,
    charDelay: 0.015,
    addStyle: 'typewriter',
    scrollStrategy: 'block',
    recolorLine: paintNamedArgsLine,
  });
  callMC.colorize(SAFETY_RULES);
  paintNamedParams(callMC);
  callMC.recenterContent();
  yield* waitFor(0.6);

  // ── Anchor (mirrors PERMISSION): the bottom-most method rests its
  // closing brace on the call's deleteAccount closing brace (2nd-to-last
  // line; the very last line is the class brace). ────────────────────────
  const braceY = callMC.node.position.y() + callMC.getLineY(callMC.lineCount - 2);
  // Final 3-method layout, solved once. softDelete and hardDelete land in
  // their FINAL spots immediately; restore's floor slot stays empty until
  // the cost beat fills it. Nothing ever re-stacks, so softDelete moves
  // exactly once (no dive-down-then-climb-back).
  const [restoreY, hardY, softY] = stackYs([RESTORE_LINES, HARD_LINES, SOFT_LINES], braceY);

  // ── SPLIT: softDelete settles to its place; hardDelete appears below ─
  const hardMC = Manticore.create(IMPL_HARD_DELETE, {
    x: IMPL_X, y: hardY, width: IMPL_W,
    fontSize: IMPL_FONT_SIZE, lineHeight: IMPL_LH,
    fontFamily: Fonts.code, theme: DryFiltersV3CodeTheme,
    noClip: true, cardStyle: TRANSPARENT_CARD,
    glowAccent: false, customTypes: CUSTOM_TYPES,
  });
  hardMC.mount(view);
  hardMC.colorize(SAFETY_RULES);
  paintNamedParams(hardMC);
  hardMC.node.opacity(0);
  yield* all(
    implMC.node.position.y(softY, 0.55, easeInOutCubic),
    hardMC.node.opacity(1, 0.55, easeInOutSine),
  );
  yield* waitFor(1.2);

  // ── Consistent close marker — the scale dot lights up ───────────────
  yield* s.showSmallScale(2);
  yield* waitFor(1.5);

  // ── COST: restore drops into the reserved floor slot — a lifecycle ──
  // (soft and hard don't budge; the API just grew downward to the brace.)
  const restoreMC = Manticore.create(IMPL_RESTORE, {
    x: IMPL_X, y: restoreY, width: IMPL_W,
    fontSize: IMPL_FONT_SIZE, lineHeight: IMPL_LH,
    fontFamily: Fonts.code, theme: DryFiltersV3CodeTheme,
    noClip: true, cardStyle: TRANSPARENT_CARD,
    glowAccent: false, customTypes: CUSTOM_TYPES,
  });
  restoreMC.mount(view);
  restoreMC.colorize(SAFETY_RULES);
  paintNamedParams(restoreMC);
  restoreMC.node.opacity(0);
  yield* restoreMC.node.opacity(1, 0.6, easeInOutSine);
  yield* waitFor(3.0);

  // ── Close ───────────────────────────────────────────────────────────
  yield* all(
    s.hideCallCode(2, 0.5),
    s.hideImplCode(2, 0.5),
    s.hideSmallScale(2, 0.4),
    hardMC.node.opacity(0, 0.5, easeInOutSine),
    restoreMC.node.opacity(0, 0.5, easeInOutSine),
  );
  yield* waitFor(0.5);
});
