export {CodeDocument} from './model';
export {CodeGrid} from './view';
export type {CodeGridConfig, CodeAnchor} from './view';

export {
    extractLines,
    mergeToCenter,
    morphTo,
    injectCalls,
    restoreOriginals,
    dryRefactor,
} from './motion/CodeMotion';
export type {ExtractedBlock, ExtractSpec} from './motion/CodeMotion';
