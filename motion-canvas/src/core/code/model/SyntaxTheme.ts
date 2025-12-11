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
    keyword: '#E6B47C',
    type: '#CEC6BB',
    string: '#B2C7C9',
    number: '#A5C9CA',
    operator: '#70778A',
    punctuation: '#70778A',
    method: '#FCFBF8',
    comment: '#4A505E',
    annotation: '#E6B47C', 
    plain: '#FCFBF8',
};

export function getTokenColor(type: TokenType, theme: SyntaxTheme = IntelliJDarkTheme): string {
    return theme[type];
}
