import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · DEEP COBALT QUIET FIELDS · FOREST FLOOR.
// Земельная вариация. Все тёплые токены уходят в природные
// материалы: STRING — мох, PROP — дуб, ACCENT — пшеница. KEY
// получает чуть земляной оттенок (taupe-lavender), METHOD —
// серо-голубой как зимнее небо сквозь крону. BG чуть теплее.
//   BG       #131820  earth-tinted dark
//   INK      #E7E1D6  warm bone
//   KEY      #B89AE0  earth-tinted lavender
//   METHOD   #82B8E0  winter sky blue
//   STRING   #98B080  deep moss green
//   PROP     #C9A87C  oak / aged wood
//   PUNC     #CFCBC0  warm cream
//   OPERATOR #8E8E80  earth grey
//   ACCENT   #D6BB6E  wheat / dried grass

export default buildCodeFirstScene({
    BG:       '#131820',
    INK:      '#E7E1D6',
    KEY:      '#B89AE0',
    METHOD:   '#82B8E0',
    STRING:   '#98B080',
    PROP:     '#C9A87C',
    PARAM:    '#E7E1D6',
    PUNC:     '#CFCBC0',
    OPERATOR: '#8E8E80',
    QUIET:    'rgba(231, 225, 214, 0.50)',
    ACCENT:   '#D6BB6E',
});
