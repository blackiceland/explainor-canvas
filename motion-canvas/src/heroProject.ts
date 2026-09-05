import {makeProject} from '@motion-canvas/core';
import chargingHeroDemoScene from './scenes/chargingHeroDemoScene?scene';
import openingMergeTimelapseSceneEn from './scenes/openingMergeTimelapseSceneEn?scene';
import duplicationEpigraphSceneEn from './scenes/duplicationEpigraphSceneEn?scene';
import duplicationCitySceneEn from './scenes/duplicationCitySceneEn?scene';
import duplicationFieldSceneEn from './scenes/duplicationFieldSceneEn?scene';

// Разовый харнесс для превью операторской демки. НЕ часть пайплайна видео —
// нужен только чтобы стилл-экспортёр рендерил сцену, не трогая project.ts автора.
export default makeProject({
  experimentalFeatures: true,
  scenes: [duplicationFieldSceneEn, duplicationEpigraphSceneEn, openingMergeTimelapseSceneEn, chargingHeroDemoScene, duplicationCitySceneEn],
});
