package com.dev.canvas.domain.animation;

import java.math.BigDecimal;
import java.util.Objects;

public final class Keyframe {

    private final BigDecimal timeSeconds;
    private final BigDecimal value;
    private final String easing;

    private Keyframe(Builder builder) {
        this.timeSeconds = builder.timeSeconds;
        this.value = builder.value;
        this.easing = builder.easing;
    }

    public static Builder builder() {
        return new Builder();
    }

    public BigDecimal getTimeSeconds() {
        return timeSeconds;
    }

    public BigDecimal getValue() {
        return value;
    }

    public String getEasing() {
        return easing;
    }

    public static final class Builder {

        private BigDecimal timeSeconds;
        private BigDecimal value;
        private String easing;

        public Builder timeSeconds(BigDecimal value) {
            this.timeSeconds = Objects.requireNonNull(value);
            return this;
        }

        public Builder value(BigDecimal newValue) {
            this.value = Objects.requireNonNull(newValue);
            return this;
        }

        public Builder easing(String value) {
            this.easing = Objects.requireNonNull(value);
            return this;
        }

        public Keyframe build() {
            Objects.requireNonNull(timeSeconds);
            Objects.requireNonNull(value);
            Objects.requireNonNull(easing);
            return new Keyframe(this);
        }
    }
}

