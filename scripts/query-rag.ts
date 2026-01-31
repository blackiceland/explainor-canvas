import {initDaedalus} from '../motion-canvas/src/rag/init';

interface QueryOptions {
  query: string;
  category?: string;
  limit?: number;
  searchLayouts?: boolean;
  searchBeats?: boolean;
  useMock?: boolean;
}

async function queryKnowledge(query: string, category?: string, limit: number = 5, useMock: boolean = false) {
  const daedalus = await initDaedalus({useMock});
  const result = await daedalus.rag.searchKnowledge(query, limit, category);
  await daedalus.rag.disconnect();
  return result;
}

async function queryLayouts(query: string, limit: number = 3, useMock: boolean = false) {
  const daedalus = await initDaedalus({useMock});
  const result = await daedalus.rag.searchLayouts(query, limit);
  await daedalus.rag.disconnect();
  return result;
}

async function queryBeats(query: string, limit: number = 3, category?: string, useMock: boolean = false) {
  const daedalus = await initDaedalus({useMock});
  const result = await daedalus.rag.searchBeats(query, limit, category);
  await daedalus.rag.disconnect();
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run query-rag [options] <query>

Query DAEDALUS RAG system for knowledge, layouts, or beats.

Options:
  --category <category>    Filter by category (rule, example, philosophy, antipattern)
  --limit <number>         Number of results (default: 5)
  --layouts                Search layouts instead of knowledge
  --beats                  Search beats instead of knowledge
  --beat-category <cat>   Beat category filter (appear, highlight, transition, etc.)
  --mock                   Force mock embeddings (still uses DB if available)

Examples:
  npm run query-rag "layout positioning top padding"
  npm run query-rag "2L-2R layout" --layouts
  npm run query-rag "highlight animation" --beats
  npm run query-rag "safe zone" --category rule
    `);
    process.exit(0);
  }

  const query = args.filter(a => !a.startsWith('--')).join(' ');
  if (!query) {
    console.error('Error: Query string is required');
    process.exit(1);
  }

  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex >= 0 && args[limitIndex + 1] 
    ? parseInt(args[limitIndex + 1], 10) 
    : 5;

  const categoryIndex = args.indexOf('--category');
  const category = categoryIndex >= 0 ? args[categoryIndex + 1] : undefined;

  const searchLayouts = args.includes('--layouts');
  const searchBeats = args.includes('--beats');
  const useMock = args.includes('--mock');

  const beatCategoryIndex = args.indexOf('--beat-category');
  const beatCategory = beatCategoryIndex >= 0 ? args[beatCategoryIndex + 1] : undefined;

  try {
    if (searchLayouts) {
      console.log(`\n=== Searching Layouts: "${query}" ===`);
      const result = await queryLayouts(query, limit, useMock);
      console.log(`Found ${result.totalFound} layouts:\n`);
      result.items.forEach((item, i) => {
        console.log(`${i + 1}. ${item.name} (similarity: ${item.similarity.toFixed(3)})`);
        console.log(`   Description: ${item.description}`);
        console.log(`   Slots:`, JSON.stringify(item.slots, null, 2));
        if (item.exampleYaml) {
          console.log(`   Example:\n${item.exampleYaml}`);
        }
        console.log('');
      });
    } else if (searchBeats) {
      console.log(`\n=== Searching Beats: "${query}" ===`);
      const result = await queryBeats(query, limit, beatCategory, useMock);
      console.log(`Found ${result.totalFound} beats:\n`);
      result.items.forEach((item, i) => {
        console.log(`${i + 1}. ${item.name} (similarity: ${item.similarity.toFixed(3)})`);
        console.log(`   Category: ${item.category}`);
        console.log(`   Description: ${item.description}`);
        if (item.params) {
          console.log(`   Params: ${JSON.stringify(item.params)}`);
        }
        if (item.exampleYaml) {
          console.log(`   Example:\n${item.exampleYaml}`);
        }
        console.log('');
      });
    } else {
      console.log(`\n=== Searching Knowledge: "${query}" ===`);
      if (category) {
        console.log(`Category filter: ${category}`);
      }
      const result = await queryKnowledge(query, category, limit, useMock);
      console.log(`Found ${result.totalFound} results:\n`);
      result.items.forEach((item, i) => {
        console.log(`${i + 1}. [${item.category}] ${item.title} (similarity: ${item.similarity.toFixed(3)})`);
        console.log(`   ${item.content}`);
        if (item.tags.length > 0) {
          console.log(`   Tags: ${item.tags.join(', ')}`);
        }
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();

