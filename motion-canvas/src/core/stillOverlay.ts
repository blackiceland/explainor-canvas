// Debug grid drawn on top of an exported still (coordinates in Motion Canvas
// space, origin at the canvas centre). Shared by stillRunner and shotRunner.
export function drawOverlay(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  // Visual style: thin + subtle.
  const lineMinor = 'rgba(244,241,235,0.08)';
  const lineMajor = 'rgba(244,241,235,0.12)';
  const axis = 'rgba(244,241,235,0.18)';
  const text = 'rgba(244,241,235,0.55)';
  const tick = 'rgba(244,241,235,0.22)';
  const cellText = 'rgba(244,241,235,0.18)';

  // Grid spacing (px).
  const minorStep = 50;
  const majorStep = 200;

  ctx.save();
  ctx.lineWidth = 1;
  ctx.textBaseline = 'top';
  ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

  const cx = w / 2;
  const cy = h / 2;

  // Grid lines (centered on (0,0) so it always aligns with the scene axes).
  const drawV = (x: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
    ctx.stroke();
  };

  const drawH = (y: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  };

  const maxKx = Math.ceil(cx / minorStep);
  const maxKy = Math.ceil(cy / minorStep);
  for (let k = -maxKx; k <= maxKx; k++) {
    const x = cx + k * minorStep;
    if (x < 0 || x > w) continue;
    const isMajor = (k * minorStep) % majorStep === 0;
    drawV(x, isMajor ? lineMajor : lineMinor);
  }
  for (let k = -maxKy; k <= maxKy; k++) {
    const y = cy + k * minorStep;
    if (y < 0 || y > h) continue;
    const isMajor = (k * minorStep) % majorStep === 0;
    drawH(y, isMajor ? lineMajor : lineMinor);
  }

  // Cell coordinate labels (center of each minor cell).
  // Very light so it doesn't overpower composition.
  ctx.save();
  ctx.fillStyle = cellText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
  const maxCellKx = Math.ceil(cx / minorStep);
  const maxCellKy = Math.ceil(cy / minorStep);
  for (let kx = -maxCellKx; kx < maxCellKx; kx++) {
    for (let ky = -maxCellKy; ky < maxCellKy; ky++) {
      const x0 = cx + kx * minorStep;
      const y0 = cy + ky * minorStep;
      const x1 = x0 + minorStep;
      const y1 = y0 + minorStep;
      if (x1 < 0 || x0 > w || y1 < 0 || y0 > h) continue;

      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      // Coords of the cell center in Motion Canvas coordinate system.
      const xCoord = Math.round((mx - cx) / 1) * 1;
      const yCoord = Math.round((my - cy) / 1) * 1;

      // Keep labels away from the very edge where we already draw axis labels.
      if (mx < 60 || mx > w - 60 || my < 40 || my > h - 40) continue;

      ctx.fillText(`${xCoord},${yCoord}`, mx, my);
    }
  }
  ctx.restore();

  // Axes (center lines).
  ctx.strokeStyle = axis;
  ctx.beginPath();
  ctx.moveTo(cx + 0.5, 0);
  ctx.lineTo(cx + 0.5, h);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, cy + 0.5);
  ctx.lineTo(w, cy + 0.5);
  ctx.stroke();

  // Edge ticks + coordinate labels (major step to keep it readable).
  const tickLen = 8;
  ctx.fillStyle = text;
  ctx.strokeStyle = tick;

  // Top & bottom X labels
  const maxLabelKx = Math.ceil(cx / majorStep);
  for (let k = -maxLabelKx; k <= maxLabelKx; k++) {
    const xCoord = k * majorStep;
    const x = cx + xCoord;
    if (x < 0 || x > w) continue;

    // top tick
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, tickLen);
    ctx.stroke();
    ctx.fillText(String(xCoord), Math.min(w - 40, Math.max(0, x + 3)), 2);

    // bottom tick
    ctx.beginPath();
    ctx.moveTo(x + 0.5, h - tickLen);
    ctx.lineTo(x + 0.5, h);
    ctx.stroke();
    ctx.fillText(String(xCoord), Math.min(w - 40, Math.max(0, x + 3)), h - 16);
  }

  // Left & right Y labels
  ctx.textBaseline = 'middle';
  const maxLabelKy = Math.ceil(cy / majorStep);
  for (let k = -maxLabelKy; k <= maxLabelKy; k++) {
    const yCoord = k * majorStep;
    const y = cy + yCoord;
    if (y < 0 || y > h) continue;

    // left tick
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(tickLen, y + 0.5);
    ctx.stroke();
    ctx.fillText(String(yCoord), 2, y);

    // right tick
    ctx.beginPath();
    ctx.moveTo(w - tickLen, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
    // keep text inside canvas
    ctx.fillText(String(yCoord), w - 42, y);
  }

  ctx.restore();
}
