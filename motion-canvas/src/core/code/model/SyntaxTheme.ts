import {TokenType} from './Tokenizer';

export interface SyntaxTheme {
    keyword: string;
    type: string;
    string: string;
    number: string;
    operator: string;
    punctuation: string;
    method: string;
    comment: string;
    annotation: string;
    plain: string;
}

export const IntelliJDarkTheme: SyntaxTheme = {
    keyword: '#CC7832',
    type: '#A9B7C6',
    string: '#6A8759',
    number: '#6897BB',
    operator: '#A9B7C6',
    punctuation: '#A9B7C6',
    method: '#FFC66D',
    comment: '#808080',
    annotation: '#BBB529',
    plain: '#A9B7C6',
};

export const WhiteTheme: SyntaxTheme = {
    keyword: '#FFFFFF',
    type: '#FFFFFF',
    string: '#FFFFFF',
    number: '#FFFFFF',
    operator: '#FFFFFF',
    punctuation: '#FFFFFF',
    method: '#FFFFFF',
    comment: '#70778A',
    annotation: '#FFFFFF',
    plain: '#FFFFFF',
};

// Стильная тема "Expensive Minimal"
export const ExplainorCodeTheme: SyntaxTheme = {
    keyword: '#E6B47C', // Приглушенный золотистый (Gold/Sand) - для структуры (class, return)
    type: '#DBD5CA',    // Основной бежевый (Base Beige) - для типов
    string: '#A5C9CA',  // Очень светлый серо-бирюзовый (Soft Teal) - свежесть для данных
    number: '#A5C9CA',  // Тот же teal для чисел
    operator: '#70778A', // Серый (Muted) - чтобы знаки не шумели
    punctuation: '#70778A', // Серый (Muted)
    method: '#F4F1EB',  // Почти белый (Off-white) - для действий, самый яркий акцент
    comment: '#4A505E', // Темно-серый, едва заметный
    annotation: '#E6B47C', 
    plain: '#DBD5CA',   // Основной текст переменных - бежевый
};

export function getTokenColor(type: TokenType, theme: SyntaxTheme = IntelliJDarkTheme): string {
    return theme[type];
}
