import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · DEEP COBALT QUIET FIELDS · MONOCHROME BLUES.
// Радикальная редукция: ВСЕ токены живут в синей семье (от
// фиолетово-синего до сине-зелёного), единственный выход —
// жёлтый ACCENT в субтитре. Палитра становится двухтоновой:
// синяя семья + один тёплый акцент. KEY — blue-violet, METHOD —
// mid blue, STRING — teal (бывший зелёный уведён в синь), PROP —
// slate-blue-grey. Эффект: цельность за счёт одной семьи, нет
// конкуренции между токенами по hue.
//   BG       #111722  cobalt graphite
//   INK      #E2E5EC  cool bone (легче ушёл в синь)
//   KEY      #9CA8E8  blue-violet
//   METHOD   #7AB8E8  mid blue (steel)
//   STRING   #80B8C0  teal — был sage green
//   PROP     #B8B8C8  slate-blue-grey
//   PUNC     #C5CCD8  cool cream
//   OPERATOR #8590A0  cool grey
//   ACCENT   #E8C656  mustard — единственный тёплый

export default buildCodeFirstScene({
    BG:       '#111722',
    INK:      '#E2E5EC',
    KEY:      '#9CA8E8',
    METHOD:   '#7AB8E8',
    STRING:   '#80B8C0',
    PROP:     '#B8B8C8',
    PARAM:    '#E2E5EC',
    PUNC:     '#C5CCD8',
    OPERATOR: '#8590A0',
    QUIET:    'rgba(226, 229, 236, 0.50)',
    ACCENT:   '#E8C656',
});
