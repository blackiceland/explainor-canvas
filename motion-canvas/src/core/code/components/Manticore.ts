import {Node, Rect} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, Reference, ThreadGenerator, TimingFunction, waitFor} from '@motion-canvas/core';
import {tokenizeLine, TokenType} from '../model/Tokenizer';
import {SyntaxTheme, IntelliJDarkTheme} from '../model/SyntaxTheme';
import {CodeCard, CodeCardStyle} from './CodeCard';
import {CodeLine, LIGATURE_OPERATORS, TokenData} from './CodeLine';
import {getCodePaddingX, getCodePaddingY, getLineHeight, charDelay as charDelayFn} from '../shared/TextMeasure';
import {Fonts} from '../../theme';
import {diffLines} from '../diff/LineDiff';
import {diffTokens, TokenDiffEntry} from '../diff/TokenDiff';
import {buildMorphBlocks} from '../director/MorphDirector';

export interface ColorRule {
    match: string | RegExp;
    color: string;
    onlyTypes?: string[];
}

export interface ManticoreConfig {
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
    clipPaddingY?: number;
    glowAccent?: boolean;
    noClip?: boolean;
}

export interface MorphOptions {
    removeDuration?: number;
    moveDuration?: number;
    charDelay?: number;
    lineDelay?: number;
    flashRemovedColor?: string;
    flashRemovedDuration?: number;
    flashRemovedIncludeTypes?: TokenType[];
    flashRemovedExcludeTypes?: TokenType[];
    flashRemovedErase?: 'none' | 'reverseType';
    flashRemovedEraseCharDelay?: number;
    scrollStrategy?: 'block' | 'blockWithTail' | 'auto';
    addStyle?: 'typewriter' | 'fade';
    lineOrder?: 'sequential' | 'parallel';
    blockOrder?: 'sequential' | 'parallel';
}

interface LinePlan {
    kind: 'keep' | 'add' | 'remove' | 'modify';
    oldIndex: number;
    newIndex: number;
    newText: string;
    tokenDiff?: TokenDiffEntry[];
}

interface TokenVisibility {
    kept: Set<number>;
}

interface MorphResolvedOptions {
    removeDuration: number;
    moveDuration: number;
    charDelay: number;
    lineDelay: number;
    flashRemovedColor?: string;
    flashRemovedDuration: number;
    flashRemovedIncludeTypes?: TokenType[];
    flashRemovedExcludeTypes: TokenType[];
    flashRemovedErase: 'none' | 'reverseType';
    flashRemovedEraseCharDelay: number;
    scrollStrategy: 'block' | 'blockWithTail' | 'auto';
    addStyle: 'typewriter' | 'fade';
    lineOrder: 'sequential' | 'parallel';
    blockOrder: 'sequential' | 'parallel';
}

interface MorphPreparedState {
    result: (CodeLine | null)[];
    modifyMap: Map<number, CodeLine>;
    settleAnims: ThreadGenerator[];
    activePlan: LinePlan[];
    blocks: ReturnType<typeof buildMorphBlocks>;
}

export interface MorphRuntimeReport {
    blockCount: number;
    activeItems: number;
    tailScrollEvents: number;
    scrollStrategy: 'block' | 'blockWithTail' | 'auto';
    lineCountBefore: number;
    lineCountAfter: number;
}

interface MorphRuntimeAccumulator {
    tailScrollEvents: number;
}

export class Manticore {
    private readonly containerRef: Reference<Node> = createRef<Node>();
    private readonly contentRef: Reference<Node> = createRef<Node>();
    private lines: CodeLine[] = [];
    private code: string[] = [];
    private readonly cfg: Required<ManticoreConfig>;
    private card: CodeCard | null = null;
    private mounted = false;
    private colorRules: ColorRule[] = [];
    private lastMorphReport: MorphRuntimeReport | null = null;

    private contentWidth = 0;
    private clipHeight = 0;
    private leftEdge = 0;
    private startY = 0;

    private constructor(initialCode: string, config: ManticoreConfig) {
        this.code = initialCode.split('\n');
        const fontSize = config.fontSize ?? 20;
        this.cfg = {
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
            clipPaddingY: config.clipPaddingY ?? getCodePaddingY(fontSize),
            glowAccent: config.glowAccent ?? true,
            noClip: config.noClip ?? false,
        };
    }

