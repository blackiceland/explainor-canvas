import {Node} from '@motion-canvas/2d';
import {all, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {CodeGrid} from '../code/view/CodeGrid';
import {ExplainorCodeTheme, SyntaxTheme} from '../code/model/SyntaxTheme';
import {GridLayout} from '../layout/GridLayout';
import {Colors, Fonts, Timing} from '../theme';

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

export function* playQuadCode(view: Node, options: QuadCodeOptions): ThreadGenerator {
    const {blocks, highlightColor = Colors.accent, theme = ExplainorCodeTheme} = options;
    const codes = blocks.map(b => b.code);
    const layout = GridLayout.quad(codes);

    const grids = blocks.map((block, i) => {
        const cell = layout.cells[i];
        const offsetX = 120;
        const grid = CodeGrid.fromCode(block.code, {
            x: cell.x + offsetX,
            y: cell.y,
            width: cell.width,
            fontSize: layout.fontSize,
            lineHeight: layout.lineHeight,
            fontFamily: Fonts.code,
            theme,
        });
        grid.mount(view);
        return grid;
    });

    yield* all(...grids.map(g => g.appear(Timing.slow)));

    yield* waitFor(Timing.normal);

    const highlights = blocks
        .map((block, i) => {
            if (block.highlightLine !== undefined && block.highlightPattern) {
                return grids[i].recolor(block.highlightLine, block.highlightPattern, highlightColor, Timing.normal);
            }
            return null;
        })
        .filter((h): h is ThreadGenerator => h !== null);

    if (highlights.length > 0) {
        yield* all(...highlights);
    }

    yield* waitFor(Timing.slow * 2);
}
