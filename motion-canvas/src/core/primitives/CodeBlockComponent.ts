import {Rect, Code} from '@motion-canvas/2d';
import {all, createRef, ThreadGenerator} from '@motion-canvas/core';
import {AnimatedComponent} from '../AnimatedComponent';
import {RenderContext} from '../RenderContext';

export interface CodeBlockProps {
    code: string;
    x?: number;
    y?: number;
    fontSize?: number;
    width?: number;
    padding?: number;
    opacity?: number;
    scale?: number;
    // 'dark' = dark bg, light code (default)
    // 'light' = light bg, dark code (inverted)
    theme?: 'dark' | 'light'; 
}

export class CodeBlockComponent extends AnimatedComponent {
    private readonly cardRef = createRef<Rect>();
    private readonly codeRef = createRef<Code>();

    constructor(private readonly props: CodeBlockProps) {
        super();
    }

    protected override onMount(ctx: RenderContext): void {
        const isDark = this.props.theme !== 'light'; 
        
        // Colors
        const bgColor = isDark ? '#13151A' : '#F0F0F0';
        const shadow = isDark ? 'rgba(0,0,0,0.50)' : 'rgba(0,0,0,0.10)';
        const borderColor = isDark ? '#262A34' : 'transparent';

        // Container Card
        ctx.createRect(
            {
                x: this.props.x ?? 0,
                y: this.props.y ?? 0,
                width: this.props.width,
                layout: true,
                direction: 'column',
                padding: this.props.padding ?? 30,
                fill: bgColor,
                stroke: borderColor,
                lineWidth: 1,
                radius: 28,
                opacity: this.props.opacity ?? 0,
                scale: this.props.scale ?? 0.95,
                shadowBlur: 44,
                shadowColor: shadow,
                shadowOffset: [-16, 22],
                alignItems: 'start',
                clip: true, // Clip content
            },
            this.cardRef
        );

        const codeNode = new Code({
            code: this.props.code,
            fontFamily: ctx.theme.fonts.code,
            fontSize: this.props.fontSize ?? 24,
            lineHeight: (this.props.fontSize ?? 24) * 1.5,
        });

        this.codeRef(codeNode);
        this.cardRef().add(codeNode);
    }

    override *appear(duration?: number): ThreadGenerator {
        const card = this.cardRef();
        const time = this.getTiming(duration);
        yield* all(
            card.opacity(1, time),
            card.scale(1, time)
        );
    }

    public *dim(duration?: number): ThreadGenerator {
        const card = this.cardRef();
        const time = this.getTiming(duration);
        // Dim the whole card
        yield* card.opacity(0.3, time); 
    }

    public getCardRef() {
        return this.cardRef;
    }
    
    public getCodeRef() {
        return this.codeRef;
    }
}
