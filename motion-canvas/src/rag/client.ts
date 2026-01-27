import type {
  KnowledgeItem,
  BeatCatalogItem,
  LayoutCatalogItem,
  SearchResult,
} from './types';

export interface RagConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  embeddingProvider: 'openai' | 'mock';
  embeddingModel?: string;
  apiKey?: string;
}

interface PostgresClient {
  connect(): Promise<void>;
  query<T>(sql: string, params?: unknown[]): Promise<{rows: T[]}>;
  end(): Promise<void>;
}

type ClientConstructor = new (config: {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  connectionString?: string;
}) => PostgresClient;

export class RagClient {
  private config: RagConfig;
  private client: PostgresClient | null = null;
  private connected: boolean = false;
  private ClientClass: ClientConstructor | null = null;

  constructor(config: RagConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      const pg = await import('pg');
      this.ClientClass = pg.Client as unknown as ClientConstructor;

      this.client = new this.ClientClass({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        connectionString: this.config.connectionString,
      });

      await this.client.connect();
      this.connected = true;
    } catch {
      console.warn('PostgreSQL not available, using mock mode');
      this.client = null;
      this.connected = true;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
    this.connected = false;
  }

  private async getEmbedding(text: string): Promise<number[]> {
    if (this.config.embeddingProvider === 'openai' && this.config.apiKey) {
      return this.getOpenAIEmbedding(text);
    }
    return this.getMockEmbedding();
  }

