import {makeProject} from '@motion-canvas/core';
import introMergeScene from './scenes/introMergeScene?scene';
import introMergeSceneV2 from './scenes/introMergeSceneV2?scene';
import chapter1IntroScene from './scenes/chapter1IntroScene?scene';
import chapter1IntroSceneV2 from './scenes/chapter1IntroSceneV2?scene';
import chapter2IntroScene from './scenes/chapter2IntroScene?scene';
import paymentInputsScene from './scenes/paymentInputsScene?scene';
import paymentInputsSceneV3 from './scenes/paymentInputsSceneV3?scene';
import chapter3IntroScene from './scenes/chapter3IntroScene?scene';
import dryFiltersScene from './scenes/dryFiltersScene?scene';
import dryFiltersSceneV2 from './scenes/dryFiltersSceneV2?scene';
import dryFiltersSceneV2Poster from './scenes/dryFiltersSceneV2Poster?scene';
import dryFiltersSceneV3 from './scenes/dryFiltersSceneV3?scene';
import dryConditionsScene from './scenes/dryConditionsScene?scene';
import dryConditionsSceneV3 from './scenes/dryConditionsSceneV3?scene';
import dryKnowledgeScene from './scenes/dryKnowledgeScene?scene';
import dryKnowledgeSceneV3 from './scenes/dryKnowledgeSceneV3?scene';
import splitDtoScene from './scenes/splitDtoScene?scene';
import splitDtoSceneV3 from './scenes/splitDtoSceneV3?scene';
import typewriterCodeScene from './scenes/typewriterCodeScene?scene';
import pilotScene from './scenes/pilotScene?scene';

export default makeProject({
    experimentalFeatures: true,
    scenes: [
        pilotScene,
        introMergeScene,
        introMergeSceneV2,
        chapter1IntroSceneV2,
        chapter1IntroScene,
        chapter2IntroScene,
        paymentInputsSceneV3,
        splitDtoSceneV3,
        paymentInputsScene,
        chapter3IntroScene,
        splitDtoScene,
        dryFiltersSceneV2Poster,
        dryFiltersSceneV3,
        dryFiltersSceneV2,
        dryFiltersScene,
        dryConditionsScene,
        dryConditionsSceneV3,
        dryKnowledgeScene,
        dryKnowledgeSceneV3,
        typewriterCodeScene
    ]
});
