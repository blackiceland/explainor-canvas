import {Line} from '@motion-canvas/2d';
import {createRef, ThreadGenerator} from '@motion-canvas/core';
import {AnimatedComponent} from '../AnimatedComponent';
import {RenderContext} from '../RenderContext';

export interface ArrowProps {
    from: [number, number];
    to: [number, number];
    color?: string;
    lineWidth?: number;
    lineDash?: number[];
    startOffset?: number;
    endOffset?: number;
}

export class ArrowComponent extends AnimatedComponent {
    private readonly ref = createRef<Line>();

    constructor(private readonly props: ArrowProps) {
        super();
    }

    protected override onMount(ctx: RenderContext): void {
        ctx.createLine(
            {
                points: [this.props.from, this.props.to],
                stroke: this.props.color ?? ctx.theme.colors.stroke.primary,
                lineWidth: this.props.lineWidth ?? 3,
                end: 0,
                endArrow: true,
                arrowSize: 12,
                lineDash: this.props.lineDash,
                startOffset: this.props.startOffset ?? 0,
                endOffset: this.props.endOffset ?? 0,
            },
            this.ref
        );
    }

    override *appear(duration?: number): ThreadGenerator {
        const line = this.ref();
        const time = this.getTiming(duration);

        yield* line.end(1, time);
    }
}
