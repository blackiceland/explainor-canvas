import {makeScene2D} from '@motion-canvas/2d';
import {Rect} from '@motion-canvas/2d';
import {all, createRef, easeInOutSine, linear, waitFor} from '@motion-canvas/core';
import {CodeLine} from '../core/code/components/CodeLine';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Fonts} from '../core/theme';
import {
  createFiveFacesStage,
  NAME_XS,
  FACES,
  CODE_RULES, CODE_LH,
  CALL_X, CALL_W,
  METHOD_COLOR, PARAM_DARK, NAMED_PARAMS, METHOD_NAMES,
  CUSTOM_TYPES, TRANSPARENT_CARD,
  blockLines,
  paintNamedParams,
} from './fiveFacesBooleanV2Setup';

// ── Clean split — the boolean method becomes two named operations ─────

// One morph turns the single delete(soft) into BOTH methods at once. The soft
// branch keeps its body and becomes softDelete; the hard branch drops out into
// hardDelete right below. Same shape, same return — two alternatives at one
// level, not a verb with a void aside. No infrastructure cascade (sessions/
// credentials would pull the eye into plumbing); markDeleted (records) vs
// deletePermanently (erases) is the whole contrast, and the destruction shows
// in the table, where the row vanishes.
const IMPL_SAFETY_AFTER = `fun softDelete(userId: UserId, deletedBy: UserId): DeletedUser {
    val user = users.requireById(userId)

    return users.markDeleted(
        userId = user.id,
        deletedAt = clock.instant(),
        deletedBy = deletedBy,
    )
}

fun hardDelete(userId: UserId): DeletedUser {
    users.deletePermanently(userId)

    return DeletedUser(userId)
}`;

// Call site — the dangerous bit disappears, the verb names itself.
const CALL_SAFETY_AFTER = `@Service
class AccountDeletionService(

    private val users: UserRepository,
    private val sessions: UserSessionRepository,
    private val deletion: UserDeletion,
    private val auditLog: AuditLog,
) {

    fun deleteAccount(userId: UserId, actor: UserId): DeletionResult {
        val user = users.requireActive(userId)
        sessions.revokeAll(user.id)

        val deletedUser = deletion.softDelete(
            userId = user.id,
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
  {match: /^(softDelete|hardDelete)$/, color: METHOD_COLOR},
];

const STRIPE_COLOR = 'rgba(255, 80, 120, 0.18)';

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

// ── CODA: the extracted solution, revealed top-down ──────────────────────
// A separate aside after the face resolves, shown centred. First the public API —
// the two safe named methods the callers use — then the shared private
// delete(hard: Boolean) appears below them. The boolean survives as a justified
// INTERNAL detail, hidden behind the two names.
const CODA_EXTRACTED = `fun softDelete(userId: UserId) {
    delete(userId, hard = false)
}

fun hardDelete(userId: UserId) {
    delete(userId, hard = true)
}

