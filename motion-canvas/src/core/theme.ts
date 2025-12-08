export interface TextColors {
    primary: string;
    muted: string;
    code: string;
}

export interface StrokeColors {
    primary: string;
    secondary: string;
}

export interface AccentColors {
    blue: string;
    red: string;
}

export interface GradientConfig {
    from: string;
    to: string;
    angle: number;
}

export interface Colors {
    background: string;
    backgroundGradient?: GradientConfig;
    surface: string;
    text: TextColors;
    stroke: StrokeColors;
    accent: AccentColors;
}

export interface Fonts {
    primary: string;
    code: string;
}

export interface Spacing {
    small: number;
    medium: number;
    large: number;
}

export interface Timing {
    fast: number;
    medium: number;
    slow: number;
}

export interface Theme {
    colors: Colors;
    fonts: Fonts;
    spacing: Spacing;
    timing: Timing;
}

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
        background: '#05070B',
        backgroundGradient: {
            from: '#05070B',
            to: '#0B0E14',
            angle: 135,
        },
        surface: '#11141C',
        text: {
            primary: '#F4F1EB',
            muted: '#70778A',
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
        primary: 'Space Grotesk, Inter, sans-serif',
        code: 'JetBrains Mono, IBM Plex Mono, monospace',
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

export function createGradientFill(gradient: GradientConfig): string {
    const { from, to, angle } = gradient;
    return `linear-gradient(${angle}deg, ${from}, ${to})`;
}
