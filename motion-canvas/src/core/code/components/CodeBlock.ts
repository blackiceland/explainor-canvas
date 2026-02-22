import {Node, Rect} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, Reference, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {CodeDocument} from '../model/CodeDocument';
import {tokenizeLine} from '../model/Tokenizer';
import {SyntaxTheme, IntelliJDarkTheme} from '../model/SyntaxTheme';
import {CodeCard, CodeCardStyle} from './CodeCard';
import {CodeLine} from './CodeLine';
import {getCodePaddingX, getCodePaddingY, getLineHeight} from '../shared/TextMeasure';
import {getWorldPosition, Point} from '../shared/Coordinates';
import {Fonts} from '../../theme';

export interface CodeBlockConfig {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    fontSize?: number;
    lineHeight?: number;
    fontFamily?: string;
    theme?: SyntaxTheme;
    cardStyle?: CodeCardStyle;
    customTypes?: string[];
    contentOffsetX?: number;
    contentOffsetY?: number;
    glowAccent?: boolean;
}

export interface CodeBlockPosition {
    readonly x: number;
    readonly y: number;
}

export interface LineGhostData {
    node: Node;
    originWorld: Point;
}

export interface LineLayout {
    y: number;
    opacity: number;
}

export interface InsertLinesOptions {
    expandDuration?: number;
    typewriter?: boolean;
    charDelay?: number;
    lineDelay?: number;
    extraColorRules?: ColorRule[];
}

export interface ColorRule {
    match: string | RegExp;
    color: string;
}

export class CodeBlock {
    private readonly containerRef: Reference<Node> = createRef<Node>();
    private readonly contentRef: Reference<Node> = createRef<Node>();
    private readonly lines: CodeLine[] = [];
    private readonly document: CodeDocument;
    private readonly config: Required<CodeBlockConfig>;
    private card: CodeCard | null = null;
    private mounted = false;

    private mountedContentWidth = 0;
    private mountedLeftEdge = 0;
    private mountedStartY = 0;
    private savedColorRules: ColorRule[] = [];

    private constructor(document: CodeDocument, config: CodeBlockConfig) {
        this.document = document;
        const fontSize = config.fontSize ?? 20;
        this.config = {
            x: config.x ?? 0,
            y: config.y ?? 0,
            width: config.width ?? 600,
            height: config.height ?? 0,
            fontSize,
            lineHeight: config.lineHeight ?? getLineHeight(fontSize),
            fontFamily: config.fontFamily ?? Fonts.code,
            theme: config.theme ?? IntelliJDarkTheme,
            cardStyle: config.cardStyle ?? {},
            customTypes: config.customTypes ?? [],
            contentOffsetX: config.contentOffsetX ?? 0,
            contentOffsetY: config.contentOffsetY ?? 0,
            glowAccent: config.glowAccent ?? true,
        };
    }

    public static fromCode(code: string, config: CodeBlockConfig = {}): CodeBlock {
        return new CodeBlock(CodeDocument.from(code), config);
    }

    public static fromDocument(document: CodeDocument, config: CodeBlockConfig = {}): CodeBlock {
        return new CodeBlock(document, config);
    }

    private getPaddingX(): number {
        return getCodePaddingX(this.config.fontSize);
    }

    private getPaddingY(): number {
        return getCodePaddingY(this.config.fontSize);
    }

    public getContentLeftEdge(): number {
        const paddingX = this.getPaddingX();
        const contentWidth = Math.max(this.config.width - paddingX * 2, 0);
        return -contentWidth / 2 + this.config.contentOffsetX;
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
        const paddingX = this.getPaddingX();
        const paddingY = this.getPaddingY();
        const cardWidth = this.config.width;
        const contentHeight = lineCount * this.config.lineHeight + paddingY * 2;
        const cardHeight = this.config.height > 0 ? this.config.height : contentHeight;
        const contentWidth = Math.max(cardWidth - paddingX * 2, 0);

        this.card = new CodeCard({width: cardWidth, height: cardHeight, style: this.config.cardStyle});
        const cardNode = this.card.build();
        container.add(cardNode);

        const clipHeight = Math.max(0, cardHeight - paddingY * 2);
        const clipContainer = new Rect({
            width: contentWidth,
            height: clipHeight,
            radius: 0,
            fill: '#00000000',
            clip: true,
        });
        container.add(clipContainer);

        const contentContainer = new Node({y: 0});
        this.contentRef(contentContainer);
        clipContainer.add(contentContainer);

        const leftEdge = this.getContentLeftEdge();
        const shouldTopAlign = this.config.height > 0 && cardHeight !== contentHeight;
        const topAlignedStartY = -clipHeight / 2 + this.config.contentOffsetY + this.config.lineHeight / 2;
        const centerAlignedStartY = -((lineCount - 1) / 2) * this.config.lineHeight;
        const startY = shouldTopAlign ? topAlignedStartY : centerAlignedStartY;

        this.mountedContentWidth = contentWidth;
        this.mountedLeftEdge = leftEdge;
        this.mountedStartY = startY;

        for (let i = 0; i < lineCount; i++) {
            const lineText = this.document.getLine(i) ?? '';
            const tokens = tokenizeLine(lineText, this.config.customTypes);
            const localY = startY + i * this.config.lineHeight;

            const codeLine = new CodeLine({
                tokens,
                fontSize: this.config.fontSize,
                lineHeight: this.config.lineHeight,
                fontFamily: this.config.fontFamily,
                theme: this.config.theme,
                contentWidth,
                leftEdge,
                glowAccent: this.config.glowAccent,
            });

            contentContainer.add(codeLine.build(localY));
            this.lines.push(codeLine);
        }

        parent.add(container);
        this.mounted = true;
    }

