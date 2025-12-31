import {makeProject} from '@motion-canvas/core';
import paymentInputsScene from './scenes/paymentInputsScene?scene';
import dryFiltersScene from './scenes/dryFiltersScene?scene';

export default makeProject({
    scenes: [paymentInputsScene, dryFiltersScene]
});
