import {makeProject} from '@motion-canvas/core';
import chargingHeroDemoScene from './scenes/chargingHeroDemoScene?scene';
import openingMergeTimelapseSceneEn from './scenes/openingMergeTimelapseSceneEn?scene';
import duplicationEpigraphSceneEn from './scenes/duplicationEpigraphSceneEn?scene';
import duplicationCitySceneEn from './scenes/duplicationCitySceneEn?scene';
import duplicationChapterOneTitleSceneEn from './scenes/duplicationChapterOneTitleSceneEn?scene';
import duplicationDivergeSceneEn from './scenes/duplicationDivergeSceneEn?scene';
import duplicationIncidentSceneEn from './scenes/duplicationIncidentSceneEn?scene';
import duplicationIdenticalLogicSceneEn from './scenes/duplicationIdenticalLogicSceneEn?scene';
import duplicationTradeoffSketchSceneEn from './scenes/duplicationTradeoffSketchSceneEn?scene';
import duplicationStreetPovSceneEn from './scenes/duplicationStreetPovSceneEn?scene';
import duplicationFieldSceneEn from './scenes/duplicationFieldSceneEn?scene';
import duplicationCityParticlesSceneEn from './scenes/duplicationCityParticlesSceneEn?scene';
import duplicationWorldSceneEn from './scenes/duplicationWorldSceneEn?scene';
import goodCodeOpeningSceneEn from './scenes/goodCodeOpeningSceneEn?scene';
import goodCodeFacesSceneEn from './scenes/goodCodeFacesSceneEn?scene';
import goodCodeIntroSceneEn from './scenes/goodCodeIntroSceneEn?scene';
import duplicationChapterTwoTitleSceneEn from './scenes/duplicationChapterTwoTitleSceneEn?scene';
import duplicationFalseIndependenceSceneEn from './scenes/duplicationFalseIndependenceSceneEn?scene';

// Разовый харнесс для превью операторской демки. НЕ часть пайплайна видео —
// нужен только чтобы стилл-экспортёр рендерил сцену, не трогая project.ts автора.
export default makeProject({
  experimentalFeatures: true,
  scenes: [goodCodeIntroSceneEn, goodCodeFacesSceneEn, goodCodeOpeningSceneEn, duplicationWorldSceneEn, duplicationCityParticlesSceneEn, duplicationFieldSceneEn, duplicationEpigraphSceneEn, openingMergeTimelapseSceneEn, chargingHeroDemoScene, duplicationChapterOneTitleSceneEn, duplicationDivergeSceneEn, duplicationIncidentSceneEn, duplicationIdenticalLogicSceneEn, duplicationTradeoffSketchSceneEn, duplicationChapterTwoTitleSceneEn, duplicationStreetPovSceneEn, duplicationFalseIndependenceSceneEn, duplicationCitySceneEn],
});
