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

const IMPL_PERMISSION = `fun save(
    path: String,
    content: Bytes,
    contentType: String,
    overwrite: Boolean = false,
): StoredFile {
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

const IMPL_SAFETY = `fun delete(
    userId: UserId,
    soft: Boolean = true,
    deletedAt: Instant,
    deletedBy: UserId,
): DeletedUser {
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

const IMPL_SHORTCUT = `fun process(
    order: Order,
    source: OrderSource,
    skipValidation: Boolean = false,
): ProcessingResult {
    if (!skipValidation) {
        validator.requireValid(order)
    }

    val normalized = normalizer.normalize(order, source)
    val reserved = inventory.reserve(normalized.items)
    val payment = payments.authorize(normalized)

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

const IMPL_POOR = `fun update(
    campaignId: CampaignId,
    active: Boolean,
    startedAt: Instant,
): Campaign {
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
  view.add(
    <Circle
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

  // ── Five names — invisible until the spotlight reaches them ────────
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
        opacity={() => brightnessAt(x)}
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
  const CODE_FONT_SIZE = 18;
  const CODE_LH        = 27;
  const IMPL_FONT_SIZE = 19;     // slightly bigger than the call class
  const IMPL_LH        = 28;
  const CALL_W         = 860;    // production class card (fits SAFETY inline sig)
  const IMPL_W         = 960;    // implementation card — wider for inline save sig
  const CALL_X         = -510;   // call card centre  → spans [-940, -80]
  const IMPL_X         = 460;    // impl card centre  → spans [-20, +940]
  const TOP_Y          = -310;   // first call-code line top — gap from names ≈ 95px

  // Manticore vertically centres its content; this returns the
  // container Y that places the FIRST line at TOP_Y for a given code.
  const yForCode = (src: string): number => {
    const lines = src.split('\n').length;
    return TOP_Y + ((lines - 1) * CODE_LH) / 2;
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
    code.node.opacity(0);
    return code;
  });

  const implCodes = FACES.map(face => {
    const code = Manticore.create(face.implCode, {
      x: IMPL_X,
      y: 0,             // implementation sits vertically centred in the right half
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
    code.node.opacity(0);
    return code;
  });

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
    const HDR_Y   = -100;
    const ROW_GAP = 56;
    const COL_X   = [-240, -80, 140];
    const TABLE_W = 600;
    const TABLE_H = 320;
    const ROW_W   = TABLE_W - 20;
    const ROW_H   = 46;
    const FONT_SZ = 24;
    const INK     = '#F4F1EB';
    const SUBTLE  = 'rgba(244, 241, 235, 0.50)';
    view.add(
      <Node ref={safetyViz} x={IMPL_X} y={0} opacity={0}>
        {/* Argument label above the table — `soft = true` etc. */}
        <Txt
          ref={safetyArgTxt}
          x={-TABLE_W / 2 + 18}
          y={-TABLE_H / 2 - 36}
          offset={[-1, 0]}
          text={'soft = true'}
          fontFamily={Fonts.code}
          fontSize={26}
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
          <Rect ref={sRowFill} x={0} y={HDR_Y + 2 * ROW_GAP} width={ROW_W} height={ROW_H} fill={'rgba(255, 140, 163, 0.10)'} radius={3} />
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
  const POOR_NODE_R = 40;
  // (x, y, colour, labelPlacement)
  const poorPositions: [number, number, string, 'right' | 'below'][] = [
    [   0, -200, '#C9B0E8', 'right'],   // 0
    [   0,  -80, '#C9B0E8', 'right'],   // 1
    [   0,   40, '#A8CDE8', 'right'],   // 2
    [-180,  200, '#86B07A', 'below'],   // 3
    [   0,  200, '#FFB562', 'below'],   // 4
    [ 180,  200, '#FF7373', 'below'],   // 5
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
      <Node ref={poorViz} x={IMPL_X} y={0} opacity={0}>
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
            lineWidth={4}
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
            fontSize={22}
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

  // Per-face beat (faces 1..4 — i.e. not PERMISSION, not POOR MODEL):
  //   1. light slides to name (auto-lights)
  //   2. call site lands on the left, sharp
  //   3. after a beat, dim everything except the boolean line on the
  //      left, and SIMULTANEOUSLY the implementation arrives on right
  //   4. settle for voice-over
  //   5. small scale dots fade in under the name (closes the step)
  //   6. fade everything for the next face
  function* runFace(
    i: number,
    slideDur: number,
    callHold: number,
    implHold: number,
    closeHold: number,
  ): ThreadGenerator {
    yield* baseX(NAME_XS[i], slideDur, easeInOutSine);
    arrivalTime(view.globalTime());          // start the 5 s hand-wobble
    yield* waitFor(0.18);
    yield* showCallCode(i);
    yield* waitFor(callHold);
    yield* all(
      spotlightLines(callCodes[i], blockLines(FACES[i].callBlock), 0.32, 0.55),
      showImplCode(i),
    );
    yield* waitFor(implHold);
    yield* showSmallScale(i);
    yield* waitFor(closeHold);
    yield* all(
      restoreLines(callCodes[i], 0.4),
      hideCallCode(i, 0.5),
      hideImplCode(i, 0.5),
      hideSmallScale(i, 0.4),
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // TIMELINE
  // ─────────────────────────────────────────────────────────────────────

  // Pre-roll — brief darkness while the eye adapts.
  yield* waitFor(0.45);

  // ─── PERMISSION ─────────────────────────────────────────────────────
  // Long initial slide brings the light into the frame; call site
  // appears, then dim → impl appears; then the BIG rating gauge blooms
  // in the middle on top of softened code, holds, and finally migrates
  // up into PERMISSION's small-scale slot (this teaches the audience
  // that the dots under every name are the same rating system).
  yield* baseX(NAME_XS[0], 1.9, easeInOutSine);
  arrivalTime(view.globalTime());
  yield* waitFor(0.2);
  yield* showCallCode(0);
  yield* waitFor(3.6);
  yield* all(
    spotlightLines(callCodes[0], blockLines(FACES[0].callBlock), 0.32, 0.55),
    showImplCode(0),
  );
  yield* waitFor(4.0);

  // Big rating bloom — frame centre, on top of the (now blurred) code.
  bigScale().position([0, 0]);
  bigScale().scale(1);
  yield* all(
    callBlurs[0](BLUR_HEAVY, 0.7, easeInOutSine),
    implBlurs[0](BLUR_HEAVY, 0.7, easeInOutSine),
    callCodes[0].node.opacity(0.40, 0.7, easeInOutSine),
    implCodes[0].node.opacity(0.40, 0.7, easeInOutSine),
    bigScale().opacity(1, 0.7, easeInOutSine),
  );
  yield* waitFor(2.4);

  // Before the gauge migrates, the "safe / risky" gradation labels
  // fade out — they only make sense while the scale is the focal point.
  yield* all(
    bigSafeLabel().opacity(0, 0.45, easeInOutSine),
    bigRiskyLabel().opacity(0, 0.45, easeInOutSine),
  );

  // Migration: gauge slides up under PERMISSION's name and shrinks;
  // the persistent small-scale node takes its place and the code
  // returns to focus.
  const SMALL_TARGET_SCALE = (DOT_R * 2) / (BIG_R * 2);
  yield* all(
    bigScale().position([NAME_XS[0], DOTS_Y], 1.0, easeInOutSine),
    bigScale().scale(SMALL_TARGET_SCALE, 1.0, easeInOutSine),
    callBlurs[0](0, 1.0, easeInOutSine),
    implBlurs[0](0, 1.0, easeInOutSine),
    callCodes[0].node.opacity(1, 1.0, easeInOutSine),
    implCodes[0].node.opacity(1, 1.0, easeInOutSine),
  );
  // Keep the migrated big-gauge node — it's now sized exactly like the
  // small under-name dots (BIG_GAP/BIG_R ratio matches), so no handover
  // and no visible flicker.
  yield* waitFor(3.0);

  // PERMISSION close — fade code and the migrated gauge; light moves on.
  yield* all(
    restoreLines(callCodes[0], 0.45),
    hideCallCode(0, 0.55),
    hideImplCode(0, 0.55),
    bigScale().opacity(0, 0.45, easeInOutSine),
  );

  // ─── MODE ───────────────────────────────────────────────────────────
  yield* runFace(1, 0.9, 3.5, 4.2, 2.2);

  // ─── SAFETY  (impl reveal → DB-table punchline) ─────────────────────
  yield* baseX(NAME_XS[2], 0.9, easeInOutSine);
  arrivalTime(view.globalTime());
  yield* waitFor(0.18);
  yield* showCallCode(2);
  yield* waitFor(3.0);
  yield* all(
    spotlightLines(callCodes[2], blockLines(FACES[2].callBlock), 0.32, 0.55),
    showImplCode(2),
  );
  yield* waitFor(3.4);

  // Blur impl + bloom DB table on top.
  yield* all(
    implBlurs[2](BLUR_HEAVY, 0.55, easeInOutSine),
    implCodes[2].node.opacity(0.35, 0.55, easeInOutSine),
    safetyViz().opacity(1, 0.55, easeInOutSine),
  );

  // Phase 1 — soft = true → Bob's deleted_at fills, row dims, row stays.
  yield* waitFor(0.4);
  yield* sRowFill().fill('rgba(255, 140, 163, 0.22)', 0.32, easeInOutSine);
  yield* waitFor(0.3);
  yield* sBobDate().text('2026-05-16', 0.6);
  yield* sBobDate().fill('#86B07A', 0.001);
  yield* waitFor(0.25);
  yield* all(
    sRowFill().fill('rgba(244, 241, 235, 0.05)', 0.55, easeInOutSine),
    sBobRow().opacity(0.45, 0.55, easeInOutSine),
  );
  yield* waitFor(1.8);

  // Phase 2 — soft = false → header switches, Bob's row is removed.
  yield* safetyArgTxt().text('soft = false', 0.5);
  yield* waitFor(0.4);
  yield* sBobRow().opacity(0, 0.6, easeInOutSine);

  yield* showSmallScale(2);
  yield* waitFor(2.2);

  yield* all(
    restoreLines(callCodes[2], 0.4),
    hideCallCode(2, 0.5),
    hideImplCode(2, 0.5),
    implBlurs[2](0, 0.5, easeInOutSine),
    safetyViz().opacity(0, 0.5, easeInOutSine),
    hideSmallScale(2, 0.4),
  );

  // ─── SHORTCUT ───────────────────────────────────────────────────────
  yield* runFace(3, 0.9, 3.4, 4.3, 2.2);

  // ─── POOR MODEL  (impl reveal → state-graph punchline) ──────────────
  yield* baseX(NAME_XS[4], 0.9, easeInOutSine);
  arrivalTime(view.globalTime());
  yield* waitFor(0.18);
  yield* showCallCode(4);
  yield* waitFor(3.0);
  yield* all(
    spotlightLines(callCodes[4], blockLines(FACES[4].callBlock), 0.32, 0.55),
    showImplCode(4),
  );
  yield* waitFor(3.4);

  // Blur impl + animate the tree in. No lone-square prelude — the
  // first node arrives at its final slot just like the others, but
  // the build still cascades node-by-node so the structure reads as
  // it grows.
  yield* all(
    implBlurs[4](BLUR_HEAVY, 0.55, easeInOutSine),
    implCodes[4].node.opacity(0.35, 0.55, easeInOutSine),
    poorViz().opacity(1, 0.55, easeInOutSine),
  );
  // Node 0 (draft) appears first, in place.
  yield* all(
    poorNodes[0].opacity(1, 0.32, easeInOutSine),
    poorLabels[0].opacity(0.95, 0.32, easeInOutSine),
  );
  // Then each edge draws and its child bloom in turn.
  for (let k = 0; k < poorEdges.length; k++) {
    const child = poorEdges[k][1];
    yield* all(
      poorLinks[k].opacity(1, 0.16),
      poorLinks[k].end(1, 0.26, easeOutCubic),
    );
    yield* all(
      poorNodes[child].opacity(1, 0.26, easeInOutSine),
      poorLabels[child].opacity(0.95, 0.28, easeInOutSine),
    );
  }

  yield* showSmallScale(4);
  yield* waitFor(3.2);

  // POOR MODEL close + outro.
  yield* all(
    restoreLines(callCodes[4], 0.45),
    hideCallCode(4, 0.55),
    hideImplCode(4, 0.55),
    implBlurs[4](0, 0.55, easeInOutSine),
    poorViz().opacity(0, 0.55, easeInOutSine),
    hideSmallScale(4, 0.45),
  );
  yield* baseX(NAME_XS[4] + 820, 1.2, easeInOutSine);
  yield* waitFor(0.8);
});
