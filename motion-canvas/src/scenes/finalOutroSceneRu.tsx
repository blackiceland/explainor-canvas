import {makeScene2D, Node, Rect, Txt, Video} from '@motion-canvas/2d';
import {all, createRef, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Colors, Fonts, Screen, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

const CLIP_URL = '/video13.mp4';

// Графит — как у остальных сцен (applyBackground). Палитра инвертирована:
// текст костяной, мат под видео — поднятая графитовая плита с хайрлайном.
const TEXT_DARK    = 'rgba(244, 241, 235, 0.96)';
const TEXT_MUTED   = 'rgba(244, 241, 235, 0.52)';
const CARD_FILL    = Colors.surface;
const CARD_STROKE  = 'rgba(244, 241, 235, 0.10)';
const VIDEO_SHADOW = 'rgba(0, 0, 0, 0.50)';
const RULE_COLOR   = 'rgba(244, 241, 235, 0.14)';

// ── Book list ───────────────────────────────────────────────────────────────
const BOOKS = [
  {
    author: 'John Ousterhout',
    title:  'A Philosophy of Software Design',
  },
  {
    author: 'David Parnas',
    title:  'On the Criteria To Be Used in Decomposing\nSystems into Modules',
  },
  {
    author: 'Sandi Metz',
    title:  'Practical Object-Oriented Design',
  },
];

// ── Grid ────────────────────────────────────────────────────────────────────
const MARGIN       = 120;                         // from screen edge
const GUTTER       = 60;                          // between columns
const LEFT_EDGE    = -Screen.width / 2 + MARGIN;  // -840
const RIGHT_EDGE   =  Screen.width / 2 - MARGIN;  // +840

// Video — 16:9, as large as the right column allows
const VIDEO_W      = 760;
const VIDEO_H      = Math.round(VIDEO_W * 9 / 16); // 428
const CARD_PAD     = 12;
const CARD_W       = VIDEO_W + CARD_PAD * 2;
const CARD_H       = VIDEO_H + CARD_PAD * 2;
const VIDEO_CX     = RIGHT_EDGE - CARD_W / 2;      // card center x

// Text column runs from LEFT_EDGE to GUTTER before card
const TEXT_LEFT    = LEFT_EDGE;

// ── Typography ──────────────────────────────────────────────────────────────
const HEADING_SIZE    = 18;
const AUTHOR_SIZE     = 14;
const TITLE_SIZE      = 23;
const TITLE_LEADING   = 33;
const AUTHOR_TO_TITLE = 28;
const BLOCK_SPACING   = 40;

function titleLines(t: string): number {
  return t.split('\n').length;
}
function bookBlockH(b: typeof BOOKS[number]): number {
  return AUTHOR_TO_TITLE + titleLines(b.title) * TITLE_LEADING;
}

export default makeScene2D(function* (view) {
  // ── Background ────────────────────────────────────────────────────────────
  applyBackground(view);

  const textGroup = createRef<Node>();
  const videoRef  = createRef<Video>();
  const videoWrap = createRef<Rect>();
  const ready     = createSignal(false);

  // ── Shared top line ───────────────────────────────────────────────────────
  // Both columns share the same top Y → one grid, not two slides
  const TOP_Y = -CARD_H / 2;   // align to video card top

  const HEADING_Y = TOP_Y;
  const RULE_Y    = HEADING_Y + 26;
  const FIRST_BOOK_Y = RULE_Y + 32;

  // ── Left column: reading list ─────────────────────────────────────────────
  const bookNodes: Node[] = [];

  view.add(
    <Node ref={textGroup} x={0} opacity={0}>
      <Txt
        fontFamily={Fonts.primary}
        fontSize={HEADING_SIZE}
        fontWeight={600}
        letterSpacing={4}
        fill={TEXT_MUTED}
        x={TEXT_LEFT}
        y={HEADING_Y}
        offset={[-1, -1]}
        textAlign="left"
      >
        FURTHER READING
      </Txt>

      <Rect
        width={460} height={1}
        fill={RULE_COLOR}
        x={TEXT_LEFT} y={RULE_Y}
        offset={[-1, 0]}
      />
    </Node>,
  );

  let cursorY = FIRST_BOOK_Y;

  for (let i = 0; i < BOOKS.length; i++) {
    const book = BOOKS[i];

    const entry = (
      <Node x={0} opacity={0}>
        <Txt
          fontFamily={Fonts.primary}
          fontSize={AUTHOR_SIZE}
          fontWeight={400}
          letterSpacing={1.5}
          fill={TEXT_MUTED}
          x={TEXT_LEFT}
          y={cursorY}
          offset={[-1, -1]}
          textAlign="left"
        >
          {book.author.toUpperCase()}
        </Txt>

        <Txt
          fontFamily={Fonts.primary}
          fontSize={TITLE_SIZE}
          fontWeight={500}
          lineHeight={TITLE_LEADING}
          fill={TEXT_DARK}
          x={TEXT_LEFT}
          y={cursorY + AUTHOR_TO_TITLE}
          offset={[-1, -1]}
          textAlign="left"
        >
          {book.title}
        </Txt>
      </Node>
    ) as Node;

    bookNodes.push(entry);
    textGroup().add(entry);

    cursorY += bookBlockH(book) + BLOCK_SPACING;
  }

  // ── Right side: video ─────────────────────────────────────────────────────
  view.add(
    <Rect
      ref={videoWrap}
      x={VIDEO_CX}
      y={0}
      width={CARD_W}
      height={CARD_H}
      radius={18}
      fill={CARD_FILL}
      stroke={CARD_STROKE}
      lineWidth={1}
      shadowColor={VIDEO_SHADOW}
      shadowBlur={44}
      shadowOffset={[0, 14]}
      opacity={0}
      clip
    >
      <Video
        ref={videoRef}
        src={CLIP_URL}
        width={VIDEO_W}
        height={VIDEO_H}
        ratio={16 / 9}
        radius={12}
        alpha={() => (ready() ? 1 : 0)}
        smoothing
      />
    </Rect>,
  );

  // ── Animation ─────────────────────────────────────────────────────────────
  yield videoRef().toPromise();
  ready(true);
  videoRef().loop(true);
  videoRef().play();

  yield* waitFor(0.2);

  // Heading + rule
  yield* textGroup().opacity(1, 0.6, easeInOutCubic);
  yield* waitFor(0.3);

  // Stagger books
  for (const entry of bookNodes) {
    yield* entry.opacity(1, 0.5, easeInOutCubic);
    yield* waitFor(0.6);
  }

  // Video
  yield* videoWrap().opacity(1, Timing.slow, easeInOutCubic);

  // Hold — let video13 play long enough
  yield* waitFor(30);

  // Out
  yield* all(
    textGroup().opacity(0, Timing.slow, easeInOutCubic),
    videoWrap().opacity(0, Timing.slow, easeInOutCubic),
  );
  yield* waitFor(0.3);
});
