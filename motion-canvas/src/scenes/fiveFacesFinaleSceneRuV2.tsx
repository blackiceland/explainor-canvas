import {makeScene2D} from '@motion-canvas/2d';
import {all, easeInOutSine, waitFor} from '@motion-canvas/core';
import {createFiveFacesStage, NAME_XS} from './fiveFacesBooleanV2Setup';

export default makeScene2D(function* (view) {
  const s = createFiveFacesStage(view);

  // Scene starts with light on POOR MODEL, bgCover already gone.
  s.baseX(NAME_XS[4]);
  s.bgCover().opacity(0);

  yield* waitFor(0.3);

  // All five names light up, all gauges fade in.
  yield* all(
    s.finaleMix(1, 1.0, easeInOutSine),
    s.finaleSpots[0]().opacity(1, 1.0, easeInOutSine),
    s.finaleSpots[1]().opacity(1, 1.0, easeInOutSine),
    s.finaleSpots[2]().opacity(1, 1.0, easeInOutSine),
    s.finaleSpots[3]().opacity(1, 1.0, easeInOutSine),
    ...s.smallScaleNodes.map(n => n().opacity(1, 1.0, easeInOutSine)),
  );

  yield* waitFor(4.0);

  // Final fade-out.
  yield* all(
    s.sceneAlpha(0, 1.4, easeInOutSine),
    s.finaleMix(0, 1.4, easeInOutSine),
    s.mainSpot().opacity(0, 1.4, easeInOutSine),
    s.finaleSpots[0]().opacity(0, 1.4, easeInOutSine),
    s.finaleSpots[1]().opacity(0, 1.4, easeInOutSine),
    s.finaleSpots[2]().opacity(0, 1.4, easeInOutSine),
    s.finaleSpots[3]().opacity(0, 1.4, easeInOutSine),
    ...s.smallScaleNodes.map(n => n().opacity(0, 1.4, easeInOutSine)),
  );
  yield* waitFor(0.6);
});
