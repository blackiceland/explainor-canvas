import {Rect, Code} from '@motion-canvas/2d';
import {all, createRef, ThreadGenerator} from '@motion-canvas/core';
import {AnimatedComponent} from '../AnimatedComponent';
import {RenderContext} from '../RenderContext';
import {Colors} from '../theme';
import {PanelStyle} from '../panelStyle';

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
        const bgColor = isDark ? Colors.surface : '#F0F0F0';
        const shadow = isDark ? PanelStyle.shadowColor : 'rgba(0,0,0,0.10)';
        const borderColor = isDark ? PanelStyle.stroke : 'transparent';

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
                radius: PanelStyle.radius,
                opacity: this.props.opacity ?? 0,
                scale: this.props.scale ?? 0.95,
                shadowBlur: PanelStyle.shadowBlur,
                shadowColor: shadow,
                shadowOffset: PanelStyle.shadowOffset,
                alignItems: 'start',
                clip: true, // Clip content
            },
            this.cardRef
        );

        if (isDark) {
            const card = this.cardRef();
            const inset = 2;
            const innerRadius = Math.max(0, PanelStyle.radius - inset);

            card.add(
                new Rect({
                    width: '100%',
                    height: 2,
                    y: () => -card.height() / 2 + 1,
                    fill: 'rgba(255,255,255,0.06)',
                    opacity: 0.7,
                    layout: false,
                }),
            );

            card.add(
                new Rect({
                    width: () => card.width() - inset * 2,
                    height: () => card.height() - inset * 2,
                    radius: innerRadius,
                    fill: 'rgba(0,0,0,0)',
                    stroke: 'rgba(255,255,255,0.045)',
                    lineWidth: 1,
                    layout: false,
                }),
            );
        }

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
