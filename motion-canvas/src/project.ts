import {makeProject} from '@motion-canvas/core';
import coreDemoScene from './scenes/coreDemoScene?scene';
import './global.css';

export default makeProject({
    scenes: [coreDemoScene]
});
