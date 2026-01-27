import type {PresetName} from '../core/layouts';

export interface SceneFeatures {
  id: string;
  cardCount: number;
  layout: PresetName | null;
  theme: 'dark' | 'light' | 'mixed';
  beatsUsed: string[];
  hasHighlight: boolean;
  hasZoom: boolean;
  hasTypewriter: boolean;
  hasCrossfade: boolean;
  hasTable: boolean;
  duration: number;
  description: string;
  tags: string[];
}

export interface SceneSearchQuery {
  cardCount?: number;
  cardCountMin?: number;
  cardCountMax?: number;
  layout?: PresetName;
  theme?: 'dark' | 'light';
  beatsRequired?: string[];
  tags?: string[];
  semantic?: string;
}

export interface SceneMatch {
  scene: SceneFeatures;
  score: number;
  matchReasons: string[];
}

export class SceneIndex {
  private scenes: Map<string, SceneFeatures> = new Map();

  register(features: SceneFeatures): void {
    this.scenes.set(features.id, features);
  }

  search(query: SceneSearchQuery, limit: number = 5): SceneMatch[] {
    const results: SceneMatch[] = [];

    for (const scene of this.scenes.values()) {
      const match = this.matchScene(scene, query);
      if (match.score > 0) {
        results.push(match);
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private matchScene(scene: SceneFeatures, query: SceneSearchQuery): SceneMatch {
    let score = 0;
    const reasons: string[] = [];

    if (query.cardCount !== undefined) {
      if (scene.cardCount === query.cardCount) {
        score += 10;
        reasons.push(`exact card count: ${query.cardCount}`);
      } else if (Math.abs(scene.cardCount - query.cardCount) === 1) {
        score += 5;
        reasons.push(`similar card count: ${scene.cardCount}`);
      }
    }

    if (query.cardCountMin !== undefined && scene.cardCount >= query.cardCountMin) {
      score += 3;
    }

    if (query.cardCountMax !== undefined && scene.cardCount <= query.cardCountMax) {
      score += 3;
    }

    if (query.layout && scene.layout === query.layout) {
      score += 8;
      reasons.push(`layout match: ${query.layout}`);
    }

    if (query.theme && scene.theme === query.theme) {
      score += 4;
      reasons.push(`theme match: ${query.theme}`);
    }

    if (query.beatsRequired) {
      const matched = query.beatsRequired.filter(b => scene.beatsUsed.includes(b));
      if (matched.length > 0) {
        score += matched.length * 3;
        reasons.push(`beats: ${matched.join(', ')}`);
      }
    }

    if (query.tags) {
      const matched = query.tags.filter(t => scene.tags.includes(t));
      if (matched.length > 0) {
        score += matched.length * 2;
        reasons.push(`tags: ${matched.join(', ')}`);
      }
    }

    return {scene, score, matchReasons: reasons};
  }

  getById(id: string): SceneFeatures | undefined {
    return this.scenes.get(id);
  }

  getAll(): SceneFeatures[] {
    return Array.from(this.scenes.values());
  }

  getByLayout(layout: PresetName): SceneFeatures[] {
    return this.getAll().filter(s => s.layout === layout);
  }

  getByCardCount(count: number): SceneFeatures[] {
    return this.getAll().filter(s => s.cardCount === count);
  }

  getSimilar(sceneId: string, limit: number = 3): SceneMatch[] {
    const source = this.scenes.get(sceneId);
    if (!source) return [];

    return this.search({
      cardCount: source.cardCount,
      layout: source.layout ?? undefined,
      theme: source.theme === 'mixed' ? undefined : source.theme,
      beatsRequired: source.beatsUsed.slice(0, 3),
    }, limit + 1).filter(m => m.scene.id !== sceneId).slice(0, limit);
  }
}

export const globalSceneIndex = new SceneIndex();

export function registerScene(features: SceneFeatures): void {
  globalSceneIndex.register(features);
}

export function findSimilarScenes(query: SceneSearchQuery, limit?: number): SceneMatch[] {
  return globalSceneIndex.search(query, limit);
}

