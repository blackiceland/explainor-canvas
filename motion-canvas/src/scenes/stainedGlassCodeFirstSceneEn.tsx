import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · STAINED GLASS.
// Источник палитры — готическое витражное окно (Сент-Шапель,
// Шартр). Это **прошлённый свет через окрашенное стекло**, не
// пигмент: рубин, кобальт, янтарь, шалфейное стекло, разделённые
// тёмными свинцовыми прожилками. Принцип отличает витраж от
// peacock'а/opal'а: цвета не «лежат рядом», а **изолированы
// перегородками** — каждый светится в своей панели. PUNC и
// OPERATOR играют роль свинцовых прожилок.
//   BG       #0A1430  lead-night between panels
//   INK      #ECE2D0  candle-lit interior
//   KEY      #DA3C4C  ruby panel
//   METHOD   #4A7AB8  Chartres cobalt panel
//   STRING   #D9A864  amber panel
//   PROP     #7AAE5C  sage glass panel
//   PUNC     #C2CAD4  candle cream cool
//   OPERATOR #7E8390  lead came (the dark dividers)
//   ACCENT   #DA3C4C  ruby — caption line

export default buildCodeFirstScene({
    BG:       '#0A1430',
    INK:      '#ECE2D0',
    KEY:      '#DA3C4C',
    METHOD:   '#4A7AB8',
    STRING:   '#D9A864',
    PROP:     '#7AAE5C',
    PARAM:    '#ECE2D0',
    PUNC:     '#C2CAD4',
    OPERATOR: '#7E8390',
    QUIET:    'rgba(236, 226, 208, 0.50)',
    ACCENT:   '#DA3C4C',
});
