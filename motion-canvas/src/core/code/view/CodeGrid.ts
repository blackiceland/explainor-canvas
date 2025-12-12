import {Node, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, Reference, ThreadGenerator} from '@motion-canvas/core';
import {CodeDocument} from '../model/CodeDocument';
import {tokenizeLine} from '../model/Tokenizer';
import {getTokenColor, SyntaxTheme, IntelliJDarkTheme} from '../model/SyntaxTheme';
import {Position} from '../../types';
import {Colors} from '../../theme';

export interface CodeGridConfig {
    x?: number;
    y?: number;
    width?: number;
    fontSize?: number;
    lineHeight?: number;
    fontFamily?: string;
    theme?: SyntaxTheme;
}

export interface CodeAnchor {
    readonly x: number;
    readonly y: number;
}

export interface TokenAnchor extends CodeAnchor {
    readonly width: number;
    readonly text: string;
}

interface LineData {
    container: Reference<Node>;
    tokens: Reference<Txt>[];
    tokenTexts: string[];
    localY: number;
    background: Reference<Rect> | null;
}

const MONOSPACE_CHAR_WIDTH_RATIO = 0.6;

export class CodeGrid {
    private readonly containerRef = createRef<Node>();
    private readonly linesData: LineData[] = [];
    private readonly document: CodeDocument;
    private readonly config: Required<Omit<CodeGridConfig, 'theme'>> & {theme: SyntaxTheme};
    private mounted = false;

    private constructor(document: CodeDocument, config: CodeGridConfig) {
        this.document = document;
        this.config = {
            x: config.x ?? 0,
            y: config.y ?? 0,
            width: config.width ?? 600,
            fontSize: config.fontSize ?? 20,
            lineHeight: config.lineHeight ?? (config.fontSize ?? 20) * 1.5,
            fontFamily: config.fontFamily ?? 'JetBrains Mono, monospace',
            theme: config.theme ?? IntelliJDarkTheme,
        };
    }

    private getPadding(): number {
        return this.config.fontSize * 2.0;
    }

    private getContentLeftEdge(): number {
        const padding = this.getPadding();
        const contentWidth = Math.max(this.config.width - padding * 2, 0);
        return -contentWidth / 2;
    }

    public static create(document: CodeDocument, config: CodeGridConfig = {}): CodeGrid {
        return new CodeGrid(document, config);
    }

    public static fromCode(code: string, config: CodeGridConfig = {}): CodeGrid {
        return new CodeGrid(CodeDocument.from(code), config);
    }

    public static fromCodeAt(code: string, position: Position, config: Omit<CodeGridConfig, 'x' | 'y'> = {}): CodeGrid {
        return new CodeGrid(CodeDocument.from(code), {...config, x: position.x, y: position.y});
    }

