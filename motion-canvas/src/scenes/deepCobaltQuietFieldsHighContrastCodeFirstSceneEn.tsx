import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · DEEP COBALT QUIET FIELDS · HIGH CONTRAST.
// Та же hue-карта, но раздвинуты светлоты: BG глубже, токены
// ярче. Цель — максимальная читаемость на маленьком экране
// (TikTok / Reels). Это НЕ punched: насыщенность та же, поднята
// только luminance acent-токенов и опущена luminance BG. Эффект:
// палитра звучит громче без перенасыщения.
//   BG       #080A14  near-black cobalt (deeper)
//   INK      #EFEAE0  brighter bone
//   KEY      #D4AAFF  brighter lavender
//   METHOD   #6FCEFF  brighter cobalt
//   STRING   #ADD698  brighter green
//   PROP     #DCC4A0  brighter champagne (но всё ещё quiet)
//   PUNC     #D5DAE5  brighter cool cream
//   OPERATOR #95A0B0  slightly brighter grey
//   ACCENT   #FFD350  brighter clean yellow

export default buildCodeFirstScene({
    BG:       '#080A14',
    INK:      '#EFEAE0',
    KEY:      '#D4AAFF',
    METHOD:   '#6FCEFF',
    STRING:   '#ADD698',
    PROP:     '#DCC4A0',
    PARAM:    '#EFEAE0',
    PUNC:     '#D5DAE5',
    OPERATOR: '#95A0B0',
    QUIET:    'rgba(239, 234, 224, 0.50)',
    ACCENT:   '#FFD350',
});
