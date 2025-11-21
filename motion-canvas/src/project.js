import { makeProject } from '@motion-canvas/core';
import circleScene from './scenes/circleScene?scene';
import coreDemoScene from './scenes/coreDemoScene?scene';
export default makeProject({
    scenes: [circleScene, coreDemoScene]
});
