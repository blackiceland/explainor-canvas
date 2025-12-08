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

export const ExplainorCodeTheme: SyntaxTheme = {
    keyword: '#FF7A1A',
    type: '#F4F1EB',
    string: '#F4F1EB',
    number: '#FF7A1A',
    operator: '#F4F1EB',
    punctuation: '#F4F1EB',
    method: '#F4F1EB',
    comment: '#70778A',
    annotation: '#F4F1EB',
    plain: '#F4F1EB',
};

export function getTokenColor(type: TokenType, theme: SyntaxTheme = IntelliJDarkTheme): string {
    return theme[type];
}
