import {Node, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, Reference, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {Token, tokenizeLine} from '../model/Tokenizer';
import {getTokenColor, SyntaxTheme} from '../model/SyntaxTheme';
import {TokenDiffEntry} from '../diff/TokenDiff';
import {Colors} from '../../theme';
import {getWorldPosition, Point} from '../shared/Coordinates';
import {textWidth} from '../../utils/textMeasure';
import {charDelay as charDelayFn} from '../shared/TextMeasure';

export interface CodeLineConfig {
    tokens: Token[];
    fontSize: number;
    lineHeight: number;
    fontFamily: string;
    theme: SyntaxTheme;
    contentWidth: number;
    leftEdge: number;
    glowAccent?: boolean;
}

export interface TokenData {
    ref: Reference<Txt>;
    text: string;
    type: string;
    localX: number;
    originalColor: string;
    originalShadowBlur: number;
    originalShadowColor: string;
    originalShadowOffset: [number, number];
}

export const LIGATURE_OPERATORS = new Set(['!=', '==', '<=', '>=', '&&', '||', '++', '--', '->', '::']);

export class CodeLine {
    private readonly containerRef: Reference<Node> = createRef<Node>();
    private readonly backgroundRef: Reference<Rect> = createRef<Rect>();
    private readonly tokensData: TokenData[] = [];
    private readonly config: CodeLineConfig;
    private readonly glowAccent: boolean;

    constructor(config: CodeLineConfig) {
        this.config = config;
        this.glowAccent = config.glowAccent ?? true;
    }

    /**
     * Создаёт CodeLine из уже существующих DOM-нод и токенов.
     * Используется при splitLine для переноса части токенов на новую строку.
     */
    public static fromExisting(
        container: Node,
        background: Rect,
        tokens: TokenData[],
        sourceLineForConfig: CodeLine,
    ): CodeLine {
        const line = new CodeLine(sourceLineForConfig.config);
        line.containerRef(container);
        line.backgroundRef(background);
        (line.tokensData as TokenData[]).push(...tokens);
        return line;
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
                        type: token.type,
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
                type: token.type,
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

    public mutateInPlace(
        tokenDiff: TokenDiffEntry[],
        newTokens: Token[],
        visibleKept: Set<number>,
    ): void {
        const container = this.containerRef();
        const {fontFamily, fontSize, theme, leftEdge} = this.config;

        const oldGroups = new Map<number, number[]>();
        let logIdx = 0;
        for (let i = 0; i < this.tokensData.length; i++) {
            if (this.tokensData[i].text.length > 0) {
                oldGroups.set(logIdx, [i]);
                logIdx++;
            } else {
                oldGroups.get(logIdx - 1)?.push(i);
            }
        }

        const keepMap = new Map<number, number>();
        const removeSet = new Set<number>();
        for (const e of tokenDiff) {
            if (e.op === 'keep') keepMap.set(e.newIndex, e.oldIndex);
            else if (e.op === 'remove') removeSet.add(e.oldIndex);
        }

        let xOff = leftEdge;
        const xPositions: number[] = [];
        for (const t of newTokens) {
            xPositions.push(xOff);
            xOff += textWidth(t.text, fontFamily, fontSize);
        }

        const newData: TokenData[] = [];

        for (let ni = 0; ni < newTokens.length; ni++) {
            const token = newTokens[ni];
            const x = xPositions[ni];

            if (keepMap.has(ni)) {
                const group = oldGroups.get(keepMap.get(ni)!)!;
                const visible = visibleKept.has(ni);

                if (group.length === 1) {
                    const td = this.tokensData[group[0]];
                    td.ref().x(x);
                    td.localX = x;
                    if (!visible) {
                        td.ref().opacity(0);
                        td.ref().text('');
                    }
                    newData.push(td);
                } else {
                    let cx = x;
                    for (let gi = 0; gi < group.length; gi++) {
                        const td = this.tokensData[group[gi]];
                        td.ref().x(cx);
                        td.localX = cx;
                        if (!visible) {
                            td.ref().opacity(0);
                            td.ref().text('');
                        }
                        newData.push(td);
                        if (gi < token.text.length) {
                            cx += textWidth(token.text[gi], fontFamily, fontSize);
                        }
                    }
                }
                continue;
            }

            const color = token.color ?? getTokenColor(token.type, theme);

            if (token.type === 'operator' && LIGATURE_OPERATORS.has(token.text)) {
                let cx = x;
                for (let c = 0; c < token.text.length; c++) {
                    const ref = createRef<Txt>();
                    const txt = new Txt({
                        text: '',
                        fontFamily,
                        fontSize,
                        fill: color,
                        x: cx,
                        offset: [-1, 0],
                        opacity: 0,
                    });
                    ref(txt);
                    container.add(txt);
                    newData.push({
                        ref,
                        text: c === 0 ? token.text : '',
                        type: token.type,
                        localX: cx,
                        originalColor: color,
                        originalShadowBlur: 0,
                        originalShadowColor: 'rgba(0,0,0,0)',
                        originalShadowOffset: [0, 0],
                    });
                    cx += textWidth(token.text[c], fontFamily, fontSize);
                }
            } else {
                const ref = createRef<Txt>();
                const txt = new Txt({
                    text: '',
                    fontFamily,
                    fontSize,
                    fill: color,
                    x,
                    offset: [-1, 0],
                    opacity: 0,
                });
                ref(txt);
                container.add(txt);
                newData.push({
                    ref,
                    text: token.text,
                    type: token.type,
                    localX: x,
                    originalColor: color,
                    originalShadowBlur: 0,
                    originalShadowColor: 'rgba(0,0,0,0)',
                    originalShadowOffset: [0, 0],
                });
            }
        }

        for (const oldIdx of removeSet) {
            const group = oldGroups.get(oldIdx);
            if (!group) continue;
            for (const gi of group) this.tokensData[gi].ref().remove();
        }

        this.tokensData.length = 0;
        this.tokensData.push(...newData);
    }

    public get node(): Node {
        return this.containerRef();
    }

    public get tokens(): TokenData[] {
        return this.tokensData;
    }

    public get background(): Rect {
        return this.backgroundRef();
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

    /** Лёгкое свечение на токенах по паттернам (shadowBlur + shadowColor). */
    public *setTokensGlow(patterns: string[], blur: number, color: string, duration: number = 0.4): ThreadGenerator {
        const animations: ThreadGenerator[] = [];
        for (const tokenData of this.tokensData) {
            if (patterns.some(p => tokenData.text.includes(p))) {
                animations.push(tokenData.ref().shadowBlur(blur, duration, easeInOutCubic));
                animations.push(tokenData.ref().shadowColor(color, duration, easeInOutCubic));
                animations.push(tokenData.ref().shadowOffset([0, 1], duration, easeInOutCubic));
            }
        }
        if (animations.length > 0) {
            yield* all(...animations);
        }
    }

    /** Сброс свечения — возврат к originalShadow*. */
    public *resetTokensGlow(patterns: string[], duration: number = 0.4): ThreadGenerator {
        const animations: ThreadGenerator[] = [];
        for (const tokenData of this.tokensData) {
            if (patterns.some(p => tokenData.text.includes(p))) {
                animations.push(tokenData.ref().shadowBlur(tokenData.originalShadowBlur, duration, easeInOutCubic));
                animations.push(tokenData.ref().shadowColor(tokenData.originalShadowColor, duration, easeInOutCubic));
                animations.push(tokenData.ref().shadowOffset(tokenData.originalShadowOffset, duration, easeInOutCubic));
            }
        }
        if (animations.length > 0) {
            yield* all(...animations);
        }
    }

    public get tokenCount(): number {
        return this.tokensData.length;
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
        if (!this.glowAccent) {
            return [];
        }
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

    /** Посимвольный typewriter: раскрывает текст каждого токена символ за символом.
     *  Сохраняет синтаксическую подсветку. Пробелы — быстрее, пунктуация — с паузой. */
    public *typewriter(delay: number = 0.012): ThreadGenerator {
        for (let i = 0; i < this.tokensData.length; i++) {
            const tokenData = this.tokensData[i];
            const full = tokenData.text;
            if (full.length === 0) continue;

            const isLigature = tokenData.type === 'operator' && LIGATURE_OPERATORS.has(full);
            if (isLigature) {
                for (let c = 0; c < full.length; c++) {
                    const partTxt = this.tokensData[i + c].ref();
                    partTxt.opacity(1);
                    partTxt.text(full[c]);
                    yield* waitFor(charDelayFn(full[c], delay));
                }
                continue;
            }

            const txtNode = tokenData.ref();
            txtNode.opacity(1);
            txtNode.text('');
            for (let c = 0; c < full.length; c++) {
                txtNode.text(full.slice(0, c + 1));
                yield* waitFor(charDelayFn(full[c], delay));
            }
        }
    }

    public hideTokensInstantly(): void {
        for (const tokenData of this.tokensData) {
            tokenData.ref().opacity(0);
        }
    }

    public showTokensInstantly(): void {
        for (const tokenData of this.tokensData) {
            tokenData.ref().opacity(1);
        }
    }

    public showTokensUpTo(charPos: number): void {
        let pos = 0;
        for (const tokenData of this.tokensData) {
            const len = tokenData.text.length;
            if (pos + len <= charPos) {
                tokenData.ref().opacity(1);
                tokenData.ref().text(tokenData.text);
            } else if (pos < charPos) {
                tokenData.ref().opacity(1);
                tokenData.ref().text(tokenData.text.slice(0, charPos - pos));
            } else {
                tokenData.ref().opacity(0);
            }
            pos += len;
        }
    }

    public hideTokensFrom(charPos: number): void {
        let pos = 0;
        for (const tokenData of this.tokensData) {
            const len = tokenData.text.length;
            if (pos >= charPos) {
                tokenData.ref().opacity(0);
            }
            pos += len;
        }
    }

    public *typewriterFrom(charPos: number, delay: number = 0.012): ThreadGenerator {
        let pos = 0;
        for (const tokenData of this.tokensData) {
            const full = tokenData.text;
            if (full.length === 0) continue;
            const txtNode = tokenData.ref();

            if (pos + full.length <= charPos) {
                txtNode.opacity(1);
                txtNode.text(full);
                pos += full.length;
                continue;
            }

            txtNode.opacity(1);
            const startChar = Math.max(0, charPos - pos);
            txtNode.text(startChar > 0 ? full.slice(0, startChar) : '');

            for (let c = startChar; c < full.length; c++) {
                txtNode.text(full.slice(0, c + 1));
                yield* waitFor(charDelayFn(full[c], delay));
            }
            pos += full.length;
        }
    }

    /** Заменяет текст токена с анимацией:
     *  1) подсветка старого (highlight), 2) стирание посимвольно, 3) печать нового посимвольно.
     *  highlightColor — цвет подсветки перед стиранием (null = без подсветки). */
    public *replaceToken(
        oldText: string,
        newText: string,
        charDelay: number = 0.015,
        highlightColor: string | null = 'rgba(255, 120, 100, 0.95)',
        fromEnd: boolean = false,
    ): ThreadGenerator {
        const idx = fromEnd
            ? this.tokensData.reduceRight((found, t, i) => found === -1 && t.text.includes(oldText) ? i : found, -1)
            : this.tokensData.findIndex(t => t.text.includes(oldText));
        if (idx === -1) return;

        const tokenData = this.tokensData[idx];
        const txtNode = tokenData.ref();
        const fullOld = tokenData.text;
        const savedFill = String(txtNode.fill());

        if (highlightColor) {
            yield* txtNode.fill(highlightColor, 0.15, easeInOutCubic);
            yield* waitFor(0.15);
        }

        for (let c = fullOld.length; c >= 0; c--) {
            txtNode.text(fullOld.slice(0, c));
            yield* waitFor(charDelay * 0.7);
        }

        const fullNew = fullOld.replace(oldText, newText);
        tokenData.text = fullNew;

        const oldWidth = textWidth(fullOld, this.config.fontFamily, this.config.fontSize);
        const newWidth = textWidth(fullNew, this.config.fontFamily, this.config.fontSize);
        const delta = newWidth - oldWidth;

        if (Math.abs(delta) > 0.5) {
            const anims: ThreadGenerator[] = [];
            for (let i = idx + 1; i < this.tokensData.length; i++) {
                this.tokensData[i].localX += delta;
                anims.push(this.tokensData[i].ref().x(this.tokensData[i].localX, 0.2, easeInOutCubic));
            }
            if (anims.length > 0) yield* all(...anims);
        }

        if (highlightColor) {
            txtNode.fill(savedFill);
        }

        for (let c = 0; c < fullNew.length; c++) {
            txtNode.text(fullNew.slice(0, c + 1));
            yield* waitFor(charDelay);
        }
    }

    /**
     * Вставляет текст перед указанным токеном с анимацией:
     * 1) Сдвигает целевой токен и все после него вправо
     * 2) Печатает новые токены посимвольно (typewriter)
     *
     * @param beforeText — текст токена, перед которым вставляем (ищем fromEnd если указано)
     * @param insertText — текст для вставки (будет токенизирован)
     * @param colorRules — правила раскраски для новых токенов
     */
    public *insertBeforeToken(
        beforeText: string,
        insertText: string,
        opts: {
            charDelay?: number;
            fromEnd?: boolean;
            colorRules?: Array<{match: string | RegExp; color: string}>;
            customTypes?: string[];
        } = {},
    ): ThreadGenerator {
        const {charDelay = 0.012, fromEnd = false, colorRules = [], customTypes = []} = opts;

        const targetIdx = fromEnd
            ? this.tokensData.reduceRight((found, t, i) => found === -1 && t.text === beforeText ? i : found, -1)
            : this.tokensData.findIndex(t => t.text === beforeText);
        if (targetIdx === -1) return;

        const newTokens = tokenizeLine(insertText, customTypes);
        const totalInsertWidth = newTokens.reduce(
            (sum, t) => sum + textWidth(t.text, this.config.fontFamily, this.config.fontSize), 0,
        );

        // 1) Сдвигаем целевой токен и все после него вправо
        const shiftAnims: ThreadGenerator[] = [];
        for (let i = targetIdx; i < this.tokensData.length; i++) {
            this.tokensData[i].localX += totalInsertWidth;
            shiftAnims.push(this.tokensData[i].ref().x(this.tokensData[i].localX, 0.25, easeInOutCubic));
        }
        if (shiftAnims.length > 0) yield* all(...shiftAnims);

        // 2) Создаём новые Txt-ноды и вставляем в tokensData
        let xOffset = this.tokensData[targetIdx].localX - totalInsertWidth;
        const container = this.containerRef();
        const newTokensData: TokenData[] = [];

        for (const token of newTokens) {
            let tokenColor = token.color ?? getTokenColor(token.type, this.config.theme);
            for (const rule of colorRules) {
                const matches = typeof rule.match === 'string'
                    ? token.text === rule.match || token.text.includes(rule.match)
                    : rule.match.test(token.text);
                if (matches) {
                    tokenColor = rule.color;
                    break;
                }
            }

            const ref = createRef<Txt>();
            const txt = new Txt({
                text: '',
                fontFamily: this.config.fontFamily,
                fontSize: this.config.fontSize,
                fill: tokenColor,
                x: xOffset,
                offset: [-1, 0],
                opacity: 1,
            });
            ref(txt);
            container.add(txt);

            const td: TokenData = {
                ref,
                text: token.text,
                type: token.type,
                localX: xOffset,
                originalColor: tokenColor,
                originalShadowBlur: 0,
                originalShadowColor: 'rgba(0,0,0,0)',
                originalShadowOffset: [0, 0],
            };
            newTokensData.push(td);
            xOffset += textWidth(token.text, this.config.fontFamily, this.config.fontSize);
        }

        // Вставляем в массив tokensData перед targetIdx
        this.tokensData.splice(targetIdx, 0, ...newTokensData);

        // 3) Typewriter — печатаем посимвольно
        for (const td of newTokensData) {
            const fullText = td.text;
            for (let c = 0; c < fullText.length; c++) {
                td.ref().text(fullText.slice(0, c + 1));
                yield* waitFor(charDelay);
            }
        }
    }

    /**
     * Стирает токен посимвольно и удаляет его ноду.
     * Сдвигает все последующие токены влево.
     */
    public *removeToken(
        tokenText: string,
        charDelay: number = 0.012,
        fromEnd: boolean = false,
    ): ThreadGenerator {
        const idx = fromEnd
            ? this.tokensData.reduceRight((found, t, i) => found === -1 && t.text === tokenText ? i : found, -1)
            : this.tokensData.findIndex(t => t.text === tokenText);
        if (idx === -1) return;

        const td = this.tokensData[idx];
        const txtNode = td.ref();
        const fullText = td.text;
        const tokenWidth = textWidth(fullText, this.config.fontFamily, this.config.fontSize);

        // Стираем посимвольно
        for (let c = fullText.length; c >= 0; c--) {
            txtNode.text(fullText.slice(0, c));
            yield* waitFor(charDelay * 0.7);
        }

        // Удаляем ноду и из массива
        txtNode.remove();
        this.tokensData.splice(idx, 1);

        // Сдвигаем последующие токены влево
        const anims: ThreadGenerator[] = [];
        for (let i = idx; i < this.tokensData.length; i++) {
            this.tokensData[i].localX -= tokenWidth;
            anims.push(this.tokensData[i].ref().x(this.tokensData[i].localX, 0.2, easeInOutCubic));
        }
        if (anims.length > 0) yield* all(...anims);
    }

    /** Мгновенно окрашивает токены, соответствующие правилу. */
    public colorizeByRule(match: string | RegExp, color: string, onlyTypes?: string[]): void {
        for (const tokenData of this.tokensData) {
            const matches = typeof match === 'string'
                ? tokenData.text === match || tokenData.text.includes(match)
                : match.test(tokenData.text);
            if (matches && (!onlyTypes || onlyTypes.includes(tokenData.type))) {
                tokenData.ref().fill(color);
            }
        }
    }

    /** Плавно окрашивает токены, соответствующие правилу. Возвращает массив анимаций. */
    public colorizeByRuleAnimated(match: string | RegExp, color: string, duration: number = 0.4, onlyTypes?: string[]): ThreadGenerator[] {
        const anims: ThreadGenerator[] = [];
        for (const tokenData of this.tokensData) {
            const matches = typeof match === 'string'
                ? tokenData.text === match || tokenData.text.includes(match)
                : match.test(tokenData.text);
            if (matches && (!onlyTypes || onlyTypes.includes(tokenData.type))) {
                anims.push(tokenData.ref().fill(color, duration, easeInOutCubic));
            }
        }
        return anims;
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
