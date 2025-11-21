import {Txt} from '@motion-canvas/2d';
import {all, createRef, ThreadGenerator} from '@motion-canvas/core';
import {AnimatedComponent} from '../AnimatedComponent';
import {RenderContext} from '../RenderContext';

export interface TextProps {
    text: string;
    x?: number;
    y?: number;
    fontSize?: number;
    color?: string;
    maxWidth?: number;
    textAlign?: 'left' | 'center' | 'right';
}

export class TextComponent extends AnimatedComponent {
    private readonly ref = createRef<Txt>();

    constructor(private readonly props: TextProps) {
        super();
    }

    protected override onMount(ctx: RenderContext): void {
        ctx.createText(
            {
                text: this.props.text,
                x: this.props.x ?? 0,
                y: this.props.y ?? 0,
                fontSize: this.props.fontSize ?? 32,
                fill: this.props.color ?? ctx.theme.colors.text.primary,
                maxWidth: this.props.maxWidth,
                textAlign: this.props.textAlign ?? 'center',
                opacity: 0
            },
            this.ref
        );
    }

    override *appear(duration?: number): ThreadGenerator {
        const txt = this.ref();
        const time = this.getTiming(duration);

        yield* all(
            txt.opacity(1, time)
        );
    }
}