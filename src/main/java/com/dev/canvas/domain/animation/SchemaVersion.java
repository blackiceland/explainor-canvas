package com.dev.canvas.domain.animation;

import java.util.Objects;

public final class SchemaVersion {

    private static final String CURRENT_VERSION = "1.0.0";

    private final String value;

    private SchemaVersion(String value) {
        this.value = Objects.requireNonNull(value);
    }

    public static SchemaVersion current() {
        return new SchemaVersion(CURRENT_VERSION);
    }

    public static SchemaVersion of(String value) {
        return new SchemaVersion(value);
    }

    public String getValue() {
        return value;
    }

    public boolean isCompatibleWith(SchemaVersion other) {
        String[] thisParts = value.split("\\.");
        String[] otherParts = other.value.split("\\.");
        return thisParts[0].equals(otherParts[0]);
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (!(obj instanceof SchemaVersion other)) return false;
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

