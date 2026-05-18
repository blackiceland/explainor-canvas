import {buildDuplicationScene} from './_duplicationShared';

// Cobalt code palette over a neutral warm-grey ground (instead of
// deep cobalt). The blue still owns the page, but the room is now
// concrete-grey, not midnight-sea.
export default buildDuplicationScene({
    BG:     '#1B1B1F', // dark warm grey
    INK:    '#E5EAF2', // cool blue-white
    KEY:    '#9CC2E8', // cobalt sky — keywords (untouched)
    DOMAIN: '#A0DCDC', // aqua       — function defs + strings (untouched)
    PUNCH:  '#F0BE8E', // warm sand  — italic "bad."
    HERO:   '#9CC2E8', // cobalt sky for frame + hero
    QUIET:  '#6E707A',
});
