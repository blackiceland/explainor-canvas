import {Code, Line, makeScene2D, Node, Txt} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, map, waitFor} from '@motion-canvas/core';
import {SafeZone} from '../core/ScreenGrid';
import {Colors, Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';
import {textWidth} from '../core/utils/textMeasure';
import {tokenizeLine} from '../core/code/model/Tokenizer';
import {DryFiltersV3CodeTheme, getTokenColor} from '../core/code/model/SyntaxTheme';

// ── Утверждённая палитра ─────────────────────────────────────────────────────
const PASS_THROUGH_CLR = 'rgba(255, 100, 130, 0.95)';
const METHOD_CLR    = '#9FC7E8';
const VARIABLE_CLR  = '#E8ECF2';
const PUNCT_CLR     = '#B7C4D4';
const CONN_CLR      = '#B7C4D4';
const HDR_CLR       = 'rgba(80, 200, 120, 0.95)';
const REMOVE_CLR    = 'rgba(255, 70, 70, 0.95)';
const RENAME_CLR    = 'rgba(232, 200, 116, 0.95)';

// Цвета модулей
const MODULE_A_CLR  = '#E8C874'; // тёплый жёлтый — подготовка
const MODULE_B_CLR  = '#4DABB5'; // тёмный бирюзовый — кодирование/финализация

const METHODS = new Set([
  'exportVideo', 'normalizeFrames', 'prepareFrames', 'applyFilters',
  'encodeWithRetry', 'encode', 'muxStreams', 'finalizeExport', 'writeOutput',
]);

// ── Модули ───────────────────────────────────────────────────────────────────
const MODULE_SPLIT = 4; // 0..3 = модуль A, 4..8 = модуль B
const MODULE_A = new Set(['exportVideo', 'normalizeFrames', 'prepareFrames', 'applyFilters']);
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
  {prefix: INDENT.repeat(1) + CONN,   method: 'normalizeFrames',  args: ['sourceFrames', 'outputFormat', 'colorProfile', 'subtitleTrack', 'watermarkMode', 'audioProfile']},
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

/** Индекс последней строки, куда добавляют hdrMode и булев флаг (нужны в encode и выше). */
const HDR_TARGET = 5;
const BOOL_TARGET = HDR_TARGET;

const RENAME_FROM = 'colorProfile';
const RENAME_TO = 'colorSpace';
/** Флаг «пробный прогон без реальной записи» — актуален на всех уровнях пайплайна. */
const BOOL_FLAG = 'isDryRun';

function argsWithoutSubtitles(args: string[]): string[] {
  return args.filter(a => a !== 'subtitleTrack');
}

function argsRenamed(args: string[]): string[] {
  return args.map(a => (a === RENAME_FROM ? RENAME_TO : a));
}

interface LinePhase {
  hdr: boolean;
  boolFlag: boolean;
  subtitles: boolean;
  renamed: boolean;
}

const LINE_PHASES: LinePhase[] = [
  {hdr: false, boolFlag: false, subtitles: true, renamed: false},
  {hdr: true, boolFlag: false, subtitles: true, renamed: false},
  {hdr: true, boolFlag: false, subtitles: false, renamed: false},
  {hdr: true, boolFlag: false, subtitles: false, renamed: true},
  {hdr: true, boolFlag: true, subtitles: false, renamed: true},
];

function buildLineForPhase(t: TreeLine, index: number, phase: LinePhase): string {
  let args = [...t.args];
  if (!phase.subtitles) args = argsWithoutSubtitles(args);
  if (phase.renamed) args = argsRenamed(args);
  const extra: string[] = [];
  if (phase.hdr && index <= HDR_TARGET) extra.push('hdrMode');
  if (phase.boolFlag && index <= BOOL_TARGET) extra.push(BOOL_FLAG);
  return buildLine({...t, args}, extra);
}

/** Максимальная длина строки по всем фазам анимации — чтобы шрифт не переполнял экран. */
function computeWidestLine(): string {
  let widest = '';
  for (const phase of LINE_PHASES) {
    for (let i = 0; i < TREE.length; i++) {
      const line = buildLineForPhase(TREE[i], i, phase);
      if (line.length > widest.length) widest = line;
    }
  }
  return widest;
}

const WIDEST_LINE = computeWidestLine();

// ── drawHooks ────────────────────────────────────────────────────────────────

interface HookState {
  highlight: string | null;
  renameHighlight: string | null;
  moduleColor: string | null;
  leakedArgs: Set<string> | null;
  dimAmount: number;
}

/** watermarkMode, audioProfile и outputFormat — транзитные аргументы в верхнем модуле. */
const LEAKED_ARGS = new Set(['watermarkMode', 'audioProfile', 'outputFormat']);

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
      const {highlight: hl, renameHighlight: rhl, moduleColor: mc, leakedArgs, dimAmount} = state();

      const flush = (seg: string, segColor: string, isLeaked: boolean) => {
        if (!seg) return;
        const savedAlpha = canvasCtx.globalAlpha;
        if (dimAmount > 0 && !isLeaked) {
          canvasCtx.globalAlpha *= 1 - dimAmount * 0.85;
        }
        canvasCtx.fillStyle = segColor;
        canvasCtx.fillText(seg, x, y);
        x += canvasCtx.measureText(seg).width;
        canvasCtx.globalAlpha = savedAlpha;
      };

      let i = 0;
      while (i < raw.length) {
        const ch = raw[i];
        if (ch === '└' || ch === '─') {
          flush(ch, CONN_CLR, false);
          i += 1;
          continue;
        }
        if (/[A-Za-z_]/.test(ch)) {
          let j = i + 1;
          while (j < raw.length && /[A-Za-z0-9_]/.test(raw[j])) j += 1;
          const word = raw.slice(i, j);
          const leaked = leakedArgs !== null && leakedArgs.has(word);
          let color: string;
          if (hl && word === hl) {
            color = REMOVE_CLR;
          } else if (rhl && word === rhl) {
            color = RENAME_CLR;
          } else if (leaked) {
            color = MODULE_B_CLR;
          } else if (METHODS.has(word)) {
            color = mc ?? METHOD_CLR;
          } else if (word === 'hdrMode' || word === BOOL_FLAG) {
            color = HDR_CLR;
          } else {
            color = VARIABLE_CLR;
          }
          flush(word, color, leaked);
          i = j;
          continue;
        }
        let j = i + 1;
        while (j < raw.length) {
          const c = raw[j];
          if (c === '└' || c === '─' || /[A-Za-z_]/.test(c)) break;
          j += 1;
        }
        flush(raw.slice(i, j), PUNCT_CLR, false);
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
  const rhlSignals: ReturnType<typeof createSignal<string | null>>[] = [];
  const mcSignals: ReturnType<typeof createSignal<string | null>>[] = [];
  const leakSignals: ReturnType<typeof createSignal<Set<string> | null>>[] = [];
  const dimSignals: ReturnType<typeof createSignal<number>>[] = [];
  const rows: Code[] = [];

  TREE.forEach((t, i) => {
    const sig = createSignal(buildLine(t));
    const hl = createSignal<string | null>(null);
    const rhl = createSignal<string | null>(null);
    const mc = createSignal<string | null>(null);
    const leak = createSignal<Set<string> | null>(null);
    const dim = createSignal(0);
    textSignals.push(sig);
    hlSignals.push(hl);
    rhlSignals.push(rhl);
    mcSignals.push(mc);
    leakSignals.push(leak);
    dimSignals.push(dim);
    const row = new Code({
      code: () => sig(),
      fontFamily: Fonts.code,
      fontSize,
      lineHeight,
      x: startX - 14,
      y: startY + i * lineHeight,
      offset: [-1, 0],
      opacity: 0,
      drawHooks: makeDrawHooks(() => ({
        highlight: hl(),
        renameHighlight: rhl(),
        moduleColor: mc(),
        leakedArgs: leak(),
        dimAmount: dim(),
      })),
    });
    rows.push(row);
    stage.add(row);
  });

  // ── Лесенка появления строк ─────────────────────────────────────────────
  for (const row of rows) {
    yield* all(
      row.opacity(1, 0.28, easeInOutCubic),
      row.x(row.x() + 14, 0.28, easeInOutCubic),
    );
    yield* waitFor(0.12);
  }

  yield* waitFor(1.8);

  // ── Акт 1: hdrMode — одновременное появление во всех строках ────────────
  const hdrSuffix = ', hdrMode';
  const hdrBases = Array.from({length: HDR_TARGET + 1}, (_, i) => {
    const cur = textSignals[i]();
    const cp = cur.lastIndexOf(')');
    return {before: cur.slice(0, cp), after: ')'};
  });
  for (let c = 1; c <= hdrSuffix.length; c++) {
    for (let i = 0; i <= HDR_TARGET; i++) {
      textSignals[i](hdrBases[i].before + hdrSuffix.slice(0, c) + hdrBases[i].after);
    }
    yield* waitFor(0.025);
  }

  yield* waitFor(2.0);

  // ── Акт 2: subtitleTrack удаляется одновременно во всех методах ───────────
  const SUBTITLE_PARAM = 'subtitleTrack';
  const subIndices = TREE.map((t, i) => (t.args.includes(SUBTITLE_PARAM) ? i : -1)).filter(i => i >= 0);
  const subFragment = `, ${SUBTITLE_PARAM}`;

  for (const i of subIndices) hlSignals[i](SUBTITLE_PARAM);
  yield* waitFor(0.4);

  const subSnapshots = subIndices.map(i => {
    const cur = textSignals[i]();
    const idx = cur.indexOf(subFragment);
    if (idx < 0) {
      throw new Error(`exportCallTreeSceneRu: expected "${subFragment}" in line ${i}: ${cur}`);
    }
    return {i, before: cur.slice(0, idx), after: cur.slice(idx + subFragment.length)};
  });

  for (let c = subFragment.length - 1; c >= 0; c--) {
    for (const s of subSnapshots) {
      textSignals[s.i](s.before + subFragment.slice(0, c) + s.after);
    }
    yield* waitFor(0.02);
  }

  for (const i of subIndices) hlSignals[i](null);

  yield* waitFor(2.0);

  // ── Акт 3: переименование параметра (тот же смысл, новый идентификатор) ──
  const renameIndices = TREE.map((t, i) => (t.args.includes(RENAME_FROM) ? i : -1)).filter(i => i >= 0);

  for (const i of renameIndices) rhlSignals[i](RENAME_FROM);
  yield* waitFor(0.45);

  const renameDelays = [0.06, 0.055, 0.05, 0.045, 0.04, 0.035, 0.03, 0.025];
  for (let k = 0; k < renameIndices.length; k++) {
    const i = renameIndices[k];
    const cur = textSignals[i]();
    if (!cur.includes(RENAME_FROM)) continue;
    textSignals[i](cur.split(RENAME_FROM).join(RENAME_TO));
    rhlSignals[i](null);
    yield* waitFor(renameDelays[k] ?? 0.03);
  }

  yield* waitFor(2.0);

  // ── Акт 4: булев флаг isDryRun — одновременное появление ─────────────────
  const boolSuffix = `, ${BOOL_FLAG}`;
  const boolBases = Array.from({length: BOOL_TARGET + 1}, (_, i) => {
    const cur = textSignals[i]();
    const cp = cur.lastIndexOf(')');
    return {before: cur.slice(0, cp), after: ')'};
  });
  for (let c = 1; c <= boolSuffix.length; c++) {
    for (let i = 0; i <= BOOL_TARGET; i++) {
      textSignals[i](boolBases[i].before + boolSuffix.slice(0, c) + boolBases[i].after);
    }
    yield* waitFor(0.025);
  }

  yield* waitFor(2.0);

  // ── Helper: snippet drawHooks — tree-consistent coloring ──────────────────
  const makeSnippetHooks = (
    leakSig: ReturnType<typeof createSignal<Set<string> | null>>,
    dimSig: ReturnType<typeof createSignal<number>>,
  ) => ({
    token: (
      ctx: CanvasRenderingContext2D,
      text: string,
      position: {x: number; y: number},
      _color: string,
      selection: number,
    ) => {
      const raw       = String(text ?? '');
      const prevAlpha = ctx.globalAlpha;
      ctx.globalAlpha *= map(0.2, 1, selection);
      let x = position.x;
      const y      = position.y;
      const leaked = leakSig();
      const dim    = dimSig();

      let i = 0;
      while (i < raw.length) {
        const ch = raw[i];
        if (/[A-Za-z_]/.test(ch)) {
          let j = i + 1;
          while (j < raw.length && /[A-Za-z0-9_]/.test(raw[j])) j++;
          const word = raw.slice(i, j);
          const isPass = leaked !== null && leaked.has(word);
          const sa = ctx.globalAlpha;
          if (dim > 0 && !isPass) ctx.globalAlpha *= 1 - dim * 0.75;
          ctx.fillStyle = isPass ? PASS_THROUGH_CLR : (METHODS.has(word) ? METHOD_CLR : VARIABLE_CLR);
          ctx.fillText(word, x, y);
          x += ctx.measureText(word).width;
          ctx.globalAlpha = sa;
          i = j;
          continue;
        }
        let j = i + 1;
        while (j < raw.length && !/[A-Za-z_]/.test(raw[j])) j++;
        const seg = raw.slice(i, j);
        const sa = ctx.globalAlpha;
        if (dim > 0) ctx.globalAlpha *= 1 - dim * 0.75;
        ctx.fillStyle = PUNCT_CLR;
        ctx.fillText(seg, x, y);
        x += ctx.measureText(seg).width;
        ctx.globalAlpha = sa;
        i = j;
      }

      ctx.globalAlpha = prevAlpha;
    },
  });

  // ── Helper: expand body, highlight pass-through, draw arrows ────────────────
  const snippetFs = Math.round(fontSize * 0.82);
  const snippetLH = Math.round(snippetFs * 1.85);

  function* showBodyWithArrows(
    parentIdx: number,
    snippetLines: string[],
    highlightLineIdx: number,
    passParams: string[],
  ) {
    const SNIPPET_PASS = new Set(passParams);
    const dimSig = createSignal(0);
    const EXPAND_GAP = snippetLH * snippetLines.length + snippetLH;
    const rowYsPreExpand = rows.slice(parentIdx + 1).map(r => r.y());

    // Раздвигаем строки ниже родителя
    yield* all(
      ...rows.slice(parentIdx + 1).map(row => row.y(row.y() + EXPAND_GAP, 0.7, easeInOutCubic)),
    );
    yield* waitFor(0.3);

    // Создаём сниппет — каждая строка получает свой leak signal
    const snippetStartY = rows[parentIdx].y() + lineHeight * 0.6;
    const snippetNodes: Code[] = [];
    const leakSigs: ReturnType<typeof createSignal<Set<string> | null>>[] = [];

    for (let si = 0; si < snippetLines.length; si++) {
      const leakSig = createSignal<Set<string> | null>(null);
      leakSigs.push(leakSig);
      const node = new Code({
        code: snippetLines[si],
        fontFamily: Fonts.code,
        fontSize: snippetFs,
        lineHeight: snippetLH,
        x: startX,
        y: snippetStartY + si * snippetLH,
        offset: [-1, 0],
        opacity: 0,
        drawHooks: makeSnippetHooks(leakSig, dimSig),
      });
      snippetNodes.push(node);
      stage.add(node);
    }

    // Появление сниппета + затемнение (родитель и writeOutput остаются яркими)
    yield* all(
      ...snippetNodes.map(n => n.opacity(1, 0.5, easeInOutCubic)),
      ...rows.filter((_, i) => i !== parentIdx && i !== TREE.length - 1)
        .map(row => row.opacity(0.12, 0.5, easeInOutCubic)),
    );
    yield* waitFor(0.8);

    // Подсвечиваем pass-through + стрелки — одновременно
    leakSigs[highlightLineIdx](SNIPPET_PASS);

    const hlLine     = snippetLines[highlightLineIdx];
    const writeOutY  = rows[TREE.length - 1].y();
    const arrowFromY = snippetStartY + highlightLineIdx * snippetLH + snippetLH * 0.55;
    const arrowToY   = writeOutY - lineHeight * 0.6;
    const arrows: Line[] = [];

    for (const param of passParams) {
      const idx  = hlLine.indexOf(param);
      if (idx < 0) continue;
      const prefW = textWidth(hlLine.slice(0, idx), Fonts.code, snippetFs, 650);
      const pW    = textWidth(param, Fonts.code, snippetFs, 650);
      const cx    = startX + prefW + pW / 2;

      const arrow = new Line({
        points: [[cx, arrowFromY], [cx, arrowToY]],
        stroke: PASS_THROUGH_CLR,
        lineWidth: 1.2,
        endArrow: true,
        arrowSize: 7,
        opacity: 0,
      });
      arrows.push(arrow);
      stage.add(arrow);
    }

    yield* all(
      dimSig(1, 0.6, easeInOutCubic),
      ...arrows.map(a => a.opacity(0.6, 0.6, easeInOutCubic)),
    );
    yield* waitFor(2.5);

    // Сворачиваем
    leakSigs[highlightLineIdx](null);
    dimSig(0);
    yield* all(
      ...snippetNodes.map(n => n.opacity(0, 0.5, easeInOutCubic)),
      ...arrows.map(a => a.opacity(0, 0.5, easeInOutCubic)),
      ...rows.filter((_, i) => i !== parentIdx && i !== TREE.length - 1)
        .map(row => row.opacity(1, 0.5, easeInOutCubic)),
      ...rows.slice(parentIdx + 1).map((row, k) => row.y(rowYsPreExpand[k], 0.5, easeInOutCubic)),
    );
    for (const n of snippetNodes) n.remove();
    for (const a of arrows) a.remove();
    yield* waitFor(0.5);
  }

  // ── Скрытая связность: тело exportVideo ──────────────────────────────────
  yield* showBodyWithArrows(
    0,
    [
      '{',
      '    validateInput(sourceFrames, outputFormat);',
      '    byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack);',
      '    return encodeWithRetry(preparedFrames, outputFormat, watermarkMode, audioProfile);',
      '}',
    ],
    3,
    ['outputFormat', 'watermarkMode', 'audioProfile'],
  );

  // ── Скрытая связность: тело encode ────────────────────────────────────────
  // 23 spaces = INDENT×5 + 3 (connector width) → aligns with "encode" in tree
  const encBrace = INDENT.repeat(5) + '        ';  // +5 spaces (28 total)
  const encBody  = encBrace + INDENT;
  yield* showBodyWithArrows(
    5,
    [
      encBrace + '{',
      encBody + 'byte[] encodedVideo = runEncoder(filteredFrames);',
      encBody + 'return finalizeExport(encodedVideo, outputFormat, watermarkMode, audioProfile);',
      encBrace + '}',
    ],
    2,
    ['outputFormat', 'watermarkMode', 'audioProfile'],
  );

  // ── Акт 5: покраска модулей ─────────────────────────────────────────────
  for (let i = 0; i < TREE.length; i++) {
    mcSignals[i](i < MODULE_SPLIT ? MODULE_A_CLR : MODULE_B_CLR);
  }
  yield* waitFor(1.5);

  // ── Подготовка лейблов и коннектора (невидимые) ─────────────────────────
  const labelFs = Math.round(fontSize * 1.3);
  const labelX = SafeZone.right + 30;

  const modAcenterY = (rows[0].y() + rows[MODULE_SPLIT - 1].y()) / 2;
  const modBcenterY = (rows[MODULE_SPLIT].y() + rows[TREE.length - 1].y()) / 2;
  const LABEL_Y_OFFSET = 20;

  const labelA = new Txt({
    text: 'VideoPreparation',
    fontFamily: Fonts.code,
    fontSize: labelFs,
    fontWeight: 600,
    fill: MODULE_A_CLR,
    x: labelX,
    y: modAcenterY + LABEL_Y_OFFSET,
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
    y: modBcenterY + LABEL_Y_OFFSET,
    offset: [1, 0],
    opacity: 0,
  });

  // Вертикальная линия между модулями — по X совпадает с символом └ строки encodeWithRetry
  const connLineWidth = fontSize * 0.08 + 1;
  /** +1 — выравнивание вправо; −0.5 — при +1 к толщине обводка «растёт» влево (центр смещён вправо). */
  const connLineX =
    rows[MODULE_SPLIT].x() +
    textWidth(INDENT.repeat(MODULE_SPLIT), Fonts.code, fontSize, 650) +
    fontSize * 0.25 +
    1 -
    0.5;
  const lastAy = rows[MODULE_SPLIT - 1].y();
  const firstBy = rows[MODULE_SPLIT].y();

  const connector = new Line({
    points: [[connLineX, lastAy + lineHeight * 0.4], [connLineX, firstBy - lineHeight * 0.4]],
    stroke: CONN_CLR,
    lineWidth: connLineWidth,
    opacity: 0,
  });

  stage.add(labelA);
  stage.add(labelB);
  stage.add(connector);

  // ── Акт 6: раздвижение + появление лейблов и коннектора ─────────────────
  const gap = lineHeight * 1.8;

  const moveAnims = rows.map((row, i) => {
    const offset = i < MODULE_SPLIT ? -gap / 2 : gap / 2;
    return row.y(row.y() + offset, 0.7, easeInOutCubic);
  });

  yield* all(
    ...moveAnims,
    labelA.y(modAcenterY - gap / 2 + LABEL_Y_OFFSET, 0.7, easeInOutCubic),
    labelB.y(modBcenterY + gap / 2 + LABEL_Y_OFFSET, 0.7, easeInOutCubic),
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

  yield* waitFor(2.0);

  // ── Акт 7: протекание — бирюзовые аргументы в жёлтом модуле ─────────────
  // Покраска leaked args + затемнение остального — одновременно
  for (let i = 0; i < MODULE_SPLIT; i++) {
    leakSignals[i](LEAKED_ARGS);
  }
  const dimDuration = 0.8;
  yield* all(
    ...Array.from({length: MODULE_SPLIT}, (_, i) =>
      dimSignals[i](1, dimDuration, easeInOutCubic),
    ),
    ...Array.from({length: TREE.length - MODULE_SPLIT}, (_, k) =>
      rows[MODULE_SPLIT + k].opacity(0.15, dimDuration, easeInOutCubic),
    ),
    connector.opacity(0.15, dimDuration, easeInOutCubic),
  );

  yield* waitFor(3.0);

  // Восстановить
  yield* all(
    ...Array.from({length: MODULE_SPLIT}, (_, i) =>
      dimSignals[i](0, 0.5, easeInOutCubic),
    ),
    ...Array.from({length: TREE.length - MODULE_SPLIT}, (_, k) =>
      rows[MODULE_SPLIT + k].opacity(1, 0.5, easeInOutCubic),
    ),
    connector.opacity(1, 0.5, easeInOutCubic),
  );
  yield* waitFor(1.5);

  yield* stage.opacity(0, Timing.normal, easeInOutCubic);
  yield* waitFor(0.3);
});
