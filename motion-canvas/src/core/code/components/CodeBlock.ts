import {Node, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, Reference, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {CodeDocument} from '../model/CodeDocument';
import {tokenizeLine} from '../model/Tokenizer';
import {SyntaxTheme, IntelliJDarkTheme, getTokenColor} from '../model/SyntaxTheme';
import {CodeCard, CodeCardStyle} from './CodeCard';
import {CodeLine} from './CodeLine';
import {getCodePaddingX, getCodePaddingY, getLineHeight} from '../shared/TextMeasure';
import {getWorldPosition, Point} from '../shared/Coordinates';
import {Fonts} from '../../theme';
import {textWidth} from '../../utils/textMeasure';

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
    onlyTypes?: string[];
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
    public get savedRules(): ColorRule[] { return this.savedColorRules; }

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

    /**
     * Плавно прокручивает код вверх так, чтобы строка lineIndex была видна.
     * Смещает contentContainer по Y.
     */
    public *scrollToLine(lineIndex: number, duration: number = 0.5): ThreadGenerator {
        const lh = this.config.lineHeight;
        const line = this.lines[lineIndex];
        if (!line) return;
        const lineY = line.node.y();
        const content = this.contentRef();
        const currentOffset = content.y();
        const newOffset = -lineY + this.mountedStartY;
        if (Math.abs(newOffset - currentOffset) > 1) {
            yield* content.y(newOffset, duration, easeInOutCubic);
        }
    }

    /** Ищет строку по подстроке в document.lines. Возвращает индекс или -1. */
    public findLine(contains: string): number {
        return this.document.lines.findIndex(l => l.includes(contains));
    }

    /** Ищет последнее вхождение подстроки в document.lines. Возвращает индекс или -1. */
    public findLastLine(contains: string): number {
        const lines = this.document.lines;
        for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].includes(contains)) return i;
        }
        return -1;
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
    public *typewriterLine(lineIndex: number, charDelay: number = 0.012): ThreadGenerator {
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
            expandDuration = 0.35,
            typewriter = true,
            charDelay = 0.012,
            lineDelay = 0.04,
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
                    line.colorizeByRule(rule.match, rule.color, rule.onlyTypes);
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

    /** Удаляет строки с анимацией: fade out + схлопывание. */
    public *removeLines(
        startLine: number,
        count: number = 1,
        duration: number = 0.35,
    ): ThreadGenerator {
        if (!this.mounted) return;
        const lh = this.config.lineHeight;

        const fadeAnims: ThreadGenerator[] = [];
        for (let i = startLine; i < startLine + count && i < this.lines.length; i++) {
            fadeAnims.push(this.lines[i].node.opacity(0, duration * 0.6, easeInOutCubic));
        }
        if (fadeAnims.length > 0) yield* all(...fadeAnims);

        for (let i = startLine; i < startLine + count && i < this.lines.length; i++) {
            this.lines[i].node.remove();
        }

        this.lines.splice(startLine, count);
        this.document.lines.splice(startLine, count);

        const collapseAnims: ThreadGenerator[] = [];
        for (let i = startLine; i < this.lines.length; i++) {
            const currentY = this.lines[i].node.y();
            collapseAnims.push(this.lines[i].node.y(currentY - count * lh, duration, easeInOutCubic));
        }
        if (collapseAnims.length > 0) yield* all(...collapseAnims);
    }

    /** Заменяет текст токена в строке с анимацией fade-out / fade-in.
     *  Находит первый (или последний при fromEnd=true) токен, содержащий oldText. */
    public *replaceInLine(
        lineIndex: number,
        oldText: string,
        newText: string,
        charDelay: number = 0.015,
        highlightColor: string | null = 'rgba(255, 120, 100, 0.95)',
        fromEnd: boolean = false,
    ): ThreadGenerator {
        const line = this.lines[lineIndex];
        if (!line) return;
        yield* line.replaceToken(oldText, newText, charDelay, highlightColor, fromEnd);

        const docLine = this.document.lines[lineIndex];
        if (docLine) {
            this.document.lines[lineIndex] = docLine.replace(oldText, newText);
        }
    }

    /** Стирает токен по точному тексту и следующий за ним токен (если nextToo=true). */
    public *removeInLine(
        lineIndex: number,
        tokenText: string,
        charDelay: number = 0.012,
        fromEnd: boolean = false,
        nextToo: boolean = false,
    ): ThreadGenerator {
        const line = this.lines[lineIndex];
        if (!line) return;
        yield* line.removeToken(tokenText, charDelay, fromEnd);
        if (nextToo) yield* line.removeToken(' ', 0, fromEnd);

        const docLine = this.document.lines[lineIndex];
        if (docLine) {
            const idx = fromEnd ? docLine.lastIndexOf(tokenText) : docLine.indexOf(tokenText);
            if (idx >= 0) {
                const removeLen = tokenText.length + (nextToo ? 1 : 0);
                this.document.lines[lineIndex] = docLine.slice(0, idx) + docLine.slice(idx + removeLen);
            }
        }
    }

    /** Вставляет текст перед указанным токеном в строке.
     *  Сдвигает токен и все после него вправо, печатает новый текст с typewriter. */
    public *insertInLine(
        lineIndex: number,
        beforeText: string,
        insertText: string,
        opts: {
            charDelay?: number;
            fromEnd?: boolean;
            colorRules?: Array<{match: string | RegExp; color: string}>;
        } = {},
    ): ThreadGenerator {
        const line = this.lines[lineIndex];
        if (!line) return;
        yield* line.insertBeforeToken(beforeText, insertText, {
            ...opts,
            colorRules: [...(opts.colorRules ?? []), ...this.savedColorRules],
            customTypes: this.config.customTypes,
        });

        const docLine = this.document.lines[lineIndex];
        if (docLine) {
            const idx = opts.fromEnd
                ? docLine.lastIndexOf(beforeText)
                : docLine.indexOf(beforeText);
            if (idx >= 0) {
                this.document.lines[lineIndex] = docLine.slice(0, idx) + insertText + docLine.slice(idx);
            }
        }
    }

    /**
     * Разбивает строку на две: токены до splitBeforeToken остаются,
     * splitBeforeToken и все после него плавно съезжают на новую строку.
     *
     * @param lineIndex — индекс строки
     * @param splitBeforeToken — текст токена, перед которым разрезаем
     * @param newLinePrefix — текст, который появится на новой строке ПЕРЕД перенесёнными токенами
     *                        (например "        String colorProfile" — отступ + новый параметр).
     *                        Будет токенизирован, раскрашен и напечатан typewriter-ом.
     * @param opts.insertBeforeSplit — текст для вставки в старую строку перед split-точкой (например ",")
     */
    public *splitLine(
        lineIndex: number,
        splitBeforeToken: string,
        newLinePrefix: string = '        ',
        opts: {
            insertBeforeSplit?: string;
            duration?: number;
            fromEnd?: boolean;
            charDelay?: number;
        } = {},
    ): ThreadGenerator {
        if (!this.mounted) return;
        const {insertBeforeSplit, duration = 0.35, fromEnd = false, charDelay = 0.012} = opts;
        const srcLine = this.lines[lineIndex];
        if (!srcLine) return;

        // Если нужно вставить текст перед split-точкой (например запятую)
        if (insertBeforeSplit) {
            yield* srcLine.insertBeforeToken(splitBeforeToken, insertBeforeSplit, {
                charDelay,
                fromEnd,
                colorRules: this.savedColorRules,
                customTypes: this.config.customTypes,
            });
        }

        // Находим splitToken (пересчитываем после возможной вставки)
        const tokens = srcLine.tokens;
        const newSplitIdx = fromEnd
            ? tokens.reduceRight((found, t, i) => found === -1 && t.text === splitBeforeToken ? i : found, -1)
            : tokens.findIndex(t => t.text === splitBeforeToken);
        if (newSplitIdx === -1) return;

        const lh = this.config.lineHeight;
        const content = this.contentRef();
        const srcY = srcLine.node.y();
        const newY = srcY + lh;

        // Токенизируем prefix
        const prefixTokens = tokenizeLine(newLinePrefix, this.config.customTypes);
        const prefixWidth = prefixTokens.reduce(
            (sum, t) => sum + textWidth(t.text, this.config.fontFamily, this.config.fontSize), 0,
        );

        // Создаём контейнер для новой строки (начинает на той же Y что и исходная)
        const newContainer = new Node({y: srcY, opacity: 1});
        const newBackground = new Rect({
            width: this.mountedContentWidth,
            height: lh * 1.15,
            x: 0, y: 0,
            radius: this.config.fontSize * 0.5,
            fill: 'rgba(0,0,0,0)',
            opacity: 0,
        });
        newContainer.add(newBackground);
        content.add(newContainer);

        // Забираем токены из старой строки
        const movedTokens = tokens.splice(newSplitIdx);

        // Удаляем trailing whitespace из старой строки
        while (tokens.length > 0 && tokens[tokens.length - 1].text.trim() === '') {
            const ws = tokens.pop()!;
            ws.ref().remove();
        }

        // Создаём prefix Txt-ноды (скрытые — для typewriter)
        const prefixTokensData: import('./CodeLine').TokenData[] = [];
        let xOffset = this.mountedLeftEdge;
        for (const pt of prefixTokens) {
            const tokenColor = pt.color ?? getTokenColor(pt.type, this.config.theme);
            let finalColor = tokenColor;
            for (const rule of this.savedColorRules) {
                const matches = typeof rule.match === 'string'
                    ? pt.text === rule.match || pt.text.includes(rule.match as string)
                    : (rule.match as RegExp).test(pt.text);
                if (matches) { finalColor = rule.color; break; }
            }

            const ref = createRef<Txt>();
            const txt = new Txt({
                text: '',
                fontFamily: this.config.fontFamily,
                fontSize: this.config.fontSize,
                fill: finalColor,
                x: xOffset,
                offset: [-1, 0],
                opacity: 1,
            });
            ref(txt);
            newContainer.add(txt);
            prefixTokensData.push({
                ref, text: pt.text, type: pt.type ?? 'plain', localX: xOffset,
                originalColor: finalColor,
                originalShadowBlur: 0, originalShadowColor: 'rgba(0,0,0,0)', originalShadowOffset: [0, 0],
            });
            xOffset += textWidth(pt.text, this.config.fontFamily, this.config.fontSize);
        }

        // Перемещаем moved-токены в новый контейнер
        const movedStartX = xOffset;
        for (const td of movedTokens) {
            const txtNode = td.ref();
            const oldX = td.localX;
            txtNode.remove();
            newContainer.add(txtNode);
            txtNode.x(oldX);
        }

        // Собираем все токены новой строки
        const allNewTokens = [...prefixTokensData, ...movedTokens];
        const newLine = CodeLine.fromExisting(newContainer, newBackground, allNewTokens, srcLine);
        this.lines.splice(lineIndex + 1, 0, newLine);

        // Обновляем document
        const docLine = this.document.lines[lineIndex];
        const docSplitPos = fromEnd ? docLine.lastIndexOf(splitBeforeToken) : docLine.indexOf(splitBeforeToken);
        if (docSplitPos >= 0) {
            let before = docLine.slice(0, docSplitPos);
            if (insertBeforeSplit) before += insertBeforeSplit;
            before = before.trimEnd();
            const after = newLinePrefix + docLine.slice(docSplitPos);
            this.document.lines[lineIndex] = before;
            this.document.lines.splice(lineIndex + 1, 0, after);
        }

        // Анимация: новая строка съезжает вниз + moved-токены едут в новые X-позиции
        const anims: ThreadGenerator[] = [];
        anims.push(newContainer.y(newY, duration, easeInOutCubic));

        let targetX = movedStartX;
        for (const td of movedTokens) {
            anims.push(td.ref().x(targetX, duration, easeInOutCubic));
            td.localX = targetX;
            targetX += textWidth(td.text, this.config.fontFamily, this.config.fontSize);
        }

        for (let i = lineIndex + 2; i < this.lines.length; i++) {
            const curY = this.lines[i].node.y();
            anims.push(this.lines[i].node.y(curY + lh, duration, easeInOutCubic));
        }

        if (anims.length > 0) yield* all(...anims);

        // Typewriter для prefix-токенов
        for (const td of prefixTokensData) {
            const fullText = td.text;
            for (let c = 0; c < fullText.length; c++) {
                td.ref().text(fullText.slice(0, c + 1));
                yield* waitFor(charDelay);
            }
        }
    }

    /** Применяет правила раскраски ко всем строкам (мгновенно, duration=0).
     *  Правила сохраняются и автоматически применяются к новым строкам при insertLinesAt. */
    public colorize(rules: ColorRule[]): void {
        this.savedColorRules = rules;
        for (let i = 0; i < this.lines.length; i++) {
            const line = this.lines[i];
            for (const rule of rules) {
                line.colorizeByRule(rule.match, rule.color, rule.onlyTypes);
            }
        }
    }

    /** Применяет правила раскраски к диапазону строк. */
    public colorizeRange(from: number, to: number, rules: ColorRule[]): void {
        for (let i = from; i <= to && i < this.lines.length; i++) {
            const line = this.lines[i];
            for (const rule of rules) {
                line.colorizeByRule(rule.match, rule.color, rule.onlyTypes);
            }
        }
    }

    public *colorizeRangeAnimated(from: number, to: number, rules: ColorRule[], duration: number = 0.4): ThreadGenerator {
        const anims: ThreadGenerator[] = [];
        for (let i = from; i <= to && i < this.lines.length; i++) {
            const line = this.lines[i];
            for (const rule of rules) {
                anims.push(...line.colorizeByRuleAnimated(rule.match, rule.color, duration));
            }
        }
        if (anims.length > 0) yield* all(...anims);
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
