package com.dev.canvas.application.dto;

import java.math.BigDecimal;
import java.util.List;

public record SceneResponse(String sceneId, String name, BigDecimal durationSeconds, List<ElementResponse> elements) {
}

