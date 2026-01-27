import {RagClient, type RagConfig} from './client';
import {initSceneRegistry} from './sceneRegistry';
import {globalBeatCatalog} from './enrichment/beatCatalog';
import {globalKnowledgeManager} from './enrichment/knowledgeManager';

export interface DaedalusConfig {
  postgres?: {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    connectionString?: string;
  };
  openai?: {
    apiKey?: string;
    model?: string;
  };
  useMock?: boolean;
}

export interface DaedalusInstance {
  rag: RagClient;
  ready: boolean;
  mode: 'database' | 'mock';
}

let instance: DaedalusInstance | null = null;

export async function initDaedalus(config: DaedalusConfig = {}): Promise<DaedalusInstance> {
  if (instance?.ready) {
    return instance;
  }

  const ragConfig: RagConfig = {
    host: config.postgres?.host ?? process.env.POSTGRES_HOST ?? 'localhost',
    port: config.postgres?.port ?? parseInt(process.env.POSTGRES_PORT ?? '5433'),
    user: config.postgres?.user ?? process.env.POSTGRES_USER ?? 'daedalus',
    password: config.postgres?.password ?? process.env.POSTGRES_PASSWORD ?? 'daedalus',
    database: config.postgres?.database ?? process.env.POSTGRES_DB ?? 'daedalus',
    connectionString: config.postgres?.connectionString,
    embeddingProvider: config.useMock ? 'mock' : 'openai',
    embeddingModel: config.openai?.model ?? process.env.EMBEDDING_MODEL,
    apiKey: config.openai?.apiKey ?? process.env.OPENAI_API_KEY,
  };

  const rag = new RagClient(ragConfig);

  try {
    await rag.connect();
  } catch {
    console.warn('DAEDALUS: Database connection failed, running in mock mode');
  }

  initSceneRegistry();
  globalBeatCatalog.initDefaults();
  initDefaultKnowledge();

  instance = {
    rag,
    ready: true,
    mode: rag.isUsingDatabase() ? 'database' : 'mock',
  };

  console.log(`DAEDALUS initialized in ${instance.mode} mode`);

  return instance;
}

export function getDaedalus(): DaedalusInstance {
  if (!instance?.ready) {
    throw new Error('DAEDALUS not initialized. Call initDaedalus() first.');
  }
  return instance;
}

export async function shutdownDaedalus(): Promise<void> {
  if (instance?.rag) {
    await instance.rag.disconnect();
  }
  instance = null;
}

