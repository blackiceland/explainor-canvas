import {buildDuplicationScene} from './_duplicationShared';

// Midnight tech. Cool navy ground, three pastel accents on the cool
// half of the wheel (lavender → sky blue → cream). Direct homage to
// the s4.codes reference palette.
export default buildDuplicationScene({
    BG:     '#191B30', // cool navy
    INK:    '#E8E7F2', // cool off-white body
    KEY:    '#CCA8F8', // lavender    — keywords
    DOMAIN: '#A0BCFA', // sky blue    — function defs + strings
    PUNCH:  '#F8E6B0', // cream       — italic "bad." (warm tension)
    HERO:   '#CCA8F8', // lavender for frame + hero
    QUIET:  '#6E6F80',
});
