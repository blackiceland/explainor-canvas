import {Node} from '@motion-canvas/2d';
import {all, easeInOutCubic, ThreadGenerator, Vector2} from '@motion-canvas/core';
import {CodeBlock, LineGhostData} from '../components/CodeBlock';
import {Point} from '../shared/Coordinates';

export interface LineGhost {
    node: Node;
    sourceBlock: CodeBlock;
    lineIndex: number;
    originWorld: Point;
}

export function buildLineGhosts(blocks: CodeBlock[], lineIndex: number): LineGhost[] {
    const ghosts: LineGhost[] = [];

    for (const block of blocks) {
        const ghostData = block.buildLineGhost(lineIndex);
        if (ghostData) {
            ghosts.push({
                node: ghostData.node,
                sourceBlock: block,
                lineIndex,
                originWorld: ghostData.originWorld,
            });
        }
    }

    return ghosts;
}

export function mountGhosts(parent: Node, ghosts: LineGhost[], initialOpacity: number = 0): void {
    for (const ghost of ghosts) {
        ghost.node.opacity(0);
        parent.add(ghost.node);
        ghost.node.absolutePosition(new Vector2(ghost.originWorld.x, ghost.originWorld.y));
        ghost.node.opacity(initialOpacity);
    }
}

export function* flyGhostsTo(ghosts: LineGhost[], target: Point, duration: number = 0.8): ThreadGenerator {
    const animations: ThreadGenerator[] = [];
    for (const ghost of ghosts) {
        animations.push(
            ghost.node.absolutePosition(new Vector2(target.x, target.y), duration, easeInOutCubic)
        );
    }
    if (animations.length > 0) {
        yield* all(...animations);
    }
}

export function* fadeInGhosts(ghosts: LineGhost[], duration: number = 0.12): ThreadGenerator {
    const animations: ThreadGenerator[] = [];
    for (const ghost of ghosts) {
        animations.push(ghost.node.opacity(1, duration, easeInOutCubic));
    }
    if (animations.length > 0) {
        yield* all(...animations);
    }
}

export function* fadeOutGhosts(ghosts: LineGhost[], duration: number = 0.2): ThreadGenerator {
    const animations: ThreadGenerator[] = [];
    for (const ghost of ghosts) {
        animations.push(ghost.node.opacity(0, duration, easeInOutCubic));
    }
    if (animations.length > 0) {
        yield* all(...animations);
    }
}
