import {blur, Code, lines, makeScene2D, Rect} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Fonts, Screen} from '../core/theme';
import {JavaClass, method, param} from '../core/code/model/JavaModel';
import {tokenizeLine} from '../core/code/model/Tokenizer';
import {getTokenColor} from '../core/code/model/SyntaxTheme';
import {ColorRule} from '../core/code/components/Manticore';

const BG = '#121212';
const FONT = Fonts.code;
const THEME = DryFiltersV3CodeTheme;

const VAR_LIGHT = 'rgba(244, 241, 235, 0.96)';
const TYPE_CLEAN = 'rgba(220, 215, 255, 0.80)';
const METHOD_COLOR = DryFiltersV3CodeTheme.method;
const SOFT_GREEN = 'rgba(168, 214, 178, 0.88)';

const COLOR_RULES: ColorRule[] = [
  {match: 'sourceFrames',      color: VAR_LIGHT},
  {match: 'outputFormat',      color: VAR_LIGHT},
  {match: 'colorProfile',      color: VAR_LIGHT},
  {match: 'subtitleTrack',     color: VAR_LIGHT},
  {match: 'preparedFrames',    color: VAR_LIGHT},
  {match: 'normalizedFrames',  color: VAR_LIGHT},
  {match: 'coloredFrames',     color: VAR_LIGHT},
  {match: /^byte$/,            color: TYPE_CLEAN},
  {match: 'String',            color: TYPE_CLEAN},
  {match: 'ExportContext',     color: TYPE_CLEAN},
  {match: 'ctx',               color: VAR_LIGHT},
  {match: 'exportVideo',       color: VAR_LIGHT},
  {match: 'validateInput',     color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'prepareFrames',     color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'encodeWithRetry',   color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'normalizeFrames',   color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'applyColorProfile', color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'overlaySubtitles',  color: METHOD_COLOR, onlyTypes: ['method']},
  {match: /^"[^"]*"$/,         color: SOFT_GREEN},
];

const MAX_CHARS = 60;

// ── Before: pass-through parameters ─────────────────────────────────────
const modelBefore = JavaClass.create([
  method('public', 'byte[]', 'exportVideo',
    [param('byte[]', 'sourceFrames'), param('String', 'outputFormat'),
     param('String', 'colorProfile'), param('String', 'subtitleTrack')],
    ['validateInput(sourceFrames, outputFormat);',
     'byte[] prepared = prepareFrames(sourceFrames, colorProfile, subtitleTrack);',
     '',
     'return encodeWithRetry(prepared, outputFormat);']),
  method('private', 'byte[]', 'prepareFrames',
    [param('byte[]', 'frames'), param('String', 'colorProfile'),
     param('String', 'subtitleTrack')],
    ['byte[] normalized = normalizeFrames(frames);',
     'byte[] colored = applyColorProfile(normalized, colorProfile);',
     '',
     'return overlaySubtitles(colored, subtitleTrack);']),
], MAX_CHARS);

const CODE_BEFORE = modelBefore.render();

// ── After: ExportContext ctx ────────────────────────────────────────────
const modelAfter = JavaClass.create([
  method('public', 'byte[]', 'exportVideo',
    [param('ExportContext', 'ctx')],
    ['validateInput(ctx);',
     'byte[] prepared = prepareFrames(ctx);',
     '',
     'return encodeWithRetry(ctx);']),
  method('private', 'byte[]', 'prepareFrames',
    [param('ExportContext', 'ctx')],
    ['byte[] normalized = normalizeFrames(ctx);',
     'byte[] colored = applyColorProfile(ctx);',
     '',
     'return overlaySubtitles(ctx);']),
], MAX_CHARS);

const CODE_AFTER = modelAfter.render();
const AFTER_LINES = CODE_AFTER.split('\n');

