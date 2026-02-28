import {MAX_LINE_CHARS} from './codeWithActionsSceneRu.config';
import {JavaClass, method, param} from '../core/code/model/JavaModel';

function f(code: string): string {
    const methods = parseRawMethods(code);
    return JavaClass.create(methods, MAX_LINE_CHARS).render();
}

function parseRawMethods(code: string): ReturnType<typeof method>[] {
    const results: ReturnType<typeof method>[] = [];
    const lines = code.split('\n');
    let i = 0;

    while (i < lines.length) {
        const sig = lines[i].match(/^(public|private)\s+(\S+)\s+(\w+)\s*\(([^)]*)\)\s*\{/);
        if (!sig) { i++; continue; }

        const [, access, returnType, name, paramStr] = sig;
        const params = paramStr.trim().length === 0
            ? []
            : paramStr.split(',').map(p => {
                const parts = p.trim().split(/\s+/);
                return param(parts.slice(0, -1).join(' '), parts[parts.length - 1]);
            });

        const body: string[] = [];
        i++;
        while (i < lines.length) {
            if (lines[i] === '}') break;
            body.push(lines[i].replace(/^    /, ''));
            i++;
        }
        i++;

        results.push(method(access, returnType, name, params, body));
        if (i < lines.length && lines[i].trim() === '') i++;
    }

    return results;
}

export const CODE_V0 = f(`public byte[] exportVideo(byte[] sourceFrames, String outputFormat) {
    validateInput(sourceFrames, outputFormat);
    byte[] encodedVideo = runEncoder(sourceFrames);

    return finalizeExport(encodedVideo, outputFormat);
}`);

export const CODE_V1a = f(`public byte[] exportVideo(byte[] sourceFrames, String outputFormat, String colorProfile) {
    validateInput(sourceFrames, outputFormat);
    byte[] encodedVideo = runEncoder(sourceFrames);

    return finalizeExport(encodedVideo, outputFormat);
}`);

export const CODE_V1b = f(`public byte[] exportVideo(byte[] sourceFrames, String outputFormat, String colorProfile) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile);
    byte[] encodedVideo = runEncoder(preparedFrames);

    return finalizeExport(encodedVideo, outputFormat);
}`);

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

export const CODE_V2a_prepare = f(`public byte[] exportVideo(byte[] sourceFrames, String outputFormat, String colorProfile, String subtitleTrack) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack);
    byte[] encodedVideo = runEncoder(preparedFrames);

    return finalizeExport(encodedVideo, outputFormat);
}

private byte[] prepareFrames(byte[] sourceFrames, String colorProfile, String subtitleTrack) {
    byte[] normalizedFrames = normalizeFrames(sourceFrames);
    return applyColorProfile(normalizedFrames, colorProfile);
}`);

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

export const CODE_V3d_sig = f(`public byte[] exportVideo(byte[] sourceFrames, String outputFormat, String colorProfile, String subtitleTrack, String watermarkMode, String audioProfile) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack, watermarkMode, audioProfile);

    return encodeWithRetry(preparedFrames, outputFormat, watermarkMode, audioProfile);
}

private byte[] prepareFrames(byte[] sourceFrames, String colorProfile, String subtitleTrack, String watermarkMode, String audioProfile) {
    byte[] normalizedFrames = normalizeFrames(sourceFrames);
    byte[] coloredFrames = applyColorProfile(normalizedFrames, colorProfile);
    byte[] subtitledFrames = overlaySubtitles(coloredFrames, subtitleTrack);

    return subtitledFrames;
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
