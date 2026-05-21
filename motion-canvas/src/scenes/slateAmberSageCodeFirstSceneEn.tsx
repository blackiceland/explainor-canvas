import {buildCodeFirstScene} from './_codeFirstShared';

// Palette per the latest ТЗ — slightly richer/softer tones.
//   BG       #121827  deep navy
//   INK      #E1E6EF  main text — softer than #FFF, less sterile
//   KEY      #D4A3FF  lavender (also caption accent on "Decisions")
//   METHOD   #72BFEA  cool blue — function defs + calls
//   STRING   #A8D98F  fresh sage — status literals
//   PROP     #E8A2B3  warm rose — property access
//   PUNC     #C9D0DE  light cool grey — brackets / dots / commas
//   OPERATOR #91A4BA  dimmer cool grey — = / !

export default buildCodeFirstScene({
    BG:       '#121827',
    INK:      '#E1E6EF',
    KEY:      '#CFA2FF',
    METHOD:   '#72BFEA',
    STRING:   '#A8D98F',
    PROP:     '#E8A2B3',
    PARAM:    '#E1E6EF',
    PUNC:     '#C9D0DE',
    OPERATOR: '#91A4BA',
    QUIET:    'rgba(225, 230, 239, 0.50)',
});
