import {Node} from '@motion-canvas/2d';
import {all, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {CodeGrid} from '../code/view/CodeGrid';
import {ExplainorCodeTheme, SyntaxTheme} from '../code/model/SyntaxTheme';
import {GridLayout} from '../layout/GridLayout';
import {Colors, Fonts, Timing, Screen} from '../theme';

export interface CodeBlock {
    code: string;
    highlightLine?: number;
    highlightPattern?: string[];
}

export interface QuadCodeOptions {
    blocks: [CodeBlock, CodeBlock, CodeBlock, CodeBlock];
    highlightColor?: string;
    theme?: SyntaxTheme;
}

export function* playQuadCode(view: Node, options: QuadCodeOptions): Generator<any, CodeGrid[], any> {
    const {blocks, highlightColor = Colors.accent, theme = ExplainorCodeTheme} = options;
    const codes = blocks.map(b => b.code);
    const layout = GridLayout.quad(codes);

    const topRowIndices = [0, 1];
    const bottomRowIndices = [2];

    const topRowHeight = Math.max(
        ...topRowIndices.map(i => {
            const lines = blocks[i].code.split('\n').length;
            return lines * layout.lineHeight + layout.fontSize * 4;
        }),
    );

    const bottomRowHeight = Math.max(
        ...bottomRowIndices.map(i => {
            const lines = blocks[i].code.split('\n').length;
            return lines * layout.lineHeight + layout.fontSize * 4;
        }),
    );

    const verticalGap = (Screen.height - topRowHeight - bottomRowHeight) / 3;
    const topRowY = -Screen.height / 2 + verticalGap + topRowHeight / 2;
    const bottomRowY = topRowY + topRowHeight / 2 + verticalGap + bottomRowHeight / 2;

    const grids = blocks.map((block, i) => {
        if (i === 3) {
            return null;
        }

        const cell = layout.cells[i];
        const rowY = i < 2 ? topRowY : bottomRowY;

        const grid = CodeGrid.fromCode(block.code, {
            x: cell.x,
            y: rowY,
            width: cell.width,
            fontSize: layout.fontSize,
            lineHeight: layout.lineHeight,
            fontFamily: Fonts.code,
            theme,
        });
        grid.mount(view);
        return grid;
    });

    const visibleGrids = grids.filter((g): g is CodeGrid => g !== null);

    yield* all(...visibleGrids.map(g => g.appear(Timing.slow)));

    yield* waitFor(Timing.normal);

    const highlights = blocks
        .map((block, i) => {
            const grid = grids[i];
            if (!grid) {
                return null;
            }
            if (block.highlightLine !== undefined && block.highlightPattern) {
                return all(
                    grid.highlightRanges([[block.highlightLine, block.highlightLine]], Timing.normal),
                    grid.recolor(block.highlightLine, block.highlightPattern, highlightColor, Timing.normal),
                );
            }
            return null;
        })
        .filter((h): h is ThreadGenerator => h !== null);

    if (highlights.length > 0) {
        yield* all(...highlights);
    }

    yield* waitFor(Timing.slow * 2);

    return visibleGrids;
}
