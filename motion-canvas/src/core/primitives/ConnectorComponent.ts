import {Line} from '@motion-canvas/2d';
import {createRef, ThreadGenerator} from '@motion-canvas/core';
import {AnimatedComponent} from '../AnimatedComponent';
import {RenderContext} from '../RenderContext';

export interface ConnectorProps {
    from: [number, number];
    to: [number, number];
    color?: string;
    lineWidth?: number;
    lineDash?: number[];
    opacity?: number;
}

/**
 * A simple line connector between two points.
 * Used to visually link related elements.
 */
export class ConnectorComponent extends AnimatedComponent {
    private readonly ref = createRef<Line>();

    constructor(private readonly props: ConnectorProps) {
        super();
    }

    protected override onMount(ctx: RenderContext): void {
        ctx.createLine(
            {
                points: [this.props.from, this.props.to],
                stroke: this.props.color ?? 'rgba(255,255,255,0.3)',
                lineWidth: this.props.lineWidth ?? 2,
                lineDash: this.props.lineDash ?? [8, 8],
                opacity: this.props.opacity ?? 0,
            },
            this.ref
        );
    }

    override *appear(duration?: number): ThreadGenerator {
        const line = this.ref();
        const time = this.getTiming(duration);
        yield* line.opacity(1, time);
    }

    public *disappear(duration?: number): ThreadGenerator {
        const line = this.ref();
        const time = this.getTiming(duration);
        yield* line.opacity(0, time);
    }

    public getRef() {
        return this.ref;
    }
}

