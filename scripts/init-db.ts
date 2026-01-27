import {Client} from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
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

    const schemaPath = path.join(__dirname, '../motion-canvas/db/schema.sql');
    const seedPath = path.join(__dirname, '../motion-canvas/db/seed.sql');

    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      await client.query(schema);
      console.log('Schema applied');
    }

    if (fs.existsSync(seedPath)) {
      const seed = fs.readFileSync(seedPath, 'utf-8');
      await client.query(seed);
      console.log('Seed data inserted');
    }

    const result = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM knowledge) as knowledge_count,
        (SELECT COUNT(*) FROM beats) as beats_count,
        (SELECT COUNT(*) FROM layouts) as layouts_count
    `);

    console.log('Database initialized:');
    console.log(`  Knowledge: ${result.rows[0].knowledge_count} items`);
    console.log(`  Beats: ${result.rows[0].beats_count} items`);
    console.log(`  Layouts: ${result.rows[0].layouts_count} items`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

