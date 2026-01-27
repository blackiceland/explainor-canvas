import type {SceneFeatures} from '../sceneIndex';
import type {PresetName} from '../../core/layouts';

interface AnalysisResult {
  features: SceneFeatures;
  warnings: string[];
  suggestions: string[];
}

const BEAT_PATTERNS: Record<string, RegExp> = {
  appear: /\.appear\(|yield\*\s*appear\(/,
  disappear: /\.disappear\(|yield\*\s*disappear\(/,
  appearStaggered: /appearStaggered\(/,
  highlightLines: /highlightLines\(/,
  recolorLine: /recolorLine\(/,
  recolorTokens: /recolorTokens\(/,
  showAllLines: /showAllLines\(/,
  knowledgeScan: /knowledgeScan\(/,
  scanTableColumn: /scanTableColumn\(/,
  filterRows: /filterRows\(/,
  crossfade: /crossfade\(/,
  zoomReveal: /zoomReveal\(|\.scale\([^)]*,.*easeInOut/,
  swipeReveal: /swipeReveal\(/,
  titleFade: /titleFade\(/,
  typewriter: /typewriter\(/,
  cursorBlink: /cursorBlink\(/,
  morphRect: /morphRect\(|\.fill\([^)]*,.*duration/,
  morphGradient: /gradient.*duration|duration.*gradient/i,
  moveTo: /moveTo\(|\.position\([^)]*,.*duration/,
  scaleTo: /scaleTo\(|\.scale\([^)]*,.*duration/,
};

const LAYOUT_PATTERNS: Record<PresetName, RegExp> = {
  '2-col': /getSlots\s*\(\s*['"]2-col['"]\s*\)/,
  '2L-1R': /getSlots\s*\(\s*['"]2L-1R['"]\s*\)/,
  '2L-2R': /getSlots\s*\(\s*['"]2L-2R['"]\s*\)/,
  'split-vertical': /getSlots\s*\(\s*['"]split-vertical['"]\s*\)|Screen\.width\s*\/\s*2/,
  'center': /getSlots\s*\(\s*['"]center['"]\s*\)/,
  'center-title': /getSlots\s*\(\s*['"]center-title['"]\s*\)/,
};

export class SceneAnalyzer {
  analyze(sceneId: string, sourceCode: string): AnalysisResult {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    const beatsUsed = this.detectBeats(sourceCode);
    const layout = this.detectLayout(sourceCode);
    const cardCount = this.countCards(sourceCode);
    const theme = this.detectTheme(sourceCode);
    const duration = this.estimateDuration(sourceCode);

    if (!layout) {
      warnings.push('No layout preset detected. Consider using getSlots().');
    }

    if (cardCount > 0 && beatsUsed.length === 0) {
      warnings.push('Cards detected but no animation beats found.');
    }

    if (this.hasMagicNumbers(sourceCode)) {
      suggestions.push('Magic numbers detected. Use Timing constants.');
    }

    if (this.hasRawCoordinates(sourceCode)) {
      suggestions.push('Raw coordinates detected. Use getSlots() for positioning.');
    }

    const features: SceneFeatures = {
      id: sceneId,
      cardCount,
      layout,
      theme,
      beatsUsed,
      hasHighlight: beatsUsed.some(b => b.includes('highlight') || b.includes('recolor')),
      hasZoom: beatsUsed.includes('zoomReveal') || beatsUsed.includes('scaleTo'),
      hasTypewriter: beatsUsed.includes('typewriter'),
      hasCrossfade: beatsUsed.includes('crossfade'),
      hasTable: /createRef<Rect>\[\]|rows.*Rect|scanTableColumn/.test(sourceCode),
      duration,
      description: '',
      tags: this.inferTags(sourceCode, beatsUsed),
    };

    return {features, warnings, suggestions};
  }

  private detectBeats(code: string): string[] {
    const found: string[] = [];
    for (const [beat, pattern] of Object.entries(BEAT_PATTERNS)) {
      if (pattern.test(code)) {
        found.push(beat);
      }
    }
    return found;
  }

  private detectLayout(code: string): PresetName | null {
    for (const [layout, pattern] of Object.entries(LAYOUT_PATTERNS)) {
      if (pattern.test(code)) {
        return layout as PresetName;
      }
    }
    return null;
  }

  private countCards(code: string): number {
    const codeBlockRefs = (code.match(/createRef<CodeBlock>/g) || []).length;
    const rectRefs = (code.match(/createRef<Rect>/g) || []).length;
    const cardMatches = (code.match(/Card|card|CODE.*=.*`/gi) || []).length;
    return Math.max(codeBlockRefs, Math.floor(rectRefs / 2), Math.floor(cardMatches / 2));
  }

  private detectTheme(code: string): 'dark' | 'light' | 'mixed' {
    const hasDark = /Colors\.|PanelStyle|#0B0C10|#1B1D24/.test(code);
    const hasLight = /OpenStyle|#E7E1D8|#FFFDF8/.test(code);
    if (hasDark && hasLight) return 'mixed';
    if (hasLight) return 'light';
    return 'dark';
  }

  private estimateDuration(code: string): number {
    const waitForCalls = code.match(/waitFor\s*\(\s*([\d.]+)\s*\)/g) || [];
    const timingCalls = code.match(/Timing\.(fast|normal|slow)/g) || [];
    
    let total = 0;
    for (const call of waitForCalls) {
      const match = call.match(/([\d.]+)/);
      if (match) total += parseFloat(match[1]);
    }
    for (const call of timingCalls) {
      if (call.includes('fast')) total += 0.3;
      else if (call.includes('normal')) total += 0.6;
      else if (call.includes('slow')) total += 1.1;
    }
    return Math.round(total);
  }

  private hasMagicNumbers(code: string): boolean {
    const suspiciousNumbers = code.match(/,\s*(0\.\d+)\s*[,)]/g) || [];
    return suspiciousNumbers.some(n => {
      const val = parseFloat(n.match(/(0\.\d+)/)?.[1] || '0');
      return val !== 0.3 && val !== 0.6 && val !== 1.1 && val > 0.1 && val < 3;
    });
  }

  private hasRawCoordinates(code: string): boolean {
    return /[xy]\s*[:=]\s*-?\d{2,}/.test(code) && !/SafeZone|getSlots|Screen\./.test(code);
  }

  private inferTags(code: string, beats: string[]): string[] {
    const tags: string[] = [];

    if (/CodeBlock|Code\s*code=/.test(code)) tags.push('code');
    if (/Rect.*rows|table|Table/.test(code)) tags.push('table');
    if (/chapter|Chapter|CHAPTER/.test(code)) tags.push('chapter');
    if (/intro|Intro/.test(code)) tags.push('intro');
    if (/quote|Quote|"—/.test(code)) tags.push('quote');
    if (/form|Form|input|Input/.test(code)) tags.push('form');
    if (/dto|Dto|DTO/.test(code)) tags.push('dto');
    if (/mapper|Mapper/.test(code)) tags.push('mapper');
    if (/filter|Filter/.test(code)) tags.push('filter');

    if (beats.includes('highlightLines') || beats.includes('recolorLine')) {
      tags.push('highlight');
    }
    if (beats.includes('zoomReveal')) tags.push('zoom');
    if (beats.includes('typewriter')) tags.push('typewriter');

    return [...new Set(tags)];
  }
}

