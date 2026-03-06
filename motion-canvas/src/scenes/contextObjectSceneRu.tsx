import {blur, Code, lines, makeScene2D, Node, Rect} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, easeOutCubic, waitFor} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {tokenizeLine} from '../core/code/model/Tokenizer';
import {DryFiltersV3CodeTheme, getTokenColor} from '../core/code/model/SyntaxTheme';

const BG = '#121212';
const FONT = Fonts.code;
const FS = 44;
const LH = 72;
const THEME = DryFiltersV3CodeTheme;


const FIELDS = [
  {type: 'byte[]',  name: 'sourceFrames'},
  {type: 'String',  name: 'outputFormat'},
  {type: 'String',  name: 'colorProfile'},
  {type: 'String',  name: 'subtitleTrack'},
  {type: 'byte[]',  name: 'preparedFrames'},
];

const SCATTER: {x: number; y: number}[] = [
  {x:  320, y: -200},
  {x: -50,  y: -310},
  {x:  450, y:  130},
  {x: -150, y:  250},
  {x:  200, y:  310},
];

// Left edge of code text
const CODE_LEFT = -875;
const INDENT = '   ';
const BLOCK_TOP = -210;

function coloringHooks() {
  return {
    token: (
      ctx: CanvasRenderingContext2D,
      text: string,
      position: {x: number; y: number},
    ) => {
      const raw = String(text ?? '');
      let x = position.x;
      const tokens = tokenizeLine(raw);
      for (const tok of tokens) {
        ctx.fillStyle = getTokenColor(tok.type, THEME);
        ctx.fillText(tok.text, x, position.y);
        x += ctx.measureText(tok.text).width;
      }
    },
  };
}

function lineY(idx: number) {
  return BLOCK_TOP + idx * LH;
}

function codeLine(text: string, x: number, y: number): Code {
  return new Code({
    code: text,
    fontFamily: FONT,
    fontSize: FS,
    lineHeight: LH,
    x,
    y,
    offset: [-1, 0],
    selection: lines(0, Infinity),
    drawHooks: coloringHooks(),
  });
}

export default makeScene2D(function* (view) {
  view.add(<Rect width={1920} height={1080} fill={BG} />);

  // ── Shell: "class ExportContext {" and "}" ──────────────────────────────
  const shellGroup = new Node({opacity: 0});
  shellGroup.add(codeLine('class ExportContext {', CODE_LEFT, lineY(0)));
  shellGroup.add(codeLine('}', CODE_LEFT, lineY(6)));
  view.add(shellGroup);

  // ── Field lines: they ARE the flying objects ───────────────────────────
  const fieldBlurs = FIELDS.map(() => createSignal(24));
  const fieldLines = FIELDS.map((f, i) => {
    const text = INDENT + f.type + ' ' + f.name + ';';
    const node = codeLine(text, SCATTER[i].x, SCATTER[i].y);
    node.opacity(0);
    node.filters(() => [blur(fieldBlurs[i]())]);
    view.add(node);
    return node;
  });

  // ── Animation ─────────────────────────────────────────────────────────

  // 1. Shell and blurred fields appear simultaneously
  yield* all(
    shellGroup.opacity(1, 0.6, easeInOutCubic),
    ...fieldLines.map((n, i) =>
      n.opacity(1, 0.4 + i * 0.06, easeOutCubic),
    ),
    ...fieldBlurs.map((b, i) =>
      b(14, 0.45 + i * 0.06, easeOutCubic),
    ),
  );
  yield* waitFor(0.6);

  // 3. One by one: field flies to its slot position and deblurs — it stays
  for (let i = 0; i < FIELDS.length; i++) {
    const node = fieldLines[i];

    yield* all(
      node.x(CODE_LEFT, 0.55, easeInOutCubic),
      node.y(lineY(i + 1), 0.55, easeInOutCubic),
      fieldBlurs[i](0, 0.45, easeInOutCubic),
    );

    if (i < FIELDS.length - 1) {
      yield* waitFor(0.1);
    }
  }

  yield* waitFor(0.8);
  // End scene with context visible after parameters animation
  yield* waitFor(0.3);
});
