import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · DEEP COBALT QUIET FIELDS · DUSTED.
// Та же палитра по hue, но насыщенность ВСЕХ акцентных токенов
// срезана. Лавандовый — dusty, голубой — chalk-blue, зелёный —
// dusty sage, ACCENT — старый дымчатый жёлтый, PROP уходит ещё
// тише. Эффект: «pastel chalk» — палитра звучит как старая
// фреска, всё пыльное и тихое. Риск: слишком ровно, слишком
// «mood», без активных пиков. Хорошо для длинных кадров с
// озвучкой, плохо для одиночного TikTok-вертикала.
//   BG       #111722  unchanged
//   INK      #E7E1D6  warm bone
//   KEY      #BBA8D8  dusty lavender
//   METHOD   #94B5CC  chalk-blue
//   STRING   #ACBE9C  dusty sage
//   PROP     #C8BAA2  dusty champagne (ещё тише)
//   PUNC     #C8CCD3  dusty cream
//   OPERATOR #8F9AAA  unchanged
//   ACCENT   #D6BD70  dusty yellow

export default buildCodeFirstScene({
    BG:       '#111722',
    INK:      '#E7E1D6',
    KEY:      '#BBA8D8',
    METHOD:   '#94B5CC',
    STRING:   '#ACBE9C',
    PROP:     '#C8BAA2',
    PARAM:    '#E7E1D6',
    PUNC:     '#C8CCD3',
    OPERATOR: '#8F9AAA',
    QUIET:    'rgba(231, 225, 214, 0.50)',
    ACCENT:   '#D6BD70',
});
