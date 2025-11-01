package com.dev.canvas.domain.animation;

import java.util.Optional;

public final class Style {

    private final String fillColor;
    private final String strokeColor;
    private final int lineWidth;
    private final Shadow shadow;

    private Style(Builder builder) {
        this.fillColor = builder.fillColor;
        this.strokeColor = builder.strokeColor;
        this.lineWidth = builder.lineWidth;
        this.shadow = builder.shadow;
    }

    public static Builder builder() {
        return new Builder();
    }

    public String getFillColor() {
        return fillColor;
    }

    public String getStrokeColor() {
        return strokeColor;
    }

    public int getLineWidth() {
        return lineWidth;
    }

    public Optional<Shadow> getShadow() {
        return Optional.ofNullable(shadow);
    }

    public static final class Builder {

        private String fillColor;
        private String strokeColor;
        private int lineWidth;
        private Shadow shadow;

        public Builder fillColor(String value) {
            this.fillColor = value;
            return this;
        }

        public Builder strokeColor(String value) {
            this.strokeColor = value;
            return this;
        }

        public Builder lineWidth(int value) {
            this.lineWidth = value;
            return this;
        }

        public Builder shadow(Shadow value) {
            this.shadow = value;
            return this;
        }

        public Style build() {
            return new Style(this);
        }
    }
}

