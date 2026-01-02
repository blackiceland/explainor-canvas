import {Txt} from '@motion-canvas/2d';
import {SignalValue} from '@motion-canvas/core';
import {Fonts} from '../theme';
import {fitText} from '../utils/textMeasure';

export type CodeBlockTextStyle = {
  fontSize: number;
  lineHeight: number;
  width: number;
  fontWeight?: number;
};

const readNum = (v: SignalValue<number>) => (typeof v === 'function' ? v() : v);
const readStr = (v: SignalValue<string>) => (typeof v === 'function' ? v() : v);

function ellipsizeBlock(
  text: string,
  maxWidthPx: number,
  fontSize: number,
  fontWeight: number,
  mode: 'end' | 'middle',
  ellipsis: string,
) {
  return text
    .split('\n')
    .map(line => fitText(line, maxWidthPx, mode, Fonts.code, fontSize, fontWeight, ellipsis))
    .join('\n');
}

export function CodeBlockText(props: {
  ref?: any;
  x: SignalValue<number>;
  y: SignalValue<number>;
  style: CodeBlockTextStyle;
  text: SignalValue<string>;
  fill: SignalValue<string>;
  opacity?: SignalValue<number>;
  ellipsis?: boolean;
  ellipsisMode?: 'end' | 'middle';
  maxWidthPx?: SignalValue<number>;
  ellipsisText?: string;
}) {
  const fontWeight = props.style.fontWeight ?? 650;
  const ellipsisMode = props.ellipsisMode ?? 'end';
  const ellipsisText = props.ellipsisText ?? '...';
  const maxWidthPx = props.maxWidthPx ?? props.style.width;

  return (
    <Txt
      ref={props.ref}
      x={props.x}
      y={props.y}
      width={props.style.width}
      text={() => {
        const raw = readStr(props.text);
        return props.ellipsis
          ? ellipsizeBlock(raw, readNum(maxWidthPx), props.style.fontSize, fontWeight, ellipsisMode, ellipsisText)
          : raw;
      }}
      fontFamily={Fonts.code}
      fontSize={props.style.fontSize}
      fontWeight={fontWeight}
      lineHeight={props.style.lineHeight}
      fill={props.fill}
      textAlign={'left'}
      offset={[-1, -1]}
      opacity={props.opacity}
    />
  );
}

export function CodeBlockWithOverlay(props: {
  x: SignalValue<number>;
  y: SignalValue<number>;
  style: CodeBlockTextStyle;
  keysText: SignalValue<string>;
  valuesText: SignalValue<string>;
  keysFill: SignalValue<string>;
  valuesFill: SignalValue<string>;
  opacity?: SignalValue<number>;
  valuesOpacity?: SignalValue<number>;
  valuesDx?: SignalValue<number>;
  ellipsis?: boolean;
  ellipsisMode?: 'end' | 'middle';
  maxWidthPx?: SignalValue<number>;
  ellipsisText?: string;
  keysRef?: any;
  valuesRef?: any;
}) {
  const baseOpacity = props.opacity ?? 1;
  const valuesOpacity = props.valuesOpacity ?? 1;
  const valuesDx = props.valuesDx ?? 0;
  const fontWeight = props.style.fontWeight ?? 650;
  const ellipsisMode = props.ellipsisMode ?? 'end';
  const ellipsisText = props.ellipsisText ?? '...';
  const maxWidthPx = props.maxWidthPx ?? props.style.width;

  const read = (v: SignalValue<number>) => readNum(v);

  return (
    <>
      <Txt
        ref={props.keysRef}
        x={props.x}
        y={props.y}
        width={props.style.width}
        text={() => {
          const raw = readStr(props.keysText);
          return props.ellipsis
            ? ellipsizeBlock(raw, readNum(maxWidthPx), props.style.fontSize, fontWeight, ellipsisMode, ellipsisText)
            : raw;
        }}
        fontFamily={Fonts.code}
        fontSize={props.style.fontSize}
        fontWeight={fontWeight}
        lineHeight={props.style.lineHeight}
        fill={props.keysFill}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={baseOpacity}
      />
      <Txt
        ref={props.valuesRef}
        x={() => readNum(props.x) + read(valuesDx)}
        y={props.y}
        width={() => Math.max(0, props.style.width - read(valuesDx))}
        text={() => {
          const raw = readStr(props.valuesText);
          const effectiveW = Math.max(0, readNum(maxWidthPx) - read(valuesDx));
          return props.ellipsis
            ? ellipsizeBlock(raw, effectiveW, props.style.fontSize, fontWeight, ellipsisMode, ellipsisText)
            : raw;
        }}
        fontFamily={Fonts.code}
        fontSize={props.style.fontSize}
        fontWeight={fontWeight}
        lineHeight={props.style.lineHeight}
        fill={props.valuesFill}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={() => read(baseOpacity) * read(valuesOpacity)}
      />
    </>
  );
}


