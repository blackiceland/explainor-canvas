import {Node, Gradient} from '@motion-canvas/2d';
import {all, easeInOutCubic, ThreadGenerator, waitFor, Vector2} from '@motion-canvas/core';
import {CodeGrid} from '../code/view/CodeGrid';
import {WhiteTheme, SyntaxTheme} from '../code/model/SyntaxTheme';
import {GridLayout, GridConfig} from '../layout/GridLayout';
import {SceneConfig} from '../layout/SceneConfig';
import {ExplainorTheme} from '../theme';

export interface CodeBlock {
    code: string;
    highlightLine?: number;
    highlightPattern?: string[];
}

export interface QuadCodeOptions {
    blocks: [CodeBlock, CodeBlock, CodeBlock, CodeBlock];
    highlightColor?: string;
    theme?: SyntaxTheme;
    gridConfig?: GridConfig;
}

export class QuadCodeScene {
    static *play(
        view: Node,
        options: QuadCodeOptions
    ): ThreadGenerator {
        const { blocks, highlightColor, theme, gridConfig } = options;
        const codes = blocks.map(b => b.code);

        const layout = GridLayout.quad(codes, gridConfig);
        const accentColor = highlightColor ?? ExplainorTheme.colors.accent.red;
        const syntaxTheme = theme ?? WhiteTheme;

        const grids: CodeGrid[] = [];

        for (let i = 0; i < 4; i++) {
            const cell = layout.cells[i];
            const block = blocks[i];

            const grid = CodeGrid.fromCode(block.code, {
                x: cell.x,
                y: cell.y,
                width: cell.width,
                fontSize: layout.fontSize,
                lineHeight: layout.lineHeight,
                fontFamily: SceneConfig.code.fontFamily,
                theme: syntaxTheme,
            });

            grid.mount(view);
            grids.push(grid);
        }

        yield* all(
            ...grids.map(grid => grid.appear(1.0))
        );

        yield* waitFor(0.5);

        const highlightAnimations: ThreadGenerator[] = [];

        for (let i = 0; i < 4; i++) {
            const block = blocks[i];
            const grid = grids[i];

            if (block.highlightLine !== undefined && block.highlightPattern) {
                highlightAnimations.push(
                    grid.recolor(block.highlightLine, block.highlightPattern, accentColor, 0.5)
                );
            }
        }

        if (highlightAnimations.length > 0) {
            yield* all(...highlightAnimations);
        }

        yield* waitFor(2);
    }
}

export function applyGradientBackground(view: Node): void {
    const gradient = ExplainorTheme.colors.backgroundGradient;
    if (gradient) {
        const gradientFill = new Gradient({
            type: 'linear',
            from: new Vector2(-960, -540),
            to: new Vector2(960, 540),
            stops: [
                { offset: 0, color: gradient.from },
                { offset: 1, color: gradient.to },
            ],
        });
        (view as any).fill(gradientFill);
    } else {
        (view as any).fill(ExplainorTheme.colors.background);
    }
}
