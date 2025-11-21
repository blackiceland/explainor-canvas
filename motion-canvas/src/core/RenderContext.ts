import {Node, Rect, RectProps, Txt, TxtProps} from '@motion-canvas/2d';
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
        const rect = new Rect({
            ...props
        });

        if (ref) {
            ref(rect);
        }

        this.container.add(rect);

        return rect;
    }

    public createText(props: TxtProps, ref?: Reference<Txt>): Txt {
        const text = new Txt({
            ...props
        });

        if (ref) {
            ref(text);
        }

        this.container.add(text);

        return text;
    }
}