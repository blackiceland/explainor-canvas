import {makeScene2D, Node, Txt} from '@motion-canvas/2d';
import {createRef, easeInOutCubic, easeOutCubic, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';

// Титул «Your null / means too much» — ЭССЕ-ЗАГОЛОВОК, строгий сериф
// (направление №3 из лабы, связка с архивной сценой Хоара). Две строки
// ровным кеглем, один тёплый крем, плотный интерлиньяж, простой fade.
// Кандидаты шрифта: Newsreader / Source Serif 4 (переключается константой).

const FONT = 'Newsreader, serif';   // утверждён автором («шрифт отличный»)

const WARM_CREAM = 'rgba(244, 230, 200, 0.96)';
const FS = 148;
const PITCH = 150;                  // −12% по правке автора: строки ближе, читаются одним блоком
const BLOCK_Y = -24;                // оптический центр: блок чуть выше геометрического

export default makeScene2D(function* (view) {
  applyBackground(view);

  const root = createRef<Node>();
  view.add(<Node ref={root} y={BLOCK_Y} opacity={0} />);
  root().add(
    <Txt
      text={'Your null'}
      y={-PITCH / 2}
      fontFamily={FONT}
      fontSize={FS}
      fontWeight={500}
      fill={WARM_CREAM}
    />,
  );
  root().add(
    <Txt
      text={'means too much'}
      y={PITCH / 2}
      fontFamily={FONT}
      fontSize={FS}
      fontWeight={500}
      fill={WARM_CREAM}
    />,
  );

  yield* waitFor(0.3);
  yield* root().opacity(1, 0.85, easeOutCubic);
  yield* waitFor(2.8);
  yield* root().opacity(0, 0.8, easeInOutCubic);
  yield* waitFor(0.4);
});