    public mount(parent: Node): void {
        const container = new Node({
            x: this.config.x,
            y: this.config.y,
            opacity: 0,
        });
        this.containerRef(container);

        const lineCount = this.document.lineCount;
        const centerOffset = (lineCount - 1) / 2;
        const leftEdge = this.getContentLeftEdge();

        const padding = this.getPadding();
        const cardWidth = this.config.width;
        const cardHeight = lineCount * this.config.lineHeight + padding * 2;
        const contentWidth = Math.max(cardWidth - padding * 2, 0);

        const card = new Rect({
            width: cardWidth,
            height: cardHeight,
            radius: 28,
            fill: Colors.surface,
            // "Бархатный" кант: едва заметная белая обводка
            stroke: 'rgba(255, 255, 255, 0.03)', 
            lineWidth: 2,
            shadowColor: 'rgba(0,0,0,0.28)',
            shadowBlur: 74,
            shadowOffset: [0, 22],
        });
        container.add(card);

        for (let i = 0; i < lineCount; i++) {
            const lineText = this.document.getLine(i) ?? '';
            const tokens = tokenizeLine(lineText);
            const localY = (i - centerOffset) * this.config.lineHeight;

            const lineContainer = new Node({y: localY});
            const lineContainerRef = createRef<Node>();
            lineContainerRef(lineContainer);

            const backgroundRef = createRef<Rect>();
            const highlightWidth = contentWidth;
            const highlightX = 0;
            const background = new Rect({
                width: highlightWidth,
                height: this.config.lineHeight * 1.15,
                x: highlightX,
                y: 0,
                radius: this.config.fontSize * 0.5,
                fill: Colors.surface,
                opacity: 0,
            });
            backgroundRef(background);
            lineContainer.add(background);

            const tokenRefs: Reference<Txt>[] = [];
            const tokenTexts: string[] = [];
            let xOffset = leftEdge;

            for (const token of tokens) {
                const ref = createRef<Txt>();
                tokenRefs.push(ref);
                tokenTexts.push(token.text);

                const txt = new Txt({
                    text: token.text,
                    fontFamily: this.config.fontFamily,
                    fontSize: this.config.fontSize,
                    fill: getTokenColor(token.type, this.config.theme),
                    x: xOffset,
                    offset: [-1, 0],
                });
                ref(txt);
                lineContainer.add(txt);

                xOffset += this.measureText(token.text);
            }

            this.linesData.push({
                container: lineContainerRef,
                tokens: tokenRefs,
                tokenTexts,
                localY,
                background: backgroundRef,
            });
            container.add(lineContainer);
        }

        parent.add(container);
        this.mounted = true;
    }

    private measureText(text: string): number {
        return text.length * this.config.fontSize * MONOSPACE_CHAR_WIDTH_RATIO;
    }

    private getContainerPosition(): {x: number; y: number} {
        if (!this.mounted) {
            return {x: this.config.x, y: this.config.y};
        }
        const pos = this.containerRef().position();
        return {x: pos.x, y: pos.y};
    }

    private getLocalY(line: number): number {
        if (line < 0 || line >= this.linesData.length) {
            return 0;
        }
        return this.linesData[line].localY;
    }

    private getScale(): number {
        if (!this.mounted) {
            return 1;
        }
        return this.containerRef().scale().x;
    }

    public getAnchor(line: number): CodeAnchor {
        const containerPos = this.getContainerPosition();
        const localY = this.getLocalY(line);
        const scale = this.getScale();

        return {
            x: containerPos.x,
            y: containerPos.y + localY * scale,
        };
    }

    public findToken(line: number, search: string): TokenAnchor | null {
        if (line < 0 || line >= this.linesData.length) {
            return null;
        }

        const lineData = this.linesData[line];
        const containerPos = this.getContainerPosition();
        const scale = this.getScale();
        const leftEdge = this.getContentLeftEdge();

        let xOffset = leftEdge;
        for (let i = 0; i < lineData.tokenTexts.length; i++) {
            const text = lineData.tokenTexts[i];
            const tokenWidth = this.measureText(text);

            if (text.includes(search)) {
                const indexInToken = text.indexOf(search);
                const searchWidth = this.measureText(search);
                const localX = xOffset + this.measureText(text.substring(0, indexInToken)) + searchWidth / 2;

                return {
                    x: containerPos.x + localX * scale,
                    y: containerPos.y + lineData.localY * scale,
                    width: searchWidth * scale,
                    text: search,
                };
            }

            xOffset += tokenWidth;
        }

        return null;
    }

    public getPosition(): CodeAnchor {
        const pos = this.getContainerPosition();
        return {x: pos.x, y: pos.y};
    }

    public container(): Node {
        return this.containerRef();
    }

    public *appear(duration: number = 0.6): ThreadGenerator {
        yield* this.containerRef().opacity(1, duration, easeInOutCubic);
    }

    public *disappear(duration: number = 0.6): ThreadGenerator {
        yield* this.containerRef().opacity(0, duration, easeInOutCubic);
    }

    public *moveTo(x: number, y: number, duration: number = 1): ThreadGenerator {
        yield* this.containerRef().position([x, y], duration, easeInOutCubic);
    }

    public *moveToPosition(position: Position, duration: number = 1): ThreadGenerator {
        yield* this.moveTo(position.x, position.y, duration);
    }

