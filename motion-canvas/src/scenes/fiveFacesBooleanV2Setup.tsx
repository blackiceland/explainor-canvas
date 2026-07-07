import {Circle, Gradient, Layout, Line, Node, Rect, Txt, View2D, blur, makeScene2D} from '@motion-canvas/2d';
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
import {Canon} from '../core/code/model/paletteCanon';

// ── FLAT viz · единый стиль для всех лиц ───────────────────────────────
// Круговой scrim цвета фона с плавным фейдом (не карточка, маскирует код).
const vizScrim = () => (
  <Rect
    width={480}
    height={480}
    fill={new Gradient({
      type: 'radial', from: new Vector2(0, 0), to: new Vector2(0, 0),
      fromRadius: 0, toRadius: 240,
      stops: [
        {offset: 0, color: '#1B1D24'},
        {offset: 0.5, color: '#16181F'},
        {offset: 1, color: 'rgba(16,18,24,0)'},
      ],
    })}
  />
);
const VIZ_DIM = 'rgba(244,241,235,0.14)';   // нейтральная заливка FLAT-примитива

// ── Palette ───────────────────────────────────────────────────────────
export const TEXT_PRIMARY  = '#F4F1EB';
export const ACCENT        = '#FF8CA3';        // project rose — weight gauge

// Code colours — strict classification with one role per colour.
export const VAR_LIGHT    = 'rgba(244,241,235,0.96)';      // variables, receivers, locals, impl-sig params
export const TYPE_CLEAN   = 'rgba(220,215,255,0.80)';      // types
export const METHOD_COLOR = '#FF8CA3';                     // method calls
export const FUN_BLUE     = '#A3CDFF';                     // language keywords
export const STRING_GREEN = '#86B07A';                     // string literals — richer green
export const CONST_COLOR  = 'rgba(201,180,255,0.78)';      // SCREAMING_SNAKE constants — project canon (DryFiltersV3CodeTheme.constant)
export const PARAM_DARK   = '#7C9CBA';                     // CALL-SITE named params only

// ── Top row layout ────────────────────────────────────────────────────
export const NAME_XS = [-720, -360, 0, 360, 720] as const;

export const NAMES_Y        = -450;
export const NAME_FONT_SIZE = 44;
export const NAME_LETTER_SP = 4;

// Small scale-dot indicators under each name.
export const DOTS_Y         = -395;
export const DOT_R          = 8;
export const DOT_GAP        = 30;

// ── Spotlight physics ─────────────────────────────────────────────────
export const LIGHT_REACH = 270;
export const SPOT_R      = 290;
export const SHADOW_MAX  = 18;

// ── Faces ─────────────────────────────────────────────────────────────
export interface Face {
  name: string;
  scale: number;             // weight rating 0..5
  callCode: string;          // full production class
  implCode: string;          // implementation of the called method
  callBlock: [number, number]; // [startLine, endLine] of the call site within callCode
}

