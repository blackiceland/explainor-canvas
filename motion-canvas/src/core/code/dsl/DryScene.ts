import {Node} from '@motion-canvas/2d';
import {all, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {DryPattern} from './types';
import {CodeGrid} from '../view/CodeGrid';
import {Stage} from '../layout/Stage';
import {
    extractLines,
    mergeToCenter,
    wrapWithSignature,
    stripToCall,
    injectFromCall,
    collapseSourceGaps,
    finalizeCode,
} from '../motion/CodeMotion';

export interface DrySceneConfig {
    fontSize?: number;
    columnGap?: number;
    durations?: {
        appear?: number;
        highlight?: number;
        extract?: number;
        merge?: number;
        wrap?: number;
        strip?: number;
        inject?: number;
        collapse?: number;
    };
}

export function* runDryScene(
    view: Node,
    pattern: DryPattern,
    config: DrySceneConfig = {}
): ThreadGenerator {
    const fontSize = config.fontSize ?? 16;
    const columnGap = config.columnGap ?? 40;
    const durations = {
        appear: config.durations?.appear ?? 0.6,
        highlight: config.durations?.highlight ?? 0.4,
        extract: config.durations?.extract ?? 0.6,
        merge: config.durations?.merge ?? 0.8,
        wrap: config.durations?.wrap ?? 0.8,
        strip: config.durations?.strip ?? 0.9,
        inject: config.durations?.inject ?? 0.8,
        collapse: config.durations?.collapse ?? 0.6,
    };

    const stage = new Stage({columnGap});

    const leftGrid = CodeGrid.fromCodeAt(pattern.left.code, stage.left(), {fontSize});
    const rightGrid = CodeGrid.fromCodeAt(pattern.right.code, stage.offset(stage.right(), -60, 0), {fontSize});

    leftGrid.mount(view);
    rightGrid.mount(view);

    yield* all(
        leftGrid.appear(durations.appear),
        rightGrid.appear(durations.appear),
    );
    yield* waitFor(0.5);

    yield* all(
        leftGrid.highlight(pattern.left.range[0], pattern.left.range[1], durations.highlight),
        rightGrid.highlight(pattern.right.range[0], pattern.right.range[1], durations.highlight),
    );
    yield* waitFor(0.5);

    const specs = [
        {grid: leftGrid, range: pattern.left.range},
        {grid: rightGrid, range: pattern.right.range},
    ];

    const {blocks, animate: animateExtract} = extractLines(view, specs, durations.extract);
    yield* animateExtract();
    yield* waitFor(0.2);

    yield* mergeToCenter(blocks, 0, 0, durations.merge);
    yield* waitFor(0.2);

    const {target: helper, sources, animate: animateWrap} = wrapWithSignature(view, blocks, pattern.helper, {duration: durations.wrap});
    yield* animateWrap();
    yield* waitFor(0.3);

    const {callGrid, animate: animateStrip} = stripToCall(view, helper, sources, pattern.call, durations.strip);
    yield* animateStrip();
    yield* waitFor(0.2);

    const targets = specs.map(spec => spec.grid.getAnchor(spec.range[0]));
    const {animate: animateInject} = injectFromCall(view, callGrid, helper, pattern.call, targets, durations.inject);
    yield* animateInject();

    yield* all(
        collapseSourceGaps(specs, durations.collapse),
        finalizeCode(specs, durations.collapse),
    );

    yield* waitFor(1.5);
}

