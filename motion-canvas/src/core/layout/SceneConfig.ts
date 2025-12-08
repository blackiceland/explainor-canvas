export interface ScreenSize {
    width: number;
    height: number;
}

export interface CodeStyle {
    fontFamily: string;
    fontSize: number;
    lineHeightRatio: number;
    charWidthRatio: number;
}

export interface TextStyle {
    fontFamily: string;
    titleSize: number;
    titleWeight: number;
    titleTracking: number;
    bodySize: number;
    bodyLineHeight: number;
}

export interface CardStyle {
    fill: string;
    radius: number;
    shadowX: number;
    shadowY: number;
    shadowBlur: number;
    shadowSpread: number;
    shadowColor: string;
    paddingTop: number;
    paddingLeft: number;
    paddingRight: number;
    paddingBottom: number;
}

export interface LayoutMargins {
    left: number;
    right: number;
    top: number;
    gap: number;
}

export interface TermCodeLayout {
    textColumnPercent: number;
    codeColumnPercent: number;
}

export interface TimingConfig {
    textFadeIn: number;
    textFadeDelay: number;
    cardFadeIn: number;
    cardFadeDelay: number;
    codeFadeIn: number;
    highlightDuration: number;
    cameraZoomDuration: number;
    cameraZoomScale: number;
}

export interface AnimationOffsets {
    textStartY: number;
    cardStartX: number;
}

export interface SceneConfigType {
    screen: ScreenSize;
    margins: LayoutMargins;
    termCodeLayout: TermCodeLayout;
    text: TextStyle;
    code: CodeStyle;
    card: CardStyle;
    timing: TimingConfig;
    animation: AnimationOffsets;
}

export const SceneConfig: SceneConfigType = {
    screen: {
        width: 1920,
        height: 1080,
    },
    margins: {
        left: 160,
        right: 160,
        top: 220,
        gap: 40,
    },
    termCodeLayout: {
        textColumnPercent: 0.4,
        codeColumnPercent: 0.6,
    },
    text: {
        fontFamily: 'Space Grotesk, Inter, sans-serif',
        titleSize: 80,
        titleWeight: 600,
        titleTracking: 0.04,
        bodySize: 26,
        bodyLineHeight: 1.4,
    },
    code: {
        fontFamily: 'JetBrains Mono, IBM Plex Mono, monospace',
        fontSize: 24,
        lineHeightRatio: 1.5,
        charWidthRatio: 0.6,
    },
    card: {
        fill: '#11141C',
        radius: 24,
        shadowX: 0,
        shadowY: 40,
        shadowBlur: 80,
        shadowSpread: 0,
        shadowColor: 'rgba(0, 0, 0, 0.65)',
        paddingTop: 40,
        paddingLeft: 52,
        paddingRight: 52,
        paddingBottom: 52,
    },
    timing: {
        textFadeIn: 0.4,
        textFadeDelay: 0,
        cardFadeIn: 0.5,
        cardFadeDelay: 0.3,
        codeFadeIn: 0.3,
        highlightDuration: 0.4,
        cameraZoomDuration: 10,
        cameraZoomScale: 1.03,
    },
    animation: {
        textStartY: 20,
        cardStartX: 40,
    },
};

export function getWorkableWidth(config: SceneConfigType = SceneConfig): number {
    return config.screen.width - config.margins.left - config.margins.right;
}

export function getTextColumnWidth(config: SceneConfigType = SceneConfig): number {
    return getWorkableWidth(config) * config.termCodeLayout.textColumnPercent;
}

export function getCodeColumnWidth(config: SceneConfigType = SceneConfig): number {
    return getWorkableWidth(config) * config.termCodeLayout.codeColumnPercent;
}
