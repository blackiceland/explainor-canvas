import {makeScene2D, Node, Pattern, Rect, Txt, Video} from '@motion-canvas/2d';
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

  // Public asset (served by Vite from `motion-canvas/public`).
  const clipUrl = '/kling_20251230_Image_to_Video_Cinematic__429_0.mp4';
  const chapterWord = 'Chapter ';
  const chapterNumber = '1';
  // Poster/editorial break: shorter first line, heavier second line.
  const captionTopLine1 = 'When fighting duplication';
  const captionTopLine2 = 'becomes the worst decision';
  const line1 = `${chapterWord}${chapterNumber} ${captionTopLine1}`;
  const captionTop = `${line1}\n${captionTopLine2}`;
  const ink = '#F6E7D4';

  const container = createRef<Node>();
  const clip = createRef<Video>();
  const on = createSignal(0);
  const ready = createSignal(false);

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

  // Strong film grain (applied ONLY to the video area).
  const grainCanvas =
    typeof document === 'undefined' ? null : (document.createElement('canvas') as HTMLCanvasElement);
  const grainSize = 220;
  if (grainCanvas) {
    grainCanvas.width = grainSize;
    grainCanvas.height = grainSize;
  }
  const grainCtx = grainCanvas?.getContext('2d');
  let lastGrainTick = -1;

  const mulberry32 = (seed: number) => {
    let t = seed >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let x = Math.imul(t ^ (t >>> 15), 1 | t);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  };

  const updateGrain = (timeSeconds: number) => {
    if (!grainCtx || !grainCanvas) return;
    // Update at ~12 fps for a "film" feel (cheap but effective).
    const tick = Math.floor(timeSeconds * 12);
    if (tick === lastGrainTick) return;
    lastGrainTick = tick;

    const img = grainCtx.createImageData(grainSize, grainSize);
    const data = img.data;
    const rnd = mulberry32(tick + 1337);
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.floor(rnd() * 255);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    grainCtx.putImageData(img, 0, 0);
  };

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
  const measureTextPx = (text: string) =>
    textWidth(text, Fonts.primary, topSize, captionWeight) +
    Math.max(0, text.length - 1) * Math.max(0, captionLetterSpacing);
  const chapterWordW = measureTextPx(chapterWord);
  const chapterNumberW = measureTextPx(chapterNumber);

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
        text={chapterWord}
      />
      <Txt
        zIndex={10}
        fontFamily={Fonts.primary}
        fontWeight={captionWeight}
        fontSize={topSize}
        lineHeight={topLineHeight}
        letterSpacing={captionLetterSpacing}
        x={-videoW / 2 + chapterWordW}
        y={topCaptionY}
        width={captionW}
        fill={hexToRgba(Colors.accent, 0.92)}
        textAlign={'left'}
        offset={[-1, -1]}
        text={chapterNumber}
      />
      <Txt
        zIndex={10}
        fontFamily={Fonts.primary}
        fontWeight={captionWeight}
        fontSize={topSize}
        lineHeight={topLineHeight}
        letterSpacing={captionLetterSpacing}
        x={-videoW / 2 + chapterWordW + chapterNumberW}
        y={topCaptionY}
        width={captionW}
        fill={hexToRgba(ink, 0.86)}
        textAlign={'left'}
        offset={[-1, -1]}
        text={` ${captionTopLine1}`}
      />
      <Txt
        zIndex={10}
        fontFamily={Fonts.primary}
        fontWeight={captionWeight}
        fontSize={topSize}
        lineHeight={topLineHeight}
        letterSpacing={captionLetterSpacing}
        x={-videoW / 2}
        y={topCaptionY + topLineHeight}
        width={captionW}
        fill={hexToRgba(ink, 0.86)}
        textAlign={'left'}
        offset={[-1, -1]}
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
          ref={clip}
          src={clipUrl}
          smoothing
          ratio={16 / 9}
          alpha={() => (ready() ? 1 : 0)}
          width={videoW}
          height={videoH}
          x={0}
          y={0}
          offset={[0, 0]}
          radius={0}
          scale={cropScale}
        />
        <Rect
          layout={false}
          width={videoW}
          height={videoH}
          x={0}
          y={0}
          offset={[0, 0]}
          fill={() => {
            updateGrain(view.globalTime());
            // Recreate the pattern after updating the canvas.
            // Some browsers effectively snapshot canvas patterns if the pattern object is reused.
            return grainCanvas ? new Pattern({image: grainCanvas, repetition: 'repeat'}) : 'rgba(0,0,0,0)';
          }}
          opacity={0.22}
          compositeOperation={'overlay'}
          cache={false}
        />
      </Rect>
    </Node>,
  );

  // Ensure the video has loaded enough metadata to have a finite duration.
  // Without this, some mp4s may report `duration = NaN` for a while and crash the renderer.
  yield clip().toPromise();
  ready(true);
  clip().loop(true);
  clip().play();

  on(0);
  yield* waitFor(0.1);
  yield* on(1, Math.max(0.75, Timing.slow * 0.82), easeInOutCubic);
  yield* waitFor(1.6);
  yield* on(0, Math.max(0.7, Timing.slow * 0.78), easeInOutCubic);
});


