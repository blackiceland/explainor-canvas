package com.dev.canvas.application.controller;

import com.dev.canvas.application.assembler.SceneAssembler;
import com.dev.canvas.application.dto.SceneResponse;
import com.dev.canvas.application.service.AnimationService;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/animations")
@CrossOrigin(origins = "*")
public class AnimationController {

    private final AnimationService animationService;
    private final SceneAssembler sceneAssembler;

    public AnimationController(AnimationService animationService, SceneAssembler sceneAssembler) {
        this.animationService = animationService;
        this.sceneAssembler = sceneAssembler;
    }

    @GetMapping("/circle-slide")
    public SceneResponse getCircleSlideScene() {
        return sceneAssembler.toResponse(animationService.createCircleSlideScene());
    }
}

