import {makeScene2D} from '@motion-canvas/2d';
import {waitFor, all} from '@motion-canvas/core';
import {RenderContext} from '../core/RenderContext';
import {StandardTheme} from '../core/theme';
import {CircleComponent} from '../core/primitives/CircleComponent';
import {TextComponent} from '../core/primitives/TextComponent';
import {ArrowComponent} from '../core/primitives/ArrowComponent';

export default makeScene2D(function* (view) {
    view.fill(StandardTheme.colors.background);

    const ctx = new RenderContext(view, StandardTheme);

    // --- Components ---

    // Title
    const title = new TextComponent({
        text: 'CLIENT / SERVER',
        y: -400,
        fontSize: 32,
        color: StandardTheme.colors.text.muted,
    });

    // Client Entity (Solid Circle)
    const client = new CircleComponent({
        size: 140,
        x: -300,
        y: 0,
        color: StandardTheme.colors.text.primary, // Ink filled
    });

    const clientLabel = new TextComponent({
        text: 'Client',
        x: -300,
        y: 120,
        fontSize: 24,
        color: StandardTheme.colors.text.primary,
    });

    // Server Entity (Outlined Circle)
    const server = new CircleComponent({
        size: 140,
        x: 300,
        y: 0,
        stroke: StandardTheme.colors.text.primary, // Ink stroke
        lineWidth: 4,
    });

    const serverLabel = new TextComponent({
        text: 'Server',
        x: 300,
        y: 120,
        fontSize: 24,
        color: StandardTheme.colors.text.primary,
    });

    // Arrows
    // Radius of circle is 70.
    // We use start/endOffset for padding instead of manual coordinate calculation
    // Center to Center is 600 (-300 to 300).
    // But we want arrows slightly offset vertically.
    
    const requestArrow = new ArrowComponent({
        from: [-300, -40],
        to: [300, -40],
        color: StandardTheme.colors.accent.blue,
        lineWidth: 3,
        startOffset: 80, // 70 radius + 10 gap
        endOffset: 80,
    });

    const responseArrow = new ArrowComponent({
        from: [300, 40],
        to: [-300, 40],
        color: StandardTheme.colors.stroke.primary, // Ink
        lineWidth: 3,
        lineDash: [8, 8], // Dashed line for response
        startOffset: 80,
        endOffset: 80,
    });

    // --- Mounting ---

    title.mount(ctx);
    client.mount(ctx);
    clientLabel.mount(ctx);
    server.mount(ctx);
    serverLabel.mount(ctx);
    requestArrow.mount(ctx);
    responseArrow.mount(ctx);

    // --- Animation Flow ---

    // 1. Setup
    yield* title.appear();
    yield* waitFor(0.5);

    // 2. Entities appear
    yield* all(
        client.appear(),
        clientLabel.appear(),
        server.appear(),
        serverLabel.appear(),
    );
    yield* waitFor(0.5);

    // 3. Request Flow
    yield* requestArrow.appear();
    yield* waitFor(0.5);

    // 4. Processing/Response Flow
    yield* responseArrow.appear();
    yield* waitFor(1);
});
