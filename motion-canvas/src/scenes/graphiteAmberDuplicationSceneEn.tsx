import {buildDuplicationScene} from './_duplicationShared';

// Graphite weave (fon.jpg) — variant A: AMBER + PEACH.
//   KEY    cobalt sky    — keywords, kept (голубой не трогать)
//   METHOD warm amber    — function definition names (sendCartReminder…)
//   STRING soft peach    — string literals ("cart.reminder", "login.code")
//   PUNCH  cool mint     — italic "bad." sits across the warm lane
// Humanist Argon mono so the amber lane feels editorial, not techy.
export default buildDuplicationScene({
    bgImage: '/fon.jpg',
    BG:      '#1A1A1E',      // fallback, only matters off-screen
    INK:     '#E8E2D8',      // warm cream-white — picks up the weave's hue
    KEY:     '#9CC2E8',      // cobalt sky (unchanged)
    DOMAIN:  '#E8B888',      // warm amber  — method name
    STRING:  '#F0C8A8',      // soft peach  — string literal
    PUNCH:   '#A8D8C2',      // cool mint   — italic "bad."
    HERO:    '#9CC2E8',
    QUIET:   '#7A7670',
    font:    '"Monaspace Argon", "JetBrains Mono", monospace',
    weight:  530,
});
