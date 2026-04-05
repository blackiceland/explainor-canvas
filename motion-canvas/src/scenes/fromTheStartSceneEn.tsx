import {makeScene2D, Txt} from '@motion-canvas/2d';
import {createRef, easeInCubic, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Colors, Fonts} from '../core/theme';

export default makeScene2D(function* (view) {
  applyBackground(view);

  const txt = createRef<Txt>();

  view.add(
    <Txt
      ref={txt}
      text={'FROM THE START'}
      fontFamily={Fonts.primary}
      fontWeight={700}
      fontSize={140}
      fill={Colors.text.primary}
      opacity={0}
    />,
  );

  // Flash
  txt().opacity(1);

  // Immediate fade out
  yield* txt().opacity(0, 1.0, easeInCubic);
});
