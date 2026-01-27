import {SceneAnalyzer} from './sceneAnalyzer';
import {registerScene, type SceneFeatures} from '../sceneIndex';

interface DiscoveryResult {
  discovered: SceneFeatures[];
  warnings: Map<string, string[]>;
  suggestions: Map<string, string[]>;
}

interface SceneSource {
  id: string;
  code: string;
}

export function discoverScenes(sources: SceneSource[]): DiscoveryResult {
  const analyzer = new SceneAnalyzer();
  const discovered: SceneFeatures[] = [];
  const warnings = new Map<string, string[]>();
  const suggestions = new Map<string, string[]>();

  for (const source of sources) {
    const result = analyzer.analyze(source.id, source.code);
    
    discovered.push(result.features);
    registerScene(result.features);

    if (result.warnings.length > 0) {
      warnings.set(source.id, result.warnings);
    }
    if (result.suggestions.length > 0) {
      suggestions.set(source.id, result.suggestions);
    }
  }

  return {discovered, warnings, suggestions};
}

export function analyzeScene(id: string, code: string): {
  features: SceneFeatures;
  warnings: string[];
  suggestions: string[];
} {
  const analyzer = new SceneAnalyzer();
  return analyzer.analyze(id, code);
}

export function formatDiscoveryReport(result: DiscoveryResult): string {
  const lines: string[] = [];
  
  lines.push(`=== DISCOVERY REPORT ===`);
  lines.push(`Discovered ${result.discovered.length} scenes\n`);

  for (const scene of result.discovered) {
    lines.push(`[${scene.id}]`);
    lines.push(`  Cards: ${scene.cardCount}`);
    lines.push(`  Layout: ${scene.layout ?? 'custom'}`);
    lines.push(`  Theme: ${scene.theme}`);
    lines.push(`  Beats: ${scene.beatsUsed.join(', ') || 'none'}`);
    lines.push(`  Tags: ${scene.tags.join(', ') || 'none'}`);
    lines.push(`  Duration: ~${scene.duration}s`);

    const sceneWarnings = result.warnings.get(scene.id);
    if (sceneWarnings?.length) {
      lines.push(`  ⚠ Warnings:`);
      for (const w of sceneWarnings) {
        lines.push(`    - ${w}`);
      }
    }

    const sceneSuggestions = result.suggestions.get(scene.id);
    if (sceneSuggestions?.length) {
      lines.push(`  💡 Suggestions:`);
      for (const s of sceneSuggestions) {
        lines.push(`    - ${s}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

