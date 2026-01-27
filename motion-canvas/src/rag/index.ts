export {RagClient, type RagConfig} from './client';
export {type KnowledgeItem, type BeatCatalogItem, type LayoutCatalogItem} from './types';
export {buildPromptContext} from './context';
export {
  SceneIndex,
  globalSceneIndex,
  registerScene,
  findSimilarScenes,
  type SceneFeatures,
  type SceneSearchQuery,
  type SceneMatch,
} from './sceneIndex';
export {initSceneRegistry, getSceneCatalog} from './sceneRegistry';

export {
  SceneAnalyzer,
  KnowledgeManager,
  BeatCatalog,
  discoverScenes,
} from './enrichment';
export {globalKnowledgeManager} from './enrichment/knowledgeManager';
export {globalBeatCatalog} from './enrichment/beatCatalog';
export {analyzeScene, formatDiscoveryReport} from './enrichment/discovery';

export {
  initDaedalus,
  getDaedalus,
  shutdownDaedalus,
  type DaedalusConfig,
  type DaedalusInstance,
} from './init';