export const CALL_PERMISSION = `@Service
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

// PERMISSION call after the split — the boolean argument is gone; the caller
// picks the named method. save(…, overwrite = true) → saveOrReplace(…).
export const CALL_PERMISSION_CLEAN = `@Service
class MonthlyReportPublisher(

    private val renderer: ReportRenderer,
    private val fileStorage: FileStorage,
    private val auditLog: AuditLog,
) {

    fun publish(period: YearMonth, requestedBy: UserId): StorageKey {
        val report = renderer.renderMonthlyReport(period)

        val savedFile = fileStorage.saveOrReplace(
            path = "reports/monthly/$period.pdf",
            content = report.bytes,
            contentType = "application/pdf",
        )

        auditLog.record(
            actorId = requestedBy,
            action = "monthly_report_published",
            resourceId = savedFile.key,
        )

        return savedFile.key
    }
}`;

export const COMPLEX_SAVE_CODE = `class FileStorageService(
    private val storage: ObjectStorage,
    private val validator: ContentValidator,
    private val antivirus: AntivirusScanner,
    private val quotas: QuotaService,
    private val locks: DistributedLockProvider,
    private val encryption: EncryptionService,
    private val events: DomainEventPublisher,
    private val audit: AuditLog,
    private val metrics: StorageMetrics,
    private val clock: Clock,
) {

    fun save(path: String, content: Bytes, contentType: String, overwrite: Boolean = false): StoredFile {
        require(path.isNotBlank()) { "Path must not be blank" }
        require(content.size > 0) { "Content must not be empty" }

        val startTime = clock.instant()

        val normalizedPath = normalizePath(path)
        val sizeBytes = content.size.toLong()
        validator.requireValidMimeType(contentType)
        validator.requireSafeContent(content, contentType)

        if (sizeBytes > MAX_FILE_SIZE) {
            throw FileTooLargeException(normalizedPath, sizeBytes, MAX_FILE_SIZE)
        }

        val scanResult = antivirus.scan(content, contentType)

        if (!scanResult.clean) {
            audit.record(currentUserId(), "malware_detected", normalizedPath,
                mapOf("threat" to scanResult.threatName, "engine" to scanResult.engineVersion))
            throw MalwareDetectedException(normalizedPath, scanResult.threatName)
        }

        val usage = quotas.currentUsage(tenantId())

        if (usage.bytes + sizeBytes > usage.limit) {
            throw QuotaExceededException(tenantId(), sizeBytes, usage.limit - usage.bytes)
        }

        val lock = locks.tryAcquire("file:\${normalizedPath}", Duration.ofSeconds(5))
            ?: throw FileLockedException(normalizedPath)

        try {
            val existing = storage.find(normalizedPath)

            if (existing != null && !overwrite) {
                throw FileAlreadyExistsException(normalizedPath)
            }

            val version = (existing?.version ?: 0) + 1

            val encryptionKey = encryption.generateKey()
            val encrypted = encryption.encrypt(content, encryptionKey)
            val checksum = computeChecksum(encrypted)

            val storageKey = storage.put(
                path = normalizedPath, content = encrypted, contentType = contentType,
                metadata = mapOf(
                    "version" to version.toString(), "checksum" to checksum,
                    "original-size" to sizeBytes.toString(), "encryption-key-id" to encryptionKey.id,
                    "uploaded-at" to clock.instant().toString(), "uploaded-by" to currentUserId().value,
                ),
            )

            val storedFile = StoredFile(
                key = storageKey, path = normalizedPath, contentType = contentType,
                sizeBytes = sizeBytes, version = version, checksum = checksum,
                createdAt = existing?.createdAt ?: clock.instant(), updatedAt = clock.instant(),
            )

            val action = if (existing != null) {
                "file_overwritten"
            } else {
                "file_created"
            }

            audit.record(currentUserId(), action, storageKey, mapOf(
                "path" to normalizedPath, "version" to version,
                "size" to sizeBytes, "contentType" to contentType,
            ))

            events.publish(FileStoredEvent(
                path = normalizedPath, key = storageKey, action = action,
                version = version, storedAt = clock.instant(), storedBy = currentUserId(),
            ))

            quotas.recordUsage(tenantId(), sizeBytes - (existing?.sizeBytes ?: 0))

            metrics.recordUpload(
                tenantId = tenantId(), sizeBytes = sizeBytes, contentType = contentType,
                duration = Duration.between(startTime, clock.instant()),
                version = version, overwritten = existing != null,
            )

            return storedFile
        } finally {
            lock.release()
        }
    }
}`;

// PERMISSION big-method view — the SAME real save(), but ONLY the method:
// no class header, no constructor injects. Shows how big one method already is,
// so "just split it" is not free. De-indented one level (standalone method).
export const COMPLEX_SAVE_METHOD = `fun save(path: String, content: Bytes, contentType: String, overwrite: Boolean = false): StoredFile {
    require(path.isNotBlank()) { "Path must not be blank" }
    require(content.size > 0) { "Content must not be empty" }

    val startTime = clock.instant()

    val normalizedPath = normalizePath(path)
    val sizeBytes = content.size.toLong()
    validator.requireValidMimeType(contentType)
    validator.requireSafeContent(content, contentType)

    if (sizeBytes > MAX_FILE_SIZE) {
        throw FileTooLargeException(normalizedPath, sizeBytes, MAX_FILE_SIZE)
    }

    val scanResult = antivirus.scan(content, contentType)

    if (!scanResult.clean) {
        audit.record(currentUserId(), "malware_detected", normalizedPath,
            mapOf("threat" to scanResult.threatName, "engine" to scanResult.engineVersion))
        throw MalwareDetectedException(normalizedPath, scanResult.threatName)
    }

    val usage = quotas.currentUsage(tenantId())

    if (usage.bytes + sizeBytes > usage.limit) {
        throw QuotaExceededException(tenantId(), sizeBytes, usage.limit - usage.bytes)
    }

    val lock = locks.tryAcquire("file:\${normalizedPath}", Duration.ofSeconds(5))
        ?: throw FileLockedException(normalizedPath)

    try {
        val existing = storage.find(normalizedPath)

        if (existing != null && !overwrite) {
            throw FileAlreadyExistsException(normalizedPath)
        }

        val version = (existing?.version ?: 0) + 1

        val encryptionKey = encryption.generateKey()
        val encrypted = encryption.encrypt(content, encryptionKey)
        val checksum = computeChecksum(encrypted)

        val storageKey = storage.put(
            path = normalizedPath, content = encrypted, contentType = contentType,
            metadata = mapOf(
                "version" to version.toString(), "checksum" to checksum,
                "original-size" to sizeBytes.toString(), "encryption-key-id" to encryptionKey.id,
                "uploaded-at" to clock.instant().toString(), "uploaded-by" to currentUserId().value,
            ),
        )

        val storedFile = StoredFile(
            key = storageKey, path = normalizedPath, contentType = contentType,
            sizeBytes = sizeBytes, version = version, checksum = checksum,
            createdAt = existing?.createdAt ?: clock.instant(), updatedAt = clock.instant(),
        )

        val action = if (existing != null) {
            "file_overwritten"
        } else {
            "file_created"
        }

        audit.record(currentUserId(), action, storageKey, mapOf(
            "path" to normalizedPath, "version" to version,
            "size" to sizeBytes, "contentType" to contentType,
        ))

        events.publish(FileStoredEvent(
            path = normalizedPath, key = storageKey, action = action,
            version = version, storedAt = clock.instant(), storedBy = currentUserId(),
        ))

        quotas.recordUsage(tenantId(), sizeBytes - (existing?.sizeBytes ?: 0))

        metrics.recordUpload(
            tenantId = tenantId(), sizeBytes = sizeBytes, contentType = contentType,
            duration = Duration.between(startTime, clock.instant()),
            version = version, overwritten = existing != null,
        )

        return storedFile
    } finally {
        lock.release()
    }
}`;

// PERMISSION trade-off payoff — the SAME method "split" cleanly. The public API
// becomes two thin verbs, but the heavy body (and the boolean) don't vanish:
// they move into a private save(…, overwrite). The flag survived the refactor —
// it just went private. Real (compact) body, no elision comments.
export const COMPLEX_SAVE_SPLIT = `fun save(path: String, content: Bytes, contentType: String): StoredFile =
    save(path, content, contentType, overwrite = false)

