import {makeScene2D, Node, Rect, Txt} from '@motion-canvas/2d';
import {createRef, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Colors, Fonts, Screen} from '../core/theme';
import {textWidth} from '../core/utils/textMeasure';
import {OpenStyle} from '../core/openStyle';

function mixHex(a: string, b: string, t: number) {
  const k = Math.max(0, Math.min(1, t));
  const toRgb = (s: string) => {
    const hex = String(s).trim().replace('#', '');
    const h = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const bb = parseInt(h.slice(4, 6), 16);
    return {r, g, b: bb};
  };
  const x = toRgb(a);
  const y = toRgb(b);
  const r = Math.round(x.r + (y.r - x.r) * k);
  const g = Math.round(x.g + (y.g - x.g) * k);
  const bb = Math.round(x.b + (y.b - x.b) * k);
  return `rgb(${r},${g},${bb})`;
}

export default makeScene2D(function* (view) {
  // Underlay: match paymentInputsScene background (so the transition is seamless).
  // Then we recolor the text to the same color during swipe -> it "disappears".
  const revealBg = OpenStyle.colors.bg;
  view.add(<Rect width={Screen.width} height={Screen.height} fill={revealBg} />);

  // Overlay: black cover that will "run away" left -> right at the end.
  const outroT = createSignal(0);
  const black = createRef<Rect>();
  view.add(
    <Rect
      ref={black}
      width={Screen.width}
      height={Screen.height}
      x={() => outroT() * Screen.width * 1.2}
      fill={'#0B0B0B'}
    />,
  );

  const fill = '#F6E7D4';
  const fontWeight = 700;
  const marginX = 90;
  const marginY = 80;
  const leftBias = 70;
  const baseSize = 300;
  const lineHeightFactor = 0.84;
  const letterSpacingFactor = 0.03;
  const fadeIn = 0.8;
  const hold = 1.4;

  const chapterPrefix = 'CHAPTER ';
  const chapterNum = '2';
  const chapter = `${chapterPrefix}${chapterNum}`;
  // Keep the same "shape" as intro #1: CHAPTER + 3 lines below.
  // This avoids width becoming the limiting factor and keeps the font size consistent.
  const restLines = ['ONE SHAPE,', 'TWO', 'MEANINGS'];
  const allLines = [chapter, ...restLines];

  const maxWidth = Screen.width - marginX * 2;
  const maxHeight = Screen.height - marginY * 2;
  const left = -Screen.width / 2 + marginX;
  const top = -Screen.height / 2 + marginY;

  const baseMaxLine = Math.max(
    ...allLines.map(l => textWidth(l, Fonts.primary, baseSize, fontWeight)),
  );
  const scaleW = baseMaxLine > 0 ? maxWidth / baseMaxLine : 1;
  // Match intro #1 sizing scheme (same number of lines now).
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
        fill={() => mixHex(fill, revealBg, outroT())}
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
        fill={() => mixHex(Colors.accent, revealBg, outroT())}
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
        fill={() => mixHex(fill, revealBg, outroT())}
        textAlign={'left'}
        text={restLines.join('\n')}
      />
    </Node>,
  );

  // Fade in text on top of the black cover.
  yield* container().opacity(1, fadeIn, easeInOutCubic);
  yield* waitFor(hold);

  // Outro: black cover swipes away left->right, revealing the underlay BEHIND the text.
  // Text stays visible during the swipe (that's the whole point of the transition).
  yield* waitFor(0.15);
  const swipe = 0.95;
  // Smoothly blend the number (and the rest of the text) into the revealed background during swipe.
  yield* outroT(1, swipe, easeInOutCubic);
  // Small tail so the revealed background "lands" before the cut to the next scene.
  yield* waitFor(0.12);
});


