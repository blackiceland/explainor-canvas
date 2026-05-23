import {buildUniversalCodeScene} from './_codeUniversalShared';

// SHOWCASE универсальной палитры. Демонстрирует все слоты:
//   PARAM   — `env` (параметр функции, отличается от INK)
//   LITERAL — `3`, `5000`, `false` (числа и keyword-литералы)
//   TYPE    — `Settings`, `number`, `string`, `boolean` (типы) —
//             ЛАВАНДОВЫЙ, светлее KEY-фиолетового, та же violet-семья
//   KEY     — ВСЕ keywords: interface, const, function, if, return
//             (фиолетовый, без разделения на declarations/flow)
//   METHOD  — `load`, `parse` (вызовы и определения функций)
// Velvet-семья по hue, расширенный охват ролей.
//
// Три логических блока разделены пустыми строками, плюс пустая
// строка между if-блоком и финальным return внутри функции.

const CODE = `interface Settings {
  retries: number
  timeout: number
  debug: boolean
}

const defaults: Settings = {
  retries: 3,
  timeout: 5000,
  debug: false,
}

function load(env: string): Settings {
  if (env === "prod") {
    return defaults
  }

  return parse(env, defaults)
}`;

export default buildUniversalCodeScene(
    {
        BG:       '#111722',
        INK:      '#E7E1D6',  // body text / locals
        PARAM:    '#D8CCB8',  // function params — INK с лёгким champagne-крен
        KEY:      '#B6A1DD',  // ВСЕ keywords — фиолетовый, чуть светлее
                              // прежнего #B19BDA (на «дец» lighter)
        METHOD:   '#6CB0DD',  // function defs + calls (Velvet sky-indigo)
        TYPE:     '#D8CEEC',  // types — нежный лавандовый (lum↑, chroma↓
                              // от #D4C5EC; та же violet-семья что и KEY)
        STRING:   '#7FB89E',  // string literals — ТОТ ЖЕ зелёный что LITERAL
                              // (значения едины: "prod" и 3, 5000 — одного цвета)
        LITERAL:  '#7FB89E',  // numbers + true/false/null
        PROP:     '#D9C8AE',  // .property access — нежнее champagne, меньше
                              // золотого крена, больше cream
        PUNC:     '#CBD1DC',  // brackets, commas
        OPERATOR: '#8F9AAA',  // =, ===, =>, etc.
        QUIET:    'rgba(231, 225, 214, 0.50)',
        ACCENT:   '#E8C656',  // subtitle mustard
    },
    {
        code: CODE,
        caption: '// universal palette',
        params: ['env'],
        props: ['retries', 'timeout', 'debug'],
        typeNames: ['Settings'],
        methodNames: ['load', 'parse'],
    },
);
