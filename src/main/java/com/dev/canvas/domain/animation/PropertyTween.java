package com.dev.canvas.domain.animation;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

public final class PropertyTween {

    private final PropertyPath propertyPath;
    private final List<Keyframe> keyframes;

    private PropertyTween(Builder builder) {
        this.propertyPath = builder.propertyPath;
        this.keyframes = List.copyOf(builder.keyframes);
    }

    public static Builder builder() {
        return new Builder();
    }

    public PropertyPath getPropertyPath() {
        return propertyPath;
    }

    public List<Keyframe> getKeyframes() {
        return Collections.unmodifiableList(keyframes);
    }

    public static final class Builder {

        private PropertyPath propertyPath;
        private final List<Keyframe> keyframes;

        public Builder() {
            this.keyframes = new ArrayList<>();
        }

        public Builder propertyPath(PropertyPath value) {
            this.propertyPath = Objects.requireNonNull(value);
            return this;
        }

        public Builder addKeyframe(Keyframe value) {
            this.keyframes.add(Objects.requireNonNull(value));
            return this;
        }

        public PropertyTween build() {
            Objects.requireNonNull(propertyPath);
            return new PropertyTween(this);
        }
    }
}
