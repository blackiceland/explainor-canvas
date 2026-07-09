import {makeScene2D} from '@motion-canvas/2d';
import {easeInOutSine, waitFor} from '@motion-canvas/core';
import {paintCanonParams, paintCanonMethodCalls} from '../core/code/model/paletteCanon';
import {createFiveFacesStage, NAME_XS, CANON_CODE_RULES} from './fiveFacesBooleanV2Setup';

export default makeScene2D(function* (view) {
  const s = createFiveFacesStage(view);

  // Канон-палитра на код лица (setup красил старым CODE_RULES; морфов тут нет)
  for (const mc of [s.callCodes[4], s.implCodes[4]]) {
    mc.colorize(CANON_CODE_RULES);
    paintCanonParams(mc);
    paintCanonMethodCalls(mc);
  }

  // Scene starts with light at SHORTCUT's position, bgCover already gone.
  s.baseX(NAME_XS[3]);
  s.bgCover().opacity(0);

  yield* waitFor(0.2);
  yield* s.runFace(4, 0.9, 4.5, 2.0, 3.8, 2.2);
});
