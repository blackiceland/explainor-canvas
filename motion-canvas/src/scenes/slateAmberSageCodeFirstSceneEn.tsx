import {buildCodeFirstScene} from './_codeFirstShared';

// Palette per the latest ТЗ — softer / more muted across the board.
// Goal: lift the visual register from "punchy social code" toward
// "expensive, restrained, slightly dusty" — the reference's mood.
//   BG       #121827  deep navy (unchanged)
//   INK      #D9DFEA  cool grey-milk (less white, less harsh contrast)
//   KEY      #C8A8F0  muted lavender (less neon)
//   METHOD   #8FB2E6  softer cool blue (less cyan-saturated)
//   STRING   #A8CC95  dusty sage (less "fresh salad")
//   PROP     #D8A4B0  muted rose
//   PUNC     #C9D0DE  light cool grey
//   OPERATOR #91A4BA  dimmer cool grey

export default buildCodeFirstScene({
    BG:       '#121827',
    INK:      '#D9DFEA',
    KEY:      '#C8A8F0',
    METHOD:   '#8FB2E6',
    STRING:   '#A8CC95',
    PROP:     '#D8A4B0',
    PARAM:    '#D9DFEA',
    PUNC:     '#C9D0DE',
    OPERATOR: '#91A4BA',
    QUIET:    'rgba(217, 223, 234, 0.50)',
});
