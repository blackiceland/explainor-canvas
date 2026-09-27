import {makeScene2D, Node} from '@motion-canvas/2d';
import {flasksSequence} from '../core/flasks';
import {applyBackground} from '../core/utils';

// ── DON'T FIGHT DUPLICATION · три колбы (отдельной сценой) ──────────────────
// Весь рисунок и таймлайн — в core/flasks.ts; та же последовательность идёт
// продолжением duplicationIdenticalLogicSceneEn. История правок — там же.

export default makeScene2D(function* (view) {
  // Фон — канонический графит (автор вернул его после пробы с чёрным).
  applyBackground(view);
  const stage = new Node({});
  view.add(stage);
  yield* flasksSequence(stage);
});
