import {makeScene2D, Txt, Node} from '@motion-canvas/2d';
import {easeInOutSine, useTime, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';

// Cold open — the opening lines spoken over black, as cinematic title cards.
// EB Garamond caps, cold lavender, a light glow. Timed to the VO: "It lives in
// every project... But today, we step into it."
//
// Word onsets measured from the final mix (speech-band energy, 10 ms windows):
// 0.14 · 2.75 · 6.46 · 7.83 · 10.37 · 12.17 · 13.65. A beat never appears before
// its first word: it starts fading in 0.02 s after the onset and fades out right
// before the next beat starts. Scene length stays 15.8 s (the clip slot in the edit).

const SERIF = 'EB Garamond, Newsreader, serif';
const INK = '#B7BCEA';                    // cold lavender (chosen sample #1)
const GLOW = 'rgba(178,188,255,0.28)';    // light glow (halved)

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

  // One beat per spoken phrase, in turn at the same spot.
  const beats: [Node, number][] = [
    [makeBeat(['IT LIVES IN EVERY PROJECT']), 0.16],                       // "It lives in every project,"
    [makeBeat(['AND IT IS NOT SOMETHING', 'PEOPLE SAY OUT LOUD'], 56), 2.77], // "and it is not … out loud."
    [makeBeat(['WE SEE IT.']), 6.48],                                      // "We see it,"
    [makeBeat(['WE RECOGNIZE IT.']), 7.85],                                // "we recognize it,"
    [makeBeat(['AND WE PASS BY.']), 10.39],                                // "and we pass by,"
    [makeBeat(['BUT TODAY']), 12.19],                                      // "but today,"
    [makeBeat(['WE STEP INTO IT.']), 13.67],                               // "we step into it."
  ];
  const IN = 0.35;
  const OUT = 0.3;
  const LAST_OUT_AT = 14.75;   // VO ends 14.45
  const LAST_OUT = 0.6;
  const SCENE_END = 15.8;

  function* at(t: number) {
    const dt = t - useTime();
    if (dt > 0) yield* waitFor(dt);
  }

  for (let i = 0; i < beats.length; i++) {
    const [node, start] = beats[i];
    yield* at(start);
    yield* node.opacity(1, IN, easeInOutSine);
    if (i + 1 < beats.length) {
      yield* at(beats[i + 1][1] - OUT);
      yield* node.opacity(0, OUT, easeInOutSine);
    } else {
      yield* at(LAST_OUT_AT);
      yield* node.opacity(0, LAST_OUT, easeInOutSine);
    }
  }
  yield* at(SCENE_END);
});
