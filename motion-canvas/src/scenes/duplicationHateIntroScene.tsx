import {makeScene2D, Txt} from '@motion-canvas/2d';
import {createRef, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Fonts, Timing} from '../core/theme';

// Открытие видео DON'T FIGHT DUPLICATION.
// Канон-эпиграф (как nullMeansIntroSceneEn): одна центрованная строка
// JetBrains Mono, кегль 60, единый бежевый. Без подсветки синтаксиса —
// это фраза, а не код.

const FS = 60;
const BEIGE = 'rgba(232, 207, 174, 0.96)';

const TEXT = 'I hated code duplication';

export default makeScene2D(function* (view) {
  applyBackground(view);

  const line = createRef<Txt>();
  view.add(
    <Txt
      ref={line}
      text={TEXT}
      fontFamily={Fonts.code}
      fontSize={FS}
      fill={BEIGE}
      y={0}
      opacity={0}
    />,
  );

  yield* waitFor(0.15);
  yield* line().opacity(1, Math.max(0.7, Timing.slow * 0.8), easeInOutCubic);
  yield* waitFor(1.25);
  yield* line().opacity(0, Math.max(0.6, Timing.slow * 0.75), easeInOutCubic);
  yield* waitFor(0.15);
});
