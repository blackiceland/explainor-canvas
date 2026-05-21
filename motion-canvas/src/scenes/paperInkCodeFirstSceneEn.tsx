import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · PAPER INK · EDITORIAL LIGHT.
// Light version, но не «тёмная тема навыворот»: логика другая —
// «дорогая бумага + чернильный код + приглушённые акценты». Фон
// тёплый (НЕ #FFFFFF), код — глубокий и плотный, акценты dusty.
//   BG       #F3EFE7  warm paper / linen (не белый)
//   INK      #252832  ink dark — main text, caption
//   KEY      #7A5CA8  dusty violet
//   METHOD   #2F6F91  ink blue
//   STRING   #5F7F4E  olive — keeps balance, not pastel-green
//   PROP     #A76F45  copper-camel (muted, warm)
//   PUNC     #3B3F4A  ink punctuation, slightly lifted
//   OPERATOR #6E7580  ink grey
//   ACCENT   #B47A3C  copper-gold — caption "decisions"
//
// Note: same weight (500 / Medium) and layout as the dark themes.
// Caption renders dark on warm paper — strongest editorial contrast.

export default buildCodeFirstScene({
    BG:       '#F3EFE7',
    INK:      '#252832',
    KEY:      '#7A5CA8',
    METHOD:   '#2F6F91',
    STRING:   '#5F7F4E',
    PROP:     '#A76F45',
    PARAM:    '#252832',
    PUNC:     '#3B3F4A',
    OPERATOR: '#6E7580',
    QUIET:    'rgba(37, 40, 50, 0.50)',
    ACCENT:   '#B47A3C',
});
