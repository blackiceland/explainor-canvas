import { Theme } from './types';

export const StandardTheme: Theme = {
    colors: {
        background: '#F9F7F1', // Warm beige
        surface: '#F0EBE0',
        text: {
            primary: '#1A1A1A', // Ink
            muted: '#666666',
            code: '#475f75',
        },
        stroke: {
            primary: '#1A1A1A', // Ink
            secondary: '#A0A0A0',
        },
        accent: {
            blue: '#2E86AB', // Architectural Blue
            red: '#D64045', // Warm Red
        },
    },
    fonts: {
        primary: 'JetBrains Mono, monospace',
        code: 'JetBrains Mono, monospace',
    },
    spacing: {
        small: 16,
        medium: 32,
        large: 64,
    },
    timing: {
        fast: 0.3,
        medium: 0.6,
        slow: 1.2,
    },
};