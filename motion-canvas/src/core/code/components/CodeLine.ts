import {Node, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, Reference, ThreadGenerator} from '@motion-canvas/core';
import {Token} from '../model/Tokenizer';
import {getTokenColor, SyntaxTheme} from '../model/SyntaxTheme';
import {measureText} from '../shared/TextMeasure';
import {Colors} from '../../theme';
import {getWorldPosition, Point} from '../shared/Coordinates';

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
}

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
            const ref = createRef<Txt>();
            const txt = new Txt({
                text: token.text,
                fontFamily: this.config.fontFamily,
                fontSize: this.config.fontSize,
                fill: getTokenColor(token.type, this.config.theme),
                x: xOffset,
                offset: [-1, 0],
            });
            ref(txt);
            container.add(txt);

            this.tokensData.push({
                ref,
                text: token.text,
                localX: xOffset,
            });

            xOffset += measureText(token.text, this.config.fontSize);
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
            }
        }
        if (animations.length > 0) {
            yield* all(...animations);
        }
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
                const offsetBefore = measureText(tokenData.text.substring(0, idx), this.config.fontSize);
                const searchWidth = measureText(search, this.config.fontSize);
                return {
                    localX: tokenData.localX + offsetBefore + searchWidth / 2,
                    width: searchWidth,
                };
            }
        }
        return null;
    }
}



