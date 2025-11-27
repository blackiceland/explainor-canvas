import {Layout, Node} from '@motion-canvas/2d';
import {all, createRef, Reference, ThreadGenerator, Vector2} from '@motion-canvas/core';
import {CodeLine} from './CodeLine';
import {Theme} from '../types';

export interface CodeBlockProps {
    code: string;
    x?: number;
    y?: number;
    fontSize?: number;
    lineHeight?: number;
    fontFamily?: string;
    fill?: string;
    opacity?: number;
}

export class CodeBlock {
    private readonly containerRef = createRef<Layout>();
    private readonly lines: CodeLine[] = [];
    private readonly props: CodeBlockProps;
    private theme: Theme | null = null;

    constructor(props: CodeBlockProps) {
        this.props = props;
        this.parseCode(props.code);
    }

    private parseCode(code: string): void {
        const rawLines = code.split('\n');
        rawLines.forEach((text, index) => {
            this.lines.push(new CodeLine(index, text));
        });
    }

    public mount(parent: Node, theme: Theme): void {
        this.theme = theme;

        const fontSize = this.props.fontSize ?? 20;
        const lineHeight = this.props.lineHeight ?? fontSize * 1.5;
        const fontFamily = this.props.fontFamily ?? theme.fonts.code;
        const fill = this.props.fill ?? '#d4d4d4';

        const layout = new Layout({
            direction: 'column',
            gap: lineHeight - fontSize,
            x: this.props.x ?? 0,
            y: this.props.y ?? 0,
            opacity: this.props.opacity ?? 0,
            layout: true,
        });

        this.containerRef(layout);

        for (const line of this.lines) {
            const node = line.createNode({fontFamily, fontSize, fill});
            layout.add(node);
        }

        parent.add(layout);
    }

    public getRef(): Reference<Layout> {
        return this.containerRef;
    }

    public getLine(index: number): CodeLine | undefined {
        return this.lines[index];
    }

    public getLines(from: number, to: number): CodeLine[] {
        return this.lines.slice(from, to + 1);
    }

    public getAllLines(): CodeLine[] {
        return [...this.lines];
    }

    public lineCount(): number {
        return this.lines.length;
    }

    public *appear(duration: number = 0.6): ThreadGenerator {
        yield* this.containerRef().opacity(1, duration);
    }

    public *disappear(duration: number = 0.6): ThreadGenerator {
        yield* this.containerRef().opacity(0, duration);
    }

    public *highlightLines(from: number, to: number, duration: number = 0.4): ThreadGenerator {
        const animations: ThreadGenerator[] = [];

        for (let i = 0; i < this.lines.length; i++) {
            const node = this.lines[i].node();
            const targetOpacity = (i >= from && i <= to) ? 1 : 0.25;
            animations.push(node.opacity(targetOpacity, duration));
        }

        yield* all(...animations);
    }

    public *dimLines(from: number, to: number, opacity: number = 0.25, duration: number = 0.4): ThreadGenerator {
        const animations: ThreadGenerator[] = [];

        for (let i = from; i <= to && i < this.lines.length; i++) {
            animations.push(this.lines[i].node().opacity(opacity, duration));
        }

        yield* all(...animations);
    }

    public *resetOpacity(duration: number = 0.4): ThreadGenerator {
        const animations: ThreadGenerator[] = [];

        for (const line of this.lines) {
            animations.push(line.node().opacity(1, duration));
        }

        yield* all(...animations);
    }

    public *moveTo(x: number, y: number, duration: number = 1): ThreadGenerator {
        yield* this.containerRef().position([x, y], duration);
    }

    public extractLines(from: number, to: number): {codeBlock: CodeBlock; sourcePosition: Vector2} {
        const extractedText = this.lines
            .slice(from, to + 1)
            .map(l => l.text)
            .join('\n');

        const firstLine = this.lines[from];
        const sourcePosition = firstLine.absolutePosition();

        const newBlock = new CodeBlock({
            code: extractedText,
            x: sourcePosition.x,
            y: sourcePosition.y,
            fontSize: this.props.fontSize,
            lineHeight: this.props.lineHeight,
            fontFamily: this.props.fontFamily,
            fill: this.props.fill,
            opacity: 1,
        });

        return {codeBlock: newBlock, sourcePosition};
    }

    public *flyLinesTo(from: number, to: number, targetX: number, targetY: number, duration: number = 1): ThreadGenerator {
        const linesToFly = this.getLines(from, to);
        const parent = this.containerRef().parent();
        
        if (!parent) return;

        const fontSize = this.props.fontSize ?? 20;
        const lineHeight = this.props.lineHeight ?? fontSize * 1.5;
        const totalHeight = linesToFly.length * lineHeight;
        
        const layoutPos = this.containerRef().absolutePosition();

        const nodesData: {node: Node; startPos: Vector2; endPos: Vector2}[] = [];

        for (let i = 0; i < linesToFly.length; i++) {
            const line = linesToFly[i];
            const node = line.node();
            
            const localPos = node.position();
            const worldPos = new Vector2(
                layoutPos.x + localPos.x,
                layoutPos.y + localPos.y
            );
            
            const targetLineY = targetY - totalHeight / 2 + i * lineHeight + lineHeight / 2;
            
            nodesData.push({
                node,
                startPos: worldPos,
                endPos: new Vector2(targetX, targetLineY),
            });
        }

        for (const data of nodesData) {
            data.node.remove();
            data.node.position(data.startPos);
            parent.add(data.node);
        }

        const animations: ThreadGenerator[] = [];
        for (const data of nodesData) {
            animations.push(data.node.position(data.endPos, duration));
        }

        yield* all(...animations);
    }
}
