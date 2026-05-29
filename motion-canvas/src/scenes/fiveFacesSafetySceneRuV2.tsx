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
  yForCode,
} from './fiveFacesBooleanV2Setup';

// ── Clean split — the boolean method becomes two named operations ─────

// soft branch survives; the cascade flashes out during the morph.
const IMPL_SOFT_DELETE = `fun softDelete(userId: UserId, deletedAt: Instant, deletedBy: UserId): DeletedUser {
    return users.markDeleted(
        userId = userId,
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

// ── Scene ────────────────────────────────────────────────────────────

export default makeScene2D(function* (view) {
  const s = createFiveFacesStage(view);

  // Scene starts with light at MODE's position, bgCover already gone.
  s.baseX(NAME_XS[1]);
  s.bgCover().opacity(0);

  // ── Face beat ──────────────────────────────────────────────────────
  yield* s.baseX(NAME_XS[2], 0.9, easeInOutSine);
  s.arrivalTime(view.globalTime());
  yield* waitFor(0.18);
  yield* s.showCallCode(2);
  yield* waitFor(4.5);
  yield* all(
    s.spotlightLines(s.callCodes[2], blockLines(FACES[2].callBlock), 0.32, 0.55),
    s.showImplCode(2),
    s.showViz(2),
  );
  yield* waitFor(2.0);
  yield* s.safetyDriver();
  yield* s.restoreLines(s.callCodes[2], 0.8);
  yield* waitFor(1.0);
  yield* s.hideViz(2, 0.5);
  yield* waitFor(0.8);

  // ── MARK: the dangerous bit (param + the if that branches on it) ────
  {
    const paramLine = s.implCodes[2].getLine(0);   // fun delete(..., soft: Boolean ...)
    const ifLine = s.implCodes[2].getLine(5);        // if (soft) {
    const anims: any[] = [];
    if (paramLine) anims.push(...paramLine.colorizeByRuleAnimated('soft', METHOD_COLOR, 0.4));
    if (ifLine) anims.push(...ifLine.colorizeByRuleAnimated('soft', METHOD_COLOR, 0.4));
    if (anims.length) yield* all(...anims);
  }
  yield* waitFor(1.2);

  // ── MORPH: split — soft branch becomes softDelete, cascade flashes out
  yield* s.implCodes[2].morphTo(IMPL_SOFT_DELETE, {
    removeDuration: 0.3,
    moveDuration: 0.45,
    charDelay: 0.015,
    flashRemovedColor: METHOD_COLOR,
    flashRemovedDuration: 0.2,
    addStyle: 'typewriter',
    scrollStrategy: 'block',
  });
  s.implCodes[2].colorize(SAFETY_RULES);
  paintNamedParams(s.implCodes[2]);
  s.implCodes[2].recenterContent();
  yield* waitFor(0.8);

  // ── hardDelete slides in below — the split made visible ─────────────
  const STACK_TOP_Y = -140;
  const HARD_Y = 56;
  const RESTORE_Y = 196;

  const hardMC = Manticore.create(IMPL_HARD_DELETE, {
    x: IMPL_X, y: HARD_Y, width: IMPL_W,
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
    s.implCodes[2].node.position.y(STACK_TOP_Y, 0.5, easeInOutCubic),
    hardMC.node.opacity(1, 0.55, easeInOutSine),
  );
  yield* waitFor(1.0);

  // ── Call site — the bit disappears, the verb names itself ───────────
  const callLines = FACES[2].callCode.split('\n').length;
  const callCenterY = yForCode(FACES[2].callCode);
  const stripeLineY = callCenterY + (16 - (callLines - 1) / 2) * CODE_LH;   // line 16: soft = true,

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
  yield* waitFor(0.6);

  yield* s.callCodes[2].morphTo(CALL_SAFETY_AFTER, {
    removeDuration: 0.3,
    moveDuration: 0.4,
    charDelay: 0.015,
    addStyle: 'typewriter',
    scrollStrategy: 'block',
  });
  s.callCodes[2].colorize(SAFETY_RULES);
  paintNamedParams(s.callCodes[2]);
  s.callCodes[2].recenterContent();
  yield* waitFor(1.0);
  yield* stripe().opacity(0, 0.5, easeInOutSine);
  yield* waitFor(0.8);

  // ── Consistent close marker — the scale dot lights up ───────────────
  yield* s.showSmallScale(2);
  yield* waitFor(1.5);

  // ── COST: one flag quietly became a lifecycle — restore slides in ───
  const restoreMC = Manticore.create(IMPL_RESTORE, {
    x: IMPL_X, y: RESTORE_Y, width: IMPL_W,
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
