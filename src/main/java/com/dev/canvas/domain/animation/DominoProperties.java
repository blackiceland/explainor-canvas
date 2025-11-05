package com.dev.canvas.domain.animation;

public record DominoProperties(
    int x,
    int y,
    int z,
    int width,
    int height,
    int depth,
    double rotationX,
    Style style
) implements PrimitiveProperties {

    public static Builder builder() {
        return new Builder();
    }

    @Override
    public PrimitiveType getType() {
        return PrimitiveType.DOMINO;
    }

    public static class Builder {
        private int x;
        private int y;
        private int z;
        private int width;
        private int height;
        private int depth;
        private double rotationX;
        private Style style;

        public Builder x(int x) {
            this.x = x;
            return this;
        }

        public Builder y(int y) {
            this.y = y;
            return this;
        }

        public Builder z(int z) {
            this.z = z;
            return this;
        }

        public Builder width(int width) {
            this.width = width;
            return this;
        }

        public Builder height(int height) {
            this.height = height;
            return this;
        }

        public Builder depth(int depth) {
            this.depth = depth;
            return this;
        }

        public Builder rotationX(double rotationX) {
            this.rotationX = rotationX;
            return this;
        }

        public Builder style(Style style) {
            this.style = style;
            return this;
        }

        public DominoProperties build() {
            return new DominoProperties(x, y, z, width, height, depth, rotationX, style);
        }
    }
}