    static create(code: string, config: ManticoreConfig = {}): Manticore {
        return new Manticore(code, config);
    }

    mount(parent: Node): void {
        if (this.mounted) return;

        const container = new Node({x: this.cfg.x, y: this.cfg.y, opacity: 0});
        this.containerRef(container);

        const paddingX = getCodePaddingX(this.cfg.fontSize);
        const paddingY = getCodePaddingY(this.cfg.fontSize);
        const cardWidth = this.cfg.width;
        const contentHeight = this.code.length * this.cfg.lineHeight + paddingY * 2;
        const cardHeight = this.cfg.height > 0 ? this.cfg.height : contentHeight;
        this.contentWidth = cardWidth;

        this.card = new CodeCard({width: cardWidth, height: cardHeight, style: this.cfg.cardStyle});
        container.add(this.card.build());

        const clipPadY = this.cfg.clipPaddingY ?? paddingY;
        this.clipHeight = Math.max(0, cardHeight - clipPadY * 2);
        const clip = new Rect({
            width: cardWidth,
            height: this.clipHeight,
            radius: 0,
            fill: '#00000000',
            clip: !this.cfg.noClip,
        });
        container.add(clip);

        const content = new Node({y: 0});
        this.contentRef(content);
        clip.add(content);

        this.leftEdge = -cardWidth / 2 + paddingX + this.cfg.contentOffsetX;
        const shouldTopAlign = this.cfg.height > 0 && cardHeight !== contentHeight;
        this.startY = shouldTopAlign
            ? -this.clipHeight / 2 + this.cfg.contentOffsetY + this.cfg.lineHeight / 2
            : -((this.code.length - 1) / 2) * this.cfg.lineHeight;

        for (let i = 0; i < this.code.length; i++) {
            const cl = this.buildLine(this.code[i], this.lineY(i));
            content.add(cl.node);
            this.lines.push(cl);
        }

        parent.add(container);
        this.mounted = true;
    }

    private lineY(index: number): number {
        return this.startY + index * this.cfg.lineHeight;
    }

    private buildLine(text: string, y: number): CodeLine {
        const tokens = tokenizeLine(text, this.cfg.customTypes);
        const cl = new CodeLine({
            tokens,
            fontSize: this.cfg.fontSize,
            lineHeight: this.cfg.lineHeight,
            fontFamily: this.cfg.fontFamily,
            theme: this.cfg.theme,
            contentWidth: this.contentWidth,
            leftEdge: this.leftEdge,
            glowAccent: this.cfg.glowAccent,
        });
        cl.build(y);
        return cl;
    }

    private applyRules(cl: CodeLine): void {
        for (const rule of this.colorRules) {
            cl.colorizeByRule(rule.match, rule.color, rule.onlyTypes);
        }
    }

