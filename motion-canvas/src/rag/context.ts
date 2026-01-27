import type {KnowledgeItem, BeatCatalogItem, LayoutCatalogItem} from './types';

export interface PromptContext {
  rules: string;
  beats: string;
  layouts: string;
  examples: string;
}

function formatKnowledge(items: KnowledgeItem[]): {rules: string; examples: string} {
  const rules = items
    .filter(i => i.category === 'rule')
    .map(i => `[${i.title}] ${i.content}`)
    .join('\n');

  const examples = items
    .filter(i => i.category === 'example')
    .map(i => `[${i.title}] ${i.content}`)
    .join('\n');

  return {rules, examples};
}

function formatBeats(items: BeatCatalogItem[]): string {
  return items
    .map(b => `${b.name}: ${b.description}\n  Example: ${b.exampleYaml}`)
    .join('\n\n');
}

function formatLayouts(items: LayoutCatalogItem[]): string {
  return items
    .map(l => `${l.name}: ${l.description}\n  Slots: ${Object.keys(l.slots).join(', ')}\n  Example: ${l.exampleYaml}`)
    .join('\n\n');
}

export function buildPromptContext(
  knowledge: KnowledgeItem[],
  beats: BeatCatalogItem[],
  layouts: LayoutCatalogItem[],
): PromptContext {
  const {rules, examples} = formatKnowledge(knowledge);

  return {
    rules,
    beats: formatBeats(beats),
    layouts: formatLayouts(layouts),
    examples,
  };
}

export function formatContextForPrompt(ctx: PromptContext): string {
  const sections: string[] = [];

  if (ctx.rules) {
    sections.push(`=== RULES ===\n${ctx.rules}`);
  }

  if (ctx.layouts) {
    sections.push(`=== LAYOUTS ===\n${ctx.layouts}`);
  }

  if (ctx.beats) {
    sections.push(`=== BEATS ===\n${ctx.beats}`);
  }

  if (ctx.examples) {
    sections.push(`=== EXAMPLES ===\n${ctx.examples}`);
  }

  return sections.join('\n\n');
}

