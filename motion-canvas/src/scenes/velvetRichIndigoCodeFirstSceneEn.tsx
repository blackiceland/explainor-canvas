import {buildCodeFirstScene} from './_codeFirstShared';

// Rich Indigo — тот же hue что текущий, но выше saturation.
// Фон ощущается «гуще», цветные токены контрастируют ярче.
// BG #0D1122 — HSL ~229°, ~45%, ~9%

export default buildCodeFirstScene({
    BG:       '#0D1122',
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
