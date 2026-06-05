import {makeProject} from '@motion-canvas/core';
import subtitleOverlayEn from './scenes/subtitleOverlayEn?scene';

// Transparent caption overlay rendered on its own. No `background` option →
// the PNG image-sequence export keeps alpha, so it drops onto a DaVinci
// track at 00:00:00 and sits over the cut video. 1080×1920, 60fps.
export default makeProject({
    scenes: [subtitleOverlayEn],
});
