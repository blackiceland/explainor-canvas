import {Rect} from '@motion-canvas/2d';
import {all, createRef, ThreadGenerator} from '@motion-canvas/core';
import {AnimatedComponent} from '../AnimatedComponent';
import {RenderContext} from '../RenderContext';

export interface CardProps {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    padding?: number;
    fill?: string;
    radius?: number;
    opacity?: number;
    scale?: number;
    shadow?: boolean;
}

/**
 * Pure visual container - a card with background, rounded corners, and optional shadow.
 * Single Responsibility: Just a box.
 */
export class CardComponent extends AnimatedComponent {
    private readonly ref = createRef<Rect>();

    constructor(private readonly props: CardProps) {
        super();
    }

    protected override onMount(ctx: RenderContext): void {
        const fill = this.props.fill ?? '#111111';
        const showShadow = this.props.shadow !== false;

        ctx.createRect(
            {
                x: this.props.x ?? 0,
                y: this.props.y ?? 0,
                width: this.props.width,
                height: this.props.height,
                padding: this.props.padding ?? 40,
                fill: fill,
                radius: this.props.radius ?? 12,
                opacity: this.props.opacity ?? 0,
                scale: this.props.scale ?? 0.95,
                shadowBlur: showShadow ? 30 : 0,
                shadowColor: showShadow ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
                layout: true,
                direction: 'column',
                alignItems: 'start',
                clip: true,
            },
            this.ref
        );
    }

    override *appear(duration?: number): ThreadGenerator {
        const card = this.ref();
        const time = this.getTiming(duration);
        yield* all(
            card.opacity(1, time),
            card.scale(1, time)
        );
    }

    public *dim(opacity: number = 0.3, duration?: number): ThreadGenerator {
        const card = this.ref();
        const time = this.getTiming(duration);
        yield* card.opacity(opacity, time);
    }

    public *moveTo(x: number, y: number, duration?: number): ThreadGenerator {
        const card = this.ref();
        const time = this.getTiming(duration);
        yield* card.position([x, y], time);
    }

    public getRef() {
        return this.ref;
    }

    /**
     * Add a child node to this card (for composition).
     */
    public addChild(node: any): void {
        this.ref().add(node);
    }
}

