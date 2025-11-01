package com.dev.canvas.domain.animation;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

public final class SceneElement {

    private final String elementId;
    private final int startMillis;
    private final int durationMillis;
    private final PrimitiveProperties properties;
    private final List<PropertyTween> tweens;

    private SceneElement(Builder builder) {
        this.elementId = builder.elementId;
        this.startMillis = builder.startMillis;
        this.durationMillis = builder.durationMillis;
        this.properties = builder.properties;
        this.tweens = List.copyOf(builder.tweens);
    }

    public static Builder builder() {
        return new Builder();
    }

    public String getElementId() {
        return elementId;
    }

    public int getStartMillis() {
        return startMillis;
    }

    public int getDurationMillis() {
        return durationMillis;
    }

    public PrimitiveProperties getProperties() {
        return properties;
    }

    public PrimitiveType getPrimitiveType() {
        return properties.getType();
    }

    public List<PropertyTween> getTweens() {
        return Collections.unmodifiableList(tweens);
    }

    public static final class Builder {

        private String elementId;
        private int startMillis;
        private int durationMillis;
        private PrimitiveProperties properties;
        private final List<PropertyTween> tweens;

        public Builder() {
            this.tweens = new ArrayList<>();
        }

        public Builder elementId(String value) {
            this.elementId = Objects.requireNonNull(value);
            return this;
        }

        public Builder startMillis(int value) {
            this.startMillis = value;
            return this;
        }

        public Builder durationMillis(int value) {
            this.durationMillis = value;
            return this;
        }

        public Builder properties(PrimitiveProperties value) {
            this.properties = Objects.requireNonNull(value);
            return this;
        }

        public Builder addTween(PropertyTween value) {
            this.tweens.add(Objects.requireNonNull(value));
            return this;
        }

        public SceneElement build() {
            Objects.requireNonNull(elementId);
            Objects.requireNonNull(properties);
            return new SceneElement(this);
        }
    }
}
