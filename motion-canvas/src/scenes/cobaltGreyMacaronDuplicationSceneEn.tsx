import {buildDuplicationScene} from './_duplicationShared';

// Cobalt-grey base — EXPERIMENT 1: PATISSERIE / MACARON.
// Confection palette. Saturated mid-tones, food-coloured. The page
// reads like a Parisian patisserie window: raspberry filling on the
// function names, pistachio glaze on the string literals, cocoa
// ganache on the .phone field, oat-cream beige for the body, cherry
// italic for "bad." Cobalt-sky keywords kept as the only "blueprint"
// hue — everything else lives in the dessert lane.
const RASPBERRY = '#E08CA0';

export default buildDuplicationScene({
    BG:     '#1B1B1F',
    INK:    '#E8DCC4', // warm cream     — body/punctuation white shifted warm
    KEY:    '#9CC2E8', // cobalt sky     — keywords (kept)
    DOMAIN: RASPBERRY, // raspberry rose — function DEFINITION names
    CALL:   RASPBERRY, // method calls   — same hue (definitions = calls)
    STRING: '#B8CC80', // pistachio      — string literals
    PROP:   '#A88068', // cocoa ganache  — .phone (NOT yellow)
    PARAM:  '#D4C8B0', // oat cream      — user / cart / message / delivery / code
    PUNCH:  '#D86068', // cherry         — italic "bad."
    HERO:   '#9CC2E8',
    QUIET:  '#7A6F60',
});
