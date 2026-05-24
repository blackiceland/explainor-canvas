import {Circle, Gradient, Line, Node, Rect, Txt, blur, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  createSignal,
  easeInCubic,
  easeInOutCubic,
  easeInOutSine,
  easeOutCubic,
  makeRef,
  ThreadGenerator,
  Vector2,
  waitFor,
} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Fonts, Screen} from '../core/theme';
import {applyBackground} from '../core/utils';

// Five Faces of Boolean — director's cut v3.
// Pitch-black stage. Five role names sit across the top, sized for
// mobile viewing and casting real light-driven shadows. A spotlight
// crawls from left to right; whichever name the light lands on lifts
// out of the dark and casts its shadow away from the source. For each
// face the centre of the frame plays the same beat: code arrives,
// breathes, then a five-dot weight gauge fades in DIRECTLY UNDER the
// active name — small punctuation of risk. After the hold, scale and
// code dissolve and the light moves on. The last face — POOR MODEL —
// burns longest; its `true` literal dissolves and the six-state
// life-cycle blooms in its place. Finally the other four names
// extinguish and POOR MODEL is left alone in the spotlight.

// ── Palette ───────────────────────────────────────────────────────────
const TEXT_PRIMARY  = '#F4F1EB';
const ACCENT        = '#FF8CA3';        // project rose — weight gauge

// Code colours — strict classification with one role per colour.
const VAR_LIGHT    = 'rgba(244,241,235,0.96)';      // variables, receivers, locals, impl-sig params
const TYPE_CLEAN   = 'rgba(220,215,255,0.80)';      // types
const METHOD_COLOR = '#FF8CA3';                     // method calls
const FUN_BLUE     = '#A3CDFF';                     // language keywords
const STRING_GREEN = '#86B07A';                     // string literals — richer green
const CONST_COLOR  = 'rgba(201,180,255,0.78)';      // SCREAMING_SNAKE constants — project canon (DryFiltersV3CodeTheme.constant)
const PARAM_DARK   = '#7C9CBA';                     // CALL-SITE named params only

// ── Top row layout ────────────────────────────────────────────────────
const NAME_XS = [-720, -360, 0, 360, 720] as const;

const NAMES_Y        = -450;
const NAME_FONT_SIZE = 44;
const NAME_LETTER_SP = 4;

// Small scale-dot indicators under each name.
const DOTS_Y         = -395;
const DOT_R          = 8;
const DOT_GAP        = 30;

// ── Spotlight physics ─────────────────────────────────────────────────
const LIGHT_REACH = 270;
const SPOT_R      = 290;
const SHADOW_MAX  = 18;

// ── Faces ─────────────────────────────────────────────────────────────
// LEFT  — full production class (the context where the boolean call
//          actually lives). After the camera reads it, every line dims
//          EXCEPT the call-site block that uses the boolean — that
//          block stays bright as the focal point.
// RIGHT — implementation of the called method ("расшифровка"). Shows
//          what the boolean really does inside.
interface Face {
  name: string;
  scale: number;             // weight rating 0..5
  callCode: string;          // full production class
  implCode: string;          // implementation of the called method
  callBlock: [number, number]; // [startLine, endLine] of the call site within callCode
}

const CALL_PERMISSION = `@Service
class MonthlyReportPublisher(
    private val renderer: ReportRenderer,
    private val fileStorage: FileStorage,
    private val auditLog: AuditLog,
) {

    fun publish(period: YearMonth, requestedBy: UserId): StorageKey {
        val report = renderer.renderMonthlyReport(period)

        val savedFile = fileStorage.save(
            path = "reports/monthly/$period.pdf",
            content = report.bytes,
            contentType = "application/pdf",
            overwrite = true,
        )

        auditLog.record(
            actorId = requestedBy,
            action = "monthly_report_published",
            resourceId = savedFile.key,
        )

        return savedFile.key
    }
}`;

const IMPL_PERMISSION = `fun save(path: String, content: Bytes, contentType: String,
         overwrite: Boolean = false): StoredFile {
    if (storage.exists(path) && !overwrite) {
        throw FileAlreadyExists(path)
    }

    val key = storage.put(
        path = path,
        content = content,
        contentType = contentType,
    )

    return StoredFile(key)
}`;

const CALL_MODE = `@Service
class ShipmentNotificationService(
    private val templates: MessageTemplateRepository,
    private val notifier: CustomerNotifier,
    private val deliveries: DeliveryRepository,
) {

    fun notifyShipmentCreated(order: Order): DeliveryResult {
        val template = templates.require("shipment.created")

        val message = template.render(mapOf(
            "firstName" to order.customer.firstName,
            "trackingNumber" to order.trackingNumber,
            "deliveryDate" to order.estimatedDeliveryDate,
        ))

        val delivery = notifier.send(
            user = order.customer,
            message = message,
            silent = true,
        )

        deliveries.save(order.id, message.id, delivery.id)

        return DeliveryResult.Sent(delivery.id)
    }
}`;

const IMPL_MODE = `fun send(user: User, message: Message, silent: Boolean): Delivery {
    val options = if (silent) {
        PushOptions.Silent
    } else {
        PushOptions.Default
    }

    return pushGateway.send(
        recipient = user.deviceToken,
        message = message,
        options = options,
    )
}`;

const CALL_SAFETY = `@Service
class AccountDeletionService(
    private val users: UserRepository,
    private val sessions: UserSessionRepository,
    private val auditLog: AuditLog,
    private val clock: Clock,
) {

    fun deleteAccount(userId: UserId, actor: UserId): DeletionResult {
        val user = users.requireActive(userId)

        sessions.revokeAll(user.id)

        val deletedUser = deletion.delete(
            userId = user.id,
            soft = true,
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

const IMPL_SAFETY = `fun delete(userId: UserId, soft: Boolean = true, deletedAt: Instant, deletedBy: UserId): DeletedUser {
    val user = users.requireById(userId)

    if (soft) {
        return users.markDeleted(
            userId = user.id,
            deletedAt = deletedAt,
            deletedBy = deletedBy,
        )
    }

    sessions.deleteByUser(user.id)
    credentials.deleteByUser(user.id)
    users.delete(user.id)

    return DeletedUser(user.id)
}`;

const CALL_SHORTCUT = `@Service
class ErpOrderImportJob(
    private val parser: ErpOrderParser,
    private val orderProcessor: OrderProcessor,
    private val imports: ImportRunRepository,
) {

    fun importOrders(file: UploadedFile): ImportResult {
        val orders = parser.parse(file)
        val run = imports.start(file.name, orders.size)

        orders.forEach { order ->
            orderProcessor.process(
                order = order,
                source = OrderSource.ERP_IMPORT,
                skipValidation = true,
            )
        }

        imports.finish(run.id)

        return ImportResult.Imported(run.id, orders.size)
    }
}`;

const IMPL_SHORTCUT = `fun process(order: Order, source: OrderSource, skipValidation: Boolean = false): ProcessingResult {
    if (!skipValidation) {
        validator.requireValid(order)
    }

    val normalized = normalizer
        .normalize(order, source)
    val reserved = inventory
        .reserve(normalized)
    val payment = payments
        .authorize(normalized)

    return ProcessingResult.Accepted(
        orderId = normalized.id,
        reservationId = reserved.id,
        paymentId = payment.id,
    )
}`;

const CALL_POOR = `@Service
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
            active = true,
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

const IMPL_POOR = `fun update(campaignId: CampaignId, active: Boolean, startedAt: Instant): Campaign {
    val campaign = requireById(campaignId)

    val updated = campaign.copy(
        active = active,
        startedAt = startedAt,
        updatedAt = clock.instant(),
    )

    return campaigns.save(updated)
}`;

