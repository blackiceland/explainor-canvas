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
        BG:       '#151A28',
        INK:      '#E7E1D6',
        PARAM:    '#E7E1D6',
        KEY:      '#CAB4EA',
        METHOD:   '#8AC7EF',
        TYPE:     '#D8CEEC',
        STRING:   '#A8CF98',
        LITERAL:  '#8BA1C1',
        PROP:     '#E7E1D6',
        PUNC:     '#D2D8E2',
        OPERATOR: '#8F9AAA',
        QUIET:    'rgba(231, 225, 214, 0.50)',
        ACCENT:   '#E8C656',
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
