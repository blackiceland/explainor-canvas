import {Circle, Code, makeScene2D, Node, Rect, lines} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {DryFiltersV3CodeTheme, LightBgCodeTheme, getTokenColor} from '../core/code/model/SyntaxTheme';
import {tokenizeLine} from '../core/code/model/Tokenizer';
import {Fonts, Screen} from '../core/theme';

const BG = '#121212';
const LIGHT_SPLIT_BG = '#E7DCC9';

const CODE_LINES = [
  'class ExportConfig {',
  '  static String outputFormat = "mp4";',
  '  static String colorProfile = "sRGB";',
  '}',
];
const CONFIG_FORMAT_LINE = 1;   // строка со значением — её и переписывает писатель

// Читатель (справа, первым): та же цепочка из прошлых сцен, но outputFormat
// больше не прокинут параметром — encode достаёт его из глобала.
const READER_CODE_LINES = [
  'public byte[] exportVideo(byte[] sourceFrames) {',
  '    validateInput(sourceFrames);',
  '    byte[] preparedFrames = prepareFrames(sourceFrames);',
  '',
  '    return encode(preparedFrames);',
  '}',
  '',
  'private byte[] encode(byte[] preparedFrames) {',
  '    String outputFormat = ExportConfig.outputFormat;',
  '',
  '    if (!isSupportedFormat(outputFormat)) {',
  '        throw new IllegalArgumentException(outputFormat);',
  '    }',
  '',
  '    byte[] encodedVideo = runEncoder(preparedFrames);',
  '',
  '    return finalizeExport(encodedVideo, outputFormat);',
  '}',
];
const READER_READ_LINE = 8;             // строка чтения — садится ровно на полоску

// Писатели (слева, вторыми): три чужих места, каждое пишет тот же самый глобал.
// Первые два — настоящие вызывающие exportVideo: запись в конфиг и есть то, чем
// теперь передают параметр, которого больше нет в сигнатуре. ThumbnailJob ставит
// "avi" на всю ночную пачку и оставляет его там навсегда.
const WRITER_CODE_LINES = [
  'class PreviewService {',
  '',
  '    byte[] renderPreview(byte[] sourceFrames) {',
  '        ExportConfig.outputFormat = "webm";',
  '',
  '        return exporter.exportVideo(sourceFrames);',
  '    }',
  '}',
  '',
  'class ThumbnailJob {',
  '',
  '    void runNightly(byte[][] batch) {',
  '        ExportConfig.outputFormat = "avi";',
  '',
  '        for (byte[] frames : batch) {',
  '            exporter.exportVideo(frames);',
  '        }',
  '    }',
  '}',
  '',
  'class SettingsPanel {',
  '',
  '    void onFormatPicked(String choice) {',
  '        ExportConfig.outputFormat = choice;',
  '',
  '        preferences.put("format", choice);',
  '    }',
  '}',
];
const WRITER_STRIPE_LINE = 12;            // виновник флипа — садится ровно на полоску
const WRITER_MUTATE_LINES = [3, 12, 23];  // все три места записи

const SOFT_GREEN = 'rgba(168, 214, 178, 0.88)';
const TYPE_COLOR = 'rgba(201, 180, 255, 0.78)';
const DIM = 0.22;

const FONT_SIZE = 28;
const LINE_HEIGHT = 42;
const CHAR_WIDTH = FONT_SIZE * 0.58;
// 22/33: с пустыми строками после class{ колонка писателей выросла до 28 строк —
// на большем кегле нижняя `}` вылезала за SafeZone.
const SIDE_FONT_SIZE = 22;
const SIDE_LINE_HEIGHT = 33;
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

// Полоска стоит на строке outputFormat в конфиге. Обе колонки кода якорятся так,
// чтобы их ключевая строка (запись слева / чтение справа) легла на ту же y —
// полоска получается одной лентой: писатель → поле → читатель.
const STRIPE_Y = CODE_TOP + 1 * LINE_HEIGHT;
const READER_X = 20;
const READER_START_Y = STRIPE_Y - READER_READ_LINE * SIDE_LINE_HEIGHT;
const WRITER_X = -850;
const WRITER_START_Y = STRIPE_Y - WRITER_STRIPE_LINE * SIDE_LINE_HEIGHT;

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

function buildColumn(source: string[], x: number, startY: number): {group: Node; rows: Code[]} {
  const group = new Node({opacity: 0});
  const rows: Code[] = [];
  source.forEach((text, index) => {
    const row = new Code({
      code: text,
      fontFamily: Fonts.code,
      fontSize: SIDE_FONT_SIZE,
      lineHeight: SIDE_LINE_HEIGHT,
      x,
      y: startY + index * SIDE_LINE_HEIGHT,
      offset: [-1, 0],
      selection: lines(0, Infinity),
      drawHooks: darkCodeHooks(),
    });
    rows.push(row);
    group.add(row);
  });
  return {group, rows};
}

