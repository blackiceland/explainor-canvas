import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · DEEP COBALT / BONE / COPPER · MUSTARD STRING variant.
// Гипотеза: STRING переведён в saturated mustard (#E8C656). В
// палитре уже выстроена тёплая градация по светлоте:
//   INK     #E7E1D6   pale cream
//   PROP    #D9A88F   sand / copper
//   ACCENT  #D2A05E   antique gold
// Жёлтый STRING встаёт в эту градацию как самый яркий член —
// не четвёртый одинаковый тёплый токен, а ЗАВЕРШЕНИЕ градиента
// (peacock-логика, применённая к deepCobalt). Холодный полюс
// (BG + METHOD + KEY-мост) остаётся нетронутым.
// Семантический бонус: STRING — это значения, которые меняются
// между вызовами ('sent' / 'blocked' / 'expired') — высокая
// светлота оправдана для «меняющихся данных».
//   BG       #111722  graphite-steel
//   INK      #E7E1D6  warm bone
//   KEY      #C7A4EE  lavender bridge
//   METHOD   #86C0EA  steel blue
//   STRING   #E8C656  saturated mustard — top of warm gradient
//   PROP     #D9A88F  sand / copper
//   PUNC     #CBD1DC  cool cream
//   OPERATOR #8F9AAA  cool grey
//   ACCENT   #D2A05E  antique gold — caption line

export default buildCodeFirstScene({
    BG:       '#111722',
    INK:      '#E7E1D6',
    KEY:      '#C7A4EE',
    METHOD:   '#86C0EA',
    STRING:   '#E8C656',
    PROP:     '#D9A88F',
    PARAM:    '#E7E1D6',
    PUNC:     '#CBD1DC',
    OPERATOR: '#8F9AAA',
    QUIET:    'rgba(231, 225, 214, 0.50)',
    ACCENT:   '#D2A05E',
});
