import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · BLACK OPAL.
// Источник палитры — австралийский black opal. Это драгоценный
// камень с **тёмной матрицей**, внутри которой возникают
// дискретные «вспышки огня» — turquoise, cobalt, amber, magenta.
// Цвета не смешиваются и не градиентят: каждый — отдельная вспышка
// света на чёрном поле. Принцип отличает opal от peacock'а:
// peacock — это иридесцентный **переход**, opal — это набор
// **независимых вспышек** на общем тёмном.
//   BG       #0A0810  black opal matrix
//   INK      #E6E0E8  milky base
//   KEY      #5DCABE  turquoise fire flash
//   METHOD   #6F8FE6  sapphire fire
//   STRING   #D9A864  amber fire
//   PROP     #C25CB2  magenta fire
//   PUNC     #B8B5C2  milky cool
//   OPERATOR #7872A0  muted opal grey
//   ACCENT   #D9A864  amber

export default buildCodeFirstScene({
    BG:       '#0A0810',
    INK:      '#E6E0E8',
    KEY:      '#5DCABE',
    METHOD:   '#6F8FE6',
    STRING:   '#D9A864',
    PROP:     '#C25CB2',
    PARAM:    '#E6E0E8',
    PUNC:     '#B8B5C2',
    OPERATOR: '#7872A0',
    QUIET:    'rgba(230, 224, 232, 0.50)',
    ACCENT:   '#D9A864',
});
