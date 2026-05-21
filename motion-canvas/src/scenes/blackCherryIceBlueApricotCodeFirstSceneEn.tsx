import {buildCodeFirstScene} from './_codeFirstShared';

// Theme 2 · BLACK CHERRY / ICE BLUE / APRICOT.
// Тёмный cinematic: почти чёрно-вишнёвый фон + холодный код,
// но смысловой удар в caption — тёплый apricot, НЕ keyword.
// Это разводит код и подпись по температурным полюсам.
//   BG       #18131D  black cherry
//   INK      #E8E3EA  cool cream
//   KEY      #D1A7FF  lavender
//   METHOD   #8CC7E8  ice blue
//   STRING   #B8D98E  sage
//   PROP     #E6A0B6  rose
//   PUNC     #D3CCD8  cool cream punctuation
//   OPERATOR #9A9AAC  dim grey
//   ACCENT   #F0AD7A  apricot — caption "decisions", warm counter-pole

export default buildCodeFirstScene({
    BG:       '#18131D',
    INK:      '#E8E3EA',
    KEY:      '#D1A7FF',
    METHOD:   '#8CC7E8',
    STRING:   '#B8D98E',
    PROP:     '#E6A0B6',
    PARAM:    '#E8E3EA',
    PUNC:     '#D3CCD8',
    OPERATOR: '#9A9AAC',
    QUIET:    'rgba(232, 227, 234, 0.50)',
    ACCENT:   '#F0AD7A',
});