    public get node(): Node {
        return this.containerRef();
    }

    public get cardRect(): Rect | null {
        return this.card?.node ?? null;
    }

    public getContentContainer(): Node {
        return this.contentRef();
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

    public *resetLineColors(lineIndex: number, duration: number = 0.4): ThreadGenerator {
        const line = this.lines[lineIndex];
        if (line) {
            yield* line.resetColors(duration);
        }
    }

    public *setLineTokensOpacity(lineIndex: number, opacity: number, duration: number = 0.4): ThreadGenerator {
        const line = this.lines[lineIndex];
        if (line) {
            yield* line.setAllTokensOpacity(opacity, duration);
        }
    }

    public *setLineTokensOpacityMatching(
        lineIndex: number,
        patterns: string[],
        opacity: number,
        duration: number = 0.4,
    ): ThreadGenerator {
        const line = this.lines[lineIndex];
        if (line) {
            yield* line.setTokensOpacity(patterns, opacity, duration);
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
        return this.lines.length;
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

    public getLineLayouts(): LineLayout[] {
        return this.lines.map(line => ({
            y: line.node.y(),
            opacity: line.node.opacity(),
        }));
    }

    public setLinePosition(lineIndex: number, y: number): void {
        const line = this.lines[lineIndex];
        if (!line) return;
        line.node.y(y);
    }

    public setLineOpacity(lineIndex: number, opacity: number): void {
        const line = this.lines[lineIndex];
        if (!line) return;
        line.node.opacity(opacity);
    }

    /** Мгновенно скрывает все токены строки (opacity=0). */
    public hideLineTokens(lineIndex: number): void {
        const line = this.lines[lineIndex];
        if (line) line.hideTokensInstantly();
    }

    public getLineTokenCount(lineIndex: number): number {
        const line = this.lines[lineIndex];
        return line ? line.tokenCount : 0;
    }

    /** Посимвольный typewriter для строки — символ за символом с подсветкой. */
    public *typewriterLine(lineIndex: number, charDelay: number = 0.024): ThreadGenerator {
        const line = this.lines[lineIndex];
        if (!line) return;
        yield* line.typewriter(charDelay);
    }

    public setTokenOpacityAt(lineIndex: number, tokenIndex: number, opacity: number): void {
        const line = this.lines[lineIndex];
        if (!line) return;
        line.setTokenOpacityAt(tokenIndex, opacity);
    }

    public *animateTokenOpacityAt(lineIndex: number, tokenIndex: number, opacity: number, duration: number = 0.4): ThreadGenerator {
        const line = this.lines[lineIndex];
        if (!line) return;
        yield* line.animateTokenOpacityAt(tokenIndex, opacity, duration);
    }

    /** Вставляет строки кода после указанной позиции с анимацией раздвижки и typewriter.
     *  afterLine — индекс строки, после которой вставляем (-1 = в начало).
     *  code — строка или массив строк для вставки. */
    public *insertLinesAt(
        afterLine: number,
        code: string | string[],
        opts: InsertLinesOptions = {},
    ): ThreadGenerator {
        if (!this.mounted) return;

        const {
            expandDuration = 0.6,
            typewriter = true,
            charDelay = 0.024,
            lineDelay = 0.08,
            extraColorRules = [],
        } = opts;

        const codeLines = typeof code === 'string' ? code.split('\n') : code;
        const insertAt = afterLine + 1;
        const count = codeLines.length;
        const lh = this.config.lineHeight;
        const content = this.contentRef();

        const newCodeLines: CodeLine[] = [];
        for (const lineText of codeLines) {
            const tokens = tokenizeLine(lineText, this.config.customTypes);
            const codeLine = new CodeLine({
                tokens,
                fontSize: this.config.fontSize,
                lineHeight: this.config.lineHeight,
                fontFamily: this.config.fontFamily,
                theme: this.config.theme,
                contentWidth: this.mountedContentWidth,
                leftEdge: this.mountedLeftEdge,
                glowAccent: this.config.glowAccent,
            });

            const targetY = this.lines[insertAt]?.node.y()
                ?? (this.lines.length > 0
                    ? this.lines[this.lines.length - 1].node.y() + lh
                    : this.mountedStartY);

            const node = codeLine.build(targetY);
            node.opacity(0);
            codeLine.hideTokensInstantly();
            content.add(node);
            newCodeLines.push(codeLine);
        }

        this.lines.splice(insertAt, 0, ...newCodeLines);
        this.document.lines.splice(insertAt, 0, ...codeLines);

        const allRules = [...this.savedColorRules, ...extraColorRules];
        if (allRules.length > 0) {
            for (const line of newCodeLines) {
                for (const rule of allRules) {
                    line.colorizeByRule(rule.match, rule.color);
                }
            }
        }

        const expandAnims: ThreadGenerator[] = [];
        for (let i = insertAt + count; i < this.lines.length; i++) {
            const currentY = this.lines[i].node.y();
            expandAnims.push(this.lines[i].node.y(currentY + count * lh, expandDuration, easeInOutCubic));
        }
        for (let i = 0; i < count; i++) {
            const targetY = (this.lines[insertAt > 0 ? insertAt - 1 : 0]?.node.y() ?? this.mountedStartY)
                + (insertAt > 0 ? (i + 1) : i) * lh;
            expandAnims.push(newCodeLines[i].node.y(targetY, expandDuration, easeInOutCubic));
            expandAnims.push(newCodeLines[i].node.opacity(1, expandDuration, easeInOutCubic));
        }
        if (expandAnims.length > 0) yield* all(...expandAnims);

        if (typewriter) {
            for (let i = 0; i < count; i++) {
                yield* this.typewriterLine(insertAt + i, charDelay);
                if (i < count - 1 && lineDelay > 0) yield* waitFor(lineDelay);
            }
        } else {
            for (let i = 0; i < count; i++) {
                this.lines[insertAt + i].showTokensInstantly();
            }
        }
    }

    /** Заменяет текст токена в строке с анимацией fade-out / fade-in.
     *  Находит первый токен, содержащий oldText, и заменяет его на newText. */
    public *replaceInLine(
        lineIndex: number,
        oldText: string,
        newText: string,
        charDelay: number = 0.03,
        highlightColor: string | null = 'rgba(255, 120, 100, 0.95)',
    ): ThreadGenerator {
        const line = this.lines[lineIndex];
        if (!line) return;
        yield* line.replaceToken(oldText, newText, charDelay, highlightColor);

        const docLine = this.document.lines[lineIndex];
        if (docLine) {
            this.document.lines[lineIndex] = docLine.replace(oldText, newText);
        }
    }

    /** Применяет правила раскраски ко всем строкам (мгновенно, duration=0).
     *  Правила сохраняются и автоматически применяются к новым строкам при insertLinesAt. */
    public colorize(rules: ColorRule[]): void {
        this.savedColorRules = rules;
        for (let i = 0; i < this.lines.length; i++) {
            const line = this.lines[i];
            for (const rule of rules) {
                line.colorizeByRule(rule.match, rule.color);
            }
        }
    }

    /** Применяет правила раскраски к диапазону строк. */
    public colorizeRange(from: number, to: number, rules: ColorRule[]): void {
        for (let i = from; i <= to && i < this.lines.length; i++) {
            const line = this.lines[i];
            for (const rule of rules) {
                line.colorizeByRule(rule.match, rule.color);
            }
        }
    }

    public *animateInsertLines(range: [number, number], currentY: number[], duration: number = 0.6): ThreadGenerator {
        const [start, end] = range;
        const count = Math.max(0, end - start + 1);
        if (count === 0) return;

        const lineHeight = this.config.lineHeight;
        const animations: ThreadGenerator[] = [];

        for (let i = start; i < this.lines.length; i++) {
            const offset =
                i <= end
                    ? (i - start) * lineHeight
                    : count * lineHeight;
            currentY[i] += offset;
            animations.push(this.lines[i].node.y(currentY[i], duration, easeInOutCubic));
        }

        for (let i = start; i <= end && i < this.lines.length; i++) {
            animations.push(this.lines[i].node.opacity(1, duration, easeInOutCubic));
        }

        if (animations.length > 0) {
            yield* all(...animations);
        }
    }

    public setScrollY(value: number): void {
        if (!this.mounted) return;
        const content = this.contentRef();
        content.y(-value);
    }

    public *animateScrollY(deltaY: number, duration: number = 0.6, timingFunction = easeInOutCubic): ThreadGenerator {
        if (!this.mounted) return;
        const content = this.contentRef();
        const target = -deltaY;
        yield* content.y(target, duration, timingFunction);
    }

    public setCardFill(color: string): void {
        if (!this.card) return;
        this.card.node.fill(color);
    }

    public *animateCardFill(color: string, duration: number = 0.6): ThreadGenerator {
        if (!this.card) return;
        yield* this.card.node.fill(color, duration, easeInOutCubic);
    }
}
