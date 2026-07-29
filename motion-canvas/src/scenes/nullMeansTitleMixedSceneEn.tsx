import {blur, makeScene2D, Node, Txt} from '@motion-canvas/2d';
import {createRef, createSignal, easeInOutCubic, waitFor, all} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Fonts} from '../core/theme';

// Титул «Your null means too much» — СМЕШАННАЯ ТИПОГРАФИКА, продолжение финала
// интро: null остаётся моно-токеном (JetBrains Mono, беж интро, тот же лёгкий
// тёплый глоу) в центре кадра — ровно там, где его оставил nullMeansIntroSceneEn.
// Человеческие слова Your / means too much проявляются ВОКРУГ него в Space
// Grotesk кремом (канон глав-титулов). Типографика разыгрывает тезис: код-токен,
// обставленный человеческими словами, которые требуют от него значить слишком много.
//
// Композиция статичная; слова проявляются КАК ОДНО через focus-pull
// (blur+opacity на общем родителе), не постадийно.

const BEIGE = 'rgba(232, 207, 174, 0.96)';       // null — беж интро (моно-эпиграф)
const WARM_CREAM = 'rgba(244, 230, 200, 0.96)';  // слова — крем глав-титулов
const GLOW_WARM = 'rgba(255, 228, 190, 1)';
const GLOW_OP = 0.18;

const NULL_FS = 190;                              // токен — протагонист, крупнее слов
const GLOW_BLUR = 28;                             // тот же плотный ореол интро (9@60), масштаб к кеглю
const WORD_FS = 96;
const WORD_GAP = 215;                             // базовые линии слов от центра

export default makeScene2D(function* (view) {
  applyBackground(view);

  const root = createRef<Node>();
  view.add(<Node ref={root} />);

  root().add(
    <Txt
      text={'null'}
      y={0}
      fontFamily={Fonts.code}
      fontSize={NULL_FS}
      fill={GLOW_WARM}
      opacity={GLOW_OP}
      filters={[blur(GLOW_BLUR)]}
      compositeOperation={'lighter'}
    />,
  );
  root().add(
    <Txt text={'null'} y={0} fontFamily={Fonts.code} fontSize={NULL_FS} fill={BEIGE} />,
  );

  const wordsOp = createSignal(0);
  const wordsBlur = createSignal(12);
  root().add(
    <Node opacity={wordsOp} filters={[blur(wordsBlur)]}>
      <Txt
        text={'Your'}
        y={-WORD_GAP}
        fontFamily={Fonts.primary}
        fontSize={WORD_FS}
        fontWeight={500}
        letterSpacing={2}
        fill={WARM_CREAM}
      />
      <Txt
        text={'means too much'}
        y={WORD_GAP}
        fontFamily={Fonts.primary}
        fontSize={WORD_FS}
        fontWeight={500}
        letterSpacing={2}
        fill={WARM_CREAM}
      />
    </Node>,
  );

  // null уже в кадре с первого фрейма — склейка с финалом интро, где он один.
  yield* waitFor(0.5);
  yield* all(wordsOp(1, 0.9, easeInOutCubic), wordsBlur(0, 0.9, easeInOutCubic));
  yield* waitFor(2.8);
  yield* root().opacity(0, 0.8, easeInOutCubic);
  yield* waitFor(0.4);
});
