import type {PresetName} from '../layouts';

export type ThemeName = 'dark' | 'light';

export type BeatType =
  | 'appear'
  | 'appear-staggered'
  | 'disappear'
  | 'highlight-lines'
  | 'recolor-line'
  | 'recolor-tokens'
  | 'reset-highlight'
  | 'scan-knowledge'
  | 'pulse-cell'
  | 'filter-rows'
  | 'crossfade'
  | 'move-to'
  | 'scale-to'
  | 'zoom-reveal'
  | 'swipe-reveal'
  | 'title-fade'
  | 'typewriter'
  | 'wait';

export interface CardConfig {
  slot: string;
  content: string;
  fontSize?: number;
  customTypes?: string[];
}

export interface BeatConfig {
  type: BeatType;
  targets?: string[];
  duration?: number;
  delay?: number;
  lines?: number[];
  tokens?: string[];
  color?: string;
  scale?: number;
  direction?: 'left' | 'right' | 'up' | 'down';
  predicate?: string;
  text?: string;
  hold?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface TimelineStep {
  beat: BeatConfig;
}

export interface SceneConfig {
  id: string;
  layout: PresetName;
  theme: ThemeName;
  cards: Record<string, CardConfig>;
  content?: Record<string, string>;
  timeline: TimelineStep[];
}

