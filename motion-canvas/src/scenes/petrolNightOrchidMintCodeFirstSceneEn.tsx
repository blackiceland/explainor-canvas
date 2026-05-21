import {buildCodeFirstScene} from './_codeFirstShared';

// Theme 1 · PETROL NIGHT / ORCHID / MINT.
// Уход из navy в глубокий зелёно-синий нефтяной фон. Cyan-mint
// функции + orchid keyword + mint strings — холодная кодовая
// сочность, но не «sine-purple s4». Caption accent остаётся
// orchid'ом (= KEY), как и в реф-эстетике.
//   BG       #0E1A20  petrol deep
//   INK      #E3E8E6  cool cream
//   KEY      #CFA6FF  orchid (=caption accent)
//   METHOD   #66C6D4  cyan-mint
//   STRING   #A8D989  fresh mint
//   PROP     #E49AAA  warm pink
//   PUNC     #CAD3D2  cool cream
//   OPERATOR #8EA3A8  dim petrol-grey

export default buildCodeFirstScene({
    BG:       '#0E1A20',
    INK:      '#E3E8E6',
    KEY:      '#CFA6FF',
    METHOD:   '#66C6D4',
    STRING:   '#A8D989',
    PROP:     '#E49AAA',
    PARAM:    '#E3E8E6',
    PUNC:     '#CAD3D2',
    OPERATOR: '#8EA3A8',
    QUIET:    'rgba(227, 232, 230, 0.50)',
});
