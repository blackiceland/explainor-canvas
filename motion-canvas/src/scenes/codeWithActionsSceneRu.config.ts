import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {ColorRule} from '../core/code/components/Manticore';
import {measureChar, getCodePaddingX} from '../core/code/shared/TextMeasure';
import {Screen} from '../core/theme';

export const CODE_FONT_SIZE = 22;

export const PANEL_W = Screen.width * 5 / 16;
export const PANEL_X = Screen.width / 2 - PANEL_W / 2;
export const DIVIDER_X = PANEL_X - PANEL_W / 2;

export const CODE_RIGHT = DIVIDER_X;
export const CODE_W = CODE_RIGHT - (-Screen.width / 2 + 40);
export const LEFT_CENTER_X = -Screen.width / 2 + 40 + CODE_W / 2;

export const MAX_LINE_CHARS = Math.floor(
  (CODE_W - getCodePaddingX(CODE_FONT_SIZE)) / measureChar(CODE_FONT_SIZE),
);

export const FRAME_W = 420;
export const FRAME_H = 236;
export const FRAME_FILL_NEUTRAL = 'rgba(244, 241, 235, 0.10)';
export const FRAME_FILL_WARM = 'rgba(255, 182, 193, 0.35)';
export const FRAME_STROKE_DONE = 'rgba(244, 241, 235, 0.85)';
export const SCANLINE_COLOR = 'rgba(244, 241, 235, 0.06)';
export const SCANLINE_COUNT = 10;

export const ITEM_GAP = 73;
export const Y_ENCODER = -305;
export const Y_FINALIZE = Y_ENCODER + FRAME_H + ITEM_GAP;

export const FRAME_STROKE = 'rgba(244, 241, 235, 0.50)';
export const GUIDE_COLOR = 'rgba(244, 241, 235, 0.15)';
export const SWEEP_COLOR = 'rgba(244, 230, 200, 0.18)';

export const SOFT_GREEN = 'rgba(168, 214, 178, 0.88)';
export const VAR_LIGHT = 'rgba(244, 241, 235, 0.96)';
export const TYPE_CLEAN = 'rgba(220, 215, 255, 0.80)';
export const METHOD_COLOR = DryFiltersV3CodeTheme.method;
export const PASS_THROUGH = 'rgba(255, 166, 85, 0.95)';   // акцент pass-through переменной — оранжевый (светлее на 15%)

export const CODE_CARD_STYLE = {
  radius: 24, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0, shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
  shadowOffsetX: 0, shadowOffsetY: 0, edge: false,
} as const;

export const COLOR_RULES: ColorRule[] = [
  {match: 'sourceFrames',      color: VAR_LIGHT},
  {match: 'outputFormat',      color: VAR_LIGHT},
  {match: 'colorProfile',      color: VAR_LIGHT},
  {match: 'encodedVideo',      color: VAR_LIGHT},
  {match: /^byte$/,            color: TYPE_CLEAN},
  {match: 'preparedFrames',    color: VAR_LIGHT},
  {match: 'normalizedFrames',  color: VAR_LIGHT},
  {match: 'exportVideo',       color: VAR_LIGHT},
  {match: 'String',            color: TYPE_CLEAN},
  {match: 'validateInput',     color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'runEncoder',        color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'finalizeExport',    color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'normalizeFrames',   color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'applyColorProfile', color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'overlaySubtitles',  color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'encodeWithRetry',   color: METHOD_COLOR, onlyTypes: ['method']},
  {match: /^encode$/,          color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'subtitleTrack',     color: VAR_LIGHT},
  {match: 'coloredFrames',     color: VAR_LIGHT},
  {match: 'attemptsLeft',      color: VAR_LIGHT},
  {match: 'maxAttempts',       color: VAR_LIGHT},
  {match: 'watermarkMode',     color: VAR_LIGHT},
  {match: 'audioProfile',      color: VAR_LIGHT},
  {match: 'subtitledFrames',   color: VAR_LIGHT},
  {match: 'watermarkedFrames', color: VAR_LIGHT},
  {match: 'container',         color: VAR_LIGHT},
  {match: 'isSupportedFormat', color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'applyWatermark',    color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'normalizeAudio',    color: METHOD_COLOR, onlyTypes: ['method']},
  {match: /^"[^"]*"$/,         color: SOFT_GREEN},
];