    public *flyTo(target: CodeAnchor, duration: number = 1): ThreadGenerator {
        yield* this.containerRef().position([target.x, target.y], duration, easeInOutCubic);
    }

    public *shiftLines(startIndex: number, delta: number, duration: number = 0.4): ThreadGenerator {
        const animations: ThreadGenerator[] = [];
        for (let i = startIndex; i < this.linesData.length; i++) {
            const line = this.linesData[i];
            const newY = line.localY + delta;
            line.localY = newY;
            animations.push(line.container().y(newY, duration, easeInOutCubic));
        }
        if (animations.length > 0) {
            yield* all(...animations);
        }
    }

    public *scale(factor: number, duration: number = 0.5): ThreadGenerator {
        yield* this.containerRef().scale(factor, duration, easeInOutCubic);
    }

    public *highlight(from: number, to: number, duration: number = 0.4): ThreadGenerator {
        yield* this.highlightRanges([[from, to]], duration);
    }

    public *highlightRanges(ranges: [number, number][], duration: number = 0.4): ThreadGenerator {
        const animations: ThreadGenerator[] = [];
        for (let i = 0; i < this.linesData.length; i++) {
            const inRange = ranges.some(([from, to]) => i >= from && i <= to);
            animations.push(this.linesData[i].container().opacity(inRange ? 1 : 0.25, duration));
        }
        yield* all(...animations);
    }

    public *dim(from: number, to: number, opacity: number = 0.25, duration: number = 0.4): ThreadGenerator {
        const animations: ThreadGenerator[] = [];
        for (let i = from; i <= to && i < this.linesData.length; i++) {
            animations.push(this.linesData[i].container().opacity(opacity, duration));
        }
        yield* all(...animations);
    }

    public *dimAll(opacity: number = 0.25, duration: number = 0.4): ThreadGenerator {
        yield* all(...this.linesData.map(line => line.container().opacity(opacity, duration)));
    }

    public *hideRanges(ranges: [number, number][], duration: number = 0.4): ThreadGenerator {
        const animations: ThreadGenerator[] = [];
        for (let i = 0; i < this.linesData.length; i++) {
            if (ranges.some(([from, to]) => i >= from && i <= to)) {
                animations.push(this.linesData[i].container().opacity(0, duration));
            }
        }
        yield* all(...animations);
    }

    public *showAll(duration: number = 0.4): ThreadGenerator {
        yield* all(...this.linesData.map(line => line.container().opacity(1, duration)));
    }

    public *hideAllExceptTokens(line: number, tokensToKeep: string[], duration: number = 0.4): ThreadGenerator {
        const animations: ThreadGenerator[] = [];

        for (let i = 0; i < this.linesData.length; i++) {
            const lineData = this.linesData[i];

            if (i === line) {
                for (let j = 0; j < lineData.tokens.length; j++) {
                    const tokenRef = lineData.tokens[j];
                    const tokenText = lineData.tokenTexts[j];
                    const shouldKeep = tokensToKeep.some(t => tokenText.includes(t));
                    if (!shouldKeep) {
                        animations.push(tokenRef().opacity(0, duration));
                    }
                }
            } else {
                animations.push(lineData.container().opacity(0, duration));
            }
        }

        yield* all(...animations);
    }

    public *collapseTokensTo(line: number, anchorToken: string, tokensToCollapse: string[], duration: number = 0.4): ThreadGenerator {
        const lineData = this.linesData[line];
        if (!lineData) return;

        const animations: ThreadGenerator[] = [];
        let anchorX: number | null = null;
        const leftEdge = this.getContentLeftEdge();
        let xOffset = leftEdge;

        for (let j = 0; j < lineData.tokens.length; j++) {
            const tokenText = lineData.tokenTexts[j];
            const tokenWidth = this.measureText(tokenText);

            if (tokenText.includes(anchorToken)) {
                anchorX = xOffset + tokenWidth;
            }
            xOffset += tokenWidth;
        }

        if (anchorX === null) return;

        let currentX = anchorX;
        let foundAnchor = false;
        xOffset = leftEdge;

        for (let j = 0; j < lineData.tokens.length; j++) {
            const tokenRef = lineData.tokens[j];
            const tokenText = lineData.tokenTexts[j];
            const tokenWidth = this.measureText(tokenText);

            if (tokenText.includes(anchorToken)) {
                foundAnchor = true;
                currentX = xOffset + tokenWidth;
            } else if (foundAnchor) {
                const shouldCollapse = tokensToCollapse.some(t => tokenText.includes(t));
                if (shouldCollapse) {
                    continue;
                }
                animations.push(tokenRef().x(currentX, duration, easeInOutCubic));
                currentX += tokenWidth;
            }
            xOffset += tokenWidth;
        }

        if (animations.length > 0) {
            yield* all(...animations);
        }
    }

