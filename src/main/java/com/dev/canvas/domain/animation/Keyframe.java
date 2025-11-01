package com.dev.canvas.domain.animation;

import java.util.Objects;

public final class Keyframe {

    private final int timeMillis;
    private final double value;
    private final EasingFunction easing;

    private Keyframe(Builder builder) {
        this.timeMillis = builder.timeMillis;
        this.value = builder.value;
        this.easing = builder.easing;
    }

    public static Builder builder() {
        return new Builder();
    }

    public int getTimeMillis() {
        return timeMillis;
    }

    public double getValue() {
        return value;
    }

    public EasingFunction getEasing() {
        return easing;
    }

    public static final class Builder {

        private int timeMillis;
        private double value;
        private EasingFunction easing;

        public Builder timeMillis(int value) {
            this.timeMillis = value;
            return this;
        }

        public Builder value(double value) {
            this.value = value;
            return this;
        }

        public Builder easing(EasingFunction value) {
            this.easing = Objects.requireNonNull(value);
            return this;
        }

        public Keyframe build() {
            Objects.requireNonNull(easing);
            return new Keyframe(this);
        }
    }
}
