export {CodeDocument} from './model';
export {CodeGrid} from './view';
export type {CodeGridConfig, CodeAnchor, TokenAnchor} from './view';
export {Stage} from './layout';
export type {SlotName, Position, StageConfig} from './layout';

export {
    extractLines,
    mergeToCenter,
    wrapWithSignature,
    stripToCall,
    injectFromCall,
    collapseSourceGaps,
    finalizeCode,
    dryRefactor,
} from './motion/CodeMotion';
export type {ExtractedBlock, ExtractSpec} from './motion/CodeMotion';
