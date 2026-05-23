import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · DEEP COBALT / BONE / COPPER · SAGE STRING variant.
// Эксперимент: STRING переведён из «свежего» зелёного (#A7C992)
// в холодный sage с кобальтовым поддоном (#7FA89E). Цель — убрать
// температурного сироту: зелёный садится в холодную семью к
// BG/METHOD/KEY, и палитра становится чисто двухполярной —
// cobalt-side против warm-side (INK/PROP/ACCENT). Лавандовый KEY
// продолжает работать мостом.
//   BG       #111722  graphite-steel
//   INK      #E7E1D6  warm bone (unchanged)
//   KEY      #C7A4EE  refined lavender (unchanged)
//   METHOD   #86C0EA  steel blue (unchanged)
//   STRING   #9FB982  muted olive — компромисс на оси
//                     fresh-green ↔ teal: достаточно холодный, чтобы
//                     не звучать как autumn, но достаточно жёлтый,
//                     чтобы не сливаться с METHOD-blue. История оси:
//                     #A7C992 (fresh, orphan) → #5FAE8E (teal,
//                     collides with METHOD) → #9FB982 (current).
//   PROP     #D9A88F  sand / camel (unchanged)
//   PUNC     #CBD1DC  cool cream
//   OPERATOR #8F9AAA  cool grey
//   ACCENT   #D2A05E  antique gold

export default buildCodeFirstScene({
    BG:       '#111722',
    INK:      '#E7E1D6',
    KEY:      '#C7A4EE',
    METHOD:   '#86C0EA',
    STRING:   '#9FB982',
    PROP:     '#D9A88F',
    PARAM:    '#E7E1D6',
    PUNC:     '#CBD1DC',
    OPERATOR: '#8F9AAA',
    QUIET:    'rgba(231, 225, 214, 0.50)',
    ACCENT:   '#D2A05E',
});