function initDefaultKnowledge(): void {
  globalKnowledgeManager.addRule(
    'Safe Zone',
    'Screen: 1920x1080, center at (0,0). SafeZone: top=-480, bottom=480, left=-840, right=840. Never position outside.',
    ['layout', 'positioning', 'boundaries']
  );

  globalKnowledgeManager.addRule(
    'Font Size',
    'Minimum font size is 14px. Code cards: small=14-16, medium=18-20, large=22-24.',
    ['typography', 'font', 'code']
  );

  globalKnowledgeManager.addRule(
    'Timing Constants',
    'Use Timing.fast=0.3, Timing.normal=0.6, Timing.slow=1.1. Never raw numbers.',
    ['animation', 'timing', 'duration']
  );

  globalKnowledgeManager.addRule(
    'Layout Presets',
    'Use getSlots(preset) for positioning. Presets: 2-col, 2L-1R, 2L-2R, split-vertical, center, center-title.',
    ['layout', 'positioning', 'presets']
  );

  globalKnowledgeManager.addRule(
    'Light Theme Services',
    'Services in light theme are DARK circles (#151515) with WHITE text. Radius 150-175px. Never rectangles. Never bright colors.',
    ['light-theme', 'services', 'circles']
  );

  globalKnowledgeManager.addRule(
    'Light Theme Wires',
    'Wires: rgba(21,21,21,0.55) semi-transparent, 1px, round lineCap. Port dots: 20px blue (#486EA2). Packet dots: 16px transport (#B07C46).',
    ['light-theme', 'wires', 'connectors']
  );

  globalKnowledgeManager.addRule(
    'Light Theme Cards',
    'Fill: #F6F1E8 cream. Stroke: #CFC6BA 1px. Shadow: rgba(21,21,21,0.18) blur 24 offset (-8,12). Radius: 22px. Padding: 18px/16px.',
    ['light-theme', 'cards', 'styling']
  );

  globalKnowledgeManager.addRule(
    'Dark Theme Cards',
    'Fill: #1B1D24. Stroke: #262A34 1px. Shadow: rgba(0,0,0,0.50) blur 44 offset (-16,22). Radius: 28px large, 22px small.',
    ['dark-theme', 'cards', 'styling']
  );

  globalKnowledgeManager.addRule(
    'Animation Easing',
    'Default: easeInOutCubic. Linear: only for constant-velocity (packets). NEVER bounce, elastic, overshoot.',
    ['animation', 'easing']
  );

  globalKnowledgeManager.addRule(
    'Animation Timing Ratios',
    'Hold before: 0.2-0.5s. Hold after: 0.3-0.6s. Between sequences: 0.4-1.0s. Stagger: 0.15-0.3s. Never rush, never drag.',
    ['animation', 'timing', 'rhythm']
  );

  globalKnowledgeManager.addRule(
    'Typography Fonts',
    'Sans: Space Grotesk (primary), Inter (fallback). Mono: JetBrains Mono. NEVER Arial, Roboto, system fonts.',
    ['typography', 'fonts']
  );

  globalKnowledgeManager.addRule(
    'Status Colors',
    'Use colored TEXT not badges. Success mint: rgba(155,227,197,0.86). Pending sky: rgba(163,205,255,0.86). Error rose: rgba(255,170,185,0.86).',
    ['colors', 'status', 'tables']
  );

  globalKnowledgeManager.addPattern(
    'Code Comparison Scene',
    'Layout: 2-col or 2L-1R. Sequence: appearStaggered → highlightLines → recolorTokens → reset.',
    ['scene', 'code', 'comparison']
  );

  globalKnowledgeManager.addPattern(
    'Chapter Intro Scene',
    'Layout: center-title. CHAPTER N (large, N is pink) + subtitle (smaller). Animation: titleFade.',
    ['scene', 'intro', 'chapter']
  );

  globalKnowledgeManager.addPattern(
    'Knowledge Scan Scene',
    'Layout: 2L-1R. Sequence: appearStaggered → knowledgeScan across cards → break animation → zoomReveal solution.',
    ['scene', 'knowledge', 'duplication']
  );

  globalKnowledgeManager.addPattern(
    'Service Diagram Scene',
    'Light theme. Services: dark circles R=150-175. Wires: semi-transparent horizontal. Labels above wires. Port dots where data enters/exits.',
    ['scene', 'services', 'light-theme']
  );

  globalKnowledgeManager.addAntipattern(
    'Color Antipatterns',
    'NEVER: bright saturated backgrounds, rainbow schemes, pure black (#000), cold/blue whites, gradient fills on shapes.',
    ['antipattern', 'colors']
  );

  globalKnowledgeManager.addAntipattern(
    'Typography Antipatterns',
    'NEVER: font < 14px, system fonts, decorative fonts, centered body text, letter-spacing on body.',
    ['antipattern', 'typography']
  );

  globalKnowledgeManager.addAntipattern(
    'Geometry Antipatterns',
    'NEVER: rectangles for services (use circles), corners > 28px, decorative shadows, 3D effects.',
    ['antipattern', 'geometry']
  );

  globalKnowledgeManager.addAntipattern(
    'Animation Antipatterns',
    'NEVER: bounce/elastic easing, arbitrary timing, constant motion without rest, flash/blink effects.',
    ['antipattern', 'animation']
  );
}

