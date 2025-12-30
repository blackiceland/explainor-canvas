export const Colors = {
    background: {
        from: '#05060A',
        to: '#0B0D12',
    },
    surface: '#13151A',
    text: {
        primary: '#F4F1EB',
        muted: '#9FA4B4',
    },
    accent: '#FF8CA3',
};

export const Fonts = {
    primary: 'Space Grotesk, Inter, sans-serif',
    code: 'JetBrains Mono, IBM Plex Mono, monospace',
};

export const Screen = {
    width: 1920,
    height: 1080,
};

export const Timing = {
    fast: 0.3,
    normal: 0.6,
    slow: 1.1,
};

import type {Theme} from './types';

export const StandardTheme: Theme = {
    fonts: Fonts,
    colors: {
        background: Colors.background,
        surface: Colors.surface,
        text: Colors.text,
        accent: Colors.accent,
        stroke: {
            primary: 'rgba(255,255,255,0.3)',
        },
    },
    timing: {
        medium: Timing.normal,
    },
};