    public *recolor(line: number, searchPatterns: string[], color: string, duration: number = 0.4): ThreadGenerator {
        const lineData = this.linesData[line];
        if (!lineData) return;

        const animations: ThreadGenerator[] = [];
        for (let j = 0; j < lineData.tokens.length; j++) {
            const tokenRef = lineData.tokens[j];
            const tokenText = lineData.tokenTexts[j];

            if (searchPatterns.some(p => tokenText.includes(p))) {
                 animations.push(tokenRef().fill(color, duration, easeInOutCubic));
            }
        }
        if (animations.length > 0) {
            yield* all(...animations);
        }
    }

    public *recolorLine(line: number, color: string, duration: number = 0.4): ThreadGenerator {
        const lineData = this.linesData[line];
        if (!lineData) return;

        const animations: ThreadGenerator[] = [];
        for (let j = 0; j < lineData.tokens.length; j++) {
            const tokenRef = lineData.tokens[j];
            animations.push(tokenRef().fill(color, duration, easeInOutCubic));
        }
        if (animations.length > 0) {
            yield* all(...animations);
        }
    }

    public *highlightLineBackground(line: number, backgroundColor: string, textColor: string, duration: number = 0.4): ThreadGenerator {
        const lineData = this.linesData[line];
        if (!lineData || !lineData.background) return;

        const animations: ThreadGenerator[] = [];
        animations.push(lineData.background().opacity(1, duration, easeInOutCubic));
        animations.push(lineData.background().fill(backgroundColor, duration, easeInOutCubic));

        for (let j = 0; j < lineData.tokens.length; j++) {
            const tokenRef = lineData.tokens[j];
            animations.push(tokenRef().fill(textColor, duration, easeInOutCubic));
        }

        if (animations.length > 0) {
            yield* all(...animations);
        }
    }

    public extract(from: number, to: number): CodeGrid {
        const slicedDoc = this.document.slice(from, to);
        const fromAnchor = this.getAnchor(from);
        const newCenterOffset = (slicedDoc.lineCount - 1) / 2;
        const newCenterY = fromAnchor.y + newCenterOffset * this.config.lineHeight;

        return CodeGrid.create(slicedDoc, {
            x: fromAnchor.x,
            y: newCenterY,
            width: this.config.width,
            fontSize: this.config.fontSize,
            lineHeight: this.config.lineHeight,
            fontFamily: this.config.fontFamily,
            theme: this.config.theme,
        });
    }

    public clone(): CodeGrid {
        const pos = this.getPosition();
        return CodeGrid.create(this.document, {
            x: pos.x,
            y: pos.y,
            width: this.config.width,
            fontSize: this.config.fontSize,
            lineHeight: this.config.lineHeight,
            fontFamily: this.config.fontFamily,
            theme: this.config.theme,
        });
    }

    public get x(): number {
        return this.getContainerPosition().x;
    }

    public get y(): number {
        return this.getContainerPosition().y;
    }

    public get width(): number {
        return this.config.width;
    }

    public get lineCount(): number {
        return this.document.lineCount;
    }

    public get lineHeight(): number {
        return this.config.lineHeight;
    }

    public get fontSize(): number {
        return this.config.fontSize;
    }

    public get fontFamily(): string {
        return this.config.fontFamily;
    }

    public get theme(): SyntaxTheme {
        return this.config.theme;
    }
}
