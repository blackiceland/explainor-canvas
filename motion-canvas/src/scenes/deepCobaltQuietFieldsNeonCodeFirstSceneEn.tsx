import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · DEEP COBALT QUIET FIELDS · NEON WIRE.
// Digital/tech уклон — цвета чистые, синтетические, как на
// printed circuit board. KEY — clean tech purple, METHOD —
// clean cyan, STRING — clean lime, ACCENT — clean amber.
// PROP остаётся приглушённым (как припой между дорожками).
// Без olive, без taupe, без champagne — никакой природы.
//   BG       #0A1020  deep tech-dark
//   INK      #E7E5DC  slightly cool bone
//   KEY      #C895FF  clean tech purple
//   METHOD   #5EC8F8  clean tech cyan
//   STRING   #88E0A0  clean tech green
//   PROP     #C8B898  muted solder
//   PUNC     #C0C8D8  cool tech cream
//   OPERATOR #8090A8  blue-grey
//   ACCENT   #FACC4A  clean tech amber

export default buildCodeFirstScene({
    BG:       '#0A1020',
    INK:      '#E7E5DC',
    KEY:      '#C895FF',
    METHOD:   '#5EC8F8',
    STRING:   '#88E0A0',
    PROP:     '#C8B898',
    PARAM:    '#E7E5DC',
    PUNC:     '#C0C8D8',
    OPERATOR: '#8090A8',
    QUIET:    'rgba(231, 229, 220, 0.50)',
    ACCENT:   '#FACC4A',
});
