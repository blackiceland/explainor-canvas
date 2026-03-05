import {Code, lines, Rect, View2D} from '@motion-canvas/2d';
import {easeInOutCubic, ThreadGenerator} from '@motion-canvas/core';
import {SyntaxTheme, getTokenColor} from '../model/SyntaxTheme';
import {tokenizeLine} from '../model/Tokenizer';
import {Fonts} from '../../theme';

export const PosterTheme: SyntaxTheme = {
    keyword: '#C586E0',
    type: '#82AAFF',
    string: '#8DC891',
    number: '#82AAFF',
    operator: '#7A7E88',
    punctuation: '#7A7E88',
    method: '#82AAFF',
    comment: '#546E7A',
    annotation: '#C586E0',
    constant: '#82AAFF',
    plain: '#BFC3CC',
};

export interface CodePosterConfig {
    fontSize?: number;
    lineHeight?: number;
    fontFamily?: string;
    theme?: SyntaxTheme;
    bg?: string;
    customTypes?: string[];
}

const DEFAULT_FONT_SIZE = 48;
const DEFAULT_LINE_HEIGHT = 90;
const DEFAULT_BG = '#121212';

export class CodePoster {
    private codeNode: Code | null = null;
    private bgNode: Rect | null = null;
    private readonly config: Required<Pick<CodePosterConfig, 'fontSize' | 'lineHeight' | 'fontFamily' | 'bg'>> & {theme: SyntaxTheme; customTypes: string[]};

    private constructor(
        private readonly source: string,
        cfg: CodePosterConfig,
    ) {
        this.config = {
            fontSize: cfg.fontSize ?? DEFAULT_FONT_SIZE,
            lineHeight: cfg.lineHeight ?? DEFAULT_LINE_HEIGHT,
            fontFamily: cfg.fontFamily ?? Fonts.code,
            theme: cfg.theme ?? PosterTheme,
            bg: cfg.bg ?? DEFAULT_BG,
            customTypes: cfg.customTypes ?? [],
        };
    }

    static create(source: string, cfg: CodePosterConfig = {}): CodePoster {
        return new CodePoster(source, cfg);
    }

    mount(view: View2D): void {
        const {fontSize, lineHeight, fontFamily, bg, theme, customTypes} = this.config;

        const drawHooks = {
            token: (
                ctx: CanvasRenderingContext2D,
                text: string,
                position: {x: number; y: number},
            ) => {
                const raw = String(text ?? '');
                let x = position.x;
                const y = position.y;

                const tokens = tokenizeLine(raw, customTypes);

                for (const tok of tokens) {
                    const color = getTokenColor(tok.type, theme);
                    ctx.fillStyle = color;
                    ctx.fillText(tok.text, x, y);
                    x += ctx.measureText(tok.text).width;
                }
            },
        };

        this.bgNode = new Rect({
            width: 1920,
            height: 1080,
            fill: bg,
        });

        this.codeNode = new Code({
            code: this.source,
            fontFamily,
            fontSize,
            lineHeight,
            opacity: 0,
            selection: lines(0, Infinity),
            drawHooks,
        });

        view.add(this.bgNode);
        view.add(this.codeNode);
    }

    *fadeIn(duration = 0.5): ThreadGenerator {
        yield* this.codeNode!.opacity(1, duration, easeInOutCubic);
    }

    *fadeOut(duration = 0.4): ThreadGenerator {
        yield* this.codeNode!.opacity(0, duration, easeInOutCubic);
    }

    get code(): Code {
        return this.codeNode!;
    }

    get background(): Rect {
        return this.bgNode!;
    }
}
