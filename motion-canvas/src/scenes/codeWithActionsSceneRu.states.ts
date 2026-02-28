export const CODE_V0 = `public byte[] exportVideo(byte[] sourceFrames, String outputFormat) {
    validateInput(sourceFrames, outputFormat);
    byte[] encodedVideo = runEncoder(sourceFrames);

    return finalizeExport(encodedVideo, outputFormat);
}`;

export const CODE_V1a = `public byte[] exportVideo(byte[] sourceFrames, String outputFormat,
        String colorProfile) {
    validateInput(sourceFrames, outputFormat);
    byte[] encodedVideo = runEncoder(sourceFrames);

    return finalizeExport(encodedVideo, outputFormat);
}`;

export const CODE_V1b = `public byte[] exportVideo(byte[] sourceFrames, String outputFormat,
        String colorProfile) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile);
    byte[] encodedVideo = runEncoder(preparedFrames);

    return finalizeExport(encodedVideo, outputFormat);
}`;

export const CODE_V1c = `public byte[] exportVideo(byte[] sourceFrames, String outputFormat,
        String colorProfile) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile);
    byte[] encodedVideo = runEncoder(preparedFrames);

    return finalizeExport(encodedVideo, outputFormat);
}

private byte[] prepareFrames(byte[] sourceFrames, String colorProfile) {
    byte[] normalizedFrames = normalizeFrames(sourceFrames);
    return applyColorProfile(normalizedFrames, colorProfile);
}`;

export const CODE_V2a_export = `public byte[] exportVideo(byte[] sourceFrames, String outputFormat,
        String colorProfile, String subtitleTrack) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack);
    byte[] encodedVideo = runEncoder(preparedFrames);

    return finalizeExport(encodedVideo, outputFormat);
}

private byte[] prepareFrames(byte[] sourceFrames, String colorProfile) {
    byte[] normalizedFrames = normalizeFrames(sourceFrames);
    return applyColorProfile(normalizedFrames, colorProfile);
}`;

export const CODE_V2a = `public byte[] exportVideo(byte[] sourceFrames, String outputFormat,
        String colorProfile, String subtitleTrack) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack);
    byte[] encodedVideo = runEncoder(preparedFrames);

    return finalizeExport(encodedVideo, outputFormat);
}

private byte[] prepareFrames(byte[] sourceFrames, String colorProfile,
    String subtitleTrack) {
    byte[] normalizedFrames = normalizeFrames(sourceFrames);
    byte[] coloredFrames = applyColorProfile(normalizedFrames, colorProfile);

    return overlaySubtitles(coloredFrames, subtitleTrack);
}`;

export const CODE_V2b = `public byte[] exportVideo(byte[] sourceFrames, String outputFormat,
        String colorProfile, String subtitleTrack) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack);

    return encodeWithRetry(preparedFrames, outputFormat);
}

private byte[] prepareFrames(byte[] sourceFrames, String colorProfile,
    String subtitleTrack) {
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
}`;

export const CODE_V3a = `public byte[] exportVideo(byte[] sourceFrames, String outputFormat,
        String colorProfile, String subtitleTrack, String watermarkMode) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack);

    return encodeWithRetry(preparedFrames, outputFormat);
}

private byte[] prepareFrames(byte[] sourceFrames, String colorProfile,
    String subtitleTrack) {
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
}`;

export const CODE_V3b = `public byte[] exportVideo(byte[] sourceFrames, String outputFormat,
        String colorProfile, String subtitleTrack, String watermarkMode, String audioProfile) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack);

    return encodeWithRetry(preparedFrames, outputFormat);
}

private byte[] prepareFrames(byte[] sourceFrames, String colorProfile,
    String subtitleTrack) {
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
}`;

