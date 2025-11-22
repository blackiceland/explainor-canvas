export interface ColorTheme {
    background: string;
    surface: string;
    text: {
        primary: string;
        muted: string;
        code: string;
    };
    stroke: {
        primary: string;
        secondary: string;
    };
    accent: {
        blue: string;
        red: string;
    };
}

export interface Theme {
    colors: ColorTheme;
    fonts: {
        primary: string;
        code: string;
    }
    spacing: {
        small: number;
        medium: number;
        large: number;
    }
    timing: {
        fast: number;
        medium: number;
        slow: number;
    };
}