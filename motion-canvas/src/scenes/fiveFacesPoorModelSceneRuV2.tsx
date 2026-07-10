import {Node, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  easeInOutCubic,
  easeInOutSine,
  makeRef,
  waitFor,
} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {
  Canon,
  CanonCodeTheme,
  paintCanonParams,
  paintCanonParamsLine,
  paintCanonMethodCalls,
  paintCanonMethodCallsLine,
} from '../core/code/model/paletteCanon';
import {Fonts} from '../core/theme';
import {
  createFiveFacesStage,
  NAME_XS,
  FACES,
  CANON_CODE_RULES,
  IMPL_X,
  IMPL_W,
  IMPL_FONT_SIZE,
  IMPL_LH,
  TRANSPARENT_CARD,
  CUSTOM_TYPES,
  METHOD_COLOR,
  FUN_BLUE,
  blockLines,
} from './fiveFacesBooleanV2Setup';

// ── Morph targets — active: Boolean → status: CampaignStatus ─────────────
// The honest fix: the flag that crushed six lifecycle states into a bit is
// replaced by the type that names all six. Minimal diff — signature param and
// the one copy() field.
const IMPL_AFTER = `fun update(campaignId: CampaignId, status: CampaignStatus, startedAt: Instant): Campaign {
    val campaign = requireById(campaignId)

    val updated = campaign.copy(
        status = status,
        startedAt = startedAt,
        updatedAt = clock.instant(),
    )

    return campaigns.save(updated)
}`;

// Call-site: launching a campaign is no longer "active = true" (which true?) —
// it is one named state.
const CALL_AFTER = `@Service
class CampaignLauncher(

    private val campaigns: CampaignRepository,
    private val scheduler: CampaignScheduler,
    private val events: DomainEventPublisher,
    private val clock: Clock,
) {

    fun launchNow(campaignId: CampaignId): Campaign {
        val campaign = campaigns.requireReady(campaignId)

        val updated = campaigns.update(
            campaignId = campaign.id,
            status = CampaignStatus.RUNNING,
            startedAt = clock.instant(),
        )

        scheduler.enqueue(updated.id)

        events.publish(
            CampaignActivated(
                campaignId = updated.id,
                startedAt = updated.startedAt,
            )
        )

        return updated
    }
}`;

// The type the flag should have been all along — the whole lifecycle, named.
const ENUM_CODE = `enum class CampaignStatus {
    DRAFT,
    SCHEDULED,
    RUNNING,
    PAUSED,
    COMPLETED,
    ARCHIVED,
}`;

// ── Coloring ──────────────────────────────────────────────────────────
const POOR_TYPES = [...CUSTOM_TYPES, 'CampaignStatus'];
const POOR_RULES: ColorRule[] = [
  ...CANON_CODE_RULES,
  {match: /^(enum|when)$/, color: FUN_BLUE},
  // CampaignStatus isn't in the shared CUSTOM_TYPES the code Manticores were
  // built with, so force the type colour by text.
  {match: /^CampaignStatus$/, color: Canon.type},
];

// recolorLine hook for morphTo — freshly typed tokens land in their final
// colour instead of flashing cream/rose until the post-morph pass runs.
const recolorPoorLine = (line: any): void => {
  paintCanonParamsLine(line);
  paintCanonMethodCallsLine(line);
};

const applyPoorColors = (mc: Manticore): void => {
  mc.colorize(POOR_RULES);
  paintCanonParams(mc);
  paintCanonMethodCalls(mc);
};

// ── Interlude viz palette ───────────────────────────────────────────────
const INK     = '#F4F1EB';
const INK70   = 'rgba(244,241,235,0.70)';
const ON      = 'rgba(133,176,220,0.24)';   // Canon.param low alpha — true / selected
const OFFDIM  = 'rgba(244,241,235,0.10)';    // false / unselected
const BAD      = 'rgba(255,140,163,0.30)';   // Canon.methodDef low alpha — illegal state
const BAD_TXT  = Canon.methodDef;            // rose — the contradiction

