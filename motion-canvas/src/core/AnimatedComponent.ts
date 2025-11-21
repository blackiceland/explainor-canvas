import { RenderContext } from './RenderContext';
import { Theme } from './types';

export abstract class AnimatedComponent {

    protected theme: Theme | null = null;

    public mount(ctx: RenderContext): void {
        this.theme = ctx.theme;
        this.onMount(ctx);
    }

    protected abstract onMount(ctx: RenderContext): void;

    protected getTiming(duration?: number): number {
        if (duration !== undefined) {
            return duration;
        }
        if (this.theme === null) {
            throw new Error('Theme is not initialized. Call mount(ctx) before using timing.');
        }
        return this.theme.timing.medium;
    }

    abstract appear(duration?: number): Promise<void>;

}