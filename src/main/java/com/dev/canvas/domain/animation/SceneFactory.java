package com.dev.canvas.domain.animation;

public final class SceneFactory {

    private static final String SCENE_CIRCLE_SLIDE = "circle-slide";
    private static final String SCENE_CLIENT_SERVER = "client-server";
    private static final String SCENE_DOMINO_FALL = "domino-fall";

    public AnimationScene createCircleSlideScene() {
        Style circleStyle = Style.builder()
            .strokeColor("#1F2933")
            .fillColor("#EF4444")
            .lineWidth(12)
            .build();

        CircleProperties circleProperties = CircleProperties.builder()
            .centerX(0)
            .centerY(0)
            .radius(160)
            .style(circleStyle)
            .build();

        PropertyTween xPositionTween = PropertyTween.builder()
            .propertyPath(PropertyPath.POSITION_X)
            .addKeyframe(Keyframe.builder()
                .timeMillis(0)
                .value(-320)
                .easing(EasingFunction.EASE_IN_OUT)
                .build())
            .addKeyframe(Keyframe.builder()
                .timeMillis(2400)
                .value(320)
                .easing(EasingFunction.EASE_IN_OUT)
                .build())
            .build();

        SceneElement circleElement = SceneElement.builder()
            .elementId(SceneId.generateForElement(SCENE_CIRCLE_SLIDE, "circle", 0).getValue())
            .startMillis(0)
            .durationMillis(2400)
            .properties(circleProperties)
            .addTween(xPositionTween)
            .build();

        return AnimationScene.builder()
            .sceneId(SceneId.generate(SCENE_CIRCLE_SLIDE).getValue())
            .name(SCENE_CIRCLE_SLIDE)
            .durationMillis(2400)
            .addElement(circleElement)
            .build();
    }

    public AnimationScene createClientServerScene() {
        Style cardStyle = Style.builder()
            .fillColor("#FFFFFF")
            .strokeColor("#FFFFFF")
            .lineWidth(0)
            .shadow(Shadow.builder()
                .blur(22)
                .offsetX(0)
                .offsetY(10)
                .color("rgba(0,0,0,0.22)")
                .build())
            .build();

        RectProperties clientCardProperties = RectProperties.builder()
            .centerX(-380)
            .centerY(0)
            .width(200)
            .height(90)
            .radius(16)
            .style(cardStyle)
            .build();

        SceneElement clientCard = SceneElement.builder()
            .elementId(SceneId.generateForElement(SCENE_CLIENT_SERVER, "rect-client", 0).getValue())
            .startMillis(0)
            .durationMillis(1800)
            .properties(clientCardProperties)
            .build();

        TextProperties clientTextProperties = TextProperties.builder()
            .text("Client")
            .centerX(-380)
            .centerY(0)
            .fontSize(36)
            .color("#111827")
            .fontWeight("600")
            .build();

        SceneElement clientText = SceneElement.builder()
            .elementId(SceneId.generateForElement(SCENE_CLIENT_SERVER, "text-client", 0).getValue())
            .startMillis(0)
            .durationMillis(1800)
            .properties(clientTextProperties)
            .build();

        RectProperties serverCardProperties = RectProperties.builder()
            .centerX(380)
            .centerY(0)
            .width(200)
            .height(90)
            .radius(16)
            .style(cardStyle)
            .build();

        SceneElement serverCard = SceneElement.builder()
            .elementId(SceneId.generateForElement(SCENE_CLIENT_SERVER, "rect-server", 0).getValue())
            .startMillis(0)
            .durationMillis(1800)
            .properties(serverCardProperties)
            .build();

        TextProperties serverTextProperties = TextProperties.builder()
            .text("Server")
            .centerX(380)
            .centerY(0)
            .fontSize(36)
            .color("#111827")
            .fontWeight("600")
            .build();

        SceneElement serverText = SceneElement.builder()
            .elementId(SceneId.generateForElement(SCENE_CLIENT_SERVER, "text-server", 0).getValue())
            .startMillis(0)
            .durationMillis(1800)
            .properties(serverTextProperties)
            .build();

        Style arrowStyle = Style.builder()
            .strokeColor("#111827")
            .lineWidth(5)
            .build();

        LineProperties arrowProperties = LineProperties.builder()
            .startX(-280)
            .startY(0)
            .endX(280)
            .endY(0)
            .style(arrowStyle)
            .build();

        PropertyTween arrowDrawTween = PropertyTween.builder()
            .propertyPath(PropertyPath.END)
            .addKeyframe(Keyframe.builder()
                .timeMillis(0)
                .value(0)
                .easing(EasingFunction.LINEAR)
                .build())
            .addKeyframe(Keyframe.builder()
                .timeMillis(1000)
                .value(1)
                .easing(EasingFunction.LINEAR)
                .build())
            .build();

        SceneElement arrow = SceneElement.builder()
            .elementId(SceneId.generateForElement(SCENE_CLIENT_SERVER, "line-arrow", 0).getValue())
            .startMillis(0)
            .durationMillis(1800)
            .properties(arrowProperties)
            .addTween(arrowDrawTween)
            .build();

        TextProperties labelProperties = TextProperties.builder()
            .text("HTTP Request")
            .centerX(0)
            .centerY(-40)
            .fontSize(32)
            .color("#6B7280")
            .fontWeight("500")
            .build();

        PropertyTween labelOpacityTween = PropertyTween.builder()
            .propertyPath(PropertyPath.OPACITY)
            .addKeyframe(Keyframe.builder()
                .timeMillis(1000)
                .value(0)
                .easing(EasingFunction.LINEAR)
                .build())
            .addKeyframe(Keyframe.builder()
                .timeMillis(1400)
                .value(1)
                .easing(EasingFunction.LINEAR)
                .build())
            .build();

        SceneElement label = SceneElement.builder()
            .elementId(SceneId.generateForElement(SCENE_CLIENT_SERVER, "text-label", 0).getValue())
            .startMillis(0)
            .durationMillis(1800)
            .properties(labelProperties)
            .addTween(labelOpacityTween)
            .build();

        return AnimationScene.builder()
            .sceneId(SceneId.generate(SCENE_CLIENT_SERVER).getValue())
            .name(SCENE_CLIENT_SERVER)
            .background("#E5E7EB")
            .durationMillis(1800)
            .addElement(clientCard)
            .addElement(clientText)
            .addElement(serverCard)
            .addElement(serverText)
            .addElement(arrow)
            .addElement(label)
            .build();
    }

