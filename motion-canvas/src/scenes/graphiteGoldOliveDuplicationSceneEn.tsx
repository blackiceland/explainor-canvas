import {buildDuplicationScene} from './_duplicationShared';

// Palette: GRAPHITE / GOLD / OLIVE.
// Самый строгий и «печатный». Графитовый фон, тёплый сливочный
// ink, mauve keyword + graphite-blue method. Olive + gold в
// служебных ролях. Сухой и взрослый — для случая когда хочется
// уйти от dev-вида максимально.
const METHOD = '#A9C2D9';

export default buildDuplicationScene({
    BG:       '#1A1C1F',
    INK:      '#E6E0D4',
    KEY:      '#C8A6FF',
    DOMAIN:   METHOD,
    CALL:     METHOD,
    STRING:   '#A9C08C',
    PROP:     '#D8BC8C',
    PARAM:    '#E6E0D4',
    PUNC:     'rgba(230, 224, 212, 0.62)',
    OPERATOR: 'rgba(230, 224, 212, 0.62)',
    PUNCH:    '#E0A56F',
    HERO:     METHOD,
    QUIET:    'rgba(230, 224, 212, 0.45)',
});
