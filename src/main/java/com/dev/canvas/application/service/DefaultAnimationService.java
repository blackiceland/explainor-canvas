package com.dev.canvas.application.service;

import com.dev.canvas.domain.animation.AnimationScene;
import com.dev.canvas.domain.animation.SceneFactory;
import org.springframework.stereotype.Service;

@Service
public class DefaultAnimationService implements AnimationService {

    private final SceneFactory sceneFactory;

    public DefaultAnimationService(SceneFactory sceneFactory) {
        this.sceneFactory = sceneFactory;
    }

    @Override
    public AnimationScene createCircleSlideScene() {
        return sceneFactory.createCircleSlideScene();
    }
}

