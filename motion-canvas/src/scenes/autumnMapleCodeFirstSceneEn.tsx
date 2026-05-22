import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · AUTUMN MAPLE.
// Источник палитры — крона клёна в момент перелома осени, когда
// на одном дереве уже есть **все стадии** превращения хлорофилла:
// листья красные, листья золотые, листья ещё зелёные, кора влажная
// тёмная. Цвета органичны не потому, что я их подобрал — а потому
// что они **физически растут на одной ветке**.
//   BG       #1C140F  wet tannin bark
//   INK      #ECDEC5  parchment
//   KEY      #C25958  reddest leaves (anthocyanin peak)
//   METHOD   #D9A864  golden leaves (carotenoid)
//   STRING   #8A9858  last green (residual chlorophyll)
//   PROP     #D9744C  rust orange — mid-transition
//   PUNC     #C2B8A4  bark cream
//   OPERATOR #8C8576  bark grey
//   ACCENT   #D9A864  deep amber — caption line

export default buildCodeFirstScene({
    BG:       '#1C140F',
    INK:      '#ECDEC5',
    KEY:      '#C25958',
    METHOD:   '#D9A864',
    STRING:   '#8A9858',
    PROP:     '#D9744C',
    PARAM:    '#ECDEC5',
    PUNC:     '#C2B8A4',
    OPERATOR: '#8C8576',
    QUIET:    'rgba(236, 222, 197, 0.50)',
    ACCENT:   '#D9A864',
});
