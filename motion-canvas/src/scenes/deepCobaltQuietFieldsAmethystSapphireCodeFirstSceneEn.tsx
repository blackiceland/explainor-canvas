import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · DEEP COBALT QUIET FIELDS · AMETHYST & SAPPHIRE.
// «Дорогой» вариант через jewel-семью: KEY становится глубоким
// аметистом (вместо лёгкого лавандового pastel), METHOD —
// сапфиром. Логика: pastel читается как «детское/candy»,
// jewel-deep — как «огранённый камень». Снижаем luminance,
// поднимаем chroma. Все остальные токены — база QuietFields
// (champagne PROP, mustard ACCENT) — чтобы изоляция эффекта на
// KEY+METHOD была чистой.
//   BG       #111722  unchanged
//   INK      #E7E1D6  warm bone (unchanged)
//   KEY      #9D7AD8  deep amethyst — было #C7A4EE
//   METHOD   #4D94CC  sapphire blue — было #86C0EA
//   STRING   #A7C992  sage (unchanged)
//   PROP     #D3BD9C  champagne (unchanged)
//   PUNC     #CBD1DC  cool cream (unchanged)
//   OPERATOR #8F9AAA  cool grey (unchanged)
//   ACCENT   #E8C656  mustard (unchanged)

export default buildCodeFirstScene({
    BG:       '#111722',
    INK:      '#E7E1D6',
    KEY:      '#9D7AD8',
    METHOD:   '#4D94CC',
    STRING:   '#A7C992',
    PROP:     '#D3BD9C',
    PARAM:    '#E7E1D6',
    PUNC:     '#CBD1DC',
    OPERATOR: '#8F9AAA',
    QUIET:    'rgba(231, 225, 214, 0.50)',
    ACCENT:   '#E8C656',
});