// Line ranges of the call-site block inside each production class.
// These lines stay BRIGHT after the spotlight; the rest of the class
// dims down so the boolean call is the focal point.
const FACES: Face[] = [
  {name: 'PERMISSION', scale: 2,
   callCode: CALL_PERMISSION, implCode: IMPL_PERMISSION,
   callBlock: [10, 15]},
  {name: 'MODE',       scale: 3,
   callCode: CALL_MODE,       implCode: IMPL_MODE,
   callBlock: [16, 20]},
  {name: 'SAFETY',     scale: 3,
   callCode: CALL_SAFETY,     implCode: IMPL_SAFETY,
   callBlock: [13, 18]},
  {name: 'SHORTCUT',   scale: 4,
   callCode: CALL_SHORTCUT,   implCode: IMPL_SHORTCUT,
   callBlock: [12, 16]},
  {name: 'POOR MODEL', scale: 5,
   callCode: CALL_POOR,       implCode: IMPL_POOR,
   callBlock: [11, 15]},
];

const STATE_LIST = 'draft  /  scheduled  /  running  /  paused  /  completed  /  archived';

// Project code-rendering canon: transparent card, no clipping.
const TRANSPARENT_CARD = {
  radius: 0,
  fill: 'rgba(0,0,0,0)',
  stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0,
  edge: false,
  opacity: 0,
  shadowColor: 'rgba(0,0,0,0)',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
} as const;

const CUSTOM_TYPES = [
  // PERMISSION
  'Service', 'MonthlyReportPublisher', 'ReportRenderer', 'FileStorage', 'AuditLog',
  'YearMonth', 'UserId', 'StorageKey',
  'FileRef', 'ByteArray', 'Bytes', 'Boolean', 'StoredFile', 'FileAlreadyExists',
  // MODE
  'ShipmentNotificationService', 'MessageTemplateRepository', 'CustomerNotifier',
  'DeliveryRepository', 'Order', 'DeliveryResult', 'Sent',
  'User', 'Message', 'Delivery', 'PushOptions', 'Silent', 'Default',
  'PushGateway',
  // SAFETY
  'AccountDeletionService', 'UserRepository', 'UserSessionRepository', 'Clock',
  'DeletionResult', 'Deleted', 'DeletedUser', 'Instant',
  // SHORTCUT
  'ErpOrderImportJob', 'ErpOrderParser', 'OrderProcessor', 'ImportRunRepository',
  'UploadedFile', 'ImportResult', 'OrderSource', 'Imported',
  'ProcessingResult', 'Accepted',
  // POOR MODEL
  'CampaignLauncher', 'CampaignRepository', 'CampaignScheduler', 'DomainEventPublisher',
  'CampaignId', 'Campaign', 'CampaignActivated',
];

const METHOD_NAMES = [
  // call sites + production classes
  'publish', 'renderMonthlyReport', 'save', 'record',
  'notifyShipmentCreated', 'require', 'render', 'send', 'format',
  'deleteAccount', 'requireActive', 'revokeAll', 'delete',
  'importOrders', 'parse', 'start', 'forEach', 'process', 'finish',
  'launchNow', 'requireReady', 'update', 'enqueue', 'mapOf',
  // impl bodies
  'exists', 'put', 'read',
  'requireById', 'markDeleted', 'deleteByUser',
  'requireValid', 'reserve', 'authorize', 'normalize',
  'copy', 'instant',
];

// Named parameters — every identifier that appears as `name = value`
// at a call site (Kotlin's named-args feature). Painted slate ONLY
// when followed by `=` on the same line — see `paintNamedParams`.
// Variables of the same name in OTHER contexts stay cream.
const NAMED_PARAMS = [
  // PERMISSION
  'path', 'content', 'contentType', 'overwrite',
  // MODE
  'user', 'message', 'silent',
  // SAFETY
  'userId', 'soft', 'deletedAt', 'deletedBy',
  // SHORTCUT
  'order', 'source', 'skipValidation',
  // POOR
  'campaignId', 'active', 'startedAt',
  // auditLog.record(...)
  'actorId', 'action', 'resourceId',
  // pushGateway.send(...)  &  copy(...)
  'recipient', 'options', 'updatedAt',
  // ProcessingResult.Accepted(...)
  'orderId', 'reservationId', 'paymentId',
];

const VAR_NAMES = [
  // receivers
  'fileStorage', 'notifier', 'userRepository', 'orderProcessor', 'campaignRepository',
  'renderer', 'auditLog', 'templates', 'deliveries', 'sessions',
  'parser', 'imports', 'scheduler', 'events', 'clock',
  'storage', 'pushGateway', 'inventory', 'payments', 'credentials', 'validator',
  // locals & params
  'file', 'report', 'content', 'pdfBytes',
  'user', 'message', 'shipmentMessage', 'template', 'delivery', 'customer',
  'firstName', 'trackingNumber', 'deliveryDate', 'estimatedDeliveryDate',
  'order', 'importedOrder', 'orders', 'run', 'name', 'size',
  'campaigns', 'campaign', 'updated', 'updatedAt',
  'savedFile', 'period', 'requestedBy', 'deletedUser',
  'reserved', 'payment', 'items', 'id', 'key', 'path',
  'deviceToken', 'pushOptions',
  'deletion', 'normalizer', 'normalized', 'actor',
];

// Manticore applies ALL rules in order; the last match wins.
//
// One role → one colour. Named-parameter highlighting is NOT a global
// rule — it is applied per-face only inside the call-site block (see
// `paintNamedParams` below). Impl-signature parameter declarations
// therefore stay as ordinary identifiers (cream).
const CODE_RULES: ColorRule[] = [
  // 1. Variables — broad fallback so every lowercase identifier starts
  //    as cream; later rules selectively repaint methods/keywords/etc.
  {match: /^[a-z][a-zA-Z0-9_]*$/, color: VAR_LIGHT},
  // 2. Explicit variable / receiver list (re-asserts cream)
  {match: new RegExp('^(' + VAR_NAMES.join('|') + ')$'), color: VAR_LIGHT},
  // 3. Types — PascalCase classified as type
  {match: /^[A-Z][a-zA-Z0-9]*$/, color: TYPE_CLEAN, onlyTypes: ['type'] as const},
  {match: new RegExp('^(' + CUSTOM_TYPES.join('|') + ')$'), color: TYPE_CLEAN},
  // 4. Method calls (with tokenizer hint)
  {match: /^[a-z][a-zA-Z0-9_]*$/, color: METHOD_COLOR, onlyTypes: ['method'] as const},
  // 5. Explicit method list — without type restriction so identifiers
  //    that the tokenizer mis-classifies (like Kotlin's higher-order
  //    .forEach) still get painted rose.
  {match: new RegExp('^(' + METHOD_NAMES.join('|') + ')$'), color: METHOD_COLOR},
  // 6. SCREAMING_SNAKE constants / enum entries — distinct warm tan
  {match: /^[A-Z][A-Z0-9_]+$/, color: CONST_COLOR},
  // 7. Kotlin keywords + Spring annotation
  {match: /^(class|object|fun|val|var|private|public|internal|return|if|else|is|in|to|true|false|throw|null|@Service)$/, color: FUN_BLUE},
  // 8. String literals
  {match: /./, color: STRING_GREEN, onlyTypes: ['string'] as const},
];

