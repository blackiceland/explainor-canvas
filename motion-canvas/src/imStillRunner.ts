import './global.css';
import project from './imProject?project';
import {Renderer, Vector2} from '@motion-canvas/core';
import {drawOverlay} from './core/stillOverlay';

// Throwaway still runner for the DON'T FIGHT DUPLICATION opening (imProject).
// Same logic as stillRunner.ts, only the project import differs.

async function ensureFontsLoaded(timeoutMs = 10_000): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const families = new Set([...document.fonts].map(f => f.family.replace(/["']/g, '')));
    if (families.has('JetBrains Mono')) break;
    await new Promise(r => setTimeout(r, 100));
  }
  await Promise.all([...document.fonts].map(f => f.load().catch(() => null)));
  await document.fonts.ready;
}

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

async function exportStillWithOverlay(
  renderer: Renderer,
  settings: any,
  globalFrame: number,
  fps: number,
  timeoutMs: number,
  showGrid: boolean,
) {
  const playback = (renderer as any).playback;

  renderer.stage.configure(settings);
  playback.fps = fps;
  await (renderer as any).reloadScenes(settings);
  await playback.recalculate();
  await playback.reset();
  await playback.seek(globalFrame);
  await renderer.stage.render(playback.currentScene, playback.previousScene);

  if (showGrid) drawOverlay(renderer.stage.finalBuffer);

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
  const showGrid = params.get('grid') !== 'off';

  await ensureFontsLoaded();

  const renderer = new Renderer(project);
  const playback = (renderer as any).playback;

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

  let globalFrame = globalFrameParam ?? localFrame;
  if (sceneName) {
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

  await exportStillWithOverlay(renderer, settings as any, globalFrame, fps, timeoutMs, showGrid);

  setStatus('Done');
  $('status').classList.add('ok');
  setDetails(`Saved: ${relPath}`);
  (window as any).__MC_STILL_DONE = true;
}

main().catch(err => {
  (window as any).__MC_STILL_ERROR = String(err instanceof Error ? (err.stack ?? err.message) : err);
  showError(err);
});
