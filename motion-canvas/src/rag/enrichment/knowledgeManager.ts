import type {KnowledgeItem} from '../types';

type KnowledgeCategory = 'rule' | 'example' | 'pattern' | 'antipattern';

interface AddKnowledgeInput {
  category: KnowledgeCategory;
  title: string;
  content: string;
  tags?: string[];
}

interface UpdateKnowledgeInput {
  title?: string;
  content?: string;
  tags?: string[];
}

export class KnowledgeManager {
  private items: Map<number, KnowledgeItem> = new Map();
  private nextId: number = 1;

  add(input: AddKnowledgeInput): KnowledgeItem {
    const item: KnowledgeItem = {
      id: this.nextId++,
      category: input.category,
      title: input.title,
      content: input.content,
      tags: input.tags ?? [],
    };
    this.items.set(item.id, item);
    return item;
  }

  update(id: number, input: UpdateKnowledgeInput): KnowledgeItem | null {
    const item = this.items.get(id);
    if (!item) return null;

    const updated: KnowledgeItem = {
      ...item,
      title: input.title ?? item.title,
      content: input.content ?? item.content,
      tags: input.tags ?? item.tags,
    };
    this.items.set(id, updated);
    return updated;
  }

  delete(id: number): boolean {
    return this.items.delete(id);
  }

  get(id: number): KnowledgeItem | undefined {
    return this.items.get(id);
  }

  getByCategory(category: KnowledgeCategory): KnowledgeItem[] {
    return Array.from(this.items.values()).filter(i => i.category === category);
  }

  getByTag(tag: string): KnowledgeItem[] {
    return Array.from(this.items.values()).filter(i => i.tags.includes(tag));
  }

  search(query: string): KnowledgeItem[] {
    const lower = query.toLowerCase();
    return Array.from(this.items.values()).filter(
      i =>
        i.title.toLowerCase().includes(lower) ||
        i.content.toLowerCase().includes(lower) ||
        i.tags.some(t => t.toLowerCase().includes(lower)),
    );
  }

  getAll(): KnowledgeItem[] {
    return Array.from(this.items.values());
  }

  addRule(title: string, content: string, tags?: string[]): KnowledgeItem {
    return this.add({category: 'rule', title, content, tags});
  }

  addExample(title: string, content: string, tags?: string[]): KnowledgeItem {
    return this.add({category: 'example', title, content, tags});
  }

  addPattern(title: string, content: string, tags?: string[]): KnowledgeItem {
    return this.add({category: 'pattern', title, content, tags});
  }

  addAntipattern(title: string, content: string, tags?: string[]): KnowledgeItem {
    return this.add({category: 'antipattern', title, content, tags});
  }

  exportToSQL(): string {
    const lines: string[] = [];
    for (const item of this.items.values()) {
      const tags = item.tags.length > 0 ? `ARRAY[${item.tags.map(t => `'${t}'`).join(', ')}]` : "'{}'";
      const escaped = item.content.replace(/'/g, "''");
      lines.push(
        `INSERT INTO knowledge (category, title, content, tags) VALUES ('${item.category}', '${item.title}', '${escaped}', ${tags});`,
      );
    }
    return lines.join('\n');
  }

  importFromJSON(json: KnowledgeItem[]): void {
    for (const item of json) {
      this.items.set(item.id, item);
      if (item.id >= this.nextId) {
        this.nextId = item.id + 1;
      }
    }
  }
}

export const globalKnowledgeManager = new KnowledgeManager();

