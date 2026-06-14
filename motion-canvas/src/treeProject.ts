import {makeProject} from '@motion-canvas/core';
import deliverSignatureForkSceneEn from './scenes/deliverSignatureForkSceneEn?scene';

// Throwaway single-scene project for render-verifying the new scene in
// isolation. Not part of the real edit; delete after verification.
export default makeProject({
  experimentalFeatures: true,
  scenes: [deliverSignatureForkSceneEn],
});
