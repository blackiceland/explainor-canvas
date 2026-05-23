import {buildCodeFirstScene} from './_codeFirstShared';

// Velvet palette + Fira Code font.
// Fira Code — популярный free-mono с лигатурами (===, =>, !==).
// Чуть шире JBM, более «округлый», humanist-уклон. Часто
// ассоциируется с Linux/devops окружением.

export default buildCodeFirstScene(
    {
        BG:       '#111722',
        INK:      '#E7E1D6',
        KEY:      '#BFADE1',
        METHOD:   '#83BCE2',
        STRING:   '#9CC4A0',
        PROP:     '#E7E1D6',
        PARAM:    '#E7E1D6',
        PUNC:     '#CBD1DC',
        OPERATOR: '#8F9AAA',
        QUIET:    'rgba(231, 225, 214, 0.50)',
        ACCENT:   '#E8C656',
    },
    {fontFamily: '"Fira Code", monospace'},
);
