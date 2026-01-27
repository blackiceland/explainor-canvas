import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as path from 'node:path';
import {Client} from 'pg';

type RunResult = {code: number; stdout: string; stderr: string};

function run(cmd: string, args: string[], cwd: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {cwd, shell: true});
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => (stdout += String(d)));
    child.stderr.on('data', d => (stderr += String(d)));
    child.on('close', code => resolve({code: code ?? 1, stdout, stderr}));
  });
}

async function waitForPostgresReady(clientConfig: {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}) {
  const deadlineMs = Date.now() + 45_000;
  let lastError = '';

  while (Date.now() < deadlineMs) {
    const client = new Client(clientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      await client.end().catch(() => undefined);
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  throw new Error(`PostgreSQL not ready within 45s: ${lastError}`);
}

async function getCounts(client: Client) {
  const res = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM knowledge) AS knowledge_count,
      (SELECT COUNT(*)::int FROM beats) AS beats_count,
      (SELECT COUNT(*)::int FROM layouts) AS layouts_count
  `);
  const row = res.rows[0] as {knowledge_count: number; beats_count: number; layouts_count: number};
  return row;
}

async function getEmbeddingCounts(client: Client) {
  const res = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM knowledge WHERE embedding IS NOT NULL) AS knowledge_embedded,
      (SELECT COUNT(*)::int FROM beats WHERE embedding IS NOT NULL) AS beats_embedded,
      (SELECT COUNT(*)::int FROM layouts WHERE embedding IS NOT NULL) AS layouts_embedded
  `);
  const row = res.rows[0] as {knowledge_embedded: number; beats_embedded: number; layouts_embedded: number};
  return row;
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..');
  const scriptsDir = here;
  const composeFile = path.join(repoRoot, 'docker-compose.daedalus.yml');

  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = parseInt(process.env.POSTGRES_PORT || '5433');
  const user = process.env.POSTGRES_USER || 'daedalus';
  const password = process.env.POSTGRES_PASSWORD || 'daedalus';
  const database = process.env.POSTGRES_DB || 'daedalus';

  const clientConfig = {host, port, user, password, database};

  const dockerV = await run('docker', ['version'], repoRoot);
  if (dockerV.code !== 0) {
    console.error(dockerV.stderr || dockerV.stdout);
    process.exit(1);
  }

  const composeV = await run('docker', ['compose', 'version'], repoRoot);
  if (composeV.code !== 0) {
    console.error(composeV.stderr || composeV.stdout);
    process.exit(1);
  }

  const up = await run('docker', ['compose', '-f', composeFile, 'up', '-d'], repoRoot);
  if (up.code !== 0) {
    console.error(up.stderr || up.stdout);
    process.exit(1);
  }

  await waitForPostgresReady(clientConfig);

  const client = new Client(clientConfig);
  await client.connect();

  const counts = await getCounts(client).catch(async () => {
    await client.end();
    console.error('Schema not applied or tables missing. Run: npm run init-db');
    process.exit(1);
  });

  const emptyAll = counts.beats_count === 0 && counts.layouts_count === 0 && counts.knowledge_count === 0;
  const partial =
    (counts.beats_count === 0 || counts.layouts_count === 0 || counts.knowledge_count === 0) && !emptyAll;

  if (emptyAll) {
    await client.end();
    const init = await run('npm', ['run', '-s', 'init-db'], scriptsDir);
    if (init.code !== 0) {
      console.error(init.stderr || init.stdout);
      process.exit(1);
    }
  } else if (partial) {
    console.log(
      `WARN  partial seed state: knowledge=${counts.knowledge_count}, beats=${counts.beats_count}, layouts=${counts.layouts_count}`,
    );
    console.log('WARN  recommended: fix manually or reset local volume');
  } else {
    await client.end();
  }

  const hc = await run('npm', ['run', '-s', 'healthcheck:warn'], scriptsDir);
  process.stdout.write(hc.stdout);
  if (hc.code !== 0) {
    process.stderr.write(hc.stderr);
  }

  const after = new Client(clientConfig);
  await after.connect();
  const embeddings = await getEmbeddingCounts(after);
  await after.end();

  const embeddedTotal = embeddings.knowledge_embedded + embeddings.beats_embedded + embeddings.layouts_embedded;
  if (embeddedTotal === 0 && !process.env.OPENAI_API_KEY) {
    const mock = await run('npm', ['run', '-s', 'embeddings:mock'], scriptsDir);
    if (mock.code === 0) {
      console.log('');
      console.log('OK   embeddings:mock generated (for local development)');
    } else {
      console.log('');
      console.log('WARN embeddings missing; embeddings:mock failed');
    }
  } else if (embeddedTotal === 0 && process.env.OPENAI_API_KEY) {
    console.log('');
    console.log('WARN embeddings missing; run: cd scripts && npm run embeddings');
  }
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`Error: ${msg}`);
  process.exit(1);
});


