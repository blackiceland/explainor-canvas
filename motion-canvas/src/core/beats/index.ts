import {Node, Rect} from '@motion-canvas/2d';
import {all, easeInOutCubic, ThreadGenerator, waitFor, SimpleSignal} from '@motion-canvas/core';
import {CodeBlock} from '../code/components/CodeBlock';
import {Colors, Timing} from '../theme';

export function* appear(
  component: Node | CodeBlock,
  duration: number = Timing.slow,
): ThreadGenerator {
  if (component instanceof CodeBlock) {
    yield* component.appear(duration);
  } else {
    yield* component.opacity(1, duration, easeInOutCubic);
  }
}

export function* disappear(
  component: Node | CodeBlock,
  duration: number = Timing.slow,
): ThreadGenerator {
  if (component instanceof CodeBlock) {
    yield* component.disappear(duration);
  } else {
    yield* component.opacity(0, duration, easeInOutCubic);
  }
}

export function* appearStaggered(
  components: (Node | CodeBlock)[],
  delay: number = Timing.fast,
  duration: number = Timing.slow,
): ThreadGenerator {
  for (let i = 0; i < components.length; i++) {
    if (i > 0) yield* waitFor(delay);
    yield* appear(components[i], duration);
  }
}

export function* disappearAll(
  components: (Node | CodeBlock)[],
  duration: number = Timing.slow,
): ThreadGenerator {
  yield* all(...components.map(c => disappear(c, duration)));
}

export function* highlightLines(
  block: CodeBlock,
  ranges: [number, number][],
  duration: number = Timing.slow,
): ThreadGenerator {
  yield* block.highlightLines(ranges, duration);
}

export function* recolorLine(
  block: CodeBlock,
  lineIndex: number,
  color: string = Colors.accent,
  duration: number = Timing.slow,
): ThreadGenerator {
  yield* block.recolorLine(lineIndex, color, duration);
}

export function* recolorTokens(
  block: CodeBlock,
  lineIndex: number,
  patterns: string[],
  color: string = Colors.accent,
  duration: number = Timing.slow,
): ThreadGenerator {
  yield* block.recolorTokens(lineIndex, patterns, color, duration);
}

export function* resetLineColors(
  block: CodeBlock,
  lineIndex: number,
  duration: number = Timing.slow,
): ThreadGenerator {
  yield* block.resetLineColors(lineIndex, duration);
}

export function* showAllLines(
  block: CodeBlock,
  duration: number = Timing.slow,
): ThreadGenerator {
  yield* block.showAllLines(duration);
}

export function* highlightLinesAcross(
  blocks: CodeBlock[],
  lineIndices: number[],
  duration: number = Timing.slow,
): ThreadGenerator {
  const animations: ThreadGenerator[] = [];
  for (const block of blocks) {
    const ranges: [number, number][] = lineIndices.map(i => [i, i]);
    animations.push(block.highlightLines(ranges, duration));
    for (const idx of lineIndices) {
      animations.push(block.recolorLine(idx, Colors.accent, duration));
    }
  }
  yield* all(...animations);
}

export function* resetHighlightAcross(
  blocks: CodeBlock[],
  lineIndices: number[],
  duration: number = Timing.slow,
): ThreadGenerator {
  const animations: ThreadGenerator[] = [];
  for (const block of blocks) {
    for (const idx of lineIndices) {
      animations.push(block.resetLineColors(idx, duration));
    }
    animations.push(block.showAllLines(duration));
  }
  yield* all(...animations);
}

export function* pulseCell(
  cell: Rect,
  highlightColor: string = 'rgba(200, 116, 143, 0.22)',
  offColor: string = 'rgba(0, 0, 0, 0)',
  onDuration: number = Timing.beat,
  offDuration: number = Timing.beat,
): ThreadGenerator {
  yield* cell.fill(highlightColor, onDuration, easeInOutCubic);
  yield* cell.fill(offColor, offDuration, easeInOutCubic);
}

export function* scanTableColumn(
  cells: Rect[],
  highlightColor: string = 'rgba(200, 116, 143, 0.22)',
  rowDelay: number = Timing.micro,
): ThreadGenerator {
  for (const cell of cells) {
    yield* pulseCell(cell, highlightColor);
    yield* waitFor(rowDelay);
  }
}

export function* filterRows(
  rows: Rect[],
  shouldShow: (index: number) => boolean,
  duration: number = Timing.slow,
): ThreadGenerator {
  const animations: ThreadGenerator[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (!shouldShow(i)) {
      animations.push(
        all(
          rows[i].opacity(0, duration, easeInOutCubic),
          rows[i].height(0, duration, easeInOutCubic),
        ),
      );
    }
  }
  if (animations.length > 0) {
    yield* all(...animations);
  }
}

