package com.dev.canvas.application.dto;

public record DominoPropertiesResponse(
    int x,
    int y,
    int z,
    int width,
    int height,
    int depth,
    double rotationX,
    StyleResponse style
) {
}


