package com.dev.canvas.application.assembler;

import com.dev.canvas.application.dto.CirclePropertiesResponse;
import com.dev.canvas.application.dto.ElementResponse;
import com.dev.canvas.application.dto.KeyframeResponse;
import com.dev.canvas.application.dto.LinePropertiesResponse;
import com.dev.canvas.application.dto.PropertyTweenResponse;
import com.dev.canvas.application.dto.RectPropertiesResponse;
import com.dev.canvas.application.dto.SceneResponse;
import com.dev.canvas.application.dto.ShadowResponse;
import com.dev.canvas.application.dto.StyleResponse;
import com.dev.canvas.application.dto.TextPropertiesResponse;
import com.dev.canvas.domain.animation.AnimationScene;
import com.dev.canvas.domain.animation.CircleProperties;
import com.dev.canvas.domain.animation.Keyframe;
import com.dev.canvas.domain.animation.LineProperties;
import com.dev.canvas.domain.animation.PropertyTween;
import com.dev.canvas.domain.animation.RectProperties;
import com.dev.canvas.domain.animation.SceneElement;
import com.dev.canvas.domain.animation.Shadow;
import com.dev.canvas.domain.animation.Style;
import com.dev.canvas.domain.animation.TextProperties;
import java.util.List;

public final class SceneAssembler {

    public SceneResponse toResponse(AnimationScene scene) {
        List<ElementResponse> elements = scene.getElements().stream()
            .map(this::mapElement)
            .toList();

        return new SceneResponse(
            scene.getSceneId(),
            scene.getName(),
            scene.getSchemaVersion().getValue(),
            scene.getDurationMillis(),
            scene.getBackground(),
            elements
        );
    }

    private ElementResponse mapElement(SceneElement element) {
        CirclePropertiesResponse circle = null;
        RectPropertiesResponse rect = null;
        LinePropertiesResponse line = null;
        TextPropertiesResponse text = null;

        switch (element.getProperties()) {
            case CircleProperties props -> circle = mapCircle(props);
            case RectProperties props -> rect = mapRect(props);
            case LineProperties props -> line = mapLine(props);
            case TextProperties props -> text = mapText(props);
        }

        List<PropertyTweenResponse> tweens = element.getTweens().stream()
            .map(this::mapTween)
            .toList();

        return new ElementResponse(
            element.getElementId(),
            element.getPrimitiveType(),
            element.getStartMillis(),
            element.getDurationMillis(),
            circle,
            rect,
            line,
            text,
            tweens
        );
    }

    private PropertyTweenResponse mapTween(PropertyTween tween) {
        List<KeyframeResponse> keyframes = tween.getKeyframes().stream()
            .map(this::mapKeyframe)
            .toList();

        return new PropertyTweenResponse(
            tween.getPropertyPath().getValue(),
            keyframes
        );
    }

    private KeyframeResponse mapKeyframe(Keyframe keyframe) {
        return new KeyframeResponse(
            keyframe.getTimeMillis(),
            keyframe.getValue(),
            keyframe.getEasing().getValue()
        );
    }

    private CirclePropertiesResponse mapCircle(CircleProperties properties) {
        return new CirclePropertiesResponse(
            properties.getCenterX(),
            properties.getCenterY(),
            properties.getRadius(),
            mapStyle(properties.getStyle())
        );
    }

    private RectPropertiesResponse mapRect(RectProperties properties) {
        return new RectPropertiesResponse(
            properties.getCenterX(),
            properties.getCenterY(),
            properties.getWidth(),
            properties.getHeight(),
            properties.getRadius(),
            mapStyle(properties.getStyle())
        );
    }

    private LinePropertiesResponse mapLine(LineProperties properties) {
        return new LinePropertiesResponse(
            properties.getStartX(),
            properties.getStartY(),
            properties.getEndX(),
            properties.getEndY(),
            mapStyle(properties.getStyle())
        );
    }

    private TextPropertiesResponse mapText(TextProperties properties) {
        return new TextPropertiesResponse(
            properties.getText(),
            properties.getCenterX(),
            properties.getCenterY(),
            properties.getFontSize(),
            properties.getColor(),
            properties.getFontWeight()
        );
    }

    private StyleResponse mapStyle(Style style) {
        ShadowResponse shadow = style.getShadow()
            .map(this::mapShadow)
            .orElse(null);

        return new StyleResponse(
            style.getFillColor(),
            style.getStrokeColor(),
            style.getLineWidth(),
            shadow
        );
    }

    private ShadowResponse mapShadow(Shadow shadow) {
        return new ShadowResponse(
            shadow.getBlur(),
            shadow.getOffsetX(),
            shadow.getOffsetY(),
            shadow.getColor()
        );
    }
}
