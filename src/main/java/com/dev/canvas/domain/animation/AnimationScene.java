package com.dev.canvas.domain.animation;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

public final class AnimationScene {

    private final String sceneId;
    private final String name;
    private final BigDecimal durationSeconds;
    private final List<SceneElement> elements;

    private AnimationScene(Builder builder) {
        this.sceneId = builder.sceneId;
        this.name = builder.name;
        this.durationSeconds = builder.durationSeconds;
        this.elements = List.copyOf(builder.elements);
    }

    public static Builder builder() {
        return new Builder();
    }

    public String getSceneId() {
        return sceneId;
    }

    public String getName() {
        return name;
    }

    public BigDecimal getDurationSeconds() {
        return durationSeconds;
    }

    public List<SceneElement> getElements() {
        return Collections.unmodifiableList(elements);
    }

    public static final class Builder {

        private String sceneId;
        private String name;
        private BigDecimal durationSeconds;
        private final List<SceneElement> elements;

        public Builder() {
            this.elements = new ArrayList<>();
        }

        public Builder sceneId(String value) {
            this.sceneId = Objects.requireNonNull(value);
            return this;
        }

        public Builder name(String value) {
            this.name = Objects.requireNonNull(value);
            return this;
        }

        public Builder durationSeconds(BigDecimal value) {
            this.durationSeconds = Objects.requireNonNull(value);
            return this;
        }

        public Builder addElement(SceneElement value) {
            this.elements.add(Objects.requireNonNull(value));
            return this;
        }

        public AnimationScene build() {
            Objects.requireNonNull(sceneId);
            Objects.requireNonNull(name);
            Objects.requireNonNull(durationSeconds);
            return new AnimationScene(this);
        }
    }
}

