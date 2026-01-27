import type {SceneConfig, BeatType, ThemeName} from './types';
import type {PresetName} from '../layouts';

const VALID_PRESETS: PresetName[] = [
  '2-col',
  '2L-1R',
  '2L-2R',
  'split-vertical',
  'center',
  'center-title',
];

const VALID_THEMES: ThemeName[] = ['dark', 'light'];

const VALID_BEATS: BeatType[] = [
  'appear',
  'appear-staggered',
  'disappear',
  'highlight-lines',
  'recolor-line',
  'recolor-tokens',
  'reset-highlight',
  'scan-knowledge',
  'pulse-cell',
  'filter-rows',
  'crossfade',
  'move-to',
  'scale-to',
  'zoom-reveal',
  'swipe-reveal',
  'title-fade',
  'typewriter',
  'wait',
];

export interface SchemaError {
  path: string;
  message: string;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: SchemaError[];
}

export const SceneConfigSchema = {
  presets: VALID_PRESETS,
  themes: VALID_THEMES,
  beats: VALID_BEATS,
};

function validateString(value: unknown, path: string): SchemaError | null {
  if (typeof value !== 'string' || value.length === 0) {
    return {path, message: 'must be a non-empty string'};
  }
  return null;
}

function validateEnum<T>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): SchemaError | null {
  if (!allowed.includes(value as T)) {
    return {path, message: `must be one of: ${allowed.join(', ')}`};
  }
  return null;
}

function validateNumber(
  value: unknown,
  path: string,
  min?: number,
  max?: number,
): SchemaError | null {
  if (typeof value !== 'number' || isNaN(value)) {
    return {path, message: 'must be a number'};
  }
  if (min !== undefined && value < min) {
    return {path, message: `must be >= ${min}`};
  }
  if (max !== undefined && value > max) {
    return {path, message: `must be <= ${max}`};
  }
  return null;
}

function validateArray(value: unknown, path: string): SchemaError | null {
  if (!Array.isArray(value)) {
    return {path, message: 'must be an array'};
  }
  return null;
}

function validateObject(value: unknown, path: string): SchemaError | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {path, message: 'must be an object'};
  }
  return null;
}

export function validateSceneConfig(config: unknown): SchemaValidationResult {
  const errors: SchemaError[] = [];

  const objError = validateObject(config, 'config');
  if (objError) {
    return {valid: false, errors: [objError]};
  }

  const cfg = config as Record<string, unknown>;

  const idError = validateString(cfg.id, 'config.id');
  if (idError) errors.push(idError);

  const layoutError = validateEnum(cfg.layout, VALID_PRESETS, 'config.layout');
  if (layoutError) errors.push(layoutError);

  const themeError = validateEnum(cfg.theme, VALID_THEMES, 'config.theme');
  if (themeError) errors.push(themeError);

  const cardsError = validateObject(cfg.cards, 'config.cards');
  if (cardsError) {
    errors.push(cardsError);
  } else {
    const cards = cfg.cards as Record<string, unknown>;
    for (const [slotName, cardCfg] of Object.entries(cards)) {
      const cardPath = `config.cards.${slotName}`;
      const cardObjError = validateObject(cardCfg, cardPath);
      if (cardObjError) {
        errors.push(cardObjError);
        continue;
      }
      const card = cardCfg as Record<string, unknown>;
      
      const slotError = validateString(card.slot, `${cardPath}.slot`);
      if (slotError) errors.push(slotError);

      const contentError = validateString(card.content, `${cardPath}.content`);
      if (contentError) errors.push(contentError);

      if (card.fontSize !== undefined) {
        const fontError = validateNumber(card.fontSize, `${cardPath}.fontSize`, 14, 100);
        if (fontError) errors.push(fontError);
      }
    }
  }

  const timelineError = validateArray(cfg.timeline, 'config.timeline');
  if (timelineError) {
    errors.push(timelineError);
  } else {
    const timeline = cfg.timeline as unknown[];
    for (let i = 0; i < timeline.length; i++) {
      const stepPath = `config.timeline[${i}]`;
      const step = timeline[i] as Record<string, unknown>;
      
      const stepObjError = validateObject(step, stepPath);
      if (stepObjError) {
        errors.push(stepObjError);
        continue;
      }

      const beat = step.beat as Record<string, unknown>;
      if (!beat) {
        errors.push({path: `${stepPath}.beat`, message: 'is required'});
        continue;
      }

      const beatObjError = validateObject(beat, `${stepPath}.beat`);
      if (beatObjError) {
        errors.push(beatObjError);
        continue;
      }

      const typeError = validateEnum(beat.type, VALID_BEATS, `${stepPath}.beat.type`);
      if (typeError) errors.push(typeError);

      if (beat.duration !== undefined) {
        const durError = validateNumber(beat.duration, `${stepPath}.beat.duration`, 0.01, 10);
        if (durError) errors.push(durError);
      }

      if (beat.delay !== undefined) {
        const delayError = validateNumber(beat.delay, `${stepPath}.beat.delay`, 0, 10);
        if (delayError) errors.push(delayError);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

