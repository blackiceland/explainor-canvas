import {buildCodeFirstScene} from './_codeFirstShared';

// Velvet palette + Cascadia Code font.
// Cascadia — Microsoft / Windows Terminal default. Modern,
// чистая геометрия, есть cursive italic. Уже установлен в
// большинстве Windows и WSL окружений. Если зрители на Windows
// часто видят его в VS Code / Windows Terminal — это family vibe.

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
    {fontFamily: '"Cascadia Code", "Cascadia Mono", "JetBrains Mono", monospace'},
);
