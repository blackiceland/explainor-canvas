import {blur, makeScene2D, Node, Txt} from '@motion-canvas/2d';
import {createRef, createSignal, easeInOutCubic, waitFor, all} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Fonts} from '../core/theme';

// Титул «Your null means too much» — ГЕРОЙ-ПОСТЕР в одном голосе.
// Весь титул Space Grotesk, один тёплый крем (канон глав-титулов Reversibility/FACES);
// иерархия ТОЛЬКО размером: null — гигант в центре, Your / means too much —
// малые строки сверху/снизу. Без второго шрифта и второго цвета.
// Проявляется КАК ОДНО через focus-pull (blur+opacity на общем корне), статично.

const WARM_CREAM = 'rgba(244, 230, 200, 0.96)';

const NULL_FS = 300;
const WORD_FS = 66;
const GAP_TOP = 250;                  // базовая линия Your над центром
const GAP_BOT = 245;                  // базовая линия means too much под центром

export default makeScene2D(function* (view) {
  applyBackground(view);

  const rootOp = createSignal(0);
  const rootBlur = createSignal(14);
  const root = createRef<Node>();
  view.add(<Node ref={root} opacity={rootOp} filters={[blur(rootBlur)]} />);

  root().add(
    <Txt
      text={'Your'}
      y={-GAP_TOP}
      fontFamily={Fonts.primary}
      fontSize={WORD_FS}
      fontWeight={500}
      letterSpacing={2}
      fill={WARM_CREAM}
    />,
  );
  root().add(
    <Txt
      text={'null'}
      y={0}
      fontFamily={Fonts.primary}
      fontSize={NULL_FS}
      fontWeight={500}
      letterSpacing={4}
      fill={WARM_CREAM}
    />,
  );
  root().add(
    <Txt
      text={'means too much'}
      y={GAP_BOT}
      fontFamily={Fonts.primary}
      fontSize={WORD_FS}
      fontWeight={500}
      letterSpacing={2}
      fill={WARM_CREAM}
    />,
  );

  yield* waitFor(0.4);
  yield* all(rootOp(1, 1.0, easeInOutCubic), rootBlur(0, 1.0, easeInOutCubic));
  yield* waitFor(2.8);
  yield* root().opacity(0, 0.8, easeInOutCubic);
  yield* waitFor(0.4);
});
