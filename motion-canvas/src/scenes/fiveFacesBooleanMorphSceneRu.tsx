import {makeScene2D} from '@motion-canvas/2d';
import {
  all,
  easeInOutCubic,
  easeInOutSine,
  ThreadGenerator,
  waitFor,
} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// ── Palette ──────────────────────────────────────────────────────────
const VAR_LIGHT    = 'rgba(244,241,235,0.96)';
const TYPE_CLEAN   = 'rgba(220,215,255,0.80)';
const METHOD_COLOR = '#FF8CA3';
const FUN_BLUE     = '#A3CDFF';
const STRING_GREEN = '#86B07A';
const CONST_COLOR  = 'rgba(201,180,255,0.78)';
const PARAM_DARK   = '#7C9CBA';

// ── Layout ───────────────────────────────────────────────────────────
const CODE_FONT_SIZE = 19;
const CODE_LH        = 28;
const IMPL_FONT_SIZE = 19;
const IMPL_LH        = 28;
const CALL_W         = 820;
const IMPL_W         = 620;
const CALL_X         = -530;
const IMPL_X         = 220;
const TOP_Y          = -310;

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

// ── Code strings ─────────────────────────────────────────────────────
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

const IMPL_SAVE_CLEAN = `fun save(path: String, content: Bytes, contentType: String): StoredFile {
    if (storage.exists(path)) {
        throw FileAlreadyExists(path)
    }

    return write(path, content, contentType)
}`;

const IMPL_SAVE_OR_REPLACE = `fun saveOrReplace(path: String, content: Bytes, contentType: String): StoredFile {
    return write(path, content, contentType)
}`;

const IMPL_WRITE = `private fun write(path: String, content: Bytes, contentType: String): StoredFile {
    val key = storage.put(
        path = path,
        content = content,
        contentType = contentType,
    )

    return StoredFile(key)
}`;

