package com.dev.canvas.application.dto;

import com.dev.canvas.domain.animation.PrimitiveType;
import java.util.List;

public record ElementResponse(String elementId, PrimitiveType primitiveType, int startMillis, int durationMillis, CirclePropertiesResponse circle, RectPropertiesResponse rect, LinePropertiesResponse line, TextPropertiesResponse text, DominoPropertiesResponse domino, List<PropertyTweenResponse> tweens) {
}
