import {SceneConfig} from './SceneConfig';

export interface CellInfo {
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    lineHeight: number;
}

export interface GridConfig {
    screenWidth?: number;
    screenHeight?: number;
    margin?: number;
    gap?: number;
    fillPercent?: number;
    minFontSize?: number;
    maxFontSize?: number;
    lineHeightRatio?: number;
    charWidthRatio?: number;
    fontFamily?: string;
}

export interface AutoFitResult {
    cells: CellInfo[];
    fontSize: number;
    lineHeight: number;
}

const DEFAULT_GRID_CONFIG: Required<GridConfig> = {
    screenWidth: 1920,
    screenHeight: 1080,
    margin: 100,
    gap: 60,
    fillPercent: 0.88,
    minFontSize: 20,
    maxFontSize: 36,
    lineHeightRatio: 1.5,
    charWidthRatio: 0.6,
    fontFamily: SceneConfig.code.fontFamily,
};

function mergeGridConfig(custom?: GridConfig): Required<GridConfig> {
    if (!custom) return DEFAULT_GRID_CONFIG;
    return {...DEFAULT_GRID_CONFIG, ...custom};
}

function measureCode(code: string, fontSize: number, charWidthRatio: number, lineHeightRatio: number): { width: number; height: number; lines: number; maxLineLength: number } {
    const lines = code.split('\n');
    const maxLineLength = Math.max(...lines.map(line => line.length));
    const width = maxLineLength * fontSize * charWidthRatio;
    const height = lines.length * fontSize * lineHeightRatio;
    return { width, height, lines: lines.length, maxLineLength };
}

export class GridLayout {
    static calculate(rows: number, cols: number, config?: GridConfig): CellInfo[] {
        const cfg = mergeGridConfig(config);

        const usableWidth = cfg.screenWidth * cfg.fillPercent;
        const usableHeight = cfg.screenHeight * cfg.fillPercent;

        const totalGapX = (cols - 1) * cfg.gap;
        const totalGapY = (rows - 1) * cfg.gap;

        const cellWidth = (usableWidth - totalGapX) / cols;
        const cellHeight = (usableHeight - totalGapY) / rows;

        const gridWidth = cols * cellWidth + totalGapX;
        const gridHeight = rows * cellHeight + totalGapY;

        const startX = -gridWidth / 2 + cellWidth / 2;
        const startY = -gridHeight / 2 + cellHeight / 2;

        const cells: CellInfo[] = [];

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = startX + col * (cellWidth + cfg.gap);
                const y = startY + row * (cellHeight + cfg.gap);

                cells.push({
                    x,
                    y,
                    width: cellWidth,
                    height: cellHeight,
                    fontSize: cfg.maxFontSize,
                    lineHeight: cfg.maxFontSize * cfg.lineHeightRatio,
                });
            }
        }

        return cells;
    }

    static autoFit(codes: string[], rows: number, cols: number, config?: GridConfig): AutoFitResult {
        const cfg = mergeGridConfig(config);

        const usableWidth = cfg.screenWidth * cfg.fillPercent;
        const usableHeight = cfg.screenHeight * cfg.fillPercent;

        const totalGapX = (cols - 1) * cfg.gap;
        const totalGapY = (rows - 1) * cfg.gap;

        const cellWidth = (usableWidth - totalGapX) / cols;
        const cellHeight = (usableHeight - totalGapY) / rows;

        let bestFontSize = cfg.minFontSize;

        for (let fontSize = cfg.maxFontSize; fontSize >= cfg.minFontSize; fontSize -= 2) {
            let allFit = true;

            for (const codeBlock of codes) {
                const measured = measureCode(codeBlock, fontSize, cfg.charWidthRatio, cfg.lineHeightRatio);
                const paddedWidth = cellWidth * 0.95;
                const paddedHeight = cellHeight * 0.95;

                if (measured.width > paddedWidth || measured.height > paddedHeight) {
                    allFit = false;
                    break;
                }
            }

            if (allFit) {
                bestFontSize = fontSize;
                break;
            }
        }

        const lineHeight = bestFontSize * cfg.lineHeightRatio;

        const gridWidth = cols * cellWidth + totalGapX;
        const gridHeight = rows * cellHeight + totalGapY;

        const startX = -gridWidth / 2 + cellWidth / 2;
        const startY = -gridHeight / 2 + cellHeight / 2;

        const cells: CellInfo[] = [];

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = startX + col * (cellWidth + cfg.gap);
                const y = startY + row * (cellHeight + cfg.gap);

                cells.push({
                    x,
                    y,
                    width: cellWidth,
                    height: cellHeight,
                    fontSize: bestFontSize,
                    lineHeight,
                });
            }
        }

        return { cells, fontSize: bestFontSize, lineHeight };
    }

    static quad(codes: string[], config?: GridConfig): AutoFitResult {
        return GridLayout.autoFit(codes, 2, 2, config);
    }

    static dual(codes: string[], config?: GridConfig): AutoFitResult {
        return GridLayout.autoFit(codes, 1, 2, config);
    }

    static single(code: string, config?: GridConfig): AutoFitResult {
        return GridLayout.autoFit([code], 1, 1, config);
    }
}
