export type LanguageCode = 'en' | 'ru';

export interface ContentBundle {
  lang: LanguageCode;
  sceneId: string;
  entries: Record<string, string>;
}

export interface ContentManifest {
  sceneId: string;
  languages: LanguageCode[];
  keys: string[];
}