const modelAfterMutation = JavaClass.create([
  method('public', 'byte[]', 'exportVideo',
    [param('ExportContext', 'ctx')],
    ['validateInput(ctx);',
     'ctx.outputFormat = "webm";',
     'byte[] prepared = prepareFrames(ctx);',
     '',
     'return encodeWithRetry(prepared, ctx);']),
  method('private', 'byte[]', 'prepareFrames',
    [param('ExportContext', 'ctx')],
    ['byte[] normalized = normalizeFrames(ctx);',
     'byte[] colored = applyColorProfile(ctx);',
     '',
     'return overlaySubtitles(ctx);']),
], MAX_CHARS);

const CODE_AFTER_MUTATION = modelAfterMutation.render();

const modelChain = JavaClass.create([
  method('public', 'byte[]', 'exportVideo',
    [param('ExportContext', 'ctx')],
    ['validateInput(ctx);',
     'ctx.outputFormat = "webm";',
     'byte[] prepared = prepareFrames(ctx);',
     '',
     'return encodeWithRetry(prepared, ctx);']),
  method('private', 'byte[]', 'prepareFrames',
    [param('ExportContext', 'ctx')],
    ['byte[] normalized = normalizeFrames(ctx);',
     'byte[] colored = applyColorProfile(ctx);',
     '',
     'return overlaySubtitles(ctx);']),
  method('private', 'byte[]', 'encodeWithRetry',
    [param('byte[]', 'preparedFrames'), param('ExportContext', 'ctx')],
    ['int attemptsLeft = 3;',
     'while (attemptsLeft-- > 0) {',
     '    try {',
     '        return encode(preparedFrames, ctx);',
     '    } catch (RuntimeException ex) {',
     '        // retry',
     '    }',
     '}',
     'throw new IllegalStateException("Encoding failed");']),
  method('private', 'byte[]', 'encode',
    [param('ExportContext', 'ctx')],
    ['if (ctx.outputFormat.equals("mp4")) {',
     '    return fastEncode(ctx);',
     '}',
     'return slowEncode(ctx);']),
], MAX_CHARS);

const CODE_CHAIN = modelChain.render();
const CHAIN_LINES = CODE_CHAIN.split('\n');

// ── Left side: same components as contextObjectSceneRu ──────────────────
const CODE_LEFT = -875;
const BLOCK_TOP = -210;
const INDENT = '   ';
const CONTEXT_FS = 44;
const CONTEXT_LH = 72;

function contextHooks() {
  return {
    token: (
      ctx: CanvasRenderingContext2D,
      text: string,
      position: {x: number; y: number},
    ) => {
      const raw = String(text ?? '');
      let x = position.x;
      const tokens = tokenizeLine(raw);
      for (const tok of tokens) {
        const isQuoted = /^"[^"]*"$/.test(tok.text);
        ctx.fillStyle = isQuoted ? SOFT_GREEN : getTokenColor(tok.type, THEME);
        ctx.fillText(tok.text, x, position.y);
        x += ctx.measureText(tok.text).width;
      }
    },
  };
}

