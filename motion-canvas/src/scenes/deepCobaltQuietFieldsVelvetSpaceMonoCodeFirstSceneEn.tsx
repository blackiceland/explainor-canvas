import {buildCodeFirstScene} from './_codeFirstShared';

// Velvet palette + Space Mono font.
// Space Mono — самый «характерный» в списке. Большие округлые
// формы, retro-futuristic, ассоциируется с NASA / 60-х
// computing aesthetic. Не для всех контекстов — несёт сильный
// дизайнерский tone-of-voice сам по себе.

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
    {fontFamily: '"Space Mono", monospace'},
);
