const SAFETY_PX = 2;

let measureCtx: CanvasRenderingContext2D | null = null;

function getContext(): CanvasRenderingContext2D {
  if (measureCtx) return measureCtx;
  
  const anyGlobal = globalThis as any;
  const canvas =
    typeof document !== 'undefined'
      ? document.createElement('canvas')
      : anyGlobal.OffscreenCanvas
        ? new anyGlobal.OffscreenCanvas(1, 1)
        : null;

  if (!canvas) throw new Error('No canvas available for text measurement.');

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D context available for text measurement.');
  
  measureCtx = ctx as CanvasRenderingContext2D;
  return measureCtx;
}

export function textWidth(text: string, fontFamily: string, fontSize: number, fontWeight: number = 400): number {
  const ctx = getContext();
  ctx.font = `normal ${fontWeight} ${fontSize}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

export function ellipsizeEnd(
  text: string,
  maxPx: number,
  fontFamily: string,
  fontSize: number,
  fontWeight: number = 400
): string {
  const ell = '…';
  if (textWidth(text, fontFamily, fontSize, fontWeight) <= maxPx) return text;
  if (textWidth(ell, fontFamily, fontSize, fontWeight) > maxPx) return '';
  
  let lo = 0;
  let hi = text.length;
  
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = text.slice(0, mid) + ell;
    if (textWidth(candidate, fontFamily, fontSize, fontWeight) <= maxPx) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  
  return text.slice(0, lo) + ell;
}

export function ellipsizeMiddle(
  text: string,
  maxPx: number,
  fontFamily: string,
  fontSize: number,
  fontWeight: number = 400
): string {
  const ell = '…';
  if (textWidth(text, fontFamily, fontSize, fontWeight) <= maxPx) return text;
  if (textWidth(ell, fontFamily, fontSize, fontWeight) > maxPx) return ell;

  let lo = 0;
  let hi = text.length;

  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const leftLen = Math.ceil(mid / 2);
    const rightLen = Math.floor(mid / 2);
    const candidate = text.slice(0, leftLen) + ell + text.slice(text.length - rightLen);
    if (textWidth(candidate, fontFamily, fontSize, fontWeight) <= maxPx) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  const leftLen = Math.ceil(lo / 2);
  const rightLen = Math.floor(lo / 2);
  return text.slice(0, leftLen) + ell + text.slice(text.length - rightLen);
}

export function fitText(
  text: string,
  maxPx: number,
  mode: 'end' | 'middle',
  fontFamily: string,
  fontSize: number,
  fontWeight: number = 400
): string {
  const w = Math.max(0, maxPx - SAFETY_PX);
  return mode === 'middle'
    ? ellipsizeMiddle(text, w, fontFamily, fontSize, fontWeight)
    : ellipsizeEnd(text, w, fontFamily, fontSize, fontWeight);
}

