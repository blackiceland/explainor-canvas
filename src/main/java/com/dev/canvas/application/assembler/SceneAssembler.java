package com.dev.canvas.application.assembler;

import com.dev.canvas.application.dto.CirclePropertiesResponse;
import com.dev.canvas.application.dto.ElementResponse;
import com.dev.canvas.application.dto.KeyframeResponse;
import com.dev.canvas.application.dto.PropertyTweenResponse;
import com.dev.canvas.application.dto.SceneResponse;
import com.dev.canvas.domain.animation.AnimationScene;
import com.dev.canvas.domain.animation.CircleProperties;
import com.dev.canvas.domain.animation.Keyframe;
import com.dev.canvas.domain.animation.PropertyTween;
import com.dev.canvas.domain.animation.SceneElement;
import java.util.List;
import java.util.stream.Collectors;

public final class SceneAssembler {

    public SceneResponse toResponse(AnimationScene scene) {
        List<ElementResponse> elements = scene.getElements().stream()
            .map(this::mapElement)
            .collect(Collectors.toList());
        return new SceneResponse(scene.getSceneId(), scene.getName(), scene.getDurationSeconds(), elements);
    }

    private ElementResponse mapElement(SceneElement element) {
        CirclePropertiesResponse circle = mapCircle(element.getCircleProperties());
        List<PropertyTweenResponse> tweens = element.getTweens().stream()
            .map(this::mapTween)
            .collect(Collectors.toList());
        return new ElementResponse(element.getElementId(), element.getPrimitiveType(), element.getStartSeconds(), element.getDurationSeconds(), circle, tweens);
    }

    private PropertyTweenResponse mapTween(PropertyTween tween) {
        List<KeyframeResponse> keyframes = tween.getKeyframes().stream()
            .map(this::mapKeyframe)
            .collect(Collectors.toList());
        return new PropertyTweenResponse(tween.getPropertyName(), keyframes);
    }

    private KeyframeResponse mapKeyframe(Keyframe keyframe) {
        return new KeyframeResponse(keyframe.getTimeSeconds(), keyframe.getValue(), keyframe.getEasing());
    }

    private CirclePropertiesResponse mapCircle(CircleProperties properties) {
        return new CirclePropertiesResponse(properties.getCenterX(), properties.getCenterY(), properties.getRadius(), properties.getStrokeColor(), properties.getFillColor());
    }
}

