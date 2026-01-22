import {makeProject} from '@motion-canvas/core';
import paymentInputsScene from './scenes/paymentInputsScene?scene';
import dryFiltersScene from './scenes/dryFiltersScene?scene';
import dryConditionsScene from './scenes/dryConditionsScene?scene';
import dryKnowledgeScene from './scenes/dryKnowledgeScene?scene';
import splitDtoScene from './scenes/splitDtoScene?scene';
import typewriterCodeScene from './scenes/typewriterCodeScene?scene';

export default makeProject({
    scenes: [paymentInputsScene, splitDtoScene, dryFiltersScene, dryConditionsScene, dryKnowledgeScene, typewriterCodeScene]
});
