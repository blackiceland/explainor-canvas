package com.dev.canvas.domain.animation;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

public final class AnimationScene {

    private final String sceneId;
    private final String name;
    private final SchemaVersion schemaVersion;
    private final int durationMillis;
    private final String background;
    private final List<SceneElement> elements;

    private AnimationScene(Builder builder) {
        this.sceneId = builder.sceneId;
        this.name = builder.name;
        this.schemaVersion = builder.schemaVersion;
        this.durationMillis = builder.durationMillis;
        this.background = builder.background;
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

    public SchemaVersion getSchemaVersion() {
        return schemaVersion;
    }

    public int getDurationMillis() {
        return durationMillis;
    }

    public String getBackground() {
        return background;
    }

    public List<SceneElement> getElements() {
        return Collections.unmodifiableList(elements);
    }

    public static final class Builder {

        private String sceneId;
        private String name;
        private SchemaVersion schemaVersion;
        private int durationMillis;
        private String background;
        private final List<SceneElement> elements;

        public Builder() {
            this.elements = new ArrayList<>();
            this.schemaVersion = SchemaVersion.current();
        }

        public Builder sceneId(String value) {
            this.sceneId = Objects.requireNonNull(value);
            return this;
        }

        public Builder name(String value) {
            this.name = Objects.requireNonNull(value);
            return this;
        }

        public Builder schemaVersion(SchemaVersion value) {
            this.schemaVersion = Objects.requireNonNull(value);
            return this;
        }

        public Builder durationMillis(int value) {
            this.durationMillis = value;
            return this;
        }

        public Builder background(String value) {
            this.background = value;
            return this;
        }

        public Builder addElement(SceneElement value) {
            this.elements.add(Objects.requireNonNull(value));
            return this;
        }

        public AnimationScene build() {
            Objects.requireNonNull(sceneId);
            Objects.requireNonNull(name);
            Objects.requireNonNull(schemaVersion);
            return new AnimationScene(this);
        }
    }
}
