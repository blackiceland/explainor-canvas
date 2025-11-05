package com.dev.canvas.domain.animation;

public sealed interface PrimitiveProperties 
    permits CircleProperties, RectProperties, LineProperties, TextProperties, DominoProperties {
    
    PrimitiveType getType();
}

