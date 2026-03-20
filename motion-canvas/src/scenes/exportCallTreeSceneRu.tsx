import {Code, Line, makeScene2D, Node, Txt} from '@motion-canvas/2d';
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

// Цвета модулей (приглушённые, в палитре проекта)
const MODULE_A_CLR  = '#E8C874'; // тёплый жёлтый — подготовка
const MODULE_B_CLR  = '#E88CB0'; // приглушённый розовый — кодирование/финализация

const METHODS = new Set([
  'exportVideo', 'validateInput', 'prepareFrames', 'applyFilters',
  'encodeWithRetry', 'encode', 'muxStreams', 'finalizeExport', 'writeOutput',
]);

// ── Модули ───────────────────────────────────────────────────────────────────
const MODULE_SPLIT = 4; // 0..3 = модуль A, 4..8 = модуль B
const MODULE_A = new Set(['exportVideo', 'validateInput', 'prepareFrames', 'applyFilters']);
const MODULE_B = new Set(['encodeWithRetry', 'encode', 'muxStreams', 'finalizeExport', 'writeOutput']);

// ── Данные дерева ────────────────────────────────────────────────────────────

interface TreeLine {
  prefix: string;
  method: string;
  args: string[];
}

const INDENT = '    ';
const CONN   = '└─ ';

const TREE: TreeLine[] = [
  {prefix: '',                         method: 'exportVideo',      args: ['sourceFrames', 'outputFormat', 'colorProfile', 'subtitleTrack', 'watermarkMode', 'audioProfile']},
  {prefix: INDENT.repeat(1) + CONN,   method: 'validateInput',    args: ['sourceFrames', 'outputFormat', 'colorProfile', 'watermarkMode', 'audioProfile']},
  {prefix: INDENT.repeat(2) + CONN,   method: 'prepareFrames',    args: ['sourceFrames', 'colorProfile', 'subtitleTrack', 'watermarkMode', 'audioProfile']},
  {prefix: INDENT.repeat(3) + CONN,   method: 'applyFilters',     args: ['preparedFrames', 'colorProfile', 'watermarkMode', 'audioProfile']},
  {prefix: INDENT.repeat(4) + CONN,   method: 'encodeWithRetry',  args: ['filteredFrames', 'outputFormat', 'watermarkMode', 'audioProfile']},
  {prefix: INDENT.repeat(5) + CONN,   method: 'encode',           args: ['filteredFrames', 'outputFormat', 'watermarkMode', 'audioProfile']},
  {prefix: INDENT.repeat(6) + CONN,   method: 'muxStreams',       args: ['encodedVideo', 'audioProfile', 'watermarkMode']},
  {prefix: INDENT.repeat(7) + CONN,   method: 'finalizeExport',   args: ['muxedVideo', 'outputFormat', 'watermarkMode', 'audioProfile']},
  {prefix: INDENT.repeat(8) + CONN,   method: 'writeOutput',      args: ['finalizedVideo', 'outputFormat', 'watermarkMode']},
];

function buildLine(t: TreeLine, extraArgs: string[] = []): string {
  const allArgs = [...t.args, ...extraArgs];
  return `${t.prefix}${t.method}(${allArgs.join(', ')})`;
}

const HDR_TARGET = 5;
const ALL_WIDTHS = TREE.map((t, i) => buildLine(t, i <= HDR_TARGET ? ['hdrMode'] : []));
const WIDEST_LINE = ALL_WIDTHS.reduce((a, b) => a.length > b.length ? a : b);

// ── drawHooks ────────────────────────────────────────────────────────────────

interface HookState {
  highlight: string | null;
  moduleColor: string | null;
}

