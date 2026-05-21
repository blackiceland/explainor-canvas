import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · INDIGO / SOFT GOLD.
// Холодная тёмная база + золото только как смысловой акцент. Code
// сохраняет «цифровой нерв»: keywords в лавандовом, function names
// в холодном голубом, strings зелёные. Тёплый камел заходит только
// на свойства (.token / .active / .text — небольшая, осмысленная
// группа), а главный gold-удар бьёт в caption на одном слове.
//   BG       #111827  cold indigo
//   INK      #E7E1D6  warm milk
//   KEY      #C8A6F2  muted lavender — digital nerve
//   METHOD   #8FB6D9  cool blue
//   STRING   #B8D39B  sage (keeps the colour temperature balanced)
//   PROP     #D8B28A  muted gold / camel — properties only
//   PUNC     #D2CCC2  warm cream punctuation
//   OPERATOR #97A0AC  cool grey
//   ACCENT   #D9A35F  gold — caption "decisions" only

export default buildCodeFirstScene({
    BG:       '#111827',
    INK:      '#E7E1D6',
    KEY:      '#C8A6F2',
    METHOD:   '#8FB6D9',
    STRING:   '#B8D39B',
    PROP:     '#D8B28A',
    PARAM:    '#E7E1D6',
    PUNC:     '#D2CCC2',
    OPERATOR: '#97A0AC',
    QUIET:    'rgba(231, 225, 214, 0.50)',
    ACCENT:   '#D9A35F',
});
