import {makeScene2D, Node, Txt} from '@motion-canvas/2d';
import {all, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Colors, Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

const TITLE = 'Takeaways';

const NOTES = [
  'Pass-through is not always a bug.\nBut it is always a signal worth investigating.',
  'If a method receives parameters it never uses,\nthe boundary is drawn in the wrong place.',
  'A long chain where every link does its job is fine.\nA long chain that just forwards data is not.',
  'Before adding new abstractions,\ntry moving responsibility to where it belongs.',
  'Each module should know only what it needs\nto do its own job. Nothing more.',
  'When every step needs its own variable name,\nthe method is probably doing too many things.',
] as const;

const LEFT_X       = -860;
const TITLE_Y      = -380;
const FIRST_NOTE_Y = -230;
const NOTE_GAP     = 105;
const TITLE_SIZE   = 56;
const NOTE_SIZE    = 28;
const LINE_HEIGHT  = Math.round(NOTE_SIZE * 1.5);
const TEXT_FILL    = 'rgba(232, 207, 174, 0.96)';
const MUTED_FILL   = 'rgba(232, 207, 174, 0.50)';
const TITLE_FILL   = Colors.text.primary;

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ── Заголовок ──────────────────────────────────────────────────────────────
  const title = new Txt({
    text: TITLE,
    fontFamily: Fonts.primary,
    fontSize: TITLE_SIZE,
    fontWeight: 600,
    fill: TITLE_FILL,
    x: LEFT_X + 36,
    y: TITLE_Y,
    offset: [-1, 0],
    textAlign: 'left',
    opacity: 0,
  });
  view.add(title);

  yield* title.opacity(1, 0.5, easeInOutCubic);
  yield* waitFor(0.5);

  // ── Пункты ─────────────────────────────────────────────────────────────────
  const noteNodes: Txt[] = [];

  for (let i = 0; i < NOTES.length; i++) {
    const y = FIRST_NOTE_Y + i * NOTE_GAP;

    const bullet = new Txt({
      text: '—',
      fontFamily: Fonts.code,
      fontSize: NOTE_SIZE,
      fill: MUTED_FILL,
      x: LEFT_X,
      y: y - LINE_HEIGHT / 2,
      offset: [-1, 0],
      textAlign: 'left',
      opacity: 0,
    });
    view.add(bullet);

    const note = new Txt({
      text: NOTES[i],
      fontFamily: Fonts.code,
      fontSize: NOTE_SIZE,
      lineHeight: LINE_HEIGHT,
      fill: TEXT_FILL,
      x: LEFT_X + 36,
      y,
      offset: [-1, 0],
      textAlign: 'left',
      opacity: 0,
    });
    view.add(note);
    noteNodes.push(note);

    yield* all(
      bullet.opacity(1, 0.4, easeInOutCubic),
      note.opacity(1, 0.4, easeInOutCubic),
    );
    yield* waitFor(3.0);
  }

  // ── Держим всё на экране ───────────────────────────────────────────────────
  yield* waitFor(2.0);

  // ── Уход ───────────────────────────────────────────────────────────────────
  yield* all(...view.children().map(c => (c as Node).opacity(0, Timing.slow, easeInOutCubic)));
  yield* waitFor(0.3);
});
