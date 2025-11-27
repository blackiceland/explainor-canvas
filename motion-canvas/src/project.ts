import {makeProject} from '@motion-canvas/core';
import coreDemoScene from './scenes/coreDemoScene?scene';
import dryDemoScene from './scenes/dryDemoScene?scene';

export default makeProject({
    scenes: [dryDemoScene, coreDemoScene]
});
