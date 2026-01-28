import {makeScene2D, Node, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Colors, Fonts, Screen, Timing} from '../core/theme';
import {textWidth} from '../core/utils/textMeasure';

export default makeScene2D(function* (view) {
  applyBackground(view);
  view.add(
    <Rect width={Screen.width} height={Screen.height} fill={'rgba(168,217,255,0.03)'} />,
  );

  const fill = '#F6E7D4';
  const fontWeight = 700;
  const marginX = 90;
  const marginY = 80;
  const leftBias = 18;
  const baseSize = 300;
  const lineHeightFactor = 0.84;
  const letterSpacingFactor = 0.03;

  const chapterPrefix = 'ГЛАВА ';
  const chapterNum = '1';
  const chapter = `${chapterPrefix}${chapterNum}`;
  const restLines = ['ЛОВУШКА', 'ОБЩИХ', 'УСЛОВИЙ'];
  const allLines = [chapter, ...restLines];

  const maxWidth = Screen.width - marginX * 2;
  const maxHeight = Screen.height - marginY * 2;
  const left = -Screen.width / 2 + marginX;
  const top = -Screen.height / 2 + marginY;

  const baseMaxLine = Math.max(
    ...allLines.map(l => textWidth(l, Fonts.primary, baseSize, fontWeight)),
  );
  const scaleW = baseMaxLine > 0 ? maxWidth / baseMaxLine : 1;
  const scaleH = maxHeight / (allLines.length * baseSize * lineHeightFactor);
  const scale = Math.min(scaleW, scaleH);
  const chapterSize = Math.max(64, Math.floor(baseSize * scale));

  const restSize = Math.max(48, Math.floor(chapterSize * 0.82));

  const chapterLineHeight = Math.floor(chapterSize * lineHeightFactor);
  const restLineHeight = Math.floor(restSize * (lineHeightFactor + 0.08));
  const chapterLetterSpacing = Math.max(1, Math.round(chapterSize * letterSpacingFactor));
  const restLetterSpacing = Math.max(1, Math.round(restSize * letterSpacingFactor));

  const gap = Math.round(chapterSize * 0.18);
  const restBlockHeight = restLines.length * restLineHeight;
  const totalHeight = chapterLineHeight + gap + restBlockHeight;

  const x = left + maxWidth / 2 - leftBias;
  const yCenter = top + maxHeight / 2;
  const yTop = yCenter - totalHeight / 2;

  const measureWithLetterSpacing = (text: string, fontSize: number, letterSpacing: number) =>
    textWidth(text, Fonts.primary, fontSize, fontWeight) +
    Math.max(0, text.length - 1) * letterSpacing;

  const blockLeftX = x - maxWidth / 2;
  const chapterNumExtraGap = () => Math.round(chapterSize * 0.12);

  const container = createRef<Node>();
  view.add(
    <Node ref={container} opacity={0}>
      <Txt
        fontFamily={Fonts.primary}
        fontWeight={fontWeight}
        fontSize={chapterSize}
        lineHeight={chapterLineHeight}
        letterSpacing={chapterLetterSpacing}
        x={x}
        y={yTop + chapterLineHeight / 2}
        width={maxWidth}
        fill={fill}
        textAlign={'left'}
        text={chapterPrefix}
      />
      <Txt
        fontFamily={Fonts.primary}
        fontWeight={fontWeight}
        fontSize={chapterSize}
        lineHeight={chapterLineHeight}
        letterSpacing={chapterLetterSpacing}
        x={() =>
          blockLeftX +
          measureWithLetterSpacing(chapterPrefix, chapterSize, chapterLetterSpacing) +
          chapterNumExtraGap()
        }
        y={yTop + chapterLineHeight / 2}
        fill={Colors.accent}
        textAlign={'left'}
        text={chapterNum}
      />
      <Txt
        fontFamily={Fonts.primary}
        fontWeight={fontWeight}
        fontSize={restSize}
        lineHeight={restLineHeight}
        letterSpacing={restLetterSpacing}
        x={x}
        y={yTop + chapterLineHeight + gap + restBlockHeight / 2}
        width={maxWidth}
        fill={fill}
        textAlign={'left'}
        text={restLines.join('\n')}
      />
    </Node>,
  );

  yield* container().opacity(1, Timing.slow, easeInOutCubic);
  yield* waitFor(Timing.normal);
  yield* container().opacity(0, Timing.slow, easeInOutCubic);
});


