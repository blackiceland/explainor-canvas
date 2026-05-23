import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · DEEP COBALT QUIET FIELDS · PUNCHED.
// Та же палитра по hue, но насыщенность всех акцентных токенов
// поднята на ~15-20%. Лавандовый яснее, голубой ближе к чистому
// cobalt, зелёный ярче, ACCENT — чище yellow без gold-крена,
// PROP остаётся приглушённым (он QUIET по дизайну, его поднимать
// нельзя — иначе теряется вся идея сцены). Эффект: «punched» —
// палитра звучит громче, но не неоновее.
//   BG       #111722  unchanged
//   INK      #E7E1D6  warm bone
//   KEY      #B98EF0  more saturated lavender
//   METHOD   #6CC0F0  cleaner cobalt blue
//   STRING   #9CCE82  more chromatic green
//   PROP     #D6B888  champagne с чуть большим золотом (только +12)
//   PUNC     #CBD1DC  cool cream (без изменений)
//   OPERATOR #8F9AAA  unchanged
//   ACCENT   #F0CC44  cleaner saturated yellow

export default buildCodeFirstScene({
    BG:       '#111722',
    INK:      '#E7E1D6',
    KEY:      '#B98EF0',
    METHOD:   '#6CC0F0',
    STRING:   '#9CCE82',
    PROP:     '#D6B888',
    PARAM:    '#E7E1D6',
    PUNC:     '#CBD1DC',
    OPERATOR: '#8F9AAA',
    QUIET:    'rgba(231, 225, 214, 0.50)',
    ACCENT:   '#F0CC44',
});
