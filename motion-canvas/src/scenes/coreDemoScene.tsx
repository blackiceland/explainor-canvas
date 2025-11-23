import {makeScene2D} from '@motion-canvas/2d';
import {waitFor, all} from '@motion-canvas/core';
import {RenderContext} from '../core/RenderContext';
import {StandardTheme} from '../core/theme';
import {CircleComponent} from '../core/primitives/CircleComponent';
import {TextComponent} from '../core/primitives/TextComponent';
import {ArrowComponent} from '../core/primitives/ArrowComponent';
import {PacketComponent} from '../core/primitives/PacketComponent';

export default makeScene2D(function* (view) {
    view.fill(StandardTheme.colors.background);

    const ctx = new RenderContext(view, StandardTheme);

    // --- Components ---

    const title = new TextComponent({
        text: 'CLIENT / SERVER',
        y: -400,
        fontSize: 32,
        color: StandardTheme.colors.text.muted,
    });

    const client = new CircleComponent({
        size: 140,
        x: -300,
        y: 0,
        color: StandardTheme.colors.text.primary,
    });

    const clientLabel = new TextComponent({
        text: 'Client',
        x: -300,
        y: 120,
        fontSize: 24,
        color: StandardTheme.colors.text.primary,
    });

    const server = new CircleComponent({
        size: 140,
        x: 300,
        y: 0,
        stroke: StandardTheme.colors.text.primary,
        lineWidth: 4,
    });

    const serverLabel = new TextComponent({
        text: 'Server',
        x: 300,
        y: 120,
        fontSize: 24,
        color: StandardTheme.colors.text.primary,
    });

    const requestArrow = new ArrowComponent({
        from: [-300, -40],
        to: [300, -40],
        color: StandardTheme.colors.stroke.primary,
        lineWidth: 3,
        startOffset: 80,
        endOffset: 80,
    });

    const responseArrow = new ArrowComponent({
        from: [300, 40],
        to: [-300, 40],
        color: StandardTheme.colors.stroke.primary,
        lineWidth: 3,
        lineDash: [8, 8],
        startOffset: 80,
        endOffset: 80,
    });

    const requestPacket = new PacketComponent({
        size: 20,
        color: StandardTheme.colors.accent.blue,
    });

    const responsePacket = new PacketComponent({
        size: 20,
        color: StandardTheme.colors.accent.blue,
    });

    // --- Mounting ---

    title.mount(ctx);
    client.mount(ctx);
    clientLabel.mount(ctx);
    server.mount(ctx);
    serverLabel.mount(ctx);
    requestArrow.mount(ctx);
    responseArrow.mount(ctx);
    
    requestPacket.mount(ctx);
    responsePacket.mount(ctx);

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

    // 3. Request
    yield* requestArrow.appear();
    yield* waitFor(0.2);
    // Arrow length calc: 300 - (-300) = 600. Start/End offset 80.
    // Travel path: -220 to 220.
    yield* requestPacket.travel([-220, -40], [220, -40], 1);
    yield* waitFor(0.3);

    // 4. Processing...
    
    // 5. Response
    yield* responseArrow.appear();
    yield* waitFor(0.2);
    // Reverse for response
    yield* responsePacket.travel([220, 40], [-220, 40], 1);

    yield* waitFor(1);
});
