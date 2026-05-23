import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · JEWEL BEETLE (Sternocera aequisignata).
// Источник палитры — надкрылья драгоценного жука Sternocera,
// которые в Индии и Таиланде веками использовали как естественный
// материал для вышивки. Это **металлический пигмент**: основной
// зелёный с золотым отливом, медное брюшко, оливковая граница
// сегментов, тёмная как у peacock основа. Принцип отличает beetle
// от peacock'а: peacock даёт **холодную** иридесценцию (teal+
// emerald), beetle — **тёплую** (gold+green+copper).
//   BG       #0F1410  deep elytra shadow
//   INK      #E6E0CB  cream underside
//   KEY      #5FB85E  metallic elytral green — primary
//   METHOD   #D9B05C  metallic gold rim
//   STRING   #B8A04F  olive metallic — segment border
//   PROP     #C26F3E  copper underside
//   PUNC     #B8B5A0  cream warm
//   OPERATOR #7E826F  olive grey
//   ACCENT   #D9B05C  metallic gold

export default buildCodeFirstScene({
    BG:       '#0F1410',
    INK:      '#E6E0CB',
    KEY:      '#5FB85E',
    METHOD:   '#D9B05C',
    STRING:   '#B8A04F',
    PROP:     '#C26F3E',
    PARAM:    '#E6E0CB',
    PUNC:     '#B8B5A0',
    OPERATOR: '#7E826F',
    QUIET:    'rgba(230, 224, 203, 0.50)',
    ACCENT:   '#D9B05C',
});
