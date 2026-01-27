import {Client} from 'pg';

type CheckResult = {
  ok: boolean;
  label: string;
  details?: string;
};

function pass(label: string, details?: string): CheckResult {
  return {ok: true, label, details};
}

function fail(label: string, details?: string): CheckResult {
  return {ok: false, label, details};
}

function print(results: CheckResult[]) {
  for (const r of results) {
    const prefix = r.ok ? 'OK ' : 'FAIL';
    console.log(`${prefix}  ${r.label}${r.details ? ` — ${r.details}` : ''}`);
  }
}

async function main() {
  const warnOnly = process.argv.includes('--warn');
  const client = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5433'),
    user: process.env.POSTGRES_USER || 'daedalus',
    password: process.env.POSTGRES_PASSWORD || 'daedalus',
    database: process.env.POSTGRES_DB || 'daedalus',
  });

  const results: CheckResult[] = [];

  try {
    await client.connect();
    results.push(pass('PostgreSQL connection'));

    const ext = await client.query(
      `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS ok`,
    );
    results.push(ext.rows[0]?.ok ? pass('pgvector extension') : fail('pgvector extension'));

    const tables = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const tableSet = new Set<string>(tables.rows.map(r => String(r.table_name)));
    const requiredTables = ['knowledge', 'beats', 'layouts', 'scenes', 'content'];
    for (const t of requiredTables) {
      results.push(tableSet.has(t) ? pass(`table ${t}`) : fail(`table ${t}`));
    }

    if (requiredTables.every(t => tableSet.has(t))) {
      const counts = await client.query(`
        SELECT
          (SELECT COUNT(*)::int FROM knowledge) AS knowledge_count,
          (SELECT COUNT(*)::int FROM beats) AS beats_count,
          (SELECT COUNT(*)::int FROM layouts) AS layouts_count,
          (SELECT COUNT(*)::int FROM scenes) AS scenes_count,
          (SELECT COUNT(*)::int FROM content) AS content_count
      `);

      const c = counts.rows[0] as {
        knowledge_count: number;
        beats_count: number;
        layouts_count: number;
        scenes_count: number;
        content_count: number;
      };

      results.push(
        c.knowledge_count > 0
          ? pass('seed knowledge', `${c.knowledge_count} rows`)
          : fail('seed knowledge', '0 rows (seed.sql not applied?)'),
      );
      results.push(
        c.beats_count > 0
          ? pass('seed beats', `${c.beats_count} rows`)
          : fail('seed beats', '0 rows (seed.sql not applied?)'),
      );
      results.push(
        c.layouts_count > 0
          ? pass('seed layouts', `${c.layouts_count} rows`)
          : fail('seed layouts', '0 rows (seed.sql not applied?)'),
      );

      const embeddingCounts = await client.query(`
        SELECT
          (SELECT COUNT(*)::int FROM knowledge WHERE embedding IS NOT NULL) AS knowledge_embedded,
          (SELECT COUNT(*)::int FROM beats WHERE embedding IS NOT NULL) AS beats_embedded,
          (SELECT COUNT(*)::int FROM layouts WHERE embedding IS NOT NULL) AS layouts_embedded
      `);

      const e = embeddingCounts.rows[0] as {
        knowledge_embedded: number;
        beats_embedded: number;
        layouts_embedded: number;
      };

      const embeddedTotal = e.knowledge_embedded + e.beats_embedded + e.layouts_embedded;
      results.push(
        embeddedTotal > 0
          ? pass('embeddings present', `knowledge=${e.knowledge_embedded}, beats=${e.beats_embedded}, layouts=${e.layouts_embedded}`)
          : fail('embeddings present', '0 vectors (run: npm run embeddings or embeddings:mock)'),
      );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    results.push(fail('PostgreSQL connection', msg));
  } finally {
    await client.end().catch(() => undefined);
  }

  print(results);

  const ok = results.every(r => r.ok);
  if (!ok) {
    console.log('');
    console.log('Hints:');
    console.log('- Start DB: docker compose -f docker-compose.daedalus.yml up -d');
    console.log('- Apply schema+seed without resetting volume: cd scripts && npm run init-db');
    console.log('- Generate vectors: cd scripts && npm run embeddings (or embeddings:mock)');
    if (!warnOnly) {
      process.exit(1);
    }
  }
}

main();


