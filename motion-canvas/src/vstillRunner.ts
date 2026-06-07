import project from './verticalProject?project';
import {Renderer, Vector2} from '@motion-canvas/core';

type ExportAck = {frame: number};

function $(id: string) {
  return document.getElementById(id)!;
}
function setStatus(text: string) { $('status').textContent = text; }
function setDetails(text: string) { $('details').textContent = text; }
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
  if (!import.meta.hot) throw new Error('HMR not available. Run via npm run dev.');
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Timeout ack frame=${targetFrame}`)); }, timeoutMs);
    const onAck = (payload: ExportAck) => { if (payload?.frame === targetFrame) { cleanup(); resolve(); } };
    const cleanup = () => { clearTimeout(timer); import.meta.hot?.off('motion-canvas:export-ack', onAck as any); };
    import.meta.hot.on('motion-canvas:export-ack', onAck as any);
  });
}

function drawOverlay(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2;
  const minorStep = 50, majorStep = 200;
  ctx.save();
  ctx.lineWidth = 1;
  const drawV = (x: number, c: string) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke(); };
  const drawH = (y: number, c: string) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke(); };
  const maxKx = Math.ceil(cx / minorStep), maxKy = Math.ceil(cy / minorStep);
  for (let k = -maxKx; k <= maxKx; k++) { const x = cx + k * minorStep; if (x < 0 || x > w) continue; drawV(x, (k * minorStep) % majorStep === 0 ? 'rgba(244,241,235,0.12)' : 'rgba(244,241,235,0.06)'); }
  for (let k = -maxKy; k <= maxKy; k++) { const y = cy + k * minorStep; if (y < 0 || y > h) continue; drawH(y, (k * minorStep) % majorStep === 0 ? 'rgba(244,241,235,0.12)' : 'rgba(244,241,235,0.06)'); }
  ctx.strokeStyle = 'rgba(244,241,235,0.20)';
  ctx.beginPath(); ctx.moveTo(cx + 0.5, 0); ctx.lineTo(cx + 0.5, h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, cy + 0.5); ctx.lineTo(w, cy + 0.5); ctx.stroke();
  ctx.fillStyle = 'rgba(244,241,235,0.55)';
  ctx.font = '13px monospace'; ctx.textBaseline = 'top';
  const maxLabelKx = Math.ceil(cx / majorStep);
  for (let k = -maxLabelKx; k <= maxLabelKx; k++) { const x = cx + k * majorStep; if (x < 0 || x > w) continue; ctx.fillText(String(k * majorStep), Math.min(w - 40, Math.max(0, x + 3)), 2); }
  ctx.textBaseline = 'middle';
  const maxLabelKy = Math.ceil(cy / majorStep);
  for (let k = -maxLabelKy; k <= maxLabelKy; k++) { const y = cy + k * majorStep; if (y < 0 || y > h) continue; ctx.fillText(String(k * majorStep), 2, y); }
  ctx.restore();
}

async function exportStill(renderer: Renderer, settings: any, globalFrame: number, fps: number, timeoutMs: number, overlay: boolean) {
  const playback = (renderer as any).playback;
  renderer.stage.configure(settings);
  playback.fps = fps;
  await (renderer as any).reloadScenes(settings);
  await playback.recalculate();
  await playback.reset();
  await playback.seek(globalFrame);
  await renderer.stage.render(playback.currentScene, playback.previousScene);
  if (overlay) drawOverlay(renderer.stage.finalBuffer);
  if (!import.meta.hot) throw new Error('HMR not available.');
  import.meta.hot.send('motion-canvas:export', {
    frame: globalFrame, name: String(globalFrame).padStart(6, '0'),
    data: renderer.stage.finalBuffer.toDataURL('image/png'),
    mimeType: 'image/png', subDirectories: ['vstill', project.name],
  });
  await waitForAck(globalFrame, timeoutMs);
}

async function main() {
  const params = new URLSearchParams(location.search);
  const fps = parseNumber(params.get('fps')) ?? 60;
  const localFrame = parseNumber(params.get('frame')) ?? 0;
  const sceneName = params.get('scene') ?? '';
  const overlay = params.get('overlay') === '1';
  const timeoutMs = parseNumber(params.get('timeoutMs')) ?? 60_000;

  const renderer = new Renderer(project);
  const playback = (renderer as any).playback;
  const settings = {
    name: project.name, range: [0, 0] as [number, number], fps,
    exporter: { name: '@motion-canvas/core/image-sequence', options: {fileType: 'image/png', quality: 100, groupByScene: false} },
    size: new Vector2(1080, 1920), resolutionScale: 1, colorSpace: 'srgb', background: null,
  };

  let globalFrame = localFrame;
  if (sceneName) {
    renderer.stage.configure(settings);
    playback.fps = fps;
    await (renderer as any).reloadScenes(settings);
    await playback.recalculate();
    const scenes = playback.onScenesRecalculated?.current ?? [];
    const scene = scenes.find((s: any) => s?.name === sceneName);
    if (!scene) throw new Error(`Scene "${sceneName}" not found. Available: ${scenes.map((s: any) => s?.name).filter(Boolean).join(', ')}`);
    globalFrame = (scene.firstFrame ?? 0) + localFrame;
  }

  const relPath = `output/vstill/${project.name}/${String(globalFrame).padStart(6, '0')}.png`;
  (window as any).__MC_STILL = {project: project.name, scene: sceneName || null, fps, localFrame, globalFrame, output: relPath};
  setStatus('Exporting…');
  setDetails(`scene=${sceneName} globalFrame=${globalFrame} fps=${fps}`);
  await exportStill(renderer, settings as any, globalFrame, fps, timeoutMs, overlay);
  setStatus('Done'); $('status').classList.add('ok'); setDetails(`Saved: ${relPath}`);
  (window as any).__MC_STILL_DONE = true;
}

main().catch(err => {
  (window as any).__MC_STILL_ERROR = String(err instanceof Error ? (err.stack ?? err.message) : err);
  showError(err);
});
