import {Circle} from '@motion-canvas/2d';
import {all, chain, createRef, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {AnimatedComponent} from '../AnimatedComponent';
import {RenderContext} from '../RenderContext';

export interface PacketProps {
    size?: number;
    color?: string;
}

export class PacketComponent extends AnimatedComponent {
    private readonly ref = createRef<Circle>();

    constructor(private readonly props: PacketProps = {}) {
        super();
    }

    protected override onMount(ctx: RenderContext): void {
        ctx.createCircle(
            {
                size: this.props.size ?? 24,
                fill: this.props.color ?? ctx.theme.colors.accent,
                opacity: 0,
                position: [0, 0]
            },
            this.ref
        );
    }

    // Not used for packet usually, but needed for abstract class
    override *appear(duration?: number): ThreadGenerator {
         const circle = this.ref();
         yield* circle.opacity(1, this.getTiming(duration));
    }

    public *travel(
        from: [number, number],
        to: [number, number],
        duration?: number
    ): ThreadGenerator {
        const circle = this.ref();
        const time = this.getTiming(duration);

        // Setup initial state
        circle.position(from);
        circle.opacity(1);
        circle.scale(1);

        // Move and fade out as it approaches the destination
        yield* all(
            circle.position(to, time),
            chain(
                waitFor(time * 0.6),
                circle.opacity(0, time * 0.4),
            ),
        );
    }
}
