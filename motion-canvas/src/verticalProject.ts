import {makeProject} from '@motion-canvas/core';
// import dontFightDuplicationVerticalSceneEn from './scenes/dontFightDuplicationVerticalSceneEn?scene';
import paperCodeSceneEn from './scenes/paperCodeSceneEn?scene';

export default makeProject({
    experimentalFeatures: true,
    scenes: [
        paperCodeSceneEn,
    ],
});
