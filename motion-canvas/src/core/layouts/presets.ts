import {SafeZone} from '../ScreenGrid';
import {Screen} from '../theme';

export type PresetName = 
  | '2-col'
  | '2L-1R'
  | '2L-2R'
  | 'split-vertical'
  | 'center'
  | 'center-title';

export interface SlotConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SlotsMap {
  [key: string]: SlotConfig;
}

const DEFAULT_GAP = 60;
const TITLE_MARGIN_X = 90;
const TITLE_MARGIN_Y = 80;
const LEFT_BIAS = 70;

export function getSlots(
  preset: PresetName,
  options: {gap?: number; paddingX?: number; paddingY?: number} = {},
): SlotsMap {
  const gap = options.gap ?? DEFAULT_GAP;
  const paddingX = options.paddingX ?? 0;
  const paddingY = options.paddingY ?? 0;

  const safeWidth = SafeZone.right - SafeZone.left - paddingX * 2;
  const safeHeight = SafeZone.bottom - SafeZone.top - paddingY * 2;

  switch (preset) {
    case '2-col': {
      const colWidth = (safeWidth - gap) / 2;
      const leftX = SafeZone.left + paddingX + colWidth / 2;
      const rightX = SafeZone.right - paddingX - colWidth / 2;
      return {
        L: {x: leftX, y: 0, width: colWidth, height: safeHeight},
        R: {x: rightX, y: 0, width: colWidth, height: safeHeight},
      };
    }

    case '2L-1R': {
      const colWidth = (safeWidth - gap) / 2;
      const leftX = SafeZone.left + paddingX + colWidth / 2;
      const rightX = SafeZone.right - paddingX - colWidth / 2;
      const cardHeight = (safeHeight - gap) / 2;
      const topY = SafeZone.top + paddingY + cardHeight / 2;
      const bottomY = SafeZone.bottom - paddingY - cardHeight / 2;
      return {
        L1: {x: leftX, y: topY, width: colWidth, height: cardHeight},
        L2: {x: leftX, y: bottomY, width: colWidth, height: cardHeight},
        R1: {x: rightX, y: 0, width: colWidth, height: safeHeight},
      };
    }

    case '2L-2R': {
      const colWidth = (safeWidth - gap) / 2;
      const leftX = SafeZone.left + paddingX + colWidth / 2;
      const rightX = SafeZone.right - paddingX - colWidth / 2;
      const cardHeight = (safeHeight - gap) / 2;
      const topY = SafeZone.top + paddingY + cardHeight / 2;
      const bottomY = SafeZone.bottom - paddingY - cardHeight / 2;
      return {
        L1: {x: leftX, y: topY, width: colWidth, height: cardHeight},
        L2: {x: leftX, y: bottomY, width: colWidth, height: cardHeight},
        R1: {x: rightX, y: topY, width: colWidth, height: cardHeight},
        R2: {x: rightX, y: bottomY, width: colWidth, height: cardHeight},
      };
    }

    case 'split-vertical': {
      const halfW = Screen.width / 2;
      const leftCenterX = -Screen.width / 4;
      const rightCenterX = Screen.width / 4;
      return {
        L: {x: leftCenterX, y: 0, width: halfW, height: Screen.height},
        R: {x: rightCenterX, y: 0, width: halfW, height: Screen.height},
      };
    }

    case 'center': {
      const cardWidth = Math.min(900, safeWidth * 0.75);
      const cardHeight = Math.min(700, safeHeight * 0.8);
      return {
        C: {x: 0, y: 0, width: cardWidth, height: cardHeight},
      };
    }

    case 'center-title': {
      const maxWidth = Screen.width - TITLE_MARGIN_X * 2;
      const maxHeight = Screen.height - TITLE_MARGIN_Y * 2;
      const left = -Screen.width / 2 + TITLE_MARGIN_X;
      const x = left + maxWidth / 2 - LEFT_BIAS;
      return {
        title: {x, y: 0, width: maxWidth, height: maxHeight},
      };
    }

    default:
      throw new Error(`Unknown preset: ${preset}`);
  }
}

export function getSlot(
  preset: PresetName,
  slotName: string,
  options?: {gap?: number; paddingX?: number; paddingY?: number},
): SlotConfig {
  const slots = getSlots(preset, options);
  const slot = slots[slotName];
  if (!slot) {
    throw new Error(`Slot "${slotName}" not found in preset "${preset}"`);
  }
  return slot;
}

export function offsetSlot(slot: SlotConfig, dx: number, dy: number): SlotConfig {
  return {...slot, x: slot.x + dx, y: slot.y + dy};
}

export function scaleSlot(slot: SlotConfig, scaleW: number, scaleH: number = scaleW): SlotConfig {
  return {...slot, width: slot.width * scaleW, height: slot.height * scaleH};
}
