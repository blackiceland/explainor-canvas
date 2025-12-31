import {Rect} from '@motion-canvas/2d';
import {all, createRef, ThreadGenerator} from '@motion-canvas/core';
import {AnimatedComponent} from '../AnimatedComponent';
import {PanelStyle} from '../panelStyle';
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
        const fill = this.props.fill ?? PanelStyle.fill;
        const showShadow = this.props.shadow !== false;

        ctx.createRect(
            {
                x: this.props.x ?? 0,
                y: this.props.y ?? 0,
                width: this.props.width,
                height: this.props.height,
                padding: this.props.padding ?? 40,
                fill: fill,
                radius: this.props.radius ?? PanelStyle.radius,
                stroke: PanelStyle.stroke,
                lineWidth: PanelStyle.lineWidth,
                opacity: this.props.opacity ?? 0,
                scale: this.props.scale ?? 0.95,
                shadowBlur: showShadow ? PanelStyle.shadowBlur : 0,
                shadowColor: showShadow ? PanelStyle.shadowColor : 'rgba(0,0,0,0)',
                shadowOffset: showShadow ? PanelStyle.shadowOffset : [0, 0],
                layout: true,
                direction: 'column',
                alignItems: 'start',
                clip: true,
            },
            this.ref
        );

        const card = this.ref();
        const shouldEdge = fill === PanelStyle.fill;
        if (!shouldEdge) return;

        const inset = 2;
        const outerRadius = (this.props.radius ?? PanelStyle.radius);
        const innerRadius = Math.max(0, outerRadius - inset);
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

