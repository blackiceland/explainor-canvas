import {makeScene2D, Node, Txt} from '@motion-canvas/2d';
import {waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Fonts} from '../core/theme';

// ЛАБОРАТОРИЯ ТИТУЛА «Your null / means too much» — 8 вариантов в одном кадре
// (сетка 4×2), разные шрифты и голоса, один крем для честного сравнения.
// Автор выбирает по номеру. Сцена служебная, в монтаж не идёт.

const WARM_CREAM = 'rgba(244, 230, 200, 0.96)';
const DIM = 'rgba(244, 230, 200, 0.35)';

const CELL_W = 480;
const CELL_H = 540;

interface Variant {
  n: number;
  label: string;
  lines: [string, string];
  font: string;
  fs: number;
  weight: number;
  ls: number;
  italic?: boolean;
  pitch: number;
}

const VARIANTS: Variant[] = [
  {n: 1, label: 'canon sans', lines: ['Your null', 'means too much'], font: Fonts.primary, fs: 46, weight: 500, ls: 1.5, pitch: 62},
  {n: 2, label: 'poster caps', lines: ['YOUR NULL', 'MEANS TOO MUCH'], font: 'Manrope, sans-serif', fs: 36, weight: 700, ls: 5, pitch: 56},
  {n: 3, label: 'garamond', lines: ['Your null', 'means too much'], font: 'EB Garamond, serif', fs: 50, weight: 500, ls: 0.5, pitch: 62},
  {n: 4, label: 'newsreader italic', lines: ['Your null', 'means too much'], font: 'Newsreader, serif', fs: 48, weight: 500, ls: 0.5, italic: true, pitch: 62},
  {n: 5, label: 'playfair italic', lines: ['your null', 'means too much'], font: 'Playfair Display, serif', fs: 46, weight: 500, ls: 0.5, italic: true, pitch: 62},
  {n: 6, label: 'jetbrains mono', lines: ['your null', 'means too much'], font: 'JetBrains Mono, monospace', fs: 40, weight: 500, ls: 0, pitch: 58},
  {n: 7, label: 'courier prime', lines: ['Your null', 'means too much'], font: 'Courier Prime, monospace', fs: 42, weight: 400, ls: 0, pitch: 58},
  {n: 8, label: 'monaspace xenon', lines: ['Your null', 'means too much'], font: 'Monaspace Xenon, monospace', fs: 38, weight: 500, ls: 0, pitch: 56},
];

export default makeScene2D(function* (view) {
  applyBackground(view);

  VARIANTS.forEach((v, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const cx = (col - 1.5) * CELL_W;
    const cy = (row - 0.5) * CELL_H;
    const cell = new Node({x: cx, y: cy});

    cell.add(
      new Txt({
        text: String(v.n),
        x: -CELL_W / 2 + 36,
        y: -CELL_H / 2 + 52,
        fontFamily: Fonts.code,
        fontSize: 24,
        fill: DIM,
      }),
    );
    v.lines.forEach((line, li) => {
      cell.add(
        new Txt({
          text: line,
          y: (li - 0.5) * v.pitch,
          fontFamily: v.font,
          fontSize: v.fs,
          fontWeight: v.weight,
          fontStyle: v.italic ? 'italic' : 'normal',
          letterSpacing: v.ls,
          fill: WARM_CREAM,
        }),
      );
    });
    view.add(cell);
  });

  yield* waitFor(1);
});
