import {makeProject} from '@motion-canvas/core';
import dryKnowledgeScene from './scenes/dryKnowledgeScene?scene';
import dryFiltersScene from './scenes/dryFiltersScene?scene';

export default makeProject({
    scenes: [dryFiltersScene, dryKnowledgeScene]
});
