import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · STORM SEA.
// Источник палитры — Северное море во время шторма. Всё, что в
// этом кадре есть: тяжёлое сланцевое небо, вспышка молнии,
// сине-зелёная вода с водорослями, обветренная медь корабельных
// заклёпок, белая пена. Цвета органичны, потому что **это
// зарисовка одного места в один момент**.
//   BG       #0E141C  storm slate cloud
//   INK      #ECF1F4  sea foam
//   KEY      #F0DC78  lightning flash (lemon-cream warm rare)
//   METHOD   #5489B5  storm water blue
//   STRING   #4FA59A  deep sea green (water + weeds)
//   PROP     #C58866  weathered ship copper
//   PUNC     #C4CBD2  sea cream
//   OPERATOR #7E8B98  rain grey
//   ACCENT   #F0DC78  lightning — caption line

export default buildCodeFirstScene({
    BG:       '#0E141C',
    INK:      '#ECF1F4',
    KEY:      '#F0DC78',
    METHOD:   '#5489B5',
    STRING:   '#4FA59A',
    PROP:     '#C58866',
    PARAM:    '#ECF1F4',
    PUNC:     '#C4CBD2',
    OPERATOR: '#7E8B98',
    QUIET:    'rgba(236, 241, 244, 0.50)',
    ACCENT:   '#F0DC78',
});