  private async getOpenAIEmbedding(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.embeddingModel ?? 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  private getMockEmbedding(): number[] {
    return new Array(1536).fill(0).map(() => Math.random() - 0.5);
  }

  async searchKnowledge(
    query: string,
    limit: number = 5,
    category?: string,
  ): Promise<SearchResult<KnowledgeItem>> {
    if (!this.client) {
      return this.searchKnowledgeMock(query, limit, category);
    }

    const embedding = await this.getEmbedding(query);
    const vectorStr = `[${embedding.join(',')}]`;

    const categoryFilter = category ? `AND category = $3` : '';
    const params = category
      ? [vectorStr, limit, category]
      : [vectorStr, limit];

    const sql = `
      SELECT 
        id, category, title, content, tags,
        1 - (embedding <=> $1::vector) as similarity
      FROM knowledge
      WHERE embedding IS NOT NULL ${categoryFilter}
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `;
    const result = await this.client.query<KnowledgeItem & {similarity: number}>(sql, params);

    return {
      items: result.rows.map(r => ({
        id: r.id,
        category: r.category,
        title: r.title,
        content: r.content,
        tags: r.tags,
        similarity: r.similarity,
      })),
      query,
      totalFound: result.rows.length,
    };
  }

  private searchKnowledgeMock(
    query: string,
    limit: number,
    category?: string,
  ): SearchResult<KnowledgeItem> {
    const mockItems: KnowledgeItem[] = [
      {
        id: 1,
        category: 'rule',
        title: 'Layout Presets',
        content: 'Use getSlots(preset) for positioning. Available: 2-col, 2L-1R, 2L-2R, split-vertical, center, center-title.',
        tags: ['layout', 'positioning'],
        similarity: 0.92,
      },
      {
        id: 2,
        category: 'rule',
        title: 'Timing',
        content: 'Use Timing constants: Timing.fast=0.3, Timing.normal=0.6, Timing.slow=1.1.',
        tags: ['animation', 'timing'],
        similarity: 0.87,
      },
      {
        id: 3,
        category: 'rule',
        title: 'Safe Zone',
        content: 'Screen: 1920x1080, center at (0,0). SafeZone: top=-480, bottom=480, left=-840, right=840.',
        tags: ['layout', 'boundaries'],
        similarity: 0.85,
      },
    ];

    const filtered = category
      ? mockItems.filter(i => i.category === category)
      : mockItems;

    return {
      items: filtered.slice(0, limit),
      query,
      totalFound: filtered.length,
    };
  }

  async searchBeats(
    query: string,
    limit: number = 5,
    category?: string,
  ): Promise<SearchResult<BeatCatalogItem>> {
    if (!this.client) {
      return this.searchBeatsMock(query, limit, category);
    }

    const embedding = await this.getEmbedding(query);
    const vectorStr = `[${embedding.join(',')}]`;

    const categoryFilter = category ? `AND category = $3` : '';
    const params = category
      ? [vectorStr, limit, category]
      : [vectorStr, limit];

    const result = await this.client.query<{
      name: string;
      description: string;
      params: Record<string, string>;
      category: string;
      example_yaml: string;
      similarity: number;
    }>(`
      SELECT 
        name, description, params, category, example_yaml,
        1 - (embedding <=> $1::vector) as similarity
      FROM beats
      WHERE embedding IS NOT NULL ${categoryFilter}
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `, params);

    return {
      items: result.rows.map(r => ({
        name: r.name,
        description: r.description,
        params: r.params,
        category: r.category,
        exampleYaml: r.example_yaml,
        similarity: r.similarity,
      })),
      query,
      totalFound: result.rows.length,
    };
  }

  private searchBeatsMock(
    query: string,
    limit: number,
    category?: string,
  ): SearchResult<BeatCatalogItem> {
    const mockItems: BeatCatalogItem[] = [
      {
        name: 'appear-staggered',
        description: 'Fade in components sequentially',
        params: {delay: 'number', duration: 'number'},
        category: 'appear',
        exampleYaml: 'beat: {type: appear-staggered, targets: [card1, card2], delay: 0.3}',
        similarity: 0.95,
      },
      {
        name: 'highlight-lines',
        description: 'Dim all lines except specified ranges',
        params: {lines: 'number[]', duration: 'number'},
        category: 'highlight',
        exampleYaml: 'beat: {type: highlight-lines, targets: [card1], lines: [3, 4, 5]}',
        similarity: 0.88,
      },
      {
        name: 'zoom-reveal',
        description: 'Zoom into card and reveal content',
        params: {scale: 'number', duration: 'number'},
        category: 'transition',
        exampleYaml: 'beat: {type: zoom-reveal, targets: [card], scale: 1.8}',
        similarity: 0.82,
      },
    ];

    const filtered = category
      ? mockItems.filter(i => i.category === category)
      : mockItems;

    return {
      items: filtered.slice(0, limit),
      query,
      totalFound: filtered.length,
    };
  }

  async searchLayouts(
    query: string,
    limit: number = 3,
  ): Promise<SearchResult<LayoutCatalogItem>> {
    if (!this.client) {
      return this.searchLayoutsMock(query, limit);
    }

    const embedding = await this.getEmbedding(query);
    const vectorStr = `[${embedding.join(',')}]`;

    const result = await this.client.query<{
      name: string;
      slots: Record<string, {x: number; y: number; width: number; height: number}>;
      description: string;
      example_yaml: string;
      similarity: number;
    }>(`
      SELECT 
        name, slots, description, example_yaml,
        1 - (embedding <=> $1::vector) as similarity
      FROM layouts
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `, [vectorStr, limit]);

    return {
      items: result.rows.map(r => ({
        name: r.name,
        slots: r.slots,
        description: r.description,
        exampleYaml: r.example_yaml,
        similarity: r.similarity,
      })),
      query,
      totalFound: result.rows.length,
    };
  }

  private searchLayoutsMock(
    query: string,
    limit: number,
  ): SearchResult<LayoutCatalogItem> {
    const mockItems: LayoutCatalogItem[] = [
      {
        name: '2L-1R',
        slots: {
          L1: {x: -420, y: -240, width: 780, height: 450},
          L2: {x: -420, y: 240, width: 780, height: 450},
          R1: {x: 420, y: 0, width: 780, height: 960},
        },
        description: 'Two cards stacked left, one tall card right',
        exampleYaml: 'layout: 2L-1R',
        similarity: 0.94,
      },
      {
        name: '2L-2R',
        slots: {
          L1: {x: -420, y: -240, width: 780, height: 450},
          L2: {x: -420, y: 240, width: 780, height: 450},
          R1: {x: 420, y: -240, width: 780, height: 450},
          R2: {x: 420, y: 240, width: 780, height: 450},
        },
        description: 'Four cards in 2x2 grid',
        exampleYaml: 'layout: 2L-2R',
        similarity: 0.89,
      },
    ];

    return {
      items: mockItems.slice(0, limit),
      query,
      totalFound: mockItems.length,
    };
  }

  async getRelevantContext(query: string): Promise<{
    knowledge: KnowledgeItem[];
    beats: BeatCatalogItem[];
    layouts: LayoutCatalogItem[];
  }> {
    const [knowledgeResult, beatsResult, layoutsResult] = await Promise.all([
      this.searchKnowledge(query, 5),
      this.searchBeats(query, 3),
      this.searchLayouts(query, 2),
    ]);

    return {
      knowledge: knowledgeResult.items,
      beats: beatsResult.items,
      layouts: layoutsResult.items,
    };
  }

  isConnected(): boolean {
    return this.connected;
  }

  isUsingDatabase(): boolean {
    return this.client !== null;
  }
}
