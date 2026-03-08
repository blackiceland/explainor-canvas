import {makeScene2D, Node, Txt} from '@motion-canvas/2d';
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
  COLOR_RULES,
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

  const codeW = Screen.width - 80;
  const codeCenterX = 0;

  const model = JavaClass.create([
    method('public', 'byte[]', 'exportVideo',
      [param('byte[]', 'sourceFrames'), param('String', 'outputFormat'),
       param('String', 'colorProfile'), param('String', 'subtitleTrack'),
       param('String', 'watermarkMode'), param('String', 'audioProfile')],
      ['validateInput(sourceFrames, outputFormat);',
       'byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack, watermarkMode, audioProfile);',
       '',
       'return encodeWithRetry(preparedFrames, outputFormat, watermarkMode, audioProfile);']),

    method('private', 'byte[]', 'prepareFrames',
      [param('byte[]', 'sourceFrames'), param('String', 'colorProfile'),
       param('String', 'subtitleTrack'), param('String', 'watermarkMode'),
       param('String', 'audioProfile')],
      ['byte[] normalizedFrames = normalizeFrames(sourceFrames);',
       'byte[] coloredFrames = applyColorProfile(normalizedFrames, colorProfile);',
       'byte[] subtitledFrames = overlaySubtitles(coloredFrames, subtitleTrack);',
       'byte[] watermarkedFrames = applyWatermark(subtitledFrames, watermarkMode);',
       '',
       'return normalizeAudio(watermarkedFrames, audioProfile);']),

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
    x: codeCenterX, y: -50,
    width: codeW,
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

  yield* manticore.appear(Timing.slow);
  yield* waitFor(1.5);
});
