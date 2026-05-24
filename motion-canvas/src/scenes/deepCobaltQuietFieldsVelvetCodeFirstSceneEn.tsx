import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · DEEP COBALT QUIET FIELDS · VELVET.
// Середина между AmethystSapphire (jewel, тяжёлый) и Smoky
// (тёмная роскошь, бледный). Сохраняет luminance близко к base
// (т.е. не «темнее»), но поднимает chroma и слегка двигает hue:
// KEY уходит немного синее (меньше pink-крен в лавандовом),
// METHOD получает чуть больше плотности (sky → indigo-sky).
// Сравнение трёх позиций:
//   base               KEY #C7A4EE / METHOD #86C0EA   pastel candy
//   AmethystSapphire   KEY #9D7AD8 / METHOD #4D94CC   jewel deep (heavy)
//   Smoky              KEY #A893C0 / METHOD #6FA0BC   muted (pale)
//   Velvet (this)      KEY #B294E0 / METHOD #6CB0DD   richer base
//   BG       #111722  unchanged
//   INK      #E7E1D6  warm bone (unchanged)
//   KEY      #B19BDA  velvet violet (de-toxic) — глубже base, не
//                     jewel, но без электрического неонового
//                     крена (B↓4, G↑7 от #B294E0 — снимает ту
//                     самую «ядовитость» лавандового)
//   METHOD   #6CB0DD  velvet sky-indigo — глубже base, не sapphire
//   STRING   #A7C992  sage (unchanged)
//   PROP     #D3BD9C  champagne (unchanged)
//   PUNC     #CBD1DC  cool cream (unchanged)
//   OPERATOR #8F9AAA  cool grey (unchanged)
//   ACCENT   #E8C656  mustard (unchanged)

export default buildCodeFirstScene({
    BG:       '#151A28',
    INK:      '#E7E1D6',
    KEY:      '#CAB4EA',
    METHOD:   '#8AC7EF',
    STRING:   '#A8CF98',
    PROP:     '#E7E1D6',
    PARAM:    '#E7E1D6',
    PUNC:     '#D2D8E2',
    OPERATOR: '#8F9AAA',
    QUIET:    'rgba(231, 225, 214, 0.50)',
    ACCENT:   '#E8C656',
});
