import {Code, makeScene2D} from '@motion-canvas/2d';
import {createSignal, easeInOutCubic, map, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Colors, Fonts, Timing} from '../core/theme';

export default makeScene2D(function* (view) {
  applyBackground(view);

  const on = createSignal(0);
  const code = createSignal('me = Person()\nwhile(me.awake()):\n  me.code()');

  const base = 'rgba(244,241,235,0.72)';
  const punctuation = 'rgba(244,241,235,0.58)';
  const keyword = 'rgba(163,205,255,0.82)';
  const method = Colors.accent;
  const type = 'rgba(201,180,255,0.78)';

  const KEYWORDS = new Set(['while']);

  view.add(
    <Code
      code={() => code()}
      fontFamily={Fonts.code}
      fontSize={56}
      lineHeight={84}
      opacity={() => on()}
      x={0}
      y={0}
      drawHooks={{
        token: (
          canvasCtx: CanvasRenderingContext2D,
          text: string,
          position: {x: number; y: number},
          color: string,
          selection: number,
        ) => {
          const raw = String(text ?? '');
          const prevAlpha = canvasCtx.globalAlpha;
          canvasCtx.globalAlpha *= map(0.2, 1, selection);

          let x = position.x;
          const y = position.y;

          const flush = (seg: string, segColor: string) => {
            if (seg.length === 0) return;
            canvasCtx.fillStyle = segColor;
            canvasCtx.fillText(seg, x, y);
            x += canvasCtx.measureText(seg).width;
          };

          let i = 0;
          while (i < raw.length) {
            const ch = raw[i];

            if (/[A-Za-z_]/.test(ch)) {
              let j = i + 1;
              while (j < raw.length && /[A-Za-z0-9_]/.test(raw[j])) j += 1;
              const word = raw.slice(i, j);
              if (KEYWORDS.has(word)) {
                flush(word, keyword);
              } else if (word === 'Person') {
                flush(word, type);
              } else {
                flush(word, base);
              }
              i = j;
              continue;
            }

            if (ch === '(' || ch === ')' || ch === ':' || ch === '=' || ch === '.') {
              flush(ch, punctuation);
              i += 1;
              continue;
            }

            if (ch === '\n' || ch === ' ' || ch === '\t') {
              flush(ch, base);
              i += 1;
              continue;
            }

            if (raw.slice(i).startsWith('code')) {
              flush('code', method);
              i += 4;
              continue;
            }

            flush(ch, base);
            i += 1;
          }

          canvasCtx.globalAlpha = prevAlpha;
        },
      }}
    />,
  );

  yield* on(1, Timing.slow, easeInOutCubic);
  yield* waitFor(Timing.normal);
  yield* on(0, Timing.slow, easeInOutCubic);
});


