export {Colors, Fonts, Screen, Timing, StandardTheme} from '../theme';
export {OpenStyle} from '../openStyle';
export {PanelStyle} from '../panelStyle';

export interface ThemeColors {
  background: {from: string; to: string} | string;
  surface: string;
  text: {primary: string; muted: string};
  accent: string;
}

export interface ThemeFonts {
  primary: string;
  code: string;
}

export interface ThemeTiming {
  fast: number;
  normal: number;
  slow: number;
}

export interface VideoTheme {
  name: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
  timing: ThemeTiming;
  panel: {
    radius: number;
    radiusSmall: number;
    fill: string;
    stroke: string;
    shadowBlur: number;
  };
}

import {Colors, Fonts, Timing} from '../theme';
import {PanelStyle} from '../panelStyle';
import {OpenStyle} from '../openStyle';

export const DarkTheme: VideoTheme = {
  name: 'dark',
  colors: {
    background: Colors.background,
    surface: Colors.surface,
    text: Colors.text,
    accent: Colors.accent,
  },
  fonts: {
    primary: Fonts.primary,
    code: Fonts.code,
  },
  timing: {
    fast: Timing.fast,
    normal: Timing.normal,
    slow: Timing.slow,
  },
  panel: {
    radius: PanelStyle.radius,
    radiusSmall: PanelStyle.radiusSmall,
    fill: PanelStyle.fill,
    stroke: PanelStyle.stroke,
    shadowBlur: PanelStyle.shadowBlur,
  },
};

export const LightTheme: VideoTheme = {
  name: 'light',
  colors: {
    background: OpenStyle.colors.bg,
    surface: OpenStyle.colors.card,
    text: {primary: OpenStyle.colors.ink, muted: OpenStyle.colors.muted},
    accent: OpenStyle.colors.accent,
  },
  fonts: {
    primary: OpenStyle.fonts.sans,
    code: OpenStyle.fonts.mono,
  },
  timing: {
    fast: Timing.fast,
    normal: Timing.normal,
    slow: Timing.slow,
  },
  panel: {
    radius: 22,
    radiusSmall: 16,
    fill: OpenStyle.colors.card,
    stroke: OpenStyle.colors.border,
    shadowBlur: 24,
  },
};
