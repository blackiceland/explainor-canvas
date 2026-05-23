import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · DEEP COBALT QUIET FIELDS · INDIGO DRIFT.
// Ключевая идея: вместо контраста BG ↔ KEY используем ГАРМОНИЮ.
// BG уходит в индиго (более фиолетовый), KEY получает близкий
// hue и сидит «в одном тоне» с BG — лавандовый растворяется в
// фоне на 30%. METHOD при этом высветляется до cyan-blue, чтобы
// сохранить контраст с BG. Получается палитра с «двумя
// семействами»: индиго (BG + KEY) против cyan (METHOD).
//   BG       #0F1430  deep indigo
//   INK      #E7E1D6  warm bone (anchor)
//   KEY      #B095E8  lavender близкий к BG-hue (растворяется)
//   METHOD   #88D0F0  light cyan-blue (контраст с BG)
//   STRING   #A5C490  sage (unchanged)
//   PROP     #D1BB99  cooler champagne
//   PUNC     #C8CCD5  cool cream
//   OPERATOR #8B92A8  cool grey
//   ACCENT   #E8C656  mustard (unchanged)

export default buildCodeFirstScene({
    BG:       '#0F1430',
    INK:      '#E7E1D6',
    KEY:      '#B095E8',
    METHOD:   '#88D0F0',
    STRING:   '#A5C490',
    PROP:     '#D1BB99',
    PARAM:    '#E7E1D6',
    PUNC:     '#C8CCD5',
    OPERATOR: '#8B92A8',
    QUIET:    'rgba(231, 225, 214, 0.50)',
    ACCENT:   '#E8C656',
});