fun saveOrReplace(path: String, content: Bytes, contentType: String): StoredFile =
    save(path, content, contentType, overwrite = true)

private fun save(
    path: String, content: Bytes, contentType: String,
    overwrite: Boolean,
): StoredFile {
    val normalizedPath = normalizePath(path)
    validator.requireValidMimeType(contentType)

    val lock = locks.tryAcquire("file:\${normalizedPath}", Duration.ofSeconds(5))
        ?: throw FileLockedException(normalizedPath)

    val existing = storage.find(normalizedPath)
    if (existing != null && !overwrite) {
        throw FileAlreadyExistsException(normalizedPath)
    }

    val stored = storage.put(normalizedPath, encrypt(content))
    events.publish(FileStoredEvent(normalizedPath, stored.key))
    return stored
}`;

export const IMPL_SAVE_CLEAN = `fun save(path: String, content: Bytes, contentType: String): StoredFile {
    if (storage.exists(path)) {
        throw FileAlreadyExists(path)
    }

    return write(path, content, contentType)
}`;

export const IMPL_SAVE_OR_REPLACE = `fun saveOrReplace(path: String, content: Bytes, contentType: String): StoredFile {
    return write(path, content, contentType)
}`;

export const IMPL_WRITE = `private fun write(path: String, content: Bytes, contentType: String): StoredFile {
    val key = storage.put(
        path = path,
        content = content,
        contentType = contentType,
    )

    return StoredFile(key)
}`;

export const IMPL_PERMISSION_REFACTORED = `fun save(path: String, content: Bytes, contentType: String): StoredFile {
    if (storage.exists(path)) {
        throw FileAlreadyExists(path)
    }

    return write(path, content, contentType)
}

fun saveOrReplace(path: String, content: Bytes, contentType: String): StoredFile {
    return write(path, content, contentType)
}

