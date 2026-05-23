import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · DEEP COBALT QUIET FIELDS · WARM SHIFT.
// Все токены сдвинуты в тёплую сторону. Лавандовый получает
// розовато-сливовый поддон (mauve), голубой теряет немного хромы,
// зелёный уходит в olive, champagne PROP становится cognac,
// жёлтый ACCENT — amber. BG слегка теплее. Эффект: «cognac
// library» — палитра звучит как кабинет с тёплыми лампами.
//   BG       #14182A  slightly warmer graphite
//   INK      #E7E1D6  warm bone (anchor)
//   KEY      #D2A5DC  mauve / plum-lavender
//   METHOD   #92BCD8  slightly desaturated steel
//   STRING   #B5C982  olive-green
//   PROP     #D9B690  warmer cognac
//   PUNC     #CFCFD0  neutral warm cream
//   OPERATOR #9494A0  warm-leaning grey
//   ACCENT   #E8B044  amber (был mustard yellow)

export default buildCodeFirstScene({
    BG:       '#14182A',
    INK:      '#E7E1D6',
    KEY:      '#D2A5DC',
    METHOD:   '#92BCD8',
    STRING:   '#B5C982',
    PROP:     '#D9B690',
    PARAM:    '#E7E1D6',
    PUNC:     '#CFCFD0',
    OPERATOR: '#9494A0',
    QUIET:    'rgba(231, 225, 214, 0.50)',
    ACCENT:   '#E8B044',
});
