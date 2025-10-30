package com.dev.canvas.domain.animation;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

public final class PropertyTween {

    private final String propertyName;
    private final List<Keyframe> keyframes;

    private PropertyTween(Builder builder) {
        this.propertyName = builder.propertyName;
        this.keyframes = List.copyOf(builder.keyframes);
    }

    public static Builder builder() {
        return new Builder();
    }

    public String getPropertyName() {
        return propertyName;
    }

    public List<Keyframe> getKeyframes() {
        return Collections.unmodifiableList(keyframes);
    }

    public static final class Builder {

        private String propertyName;
        private final List<Keyframe> keyframes;

        public Builder() {
            this.keyframes = new ArrayList<>();
        }

        public Builder propertyName(String value) {
            this.propertyName = Objects.requireNonNull(value);
            return this;
        }

        public Builder addKeyframe(Keyframe value) {
            this.keyframes.add(Objects.requireNonNull(value));
            return this;
        }

        public PropertyTween build() {
            Objects.requireNonNull(propertyName);
            return new PropertyTween(this);
        }
    }
}

