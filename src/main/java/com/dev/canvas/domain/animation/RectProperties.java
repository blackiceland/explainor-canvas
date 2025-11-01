package com.dev.canvas.domain.animation;

import java.util.Objects;

public final class RectProperties implements PrimitiveProperties {

    private final int centerX;
    private final int centerY;
    private final int width;
    private final int height;
    private final int radius;
    private final Style style;

    private RectProperties(Builder builder) {
        this.centerX = builder.centerX;
        this.centerY = builder.centerY;
        this.width = builder.width;
        this.height = builder.height;
        this.radius = builder.radius;
        this.style = builder.style;
    }

    public static Builder builder() {
        return new Builder();
    }

    @Override
    public PrimitiveType getType() {
        return PrimitiveType.RECT;
    }

    public int getCenterX() {
        return centerX;
    }

    public int getCenterY() {
        return centerY;
    }

    public int getWidth() {
        return width;
    }

    public int getHeight() {
        return height;
    }

    public int getRadius() {
        return radius;
    }

    public Style getStyle() {
        return style;
    }

    public static final class Builder {

        private int centerX;
        private int centerY;
        private int width;
        private int height;
        private int radius;
        private Style style;

        public Builder centerX(int value) {
            this.centerX = value;
            return this;
        }

        public Builder centerY(int value) {
            this.centerY = value;
            return this;
        }

        public Builder width(int value) {
            this.width = value;
            return this;
        }

        public Builder height(int value) {
            this.height = value;
            return this;
        }

        public Builder radius(int value) {
            this.radius = value;
            return this;
        }

        public Builder style(Style value) {
            this.style = Objects.requireNonNull(value);
            return this;
        }

        public RectProperties build() {
            Objects.requireNonNull(style);
            return new RectProperties(this);
        }
    }
}
