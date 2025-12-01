import {Node} from '@motion-canvas/2d';
import {all, delay, ThreadGenerator} from '@motion-canvas/core';
import {CodeGrid, CodeAnchor} from '../view/CodeGrid';

export interface ExtractedBlock {
    grid: CodeGrid;
    sourceGrid: CodeGrid;
    range: [number, number];
}

export interface ExtractSpec {
    grid: CodeGrid;
    range: [number, number];
}

export interface ExtractResult {
    blocks: ExtractedBlock[];
    animate: () => ThreadGenerator;
}

export interface MorphResult {
    target: CodeGrid;
    animate: () => ThreadGenerator;
}

export interface InjectResult {
    calls: CodeGrid[];
    animate: () => ThreadGenerator;
}

export function extractLines(
    parent: Node,
    specs: ExtractSpec[],
    duration: number = 0.5
): ExtractResult {
    const blocks: ExtractedBlock[] = [];

    for (const spec of specs) {
        const extracted = spec.grid.extract(spec.range[0], spec.range[1]);
        extracted.mount(parent);
        
        blocks.push({
            grid: extracted,
            sourceGrid: spec.grid,
            range: spec.range,
        });
    }

    function* animate(): ThreadGenerator {
        const animations: ThreadGenerator[] = [];
        for (const spec of specs) {
            animations.push(spec.grid.hideRanges([spec.range], duration));
        }
        for (const block of blocks) {
            animations.push(block.grid.appear(duration * 0.6));
        }
        yield* all(...animations);
    }

    return {blocks, animate};
}

export function* mergeToCenter(
    blocks: ExtractedBlock[] | CodeGrid[],
    centerX: number = 0,
    centerY: number = 0,
    duration: number = 0.8
): ThreadGenerator {
    const grids = blocks.map(b => 'grid' in b ? b.grid : b);
    const animations: ThreadGenerator[] = [];
    for (const grid of grids) {
        animations.push(grid.moveTo(centerX, centerY, duration));
    }
    yield* all(...animations);
}

export function morphTo(
    parent: Node,
    sources: ExtractedBlock[] | CodeGrid[],
    targetCode: string,
    config: {
        x?: number;
        y?: number;
        fontSize?: number;
        duration?: number;
    } = {}
): MorphResult {
    const grids = sources.map(b => 'grid' in b ? b.grid : b);
    const firstGrid = grids[0];
    
    const duration = config.duration ?? 0.6;
    const x = config.x ?? firstGrid.x;
    const y = config.y ?? firstGrid.y;
    const fontSize = config.fontSize ?? firstGrid.fontSize;

    const target = CodeGrid.fromCode(targetCode, {
        x,
        y,
        fontSize,
        fontFamily: firstGrid.fontFamily,
        theme: firstGrid.theme,
        width: firstGrid.width,
    });
    target.mount(parent);

    function* animate(): ThreadGenerator {
        const disappearAnimations: ThreadGenerator[] = [];
        for (const g of grids) {
            disappearAnimations.push(g.disappear(duration));
        }

        yield* all(
            ...disappearAnimations,
            delay(duration * 0.3, target.appear(duration * 0.8))
        );
    }

    return {target, animate};
}

export function injectCalls(
    parent: Node,
    helper: CodeGrid,
    callCode: string,
    targets: CodeAnchor[],
    config: {
        fromLine?: number;
        duration?: number;
        stagger?: number;
    } = {}
): InjectResult {
    const fromLine = config.fromLine ?? 0;
    const duration = config.duration ?? 1.0;
    const stagger = config.stagger ?? 0;

    const sourceAnchor = helper.getAnchor(fromLine);
    const calls: CodeGrid[] = [];

    for (const target of targets) {
        const call = CodeGrid.fromCode(callCode, {
            x: sourceAnchor.x,
            y: sourceAnchor.y,
            fontSize: helper.fontSize,
            fontFamily: helper.fontFamily,
            theme: helper.theme,
        });
        call.mount(parent);
        calls.push(call);
    }

    function* animate(): ThreadGenerator {
        const appearAnimations: ThreadGenerator[] = [];
        for (const c of calls) {
            appearAnimations.push(c.appear(0.3));
        }
        yield* all(...appearAnimations);

        if (stagger > 0) {
            for (let i = 0; i < calls.length; i++) {
                if (i > 0) {
                    yield* delay(stagger, calls[i].flyTo(targets[i], duration));
                } else {
                    yield* calls[i].flyTo(targets[i], duration);
                }
            }
        } else {
            const flyAnimations: ThreadGenerator[] = [];
            for (let i = 0; i < calls.length; i++) {
                flyAnimations.push(calls[i].flyTo(targets[i], duration));
            }
            yield* all(...flyAnimations);
        }
    }

    return {calls, animate};
}

export function* restoreOriginals(
    blocks: ExtractedBlock[],
    opacity: number = 1,
    duration: number = 0.4
): ThreadGenerator {
    const animations: ThreadGenerator[] = [];

    for (const block of blocks) {
        const lineCount = block.sourceGrid.lineCount;
        const [from, to] = block.range;

        if (from > 0) {
            animations.push(block.sourceGrid.dim(0, from - 1, opacity, duration));
        }
        if (to < lineCount - 1) {
            animations.push(block.sourceGrid.dim(to + 1, lineCount - 1, opacity, duration));
        }
    }

    if (animations.length > 0) {
        yield* all(...animations);
    }
}

export function* dryRefactor(
    parent: Node,
    specs: ExtractSpec[],
    helperCode: string,
    callCode: string,
    config: {
        centerY?: number;
        extractDuration?: number;
        mergeDuration?: number;
        morphDuration?: number;
        injectDuration?: number;
    } = {}
): ThreadGenerator {
    const centerY = config.centerY ?? 0;
    const extractDuration = config.extractDuration ?? 0.5;
    const mergeDuration = config.mergeDuration ?? 0.8;
    const morphDuration = config.morphDuration ?? 0.8;
    const injectDuration = config.injectDuration ?? 1.0;

    const {blocks, animate: animateExtract} = extractLines(parent, specs, extractDuration);
    yield* animateExtract();
    
    yield* mergeToCenter(blocks, 0, centerY, mergeDuration);
    
    const {target: helper, animate: animateMorph} = morphTo(parent, blocks, helperCode, {duration: morphDuration});
    yield* animateMorph();
    
    const targets = specs.map(spec => spec.grid.getAnchor(spec.range[0]));
    const {calls, animate: animateInject} = injectCalls(parent, helper, callCode, targets, {duration: injectDuration});
    yield* animateInject();
    
    yield* restoreOriginals(blocks);
}
