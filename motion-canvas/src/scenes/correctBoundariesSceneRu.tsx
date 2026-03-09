import {Line, makeScene2D, Node, Rect, Txt} from '@motion-canvas/2d';
import {all, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {measureChar, getCodePaddingX, getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Colors, Fonts, Timing} from '../core/theme';
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

  // Крупный manticore для финального показа рефакторированного кода
  const bigFontSize = 36;
  const bigLineHeight = Math.round(bigFontSize * 1.62 * 10) / 10;
  const bigTopInset = Math.max(8, getCodePaddingY(bigFontSize) - 8);
  const bigMaxChars = Math.floor(
    (CODE_W - getCodePaddingX(bigFontSize)) / measureChar(bigFontSize),
  );

  // ── Структура справа ──────────────────────────────────────────────────
  const BOX_W = 320;
  const BOX_H = 80;
  const BOX_R = 18;
  const BOX_STROKE = 'rgba(244, 241, 235, 0.25)';
  const LINE_COLOR = 'rgba(244, 241, 235, 0.22)';
  const LABEL_SIZE = 30;
  const BOX_FILLS = [
    'rgba(160, 190, 255, 0.16)',
    'rgba(160, 225, 200, 0.16)',
    'rgba(255, 200, 160, 0.16)',
    'rgba(200, 185, 255, 0.16)',
    'rgba(255, 180, 200, 0.16)',
  ];

  const TREE_CX = 530;
  const ROW0_Y = -280;
  const ROW1_Y = -110;
  const ROW2_Y = 60;
  const ROW3_Y = 230;
  const BRANCH_DX = 200;

  const treeGroup = new Node({});
  view.add(treeGroup);

  const treeLayout = [
    {name: 'exportVideo',     x: TREE_CX,              y: ROW0_Y, fill: BOX_FILLS[0]},
    {name: 'prepareFrames',   x: TREE_CX - BRANCH_DX,  y: ROW1_Y, fill: BOX_FILLS[1]},
    {name: 'encodeWithRetry', x: TREE_CX + BRANCH_DX,  y: ROW1_Y, fill: BOX_FILLS[2]},
    {name: 'encode',          x: TREE_CX + BRANCH_DX,  y: ROW2_Y, fill: BOX_FILLS[3]},
    {name: 'finalizeExport',  x: TREE_CX + BRANCH_DX,  y: ROW3_Y, fill: BOX_FILLS[4]},
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
  const splitY = (ROW0_Y + ROW1_Y) / 2;
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
      radius: 10,
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
      radius: 10,
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
      radius: 10,
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
      radius: 10,
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

  // Целевые позиции: три ребёнка в ряд (treeGroup сдвинется левее)
  const SHIFT_X = -210;
  const THREE_Y = ROW1_Y;
  const LEFT_X = TREE_CX - 370;
  const MID_X = TREE_CX;
  const RIGHT_X = TREE_CX + 370;

  const newSplitY = splitY;
  const rootX = treeLayout[0].x;
  const newConn0 = new Line({
    points: [
      [rootX, exportBottom],
      [rootX, newSplitY],
      [LEFT_X, newSplitY],
      [LEFT_X, THREE_Y - BOX_H / 2],
    ],
    stroke: LINE_COLOR, lineWidth: 2, radius: 12, opacity: 0,
  });
  const newConn1 = new Line({
    points: [
      [rootX, exportBottom],
      [rootX, newSplitY],
      [MID_X, newSplitY],
      [MID_X, THREE_Y - BOX_H / 2],
    ],
    stroke: LINE_COLOR, lineWidth: 2, radius: 12, opacity: 0,
  });
  const newConn2 = new Line({
    points: [
      [rootX, exportBottom],
      [rootX, newSplitY],
      [RIGHT_X, newSplitY],
      [RIGHT_X, THREE_Y - BOX_H / 2],
    ],
    stroke: LINE_COLOR, lineWidth: 2, radius: 12, opacity: 0,
  });
  treeGroup.add(newConn0);
  treeGroup.add(newConn1);
  treeGroup.add(newConn2);

  // Всё одним движением: дерево сдвигается в центр, перестраивается
  const DUR = 1.0;
  yield* all(
    treeGroup.position.x(SHIFT_X, DUR, easeInOutCubic),
    connectors[0].opacity(0, 0.4, easeInOutCubic),
    connectors[1].opacity(0, 0.4, easeInOutCubic),
    connectors[2].opacity(0, 0.4, easeInOutCubic),
    connectors[3].opacity(0, 0.4, easeInOutCubic),
    boxes[3].opacity(0, 0.4, easeInOutCubic),
    boxes[1].position([LEFT_X, THREE_Y], DUR, easeInOutCubic),
    boxes[2].position([MID_X, THREE_Y], DUR, easeInOutCubic),
    boxes[4].position([RIGHT_X, THREE_Y], DUR, easeInOutCubic),
    (function* () {
      yield* waitFor(0.4);
      yield* all(
        newConn0.opacity(1, 0.6, easeInOutCubic),
        newConn1.opacity(1, 0.6, easeInOutCubic),
        newConn2.opacity(1, 0.6, easeInOutCubic),
      );
    })(),
  );
  const bigW = SafeZone.right - SafeZone.left - 80;
  const bigMaxCharsWide = Math.floor(
    (bigW - getCodePaddingX(bigFontSize)) / measureChar(bigFontSize),
  );
  const refactoredModel = JavaClass.create([
    method('public', 'byte[]', 'exportVideo',
      [param('byte[]', 'sourceFrames'), param('String', 'outputFormat'),
       param('String', 'colorProfile'), param('String', 'subtitleTrack'),
       param('String', 'watermarkMode'), param('String', 'audioProfile')],
      ['validateInput(sourceFrames, outputFormat);',
       'byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack);',
       'byte[] encodedVideo = encodeWithRetry(preparedFrames);',
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
      [param('byte[]', 'preparedFrames')],
      ['int attemptsLeft = this.maxAttempts;',
       '',
       'while (attemptsLeft-- > 0) {',
       '    try {',
       '        return runEncoder(preparedFrames);',
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
  ], bigMaxCharsWide);

  const bigX = LEFT_CENTER_X - 50 - CODE_W / 2 + bigW / 2;
  const bigManticore = Manticore.create(refactoredModel.render(), {
    x: bigX, y: -50,
    width: bigW,
    height: SafeZone.bottom - SafeZone.top + 60,
    fontSize: bigFontSize,
    lineHeight: bigLineHeight,
    contentOffsetY: bigTopInset,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    customTypes: ['String', 'RuntimeException', 'IllegalStateException',
      'IllegalArgumentException', 'Muxer', 'Container'],
  });
  bigManticore.mount(view);
  bigManticore.colorize(COLOR_RULES);

  yield* waitFor(2.0);

  // Схема и код исчезают вместе
  yield* all(
    treeGroup.opacity(0, 0.8, easeInOutCubic),
    manticore.disappear(0.8),
  );
  yield* waitFor(0.5);

  // Крупный рефакторированный код плавно появляется
  yield* bigManticore.appear(1.0);
  yield* waitFor(2.5);

  yield* bigManticore.disappear(1.0);
  yield* waitFor(0.5);
});
