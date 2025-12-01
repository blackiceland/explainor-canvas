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

export function getTokenColor(type: TokenType, theme: SyntaxTheme = IntelliJDarkTheme): string {
    return theme[type];
}
