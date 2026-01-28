import {SafeZone} from '../ScreenGrid';
import {Timing} from '../theme';

export const MIN_FONT_SIZE = 14;
export const MAX_TIMING = 5.0;
export const MIN_TIMING = 0.01;

export function isSafeZoneCompliant(
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  const left = x - width / 2;
  const right = x + width / 2;
  const top = y - height / 2;
  const bottom = y + height / 2;

  return (
    left >= SafeZone.left &&
    right <= SafeZone.right &&
    top >= SafeZone.top &&
    bottom <= SafeZone.bottom
  );
}

export function isMinFontSize(fontSize: number): boolean {
  return fontSize >= MIN_FONT_SIZE;
}

export function isValidTiming(duration: number): boolean {
  return duration >= MIN_TIMING && duration <= MAX_TIMING;
}

export function isStandardTiming(duration: number): boolean {
  const standardValues = [Timing.micro, Timing.beat, Timing.fast, Timing.normal, Timing.slow];
  const tolerance = 0.001;
  return standardValues.some(v => Math.abs(v - duration) < tolerance);
}

export function suggestTiming(duration: number): string {
  if (duration <= 0.12) return 'Timing.micro';
  if (duration <= 0.26) return 'Timing.beat';
  if (duration <= 0.45) return 'Timing.fast';
  if (duration <= 0.85) return 'Timing.normal';
  return 'Timing.slow';
}

