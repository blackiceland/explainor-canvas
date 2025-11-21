import { Rect } from '@motion-canvas/2d';
/**
 * Контекст рендеринга.
 * Предоставляет доступ к теме и фабрикам примитивов.
 * Изолирует компоненты от прямого использования конструкторов Motion Canvas.
 */
export class RenderContext {
    container;
    theme;
    constructor(container, theme) {
        this.container = container;
        this.theme = theme;
    }
    createRect(props, ref) {
        const rect = new Rect({
            ...props,
        });
        if (ref) {
            ref(rect);
        }
        this.container.add(rect);
        return rect;
    }
}
