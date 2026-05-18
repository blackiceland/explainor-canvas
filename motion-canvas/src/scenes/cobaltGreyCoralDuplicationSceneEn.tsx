import {buildDuplicationScene} from './_duplicationShared';

// Cobalt-grey base — EXPERIMENT 3, v2.
// Restrained + tender after feedback: red was too loud, string should
// be green. Kept the chapter1 opacity-driven cream hierarchy on body
// (PARAM 92 %, PUNCT 58 %) and the veiled cobalt KEY at 82 %, since
// those landed. Method coral pulled down to dusty rose, string moved
// from cream-72 % to a tender sage, prop shifted from saturated
// lavender to a pale periwinkle, punch returned to warm sand.
//
//   KEY     cobalt sky 82 %  — keywords (kept)
//   METHOD  dusty rose        — function defs AND call sites
//   STRING  tender sage       — string literals (green now)
//   PROP    pale periwinkle   — object field access (.phone)
//   PARAM   cream  92 %       — user / cart / message / delivery / code (kept)
//   PUNC    cream  58 %       — brackets / commas / operators (kept)
//   PUNCH   warm sand         — italic "bad."
const ROSE = '#C89098';

export default buildDuplicationScene({
    BG:     '#1B1B1F',
    INK:    'rgba(244, 241, 235, 0.92)',
    KEY:    'rgba(156, 194, 232, 0.82)', // cobalt sky veiled (kept)
    DOMAIN: ROSE,
    CALL:   ROSE,
    STRING: '#A8C0A0',                    // tender sage
    PROP:   '#B88878',                    // terracotta light — .phone
    PARAM:  '#D8B8A0',                    // warm peach — user / cart / …
    PUNC:   'rgba(244, 241, 235, 0.58)',  // (kept)
    OPERATOR: 'rgba(244, 241, 235, 0.58)',
    PUNCH:  '#F0BE8E',                    // warm sand — italic "bad."
    HERO:   '#9CC2E8',
    QUIET:  'rgba(244, 241, 235, 0.45)',
});
