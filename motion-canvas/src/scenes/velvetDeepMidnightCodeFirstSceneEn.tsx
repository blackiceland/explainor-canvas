import {buildCodeFirstScene} from './_codeFirstShared';

// Deep Midnight — темнее текущего #151A28, тот же hue.
// Больше контраста с bone/lavender/blue, глубже погружение.
// BG #101520 — HSL ~221°, ~33%, ~9%

export default buildCodeFirstScene({
    BG:       '#101520',
    INK:      '#E7E1D6',
    KEY:      '#CAB4EA',
    METHOD:   '#8AC7EF',
    STRING:   '#A8CF98',
    PROP:     '#E7E1D6',
    PARAM:    '#E7E1D6',
    PUNC:     '#D2D8E2',
    OPERATOR: '#8F9AAA',
    QUIET:    'rgba(231, 225, 214, 0.50)',
    ACCENT:   '#E8C656',
});
