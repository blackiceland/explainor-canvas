import type {LanguageCode, ContentBundle, ContentManifest} from './types';

export interface ContentConfig {
  basePath: string;
  defaultLang: LanguageCode;
}

export class ContentLoader {
  private config: ContentConfig;
  private cache: Map<string, ContentBundle> = new Map();

  constructor(config: ContentConfig) {
    this.config = config;
  }

  private getCacheKey(sceneId: string, lang: LanguageCode): string {
    return `${sceneId}:${lang}`;
  }

  async load(sceneId: string, lang?: LanguageCode): Promise<ContentBundle> {
    const targetLang = lang ?? this.config.defaultLang;
    const cacheKey = this.getCacheKey(sceneId, targetLang);

    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const bundle = await this.loadFromFile(sceneId, targetLang);
    this.cache.set(cacheKey, bundle);
    return bundle;
  }

  private async loadFromFile(
    sceneId: string,
    lang: LanguageCode,
  ): Promise<ContentBundle> {
    const path = `${this.config.basePath}/${sceneId}/${lang}.ts`;

    try {
      const module = await import(path);
      return {
        lang,
        sceneId,
        entries: module.content ?? module.default ?? {},
      };
    } catch {
      if (lang !== this.config.defaultLang) {
        return this.loadFromFile(sceneId, this.config.defaultLang);
      }
      return {lang, sceneId, entries: {}};
    }
  }

  async loadManifest(sceneId: string): Promise<ContentManifest> {
    const languages: LanguageCode[] = ['en', 'ru'];
    const availableLangs: LanguageCode[] = [];
    const allKeys = new Set<string>();

    for (const lang of languages) {
      try {
        const bundle = await this.load(sceneId, lang);
        if (Object.keys(bundle.entries).length > 0) {
          availableLangs.push(lang);
          Object.keys(bundle.entries).forEach(k => allKeys.add(k));
        }
      } catch {
        continue;
      }
    }

    return {
      sceneId,
      languages: availableLangs,
      keys: Array.from(allKeys),
    };
  }

  get(sceneId: string, key: string, lang?: LanguageCode): string {
    const targetLang = lang ?? this.config.defaultLang;
    const cacheKey = this.getCacheKey(sceneId, targetLang);
    const bundle = this.cache.get(cacheKey);

    if (!bundle) {
      return key;
    }

    return bundle.entries[key] ?? key;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

let globalLoader: ContentLoader | null = null;

export function initContentLoader(config: ContentConfig): ContentLoader {
  globalLoader = new ContentLoader(config);
  return globalLoader;
}

export function getContentLoader(): ContentLoader {
  if (!globalLoader) {
    throw new Error('ContentLoader not initialized. Call initContentLoader first.');
  }
  return globalLoader;
}