private fun write(path: String, content: Bytes, contentType: String): StoredFile {
    val key = storage.put(
        path = path,
        content = content,
        contentType = contentType,
    )

    return StoredFile(key)
}`;

export const IMPL_PERMISSION = `fun save(path: String, content: Bytes, contentType: String,
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

export const CALL_MODE = `@Service
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

export const IMPL_MODE = `fun send(user: User, message: Message, silent: Boolean): Delivery {
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

export const CALL_SAFETY = `@Service
class AccountDeletionService(

    private val users: UserRepository,
    private val sessions: UserSessionRepository,
    private val deletion: UserDeletion,
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

export const IMPL_SAFETY = `fun delete(userId: UserId, soft: Boolean = true, deletedAt: Instant,
    deletedBy: UserId): DeletedUser {
    val user = users.requireById(userId)

    if (soft) {
        return users.markDeleted(
            userId = user.id,
            deletedAt = deletedAt,
            deletedBy = deletedBy,
        )
    }

    users.deletePermanently(user.id)

    return DeletedUser(user.id)
}`;

export const CALL_SHORTCUT = `@Service
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

export const IMPL_SHORTCUT = `fun process(order: Order, source: OrderSource, skipValidation: Boolean = false
): ProcessingResult {
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

export const CALL_POOR = `@Service
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

export const IMPL_POOR = `fun update(campaignId: CampaignId, active: Boolean, startedAt: Instant
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
export const FACES: Face[] = [
  {name: 'PERMISSION', scale: 2,
   callCode: CALL_PERMISSION, implCode: IMPL_PERMISSION,
   callBlock: [11, 16]},
  {name: 'MODE',       scale: 3,
   callCode: CALL_MODE,       implCode: IMPL_MODE,
   callBlock: [17, 21]},
  {name: 'SAFETY',     scale: 3,
   callCode: CALL_SAFETY,     implCode: IMPL_SAFETY,
   callBlock: [14, 19]},
  {name: 'SHORTCUT',   scale: 4,
   callCode: CALL_SHORTCUT,   implCode: IMPL_SHORTCUT,
   callBlock: [13, 17]},
  {name: 'POOR MODEL', scale: 5,
   callCode: CALL_POOR,       implCode: IMPL_POOR,
   callBlock: [12, 16]},
];

export const STATE_LIST = 'draft  /  scheduled  /  running  /  paused  /  completed  /  archived';

// Project code-rendering canon: transparent card, no clipping.
export const TRANSPARENT_CARD = {
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

export const CUSTOM_TYPES = [
  // PERMISSION
  'Service', 'MonthlyReportPublisher', 'ReportRenderer', 'FileStorage', 'AuditLog',
  'YearMonth', 'UserId', 'StorageKey',
  'FileRef', 'ByteArray', 'Bytes', 'Boolean', 'StoredFile', 'FileAlreadyExists',
  // COMPLEX SAVE
  'FileStorageService', 'ObjectStorage', 'MetadataExtractor', 'ContentValidator',
  'QuotaService', 'DistributedLockProvider', 'ThumbnailGenerator', 'EncryptionService',
  'CdnInvalidator', 'VersionRepository', 'SearchIndex', 'Duration',
  'FileTooLargeException', 'QuotaExceededException', 'FileLockedException',
  'FileAlreadyExistsException', 'StorageDocument', 'FileStoredEvent',
  'AntivirusScanner', 'RateLimiter', 'FileSubscriptionRepository', 'NotificationService',
  'BackupStorage', 'BackupPolicy', 'StorageMetrics', 'BackupEncryption',
  'MalwareDetectedException', 'FileChangedNotification',
  // MODE
  'ShipmentNotificationService', 'MessageTemplateRepository', 'CustomerNotifier',
  'DeliveryRepository', 'Order', 'DeliveryResult', 'Sent',
  'User', 'Message', 'Delivery', 'PushOptions', 'Silent', 'Default',
  'PushGateway',
  // SAFETY
  'AccountDeletionService', 'UserRepository', 'UserSessionRepository', 'UserDeletion', 'Clock',
  'DeletionResult', 'Deleted', 'DeletedUser', 'Instant',
  // SHORTCUT
  'ErpOrderImportJob', 'ErpOrderParser', 'OrderProcessor', 'ImportRunRepository',
  'UploadedFile', 'ImportResult', 'OrderSource', 'Imported',
  'ProcessingResult', 'Accepted',
  // POOR MODEL
  'CampaignLauncher', 'CampaignRepository', 'CampaignScheduler', 'DomainEventPublisher',
  'CampaignId', 'Campaign', 'CampaignActivated',
];

export const METHOD_NAMES = [
  // call sites + production classes
  'publish', 'renderMonthlyReport', 'save', 'record',
  'notifyShipmentCreated', 'require', 'render', 'send', 'format',
  'deleteAccount', 'requireActive', 'revokeAll', 'delete',
  'importOrders', 'parse', 'start', 'forEach', 'process', 'finish',
  'launchNow', 'requireReady', 'update', 'enqueue', 'mapOf',
  // impl bodies
  'exists', 'put', 'read', 'find', 'ensureDirectory',
  'generateKey', 'encrypt', 'extract', 'generate', 'archive', 'index',
  'invalidate', 'tryAcquire', 'release', 'recordUsage', 'publish',
  'requireValidMimeType', 'requireSafeContent', 'currentUsage',
  'normalizePath', 'computeChecksum', 'isImageType', 'thumbnailPath',
  'currentUserId', 'tenantId', 'substringBeforeLast', 'isNotBlank',
  'isNotEmpty', 'toMap', 'ofSeconds', 'toLong', 'toString',
  'scan', 'check', 'replicate', 'requiresBackup', 'targetBucket',
  'retention', 'recordUpload', 'findWatchers', 'between',
  'requireById', 'markDeleted', 'deleteByUser', 'deletePermanently',
  'requireValid', 'reserve', 'authorize', 'normalize',
  'copy', 'instant',
];

export const NAMED_PARAMS = [
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

export const VAR_NAMES = [
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
export const CODE_RULES: ColorRule[] = [
  // 1. Variables — broad fallback
  {match: /^[a-z][a-zA-Z0-9_]*$/, color: VAR_LIGHT},
  // 2. Explicit variable / receiver list (re-asserts cream)
  {match: new RegExp('^(' + VAR_NAMES.join('|') + ')$'), color: VAR_LIGHT},
  // 3. Types — PascalCase classified as type
  {match: /^[A-Z][a-zA-Z0-9]*$/, color: TYPE_CLEAN, onlyTypes: ['type'] as const},
  {match: new RegExp('^(' + CUSTOM_TYPES.join('|') + ')$'), color: TYPE_CLEAN},
  // 4. Method calls (with tokenizer hint)
  {match: /^[a-z][a-zA-Z0-9_]*$/, color: METHOD_COLOR, onlyTypes: ['method'] as const},
  // 5. Explicit method list
  {match: new RegExp('^(' + METHOD_NAMES.join('|') + ')$'), color: METHOD_COLOR},
  // 6. SCREAMING_SNAKE constants / enum entries
  {match: /^[A-Z][A-Z0-9_]+$/, color: CONST_COLOR},
  // 7. Kotlin keywords + Spring annotation
  {match: /^(class|object|fun|val|var|private|public|internal|return|if|else|is|in|to|true|false|throw|null|try|catch|finally|@Service)$/, color: FUN_BLUE},
  // 8. String literals
  {match: /./, color: STRING_GREEN, onlyTypes: ['string'] as const},
];

// ── Code layout constants ─────────────────────────────────────────────
export const CODE_FONT_SIZE = 19;
export const CODE_LH        = 28;
export const IMPL_FONT_SIZE = 19;
export const IMPL_LH        = 28;
export const CALL_W         = 820;
export const IMPL_W         = 620;
export const CALL_X         = -530;
export const IMPL_X         = 220;
export const VIZ_X          = 670;
export const VIZ_Y          = 200;
export const TOP_Y          = -310;

// ── Shortcut viz constants ────────────────────────────────────────────
export const SC_STEP_W = 240;
export const SC_STEP_H = 70;
export const SC_GAP    = 20;
export const STEPS     = ['input', 'validate', 'process', 'finalize'];
export const SC_COLOURS = ['#7AA8D4', '#D67373', '#D9A574', '#8FA887'];
export const SC_FILLS   = [
  'rgba(122, 168, 212, 0.16)',
  'rgba(214, 115, 115, 0.16)',
  'rgba(217, 165, 116, 0.16)',
  'rgba(143, 168, 135, 0.18)',
];
export const SC_TOTAL  = STEPS.length * SC_STEP_H + (STEPS.length - 1) * SC_GAP;
export const cellY     = (i: number): number => -SC_TOTAL / 2 + SC_STEP_H / 2 + i * (SC_STEP_H + SC_GAP);

// ── Poor Model viz constants ──────────────────────────────────────────
export const POOR_NODE_R = 30;
export const poorPositions: [number, number, string, 'right' | 'below'][] = [
  [   0, -180, '#C9B0E8', 'right'],   // 0
  [   0,  -80, '#C9B0E8', 'right'],   // 1
  [   0,   20, '#A8CDE8', 'right'],   // 2
  [-130,  150, '#86B07A', 'below'],   // 3
  [   0,  150, '#FFB562', 'below'],   // 4
  [ 130,  150, '#FF7373', 'below'],   // 5
];
export const poorEdges: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [2, 4], [2, 5],
];
export const poorStateLabels = [
  'draft',        // 0
  'scheduled',    // 1
  'running',      // 2
  'paused',       // 3
  'completed',    // 4
  'archived',     // 5
];

// ── Blur constant ─────────────────────────────────────────────────────
export const BLUR_HEAVY = 14;

// ── Big scale constants ───────────────────────────────────────────────
export const BIG_R   = 40;
export const BIG_GAP = 150;

// ── Pure helpers ──────────────────────────────────────────────────────
export const yForCode = (src: string): number => {
  const lines = src.split('\n').length;
  return TOP_Y + ((lines - 1) * CODE_LH) / 2;
};

export const findMethodLine = (src: string): number => {
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('fun ')) return i;
  }
  return 0;
};

const BOOL_LINE_RE = /\b(true|false)\b|:\s*Boolean\b/;
export const findBoolLines = (src: string): number[] => {
  const out: number[] = [];
  src.split('\n').forEach((line, i) => {
    if (BOOL_LINE_RE.test(line)) out.push(i);
  });
  return out;
};

export const blockLines = (block: readonly [number, number]): number[] => {
  const arr: number[] = [];
  for (let i = block[0]; i <= block[1]; i++) arr.push(i);
  return arr;
};

// Paint call-site named parameters slate.
export const paintNamedParams = (code: Manticore): void => {
  for (let lineIdx = 0; lineIdx < code.lineCount; lineIdx++) {
    const line = code.getLine(lineIdx);
    if (!line) continue;
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
  }
};

// ── Stage factory ─────────────────────────────────────────────────────
export function createFiveFacesStage(view: View2D) {
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
  const baseX = createSignal(NAME_XS[0] - 760);   // off-screen left
  const baseY = NAMES_Y - 6;

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

  // ── Finale spotlights — one per name, stationary.
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
  const finaleMix  = createSignal(0);
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

  // PERMISSION's BIG bloom-and-migrate scale node
  const bigScale = createRef<Node>();
  const bigSafeLabel  = createRef<Txt>();
  const bigRiskyLabel = createRef<Txt>();
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
  const BOOL_NAMES = new Set([
    'overwrite', 'silent', 'soft', 'skipValidation', 'active',
  ]);
  const BOOL_LITERALS = new Set(['true', 'false', 'Boolean']);
  const BOOL_SIGNS    = new Set([':', '=', '!']);
  const isBoolToken   = (text: string): boolean =>
    BOOL_NAMES.has(text) || BOOL_LITERALS.has(text);

  const glowBooleanLines = (code: Manticore): void => {
    for (let lineIdx = 0; lineIdx < code.lineCount; lineIdx++) {
      const line = code.getLine(lineIdx);
      if (!line) continue;
      const toks = line.tokens;

      const glow = new Set<number>();
      for (let i = 0; i < toks.length; i++) {
        if (isBoolToken(toks[i].text.trim())) glow.add(i);
      }
      if (glow.size === 0) continue;

      for (let i = 0; i < toks.length; i++) {
        if (!glow.has(i)) continue;
        let p = i - 1;
        while (p >= 0 && toks[p].text.trim() === '') p--;
        if (p >= 0 && BOOL_SIGNS.has(toks[p].text.trim())) glow.add(p);
        let n = i + 1;
        while (n < toks.length && toks[n].text.trim() === '') n++;
        if (n < toks.length && BOOL_SIGNS.has(toks[n].text.trim())) glow.add(n);
      }

      for (const idx of glow) {
        const ref = toks[idx].ref();
        ref.shadowColor(ref.fill());
        ref.shadowBlur(16);
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

  // Complex save code — method-only view for PERMISSION trade-off section.
  const complexSaveCode = Manticore.create(COMPLEX_SAVE_METHOD, {
    x: 0,
    y: 115,
    width: 1400,
    height: 850,
    fontSize: 17,
    lineHeight: 23,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    // noClip: no clip rectangle → no hard bottom cut and no need for edge fades.
    // The method simply runs off the frame; it gets softened/blurred before the
    // verdict anyway.
    noClip: true,
    cardStyle: TRANSPARENT_CARD,
    glowAccent: false,
    customTypes: CUSTOM_TYPES,
    contentOffsetX: 200,
    contentOffsetY: 140,
  });
  complexSaveCode.mount(view);
  complexSaveCode.colorize(CODE_RULES);
  paintNamedParams(complexSaveCode);
  complexSaveCode.node.opacity(0);
  complexSaveCode.node.cache(true);
  complexSaveCode.node.cachePadding(20);

  {
    // TOP fade only (no bottom — the method just runs off the frame). noClip means
    // lines above the scroll window would otherwise show, so this band fully erases
    // from the screen top (-540) down past the window top, then feathers in by -250.
    complexSaveCode.node.add(new Rect({
      width: 1400,
      height: 290,
      y: -395, // band spans -540 → -250
      fill: new Gradient({
        type: 'linear',
        from: new Vector2(0, -145),
        to: new Vector2(0, 145),
        stops: [
          {offset: 0.0, color: 'white'},                  // screen top — fully erased
          {offset: 0.51, color: 'white'},                 // ~-391, overflow lines still erased
          {offset: 1.0, color: 'rgba(255,255,255,0)'},    // -250 — visible
        ],
      }),
      compositeOperation: 'destination-out',
    }));
  }

  // Split payoff — a SEPARATE, clip-free Manticore, screen-centered (noClip node
  // is center-anchored at y). No clip → no hard edge; no morph → no garble; the
  // giant cross-dissolves into this. cache(true) so the verdict can softly blur it.
  const splitSaveCode = Manticore.create(COMPLEX_SAVE_SPLIT, {
    x: 0,
    y: 0,
    width: 1400,
    fontSize: 17,
    lineHeight: 23,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    noClip: true,
    cardStyle: TRANSPARENT_CARD,
    glowAccent: false,
    customTypes: CUSTOM_TYPES,
    contentOffsetX: 200,
  });
  splitSaveCode.mount(view);
  splitSaveCode.colorize(CODE_RULES);
  paintNamedParams(splitSaveCode);
  splitSaveCode.node.opacity(0);
  splitSaveCode.node.cache(true);
  splitSaveCode.node.cachePadding(20);

  // Separate Manticores for the 3-method morph reveal.
  const writeMC = Manticore.create(IMPL_WRITE, {
    x: IMPL_X, y: 0, width: IMPL_W,
    fontSize: IMPL_FONT_SIZE, lineHeight: IMPL_LH,
    fontFamily: Fonts.code, theme: DryFiltersV3CodeTheme,
    noClip: true, cardStyle: TRANSPARENT_CARD,
    glowAccent: false, customTypes: CUSTOM_TYPES,
  });
  writeMC.mount(view);
  writeMC.colorize(CODE_RULES);
  paintNamedParams(writeMC);
  writeMC.node.opacity(0);

  const saveOrReplaceMC = Manticore.create(IMPL_SAVE_OR_REPLACE, {
    x: IMPL_X, y: 0, width: IMPL_W,
    fontSize: IMPL_FONT_SIZE, lineHeight: IMPL_LH,
    fontFamily: Fonts.code, theme: DryFiltersV3CodeTheme,
    noClip: true, cardStyle: TRANSPARENT_CARD,
    glowAccent: false, customTypes: CUSTOM_TYPES,
  });
  saveOrReplaceMC.mount(view);
  saveOrReplaceMC.colorize(CODE_RULES);
  paintNamedParams(saveOrReplaceMC);
  saveOrReplaceMC.node.opacity(0);

  // ── Blur signals ────────────────────────────────────────────────────
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

  // ── PERMISSION viz — FLAT: поток проходит гейт ──────────────────────
  const permissionViz    = createRef<Node>();
  const permRequest      = createRef<Circle>();
  const permRequestLabel = createRef<Txt>();
  const permBarrier      = createRef<Rect>();
  const permTarget       = createRef<Rect>();
  {
    const INK70 = 'rgba(244,241,235,0.70)';
    view.add(
      <Node ref={permissionViz} x={VIZ_X} y={VIZ_Y} opacity={0}>
        {vizScrim()}
        <Circle ref={permRequest} x={0} y={-140} width={64} height={64} fill={Canon.param} />
        <Txt ref={permRequestLabel} x={0} y={-92} text={'request'} fontFamily={Fonts.code} fontSize={18} letterSpacing={1} fill={INK70} />
        {/* гейт — закрыт по умолчанию (rose = флаг) */}
        <Rect ref={permBarrier} x={0} y={-6} width={190} height={10} radius={5} fill={Canon.methodDef} />
        {/* цель */}
        <Rect ref={permTarget} x={0} y={130} width={78} height={78} radius={8} fill={VIZ_DIM} />
        <Txt x={0} y={190} text={'save'} fontFamily={Fonts.code} fontSize={18} letterSpacing={1} fill={INK70} />
      </Node>,
    );
  }

  const vizBlur = createSignal(0);

  // ── MODE viz — FLAT: два круга, флип default→silent ─────────────────
  const modeViz       = createRef<Node>();
  const modeTopCircle = createRef<Circle>();
  const modeBotCircle = createRef<Circle>();
  const modeLoudTxt   = createRef<Txt>();
  const modeSilentTxt = createRef<Txt>();
  {
    const DIMTXT = 'rgba(244,241,235,0.42)';
    view.add(
      <Node ref={modeViz} x={VIZ_X} y={VIZ_Y} opacity={0}>
        {vizScrim()}
        {/* default — активен по умолчанию (blue) */}
        <Circle ref={modeTopCircle} x={-96} y={-16} width={84} height={84} fill={Canon.param} />
        <Txt ref={modeLoudTxt} x={-96} y={50} text={'default'} fontFamily={Fonts.code} fontSize={18} letterSpacing={1} fill={Canon.param} />
        {/* silent — выключен */}
        <Circle ref={modeBotCircle} x={96} y={-16} width={84} height={84} fill={VIZ_DIM} />
        <Txt ref={modeSilentTxt} x={96} y={50} text={'silent'} fontFamily={Fonts.code} fontSize={18} letterSpacing={1} fill={DIMTXT} />
      </Node>,
    );
  }

  // ── SHORTCUT viz — FLAT: пайплайн-бары, validate обходят ────────────
  const shortcutViz = createRef<Node>();
  const scCells: Rect[] = [];
  const scTexts: Txt[]  = [];
  {
    const BAR_W = 210, BAR_H = 44, GAP = 14;
    const barY = (i: number): number => (i - 1.5) * (BAR_H + GAP);   // -87,-29,29,87
    const LABELS = ['input', 'validate', 'process', 'finalize'];
    const FILL   = [Canon.param, Canon.methodDef, VIZ_DIM, Canon.constant];
    const TXTCOL = ['#0B0C10', '#0B0C10', '#F4F1EB', '#0B0C10'];
    view.add(
      <Node ref={shortcutViz} x={VIZ_X} y={VIZ_Y} opacity={0}>
        {vizScrim()}
        {LABELS.map((s, i) => (
          <Rect ref={makeRef(scCells, i)} x={0} y={barY(i)} width={BAR_W} height={BAR_H} radius={6} fill={FILL[i]} />
        ))}
        {LABELS.map((s, i) => (
          <Txt ref={makeRef(scTexts, i)} x={0} y={barY(i)} text={s} fontFamily={Fonts.code} fontSize={18} letterSpacing={1} fontWeight={600} fill={TXTCOL[i]} />
        ))}
      </Node>,
    );
  }

  // ── SAFETY viz — FLAT: строки-бары, Bob сохранён (тил) → стёрт ───────
  const safetyViz    = createRef<Node>();
  const safetyArgTxt = createRef<Txt>();
  const safetyValTxt = createRef<Txt>();
  const sBob         = createRef<Rect>();
  const sBobRow      = createRef<Node>();
  const sBobDate     = createRef<Txt>();
  {
    const BAR_W = 300, BAR_H = 44, GAP = 16;
    const rowY = (i: number): number => (i - 1) * (BAR_H + GAP);   // -60, 0, 60
    const NAME_X = -BAR_W / 2 + 18;
    const ST_X   = BAR_W / 2 - 18;
    const INK    = '#F4F1EB';
    const SUBTLE = 'rgba(244,241,235,0.50)';
    const row = (i: number, id: string, nm: string) => (
      <>
        <Rect x={0} y={rowY(i)} width={BAR_W} height={BAR_H} radius={6} fill={VIZ_DIM} />
        <Txt x={NAME_X} y={rowY(i)} offset={[-1, 0]} text={nm} fontFamily={Fonts.code} fontSize={19} fill={INK} />
        <Txt x={ST_X} y={rowY(i)} offset={[1, 0]} text={'—'} fontFamily={Fonts.code} fontSize={17} fill={SUBTLE} />
      </>
    );
    view.add(
      <Node ref={safetyViz} x={VIZ_X} y={VIZ_Y} opacity={0}>
        {vizScrim()}
        {row(0, '1', 'Alice')}
        {/* Bob — цель */}
        <Node ref={sBobRow}>
          <Rect ref={sBob} x={0} y={rowY(1)} width={BAR_W} height={BAR_H} radius={6} fill={VIZ_DIM} />
          <Txt x={NAME_X} y={rowY(1)} offset={[-1, 0]} text={'Bob'} fontFamily={Fonts.code} fontSize={19} fill={INK} />
          <Txt ref={sBobDate} x={ST_X} y={rowY(1)} offset={[1, 0]} text={'—'} fontFamily={Fonts.code} fontSize={17} fill={SUBTLE} />
        </Node>
        {row(2, '3', 'Carol')}
        {/* soft = true — центрировано под таблицей (x=0) */}
        <Layout layout direction={'row'} alignItems={'center'} gap={8} x={0} y={rowY(2) + 58}>
          <Txt ref={safetyArgTxt} text={'soft ='} fontFamily={Fonts.code} fontSize={21} letterSpacing={1} fill={Canon.param} />
          <Txt ref={safetyValTxt} text={'true'} fontFamily={Fonts.code} fontSize={21} letterSpacing={1} fill={Canon.param} />
        </Layout>
      </Node>,
    );
  }

  // ── POOR MODEL viz — FLAT: 6 состояний-квадратов (булев их не описывает) ──
  const poorViz = createRef<Node>();
  const poorNodes:  Rect[] = [];
  const poorLabels: Txt[]  = [];
  const poorLinks:  Line[] = [];   // FLAT — без связей
  {
    const POS: [number, number][] = [
      [-120, -64], [0, -64], [120, -64],   // draft, scheduled, running
      [-120, 60], [0, 60], [120, 60],       // paused, completed, archived
    ];
    const FILL = [VIZ_DIM, VIZ_DIM, Canon.param, VIZ_DIM, Canon.constant, VIZ_DIM];
    const SQ = 66;
    view.add(
      <Node ref={poorViz} x={VIZ_X} y={VIZ_Y} opacity={0}>
        {vizScrim()}
        {POS.map((p, i) => (
          <Rect ref={makeRef(poorNodes, i)} x={p[0]} y={p[1]} width={SQ} height={SQ} radius={8} fill={FILL[i]} opacity={0} />
        ))}
        {POS.map((p, i) => (
          <Txt ref={makeRef(poorLabels, i)} x={p[0]} y={p[1] + SQ / 2 + 17} text={poorStateLabels[i]} fontFamily={Fonts.code} fontSize={14} letterSpacing={1} fill={'rgba(244,241,235,0.6)'} opacity={0} />
        ))}
      </Node>,
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // Helper generators
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

  // Dim every line of `code` except the ones in `keepBright`.
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

  // Lift every line back to full opacity.
  function* restoreLines(code: Manticore, dur: number): ThreadGenerator {
    const anims: ThreadGenerator[] = [];
    for (let i = 0; i < code.lineCount; i++) {
      const line = code.getLine(i);
      if (line) anims.push(line.node.opacity(1, dur, easeInOutSine));
    }
    yield* all(...anims);
  }

  // ── Per-face viz drivers ────────────────────────────────────────────
  function* permissionDriver(): ThreadGenerator {
    yield* waitFor(0.3);
    yield* permRequestLabel().opacity(0, 0.25, easeInOutSine);
    yield* permRequest().position.y(-44, 0.5, easeInOutCubic);   // спускается к гейту
    yield* waitFor(0.6);
    // overwrite = true: гейт открывается
    yield* all(
      permBarrier().scale.x(0, 0.4, easeInOutCubic),
      permBarrier().opacity(0, 0.4),
    );
    yield* permRequest().position.y(130, 0.55, easeInOutCubic);   // проходит к цели
    yield* all(
      permTarget().fill('rgba(162,205,214,0.30)', 0.35, easeInOutSine),   // цель зажигается (тил)
      permRequest().opacity(0, 0.35, easeInOutSine),
    );
  }

  function* modeDriver(): ThreadGenerator {
    yield* waitFor(0.4);
    // флип default→silent: активный круг всегда blue
    yield* all(
      modeTopCircle().fill(VIZ_DIM, 0.5, easeInOutSine),
      modeBotCircle().fill(Canon.param, 0.5, easeInOutSine),
      modeLoudTxt().fill('rgba(244,241,235,0.42)', 0.5, easeInOutSine),
      modeSilentTxt().fill(Canon.param, 0.5, easeInOutSine),
    );
  }

  function* shortcutDriver(): ThreadGenerator {
    yield* waitFor(0.35);
    const COLLAPSE = 58;
    // validate обходят — уезжает вправо и гаснет
    yield* all(
      scCells[1].position.x(220, 0.45, easeInOutCubic),
      scCells[1].opacity(0, 0.45, easeInOutSine),
      scTexts[1].position.x(220, 0.45, easeInOutCubic),
      scTexts[1].opacity(0, 0.45, easeInOutSine),
    );
    // process, finalize схлопываются вверх
    yield* all(
      scCells[2].position.y(scCells[2].position.y() - COLLAPSE, 0.55, easeInOutCubic),
      scTexts[2].position.y(scTexts[2].position.y() - COLLAPSE, 0.55, easeInOutCubic),
      scCells[3].position.y(scCells[3].position.y() - COLLAPSE, 0.55, easeInOutCubic),
      scTexts[3].position.y(scTexts[3].position.y() - COLLAPSE, 0.55, easeInOutCubic),
    );
  }

  function* safetyDriver(): ThreadGenerator {
    yield* waitFor(0.35);
    // soft = true: Bob сохранён — бар тинтуется в тил, появляется дата
    yield* sBob().fill('rgba(162,205,214,0.22)', 0.35, easeInOutSine);
    yield* waitFor(0.25);
    yield* sBobDate().text('2026-05-16', 0.5);
    yield* sBobDate().fill(Canon.constant, 0.001);
    yield* waitFor(0.3);
    yield* sBobRow().opacity(0.5, 0.5, easeInOutSine);
    yield* waitFor(1.5);
    // flip на false: hard delete — строка стирается
    yield* all(
      safetyValTxt().text('false', 0.5),
      safetyValTxt().fill(METHOD_COLOR, 0.5, easeInOutSine),
    );
    yield* waitFor(0.35);
    yield* sBobRow().opacity(0, 0.55, easeInOutSine);
  }

  function* poorDriver(): ThreadGenerator {
    yield* waitFor(0.25);
    // 6 состояний проявляются по очереди — булев их не описывает
    for (let i = 0; i < poorNodes.length; i++) {
      yield* all(
        poorNodes[i].opacity(1, 0.24, easeInOutSine),
        poorLabels[i].opacity(1, 0.24, easeInOutSine),
      );
      yield* waitFor(0.05);
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

  // Per-face beat — same shape for every face.
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
    yield* waitFor(1.2);
    yield* hideViz(i, 0.5);
    yield* waitFor(vizHold - 1.7);
    yield* showSmallScale(i);
    yield* waitFor(closeHold);
    yield* all(
      hideCallCode(i, 0.5),
      hideImplCode(i, 0.5),
      hideSmallScale(i, 0.4),
    );
  }

  // ── Return all refs, signals, and generators ────────────────────────
  return {
    // Refs
    bgCover,
    mainSpot,
    finaleSpots,
    nameRefs,
    smallScaleNodes,
    bigScale,
    bigSafeLabel,
    bigRiskyLabel,
    callCodes,
    implCodes,
    complexSaveCode,
    splitSaveCode,
    writeMC,
    saveOrReplaceMC,
    permissionViz,
    permRequest,
    permRequestLabel,
    permBarrier,
    permTarget,
    modeViz,
    modeTopCircle,
    modeBotCircle,
    modeLoudTxt,
    modeSilentTxt,
    shortcutViz,
    scCells,
    scTexts,
    safetyViz,
    safetyArgTxt,
    safetyValTxt,
    sBob,
    sBobRow,
    sBobDate,
    poorViz,
    poorNodes,
    poorLabels,
    poorLinks,
    vizRefs,

    // Signals
    baseX,
    baseY,
    arrivalTime,
    finaleMix,
    sceneAlpha,
    callBlurs,
    implBlurs,
    vizBlur,

    // Computed
    lightX,
    lightY,
    brightnessAt,

    // Generators
    showCallCode,
    hideCallCode,
    showImplCode,
    hideImplCode,
    showSmallScale,
    hideSmallScale,
    spotlightLines,
    restoreLines,
    showViz,
    hideViz,
    runFace,
    permissionDriver,
    modeDriver,
    safetyDriver,
    shortcutDriver,
    poorDriver,
    vizDrivers,

    // Utilities available inside timeline
    glowBooleanLines,
  };
}
