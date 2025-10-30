package com.dev.canvas.domain.animation;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

public final class SceneElement {

    private final String elementId;
    private final PrimitiveType primitiveType;
    private final BigDecimal startSeconds;
    private final BigDecimal durationSeconds;
    private final CircleProperties circleProperties;
    private final List<PropertyTween> tweens;

    private SceneElement(Builder builder) {
        this.elementId = builder.elementId;
        this.primitiveType = builder.primitiveType;
        this.startSeconds = builder.startSeconds;
        this.durationSeconds = builder.durationSeconds;
        this.circleProperties = builder.circleProperties;
        this.tweens = List.copyOf(builder.tweens);
    }

    public static Builder builder() {
        return new Builder();
    }

    public String getElementId() {
        return elementId;
    }

    public PrimitiveType getPrimitiveType() {
        return primitiveType;
    }

    public BigDecimal getStartSeconds() {
        return startSeconds;
    }

    public BigDecimal getDurationSeconds() {
        return durationSeconds;
    }

    public CircleProperties getCircleProperties() {
        return circleProperties;
    }

    public List<PropertyTween> getTweens() {
        return Collections.unmodifiableList(tweens);
    }

    public static final class Builder {

        private String elementId;
        private PrimitiveType primitiveType;
        private BigDecimal startSeconds;
        private BigDecimal durationSeconds;
        private CircleProperties circleProperties;
        private final List<PropertyTween> tweens;

        public Builder() {
            this.tweens = new ArrayList<>();
        }

        public Builder elementId(String value) {
            this.elementId = Objects.requireNonNull(value);
            return this;
        }

        public Builder primitiveType(PrimitiveType value) {
            this.primitiveType = Objects.requireNonNull(value);
            return this;
        }

        public Builder startSeconds(BigDecimal value) {
            this.startSeconds = Objects.requireNonNull(value);
            return this;
        }

        public Builder durationSeconds(BigDecimal value) {
            this.durationSeconds = Objects.requireNonNull(value);
            return this;
        }

        public Builder circleProperties(CircleProperties value) {
            this.circleProperties = Objects.requireNonNull(value);
            return this;
        }

        public Builder addTween(PropertyTween value) {
            this.tweens.add(Objects.requireNonNull(value));
            return this;
        }

        public SceneElement build() {
            Objects.requireNonNull(elementId);
            Objects.requireNonNull(primitiveType);
            Objects.requireNonNull(startSeconds);
            Objects.requireNonNull(durationSeconds);
            Objects.requireNonNull(circleProperties);
            return new SceneElement(this);
        }
    }
}

