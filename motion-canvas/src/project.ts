import {makeProject} from '@motion-canvas/core';
import circleScene from './scenes/circleScene?scene';
import clientServerScene from './scenes/clientServerScene?scene';
import dominoScene from './scenes/dominoScene?scene';
import domino2dProtoScene from './scenes/domino2dProtoScene?scene';

export default makeProject({
  scenes: [circleScene, clientServerScene, dominoScene, domino2dProtoScene]
});

