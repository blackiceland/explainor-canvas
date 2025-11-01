import {makeProject} from '@motion-canvas/core';
import circleScene from './scenes/circleScene?scene';
import clientServerScene from './scenes/clientServerScene?scene';

export default makeProject({
  scenes: [circleScene, clientServerScene]
});

