import {makeProject} from '@motion-canvas/core';
import dontFightDuplicationVerticalSceneEn from './scenes/dontFightDuplicationVerticalSceneEn?scene';

export default makeProject({
    experimentalFeatures: true,
    scenes: [
        dontFightDuplicationVerticalSceneEn,
    ],
});
