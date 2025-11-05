package com.dev.canvas.application.controller;

import com.dev.canvas.application.assembler.SceneAssembler;
import com.dev.canvas.application.dto.SceneResponse;
import com.dev.canvas.domain.animation.SceneFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/animations")
public class AnimationController {

    private final SceneFactory sceneFactory;
    private final SceneAssembler sceneAssembler;

    public AnimationController(SceneFactory sceneFactory, SceneAssembler sceneAssembler) {
        this.sceneFactory = sceneFactory;
        this.sceneAssembler = sceneAssembler;
    }

    @GetMapping("/circle-slide")
    public SceneResponse getCircleSlideScene() {
        return sceneAssembler.toResponse(sceneFactory.createCircleSlideScene());
    }

    @GetMapping("/client-server")
    public SceneResponse getClientServerScene() {
        return sceneAssembler.toResponse(sceneFactory.createClientServerScene());
    }

    @GetMapping("/domino-fall")
    public SceneResponse getDominoFallScene() {
        return sceneAssembler.toResponse(sceneFactory.createDominoFallScene());
    }
}

