import {makeScene2D} from '@motion-canvas/2d';
import {waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
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
    String message = buildGreeting(user);
    sender.send(message, channel);
}`;

export default makeScene2D(function* (view) {
  applyBackground(view);

  const fontSize = 52;
  const lineHeight = Math.round(fontSize * 1.62 * 10) / 10;
  const topInset = Math.max(8, getCodePaddingY(fontSize) - 8);
  const blockHeight = SafeZone.bottom - SafeZone.top - 30;
  const blockWidth = SafeZone.right - SafeZone.left + 200;

  // 4 строки кода — центрируем блок вертикально вручную
  const codeLines = 4;
  const totalCodeH = codeLines * lineHeight;
  const centeredY = -(blockHeight / 2 - totalCodeH / 2 - topInset);

  const code = CodeBlock.fromCode(NOTIFY_CODE, {
    x: 0,
    y: centeredY,
    width: blockWidth,
    height: blockHeight,
    fontSize,
    lineHeight,
    contentOffsetX: 20,
    contentOffsetY: topInset,
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
    // переменные
    const vars = ['user', 'channel', 'message', 'sender'].filter(t => new RegExp(`\\b${t}\\b`).test(line));
    if (vars.length > 0) yield* code.recolorTokens(i, vars, VAR_LIGHT, 0);
    // типы
    if (line.includes('User') || line.includes('String')) {
      yield* code.recolorTokens(i, ['User', 'String'], TYPE_CLEAN, 0);
    }
    // вызовы методов (не сигнатура notify)
    const methods = ['buildGreeting', 'send'].filter(t => line.includes(t));
    if (methods.length > 0) yield* code.recolorTokens(i, methods, DryFiltersV3CodeTheme.method, 0);
  }

  yield* code.appear(Timing.normal);
  yield* waitFor(4);
  yield* code.disappear(Timing.normal);
  yield* waitFor(0.5);
});
