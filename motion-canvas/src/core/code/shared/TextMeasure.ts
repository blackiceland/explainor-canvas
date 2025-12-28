const MONOSPACE_CHAR_WIDTH_RATIO = 0.6;
const DEFAULT_LINE_HEIGHT_RATIO = 1.7;

export interface TextMetrics {
    width: number;
    height: number;
    lineHeight: number;
}

export function measureChar(fontSize: number): number {
    return fontSize * MONOSPACE_CHAR_WIDTH_RATIO;
}

export function measureText(text: string, fontSize: number): number {
    return text.length * measureChar(fontSize);
}

export function measureCode(code: string, fontSize: number): TextMetrics {
    const lines = code.split('\n');
    const maxLen = Math.max(...lines.map(l => l.length));
    const lineHeight = fontSize * DEFAULT_LINE_HEIGHT_RATIO;
    
    return {
        width: maxLen * measureChar(fontSize),
        height: lines.length * lineHeight,
        lineHeight,
    };
}

export function getCodePaddingX(fontSize: number): number {
    return Math.round(Math.max(24, Math.min(56, fontSize * 2 + 8)));
}

export function getCodePaddingY(fontSize: number): number {
    return Math.round(Math.max(24, Math.min(48, fontSize * 1.5 + 8)));
}

export function getLineHeight(fontSize: number): number {
    return fontSize * DEFAULT_LINE_HEIGHT_RATIO;
}