export function* crossfade(
  from: Node,
  to: Node,
  duration: number = Timing.slow,
): ThreadGenerator {
  yield* all(
    from.opacity(0, duration, easeInOutCubic),
    to.opacity(1, duration, easeInOutCubic),
  );
}

export function* moveTo(
  component: Node,
  x: number,
  y: number,
  duration: number = Timing.slow,
): ThreadGenerator {
  yield* component.position([x, y], duration, easeInOutCubic);
}

export function* scaleTo(
  component: Node,
  scale: number,
  duration: number = Timing.slow,
): ThreadGenerator {
  yield* component.scale(scale, duration, easeInOutCubic);
}

export function* typewriter(
  textSignal: SimpleSignal<string>,
  text: string,
  charDelay: number = Timing.micro,
  punctuationDelay: number = Timing.beat,
  newlineDelay: number = Timing.fast,
): ThreadGenerator {
  for (let i = 0; i <= text.length; i++) {
    textSignal(text.slice(0, i));
    const ch = text[i] ?? '';
    const dt =
      ch === '\n' ? newlineDelay :
      ch === ' ' ? charDelay * 0.8 :
      /["""—–.,:;!?]/.test(ch) ? punctuationDelay :
      charDelay;
    yield* waitFor(dt);
  }
}

export function* titleFade(
  container: Node,
  fadeIn: number = Timing.slow,
  hold: number = Timing.normal,
  fadeOut: number = Timing.slow,
): ThreadGenerator {
  yield* container.opacity(1, fadeIn, easeInOutCubic);
  yield* waitFor(hold);
  yield* container.opacity(0, fadeOut, easeInOutCubic);
}

export function* cursorBlink(
  cursorOpacity: SimpleSignal<number>,
  duration: number,
  step: number = Timing.fast,
): ThreadGenerator {
  let t = 0;
  while (t < duration) {
    yield* cursorOpacity(0, step, easeInOutCubic);
    t += step;
    if (t >= duration) break;
    yield* cursorOpacity(1, step, easeInOutCubic);
    t += step;
  }
}

export function* swipeReveal(
  overlay: Rect,
  direction: 'left' | 'right' | 'up' | 'down' = 'right',
  distance: number = 1920 * 1.2,
  duration: number = Timing.slow,
): ThreadGenerator {
  const current = overlay.position();
  let targetX = current.x;
  let targetY = current.y;

  switch (direction) {
    case 'left':
      targetX = current.x - distance;
      break;
    case 'right':
      targetX = current.x + distance;
      break;
    case 'up':
      targetY = current.y - distance;
      break;
    case 'down':
      targetY = current.y + distance;
      break;
  }

  yield* overlay.position([targetX, targetY], duration, easeInOutCubic);
}

export function* knowledgeScan(
  blocks: CodeBlock[],
  lineIndices: number[],
  highlightDuration: number = Timing.slow,
  holdDuration: number = Timing.fast,
): ThreadGenerator {
  for (const lineIndex of lineIndices) {
    yield* all(
      ...blocks.map(b => b.highlightLines([[lineIndex, lineIndex]], highlightDuration)),
      ...blocks.map(b => b.recolorLine(lineIndex, Colors.accent, highlightDuration)),
    );
    yield* waitFor(holdDuration);
  }
}

export function* zoomReveal(
  card: Node,
  content: Node,
  scale: number = 1.8,
  zoomDuration: number = Timing.slow,
  revealDuration: number = Timing.slow,
): ThreadGenerator {
  yield* card.scale(scale, zoomDuration, easeInOutCubic);
  yield* content.opacity(1, revealDuration, easeInOutCubic);
}

export function* cardStackReveal(
  cards: (Node | CodeBlock)[],
  delay: number = Timing.fast,
  duration: number = Timing.slow,
): ThreadGenerator {
  yield* appearStaggered(cards, delay, duration);
}

export function* focus(
  active: Node | CodeBlock,
  inactive: Node | CodeBlock,
  activeOpacity: number = 1,
  inactiveOpacity: number = 0.55,
  duration: number = Timing.normal,
): ThreadGenerator {
  const setOpacity = (c: Node | CodeBlock, o: number) =>
    c instanceof CodeBlock
      ? c.node.opacity(o, duration, easeInOutCubic)
      : c.opacity(o, duration, easeInOutCubic);

  yield* all(
    setOpacity(active, activeOpacity),
    setOpacity(inactive, inactiveOpacity),
  );
}
