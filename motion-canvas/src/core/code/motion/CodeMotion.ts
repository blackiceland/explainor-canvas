import {Node} from '@motion-canvas/2d';
import {all, delay, ThreadGenerator, Vector2, waitFor} from '@motion-canvas/core';
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
    sources: CodeGrid[];
    animate: () => ThreadGenerator;
}

export interface StripResult {
    callGrid: CodeGrid;
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

export function wrapWithSignature(
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
    const fontSize = config.fontSize ?? firstGrid.fontSize;

    const target = CodeGrid.fromCode(targetCode, {
        x: firstGrid.x,
        y: firstGrid.y,
        fontSize,
        fontFamily: firstGrid.fontFamily,
        theme: firstGrid.theme,
        width: firstGrid.width,
    });
    target.mount(parent);

    const bodyStartLine = 1;
    const bodyEndLine = target.lineCount - 2;

    const firstGridBodyAnchor = firstGrid.getAnchor(0);
    const targetBodyAnchor = target.getAnchor(bodyStartLine);

    const dx = firstGridBodyAnchor.x - targetBodyAnchor.x;
    const dy = firstGridBodyAnchor.y - targetBodyAnchor.y;

    const currentPos = target.getPosition();
    target.container().position(new Vector2(currentPos.x + dx, currentPos.y + dy));

    target.container().opacity(0);

    function* animate(): ThreadGenerator {
        yield* all(
            target.appear(duration),
            target.hideRanges([[bodyStartLine, bodyEndLine]], 0)
        );
    }

    return {target, sources: grids, animate};
}

export function stripToCall(
    parent: Node,
    helper: CodeGrid,
    sources: CodeGrid[],
    callCode: string,
    duration: number = 0.5
): StripResult {
    const helperToken = helper.findToken(0, 'validate');
    
    const helperPos = helper.getPosition();
    const callGrid = CodeGrid.fromCode(callCode, {
        x: helperPos.x,
        y: helperPos.y,
        fontSize: helper.fontSize,
        fontFamily: helper.fontFamily,
        theme: helper.theme,
    });
    callGrid.mount(parent);
    
    const callToken = callGrid.findToken(0, 'validate');
    
    if (callToken && helperToken) {
        const dx = helperToken.x - callToken.x;
        const dy = helperToken.y - callToken.y;
        
        const currentGridPos = callGrid.getPosition();
        callGrid.container().position(new Vector2(currentGridPos.x + dx, currentGridPos.y + dy));
    }

    callGrid.container().opacity(0);

    function* animate(): ThreadGenerator {
        yield* all(
            helper.disappear(duration * 1.2),
            ...sources.map(s => s.disappear(duration * 1.2)),
            delay(duration * 0.4, callGrid.appear(duration))
        );
    }

    return {callGrid, animate};
}

export function injectFromCall(
    parent: Node,
    sourceCall: CodeGrid,
    callCode: string,
    targets: CodeAnchor[],
    duration: number = 0.8
): InjectResult {
    const sourcePos = sourceCall.getPosition();

    const calls: CodeGrid[] = [];

    for (let i = 0; i < targets.length; i++) {
        const call = CodeGrid.fromCode(callCode, {
            x: sourcePos.x,
            y: sourcePos.y,
            fontSize: sourceCall.fontSize,
            fontFamily: sourceCall.fontFamily,
            theme: sourceCall.theme,
        });
        call.mount(parent);
        call.container().opacity(1); 
        calls.push(call);
    }

    function* animate(): ThreadGenerator {
        yield* sourceCall.container().opacity(0, 0);
        
        yield* all(
            ...calls.map((c, i) => c.flyTo(targets[i], duration))
        );
    }

    return {calls, animate};
}

export function* collapseSourceGaps(
    specs: ExtractSpec[],
    duration: number = 0.6
): ThreadGenerator {
    const animations: ThreadGenerator[] = [];

    for (const spec of specs) {
        const [from, to] = spec.range;
        const linesToCollapse = to - from;
        
        if (linesToCollapse > 0) {
            const delta = -linesToCollapse * spec.grid.lineHeight;
            animations.push(spec.grid.shiftLines(to + 1, delta, duration));
        }
    }

    if (animations.length > 0) {
        yield* all(...animations);
    }
}

export function* finalizeCode(
    specs: ExtractSpec[],
    duration: number = 0.5
): ThreadGenerator {
    const animations: ThreadGenerator[] = [];

    for (const spec of specs) {
        const lineCount = spec.grid.lineCount;
        const [from, to] = spec.range;

        if (from > 0) {
            animations.push(spec.grid.dim(0, from - 1, 1, duration));
        }
        if (to < lineCount - 1) {
            animations.push(spec.grid.dim(to + 1, lineCount - 1, 1, duration));
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
        wrapDuration?: number;
        stripDuration?: number;
        injectDuration?: number;
        collapseDuration?: number;
    } = {}
): ThreadGenerator {
    const centerY = config.centerY ?? 0;
    const extractDuration = config.extractDuration ?? 0.6;
    const mergeDuration = config.mergeDuration ?? 0.8;
    const wrapDuration = config.wrapDuration ?? 0.8;
    const stripDuration = config.stripDuration ?? 0.9;
    const injectDuration = config.injectDuration ?? 0.8;
    const collapseDuration = config.collapseDuration ?? 0.6;

    const {blocks, animate: animateExtract} = extractLines(parent, specs, extractDuration);
    yield* animateExtract();
    yield* waitFor(0.2);

    yield* mergeToCenter(blocks, 0, centerY, mergeDuration);
    yield* waitFor(0.2);

    const {target: helper, sources, animate: animateWrap} = wrapWithSignature(parent, blocks, helperCode, {duration: wrapDuration});
    yield* animateWrap();
    yield* waitFor(0.3);

    const {callGrid, animate: animateStrip} = stripToCall(parent, helper, sources, callCode, stripDuration);
    yield* animateStrip();
    yield* waitFor(0.2);

    const targets = specs.map(spec => spec.grid.getAnchor(spec.range[0]));
    const {animate: animateInject} = injectFromCall(parent, callGrid, callCode, targets, injectDuration);
    yield* animateInject();

    yield* all(
        collapseSourceGaps(specs, collapseDuration),
        finalizeCode(specs, collapseDuration)
    );
}
