import {makeProject} from '@motion-canvas/core';
import booleanTruthTreeSceneEn from './scenes/booleanTruthTreeSceneEn?scene';

// Throwaway single-scene project for render-verifying booleanTruthTreeSceneEn
// in isolation. Not part of the real edit; delete after verification.
export default makeProject({
  experimentalFeatures: true,
  scenes: [booleanTruthTreeSceneEn],
});