export default makeScene2D(function* (view) {
  // ── Project background (canon vertical gradient) ───────────────────
  applyBackground(view);

  const bgCover = createRef<Rect>();
  view.add(
    <Rect
      ref={bgCover}
      width={1920}
      height={1080}
      fill={'#000000'}
    />,
  );

  // ── Spotlight ──────────────────────────────────────────────────────
  // The aim point is a tweenable signal. On top of it, layered sines
  // add organic hand-jitter so the light is never perfectly still — the
  // wobble is borrowed from pipelineGrabGrowthSceneEn.
  const baseX = createSignal(NAME_XS[0] - 760);   // off-screen left
  const baseY = NAMES_Y - 6;

  // Hand-held wobble — active only during the first 5 s after the light
  // lands on a name. The envelope EASES IN over the first 0.4 s so the
  // wobble doesn't pop on arrival (that was the visible micro-lag),
  // holds, then eases out smoothly to zero by the 5 s mark.
  const arrivalTime = createSignal(-100);
  const smoothstep = (t: number): number => t * t * (3 - 2 * t);
  const tremorEnvelope = (): number => {
    const elapsed = view.globalTime() - arrivalTime();
    if (elapsed <= 0 || elapsed >= 5) return 0;
    const RAMP_IN = 0.4;
    if (elapsed < RAMP_IN) return smoothstep(elapsed / RAMP_IN);
    const k = 1 - (elapsed - RAMP_IN) / (5 - RAMP_IN);
    return smoothstep(k);
  };

  const tremorX = (): number => {
    const t = view.globalTime();
    const e = tremorEnvelope();
    if (e <= 0) return 0;
    return e * (
      Math.sin(t * 0.8 + 0.0) * 22 +
      Math.sin(t * 1.6 + 0.3) * 12 +
      Math.sin(t * 4.0 + 1.4) * 6 +
      Math.sin(t * 7.5 + 2.7) * 3
    );
  };
  const tremorY = (): number => {
    const t = view.globalTime();
    const e = tremorEnvelope();
    if (e <= 0) return 0;
    return e * (
      Math.cos(t * 0.9 + 0.4) * 16 +
      Math.cos(t * 1.9 + 1.1) * 10 +
      Math.cos(t * 4.3 + 1.8) * 5 +
      Math.cos(t * 7.7 + 0.3) * 2.5
    );
  };

  const lightX = (): number => baseX() + tremorX();
  const lightY = (): number => baseY + tremorY();

  const brightnessAt = (wx: number, wy: number = NAMES_Y): number => {
    const dx = wx - lightX();
    const dy = wy - lightY();
    const d = Math.sqrt(dx * dx + dy * dy);
    const t = Math.max(0, Math.min(1, 1 - d / LIGHT_REACH));
    return t * t * (3 - 2 * t);
  };

  // Drawn under the names so its glow reads behind the type.
  const mainSpot = createRef<Circle>();
  view.add(
    <Circle
      ref={mainSpot}
      x={() => lightX()}
      y={() => lightY()}
      width={SPOT_R * 2}
      height={SPOT_R * 2}
      compositeOperation={'screen'}
      fill={new Gradient({
        type: 'radial',
        from: new Vector2(0, 0),
        to: new Vector2(0, 0),
        fromRadius: 0,
        toRadius: SPOT_R,
        stops: [
          {offset: 0.00, color: 'rgba(244, 241, 235, 0.55)'},
          {offset: 0.28, color: 'rgba(244, 241, 235, 0.22)'},
          {offset: 0.62, color: 'rgba(244, 241, 235, 0.05)'},
          {offset: 1.00, color: 'rgba(0, 0, 0, 0)'},
        ],
      })}
    />,
  );

  // ── Finale spotlights — one per name, stationary. Hidden until the
  //    summary moment when all five names should light up at once.
  const finaleSpots: ReturnType<typeof createRef<Circle>>[] = [];
  for (let i = 0; i < NAME_XS.length; i++) {
    const spotRef = createRef<Circle>();
    finaleSpots.push(spotRef);
    view.add(
      <Circle
        ref={spotRef}
        x={NAME_XS[i]}
        y={NAMES_Y - 6}
        width={SPOT_R * 2}
        height={SPOT_R * 2}
        compositeOperation={'screen'}
        opacity={0}
        fill={new Gradient({
          type: 'radial',
          from: new Vector2(0, 0),
          to: new Vector2(0, 0),
          fromRadius: 0,
          toRadius: SPOT_R,
          stops: [
            {offset: 0.00, color: 'rgba(244, 241, 235, 0.55)'},
            {offset: 0.28, color: 'rgba(244, 241, 235, 0.22)'},
            {offset: 0.62, color: 'rgba(244, 241, 235, 0.05)'},
            {offset: 1.00, color: 'rgba(0, 0, 0, 0)'},
          ],
        })}
      />,
    );
  }

  // ── Five names — invisible until the spotlight reaches them ────────
  // Finale override — when this signal tweens to 1, every name lights
  // up regardless of where the spotlight is. Used for the summary
  // moment at the very end of the scene.
  const finaleMix  = createSignal(0);
  // Global scene-alpha — multiplied into every name's opacity so the
  // final fade-out can dim all five names regardless of brightness.
  const sceneAlpha = createSignal(1);

  const nameRefs: ReturnType<typeof createRef<Txt>>[] = [];
  for (let i = 0; i < FACES.length; i++) {
    const x = NAME_XS[i];
    const nameRef = createRef<Txt>();
    nameRefs.push(nameRef);

    view.add(
      <Txt
        ref={nameRef}
        x={x}
        y={NAMES_Y}
        text={FACES[i].name}
        fontFamily={Fonts.code}
        fontSize={NAME_FONT_SIZE}
        fontWeight={500}
        letterSpacing={NAME_LETTER_SP}
        fill={TEXT_PRIMARY}
        opacity={() => Math.max(brightnessAt(x), finaleMix()) * sceneAlpha()}
        shadowColor={() => `rgba(0, 0, 0, ${brightnessAt(x) * 0.9})`}
        shadowBlur={() => 6 + (1 - brightnessAt(x)) * 10}
        shadowOffset={() => {
          const b = brightnessAt(x);
          if (b <= 0) return [0, 0] as [number, number];
          const dx = x - lightX();
          const dy = NAMES_Y - lightY();
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 0.001) return [0, 0] as [number, number];
          const len = Math.min(d * 0.28, SHADOW_MAX);
          return [(dx / d) * len, (dy / d) * len] as [number, number];
        }}
      />,
    );
  }

  // ── Small scale-dot indicators (sit under each name) ───────────────
  // For PERMISSION there is ALSO a separate, BIG version that blooms in
  // the middle of the frame on top of the blurred code, then migrates
  // up into PERMISSION's small slot. The other four faces just light
  // up their small dots directly under the name at the end of the step.
  const smallScaleNodes: ReturnType<typeof createRef<Node>>[] = [];
  for (let i = 0; i < FACES.length; i++) {
    const x = NAME_XS[i];
    const groupRef = createRef<Node>();
    smallScaleNodes.push(groupRef);

    const dots: any[] = [];
    for (let j = 0; j < 5; j++) {
      const isFilled = j < FACES[i].scale;
      dots.push(
        <Circle
          x={(j - 2) * DOT_GAP}
          y={0}
          width={DOT_R * 2}
          height={DOT_R * 2}
          fill={isFilled ? ACCENT : 'rgba(0,0,0,0)'}
          stroke={isFilled ? 'rgba(0,0,0,0)' : 'rgba(244,241,235,0.55)'}
          lineWidth={isFilled ? 0 : 1.6}
        />,
      );
    }

    view.add(
      <Node ref={groupRef} x={x} y={DOTS_Y} opacity={0}>
        {dots}
      </Node>,
    );
  }

  // PERMISSION's BIG bloom-and-migrate scale node — drawn at frame
  // centre at large scale, migrates to PERMISSION's small slot, then
  // hides (smallScaleNodes[0] takes over as the persistent indicator).
  const bigScale = createRef<Node>();
  const bigSafeLabel  = createRef<Txt>();
  const bigRiskyLabel = createRef<Txt>();
  const BIG_R   = 40;
  // BIG_GAP / BIG_R == DOT_GAP / DOT_R, so when the big gauge shrinks
  // to SMALL_TARGET_SCALE = 0.2 it lands at the exact same geometry as
  // the small under-name indicator — the handover is seamless.
  const BIG_GAP = 150;
  {
    const dots: any[] = [];
    for (let j = 0; j < 5; j++) {
      const isFilled = j < FACES[0].scale;
      dots.push(
        <Circle
          x={(j - 2) * BIG_GAP}
          y={0}
          width={BIG_R * 2}
          height={BIG_R * 2}
          fill={isFilled ? ACCENT : 'rgba(0,0,0,0)'}
          stroke={isFilled ? 'rgba(0,0,0,0)' : 'rgba(244,241,235,0.55)'}
          lineWidth={isFilled ? 0 : 3}
        />,
      );
    }
    const labelX = 2 * BIG_GAP + BIG_R + 40;
    view.add(
      <Node ref={bigScale} x={0} y={0} opacity={0}>
        {dots}
        <Txt
          ref={bigSafeLabel}
          x={-labelX}
          y={0}
          offset={[1, 0]}
          text={'safe'}
          fontFamily={Fonts.code}
          fontSize={30}
          letterSpacing={2}
          fill={STRING_GREEN}
        />
        <Txt
          ref={bigRiskyLabel}
          x={labelX}
          y={0}
          offset={[-1, 0]}
          text={'risky'}
          fontFamily={Fonts.code}
          fontSize={30}
          letterSpacing={2}
          fill={'rgba(255, 140, 163, 0.85)'}
        />
      </Node>,
    );
  }

  // ── Two-layer code: call site (left) + implementation (right) ──────
  // Same fontSize, top-aligned per face so the cards always feel like
  // they live on the same shelf, regardless of how many lines each one
  // has.  The boolean parameter is highlighted in BOTH halves: in the
  // call site it looks small, in the implementation it does its work.
  const CODE_FONT_SIZE = 19;
  const CODE_LH        = 28;
  const IMPL_FONT_SIZE = 19;     // same size as the call code
  const IMPL_LH        = 28;
  const CALL_W         = 820;    // production class card
  const IMPL_W         = 620;    // implementation card
  const CALL_X         = -530;   // call card centre  → spans [-940, -120]
  const IMPL_X         = 220;    // impl card centre  → spans [-90, +530]
  const VIZ_X          = 670;    // viz zone centre, pulled left for breathing room
  const VIZ_Y          = 200;    // push viz into bottom-right zone
  const TOP_Y          = -310;   // first call-code line top — gap from names ≈ 95px

  // Manticore vertically centres its content; this returns the
  // container Y that places the FIRST line at TOP_Y for a given code.
  const yForCode = (src: string): number => {
    const lines = src.split('\n').length;
    return TOP_Y + ((lines - 1) * CODE_LH) / 2;
  };

  const findMethodLine = (src: string): number => {
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('fun ')) return i;
    }
    return 0;
  };

  // Identify the lines that hold a boolean.
  const BOOL_LINE_RE = /\b(true|false)\b|:\s*Boolean\b/;
  const findBoolLines = (src: string): number[] => {
    const out: number[] = [];
    src.split('\n').forEach((line, i) => {
      if (BOOL_LINE_RE.test(line)) out.push(i);
    });
    return out;
  };

  // The identifiers that ARE booleans in our snippets — these get the
  // halo wherever they appear (parameter list, call argument, or `if`
  // condition). Together with the literal values and the type, they
  // form the "boolean cluster".
  const BOOL_NAMES = new Set([
    'overwrite', 'silent', 'soft', 'skipValidation', 'active',
  ]);
  const BOOL_LITERALS = new Set(['true', 'false', 'Boolean']);
  const BOOL_SIGNS    = new Set([':', '=', '!']);
  const isBoolToken   = (text: string): boolean =>
    BOOL_NAMES.has(text) || BOOL_LITERALS.has(text);

  // Per-token halo. We mark just the boolean-cluster tokens (name +
  // type + signs + value), not the whole line, and give each token a
  // shadow in its own fill colour. Works at call sites, in impl
  // signatures, and inside `if (…)` checks alike.
  const glowBooleanLines = (code: Manticore): void => {
    for (let lineIdx = 0; lineIdx < code.lineCount; lineIdx++) {
      const line = code.getLine(lineIdx);
      if (!line) continue;
      const toks = line.tokens;

      // First pass — identifiers + literals.
      const glow = new Set<number>();
      for (let i = 0; i < toks.length; i++) {
        if (isBoolToken(toks[i].text.trim())) glow.add(i);
      }
      if (glow.size === 0) continue;

      // Second pass — pull in adjacent signs ( `:` `=` `!` ) sitting
      // immediately around a marked token. Skip whitespace tokens.
      for (let i = 0; i < toks.length; i++) {
        if (!glow.has(i)) continue;
        let p = i - 1;
        while (p >= 0 && toks[p].text.trim() === '') p--;
        if (p >= 0 && BOOL_SIGNS.has(toks[p].text.trim())) glow.add(p);
        let n = i + 1;
        while (n < toks.length && toks[n].text.trim() === '') n++;
        if (n < toks.length && BOOL_SIGNS.has(toks[n].text.trim())) glow.add(n);
      }

      // Apply the halo — shadow in each token's own fill colour.
      for (const idx of glow) {
        const ref = toks[idx].ref();
        ref.shadowColor(ref.fill());
        ref.shadowBlur(16);
      }
    }
  };

  // Paint call-site named parameters slate. Detects the pattern
  // `IDENT = …` where IDENT is in NAMED_PARAMS AND is NOT a variable
  // declaration (`val IDENT = …`).  Kotlin named arguments are the
  // only syntax in our snippets that matches both checks, so anything
  // else (variables, type annotations, the value on the right of `=`,
  // lambda parameters) is left as its default colour.
  const paintNamedParams = (code: Manticore): void => {
    for (let lineIdx = 0; lineIdx < code.lineCount; lineIdx++) {
      const line = code.getLine(lineIdx);
      if (!line) continue;
      const toks = line.tokens;
      for (let i = 0; i < toks.length; i++) {
        const tok = toks[i];
        if (!NAMED_PARAMS.includes(tok.text)) continue;

        // The previous non-whitespace token must NOT be `val` / `var`
        // — that would mean we're looking at a variable declaration.
        let p = i - 1;
        while (p >= 0 && toks[p].text.trim() === '') p--;
        const prev = p >= 0 ? toks[p].text.trim() : '';
        if (prev === 'val' || prev === 'var') continue;

        // The next non-whitespace token must be `=`.
        let n = i + 1;
        while (n < toks.length && toks[n].text.trim() === '') n++;
        if (n < toks.length && toks[n].text.trim() === '=') {
          tok.ref().fill(PARAM_DARK);
        }
      }
    }
  };

  const callCodes = FACES.map(face => {
    const code = Manticore.create(face.callCode, {
      x: CALL_X,
      y: yForCode(face.callCode),
      width: CALL_W,
      fontSize: CODE_FONT_SIZE,
      lineHeight: CODE_LH,
      fontFamily: Fonts.code,
      theme: DryFiltersV3CodeTheme,
      noClip: true,
      cardStyle: TRANSPARENT_CARD,
      glowAccent: false,
      customTypes: CUSTOM_TYPES,
    });
    code.mount(view);
    code.colorize(CODE_RULES);
    paintNamedParams(code);
    glowBooleanLines(code);
    code.node.opacity(0);
    return code;
  });

  const implCodes = FACES.map(face => {
    const methodLine = findMethodLine(face.callCode);
    const implLines = face.implCode.split('\n').length;
    const implY = TOP_Y + methodLine * CODE_LH + ((implLines - 1) * IMPL_LH) / 2;
    const code = Manticore.create(face.implCode, {
      x: IMPL_X,
      y: implY,
      width: IMPL_W,
      fontSize: IMPL_FONT_SIZE,
      lineHeight: IMPL_LH,
      fontFamily: Fonts.code,
      theme: DryFiltersV3CodeTheme,
      noClip: true,
      cardStyle: TRANSPARENT_CARD,
      glowAccent: false,
      customTypes: CUSTOM_TYPES,
    });
    code.mount(view);
    code.colorize(CODE_RULES);
    paintNamedParams(code);
    glowBooleanLines(code);
    code.node.opacity(0);
    return code;
  });

  // Backlit highlight strip behind every boolean line. Builds a thin
  // rounded plate sized to the actual code line and binds its opacity
  // to the code's opacity so it fades together. Renders BEHIND the
  // code (zIndex=-1) so glyphs stay sharp.
  const addBoolBacklight = (
    src: string,
    containerY: number,
    cardCenterX: number,
    cardWidth: number,
    fontSize: number,
    lineHeight: number,
    codeOpacity: () => number,
  ): void => {
    const lines = src.split('\n');
    const totalLines = lines.length;
    const charW = fontSize * 0.6;
    const textLeft = cardCenterX - cardWidth / 2 + 56;     // matches Manticore paddingX
    for (const lineIdx of findBoolLines(src)) {
      const raw = lines[lineIdx];
      const leading = raw.length - raw.trimStart().length;
      const trimmed = raw.trim();
      const sceneY = containerY + (lineIdx - (totalLines - 1) / 2) * lineHeight;
      const lineX0 = textLeft + leading * charW;
      const lineWidth = trimmed.length * charW;
      view.add(
        <Rect
          x={lineX0 + lineWidth / 2}
          y={sceneY}
          width={lineWidth + 22}
          height={lineHeight + 2}
          fill={'rgba(244, 241, 235, 0.04)'}
          stroke={'rgba(244, 241, 235, 0.22)'}
          lineWidth={1}
          radius={4}
          zIndex={-1}
          opacity={() => codeOpacity() * 0.9}
        />,
      );
    }
  };

  // Backlight strips removed — the per-token coloured halo is the only
  // glow now, exactly matching the boolean cluster.

  // Every code card carries a tweenable blur — PERMISSION uses it for
  // the bloom ritual at the start; SAFETY and POOR MODEL use it to
  // soften the impl when their right-side visualisations take over.
  const BLUR_HEAVY = 14;
  const callBlurs = callCodes.map(c => {
    const sig = createSignal(0);
    c.node.cache(true);
    c.node.cachePadding(60);
    c.node.filters(() => [blur(sig())]);
    return sig;
  });
  const implBlurs = implCodes.map(c => {
    const sig = createSignal(0);
    c.node.cache(true);
    c.node.cachePadding(60);
    c.node.filters(() => [blur(sig())]);
    return sig;
  });

  // ── PERMISSION viz — VERTICAL: request circle hits a barrier ──────
  // Style: foreignResponsibilityShapesSceneEn — solid filled shapes,
  // bright saturated palette.  Circle starts at top, drops toward a
  // red barrier; when the boolean fires the barrier shatters and the
  // circle continues into a green target square at the bottom.
  const permissionViz   = createRef<Node>();
  const permRequest     = createRef<Circle>();
  const permBarrier     = createRef<Rect>();
  const permTarget      = createRef<Rect>();
  {
    view.add(
      <Node ref={permissionViz} x={VIZ_X} y={VIZ_Y} opacity={0}>
        {/* Request token — top */}
        <Circle
          ref={permRequest}
          x={0}
          y={-180}
          width={56}
          height={56}
          fill={'rgba(100, 180, 255, 0.85)'}
        />
        <Txt
          x={0}
          y={-180 + 56}
          text={'request'}
          fontFamily={Fonts.code}
          fontSize={20}
          fill={'rgba(244, 241, 235, 0.70)'}
          letterSpacing={2}
        />
        {/* Barrier — thin rose line, blocks the path by default */}
        <Rect
          ref={permBarrier}
          x={0}
          y={0}
          width={240}
          height={10}
          fill={'#FF8CA3'}
          radius={1}
        />
        {/* Target — bottom (green; starts grey-tinted, ignites on pass) */}
        <Rect
          ref={permTarget}
          x={0}
          y={180}
          width={80}
          height={80}
          fill={'rgba(244, 241, 235, 0.10)'}
          radius={6}
        />
        <Txt
          x={0}
          y={180 + 60}
          text={'save'}
          fontFamily={Fonts.code}
          fontSize={20}
          fill={'rgba(244, 241, 235, 0.70)'}
          letterSpacing={2}
        />
      </Node>,
    );
  }

  const vizBlur = createSignal(0);
  permissionViz().cache(true);
  permissionViz().cachePadding(60);
  permissionViz().filters(() => [blur(vizBlur())]);

  // ── MODE viz — minimalist: two stacked circles, active state swaps
  // Top circle filled orange = default mode (active). Bottom circle
  // outlined lilac = silent (inactive). When the flag fires, fills
  // swap: top empties to outline, bottom fills lilac. Labels follow.
  const modeViz       = createRef<Node>();
  const modeTopCircle = createRef<Circle>();
  const modeBotCircle = createRef<Circle>();
  const modeLoudTxt   = createRef<Txt>();
  const modeSilentTxt = createRef<Txt>();
  {
    view.add(
      <Node ref={modeViz} x={VIZ_X} y={VIZ_Y} opacity={0}>
        {/* Left — active by default (orange filled) */}
        <Circle
          ref={modeTopCircle}
          x={-100}
          y={0}
          width={120}
          height={120}
          fill={'#FF9F43'}
        />
        <Txt
          ref={modeLoudTxt}
          x={-100}
          y={92}
          text={'default'}
          fontFamily={Fonts.code}
          fontSize={20}
          letterSpacing={2}
          fill={'#FF9F43'}
        />

        {/* Right — inactive by default (lilac outline) */}
        <Circle
          ref={modeBotCircle}
          x={100}
          y={0}
          width={120}
          height={120}
          fill={'rgba(201, 176, 232, 0)'}
          stroke={'rgba(201, 176, 232, 0.45)'}
          lineWidth={3}
        />
        <Txt
          ref={modeSilentTxt}
          x={100}
          y={92}
          text={'silent'}
          fontFamily={Fonts.code}
          fontSize={20}
          letterSpacing={2}
          fill={'rgba(201, 176, 232, 0.45)'}
        />
      </Node>,
    );
  }

  // ── SHORTCUT viz — VERTICAL stack, one cell falls out ─────────────
  // Style: solid filled chips, foreign-shapes vocabulary. Four stages
  // stacked top → bottom. When the flag fires the "validate" cell
  // drops out of the column (translates off-screen + fades) and the
  // remaining cells collapse upward to close the void.
  const shortcutViz = createRef<Node>();
  const scCells: Rect[] = [];
  const scTexts: Txt[]  = [];
  const SC_STEP_W = 240;
  const SC_STEP_H = 70;
  const SC_GAP    = 20;
  const STEPS     = ['input', 'validate', 'process', 'finalize'];
  // Less-bright, slightly desaturated stage colours.
  const SC_COLOURS = ['#7AA8D4', '#D67373', '#D9A574', '#8FA887'];
  const SC_FILLS   = [
    'rgba(122, 168, 212, 0.16)',
    'rgba(214, 115, 115, 0.16)',
    'rgba(217, 165, 116, 0.16)',
    'rgba(143, 168, 135, 0.18)',
  ];
  const SC_TOTAL  = STEPS.length * SC_STEP_H + (STEPS.length - 1) * SC_GAP;
  const cellY     = (i: number): number => -SC_TOTAL / 2 + SC_STEP_H / 2 + i * (SC_STEP_H + SC_GAP);
  {
    view.add(
      <Node ref={shortcutViz} x={VIZ_X} y={VIZ_Y} opacity={0}>
        {/* Stage cards — outlined "stations" with subtle tinted fill,
            chunky coloured stroke, label in the stage colour. */}
        {STEPS.map((s, i) => (
          <Rect
            ref={makeRef(scCells, i)}
            x={0}
            y={cellY(i)}
            width={SC_STEP_W}
            height={SC_STEP_H}
            fill={SC_FILLS[i]}
            stroke={SC_COLOURS[i]}
            lineWidth={3}
            radius={6}
          />
        ))}
        {STEPS.map((s, i) => (
          <Txt
            ref={makeRef(scTexts, i)}
            x={0}
            y={cellY(i)}
            text={s}
            fontFamily={Fonts.code}
            fontSize={20}
            letterSpacing={2}
            fill={SC_COLOURS[i]}
            fontWeight={600}
          />
        ))}
      </Node>,
    );
  }

  // ── SAFETY viz — bordered DB table, two-phase reveal ───────────────
  // Header label above (`soft = true` / `soft = false`) shows which
  // branch is active.  Phase 1: soft=true — Bob's deleted_at fills,
  // his row dims but stays. Phase 2: soft=false — Bob's row is
  // removed entirely (the literal "hard delete" outcome).
  const safetyViz   = createRef<Node>();
  const safetyArgTxt = createRef<Txt>();
  const sRowFill    = createRef<Rect>();
  const sBobRow     = createRef<Node>();
  const sBobDate    = createRef<Txt>();
  {
    const HDR_Y   = -90;
    const ROW_GAP = 48;
    const COL_X   = [-160, -50, 100];
    const TABLE_W = 420;
    const TABLE_H = 280;
    const ROW_W   = TABLE_W - 16;
    const ROW_H   = 40;
    const FONT_SZ = 20;
    const INK     = '#F4F1EB';
    const SUBTLE  = 'rgba(244, 241, 235, 0.50)';
    view.add(
      <Node ref={safetyViz} x={VIZ_X} y={VIZ_Y} opacity={0}>
        {/* Argument label above the table — `soft = true` etc. */}
        <Txt
          ref={safetyArgTxt}
          x={-TABLE_W / 2 + 18}
          y={-TABLE_H / 2 - 36}
          offset={[-1, 0]}
          text={'soft = true'}
          fontFamily={Fonts.code}
          fontSize={22}
          letterSpacing={1}
          fill={PARAM_DARK}
        />
        {/* Outer table border */}
        <Rect
          width={TABLE_W}
          height={TABLE_H}
          stroke={'rgba(244, 241, 235, 0.55)'}
          lineWidth={2}
          radius={6}
          fill={'rgba(244, 241, 235, 0.03)'}
        />
        {/* Header row */}
        <Txt x={COL_X[0]} y={HDR_Y} text={'id'}         fontFamily={Fonts.code} fontSize={FONT_SZ} fill={SUBTLE} fontWeight={600} letterSpacing={1} />
        <Txt x={COL_X[1]} y={HDR_Y} text={'name'}       fontFamily={Fonts.code} fontSize={FONT_SZ} fill={SUBTLE} fontWeight={600} letterSpacing={1} />
        <Txt x={COL_X[2]} y={HDR_Y} text={'deleted_at'} fontFamily={Fonts.code} fontSize={FONT_SZ} fill={SUBTLE} fontWeight={600} letterSpacing={1} />
        <Line
          points={[[-ROW_W / 2, HDR_Y + 26], [ROW_W / 2, HDR_Y + 26]]}
          stroke={'rgba(244, 241, 235, 0.40)'}
          lineWidth={1.2}
        />

        {/* Row 1 — Alice */}
        <Txt x={COL_X[0]} y={HDR_Y +     ROW_GAP} text={'1'}     fontFamily={Fonts.code} fontSize={FONT_SZ} fill={INK} />
        <Txt x={COL_X[1]} y={HDR_Y +     ROW_GAP} text={'Alice'} fontFamily={Fonts.code} fontSize={FONT_SZ} fill={INK} />
        <Txt x={COL_X[2]} y={HDR_Y +     ROW_GAP} text={'—'}     fontFamily={Fonts.code} fontSize={FONT_SZ} fill={SUBTLE} />

        {/* Row 2 — Bob (target) wrapped in a Node so phase 2 can hide
            the WHOLE row at once. */}
        <Node ref={sBobRow}>
          <Rect ref={sRowFill} x={0} y={HDR_Y + 2 * ROW_GAP} width={ROW_W} height={ROW_H} fill={'rgba(255, 140, 163, 0.10)'} radius={6} />
          <Txt              x={COL_X[0]} y={HDR_Y + 2 * ROW_GAP} text={'2'}   fontFamily={Fonts.code} fontSize={FONT_SZ} fill={INK} />
          <Txt              x={COL_X[1]} y={HDR_Y + 2 * ROW_GAP} text={'Bob'} fontFamily={Fonts.code} fontSize={FONT_SZ} fill={INK} />
          <Txt ref={sBobDate} x={COL_X[2]} y={HDR_Y + 2 * ROW_GAP} text={'—'} fontFamily={Fonts.code} fontSize={FONT_SZ} fill={SUBTLE} />
        </Node>

        {/* Row 3 — Carol */}
        <Txt x={COL_X[0]} y={HDR_Y + 3 * ROW_GAP} text={'3'}     fontFamily={Fonts.code} fontSize={FONT_SZ} fill={INK} />
        <Txt x={COL_X[1]} y={HDR_Y + 3 * ROW_GAP} text={'Carol'} fontFamily={Fonts.code} fontSize={FONT_SZ} fill={INK} />
        <Txt x={COL_X[2]} y={HDR_Y + 3 * ROW_GAP} text={'—'}     fontFamily={Fonts.code} fontSize={FONT_SZ} fill={SUBTLE} />
      </Node>,
    );
  }

  // ── POOR MODEL viz — six-node campaign lifecycle ───────────────────
  // Whole tree blooms in one fade (no lone-square intro, no title).
  // Vertical-column nodes carry labels on their RIGHT side. The bottom
  // row carries labels BELOW each cube — they never overlap each other.
  // State names are domain-leaning (campaign / message lifecycle) so
  // the audience reads them as concrete states, not abstract chips.
  const poorViz = createRef<Node>();
  const poorNodes:  Rect[] = [];
  const poorLabels: Txt[]  = [];
  const poorLinks:  Line[] = [];
  const POOR_NODE_R = 30;
  // (x, y, colour, labelPlacement)
  const poorPositions: [number, number, string, 'right' | 'below'][] = [
    [   0, -180, '#C9B0E8', 'right'],   // 0
    [   0,  -80, '#C9B0E8', 'right'],   // 1
    [   0,   20, '#A8CDE8', 'right'],   // 2
    [-130,  150, '#86B07A', 'below'],   // 3
    [   0,  150, '#FFB562', 'below'],   // 4
    [ 130,  150, '#FF7373', 'below'],   // 5
  ];
  const poorEdges: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [2, 4], [2, 5],
  ];
  const poorStateLabels = [
    'draft',        // 0
    'scheduled',    // 1
    'running',      // 2
    'paused',       // 3
    'completed',    // 4
    'archived',     // 5
  ];
  {
    const labelX = (p: [number, number, string, string]): number =>
      p[3] === 'below' ? p[0] : p[0] + POOR_NODE_R + 14;
    const labelY = (p: [number, number, string, string]): number =>
      p[3] === 'below' ? p[1] + POOR_NODE_R + 22 : p[1];
    const labelOffset = (p: [number, number, string, string]): [number, number] =>
      p[3] === 'below' ? [0, 0] : [-1, 0];
    view.add(
      <Node ref={poorViz} x={VIZ_X} y={VIZ_Y} opacity={0}>
        {poorEdges.map(([a, b], i) => (
          <Line
            ref={makeRef(poorLinks, i)}
            points={[
              [poorPositions[a][0], poorPositions[a][1] + POOR_NODE_R],
              [poorPositions[b][0], poorPositions[b][1] - POOR_NODE_R],
            ]}
            stroke={'rgba(244, 241, 235, 0.32)'}
            lineWidth={3}
            opacity={0}
            end={0}
          />
        ))}
        {poorPositions.map((p, i) => (
          <Rect
            ref={makeRef(poorNodes, i)}
            x={p[0]}
            y={p[1]}
            width={POOR_NODE_R * 2}
            height={POOR_NODE_R * 2}
            stroke={p[2]}
            lineWidth={3}
            radius={6}
            opacity={0}
          />
        ))}
        {poorPositions.map((p, i) => (
          <Txt
            ref={makeRef(poorLabels, i)}
            x={labelX(p)}
            y={labelY(p)}
            offset={labelOffset(p)}
            text={poorStateLabels[i]}
            fontFamily={Fonts.code}
            fontSize={18}
            letterSpacing={1}
            fill={p[2]}
            opacity={0}
          />
        ))}
      </Node>,
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────
  function* showCallCode(i: number, dur = 0.55): ThreadGenerator {
    yield* callCodes[i].node.opacity(1, dur, easeInOutSine);
  }
  function* hideCallCode(i: number, dur = 0.5): ThreadGenerator {
    yield* callCodes[i].node.opacity(0, dur, easeInOutSine);
  }
  function* showImplCode(i: number, dur = 0.55): ThreadGenerator {
    yield* implCodes[i].node.opacity(1, dur, easeInOutSine);
  }
  function* hideImplCode(i: number, dur = 0.5): ThreadGenerator {
    yield* implCodes[i].node.opacity(0, dur, easeInOutSine);
  }
  function* showSmallScale(i: number, dur = 0.45): ThreadGenerator {
    yield* smallScaleNodes[i]().opacity(1, dur, easeInOutSine);
  }
  function* hideSmallScale(i: number, dur = 0.4): ThreadGenerator {
    yield* smallScaleNodes[i]().opacity(0, dur, easeInOutSine);
  }

  // Expand a [start, end] (inclusive) range into an array of indices.
  const blockLines = (block: readonly [number, number]): number[] => {
    const arr: number[] = [];
    for (let i = block[0]; i <= block[1]; i++) arr.push(i);
    return arr;
  };

  // Dim every line of `code` except the ones in `keepBright`. The
  // bright lines stay at opacity 1; the rest go to `dimOpacity`.
  function* spotlightLines(code: Manticore, keepBright: number[], dimOpacity: number, dur: number): ThreadGenerator {
    const anims: ThreadGenerator[] = [];
    for (let i = 0; i < code.lineCount; i++) {
      const line = code.getLine(i);
      if (!line) continue;
      const target = keepBright.includes(i) ? 1 : dimOpacity;
      anims.push(line.node.opacity(target, dur, easeInOutSine));
    }
    yield* all(...anims);
  }

  // Lift every line back to full opacity (used before hide).
  function* restoreLines(code: Manticore, dur: number): ThreadGenerator {
    const anims: ThreadGenerator[] = [];
    for (let i = 0; i < code.lineCount; i++) {
      const line = code.getLine(i);
      if (line) anims.push(line.node.opacity(1, dur, easeInOutSine));
    }
    yield* all(...anims);
  }

  // ── Per-face viz drivers — each plays the animation that explains
  //    its role: opens (Permission), modifies (Mode), persists (Safety),
  //    skips (Shortcut), reveals hidden states (Poor Model).
  function* permissionDriver(): ThreadGenerator {
    yield* waitFor(0.3);
    // Ball drops and stops dead against the barrier.
    yield* permRequest().position.y(-32, 0.5, easeInOutCubic);
    // Ball turns RED — request was blocked.
    yield* permRequest().fill('#E63946', 0.32, easeInOutSine);
    // Hold the blocked state so the viewer reads "denied by default".
    yield* waitFor(0.8);
    // Flag fires — barrier collapses.
    yield* all(
      permBarrier().scale.x(0, 0.4, easeInOutCubic),
      permBarrier().opacity(0, 0.4),
    );
    // Ball returns to blue — exception granted, it's allowed through.
    yield* permRequest().fill('rgba(100, 180, 255, 0.85)', 0.25, easeInOutSine);
    // Continues falling into target.
    yield* permRequest().position.y(180, 0.55, easeInOutCubic);
    // Target ignites green — action permitted.
    yield* all(
      permTarget().fill('rgba(134, 176, 122, 0.92)', 0.35, easeInOutSine),
      permRequest().opacity(0, 0.35, easeInOutSine),
    );
  }

  function* modeDriver(): ThreadGenerator {
    yield* waitFor(0.4);
    // Active state swaps. Top empties; bottom fills.
    yield* all(
      modeTopCircle().fill('rgba(255, 159, 67, 0)', 0.5, easeInOutSine),
      modeTopCircle().stroke('rgba(255, 159, 67, 0.45)', 0.5, easeInOutSine),
      modeTopCircle().lineWidth(4, 0.5, easeInOutSine),
      modeBotCircle().fill('#C9B0E8', 0.5, easeInOutSine),
      modeBotCircle().stroke('rgba(201, 176, 232, 0)', 0.5, easeInOutSine),
      modeLoudTxt().fill('rgba(255, 159, 67, 0.45)', 0.5, easeInOutSine),
      modeSilentTxt().fill('#C9B0E8', 0.5, easeInOutSine),
    );
  }

  function* shortcutDriver(): ThreadGenerator {
    yield* waitFor(0.35);
    // The `validate` cell (index 1) falls out of the column.
    yield* all(
      scCells[1].position.x(220, 0.45, easeInOutCubic),
      scCells[1].opacity(0, 0.45, easeInOutSine),
      scTexts[1].position.x(220, 0.45, easeInOutCubic),
      scTexts[1].opacity(0, 0.45, easeInOutSine),
    );
    // The cells below collapse upward to close the gap.
    const collapseDist = SC_STEP_H + SC_GAP;
    yield* all(
      scCells[2].position.y(cellY(2) - collapseDist, 0.55, easeInOutCubic),
      scTexts[2].position.y(cellY(2) - collapseDist, 0.55, easeInOutCubic),
      scCells[3].position.y(cellY(3) - collapseDist, 0.55, easeInOutCubic),
      scTexts[3].position.y(cellY(3) - collapseDist, 0.55, easeInOutCubic),
    );
  }

  function* safetyDriver(): ThreadGenerator {
    // Phase 1 — soft = true → Bob's deleted_at fills, row dims, stays.
    yield* waitFor(0.35);
    yield* sRowFill().fill('rgba(255, 140, 163, 0.22)', 0.3, easeInOutSine);
    yield* waitFor(0.3);
    yield* sBobDate().text('2026-05-16', 0.55);
    yield* sBobDate().fill('#86B07A', 0.001);
    yield* waitFor(0.25);
    yield* all(
      sRowFill().fill('rgba(244, 241, 235, 0.05)', 0.5, easeInOutSine),
      sBobRow().opacity(0.45, 0.5, easeInOutSine),
    );
    // Phase 2 — soft = false → row disappears.
    yield* waitFor(1.5);
    yield* safetyArgTxt().text('soft = false', 0.5);
    yield* waitFor(0.35);
    yield* sBobRow().opacity(0, 0.55, easeInOutSine);
  }

  function* poorDriver(): ThreadGenerator {
    yield* waitFor(0.25);
    yield* all(
      poorNodes[0].opacity(1, 0.32, easeInOutSine),
      poorLabels[0].opacity(0.95, 0.32, easeInOutSine),
    );
    for (let k = 0; k < poorEdges.length; k++) {
      const child = poorEdges[k][1];
      yield* all(
        poorLinks[k].opacity(1, 0.14),
        poorLinks[k].end(1, 0.24, easeOutCubic),
      );
      yield* all(
        poorNodes[child].opacity(1, 0.24, easeInOutSine),
        poorLabels[child].opacity(0.95, 0.26, easeInOutSine),
      );
    }
  }

  const vizRefs    = [permissionViz, modeViz, safetyViz, shortcutViz, poorViz];
  const vizDrivers = [permissionDriver, modeDriver, safetyDriver, shortcutDriver, poorDriver];

  function* showViz(i: number, dur = 0.55): ThreadGenerator {
    yield* vizRefs[i]().opacity(1, dur, easeInOutSine);
  }
  function* hideViz(i: number, dur = 0.5): ThreadGenerator {
    yield* vizRefs[i]().opacity(0, dur, easeInOutSine);
  }

  // Per-face beat — same shape for every face:
  //   1. light slides to name (auto-lights)
  //   2. call site lands on the left, sharp
  //   3. after a beat, dim non-bool lines + show impl AND viz at once
  //   4. play the viz driver (face-specific animation)
  //   5. small scale dots fade in under the name (closes the step)
  //   6. fade everything for the next face
  function* runFace(
    i: number,
    slideDur: number,
    callHold: number,
    implHold: number,
    vizHold: number,
    closeHold: number,
  ): ThreadGenerator {
    yield* baseX(NAME_XS[i], slideDur, easeInOutSine);
    arrivalTime(view.globalTime());
    yield* waitFor(0.18);
    yield* showCallCode(i);
    yield* waitFor(callHold);
    yield* all(
      spotlightLines(callCodes[i], blockLines(FACES[i].callBlock), 0.32, 0.55),
      showImplCode(i),
      showViz(i),
    );
    yield* waitFor(implHold);
    yield* vizDrivers[i]();
    yield* restoreLines(callCodes[i], 0.8);
    yield* waitFor(vizHold);
    yield* showSmallScale(i);
    yield* waitFor(closeHold);
    yield* all(
      hideCallCode(i, 0.5),
      hideImplCode(i, 0.5),
      hideViz(i, 0.5),
      hideSmallScale(i, 0.4),
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // TIMELINE
  // ─────────────────────────────────────────────────────────────────────

  // Pre-roll — brief darkness while the eye adapts.
  yield* waitFor(0.45);

  // ─── PERMISSION ─────────────────────────────────────────────────────
  // Long initial slide brings the light into the frame. Call site,
  // impl and gate viz all arrive together; the gate viz plays. Then
  // the big rating gauge blooms centre-frame and migrates up under
  // PERMISSION's name as the persistent rating indicator.
  yield* all(
    baseX(NAME_XS[0], 1.9, easeInOutSine),
    bgCover().opacity(0, 1.4, easeInOutSine),
  );
  arrivalTime(view.globalTime());
  yield* waitFor(0.2);
  yield* showCallCode(0);
  // Let the viewer actually read the call site before anything dims.
  yield* waitFor(4.5);
  yield* all(
    spotlightLines(callCodes[0], blockLines(FACES[0].callBlock), 0.32, 0.55),
    showImplCode(0),
    showViz(0),
  );
  // Time to read the impl before the gate animation starts.
  yield* waitFor(2.0);
  yield* permissionDriver();
  yield* restoreLines(callCodes[0], 0.8);
  yield* waitFor(2.5);

  // Big rating bloom — frame centre, on top of HEAVY-blurred code.
  bigScale().position([0, 0]);
  bigScale().scale(1);
  yield* all(
    callBlurs[0](BLUR_HEAVY, 0.6, easeInOutSine),
    implBlurs[0](BLUR_HEAVY, 0.6, easeInOutSine),
    vizBlur(BLUR_HEAVY, 0.6, easeInOutSine),
    callCodes[0].node.opacity(0.40, 0.6, easeInOutSine),
    implCodes[0].node.opacity(0.40, 0.6, easeInOutSine),
    permissionViz().opacity(0.40, 0.6, easeInOutSine),
    bigScale().opacity(1, 0.6, easeInOutSine),
  );
  yield* waitFor(2.2);

  // Labels fade before migration.
  yield* all(
    bigSafeLabel().opacity(0, 0.4, easeInOutSine),
    bigRiskyLabel().opacity(0, 0.4, easeInOutSine),
  );

  // Migration: gauge → small slot under PERMISSION; everything else
  // comes back to focus.
  const SMALL_TARGET_SCALE = (DOT_R * 2) / (BIG_R * 2);
  yield* all(
    bigScale().position([NAME_XS[0], DOTS_Y], 1.0, easeInOutSine),
    bigScale().scale(SMALL_TARGET_SCALE, 1.0, easeInOutSine),
    callBlurs[0](0, 1.0, easeInOutSine),
    implBlurs[0](0, 1.0, easeInOutSine),
    vizBlur(0, 1.0, easeInOutSine),
    callCodes[0].node.opacity(1, 1.0, easeInOutSine),
    implCodes[0].node.opacity(1, 1.0, easeInOutSine),
    permissionViz().opacity(1, 1.0, easeInOutSine),
  );
  yield* waitFor(2.0);

  // PERMISSION close.
  yield* all(
    hideCallCode(0, 0.55),
    hideImplCode(0, 0.55),
    hideViz(0, 0.55),
    bigScale().opacity(0, 0.45, easeInOutSine),
  );

  // ─── MODE / SAFETY / SHORTCUT / POOR MODEL — same shape ─────────────
  // Per-face holds: slide / callHold(read call) / implHold(read impl
  // before viz drives) / vizHold / closeHold. Each waitFor leaves at
  // least ~2 s for the viewer before the next opacity change.
  yield* runFace(1, 0.9, 4.5, 2.0, 3.0, 2.2);
  yield* runFace(2, 0.9, 4.5, 2.0, 4.5, 2.2);
  yield* runFace(3, 0.9, 4.5, 2.0, 3.0, 2.2);
  yield* runFace(4, 0.9, 4.5, 2.0, 3.8, 2.2);

  // ─── FINALE — moving lamp stays on POOR MODEL, four new lamps
  //    flick on over the other names. All five gauges fade in.
  yield* all(
    finaleMix(1, 1.0, easeInOutSine),
    finaleSpots[0]().opacity(1, 1.0, easeInOutSine),
    finaleSpots[1]().opacity(1, 1.0, easeInOutSine),
    finaleSpots[2]().opacity(1, 1.0, easeInOutSine),
    finaleSpots[3]().opacity(1, 1.0, easeInOutSine),
    ...smallScaleNodes.map(s => s().opacity(1, 1.0, easeInOutSine)),
  );

  // Reminder hold.
  yield* waitFor(4.0);

  // Final fade-out — everything dims in place; the lamp stays on
  // POOR MODEL, just dims out with the rest of the scene.
  yield* all(
    sceneAlpha(0, 1.4, easeInOutSine),
    finaleMix(0, 1.4, easeInOutSine),
    mainSpot().opacity(0, 1.4, easeInOutSine),
    finaleSpots[0]().opacity(0, 1.4, easeInOutSine),
    finaleSpots[1]().opacity(0, 1.4, easeInOutSine),
    finaleSpots[2]().opacity(0, 1.4, easeInOutSine),
    finaleSpots[3]().opacity(0, 1.4, easeInOutSine),
    ...smallScaleNodes.map(s => s().opacity(0, 1.4, easeInOutSine)),
  );
  yield* waitFor(0.6);
});
