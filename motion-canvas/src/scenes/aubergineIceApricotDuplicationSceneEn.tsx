import {buildDuplicationScene} from './_duplicationShared';

// Palette: AUBERGINE / ICE / APRICOT.
// Драматичный, cinematic вариант. Глубокий пурпурно-баклажановый
// фон, светло-фиолетовый ink. Mauve keyword + ice blue method —
// холодная пара. Apricot italic "bad." на тёплой точке. Sage и
// rose в служебных ролях.
const METHOD = '#9AC2FF';

export default buildDuplicationScene({
    BG:       '#1B1826',
    INK:      '#ECE9F2',
    KEY:      '#C7A1FF',
    DOMAIN:   METHOD,
    CALL:     METHOD,
    STRING:   '#B7D89F',
    PROP:     '#F0A3BC',
    PARAM:    '#ECE9F2',
    PUNC:     'rgba(236, 233, 242, 0.62)',
    OPERATOR: 'rgba(236, 233, 242, 0.62)',
    PUNCH:    '#F3B189',
    HERO:     METHOD,
    QUIET:    'rgba(236, 233, 242, 0.45)',
});
