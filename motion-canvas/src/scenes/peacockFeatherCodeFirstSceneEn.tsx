import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · PEACOCK FEATHER.
// Источник палитры — переливающееся павлинье перо. Все цвета
// **физически живут в одном пере**: тёмная сердцевина «глаза»,
// иридесцентный сине-зелёный обод, медно-бронзовая радужка,
// золотистая каёмка. Гармония биологическая — эти цвета
// эволюционно подобраны природой быть рядом.
//   BG       #0C1622  dark eyespot core
//   INK      #ECE2D0  feather cream
//   KEY      #2BA6C5  iridescent teal-blue
//   METHOD   #4FB585  iridescent emerald
//   STRING   #D9B260  feather-rim gold
//   PROP     #C2876A  copper-bronze iris
//   PUNC     #CBC4B4  feather cream
//   OPERATOR #7E8590  feather shadow
//   ACCENT   #D9B260  gold

export default buildCodeFirstScene({
    BG:       '#0C1622',
    INK:      '#ECE2D0',
    KEY:      '#2BA6C5',
    METHOD:   '#4FB585',
    STRING:   '#D9B260',
    PROP:     '#C2876A',
    PARAM:    '#ECE2D0',
    PUNC:     '#CBC4B4',
    OPERATOR: '#7E8590',
    QUIET:    'rgba(236, 226, 208, 0.50)',
    ACCENT:   '#D9B260',
});
