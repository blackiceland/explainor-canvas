import {Client} from 'pg';

const EMBEDDING_DIM = 1536;

interface EmbeddingProvider {
  generate(text: string): Promise<number[]>;
}

type OpenAIEmbeddingApiResponse = {
  data: Array<{
    embedding: number[];
  }>;
};

function isOpenAIEmbeddingApiResponse(value: unknown): value is OpenAIEmbeddingApiResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.data) || v.data.length < 1) return false;
  const first = v.data[0] as unknown;
  if (typeof first !== 'object' || first === null) return false;
  const f = first as Record<string, unknown>;
  return Array.isArray(f.embedding) && f.embedding.every(n => typeof n === 'number');
}

class OpenAIEmbedding implements EmbeddingProvider {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
  }

  async generate(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`OpenAI API error: ${response.status}${body ? ` ${body}` : ''}`);
    }

    const json: unknown = await response.json();
    if (!isOpenAIEmbeddingApiResponse(json)) {
      throw new Error('OpenAI API returned unexpected JSON shape');
    }
    return json.data[0].embedding;
  }
}

class MockEmbedding implements EmbeddingProvider {
  async generate(_text: string): Promise<number[]> {
    return Array.from({length: EMBEDDING_DIM}, () => Math.random() * 2 - 1);
  }
}

async function main() {
  const useMock = !process.env.OPENAI_API_KEY || process.argv.includes('--mock');
  const provider: EmbeddingProvider = useMock ? new MockEmbedding() : new OpenAIEmbedding();

  if (useMock) {
    console.log('Using mock embeddings (set OPENAI_API_KEY for real embeddings)');
  } else {
    console.log('Using OpenAI embeddings');
  }

  const client = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5433'),
    user: process.env.POSTGRES_USER || 'daedalus',
    password: process.env.POSTGRES_PASSWORD || 'daedalus',
    database: process.env.POSTGRES_DB || 'daedalus',
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    await generateForTable(client, provider, 'knowledge', 'id', ['title', 'content']);
    await generateForTable(client, provider, 'beats', 'name', ['name', 'description']);
    await generateForTable(client, provider, 'layouts', 'name', ['name', 'description']);

    console.log('Embeddings generation complete');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function generateForTable(
  client: Client,
  provider: EmbeddingProvider,
  table: string,
  idColumn: string,
  textColumns: string[],
) {
  const selectColumns = [idColumn, ...textColumns].join(', ');
  const result = await client.query(
    `SELECT ${selectColumns} FROM ${table} WHERE embedding IS NULL`
  );

  console.log(`Processing ${result.rows.length} rows in ${table}...`);

  for (const row of result.rows) {
    const text = textColumns.map(col => row[col]).join(' ');
    const embedding = await provider.generate(text);
    const vectorStr = `[${embedding.join(',')}]`;

    await client.query(
      `UPDATE ${table} SET embedding = $1 WHERE ${idColumn} = $2`,
      [vectorStr, row[idColumn]]
    );

    process.stdout.write('.');
  }

  console.log(` Done`);
}

main();

