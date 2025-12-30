export interface Position {
    readonly x: number;
    readonly y: number;
}

export interface ThemeFonts {
    primary: string;
    code: string;
}

export interface ThemeColors {
    background: {
        from: string;
        to: string;
    };
    surface: string;
    text: {
        primary: string;
        muted: string;
    };
    accent: string;
    stroke: {
        primary: string;
    };
}

export interface ThemeTiming {
    medium: number;
}

export interface Theme {
    fonts: ThemeFonts;
    colors: ThemeColors;
    timing: ThemeTiming;
}