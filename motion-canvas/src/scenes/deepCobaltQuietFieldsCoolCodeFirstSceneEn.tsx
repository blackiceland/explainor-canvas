import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · DEEP COBALT QUIET FIELDS · COOL SHIFT.
// Все токены сдвинуты в холодную сторону на ~15-20 RGB пунктов.
// Лавандовый становится periwinkle (меньше красного), голубой —
// глубже steel, зелёный — в seafoam (с цианом), champagne PROP —
// в cool taupe, жёлтый ACCENT — в chartreuse. BG чуть глубже
// холодный. Эффект: «winter steel» — палитра звучит как зимнее
// северное освещение.
//   BG       #0E1522  deeper cool graphite
//   INK      #E7E1D6  warm bone (anchor — не трогаем)
//   KEY      #A8A0EE  periwinkle (был lavender)
//   METHOD   #6BB0E2  deeper steel blue
//   STRING   #82C0A8  seafoam (sage с цианом)
//   PROP     #B8B2A0  cool taupe (champagne минус золото)
//   PUNC     #C8D0DC  cooler cream
//   OPERATOR #8993A4  cool grey (без изменений почти)
//   ACCENT   #D4C260  chartreuse-yellow

export default buildCodeFirstScene({
    BG:       '#0E1522',
    INK:      '#E7E1D6',
    KEY:      '#A8A0EE',
    METHOD:   '#6BB0E2',
    STRING:   '#82C0A8',
    PROP:     '#B8B2A0',
    PARAM:    '#E7E1D6',
    PUNC:     '#C8D0DC',
    OPERATOR: '#8993A4',
    QUIET:    'rgba(231, 225, 214, 0.50)',
    ACCENT:   '#D4C260',
});
