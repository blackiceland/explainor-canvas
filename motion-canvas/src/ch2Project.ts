import {makeProject} from '@motion-canvas/core';
import chapter2ReplaySceneEn from './scenes/chapter2ReplaySceneEn?scene';
import chapter2LivingPathSceneEn from './scenes/chapter2LivingPathSceneEn?scene';
import chapter2BoundaryTakeSceneEn from './scenes/chapter2BoundaryTakeSceneEn?scene';
import chapter2FinalRunSceneEn from './scenes/chapter2FinalRunSceneEn?scene';
import chapter2FullSubsSceneEn from './scenes/chapter2FullSubsSceneEn?scene';
import chapter2FullSceneEn from './scenes/chapter2FullSceneEn?scene';
import preparingForChangeQuestionSceneEn from './scenes/preparingForChangeQuestionSceneEn?scene';
import chapter2ClosingQuoteSceneEn from './scenes/chapter2ClosingQuoteSceneEn?scene';

// Throwaway render harness project for chapter-2 scenes.
// NOT part of the video pipeline — exists so the still exporter can render
// the scenes without touching the author's project.ts.
export default makeProject({
  scenes: [chapter2ReplaySceneEn, chapter2LivingPathSceneEn, chapter2BoundaryTakeSceneEn, chapter2FinalRunSceneEn, chapter2FullSubsSceneEn, chapter2FullSceneEn, preparingForChangeQuestionSceneEn, chapter2ClosingQuoteSceneEn],
});