export default makeScene2D(function* (view) {
  view.add(<Rect width={1920} height={1080} fill={BG} />);

  const lineY = (idx: number) => BLOCK_TOP + idx * CONTEXT_LH;
  const codeLine = (text: string, y: number) =>
    new Code({
      code: text,
      fontFamily: FONT,
      fontSize: CONTEXT_FS,
      lineHeight: CONTEXT_LH,
      x: CODE_LEFT,
      y,
      offset: [-1, 0],
      opacity: 1,
      selection: lines(0, Infinity),
      drawHooks: contextHooks(),
    });

  // ── Left: same final look as contextObjectSceneRu ─────────────────────
  const contextGroup = new Rect({opacity: 1});
  const contextBlur = createSignal(0);
  contextGroup.filters(() => [blur(contextBlur())]);
  const openingBrace = codeLine('class ExportContext {', lineY(0));
  contextGroup.add(openingBrace);
  const closingBrace = codeLine('}', lineY(6));
  contextGroup.add(closingBrace);
  contextGroup.add(codeLine(`${INDENT}byte[] sourceFrames;`, lineY(1)));
  contextGroup.add(codeLine(`${INDENT}String outputFormat;`, lineY(2)));
  contextGroup.add(codeLine(`${INDENT}String colorProfile;`, lineY(3)));
  contextGroup.add(codeLine(`${INDENT}String subtitleTrack;`, lineY(4)));
  contextGroup.add(codeLine(`${INDENT}byte[] preparedFrames;`, lineY(5)));

  const TOP_EXTRA_FIELDS = [
    `${INDENT}String tenantId;`,
    `${INDENT}long requestId;`,
    `${INDENT}String traceId;`,
  ];
  const BOTTOM_EXTRA_FIELDS = [
    `${INDENT}boolean retryFailed;`,
    `${INDENT}int attemptCount;`,
    `${INDENT}Map<String, String> metadata;`,
  ];

  const topExtraLines = TOP_EXTRA_FIELDS.map((text, i) => {
    const node = codeLine(text, lineY(0) - i * CONTEXT_LH);
    node.opacity(0);
    return node;
  });
  const bottomExtraLines = BOTTOM_EXTRA_FIELDS.map((text, i) => {
    const node = codeLine(text, lineY(6) + i * CONTEXT_LH);
    node.opacity(0);
    return node;
  });
  topExtraLines.forEach(n => contextGroup.add(n));
  bottomExtraLines.forEach(n => contextGroup.add(n));

  view.add(contextGroup);

  // ── Right: Manticore ──────────────────────────────────────────────────
  // Strict right-side geometry, shifted a bit left, with larger code
  const RIGHT_REGION_LEFT = -80;
  const RIGHT_REGION_WIDTH = Screen.width / 2 + 10;
  const rightCenterX = RIGHT_REGION_LEFT + RIGHT_REGION_WIDTH / 2;

  const fontSize = 28;
  const lineHeight = Math.round(fontSize * 1.62 * 10) / 10;
  const paddingY = getCodePaddingY(fontSize);
  const topInset = Math.max(8, paddingY - 8);

  const manticore = Manticore.create(CODE_BEFORE, {
    x: rightCenterX, y: -45,
    width: RIGHT_REGION_WIDTH,
    height: SafeZone.bottom - SafeZone.top - 5,
    fontSize, lineHeight,
    contentOffsetY: topInset,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: {
      radius: 24, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)',
      strokeWidth: 0, shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
      shadowOffsetX: 0, shadowOffsetY: 0, edge: false,
    },
    glowAccent: false,
    customTypes: ['String', 'ExportContext'],
  });
  manticore.mount(view);
  manticore.colorize(COLOR_RULES);

  // ── Animation ─────────────────────────────────────────────────────────

  // 1. Seamless start: context already visible, appear only right code
  yield* manticore.appear(0.7);
  yield* waitFor(1.5);

  // 2. Morph: pass-through params → ExportContext ctx
  yield* manticore.morphTo(CODE_AFTER, {
    scrollStrategy: 'block',
    addStyle: 'fade',
    lineOrder: 'parallel',
    blockOrder: 'parallel',
    charDelay: 0.045,
    lineDelay: 0,
    moveDuration: 0.8,
    removeDuration: 0.4,
  });
  yield* waitFor(1.8);

  // 3. Context bloats in both directions: one top + one bottom per step
  const BLOAT_DUR = 0.35;
  for (let i = 0; i < Math.min(topExtraLines.length, bottomExtraLines.length); i++) {
    yield* all(
      openingBrace.y(lineY(0) - (i + 1) * CONTEXT_LH, BLOAT_DUR, easeInOutCubic),
      closingBrace.y(lineY(6 + i + 1), BLOAT_DUR, easeInOutCubic),
      topExtraLines[i].opacity(1, BLOAT_DUR, easeInOutCubic),
      bottomExtraLines[i].opacity(1, BLOAT_DUR, easeInOutCubic),
    );
    yield* waitFor(0.08);
  }
  yield* waitFor(0.6);

  // 3b. Highlight unchanged signatures: dim all, restore only signature lines
  const exportSig = AFTER_LINES.findIndex(l => l.includes('public byte[] exportVideo('));
  const prepareSig = AFTER_LINES.findIndex(l => l.includes('private byte[] prepareFrames('));
  const totalAfterLines = AFTER_LINES.length;
  yield* manticore.dimLines(0, totalAfterLines - 1, 0.15, 0.45);
  const sigAnims: Generator[] = [];
  if (exportSig >= 0) {
    sigAnims.push(manticore.dimLines(exportSig, exportSig, 1, 0.35));
  }
  if (prepareSig >= 0) {
    sigAnims.push(manticore.dimLines(prepareSig, prepareSig, 1, 0.35));
  }
  if (sigAnims.length > 0) yield* all(...sigAnims);
  yield* waitFor(1.8);

  // 3c. Restore all lines, then blur context
  yield* manticore.showAllLines(0.35);
  yield* contextBlur(5, 0.45, easeInOutCubic);

  // 4. Runtime mutation of context field in exportVideo
  yield* manticore.morphTo(CODE_AFTER_MUTATION, {
    scrollStrategy: 'block',
    addStyle: 'fade',
    lineOrder: 'parallel',
    blockOrder: 'parallel',
    charDelay: 0.05,
    lineDelay: 0,
    moveDuration: 0.75,
    removeDuration: 0.35,
  });
  yield* waitFor(0.6);

  // 5. Build deeper chain while scrolling down to the new methods
  yield* manticore.morphTo(CODE_CHAIN, {
    scrollStrategy: 'block',
    addStyle: 'fade',
    lineOrder: 'parallel',
    blockOrder: 'parallel',
    charDelay: 0.04,
    lineDelay: 0,
    moveDuration: 0.75,
    removeDuration: 0.35,
  });
  yield* manticore.scrollTo('private byte[] encode(', 2.5);
  yield* waitFor(1.0);

  // 6. Highlight if-block: dim entire encode, then restore if-block
  const encodeStart = CHAIN_LINES.findIndex(l => l.includes('private byte[] encode(ExportContext ctx)'));
  const ifLine = CHAIN_LINES.findIndex(l => l.includes('if (ctx.outputFormat.equals("mp4"))'));
  const fastLine = CHAIN_LINES.findIndex(l => l.includes('return fastEncode(ctx);'));
  const ifCloseLine = CHAIN_LINES.findIndex((l, idx) => idx > fastLine && l.trim() === '}');
  const slowLine = CHAIN_LINES.findIndex(l => l.includes('return slowEncode(ctx);'));

  if (
    encodeStart >= 0 && slowLine >= encodeStart &&
    ifLine >= 0 && ifCloseLine >= ifLine
  ) {
    yield* all(
      manticore.dimLines(encodeStart, slowLine, 0.22, 0.45),
      manticore.dimLines(ifLine, ifCloseLine, 1, 0.45),
    );
  } else if (encodeStart >= 0 && slowLine >= encodeStart) {
    yield* manticore.dimLines(encodeStart, slowLine, 0.22, 0.45);
  } else if (ifLine >= 0 && ifCloseLine >= ifLine) {
    yield* manticore.dimLines(ifLine, ifCloseLine, 1, 0.45);
  }
  yield* waitFor(1.5);

  // 7. Freeze highlighted frame and show popups on top
  const POPUP_FS = 28;
  const POPUP_LH = 42;
  const PAD_X = 28;
  const PAD_Y = 22;
  const FRAME_W = Screen.width;
  const FRAME_H = Screen.height;
  const FRAME_MARGIN_X = 64;
  const FRAME_MARGIN_Y = 56;
  const CHAR_W = POPUP_FS * 0.62;
  const MIN_W = 560;
  const MAX_W = FRAME_W - FRAME_MARGIN_X * 2;
  const MIN_H = 180;
  const MAX_H = FRAME_H - FRAME_MARGIN_Y * 2;

  function fitTopLeft(x: number, y: number, width: number, height: number) {
    const minX = -FRAME_W / 2 + FRAME_MARGIN_X;
    const maxX = FRAME_W / 2 - FRAME_MARGIN_X - width;
    const minY = -FRAME_H / 2 + FRAME_MARGIN_Y;
    const maxY = FRAME_H / 2 - FRAME_MARGIN_Y - height;
    return {
      x: Math.min(maxX, Math.max(minX, x)),
      y: Math.min(maxY, Math.max(minY, y)),
    };
  }

  function makePopup(codeLines: string[], preferredX: number, preferredY: number) {
    const codeText = codeLines.join('\n');
    const longest = codeLines.reduce((m, l) => Math.max(m, l.length), 0);
    const width = Math.min(MAX_W, Math.max(MIN_W, Math.ceil(longest * CHAR_W + PAD_X * 2)));
    const height = Math.min(MAX_H, Math.max(MIN_H, Math.ceil(codeLines.length * POPUP_LH + PAD_Y * 2)));
    const pos = fitTopLeft(preferredX, preferredY, width, height);

    const plate = new Rect({
      x: pos.x,
      y: pos.y,
      width,
      height,
      radius: 26,
      fill: 'rgba(22, 22, 22, 0.88)',
      stroke: 'rgba(255, 255, 255, 0)',
      lineWidth: 0,
      shadowColor: 'rgba(0, 0, 0, 0.38)',
      shadowBlur: 34,
      shadowOffsetY: 10,
      opacity: 0,
      offset: [-1, -1],
    });

    const code = new Code({
      code: codeText,
      fontFamily: Fonts.code,
      fontSize: POPUP_FS,
      lineHeight: POPUP_LH,
      x: pos.x + PAD_X,
      y: pos.y + PAD_Y,
      offset: [-1, -1],
      selection: lines(0, Infinity),
      drawHooks: contextHooks(),
      opacity: 0,
    });

    view.add(plate);
    view.add(code);
    return {plate, code};
  }

  const popupA = makePopup(
    [
      'void resolveProfile(ExportContext ctx) {',
      '    String profile = ctx.metadata.get("profile");',
      '',
      '    if (Objects.isNull(profile)) {',
      '        return;',
      '    }',
      '',
      '    ctx.outputFormat = profileToFormat(profile);',
      '}',
    ],
    -FRAME_W / 2 + FRAME_MARGIN_X - 25,
    -FRAME_H / 2 + FRAME_MARGIN_Y + 100,
  );

  const popupB = makePopup(
    [
      'void applyFallback(ExportContext ctx) {',
      '    if (Objects.isNull(ctx.outputFormat)) {',
      '        ctx.outputFormat = "mp4";',
      '    }',
      '}',
    ],
    FRAME_W / 2 - FRAME_MARGIN_X - 910,
    -20,
  );

  const popupC = makePopup(
    [
      'void negotiateFormat(ExportContext ctx, ClientCapabilities caps) {',
      '    if (caps.supportsFormat(ctx.outputFormat)) {',
      '        return;',
      '    }',
      '',
      '    ctx.outputFormat = caps.getPreferredFormat();',
      '}',
    ],
    -FRAME_W / 2 + FRAME_MARGIN_X - 25,
    FRAME_H / 2 - FRAME_MARGIN_Y - 400,
  );

  yield* all(
    popupA.plate.opacity(1, 0.35, easeInOutCubic),
    popupA.code.opacity(1, 0.35, easeInOutCubic),
  );
  yield* waitFor(0.9);
  yield* all(
    popupB.plate.opacity(1, 0.35, easeInOutCubic),
    popupB.code.opacity(1, 0.35, easeInOutCubic),
  );
  yield* waitFor(0.9);
  yield* all(
    popupC.plate.opacity(1, 0.35, easeInOutCubic),
    popupC.code.opacity(1, 0.35, easeInOutCubic),
  );
  yield* waitFor(2.0);
});
