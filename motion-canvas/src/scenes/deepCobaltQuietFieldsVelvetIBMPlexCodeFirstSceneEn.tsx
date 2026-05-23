import {buildCodeFirstScene} from './_codeFirstShared';

// Velvet palette + IBM Plex Mono font.
// IBM Plex Mono — корпоративный modernism, более «инженерный»
// силуэт. Чуть уже JBM, прямые засечки на терминалах. Несёт
// industrial-эстетику IBM design system.

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
    {fontFamily: '"IBM Plex Mono", monospace'},
);
