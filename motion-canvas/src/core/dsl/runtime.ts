import {Node} from '@motion-canvas/2d';
import {ThreadGenerator, waitFor} from '@motion-canvas/core';
import type {SceneConfig, BeatConfig, CardConfig} from './types';
import {getSlots} from '../layouts';
import {CodeBlock} from '../code/components/CodeBlock';
import {ExplainorCodeTheme} from '../code/model/SyntaxTheme';
import {Fonts, Timing, Colors} from '../theme';
import * as beats from '../beats';

export interface RuntimeContext {
  view: Node;
  cards: Map<string, CodeBlock>;
  content: Map<string, string>;
}

export function createRuntimeContext(view: Node): RuntimeContext {
  return {
    view,
    cards: new Map(),
    content: new Map(),
  };
}

export function mountCards(
  ctx: RuntimeContext,
  config: SceneConfig,
): void {
  const slots = getSlots(config.layout);

  for (const [name, cardConfig] of Object.entries(config.cards)) {
    const slot = slots[cardConfig.slot];
    if (!slot) {
      throw new Error(`Slot "${cardConfig.slot}" not found in layout "${config.layout}"`);
    }

    const code = config.content?.[cardConfig.content] ?? cardConfig.content;

    const block = CodeBlock.fromCode(code, {
      x: slot.x,
      y: slot.y,
      width: slot.width,
      height: slot.height,
      fontSize: cardConfig.fontSize ?? 16,
      fontFamily: Fonts.code,
      theme: ExplainorCodeTheme,
      customTypes: cardConfig.customTypes ?? [],
    });

    block.mount(ctx.view);
    ctx.cards.set(name, block);
  }
}

function getTargetCards(ctx: RuntimeContext, targets?: string[]): CodeBlock[] {
  if (!targets || targets.length === 0) {
    return Array.from(ctx.cards.values());
  }
  return targets
    .map(t => ctx.cards.get(t))
    .filter((c): c is CodeBlock => c !== undefined);
}

function getDuration(beat: BeatConfig): number {
  return beat.duration ?? Timing.slow;
}

export function* executeBeat(
  ctx: RuntimeContext,
  beat: BeatConfig,
): ThreadGenerator {
  const cards = getTargetCards(ctx, beat.targets);
  const duration = getDuration(beat);

  switch (beat.type) {
    case 'appear':
      for (const card of cards) {
        yield* beats.appear(card, duration);
      }
      break;

    case 'appear-staggered':
      yield* beats.appearStaggered(cards, beat.delay ?? 0.3, duration);
      break;

    case 'disappear':
      yield* beats.disappearAll(cards, duration);
      break;

    case 'highlight-lines':
      if (beat.lines) {
        const ranges: [number, number][] = beat.lines.map(i => [i, i]);
        for (const card of cards) {
          yield* beats.highlightLines(card, ranges, duration);
        }
      }
      break;

    case 'recolor-line':
      if (beat.lines && beat.lines.length > 0) {
        const color = beat.color ?? Colors.accent;
        for (const card of cards) {
          yield* beats.recolorLine(card, beat.lines[0], color, duration);
        }
      }
      break;

    case 'recolor-tokens':
      if (beat.lines && beat.tokens) {
        const color = beat.color ?? Colors.accent;
        for (const card of cards) {
          yield* beats.recolorTokens(card, beat.lines[0], beat.tokens, color, duration);
        }
      }
      break;

    case 'reset-highlight':
      if (beat.lines) {
        for (const card of cards) {
          for (const line of beat.lines) {
            yield* beats.resetLineColors(card, line, duration);
          }
          yield* beats.showAllLines(card, duration);
        }
      }
      break;

    case 'scan-knowledge':
      if (beat.lines) {
        yield* beats.knowledgeScan(cards, beat.lines, duration, beat.hold ?? 0.3);
      }
      break;

    case 'wait':
      yield* waitFor(duration);
      break;

    default:
      yield* waitFor(0);
  }
}

export function* executeTimeline(
  ctx: RuntimeContext,
  config: SceneConfig,
): ThreadGenerator {
  for (const step of config.timeline) {
    yield* executeBeat(ctx, step.beat);
  }
}

export function* runScene(
  view: Node,
  config: SceneConfig,
): ThreadGenerator {
  const ctx = createRuntimeContext(view);
  mountCards(ctx, config);
  yield* executeTimeline(ctx, config);
}

