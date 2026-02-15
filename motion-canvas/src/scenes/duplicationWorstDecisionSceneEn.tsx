import {Code, makeScene2D, Node} from '@motion-canvas/2d';
import {createRef, createSignal, easeInOutCubic, map, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Colors, Fonts, Timing} from '../core/theme';
import {SafeZone} from '../core/ScreenGrid';
import {textWidth} from '../core/utils/textMeasure';

function fitFontSize(
  text: string,
  maxWidthPx: number,
  fontFamily: string,
  maxFontSize: number,
  minFontSize: number,
  fontWeight: number = 600,
): number {
  const lines = text.split('\n');
  const maxW = Math.max(1, maxWidthPx);
  let lo = Math.max(1, Math.floor(minFontSize));
  let hi = Math.max(lo, Math.floor(maxFontSize));

  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const allFit = lines.every(
      line => textWidth(line, fontFamily, mid, fontWeight) <= maxW,
    );
    if (allFit) lo = mid;
    else hi = mid - 1;
  }

  return lo;
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  const stage = createRef<Node>();
  view.add(<Node ref={stage} />);

  // Split into 2 lines to guarantee safe framing.
  const TEXT = 'When fighting duplication\nbecomes the worst solution.';

  const text = createSignal(TEXT);
  const on = createSignal(0);

  const baseInk = '#F6E7D4'; // match introMergeScene "ink"
  const bracketBlue = '#BFEAFF';
  const keywordPink = Colors.accent;

  // Highlight the specific phrase in brand pink.
  const HIGHLIGHT_WORDS = new Set(['the', 'worst', 'solution']);

  const KEYWORDS = new Set([
    'if',
    'else',
    'return',
    'case',
    'default',
    'switch',
    'try',
    'catch',
    'finally',
    'throw',
    'new',
    'for',
    'while',
    'break',
    'continue',
  ]);

  const drawHooks = {
    token: (
      canvasCtx: CanvasRenderingContext2D,
      tokenText: string,
      position: {x: number; y: number},
      _color: string,
      selection: number,
    ) => {
      const raw = String(tokenText ?? '');

      const prevAlpha = canvasCtx.globalAlpha;
      canvasCtx.globalAlpha *= map(0.2, 1, selection);

      let x = position.x;
      const y = position.y;

      const flush = (seg: string, segColor: string) => {
        if (seg.length === 0) return;
        canvasCtx.fillStyle = segColor;
        canvasCtx.fillText(seg, x, y);
        x += canvasCtx.measureText(seg).width;
      };

      let i = 0;
      while (i < raw.length) {
        const ch = raw[i];

        if (ch === '{' || ch === '}') {
          flush(ch, bracketBlue);
          i += 1;
          continue;
        }

        if (/[A-Za-z_]/.test(ch)) {
          let j = i + 1;
          while (j < raw.length && /[A-Za-z0-9_]/.test(raw[j])) j += 1;
          const word = raw.slice(i, j);
          const lower = word.toLowerCase();
          const isHighlight = HIGHLIGHT_WORDS.has(lower);
          flush(word, isHighlight ? keywordPink : (KEYWORDS.has(word) ? keywordPink : baseInk));
          i = j;
          continue;
        }

        let j = i + 1;
        while (j < raw.length) {
          const c = raw[j];
          if (c === '{' || c === '}') break;
          if (/[A-Za-z_]/.test(c)) break;
          j += 1;
        }
        flush(raw.slice(i, j), baseInk);
        i = j;
      }

      canvasCtx.globalAlpha = prevAlpha;
    },
  } satisfies Partial<{
    token: (
      canvasCtx: CanvasRenderingContext2D,
      text: string,
      position: {x: number; y: number},
      color: string,
      selection: number,
    ) => void;
  }>;

  const sideMargin = 56;
  // Keep some extra breathing room: Code layout can be slightly wider than our measurement.
  const maxWidth = (SafeZone.right - SafeZone.left) - sideMargin * 2 - 120;
  const fontFamily = Fonts.code;
  const fontWeight = 650;
  const fontSize = fitFontSize(TEXT, maxWidth, fontFamily, 200, 64, fontWeight);
  const y = -30;

  stage().add(
    <Code
      code={() => text()}
      fontFamily={fontFamily}
      fontSize={fontSize}
      lineHeight={fontSize * 1.35}
      opacity={() => on()}
      x={0}
      y={y}
      drawHooks={drawHooks}
    />,
  );

  // Smooth reveal, then disappear (intro pacing).
  on(0);
  yield* waitFor(0.15);
  yield* on(1, Math.max(0.7, Timing.slow * 0.8), easeInOutCubic);
  yield* waitFor(1.25);
  yield* on(0, Math.max(0.6, Timing.slow * 0.75), easeInOutCubic);
  yield* waitFor(0.15);
});

