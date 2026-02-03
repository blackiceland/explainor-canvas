import {makeScene2D, Node, Rect, Txt, Video} from '@motion-canvas/2d';
import {createRef, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Colors, Fonts, Screen, Timing} from '../core/theme';
import {textWidth} from '../core/utils/textMeasure';

function hexToRgba(hex: string, alpha: number): string {
  const h = String(hex).trim().replace('#', '');
  const s = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}

function fitFontSize(
  text: string,
  maxWidthPx: number,
  fontFamily: string,
  maxFontSize: number,
  minFontSize: number,
  fontWeight: number,
  letterSpacing: number,
): number {
  const maxW = Math.max(1, maxWidthPx);
  let lo = Math.max(1, Math.floor(minFontSize));
  let hi = Math.max(lo, Math.floor(maxFontSize));

  const lines = String(text ?? '').split('\n');
  const measureLine = (line: string, size: number) =>
    textWidth(line, fontFamily, size, fontWeight) +
    Math.max(0, line.length - 1) * Math.max(0, letterSpacing);
  const measure = (size: number) =>
    Math.max(0, ...lines.map(line => measureLine(line, size)));

  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(mid) <= maxW) lo = mid;
    else hi = mid - 1;
  }

  return lo;
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  const clipUrl = '/kling_20251230_Image_to_Video_Cinematic__429_0.mp4';
  // Poster/editorial break: shorter first line, heavier second line.
  const captionTopLine1 = 'When fighting duplication';
  const captionTopLine2 = 'becomes the worst decision.';
  const captionTop = `${captionTopLine1}\n${captionTopLine2}`;
  const ink = '#F6E7D4';

  const container = createRef<Node>();
  const on = createSignal(0);

  const captionTopSize = 48;
  const captionWeight = 600;
  const captionLetterSpacing = 0.5;
  // Bring captions closer to the video (less empty air).
  const topCaptionY = -Screen.height / 2 + 160;

  // Centered, large video. Simple rectangle: no frame, no radius, no shadow.
  const videoW = 1000;
  const videoH = Math.round(videoW * 9 / 16);
  const cropScale = 1.06;
  const captionW = Math.round(videoW * 0.78);
  const videoY = 40;

  // Captions match the video width exactly (and auto-fit to avoid wrapping/clipping).
  const topSize = fitFontSize(
    captionTop,
    captionW,
    Fonts.primary,
    captionTopSize,
    36,
    captionWeight,
    captionLetterSpacing,
  );
  const topLineHeight = Math.round(topSize * 1.05);

  view.add(
    <Node ref={container} opacity={() => on()}>
      <Txt
        zIndex={10}
        fontFamily={Fonts.primary}
        fontWeight={captionWeight}
        fontSize={topSize}
        lineHeight={topLineHeight}
        letterSpacing={captionLetterSpacing}
        x={-videoW / 2}
        y={topCaptionY}
        width={captionW}
        fill={hexToRgba(ink, 0.86)}
        textAlign={'left'}
        offset={[-1, -1]}
        text={captionTopLine1}
      />
      <Txt
        zIndex={10}
        fontFamily={Fonts.primary}
        fontWeight={captionWeight}
        fontSize={topSize}
        lineHeight={topLineHeight}
        letterSpacing={captionLetterSpacing}
        x={videoW / 2}
        y={topCaptionY + topLineHeight}
        width={captionW}
        fill={hexToRgba(Colors.accent, 0.92)}
        textAlign={'right'}
        offset={[1, -1]}
        text={captionTopLine2}
      />

      <Rect
        width={videoW}
        height={videoH}
        x={0}
        y={videoY}
        offset={[0, 0]}
        radius={0}
        clip
        fill={'rgba(0,0,0,0)'}
      >
        <Video
          src={clipUrl}
          play
          loop
          smoothing
          width={videoW}
          height={videoH}
          x={0}
          y={0}
          offset={[0, 0]}
          radius={0}
          scale={cropScale}
        />
      </Rect>
    </Node>,
  );

  on(0);
  yield* waitFor(0.1);
  yield* on(1, Math.max(0.75, Timing.slow * 0.82), easeInOutCubic);
  yield* waitFor(1.6);
  yield* on(0, Math.max(0.7, Timing.slow * 0.78), easeInOutCubic);
});


