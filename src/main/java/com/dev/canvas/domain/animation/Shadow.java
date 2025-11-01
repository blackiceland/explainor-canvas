package com.dev.canvas.domain.animation;

import java.util.Objects;

public final class Shadow {

    private final int blur;
    private final int offsetX;
    private final int offsetY;
    private final String color;

    private Shadow(Builder builder) {
        this.blur = builder.blur;
        this.offsetX = builder.offsetX;
        this.offsetY = builder.offsetY;
        this.color = builder.color;
    }

    public static Builder builder() {
        return new Builder();
    }

    public int getBlur() {
        return blur;
    }

    public int getOffsetX() {
        return offsetX;
    }

    public int getOffsetY() {
        return offsetY;
    }

    public String getColor() {
        return color;
    }

    public static final class Builder {

        private int blur;
        private int offsetX;
        private int offsetY;
        private String color;

        public Builder blur(int value) {
            this.blur = value;
            return this;
        }

        public Builder offsetX(int value) {
            this.offsetX = value;
            return this;
        }

        public Builder offsetY(int value) {
            this.offsetY = value;
            return this;
        }

        public Builder color(String value) {
            this.color = Objects.requireNonNull(value);
            return this;
        }

        public Shadow build() {
            Objects.requireNonNull(color);
            return new Shadow(this);
        }
    }
}