// ═══════════════════════════════════════════════════════════════════════
export default makeScene2D(function* (view) {
  const s = createFiveFacesStage(view);

  // Канон-палитра на код лица (setup красил старым CODE_RULES).
  applyPoorColors(s.callCodes[4]);
  applyPoorColors(s.implCodes[4]);

  // Правый (impl) блок — 50 влево: одностроковая сигнатура шире, ей нужен
  // запас у правого края (как в SHORTCUT).
  const IMPL_X_POOR = IMPL_X - 50;
  s.implCodes[4].node.position.x(IMPL_X_POOR);

  // Scene enters from SHORTCUT's light position.
  s.baseX(NAME_XS[3]);
  s.bgCover().opacity(0);

  // ── Face beat ──────────────────────────────────────────────────────
  yield* s.baseX(NAME_XS[4], 0.9, easeInOutSine);
  s.arrivalTime(view.globalTime());
  yield* waitFor(0.18);
  yield* s.showCallCode(4);
  yield* waitFor(4.5);
  yield* all(
    s.spotlightLines(s.callCodes[4], blockLines(FACES[4].callBlock), 0.32, 0.55),
    s.showImplCode(4),
    s.showViz(4),
  );
  yield* waitFor(2.0);
  yield* s.poorDriver();          // схлоп: 6 состояний → 2 значения
  yield* s.restoreLines(s.callCodes[4], 0.8);
  yield* waitFor(1.2);
  yield* s.hideViz(4, 0.5);
  yield* waitFor(1.2);

  // ── INTERLUDE (over the blurred code): the bit multiplies → illegal
  // state → one dial. The collapse showed loss; forcing the poor model to
  // grow makes the data lie. The enum answers by making illegal states
  // unrepresentable — the actual danger, and its exact fix.
  yield* all(
    s.callBlurs[4](12, 0.6, easeInOutSine),
    s.implBlurs[4](12, 0.6, easeInOutSine),
  );
  yield* waitFor(0.3);

  const idea      = createRef<Node>();
  const boolGroup = createRef<Node>();
  const dialGroup = createRef<Node>();
  const boolItems: Node[] = [];
  const boolCells: Rect[] = [];
  const boolLbls:  Txt[]  = [];
  const dialCells: Rect[] = [];
  const dialLbls:  Txt[]  = [];

  const BOOLS = ['active', 'paused', 'archived'];
  const BCELL_W = 360, BCELL_H = 60, BPITCH = 84;
  const bY = (i: number): number => (i - 1) * BPITCH;       // -84, 0, 84

  const DIAL = ['DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'ARCHIVED'];
  const DSEL = 2;                                            // RUNNING
  const DCELL_W = 360, DCELL_H = 50, DPITCH = 60;
  const dY = (i: number): number => (i - 2.5) * DPITCH;     // -150..150

  view.add(
    <Node ref={idea}>
      <Node ref={boolGroup}>
        {BOOLS.map((b, i) => (
          <Node ref={makeRef(boolItems, i)} opacity={0}>
            <Rect ref={makeRef(boolCells, i)} x={0} y={bY(i)} width={BCELL_W} height={BCELL_H}
                  radius={12} fill={i === 0 ? ON : OFFDIM} />
            <Txt ref={makeRef(boolLbls, i)} x={0} y={bY(i)} text={b}
                 fontFamily={Fonts.code} fontSize={25} letterSpacing={1}
                 fill={i === 0 ? Canon.param : INK} />
          </Node>
        ))}
      </Node>
      <Node ref={dialGroup} opacity={0}>
        <Txt x={0} y={dY(0) - 66} text={'CampaignStatus'} fontFamily={Fonts.code}
             fontSize={30} letterSpacing={1} fill={Canon.type} />
        {DIAL.map((d, i) => (
          <Rect ref={makeRef(dialCells, i)} x={0} y={dY(i)} width={DCELL_W} height={DCELL_H}
                radius={10} fill={i === DSEL ? ON : OFFDIM} />
        ))}
        {DIAL.map((d, i) => (
          <Txt ref={makeRef(dialLbls, i)} x={0} y={dY(i)} text={d}
               fontFamily={Fonts.code} fontSize={22} letterSpacing={2}
               fill={i === DSEL ? Canon.param : INK70} />
        ))}
      </Node>
    </Node>,
  );

  // 1) The bit multiplies: active (true), then paused, then archived bolted on
  //    — because the shipped boolean was too poor and too costly to change.
  yield* boolItems[0].opacity(1, 0.45, easeInOutSine);
  yield* waitFor(0.5);
  yield* boolItems[1].opacity(1, 0.45, easeInOutSine);
  yield* waitFor(0.3);
  yield* boolItems[2].opacity(1, 0.45, easeInOutSine);
  yield* waitFor(0.6);

  // 2) Illegal state: archived flips true while active is still true — a
  //    contradiction the type system now permits and stores. Both stamp rose.
  yield* all(
    boolCells[2].fill(ON, 0.35, easeInOutSine),
    boolLbls[2].fill(Canon.param, 0.35, easeInOutSine),
  );
  yield* waitFor(0.35);
  yield* all(
    boolCells[0].fill(BAD, 0.3, easeInOutSine),
    boolLbls[0].fill(BAD_TXT, 0.3, easeInOutSine),
    boolCells[2].fill(BAD, 0.3, easeInOutSine),
    boolLbls[2].fill(BAD_TXT, 0.3, easeInOutSine),
    boolCells[0].scale(1.05, 0.2, easeInOutCubic),
    boolCells[2].scale(1.05, 0.2, easeInOutCubic),
  );
  yield* all(
    boolCells[0].scale(1, 0.25, easeInOutCubic),
    boolCells[2].scale(1, 0.25, easeInOutCubic),
  );
  yield* waitFor(1.3);

  // 3) The enum: three independent bits collapse into one dial of six
  //    mutually exclusive positions. The contradiction is gone by design.
  yield* all(
    boolGroup().opacity(0, 0.45, easeInOutSine),
    boolGroup().scale(0.92, 0.45, easeInOutCubic),
  );
  yield* dialGroup().opacity(1, 0.55, easeInOutSine);
  yield* waitFor(0.7);

  // Exactly one can be lit — flick through positions, never two at once.
  const flick = function* (from: number, to: number) {
    yield* all(
      dialCells[from].fill(OFFDIM, 0.28, easeInOutSine),
      dialLbls[from].fill(INK70, 0.28, easeInOutSine),
      dialCells[to].fill(ON, 0.28, easeInOutSine),
      dialLbls[to].fill(Canon.param, 0.28, easeInOutSine),
    );
    yield* waitFor(0.4);
  };
  yield* flick(2, 5);   // running → archived
  yield* flick(5, 3);   // archived → paused
  yield* flick(3, 2);   // back to running (matches the call site)
  yield* waitFor(1.0);

  // ── Back to the code — sharpen it and apply the fix ───────────────────
  yield* all(
    idea().opacity(0, 0.55, easeInOutSine),
    s.callBlurs[4](0, 0.6, easeInOutSine),
    s.implBlurs[4](0, 0.6, easeInOutSine),
  );
  idea().remove();
  yield* waitFor(0.4);

  // ── MORPH 1: impl signature + copy() field ───────────────────────────
  applyPoorColors(s.implCodes[4]);
  yield* s.implCodes[4].morphTo(IMPL_AFTER, {
    removeDuration: 0.28,
    moveDuration: 0.4,
    charDelay: 0.014,
    flashRemovedColor: METHOD_COLOR,
    flashRemovedDuration: 0.2,
    addStyle: 'typewriter',
    scrollStrategy: 'block',
    recolorLine: recolorPoorLine,
  });
  applyPoorColors(s.implCodes[4]);
  s.implCodes[4].recenterContent();
  yield* waitFor(1.4);

  // ── The enum appears below the function ──────────────────────────────
  const implLines = IMPL_AFTER.split('\n').length;
  const implBottomY = s.implCodes[4].node.position.y() + ((implLines - 1) * IMPL_LH) / 2;
  const enumLines = ENUM_CODE.split('\n').length;
  const enumY = implBottomY + IMPL_LH * 2 + ((enumLines - 1) * IMPL_LH) / 2;

  const enumMC = Manticore.create(ENUM_CODE, {
    x: IMPL_X_POOR,
    y: enumY,
    width: IMPL_W,
    fontSize: IMPL_FONT_SIZE,
    lineHeight: IMPL_LH,
    fontFamily: Fonts.code,
    theme: CanonCodeTheme,
    noClip: true,
    cardStyle: TRANSPARENT_CARD,
    glowAccent: false,
    customTypes: POOR_TYPES,
  });
  enumMC.mount(view);
  enumMC.colorize(POOR_RULES);
  enumMC.node.opacity(0);

  yield* enumMC.node.opacity(1, 0.55, easeInOutSine);
  yield* waitFor(1.2);

  // ── MORPH 2: call-site — active = true → status = CampaignStatus.RUNNING
  applyPoorColors(s.callCodes[4]);
  yield* s.callCodes[4].morphTo(CALL_AFTER, {
    removeDuration: 0.26,
    moveDuration: 0.4,
    charDelay: 0.014,
    flashRemovedColor: METHOD_COLOR,
    flashRemovedDuration: 0.2,
    addStyle: 'typewriter',
    scrollStrategy: 'block',
    recolorLine: recolorPoorLine,
  });
  applyPoorColors(s.callCodes[4]);
  s.callCodes[4].recenterContent();
  yield* waitFor(1.0);

  // Glow RUNNING where the flag's meaning lands as a named state.
  {
    const callLine = s.callCodes[4].getLine(14);   // status = CampaignStatus.RUNNING,
    if (callLine) {
      yield* callLine.setTokensGlow(['RUNNING'], 12, 'rgba(162,205,214,0.5)', 0.4);
      yield* waitFor(0.7);
      yield* callLine.resetTokensGlow(['RUNNING'], 0.5);
    }
  }
  yield* waitFor(1.0);

  // ── Verdict: the face's weight ───────────────────────────────────────
  yield* s.showSmallScale(4);
  const scaleNode = s.smallScaleNodes[4]();
  yield* waitFor(0.25);
  for (let k = 0; k < 2; k++) {
    yield* scaleNode.opacity(0.18, 0.16, easeInOutSine);
    yield* scaleNode.opacity(1, 0.16, easeInOutSine);
  }
  yield* waitFor(1.0);

  yield* all(
    s.hideCallCode(4, 0.6),
    s.hideImplCode(4, 0.6),
    enumMC.node.opacity(0, 0.6, easeInOutSine),
    s.hideSmallScale(4, 0.6),
  );
  yield* waitFor(0.4);

  // Lights out: the spotlight and the face label fade last, instead of
  // hanging to the very end.
  yield* all(
    s.mainSpot().opacity(0, 0.9, easeInOutSine),
    s.sceneAlpha(0, 0.9, easeInOutSine),
  );
  yield* waitFor(0.5);
});
