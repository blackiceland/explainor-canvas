import {MorphOptions} from '../components/Manticore';

export type MorphProfileName =
    | 'stableExpand'
    | 'methodAdd'
    | 'methodAddFade'
    | 'argSwap';

export const DEFAULT_MORPH_PROFILES: Record<MorphProfileName, MorphOptions> = {
    stableExpand: {
        scrollStrategy: 'block',
        removeDuration: 0,
        moveDuration: 0.6,
    },
    methodAdd: {
        scrollStrategy: 'auto',
        removeDuration: 0,
        moveDuration: 0.6,
        lineDelay: 0.03,
        charDelay: 0.012,
    },
    methodAddFade: {
        scrollStrategy: 'auto',
        removeDuration: 0,
        moveDuration: 0.6,
        addStyle: 'fade',
    },
    argSwap: {
        scrollStrategy: 'block',
        removeDuration: 0,
        moveDuration: 0.6,
        flashRemovedColor: 'rgba(255, 80, 80, 0.95)',
        flashRemovedDuration: 0.2,
        flashRemovedIncludeTypes: ['method', 'plain'],
        flashRemovedExcludeTypes: [],
        flashRemovedErase: 'reverseType',
        flashRemovedEraseCharDelay: 0.009,
    },
};
