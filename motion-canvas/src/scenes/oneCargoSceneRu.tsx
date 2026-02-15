import {Code, makeScene2D, Rect} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';
import {textWidth} from '../core/utils/textMeasure';

const BASE = 'rgba(244,241,235,0.72)';
const PUNCT = 'rgba(244,241,235,0.58)';
const KEYWORD = 'rgba(163,205,255,0.82)';
const TYPE = 'rgba(201,180,255,0.78)';
const BLUE = '#3FA8FF';
const GREEN = '#31D890';
const YELLOW = '#F0D84F';

export default makeScene2D(function* (view) {
  applyBackground(view);

  const codeOpacity = createSignal(0);
  const blocksOpacity = createSignal(0);
  const full = 'Result run(String parameter1, String parameter2)';
  const maxW = 1700;
  let fontSize = 74;
  while (fontSize > 28 && textWidth(full, Fonts.code, fontSize, 600) > maxW) fontSize -= 1;
  const lineHeight = Math.round(fontSize * 1.24);
  const codeY = -6;

  const resultToken = 'Result';
  const afterResult = ' ';
  const methodToken = 'run';
  const punctOpen = '(';
  const p1Token = 'String parameter1';
  const delim1 = ', ';
  const p2Token = 'String parameter2';
  const punctClose = ')';

  const sAfterResult = textWidth(afterResult, Fonts.code, fontSize, 600);
  const sOpen = textWidth(punctOpen, Fonts.code, fontSize, 600);
  const sAfterP1 = textWidth(delim1, Fonts.code, fontSize, 600);
  const sTail = textWidth(punctClose, Fonts.code, fontSize, 600);

  const resultW = textWidth(resultToken, Fonts.code, fontSize, 600) + 26;
  const methodW = textWidth(methodToken, Fonts.code, fontSize, 600) + 26;
  const p1W = textWidth(p1Token, Fonts.code, fontSize, 600) + 26;
  const p2W = textWidth(p2Token, Fonts.code, fontSize, 600) + 26;
  const blockH = Math.round(lineHeight * 0.72);

  const KEYWORDS = new Set(['return', 'final', 'class', 'private', 'public', 'new', 'this']);
  const TYPES = new Set(['Result', 'String']);
  const METHODS = new Set(['run']);

  view.add(
    <Rect>
      <Code
        code={full}
        fontFamily={Fonts.code}
        fontSize={fontSize}
        lineHeight={lineHeight}
        x={0}
        y={codeY}
        opacity={codeOpacity}
        drawHooks={{
          token: (ctx: CanvasRenderingContext2D, text: string, position: {x: number; y: number}) => {
            const raw = String(text ?? '');
            let x = position.x;
            const y = position.y;
            const flush = (seg: string, segColor: string) => {
              if (!seg) return;
              ctx.fillStyle = segColor;
              ctx.fillText(seg, x, y);
              x += ctx.measureText(seg).width;
            };
            let i = 0;
            while (i < raw.length) {
              const ch = raw[i];
              if (/[A-Za-z_]/.test(ch)) {
                let j = i + 1;
                while (j < raw.length && /[A-Za-z0-9_]/.test(raw[j])) j += 1;
                const w = raw.slice(i, j);
                if (KEYWORDS.has(w)) flush(w, KEYWORD);
                else if (TYPES.has(w)) flush(w, TYPE);
                else if (METHODS.has(w)) flush(w, KEYWORD);
                else flush(w, BASE);
                i = j;
                continue;
              }
              if ('(),.'.includes(ch)) {
                flush(ch, PUNCT);
                i += 1;
                continue;
              }
              flush(ch, BASE);
              i += 1;
            }
          },
        }}
      />

      <Rect x={0} y={codeY} layout direction={'row'} alignItems={'center'} opacity={blocksOpacity}>
        <Rect width={resultW} height={blockH} radius={14} fill={BLUE} />
        <Rect width={sAfterResult} height={1} fill={'rgba(0,0,0,0)'} />
        <Rect width={methodW} height={blockH} radius={14} fill={GREEN} />
        <Rect width={sOpen} height={1} fill={'rgba(0,0,0,0)'} />
        <Rect width={p1W} height={blockH} radius={14} fill={YELLOW} />
        <Rect width={sAfterP1} height={1} fill={'rgba(0,0,0,0)'} />
        <Rect width={p2W} height={blockH} radius={14} fill={YELLOW} />
        <Rect width={sTail} height={1} fill={'rgba(0,0,0,0)'} />
      </Rect>
    </Rect>,
  );

  yield* codeOpacity(1, 0.8, easeInOutCubic);
  yield* waitFor(0.8);
  yield* all(codeOpacity(0, 0.85, easeInOutCubic), blocksOpacity(1, 0.85, easeInOutCubic));
  yield* waitFor(1.2);
});
