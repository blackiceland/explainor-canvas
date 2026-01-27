import type {BeatCatalogItem} from '../types';

type BeatCategory = 'appear' | 'highlight' | 'transition' | 'timing' | 'title' | 'text';

interface AddBeatInput {
  name: string;
  description: string;
  params: Record<string, string>;
  category: BeatCategory;
  exampleYaml?: string;
}

export class BeatCatalog {
  private beats: Map<string, BeatCatalogItem> = new Map();

  add(input: AddBeatInput): BeatCatalogItem {
    const item: BeatCatalogItem = {
      name: input.name,
      description: input.description,
      params: input.params,
      category: input.category,
      exampleYaml: input.exampleYaml ?? this.generateExample(input),
    };
    this.beats.set(item.name, item);
    return item;
  }

  update(name: string, input: Partial<AddBeatInput>): BeatCatalogItem | null {
    const item = this.beats.get(name);
    if (!item) return null;

    const updated: BeatCatalogItem = {
      ...item,
      description: input.description ?? item.description,
      params: input.params ?? item.params,
      category: input.category ?? item.category,
      exampleYaml: input.exampleYaml ?? item.exampleYaml,
    };
    this.beats.set(name, updated);
    return updated;
  }

  delete(name: string): boolean {
    return this.beats.delete(name);
  }

  get(name: string): BeatCatalogItem | undefined {
    return this.beats.get(name);
  }

  getByCategory(category: BeatCategory): BeatCatalogItem[] {
    return Array.from(this.beats.values()).filter(b => b.category === category);
  }

  search(query: string): BeatCatalogItem[] {
    const lower = query.toLowerCase();
    return Array.from(this.beats.values()).filter(
      b =>
        b.name.toLowerCase().includes(lower) ||
        b.description.toLowerCase().includes(lower),
    );
  }

  getAll(): BeatCatalogItem[] {
    return Array.from(this.beats.values());
  }

  private generateExample(input: AddBeatInput): string {
    const params = Object.entries(input.params)
      .map(([k, v]) => {
        if (v === 'number') return `${k}: 1.0`;
        if (v === 'number[]') return `${k}: [0, 1, 2]`;
        if (v === 'string') return `${k}: "value"`;
        if (v === 'string[]') return `${k}: ["a", "b"]`;
        return `${k}: null`;
      })
      .join(', ');

    return `beat: {type: ${input.name}, targets: [card1]${params ? ', ' + params : ''}}`;
  }

  exportToSQL(): string {
    const lines: string[] = [];
    for (const beat of this.beats.values()) {
      const paramsJson = JSON.stringify(beat.params).replace(/'/g, "''");
      const escaped = beat.exampleYaml.replace(/'/g, "''");
      lines.push(
        `INSERT INTO beats (name, description, params, category, example_yaml) VALUES ('${beat.name}', '${beat.description}', '${paramsJson}', '${beat.category}', '${escaped}');`,
      );
    }
    return lines.join('\n');
  }

  initDefaults(): void {
    this.add({
      name: 'appear',
      description: 'Fade in a component',
      params: {duration: 'number'},
      category: 'appear',
    });
    this.add({
      name: 'appear-staggered',
      description: 'Fade in components sequentially',
      params: {delay: 'number', duration: 'number'},
      category: 'appear',
    });
    this.add({
      name: 'disappear',
      description: 'Fade out components',
      params: {duration: 'number'},
      category: 'appear',
    });
    this.add({
      name: 'highlight-lines',
      description: 'Dim all lines except specified ranges',
      params: {lines: 'number[]', duration: 'number'},
      category: 'highlight',
    });
    this.add({
      name: 'recolor-line',
      description: 'Change color of a specific line',
      params: {lines: 'number[]', color: 'string', duration: 'number'},
      category: 'highlight',
    });
    this.add({
      name: 'recolor-tokens',
      description: 'Change color of specific tokens',
      params: {lines: 'number[]', tokens: 'string[]', color: 'string'},
      category: 'highlight',
    });
    this.add({
      name: 'scan-knowledge',
      description: 'Highlight lines across multiple cards',
      params: {lines: 'number[]', hold: 'number'},
      category: 'highlight',
    });
    this.add({
      name: 'crossfade',
      description: 'Crossfade between two components',
      params: {duration: 'number'},
      category: 'transition',
    });
    this.add({
      name: 'zoom-reveal',
      description: 'Zoom into card and reveal content',
      params: {scale: 'number', duration: 'number'},
      category: 'transition',
    });
    this.add({
      name: 'swipe-reveal',
      description: 'Slide overlay to reveal background',
      params: {direction: 'string', duration: 'number'},
      category: 'transition',
    });
    this.add({
      name: 'title-fade',
      description: 'Fade in, hold, fade out for titles',
      params: {fadeIn: 'number', hold: 'number', fadeOut: 'number'},
      category: 'title',
    });
    this.add({
      name: 'typewriter',
      description: 'Type text character by character',
      params: {charDelay: 'number'},
      category: 'text',
    });
    this.add({
      name: 'cursor-blink',
      description: 'Blinking cursor animation',
      params: {duration: 'number', step: 'number'},
      category: 'text',
    });
    this.add({
      name: 'wait',
      description: 'Pause for specified duration',
      params: {duration: 'number'},
      category: 'timing',
    });
  }
}

export const globalBeatCatalog = new BeatCatalog();

