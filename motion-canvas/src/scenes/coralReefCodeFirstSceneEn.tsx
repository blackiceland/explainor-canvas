import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · CORAL REEF.
// Источник палитры — тропический риф на глубине 8–12 м. Цвета
// рифовых рыб — это **сигнальная биология**, эволюционно
// доведённая до максимальной контрастности: yellow tang, regal
// blue tang (та самая «Дори»), оранжевая клоунская рыба,
// magenta fairy basslet. Принцип отличает риф от peacock'а: peacock
// — это **один организм с гармонизированной палитрой**, риф — это
// **разные виды**, которые соседствуют, потому что глубокая вода
// их объединяет фоном.
//   BG       #08182A  tropical deep water 10m
//   INK      #ECF1F4  sand bottom
//   KEY      #EBC960  yellow tang
//   METHOD   #4F90D0  regal tang blue (Dory)
//   STRING   #5FAE8E  reef coral green
//   PROP     #E0784E  clownfish orange
//   PUNC     #C5D0DA  underwater cream
//   OPERATOR #7E8898  water grey
//   ACCENT   #EBC960  yellow tang — caption line

export default buildCodeFirstScene({
    BG:       '#08182A',
    INK:      '#ECF1F4',
    KEY:      '#EBC960',
    METHOD:   '#4F90D0',
    STRING:   '#5FAE8E',
    PROP:     '#E0784E',
    PARAM:    '#ECF1F4',
    PUNC:     '#C5D0DA',
    OPERATOR: '#7E8898',
    QUIET:    'rgba(236, 241, 244, 0.50)',
    ACCENT:   '#EBC960',
});
