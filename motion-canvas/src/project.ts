import {makeProject} from '@motion-canvas/core';
import videoExportActionsSceneRu from './scenes/videoExportActionsSceneRu?scene';
import codeWithActionsSceneRuTilt from './scenes/codeWithActionsSceneRuTilt?scene';
import contextObjectSceneRu from './scenes/contextObjectSceneRu?scene';
import contextRefactorSceneRu from './scenes/contextRefactorSceneRu?scene';
import codeWithActionsSceneRu from './scenes/codeWithActionsSceneRu?scene';

export default makeProject({
    experimentalFeatures: true,
    scenes: [
        // duplicationHateIntroScene,
        // introMergeScene,
        // duplicationBestChoiceTitleSceneEn,
        // doItAllComponentTitleSceneEn,
        // chapter1IntroScene,
        // dryFiltersScene,
        // dryConditionsScene,
        // chapter2IntroScene, // intro 2
        // paymentInputsScene,
        // splitDtoScene,
        // dryKnowledgeScene,
        // typewriterCodeScene,


        // duplicationHateIntroSceneRu,
        // introMergeSceneV2,
        // duplicationBestChoiceTitleSceneRu,
        //  doItAllComponentTitleSceneRu,
        // trainCodeOverlaySceneRu,

        // chapter1IntroSceneV2, // интро 1
        //  dryFiltersSceneV3,
        // dryConditionsSceneV3,
        // chapter3IntroScene,
        // paymentInputsSceneV3,
        //  splitDtoSceneV3,
        // dryKnowledgeSceneV3,
        // typewriterCodeSceneRu,

        // dryFiltersSceneV2Poster,
        // dryFiltersSceneV2,


        // trainCodeOverlaySceneRu,
        // oneCargoSceneRu,
        // passThroughMonolithScrollSceneRu,
        // sphereDigitsDemoSceneRu,

        // validateMonolithSceneRu,

        // starWarsCrawlSceneRu,
        //  jackIntroSceneEn,

        // просто анимации
        // videoExportActionsSceneRu,

        // codeWithActionsSceneRu,
        // codeWithActionsSceneRuTilt,
        // guitarHeroPassThroughSceneRu,
        contextObjectSceneRu,
        contextRefactorSceneRu,

    ]
});
