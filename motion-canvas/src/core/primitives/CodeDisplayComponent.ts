import {Code, lines} from '@motion-canvas/2d';
import {all, createRef, ThreadGenerator, map} from '@motion-canvas/core';
import {AnimatedComponent} from '../AnimatedComponent';
import {RenderContext} from '../RenderContext';

export type CodeTheme = 'dark' | 'light';

export interface CodeDisplayProps {
    code: string;
    x?: number;
    y?: number;
    fontSize?: number;
    theme?: CodeTheme;
    opacity?: number;
}

/**
 * Code display component with theme support.
 * 
 * - 'dark' theme: Light colored code (default syntax highlighting)
 * - 'light' theme: Dark colored code (inverted for light backgrounds)
 * 
 * Uses drawHooks to override token colors for inversion.
 */
export class CodeDisplayComponent extends AnimatedComponent {
    private readonly ref = createRef<Code>();
    private currentTheme: CodeTheme = 'dark';

    constructor(private readonly props: CodeDisplayProps) {
        super();
        this.currentTheme = props.theme ?? 'dark';
    }

    protected override onMount(ctx: RenderContext): void {
        const isLight = this.currentTheme === 'light';
        
        // For light theme, we override the token drawing to use dark colors
        const drawHooks = isLight ? {
            token: (
                canvasCtx: CanvasRenderingContext2D,
                text: string,
                position: { x: number; y: number },
                color: string,
                selection: number
            ) => {
                // Convert any color to dark for light backgrounds
                // Simple approach: use a fixed dark color
                canvasCtx.fillStyle = '#1a1a1a'; // Ink color
                canvasCtx.fillText(text, position.x, position.y);
            }
        } : undefined;

        const codeNode = new Code({
            code: this.props.code,
            fontFamily: ctx.theme.fonts.code,
            fontSize: this.props.fontSize ?? 22,
            x: this.props.x ?? 0,
            y: this.props.y ?? 0,
            opacity: this.props.opacity ?? 1,
            drawHooks: drawHooks,
        });

        this.ref(codeNode);
        
        // Note: This component creates a standalone Code node.
        // It should be added to a container (Card) or view externally.
    }

    /**
     * Get the underlying Code node to add to a parent.
     */
    public getNode(): Code {
        return this.ref();
    }

    public getRef() {
        return this.ref;
    }

    override *appear(duration?: number): ThreadGenerator {
        const code = this.ref();
        const time = this.getTiming(duration);
        yield* code.opacity(1, time);
    }

    public *dim(opacity: number = 0.2, duration?: number): ThreadGenerator {
        const code = this.ref();
        const time = this.getTiming(duration);
        yield* code.opacity(opacity, time);
    }

    /**
     * Highlight specific lines of code using selection.
     */
    public *highlightLines(start: number, end: number, duration?: number): ThreadGenerator {
        const code = this.ref();
        const time = this.getTiming(duration);
        yield* code.selection(lines(start, end), time);
    }

    /**
     * Clear selection (show all code equally).
     */
    public *clearSelection(duration?: number): ThreadGenerator {
        const code = this.ref();
        const time = this.getTiming(duration);
        yield* code.selection([], time);
    }
}

