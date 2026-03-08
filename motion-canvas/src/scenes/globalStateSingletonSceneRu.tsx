import {Circle, Code, makeScene2D, Node, Rect, lines} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {DryFiltersV3CodeTheme, LightBgCodeTheme, getTokenColor} from '../core/code/model/SyntaxTheme';
import {tokenizeLine} from '../core/code/model/Tokenizer';
import {Fonts, Screen} from '../core/theme';

const BG = '#121212';
const LIGHT_SPLIT_BG = '#E7DCC9';

const CODE_LINES = [
  'class ExportConfig {',
  '  static String outputFormat = ',
  '  static String colorProfile = "sRGB";',
  '}',
];
const RIGHT_CODE_LINES = [
  'public byte[] exportVideo(byte[] source) {',
  '    validate(source);',
  '    byte[] prepared = prepareFrames(source);',
  '',
  '    return encode(prepared);',
  '}',
  '',
  'private byte[] encode(byte[] frames) {',
  '    String fmt = ExportConfig.outputFormat;',
  '',
  '    if (fmt.equals("mp4")) {',
  '        return fastEncode(frames);',
  '    }',
  '',
  '    return slowEncode(frames);',
  '}',
];
const SOFT_GREEN = 'rgba(168, 214, 178, 0.88)';
const TYPE_COLOR = 'rgba(201, 180, 255, 0.78)';

const FONT_SIZE = 28;
const LINE_HEIGHT = 42;
const CHAR_WIDTH = FONT_SIZE * 0.58;
const OUTPUT_FORMAT_PREFIX = '  static String outputFormat = ';
const CODE_WIDTH = Math.max(...CODE_LINES.map(line => line.length)) * CHAR_WIDTH;
const CODE_HEIGHT = (CODE_LINES.length - 1) * LINE_HEIGHT + FONT_SIZE;
const CIRCLE_PAD_X = 70;
const CIRCLE_PAD_Y = 120;
const CIRCLE_DIAMETER = Math.max(
  CODE_WIDTH + CIRCLE_PAD_X * 2,
  CODE_HEIGHT + CIRCLE_PAD_Y * 2,
);
const CODE_LEFT = -CODE_WIDTH / 2;
const CODE_TOP = -CODE_HEIGHT / 2 + FONT_SIZE * 0.45;

function codeHooks() {
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
        ctx.fillStyle = getTokenColor(tok.type, LightBgCodeTheme);
        ctx.fillText(tok.text, x, position.y);
        x += ctx.measureText(tok.text).width;
      }
    },
  };
}

function darkCodeHooks() {
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
        const isQuoted = /^"[^"]*"$/.test(tok.text);
        const isConfig = tok.text === 'ExportConfig';
        ctx.fillStyle = isQuoted ? SOFT_GREEN : isConfig ? TYPE_COLOR : getTokenColor(tok.type, DryFiltersV3CodeTheme);
        ctx.fillText(tok.text, x, position.y);
        x += ctx.measureText(tok.text).width;
      }
    },
  };
}

export default makeScene2D(function* (view) {
  const circleOn = createSignal(0);
  const codeOn = createSignal(0);
  const focusX = createSignal(0);
  const rightCodeOn = createSignal(0);
  const formatValue = createSignal('mp4');

  view.add(<Rect width={Screen.width} height={Screen.height} fill={BG} />);

  const rightCodeGroup = new Node({opacity: 0});
  const rightStartX = 60;
  const rightStartY = -358;
  RIGHT_CODE_LINES.forEach((text, index) => {
    rightCodeGroup.add(
      new Code({
        code: text,
        fontFamily: Fonts.code,
        fontSize: 28,
        lineHeight: 42,
        x: rightStartX,
        y: rightStartY + index * 42,
        offset: [-1, 0],
        selection: lines(0, Infinity),
        drawHooks: darkCodeHooks(),
      }),
    );
  });
  rightCodeGroup.opacity(() => rightCodeOn());
  view.add(rightCodeGroup);

  view.add(
    <Circle
      x={() => focusX()}
      width={CIRCLE_DIAMETER}
      height={CIRCLE_DIAMETER}
      fill={LIGHT_SPLIT_BG}
      shadowColor={'rgba(0, 0, 0, 0.30)'}
      shadowBlur={36}
      shadowOffsetY={14}
      scale={() => 0.94 + 0.06 * circleOn()}
      opacity={circleOn}
    />,
  );

  const stripeY = CODE_TOP + 1 * LINE_HEIGHT;
  const stripeOn = createSignal(0);
  const stripe = new Rect({
    x: 0,
    y: stripeY,
    width: Screen.width,
    height: LINE_HEIGHT * 1.15,
    fill: 'rgba(255, 80, 120, 0.18)',
    radius: 4,
    opacity: () => stripeOn(),
  });
  view.add(stripe);

  const codeGroup = new Node({opacity: 0});
  codeGroup.x(() => focusX());
  CODE_LINES.forEach((text, index) => {
    codeGroup.add(
      new Code({
        code: text,
        fontFamily: Fonts.code,
        fontSize: FONT_SIZE,
        lineHeight: LINE_HEIGHT,
        x: CODE_LEFT,
        y: CODE_TOP + index * LINE_HEIGHT,
        offset: [-1, 0],
        selection: lines(0, Infinity),
        drawHooks: codeHooks(),
      }),
    );
  });
  const formatValueCode = new Code({
    code: () => ` "${formatValue()}";`,
    fontFamily: Fonts.code,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    x: CODE_LEFT + OUTPUT_FORMAT_PREFIX.length * CHAR_WIDTH,
    y: CODE_TOP + 1 * LINE_HEIGHT,
    offset: [-1, 0],
    selection: lines(0, Infinity),
    drawHooks: codeHooks(),
  });
  codeGroup.add(formatValueCode);
  codeGroup.opacity(() => codeOn());
  view.add(codeGroup);

  yield* circleOn(1, 0.7, easeInOutCubic);
  yield* codeOn(1, 0.6, easeInOutCubic);
  yield* all(
    focusX(-Screen.width * 0.26, 0.9, easeInOutCubic),
    rightCodeOn(1, 0.7, easeInOutCubic),
  );
  yield* waitFor(0.4);
  yield* stripeOn(1, 0.4, easeInOutCubic);
  yield* waitFor(0.6);

  const VALUES = ['webm', 'avi', 'mkv', 'mov'];
  for (const val of VALUES) {
    yield* formatValueCode.opacity(0, 0.3, easeInOutCubic);
    formatValue(val);
    yield* formatValueCode.opacity(1, 0.3, easeInOutCubic);
    yield* waitFor(0.6);
  }

  yield* waitFor(1.0);
});
