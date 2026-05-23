import {buildCodeFirstScene} from './_codeFirstShared';

// Velvet palette + Geist Mono font.
// Geist Mono — современный free-mono от Vercel. Чище и
// функциональнее JBM, минималистичная геометрия. Несёт vibes
// модернистских dev-tools 2023-2024 (Vercel, Next.js).

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
    {fontFamily: '"Geist Mono", monospace'},
);
