package com.dev.canvas.domain.animation;

public enum EasingFunction {

    LINEAR("linear"),
    EASE_IN("easeIn"),
    EASE_OUT("easeOut"),
    EASE_IN_OUT("easeInOut");

    private final String value;

    EasingFunction(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static EasingFunction fromValue(String value) {
        for (EasingFunction easing : values()) {
            if (easing.value.equals(value)) {
                return easing;
            }
        }
        return LINEAR;
    }
}

