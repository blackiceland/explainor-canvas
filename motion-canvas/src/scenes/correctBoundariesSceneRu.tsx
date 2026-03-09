import {Line, makeScene2D, Node, Rect, Txt} from '@motion-canvas/2d';
import {all, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Colors, Fonts, Screen, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';
import {JavaClass, method, param} from '../core/code/model/JavaModel';
import {
  CODE_CARD_STYLE,
  CODE_W,
  COLOR_RULES,
  LEFT_CENTER_X,
  MAX_LINE_CHARS,
} from './codeWithActionsSceneRu.config';

export default makeScene2D(function* (view) {
  applyBackground(view);

  const stage = new Node({});
  view.add(stage);

  const quoteContainer = new Node({opacity: 0, y: -20});
  stage.add(quoteContainer);

  quoteContainer.add(
    <Txt
      fontFamily={Fonts.primary}
      fontSize={48}
      fontWeight={300}
      fill={Colors.text.primary}
      textAlign="center"
      y={-70}
    >
      It is more important for a module to have a
    </Txt>,
  );
  quoteContainer.add(
    <Txt
      fontFamily={Fonts.primary}
      fontSize={48}
      fontWeight={300}
      fill={Colors.text.primary}
      textAlign="center"
      y={0}
    >
      <Txt fill={Colors.accent} fontWeight={600}>
        simple interface
      </Txt>{' '}
      than a simple implementation
    </Txt>,
  );
  quoteContainer.add(
    <Txt
      fontFamily={Fonts.primary}
      fontSize={28}
      fill={Colors.text.muted}
      opacity={0.7}
      fontStyle="italic"
      textAlign="center"
      y={100}
    >
      — John Ousterhout, A Philosophy of Software Design
    </Txt>,
  );

  yield* quoteContainer.opacity(1, Timing.slow, easeInOutCubic);
  yield* waitFor(3);
  yield* quoteContainer.opacity(0, Timing.slow, easeInOutCubic);
  yield* waitFor(0.6);

  const fontSize = 22;
  const lineHeight = Math.round(fontSize * 1.62 * 10) / 10;
  const topInset = Math.max(8, getCodePaddingY(fontSize) - 8);

  const model = JavaClass.create([
    method('public', 'byte[]', 'exportVideo',
      [param('byte[]', 'sourceFrames'), param('String', 'outputFormat'),
       param('String', 'colorProfile'), param('String', 'subtitleTrack'),
       param('String', 'watermarkMode'), param('String', 'audioProfile')],
      ['validateInput(sourceFrames, outputFormat);',
       'byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack);',
       '',
       'return encodeWithRetry(preparedFrames, outputFormat, watermarkMode, audioProfile);']),

    method('private', 'byte[]', 'prepareFrames',
      [param('byte[]', 'sourceFrames'), param('String', 'colorProfile'),
       param('String', 'subtitleTrack')],
      ['byte[] normalizedFrames = normalizeFrames(sourceFrames);',
       'byte[] coloredFrames = applyColorProfile(normalizedFrames, colorProfile);',
       '',
       'return overlaySubtitles(coloredFrames, subtitleTrack);']),

    method('private', 'byte[]', 'encodeWithRetry',
      [param('byte[]', 'preparedFrames'), param('String', 'outputFormat'),
       param('String', 'watermarkMode'), param('String', 'audioProfile')],
      ['int attemptsLeft = this.maxAttempts;',
       '',
       'while (attemptsLeft-- > 0) {',
       '    try {',
       '        return encode(preparedFrames, outputFormat, watermarkMode, audioProfile);',
       '    } catch (RuntimeException ex) { /* retry */ }',
       '}',
       '',
       'throw new IllegalStateException("Encoding failed");']),

    method('private', 'byte[]', 'encode',
      [param('byte[]', 'preparedFrames'), param('String', 'outputFormat'),
       param('String', 'watermarkMode'), param('String', 'audioProfile')],
      ['byte[] encodedVideo = runEncoder(preparedFrames);',
       '',
       'return finalizeExport(encodedVideo, outputFormat, watermarkMode, audioProfile);']),

    method('private', 'byte[]', 'finalizeExport',
      [param('byte[]', 'encodedVideo'), param('String', 'outputFormat'),
       param('String', 'watermarkMode'), param('String', 'audioProfile')],
      ['if (!isSupportedFormat(outputFormat)) {',
       '    throw new IllegalArgumentException("Unsupported: " + outputFormat);',
       '}',
       '',
       'Container container = Muxer.mux(encodedVideo, outputFormat);',
       'container.applyWatermark(watermarkMode);',
       'container.normalizeAudio(audioProfile);',
       '',
       'return container;']),
  ], MAX_LINE_CHARS);

  const manticore = Manticore.create(model.render(), {
    x: LEFT_CENTER_X - 50, y: -50,
    width: CODE_W,
    height: SafeZone.bottom - SafeZone.top - 36,
    fontSize, lineHeight,
    contentOffsetY: topInset,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    customTypes: ['String', 'RuntimeException', 'IllegalStateException',
      'IllegalArgumentException', 'Muxer', 'Container'],
  });
  manticore.mount(view);
  manticore.colorize(COLOR_RULES);

  // ── Структура справа ──────────────────────────────────────────────────
  const BOX_W = 220;
  const BOX_H = 52;
  const BOX_R = 16;
  const BOX_STROKE = 'rgba(244, 241, 235, 0.22)';
  const LINE_COLOR = 'rgba(244, 241, 235, 0.18)';
  const LABEL_SIZE = 20;
  const BOX_FILLS = [
    'rgba(160, 190, 255, 0.16)',
    'rgba(160, 225, 200, 0.16)',
    'rgba(255, 200, 160, 0.16)',
    'rgba(200, 185, 255, 0.16)',
    'rgba(255, 180, 200, 0.16)',
  ];

  const treeGroup = new Node({});
  view.add(treeGroup);

  const treeLayout = [
    {name: 'exportVideo', x: 560, y: -230, fill: BOX_FILLS[0]},
    {name: 'prepareFrames', x: 370, y: -100, fill: BOX_FILLS[1]},
    {name: 'encodeWithRetry', x: 750, y: -100, fill: BOX_FILLS[2]},
    {name: 'encode', x: 750, y: 20, fill: BOX_FILLS[3]},
    {name: 'finalizeExport', x: 750, y: 140, fill: BOX_FILLS[4]},
  ] as const;

  const boxes: Rect[] = [];
  const connectors: Line[] = [];

  for (const item of treeLayout) {
    const box = new Rect({
      x: item.x,
      y: item.y,
      width: BOX_W,
      height: BOX_H,
      radius: BOX_R,
      fill: item.fill,
      stroke: BOX_STROKE,
      lineWidth: 1,
      opacity: 0,
      children: [
        new Txt({
          text: item.name,
          fontFamily: Fonts.code,
          fontSize: LABEL_SIZE,
          fill: Colors.text.primary,
          fontWeight: 500,
        }),
      ],
    });
    boxes.push(box);
  }

  const exportBottom = treeLayout[0].y + BOX_H / 2;
  const splitY = -165;
  connectors.push(
    new Line({
      points: [
        [treeLayout[0].x, exportBottom],
        [treeLayout[0].x, splitY],
        [treeLayout[1].x, splitY],
        [treeLayout[1].x, treeLayout[1].y - BOX_H / 2],
      ],
      stroke: LINE_COLOR,
      lineWidth: 2,
      radius: 8,
      opacity: 0,
    }),
  );
  connectors.push(
    new Line({
      points: [
        [treeLayout[0].x, exportBottom],
        [treeLayout[0].x, splitY],
        [treeLayout[2].x, splitY],
        [treeLayout[2].x, treeLayout[2].y - BOX_H / 2],
      ],
      stroke: LINE_COLOR,
      lineWidth: 2,
      radius: 8,
      opacity: 0,
    }),
  );
  connectors.push(
    new Line({
      points: [
        [treeLayout[2].x, treeLayout[2].y + BOX_H / 2],
        [treeLayout[2].x, treeLayout[3].y - BOX_H / 2],
      ],
      stroke: LINE_COLOR,
      lineWidth: 2,
      radius: 8,
      opacity: 0,
    }),
  );
  connectors.push(
    new Line({
      points: [
        [treeLayout[3].x, treeLayout[3].y + BOX_H / 2],
        [treeLayout[3].x, treeLayout[4].y - BOX_H / 2],
      ],
      stroke: LINE_COLOR,
      lineWidth: 2,
      radius: 8,
      opacity: 0,
    }),
  );

  for (const line of connectors) treeGroup.add(line);
  for (const box of boxes) treeGroup.add(box);

  // ── Анимация ──────────────────────────────────────────────────────────
  yield* manticore.appear(Timing.slow);
  yield* waitFor(0.4);

  const METHOD_SIGNATURES = [
    'public byte[] exportVideo',
    'private byte[] prepareFrames',
    'private byte[] encodeWithRetry',
    'private byte[] encode(',
    'private byte[] finalizeExport',
  ];

  yield* all(
    manticore.scrollTo(METHOD_SIGNATURES[4], 5.2),
    (function* () {
      yield* boxes[0]?.opacity(1, 0.35, easeInOutCubic);
      yield* waitFor(0.62);
      yield* all(
        boxes[1]?.opacity(1, 0.35, easeInOutCubic) ?? waitFor(0),
        connectors[0]?.opacity(1, 0.35, easeInOutCubic) ?? waitFor(0),
      );
      yield* waitFor(0.62);
      yield* all(
        boxes[2]?.opacity(1, 0.35, easeInOutCubic) ?? waitFor(0),
        connectors[1]?.opacity(1, 0.35, easeInOutCubic) ?? waitFor(0),
      );
      yield* waitFor(0.62);
      yield* all(
        boxes[3]?.opacity(1, 0.35, easeInOutCubic) ?? waitFor(0),
        connectors[2]?.opacity(1, 0.35, easeInOutCubic) ?? waitFor(0),
      );
      yield* waitFor(0.62);
      yield* all(
        boxes[4]?.opacity(1, 0.35, easeInOutCubic) ?? waitFor(0),
        connectors[3]?.opacity(1, 0.35, easeInOutCubic) ?? waitFor(0),
      );
    })(),
  );
  yield* waitFor(1.5);

  // ── Такт 2: Рефакторинг — правильные границы ─────────────────────────

  // Целевые позиции: три ребёнка равномерно
  const THREE_Y = treeLayout[1].y;
  const LEFT_X = 370;
  const MID_X = 610;
  const RIGHT_X = 850;

  // Шаг 1: линия encode→finalizeExport исчезает, finalizeExport отрывается и поднимается
  yield* all(
    connectors[3].opacity(0, 0.5, easeInOutCubic),
    connectors[2].opacity(0, 0.5, easeInOutCubic),
  );
  yield* waitFor(0.3);

  // encode исчезает
  yield* boxes[3].opacity(0, 0.5, easeInOutCubic);
  yield* waitFor(0.2);

  yield* all(
    boxes[1].position([LEFT_X, THREE_Y], 0.8, easeInOutCubic),
    boxes[2].position([MID_X, THREE_Y], 0.8, easeInOutCubic),
    boxes[4].position([RIGHT_X, THREE_Y], 0.8, easeInOutCubic),
  );
  yield* waitFor(0.3);

  // Старые связи от exportVideo исчезают
  yield* all(
    connectors[0].opacity(0, 0.4, easeInOutCubic),
    connectors[1].opacity(0, 0.4, easeInOutCubic),
  );
  yield* waitFor(0.2);

  const newSplitY = treeLayout[0].y + BOX_H / 2 + 15;
  const rootX = treeLayout[0].x;
  const newConn0 = new Line({
    points: [
      [rootX, treeLayout[0].y + BOX_H / 2],
      [rootX, newSplitY],
      [LEFT_X, newSplitY],
      [LEFT_X, THREE_Y - BOX_H / 2],
    ],
    stroke: LINE_COLOR, lineWidth: 2, radius: 8, opacity: 0,
  });
  const newConn1 = new Line({
    points: [
      [rootX, treeLayout[0].y + BOX_H / 2],
      [rootX, newSplitY],
      [MID_X, newSplitY],
      [MID_X, THREE_Y - BOX_H / 2],
    ],
    stroke: LINE_COLOR, lineWidth: 2, radius: 8, opacity: 0,
  });
  const newConn2 = new Line({
    points: [
      [rootX, treeLayout[0].y + BOX_H / 2],
      [rootX, newSplitY],
      [RIGHT_X, newSplitY],
      [RIGHT_X, THREE_Y - BOX_H / 2],
    ],
    stroke: LINE_COLOR, lineWidth: 2, radius: 8, opacity: 0,
  });
  treeGroup.add(newConn0);
  treeGroup.add(newConn1);
  treeGroup.add(newConn2);

  yield* all(
    newConn0.opacity(1, 0.5, easeInOutCubic),
    newConn1.opacity(1, 0.5, easeInOutCubic),
    newConn2.opacity(1, 0.5, easeInOutCubic),
  );
  yield* waitFor(0.8);

  // Шаг 2: Морф кода — скролл наверх и морф exportVideo
  const refactoredModel = JavaClass.create([
    method('public', 'byte[]', 'exportVideo',
      [param('byte[]', 'sourceFrames'), param('String', 'outputFormat'),
       param('String', 'colorProfile'), param('String', 'subtitleTrack'),
       param('String', 'watermarkMode'), param('String', 'audioProfile')],
      ['validateInput(sourceFrames, outputFormat);',
       'byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack);',
       'byte[] encodedVideo = encodeWithRetry(preparedFrames, outputFormat);',
       '',
       'return finalizeExport(encodedVideo, outputFormat, watermarkMode, audioProfile);']),

    method('private', 'byte[]', 'prepareFrames',
      [param('byte[]', 'sourceFrames'), param('String', 'colorProfile'),
       param('String', 'subtitleTrack')],
      ['byte[] normalizedFrames = normalizeFrames(sourceFrames);',
       'byte[] coloredFrames = applyColorProfile(normalizedFrames, colorProfile);',
       '',
       'return overlaySubtitles(coloredFrames, subtitleTrack);']),

    method('private', 'byte[]', 'encodeWithRetry',
      [param('byte[]', 'preparedFrames'), param('String', 'outputFormat')],
      ['int attemptsLeft = this.maxAttempts;',
       '',
       'while (attemptsLeft-- > 0) {',
       '    try {',
       '        return runEncoder(preparedFrames, outputFormat);',
       '    } catch (RuntimeException ex) { /* retry */ }',
       '}',
       '',
       'throw new IllegalStateException("Encoding failed");']),

    method('private', 'byte[]', 'finalizeExport',
      [param('byte[]', 'encodedVideo'), param('String', 'outputFormat'),
       param('String', 'watermarkMode'), param('String', 'audioProfile')],
      ['if (!isSupportedFormat(outputFormat)) {',
       '    throw new IllegalArgumentException("Unsupported: " + outputFormat);',
       '}',
       '',
       'Container container = Muxer.mux(encodedVideo, outputFormat);',
       'container.applyWatermark(watermarkMode);',
       'container.normalizeAudio(audioProfile);',
       '',
       'return container;']),
  ], MAX_LINE_CHARS);

  yield* manticore.scrollTo(0, 1.0);
  yield* waitFor(0.3);
  yield* manticore.morphTo(refactoredModel.render(), {
    addStyle: 'fade',
    blockOrder: 'parallel',
    scrollStrategy: 'block',
  });
  yield* waitFor(2.0);

  // Затухание
  yield* all(
    manticore.disappear(0.8),
    treeGroup.opacity(0, 0.8, easeInOutCubic),
  );
  yield* waitFor(0.5);
});
