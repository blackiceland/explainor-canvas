import {buildDuplicationScene} from './_duplicationShared';

// Palette: DEEP TEAL / SAND / ROSE.
// Самый «авторский» из 4. Уход из синего интернета в морскую
// глубину. Mauve keyword + teal method — две холодные ноты в
// одной семье, rose на полях добавляет тёплой человечности,
// sand на italic "bad." — единственная горячая точка.
const METHOD = '#6FC7D8';

export default buildDuplicationScene({
    BG:       '#132026',
    INK:      '#EAE7DF',
    KEY:      '#D7A6FF',
    DOMAIN:   METHOD,
    CALL:     METHOD,
    STRING:   '#9FC8A7',
    PROP:     '#E5A3A6',
    PARAM:    '#EAE7DF',
    PUNC:     'rgba(234, 231, 223, 0.62)',
    OPERATOR: 'rgba(234, 231, 223, 0.62)',
    PUNCH:    '#E8BE7A',
    HERO:     METHOD,
    QUIET:    'rgba(234, 231, 223, 0.45)',
});
