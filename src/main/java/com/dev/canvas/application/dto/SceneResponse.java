package com.dev.canvas.application.dto;

import java.util.List;

public record SceneResponse(String sceneId, String name, String schemaVersion, int durationMillis, String background, List<ElementResponse> elements) {
}
