import {Code, makeScene2D, Node} from '@motion-canvas/2d';
import {all, easeInOutCubic, map, waitFor} from '@motion-canvas/core';
import {SafeZone} from '../core/ScreenGrid';
import {Colors, Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';
import {textWidth} from '../core/utils/textMeasure';

const TREE = [
  'exportVideo(sourceFrames, outputFormat, colorProfile, subtitleTrack, watermarkMode, audioProfile, hdrMode)',
  '    └─ prepareFrames(sourceFrames, colorProfile, subtitleTrack, watermarkMode, audioProfile, hdrMode)',
  '        └─ encodeWithRetry(preparedFrames, outputFormat, watermarkMode, audioProfile, hdrMode)',
  '            └─ encode(preparedFrames, outputFormat, watermarkMode, audioProfile, hdrMode)',
  '                └─ finalizeExport(encodedVideo, outputFormat, watermarkMode, audioProfile, hdrMode)',
] as const;

export default makeScene2D(function* (view) {
  applyBackground(view);

  const stage = new Node({});
  view.add(stage);

  const baseInk = '#F6E7D4';
  const bracketBlue = '#BFEAFF';
  const keywordPink = Colors.accent;

  // Same sizing approach as introMergeScene: fit to safe-zone by width.
  const maxWidth = SafeZone.right - SafeZone.left - 40;
  const maxFont = 32;
  const minFont = 18;
  let fontSize = maxFont;
  while (fontSize > minFont) {
    const widest = Math.max(...TREE.map(line => textWidth(line, Fonts.code, fontSize, 650)));
    if (widest <= maxWidth) break;
    fontSize -= 1;
  }
  const lineHeight = fontSize * 1.35;

  const blockW = Math.max(...TREE.map(line => textWidth(line, Fonts.code, fontSize, 650)));
  const blockH = lineHeight * TREE.length;
  const startX = -blockW / 2;
  const startY = -blockH / 2 + lineHeight * 0.5;

  const drawHooks = {
    token: (
      canvasCtx: CanvasRenderingContext2D,
      text: string,
      position: {x: number; y: number},
      _color: string,
      selection: number,
    ) => {
      const raw = String(text ?? '');
      const prevAlpha = canvasCtx.globalAlpha;
      canvasCtx.globalAlpha *= map(0.2, 1, selection);

      let x = position.x;
      const y = position.y;
      const flush = (seg: string, segColor: string) => {
        if (!seg) return;
        canvasCtx.fillStyle = segColor;
        canvasCtx.fillText(seg, x, y);
        x += canvasCtx.measureText(seg).width;
      };

      let i = 0;
      while (i < raw.length) {
        const ch = raw[i];
        if (ch === '└' || ch === '─') {
          flush(ch, bracketBlue);
          i += 1;
          continue;
        }
        if (/[A-Za-z_]/.test(ch)) {
          let j = i + 1;
          while (j < raw.length && /[A-Za-z0-9_]/.test(raw[j])) j += 1;
          const word = raw.slice(i, j);
          const color = word === 'hdrMode' ? keywordPink : baseInk;
          flush(word, color);
          i = j;
          continue;
        }
        let j = i + 1;
        while (j < raw.length) {
          const c = raw[j];
          if (c === '└' || c === '─' || /[A-Za-z_]/.test(c)) break;
          j += 1;
        }
        flush(raw.slice(i, j), baseInk);
        i = j;
      }

      canvasCtx.globalAlpha = prevAlpha;
    },
  };

  const rows: Code[] = [];
  TREE.forEach((line, i) => {
    const row = new Code({
      code: line,
      fontFamily: Fonts.code,
      fontSize,
      lineHeight,
      x: startX - 14,
      y: startY + i * lineHeight,
      offset: [-1, 0],
      opacity: 0,
      drawHooks,
    });
    rows.push(row);
    stage.add(row);
  });

  // Stair-step reveal from first line to last.
  for (const row of rows) {
    yield* all(
      row.opacity(1, 0.28, easeInOutCubic),
      row.x(row.x() + 14, 0.28, easeInOutCubic),
    );
    yield* waitFor(0.12);
  }

  yield* waitFor(3.0);
  yield* stage.opacity(0, Timing.normal, easeInOutCubic);
  yield* waitFor(0.3);
});
