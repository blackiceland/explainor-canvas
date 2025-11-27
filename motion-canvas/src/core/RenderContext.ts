import {Circle, CircleProps, Code, CodeProps, Line, LineProps, Node, Rect, RectProps, Txt, TxtProps} from '@motion-canvas/2d';
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
            fontFamily: this.theme.fonts.primary,
            fontWeight: 700,
            ...props
        });

        if (ref) {
            ref(text);
        }

        this.container.add(text);

        return text;
    }

    public createLine(props: LineProps, ref?: Reference<Line>): Line {
        const line = new Line({
            ...props
        });

        if (ref) {
            ref(line);
        }

        this.container.add(line);

        return line;
    }

    public createCircle(props: CircleProps, ref?: Reference<Circle>): Circle {
        const circle = new Circle({
            ...props
        });

        if (ref) {
            ref(circle);
        }

        this.container.add(circle);

        return circle;
    }
}