private fun delete(userId: UserId, hard: Boolean) {
    val user = users.requireById(userId)
    checkPermissions(user)
    writeAuditLog(user)
    closeSessions(user)

    if (hard) {
        users.deletePermanently(user.id)
    } else {
        users.markDeleted(user.id)
    }
}`;

// Same colour rules as the face; the named-arg painter also covers `hard = …`.
const CODA_PARAMS = [...NAMED_PARAMS, 'hard'];

const paintCodaParamsLine = (line: CodeLine): void => {
  const toks = line.tokens;
  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];
    if (!CODA_PARAMS.includes(tok.text)) continue;
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

const paintCodaParams = (code: Manticore): void => {
  for (let i = 0; i < code.lineCount; i++) {
    const line = code.getLine(i);
    if (line) paintCodaParamsLine(line);
  }
};

// CODA ONLY: method calls take a clean, restrained rose (solid — no alpha, so it
// doesn't muddy against the background) so the named definitions stand out. A
// definition is the method token right after `fun`; every other method token
// (calls) takes the gentle tone. The main face is untouched.
const CALL_SOFT = '#E89DAB';
const METHOD_TOKENS = new Set<string>([
  ...METHOD_NAMES,
  'softDelete', 'hardDelete',
  'checkPermissions', 'writeAuditLog', 'closeSessions',
]);
const paintMethodRolesLine = (line: CodeLine): void => {
  const toks = line.tokens;
  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];
    if (!METHOD_TOKENS.has(tok.text)) continue;
    let p = i - 1;
    while (p >= 0 && toks[p].text.trim() === '') p--;
    const prev = p >= 0 ? toks[p].text.trim() : '';
    tok.ref().fill(prev === 'fun' ? METHOD_COLOR : CALL_SOFT);
  }
};
const paintMethodRoles = (code: Manticore): void => {
  for (let i = 0; i < code.lineCount; i++) {
    const line = code.getLine(i);
    if (line) paintMethodRolesLine(line);
  }
};

// Single centred coda block (24/36), TOP-anchored at CODA_TOP — raised so it sits
// a bit higher while still clearing the spotlight glow (which fades by ≈ -340).
// 20 lines bottom out ≈ +414. Revealed top-down: the two public methods first,
// then the shared private delete below them. The rating blinks in last.
const CODA_FS  = 24;
const CODA_LH  = 36;
const CODA_TOP = -270;
const codaY = (src: string): number =>
  CODA_TOP + ((src.split('\n').length - 1) / 2) * CODA_LH;
const CODA_CX = 65;   // container centre (text starts at CODA_CX - width/2) so the full block sits centred

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

  // ── MARK: the dangerous bit (param + the if that branches on it) ────
  {
    const paramLine = implMC.getLine(0);   // fun delete(... soft: Boolean ...)
    const ifLine = implMC.getLine(4);        // if (soft) {
    const anims: any[] = [];
    if (paramLine) anims.push(...paramLine.colorizeByRuleAnimated('soft', METHOD_COLOR, 0.4));
    if (ifLine) anims.push(...ifLine.colorizeByRuleAnimated('soft', METHOD_COLOR, 0.4));
    if (anims.length) yield* all(...anims);
  }
  yield* waitFor(1.0);

  // ── MORPH: the boolean splits into BOTH named methods in one pass. The
  // if-gate and the soft/deletedAt params flash out; softDelete keeps the
  // markDeleted body, hardDelete's header types in at the same time as its
  // body so neither method appears headerless. Parallel block+line order =
  // both methods form together (the user's "simultaneous"); no token-slide
  // and no similarity-pairing, so tokens retype/settle straight — nothing
  // creeps diagonally. The pair re-centres as one block — softDelete never
  // moves again afterwards. ───────────────────────────────────────────────
  yield* implMC.morphTo(IMPL_SAFETY_AFTER, {
    removeDuration: 0.3,
    moveDuration: 0.45,
    charDelay: 0.015,
    flashRemovedColor: METHOD_COLOR,
    flashRemovedDuration: 0.2,
    addStyle: 'typewriter',
    scrollStrategy: 'block',
    lineOrder: 'parallel',
    blockOrder: 'parallel',
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
  // The call morph drops the clock inject above the signature, so deleteAccount
  // rises one line. The right column has nothing to morph here, so lift it the
  // same one line in sympathy — both signatures travel up together instead of
  // the left drifting alone. (Delayed past removeDuration to track the settle.)
  const implLiftTarget = implMC.node.position.y() - CODE_LH;
  yield* all(
    callMC.morphTo(CALL_SAFETY_AFTER, {
      removeDuration: 0.3,
      moveDuration: 0.4,
      charDelay: 0.015,
      addStyle: 'typewriter',
      scrollStrategy: 'block',
      recolorLine: paintNamedArgsLine,
    }),
    (function* () {
      yield* waitFor(0.25);
      yield* implMC.node.position.y(implLiftTarget, 0.45, easeInOutSine);
    })(),
  );
  callMC.colorize(SAFETY_RULES);
  paintNamedParams(callMC);
  callMC.recenterContent();
  yield* waitFor(0.6);

  // ── Both methods are already on screen from the single morph — no split
  // stage and no repositioning. Hold, then close. The rating is withheld until
  // the coda has shown the whole code. ───────────────────────────────────
  yield* waitFor(1.2);

  // ── Hold on the clean solution: the caller names the operation it wants
  // (deletion.softDelete), and the boolean has become two named methods —
  // softDelete records, hardDelete erases. The cost was already paid on
  // screen by the table, where the row vanished; no extra code is piled on. ─
  yield* waitFor(2.4);

  // ── Clear only the two columns. The SAFETY name stays in the spotlight; the
  // coda elaborates the nuance beneath it rather than replacing the frame. The
  // rating blinks in later, once the whole coda code is on screen. ─────────
  yield* all(
    s.hideCallCode(2, 0.5),
    s.hideImplCode(2, 0.5),
  );
  yield* waitFor(0.4);

  // ── CODA: the extracted solution, revealed top-down ────────────────────
  // One centred block. First the public API (softDelete / hardDelete), then the
  // shared private delete(hard: Boolean) below it. Each section develops as one
  // (no per-line stagger); nothing moves once placed.
  const coda = Manticore.create(CODA_EXTRACTED, {
    x: CODA_CX,
    y: codaY(CODA_EXTRACTED),
    width: 900,
    fontSize: CODA_FS,
    lineHeight: CODA_LH,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    noClip: true,
    cardStyle: TRANSPARENT_CARD,
    glowAccent: false,
    customTypes: CUSTOM_TYPES,
  });
  coda.mount(view);
  coda.colorize(SAFETY_RULES);
  paintCodaParams(coda);
  paintMethodRoles(coda);   // definitions full rose, calls pale
  // Node visible, every line hidden — so we can reveal in two beats.
  coda.node.opacity(1);
  for (let i = 0; i < coda.lineCount; i++) {
    const ln = coda.getLine(i);
    if (ln) ln.node.opacity(0);
  }

  // 1. The public API first — the two named methods the callers actually see.
  const PUBLIC_LINES = 7;   // softDelete + blank + hardDelete (lines 0..6)
  const publicAnims: any[] = [];
  for (let i = 0; i < PUBLIC_LINES; i++) {
    const ln = coda.getLine(i);
    if (ln) publicAnims.push(ln.node.opacity(1, 0.6, easeInOutSine));
  }
  yield* all(...publicAnims);
  yield* waitFor(2.2);

  // 2. Then the shared delete underneath — where the boolean actually lives,
  //    justified and out of the callers' sight. Reveals as one block below.
  const deleteAnims: any[] = [];
  for (let i = PUBLIC_LINES; i < coda.lineCount; i++) {
    const ln = coda.getLine(i);
    if (ln) deleteAnims.push(ln.node.opacity(1, 0.7, easeInOutSine));
  }
  yield* all(...deleteAnims);
  yield* waitFor(1.8);

  // 3. Verdict — now, with the whole solution on screen, the rating blinks in.
  //    Crisp on/off (linear snaps) with a beat held between each, then settles lit.
  const verdict = s.smallScaleNodes[2]();
  yield* verdict.opacity(1, 0.05, linear);
  yield* waitFor(0.1);
  yield* verdict.opacity(0, 0.05, linear);
  yield* waitFor(0.08);
  yield* verdict.opacity(1, 0.05, linear);
  yield* waitFor(0.1);
  yield* verdict.opacity(0, 0.05, linear);
  yield* waitFor(0.08);
  yield* verdict.opacity(1, 0.1, linear);
  yield* waitFor(1.7);

  // Close everything together.
  yield* all(
    coda.node.opacity(0, 0.7, easeInOutSine),
    s.nameRefs[2]().opacity(0, 0.7, easeInOutSine),
    verdict.opacity(0, 0.7, easeInOutSine),
  );
  yield* waitFor(0.6);
});