function makeDrawHooks(state: () => HookState) {
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
      const {highlight: hl, moduleColor: mc} = state();

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
            color = mc ?? METHOD_CLR;
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

  // ── Позиционирование: прижимаем влево, центрируем по вертикали ──────
  const blockH = lineHeight * TREE.length;
  const startX = SafeZone.left;
  const startY = -blockH / 2 + lineHeight * 0.5;

  // ── Создание Code-строк ────────────────────────────────────────────────
  const textSignals: ReturnType<typeof createSignal<string>>[] = [];
  const hlSignals: ReturnType<typeof createSignal<string | null>>[] = [];
  const mcSignals: ReturnType<typeof createSignal<string | null>>[] = [];
  const rows: Code[] = [];

  TREE.forEach((t, i) => {
    const sig = createSignal(buildLine(t));
    const hl = createSignal<string | null>(null);
    const mc = createSignal<string | null>(null);
    textSignals.push(sig);
    hlSignals.push(hl);
    mcSignals.push(mc);
    const row = new Code({
      code: () => sig(),
      fontFamily: Fonts.code,
      fontSize,
      lineHeight,
      x: startX - 14,
      y: startY + i * lineHeight,
      offset: [-1, 0],
      opacity: 0,
      drawHooks: makeDrawHooks(() => ({highlight: hl(), moduleColor: mc()})),
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

  // ── Акт 1: hdrMode нужен в encode — каскад проброса снизу вверх ────────
  const delays = [0.3, 0.35, 0.40, 0.45, 0.50, 0.55];

  for (let i = HDR_TARGET; i >= 0; i--) {
    const currentText = textSignals[i]();
    const closeParen = currentText.lastIndexOf(')');
    const before = currentText.slice(0, closeParen);
    const suffix = ', hdrMode';
    for (let c = 1; c <= suffix.length; c++) {
      textSignals[i](before + suffix.slice(0, c) + ')');
      yield* waitFor(0.025);
    }
    yield* waitFor(delays[HDR_TARGET - i] ?? 0.3);
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

  // ── Акт 3: покраска модулей ─────────────────────────────────────────────
  for (let i = 0; i < TREE.length; i++) {
    mcSignals[i](i < MODULE_SPLIT ? MODULE_A_CLR : MODULE_B_CLR);
  }
  yield* waitFor(1.5);

  // ── Подготовка лейблов и коннектора (невидимые) ─────────────────────────
  const labelFs = Math.round(fontSize * 1.3);
  const labelX = SafeZone.right + 30;

  const modAcenterY = (rows[0].y() + rows[MODULE_SPLIT - 1].y()) / 2;
  const modBcenterY = (rows[MODULE_SPLIT].y() + rows[TREE.length - 1].y()) / 2;

  const labelA = new Txt({
    text: 'VideoPreparation',
    fontFamily: Fonts.code,
    fontSize: labelFs,
    fontWeight: 600,
    fill: MODULE_A_CLR,
    x: labelX,
    y: modAcenterY,
    offset: [1, 0],
    opacity: 0,
  });

  const labelB = new Txt({
    text: 'EncodingPipeline',
    fontFamily: Fonts.code,
    fontSize: labelFs,
    fontWeight: 600,
    fill: MODULE_B_CLR,
    x: labelX,
    y: modBcenterY,
    offset: [1, 0],
    opacity: 0,
  });

  // Вертикальная линия между модулями — по X совпадает с символом └ строки encodeWithRetry
  const connLineX = rows[MODULE_SPLIT].x() + textWidth(INDENT.repeat(MODULE_SPLIT), Fonts.code, fontSize, 650) + fontSize * 0.25;
  const lastAy = rows[MODULE_SPLIT - 1].y();
  const firstBy = rows[MODULE_SPLIT].y();

  const connector = new Line({
    points: [[connLineX, lastAy + lineHeight * 0.4], [connLineX, firstBy - lineHeight * 0.4]],
    stroke: CONN_CLR,
    lineWidth: fontSize * 0.08,
    opacity: 0,
  });

  stage.add(labelA);
  stage.add(labelB);
  stage.add(connector);

  // ── Акт 4: раздвижение + появление лейблов и коннектора ─────────────────
  const gap = lineHeight * 1.8;

  const moveAnims = rows.map((row, i) => {
    const offset = i < MODULE_SPLIT ? -gap / 2 : gap / 2;
    return row.y(row.y() + offset, 0.7, easeInOutCubic);
  });

  yield* all(
    ...moveAnims,
    labelA.y(modAcenterY - gap / 2, 0.7, easeInOutCubic),
    labelB.y(modBcenterY + gap / 2, 0.7, easeInOutCubic),
    connector.points(
      [[connLineX, lastAy + lineHeight * 0.4 - gap / 2], [connLineX, firstBy - lineHeight * 0.4 + gap / 2]],
      0.7, easeInOutCubic,
    ),
  );

  yield* all(
    labelA.opacity(1, 0.4, easeInOutCubic),
    labelB.opacity(1, 0.4, easeInOutCubic),
    connector.opacity(1, 0.4, easeInOutCubic),
  );

  yield* waitFor(2.5);

  yield* stage.opacity(0, Timing.normal, easeInOutCubic);
  yield* waitFor(0.3);
});
