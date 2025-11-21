import {makeScene2D} from '@motion-canvas/2d';
import {waitFor} from '@motion-canvas/core';
import {RenderContext} from '../core/RenderContext';
import {StandardTheme} from '../core/theme';
import {SquareComponent} from '../core/primitives/SquareComponent';
import {TextComponent} from '../core/primitives/TextComponent';

export default makeScene2D(function* (view) {
    const ctx = new RenderContext(view, StandardTheme);

    const square = new SquareComponent({
        size: 160,
        x: 0,
        y: 0
    });

    const label = new TextComponent({
        text: 'Demo',
        x: 0,
        y: 120,
        fontSize: 40,
        color: '#f10808'
    });

    square.mount(ctx);
    label.mount(ctx);

    yield* square.appear();
    yield* label.appear();
    yield* waitFor(1);
});