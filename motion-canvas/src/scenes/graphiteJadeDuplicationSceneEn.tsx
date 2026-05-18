import {buildDuplicationScene} from './_duplicationShared';

// Graphite weave (fon.jpg) — variant B: JADE + OLIVE.
//   KEY    cobalt sky   — keywords, kept (голубой не трогать)
//   METHOD jade green   — function names feel fresh, alive
//   STRING warm olive   — string literals as drier, parchment-y matter
//   PUNCH  rose pink    — italic "bad." pops across the cool greens
// Xenon — slab-flavoured book-mono, the editorial "botanical print" cut.
export default buildDuplicationScene({
    bgImage: '/fon.jpg',
    BG:      '#1A1C1A',
    INK:     '#E2E6DE',      // cool ivory with a green whisper
    KEY:     '#9CC2E8',      // cobalt sky (unchanged)
    DOMAIN:  '#9CD4A8',      // jade   — method name
    STRING:  '#C8C898',      // olive  — string literal
    PUNCH:   '#F0AABC',      // rose   — italic "bad."
    HERO:    '#9CC2E8',
    QUIET:   '#727870',
    font:    '"Monaspace Xenon", "JetBrains Mono", monospace',
    weight:  520,
});
