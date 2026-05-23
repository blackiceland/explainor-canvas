import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · DEEP COBALT / BONE / COPPER · QUIET FIELDS variant.
// Гипотеза: PROP (.token / .to / .active / .text / .ok) в исходной
// палитре сидит на уровне METHOD-blue и ACCENT-gold по chrome —
// поля читаются как «события», хотя по семантике это просто
// аксессоры. Здесь PROP уведён в muted warm taupe (#C2B3A2):
// сохраняется тёплая семья (родство с INK), но насыщенность срезана
// на ~70%. Поля садятся в body-text слой, а не в highlight-слой.
// Иерархия в итоге:
//   LOUD     METHOD (steel blue)   — действия
//   LOUD     KEY (lavender)        — структура control flow
//   MEDIUM   STRING (sage green)   — возвращаемые значения
//   QUIET    INK (warm bone)       — body + params
//   QUIETER  PROP (muted taupe)    — fields (changed here)
//   SILENT   PUNC / OPERATOR
//   BG       #111722  graphite-steel
//   INK      #E7E1D6  warm bone (unchanged)
//   KEY      #C7A4EE  lavender bridge (unchanged)
//   METHOD   #86C0EA  steel blue (unchanged)
//   STRING   #A7C992  sage (unchanged)
//   PROP     #D3BD9C  warm champagne с золотым креном — поля
//                     уходят в тот же тёплый луч, что и новый
//                     ACCENT-жёлтый, становятся «приглушённой
//                     роднёй» жёлтого комментария, не отдельным
//                     цветовым событием
//   PUNC     #CBD1DC  cool cream
//   OPERATOR #8F9AAA  cool grey
//   ACCENT   #E8C656  saturated mustard — субтитр-комментарий
//                     («// too many decisions») в чистом жёлтом,
//                     не в antique gold. Завершает тёплый градиент:
//                     INK pale → PROP champagne → ACCENT yellow.

export default buildCodeFirstScene({
    BG:       '#111722',
    INK:      '#E7E1D6',
    KEY:      '#C7A4EE',
    METHOD:   '#86C0EA',
    STRING:   '#A7C992',
    PROP:     '#D3BD9C',
    PARAM:    '#E7E1D6',
    PUNC:     '#CBD1DC',
    OPERATOR: '#8F9AAA',
    QUIET:    'rgba(231, 225, 214, 0.50)',
    ACCENT:   '#E8C656',
});
