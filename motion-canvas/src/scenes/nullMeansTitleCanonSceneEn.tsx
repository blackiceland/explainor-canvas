import {makeScene2D, Node, Txt} from '@motion-canvas/2d';
import {createRef, easeInOutCubic, easeOutCubic, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Fonts} from '../core/theme';

// Титул «Your null / means too much» — ЧИСТЫЙ КАНОН глав-титулов
// (chapter2ReversibilitySceneEn): Space Grotesk 500, один тёплый крем,
// ровный кегль на обеих строках, простой fade. Без концептов: без второго
// шрифта, без второго цвета, без игры размеров.

const WARM_CREAM = 'rgba(244, 230, 200, 0.96)';
const FS = 130;
const PITCH = 176;

export default makeScene2D(function* (view) {
  applyBackground(view);

  const root = createRef<Node>();
  view.add(<Node ref={root} y={-14} opacity={0} />);
  root().add(
    <Txt
      text={'Your null'}
      y={-PITCH / 2}
      fontFamily={Fonts.primary}
      fontSize={FS}
      fontWeight={500}
      letterSpacing={4}
      fill={WARM_CREAM}
    />,
  );
  root().add(
    <Txt
      text={'means too much'}
      y={PITCH / 2}
      fontFamily={Fonts.primary}
      fontSize={FS}
      fontWeight={500}
      letterSpacing={4}
      fill={WARM_CREAM}
    />,
  );

  yield* waitFor(0.3);
  yield* root().opacity(1, 0.85, easeOutCubic);
  yield* waitFor(2.8);
  yield* root().opacity(0, 0.8, easeInOutCubic);
  yield* waitFor(0.4);
});
