import {Node, Gradient, Rect} from '@motion-canvas/2d';
import {Vector2} from '@motion-canvas/core';
import {Colors, Screen} from './theme';

export function applyBackground(view: Node): void {
    const gradient = new Gradient({
        type: 'linear',
        from: new Vector2(-Screen.width / 2, Screen.height / 2),
        to: new Vector2(Screen.width / 2, -Screen.height / 2),
        stops: [
            {offset: 0, color: Colors.background.from},
            {offset: 1, color: Colors.background.to},
        ],
    });

    const base = new Rect({
        width: Screen.width,
        height: Screen.height,
        fill: gradient,
    });

    const spotlight = new Gradient({
        type: 'radial',
        from: new Vector2(Screen.width * 0.12, -Screen.height * 0.12),
        to: new Vector2(Screen.width * 0.12, -Screen.height * 0.12),
        fromRadius: 0,
        toRadius: Screen.width * 0.95,
        stops: [
            // Slightly warm highlight (adds "life" without warming the whole background)
            {offset: 0, color: 'rgba(246,231,212,0.055)'},
            {offset: 1, color: 'rgba(255,255,255,0)'},
        ],
    });

    const glow = new Rect({
        width: Screen.width,
        height: Screen.height,
        fill: spotlight,
        opacity: 1,
    });

    view.add(base);
    view.add(glow);
}








