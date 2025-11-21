export interface ColorTheme {
    background: string;
    surface: string;
    text: {
        primary: string;
        secondary: string;
        code: string;
    };
    stroke: {
        primary: string;
        secondary: string;
    };
    status: {
        success: string;
        warning: string;
        error: string;
        info: string;
    }
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