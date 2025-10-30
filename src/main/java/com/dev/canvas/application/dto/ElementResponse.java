package com.dev.canvas.application.dto;

import com.dev.canvas.domain.animation.PrimitiveType;
import java.math.BigDecimal;
import java.util.List;

public record ElementResponse(String elementId, PrimitiveType primitiveType, BigDecimal startSeconds, BigDecimal durationSeconds, CirclePropertiesResponse circle, List<PropertyTweenResponse> tweens) {
}

