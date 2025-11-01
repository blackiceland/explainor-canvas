package com.dev.canvas.domain.animation;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Objects;

public final class SceneId {

    private final String value;

    private SceneId(String value) {
        this.value = Objects.requireNonNull(value);
    }

    public static SceneId of(String value) {
        return new SceneId(value);
    }

    public static SceneId generate(String sceneName) {
        return new SceneId(hash(sceneName));
    }

    public static SceneId generateForElement(String sceneName, String elementType, int index) {
        return new SceneId(hash(sceneName + "-" + elementType + "-" + index));
    }

    public String getValue() {
        return value;
    }

    private static String hash(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashBytes).substring(0, 32);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (!(obj instanceof SceneId other)) return false;
        return value.equals(other.value);
    }

    @Override
    public int hashCode() {
        return value.hashCode();
    }

    @Override
    public String toString() {
        return value;
    }
}

