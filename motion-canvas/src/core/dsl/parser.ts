import type {
  SceneConfig,
  CardConfig,
  BeatConfig,
  TimelineStep,
  ThemeName,
  BeatType,
} from './types';
import type {PresetName} from '../layouts';
import {validateSceneConfig} from './schema';

export type {SceneConfig, CardConfig, BeatConfig, TimelineStep};

interface RawSceneConfig {
  id?: string;
  layout?: string;
  theme?: string;
  cards?: Record<string, RawCardConfig>;
  content?: Record<string, string>;
  timeline?: RawTimelineStep[];
}

interface RawCardConfig {
  slot?: string;
  content?: string;
  fontSize?: number;
  customTypes?: string[];
}

interface RawBeatConfig {
  type?: string;
  targets?: string[];
  duration?: number;
  delay?: number;
  lines?: number[];
  tokens?: string[];
  color?: string;
  scale?: number;
  direction?: string;
  predicate?: string;
  text?: string;
  hold?: number;
  fadeIn?: number;
  fadeOut?: number;
}

interface RawTimelineStep {
  beat?: RawBeatConfig;
}

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly errors: Array<{path: string; message: string}>,
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

function parseCard(raw: RawCardConfig, slotName: string): CardConfig {
  return {
    slot: raw.slot ?? slotName,
    content: raw.content ?? '',
    fontSize: raw.fontSize,
    customTypes: raw.customTypes,
  };
}

function parseBeat(raw: RawBeatConfig): BeatConfig {
  return {
    type: (raw.type ?? 'wait') as BeatType,
    targets: raw.targets,
    duration: raw.duration,
    delay: raw.delay,
    lines: raw.lines,
    tokens: raw.tokens,
    color: raw.color,
    scale: raw.scale,
    direction: raw.direction as 'left' | 'right' | 'up' | 'down' | undefined,
    predicate: raw.predicate,
    text: raw.text,
    hold: raw.hold,
    fadeIn: raw.fadeIn,
    fadeOut: raw.fadeOut,
  };
}

function parseTimelineStep(raw: RawTimelineStep): TimelineStep {
  return {
    beat: parseBeat(raw.beat ?? {}),
  };
}

export function parseSceneConfig(raw: unknown): SceneConfig {
  const validation = validateSceneConfig(raw);
  
  if (!validation.valid) {
    throw new ParseError(
      'Invalid scene configuration',
      'config',
      validation.errors,
    );
  }

  const data = raw as RawSceneConfig;

  const cards: Record<string, CardConfig> = {};
  if (data.cards) {
    for (const [name, cardData] of Object.entries(data.cards)) {
      cards[name] = parseCard(cardData, name);
    }
  }

  const timeline: TimelineStep[] = (data.timeline ?? []).map(parseTimelineStep);

  return {
    id: data.id ?? 'unnamed',
    layout: (data.layout ?? 'center') as PresetName,
    theme: (data.theme ?? 'dark') as ThemeName,
    cards,
    content: data.content,
    timeline,
  };
}

export function serializeSceneConfig(config: SceneConfig): string {
  return JSON.stringify(config, null, 2);
}

