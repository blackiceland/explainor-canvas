import {buildDuplicationScene} from './_duplicationShared';

// Cobalt KEY (the blue is preserved) with a WARM swing — domain
// markers go gold instead of aqua, italic punch goes salmon. Cool
// keyword + warm domain creates thermal tension across the line.
export default buildDuplicationScene({
    BG:     '#0D1428', // deep cobalt
    INK:    '#E5EAF2', // cool blue-white
    KEY:    '#9CC2E8', // cobalt sky — keywords (untouched)
    DOMAIN: '#E8D08E', // warm gold  — function defs + strings
    PUNCH:  '#F0B8A8', // salmon     — italic "bad."
    HERO:   '#9CC2E8', // cobalt sky for frame + hero
    QUIET:  '#6E777F',
});
