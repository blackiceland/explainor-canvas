import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · DEEP COBALT QUIET FIELDS · JEWEL LEAN.
// Лёгкий уклон в peacock-семью: голубой получает teal-undertone,
// зелёный уходит в emerald, ACCENT смягчается до amber-gold,
// лавандовый углубляется до violet. BG получает чуть teal-крен.
// Эффект: deepCobalt начинает звучать как родственник peacock'а,
// но БЕЗ полного перехода в иридесцент — это все ещё «cobalt с
// драгоценным акцентом», а не peacock.
//   BG       #0E1820  cobalt с teal-undertone
//   INK      #E7E1D6  warm bone (anchor)
//   KEY      #B098E8  deeper violet
//   METHOD   #5FB5DC  teal-leaning cobalt
//   STRING   #6FBC9C  emerald-leaning green
//   PROP     #D0B088  warmer bronze (champagne темнее)
//   PUNC     #C5CDDA  cool cream
//   OPERATOR #8693A2  cool grey
//   ACCENT   #D8B048  amber-gold

export default buildCodeFirstScene({
    BG:       '#0E1820',
    INK:      '#E7E1D6',
    KEY:      '#B098E8',
    METHOD:   '#5FB5DC',
    STRING:   '#6FBC9C',
    PROP:     '#D0B088',
    PARAM:    '#E7E1D6',
    PUNC:     '#C5CDDA',
    OPERATOR: '#8693A2',
    QUIET:    'rgba(231, 225, 214, 0.50)',
    ACCENT:   '#D8B048',
});
