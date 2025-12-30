import {makeProject} from '@motion-canvas/core';
import chapter1IntroScene from './scenes/chapter1IntroScene?scene';
import dryKnowledgeScene from './scenes/dryKnowledgeScene?scene';
import dryFiltersScene from './scenes/dryFiltersScene?scene';
import dryConditionsScene from './scenes/dryConditionsScene?scene';

export default makeProject({
    scenes: [chapter1IntroScene, dryFiltersScene, dryConditionsScene, dryKnowledgeScene]
});
