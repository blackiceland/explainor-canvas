import {makeScene2D, Txt, Node} from '@motion-canvas/2d';
import {easeInOutSine, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';

// Cold open — the opening lines spoken over black, as cinematic title cards.
// EB Garamond caps, cold lavender, a light glow. Timed to the VO (srt cues 1-5,
// 00:00:00–00:00:14): "It lives in every project... But today, we step into it."

const SERIF = 'EB Garamond, Newsreader, serif';
const INK = '#B7BCEA';                    // cold lavender (chosen sample #1)
const GLOW = 'rgba(178,188,255,0.55)';    // light glow

export default makeScene2D(function* (view) {
  applyBackground(view);

  // A centered beat of 1–2 lines, hidden until shown.
  function makeBeat(lines: string[], size = 60): Node {
    const node = new Node({opacity: 0});
    const lh = size * 1.34;
    const y0 = -((lines.length - 1) / 2) * lh;
    lines.forEach((ln, i) => {
      node.add(
        new Txt({
          text: ln,
          fontFamily: SERIF,
          fontWeight: 500,
          fontSize: size,
          letterSpacing: 4,
          fill: INK,
          shadowColor: GLOW,
          shadowBlur: 16,
          y: y0 + i * lh,
        }),
      );
    });
    view.add(node);
    return node;
  }

  const b1 = makeBeat(['IT LIVES IN EVERY PROJECT']);
  const b2 = makeBeat(['AND IT IS NOT SOMETHING', 'PEOPLE SAY OUT LOUD'], 56);
  const b3 = makeBeat(['WE SEE IT. WE RECOGNIZE IT.', 'AND WE PASS BY.'], 56);
  const b4 = makeBeat(['BUT TODAY,', 'WE STEP INTO IT.']);

  function* show(node: Node, inDur: number, hold: number, outDur: number) {
    yield* node.opacity(1, inDur, easeInOutSine);
    yield* waitFor(hold);
    yield* node.opacity(0, outDur, easeInOutSine);
  }

  yield* waitFor(0.2);
  yield* show(b1, 0.6, 2.4, 0.6);   // 0.2 → 3.8   (VO 00:00.18–00:03.7)
  yield* show(b2, 0.5, 1.1, 0.5);   // 3.8 → 5.9   (VO 00:03.7–00:05.1)
  yield* waitFor(0.4);              //     → 6.3
  yield* show(b3, 0.6, 3.7, 0.6);   // 6.3 → 11.2  (VO 00:06.3–00:11.25)
  yield* waitFor(1.0);              //     → 12.2
  yield* show(b4, 0.6, 1.2, 0.9);   // 12.2 → 14.9 (VO 00:12.2–00:14.6)
  yield* waitFor(0.3);
});
