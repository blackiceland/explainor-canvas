import {makeProject} from '@motion-canvas/core';
import chapter1IntroScene from './scenes/chapter1IntroScene?scene';
import paymentInputsScene from './scenes/paymentInputsScene?scene';
import dryFiltersScene from './scenes/dryFiltersScene?scene';
import dryConditionsScene from './scenes/dryConditionsScene?scene';
import dryKnowledgeScene from './scenes/dryKnowledgeScene?scene';
import splitDtoScene from './scenes/splitDtoScene?scene';
import typewriterCodeScene from './scenes/typewriterCodeScene?scene';

export default makeProject({
    scenes: [chapter1IntroScene, paymentInputsScene, splitDtoScene, dryFiltersScene, dryConditionsScene, dryKnowledgeScene, typewriterCodeScene]
});
