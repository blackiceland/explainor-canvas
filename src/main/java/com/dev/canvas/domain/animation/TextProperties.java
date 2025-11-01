package com.dev.canvas.domain.animation;

import java.util.Objects;

public final class TextProperties implements PrimitiveProperties {

    private final String text;
    private final int centerX;
    private final int centerY;
    private final int fontSize;
    private final String color;
    private final String fontWeight;

    private TextProperties(Builder builder) {
        this.text = builder.text;
        this.centerX = builder.centerX;
        this.centerY = builder.centerY;
        this.fontSize = builder.fontSize;
        this.color = builder.color;
        this.fontWeight = builder.fontWeight;
    }

    public static Builder builder() {
        return new Builder();
    }

    @Override
    public PrimitiveType getType() {
        return PrimitiveType.TEXT;
    }

    public String getText() {
        return text;
    }

    public int getCenterX() {
        return centerX;
    }

    public int getCenterY() {
        return centerY;
    }

    public int getFontSize() {
        return fontSize;
    }

    public String getColor() {
        return color;
    }

    public String getFontWeight() {
        return fontWeight;
    }

    public static final class Builder {

        private String text;
        private int centerX;
        private int centerY;
        private int fontSize;
        private String color;
        private String fontWeight;

        public Builder text(String value) {
            this.text = Objects.requireNonNull(value);
            return this;
        }

        public Builder centerX(int value) {
            this.centerX = value;
            return this;
        }

        public Builder centerY(int value) {
            this.centerY = value;
            return this;
        }

        public Builder fontSize(int value) {
            this.fontSize = value;
            return this;
        }

        public Builder color(String value) {
            this.color = Objects.requireNonNull(value);
            return this;
        }

        public Builder fontWeight(String value) {
            this.fontWeight = Objects.requireNonNull(value);
            return this;
        }

        public TextProperties build() {
            Objects.requireNonNull(text);
            Objects.requireNonNull(color);
            Objects.requireNonNull(fontWeight);
            return new TextProperties(this);
        }
    }
}
