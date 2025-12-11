import {Node, Gradient} from '@motion-canvas/2d';
import {Vector2} from '@motion-canvas/core';
import {Colors, Screen} from './theme';

export function applyBackground(view: Node): void {
    const gradient = new Gradient({
        type: 'linear',
        from: new Vector2(-Screen.width / 2, -Screen.height / 2),
        to: new Vector2(Screen.width / 2, Screen.height / 2),
        stops: [
            {offset: 0, color: Colors.background.from},
            {offset: 1, color: Colors.background.to},
        ],
    });
    (view as any).fill(gradient);
}








