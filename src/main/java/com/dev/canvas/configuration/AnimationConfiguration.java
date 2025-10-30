package com.dev.canvas.configuration;

import com.dev.canvas.application.assembler.SceneAssembler;
import com.dev.canvas.domain.animation.SceneFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AnimationConfiguration {

    @Bean
    public SceneFactory sceneFactory() {
        return new SceneFactory();
    }

    @Bean
    public SceneAssembler sceneAssembler() {
        return new SceneAssembler();
    }
}