const COMPLEX_SAVE_CODE = `class FileStorageService(
    private val storage: ObjectStorage,
    private val metadata: MetadataExtractor,
    private val validator: ContentValidator,
    private val antivirus: AntivirusScanner,
    private val quotas: QuotaService,
    private val rateLimiter: RateLimiter,
    private val locks: DistributedLockProvider,
    private val events: DomainEventPublisher,
    private val audit: AuditLog,
    private val thumbnails: ThumbnailGenerator,
    private val encryption: EncryptionService,
    private val cdn: CdnInvalidator,
    private val versions: VersionRepository,
    private val searchIndex: SearchIndex,
    private val subscriptions: FileSubscriptionRepository,
    private val notifications: NotificationService,
    private val backupStorage: BackupStorage,
    private val backupPolicy: BackupPolicy,
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

        rateLimiter.check(currentUserId(), "file.save")

        val lock = locks.tryAcquire("file:\${normalizedPath}", Duration.ofSeconds(5))
            ?: throw FileLockedException(normalizedPath)

        try {
            val existing = storage.find(normalizedPath)

            if (existing != null && !overwrite) {
                throw FileAlreadyExistsException(normalizedPath)
            }

            val version = if (existing != null) existing.version + 1 else 1

            val encryptionKey = encryption.generateKey()
            val encrypted = encryption.encrypt(content, encryptionKey)
            val checksum = computeChecksum(encrypted)
            val meta = metadata.extract(content, contentType)

            val parentDir = normalizedPath.substringBeforeLast('/')
            if (parentDir.isNotEmpty()) storage.ensureDirectory(parentDir)

            val storageKey = storage.put(
                path = normalizedPath, content = encrypted, contentType = contentType,
                metadata = mapOf(
                    "version" to version.toString(), "checksum" to checksum,
                    "original-size" to sizeBytes.toString(), "encryption-key-id" to encryptionKey.id,
                    "uploaded-at" to clock.instant().toString(), "uploaded-by" to currentUserId().value,
                ),
            )

            val thumbKeys = if (isImageType(contentType)) {
                THUMBNAIL_SIZES.map { size ->
                    val thumb = thumbnails.generate(content, size.width, size.height, "webp")
                    val thumbPath = thumbnailPath(normalizedPath, size.label)
                    storage.put(path = thumbPath, content = thumb, contentType = "image/webp")
                    size.label to thumbPath
                }.toMap()
            } else emptyMap()

            if (existing != null) {
                versions.archive(normalizedPath, existing.version, currentUserId())
            }

            searchIndex.index(StorageDocument(
                path = normalizedPath, contentType = contentType, sizeBytes = sizeBytes,
                version = version, dimensions = meta.dimensions,
                createdAt = existing?.createdAt ?: clock.instant(), updatedAt = clock.instant(),
                createdBy = existing?.createdBy ?: currentUserId(), updatedBy = currentUserId(),
            ))

            if (existing != null) {
                cdn.invalidate(normalizedPath)
                thumbKeys.values.forEach { cdn.invalidate(it) }
            }

            if (backupPolicy.requiresBackup(normalizedPath, contentType)) {
                backupStorage.replicate(
                    source = storageKey, destination = backupPolicy.targetBucket(normalizedPath),
                    encryption = BackupEncryption.AES256, retentionDays = backupPolicy.retention(contentType),
                )
            }

            val storedFile = StoredFile(
                key = storageKey, path = normalizedPath, contentType = contentType,
                sizeBytes = sizeBytes, version = version, checksum = checksum,
                thumbnails = thumbKeys, dimensions = meta.dimensions,
                createdAt = existing?.createdAt ?: clock.instant(), updatedAt = clock.instant(),
            )

            val action = if (existing != null) "file_overwritten" else "file_created"

            audit.record(currentUserId(), action, storageKey, mapOf(
                "path" to normalizedPath, "version" to version,
                "size" to sizeBytes, "contentType" to contentType,
            ))

            events.publish(FileStoredEvent(
                path = normalizedPath, key = storageKey, action = action,
                version = version, storedAt = clock.instant(), storedBy = currentUserId(),
            ))

            val watchers = subscriptions.findWatchers(normalizedPath)
            if (watchers.isNotEmpty()) {
                notifications.send(watchers, FileChangedNotification(
                    path = normalizedPath, action = action, changedBy = currentUserId(),
                    changedAt = clock.instant(), version = version,
                ))
            }

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

// ── Tokens ───────────────────────────────────────────────────────────
const CUSTOM_TYPES = [
  'Service', 'MonthlyReportPublisher', 'ReportRenderer', 'FileStorage', 'AuditLog',
  'YearMonth', 'UserId', 'StorageKey',
  'FileRef', 'ByteArray', 'Bytes', 'Boolean', 'StoredFile', 'FileAlreadyExists',
  'FileStorageService', 'ObjectStorage', 'MetadataExtractor', 'ContentValidator',
  'QuotaService', 'DistributedLockProvider', 'ThumbnailGenerator', 'EncryptionService',
  'CdnInvalidator', 'VersionRepository', 'SearchIndex', 'Duration',
  'FileTooLargeException', 'QuotaExceededException', 'FileLockedException',
  'FileAlreadyExistsException', 'StorageDocument', 'FileStoredEvent',
  'AntivirusScanner', 'RateLimiter', 'FileSubscriptionRepository', 'NotificationService',
  'BackupStorage', 'BackupPolicy', 'StorageMetrics', 'BackupEncryption',
  'MalwareDetectedException', 'FileChangedNotification',
  'DomainEventPublisher',
];

const METHOD_NAMES = [
  'publish', 'renderMonthlyReport', 'save', 'record',
  'exists', 'put', 'read', 'find', 'ensureDirectory',
  'generateKey', 'encrypt', 'extract', 'generate', 'archive', 'index',
  'invalidate', 'tryAcquire', 'release', 'recordUsage',
  'requireValidMimeType', 'requireSafeContent', 'currentUsage',
  'normalizePath', 'computeChecksum', 'isImageType', 'thumbnailPath',
  'currentUserId', 'tenantId', 'substringBeforeLast', 'isNotBlank',
  'isNotEmpty', 'toMap', 'ofSeconds', 'toLong', 'toString',
  'scan', 'check', 'replicate', 'requiresBackup', 'targetBucket',
  'retention', 'recordUpload', 'findWatchers', 'between',
  'write', 'saveOrReplace', 'mapOf', 'require',
];

const VAR_NAMES = [
  'fileStorage', 'renderer', 'auditLog', 'storage',
  'report', 'content', 'pdfBytes', 'savedFile', 'period', 'requestedBy',
  'key', 'path', 'id',
  'normalizedPath', 'sizeBytes', 'startTime', 'scanResult',
  'usage', 'lock', 'existing', 'version', 'encryptionKey',
  'encrypted', 'checksum', 'meta', 'parentDir', 'storageKey',
  'thumbKeys', 'thumb', 'thumbPath', 'storedFile', 'action', 'watchers',
  'validator', 'antivirus', 'quotas', 'rateLimiter', 'locks',
  'events', 'audit', 'thumbnails', 'encryption', 'cdn',
  'versions', 'searchIndex', 'subscriptions', 'notifications',
  'backupStorage', 'backupPolicy', 'metrics', 'clock', 'metadata',
];

const NAMED_PARAMS = [
  'path', 'content', 'contentType', 'overwrite',
  'actorId', 'action', 'resourceId',
];

const CODE_RULES: ColorRule[] = [
  {match: /^[a-z][a-zA-Z0-9_]*$/, color: VAR_LIGHT},
  {match: new RegExp('^(' + VAR_NAMES.join('|') + ')$'), color: VAR_LIGHT},
  {match: /^[A-Z][a-zA-Z0-9]*$/, color: TYPE_CLEAN, onlyTypes: ['type'] as const},
  {match: new RegExp('^(' + CUSTOM_TYPES.join('|') + ')$'), color: TYPE_CLEAN},
  {match: /^[a-z][a-zA-Z0-9_]*$/, color: METHOD_COLOR, onlyTypes: ['method'] as const},
  {match: new RegExp('^(' + METHOD_NAMES.join('|') + ')$'), color: METHOD_COLOR},
  {match: /^[A-Z][A-Z0-9_]+$/, color: CONST_COLOR},
  {match: /^(class|object|fun|val|var|private|public|internal|return|if|else|is|in|to|true|false|throw|null|@Service|require|try|finally)$/, color: FUN_BLUE},
  {match: /./, color: STRING_GREEN, onlyTypes: ['string'] as const},
];

// ── Scene ────────────────────────────────────────────────────────────
export default makeScene2D(function* (view) {
  applyBackground(view);

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

  const paintNamedParams = (code: Manticore): void => {
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

  const BOOL_NAMES = new Set(['overwrite']);
  const BOOL_LITERALS = new Set(['true', 'false', 'Boolean']);
  const BOOL_SIGNS = new Set([':', '=', '!']);
  const isBoolToken = (text: string): boolean =>
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

  // ── Setup Manticores ───────────────────────────────────────────────
  const mcOpts = (x: number, y: number, w: number, fs: number, lh: number) => ({
    x, y, width: w,
    fontSize: fs, lineHeight: lh,
    fontFamily: Fonts.code, theme: DryFiltersV3CodeTheme,
    noClip: true, cardStyle: TRANSPARENT_CARD,
    glowAccent: false, customTypes: CUSTOM_TYPES,
  });

  const callCode = Manticore.create(CALL_PERMISSION, mcOpts(CALL_X, yForCode(CALL_PERMISSION), CALL_W, CODE_FONT_SIZE, CODE_LH));
  callCode.mount(view);
  callCode.colorize(CODE_RULES);
  paintNamedParams(callCode);
  glowBooleanLines(callCode);

  const methodLine = findMethodLine(CALL_PERMISSION);
  const implLines = IMPL_PERMISSION.split('\n').length;
  const implY = TOP_Y + methodLine * CODE_LH + ((implLines - 1) * IMPL_LH) / 2;
  const implCode = Manticore.create(IMPL_PERMISSION, mcOpts(IMPL_X, implY, IMPL_W, IMPL_FONT_SIZE, IMPL_LH));
  implCode.mount(view);
  implCode.colorize(CODE_RULES);
  paintNamedParams(implCode);
  glowBooleanLines(implCode);

  const writeMC = Manticore.create(IMPL_WRITE, mcOpts(IMPL_X, 0, IMPL_W, IMPL_FONT_SIZE, IMPL_LH));
  writeMC.mount(view);
  writeMC.colorize(CODE_RULES);
  paintNamedParams(writeMC);
  writeMC.node.opacity(0);

  const saveOrReplaceMC = Manticore.create(IMPL_SAVE_OR_REPLACE, mcOpts(IMPL_X, 0, IMPL_W, IMPL_FONT_SIZE, IMPL_LH));
  saveOrReplaceMC.mount(view);
  saveOrReplaceMC.colorize(CODE_RULES);
  paintNamedParams(saveOrReplaceMC);
  saveOrReplaceMC.node.opacity(0);

  const complexSaveCode = Manticore.create(COMPLEX_SAVE_CODE, {
    x: 0, y: 115, width: 1000, height: 850,
    fontSize: 17, lineHeight: 23,
    fontFamily: Fonts.code, theme: DryFiltersV3CodeTheme,
    noClip: false, cardStyle: TRANSPARENT_CARD,
    glowAccent: false, customTypes: CUSTOM_TYPES,
  });
  complexSaveCode.mount(view);
  complexSaveCode.colorize(CODE_RULES);
  paintNamedParams(complexSaveCode);
  complexSaveCode.node.opacity(0);

  // ── Animation ──────────────────────────────────────────────────────
  yield* waitFor(1.0);

  // Step 1: highlight overwrite, then morph save (remove boolean).
  {
    const sigLine = implCode.getLine(1);
    const ifLine = implCode.getLine(2);
    if (sigLine) yield* sigLine.colorizeByRuleAnimated('overwrite', METHOD_COLOR, 0.4);
    if (ifLine) yield* ifLine.colorizeByRuleAnimated('overwrite', METHOD_COLOR, 0.4);
  }
  yield* waitFor(1.5);
  yield* implCode.morphTo(IMPL_SAVE_CLEAN, {
    removeDuration: 0.3,
    moveDuration: 0.4,
    charDelay: 0.015,
    flashRemovedColor: METHOD_COLOR,
    flashRemovedDuration: 0.2,
    addStyle: 'typewriter',
    scrollStrategy: 'block',
  });
  implCode.colorize(CODE_RULES);
  paintNamedParams(implCode);
  implCode.recenterContent();
  yield* waitFor(0.8);

  // Step 2: write appears — its bottom `}` aligns with publish's bottom `}`.
  const callLines = CALL_PERMISSION.split('\n').length;
  const callY = yForCode(CALL_PERMISSION);
  const publishBraceY = callY - ((callLines - 1) * CODE_LH) / 2 + 25 * CODE_LH;
  const writeLines = IMPL_WRITE.split('\n').length;
  const writeY = publishBraceY - ((writeLines - 1) * IMPL_LH) / 2;
  const sorLines = IMPL_SAVE_OR_REPLACE.split('\n').length;
  const gap = IMPL_LH;

  writeMC.node.position.y(writeY);
  yield* writeMC.node.opacity(1, 0.5, easeInOutSine);
  yield* waitFor(0.6);

  // Step 3: saveOrReplace inserts between save and write.
  const writeTop = writeY - ((writeLines - 1) * IMPL_LH) / 2;
  const sorY = writeTop - gap - ((sorLines - 1) * IMPL_LH) / 2;
  const sorTop = sorY - ((sorLines - 1) * IMPL_LH) / 2;
  const saveLines = IMPL_SAVE_CLEAN.split('\n').length;
  const saveTargetY = sorTop - gap - ((saveLines - 1) * IMPL_LH) / 2;
  saveOrReplaceMC.node.position.y(sorY);
  yield* all(
    saveOrReplaceMC.node.opacity(1, 0.5, easeInOutSine),
    implCode.node.position.y(saveTargetY, 0.5, easeInOutCubic),
  );
  yield* waitFor(3.0);

  // ── COMPLEX SAVE — trade-off reveal ────────────────────────────────
  yield* all(
    callCode.node.opacity(0, 0.55, easeInOutSine),
    implCode.node.opacity(0, 0.55, easeInOutSine),
    writeMC.node.opacity(0, 0.55, easeInOutSine),
    saveOrReplaceMC.node.opacity(0, 0.55, easeInOutSine),
  );
  yield* complexSaveCode.node.opacity(1, 0.6, easeInOutSine);
  yield* waitFor(1.0);
  yield* complexSaveCode.scrollTo(56, 5, easeInOutSine);
  yield* waitFor(2.5);
  yield* complexSaveCode.scrollTo(140, 6, easeInOutSine);
  yield* waitFor(1.5);

  yield* complexSaveCode.node.opacity(0, 0.55, easeInOutSine);
});
