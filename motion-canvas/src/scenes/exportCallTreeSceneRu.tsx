import {Code, makeScene2D, Node} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, map, waitFor} from '@motion-canvas/core';
import {SafeZone} from '../core/ScreenGrid';
import {Colors, Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';
import {textWidth} from '../core/utils/textMeasure';

// ── Утверждённая палитра ─────────────────────────────────────────────────────
const METHOD_CLR    = '#9FC7E8';
const VARIABLE_CLR  = '#E8ECF2';
const PUNCT_CLR     = '#B7C4D4';
const CONN_CLR      = '#B7C4D4';
const HDR_CLR       = Colors.accent;
const REMOVE_CLR    = 'rgba(255, 70, 70, 0.95)';

const METHODS = new Set([
  'exportVideo', 'prepareFrames', 'encodeWithRetry', 'encode', 'finalizeExport',
]);

// ── Данные дерева ────────────────────────────────────────────────────────────

interface TreeLine {
  prefix: string;   // '    └─ ' or ''
  method: string;   // 'exportVideo'
  args: string[];   // each arg name
}

const TREE: TreeLine[] = [
  {prefix: '',                method: 'exportVideo',      args: ['sourceFrames', 'outputFormat', 'colorProfile', 'subtitleTrack', 'watermarkMode', 'audioProfile']},
  {prefix: '    └─ ',        method: 'prepareFrames',    args: ['sourceFrames', 'colorProfile', 'subtitleTrack', 'watermarkMode', 'audioProfile']},
  {prefix: '        └─ ',    method: 'encodeWithRetry',  args: ['preparedFrames', 'outputFormat', 'watermarkMode', 'audioProfile']},
  {prefix: '            └─ ',method: 'encode',           args: ['preparedFrames', 'outputFormat', 'watermarkMode', 'audioProfile']},
  {prefix: '                └─ ', method: 'finalizeExport', args: ['encodedVideo', 'outputFormat', 'watermarkMode', 'audioProfile']},
];

function buildLine(t: TreeLine, extraArgs: string[] = []): string {
  const allArgs = [...t.args, ...extraArgs];
  return `${t.prefix}${t.method}(${allArgs.join(', ')})`;
}

const WIDEST_LINE = buildLine(TREE[0], ['hdrMode']);

function makeDrawHooks(highlightArg: () => string | null) {
  return {
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
      const hl = highlightArg();

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
          flush(ch, CONN_CLR);
          i += 1;
          continue;
        }
        if (/[A-Za-z_]/.test(ch)) {
          let j = i + 1;
          while (j < raw.length && /[A-Za-z0-9_]/.test(raw[j])) j += 1;
          const word = raw.slice(i, j);
          let color: string;
          if (hl && word === hl) {
            color = REMOVE_CLR;
          } else if (METHODS.has(word)) {
            color = METHOD_CLR;
          } else if (word === 'hdrMode') {
            color = HDR_CLR;
          } else {
            color = VARIABLE_CLR;
          }
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
        flush(raw.slice(i, j), PUNCT_CLR);
        i = j;
      }

      canvasCtx.globalAlpha = prevAlpha;
    },
  };
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  const stage = new Node({});
  view.add(stage);

  // ── Размер: максимально крупный под safe-zone ───────────────────────────
  const maxWidth = SafeZone.right - SafeZone.left - 40;
  const maxFont = 32;
  const minFont = 18;
  let fontSize = maxFont;
  while (fontSize > minFont) {
    if (textWidth(WIDEST_LINE, Fonts.code, fontSize, 650) <= maxWidth) break;
    fontSize -= 1;
  }
  const lineHeight = fontSize * 1.85;

  // ── Центрирование ──────────────────────────────────────────────────────
  const initLines = TREE.map(t => buildLine(t));
  const blockW = Math.max(...initLines.map(l => textWidth(l, Fonts.code, fontSize, 650)));
  const blockH = lineHeight * TREE.length;
  const startX = -blockW / 2;
  const startY = -blockH / 2 + lineHeight * 0.5;

  // ── Создание Code-строк ────────────────────────────────────────────────
  const textSignals: ReturnType<typeof createSignal<string>>[] = [];
  const hlSignals: ReturnType<typeof createSignal<string | null>>[] = [];
  const rows: Code[] = [];

  TREE.forEach((t, i) => {
    const sig = createSignal(buildLine(t));
    const hl = createSignal<string | null>(null);
    textSignals.push(sig);
    hlSignals.push(hl);
    const row = new Code({
      code: () => sig(),
      fontFamily: Fonts.code,
      fontSize,
      lineHeight,
      x: startX - 14,
      y: startY + i * lineHeight,
      offset: [-1, 0],
      opacity: 0,
      drawHooks: makeDrawHooks(() => hl()),
    });
    rows.push(row);
    stage.add(row);
  });

  // ── Утверждённая лесенка появления ──────────────────────────────────────
  for (const row of rows) {
    yield* all(
      row.opacity(1, 0.28, easeInOutCubic),
      row.x(row.x() + 14, 0.28, easeInOutCubic),
    );
    yield* waitFor(0.12);
  }

  yield* waitFor(1.8);

  // ── Акт 1: hdrMode — снизу вверх (каскад проброса) ─────────────────────
  const last = TREE.length - 1;
  const delays = [0.6, 0.5, 0.4, 0.35, 0.3];

  for (let i = last; i >= 0; i--) {
    const currentText = textSignals[i]();
    const closeParen = currentText.lastIndexOf(')');
    const before = currentText.slice(0, closeParen);
    const suffix = ', hdrMode';
    for (let c = 1; c <= suffix.length; c++) {
      textSignals[i](before + suffix.slice(0, c) + ')');
      yield* waitFor(0.025);
    }
    yield* waitFor(delays[last - i] ?? 0.3);
  }

  yield* waitFor(2.0);

  // ── Акт 2: watermarkMode удаляется одновременно во всех методах ─────────
  const wmIndices = TREE.map((t, i) => t.args.includes('watermarkMode') ? i : -1).filter(i => i >= 0);
  const fragment = ', watermarkMode';

  for (const i of wmIndices) hlSignals[i]('watermarkMode');
  yield* waitFor(0.4);

  const snapshots = wmIndices.map(i => {
    const cur = textSignals[i]();
    const idx = cur.indexOf(fragment);
    return {i, before: cur.slice(0, idx), after: cur.slice(idx + fragment.length)};
  });

  for (let c = fragment.length - 1; c >= 0; c--) {
    for (const s of snapshots) {
      textSignals[s.i](s.before + fragment.slice(0, c) + s.after);
    }
    yield* waitFor(0.02);
  }

  for (const i of wmIndices) hlSignals[i](null);

  yield* waitFor(2.0);

  yield* stage.opacity(0, Timing.normal, easeInOutCubic);
  yield* waitFor(0.3);
});
