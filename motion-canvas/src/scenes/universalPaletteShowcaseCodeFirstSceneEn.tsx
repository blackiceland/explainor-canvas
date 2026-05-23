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
        // Палитра выровнена под deepCobaltQuietFieldsVelvet (scene 1):
        // те же hex для BG/INK/KEY/METHOD/STRING/PUNC/OPERATOR/ACCENT.
        // Universal расширяет Velvet ДВУМЯ новыми слотами:
        //   TYPE     — лавандовый (Velvet не имел отдельного цвета типов)
        //   LITERAL  — тот же sage что STRING (Velvet не имел отдельного
        //              цвета для чисел, они там попадали в INK; здесь
        //              для согласованности «значений» 3/5000/false идут
        //              в один зелёный со строками)
        // PARAM и PROP оба = INK, как в Velvet (params/locals/fields
        // сливаются в один «идентификатор пользователя» цвет).
        BG:       '#111722',
        INK:      '#E7E1D6',  // body text / locals
        PARAM:    '#E7E1D6',  // = INK (как в Velvet)
        KEY:      '#BFADE1',  // ВСЕ keywords — фиолетовый, +5% lightness
        METHOD:   '#83BCE2',  // function defs + calls, +5% lightness
        TYPE:     '#D8CEEC',  // types — нежный лавандовый (расширение)
        STRING:   '#A7C992',  // string literals — Velvet sage
                              // (синхронизировано с scene 1)
        LITERAL:  '#A7C992',  // numbers + true/false/null — тот же sage
                              // (расширение Velvet: там числа = INK,
                              // здесь объединены с строками в один зелёный)
        PROP:     '#E7E1D6',  // = INK (как в Velvet)
        PUNC:     '#CBD1DC',  // brackets, commas (Velvet)
        OPERATOR: '#8F9AAA',  // operators (Velvet)
        QUIET:    'rgba(231, 225, 214, 0.50)',
        ACCENT:   '#E8C656',  // subtitle mustard (Velvet)
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
