import {buildDuplicationScene} from './_duplicationShared';

// Palette: SLATE / AMBER / SAGE.
// Самый безопасный и журнальный из 4 вариантов. Тёплый, дорогой,
// без соцсетевого вайба. Lavender keyword + slate blue method
// дают разнесённые холодные акценты, sage + sand — мягкая
// двойная тёплая поддержка, amber точкой на italic "bad."
const METHOD = '#86B7E8';

export default buildDuplicationScene({
    BG:       '#161A24',
    INK:      '#E8E5DD',
    KEY:      '#B79CFF',
    DOMAIN:   METHOD,
    CALL:     METHOD,
    STRING:   '#A7C89A',
    PROP:     '#D9B38C',
    PARAM:    '#E8E5DD',
    PUNC:     'rgba(232, 229, 221, 0.62)',
    OPERATOR: 'rgba(232, 229, 221, 0.62)',
    PUNCH:    '#F0B06E',
    HERO:     METHOD,
    QUIET:    'rgba(232, 229, 221, 0.45)',
});
