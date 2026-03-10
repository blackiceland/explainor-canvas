import {Node, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, Reference, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {tokenizeLine} from '../model/Tokenizer';
import {SyntaxTheme, IntelliJDarkTheme, getTokenColor} from '../model/SyntaxTheme';
import {CodeCard, CodeCardStyle} from './CodeCard';
import {CodeLine, TokenData} from './CodeLine';
import {getCodePaddingX, getCodePaddingY, getLineHeight} from '../shared/TextMeasure';
import {Fonts} from '../../theme';
import {diffLines, DiffEntry} from '../diff/LineDiff';

export interface ColorRule {
    match: string | RegExp;
    color: string;
    onlyTypes?: string[];
}

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

export interface TransitionOptions {
    removeDuration?: number;
    expandDuration?: number;
    typewriter?: boolean;
    charDelay?: number;
    lineDelay?: number;
}

export class CodeBlock2 {
    private readonly containerRef: Reference<Node> = createRef<Node>();
    private readonly contentRef: Reference<Node> = createRef<Node>();
    private readonly clipRef: Reference<Rect> = createRef<Rect>();
    private lines: CodeLine[] = [];
    private code: string[] = [];
    private readonly cfg: Required<CodeBlockConfig>;
    private card: CodeCard | null = null;
    private mounted = false;
    private colorRules: ColorRule[] = [];

    private contentWidth = 0;
    private leftEdge = 0;
    private startY = 0;

    private constructor(initialCode: string, config: CodeBlockConfig) {
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
            glowAccent: config.glowAccent ?? true,
        };
    }

    static create(code: string, config: CodeBlockConfig = {}): CodeBlock2 {
        return new CodeBlock2(code, config);
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
        this.contentWidth = Math.max(cardWidth - paddingX * 2, 0);

        this.card = new CodeCard({width: cardWidth, height: cardHeight, style: this.cfg.cardStyle});
        container.add(this.card.build());

        const clipHeight = Math.max(0, cardHeight - paddingY * 2);
        const clip = new Rect({
            width: this.contentWidth,
            height: clipHeight,
            radius: 0,
            fill: '#00000000',
            clip: true,
        });
        this.clipRef(clip);
        container.add(clip);

        const content = new Node({y: 0});
        this.contentRef(content);
        clip.add(content);

        this.leftEdge = -this.contentWidth / 2 + this.cfg.contentOffsetX;
        const shouldTopAlign = this.cfg.height > 0 && cardHeight !== contentHeight;
        this.startY = shouldTopAlign
            ? -clipHeight / 2 + this.cfg.contentOffsetY + this.cfg.lineHeight / 2
            : -((this.code.length - 1) / 2) * this.cfg.lineHeight;

        for (let i = 0; i < this.code.length; i++) {
            const cl = this.buildLine(this.code[i], this.startY + i * this.cfg.lineHeight);
            content.add(cl.node);
            this.lines.push(cl);
        }

        parent.add(container);
        this.mounted = true;
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

    // ── Public API: appearance ──────────────────────────────────────────

    get node(): Node { return this.containerRef(); }
    get cardRect(): Rect | null { return this.card?.node ?? null; }
    get lineCount(): number { return this.lines.length; }
    get currentCode(): string[] { return [...this.code]; }

    *appear(duration = 0.6): ThreadGenerator {
        yield* this.containerRef().opacity(1, duration, easeInOutCubic);
    }

    *disappear(duration = 0.6): ThreadGenerator {
        yield* this.containerRef().opacity(0, duration, easeInOutCubic);
    }

    // ── Public API: coloring ────────────────────────────────────────────

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

    // ── Public API: scroll ──────────────────────────────────────────────

    *scrollTo(target: string | number, duration = 0.5): ThreadGenerator {
        const idx = typeof target === 'number' ? target : this.code.findIndex(l => l.includes(target));
        if (idx < 0 || idx >= this.lines.length) return;
        const lineY = this.lines[idx].node.y();
        const content = this.contentRef();
        const newOffset = -lineY + this.startY;
        if (Math.abs(newOffset - content.y()) > 1) {
            yield* content.y(newOffset, duration, easeInOutCubic);
        }
    }

    // ── Public API: visual effects (non-mutating) ───────────────────────

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

    // ── Public API: line queries ────────────────────────────────────────

    findLine(contains: string, from = 0): number {
        return this.code.findIndex((l, i) => i >= from && l.includes(contains));
    }

    getLine(index: number): CodeLine | null {
        return this.lines[index] ?? null;
    }

    getLineSceneY(index: number): number {
        const line = this.lines[index];
        if (!line) return 0;
        return this.cfg.y + this.contentRef().y() + line.node.y();
    }

    // ── Core: transitionTo ──────────────────────────────────────────────

    *transitionTo(newCode: string, opts: TransitionOptions = {}): ThreadGenerator {
        if (!this.mounted) return;

        const {
            removeDuration = 0.25,
            expandDuration = 0.3,
            typewriter = true,
            charDelay = 0.012,
            lineDelay = 0.04,
        } = opts;

        const newLines = newCode.split('\n');
        const diff = diffLines(this.code, newLines);

        const removes: DiffEntry[] = [];
        const adds: DiffEntry[] = [];
        const keeps: DiffEntry[] = [];

        for (const entry of diff) {
            if (entry.op === 'remove') removes.push(entry);
            else if (entry.op === 'add') adds.push(entry);
            else keeps.push(entry);
        }

        const keepMap = new Map<number, number>();
        for (const e of keeps) keepMap.set(e.oldIndex, e.newIndex);

        const modifyPairs: {oldIndex: number; newIndex: number; text: string}[] = [];
        const pureRemoves: number[] = [];
        const pureAdds: {newIndex: number; text: string}[] = [];

        const usedAdds = new Set<number>();
        for (const rem of removes) {
            let bestAdd = -1;
            let bestScore = 0;
            for (let ai = 0; ai < adds.length; ai++) {
                if (usedAdds.has(ai)) continue;
                const score = this.similarity(rem.text, adds[ai].text);
                if (score > bestScore) {
                    bestScore = score;
                    bestAdd = ai;
                }
            }
            if (bestAdd >= 0 && bestScore > 0.3) {
                usedAdds.add(bestAdd);
                modifyPairs.push({
                    oldIndex: rem.oldIndex,
                    newIndex: adds[bestAdd].newIndex,
                    text: adds[bestAdd].text,
                });
            } else {
                pureRemoves.push(rem.oldIndex);
            }
        }
        for (let ai = 0; ai < adds.length; ai++) {
            if (!usedAdds.has(ai)) {
                pureAdds.push({newIndex: adds[ai].newIndex, text: adds[ai].text});
            }
        }

        const content = this.contentRef();
        const lh = this.cfg.lineHeight;

        // Phase 1: fade out purely removed lines
        if (pureRemoves.length > 0) {
            yield* all(...pureRemoves.map(idx => this.lines[idx].setOpacity(0, removeDuration)));
        }

        // Build new lines array
        const newCodeLines: (CodeLine | null)[] = new Array(newLines.length).fill(null);

        for (const [oldIdx, newIdx] of keepMap) {
            newCodeLines[newIdx] = this.lines[oldIdx];
        }

        for (const idx of pureRemoves) {
            this.lines[idx].node.remove();
        }

        // Handle modified lines: replace in-place
        for (const mod of modifyPairs) {
            const oldLine = this.lines[mod.oldIndex];
            const prefix = this.commonPrefix(this.code[mod.oldIndex], mod.text);

            const cl = this.buildLine(mod.text, oldLine.node.y());
            this.applyRules(cl);

            if (prefix.length > 0) {
                cl.showTokensUpTo(prefix.length);
                cl.hideTokensFrom(prefix.length);
            } else {
                cl.node.opacity(0);
                cl.hideTokensInstantly();
            }

            content.add(cl.node);
            newCodeLines[mod.newIndex] = cl;
        }

        // Create purely new lines
        const addedLines: {line: CodeLine; index: number}[] = [];
        for (const {newIndex, text} of pureAdds) {
            const cl = this.buildLine(text, this.startY + newIndex * lh);
            cl.node.opacity(0);
            cl.hideTokensInstantly();
            this.applyRules(cl);
            content.add(cl.node);
            newCodeLines[newIndex] = cl;
            addedLines.push({line: cl, index: newIndex});
        }

        // Phase 2: move kept + modified lines, fade in new lines
        const moveAnims: ThreadGenerator[] = [];
        for (let i = 0; i < newCodeLines.length; i++) {
            const cl = newCodeLines[i]!;
            const targetY = this.startY + i * lh;
            if (Math.abs(targetY - cl.node.y()) > 0.5) {
                moveAnims.push(cl.node.y(targetY, expandDuration, easeInOutCubic));
            }
        }
        for (const {line} of addedLines) {
            moveAnims.push(line.node.opacity(1, expandDuration, easeInOutCubic));
        }

        // Fade out old modified lines simultaneously
        for (const mod of modifyPairs) {
            const oldLine = this.lines[mod.oldIndex];
            moveAnims.push(oldLine.setOpacity(0, expandDuration * 0.6));
        }
        for (const mod of modifyPairs) {
            const cl = newCodeLines[mod.newIndex]!;
            if (cl.node.opacity() < 1) {
                moveAnims.push(cl.node.opacity(1, expandDuration, easeInOutCubic));
            }
        }

        if (moveAnims.length > 0) yield* all(...moveAnims);

        // Remove old DOM nodes for modified lines
        for (const mod of modifyPairs) {
            this.lines[mod.oldIndex].node.remove();
        }

        // Phase 3: typewriter for new + modified lines (only the new portion)
        const allTypewriterTargets = [
            ...modifyPairs.map(mod => ({
                line: newCodeLines[mod.newIndex]!,
                prefixLen: this.commonPrefix(this.code[mod.oldIndex], mod.text).length,
            })),
            ...addedLines.map(({line}) => ({line, prefixLen: 0})),
        ].sort((a, b) => {
            const ai = newCodeLines.indexOf(a.line);
            const bi = newCodeLines.indexOf(b.line);
            return ai - bi;
        });

        if (typewriter) {
            for (const {line, prefixLen} of allTypewriterTargets) {
                yield* line.typewriterFrom(prefixLen, charDelay);
                if (lineDelay > 0) yield* waitFor(lineDelay);
            }
        } else {
            for (const {line} of allTypewriterTargets) {
                line.showTokensInstantly();
            }
        }

        this.lines = newCodeLines as CodeLine[];
        this.code = newLines;
    }

    private similarity(a: string, b: string): number {
        const ta = a.trim();
        const tb = b.trim();
        if (ta.length === 0 && tb.length === 0) return 0;
        const prefix = this.commonPrefix(ta, tb);
        return prefix.length / Math.max(ta.length, tb.length);
    }

    private commonPrefix(a: string, b: string): string {
        let i = 0;
        while (i < a.length && i < b.length && a[i] === b[i]) i++;
        return a.slice(0, i);
    }

    // ── Convenience: card styling ───────────────────────────────────────

    *animateCardFill(color: string, duration = 0.6): ThreadGenerator {
        if (!this.card) return;
        yield* this.card.node.fill(color, duration, easeInOutCubic);
    }
}
