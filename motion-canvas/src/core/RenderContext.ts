import {Node, Rect, RectProps} from '@motion-canvas/2d';
import {Reference} from '@motion-canvas/core';
import {Theme} from './types';

/**
 * Контекст рендеринга.
 * Предоставляет доступ к теме и фабрикам примитивов.
 * Изолирует компоненты от прямого использования конструкторов Motion Canvas.
 */
export class RenderContext {

    constructor(
        private readonly container: Node,
        public readonly theme: Theme
    ) {
    }

    public createRect(props: RectProps, ref?: Reference<Rect>): Rect {
        console.log('RenderContext: createRect called with', props);
        const rect = new Rect({
            ...props,
        });

        if (ref) {
            ref(rect);
        }

        this.container.add(rect);
        console.log('RenderContext: rect added to container', this.container);

        return rect;
    }
}