import {blur, Code, lines, makeScene2D, Node, Rect, Txt} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, easeOutCubic, waitFor} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {tokenizeLine} from '../core/code/model/Tokenizer';
import {getTokenColor} from '../core/code/model/SyntaxTheme';
import {PosterTheme} from '../core/code/components/CodePoster';

const BG = '#121212';
const FONT = Fonts.code;
const FS = 36;
const LH = 58;
const THEME = PosterTheme;

const C_KW = THEME.keyword;
const C_TYPE = THEME.type;
const C_PLAIN = THEME.plain;
const C_PUNCT = THEME.punctuation;

const FIELDS = [
  {type: 'String',  name: 'outputFormat'},
  {type: 'String',  name: 'watermarkMode'},
  {type: 'byte[]',  name: 'intermediateResult'},
  {type: 'boolean', name: 'retryFailed'},
  {type: 'int',     name: 'attemptCount'},
];

const PARAM_CODE =
  'class ExportParameters {\n' +
  '    String outputFormat;\n' +
  '    String watermarkMode;\n' +
  '    byte[] intermediateResult;\n' +
  '    boolean retryFailed;\n' +
  '    int attemptCount;\n' +
  '}';

const SCATTER: {x: number; y: number}[] = [
  {x:  320, y: -200},
  {x: -50,  y: -310},
  {x:  450, y:  130},
  {x: -150, y:  250},
  {x:  200, y:  310},
];

// Left edge of code text
const CODE_LEFT = -700;
const INDENT = '    ';
const BLOCK_TOP = -170;
const RIGHT_X = 380;

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

function makeLine(y: number, parts: {text: string; fill: string}[]): Txt {
  const root = new Txt({
    x: CODE_LEFT,
    y,
    fontFamily: FONT,
    fontSize: FS,
    fill: C_PLAIN,
  });
  for (const p of parts) {
    root.add(new Txt({fill: p.fill, text: p.text}));
  }
  return root;
}

function makeFieldLine(f: {type: string; name: string}): {text: string; fill: string}[] {
  return [
    {text: INDENT, fill: C_PLAIN},
    {text: f.type, fill: C_KW},
    {text: ' ', fill: C_PLAIN},
    {text: f.name, fill: C_PLAIN},
    {text: ';', fill: C_PUNCT},
  ];
}

export default makeScene2D(function* (view) {
  view.add(<Rect width={1920} height={1080} fill={BG} />);

  // ── Shell: "class ExportContext {" and "}" ──────────────────────────────
  const shellGroup = new Node({opacity: 0});
  shellGroup.add(makeLine(lineY(0), [
    {text: 'class ', fill: C_KW},
    {text: 'ExportContext ', fill: C_TYPE},
    {text: '{', fill: C_PUNCT},
  ]));
  shellGroup.add(makeLine(lineY(6), [
    {text: '}', fill: C_PUNCT},
  ]));
  view.add(shellGroup);

  // ── Field lines: they ARE the flying objects ───────────────────────────
  // Each field starts at a scattered position with blur.
  // It flies to its slot and stays there. One object, no swap.
  const fieldBlurs = FIELDS.map(() => createSignal(14));
  const fieldLines = FIELDS.map((f, i) => {
    const node = makeLine(SCATTER[i].y, makeFieldLine(f));
    node.x(SCATTER[i].x);
    node.opacity(0);
    node.filters(() => [blur(fieldBlurs[i]())]);
    view.add(node);
    return node;
  });

  // ── ExportParameters (right side, Code component) ─────────────────────
  const paramCode = new Code({
    code: PARAM_CODE,
    fontFamily: FONT,
    fontSize: FS,
    lineHeight: LH,
    x: RIGHT_X,
    opacity: 0,
    selection: lines(0, Infinity),
    drawHooks: coloringHooks(),
  });
  view.add(paramCode);

  // ── Animation ─────────────────────────────────────────────────────────

  // 1. Shell appears
  yield* shellGroup.opacity(1, 0.6, easeInOutCubic);
  yield* waitFor(0.4);

  // 2. Blurred fields appear scattered
  yield* all(
    ...fieldLines.map((n, i) =>
      n.opacity(1, 0.3 + i * 0.06, easeOutCubic),
    ),
  );
  yield* waitFor(0.5);

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

  // 4. ExportParameters appears
  yield* paramCode.opacity(1, 0.75, easeInOutCubic);

  yield* waitFor(3.0);

  // 5. Fade out
  yield* all(
    shellGroup.opacity(0, 0.55, easeInOutCubic),
    ...fieldLines.map(n => n.opacity(0, 0.55, easeInOutCubic)),
    paramCode.opacity(0, 0.55, easeInOutCubic),
  );
  yield* waitFor(0.3);
});
