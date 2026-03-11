import {makeScene2D} from '@motion-canvas/2d';
import {all, waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingX, measureChar} from '../core/code/shared/TextMeasure';
import {Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

const CODE_CARD_STYLE = {
  radius: 24,
  fill: 'rgba(0,0,0,0)',
  stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0,
  shadowColor: 'rgba(0,0,0,0)',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  edge: false,
} as const;

const NOTIFY_CODE = `void notify(User user, String channel) {
    String address = contacts.getAddress(user);
    sender.send(address, channel);
}`;

export default makeScene2D(function* (view) {
  applyBackground(view);

  const fontSize = 52;
  const lineHeight = Math.round(fontSize * 1.62 * 10) / 10;
  const maxLineLen = Math.max(...NOTIFY_CODE.split('\n').map(l => l.length));
  const blockWidth = maxLineLen * measureChar(fontSize) + getCodePaddingX(fontSize) * 2 + 40;

  // height: 0 → shouldTopAlign = false → код центрируется автоматически
  const code = CodeBlock.fromCode(NOTIFY_CODE, {
    x: 0,
    y: 0,
    width: blockWidth,
    height: 0,
    fontSize,
    lineHeight,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    customTypes: ['User'],
  });
  code.mount(view);

  const lines = NOTIFY_CODE.split('\n');
  const VAR_LIGHT = 'rgba(244, 241, 235, 0.96)';
  const TYPE_CLEAN = 'rgba(220, 215, 255, 0.80)';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // типы
    if (line.includes('User') || line.includes('String')) {
      yield* code.recolorTokens(i, ['User', 'String'], TYPE_CLEAN, 0);
    }
    // вызовы методов — сначала, чтобы переменные потом перезаписали ложные совпадения
    if (line.includes('getAddress(')) {
      yield* code.recolorTokens(i, ['getAddress'], DryFiltersV3CodeTheme.method, 0);
    }
    if (line.includes('sender.send(')) {
      yield* code.recolorTokens(i, ['send'], DryFiltersV3CodeTheme.method, 0);
    }
    // переменные — после методов, чтобы sender/contacts перекрыли ложные совпадения
    const vars = ['user', 'channel', 'address', 'contacts', 'sender'].filter(t => new RegExp(`\\b${t}\\b`).test(line));
    if (vars.length > 0) yield* code.recolorTokens(i, vars, VAR_LIGHT, 0);
  }

  yield* code.appear(Timing.normal);
  yield* waitFor(2);

  const dimOpacity = 0.2;
  const dimDuration = 1.1;
  const glowBlur = 14;
  const glowColor = 'rgba(255, 255, 255, 0.65)';
  const dimAnims: ReturnType<typeof code.setLineTokensOpacity>[] = [];
  const channelAnims: ReturnType<typeof code.setLineTokensOpacityMatching>[] = [];
  const channelGlowAnims: ReturnType<typeof code.setLineTokensGlowMatching>[] = [];
  for (let i = 0; i < lines.length; i++) {
    dimAnims.push(code.setLineTokensOpacity(i, dimOpacity, dimDuration));
    channelAnims.push(code.setLineTokensOpacityMatching(i, ['channel'], 1, dimDuration));
    channelGlowAnims.push(code.setLineTokensGlowMatching(i, ['channel'], glowBlur, glowColor, dimDuration));
  }
  yield* all(...dimAnims, ...channelAnims, ...channelGlowAnims);

  yield* waitFor(2);
  const restoreAnims: ReturnType<typeof code.setLineTokensOpacity>[] = [];
  const resetGlowAnims: ReturnType<typeof code.resetLineTokensGlowMatching>[] = [];
  for (let i = 0; i < lines.length; i++) {
    restoreAnims.push(code.setLineTokensOpacity(i, 1, dimDuration));
    resetGlowAnims.push(code.resetLineTokensGlowMatching(i, ['channel'], dimDuration));
  }
  yield* all(...restoreAnims, ...resetGlowAnims);
  yield* waitFor(0.5);

  yield* code.disappear(1.2);
  yield* waitFor(0.5);
});
