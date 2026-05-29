import {makeScene2D} from '@motion-canvas/2d';
import {Rect} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, easeInOutSine, waitFor} from '@motion-canvas/core';
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
  METHOD_COLOR,
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

const SOFT_LINES = IMPL_SOFT_DELETE.split('\n').length;     // 8
const HARD_LINES = IMPL_HARD_DELETE.split('\n').length;     // 5
const RESTORE_LINES = IMPL_RESTORE.split('\n').length;      // 3

// ── Scene ────────────────────────────────────────────────────────────

export default makeScene2D(function* (view) {
  const s = createFiveFacesStage(view);

  // Scene starts with light at MODE's position, bgCover already gone.
  s.baseX(NAME_XS[1]);
  s.bgCover().opacity(0);

  const callMC = s.callCodes[2];
  const implMC = s.implCodes[2];

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

  // ── Shared bottom baseline = the call code's natural closing brace ──
  // The left code never moves; the right method stack hangs its bottom
  // brace on this same line. container.y = bottom - ((lines-1)/2)*lh.
  let baseY = callMC.node.position.y() + callMC.getLineY(callMC.lineCount - 1);
  const GAP = IMPL_LH * 2;
  const topY = (lines: number, bottom: number = baseY): number =>
    bottom - ((lines - 1) / 2) * IMPL_LH;
  // Centers for a stack of method blocks resting on the baseline, given
  // their line counts from the floor up.
  const stackYs = (fromFloor: number[]): number[] => {
    const ys: number[] = [];
    let bottom = baseY;
    for (const n of fromFloor) {
      const span = (n - 1) * IMPL_LH;
      ys.push(bottom - span / 2);
      bottom = bottom - span - GAP;
    }
    return ys;
  };

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
  // branch lifts free into softDelete.
  yield* implMC.morphTo(IMPL_SOFT_DELETE, {
    removeDuration: 0.35,
    moveDuration: 0.5,
    charDelay: 0.015,
    flashRemovedColor: METHOD_COLOR,
    flashRemovedDuration: 0.25,
    addStyle: 'typewriter',
    scrollStrategy: 'block',
  });
  implMC.colorize(SAFETY_RULES);
  paintNamedParams(implMC);
  implMC.recenterContent();
  yield* waitFor(0.5);

  // ── softDelete settles onto the baseline (left code stays put) ──────
  yield* implMC.node.position.y(topY(SOFT_LINES), 0.6, easeInOutCubic);
  yield* waitFor(1.0);

  // ── SPLIT: hardDelete takes the floor, softDelete climbs above it ────
  const hardMC = Manticore.create(IMPL_HARD_DELETE, {
    x: IMPL_X, y: topY(HARD_LINES), width: IMPL_W,
    fontSize: IMPL_FONT_SIZE, lineHeight: IMPL_LH,
    fontFamily: Fonts.code, theme: DryFiltersV3CodeTheme,
    noClip: true, cardStyle: TRANSPARENT_CARD,
    glowAccent: false, customTypes: CUSTOM_TYPES,
  });
  hardMC.mount(view);
  hardMC.colorize(SAFETY_RULES);
  paintNamedParams(hardMC);
  hardMC.node.opacity(0);

  {
    const [hardY, softY] = stackYs([HARD_LINES, SOFT_LINES]);
    hardMC.node.position.y(hardY);
    yield* all(
      implMC.node.position.y(softY, 0.5, easeInOutCubic),
      hardMC.node.opacity(1, 0.55, easeInOutSine),
    );
  }
  yield* waitFor(1.0);

  // ── Call site — the highlight marks the doomed bit, then clears ─────
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
  // Highlight disappears exactly before the morph.
  yield* stripe().opacity(0, 0.3, easeInOutSine);

  yield* callMC.morphTo(CALL_SAFETY_AFTER, {
    removeDuration: 0.3,
    moveDuration: 0.4,
    charDelay: 0.015,
    addStyle: 'typewriter',
    scrollStrategy: 'block',
  });
  callMC.colorize(SAFETY_RULES);
  paintNamedParams(callMC);
  callMC.recenterContent();   // visually a no-op; only normalizes line coords
  // Re-anchor the RIGHT stack to the call's actual post-morph bottom brace,
  // so the left code never has to move to stay aligned.
  baseY = callMC.node.position.y() + callMC.getLineY(callMC.lineCount - 1);
  {
    const [hardY, softY] = stackYs([HARD_LINES, SOFT_LINES]);
    if (Math.abs(softY - implMC.node.position.y()) > 1) {
      yield* all(
        implMC.node.position.y(softY, 0.35, easeInOutSine),
        hardMC.node.position.y(hardY, 0.35, easeInOutSine),
      );
    }
  }
  yield* waitFor(1.2);

  // ── Consistent close marker — the scale dot lights up ───────────────
  yield* s.showSmallScale(2);
  yield* waitFor(1.5);

  // ── COST: restore takes the floor, soft+hard climb — a lifecycle ────
  const restoreMC = Manticore.create(IMPL_RESTORE, {
    x: IMPL_X, y: topY(RESTORE_LINES), width: IMPL_W,
    fontSize: IMPL_FONT_SIZE, lineHeight: IMPL_LH,
    fontFamily: Fonts.code, theme: DryFiltersV3CodeTheme,
    noClip: true, cardStyle: TRANSPARENT_CARD,
    glowAccent: false, customTypes: CUSTOM_TYPES,
  });
  restoreMC.mount(view);
  restoreMC.colorize(SAFETY_RULES);
  paintNamedParams(restoreMC);
  restoreMC.node.opacity(0);

  {
    const [restoreY, hardY, softY] = stackYs([RESTORE_LINES, HARD_LINES, SOFT_LINES]);
    restoreMC.node.position.y(restoreY);
    yield* all(
      implMC.node.position.y(softY, 0.5, easeInOutCubic),
      hardMC.node.position.y(hardY, 0.5, easeInOutCubic),
      restoreMC.node.opacity(1, 0.6, easeInOutSine),
    );
  }
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
