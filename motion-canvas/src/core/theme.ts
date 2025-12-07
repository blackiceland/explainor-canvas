import { Theme } from './types';

export const StandardTheme: Theme = {
    colors: {
        background: '#F9F7F1',
        surface: '#F0EBE0',
        text: {
            primary: '#1A1A1A',
            muted: '#666666',
            code: '#475f75',
        },
        stroke: {
            primary: '#1A1A1A',
            secondary: '#A0A0A0',
        },
        accent: {
            blue: '#2E86AB',
            red: '#D64045',
        },
    },
    fonts: {
        primary: 'Manrope, sans-serif',
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

export const ExplainorTheme: Theme = {
    colors: {
        background: '#000000',
        surface: '#111111',
        text: {
            primary: '#F4F1EB',
            muted: '#A2A8B5',
            code: '#70778A',
        },
        stroke: {
            primary: '#F4F1EB',
            secondary: '#70778A',
        },
        accent: {
            blue: '#4A9EFF',
            red: '#FF7A1A',
        },
    },
    fonts: {
        primary: 'Inter, sans-serif',
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
