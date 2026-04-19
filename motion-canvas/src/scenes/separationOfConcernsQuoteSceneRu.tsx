import {makeScene2D, Node, Txt} from '@motion-canvas/2d';
import {easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Colors, Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

export default makeScene2D(function* (view) {
  applyBackground(view);

  const quoteContainer = new Node({opacity: 0, y: -20});
  view.add(quoteContainer);

  quoteContainer.add(
    <Txt fontFamily={Fonts.primary} fontSize={40} fontWeight={300}
      fill={Colors.text.primary} textAlign="center" y={-40}>
      The <Txt fill={Colors.accent} fontWeight={600}>separation of concerns</Txt> is the only available technique
    </Txt>,
  );
  quoteContainer.add(
    <Txt fontFamily={Fonts.primary} fontSize={40} fontWeight={300}
      fill={Colors.text.primary} textAlign="center" y={20}>
      for effective ordering of one's thoughts.
    </Txt>,
  );
  quoteContainer.add(
    <Txt fontFamily={Fonts.primary} fontSize={24} fill={Colors.text.muted}
      opacity={0.7} fontStyle="italic" textAlign="center" y={100}>
      — Edsger W. Dijkstra, On the Role of Scientific Thought (1974)
    </Txt>,
  );

  yield* quoteContainer.opacity(1, Timing.slow, easeInOutCubic);
  yield* waitFor(3.5);
  yield* quoteContainer.opacity(0, Timing.slow, easeInOutCubic);
  yield* waitFor(0.3);
});
