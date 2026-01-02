import {Node} from '@motion-canvas/2d';
import {Vector2} from '@motion-canvas/core';

export interface Point {
    readonly x: number;
    readonly y: number;
}

export function getWorldPosition(node: Node): Point {
    const pos = node.absolutePosition();
    return {x: pos.x, y: pos.y};
}

export function setWorldPosition(node: Node, point: Point): void {
    node.absolutePosition(new Vector2(point.x, point.y));
}

export function localToWorld(node: Node, localPoint: Point): Point {
    const nodeWorld = node.absolutePosition();
    const scale = node.scale();
    return {
        x: nodeWorld.x + localPoint.x * scale.x,
        y: nodeWorld.y + localPoint.y * scale.y,
    };
}

export function worldToLocal(node: Node, worldPoint: Point): Point {
    const nodeWorld = node.absolutePosition();
    const scale = node.scale();
    return {
        x: (worldPoint.x - nodeWorld.x) / scale.x,
        y: (worldPoint.y - nodeWorld.y) / scale.y,
    };
}

export function deltaVector(from: Point, to: Point): Point {
    return {
        x: to.x - from.x,
        y: to.y - from.y,
    };
}














