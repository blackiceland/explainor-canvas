import {Line, makeScene2D} from '@motion-canvas/2d';
import {createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Fonts, Screen, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

// правая панель совпадает с videoExportActionsSceneRu
const PANEL_W       = Screen.width * 5 / 16;           // 600
const PANEL_X       = Screen.width / 2 - PANEL_W / 2;  // 660 (центр правой панели)
const DIVIDER_X     = PANEL_X - PANEL_W / 2;           // 360 (левый край правой панели)

// левая панель: от SafeZone.left до DIVIDER_X
const LEFT_W        = DIVIDER_X - SafeZone.left;       // 360 - (-840) = 1200
const LEFT_CENTER_X = SafeZone.left + LEFT_W / 2;      // -840 + 600 = -240

const CODE_CARD_STYLE = {
  radius: 24, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0, shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
  shadowOffsetX: 0, shadowOffsetY: 0, edge: false,
} as const;

const V0 = `byte[] exportVideo(byte[] sourceFrames, String outputFormat) {
    validateInput(sourceFrames, outputFormat);
    byte[] encoded = runEncoder(sourceFrames);
    return wrapContainer(encoded, outputFormat);
}`;

export default makeScene2D(function* (view) {
  applyBackground(view);

  const fontSize   = 26;
  const lineHeight = Math.round(fontSize * 1.62 * 10) / 10;
  const paddingY   = getCodePaddingY(fontSize);
  const topInset   = Math.max(8, paddingY - 8);

  const SOFT_GREEN    = 'rgba(168, 214, 178, 0.88)';
  const VAR_LIGHT     = 'rgba(244, 241, 235, 0.96)';
  const TYPE_CLEAN    = 'rgba(220, 215, 255, 0.80)';
  const METHOD_COLOR  = DryFiltersV3CodeTheme.method;
  const KEYWORD_COLOR = DryFiltersV3CodeTheme.keyword;

  const dividerOp = createSignal(0);
  view.add(
    <Line
      points={[[DIVIDER_X, SafeZone.top], [DIVIDER_X, SafeZone.bottom]]}
      stroke={'rgba(244,241,235,0.08)'}
      lineWidth={1}
      opacity={dividerOp}
    />,
  );

  const cb = CodeBlock.fromCode(V0, {
    x: LEFT_CENTER_X,
    y: 0,
    width: LEFT_W - 40,
    height: SafeZone.bottom - SafeZone.top - 36,
    fontSize,
    lineHeight,
    contentOffsetY: topInset,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    customTypes: ['String', 'RuntimeException', 'IllegalStateException', 'IllegalArgumentException'],
  });

  cb.mount(view);

  // раскраска токенов
  const lines = V0.split('\n');
  const variableTokens = ['sourceFrames', 'outputFormat', 'encoded'];
  const methodTokens   = ['validateInput', 'runEncoder', 'wrapContainer', 'exportVideo'];
  const typeTokens     = ['String'];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const vars = variableTokens.filter(t => new RegExp(`\\b${t}\\b`).test(line));
    if (vars.length) yield* cb.recolorTokens(i, vars, VAR_LIGHT, 0);
    const quoted: string[] = [];
    const re = /"[^"\n]*"/g; let m = re.exec(line);
    while (m) { quoted.push(m[0]); m = re.exec(line); }
    if (quoted.length) yield* cb.recolorTokens(i, quoted, SOFT_GREEN, 0);
    const types = typeTokens.filter(t => line.includes(t));
    if (types.length) yield* cb.recolorTokens(i, types, TYPE_CLEAN, 0);
    const methods = methodTokens.filter(t => line.includes(t));
    if (methods.length) yield* cb.recolorTokens(i, methods, METHOD_COLOR, 0);
    if (line.includes('exportVideo(')) yield* cb.recolorTokens(i, ['exportVideo'], VAR_LIGHT, 0);
  }

  yield* dividerOp(1, 0.4, easeInOutCubic);
  yield* cb.appear(Timing.normal);
  yield* waitFor(3);
});
