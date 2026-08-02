import {makeProject} from '@motion-canvas/core';
import duplicationHateIntroScene from './scenes/duplicationHateIntroScene?scene';
import introMergeScene from './scenes/introMergeScene?scene';

// Throwaway render harness for the DON'T FIGHT DUPLICATION opening.
// NOT part of the video pipeline — exists so the still exporter can render
// these scenes without touching the author's project.ts.
export default makeProject({
  experimentalFeatures: true,
  scenes: [duplicationHateIntroScene, introMergeScene],
});
