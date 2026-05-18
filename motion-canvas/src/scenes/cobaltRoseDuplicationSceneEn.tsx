import {buildDuplicationScene} from './_duplicationShared';

// Cobalt KEY again preserved, but domain markers shift to rose pink
// and the italic punch becomes cool mint. Three temperature zones:
// cool blue keywords, warm rose domain, cool mint punch.
export default buildDuplicationScene({
    BG:     '#0D1428', // deep cobalt
    INK:    '#E5EAF2', // cool blue-white
    KEY:    '#9CC2E8', // cobalt sky — keywords (untouched)
    DOMAIN: '#F0AABC', // rose pink  — function defs + strings
    PUNCH:  '#A8D8C2', // cool mint  — italic "bad."
    HERO:   '#9CC2E8', // cobalt sky for frame + hero
    QUIET:  '#6E777F',
});