    private resolveTokenVisibility(td: TokenDiffEntry[]): TokenVisibility {
        let firstAddIdx = Infinity;
        for (const entry of td) {
            if (entry.op === 'add' && entry.newIndex < firstAddIdx) {
                firstAddIdx = entry.newIndex;
            }
        }

        const kept = new Set<number>();
        for (const entry of td) {
            if (entry.op !== 'keep') continue;
            if (entry.newIndex < firstAddIdx) {
                kept.add(entry.newIndex);
                continue;
            }
            const trimmed = entry.token.text.trim();
            const isWhitespace = entry.token.type === 'plain' && trimmed.length === 0;
            const isClosingPunct = entry.token.type === 'punctuation' && /^[)\]}]+$/.test(trimmed);
            if (!isWhitespace && !isClosingPunct) kept.add(entry.newIndex);
        }

        return {kept};
    }

    private mapTokenDataToNewIndex(tokens: TokenData[]): number[] {
        const mapping: number[] = [];
        let idx = 0;
        for (const token of tokens) {
            if (token.text.length > 0) {
                mapping.push(idx);
                idx++;
            } else {
                mapping.push(-1);
            }
        }
        return mapping;
    }

    get node(): Node { return this.containerRef(); }
    get cardRect(): Rect | null { return this.card?.node ?? null; }
    get lineCount(): number { return this.lines.length; }
    get currentCode(): string[] { return [...this.code]; }
    getLastMorphReport(): MorphRuntimeReport | null { return this.lastMorphReport; }

    addToContent(child: Node): void { this.contentRef().add(child); }
    getLineY(index: number): number { return this.lineY(index); }
    getLeftEdge(): number { return this.leftEdge; }

    *appear(duration = 0.6): ThreadGenerator {
        yield* this.containerRef().opacity(1, duration, easeInOutCubic);
    }

    *disappear(duration = 0.6): ThreadGenerator {
        yield* this.containerRef().opacity(0, duration, easeInOutCubic);
    }

    colorize(rules: ColorRule[]): void {
        this.colorRules = rules;
        for (const line of this.lines) {
            for (const rule of rules) {
                line.colorizeByRule(rule.match, rule.color, rule.onlyTypes);
            }
        }
    }

    colorizeRange(from: number, to: number): void {
        for (let i = from; i <= to && i < this.lines.length; i++) {
            this.applyRules(this.lines[i]);
        }
    }

    *colorizeAnimated(from: number, to: number, duration = 0.4, rules?: ColorRule[]): ThreadGenerator {
        const effectiveRules = rules ?? this.colorRules;
        const anims: ThreadGenerator[] = [];
        for (let i = from; i <= to && i < this.lines.length; i++) {
            for (const rule of effectiveRules) {
                anims.push(...this.lines[i].colorizeByRuleAnimated(rule.match, rule.color, duration, rule.onlyTypes));
            }
        }
        if (anims.length > 0) yield* all(...anims);
    }

    *scrollTo(target: string | number, duration = 0.5, easing: TimingFunction = easeInOutCubic): ThreadGenerator {
        const idx = typeof target === 'number' ? target : this.code.findIndex(l => l.includes(target));
        if (idx < 0 || idx >= this.lines.length) return;
        const content = this.contentRef();
        const newOffset = -this.lineY(idx) + this.startY;
        if (Math.abs(newOffset - content.y()) > 1) {
            yield* content.y(newOffset, duration, easing);
        }
    }

    isLineVisible(lineIdx: number): boolean {
        if (lineIdx < 0 || lineIdx >= this.lines.length) return false;
        const content = this.contentRef();
        const halfClip = this.clipHeight / 2;
        const halfLine = this.cfg.lineHeight / 2;
        const y = this.lines[lineIdx].node.y() + content.y();
        return y - halfLine >= -halfClip && y + halfLine <= halfClip;
    }

    private viewMetrics() {
        return {
            contentY: this.contentRef().y(),
            halfClip: this.clipHeight / 2,
            halfLine: this.cfg.lineHeight / 2,
            topPad: Math.min(8, this.cfg.lineHeight * 0.25),
            bottomPad: this.cfg.lineHeight,
        };
    }

    private isRangeVisible(
        firstLine: number,
        lastLine: number,
        linesRef?: (CodeLine | null)[],
    ): boolean {
        const {contentY, halfClip, halfLine, topPad, bottomPad} = this.viewMetrics();
        const lines = linesRef ?? this.lines;
        const firstY = lines[firstLine]?.node.y() ?? this.lineY(firstLine);
        const lastY = lines[lastLine]?.node.y() ?? this.lineY(lastLine);
        const topEdge = firstY + contentY - halfLine;
        const bottomEdge = lastY + contentY + halfLine;

        if (bottomEdge - topEdge > this.clipHeight - topPad - bottomPad) return false;
        if (bottomEdge > halfClip - bottomPad) return false;
        if (firstLine > 0 && topEdge < -halfClip + topPad) return false;
        return true;
    }

    private resolveTailScrollMode(
        scrollStrategy: 'block' | 'blockWithTail' | 'auto',
        block: ReturnType<typeof buildMorphBlocks>[number],
        state: MorphPreparedState,
    ): 'none' | 'line' | 'jump' {
        if (scrollStrategy === 'blockWithTail') return 'line';
        if (scrollStrategy === 'block') return 'none';
        const startIdx = state.activePlan[block.start].newIndex;
        const endIdx = state.activePlan[block.end].newIndex;
        return this.isRangeVisible(startIdx, endIdx, state.result) ? 'none' : 'jump';
    }

    private *ensureRangeVisible(
        firstLine: number,
        lastLine: number,
        duration = 0.3,
        linesRef?: (CodeLine | null)[],
    ): ThreadGenerator {
        const {contentY, halfClip, halfLine, topPad, bottomPad} = this.viewMetrics();
        const content = this.contentRef();
        const lines = linesRef ?? this.lines;
        const firstY = lines[firstLine]?.node.y() ?? this.lineY(firstLine);
        const lastY = lines[lastLine]?.node.y() ?? this.lineY(lastLine);
        const topEdge = firstY + contentY - halfLine;
        const bottomEdge = lastY + contentY + halfLine;

        if (bottomEdge - topEdge > this.clipHeight - topPad - bottomPad) {
            if (firstLine > 0 && topEdge < -halfClip + topPad) {
                yield* content.y(-firstY + halfLine - halfClip + topPad, duration, easeInOutCubic);
            }
            return;
        }

        if (bottomEdge > halfClip - bottomPad) {
            yield* content.y(-lastY - halfLine + halfClip - bottomPad, duration, easeInOutCubic);
        } else if (firstLine > 0 && topEdge < -halfClip + topPad) {
            yield* content.y(-firstY + halfLine - halfClip + topPad, duration, easeInOutCubic);
        }
    }

    *dimLines(from: number, to: number, opacity = 0.25, duration = 0.4): ThreadGenerator {
        const anims: ThreadGenerator[] = [];
        for (let i = from; i <= to && i < this.lines.length; i++) {
            anims.push(this.lines[i].setOpacity(opacity, duration));
        }
        if (anims.length > 0) yield* all(...anims);
    }

    *showAllLines(duration = 0.4): ThreadGenerator {
        yield* all(...this.lines.map(l => l.setOpacity(1, duration)));
    }

    *showBackground(from: number, to: number, color: string, duration = 0.4): ThreadGenerator {
        const anims: ThreadGenerator[] = [];
        for (let i = Math.max(0, from); i <= to && i < this.lines.length; i++) {
            anims.push(this.lines[i].showBackground(color, duration));
        }
        if (anims.length > 0) yield* all(...anims);
    }

    *hideBackground(from: number, to: number, duration = 0.4): ThreadGenerator {
        const anims: ThreadGenerator[] = [];
        for (let i = Math.max(0, from); i <= to && i < this.lines.length; i++) {
            anims.push(this.lines[i].hideBackground(duration));
        }
        if (anims.length > 0) yield* all(...anims);
    }

    findLine(contains: string, from = 0): number {
        return this.code.findIndex((l, i) => i >= from && l.includes(contains));
    }

    getLine(index: number): CodeLine | null {
        return this.lines[index] ?? null;
    }

    getLineSceneY(index: number): number {
        if (index < 0 || index >= this.lines.length) return 0;
        return this.cfg.y + this.contentRef().y() + this.lineY(index);
    }

    private buildPlan(newLines: string[]): LinePlan[] {
        const diff = diffLines(this.code, newLines);
        const plan: LinePlan[] = [];
        let di = 0;

        while (di < diff.length) {
            if (diff[di].op === 'keep') {
                const e = diff[di];
                plan.push({kind: 'keep', oldIndex: e.oldIndex, newIndex: e.newIndex, newText: e.text});
                di++;
                continue;
            }

            const removes: typeof diff = [];
            const adds: typeof diff = [];
            while (di < diff.length && diff[di].op !== 'keep') {
                if (diff[di].op === 'remove') removes.push(diff[di]);
                else adds.push(diff[di]);
                di++;
            }

            const pairs = Math.min(removes.length, adds.length);
            for (let k = 0; k < pairs; k++) {
                const r = removes[k];
                const a = adds[k];
                const oldTokens = tokenizeLine(this.code[r.oldIndex], this.cfg.customTypes);
                const newTokens = tokenizeLine(a.text, this.cfg.customTypes);
                plan.push({
                    kind: 'modify',
                    oldIndex: r.oldIndex,
                    newIndex: a.newIndex,
                    newText: a.text,
                    tokenDiff: diffTokens(oldTokens, newTokens),
                });
            }
            for (let k = pairs; k < removes.length; k++) {
                plan.push({kind: 'remove', oldIndex: removes[k].oldIndex, newIndex: -1, newText: ''});
            }
            for (let k = pairs; k < adds.length; k++) {
                plan.push({kind: 'add', oldIndex: -1, newIndex: adds[k].newIndex, newText: adds[k].text});
            }
        }

        return plan;
    }

    *morphTo(newCode: string, opts: MorphOptions = {}): ThreadGenerator {
        if (!this.mounted) return;

        const o = this.resolveMorphOptions(opts);
        const lineCountBefore = this.code.length;
        const newLines = newCode.split('\n');
        const plan = this.buildPlan(newLines);
        const lh = this.cfg.lineHeight;
        yield* this.runRemovePhase(plan, o);
        const state = this.prepareMorphState(newLines, plan, lh, o);
        const stats: MorphRuntimeAccumulator = {tailScrollEvents: 0};
        yield* this.runAnimatePhase(state, o, stats);
        this.lines = state.result as CodeLine[];
        this.code = newLines;
        this.lastMorphReport = {
            blockCount: state.blocks.length,
            activeItems: state.activePlan.length,
            tailScrollEvents: stats.tailScrollEvents,
            scrollStrategy: o.scrollStrategy,
            lineCountBefore,
            lineCountAfter: newLines.length,
        };
    }

    private resolveMorphOptions(opts: MorphOptions): MorphResolvedOptions {
        return {
            removeDuration: opts.removeDuration ?? 0.2,
            moveDuration: opts.moveDuration ?? 0.3,
            charDelay: opts.charDelay ?? 0.012,
            lineDelay: opts.lineDelay ?? 0.03,
            flashRemovedColor: opts.flashRemovedColor,
            flashRemovedDuration: opts.flashRemovedDuration ?? 0.15,
            flashRemovedIncludeTypes: opts.flashRemovedIncludeTypes,
            flashRemovedExcludeTypes: opts.flashRemovedExcludeTypes ?? ['method'],
            flashRemovedErase: opts.flashRemovedErase ?? 'none',
            flashRemovedEraseCharDelay: opts.flashRemovedEraseCharDelay ?? 0.01,
            scrollStrategy: opts.scrollStrategy ?? 'blockWithTail',
            addStyle: opts.addStyle ?? 'typewriter',
            lineOrder: opts.lineOrder ?? 'sequential',
            blockOrder: opts.blockOrder ?? 'sequential',
        };
    }

    private *runRemovePhase(plan: LinePlan[], opts: MorphResolvedOptions): ThreadGenerator {
        const removes = plan.filter(p => p.kind === 'remove');
        if (removes.length > 0) {
            yield* all(...removes.map(p => this.lines[p.oldIndex].setOpacity(0, opts.removeDuration)));
        }
        if (opts.flashRemovedColor) {
            yield* this.flashRemovedTokens(
                plan,
                opts.flashRemovedColor,
                opts.flashRemovedDuration,
                opts.flashRemovedIncludeTypes,
                opts.flashRemovedExcludeTypes,
                opts.flashRemovedErase,
                opts.flashRemovedEraseCharDelay,
            );
        }
        for (const p of removes) {
            this.lines[p.oldIndex].node.remove();
        }
    }

    private prepareMorphState(
        newLines: string[],
        plan: LinePlan[],
        lh: number,
        opts: MorphResolvedOptions,
    ): MorphPreparedState {
        const result: (CodeLine | null)[] = new Array(newLines.length).fill(null);
        const modifyMap = new Map<number, CodeLine>();

        for (const p of plan) {
            if (p.kind === 'keep') {
                result[p.newIndex] = this.lines[p.oldIndex];
                continue;
            }
            if (p.kind === 'modify') {
                result[p.newIndex] = this.lines[p.oldIndex];
                modifyMap.set(p.newIndex, this.lines[p.oldIndex]);
                continue;
            }
            if (p.kind === 'add') {
                const cl = this.buildLine(p.newText, this.startY + p.newIndex * lh);
                cl.node.opacity(0);
                if (opts.addStyle === 'typewriter') cl.hideTokensInstantly();
                this.applyRules(cl);
                this.contentRef().add(cl.node);
                result[p.newIndex] = cl;
            }
        }

        const settleAnims: ThreadGenerator[] = [];
        for (const p of plan) {
            if (p.kind !== 'keep' && p.kind !== 'modify') continue;
            const cl = result[p.newIndex]!;
            const targetY = this.startY + p.newIndex * lh;
            if (Math.abs(targetY - cl.node.y()) > 0.5) {
                settleAnims.push(cl.node.y(targetY, opts.moveDuration, easeInOutCubic));
            }
        }

        const activePlan = plan.filter(p => p.kind === 'modify' || p.kind === 'add');
        const blocks = buildMorphBlocks(activePlan.map(p => p.newIndex));

        return {result, modifyMap, settleAnims, activePlan, blocks};
    }

    private *runAnimatePhase(
        state: MorphPreparedState,
        opts: MorphResolvedOptions,
        stats: MorphRuntimeAccumulator,
    ): ThreadGenerator {
        if (state.activePlan.length === 0) {
            if (state.settleAnims.length > 0) yield* all(...state.settleAnims);
            return;
        }

        const isAddOnly = state.activePlan.every(p => p.kind === 'add');
        if (isAddOnly) {
            for (const p of state.activePlan) {
                const cl = state.result[p.newIndex]!;
                state.settleAnims.push(cl.node.opacity(1, opts.moveDuration, easeInOutCubic));
                if (opts.addStyle === 'typewriter') {
                    state.settleAnims.push(cl.typewriter(opts.charDelay));
                } else {
                    state.settleAnims.push(cl.setAllTokensOpacity(1, opts.moveDuration));
                }
            }
            if (state.settleAnims.length > 0) yield* all(...state.settleAnims);
            return;
        }

        const animateBlockParallel = (block: ReturnType<typeof buildMorphBlocks>[number]): ThreadGenerator[] => {
            const blockAnims: ThreadGenerator[] = [];
            for (let bi = block.start; bi <= block.end; bi++) {
                const p = state.activePlan[bi];
                const lineAnims: ThreadGenerator[] = [];

                if (state.settleAnims.length > 0) {
                    lineAnims.push(...state.settleAnims.splice(0));
                }

                if (p.kind === 'modify') {
                    const cl = state.modifyMap.get(p.newIndex)!;
                    const newTokens = tokenizeLine(p.newText, this.cfg.customTypes);
                    const vis = this.resolveTokenVisibility(p.tokenDiff!);
                    cl.mutateInPlace(p.tokenDiff!, newTokens, vis.kept);
                    this.applyRules(cl);
                    lineAnims.push(this.typewriterNewTokens(cl, vis, opts.charDelay));
                } else {
                    const addCl = state.result[p.newIndex]!;
                    if (addCl.node.opacity() < 1) {
                        lineAnims.push(addCl.node.opacity(1, opts.moveDuration * 0.5, easeInOutCubic));
                    }
                    if (opts.addStyle === 'typewriter') {
                        lineAnims.push(addCl.typewriter(opts.charDelay));
                    }
                }

                if (lineAnims.length > 0) blockAnims.push(all(...lineAnims));
            }
            return blockAnims;
        };

        if (opts.blockOrder === 'parallel' && opts.lineOrder === 'parallel') {
            const allAnims: ThreadGenerator[] = [];
            for (const block of state.blocks) {
                allAnims.push(...animateBlockParallel(block));
            }
            if (state.settleAnims.length > 0) allAnims.push(...state.settleAnims.splice(0));
            if (allAnims.length > 0) yield* all(...allAnims);
            return;
        }

        for (const block of state.blocks) {
            yield* this.ensureRangeVisible(
                state.activePlan[block.start].newIndex,
                state.activePlan[block.safeEnd].newIndex,
                opts.moveDuration,
                state.result,
            );
            const tailScrollMode = this.resolveTailScrollMode(opts.scrollStrategy, block, state);
            const blockEndIdx = state.activePlan[block.end].newIndex;

            if (opts.lineOrder === 'parallel') {
                const blockAnims = animateBlockParallel(block);
                if (blockAnims.length > 0) yield* all(...blockAnims);
                if (opts.lineDelay > 0) yield* waitFor(opts.lineDelay);
                continue;
            }

            for (let bi = block.start; bi <= block.end; bi++) {
                const p = state.activePlan[bi];

                if (tailScrollMode === 'line' && bi > block.safeEnd) {
                    stats.tailScrollEvents++;
                    yield* this.ensureRangeVisible(p.newIndex, p.newIndex, opts.moveDuration * 0.6, state.result);
                }
                if (tailScrollMode === 'jump' && bi === block.safeEnd + 1) {
                    yield* this.ensureRangeVisible(p.newIndex, blockEndIdx, opts.moveDuration, state.result);
                }

                const lineAnims: ThreadGenerator[] = [];
                if (state.settleAnims.length > 0) {
                    lineAnims.push(...state.settleAnims.splice(0));
                }

                if (p.kind === 'modify') {
                    const cl = state.modifyMap.get(p.newIndex)!;
                    const newTokens = tokenizeLine(p.newText, this.cfg.customTypes);
                    const vis = this.resolveTokenVisibility(p.tokenDiff!);
                    cl.mutateInPlace(p.tokenDiff!, newTokens, vis.kept);
                    this.applyRules(cl);
                    lineAnims.push(this.typewriterNewTokens(cl, vis, opts.charDelay));
                } else {
                    const addCl = state.result[p.newIndex]!;
                    if (addCl.node.opacity() < 1) {
                        lineAnims.push(addCl.node.opacity(1, opts.moveDuration * 0.5, easeInOutCubic));
                    }
                    if (opts.addStyle === 'typewriter') {
                        lineAnims.push(addCl.typewriter(opts.charDelay));
                    }
                }

                if (lineAnims.length > 0) yield* all(...lineAnims);
                if (opts.lineDelay > 0) yield* waitFor(opts.lineDelay);
            }
        }

        if (state.settleAnims.length > 0) yield* all(...state.settleAnims);
    }

    private *flashRemovedTokens(
        plan: LinePlan[],
        color: string,
        duration: number,
        includeTypes?: TokenType[],
        excludeTypes: TokenType[] = ['method'],
        eraseMode: 'none' | 'reverseType' = 'none',
        eraseCharDelay = 0.01,
    ): ThreadGenerator {
        const anims: ThreadGenerator[] = [];
        const eraseAnims: ThreadGenerator[] = [];
        const include = includeTypes ? new Set<string>(includeTypes) : null;
        const exclude = new Set<string>(excludeTypes);
        for (const p of plan) {
            if (p.kind !== 'modify' || !p.tokenDiff) continue;
            const oldLine = this.lines[p.oldIndex];
            const removed = new Set(
                p.tokenDiff.filter(e => e.op === 'remove').map(e => e.oldIndex)
            );
            const mapping = this.mapTokenDataToNewIndex(oldLine.tokens);
            for (let i = 0; i < oldLine.tokens.length; i++) {
                const tokenIdx = mapping[i];
                if (tokenIdx < 0 || !removed.has(tokenIdx)) continue;
                const token = oldLine.tokens[i];
                if (include && !include.has(token.type)) continue;
                if (exclude.has(token.type)) continue;
                if (token.text.trim().length === 0) continue;
                const node = token.ref();
                anims.push(node.fill(color, duration, easeInOutCubic));
                if (eraseMode === 'reverseType') {
                    const full = token.text;
                    eraseAnims.push((function* (): ThreadGenerator {
                        for (let c = full.length; c >= 0; c--) {
                            node.text(full.slice(0, c));
                            yield* waitFor(eraseCharDelay);
                        }
                    })());
                }
            }
        }
        if (anims.length > 0) {
            yield* all(...anims);
            yield* waitFor(duration);
        }
        if (eraseAnims.length > 0) {
            yield* all(...eraseAnims);
        }
    }

    private *typewriterNewTokens(cl: CodeLine, vis: TokenVisibility, delay: number): ThreadGenerator {
        const mapping = this.mapTokenDataToNewIndex(cl.tokens);
        for (let i = 0; i < cl.tokens.length; i++) {
            const newIdx = mapping[i];
            if (newIdx < 0) continue;
            if (vis.kept.has(newIdx)) continue;

            const token = cl.tokens[i];
            const full = token.text;
            if (full.length === 0) continue;
            const isLigature = token.type === 'operator' && LIGATURE_OPERATORS.has(full);

            if (isLigature) {
                for (let c = 0; c < full.length; c++) {
                    const partTxt = cl.tokens[i + c].ref();
                    partTxt.opacity(1);
                    partTxt.text(full[c]);
                    yield* waitFor(charDelayFn(full[c], delay));
                }
                continue;
            }

            const txtNode = token.ref();
            txtNode.opacity(1);
            txtNode.text('');
            for (let c = 0; c < full.length; c++) {
                txtNode.text(full.slice(0, c + 1));
                yield* waitFor(charDelayFn(full[c], delay));
            }
        }
    }

    *animateCardFill(color: string, duration = 0.6): ThreadGenerator {
        if (!this.card) return;
        yield* this.card.node.fill(color, duration, easeInOutCubic);
    }
}
