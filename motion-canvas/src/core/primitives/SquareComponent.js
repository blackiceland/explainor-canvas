import { createRef } from '@motion-canvas/core';
import { AnimatedComponent } from '../AnimatedComponent';
export class SquareComponent extends AnimatedComponent {
    props;
    ref = createRef();
    constructor(props) {
        super();
        this.props = props;
    }
    onMount(ctx) {
        ctx.createRect({
            size: this.props.size,
            fill: this.props.color ?? ctx.theme.colors.status.info,
            x: this.props.x ?? 0,
            y: this.props.y ?? 0,
            opacity: 0,
            scale: 0,
        }, this.ref);
    }
    async appear(duration) {
        const rect = this.ref();
        const time = this.getTiming(duration);
        await Promise.all([
            rect.opacity(1, time),
            rect.scale(1, time)
        ]);
    }
}