    public AnimationScene createDominoFallScene() {
        Style wireframeStyle = Style.builder()
            .strokeColor("#000000")
            .fillColor("transparent")
            .lineWidth(2)
            .build();

        AnimationScene.Builder sceneBuilder = AnimationScene.builder()
            .sceneId(SceneId.generate(SCENE_DOMINO_FALL).getValue())
            .name(SCENE_DOMINO_FALL)
            .background("#F5F5DC")
            .durationMillis(3000);

        int dominoCount = 5;
        int spacing = 100;
        int startX = -200;

        for (int i = 0; i < dominoCount; i++) {
            int x = startX + i * spacing;
            int delay = i * 250;

            DominoProperties dominoProperties = DominoProperties.builder()
                .x(x)
                .y(0)
                .z(0)
                .width(60)
                .height(120)
                .depth(10)
                .rotationX(0)
                .style(wireframeStyle)
                .build();

            PropertyTween rotationTween = PropertyTween.builder()
                .propertyPath(PropertyPath.ROTATION_X)
                .addKeyframe(Keyframe.builder()
                    .timeMillis(delay)
                    .value(0)
                    .easing(EasingFunction.EASE_IN_OUT)
                    .build())
                .addKeyframe(Keyframe.builder()
                    .timeMillis(delay + 600)
                    .value(90)
                    .easing(EasingFunction.EASE_IN_OUT)
                    .build())
                .build();

            SceneElement dominoElement = SceneElement.builder()
                .elementId(SceneId.generateForElement(SCENE_DOMINO_FALL, "domino", i).getValue())
                .startMillis(0)
                .durationMillis(3000)
                .properties(dominoProperties)
                .addTween(rotationTween)
                .build();

            sceneBuilder.addElement(dominoElement);
        }

        return sceneBuilder.build();
    }
}
