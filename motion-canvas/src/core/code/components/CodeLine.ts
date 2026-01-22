import {Node, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, Reference, ThreadGenerator} from '@motion-canvas/core';
import {Token} from '../model/Tokenizer';
import {getTokenColor, SyntaxTheme} from '../model/SyntaxTheme';
import {Colors} from '../../theme';
import {getWorldPosition, Point} from '../shared/Coordinates';
import {textWidth} from '../../utils/textMeasure';

export interface CodeLineConfig {
    tokens: Token[];
    fontSize: number;
    lineHeight: number;
    fontFamily: string;
    theme: SyntaxTheme;
    contentWidth: number;
    leftEdge: number;
}

interface TokenData {
    ref: Reference<Txt>;
    text: string;
    localX: number;
    originalColor: string;
    originalShadowBlur: number;
    originalShadowColor: string;
    originalShadowOffset: [number, number];
}

const LIGATURE_OPERATORS = new Set(['!=', '==', '<=', '>=', '&&', '||', '++', '--', '->', '::']);

export class CodeLine {
    private readonly containerRef: Reference<Node> = createRef<Node>();
    private readonly backgroundRef: Reference<Rect> = createRef<Rect>();
    private readonly tokensData: TokenData[] = [];
    private readonly config: CodeLineConfig;

    constructor(config: CodeLineConfig) {
        this.config = config;
    }

    public build(localY: number): Node {
        const container = new Node({y: localY});
        this.containerRef(container);

        const background = new Rect({
            width: this.config.contentWidth,
            height: this.config.lineHeight * 1.15,
            x: 0,
            y: 0,
            radius: this.config.fontSize * 0.5,
            fill: Colors.surface,
            opacity: 0,
        });
        this.backgroundRef(background);
        container.add(background);

        let xOffset = this.config.leftEdge;
        for (const token of this.config.tokens) {
            // Если токен имеет color (Shiki), используем его напрямую
            const tokenColor = token.color ?? getTokenColor(token.type, this.config.theme);

            if (token.type === 'operator' && LIGATURE_OPERATORS.has(token.text)) {
                for (let i = 0; i < token.text.length; i++) {
                    const ch = token.text[i];
                    const ref = createRef<Txt>();
                    const txt = new Txt({
                        text: ch,
                        fontFamily: this.config.fontFamily,
                        fontSize: this.config.fontSize,
                        fill: tokenColor,
                        x: xOffset,
                        offset: [-1, 0],
                    });
                    ref(txt);
                    container.add(txt);

                    this.tokensData.push({
                        ref,
                        text: i === 0 ? token.text : '',
                        localX: xOffset,
                        originalColor: tokenColor,
                        originalShadowBlur: 0,
                        originalShadowColor: 'rgba(0,0,0,0)',
                        originalShadowOffset: [0, 0],
                    });

                    xOffset += textWidth(ch, this.config.fontFamily, this.config.fontSize);
                }
                continue;
            }

            const ref = createRef<Txt>();
            const txt = new Txt({
                text: token.text,
                fontFamily: this.config.fontFamily,
                fontSize: this.config.fontSize,
                fill: tokenColor,
                x: xOffset,
                offset: [-1, 0],
            });
            ref(txt);
            container.add(txt);

            this.tokensData.push({
                ref,
                text: token.text,
                localX: xOffset,
                originalColor: tokenColor,
                originalShadowBlur: 0,
                originalShadowColor: 'rgba(0,0,0,0)',
                originalShadowOffset: [0, 0],
            });

            xOffset += textWidth(token.text, this.config.fontFamily, this.config.fontSize);
        }

        return container;
    }

    public get node(): Node {
        return this.containerRef();
    }

    public getWorldPosition(): Point {
        return getWorldPosition(this.containerRef());
    }

    public *setOpacity(value: number, duration: number = 0.4): ThreadGenerator {
        yield* this.containerRef().opacity(value, duration, easeInOutCubic);
    }

    public *recolorAll(color: string, duration: number = 0.4): ThreadGenerator {
        const animations: ThreadGenerator[] = [];
        for (const tokenData of this.tokensData) {
            animations.push(tokenData.ref().fill(color, duration, easeInOutCubic));
            animations.push(...this.getGlowAnimations(tokenData, color, duration));
        }
        if (animations.length > 0) {
            yield* all(...animations);
        }
    }

    public *recolorTokens(patterns: string[], color: string, duration: number = 0.4): ThreadGenerator {
        const animations: ThreadGenerator[] = [];
        for (const tokenData of this.tokensData) {
            if (patterns.some(p => tokenData.text.includes(p))) {
                animations.push(tokenData.ref().fill(color, duration, easeInOutCubic));
                animations.push(...this.getGlowAnimations(tokenData, color, duration));
            }
        }
        if (animations.length > 0) {
            yield* all(...animations);
        }
    }

