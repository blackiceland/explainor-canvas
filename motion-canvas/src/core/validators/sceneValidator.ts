import {
  isSafeZoneCompliant,
  isMinFontSize,
  isValidTiming,
  MIN_FONT_SIZE,
} from './rules';

export interface ValidationError {
  code: string;
  message: string;
  path?: string;
  value?: unknown;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface SceneValidationOptions {
  checkSafeZone?: boolean;
  checkFontSize?: boolean;
  checkTiming?: boolean;
  strict?: boolean;
}

const DEFAULT_OPTIONS: Required<SceneValidationOptions> = {
  checkSafeZone: true,
  checkFontSize: true,
  checkTiming: true,
  strict: false,
};

export function validateBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  name?: string,
): ValidationError | null {
  if (!isSafeZoneCompliant(x, y, width, height)) {
    return {
      code: 'SAFE_ZONE_VIOLATION',
      message: `Element ${name ?? 'unknown'} extends outside safe zone`,
      path: name,
      value: {x, y, width, height},
      suggestion: 'Use getSlots() from layouts/presets for positioning',
    };
  }
  return null;
}

export function validateFontSize(
  fontSize: number,
  name?: string,
): ValidationError | null {
  if (!isMinFontSize(fontSize)) {
    return {
      code: 'FONT_SIZE_TOO_SMALL',
      message: `Font size ${fontSize} is below minimum ${MIN_FONT_SIZE}`,
      path: name,
      value: fontSize,
      suggestion: `Use fontSize >= ${MIN_FONT_SIZE}`,
    };
  }
  return null;
}

export function validateTiming(
  duration: number,
  name?: string,
): ValidationError | null {
  if (!isValidTiming(duration)) {
    return {
      code: 'INVALID_TIMING',
      message: `Timing ${duration} is out of valid range`,
      path: name,
      value: duration,
      suggestion: 'Use Timing.fast, Timing.normal, or Timing.slow',
    };
  }
  return null;
}

export interface ElementDescriptor {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
}

export interface TimingDescriptor {
  name: string;
  duration: number;
}

export function validateScene(
  elements: ElementDescriptor[],
  timings: TimingDescriptor[] = [],
  options: SceneValidationOptions = {},
): ValidationResult {
  const opts = {...DEFAULT_OPTIONS, ...options};
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (opts.checkSafeZone) {
    for (const el of elements) {
      const error = validateBounds(el.x, el.y, el.width, el.height, el.name);
      if (error) {
        errors.push(error);
      }
    }
  }

  if (opts.checkFontSize) {
    for (const el of elements) {
      if (el.fontSize !== undefined) {
        const error = validateFontSize(el.fontSize, el.name);
        if (error) {
          errors.push(error);
        }
      }
    }
  }

  if (opts.checkTiming) {
    for (const t of timings) {
      const error = validateTiming(t.duration, t.name);
      if (error) {
        if (opts.strict) {
          errors.push(error);
        } else {
          warnings.push(error);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push('✓ Validation passed');
  } else {
    lines.push('✗ Validation failed');
  }

  if (result.errors.length > 0) {
    lines.push('');
    lines.push('Errors:');
    for (const err of result.errors) {
      lines.push(`  [${err.code}] ${err.message}`);
      if (err.suggestion) {
        lines.push(`    → ${err.suggestion}`);
      }
    }
  }

  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const warn of result.warnings) {
      lines.push(`  [${warn.code}] ${warn.message}`);
      if (warn.suggestion) {
        lines.push(`    → ${warn.suggestion}`);
      }
    }
  }

  return lines.join('\n');
}

