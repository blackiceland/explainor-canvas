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
  const chapterWord = 'ГЛАВА';
  const chapterNumber = '1';
  const titleLine1 = 'КОГДА БОРЬБА С ДУБЛИРОВАНИЕМ';
  const titleLine2 = 'СТАНОВИТСЯ ХУДШИМ РЕШЕНИЕМ';
  const chapterTitle = `${titleLine1}\n${titleLine2}`;
  const ink = '#F6E7D4';

  const container = createRef<Node>();
  const clip = createRef<Video>();
  const on = createSignal(0);
  const ready = createSignal(false);

  const captionTopSize = 48;
  const captionWeight = 600;
  const captionLetterSpacing = 0.5;
  // Header line baseline (above the video).
  const headerY = -Screen.height / 2 + 210;

  // Keep video size identical to EN; crop left/right slightly.
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

  // Header: left big "ГЛАВА 1", right smaller 2-line title (as in the reference).
  const headerW = videoW;
  const blocksGap = 40;
  const leftSize = 72;
  const leftGap = 18;
  const titleMaxFont = 48;
  const titleMinFont = 28;
  const titleLineHeightFactor = 1.08;

  const measureTextPx = (text: string, size: number) =>
    textWidth(text, Fonts.primary, size, captionWeight) +
    Math.max(0, text.length - 1) * Math.max(0, captionLetterSpacing);

  const chapterWordW = measureTextPx(chapterWord, leftSize);
  const chapterNumberW = measureTextPx(chapterNumber, leftSize);
  const leftBlockW = chapterWordW + leftGap + chapterNumberW;
  const titleMaxW = Math.max(1, headerW - leftBlockW - blocksGap);

  const titleSize = fitFontSize(
    chapterTitle,
    titleMaxW,
    Fonts.primary,
    titleMaxFont,
    titleMinFont,
    captionWeight,
    captionLetterSpacing,
  );
  const titleLineHeight = Math.round(titleSize * titleLineHeightFactor);
  const titleY1 = headerY - titleLineHeight / 2;
  const titleY2 = headerY + titleLineHeight / 2;

  // "Justify" each title line by adjusting letter spacing so the line
  // spans exactly `titleMaxW` (right edge matches the video edge).
  const measureLinePx = (text: string, size: number, letterSpacing: number) =>
    textWidth(text, Fonts.primary, size, captionWeight) +
    Math.max(0, text.length - 1) * Math.max(0, letterSpacing);
  const justifySpacing = (text: string) => {
    const base = captionLetterSpacing;
    const w = measureLinePx(text, titleSize, base);
    const slots = Math.max(1, text.length - 1);
    const extra = Math.max(0, (titleMaxW - w) / slots);
    // Prevent ugly "tracked-out" look on short lines (e.g. a single word).
    const cap = text.length < 14 ? 2.2 : 8;
    return base + Math.min(extra, cap);
  };
  const titleLetterSpacing1 = justifySpacing(titleLine1);
  const titleLetterSpacing2 = justifySpacing(titleLine2);

  view.add(
    <Node ref={container} opacity={() => on()}>
      <Txt
        zIndex={10}
        fontFamily={Fonts.primary}
        fontWeight={captionWeight}
        fontSize={leftSize}
        lineHeight={Math.round(leftSize * 0.95)}
        letterSpacing={captionLetterSpacing}
        x={-videoW / 2}
        y={headerY}
        width={headerW}
        fill={hexToRgba(ink, 0.86)}
        textAlign={'left'}
        offset={[-1, 0]}
        text={chapterWord}
      />
      <Txt
        zIndex={10}
        fontFamily={Fonts.primary}
        fontWeight={captionWeight}
        fontSize={leftSize}
        lineHeight={Math.round(leftSize * 0.95)}
        letterSpacing={captionLetterSpacing}
        x={-videoW / 2 + chapterWordW + leftGap}
        y={headerY}
        width={headerW}
        fill={hexToRgba(Colors.accent, 0.92)}
        textAlign={'left'}
        offset={[-1, 0]}
        text={chapterNumber}
      />
      <Txt
        zIndex={10}
        fontFamily={Fonts.primary}
        fontWeight={captionWeight}
        fontSize={titleSize}
        lineHeight={titleLineHeight}
        letterSpacing={titleLetterSpacing1}
        x={-videoW / 2 + leftBlockW + blocksGap}
        y={titleY1}
        width={titleMaxW}
        fill={hexToRgba(ink, 0.86)}
        textAlign={'left'}
        offset={[-1, 0]}
        text={titleLine1}
      />
      <Txt
        zIndex={10}
        fontFamily={Fonts.primary}
        fontWeight={captionWeight}
        fontSize={titleSize}
        lineHeight={titleLineHeight}
        letterSpacing={titleLetterSpacing2}
        x={-videoW / 2 + leftBlockW + blocksGap}
        y={titleY2}
        width={titleMaxW}
        fill={hexToRgba(ink, 0.86)}
        textAlign={'left'}
        offset={[-1, 0]}
        text={titleLine2}
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


