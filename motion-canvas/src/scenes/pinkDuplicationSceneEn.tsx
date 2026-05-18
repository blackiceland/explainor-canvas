import {buildDuplicationScene} from './_duplicationShared';

// Rose universe. Deep rose-tinted dark ground, three pastel accents
// in a 75° hue arc (rose → peach → champagne) — all at ~80 % lightness
// and ~80 % saturation. Differences are HUE only.
export default buildDuplicationScene({
    BG:     '#1F0E16', // deep rose-tinted dark
    INK:    '#F5E8E2', // warm cream body
    KEY:    '#F8AAC4', // rose pink   — keywords
    DOMAIN: '#F8C4AA', // warm peach  — function defs + strings
    PUNCH:  '#F8E4AA', // champagne   — italic "bad."
    HERO:   '#F8AAC4', // rose for frame + hero
    QUIET:  '#7B6066',
});
