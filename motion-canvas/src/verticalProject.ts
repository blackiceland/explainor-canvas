import {makeProject} from '@motion-canvas/core';
// import dontFightDuplicationVerticalSceneEn from './scenes/dontFightDuplicationVerticalSceneEn?scene';
// import paperCodeSceneEn from './scenes/paperCodeSceneEn?scene';
import linenHeroTestSceneEn from './scenes/linenHeroTestSceneEn?scene';
import linenDuplicationSceneEn from './scenes/linenDuplicationSceneEn?scene';

export default makeProject({
    experimentalFeatures: true,
    scenes: [
       // linenHeroTestSceneEn,
        linenDuplicationSceneEn,
    ],
});
