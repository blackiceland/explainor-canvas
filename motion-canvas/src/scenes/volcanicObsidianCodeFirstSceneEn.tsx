import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · VOLCANIC OBSIDIAN.
// Источник палитры — действующий вулкан в разрезе. Обсидиановое
// стекло (фон с лёгким фиолетовым подтоном), горячая лава, остывающая
// корка лавы, серая базальтовая порода, жёлтые серные отложения у
// фумарол. Каждый цвет — это **физическое состояние одной и той же
// магмы** на разных температурах и стадиях.
//   BG       #100A14  obsidian glass — purple-tinged black
//   INK      #DDD8D2  volcanic ash
//   KEY      #E58046  hot lava (1100°C)
//   METHOD   #6E8FA0  cold basalt mineral
//   STRING   #B4B958  sulfur deposit
//   PROP     #B85940  cooling lava crust (700°C)
//   PUNC     #C0BAB2  ash cream
//   OPERATOR #807A78  ash grey
//   ACCENT   #E58046  hot lava — caption line

export default buildCodeFirstScene({
    BG:       '#100A14',
    INK:      '#DDD8D2',
    KEY:      '#E58046',
    METHOD:   '#6E8FA0',
    STRING:   '#B4B958',
    PROP:     '#B85940',
    PARAM:    '#DDD8D2',
    PUNC:     '#C0BAB2',
    OPERATOR: '#807A78',
    QUIET:    'rgba(221, 216, 210, 0.50)',
    ACCENT:   '#E58046',
});
