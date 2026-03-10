import {makeScene2D} from '@motion-canvas/2d';
import {waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Colors, Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

const CODE_CARD_STYLE = {
  radius: 24,
  fill: 'rgba(0,0,0,0)',
  stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0,
  shadowColor: 'rgba(0,0,0,0)',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  edge: false,
} as const;

const MONOLITH_CODE = `ExportResult export(VideoClip clip, String outputFormat) {
    validateClip(clip);
    return prepareAndEncode(clip, outputFormat);
  }

  private ExportResult prepareAndEncode(VideoClip clip, String outputFormat) {
    FrameBatch frames = new FrameBatch(clip.frames());
    return encodeWithRetry(frames, outputFormat);
  }

  private ExportResult encodeWithRetry(FrameBatch frames, String outputFormat) {
    return retryPolicy.execute(() -> encode(frames, outputFormat));
  }

  private ExportResult encode(FrameBatch frames, String outputFormat) {
    EncodedPayload payload = encoderGateway.encode(frames);
    return finalizeExport(payload, outputFormat);
  }

  private ExportResult finalizeExport(EncodedPayload payload, String outputFormat) {
    if (!"mp4".equals(outputFormat) && !"webm".equals(outputFormat)) {
      throw new IllegalArgumentException("Unsupported format: " + outputFormat);
    }

    byte[] fileBytes = wrapContainer(payload.getBytes(), outputFormat);
    return new ExportResult(fileBytes);
  }
}`;

export default makeScene2D(function* (view) {
  applyBackground(view);

  const fontSize = 28;
  const lineHeight = Math.round(fontSize * 1.55 * 10) / 10;
  const paddingY = getCodePaddingY(fontSize);

  const blockHeight = SafeZone.bottom - SafeZone.top - 40;
  const blockWidth = SafeZone.right - SafeZone.left;
  const topInset = Math.max(8, paddingY - 6);

  const monolith = CodeBlock.fromCode(MONOLITH_CODE, {
    x: 0,
    y: 0,
    width: blockWidth,
    height: blockHeight,
    fontSize,
    lineHeight,
    contentOffsetY: topInset,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    customTypes: [
      'VideoClip',
      'ExportResult',
      'FrameBatch',
      'EncodedPayload',
      'RetryPolicy',
      'EncoderGateway',
      'Operation',
    ],
  });

  monolith.mount(view);

  const lines = MONOLITH_CODE.split('\n');
  const callSiteRules: Array<{contains: string; methods: string[]}> = [
    {contains: 'validateClip(clip);', methods: ['validateClip']},
    {contains: 'return prepareAndEncode(clip, outputFormat);', methods: ['prepareAndEncode']},
    {contains: 'return encodeWithRetry(frames, outputFormat);', methods: ['encodeWithRetry']},
    {contains: 'return retryPolicy.execute(() -> encode(frames, outputFormat));', methods: ['execute', 'encode']},
    {contains: 'EncodedPayload payload = encoderGateway.encode(frames);', methods: ['encode']},
    {contains: 'return finalizeExport(payload, outputFormat);', methods: ['finalizeExport']},
    {contains: 'byte[] fileBytes = wrapContainer(payload.getBytes(), outputFormat);', methods: ['getBytes']},
  ];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rule = callSiteRules.find(r => line.includes(r.contains));
    if (!rule) continue;
    yield* monolith.recolorTokens(i, rule.methods, Colors.accent, 0);
    if (line.includes('encoderGateway.encode(')) {
      yield* monolith.recolorTokens(i, ['encoderGateway'], 'rgba(244,241,235,0.72)', 0);
    }
  }

  const errorLine = lines.findIndex(line => line.includes('throw new IllegalArgumentException('));
  if (errorLine >= 0) {
    // Only the quoted string should stand out softly.
    yield* monolith.recolorTokens(errorLine, ['"Unsupported format: "'], 'rgba(168, 214, 178, 0.88)', 0);
  }

  yield* monolith.appear(Timing.normal);

  const clipHeight = blockHeight - paddingY * 2;
  const targetLastY = clipHeight / 2 - lineHeight / 2 - 12;
  // Height is fixed, so CodeBlock uses top-aligned content start.
  const startY = -clipHeight / 2 + topInset + lineHeight / 2;
  const currentLastY = startY + (lines.length - 1) * lineHeight;
  const scrollAmount = Math.max(0, currentLastY - targetLastY + 24);

  yield* monolith.animateScrollY(scrollAmount, 12.5);

  yield* waitFor(0.5);
  yield* monolith.disappear(Timing.normal);
});