export default makeScene2D(function* (view) {
  const circleOn = createSignal(0);
  const codeOn = createSignal(0);
  const focusX = createSignal(0);
  const readerOn = createSignal(0);
  const writersOn = createSignal(0);
  const stripeOn = createSignal(0);
  const formatValue = createSignal('mp4');

  view.add(<Rect width={Screen.width} height={Screen.height} fill={BG} />);

  const writers = buildColumn(WRITER_CODE_LINES, WRITER_X, WRITER_START_Y);
  writers.group.opacity(() => writersOn());
  view.add(writers.group);

  const reader = buildColumn(READER_CODE_LINES, READER_X, READER_START_Y);
  reader.group.opacity(() => readerOn());
  view.add(reader.group);

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

  // Лента приходит из-за левого края («запись где-то ещё») и обрывается на правой
  // кромке диска — конфиг и есть её пункт назначения, дальше ей идти незачем.
  const stripeRight = () => focusX() + CIRCLE_DIAMETER / 2;
  view.add(
    new Rect({
      x: () => (stripeRight() - Screen.width / 2) / 2,
      y: STRIPE_Y,
      width: () => stripeRight() + Screen.width / 2,
      height: LINE_HEIGHT * 1.15,
      fill: 'rgba(255, 80, 120, 0.18)',
      radius: 4,
      opacity: () => stripeOn(),
    }),
  );

  const codeGroup = new Node({opacity: 0});
  codeGroup.x(() => focusX());
  const configRows: Code[] = [];
  CODE_LINES.forEach((text, index) => {
    const row = new Code({
      // Значение вшито в строку целиком: отдельная нода со сдвигом по прикидке
      // ширины символа промахивалась и оставляла дырку перед литералом.
      code: index === CONFIG_FORMAT_LINE
        ? () => `  static String outputFormat = "${formatValue()}";`
        : text,
      fontFamily: Fonts.code,
      fontSize: FONT_SIZE,
      lineHeight: LINE_HEIGHT,
      x: CODE_LEFT,
      y: CODE_TOP + index * LINE_HEIGHT,
      offset: [-1, 0],
      selection: lines(0, Infinity),
      drawHooks: codeHooks(),
    });
    configRows.push(row);
    codeGroup.add(row);
  });
  codeGroup.opacity(() => codeOn());
  view.add(codeGroup);

  // ── Конфиг в центре ───────────────────────────────────────────────────
  // VO: «put them in one shared state object» / «Often a static config or effectively a singleton»
  yield* circleOn(1, 0.7, easeInOutCubic);
  yield* codeOn(1, 0.6, easeInOutCubic);

  // ── Справа читатель. Полоски нет — это только завязка ─────────────────
  // VO: «encode just reads output format from a global place»
  yield* all(
    focusX(-Screen.width * 0.26, 0.9, easeInOutCubic),
    readerOn(1, 0.7, easeInOutCubic),
  );
  yield* waitFor(2.4);

  // ── Слева три чужих места, которые пишут в конфиг ─────────────────────
  // VO: «Settings live in one shared place and anyone can overwrite them»
  yield* all(
    focusX(Screen.width * 0.26, 1.0, easeInOutCubic),
    writersOn(1, 0.8, easeInOutCubic),
    (function* () {
      yield* waitFor(0.2);
      yield* readerOn(0, 0.5, easeInOutCubic);
    })(),
  );
  yield* waitFor(0.6);

  // ── Полоска ведёт ОТ строки записи В поле конфига, и запись срабатывает ─
  // VO: «Behavior can shift because of a write somewhere else»
  yield* stripeOn(1, 0.5, easeInOutCubic);
  yield* waitFor(1.0);
  const formatRow = configRows[CONFIG_FORMAT_LINE];
  yield* formatRow.opacity(0, 0.3, easeInOutCubic);
  formatValue('avi');
  yield* formatRow.opacity(1, 0.3, easeInOutCubic);
  yield* waitFor(2.0);
  yield* stripeOn(0, 0.4, easeInOutCubic);

  // ── Подозреваемых трое: каждый пишет тот же глобал ────────────────────
  // VO: «Debugging means hunting every place that mutates that config»
  yield* all(
    ...writers.rows.map((row, index) =>
      row.opacity(WRITER_MUTATE_LINES.includes(index) ? 1 : DIM, 0.8, easeInOutCubic),
    ),
  );
  // Гаснем прямо из этого состояния: последнее, что остаётся на экране, —
  // три горящие строки записи и диск конфига.
  yield* waitFor(3.4);
  yield* all(
    writersOn(0, 0.9, easeInOutCubic),
    circleOn(0, 0.9, easeInOutCubic),
    codeOn(0, 0.9, easeInOutCubic),
  );
  yield* waitFor(0.5);
});
