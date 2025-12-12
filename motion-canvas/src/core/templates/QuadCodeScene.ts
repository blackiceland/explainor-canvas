import {Node} from '@motion-canvas/2d';
import {all, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../code/components/CodeBlock';
import {ExplainorCodeTheme, SyntaxTheme} from '../code/model/SyntaxTheme';
import {GridLayout} from '../layout/GridLayout';
import {Colors, Fonts, Timing, Screen} from '../theme';

export interface CodeBlockSpec {
    code: string;
    highlightLine?: number;
    highlightPattern?: string[];
}

export interface QuadCodeOptions {
    blocks: [CodeBlockSpec, CodeBlockSpec, CodeBlockSpec, CodeBlockSpec];
    highlightColor?: string;
    theme?: SyntaxTheme;
    visibleIndices?: number[];
}

export function* playQuadCode(view: Node, options: QuadCodeOptions): Generator<any, CodeBlock[], any> {
    const {
        blocks,
        highlightColor = Colors.accent,
        theme = ExplainorCodeTheme,
        visibleIndices = [0, 1, 2, 3],
    } = options;

    const codes = blocks.map(b => b.code);
    const layout = GridLayout.quad(codes);

    const topRowIndices = [0, 1];
    const bottomRowIndices = [2, 3];

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

    const codeBlocks = blocks.map((blockSpec, i) => {
        const cell = layout.cells[i];
        const rowY = i < 2 ? topRowY : bottomRowY;

        const codeBlock = CodeBlock.fromCode(blockSpec.code, {
            x: cell.x,
            y: rowY,
            width: cell.width,
            fontSize: layout.fontSize,
            lineHeight: layout.lineHeight,
            fontFamily: Fonts.code,
            theme,
        });
        codeBlock.mount(view);
        return codeBlock;
    });

    const blocksToAppear = codeBlocks.filter((_, i) => visibleIndices.includes(i));
    yield* all(...blocksToAppear.map(b => b.appear(Timing.slow)));

    yield* waitFor(Timing.normal);

    const highlights = blocks
        .map((blockSpec, i) => {
            const codeBlock = codeBlocks[i];
            if (blockSpec.highlightLine !== undefined && blockSpec.highlightPattern) {
                return all(
                    codeBlock.highlightLines([[blockSpec.highlightLine, blockSpec.highlightLine]], Timing.normal),
                    codeBlock.recolorTokens(blockSpec.highlightLine, blockSpec.highlightPattern, highlightColor, Timing.normal),
                );
            }
            return null;
        })
        .filter((h): h is ThreadGenerator => h !== null);

    if (highlights.length > 0) {
        yield* all(...highlights);
    }

    yield* waitFor(Timing.slow * 2);

    return codeBlocks;
}
