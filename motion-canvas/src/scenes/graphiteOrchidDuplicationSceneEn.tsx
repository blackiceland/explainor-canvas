import {buildDuplicationScene} from './_duplicationShared';

// Graphite weave (fon.jpg) — variant C: ORCHID + LAVENDER.
//   KEY    cobalt sky    — keywords, kept (голубой не трогать)
//   METHOD orchid pink   — function names — perfumed, identity-loaded
//   STRING periwinkle    — string literals — quieter, slightly cool
//   PUNCH  warm gold     — italic "bad." as the lone warm note
// Krypton — architectural / geometric mono, gives the perfumed lane a
// disciplined edge instead of letting it read soft.
export default buildDuplicationScene({
    bgImage: '/fon.jpg',
    BG:      '#1A181E',
    INK:     '#E4E0E8',      // very pale lilac white
    KEY:     '#9CC2E8',      // cobalt sky (unchanged)
    DOMAIN:  '#D8A0CC',      // orchid       — method name
    STRING:  '#B8B8DC',      // periwinkle   — string literal
    PUNCH:   '#E8C088',      // warm gold    — italic "bad."
    HERO:    '#9CC2E8',
    QUIET:   '#787078',
    font:    '"Monaspace Krypton", "JetBrains Mono", monospace',
    weight:  530,
});
