import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · HUMMINGBIRD GORGET.
// Источник палитры — горловое оперение колибри (gorget). В одной
// зоне птица носит **рубиново-красную грудку**, изумрудное крыло
// и сапфировые кончики перьев — это структурная иридесценция, не
// пигмент. По принципу похоже на peacock, но баланс перевёрнут:
// peacock = «cool teal-blue доминирует», hummingbird = «warm ruby
// доминирует, cool emerald/sapphire — редкие холодные пятна».
//   BG       #1A0A14  deep gorget shadow
//   INK      #ECDED2  feather cream
//   KEY      #DA3C5C  ruby gorget — warm dominant
//   METHOD   #4FAE7E  emerald wing
//   STRING   #D9B260  gold throat fleck
//   PROP     #6A8EC2  sapphire feather cap
//   PUNC     #C9C0BE  feather cream
//   OPERATOR #807679  muted plum
//   ACCENT   #D9B260  gold

export default buildCodeFirstScene({
    BG:       '#1A0A14',
    INK:      '#ECDED2',
    KEY:      '#DA3C5C',
    METHOD:   '#4FAE7E',
    STRING:   '#D9B260',
    PROP:     '#6A8EC2',
    PARAM:    '#ECDED2',
    PUNC:     '#C9C0BE',
    OPERATOR: '#807679',
    QUIET:    'rgba(236, 222, 210, 0.50)',
    ACCENT:   '#D9B260',
});
