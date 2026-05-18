import {buildDuplicationScene} from './_duplicationShared';

// Cobalt-grey base — EXPERIMENT 2: VELVET / TEA-HOUSE JEWEL.
// Saturated jewel palette. Deeper than macaron, sits in the
// terracotta / aubergine / teal family — like a Japanese tea-house
// interior or a velvet-bound book. Plum for function identity, warm
// clay for literals, peacock teal for .phone (cool counterweight,
// pointedly NOT yellow), tan for body, madder red italic punch.
// Xenon mono — the slab-flavoured cut — gives the page a bookish
// density that suits the jewel mood.
const PLUM = '#A878B8';

export default buildDuplicationScene({
    BG:     '#1B1B1F',
    INK:    '#E0D8CC', // warm bone      — body/punctuation
    KEY:    '#9CC2E8', // cobalt sky     — keywords (kept)
    DOMAIN: PLUM,      // deep plum      — function DEFINITION names
    CALL:   PLUM,      // method calls   — same hue
    STRING: '#D08060', // terracotta     — string literals (warm clay)
    PROP:   '#5C9080', // peacock teal   — .phone (cool, NOT yellow)
    PARAM:  '#B8A888', // warm tan       — user / cart / message / delivery / code
    PUNCH:  '#C25868', // madder red     — italic "bad."
    HERO:   '#9CC2E8',
    QUIET:  '#7A6E60',
    font:   '"Monaspace Xenon", "JetBrains Mono", monospace',
});
