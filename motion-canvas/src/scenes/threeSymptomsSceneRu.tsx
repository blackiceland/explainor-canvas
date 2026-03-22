import {makeScene2D, Txt, Node} from '@motion-canvas/2d';
import {all, easeInOutCubic, linear, waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Colors, Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';
import {CODE_V4} from './codeWithActionsSceneRu.states';
import {
  CODE_CARD_STYLE,
  COLOR_RULES,
  METHOD_COLOR,
  VAR_LIGHT,
  TYPE_CLEAN,
  SOFT_GREEN,
  PASS_THROUGH,
} from './codeWithActionsSceneRu.config';

const SYMPTOM_CLR = Colors.text.primary;
const SYMPTOM_MUTED = Colors.text.muted;
const DIVIDER_X = -80;

const SYMPTOMS = [
  'Cascading\nChanges',
  'Hidden\nCoupling',
  'Interface\nPollution',
];

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ── Правая часть: скроллящийся код ──────────────────────────────────────
  const fontSize = 18;
  const lineHeight = Math.round(fontSize * 1.55 * 10) / 10;
  const paddingY = getCodePaddingY(fontSize);
  const topInset = Math.max(8, paddingY - 6);

  const codeWidth = SafeZone.right - DIVIDER_X - 40;
  const codeHeight = SafeZone.bottom - SafeZone.top - 40;
  const codeCenterX = DIVIDER_X + 20 + codeWidth / 2;

  const codeBlock = CodeBlock.fromCode(CODE_V4, {
    x: codeCenterX,
    y: 0,
    width: codeWidth,
    height: codeHeight,
    fontSize,
    lineHeight,
    contentOffsetY: topInset,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    customTypes: [
      'Container',
      'Muxer',
      'Metadata',
      'MetadataWriter',
      'ContentSigner',
      'Instant',
    ],
  });

  codeBlock.mount(view);

  // ── Левая часть: три надписи ────────────────────────────────────────────
  const labelFontSize = 56;
  const labelArea = SafeZone.bottom - SafeZone.top - 80;
  const labelSpacing = labelArea / (SYMPTOMS.length - 1);
  const labelStartY = SafeZone.top + 80;
  const labelX = SafeZone.left + (DIVIDER_X - SafeZone.left) / 2;

  const labels: Txt[] = [];

  for (let i = 0; i < SYMPTOMS.length; i++) {
    const label = new Txt({
      text: SYMPTOMS[i],
      fontFamily: Fonts.primary,
      fontWeight: 700,
      fontSize: labelFontSize,
      lineHeight: labelFontSize * 1.15,
      fill: SYMPTOM_CLR,
      x: labelX,
      y: labelStartY + i * labelSpacing,
      opacity: 0,
      textAlign: 'center',
    });
    labels.push(label);
    view.add(label);
  }

  // ── Анимация: код появляется ────────────────────────────────────────────
  yield* codeBlock.appear(Timing.normal);

  // ── Анимация: надписи появляются по очереди + код скроллится ─────────────
  const lines = CODE_V4.split('\n');
  const clipHeight = codeHeight - paddingY * 2;
  const targetLastY = clipHeight / 2 - lineHeight / 2 - 12;
  const startY = -clipHeight / 2 + topInset + lineHeight / 2;
  const currentLastY = startY + (lines.length - 1) * lineHeight;
  const scrollAmount = Math.max(0, currentLastY - targetLastY + 24);
  const scrollDuration = 14;

  const scrollGen = codeBlock.animateScrollY(scrollAmount, scrollDuration);

  const labelDelay = scrollDuration / (SYMPTOMS.length + 1);

  function* labelSequence() {
    for (let i = 0; i < labels.length; i++) {
      yield* waitFor(labelDelay);
      yield* all(
        labels[i].opacity(1, 0.6, easeInOutCubic),
        labels[i].y(labels[i].y() - 10, 0.6, easeInOutCubic),
      );
    }
  }

  yield* all(scrollGen, labelSequence());

  yield* waitFor(1.5);

  // ── Fade out ────────────────────────────────────────────────────────────
  yield* all(
    ...labels.map(l => l.opacity(0, Timing.normal, easeInOutCubic)),
    codeBlock.disappear(Timing.normal),
  );
});
