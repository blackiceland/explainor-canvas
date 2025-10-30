package com.dev.canvas.application.dto;

import java.util.List;

public record PropertyTweenResponse(String propertyName, List<KeyframeResponse> keyframes) {
}

