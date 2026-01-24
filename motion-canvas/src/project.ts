import {makeProject} from '@motion-canvas/core';
import introMergeScene from './scenes/introMergeScene?scene';
import chapter1IntroScene from './scenes/chapter1IntroScene?scene';
import chapter2IntroScene from './scenes/chapter2IntroScene?scene';
import paymentInputsScene from './scenes/paymentInputsScene?scene';
import chapter3IntroScene from './scenes/chapter3IntroScene?scene';
import dryFiltersScene from './scenes/dryFiltersScene?scene';
import dryConditionsScene from './scenes/dryConditionsScene?scene';
import dryKnowledgeScene from './scenes/dryKnowledgeScene?scene';
import splitDtoScene from './scenes/splitDtoScene?scene';
import typewriterCodeScene from './scenes/typewriterCodeScene?scene';

export default makeProject({
    experimentalFeatures: true,
    scenes: [introMergeScene, chapter1IntroScene, chapter2IntroScene, paymentInputsScene, chapter3IntroScene, splitDtoScene, dryFiltersScene, dryConditionsScene, dryKnowledgeScene, typewriterCodeScene]
});
