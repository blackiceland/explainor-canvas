package com.dev.canvas.domain.animation;

import java.util.Objects;

public final class LineProperties implements PrimitiveProperties {

    private final int startX;
    private final int startY;
    private final int endX;
    private final int endY;
    private final Style style;

    private LineProperties(Builder builder) {
        this.startX = builder.startX;
        this.startY = builder.startY;
        this.endX = builder.endX;
        this.endY = builder.endY;
        this.style = builder.style;
    }

    public static Builder builder() {
        return new Builder();
    }

    @Override
    public PrimitiveType getType() {
        return PrimitiveType.LINE;
    }

    public int getStartX() {
        return startX;
    }

    public int getStartY() {
        return startY;
    }

    public int getEndX() {
        return endX;
    }

    public int getEndY() {
        return endY;
    }

    public Style getStyle() {
        return style;
    }

    public static final class Builder {

        private int startX;
        private int startY;
        private int endX;
        private int endY;
        private Style style;

        public Builder startX(int value) {
            this.startX = value;
            return this;
        }

        public Builder startY(int value) {
            this.startY = value;
            return this;
        }

        public Builder endX(int value) {
            this.endX = value;
            return this;
        }

        public Builder endY(int value) {
            this.endY = value;
            return this;
        }

        public Builder style(Style value) {
            this.style = Objects.requireNonNull(value);
            return this;
        }

        public LineProperties build() {
            Objects.requireNonNull(style);
            return new LineProperties(this);
        }
    }
}
