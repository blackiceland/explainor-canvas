export class AnimatedComponent {
    theme = null;
    mount(ctx) {
        this.theme = ctx.theme;
        this.onMount(ctx);
    }
    getTiming(duration) {
        if (duration !== undefined) {
            return duration;
        }
        if (this.theme === null) {
            throw new Error('Theme is not initialized. Call mount(ctx) before using timing.');
        }
        return this.theme.timing.medium;
    }
}
