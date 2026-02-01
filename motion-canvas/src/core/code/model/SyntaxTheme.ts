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
    constant: string;
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
    constant: '#9876AA',
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
    constant: '#FFFFFF',
    plain: '#FFFFFF',
};

export const ExplainorCodeTheme: SyntaxTheme = {
    keyword: '#F2A25F',
    type: '#D3DBEC',
    string: '#F2C37B',
    number: '#FF9A4A',
    operator: '#D3CCBF',
    punctuation: 'rgba(252,251,248,0.70)',
    method: '#E8CFAE',
    comment: '#6E7380',
    annotation: '#F2A25F',
    constant: '#A8D8C0',
    plain: '#FCFBF8',
};

// V3 code look used in dryFiltersSceneV3 (dark UI text, subtle punctuation, accent methods).
export const DryFiltersV3CodeTheme: SyntaxTheme = {
    plain: 'rgba(244,241,235,0.72)',
    punctuation: 'rgba(244,241,235,0.58)',
    operator: 'rgba(244,241,235,0.58)',
    keyword: 'rgba(163,205,255,0.82)',
    annotation: 'rgba(163,205,255,0.82)',
    type: 'rgba(201,180,255,0.78)',
    constant: 'rgba(201,180,255,0.78)',
    method: '#FF8CA3',
    string: 'rgba(244,241,235,0.72)',
    number: 'rgba(201,180,255,0.78)',
    comment: 'rgba(244,241,235,0.45)',
};

// Theme for code on LIGHT (beige) background — high contrast, dark tones.
export const LightBgCodeTheme: SyntaxTheme = {
    plain: '#1F1A14',         // Near-black brown (main text)
    punctuation: '#3D3428',   // Dark brown-gray
    operator: '#2A241C',      // Very dark brown
    keyword: '#5C1A00',       // Deep burnt orange
    annotation: '#6B3A00',    // Dark orange-brown (NOT gold!)
    type: '#1A0F05',          // Almost black
    constant: '#4A2800',      // Dark brown
    method: '#7A2E00',        // Burnt sienna (visible)
    string: '#2D4A1A',        // Dark forest green
    number: '#6B0000',        // Deep maroon
    comment: '#5A5048',       // Dark gray-brown (visible but muted)
};

export function getTokenColor(type: TokenType, theme: SyntaxTheme = IntelliJDarkTheme): string {
    return theme[type];
}
