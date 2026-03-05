import {Code, lines, makeScene2D, Rect} from '@motion-canvas/2d';
import {all, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Fonts, Screen} from '../core/theme';
import {JavaClass, method, param} from '../core/code/model/JavaModel';
import {tokenizeLine} from '../core/code/model/Tokenizer';
import {getTokenColor} from '../core/code/model/SyntaxTheme';
import {PosterTheme} from '../core/code/components/CodePoster';
import {ColorRule} from '../core/code/components/Manticore';

const BG = '#121212';
const FONT = Fonts.code;
const THEME = PosterTheme;

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
        ctx.fillStyle = getTokenColor(tok.type, THEME);
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
  contextGroup.add(codeLine('class ExportContext {', lineY(0)));
  contextGroup.add(codeLine('}', lineY(6)));
  contextGroup.add(codeLine(`${INDENT}byte[] sourceFrames;`, lineY(1)));
  contextGroup.add(codeLine(`${INDENT}String outputFormat;`, lineY(2)));
  contextGroup.add(codeLine(`${INDENT}String colorProfile;`, lineY(3)));
  contextGroup.add(codeLine(`${INDENT}String subtitleTrack;`, lineY(4)));
  contextGroup.add(codeLine(`${INDENT}byte[] preparedFrames;`, lineY(5)));
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
    x: rightCenterX, y: -95,
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
    moveDuration: 0.8,
    removeDuration: 0.4,
  });
  yield* waitFor(3.0);

  // 3. Fade out
  yield* all(
    contextGroup.opacity(0, 0.55, easeInOutCubic),
    manticore.disappear(0.55),
  );
  yield* waitFor(0.3);
});
