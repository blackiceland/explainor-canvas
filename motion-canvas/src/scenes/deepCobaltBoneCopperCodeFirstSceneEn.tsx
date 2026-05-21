import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · DEEP COBALT / BONE / COPPER · LUXURY PASS.
// Базовая концепция та же (cold dark + warm milk + soft gold), но
// тонально сдвинута: фон уведён в graphite-steel, основной текст
// чуть холоднее, properties перешли из розы в sand/camel, accent —
// из тёплого оранжа в muted antique gold.
//   BG       #111722  graphite-steel
//   INK      #E2E6EE  cool milk
//   KEY      #C7A4EE  refined lavender
//   METHOD   #80B6DE  steel blue
//   STRING   #A7C992  sage
//   PROP     #D9A88F  sand / camel — replaces rose
//   PUNC     #CBD1DC  cool cream punctuation
//   OPERATOR #8F9AAA  cool grey
//   ACCENT   #D6A064  antique gold — caption "decisions"

export default buildCodeFirstScene({
    BG:       '#111722',
    INK:      '#E2E6EE',
    KEY:      '#C7A4EE',
    METHOD:   '#80B6DE',
    STRING:   '#A7C992',
    PROP:     '#D9A88F',
    PARAM:    '#E2E6EE',
    PUNC:     '#CBD1DC',
    OPERATOR: '#8F9AAA',
    QUIET:    'rgba(226, 230, 238, 0.50)',
    ACCENT:   '#D6A064',
});
