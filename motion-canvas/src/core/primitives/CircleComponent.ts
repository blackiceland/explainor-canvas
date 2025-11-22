import { Circle } from '@motion-canvas/2d';
import { createRef, all, ThreadGenerator } from '@motion-canvas/core';
import { AnimatedComponent } from '../AnimatedComponent';
import { RenderContext } from '../RenderContext';

export interface CircleProps {
    size: number;
    color?: string; // fill color
    stroke?: string; // stroke color
    lineWidth?: number;
    x?: number;
    y?: number;
}

export class CircleComponent extends AnimatedComponent {
    private readonly ref = createRef<Circle>();

    constructor(private readonly props: CircleProps) {
        super();
    }

    protected override onMount(ctx: RenderContext): void {
        ctx.createCircle(
            {
                size: this.props.size,
                fill: this.props.color,
                stroke: this.props.stroke,
                lineWidth: this.props.lineWidth ?? 0,
                x: this.props.x ?? 0,
                y: this.props.y ?? 0,
                opacity: 0,
                scale: 0,
            },
            this.ref
        );
    }

    override *appear(duration?: number): ThreadGenerator {
        const circle = this.ref();
        const time = this.getTiming(duration);

        yield* all(
            circle.opacity(1, time),
            circle.scale(1, time)
        );
    }
}

