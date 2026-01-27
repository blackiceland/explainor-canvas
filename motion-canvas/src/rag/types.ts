export interface KnowledgeItem {
  id: number;
  category: string;
  title: string;
  content: string;
  tags: string[];
  similarity?: number;
}

export interface BeatCatalogItem {
  name: string;
  description: string;
  params: Record<string, string>;
  category: string;
  exampleYaml: string;
  similarity?: number;
}

export interface LayoutCatalogItem {
  name: string;
  slots: Record<string, {x: number; y: number; width: number; height: number}>;
  description: string;
  exampleYaml: string;
  similarity?: number;
}

export interface SearchResult<T> {
  items: T[];
  query: string;
  totalFound: number;
}

