import './global.css';
import project from './project?project';
import {Renderer, Vector2} from '@motion-canvas/core';
import {drawOverlay} from './core/stillOverlay';

// Multi-frame still exporter.
//
// Why this exists next to stillRunner.ts: that one renders exactly ONE frame per
// page load, and a page load costs two full playthroughs of the WHOLE project —
// `recalculate()` walks every scene in project.ts (92 of them) to measure
// durations. That is where the ~65 s per frame went; the frame itself is cheap.
//
// Two changes, both in the setup rather than in the scene:
//   1. the renderer is built over a ONE-SCENE project (`{...project, scenes:[desc]}`),
//      so `recalculate()` only measures the scene under test;
//   2. one page load renders MANY frames. Frames are sorted ascending, and
//      `PlaybackManager.seek()` advances forward from the current position, so
//      frame N+1 only costs the delta from frame N instead of a replay from 0.
//
// Caveat inherited from seek(): frames between the requested ones are never
// rendered, so anything that snapshots state in `onRender` (three.js scenes)
// still lags. Request a dense sweep when that matters.

async function ensureFontsLoaded(timeoutMs = 10_000): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const families = new Set([...document.fonts].map(f => f.family.replace(/["']/g, '')));
    if (families.has('Newsreader') && families.has('JetBrains Mono')) break;
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

/**
 * Frame spec: comma separated list of
 *   `120`        single frame
 *   `0-300`      inclusive range, step 1
 *   `0-300:15`   inclusive range, step 15
 *   `sweep:12`   12 frames spread evenly over the scene (needs the duration)
 * Always returned deduped and ascending — that is what makes seek incremental.
 */
function parseSpec(spec: string, duration: number): number[] {
  const out: number[] = [];
  for (const token of spec.split(',').map(s => s.trim()).filter(Boolean)) {
    let m: RegExpExecArray | null;
    if ((m = /^sweep:(\d+)$/.exec(token))) {
      const n = Math.max(1, Number(m[1]));
      const last = Math.max(0, duration - 1);
      for (let i = 0; i < n; i++) out.push(Math.round((last * i) / Math.max(1, n - 1)));
    } else if ((m = /^(\d+)-(\d+)(?::(\d+))?$/.exec(token))) {
      const from = Number(m[1]);
      const to = Number(m[2]);
      const step = Math.max(1, Number(m[3] ?? 1));
      for (let f = from; f <= to; f += step) out.push(f);
    } else if (/^\d+$/.test(token)) {
      out.push(Number(token));
    }
  }
  return [...new Set(out)].sort((a, b) => a - b);
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

const tModule = Date.now();

async function main() {
  const tMain = Date.now();
  const params = new URLSearchParams(location.search);

  const sceneName = params.get('scene') ?? '';
  const fps = parseNumber(params.get('fps')) ?? 30;
  const width = parseNumber(params.get('w')) ?? 1920;
  const height = parseNumber(params.get('h')) ?? 1080;
  const showGrid = params.get('grid') === 'on';
  const spec = params.get('frames') ?? '0';
  const timeoutMs = parseNumber(params.get('timeoutMs')) ?? 120_000;
  const tag = params.get('out') || sceneName || 'shot';

  if (!sceneName) throw new Error('missing ?scene=');

  const tFonts = Date.now();
  await ensureFontsLoaded();
  const fontsMs = Date.now() - tFonts;

  // ⚠️ Запись .meta глушится в shot.html на уровне вебсокета — сам MetaFile
  // сюда не дотянуть, bootstrap() держит его у себя. Без этого каждый прогон
  // харнесса переписывал project.meta и дёргал открытый редактор автора.
  const descriptions = project.scenes as any[];
  const description = descriptions.find(s => s?.name === sceneName);
  if (!description) {
    const names = descriptions.map(s => s?.name).filter(Boolean).join(', ');
    throw new Error(`Scene "${sceneName}" not found. Available: ${names}`);
  }

  // One-scene project: `recalculate()` below then walks a single scene.
  const tCtor = Date.now();
  const renderer = new Renderer({...(project as any), scenes: [description]});
  const ctorMs = Date.now() - tCtor;
  const playback = (renderer as any).playback;

  const settings = {
    name: project.name,
    range: [0, 0] as [number, number],
    fps,
    exporter: {
      name: '@motion-canvas/core/image-sequence',
      options: {fileType: 'image/png', quality: 100, groupByScene: false},
    },
    size: new Vector2(width, height),
    resolutionScale: 1,
    colorSpace: 'srgb',
    background: null,
  };

  const state = {
    scene: sceneName,
    fps,
    duration: 0,
    frames: [] as number[],
    results: [] as {frame: number; file: string; ms: number; error?: string}[],
    dir: `output/still/shot/${tag}`,
  };
  (window as any).__SHOT = state;

  // `recalculate()` runs the scene generator end to end just to learn its
  // duration — on a heavy scene that is a whole minute. Only `sweep:N` needs it;
  // explicit frames go straight to seeking, because with a single uncached scene
  // `findBestScene()` always returns it and `reset()` does not depend on timings.
  const needsDuration = /sweep:/.test(spec);

  setStatus(needsDuration ? 'Measuring…' : 'Loading…');
  const tSetup = Date.now();
  const steps: Record<string, number> = {
    moduleToMain: tMain - tModule,
    fonts: fontsMs,
    rendererCtor: ctorMs,
  };
  let tStep = Date.now();
  const mark = (label: string) => {
    steps[label] = Date.now() - tStep;
    tStep = Date.now();
  };

  renderer.stage.configure(settings as any);
  playback.fps = fps;
  mark('configure');
  await (renderer as any).reloadScenes(settings);
  mark('reloadScenes');
  if (needsDuration) {
    await playback.recalculate();
    mark('recalculate');
  }
  await playback.reset();
  mark('reset');
  const setupMs = Date.now() - tSetup;
  (window as any).__SHOT_STEPS = steps;

  state.duration = needsDuration ? playback.duration : 0;
  state.frames = parseSpec(spec, playback.duration);
  (window as any).__SHOT_SETUP_MS = setupMs;

  if (state.frames.length === 0) throw new Error(`frame spec "${spec}" resolved to nothing`);

  const durationText = needsDuration
    ? `duration=${playback.duration}f (${(playback.duration / fps).toFixed(2)}s) `
    : '';
  setDetails(
    `scene=${sceneName} ${durationText}setup=${(setupMs / 1000).toFixed(1)}s frames=${state.frames.length}`,
  );

  for (const frame of state.frames) {
    const t0 = Date.now();
    const padded = String(frame).padStart(6, '0');
    try {
      await playback.seek(frame);
      await renderer.stage.render(playback.currentScene, playback.previousScene);
      if (showGrid) drawOverlay(renderer.stage.finalBuffer);

      if (!import.meta.hot) throw new Error('HMR is not available.');
      import.meta.hot.send('motion-canvas:export', {
        frame,
        name: padded,
        data: renderer.stage.finalBuffer.toDataURL('image/png'),
        mimeType: 'image/png',
        subDirectories: ['still', 'shot', tag],
      });
      await waitForAck(frame, timeoutMs);
      state.results.push({frame, file: `${state.dir}/${padded}.png`, ms: Date.now() - t0});
    } catch (e) {
      state.results.push({
        frame,
        file: '',
        ms: Date.now() - t0,
        error: String(e instanceof Error ? e.message : e),
      });
    }
    setStatus(`Rendered ${state.results.length}/${state.frames.length}`);
  }

  setStatus('Done');
  $('status').classList.add('ok');
  setDetails(`${state.results.length} frame(s) -> ${state.dir}`);
  (window as any).__SHOT_DONE = true;
}

main().catch(err => {
  (window as any).__SHOT_ERROR = String(err instanceof Error ? (err.stack ?? err.message) : err);
  showError(err);
});
