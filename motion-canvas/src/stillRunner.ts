import project from './project?project';
import {Renderer, Vector2} from '@motion-canvas/core';

type ExportAck = {frame: number};

function $(id: string) {
  return document.getElementById(id)!;
}

function setStatus(text: string) {
  $('status').textContent = text;
}

function setDetails(text: string) {
  $('details').textContent = text;
}

function showError(err: unknown) {
  const pre = $('error');
  pre.style.display = 'block';
  pre.textContent = String(err instanceof Error ? (err.stack ?? err.message) : err);
  setStatus('Error');
}

function parseNumber(v: string | null): number | null {
  if (v == null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function waitForAck(targetFrame: number, timeoutMs: number): Promise<void> {
  if (!import.meta.hot) {
    throw new Error('HMR is not available. Run via `npm run dev` (Vite dev server).');
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for export ack for frame=${targetFrame}`));
    }, timeoutMs);

    const onAck = (payload: ExportAck) => {
      if (payload?.frame === targetFrame) {
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      import.meta.hot?.off('motion-canvas:export-ack', onAck as any);
    };

    import.meta.hot.on('motion-canvas:export-ack', onAck as any);
  });
}

function drawOverlay(canvas: HTMLCanvasElement) {
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

async function exportStillWithOverlay(
  renderer: Renderer,
  settings: any,
  globalFrame: number,
  fps: number,
  timeoutMs: number,
) {
  const playback = (renderer as any).playback;

  renderer.stage.configure(settings);
  playback.fps = fps;
  await (renderer as any).reloadScenes(settings);
  await playback.recalculate();
  await playback.reset();
  await playback.seek(globalFrame);
  await renderer.stage.render(playback.currentScene, playback.previousScene);

  // Draw overlay onto the rendered frame.
  drawOverlay(renderer.stage.finalBuffer);

  if (!import.meta.hot) {
    throw new Error('HMR is not available. Run via `npm run dev` (Vite dev server).');
  }

  import.meta.hot.send('motion-canvas:export', {
    frame: globalFrame,
    name: String(globalFrame).padStart(6, '0'),
    data: renderer.stage.finalBuffer.toDataURL('image/png'),
    mimeType: 'image/png',
    subDirectories: ['still', project.name],
  });

  await waitForAck(globalFrame, timeoutMs);
}

async function main() {
  const params = new URLSearchParams(location.search);

  const fps = parseNumber(params.get('fps')) ?? 60;
  const localFrame = parseNumber(params.get('frame')) ?? 0;
  const globalFrameParam = parseNumber(params.get('globalFrame'));
  const sceneName = params.get('scene') ?? '';
  const timeoutMs = parseNumber(params.get('timeoutMs')) ?? 60_000;

  const renderer = new Renderer(project);
  const playback = (renderer as any).playback;

  // Minimal settings for rendering a single frame.
  const settings = {
    name: project.name,
    range: [0, 0] as [number, number],
    fps,
    exporter: {
      name: '@motion-canvas/core/image-sequence',
      options: {fileType: 'image/png', quality: 100, groupByScene: false},
    },
    size: new Vector2(1920, 1080),
    resolutionScale: 1,
    colorSpace: 'srgb',
    background: null,
  };

  // Compute global frame (project timeline) if `scene` is provided.
  let globalFrame = globalFrameParam ?? localFrame;
  if (sceneName) {
    // Prepare playback timings so we can access scene offsets (firstFrame).
    renderer.stage.configure(settings);
    playback.fps = fps;
    await (renderer as any).reloadScenes(settings);
    await playback.recalculate();

    const scenes = playback.onScenesRecalculated?.current ?? [];
    const scene = scenes.find((s: any) => s?.name === sceneName);
    if (!scene) {
      const names = scenes.map((s: any) => s?.name).filter(Boolean).join(', ');
      throw new Error(`Scene "${sceneName}" not found. Available: ${names}`);
    }
    globalFrame = (scene.firstFrame ?? 0) + localFrame;
  }

  const padded = String(globalFrame).padStart(6, '0');
  const relPath = `output/still/${project.name}/${padded}.png`;

  (window as any).__MC_STILL = {
    project: project.name,
    scene: sceneName || null,
    fps,
    localFrame,
    globalFrame,
    output: relPath,
  };

  setStatus('Exporting…');
  setDetails(`project=${project.name} scene=${sceneName || '(timeline)'} globalFrame=${globalFrame} fps=${fps}`);

  await exportStillWithOverlay(renderer, settings as any, globalFrame, fps, timeoutMs);

  setStatus('Done');
  $('status').classList.add('ok');
  setDetails(`Saved: ${relPath}`);
  (window as any).__MC_STILL_DONE = true;
}

main().catch(err => {
  (window as any).__MC_STILL_ERROR = String(err instanceof Error ? (err.stack ?? err.message) : err);
  showError(err);
});


