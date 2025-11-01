package com.dev.canvas.domain.animation;

import java.math.BigDecimal;
import java.util.UUID;

public final class SceneFactory {

    public AnimationScene createCircleSlideScene() {
        CircleProperties circleProperties = CircleProperties.builder()
            .centerX(new BigDecimal("0"))
            .centerY(new BigDecimal("0"))
            .radius(new BigDecimal("160"))
            .strokeColor("#1F2933")
            .fillColor("#EF4444")
            .build();

        PropertyTween xPositionTween = PropertyTween.builder()
            .propertyName("positionX")
            .addKeyframe(Keyframe.builder()
                .timeSeconds(new BigDecimal("0"))
                .value(new BigDecimal("-320"))
                .easing("easeInOut")
                .build())
            .addKeyframe(Keyframe.builder()
                .timeSeconds(new BigDecimal("2.4"))
                .value(new BigDecimal("320"))
                .easing("easeInOut")
                .build())
            .build();

        SceneElement circleElement = SceneElement.builder()
            .elementId(UUID.randomUUID().toString())
            .primitiveType(PrimitiveType.CIRCLE)
            .startSeconds(new BigDecimal("0"))
            .durationSeconds(new BigDecimal("2.4"))
            .circleProperties(circleProperties)
            .addTween(xPositionTween)
            .build();

        return AnimationScene.builder()
            .sceneId(UUID.randomUUID().toString())
            .name("circle-slide")
            .durationSeconds(new BigDecimal("2.4"))
            .addElement(circleElement)
            .build();
    }
}

