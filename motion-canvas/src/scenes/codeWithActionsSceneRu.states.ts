import {MAX_LINE_CHARS} from './codeWithActionsSceneRu.config';

function wrapLine(line: string, maxChars: number): string[] {
    if (line.length <= maxChars) return [line];

    const indent = line.match(/^(\s*)/)?.[0] ?? '';
    const continuation = indent.length >= 8 ? indent : indent + '        ';
    const result: string[] = [];
    let current = line;

    while (current.length > maxChars) {
        let splitAt = -1;
        for (let i = maxChars - 1; i > indent.length; i--) {
            if (current[i] === ',' && i + 1 < current.length && current[i + 1] === ' ') {
                splitAt = i;
                break;
            }
        }
        if (splitAt < 0) break;

        result.push(current.slice(0, splitAt + 1));
        current = continuation + current.slice(splitAt + 2);
    }
    result.push(current);
    return result;
}

function f(code: string): string {
    return code.split('\n').flatMap(l => wrapLine(l, MAX_LINE_CHARS)).join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// V0: начальное состояние — два метода, минимальные параметры
// exportVideo sig = 1 line, prepareFrames отсутствует
// ─────────────────────────────────────────────────────────────────────────────

export const CODE_V0 = f(`public byte[] exportVideo(byte[] sourceFrames, String outputFormat) {
    validateInput(sourceFrames, outputFormat);
    byte[] encodedVideo = runEncoder(sourceFrames);

    return finalizeExport(encodedVideo, outputFormat);
}`);

// ─────────────────────────────────────────────────────────────────────────────
// V0 → V1a: exportVideo получает colorProfile (сигнатура растёт, тело не меняется)
// ─────────────────────────────────────────────────────────────────────────────

export const CODE_V1a = f(`public byte[] exportVideo(byte[] sourceFrames, String outputFormat, String colorProfile) {
    validateInput(sourceFrames, outputFormat);
    byte[] encodedVideo = runEncoder(sourceFrames);

    return finalizeExport(encodedVideo, outputFormat);
}`);

// ─────────────────────────────────────────────────────────────────────────────
// V1a → V1b: ТОЛЬКО тело exportVideo — добавляется prepareFrames вызов
// ─────────────────────────────────────────────────────────────────────────────

export const CODE_V1b = f(`public byte[] exportVideo(byte[] sourceFrames, String outputFormat, String colorProfile) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile);
    byte[] encodedVideo = runEncoder(preparedFrames);

    return finalizeExport(encodedVideo, outputFormat);
}`);

// ─────────────────────────────────────────────────────────────────────────────
// V1b → V1c: появляется метод prepareFrames (НОВЫЙ метод, exportVideo не меняется)
// ─────────────────────────────────────────────────────────────────────────────

export const CODE_V1c = f(`public byte[] exportVideo(byte[] sourceFrames, String outputFormat, String colorProfile) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile);
    byte[] encodedVideo = runEncoder(preparedFrames);

    return finalizeExport(encodedVideo, outputFormat);
}

private byte[] prepareFrames(byte[] sourceFrames, String colorProfile) {
    byte[] normalizedFrames = normalizeFrames(sourceFrames);
    return applyColorProfile(normalizedFrames, colorProfile);
}`);

// ─────────────────────────────────────────────────────────────────────────────
// V1c → V2a_export: ТОЛЬКО exportVideo — добавляется subtitleTrack в сигнатуру + вызов
// prepareFrames НЕ меняется (вызов с 3 args, сигнатура пока с 2 — намеренно)
// ─────────────────────────────────────────────────────────────────────────────

export const CODE_V2a_export = f(`public byte[] exportVideo(byte[] sourceFrames, String outputFormat, String colorProfile, String subtitleTrack) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack);
    byte[] encodedVideo = runEncoder(preparedFrames);

    return finalizeExport(encodedVideo, outputFormat);
}

private byte[] prepareFrames(byte[] sourceFrames, String colorProfile) {
    byte[] normalizedFrames = normalizeFrames(sourceFrames);
    return applyColorProfile(normalizedFrames, colorProfile);
}`);

// ─────────────────────────────────────────────────────────────────────────────
// V2a_export → V2a: ТОЛЬКО prepareFrames — принимает subtitleTrack, тело расширяется
// exportVideo НЕ меняется
// ─────────────────────────────────────────────────────────────────────────────

export const CODE_V2a = f(`public byte[] exportVideo(byte[] sourceFrames, String outputFormat, String colorProfile, String subtitleTrack) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack);
    byte[] encodedVideo = runEncoder(preparedFrames);

    return finalizeExport(encodedVideo, outputFormat);
}

private byte[] prepareFrames(byte[] sourceFrames, String colorProfile, String subtitleTrack) {
    byte[] normalizedFrames = normalizeFrames(sourceFrames);
    byte[] coloredFrames = applyColorProfile(normalizedFrames, colorProfile);

    return overlaySubtitles(coloredFrames, subtitleTrack);
}`);

// ─────────────────────────────────────────────────────────────────────────────
// V2a → V2b_export: ТОЛЬКО exportVideo — runEncoder заменяется на encodeWithRetry
// prepareFrames и ниже НЕ меняются
// ─────────────────────────────────────────────────────────────────────────────

export const CODE_V2b_export = f(`public byte[] exportVideo(byte[] sourceFrames, String outputFormat, String colorProfile, String subtitleTrack) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack);

    return encodeWithRetry(preparedFrames, outputFormat);
}

private byte[] prepareFrames(byte[] sourceFrames, String colorProfile, String subtitleTrack) {
    byte[] normalizedFrames = normalizeFrames(sourceFrames);
    byte[] coloredFrames = applyColorProfile(normalizedFrames, colorProfile);

    return overlaySubtitles(coloredFrames, subtitleTrack);
}`);

// ─────────────────────────────────────────────────────────────────────────────
// V2b_export → V2b: появляются encodeWithRetry + encode (НОВЫЕ методы)
// exportVideo и prepareFrames НЕ меняются
// ─────────────────────────────────────────────────────────────────────────────

export const CODE_V2b = f(`public byte[] exportVideo(byte[] sourceFrames, String outputFormat, String colorProfile, String subtitleTrack) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack);

    return encodeWithRetry(preparedFrames, outputFormat);
}

private byte[] prepareFrames(byte[] sourceFrames, String colorProfile, String subtitleTrack) {
    byte[] normalizedFrames = normalizeFrames(sourceFrames);
    byte[] coloredFrames = applyColorProfile(normalizedFrames, colorProfile);

    return overlaySubtitles(coloredFrames, subtitleTrack);
}

private byte[] encodeWithRetry(byte[] preparedFrames, String outputFormat) {
    int attemptsLeft = this.maxAttempts;

    while (attemptsLeft-- > 0) {
        try {
            return encode(preparedFrames, outputFormat);
        } catch (RuntimeException ex) { /* retry */ }
    }

    throw new IllegalStateException("Encoding failed");
}

private byte[] encode(byte[] preparedFrames, String outputFormat) {
    byte[] encodedVideo = runEncoder(preparedFrames);

    return finalizeExport(encodedVideo, outputFormat);
}`);

// ─────────────────────────────────────────────────────────────────────────────
// V2b → V3a: ТОЛЬКО exportVideo — добавляется watermarkMode
// ─────────────────────────────────────────────────────────────────────────────

export const CODE_V3a = f(`public byte[] exportVideo(byte[] sourceFrames, String outputFormat, String colorProfile, String subtitleTrack, String watermarkMode) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack);

    return encodeWithRetry(preparedFrames, outputFormat);
}

private byte[] prepareFrames(byte[] sourceFrames, String colorProfile, String subtitleTrack) {
    byte[] normalizedFrames = normalizeFrames(sourceFrames);
    byte[] coloredFrames = applyColorProfile(normalizedFrames, colorProfile);

    return overlaySubtitles(coloredFrames, subtitleTrack);
}

private byte[] encodeWithRetry(byte[] preparedFrames, String outputFormat) {
    int attemptsLeft = this.maxAttempts;

    while (attemptsLeft-- > 0) {
        try {
            return encode(preparedFrames, outputFormat);
        } catch (RuntimeException ex) { /* retry */ }
    }

    throw new IllegalStateException("Encoding failed");
}

private byte[] encode(byte[] preparedFrames, String outputFormat) {
    byte[] encodedVideo = runEncoder(preparedFrames);

    return finalizeExport(encodedVideo, outputFormat);
}`);

// ─────────────────────────────────────────────────────────────────────────────
// V3a → V3b: ТОЛЬКО exportVideo — добавляется audioProfile
// ─────────────────────────────────────────────────────────────────────────────

export const CODE_V3b = f(`public byte[] exportVideo(byte[] sourceFrames, String outputFormat, String colorProfile, String subtitleTrack, String watermarkMode, String audioProfile) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack);

    return encodeWithRetry(preparedFrames, outputFormat);
}

private byte[] prepareFrames(byte[] sourceFrames, String colorProfile, String subtitleTrack) {
    byte[] normalizedFrames = normalizeFrames(sourceFrames);
    byte[] coloredFrames = applyColorProfile(normalizedFrames, colorProfile);

    return overlaySubtitles(coloredFrames, subtitleTrack);
}

private byte[] encodeWithRetry(byte[] preparedFrames, String outputFormat) {
    int attemptsLeft = this.maxAttempts;

    while (attemptsLeft-- > 0) {
        try {
            return encode(preparedFrames, outputFormat);
        } catch (RuntimeException ex) { /* retry */ }
    }

    throw new IllegalStateException("Encoding failed");
}

private byte[] encode(byte[] preparedFrames, String outputFormat) {
    byte[] encodedVideo = runEncoder(preparedFrames);

    return finalizeExport(encodedVideo, outputFormat);
}`);

// ─────────────────────────────────────────────────────────────────────────────
// V3b → V3c: ТОЛЬКО exportVideo тело — вызовы получают доп. аргументы
// ─────────────────────────────────────────────────────────────────────────────

export const CODE_V3c = f(`public byte[] exportVideo(byte[] sourceFrames, String outputFormat, String colorProfile, String subtitleTrack, String watermarkMode, String audioProfile) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack, watermarkMode, audioProfile);

    return encodeWithRetry(preparedFrames, outputFormat, watermarkMode, audioProfile);
}

private byte[] prepareFrames(byte[] sourceFrames, String colorProfile, String subtitleTrack) {
    byte[] normalizedFrames = normalizeFrames(sourceFrames);
    byte[] coloredFrames = applyColorProfile(normalizedFrames, colorProfile);

    return overlaySubtitles(coloredFrames, subtitleTrack);
}

private byte[] encodeWithRetry(byte[] preparedFrames, String outputFormat) {
    int attemptsLeft = this.maxAttempts;

    while (attemptsLeft-- > 0) {
        try {
            return encode(preparedFrames, outputFormat);
        } catch (RuntimeException ex) { /* retry */ }
    }

    throw new IllegalStateException("Encoding failed");
}

private byte[] encode(byte[] preparedFrames, String outputFormat) {
    byte[] encodedVideo = runEncoder(preparedFrames);

    return finalizeExport(encodedVideo, outputFormat);
}`);

// ─────────────────────────────────────────────────────────────────────────────
// V3c → V3d: ТОЛЬКО prepareFrames — сигнатура + тело расширяются
// ─────────────────────────────────────────────────────────────────────────────

export const CODE_V3d = f(`public byte[] exportVideo(byte[] sourceFrames, String outputFormat, String colorProfile, String subtitleTrack, String watermarkMode, String audioProfile) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack, watermarkMode, audioProfile);

    return encodeWithRetry(preparedFrames, outputFormat, watermarkMode, audioProfile);
}

private byte[] prepareFrames(byte[] sourceFrames, String colorProfile, String subtitleTrack, String watermarkMode, String audioProfile) {
    byte[] normalizedFrames = normalizeFrames(sourceFrames);
    byte[] coloredFrames = applyColorProfile(normalizedFrames, colorProfile);
    byte[] subtitledFrames = overlaySubtitles(coloredFrames, subtitleTrack);
    byte[] watermarkedFrames = applyWatermark(subtitledFrames, watermarkMode);

    return normalizeAudio(watermarkedFrames, audioProfile);
}

private byte[] encodeWithRetry(byte[] preparedFrames, String outputFormat) {
    int attemptsLeft = this.maxAttempts;

    while (attemptsLeft-- > 0) {
        try {
            return encode(preparedFrames, outputFormat);
        } catch (RuntimeException ex) { /* retry */ }
    }

    throw new IllegalStateException("Encoding failed");
}

private byte[] encode(byte[] preparedFrames, String outputFormat) {
    byte[] encodedVideo = runEncoder(preparedFrames);

    return finalizeExport(encodedVideo, outputFormat);
}`);

// ─────────────────────────────────────────────────────────────────────────────
// V3d → V3e: ТОЛЬКО encodeWithRetry — сигнатура + вызов encode расширяются
// ─────────────────────────────────────────────────────────────────────────────

export const CODE_V3e = f(`public byte[] exportVideo(byte[] sourceFrames, String outputFormat, String colorProfile, String subtitleTrack, String watermarkMode, String audioProfile) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack, watermarkMode, audioProfile);

    return encodeWithRetry(preparedFrames, outputFormat, watermarkMode, audioProfile);
}

private byte[] prepareFrames(byte[] sourceFrames, String colorProfile, String subtitleTrack, String watermarkMode, String audioProfile) {
    byte[] normalizedFrames = normalizeFrames(sourceFrames);
    byte[] coloredFrames = applyColorProfile(normalizedFrames, colorProfile);
    byte[] subtitledFrames = overlaySubtitles(coloredFrames, subtitleTrack);
    byte[] watermarkedFrames = applyWatermark(subtitledFrames, watermarkMode);

    return normalizeAudio(watermarkedFrames, audioProfile);
}

private byte[] encodeWithRetry(byte[] preparedFrames, String outputFormat, String watermarkMode, String audioProfile) {
    int attemptsLeft = this.maxAttempts;

    while (attemptsLeft-- > 0) {
        try {
            return encode(preparedFrames, outputFormat, watermarkMode, audioProfile);
        } catch (RuntimeException ex) { /* retry */ }
    }

    throw new IllegalStateException("Encoding failed");
}

private byte[] encode(byte[] preparedFrames, String outputFormat) {
    byte[] encodedVideo = runEncoder(preparedFrames);

    return finalizeExport(encodedVideo, outputFormat);
}`);

// ─────────────────────────────────────────────────────────────────────────────
// V3e → V3f_encode: ТОЛЬКО encode — сигнатура + вызов finalizeExport расширяются
// ─────────────────────────────────────────────────────────────────────────────

export const CODE_V3f_encode = f(`public byte[] exportVideo(byte[] sourceFrames, String outputFormat, String colorProfile, String subtitleTrack, String watermarkMode, String audioProfile) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack, watermarkMode, audioProfile);

    return encodeWithRetry(preparedFrames, outputFormat, watermarkMode, audioProfile);
}

private byte[] prepareFrames(byte[] sourceFrames, String colorProfile, String subtitleTrack, String watermarkMode, String audioProfile) {
    byte[] normalizedFrames = normalizeFrames(sourceFrames);
    byte[] coloredFrames = applyColorProfile(normalizedFrames, colorProfile);
    byte[] subtitledFrames = overlaySubtitles(coloredFrames, subtitleTrack);
    byte[] watermarkedFrames = applyWatermark(subtitledFrames, watermarkMode);

    return normalizeAudio(watermarkedFrames, audioProfile);
}

private byte[] encodeWithRetry(byte[] preparedFrames, String outputFormat, String watermarkMode, String audioProfile) {
    int attemptsLeft = this.maxAttempts;

    while (attemptsLeft-- > 0) {
        try {
            return encode(preparedFrames, outputFormat, watermarkMode, audioProfile);
        } catch (RuntimeException ex) { /* retry */ }
    }

    throw new IllegalStateException("Encoding failed");
}

private byte[] encode(byte[] preparedFrames, String outputFormat, String watermarkMode, String audioProfile) {
    byte[] encodedVideo = runEncoder(preparedFrames);

    return finalizeExport(encodedVideo, outputFormat, watermarkMode, audioProfile);
}`);

// ─────────────────────────────────────────────────────────────────────────────
// V3f_encode → V3f: появляется finalizeExport (НОВЫЙ метод)
// ─────────────────────────────────────────────────────────────────────────────

export const CODE_V3f = f(`public byte[] exportVideo(byte[] sourceFrames, String outputFormat, String colorProfile, String subtitleTrack, String watermarkMode, String audioProfile) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack, watermarkMode, audioProfile);

    return encodeWithRetry(preparedFrames, outputFormat, watermarkMode, audioProfile);
}

private byte[] prepareFrames(byte[] sourceFrames, String colorProfile, String subtitleTrack, String watermarkMode, String audioProfile) {
    byte[] normalizedFrames = normalizeFrames(sourceFrames);
    byte[] coloredFrames = applyColorProfile(normalizedFrames, colorProfile);
    byte[] subtitledFrames = overlaySubtitles(coloredFrames, subtitleTrack);
    byte[] watermarkedFrames = applyWatermark(subtitledFrames, watermarkMode);

    return normalizeAudio(watermarkedFrames, audioProfile);
}

private byte[] encodeWithRetry(byte[] preparedFrames, String outputFormat, String watermarkMode, String audioProfile) {
    int attemptsLeft = this.maxAttempts;

    while (attemptsLeft-- > 0) {
        try {
            return encode(preparedFrames, outputFormat, watermarkMode, audioProfile);
        } catch (RuntimeException ex) { /* retry */ }
    }

    throw new IllegalStateException("Encoding failed");
}

private byte[] encode(byte[] preparedFrames, String outputFormat, String watermarkMode, String audioProfile) {
    byte[] encodedVideo = runEncoder(preparedFrames);

    return finalizeExport(encodedVideo, outputFormat, watermarkMode, audioProfile);
}

private byte[] finalizeExport(byte[] encodedVideo, String outputFormat, String watermarkMode, String audioProfile) {
    if (!isSupportedFormat(outputFormat)) {
        throw new IllegalArgumentException("Unsupported: " + outputFormat);
    }

    Container container = Muxer.mux(encodedVideo, outputFormat);
    container.applyWatermark(watermarkMode);
    container.normalizeAudio(audioProfile);

    return container;
}`);