    public *resetColors(duration: number = 0.4): ThreadGenerator {
        const animations: ThreadGenerator[] = [];
        for (const tokenData of this.tokensData) {
            animations.push(tokenData.ref().fill(tokenData.originalColor, duration, easeInOutCubic));
            animations.push(tokenData.ref().shadowBlur(tokenData.originalShadowBlur, duration, easeInOutCubic));
            animations.push(tokenData.ref().shadowColor(tokenData.originalShadowColor, duration, easeInOutCubic));
            animations.push(tokenData.ref().shadowOffset(tokenData.originalShadowOffset, duration, easeInOutCubic));
        }
        if (animations.length > 0) {
            yield* all(...animations);
        }
    }

    public *setAllTokensOpacity(opacity: number, duration: number = 0.4): ThreadGenerator {
        const animations: ThreadGenerator[] = [];
        for (const tokenData of this.tokensData) {
            animations.push(tokenData.ref().opacity(opacity, duration, easeInOutCubic));
        }
        if (animations.length > 0) {
            yield* all(...animations);
        }
    }

    public *setTokensOpacity(patterns: string[], opacity: number, duration: number = 0.4): ThreadGenerator {
        const animations: ThreadGenerator[] = [];
        for (const tokenData of this.tokensData) {
            if (patterns.some(p => tokenData.text.includes(p))) {
                animations.push(tokenData.ref().opacity(opacity, duration, easeInOutCubic));
            }
        }
        if (animations.length > 0) {
            yield* all(...animations);
        }
    }

    public setTokenOpacityAt(index: number, opacity: number): void {
        const resolved = this.resolveTokenIndex(index);
        const token = this.tokensData[resolved];
        if (!token) return;
        token.ref().opacity(opacity);
    }

    public *animateTokenOpacityAt(index: number, opacity: number, duration: number = 0.4): ThreadGenerator {
        const resolved = this.resolveTokenIndex(index);
        const token = this.tokensData[resolved];
        if (!token) return;
        yield* token.ref().opacity(opacity, duration, easeInOutCubic);
    }

    private resolveTokenIndex(index: number): number {
        if (index < 0) {
            return Math.max(0, this.tokensData.length + index);
        }
        return Math.min(index, Math.max(0, this.tokensData.length - 1));
    }


    private getGlowAnimations(tokenData: TokenData, color: string, duration: number): ThreadGenerator[] {
        if (color !== Colors.accent) {
            return [
                tokenData.ref().shadowBlur(tokenData.originalShadowBlur, duration, easeInOutCubic),
                tokenData.ref().shadowColor(tokenData.originalShadowColor, duration, easeInOutCubic),
                tokenData.ref().shadowOffset(tokenData.originalShadowOffset, duration, easeInOutCubic),
            ];
        }

        return [
            tokenData.ref().shadowBlur(8, duration, easeInOutCubic),
            tokenData.ref().shadowColor('rgba(255, 140, 163, 0.30)', duration, easeInOutCubic),
            tokenData.ref().shadowOffset([0, 0], duration, easeInOutCubic),
        ];
    }

    public *showBackground(color: string, duration: number = 0.4): ThreadGenerator {
        yield* all(
            this.backgroundRef().opacity(1, duration, easeInOutCubic),
            this.backgroundRef().fill(color, duration, easeInOutCubic),
        );
    }

    public *hideBackground(duration: number = 0.4): ThreadGenerator {
        yield* this.backgroundRef().opacity(0, duration, easeInOutCubic);
    }

    public hideTokensInstantly(): void {
        for (const tokenData of this.tokensData) {
            tokenData.ref().opacity(0);
        }
    }

    public cloneTokensAsGhost(): Txt[] {
        const clones: Txt[] = [];
        for (const tokenData of this.tokensData) {
            const original = tokenData.ref();
            const clone = new Txt({
                text: original.text(),
                fontFamily: original.fontFamily(),
                fontSize: original.fontSize(),
                fill: original.fill(),
                x: tokenData.localX,
                y: 0,
                offset: [-1, 0],
            });
            clones.push(clone);
        }
        return clones;
    }

    public findToken(search: string): {localX: number; width: number} | null {
        for (const tokenData of this.tokensData) {
            if (tokenData.text.includes(search)) {
                const idx = tokenData.text.indexOf(search);
                const offsetBefore = textWidth(tokenData.text.substring(0, idx), this.config.fontFamily, this.config.fontSize);
                const searchWidth = textWidth(search, this.config.fontFamily, this.config.fontSize);
                return {
                    localX: tokenData.localX + offsetBefore + searchWidth / 2,
                    width: searchWidth,
                };
            }
        }
        return null;
    }
}



