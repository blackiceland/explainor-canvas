import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · AURORA BOREALIS.
// Источник палитры — полярная ночь над Норвегией. Глубокое
// синее небо, поверх которого светятся ленты сияния: чаще всего
// зелёная (кислород, 100–250 км), реже magenta-красная (азот,
// выше 250 км), внизу слабый бирюзовый glow. Цвета не подбирались —
// их **выпускают разные молекулы атмосферы** на разных высотах.
// Поэтому они органично сосуществуют в одном кадре неба.
//   BG       #0A1230  polar night sky (saturated cool dark)
//   INK      #ECEFF5  starlight white
//   KEY      #5DD8A8  aurora green — oxygen 100–250km
//   METHOD   #D26FB0  aurora magenta — nitrogen 250km+
//   STRING   #9CD9C8  low aurora teal glow
//   PROP     #E0795E  rare red band — oxygen at extreme altitude
//   PUNC     #C5C9D4  ice cream
//   OPERATOR #7E859A  night grey
//   ACCENT   #5DD8A8  aurora green — caption line

export default buildCodeFirstScene({
    BG:       '#0A1230',
    INK:      '#ECEFF5',
    KEY:      '#5DD8A8',
    METHOD:   '#D26FB0',
    STRING:   '#9CD9C8',
    PROP:     '#E0795E',
    PARAM:    '#ECEFF5',
    PUNC:     '#C5C9D4',
    OPERATOR: '#7E859A',
    QUIET:    'rgba(236, 239, 245, 0.50)',
    ACCENT:   '#5DD8A8',
});