export const CODE_V3c = `public byte[] exportVideo(byte[] sourceFrames, String outputFormat,
        String colorProfile, String subtitleTrack, String watermarkMode, String audioProfile) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile,
        subtitleTrack, watermarkMode, audioProfile);

    return encodeWithRetry(preparedFrames, outputFormat,
        watermarkMode, audioProfile);
}

private byte[] prepareFrames(byte[] sourceFrames, String colorProfile,
    String subtitleTrack) {
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
}`;

export const CODE_V3d = `public byte[] exportVideo(byte[] sourceFrames, String outputFormat,
        String colorProfile, String subtitleTrack, String watermarkMode, String audioProfile) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile,
        subtitleTrack, watermarkMode, audioProfile);

    return encodeWithRetry(preparedFrames, outputFormat,
        watermarkMode, audioProfile);
}

private byte[] prepareFrames(byte[] sourceFrames, String colorProfile,
    String subtitleTrack, String watermarkMode, String audioProfile) {
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
}`;

export const CODE_V3e = `public byte[] exportVideo(byte[] sourceFrames, String outputFormat,
        String colorProfile, String subtitleTrack, String watermarkMode, String audioProfile) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile,
        subtitleTrack, watermarkMode, audioProfile);

    return encodeWithRetry(preparedFrames, outputFormat,
        watermarkMode, audioProfile);
}

private byte[] prepareFrames(byte[] sourceFrames, String colorProfile,
    String subtitleTrack, String watermarkMode, String audioProfile) {
    byte[] normalizedFrames = normalizeFrames(sourceFrames);
    byte[] coloredFrames = applyColorProfile(normalizedFrames, colorProfile);
    byte[] subtitledFrames = overlaySubtitles(coloredFrames, subtitleTrack);
    byte[] watermarkedFrames = applyWatermark(subtitledFrames, watermarkMode);

    return normalizeAudio(watermarkedFrames, audioProfile);
}

private byte[] encodeWithRetry(byte[] preparedFrames, String outputFormat,
    String watermarkMode, String audioProfile) {
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
}`;

export const CODE_V3f = `public byte[] exportVideo(byte[] sourceFrames, String outputFormat,
        String colorProfile, String subtitleTrack, String watermarkMode, String audioProfile) {
    validateInput(sourceFrames, outputFormat);
    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile,
        subtitleTrack, watermarkMode, audioProfile);

    return encodeWithRetry(preparedFrames, outputFormat,
        watermarkMode, audioProfile);
}

private byte[] prepareFrames(byte[] sourceFrames, String colorProfile,
    String subtitleTrack, String watermarkMode, String audioProfile) {
    byte[] normalizedFrames = normalizeFrames(sourceFrames);
    byte[] coloredFrames = applyColorProfile(normalizedFrames, colorProfile);
    byte[] subtitledFrames = overlaySubtitles(coloredFrames, subtitleTrack);
    byte[] watermarkedFrames = applyWatermark(subtitledFrames, watermarkMode);

    return normalizeAudio(watermarkedFrames, audioProfile);
}

private byte[] encodeWithRetry(byte[] preparedFrames, String outputFormat,
    String watermarkMode, String audioProfile) {
    int attemptsLeft = this.maxAttempts;

    while (attemptsLeft-- > 0) {
        try {
            return encode(preparedFrames, outputFormat, watermarkMode, audioProfile);
        } catch (RuntimeException ex) { /* retry */ }
    }

    throw new IllegalStateException("Encoding failed");
}

private byte[] encode(byte[] preparedFrames, String outputFormat,
    String watermarkMode, String audioProfile) {
    byte[] encodedVideo = runEncoder(preparedFrames);

    return finalizeExport(encodedVideo, outputFormat, watermarkMode, audioProfile);
}

private byte[] finalizeExport(byte[] encodedVideo, String outputFormat,
    String watermarkMode, String audioProfile) {
    if (!isSupportedFormat(outputFormat)) {
        throw new IllegalArgumentException("Unsupported: " + outputFormat);
    }

    Container container = Muxer.mux(encodedVideo, outputFormat);
    container.applyWatermark(watermarkMode);
    container.normalizeAudio(audioProfile);

    return container;
}`;
