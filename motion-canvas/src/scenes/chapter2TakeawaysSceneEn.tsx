import {Node, Txt, makeScene2D} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, makeRef, waitFor} from '@motion-canvas/core';
import {Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

// Takeaways главы 2 — тот же бит, что в pureBooleanTakeawaySceneEn (две колонки
// на общей строчной сетке: Takeaways слева, Further reading справа), но тире
// стоит на ПЕРВОЙ строке пункта, а не по центру блока: пункты набраны одной
// строкой без textWrap и стоят на линии НАЗВАНИЯ книги (1-я строка пункта ↔
// название, как в рефе), тире — на той же линии.
const CREAM      = '#F4F1EB';
const WARM       = 'rgba(232, 207, 174, 0.96)';
const WARM_MUTED = 'rgba(232, 207, 174, 0.55)';

const TAKE_TITLE = 'Takeaways';
const POINTS = [
  'Keep it reversible.',
  'Let change reveal the boundary.',
  'Extract only what the evidence supports.',
];

const READ_TITLE = 'Further reading';
const BOOKS = [
  {title: 'The Wrong Abstraction', meta: 'Sandi Metz'},
  {title: 'The Pragmatic Programmer', meta: 'David Thomas · Andrew Hunt'},
  {title: 'Refactoring', meta: 'Martin Fowler'},
  {title: '99 Bottles of OOP', meta: 'Sandi Metz · Katrina Owen'},
  {title: 'Tidy First?', meta: 'Kent Beck'},
];

// Обе колонки на ОДНОЙ сетке rowY(i)=ROW0+i·PITCH: строка тезиса и строки книги
// стоят на одних линиях (название ↔ строка тезиса, автор — на HALF ниже).
const LEFT_X = -860;
const READ_X = 170;
const HEAD_Y = -350;
const ROW0   = -200;
const PITCH  = 116;
const HALF   = 21;
const rowY = (i: number): number => ROW0 + i * PITCH;

export default makeScene2D(function* (view) {
  applyBackground(view);

  const take = createRef<Node>();
  const title = createRef<Txt>();
  const bullets: Txt[] = [];
  const notes: Txt[] = [];
  view.add(
    <Node ref={take}>
      <Txt ref={title} x={LEFT_X + 44} y={HEAD_Y} text={TAKE_TITLE} fontFamily={Fonts.primary}
           fontSize={56} fontWeight={600} fill={CREAM} offset={[-1, 0]} textAlign={'left'} opacity={0} />
      {POINTS.map((p, i) => (
        <Txt ref={makeRef(bullets, i)} x={LEFT_X} y={rowY(i) - HALF} text={'—'}
             fontFamily={Fonts.code} fontSize={28} lineHeight={42} fill={WARM_MUTED}
             offset={[-1, 0]} textAlign={'left'} opacity={0} />
      ))}
      {POINTS.map((p, i) => (
        <Txt ref={makeRef(notes, i)} x={LEFT_X + 44} y={rowY(i) - HALF} text={p}
             fontFamily={Fonts.code} fontSize={28} lineHeight={42} fill={WARM}
             offset={[-1, 0]} textAlign={'left'} opacity={0} />
      ))}
    </Node>,
  );

  const reading = createRef<Node>();
  view.add(
    <Node ref={reading} opacity={0}>
      <Txt x={READ_X} y={HEAD_Y} text={READ_TITLE} fontFamily={Fonts.primary}
           fontSize={56} fontWeight={600} fill={CREAM} offset={[-1, 0]} textAlign={'left'} />
      {BOOKS.map((b, i) => (
        <Txt x={READ_X} y={rowY(i) - HALF} text={b.title} fontFamily={Fonts.code}
             fontSize={28} lineHeight={42} fill={WARM} offset={[-1, 0]} textAlign={'left'} />
      ))}
      {BOOKS.map((b, i) => (
        <Txt x={READ_X} y={rowY(i) + HALF} text={b.meta} fontFamily={Fonts.code}
             fontSize={28} lineHeight={42} fill={WARM_MUTED} offset={[-1, 0]} textAlign={'left'} />
      ))}
    </Node>,
  );

  // Сначала — весь текст takeaways (шапка, затем пункты по одному).
  yield* title().opacity(1, 0.5, easeInOutCubic);
  yield* waitFor(0.4);
  for (let i = 0; i < POINTS.length; i++) {
    yield* all(
      bullets[i].opacity(1, 0.4, easeInOutCubic),
      notes[i].opacity(1, 0.4, easeInOutCubic),
    );
    yield* waitFor(2.4);
  }
  // Затем — справочная панель, разворачивается КАК ОДНО.
  yield* waitFor(0.4);
  yield* reading().opacity(1, 0.7, easeInOutCubic);
  yield* waitFor(3.6);

  yield* all(
    take().opacity(0, Timing.slow, easeInOutCubic),
    reading().opacity(0, Timing.slow, easeInOutCubic),
  );
  yield* waitFor(0.4);
});
