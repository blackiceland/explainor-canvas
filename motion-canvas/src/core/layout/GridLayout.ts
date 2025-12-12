import {Screen} from '../theme';
import {measureCode, getLineHeight} from '../code/shared/TextMeasure';

export interface Cell {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface FitResult {
    cells: Cell[];
    fontSize: number;
    lineHeight: number;
}

interface LayoutOptions {
    margin?: number;
    gap?: number;
    fill?: number;
    minFontSize?: number;
    maxFontSize?: number;
}

const DEFAULTS: Required<LayoutOptions> = {
    margin: 100,
    gap: 90,
    fill: 0.88,
    minFontSize: 18,
    maxFontSize: 26,
};

function createGrid(rows: number, cols: number, opts: Required<LayoutOptions>): Cell[] {
    const totalGapX = (cols + 1) * opts.gap;
    const cellW = (Screen.width - totalGapX) / cols;

    let cellH: number;
    let gridH: number;

    if (rows === 2) {
        const gapY = opts.gap;
        const availableH = Screen.height - gapY * 3;
        cellH = availableH / 2;
        gridH = 2 * cellH + gapY;
    } else {
        const usableH = Screen.height * opts.fill;
        cellH = (usableH - (rows - 1) * opts.gap) / rows;
        gridH = rows * cellH + (rows - 1) * opts.gap;
    }

    const startX = -Screen.width / 2 + opts.gap + cellW / 2;
    const startY = -gridH / 2 + cellH / 2;

    const cells: Cell[] = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            cells.push({
                x: startX + c * (cellW + opts.gap),
                y: startY + r * (cellH + opts.gap),
                width: cellW,
                height: cellH,
            });
        }
    }
    return cells;
}

function fitCodes(codes: string[], rows: number, cols: number, opts: Required<LayoutOptions>): FitResult {
    const cells = createGrid(rows, cols, opts);
    const cellW = cells[0].width * 0.95;
    const cellH = cells[0].height * 0.95;

    let fontSize = opts.maxFontSize;
    for (let fs = opts.maxFontSize; fs >= opts.minFontSize; fs -= 2) {
        const allFit = codes.every(code => {
            const m = measureCode(code, fs);
            return m.width <= cellW && m.height <= cellH;
        });
        if (allFit) {
            fontSize = fs;
            break;
        }
    }

    return {
        cells,
        fontSize,
        lineHeight: getLineHeight(fontSize),
    };
}

export const GridLayout = {
    quad(codes: string[], options?: LayoutOptions): FitResult {
        return fitCodes(codes, 2, 2, {...DEFAULTS, ...options});
    },

    dual(codes: string[], options?: LayoutOptions): FitResult {
        return fitCodes(codes, 1, 2, {...DEFAULTS, ...options});
    },

    single(code: string, options?: LayoutOptions): FitResult {
        return fitCodes([code], 1, 1, {...DEFAULTS, ...options});
    },

    stack(codes: string[], options?: LayoutOptions): FitResult {
        return fitCodes(codes, codes.length, 1, {...DEFAULTS, ...options});
    },
};
