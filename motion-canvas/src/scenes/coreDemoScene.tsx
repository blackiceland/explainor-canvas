import {makeScene2D} from '@motion-canvas/2d';
import {waitFor} from '@motion-canvas/core';
import {RenderContext} from '../core/RenderContext';
import {StandardTheme} from '../core/theme';
import {SquareComponent} from '../core/primitives/SquareComponent';

export default makeScene2D(function* (view) {
    const ctx = new RenderContext(view, StandardTheme);

    const square = new SquareComponent({
        size: 160,
        x: 0,
        y: 0
    });

    square.mount(ctx);

    yield* waitFor(2);
});