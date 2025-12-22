import {Node} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, Reference, ThreadGenerator} from '@motion-canvas/core';
import {CodeDocument} from '../model/CodeDocument';
import {tokenizeLine} from '../model/Tokenizer';
import {SyntaxTheme, IntelliJDarkTheme} from '../model/SyntaxTheme';
import {CodeCard, CodeCardStyle} from './CodeCard';
import {CodeLine} from './CodeLine';
import {getLineHeight} from '../shared/TextMeasure';
import {getWorldPosition, Point} from '../shared/Coordinates';
import {Fonts} from '../../theme';

export interface CodeBlockConfig {
    x?: number;
    y?: number;
    width?: number;
    fontSize?: number;
    lineHeight?: number;
    fontFamily?: string;
    theme?: SyntaxTheme;
    cardStyle?: CodeCardStyle;
    customTypes?: string[];  // Классы/типы для подсветки как type
}

export interface CodeBlockPosition {
    readonly x: number;
    readonly y: number;
}

export interface LineGhostData {
    node: Node;
    originWorld: Point;
}

export class CodeBlock {
    private readonly containerRef: Reference<Node> = createRef<Node>();
    private readonly lines: CodeLine[] = [];
    private readonly document: CodeDocument;
    private readonly config: Required<CodeBlockConfig>;
    private card: CodeCard | null = null;
    private mounted = false;

    private constructor(document: CodeDocument, config: CodeBlockConfig) {
        this.document = document;
        const fontSize = config.fontSize ?? 20;
        this.config = {
            x: config.x ?? 0,
            y: config.y ?? 0,
            width: config.width ?? 600,
            fontSize,
            lineHeight: config.lineHeight ?? getLineHeight(fontSize),
            fontFamily: config.fontFamily ?? Fonts.code,
            theme: config.theme ?? IntelliJDarkTheme,
            cardStyle: config.cardStyle ?? {},
            customTypes: config.customTypes ?? [],
        };
    }

    public static fromCode(code: string, config: CodeBlockConfig = {}): CodeBlock {
        return new CodeBlock(CodeDocument.from(code), config);
    }

    public static fromDocument(document: CodeDocument, config: CodeBlockConfig = {}): CodeBlock {
        return new CodeBlock(document, config);
    }

    private getPadding(): number {
        return this.config.fontSize * 2.0;
    }

    private getContentLeftEdge(): number {
        const padding = this.getPadding();
        const contentWidth = Math.max(this.config.width - padding * 2, 0);
        return -contentWidth / 2;
    }

    public mount(parent: Node): void {
        if (this.mounted) return;

        const container = new Node({
            x: this.config.x,
            y: this.config.y,
            opacity: 0,
        });
        this.containerRef(container);

        const lineCount = this.document.lineCount;
        const padding = this.getPadding();
        const cardWidth = this.config.width;
        const cardHeight = lineCount * this.config.lineHeight + padding * 2;
        const contentWidth = Math.max(cardWidth - padding * 2, 0);

        this.card = new CodeCard({width: cardWidth, height: cardHeight, style: this.config.cardStyle});
        container.add(this.card.build());

        const centerOffset = (lineCount - 1) / 2;
        const leftEdge = this.getContentLeftEdge();

        for (let i = 0; i < lineCount; i++) {
            const lineText = this.document.getLine(i) ?? '';
            const tokens = tokenizeLine(lineText, this.config.customTypes);
            const localY = (i - centerOffset) * this.config.lineHeight;

            const codeLine = new CodeLine({
                tokens,
                fontSize: this.config.fontSize,
                lineHeight: this.config.lineHeight,
                fontFamily: this.config.fontFamily,
                theme: this.config.theme,
                contentWidth,
                leftEdge,
            });

            container.add(codeLine.build(localY));
            this.lines.push(codeLine);
        }

        parent.add(container);
        this.mounted = true;
    }

    public get node(): Node {
        return this.containerRef();
    }

    public getLine(index: number): CodeLine | null {
        return this.lines[index] ?? null;
    }

    public getPosition(): CodeBlockPosition {
        if (!this.mounted) {
            return {x: this.config.x, y: this.config.y};
        }
        return getWorldPosition(this.containerRef());
    }

    public getLineWorldPosition(lineIndex: number): Point | null {
        const line = this.lines[lineIndex];
        if (!line) return null;
        return line.getWorldPosition();
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

    public *flyTo(target: Point, duration: number = 1): ThreadGenerator {
        yield* this.containerRef().position([target.x, target.y], duration, easeInOutCubic);
    }

    public *highlightLines(ranges: [number, number][], duration: number = 0.4): ThreadGenerator {
        const animations: ThreadGenerator[] = [];
        for (let i = 0; i < this.lines.length; i++) {
            const inRange = ranges.some(([from, to]) => i >= from && i <= to);
            animations.push(this.lines[i].setOpacity(inRange ? 1 : 0.25, duration));
        }
        yield* all(...animations);
    }

    public *dimLines(from: number, to: number, opacity: number = 0.25, duration: number = 0.4): ThreadGenerator {
        const animations: ThreadGenerator[] = [];
        for (let i = from; i <= to && i < this.lines.length; i++) {
            animations.push(this.lines[i].setOpacity(opacity, duration));
        }
        yield* all(...animations);
    }

    public *hideLines(ranges: [number, number][], duration: number = 0.4): ThreadGenerator {
        const animations: ThreadGenerator[] = [];
        for (let i = 0; i < this.lines.length; i++) {
            if (ranges.some(([from, to]) => i >= from && i <= to)) {
                animations.push(this.lines[i].setOpacity(0, duration));
            }
        }
        yield* all(...animations);
    }

    public *showAllLines(duration: number = 0.4): ThreadGenerator {
        yield* all(...this.lines.map(line => line.setOpacity(1, duration)));
    }

    public *recolorLine(lineIndex: number, color: string, duration: number = 0.4): ThreadGenerator {
        const line = this.lines[lineIndex];
        if (line) {
            yield* line.recolorAll(color, duration);
        }
    }

    public *recolorTokens(lineIndex: number, patterns: string[], color: string, duration: number = 0.4): ThreadGenerator {
        const line = this.lines[lineIndex];
        if (line) {
            yield* line.recolorTokens(patterns, color, duration);
        }
    }

    public hideAllTokens(): void {
        for (const line of this.lines) {
            line.hideTokensInstantly();
        }
    }

    public buildLineGhost(lineIndex: number): LineGhostData | null {
        const line = this.lines[lineIndex];
        if (!line) return null;

        const originWorld = line.getWorldPosition();

        const group = new Node({opacity: 0});

        const clones = line.cloneTokensAsGhost();
        for (const clone of clones) {
            group.add(clone);
        }

        return {node: group, originWorld};
    }

    public get lineCount(): number {
        return this.document.lineCount;
    }

    public get width(): number {
        return this.config.width;
    }

    public get fontSize(): number {
        return this.config.fontSize;
    }

    public get lineHeight(): number {
        return this.config.lineHeight;
    }

    public get fontFamily(): string {
        return this.config.fontFamily;
    }

    public get theme(): SyntaxTheme {
        return this.config.theme;
    }
}
