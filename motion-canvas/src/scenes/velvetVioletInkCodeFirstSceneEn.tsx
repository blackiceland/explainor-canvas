import {buildCodeFirstScene} from './_codeFirstShared';

// Violet Ink — сдвиг hue в сторону фиолета (~250°).
// Фон подыгрывает KEY (lavender) — они в одной семье.
// BG #131020 — чуть теплее, чуть пурпурнее.

export default buildCodeFirstScene({
    BG:       '#131020',
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
