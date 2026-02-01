import {makeProject} from '@motion-canvas/core';
import dryKnowledgeScene from './scenes/dryKnowledgeScene?scene';
import dryKnowledgeSceneV3 from './scenes/dryKnowledgeSceneV3?scene';

export default makeProject({
    experimentalFeatures: true,
    scenes: [
        // pilotScene,
        // introMergeScene,
        // introMergeSceneV2,
        // chapter1IntroSceneV2,
        // chapter1IntroScene,
        // chapter2IntroScene,
        // paymentInputsSceneV3,
        // splitDtoSceneV3,
        // paymentInputsScene,
        // chapter3IntroScene,
        // splitDtoScene,
        // dryFiltersSceneV2Poster,
        // dryFiltersSceneV3,
        // dryFiltersSceneV2,
        // dryFiltersScene,
        // dryConditionsScene,
        // dryConditionsSceneV3,
        dryKnowledgeScene,
        dryKnowledgeSceneV3,
        // typewriterCodeScene
    ]
});
