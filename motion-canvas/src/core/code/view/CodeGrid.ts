import {Node, Txt} from '@motion-canvas/2d';
import {all, createRef, Reference, ThreadGenerator} from '@motion-canvas/core';
import {CodeDocument} from '../model/CodeDocument';

export interface CodeGridConfig {
    x?: number;
    y?: number;
    width?: number;
    fontSize?: number;
    lineHeight?: number;
    fontFamily?: string;
    fill?: string;
}

export class CodeGrid {
    private readonly containerRef = createRef<Node>();
    private readonly lineRefs: Reference<Txt>[] = [];
    private readonly document: CodeDocument;
    private readonly config: Required<CodeGridConfig>;

    private constructor(document: CodeDocument, config: CodeGridConfig) {
        this.document = document;
        this.config = {
            x: config.x ?? 0,
            y: config.y ?? 0,
            width: config.width ?? 600,
            fontSize: config.fontSize ?? 20,
            lineHeight: config.lineHeight ?? (config.fontSize ?? 20) * 1.5,
            fontFamily: config.fontFamily ?? 'JetBrains Mono, monospace',
            fill: config.fill ?? '#d4d4d4',
        };
    }

    public static create(document: CodeDocument, config: CodeGridConfig = {}): CodeGrid {
        return new CodeGrid(document, config);
    }

    public static fromCode(code: string, config: CodeGridConfig = {}): CodeGrid {
        return new CodeGrid(CodeDocument.from(code), config);
    }

    public mount(parent: Node): void {
        const container = new Node({
            x: this.config.x,
            y: this.config.y,
            opacity: 0,
        });
        this.containerRef(container);

        const n = this.document.lineCount;
        const centerOffset = (n - 1) / 2;
        const leftEdge = -this.config.width / 2;

        for (let i = 0; i < n; i++) {
            const ref = createRef<Txt>();
            this.lineRefs.push(ref);

            const y = (i - centerOffset) * this.config.lineHeight;

            const txt = new Txt({
                text: this.document.getLine(i) ?? '',
                fontFamily: this.config.fontFamily,
                fontSize: this.config.fontSize,
                fill: this.config.fill,
                y: y,
                x: leftEdge,
                offset: [-1, 0],
            });
            ref(txt);
            container.add(txt);
        }

        parent.add(container);
    }

    public getLineNode(index: number): Txt | undefined {
        return this.lineRefs[index]?.();
    }

    public getLineNodes(from: number, to: number): Txt[] {
        const nodes: Txt[] = [];
        for (let i = from; i <= to && i < this.lineRefs.length; i++) {
            const node = this.lineRefs[i]?.();
            if (node) nodes.push(node);
        }
        return nodes;
    }

    public getLineY(index: number): number {
        const n = this.document.lineCount;
        const centerOffset = (n - 1) / 2;
        return this.config.y + (index - centerOffset) * this.config.lineHeight;
    }

    public getLineWorldY(index: number): number {
        return this.getLineY(index);
    }

    public *appear(duration: number = 0.6): ThreadGenerator {
        yield* this.containerRef().opacity(1, duration);
    }

    public *disappear(duration: number = 0.6): ThreadGenerator {
        yield* this.containerRef().opacity(0, duration);
    }

    public *highlight(from: number, to: number, duration: number = 0.4): ThreadGenerator {
        const animations: ThreadGenerator[] = [];
        for (let i = 0; i < this.lineRefs.length; i++) {
            const node = this.lineRefs[i]();
            const targetOpacity = (i >= from && i <= to) ? 1 : 0.25;
            animations.push(node.opacity(targetOpacity, duration));
        }
        yield* all(...animations);
    }

    public *dim(from: number, to: number, opacity: number = 0.25, duration: number = 0.4): ThreadGenerator {
        const animations: ThreadGenerator[] = [];
        for (let i = from; i <= to && i < this.lineRefs.length; i++) {
            animations.push(this.lineRefs[i]().opacity(opacity, duration));
        }
        yield* all(...animations);
    }

    public *dimAll(opacity: number = 0.25, duration: number = 0.4): ThreadGenerator {
        const animations: ThreadGenerator[] = [];
        for (const ref of this.lineRefs) {
            animations.push(ref().opacity(opacity, duration));
        }
        yield* all(...animations);
    }

    public *moveTo(x: number, y: number, duration: number = 1): ThreadGenerator {
        yield* this.containerRef().position([x, y], duration);
    }

    public extract(from: number, to: number): CodeGrid {
        const slicedDoc = this.document.slice(from, to);

        const sourceY = this.getLineWorldY(from);
        const extractedCenterOffset = (slicedDoc.lineCount - 1) / 2;
        const newY = sourceY + extractedCenterOffset * this.config.lineHeight;

        return CodeGrid.create(slicedDoc, {
            x: this.config.x,
            y: newY,
            width: this.config.width,
            fontSize: this.config.fontSize,
            lineHeight: this.config.lineHeight,
            fontFamily: this.config.fontFamily,
            fill: this.config.fill,
        });
    }

    public get x(): number {
        return this.config.x;
    }

    public get y(): number {
        return this.config.y;
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
}
