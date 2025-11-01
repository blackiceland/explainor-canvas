package com.dev.canvas.domain.animation;

public enum PropertyPath {

    POSITION_X("positionX"),
    POSITION_Y("positionY"),
    OPACITY("opacity"),
    SCALE_X("scaleX"),
    SCALE_Y("scaleY"),
    ROTATION("rotation"),
    END("end");

    private final String value;

    PropertyPath(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static PropertyPath fromValue(String value) {
        for (PropertyPath path : values()) {
            if (path.value.equals(value)) {
                return path;
            }
        }
        throw new IllegalArgumentException("Unknown property path: " + value);
    }
}

