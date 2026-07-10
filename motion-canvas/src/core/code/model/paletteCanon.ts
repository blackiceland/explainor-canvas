import {ColorRule, Manticore} from '../components/Manticore';
import {SyntaxTheme} from './SyntaxTheme';

// ── КАНОН ПАЛИТРЫ · эталон цвета для код-сцен ──────────────────────────
// Единый источник правды. Собран и утверждён в paletteLabSceneRu.
//
// Вариант A (go-forward): это НОВЫЙ модуль. Существующие сцены пока на старой
// DryFiltersV3CodeTheme и не меняются — мигрируют на канон по одной, осознанно.
// Новые сцены: theme: CanonCodeTheme  +  colorize(buildCanonRules({...}))
//              + paintCanonParams(mc) + paintCanonMethodCalls(mc).
//
// Логика палитры:
//  • фон — поднятый графит (не near-black: муть на чёрном уходит);
//  • холодная семья — ключевые/числа (синий), типы (лаванда), поля (синий),
//    константы (тил); все свежие, не «дасти»;
//  • тёплый акцент — методы: определение = якорь, вызовы = чистый пастель (тинт
//    К БЕЛОМУ, не к серому — иначе «грязь»);
//  • «значения» тёплые/зелёные — строки (свежий зелёный);
//  • второстепенное — нейтраль (пунктуация, комментарии); булев НЕ красим.

export const CanonBg = {
  from: '#15161A',   // верх вертикального графитового градиента
  to:   '#1C1E24',   // низ
};

export const Canon = {
  // нейтраль
  ink:         'rgba(244,241,235,0.96)',   // переменные / receiver / plain
  punctuation: 'rgba(244,241,235,0.58)',   // пунктуация / операторы
  comment:     'rgba(244,241,235,0.45)',   // комментарии

  // холодная семья
  keyword:     '#A3CDFF',                  // ключевые слова + аннотации + ЧИСЛА
  number:      '#A3CDFF',                  // = keyword
  type:        'rgba(205,198,250,0.90)',   // типы — свежая лаванда
  param:       '#85B0DC',                  // поля-аргументы (fee =) — свежий синий
  constant:    '#A2CDD6',                  // константы — воздушный тил

  // тёплый акцент — методы
  methodDef:   '#FF8CA3',                  // имя в определении (после fun) — якорь
  methodCall:  '#FFAEC0',                  // вызовы — чистый пастельный роуз

  // значения
  string:      '#94C086',                  // строки — свежий зелёный
} as const;

// SyntaxTheme для Manticore (theme:). Базовая раскраска по токенайзеру.
// method = methodDef; вызовы перекрашивает paintCanonMethodCalls().
export const CanonCodeTheme: SyntaxTheme = {
  plain:       Canon.ink,
  punctuation: Canon.punctuation,
  operator:    Canon.punctuation,
  keyword:     Canon.keyword,
  annotation:  Canon.keyword,
  number:      Canon.number,
  type:        Canon.type,
  constant:    Canon.constant,
  method:      Canon.methodDef,
  string:      Canon.string,
  comment:     Canon.comment,
};

const KEYWORDS =
  'class|object|interface|fun|val|var|private|public|internal|protected|' +
  'return|if|else|when|for|while|is|in|to|true|false|throw|null|try|catch|' +
  'finally|override|import|package|@Service';

// Правила поверх темы: явные списки имён там, где токенайзер может ошибиться
// (типы/методы/переменные). Все цвета — из Canon. Последнее совпадение побеждает.
export interface CanonRuleNames {
  types?: string[];
  methods?: string[];
  vars?: string[];
}

export const buildCanonRules = (n: CanonRuleNames = {}): ColorRule[] => {
  const rules: ColorRule[] = [
    {match: /^[a-z][a-zA-Z0-9_]*$/, color: Canon.ink},
    {match: /^[A-Z][a-zA-Z0-9]*$/, color: Canon.type, onlyTypes: ['type'] as const},
    {match: /^[a-z][a-zA-Z0-9_]*$/, color: Canon.methodDef, onlyTypes: ['method'] as const},
    {match: /^[A-Z][A-Z0-9_]+$/, color: Canon.constant},
    {match: new RegExp('^(' + KEYWORDS + ')$'), color: Canon.keyword},
    {match: /./, color: Canon.number, onlyTypes: ['number'] as const},
    {match: /./, color: Canon.string, onlyTypes: ['string'] as const},
  ];
  if (n.vars?.length)
    rules.push({match: new RegExp('^(' + n.vars.join('|') + ')$'), color: Canon.ink});
  if (n.types?.length)
    rules.push({match: new RegExp('^(' + n.types.join('|') + ')$'), color: Canon.type});
  if (n.methods?.length)
    rules.push({match: new RegExp('^(' + n.methods.join('|') + ')$'), color: Canon.methodDef});
  return rules;
};

// ── Пейнтеры для ролей, которых нет в плоской теме ────────────────────
const prevNonSpace = (toks: any[], i: number): string => {
  let p = i - 1;
  while (p >= 0 && toks[p].text.trim() === '') p--;
  return p >= 0 ? toks[p].text.trim() : '';
};
const nextNonSpace = (toks: any[], i: number): string => {
  let nx = i + 1;
  while (nx < toks.length && toks[nx].text.trim() === '') nx++;
  return nx < toks.length ? toks[nx].text.trim() : '';
};

// Поля-аргументы: идентификатор перед `=` (не после val/var) → param.
// Пер-строчная версия — годится как recolorLine-хук в morphTo (чтобы поля
// печатались slate УЖЕ во время морфа, а не вспыхивали белым VAR_LIGHT до
// пост-морф перекраски).
export const paintCanonParamsLine = (line: any, color: string = Canon.param): void => {
  const toks = line.tokens;
  for (let i = 0; i < toks.length; i++) {
    if (!/^[a-z][a-zA-Z0-9_]*$/.test(toks[i].text.trim())) continue;
    if (nextNonSpace(toks, i) !== '=') continue;
    const prev = prevNonSpace(toks, i);
    if (prev === 'val' || prev === 'var') continue;
    toks[i].ref().fill(color);
  }
};

export const paintCanonParams = (mc: Manticore, color: string = Canon.param): void => {
  for (let li = 0; li < mc.lineCount; li++) {
    const line = mc.getLine(li);
    if (line) paintCanonParamsLine(line, color);
  }
};

// Вызовы метода → methodCall; определение (после `fun`) остаётся methodDef.
// Структурно: lowercase-имя, за которым `(`, но НЕ управляющее слово и НЕ после fun.
const CALL_STOP = new Set(['if', 'for', 'while', 'when', 'catch', 'synchronized']);

// Пер-строчная версия — годится как recolorLine-хук в morphTo (чтобы вызовы
// печатались пастелью УЖЕ во время морфа, а не вспыхивали полным rose).
export const paintCanonMethodCallsLine = (line: any, color: string = Canon.methodCall): void => {
  const toks = line.tokens;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i].text.trim();
    if (!/^[a-z][a-zA-Z0-9_]*$/.test(t) || CALL_STOP.has(t)) continue;
    if (nextNonSpace(toks, i) !== '(') continue;      // это вызов/определение
    if (prevNonSpace(toks, i) === 'fun') continue;    // определение — не трогаем
    toks[i].ref().fill(color);
  }
};

export const paintCanonMethodCalls = (mc: Manticore, color: string = Canon.methodCall): void => {
  for (let li = 0; li < mc.lineCount; li++) {
    const line = mc.getLine(li);
    if (line) paintCanonMethodCallsLine(line, color);
  }
};
