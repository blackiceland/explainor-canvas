import { Rect } from '@motion-canvas/2d';
import { createRef, all, ThreadGenerator } from '@motion-canvas/core';
import { AnimatedComponent } from '../AnimatedComponent';
import { RenderContext } from '../RenderContext';

export interface SquareProps {
    size: number;
    color?: string;
    x?: number;
    y?: number;
}

export class SquareComponent extends AnimatedComponent {

    private readonly ref = createRef<Rect>();

    constructor(private readonly props: SquareProps) {
        super();
    }

    protected override onMount(ctx: RenderContext): void {
        ctx.createRect(
            {
                size: this.props.size,
                fill: this.props.color ?? ctx.theme.colors.status.info,
                x: this.props.x ?? 0,
                y: this.props.y ?? 0,
                opacity: 0,
                scale: 0,
            },
            this.ref
        );
    }

    override *appear(duration?: number): ThreadGenerator {
        const rect = this.ref();
        const time = this.getTiming(duration);

        yield* all(
            rect.opacity(1, time),
            rect.scale(1, time)
        );
    }
}