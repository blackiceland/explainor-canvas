import {makeProject} from '@motion-canvas/core';
import dryKnowledgeScene from './scenes/dryKnowledgeScene?scene';
import dryFiltersScene from './scenes/dryFiltersScene?scene';
import dryConditionsScene from './scenes/dryConditionsScene?scene';

export default makeProject({
    scenes: [dryFiltersScene, dryConditionsScene, dryKnowledgeScene]
});
