package com.dev.canvas.domain.animation;

import java.math.BigDecimal;
import java.util.Objects;

public final class CircleProperties {

    private final BigDecimal centerX;
    private final BigDecimal centerY;
    private final BigDecimal radius;
    private final String strokeColor;
    private final String fillColor;

    private CircleProperties(Builder builder) {
        this.centerX = builder.centerX;
        this.centerY = builder.centerY;
        this.radius = builder.radius;
        this.strokeColor = builder.strokeColor;
        this.fillColor = builder.fillColor;
    }

    public static Builder builder() {
        return new Builder();
    }

    public BigDecimal getCenterX() {
        return centerX;
    }

    public BigDecimal getCenterY() {
        return centerY;
    }

    public BigDecimal getRadius() {
        return radius;
    }

    public String getStrokeColor() {
        return strokeColor;
    }

    public String getFillColor() {
        return fillColor;
    }

    public static final class Builder {

        private BigDecimal centerX;
        private BigDecimal centerY;
        private BigDecimal radius;
        private String strokeColor;
        private String fillColor;

        public Builder centerX(BigDecimal value) {
            this.centerX = Objects.requireNonNull(value);
            return this;
        }

        public Builder centerY(BigDecimal value) {
            this.centerY = Objects.requireNonNull(value);
            return this;
        }

        public Builder radius(BigDecimal value) {
            this.radius = Objects.requireNonNull(value);
            return this;
        }

        public Builder strokeColor(String value) {
            this.strokeColor = Objects.requireNonNull(value);
            return this;
        }

        public Builder fillColor(String value) {
            this.fillColor = Objects.requireNonNull(value);
            return this;
        }

        public CircleProperties build() {
            Objects.requireNonNull(centerX);
            Objects.requireNonNull(centerY);
            Objects.requireNonNull(radius);
            Objects.requireNonNull(strokeColor);
            Objects.requireNonNull(fillColor);
            return new CircleProperties(this);
        }
    }
}

